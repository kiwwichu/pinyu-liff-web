import path from 'node:path';
import process from 'node:process';
import ExcelJS from 'exceljs';

function workbookPathFromArgs() {
  const fileIndex = process.argv.indexOf('--file');
  if (fileIndex === -1 || !process.argv[fileIndex + 1]) {
    throw new Error('請使用 --file 指定 Excel 檔案。');
  }

  return path.resolve(process.argv[fileIndex + 1]);
}

function displayValue(cell) {
  const value = cell.value;

  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'result' in value) {
    return value.result === null || value.result === undefined
      ? ''
      : String(value.result).trim();
  }
  if (typeof value === 'object' && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? '').join('').trim();
  }
  if (typeof value === 'object' && 'text' in value) {
    return String(value.text ?? '').trim();
  }

  return String(value).trim();
}

const inputPath = workbookPathFromArgs();
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(inputPath);

console.log(`活頁簿：${path.basename(inputPath)}`);
console.log(`工作表數：${workbook.worksheets.length}`);

for (const worksheet of workbook.worksheets) {
  const headers = worksheet.getRow(1).values
    .slice(1)
    .map((_, index) => displayValue(worksheet.getCell(1, index + 1)));

  let nonEmptyRows = 0;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    if (row.values.slice(1).some((value) => value !== null && value !== undefined && value !== '')) {
      nonEmptyRows += 1;
    }
  });

  console.log(`\n[${worksheet.name}] 資料列=${nonEmptyRows}`);
  console.log(headers.map((header, index) => `${index + 1}:${header || '(空白)'}`).join(' | '));
}
