const ADMIN_AVAILABILITY_SHEET = '不可預約時段';
const ADMIN_AVAILABILITY_SOURCE_MANUAL = 'MANUAL';
const ADMIN_AVAILABILITY_SOURCE_QUICK = 'QUICK_SLOT';
const ADMIN_TZ = 'Asia/Taipei';
const ADMIN_HOLIDAY_CALENDAR_ID = 'zh.taiwan#holiday@group.v.calendar.google.com';
const ADMIN_AVAILABILITY_SLOTS = [
  { code: 'MORNING', label: '早上', start: '10:00', end: '12:00' },
  { code: 'AFTERNOON', label: '下午', start: '13:00', end: '16:00' },
  { code: 'EVENING', label: '晚上', start: '19:30', end: '22:30' }
];

function getAdminAvailability(sessionToken, year, month) {
  requireFreshAdminPermission_(sessionToken, null, '權限不足。');
  const result = buildAvailabilityMonth_(year, month, true);
  result.manualBlocks = listManualAvailabilityBlocks_(year, month).filter(function (item) {
    return item.source !== ADMIN_AVAILABILITY_SOURCE_QUICK;
  });
  return result;
}

function getPublicAvailability_(year, month) {
  try {
    const result = buildAvailabilityMonth_(year, month, false);
    return {
      avail: result.avail,
      holidays: result.holidays,
      calendarConnected: result.calendarConnected
    };
  } catch (error) {
    return { error: String(error && error.message || error), avail: [], holidays: [] };
  }
}

function buildAvailabilityMonth_(year, month, includeAdminDetails) {
  year = Number(year);
  month = Number(month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('月份不正確。');
  }
  const today = new Date();
  const requested = new Date(year, month - 1, 1);
  const earliest = new Date(today.getFullYear(), today.getMonth(), 1);
  const latest = new Date(today.getFullYear() + 2, today.getMonth(), 1);
  if (requested < earliest || requested > latest) throw new Error('只能查詢本月起兩年內的資料。');

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const holidays = getAdminHolidayRows_(year, month);
  const holidayMap = new Map(holidays.map(function (item) { return [item.date, item.title]; }));
  const manualBlocks = readAdminManualBlocks_(monthStart, monthEnd);
  const inventoryUsage = readExistingAvailabilityUsage_(year, month);
  const calendarResult = readGoogleCalendarBusy_(monthStart, monthEnd);
  const busy = manualBlocks.concat(calendarResult.busy);
  const avail = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dateKey = Utilities.formatDate(date, ADMIN_TZ, 'yyyy-MM-dd');
    const isRedDay = date.getDay() === 0 || date.getDay() === 6 || holidayMap.has(dateKey);
    ADMIN_AVAILABILITY_SLOTS.forEach(function (slot) {
      const slotStart = dateAtAdminTime_(date, slot.start);
      const slotEnd = dateAtAdminTime_(date, slot.end);
      const baseMinutes = (isRedDay || slot.code === 'EVENING')
        ? Math.round((slotEnd - slotStart) / 60000)
        : 0;
      let blockedMinutes = 0;
      const reasons = [];
      busy.forEach(function (block) {
        const overlap = overlapMinutes_(slotStart, slotEnd, block.start, block.end);
        if (overlap <= 0) return;
        blockedMinutes += overlap;
        if (includeAdminDetails && block.reason && !reasons.includes(block.reason)) reasons.push(block.reason);
      });
      const usedMinutes = Number(inventoryUsage.get(dateKey + '|' + slot.code) || 0);
      const availableMinutes = Math.max(0, baseMinutes - Math.min(baseMinutes, blockedMinutes) - usedMinutes);
      const status = availableMinutes <= 0 ? '額滿' : (availableMinutes <= 60 ? '少量' : '開放');
      const quickBlocked = busy.some(function (block) {
        return block.source === ADMIN_AVAILABILITY_SOURCE_QUICK && overlapMinutes_(slotStart, slotEnd, block.start, block.end) > 0;
      });
      avail.push({
        date: dateKey,
        slot: slot.code,
        start: slot.start,
        end: slot.end,
        availableMinutes: availableMinutes,
        status: status,
        blocked: includeAdminDetails ? reasons.join('、') : (blockedMinutes > 0 ? '不可預約' : ''),
        remaining: availableMinutes > 0 ? slot.start + '–' + slot.end : '',
        usedMinutes: usedMinutes,
        isRedDay: isRedDay,
        quickBlocked: includeAdminDetails ? quickBlocked : false,
        canQuickEdit: includeAdminDetails ? (baseMinutes > 0 && (availableMinutes > 0 || quickBlocked)) : false
      });
    });
  }

  return {
    success: true,
    year: year,
    month: month,
    avail: avail,
    holidays: addWeekendHolidayRows_(year, month, holidays),
    calendarConnected: calendarResult.connected,
    calendarName: includeAdminDetails ? calendarResult.calendarName : '',
    calendarWarning: includeAdminDetails ? calendarResult.warning : ''
  };
}

