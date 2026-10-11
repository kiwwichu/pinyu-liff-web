const ADMIN_ALLOWED_ORDER_STATUSES = [
  '未付訂金', '待執行', '常客', '常客-待付尾款', '未付尾款', '完成'
];

function createAdminOrder(sessionToken, payload) {
  const session = requireFreshAdminPermission_(sessionToken, 'canAddOrder', '你沒有新增訂單的權限。');
  payload = payload || {};

  const owner = cleanAdminText_(payload.owner, 80);
  const pet = cleanAdminText_(payload.pet, 80);
  const familyId = cleanAdminText_(payload.familyId, 80);
  const serviceDateStart = parseAdminDate_(payload.serviceDateStart || payload.serviceDate);
  const serviceDateEnd = parseAdminDate_(payload.serviceDateEnd || payload.serviceDateStart || payload.serviceDate);
  const status = cleanAdminText_(payload.status, 30) || '未付訂金';
  const isTestOrder = payload.isTestOrder === true || String(payload.isTestOrder || '').toLowerCase() === 'true' || String(payload.isTestOrder || '') === '1';
  const services = Array.isArray(payload.services) && payload.services.length
    ? payload.services.slice(0, 12)
    : [{
        category: payload.category,
        plan: payload.plan,
        hours: payload.hours,
        times: payload.times,
        standardPrice: payload.standardPrice,
        customPrice: payload.customPrice,
        specifiedTime: payload.specifiedTime
      }];

  if (!owner) throw new Error('請填寫飼主姓名。');
  if (!pet) throw new Error('請填寫毛孩姓名。');
  if (!serviceDateStart || !serviceDateEnd) throw new Error('請選擇正確的服務日期。');
  if (serviceDateEnd < serviceDateStart) throw new Error('服務結束日期不可早於開始日期。');
  if (!ADMIN_ALLOWED_ORDER_STATUSES.includes(status)) throw new Error('訂單狀態不正確。');
  if (!services.length) throw new Error('至少要有一個服務項目。');

  const preparedServices = services.map(function (service, index) {
    const category = cleanAdminText_(service.category || service.serviceType, 80);
    if (!category) throw new Error('請填寫服務 ' + (index + 1) + ' 的服務類別。');
    const standardPrice = nonNegativeAdminNumber_(service.standardPrice || service.standardUnitPrice);
    const customPrice = nonNegativeAdminNumber_(service.customPrice || service.customUnitPrice);
    const times = positiveAdminNumber_(service.times || service.quantity, 1);
    return {
      category: category,
      plan: cleanAdminText_(service.plan || service.planName, 120),
      hours: cleanAdminText_(service.hours || service.durationMinutes, 30),
      times: times,
      standardPrice: standardPrice,
      customPrice: customPrice,
      unitPrice: customPrice > 0 ? customPrice : standardPrice,
      bookingSegment: cleanAdminText_(service.bookingSegment, 20),
      specifiedTime: cleanAdminText_(service.specifiedTime || service.bookingSegment, 80),
      customPriceReason: cleanAdminText_(service.customPriceReason, 160)
    };
  });

  const travelFee = nonNegativeAdminNumber_(payload.travelFee || payload.travelFeePerVisit);
  const tip = nonNegativeAdminNumber_(payload.tip);
  const discountRateRaw = Number(payload.discountRate == null ? 1 : payload.discountRate);
  const discountRate = Number.isFinite(discountRateRaw) ? Math.min(Math.max(discountRateRaw, 0), 1) : 1;
  const serviceSubtotal = preparedServices.reduce(function (sum, service) { return sum + service.unitPrice * service.times; }, 0);
  const totalTimes = preparedServices.reduce(function (sum, service) { return sum + service.times; }, 0);
  const orderTotal = Math.round((serviceSubtotal + travelFee * totalTimes + tip) * discountRate);
  const depositRate = Math.min(Math.max(Number(payload.depositRate == null ? 0.5 : payload.depositRate) || 0, 0), 1);
  const customDeposit = nonNegativeAdminNumber_(payload.customRequiredDeposit);
  const standardDeposit = Math.round(orderTotal * depositRate);
  const paidAmount = nonNegativeAdminNumber_(payload.paidAmount);
  const serviceDateValue = serviceDateStart.getTime() === serviceDateEnd.getTime()
    ? serviceDateStart
    : Utilities.formatDate(serviceDateStart, ADMIN_TZ, 'yyyy/MM/dd') + '～' + Utilities.formatDate(serviceDateEnd, ADMIN_TZ, 'yyyy/MM/dd');

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = openSS_().getSheetByName(ADMIN_ORDER_SHEET);
    if (!sheet) throw new Error('找不到工作表：' + ADMIN_ORDER_SHEET);

    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) throw new Error('需求單沒有表頭。');
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const normalized = headers.map(normalizeAdminHeader_);
    const find = function (names) {
      for (let i = 0; i < names.length; i++) {
        const key = normalizeAdminHeader_(names[i]);
        const exact = normalized.indexOf(key);
        if (exact >= 0) return exact;
      }
      return -1;
    };

    const idCol = find(['需求單編號', '訂單編號']);
    if (idCol < 0) throw new Error('需求單缺少「需求單編號」欄位。');

    const orderId = createUniqueAdminOrderId_(sheet, idCol);
    const firstTargetRow = Math.max(2, sheet.getLastRow() + 1);
    const templateRow = firstTargetRow > 2 ? firstTargetRow - 1 : 0;
    const templateFormulas = templateRow
      ? sheet.getRange(templateRow, 1, 1, lastColumn).getFormulasR1C1()[0]
      : new Array(lastColumn).fill('');
    const notifyMap = {
      '未付訂金': '⚠️ 待發送訂單確認',
      '常客': '⚠️ 待發送訂單確認',
      '待執行': '⚠️ 待發送成立通知',
      '常客-待付尾款': '⚠️ 待發送尾款通知',
      '未付尾款': '⚠️ 待發送尾款通知',
      '完成': '⚠️ 待發送完成通知'
    };

    preparedServices.forEach(function (service, serviceIndex) {
      const targetRow = firstTargetRow + serviceIndex;
      const targetRange = sheet.getRange(targetRow, 1, 1, lastColumn);
      if (templateRow) {
        sheet.getRange(templateRow, 1, 1, lastColumn)
          .copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        templateFormulas.forEach(function (formula, column) {
          if (formula) sheet.getRange(targetRow, column + 1).setFormulaR1C1(formula);
        });
      }
      function put(names, value, options) {
        const column = find(names);
        if (column < 0 || value === undefined || value === null || value === '') return;
        const cell = sheet.getRange(targetRow, column + 1);
        if (options && options.keepFormula && cell.getFormula()) return;
        cell.setValue(value);
      }
      const isFirst = serviceIndex === 0;
      const rowTravelFee = travelFee;
      const rowTip = isFirst ? tip : 0;
      const rowRawTotal = service.unitPrice * service.times + rowTravelFee + rowTip;
      const rowTotal = Math.round(rowRawTotal * discountRate);
      const customReasonNote = service.customPriceReason
        ? '客製單價原因：' + service.customPriceReason
        : '';
      const note = [cleanAdminText_(payload.note || payload.notes, 500), customReasonNote].filter(Boolean).join('\n');

      put(['需求單編號', '訂單編號'], orderId);
      put(['家庭編號'], familyId);
      put(['飼主姓名', '主人姓名'], owner);
      put(['毛孩姓名', '寵物姓名'], pet);
      put(['需求單狀態', '訂單狀態', '狀態'], status);
      put(['執行保姆'], cleanAdminText_(payload.provider, 40));
      put(['通知狀態'], isTestOrder ? '🧪 測試單' : (notifyMap[status] || ''));
      put(['服務日期'], serviceDateValue);
      put(['預約區段'], service.bookingSegment);
      put(['指定時間', '時段文字'], service.specifiedTime);
      put(['服務類別'], service.category);
      put(['服務方案'], service.plan);
      put(['時數'], service.hours);
      put(['次數'], service.times);
      put(['標準單價'], service.standardPrice);
      put(['客製化單價', '自訂單價'], service.customPrice);
      put(['車馬費'], rowTravelFee);
      put(['小費'], rowTip);
      put(['折扣係數'], discountRate);
      put(['折扣百分比'], Math.round((1 - discountRate) * 10000) / 100);
      put(['總價', '總金額'], rowTotal, { keepFormula: true });
      put(['標準訂金'], isFirst ? standardDeposit : 0);
      put(['自訂訂金', '客製應付訂金'], isFirst ? customDeposit : 0);
      put(['已付金額', '已付訂金'], isFirst ? paidAmount : 0);
      put(['未付尾款'], isFirst ? Math.max(orderTotal - paidAmount, 0) : 0);
      put(['尾款'], isFirst ? Math.max(orderTotal - (customDeposit > 0 ? customDeposit : standardDeposit), 0) : 0);
      put(['下單平台', '訂單來源'], cleanAdminText_(payload.orderSource, 80) || '管理後台');
      put(['新舊客', '客戶類型'], cleanAdminText_(payload.customerType, 30));
      put(['訂單類型'], isTestOrder ? '測試' : '正式');
      put(['備註'], note);
      put(['建立時間', '下單時間', '建立日期'], new Date());
    });

    SpreadsheetApp.flush();
    return {
      success: true,
      orderId: orderId,
      row: firstTargetRow,
      rows: preparedServices.length,
      total: orderTotal,
      createdBy: session.email,
      message: '訂單 ' + orderId + ' 已新增。'
    };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function requireFreshAdminPermission_(sessionToken, permission, message) {
  const session = requireSession_(sessionToken);
  const user = findUser_(session.email);
  if (!user || user.status !== '啟用') throw new Error('此帳號目前沒有使用權限。');
  if (permission && !user.permissions[permission]) throw new Error(message || '權限不足。');
  session.permissions = user.permissions;
  return session;
}

function createUniqueAdminOrderId_(sheet, idColumn) {
  const tz = Session.getScriptTimeZone() || 'Asia/Taipei';
  const prefix = 'ADM-' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
  const values = sheet.getLastRow() > 1
    ? sheet.getRange(2, idColumn + 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat()
    : [];
  const used = new Set(values.map(function (value) { return String(value || '').trim(); }));
  let id = prefix;
  let suffix = 2;
  while (used.has(id)) id = prefix + '-' + suffix++;
  return id;
}

function normalizeAdminHeader_(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function cleanAdminText_(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength || 500);
}

function nonNegativeAdminNumber_(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function positiveAdminNumber_(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function parseAdminDate_(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
  return date;
}
