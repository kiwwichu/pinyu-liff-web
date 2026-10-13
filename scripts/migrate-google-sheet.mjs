import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ExcelJS from 'exceljs';

const SHEETS = {
  orders: '需求單',
  visits: '到府明細',
  bindings: 'LINE綁定表',
  families: '家庭主檔',
  reviews: '服務評價',
  users: '使用者權限',
  reminders: '系統提醒紀錄',
  pets: '毛孩主檔',
  postalCodes: '郵遞區號',
  plans: '方案表',
  deductions: '扣款自動表',
  cooldown: 'COOLDOWN',
  settings: '系統設定',
  wallet: '儲值流水',
};

const TABLE_ORDER = [
  'families',
  'pets',
  'line_bindings',
  'service_plans',
  'orders',
  'visits',
  'service_reviews',
  'app_users',
  'reminder_logs',
  'wallet_transactions',
  'postal_codes',
  'app_settings',
];

const IMPORT_COLUMNS = {
  families: ['family_id', 'district', 'owner_name', 'travel_fee', 'distance_km', 'customer_category', 'notes', 'established_at', 'notification_channel', 'home_visit_at', 'contract_status', 'instagram_permission', 'legacy_unique_key', 'marketing_channel', 'first_inquiry_date', 'source_row'],
  pets: ['pet_id', 'family_id', 'pet_name', 'species', 'breed', 'weight_kg', 'sex', 'age_text', 'neuter_status', 'medical_notes', 'behavior_notes', 'feeding_notes', 'established_on', 'is_enabled', 'source_row'],
  line_bindings: ['line_user_id', 'family_id', 'binding_status', 'bound_at', 'last_interaction_at', 'is_enabled', 'source_row'],
  service_plans: ['service_type', 'plan_name', 'duration_minutes', 'price', 'legacy_key', 'source_row'],
  orders: ['order_id', 'legacy_order_id', 'order_status', 'caregiver', 'notification_command', 'visits_command', 'legacy_notification_status', 'confirmation_result', 'established_at', 'service_date_raw', 'booking_segment', 'specified_time', 'family_id', 'owner_name_snapshot', 'pet_name_snapshot', 'line_user_id_snapshot', 'service_type', 'plan_name', 'hours', 'quantity', 'standard_price', 'custom_price', 'travel_fee', 'tip', 'order_platform', 'standard_deposit', 'custom_deposit', 'home_visit_fee', 'remaining_payment', 'discount', 'total', 'net_income', 'unpaid_balance', 'total_before_discount', 'uses_wallet', 'notes', 'source_row'],
  visits: ['visit_id', 'order_id', 'legacy_order_id', 'family_id', 'established_at', 'owner_name_snapshot', 'pet_name_snapshot', 'service_date', 'slot_code', 'slot_text', 'specified_time', 'is_slot_locked', 'hours', 'service_type', 'plan_name', 'source_order_row', 'order_status_snapshot', 'sync_status', 'notes', 'inventory_sync_status', 'inventory_synced_at', 'inventory_sync_key', 'source_row'],
  service_reviews: ['review_id', 'order_id', 'legacy_order_id', 'family_id', 'line_user_id', 'overall_rating', 'report_clarity', 'care_quality', 'pet_comfort', 'punctuality', 'communication', 'feedback', 'allow_anonymous_publication', 'public_name', 'submitted_at', 'last_modified_at', 'source_row'],
  app_users: ['line_user_id', 'google_email', 'display_name', 'role', 'visible_families', 'can_create_orders', 'can_edit_orders', 'can_send_notifications', 'can_view_money', 'status', 'legacy_created_at', 'last_login_at', 'notes', 'source_row'],
  reminder_logs: ['reminder_key', 'reminder_type', 'family_id', 'legacy_family_id', 'order_id', 'legacy_order_id', 'target_date', 'result', 'logged_at', 'details', 'source_row'],
  wallet_transactions: ['legacy_transaction_id', 'occurred_on', 'family_id', 'transaction_type', 'amount', 'order_id', 'uses_wallet', 'notes', 'source_sheet', 'source_row'],
  postal_codes: ['city', 'district', 'postal_code', 'source_row'],
  app_settings: ['setting_key', 'setting_value'],
};

const issues = [];

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function fail(message) {
  console.error(`錯誤：${message}`);
  process.exitCode = 1;
}