function addAvailabilityBlock(sessionToken, payload) {
  const session = requireFreshAdminPermission_(sessionToken, 'canEditOrder', '你沒有修改可預約時間的權限。');
  payload = payload || {};
  const date = parseAdminDate_(payload.date);
  const start = cleanAdminText_(payload.start, 5);
  const end = cleanAdminText_(payload.end, 5);
  const note = cleanAdminText_(payload.note, 160) || '手動設定';
  if (!date) throw new Error('請選擇正確日期。');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) throw new Error('開始或結束時間不正確。');
  if (dateAtAdminTime_(date, end) <= dateAtAdminTime_(date, start)) throw new Error('結束時間必須晚於開始時間。');

  const sheet = ensureAdminBlockedSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const row = new Array(headers.length).fill('');
  putBlockedValue_(row, headers, ['日期'], date);
  putBlockedValue_(row, headers, ['開始時間'], start);
  putBlockedValue_(row, headers, ['結束時間'], end);
  putBlockedValue_(row, headers, ['預留開始時間'], start);
  putBlockedValue_(row, headers, ['預留結束時間'], end);
  putBlockedValue_(row, headers, ['備註'], note);
  putBlockedValue_(row, headers, ['來源'], ADMIN_AVAILABILITY_SOURCE_MANUAL);
  putBlockedValue_(row, headers, ['建立時間'], new Date());
  putBlockedValue_(row, headers, ['建立者'], session.email);
  sheet.appendRow(row);
  return { success: true, message: '已新增不可預約時段。' };
}

function saveAvailabilitySlotChanges(sessionToken, changes) {
  const session = requireFreshAdminPermission_(sessionToken, 'canEditOrder', '你沒有修改可預約時間的權限。');
  if (!Array.isArray(changes) || !changes.length) throw new Error('目前沒有需要儲存的時段。');
  if (changes.length > 93) throw new Error('一次修改的時段過多。');
  const slotMap = new Map(ADMIN_AVAILABILITY_SLOTS.map(function (slot) { return [slot.code, slot]; }));
  const prepared = changes.map(function (change) {
    const date = parseAdminDate_(change.date);
    const slot = slotMap.get(String(change.slot || '').trim());
    if (!date || !slot) throw new Error('包含不正確的日期或時段。');
    return {
      date: Utilities.formatDate(date, ADMIN_TZ, 'yyyy-MM-dd'),
      slot: slot,
      blocked: Boolean(change.blocked)
    };
  });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = ensureAdminBlockedSheet_();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String);
    const existing = new Map();
    for (let row = 1; row < data.length; row++) {
      const source = String(blockedValue_(data[row], headers, ['來源']) || '').toUpperCase();
      if (source !== ADMIN_AVAILABILITY_SOURCE_QUICK) continue;
      const date = adminDateKey_(blockedValue_(data[row], headers, ['日期']));
      const start = adminTimeValue_(blockedValue_(data[row], headers, ['預留開始時間', '開始時間']));
      existing.set(date + '|' + start, row + 1);
    }
    const rowsToDelete = [];
    let added = 0;
    prepared.forEach(function (change) {
      const key = change.date + '|' + change.slot.start;
      const rowNumber = existing.get(key);
      if (!change.blocked && rowNumber) rowsToDelete.push(rowNumber);
      if (!change.blocked || rowNumber) return;
      const row = new Array(headers.length).fill('');
      putBlockedValue_(row, headers, ['日期'], parseAdminDate_(change.date));
      putBlockedValue_(row, headers, ['開始時間'], change.slot.start);
      putBlockedValue_(row, headers, ['結束時間'], change.slot.end);
      putBlockedValue_(row, headers, ['預留開始時間'], change.slot.start);
      putBlockedValue_(row, headers, ['預留結束時間'], change.slot.end);
      putBlockedValue_(row, headers, ['備註'], '快速設定：' + change.slot.label + '不可預約');
      putBlockedValue_(row, headers, ['來源'], ADMIN_AVAILABILITY_SOURCE_QUICK);
      putBlockedValue_(row, headers, ['建立時間'], new Date());
      putBlockedValue_(row, headers, ['建立者'], session.email);
      sheet.appendRow(row);
      added++;
    });
    rowsToDelete.sort(function (a, b) { return b - a; }).forEach(function (rowNumber) { sheet.deleteRow(rowNumber); });
    SpreadsheetApp.flush();
    return {
      success: true,
      added: added,
      removed: rowsToDelete.length,
      message: '已儲存 ' + prepared.length + ' 個時段變更。'
    };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function deleteAvailabilityBlock(sessionToken, rowNumber, expectedKey) {
  requireFreshAdminPermission_(sessionToken, 'canEditOrder', '你沒有修改可預約時間的權限。');
  const sheet = openSS_().getSheetByName(ADMIN_AVAILABILITY_SHEET);
  rowNumber = Number(rowNumber);
  if (!sheet || !Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow()) throw new Error('找不到這筆不可預約時段。');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const source = blockedValue_(row, headers, ['來源']);
  const key = blockedRowKey_(row, headers);
  if (String(source || '').toUpperCase() === 'FIXED') throw new Error('固定班表不能從這裡刪除。');
  if (!expectedKey || expectedKey !== key) throw new Error('資料已變更，請重新整理後再試。');
  sheet.deleteRow(rowNumber);
  return { success: true, message: '已移除不可預約時段。' };
}

