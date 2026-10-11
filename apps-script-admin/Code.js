const ADMIN_BUILD = 'ADMIN-GOOGLE-20261011-6';
const ADMIN_SPREADSHEET_ID =
  PropertiesService.getScriptProperties()
    .getProperty('ADMIN_SPREADSHEET_ID');

const ADMIN_GOOGLE_CLIENT_ID =
  PropertiesService.getScriptProperties()
    .getProperty('ADMIN_GOOGLE_CLIENT_ID');
const ADMIN_USER_SHEET = '使用者權限';
const ADMIN_ORDER_SHEET = '需求單';
const ADMIN_SESSION_SECONDS = 1800;

function doGet(e) {
  if (e && e.parameter && String(e.parameter.action || '') === 'availability') {
    return adminJson_(getPublicAvailability_(e.parameter.year, e.parameter.month));
  }
  return HtmlService.createHtmlOutput(
    '<h2>' + ADMIN_BUILD + '</h2>' +
    '<p>ID存在：' + Boolean(
      String(ADMIN_SPREADSHEET_ID || '').trim()
    ) + '</p>'
  );
}

function adminJson_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
function doPost(e){
  try{
    if(!e||!e.parameter||String(e.parameter.action||'')!=='googleAdminLogin'){
      return adminError_('無法辨識登入要求。');
    }

    const googleUser = verifyGoogle_(e.parameter.credential);
    const user = findUser_(googleUser.email);
    
if (!ADMIN_GOOGLE_CLIENT_ID) {
  throw new Error(
    '尚未設定指令碼屬性：ADMIN_GOOGLE_CLIENT_ID'
  );
}
    if(!user) return adminError_('此 Google 帳號不在「系統使用者」名單中。');
    if(user.status!=='啟用') return adminError_('此帳號目前不是啟用狀態。');

    const token = Utilities.getUuid();
    CacheService.getScriptCache().put(
      'PINYU_ADMIN_'+token,
      JSON.stringify({
        email:googleUser.email,
        name:user.name||googleUser.name||googleUser.email,
        role:user.role,
        permissions:user.permissions
      }),
      ADMIN_SESSION_SECONDS
    );

    const t=HtmlService.createTemplateFromFile('AdminDashboard');
    t.sessionToken=token;
    t.initialName=user.name||googleUser.name||googleUser.email;
    t.initialRole=user.role||'—';
    return t.evaluate().setTitle('快樂小狗｜管理後台');
  }catch(err){
    return adminError_(err.message||String(err));
  }
}

