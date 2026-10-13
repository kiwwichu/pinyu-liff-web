import path from "node:path";
import process from "node:process";
import ExcelJS from "exceljs";

const fileIndex = process.argv.indexOf("--file");
if (fileIndex === -1 || !process.argv[fileIndex + 1]) {
  throw new Error("請使用 --file 指定排班 Excel 檔案");
}

const workbookPath = path.resolve(process.argv[fileIndex + 1]);
const sheetIndex = process.argv.indexOf("--sheet");
const requestedSheet = sheetIndex >= 0 ? process.argv[sheetIndex + 1] : "";
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);

function cellValue(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "formula" in value) {
    return `=${value.formula} => ${String(value.result ?? "")}`;
  }
  if (typeof value === "object" && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? "").join("");
  }
  if (typeof value === "object" && "text" in value) return String(value.text ?? "");
  return String(value);
}

for (const worksheet of workbook.worksheets) {
  if (requestedSheet && worksheet.name !== requestedSheet) continue;
  console.log(`\n## ${worksheet.name}`);
  console.log(JSON.stringify({
    state: worksheet.state,
    rows: worksheet.rowCount,
    columns: worksheet.columnCount,
    frozen: worksheet.views,
    mergedCells: Object.keys(worksheet._merges ?? {}),
    widths: worksheet.columns.slice(0, 20).map((column, index) => ({
      column: index + 1,
      width: column.width ?? null,
      hidden: Boolean(column.hidden),
    })),
  }, null, 2));

  let shown = 0;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (shown >= 35) return;
    const values = [];
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const display = cellValue(cell).trim();
      if (display) values.push(`${cell.address}=${display}`);
    });
    if (!values.length) return;
    console.log(`R${rowNumber}: ${values.join(" | ")}`);
    shown += 1;
  });
}