function listManualAvailabilityBlocks_(year, month) {
  const sheet = openSS_().getSheetByName(ADMIN_AVAILABILITY_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const prefix = String(year) + '-' + String(month).padStart(2, '0') + '-';
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const source = String(blockedValue_(data[i], headers, ['來源']) || '').toUpperCase();
    if (source === 'FIXED') continue;
    const date = adminDateKey_(blockedValue_(data[i], headers, ['日期']));
    if (!date.startsWith(prefix)) continue;
    const start = adminTimeValue_(blockedValue_(data[i], headers, ['預留開始時間', '開始時間']));
    const end = adminTimeValue_(blockedValue_(data[i], headers, ['預留結束時間', '結束時間']));
    out.push({
      rowNumber: i + 1,
      key: blockedRowKey_(data[i], headers),
      date: date,
      start: start,
      end: end,
      note: String(blockedValue_(data[i], headers, ['備註']) || ''),
      source: source || ADMIN_AVAILABILITY_SOURCE_MANUAL
    });
  }
  return out.sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
}

function readAdminManualBlocks_(start, end) {
  return listManualAvailabilityBlocks_(start.getFullYear(), start.getMonth() + 1).map(function (item) {
    const date = parseAdminDate_(item.date);
    return { start: dateAtAdminTime_(date, item.start), end: dateAtAdminTime_(date, item.end), reason: item.note || '手動不可預約', source: item.source };
  });
}

function readGoogleCalendarBusy_(start, end) {
  try {
    const id = String(PropertiesService.getScriptProperties().getProperty('ADMIN_CALENDAR_ID') || '').trim();
    const calendar = id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
    if (!calendar) return { connected: false, calendarName: '', warning: '找不到指定的 Google 行事曆。', busy: [] };
    const events = calendar.getEvents(start, end);
    const busy = events.filter(function (event) {
      try { return event.getTransparency() !== CalendarApp.EventTransparency.TRANSPARENT; } catch (ignore) { return true; }
    }).map(function (event) {
      return { start: event.getStartTime(), end: event.getEndTime(), reason: 'Google 行事曆忙碌' };
    });
    return { connected: true, calendarName: calendar.getName(), warning: '', busy: busy };
  } catch (error) {
    return { connected: false, calendarName: '', warning: 'Google 行事曆尚未授權：' + String(error && error.message || error), busy: [] };
  }
}

function getAdminHolidayRows_(year, month) {
  try {
    const calendar = CalendarApp.getCalendarById(ADMIN_HOLIDAY_CALENDAR_ID);
    if (calendar) {
      return calendar.getEvents(new Date(year, month - 1, 1), new Date(year, month, 1)).filter(function (event) {
        return isAdminPublicHolidayTitle_(event.getTitle());
      }).map(function (event) {
        return { date: Utilities.formatDate(event.getStartTime(), ADMIN_TZ, 'yyyy-MM-dd'), title: event.getTitle() };
      });
    }
  } catch (ignore) {}

  // 未訂閱台灣假日日曆時，改讀 Google 的公開 iCalendar，不需要使用者另外訂閱。
  try {
    const url = 'https://calendar.google.com/calendar/ical/' +
      encodeURIComponent(ADMIN_HOLIDAY_CALENDAR_ID) + '/public/basic.ics';
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return [];
    const unfolded = response.getContentText().replace(/\r?\n[ \t]/g, '');
    const events = unfolded.split('BEGIN:VEVENT').slice(1);
    const prefix = String(year) + String(month).padStart(2, '0');
    return events.map(function (block) {
      const dateMatch = block.match(/DTSTART(?:;VALUE=DATE)?:([0-9]{8})/);
      const titleMatch = block.match(/(?:^|\n)SUMMARY:(.*)/);
      if (!dateMatch || !dateMatch[1].startsWith(prefix)) return null;
      const title = decodeIcalText_(titleMatch ? titleMatch[1] : '國定假日');
      if (!isAdminPublicHolidayTitle_(title)) return null;
      const raw = dateMatch[1];
      return { date: raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8), title: title };
    }).filter(Boolean);
  } catch (ignore) {
    return [];
  }
}