function getAdminDashboardData(sessionToken) {
  const session = requireSession_(sessionToken);
  const orders = getOrders_();
  const visibleOrders = orders.filter(function (order) {
    return !order.isTestOrder;
  });
  const testOrders = orders.filter(function (order) {
    return order.isTestOrder;
  }).sort(orderUnfinishedThenNewest_);

const today = stripDate_(new Date());

const end = addMonths_(today, 3);

end.setHours(
  23,
  59,
  59,
  999
);
  
  const todayOrders = visibleOrders
    .filter(function (order) {
      return order.serviceDates.some(function (dateText) {
        const range = parseRange_(dateText);

        return Boolean(
          range.start &&
          range.end &&
          range.start <= today &&
          range.end >= today
        );
      });
    })
    .sort(function (a, b) {
      return a.sortTime - b.sortTime;
    });

const recentOrders = visibleOrders
  .filter(function (order) {
    const status = String(
      order.status || ''
    ).trim();

    // 「未完成」是集合名稱：除了狀態完全等於「完成」以外都顯示。
    return status !== '完成';
  })
  .sort(function (a, b) {
    return orderNewestFirst_(a, b);
  });

  // 搜尋頁顯示全部訂單：未完成優先、完成置後，同類再依服務日期新到舊。
  const allOrders = visibleOrders.slice().sort(orderUnfinishedThenNewest_);

  const paymentStatuses = [
    '未付訂金',
    '常客-待付尾款',
    '未付尾款'
  ];

  const paymentTracking = visibleOrders
    .filter(function (order) {
      return paymentStatuses.includes(order.status);
    })
    .sort(function (a, b) {
      return orderNewestFirst_(a, b);
    });

  const pendingNotifications = visibleOrders
    .filter(function (order) {
      return String(order.notifyStatus || '')
        .trim()
        .startsWith('⚠️');
    })
    .sort(function (a, b) {
      return orderNewestFirst_(a, b);
    });

  function protectOrder(order) {
    const protectedOrder = Object.assign({}, order);

    // 沒有查看金額權限時，後端就不傳金額
    if (!session.permissions.canViewAmount) {
      delete protectedOrder.total;
      delete protectedOrder.payment;
      protectedOrder.items = (protectedOrder.items || []).map(function (item) {
        const safeItem = Object.assign({}, item);
        delete safeItem.standardPrice;
        delete safeItem.customPrice;
        delete safeItem.unitPrice;
        delete safeItem.travelFee;
        delete safeItem.tip;
        delete safeItem.subtotal;
        return safeItem;
      });
    }

    return protectedOrder;
  }

  return {
    success: true,

    profile: {
      name: session.name,
      email: session.email,
      role: session.role
    },

    permissions: session.permissions,
    createOptions: buildAdminCreateOptions_(visibleOrders, session.permissions.canViewAmount),

    todayOrders: todayOrders.map(protectOrder),
    recentOrders: recentOrders.map(protectOrder),
    paymentTracking: paymentTracking.map(protectOrder),
    pendingNotifications:
      pendingNotifications.map(protectOrder),
    allOrders: allOrders.map(protectOrder),
    testOrders: testOrders.map(protectOrder),

    counts: {
      todayOrders: todayOrders.length,
      recentOrders: recentOrders.length,
      paymentTracking: paymentTracking.length,
      pendingNotifications:
        pendingNotifications.length,
      testOrders: testOrders.length
    }
  };
}

