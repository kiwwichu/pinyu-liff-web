function testAdminSpreadsheetConfig() {
  const id = String(ADMIN_SPREADSHEET_ID || '').trim();

  Logger.log('ID 是否存在：' + Boolean(id));
  Logger.log('ID 長度：' + id.length);

  if (!id) {
    throw new Error('ADMIN_SPREADSHEET_ID 目前仍是空的');
  }

  const ss = SpreadsheetApp.openById(id);

  Logger.log('成功開啟試算表：' + ss.getName());
  Logger.log(
    '分頁：' +
    ss.getSheets().map(sheet => sheet.getName()).join('、')
  );
}

function testAdminSheetNames() {
  const ss = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);

  Logger.log('目前試算表：' + ss.getName());
  Logger.log(
    '所有分頁：' +
    ss.getSheets()
      .map(sheet => '[' + sheet.getName() + ']')
      .join('、')
  );
}