function isAdminPublicHolidayTitle_(title) {
  title = String(title || '').trim();
  if (!title || /(補班|補行上班|工作日)/.test(title)) return false;
  // Google 的台灣假日日曆也會列出冬至等節氣；這裡只保留政府實際放假日與補假。
  return /(放假|補假|元旦|開國紀念日|農曆除夕|除夕|春節|和平紀念日|兒童節|清明節|民族掃墓節|勞動節|端午節|軍人節|教師節|孔子誕辰|國慶日|臺灣光復|台灣光復|金門古寧頭|行憲紀念日)/.test(title);
}

function decodeIcalText_(value) {
  return String(value || '')
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function authorizeAdminCalendar() {
  const calendar = CalendarApp.getDefaultCalendar();
  return { success: true, calendarId: calendar.getId(), calendarName: calendar.getName() };
}

function addWeekendHolidayRows_(year, month, holidays) {
  const map = new Map(holidays.map(function (item) { return [item.date, item.title]; }));
  const days = new Date(year, month, 0).getDate();
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() !== 0 && date.getDay() !== 6) continue;
    const key = Utilities.formatDate(date, ADMIN_TZ, 'yyyy-MM-dd');
    if (!map.has(key)) map.set(key, '週末');
  }
  return Array.from(map, function (entry) { return { date: entry[0], title: entry[1] }; });
}

function readExistingAvailabilityUsage_(year, month) {
  const result = new Map();
  const sheet = openSS_().getSheetByName('可預約表');
  if (!sheet || sheet.getLastRow() < 2) return result;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(normalizeAdminHeader_);
  const dateCol = headers.indexOf(normalizeAdminHeader_('日期'));
  const slotCol = headers.indexOf(normalizeAdminHeader_('時段代碼'));
  const usedCol = headers.indexOf(normalizeAdminHeader_('已用分鐘'));
  if ([dateCol, slotCol, usedCol].some(function (index) { return index < 0; })) return result;
  const prefix = String(year) + '-' + String(month).padStart(2, '0') + '-';
  for (let i = 1; i < data.length; i++) {
    const date = adminDateKey_(data[i][dateCol]);
    if (!date.startsWith(prefix)) continue;
    result.set(date + '|' + String(data[i][slotCol] || '').trim(), Number(data[i][usedCol] || 0));
  }
  return result;
}

function ensureAdminBlockedSheet_() {
  const ss = openSS_();
  let sheet = ss.getSheetByName(ADMIN_AVAILABILITY_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ADMIN_AVAILABILITY_SHEET);
    sheet.appendRow(['日期', '開始時間', '結束時間', '預留時間', '預留開始時間', '預留結束時間', '備註', '來源', '建立時間', '建立者']);
  }
  return sheet;
}

function putBlockedValue_(row, headers, names, value) {
  const normalized = headers.map(normalizeAdminHeader_);
  for (let i = 0; i < names.length; i++) {
    const index = normalized.indexOf(normalizeAdminHeader_(names[i]));
    if (index >= 0) { row[index] = value; return; }
  }
}

function blockedValue_(row, headers, names) {
  const normalized = headers.map(normalizeAdminHeader_);
  for (let i = 0; i < names.length; i++) {
    const index = normalized.indexOf(normalizeAdminHeader_(names[i]));
    if (index >= 0 && row[index] !== '' && row[index] != null) return row[index];
  }
  return '';
}

function blockedRowKey_(row, headers) {
  return [adminDateKey_(blockedValue_(row, headers, ['日期'])), adminTimeValue_(blockedValue_(row, headers, ['預留開始時間', '開始時間'])), adminTimeValue_(blockedValue_(row, headers, ['預留結束時間', '結束時間'])), String(blockedValue_(row, headers, ['備註']) || '')].join('|');
}

function adminDateKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, ADMIN_TZ, 'yyyy-MM-dd');
  const match = String(value || '').match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  return match ? match[1] + '-' + String(match[2]).padStart(2, '0') + '-' + String(match[3]).padStart(2, '0') : '';
}

function adminTimeValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, ADMIN_TZ, 'HH:mm');
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  return match ? String(match[1]).padStart(2, '0') + ':' + match[2] : '';
}

function dateAtAdminTime_(date, time) {
  const parts = String(time || '00:00').split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), parts[0] || 0, parts[1] || 0, 0, 0);
}

function overlapMinutes_(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.round((Math.min(aEnd.getTime(), bEnd.getTime()) - Math.max(aStart.getTime(), bStart.getTime())) / 60000));
}