function buildAdminCreateOptions_(orders, canViewAmount) {
  const familyMap = new Map();
  const presetMap = new Map();
  const ss = openSS_();
  const findColumn = function (headers, names) {
    const normalized = headers.map(normalizeAdminHeader_);
    for (let i = 0; i < names.length; i++) {
      const index = normalized.indexOf(normalizeAdminHeader_(names[i]));
      if (index >= 0) return index;
    }
    return -1;
  };

  const familySheet = ss.getSheetByName('家庭主檔');
  if (familySheet && familySheet.getLastRow() > 1) {
    const rows = familySheet.getDataRange().getValues();
    const headers = rows[0].map(String);
    const idColumn = findColumn(headers, ['家庭編號', '唯一KEY']);
    const ownerColumn = findColumn(headers, ['飼主姓名']);
    const travelColumn = findColumn(headers, ['車馬費']);
    const districtColumn = findColumn(headers, ['行政區']);
    const regularColumn = findColumn(headers, ['常客']);
    rows.slice(1).forEach(function (row) {
      const familyId = idColumn >= 0 ? String(row[idColumn] || '').trim() : '';
      const owner = ownerColumn >= 0 ? String(row[ownerColumn] || '').trim() : '';
      const familyKey = familyId || ('NAME|' + owner);
      if (!familyId && !owner) return;
      familyMap.set(familyKey, {
        familyId: familyId,
        owner: owner,
        pets: [],
        travelFee: travelColumn >= 0 ? Number(row[travelColumn] || 0) : 0,
        district: districtColumn >= 0 ? String(row[districtColumn] || '').trim() : '',
        customerType: regularColumn >= 0 && String(row[regularColumn] || '').trim() ? '常客' : '新客',
        recentTime: 0,
        recentDate: ''
      });
    });
  }

  const petSheet = ss.getSheetByName('毛孩主檔');
  if (petSheet && petSheet.getLastRow() > 1) {
    const rows = petSheet.getDataRange().getValues();
    const headers = rows[0].map(String);
    const familyColumn = findColumn(headers, ['飼主編號', '家庭編號']);
    const petColumn = findColumn(headers, ['毛孩姓名']);
    rows.slice(1).forEach(function (row) {
      const familyId = familyColumn >= 0 ? String(row[familyColumn] || '').trim() : '';
      const pet = petColumn >= 0 ? String(row[petColumn] || '').trim() : '';
      const family = familyMap.get(familyId);
      if (family && pet && !family.pets.includes(pet)) family.pets.push(pet);
    });
  }

  const planSheet = ss.getSheetByName('方案表');
  if (planSheet && planSheet.getLastRow() > 1) {
    const rows = planSheet.getDataRange().getValues();
    const headers = rows[0].map(String);
    const categoryColumn = findColumn(headers, ['服務類別']);
    const planColumn = findColumn(headers, ['服務方案']);
    const durationColumn = findColumn(headers, ['時長(分)', '時數']);
    const priceColumn = findColumn(headers, ['單價', '標準單價']);
    rows.slice(1).forEach(function (row) {
      const category = categoryColumn >= 0 ? String(row[categoryColumn] || '').trim() : '';
      const plan = planColumn >= 0 ? String(row[planColumn] || '').trim() : '';
      if (!category || !plan) return;
      const key = category + '|' + plan;
      presetMap.set(key, {
        key: key,
        category: category,
        plan: plan,
        hours: durationColumn >= 0 ? String(row[durationColumn] || '').trim() : '',
        standardPrice: canViewAmount && priceColumn >= 0 ? Number(row[priceColumn] || 0) : 0,
        recentTime: 0
      });
    });
  }

  (orders || []).forEach(function (order) {
    const familyId = String(order.familyId || '').trim();
    const familyKey = familyId || ('NAME|' + String(order.owner || '').trim());
    if (familyKey && !familyMap.has(familyKey)) {
      familyMap.set(familyKey, {
        familyId: familyId,
        owner: String(order.owner || '').trim(),
        pets: [],
        recentTime: Number(order.sortTime || 0),
        recentDate: String(order.serviceDate || ''),
        travelFee: 0,
        district: '',
        customerType: String(order.status || '').startsWith('常客') ? '常客' : '新客'
      });
    }
    const family = familyMap.get(familyKey);
    if (family) {
      const pet = String(order.pet || '').trim();
      if (pet && !family.pets.includes(pet)) family.pets.push(pet);
      if (Number(order.sortTime || 0) > family.recentTime) {
        family.recentTime = Number(order.sortTime || 0);
        family.recentDate = String(order.serviceDate || '');
      }
    }
    (order.items || []).forEach(function (item) {
      const category = String(item.category || '').trim();
      const plan = String(item.plan || '').trim();
      const hours = String(item.hours || '').trim();
      if (!category) return;
      const key = [category, plan].join('|');
      const current = presetMap.get(key);
      if (!current) {
        presetMap.set(key, {
          key: key,
          category: category,
          plan: plan,
          hours: hours,
          standardPrice: canViewAmount ? Number(item.standardPrice || item.unitPrice || 0) : 0,
          recentTime: Number(order.sortTime || 0)
        });
      } else if (Number(order.sortTime || 0) >= current.recentTime) {
        current.recentTime = Number(order.sortTime || 0);
      }
    });
  });
  return {
    families: Array.from(familyMap.values()).sort(function (a, b) {
      return b.recentTime - a.recentTime || a.owner.localeCompare(b.owner, 'zh-TW');
    }),
    servicePresets: Array.from(presetMap.values()).sort(function (a, b) {
      return a.category.localeCompare(b.category, 'zh-TW') || a.plan.localeCompare(b.plan, 'zh-TW');
    }),
    dropdowns: getAdminCreateDropdowns_(ss)
  };
}