function cellValue(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if ('result' in value) return value.result ?? null;
  if (Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? '').join('');
  }
  if ('text' in value) return value.text ?? null;
  if ('error' in value) return null;
  return null;
}

function raw(row, column) {
  return cellValue(row.getCell(column));
}

function text(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\r\n/g, '\n').trim();
  return normalized === '' ? null : normalized;
}

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value).replace(/[$,，\s]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value) {
  const parsed = number(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function boolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = text(value)?.toLowerCase();
  if (!normalized) return fallback;
  if (['是', '有', '啟用', 'true', 'yes', 'y', '1', '同意'].includes(normalized)) return true;
  if (['否', '無', '停用', 'false', 'no', 'n', '0', '不同意'].includes(normalized)) return false;
  return fallback;
}

function excelSerialToDate(value) {
  return new Date(Math.round((value - 25569) * 86400 * 1000));
}

function parseDate(value, dateOnly = false) {
  if (value === null || value === undefined || value === '') return null;
  let parsed;

  if (value instanceof Date) {
    parsed = value;
  } else if (typeof value === 'number') {
    parsed = excelSerialToDate(value);
  } else {
    const normalized = text(value);
    if (!normalized) return null;
    const localDateTime = normalized.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (localDateTime) {
      const [, year, month, day, hour = '00', minute = '00', second = '00'] = localDateTime;
      parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}+08:00`);
    } else {
      parsed = new Date(normalized);
    }
  }

  if (Number.isNaN(parsed.getTime())) return null;
  if (!dateOnly) return parsed.toISOString();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(parsed);
}

function rowHasData(row) {
  for (let column = 1; column <= row.cellCount; column += 1) {
    if (text(raw(row, column)) !== null) return true;
  }
  return false;
}

function addIssue(level, table, sourceSheet, sourceRow, field, code) {
  issues.push({ level, table, sourceSheet, sourceRow, field, code });
}

function getWorksheet(workbook, name) {
  const worksheet = workbook.getWorksheet(name);
  if (!worksheet) throw new Error(`找不到工作表「${name}」`);
  return worksheet;
}

function mapRows(workbook, sheetName, table, mapper, primaryField, isMeaningful = () => true) {
  const worksheet = getWorksheet(workbook, sheetName);
  const records = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1 || !rowHasData(row)) return;
    const record = mapper(row, rowNumber);
    if (!isMeaningful(record)) return;
    if (!text(record[primaryField])) {
      addIssue('error', table, sheetName, rowNumber, primaryField, 'missing_primary_key');
      return;
    }
    records.push(record);
  });

  return records;
}

function mapWorkbook(workbook) {
  const data = {};

  data.families = mapRows(workbook, SHEETS.families, 'families', (row, sourceRow) => ({
    family_id: text(raw(row, 1)),
    district: text(raw(row, 2)),
    owner_name: text(raw(row, 3)),
    travel_fee: number(raw(row, 4)),
    distance_km: number(raw(row, 5)),
    customer_category: text(raw(row, 6)),
    notes: text(raw(row, 7)),
    established_at: parseDate(raw(row, 8)),
    notification_channel: text(raw(row, 9)),
    home_visit_at: parseDate(raw(row, 10)),
    contract_status: text(raw(row, 11)),
    instagram_permission: text(raw(row, 12)),
    legacy_unique_key: text(raw(row, 14)),
    marketing_channel: text(raw(row, 15)),
    first_inquiry_date: parseDate(raw(row, 16), true),
    source_row: sourceRow,
  }), 'family_id');

  data.pets = mapRows(workbook, SHEETS.pets, 'pets', (row, sourceRow) => ({
    pet_id: text(raw(row, 1)),
    family_id: text(raw(row, 2)),
    pet_name: text(raw(row, 4)),
    species: text(raw(row, 5)),
    breed: text(raw(row, 6)),
    weight_kg: number(raw(row, 7)),
    sex: text(raw(row, 8)),
    age_text: text(raw(row, 9)),
    neuter_status: text(raw(row, 10)),
    medical_notes: text(raw(row, 11)),
    behavior_notes: text(raw(row, 12)),
    feeding_notes: text(raw(row, 13)),
    established_on: parseDate(raw(row, 14), true),
    is_enabled: boolean(raw(row, 15), true),
    source_row: sourceRow,
  }), 'pet_id');

  data.line_bindings = mapRows(workbook, SHEETS.bindings, 'line_bindings', (row, sourceRow) => ({
    line_user_id: text(raw(row, 1)),
    family_id: text(raw(row, 2)),
    binding_status: text(raw(row, 4)) ?? 'bound',
    bound_at: parseDate(raw(row, 5)),
    last_interaction_at: parseDate(raw(row, 6)),
    is_enabled: boolean(raw(row, 7), true),
    source_row: sourceRow,
  }), 'line_user_id');

  data.service_plans = mapRows(workbook, SHEETS.plans, 'service_plans', (row, sourceRow) => ({
    service_type: text(raw(row, 1)),
    plan_name: text(raw(row, 2)),
    duration_minutes: integer(raw(row, 3)),
    price: number(raw(row, 4)) ?? 0,
    legacy_key: text(raw(row, 5)),
    source_row: sourceRow,
  }), 'legacy_key');

  data.orders = mapRows(workbook, SHEETS.orders, 'orders', (row, sourceRow) => ({
    legacy_order_id: text(raw(row, 1)) ?? `MIGRATED-ROW-${sourceRow}`,
    __legacy_order_id_missing: text(raw(row, 1)) === null,
    order_status: text(raw(row, 2)),
    caregiver: text(raw(row, 3)),
    notification_command: text(raw(row, 4)),
    visits_command: text(raw(row, 5)),
    legacy_notification_status: text(raw(row, 6)),
    confirmation_result: text(raw(row, 7)),
    established_at: parseDate(raw(row, 8)),
    service_date_raw: text(raw(row, 9)),
    booking_segment: text(raw(row, 10)),
    specified_time: text(raw(row, 11)),
    owner_name_snapshot: text(raw(row, 12)),
    pet_name_snapshot: text(raw(row, 13)),
    family_id: text(raw(row, 14)),
    line_user_id_snapshot: text(raw(row, 15)),
    service_type: text(raw(row, 16)),
    plan_name: text(raw(row, 17)),
    hours: number(raw(row, 18)),
    quantity: integer(raw(row, 19)),
    standard_price: number(raw(row, 20)),
    custom_price: number(raw(row, 21)),
    travel_fee: number(raw(row, 22)),
    tip: number(raw(row, 23)),
    order_platform: text(raw(row, 24)),
    standard_deposit: number(raw(row, 25)),
    custom_deposit: number(raw(row, 26)),
    home_visit_fee: number(raw(row, 27)),
    remaining_payment: number(raw(row, 28)),
    discount: number(raw(row, 29)),
    total: number(raw(row, 30)),
    net_income: number(raw(row, 31)),
    unpaid_balance: number(raw(row, 32)),
    total_before_discount: number(raw(row, 33)),
    uses_wallet: boolean(raw(row, 34), false),
    notes: text(raw(row, 35)),
    source_row: sourceRow,
  }), 'legacy_order_id', (record) => Boolean(
    record.established_at
      || record.service_date_raw
      || record.owner_name_snapshot
      || record.family_id,
  ));

  data.visits = mapRows(workbook, SHEETS.visits, 'visits', (row, sourceRow) => ({
    visit_id: text(raw(row, 1)),
    legacy_order_id: text(raw(row, 2)),
    order_id: null,
    established_at: parseDate(raw(row, 3)),
    family_id: text(raw(row, 4)),
    owner_name_snapshot: text(raw(row, 5)),
    pet_name_snapshot: text(raw(row, 6)),
    service_date: parseDate(raw(row, 7), true),
    slot_code: text(raw(row, 8)),
    slot_text: text(raw(row, 9)),
    specified_time: text(raw(row, 10)),
    is_slot_locked: boolean(raw(row, 11), false),
    hours: number(raw(row, 12)),
    service_type: text(raw(row, 13)),
    plan_name: text(raw(row, 14)),
    source_order_row: integer(raw(row, 15)),
    order_status_snapshot: text(raw(row, 16)),
    sync_status: text(raw(row, 17)),
    notes: text(raw(row, 18)),
    inventory_sync_status: text(raw(row, 19)),
    inventory_synced_at: parseDate(raw(row, 20)),
    inventory_sync_key: text(raw(row, 21)),
    source_row: sourceRow,
  }), 'visit_id');

  data.service_reviews = mapRows(workbook, SHEETS.reviews, 'service_reviews', (row, sourceRow) => ({
    review_id: text(raw(row, 1)),
    legacy_order_id: text(raw(row, 2)),
    order_id: null,
    family_id: text(raw(row, 3)),
    line_user_id: text(raw(row, 4)),
    overall_rating: integer(raw(row, 5)),
    report_clarity: integer(raw(row, 6)),
    care_quality: integer(raw(row, 7)),
    pet_comfort: integer(raw(row, 8)),
    punctuality: integer(raw(row, 9)),
    communication: integer(raw(row, 10)),
    feedback: text(raw(row, 11)),
    allow_anonymous_publication: boolean(raw(row, 12), false),
    public_name: text(raw(row, 13)),
    submitted_at: parseDate(raw(row, 14)),
    last_modified_at: parseDate(raw(row, 15)),
    source_row: sourceRow,
  }), 'review_id');

  data.app_users = mapRows(workbook, SHEETS.users, 'app_users', (row, sourceRow) => ({
    line_user_id: text(raw(row, 1)),
    google_email: text(raw(row, 2)),
    display_name: text(raw(row, 3)),
    role: text(raw(row, 4)),
    visible_families: text(raw(row, 5)),
    can_create_orders: boolean(raw(row, 6), false),
    can_edit_orders: boolean(raw(row, 7), false),
    can_send_notifications: boolean(raw(row, 8), false),
    can_view_money: boolean(raw(row, 9), false),
    status: text(raw(row, 10)) ?? 'active',
    legacy_created_at: parseDate(raw(row, 11)),
    last_login_at: parseDate(raw(row, 12)),
    notes: text(raw(row, 13)),
    source_row: sourceRow,
  }), 'display_name');

  data.reminder_logs = mapRows(workbook, SHEETS.reminders, 'reminder_logs', (row, sourceRow) => ({
    reminder_key: text(raw(row, 1)),
    reminder_type: text(raw(row, 2)),
    legacy_family_id: text(raw(row, 4)),
    family_id: text(raw(row, 4)),
    legacy_order_id: text(raw(row, 5)),
    order_id: null,
    target_date: parseDate(raw(row, 6), true),
    result: text(raw(row, 7)),
    logged_at: parseDate(raw(row, 8)),
    details: text(raw(row, 9)),
    source_row: sourceRow,
  }), 'reminder_key');

  const walletRows = [
    ...mapRows(workbook, SHEETS.wallet, 'wallet_transactions', (row, sourceRow) => ({
      legacy_transaction_id: text(raw(row, 2)),
      occurred_on: parseDate(raw(row, 1), true),
      family_id: text(raw(row, 3)),
      transaction_type: text(raw(row, 4)),
      amount: number(raw(row, 5)),
      uses_wallet: boolean(raw(row, 6), false),
      notes: text(raw(row, 7)),
      source_sheet: SHEETS.wallet,
      source_row: sourceRow,
    }), 'legacy_transaction_id', (record) => Boolean(
      record.occurred_on || record.family_id || record.amount !== null,
    )),
    ...mapRows(workbook, SHEETS.deductions, 'wallet_transactions', (row, sourceRow) => ({
      legacy_transaction_id: text(raw(row, 2)),
      occurred_on: parseDate(raw(row, 1), true),
      family_id: text(raw(row, 3)),
      transaction_type: text(raw(row, 4)) ?? '扣款',
      amount: number(raw(row, 5)),
      uses_wallet: boolean(raw(row, 6), false),
      notes: text(raw(row, 7)),
      source_sheet: SHEETS.deductions,
      source_row: sourceRow,
    }), 'legacy_transaction_id', (record) => Boolean(
      record.occurred_on || record.family_id || record.amount !== null,
    )),
  ];
  data.wallet_transactions = walletRows;

  data.postal_codes = mapRows(workbook, SHEETS.postalCodes, 'postal_codes', (row, sourceRow) => ({
    city: text(raw(row, 1)),
    district: text(raw(row, 2)),
    postal_code: text(raw(row, 3)),
    source_row: sourceRow,
  }), 'postal_code');

  const settingsSheet = getWorksheet(workbook, SHEETS.settings);
  const settingKey = text(raw(settingsSheet.getRow(1), 1));
  data.app_settings = settingKey ? [{
    setting_key: settingKey,
    setting_value: text(raw(settingsSheet.getRow(1), 2)),
  }] : [];

  return data;
}

function assignStableOrderIds(data) {
  const groups = new Map();
  for (const order of data.orders) {
    const group = groups.get(order.legacy_order_id) ?? [];
    group.push(order);
    groups.set(order.legacy_order_id, group);
  }

  for (const group of groups.values()) {
    for (const order of group) {
      order.order_id = group.length === 1
        ? order.legacy_order_id
        : `${order.legacy_order_id}~R${order.source_row}`;
    }
    if (group.length > 1) {
      for (const order of group) {
        addIssue('warning', 'orders', SHEETS.orders, order.source_row, 'legacy_order_id', 'legacy_order_id_collision_resolved');
      }
    }
    for (const order of group) {
      if (order.__legacy_order_id_missing) {
        addIssue('warning', 'orders', SHEETS.orders, order.source_row, 'legacy_order_id', 'source_formula_result_missing_generated_id');
      }
    }
  }

  return groups;
}

function normalizeNullableLegacyReferences(data) {
  const familyIds = new Set(data.families.map((family) => family.family_id));
  for (const reminder of data.reminder_logs) {
    if (reminder.family_id && !familyIds.has(reminder.family_id)) {
      reminder.family_id = null;
      addIssue('warning', 'reminder_logs', SHEETS.reminders, reminder.source_row, 'family_id', 'legacy_family_not_found');
    }
  }
}

function resolveOrderReferences(data, orderGroups) {
  for (const visit of data.visits) {
    const candidates = orderGroups.get(visit.legacy_order_id) ?? [];
    if (candidates.length === 1) {
      visit.order_id = candidates[0].order_id;
      continue;
    }
    if (candidates.length > 1) {
      const matches = candidates.filter((order) => (
        order.family_id === visit.family_id
          && order.service_type === visit.service_type
          && order.plan_name === visit.plan_name
      ));
      if (matches.length === 1) {
        visit.order_id = matches[0].order_id;
        continue;
      }
    }
    addIssue('warning', 'visits', SHEETS.visits, visit.source_row, 'order_id', candidates.length === 0
      ? 'historical_order_not_found'
      : 'historical_order_ambiguous');
  }

  for (const [table, sheet] of [
    ['service_reviews', SHEETS.reviews],
    ['reminder_logs', SHEETS.reminders],
  ]) {
    for (const record of data[table]) {
      if (!record.legacy_order_id) continue;
      const candidates = orderGroups.get(record.legacy_order_id) ?? [];
      if (candidates.length === 1) {
        record.order_id = candidates[0].order_id;
      } else {
        addIssue('warning', table, sheet, record.source_row, 'order_id', candidates.length === 0
          ? 'historical_order_not_found'
          : 'historical_order_ambiguous');
      }
    }
  }
}

function validateUnique(data, table, fields, { skipNull = false } = {}) {
  const seen = new Set();
  for (const row of data[table]) {
    if (skipNull && fields.some((field) => row[field] === null || row[field] === undefined || row[field] === '')) {
      continue;
    }
    const key = fields.map((field) => row[field] ?? '').join('\u0000');
    if (seen.has(key)) {
      addIssue('error', table, row.source_sheet ?? null, row.source_row ?? null, fields.join(','), 'duplicate_key');
    }
    seen.add(key);
  }
}

function validateRequired(data, table, fields) {
  for (const row of data[table]) {
    for (const field of fields) {
      if (row[field] === null || row[field] === undefined || row[field] === '') {
        addIssue('error', table, row.source_sheet ?? null, row.source_row ?? null, field, 'missing_required_value');
      }
    }
  }
}

function validateForeignKey(data, table, field, parentTable, parentField, required = false) {
  const parents = new Set(data[parentTable].map((row) => row[parentField]).filter(Boolean));
  for (const row of data[table]) {
    const value = row[field];
    if (!value) {
      if (required) addIssue('error', table, row.source_sheet ?? null, row.source_row ?? null, field, 'missing_foreign_key');
      continue;
    }
    if (!parents.has(value)) {
      addIssue('error', table, row.source_sheet ?? null, row.source_row ?? null, field, 'foreign_key_not_found');
    }
  }
}

function validateRatings(data) {
  const fields = ['overall_rating', 'report_clarity', 'care_quality', 'pet_comfort', 'punctuality', 'communication'];
  for (const row of data.service_reviews) {
    for (const field of fields) {
      const value = row[field];
      if (value !== null && (value < 1 || value > 5)) {
        addIssue('error', 'service_reviews', null, row.source_row, field, 'rating_out_of_range');
      }
    }
  }
}

function validate(data) {
  validateUnique(data, 'families', ['family_id']);
  validateUnique(data, 'pets', ['pet_id']);
  validateUnique(data, 'line_bindings', ['line_user_id']);
  validateUnique(data, 'service_plans', ['legacy_key']);
  validateUnique(data, 'service_plans', ['service_type', 'plan_name']);
  validateUnique(data, 'orders', ['order_id']);
  validateUnique(data, 'visits', ['visit_id']);
  validateUnique(data, 'service_reviews', ['review_id']);
  validateUnique(data, 'service_reviews', ['order_id'], { skipNull: true });
  validateUnique(data, 'app_users', ['line_user_id'], { skipNull: true });
  validateUnique(data, 'app_users', ['google_email'], { skipNull: true });
  validateUnique(data, 'reminder_logs', ['reminder_key']);
  validateUnique(data, 'wallet_transactions', ['source_sheet', 'legacy_transaction_id']);
  validateUnique(data, 'postal_codes', ['city', 'district', 'postal_code']);

  validateRequired(data, 'families', ['family_id', 'owner_name']);
  validateRequired(data, 'pets', ['pet_id', 'family_id', 'pet_name']);
  validateRequired(data, 'line_bindings', ['line_user_id', 'family_id']);
  validateRequired(data, 'service_plans', ['service_type', 'plan_name', 'price']);
  validateRequired(data, 'orders', ['order_id', 'legacy_order_id', 'order_status']);
  validateRequired(data, 'visits', ['visit_id', 'legacy_order_id']);
  validateRequired(data, 'service_reviews', ['review_id', 'legacy_order_id', 'family_id', 'overall_rating']);
  validateRequired(data, 'app_users', ['display_name', 'role']);
  validateRequired(data, 'reminder_logs', ['reminder_key', 'reminder_type']);
  validateRequired(data, 'wallet_transactions', ['legacy_transaction_id', 'occurred_on', 'family_id', 'transaction_type', 'amount']);
  validateRequired(data, 'postal_codes', ['city', 'district', 'postal_code']);

  validateForeignKey(data, 'pets', 'family_id', 'families', 'family_id', true);
  validateForeignKey(data, 'line_bindings', 'family_id', 'families', 'family_id', true);
  validateForeignKey(data, 'orders', 'family_id', 'families', 'family_id');
  validateForeignKey(data, 'visits', 'order_id', 'orders', 'order_id');
  validateForeignKey(data, 'visits', 'family_id', 'families', 'family_id');
  validateForeignKey(data, 'service_reviews', 'order_id', 'orders', 'order_id');
  validateForeignKey(data, 'service_reviews', 'family_id', 'families', 'family_id', true);
  validateForeignKey(data, 'reminder_logs', 'family_id', 'families', 'family_id');
  validateForeignKey(data, 'reminder_logs', 'order_id', 'orders', 'order_id');
  validateForeignKey(data, 'wallet_transactions', 'family_id', 'families', 'family_id', true);

  for (const row of data.app_users) {
    if (!row.line_user_id && !row.google_email) {
      addIssue('error', 'app_users', SHEETS.users, row.source_row, 'line_user_id,google_email', 'missing_login_identifier');
    }
  }

  const allowedTransactions = new Set(['儲值', '贈送', '扣款']);
  for (const row of data.wallet_transactions) {
    if (!allowedTransactions.has(row.transaction_type)) {
      addIssue('error', 'wallet_transactions', row.source_sheet, row.source_row, 'transaction_type', 'invalid_transaction_type');
    }
  }

  validateRatings(data);

  for (const visit of data.visits) {
    if (!visit.service_date) {
      addIssue('warning', 'visits', SHEETS.visits, visit.source_row, 'service_date', 'historical_service_date_missing');
    }
  }

  for (const reminder of data.reminder_logs) {
    if (!reminder.logged_at) {
      addIssue('warning', 'reminder_logs', SHEETS.reminders, reminder.source_row, 'logged_at', 'legacy_row_layout_mismatch');
    }
  }
}

function frequency(rows, field) {
  return Object.fromEntries(
    [...rows.reduce((map, row) => {
      const value = row[field] ?? '(空白)';
      map.set(value, (map.get(value) ?? 0) + 1);
      return map;
    }, new Map())].sort(([a], [b]) => String(a).localeCompare(String(b), 'zh-Hant')),
  );
}

function buildSummary(workbook, data, inputPath) {
  const cooldownSheet = getWorksheet(workbook, SHEETS.cooldown);
  const cooldownRows = Math.max(cooldownSheet.actualRowCount - 1, 0);
  return {
    generated_at: new Date().toISOString(),
    input_file: path.basename(inputPath),
    mode: 'dry-run',
    safe_to_import: issues.every((issue) => issue.level !== 'error'),
    table_counts: Object.fromEntries(TABLE_ORDER.map((table) => [table, data[table].length])),
    distributions: {
      order_status: frequency(data.orders, 'order_status'),
      order_platform: frequency(data.orders, 'order_platform'),
      service_type: frequency(data.orders, 'service_type'),
      wallet_transaction_type: frequency(data.wallet_transactions, 'transaction_type'),
    },
    skipped_sheets: {
      '消費紀錄  查詢表': '將由 wallet_activity view 取代，不重複匯入',
      '儲值總表': '將由 wallet_balances view 重新計算，不重複匯入',
      '匯出用': '將由 orders_export view 取代，不重複匯入',
      '使用說明': '說明文字，不是資料表',
      [SHEETS.cooldown]: `暫存限流資料共 ${cooldownRows} 列；搬遷時重置，避免沿用過期限流`,
    },
    issue_counts: {
      errors: issues.filter((issue) => issue.level === 'error').length,
      warnings: issues.filter((issue) => issue.level === 'warning').length,
    },
    issues,
    privacy_note: '報告只含工作表、列號、欄位與錯誤代碼，不含姓名、LINE ID 或其他儲存格內容。',
  };
}

const IMPORT_BATCH_ID = 'pet_sitter_excel_20260818';
const MAX_STAGE_CHUNK_BYTES = 12_000;

function recordsForImport(data, table) {
  const columns = IMPORT_COLUMNS[table];
  return data[table].map((record) => Object.fromEntries(
    columns.map((column) => [column, record[column] ?? null]),
  ));
}

function chunkRecords(records) {
  const chunks = [];
  let current = [];
  let currentBytes = 2;

  for (const record of records) {
    const recordBytes = Buffer.byteLength(JSON.stringify(record), 'utf8') + 1;
    if (current.length > 0 && currentBytes + recordBytes > MAX_STAGE_CHUNK_BYTES) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(record);
    currentBytes += recordBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function stagingSql(table, chunkIndex, records) {
  const encoded = Buffer.from(JSON.stringify(records), 'utf8').toString('base64');
  return [
    '-- Contains base64-encoded private customer data. Git-ignored.',
    'insert into private.migration_import_payloads (batch_id, table_name, chunk_index, payload)',
    `values ('${IMPORT_BATCH_ID}', '${table}', ${chunkIndex}, convert_from(decode('${encoded}', 'base64'), 'UTF8')::jsonb)`,
    'on conflict (batch_id, table_name, chunk_index)',
    'do update set payload = excluded.payload, created_at = now();',
    '',
  ].join('\n');
}

function finalizeSql(data) {
  const populatedTables = TABLE_ORDER.map((table) => `exists (select 1 from public.${table})`).join('\n    or ');
  const statements = [
    '-- Moves the verified private staging batch into the application tables.',
    'begin;',
    "set local statement_timeout = '120s';",
    '',
    'do $migration_guard$',
    'begin',
    `  if ${populatedTables} then`,
    "    raise exception 'Migration target is not empty; import cancelled.';",
    '  end if;',
    'end',
    '$migration_guard$;',
    '',
    'do $migration_stage_verify$',
    'declare',
    '  staged_count bigint;',
    'begin',
  ];

  for (const table of TABLE_ORDER) {
    statements.push(
      `  select coalesce(sum(jsonb_array_length(payload)), 0) into staged_count`,
      '  from private.migration_import_payloads',
      `  where batch_id = '${IMPORT_BATCH_ID}' and table_name = '${table}';`,
      `  if staged_count <> ${data[table].length} then`,
      `    raise exception 'Staging row count mismatch: ${table}';`,
      '  end if;',
    );
  }
  statements.push('end', '$migration_stage_verify$;');

  for (const table of TABLE_ORDER) {
    const columns = IMPORT_COLUMNS[table];
    const selectedColumns = columns.map((column) => `r.${column}`).join(', ');

    statements.push(
      '',
      `-- ${table}: ${data[table].length} rows`,
      `insert into public.${table} (${columns.join(', ')})`,
      `select ${selectedColumns}`,
      'from private.migration_import_payloads p',
      `cross join lateral jsonb_populate_recordset(null::public.${table}, p.payload) as r`,
      `where p.batch_id = '${IMPORT_BATCH_ID}' and p.table_name = '${table}'`,
      'order by p.chunk_index;',
    );
  }

  statements.push('', 'do $migration_verify$', 'begin');
  for (const table of TABLE_ORDER) {
    statements.push(
      `  if (select count(*) from public.${table}) <> ${data[table].length} then`,
      `    raise exception 'Row count mismatch: ${table}';`,
      '  end if;',
    );
  }
  statements.push(
    'end',
    '$migration_verify$;',
    '',
    'delete from private.migration_import_payloads',
    `where batch_id = '${IMPORT_BATCH_ID}';`,
    '',
    'commit;',
    '',
  );
  return statements.join('\n');
}

async function writeStagingBundle(outputDirectory, data) {
  const stageDirectory = path.join(outputDirectory, 'stage');
  await fs.mkdir(stageDirectory, { recursive: true });
  const files = [];
  let fileIndex = 0;

  for (const table of TABLE_ORDER) {
    const chunks = chunkRecords(recordsForImport(data, table));
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const fileName = `${String(fileIndex).padStart(3, '0')}-${table}-${String(chunkIndex).padStart(3, '0')}.sql`;
      await fs.writeFile(path.join(stageDirectory, fileName), stagingSql(table, chunkIndex, chunks[chunkIndex]), 'utf8');
      files.push(fileName);
      fileIndex += 1;
    }
  }

  const finalizeName = 'finalize.sql';
  await fs.writeFile(path.join(stageDirectory, finalizeName), finalizeSql(data), 'utf8');
  await fs.writeFile(path.join(stageDirectory, 'manifest.json'), `${JSON.stringify({
    batch_id: IMPORT_BATCH_ID,
    stage_files: files,
    finalize_file: finalizeName,
    expected_counts: Object.fromEntries(TABLE_ORDER.map((table) => [table, data[table].length])),
  }, null, 2)}\n`, 'utf8');
  return { stageDirectory, stageFiles: files.length };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const generateSql = process.argv.includes('--generate-sql');
  if (dryRun === generateSql) throw new Error('請擇一使用 --dry-run 或 --generate-sql。');
  const file = option('--file');
  if (!file) throw new Error('請使用 --file 指定 Excel 檔案。');

  const inputPath = path.resolve(file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);
  const missingSheets = Object.values(SHEETS).filter((name) => !workbook.getWorksheet(name));
  if (missingSheets.length > 0) throw new Error(`缺少工作表：${missingSheets.join('、')}`);

  const data = mapWorkbook(workbook);
  const orderGroups = assignStableOrderIds(data);
  normalizeNullableLegacyReferences(data);
  resolveOrderReferences(data, orderGroups);
  validate(data);
  const summary = buildSummary(workbook, data, inputPath);
  const outputDirectory = path.resolve('.migration-output');
  const outputPath = path.join(outputDirectory, 'dry-run-summary.json');
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log('\nExcel → Supabase 只讀演練完成');
  console.table(summary.table_counts);
  console.log(`錯誤：${summary.issue_counts.errors}；警告：${summary.issue_counts.warnings}`);
  console.log(`是否可正式匯入：${summary.safe_to_import ? '可以' : '不可以，需先處理錯誤'}`);
  console.log(`隱私安全報告：${outputPath}`);

  if (generateSql) {
    if (!summary.safe_to_import) throw new Error('檢查仍有錯誤，拒絕產生正式匯入檔。');
    const bundle = await writeStagingBundle(outputDirectory, data);
    console.log(`已產生 ${bundle.stageFiles} 個私密暫存資料片段：${bundle.stageDirectory}`);
    console.log('注意：這些檔案含客戶資料，已被 .gitignore 排除。');
  }
}

main().catch((error) => fail(error.message));
