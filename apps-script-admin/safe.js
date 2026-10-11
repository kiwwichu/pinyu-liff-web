function updateOrderStatus(
  sessionToken,
  orderId,
  newStatus
) {
  const session = requireSession_(sessionToken);

  // 每次寫入前重新確認使用者與最新權限
  const currentUser = findUser_(session.email);

  if (
    !currentUser ||
    currentUser.status !== '啟用'
  ) {
    throw new Error('此帳號目前沒有使用權限。');
  }

  if (!currentUser.permissions.canEditOrder) {
    throw new Error('你沒有修改訂單的權限。');
  }

  orderId = String(orderId || '').trim();
  newStatus = String(newStatus || '').trim();

  if (!orderId) {
    throw new Error('缺少需求單編號。');
  }

  const allowedStatuses = [
    '未付訂金',
    '待執行',
    '常客',
    '常客-待付尾款',
    '未付尾款',
    '完成'
  ];

  if (!allowedStatuses.includes(newStatus)) {
    throw new Error('不允許使用此需求單狀態。');
  }

  const notifyStatusMap = {
    '未付訂金': '⚠️ 待發送訂單確認',
    '常客': '⚠️ 待發送訂單確認',
    '待執行': '⚠️ 待發送成立通知',
    '常客-待付尾款': '⚠️ 待發送尾款通知',
    '未付尾款': '⚠️ 待發送尾款通知',
    '完成': '⚠️ 待發送完成通知'
  };

  const newNotifyStatus =
    notifyStatusMap[newStatus] || '';

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const sheet = openSS_()
      .getSheetByName(ADMIN_ORDER_SHEET);

    if (!sheet) {
      throw new Error(
        '找不到工作表：' + ADMIN_ORDER_SHEET
      );
    }

    const data =
      sheet.getDataRange().getValues();

    if (data.length <= 1) {
      throw new Error('需求單目前沒有資料。');
    }

    const headers = data[0].map(
      function (value) {
        return String(value || '')
          .replace(/\s+/g, '');
      }
    );

    const orderIdColumn = headers.findIndex(
      function (header) {
        return [
          '需求單編號',
          '訂單編號'
        ].includes(header);
      }
    );

    const statusColumn = headers.findIndex(
      function (header) {
        return [
          '需求單狀態',
          '訂單狀態'
        ].includes(header);
      }
    );

    const notifyStatusColumn =
      headers.indexOf('通知狀態');

    if (orderIdColumn < 0) {
      throw new Error(
        '找不到「需求單編號」欄位。'
      );
    }

    if (statusColumn < 0) {
      throw new Error(
        '找不到「需求單狀態」欄位。'
      );
    }

    if (notifyStatusColumn < 0) {
      throw new Error(
        '找不到「通知狀態」欄位。'
      );
    }

    let updatedRows = 0;

    for (
      let row = 1;
      row < data.length;
      row++
    ) {
      const currentOrderId = String(
        data[row][orderIdColumn] || ''
      ).trim();

      if (currentOrderId !== orderId) {
        continue;
      }

      // 更新需求單狀態
      sheet
        .getRange(
          row + 1,
          statusColumn + 1
        )
        .setValue(newStatus);

      // 更新通知狀態與底色
      sheet
        .getRange(
          row + 1,
          notifyStatusColumn + 1
        )
        .setValue(newNotifyStatus)
        .setBackground(
          newNotifyStatus.startsWith('⚠️')
            ? '#fff2cc'
            : '#ffffff'
        );

      updatedRows++;
    }

    if (updatedRows === 0) {
      throw new Error(
        '找不到需求單：' + orderId
      );
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      message:
        '需求單狀態及通知狀態已更新',
      orderId: orderId,
      newStatus: newStatus,
      notifyStatus: newNotifyStatus,
      updatedRows: updatedRows
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function markNotificationHandled(sessionToken, orderId) {
  const session = requireSession_(sessionToken);
  const currentUser = findUser_(session.email);
  if (!currentUser || currentUser.status !== '啟用') throw new Error('此帳號目前沒有使用權限。');
  if (!currentUser.permissions.canEditOrder && !currentUser.permissions.canSendNotification) {
    throw new Error('你沒有處理通知的權限。');
  }
  orderId = String(orderId || '').trim();
  if (!orderId) throw new Error('缺少需求單編號。');

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = openSS_().getSheetByName(ADMIN_ORDER_SHEET);
    if (!sheet) throw new Error('找不到工作表：' + ADMIN_ORDER_SHEET);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(function (value) { return String(value || '').replace(/\s+/g, ''); });
    const orderIdColumn = headers.findIndex(function (header) { return ['需求單編號', '訂單編號'].includes(header); });
    const notifyStatusColumn = headers.indexOf('通知狀態');
    if (orderIdColumn < 0 || notifyStatusColumn < 0) throw new Error('需求單缺少編號或通知狀態欄位。');
    let updatedRows = 0;
    for (let row = 1; row < data.length; row++) {
      if (String(data[row][orderIdColumn] || '').trim() !== orderId) continue;
      sheet.getRange(row + 1, notifyStatusColumn + 1)
        .setValue('✅ 已處理')
        .setBackground('#e9f8f1');
      updatedRows++;
    }
    if (!updatedRows) throw new Error('找不到需求單：' + orderId);
    SpreadsheetApp.flush();
    return { success: true, orderId: orderId, updatedRows: updatedRows, message: '已標示為處理完成。' };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