function getAdminCreateDropdowns_(ss) {
  const defaults = {
    statuses: ADMIN_ALLOWED_ORDER_STATUSES.slice(),
    providers: ['品伃', '容容'],
    bookingSegments: ['早上', '下午', '晚上'],
    orderSources: ['LINE', 'IG', '毛小愛', 'fb', 'Petbacker', '其他']
  };
  const sheet = ss.getSheetByName(ADMIN_ORDER_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return defaults;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const validations = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getDataValidations()[0];
  function choices(names, fallback) {
    const normalized = headers.map(normalizeAdminHeader_);
    let column = -1;
    names.some(function (name) {
      column = normalized.indexOf(normalizeAdminHeader_(name));
      return column >= 0;
    });
    if (column < 0 || !validations[column]) return fallback;
    const criteria = validations[column].getCriteriaValues();
    const values = criteria && Array.isArray(criteria[0]) ? criteria[0].map(String).filter(Boolean) : [];
    return values.length ? values : fallback;
  }
  return {
    statuses: choices(['需求單狀態', '訂單狀態'], defaults.statuses),
    providers: choices(['執行保姆'], defaults.providers),
    bookingSegments: choices(['預約區段'], defaults.bookingSegments),
    orderSources: choices(['下單平台', '訂單來源'], defaults.orderSources)
  };
}

function orderNewestFirst_(a, b) {
  const left = Number(a && a.sortTime);
  const right = Number(b && b.sortTime);
  return (Number.isFinite(right) ? right : 0) -
    (Number.isFinite(left) ? left : 0);
}

function orderUnfinishedThenNewest_(a, b) {
  const leftCompleted = String(a && a.status || '').trim() === '完成';
  const rightCompleted = String(b && b.status || '').trim() === '完成';
  if (leftCompleted !== rightCompleted) return leftCompleted ? 1 : -1;
  return orderNewestFirst_(a, b);
}

function logoutAdminSession(sessionToken){
  if(sessionToken) CacheService.getScriptCache().remove('PINYU_ADMIN_'+sessionToken);
  return {success:true};
}

function verifyGoogle_(credential){
  if(!credential) throw new Error('缺少 Google 登入憑證。');
  const r=UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(credential),
    {muteHttpExceptions:true}
  );
  const body=JSON.parse(r.getContentText()||'{}');
  if(r.getResponseCode()<200||r.getResponseCode()>=300) throw new Error('Google 登入驗證失敗。');
  if(String(body.aud||'')!==ADMIN_GOOGLE_CLIENT_ID) throw new Error('Google Client ID 不相符。');
  if(!['accounts.google.com','https://accounts.google.com'].includes(String(body.iss||''))) throw new Error('Google Token 發行者不正確。');
  if((Number(body.exp)||0)*1000<=Date.now()) throw new Error('Google 登入憑證已逾時。');
  if(!(body.email_verified===true||String(body.email_verified)==='true')) throw new Error('Google Email 尚未驗證。');
  return {email:String(body.email||'').trim().toLowerCase(),name:String(body.name||'').trim()};
}

function findUser_(email){
  const sh=openSS_().getSheetByName(ADMIN_USER_SHEET);
  if(!sh) throw new Error('找不到工作表：'+ADMIN_USER_SHEET);
  const data=sh.getDataRange().getValues(), h=data[0].map(x=>String(x||'').trim());
  const idx=n=>h.findIndex(x=>x.replace(/\s+/g,'')===n.replace(/\s+/g,''));
  const e=idx('Google Email'), name=idx('姓名'), role=idx('角色'), status=idx('狀態');
  const vf=idx('可查看家庭'), ao=idx('可新增訂單'), eo=idx('可修改訂單'), sn=idx('可發送通知'), va=idx('可查看金額');
  if(e<0||status<0) throw new Error('系統使用者缺少 Google Email／狀態欄。');
  for(let i=1;i<data.length;i++){
    if(String(data[i][e]||'').trim().toLowerCase()!==email) continue;
    const r=role>=0?String(data[i][role]||'').trim():'';
    const full=['ADMIN','OWNER','管理員','擁有者'].includes(r.toUpperCase());
    const b=j=>j>=0&&(data[i][j]===true||['TRUE','是','YES','Y','1','啟用'].includes(String(data[i][j]||'').trim().toUpperCase()));
    return {
      name:name>=0?String(data[i][name]||'').trim():'',
      role:r,status:String(data[i][status]||'').trim(),
      permissions:{
        canViewFamily:full||b(vf),canAddOrder:full||b(ao),canEditOrder:full||b(eo),
        canSendNotification:full||b(sn),canViewAmount:full||b(va)
      }
    };
  }
  return null;
}

