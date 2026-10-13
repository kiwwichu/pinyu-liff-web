import path from 'node:path';
import process from 'node:process';
import ExcelJS from 'exceljs';

const fileIndex = process.argv.indexOf('--file');
if (fileIndex === -1 || !process.argv[fileIndex + 1]) {
  throw new Error('請使用 --file 指定 Excel 檔案。');
}

function value(cell) {
  const raw = cell.value;
  if (raw && typeof raw === 'object' && 'result' in raw) return raw.result;
  return raw;
}

function date(valueToFormat) {
  if (valueToFormat instanceof Date) return valueToFormat.toISOString().slice(0, 10);
  return String(valueToFormat ?? '').trim().slice(0, 10);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(path.resolve(process.argv[fileIndex + 1]));
const worksheet = workbook.getWorksheet('需求單');

if (!worksheet) throw new Error('找不到「需求單」工作表。');

const groups = new Map();

worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
  if (rowNumber === 1) return;

  const serviceType = String(value(row.getCell(16)) ?? '').trim();
  const planName = String(value(row.getCell(17)) ?? '').trim();
  const standardPrice = Number(value(row.getCell(20))) || 0;
  const customPrice = Number(value(row.getCell(21))) || 0;
  const actualUnitPrice = customPrice || standardPrice;
  const priceSource = customPrice ? '客製價' : '標準價';
  const establishedAt = date(value(row.getCell(8)));

  if (!serviceType || !actualUnitPrice) return;

  const key = `${serviceType} | ${planName || '未填方案'} | ${actualUnitPrice} | ${priceSource}`;
  const group = groups.get(key) ?? {
    count: 0,
    first: establishedAt,
    last: establishedAt,
  };

  group.count += 1;
  if (establishedAt && (!group.first || establishedAt < group.first)) group.first = establishedAt;
  if (establishedAt && (!group.last || establishedAt > group.last)) group.last = establishedAt;
  groups.set(key, group);
});

for (const [key, group] of [...groups].sort((left, right) => {
  return left[1].first.localeCompare(right[1].first) || left[0].localeCompare(right[0], 'zh-Hant');
})) {
  console.log(`${group.first} .. ${group.last} | ${String(group.count).padStart(3)} | ${key}`);
}