function requireSession_(token){
  const key='PINYU_ADMIN_'+String(token||'').trim();
  const c=CacheService.getScriptCache(), raw=c.get(key);
  if(!raw) throw new Error('登入已逾時，請重新登入。');
  c.put(key,raw,ADMIN_SESSION_SECONDS);
  return JSON.parse(raw);
}

function getOrders_() {
  const sheet = openSS_()
    .getSheetByName(ADMIN_ORDER_SHEET);

  if (!sheet) {
    throw new Error(
      '找不到工作表：' +
      ADMIN_ORDER_SHEET
    );
  }

  const data =
    sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return [];
  }

  const headers = data[0].map(
    function (value) {
      return String(value || '').trim();
    }
  );

  const normalizedHeaders =
    headers.map(function (value) {
      return value
        .replace(/\s+/g, '')
        .toLowerCase();
    });

  function findColumn(candidates) {
    for (
      let i = 0;
      i < candidates.length;
      i++
    ) {
      const keyword = String(
        candidates[i] || ''
      )
        .replace(/\s+/g, '')
        .toLowerCase();

      const columnIndex =
        normalizedHeaders.findIndex(
          function (header) {
            return header.includes(keyword);
          }
        );

      if (columnIndex >= 0) {
        return columnIndex;
      }
    }

    return -1;
  }

  const orderIdColumn = findColumn([
    '需求單編號',
    '訂單編號'
  ]);

  const familyIdColumn = findColumn([
    '家庭編號'
  ]);

  const ownerColumn = findColumn([
    '飼主姓名',
    '主人姓名',
    '姓名'
  ]);

  const petColumn = findColumn([
    '毛孩姓名',
    '寵物姓名'
  ]);

  const statusColumn = findColumn([
    '需求單狀態',
    '訂單狀態'
  ]);

  const notifyStatusColumn = findColumn([
    '通知狀態'
  ]);

  const serviceDateColumn = findColumn([
    '服務日期'
  ]);

  const totalColumn = findColumn([
    '總價',
    '總金額'
  ]);

  const specifiedTimeColumn = findColumn(['指定時間']);
  const categoryColumn = findColumn(['服務類別']);
  const planColumn = findColumn(['服務方案']);
  const hoursColumn = findColumn(['時數']);
  const timesColumn = findColumn(['次數']);
  const standardPriceColumn = findColumn(['標準單價']);
  const customPriceColumn = findColumn(['客製化單價']);
  const travelFeeColumn = findColumn(['車馬費']);
  const tipColumn = findColumn(['小費']);
  const platformColumn = findColumn(['下單平台']);
  const standardDepositColumn = findColumn(['標準訂金']);
  const customDepositColumn = findColumn(['自訂訂金']);
  const homeVisitFeeColumn = findColumn(['家訪費']);
  const balanceColumn = findColumn(['尾款']);
  const netIncomeColumn = findColumn(['淨收入']);
  const unpaidBalanceColumn = findColumn(['未付尾款']);
  const storedValueColumn = findColumn(['是否使用儲值金']);
  const noteColumn = findColumn(['備註']);
  const orderTypeColumn = findColumn(['訂單類型']);

  if (orderIdColumn < 0) {
    throw new Error(
      '需求單缺少表頭：需求單編號'
    );
  }

  // 同一需求單可能有多列，因此先依需求單編號合併
  const orderGroups = new Map();

  for (
    let row = 1;
    row < data.length;
    row++
  ) {
    const rowData = data[row];

    const orderId = String(
      rowData[orderIdColumn] || ''
    ).trim();

    if (!orderId) {
      continue;
    }

    if (!orderGroups.has(orderId)) {
      orderGroups.set(orderId, {
        orderId: orderId,

        familyId:
          familyIdColumn >= 0
            ? String(
                rowData[familyIdColumn] || ''
              ).trim()
            : '',

        owner:
          ownerColumn >= 0
            ? String(
                rowData[ownerColumn] || ''
              ).trim()
            : '',

        pet:
          petColumn >= 0
            ? String(
                rowData[petColumn] || ''
              ).trim()
            : '',

        status:
          statusColumn >= 0
            ? String(
                rowData[statusColumn] || ''
              ).trim()
            : '',

        notifyStatus:
          notifyStatusColumn >= 0
            ? String(
                rowData[
                  notifyStatusColumn
                ] || ''
              ).trim()
            : '',

        orderType:
          orderTypeColumn >= 0
            ? String(rowData[orderTypeColumn] || '').trim()
            : '',

        serviceDates: [],
        items: [],
        total: 0,
      payment: {
  standardDeposit: 0,
  customDeposit: 0,
  depositTotal: 0,
  homeVisitFee: 0,
  balance: 0,
  netIncome: 0,
  unpaidBalance: 0
},
        platform: '',
        storedValue: '',
        notes: []
      });
    }

    const order =
      orderGroups.get(orderId);

    // 如果後面列有比較新的非空狀態，就更新
    if (statusColumn >= 0) {
      const status = String(
        rowData[statusColumn] || ''
      ).trim();

      if (status) {
        order.status = status;
      }
    }

    if (notifyStatusColumn >= 0) {
      const notifyStatus = String(
        rowData[
          notifyStatusColumn
        ] || ''
      ).trim();

      if (notifyStatus) {
        order.notifyStatus =
          notifyStatus;
      }
    }

    if (orderTypeColumn >= 0) {
      const orderType = String(rowData[orderTypeColumn] || '').trim();
      if (orderType) order.orderType = orderType;
    }

    // 收集服務日期
    if (serviceDateColumn >= 0) {
      const serviceDate = dateText_(
        rowData[serviceDateColumn]
      );

      if (
        serviceDate &&
        !order.serviceDates.includes(
          serviceDate
        )
      ) {
        order.serviceDates.push(
          serviceDate
        );
      }
    }

    const standardPrice = standardPriceColumn >= 0
      ? Number(rowData[standardPriceColumn]) || 0
      : 0;
    const customPrice = customPriceColumn >= 0
      ? Number(rowData[customPriceColumn]) || 0
      : 0;

    order.items.push({
      serviceDate: serviceDateColumn >= 0
        ? dateText_(rowData[serviceDateColumn])
        : '',
      specifiedTime: specifiedTimeColumn >= 0
        ? adminTimeText_(rowData[specifiedTimeColumn])
        : '',
      category: categoryColumn >= 0 ? String(rowData[categoryColumn] || '').trim() : '',
      plan: planColumn >= 0 ? String(rowData[planColumn] || '').trim() : '',
      hours: hoursColumn >= 0 ? String(rowData[hoursColumn] || '').trim() : '',
      times: timesColumn >= 0 ? Number(rowData[timesColumn]) || 0 : 0,
      standardPrice: standardPrice,
      customPrice: customPrice,
      unitPrice: customPrice > 0 ? customPrice : standardPrice,
      travelFee: travelFeeColumn >= 0 ? Number(rowData[travelFeeColumn]) || 0 : 0,
      tip: tipColumn >= 0 ? Number(rowData[tipColumn]) || 0 : 0,
      subtotal: totalColumn >= 0 ? Number(rowData[totalColumn]) || 0 : 0
    });

    if (!order.platform && platformColumn >= 0) {
      order.platform = String(rowData[platformColumn] || '').trim();
    }
    if (!order.storedValue && storedValueColumn >= 0) {
      order.storedValue = String(rowData[storedValueColumn] || '').trim();
    }
    if (noteColumn >= 0) {
      const note = String(rowData[noteColumn] || '').trim();
      if (note && !order.notes.includes(note)) order.notes.push(note);
    }

    [
      ['standardDeposit', standardDepositColumn],
      ['customDeposit', customDepositColumn],
      ['homeVisitFee', homeVisitFeeColumn],
      ['balance', balanceColumn],
      ['netIncome', netIncomeColumn],
      ['unpaidBalance', unpaidBalanceColumn]
    ].forEach(function (entry) {
      if (entry[1] >= 0) {
        order.payment[entry[0]] += Number(rowData[entry[1]]) || 0;
      }
    });

const rowStandardDeposit =
  standardDepositColumn >= 0
    ? Number(rowData[standardDepositColumn]) || 0
    : 0;

const rowCustomDeposit =
  customDepositColumn >= 0
    ? Number(rowData[customDepositColumn]) || 0
    : 0;

order.payment.depositTotal +=
  rowCustomDeposit > 0
    ? rowCustomDeposit
    : rowStandardDeposit;

    // 合計同一需求單所有列的金額
    if (totalColumn >= 0) {
      order.total +=
        Number(
          rowData[totalColumn]
        ) || 0;
    }
  }

  const today =
    stripDate_(new Date());

  const end =
    addMonths_(today, 3);

  const farFutureLimit = new Date(today);
  farFutureLimit.setFullYear(farFutureLimit.getFullYear() + 20);

  end.setHours(
    23,
    59,
    59,
    999
  );

  return Array.from(
    orderGroups.values()
  ).map(function (order) {
    const parsedDates = [];

    order.serviceDates.forEach(
      function (dateText) {
        const range =
          parseRange_(dateText);

        if (range.start) {
          parsedDates.push(
            range.start
          );
        }

        if (range.end) {
          parsedDates.push(
            range.end
          );
        }
      }
    );

    const firstDate =
      parsedDates.length
        ? new Date(
            Math.min.apply(
              null,
              parsedDates.map(
                function (date) {
                  return date.getTime();
                }
              )
            )
          )
        : null;

    const lastDate =
      parsedDates.length
        ? new Date(
            Math.max.apply(
              null,
              parsedDates.map(
                function (date) {
                  return date.getTime();
                }
              )
            )
          )
        : null;

    const serviceDate =
      order.serviceDates.join('、');

    const isWithin3Months =
      Boolean(
        firstDate &&
        lastDate &&
        lastDate >= today &&
        firstDate <= end
      );

    return Object.assign(
      {},
      order,
      {
        serviceDate:
          serviceDate,

        searchText: [
          order.orderId,
          order.familyId,
          order.owner,
          order.pet,
          order.status,
          order.notifyStatus,
          serviceDate
        ].join(' '),

        isWithin3Months:
          isWithin3Months,

        isFarFutureTest:
          Boolean(firstDate && firstDate > farFutureLimit),

        isTestOrder:
          order.orderType === '測試' ||
          (!order.orderType && (
            String(order.owner || '').trim() === '測試' ||
            Boolean(firstDate && firstDate > farFutureLimit)
          )),

        sortTime:
          firstDate
            ? firstDate.getTime()
            : 0
      }
    );
  });
}


/**
 * 增加日曆月份。
 * 例如 7/20 加三個月會得到 10/20。
 * 1/31 加一個月則會自動調整至 2 月最後一天。
 */
function addMonths_(
  date,
  months
) {
  const result =
    new Date(date);

  const originalDay =
    result.getDate();

  // 先移到每月第一天，
  // 避免月底直接加月份造成跨月
  result.setDate(1);

  result.setMonth(
    result.getMonth() +
    Number(months || 0)
  );

  const lastDayOfMonth =
    new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0
    ).getDate();

  result.setDate(
    Math.min(
      originalDay,
      lastDayOfMonth
    )
  );

  return result;
}

function openSS_() {
  if (!ADMIN_SPREADSHEET_ID) {
    throw new Error(
      '尚未設定指令碼屬性：ADMIN_SPREADSHEET_ID'
    );
  }

  return SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
}
function adminError_(m){
  return HtmlService.createHtmlOutput('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:24px"><h2>無法開啟管理後台</h2><p>'+String(m).replace(/[&<>]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]))+'</p></body>');
}
function dateText_(v){
  return Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v)?Utilities.formatDate(v,Session.getScriptTimeZone()||'Asia/Taipei','yyyy/MM/dd'):String(v||'').trim();
}
function stripDate_(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function addDays_(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function parseRange_(raw){
  const t=String(raw||'').replace(/[～~至]/g,'-').trim(), p=t.split('-').map(x=>x.trim()).filter(Boolean);
  const one=s=>{const m=String(s||'').match(/(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})/);return m?stripDate_(new Date(+m[1],+m[2]-1,+m[3])):null;};
  return {start:one(p[0]),end:one(p[1]||p[0])};
}


function testAdminDashboardFile() {
  const template =
    HtmlService.createTemplateFromFile('AdminDashboard');

  template.sessionToken = 'TEST-TOKEN';
  template.initialName = '品伃';
  template.initialRole = 'Admin';

  const html = template.evaluate().getContent();

  Logger.log('成功讀到 AdminDashboard');
  Logger.log('HTML 長度：' + html.length);
  Logger.log('HTML 開頭：' + html.substring(0, 100));
}

function queueOrderNotification(sessionToken, orderId) {
  const session = requireSession_(sessionToken);
  const currentUser = findUser_(session.email);

  if (!currentUser || currentUser.status !== '啟用') {
    throw new Error('此帳號目前沒有使用權限。');
  }

  if (!currentUser.permissions.canSendNotification) {
    throw new Error('你沒有發送通知的權限。');
  }

  orderId = String(orderId || '').trim();

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

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const sheet = openSS_().getSheetByName(ADMIN_ORDER_SHEET);

    if (!sheet) {
      throw new Error('找不到工作表：' + ADMIN_ORDER_SHEET);
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      throw new Error('需求單目前沒有資料。');
    }

    const headers = data[0].map(function (value) {
      return String(value || '').replace(/\s+/g, '');
    });

    const orderIdColumn =
      headers.indexOf('需求單編號');

    const statusColumn =
      headers.indexOf('需求單狀態');

    const commandColumn =
      headers.indexOf('通知指令');

    const notifyStatusColumn =
      headers.indexOf('通知狀態');

    if (
      orderIdColumn < 0 ||
      statusColumn < 0 ||
      commandColumn < 0
    ) {
      throw new Error(
        '需求單缺少：需求單編號、需求單狀態或通知指令'
      );
    }

    const matchedRows = [];

    for (let i = 1; i < data.length; i++) {
      if (
        String(data[i][orderIdColumn] || '').trim() ===
        orderId
      ) {
        matchedRows.push(i);
      }
    }

    if (!matchedRows.length) {
      throw new Error('找不到需求單：' + orderId);
    }

    const firstRow = data[matchedRows[0]];
    const status =
      String(firstRow[statusColumn] || '').trim();

    if (!allowedStatuses.includes(status)) {
      throw new Error(
        '目前狀態「' + status + '」不能發送通知。'
      );
    }

    const alreadyQueued = matchedRows.some(function (i) {
      return (
        String(data[i][commandColumn] || '').trim() ===
        '發送'
      );
    });

    if (alreadyQueued) {
      throw new Error('此需求單已在發送佇列中。');
    }

    matchedRows.forEach(function (i) {
      sheet
        .getRange(i + 1, commandColumn + 1)
        .setValue('發送');
    });

    SpreadsheetApp.flush();

    return {
      success: true,
      orderId: orderId,
      orderStatus: status,
      notifyStatus:
        notifyStatusColumn >= 0
          ? String(
              firstRow[notifyStatusColumn] || ''
            ).trim()
          : '',
      message: '已下達發送指令，系統稍後會處理。'
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function adminTimeText_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(value || '').trim();
}
