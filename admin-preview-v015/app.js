(function () {
  const icons = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    orders: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><path d="M4 6h16v14H4zM8 3v6M16 3v6M4 10h16"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M15 15c3 0 5 2 5 5"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    inbox: '<svg viewBox="0 0 24 24"><path d="M4 5h16l2 10v4H2v-4zM2 15h6l2 2h4l2-2h6"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };

  const todayTime = new Date('2026-10-12T00:00:00+08:00').getTime();
  const allOrders = [
    { id: 'O-261212-01', avatar: '未', owner: '可/Jun', pet: '未填毛孩', familyId: 'F-1042', service: '04新－客價格', startDate: '2026-12-12', date: '2026/12/12–2026/12/15', status: '未付訂金', amount: '2,200 元', notifyStatus: '⚠️ 待發送訂單確認', note: '第一次服務，抵達後請先傳訊息。' },
    { id: 'O-261027-02', avatar: '歐', owner: '熊', pet: '歐拉', familyId: 'F-0916', service: '到府照顧', startDate: '2026-10-27', date: '2026/10/27–2026/10/29', status: '常客-待付尾款', amount: '1,500 元', notifyStatus: '⚠️ 待發送尾款通知', note: '鑰匙依家庭備註交付。' },
    { id: 'O-261018-03', avatar: 'C', owner: 'Sandra', pet: 'Clyde', familyId: 'F-0882', service: '04熟－客價格', startDate: '2026-10-18', date: '2026/10/18–2026/10/20', status: '待執行', amount: '1,800 元', notifyStatus: '通知已發送', note: '晚餐後陪玩 20 分鐘。' },
    { id: 'O-261014-04', avatar: '豆', owner: '王小姐', pet: '豆豆', familyId: 'F-1028', service: '到府照顧', startDate: '2026-10-14', date: '2026/10/14・18:30', status: '待執行', amount: '1,800 元', notifyStatus: '⚠️ 尚未發送訂單通知', note: '門口鞋櫃內有備用鑰匙。' },
    { id: 'O-260928-05', avatar: '奶', owner: '林小姐', pet: '奶茶', familyId: 'F-0780', service: '散步服務', startDate: '2026-09-28', date: '2026/09/28・19:00', status: '完成', amount: '650 元', notifyStatus: '完成通知已發送', note: '' }
  ];
  const TEST_STATE_KEY = 'pinyu-admin-functional-test-v014';
  const savedTestState = (() => {
    try { return JSON.parse(window.localStorage.getItem(TEST_STATE_KEY) || '{}'); } catch (error) { return {}; }
  })();
  const defaultTestOrders = [
    { id: 'T-261013-01', avatar: '測', owner: '測試家庭', pet: '測試毛孩', familyId: 'TEST-001', service: '到府照顧', startDate: '2026-10-13', date: '2026/10/13・晚上', status: '待執行', amount: '500 元', notifyStatus: '測試環境・不發送 LINE', note: '此筆只存在功能測試環境。', isTestOrder: true }
  ];
  const testOrders = Array.isArray(savedTestState.orders) && savedTestState.orders.length ? savedTestState.orders : defaultTestOrders;
  allOrders.push(...testOrders);
  const orderTime = (order) => new Date(`${order.startDate}T00:00:00+08:00`).getTime();
  const formalOrders = allOrders.filter((order) => !order.isTestOrder);
  const orders = formalOrders.filter((order) => order.status !== '完成').sort((a, b) => orderTime(a) - orderTime(b));
  const searchOrders = [...formalOrders].sort((a, b) => Math.abs(orderTime(a) - todayTime) - Math.abs(orderTime(b) - todayTime) || orderTime(b) - orderTime(a));
  const pendingNotifications = [
    { ...orders[3], notifyStatus: '⚠️ 尚未發送訂單通知' },
    { ...orders[1], notifyStatus: '⚠️ 尚未發送訂單通知' },
    { ...orders[0], notifyStatus: '⚠️ 尚未發送訂單通知' }
  ].filter((order) => order.notifyStatus.startsWith('⚠️'));
  const serviceCatalog = {
    '到府照顧': [['30分', '30', 350], ['45分', '45', 450], ['60分', '60', 500]],
    '遛狗': [['30分', '30', 350], ['45分', '45', 450], ['60分', '60', 500]],
    '長時間陪伴': [['120分', '120', 900]],
    '到府照顧-毛': [['30分', '30', 400], ['60分', '60', 800]],
    '到府照顧-500毛': [['30分', '30', 500]],
    '04熟-客價格': [['30分', '30', 450], ['45分', '45', 650], ['60分', '60', 700], ['120分', '120', 1250]],
    '04新-客價格': [['30分', '30', 550], ['45分', '45', 750], ['60分', '60', 800], ['120分', '120', 1500]],
    '過年早鳥-到府照顧': [['30分', '30', 450]],
    '過年-到府照顧': [['30分', '30', 500], ['60分', '60', 700]],
    '餵藥器': [['餵藥器', '餵藥器', 150]],
    '餵藥': [['餵藥', '餵藥', 50]],
    '緊急出勤': [['30分', '30', 250]],
    '陪診/等候': [['30分', '30', 200]],
    '家訪': [['30分', '30', 0]],
    '到府照顧-夥伴服務': [['30分', '30', 400], ['45分', '45', 450], ['60分', '60', 500]]
  };
  const userProfile = {
    name: '品妤',
    avatar: window.localStorage.getItem('pinyu-admin-avatar') || '🐶'
  };

  const statusTone = (status) => {
    if (status === '待執行') return 'tone-green';
    if (status === '常客') return 'tone-purple';
    if (status === '常客-待付尾款') return 'tone-coral';
    if (status === '未付訂金') return 'tone-coral';
    if (status === '未付尾款') return 'tone-blue';
    if (status === '完成') return 'tone-none';
    return 'tone-blue';
  };

  const orderCardHtml = (order) => `
    <button class="recent-order-card" type="button" data-order-id="${order.id}">
      <span class="recent-card-top">
        <b class="recent-avatar">${order.avatar}</b>
        <span class="recent-name"><strong>${order.owner}｜${order.pet}</strong><small>${order.service}</small></span>
        <em class="order-status ${statusTone(order.status)}">${order.status}</em>
      </span>
      <span class="recent-card-bottom">${icons.clock}<strong>${order.date}</strong><b>${order.amount}</b><i>›</i></span>
    </button>`;
  const dashboardStatusTone = (status) => {
    if (status === '待執行') return 'blue';
    if (status.includes('未付') || status.includes('尾款')) return 'coral';
    return 'yellow';
  };
  const dashboardOrderRowHtml = (order) => `
    <button class="order-row dashboard-order-row" type="button" data-order-id="${order.id}">
      <span class="pet dashboard-pet"><b>${order.avatar}</b><span><strong>${order.pet}</strong><small class="dashboard-owner">${order.owner}</small></span></span>
      <span class="dashboard-date">${order.date}</span>
      <span class="dashboard-service">${order.service}</span>
      <em class="status dashboard-status ${dashboardStatusTone(order.status)}">${order.status}</em>
      <strong class="dashboard-amount">${order.amount}</strong>
    </button>`;
  const orderCards = orders.map(orderCardHtml).join('');
  const dashboardOrderRows = orders.slice(0, 4).map(dashboardOrderRowHtml).join('');
  const allOrderCards = searchOrders.map(orderCardHtml).join('');

  document.getElementById('app').innerHTML = `
    <div class="loading-screen" role="status" aria-live="polite">
      <div class="loader-card"><span>加載中…</span><div class="loader-dots"><i></i><i></i><i></i></div></div>
    </div>

    <div class="dashboard-shell">
      <aside class="sidebar" aria-label="完整功能選單">
        <a class="brand" href="#" data-view="dashboard" aria-label="返回儀表板"><span class="brand-pet">🐶</span><span><strong>快樂小狗</strong><small>寵物保母管理後台</small></span></a>
        <button class="sidebar-close" type="button" aria-label="關閉功能選單">×</button>
        <nav>
          <a class="active" href="#" data-view="dashboard">${icons.home}<span>主頁</span></a>
          <a href="#" data-view="recent">${icons.orders}<span>近期訂單</span></a>
          <a href="#" data-view="availability">${icons.calendar}<span>可預約時間</span></a>
          <a href="#" data-view="search">${icons.search}<span>搜尋訂單</span></a>
          <a href="#" data-view="dashboard">${icons.chart}<span>報表分析</span></a>
          <a href="#" data-view="pending">${icons.inbox}<span>待處理</span><b data-pending-badge>${pendingNotifications.length}</b></a>
        </nav>
        <div class="sidebar-bottom"><button class="test-orders" type="button" data-view="test">🧪 <span>測試訂單</span><small>2</small></button><div class="admin"><button class="admin-avatar avatar-picker-trigger" type="button" aria-label="選擇個人頭像"><span data-user-avatar>${userProfile.avatar}</span></button><div><strong data-user-name>${userProfile.name}</strong><small>管理員</small></div></div></div>
      </aside>
      <button class="sidebar-scrim" type="button" aria-label="關閉功能選單"></button>

      <section class="workspace">
        <header class="topbar">
          <button class="mobile-menu" type="button" aria-label="開啟選單">${icons.menu}</button>
          <div class="mobile-brand"><button class="mobile-avatar avatar-picker-trigger" type="button" aria-label="選擇個人頭像"><span data-user-avatar>${userProfile.avatar}</span></button><div><small>快樂小狗 Pinyu</small><strong data-user-name>${userProfile.name}</strong></div></div>
          <label class="search"><span>⌕</span><input aria-label="搜尋" placeholder="搜尋訂單、飼主或毛孩…"></label>
          <button class="theme-toggle" type="button" aria-label="切換明暗模式"><span class="sun">☀</span><span class="moon">☾</span></button>
          <button class="refresh-demo" type="button" title="重新播放載入動畫" aria-label="重新播放載入動畫">↻</button>
          <button class="top-profile avatar-picker-trigger" type="button" aria-label="選擇個人頭像"><span data-user-avatar>${userProfile.avatar}</span><strong data-user-name>${userProfile.name}</strong></button>
        </header>
        <div class="test-env-banner"><strong>🧪 功能測試環境</strong><span>操作會保存在此瀏覽器，不寫入正式 Google Sheet，也不會發送 LINE。</span></div>

        <main class="content">
          <section class="app-view is-active" data-view-panel="dashboard">
            <section class="hero">
              <div><span class="eyebrow">工作總覽</span><h1>早安，今天也一起照顧毛孩吧！</h1><p>正式未完成訂單已由過去排到現在。</p></div>
              <button class="primary-action" type="button" data-view="create">${icons.plus}<span>新增訂單</span></button>
            </section>
            <section class="metrics">
              <article class="metric metric-blue"><span>全部未完成</span><strong>${orders.length}</strong><small>筆正式訂單</small><i>▣</i></article>
              <article class="metric metric-yellow"><span>需要處理</span><strong data-pending-count>${pendingNotifications.length}</strong><small>筆未發送通知</small><i>✓</i></article>
              <article class="metric metric-coral"><span>服務家庭</span><strong>28</strong><small>本月新增 2</small><i>♡</i></article>
              <article class="metric metric-plain"><span>本月營收</span><strong>NT$ 24,560</strong><small>比上月 ＋18%</small><i>↗</i></article>
            </section>
            <section class="dashboard-grid">
              <article class="panel orders-panel">
                <div class="panel-heading"><div><h2>近期訂單</h2><span>正式未完成訂單・由過去排到現在</span></div><button type="button" data-view="recent">查看全部 ›</button></div>
                <div class="desktop-order-table">
                  <div class="order-head"><span>毛孩／飼主</span><span>服務時間</span><span>服務項目</span><span>狀態</span><span>金額</span></div>
                  ${dashboardOrderRows}
                </div>
                <div class="recent-list dashboard-recent-list dashboard-mobile-list">${orderCards}</div>
              </article>
              <article class="panel tasks-panel">
                <div class="panel-heading"><div><h2>待處理</h2><span data-pending-summary>${pendingNotifications.length} 筆訂單通知尚未發送</span></div><button type="button" data-view="pending">查看全部 ›</button></div>
                ${pendingNotifications.map((order) => `<button class="pending-mini" type="button" data-view="pending" data-pending-mini="${order.id}"><span>!</span><span><strong>${order.owner}｜${order.pet}</strong><small>${order.date}</small></span><em>${order.notifyStatus}</em></button>`).join('')}
              </article>
              <article class="panel analytics-panel">
                <div class="panel-heading"><div><h2>服務分析</h2><span>近六個月完成趨勢</span></div><button type="button">本月⌄</button></div>
                <div class="chart" aria-label="服務數量折線圖"><i style="--x:8%;--y:68%"></i><i style="--x:25%;--y:50%"></i><i style="--x:43%;--y:58%"></i><i style="--x:61%;--y:29%"></i><i style="--x:79%;--y:40%"></i><i style="--x:94%;--y:18%"></i><svg viewBox="0 0 100 70" preserveAspectRatio="none"><polyline points="8,48 25,35 43,41 61,20 79,29 94,12"/></svg></div>
                <div class="chart-caption"><span>4 月</span><span>5 月</span><span>6 月</span><span>7 月</span><span>8 月</span><span>9 月</span></div>
              </article>
              <article class="panel calendar-panel">
                <div class="panel-heading"><div><h2>10 月行程</h2><span>平日晚上、假日全天</span></div><button type="button" data-view="availability">管理時段 ›</button></div>
                <div class="week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
                <div class="days">${Array.from({length: 14}, (_, i) => `<span class="${i === 9 ? 'today' : i === 4 || i === 11 ? 'busy' : ''}">${i + 6}</span>`).join('')}</div>
              </article>
            </section>
          </section>

          <section class="app-view recent-view" data-view-panel="recent">
            <div class="recent-summary"><article><span>全部未完成</span><div><strong>${orders.length}</strong><small>筆訂單</small></div><i></i></article><article><span>需要處理</span><div><strong>3</strong><small>筆通知</small></div><i></i></article></div>
            <div class="page-heading"><span class="eyebrow">近期訂單</span></div>
            <div class="recent-sort-note">只顯示正式訂單並排除「完成」，服務日期由過去排到現在。</div>
            <label class="recent-search">${icons.search}<input type="search" placeholder="搜尋飼主、毛孩、日期或編號" aria-label="搜尋近期訂單"></label>
            <div class="recent-list" data-recent-results>${orderCards}</div>
            <div class="search-empty" data-recent-empty hidden>找不到符合的近期訂單。</div>
          </section>

          <section class="app-view create-view" data-view-panel="create">
            <div class="page-heading"><span class="eyebrow">新增訂單</span></div>
            <form class="preview-form" id="create-order-form">
              <section class="form-card"><div class="form-card-title"><b>1</b><span><strong>選擇家庭</strong><small>搜尋既有家庭，選取後自動帶入車馬費</small></span></div>
                <label class="field-label">搜尋家庭 *</label><button class="family-trigger" type="button" aria-expanded="false">${icons.search}<span>輸入飼主、毛孩或家庭編號</span><i>⌄</i></button>
                <div class="family-options" hidden><button type="button" data-family="王小姐｜豆豆、米米" data-owner="王小姐" data-pet="豆豆" data-fee="100">王小姐｜豆豆、米米<small>F-1028・車馬費 100 元／次</small></button><button type="button" data-family="熊｜歐拉" data-owner="熊" data-pet="歐拉" data-fee="150">熊｜歐拉<small>F-0916・車馬費 150 元／次</small></button><button type="button" data-family="Sandra｜Clyde" data-owner="Sandra" data-pet="Clyde" data-fee="120">Sandra｜Clyde<small>F-0882・車馬費 120 元／次</small></button></div>
                <output class="selected-family">尚未選擇家庭</output>
                <input name="owner" type="hidden"><input name="pet" type="hidden">
              </section>
              <section class="form-card"><div class="form-card-title"><b>2</b><span><strong>日期與訂單狀態</strong><small>狀態包含「常客」時，訂金比例自動設為 0</small></span></div><div class="form-grid"><label><span>服務開始日期 *</span><input name="start" type="date" value="2026-10-27" required></label><label><span>服務結束日期</span><input name="end" type="date" value="2026-10-29"></label><label><span>訂單狀態</span><select id="order-status" name="status"><option>未付訂金</option><option selected>待執行</option><option>常客</option><option>常客-待付尾款</option><option>未付尾款</option><option>完成</option></select></label><label><span>執行保姆</span><select><option>品妤</option><option>協力保姆</option></select></label><label class="check-control"><input type="checkbox" checked disabled><span>功能測試版只建立測試訂單</span></label></div></section>
              <section class="form-card"><div class="form-card-title"><b>3</b><span><strong>服務項目</strong><small>服務類別、方案與單價依正式 Google Sheet「方案表」連動</small></span></div><div class="sheet-rule-note">已核對正式方案表；變更服務類別後只顯示可用方案</div><div id="service-items" class="service-items"></div><button id="add-service" class="secondary-action" type="button">＋ 再加一個服務項目</button></section>
              <section class="form-card"><div class="form-card-title"><b>4</b><span><strong>費用與付款</strong><small>計算方式沿用正式版本</small></span></div><div class="pricing-grid"><div class="form-grid"><label><span>訂單來源</span><select><option>LINE</option><option>IG</option><option>毛小愛</option><option>Petbacker</option><option>其他</option></select></label><label><span>車馬費（每次）</span><input id="travel-fee" type="number" min="0" value="0"></label><label><span>小費</span><input id="tip" type="number" min="0" value="0"></label><label><span>折扣倍率</span><input id="discount" type="number" min="0" max="1" step="0.01" value="1"></label><label><span>訂金比例</span><input id="deposit-rate" type="number" min="0" max="1" step="0.01" value="0.5"></label><label><span>已付款金額</span><input id="paid" type="number" min="0" value="0"></label></div><aside id="calculation" class="calculation"></aside></div></section>
              <section class="form-card"><label class="field-label" for="order-note">備註</label><textarea id="order-note" rows="4" placeholder="輸入照顧事項或其他備註"></textarea></section>
              <div class="form-actions"><button class="secondary-action" type="reset">清除</button><button class="form-submit" type="submit">建立測試訂單</button></div>
            </form>
          </section>

          <section class="app-view pending-view" data-view-panel="pending">
            <div class="page-heading page-heading-actions"><span class="eyebrow">待處理</span><button id="complete-all-pending" type="button">✓ 一鍵標示已完成</button></div>
            <div class="pending-rule">只顯示正式後台中「通知狀態以 ⚠️ 開頭」的訂單。</div>
            <div class="pending-selection-help">勾選多筆可批次完成；每張卡片也能單獨處理。</div>
            <div class="pending-list">${pendingNotifications.map((order) => `<article data-pending-id="${order.id}"><label class="pending-check" aria-label="選取 ${order.owner} 的待處理項目"><input class="pending-select" type="checkbox"><span>✓</span></label><button class="pending-summary" type="button" data-pending-order="${order.id}"><b>${order.avatar}</b><span><strong>${order.owner}｜${order.pet}</strong><small>${order.id}・${order.date}</small><em>${order.notifyStatus}</em></span><i>查看詳情 ›</i></button><div class="pending-actions"><button class="mark-pending-complete" type="button">標示完成</button><button class="send-notification" type="button">立即發送</button></div></article>`).join('')}</div>
            <output id="pending-bulk-feedback" class="pending-bulk-feedback" aria-live="polite"></output>
          </section>

          <section class="app-view search-view" data-view-panel="search">
            <div class="page-heading"><span class="eyebrow">搜尋訂單</span></div>
            <label class="recent-search">${icons.search}<input id="all-order-search" type="search" placeholder="搜尋飼主、毛孩、日期或編號" aria-label="搜尋所有訂單"></label>
            <div class="filter-chips"><button class="active" type="button" data-filter="all">全部訂單</button><button type="button" data-filter="unfinished">全部未完成</button><button type="button" data-filter="deposit">未付訂金</button><button type="button" data-filter="complete">完成</button></div>
            <div class="recent-sort-note">以今天為基準，由日期最近排到最遠。</div>
            <div id="search-results" class="recent-list">${allOrderCards}</div>
            <div class="search-empty" id="all-order-empty" hidden>找不到符合條件的訂單。</div>
          </section>

          <section class="app-view test-view" data-view-panel="test">
            <div class="page-heading"><span class="eyebrow">測試訂單</span></div>
            <div class="test-notice">🧪 以下資料與正式訂單隔離，重新整理後仍會保留在此瀏覽器。</div><div id="test-order-list" class="recent-list"></div>
          </section>

          <section class="app-view availability-view" data-view-panel="availability">
            <div class="page-heading"><span class="eyebrow">可預約時間</span></div>
            <div class="availability-toolbar"><label><span>選擇年月</span><input id="availability-month" type="month" value="2026-10"></label><button id="sync-calendar" class="secondary-action" type="button">同步 Google 行事曆</button></div>
            <div class="calendar-legend"><span><i class="dot open"></i>可預約</span><span><i class="dot limited"></i>少量</span><span><i class="dot blocked"></i>不可預約</span></div>
            <div class="date-jump"><label><span>搜尋日期</span><input id="jump-date" type="date" value="2026-10-10"></label><button id="jump-date-button" class="secondary-action" type="button">切到該日</button><button id="show-month-button" class="secondary-action" type="button">顯示整月</button></div>
            <details class="form-card unavailable-form"><summary>＋ 新增不可預約時段</summary><div class="form-grid"><label><span>日期</span><input type="date"></label><label><span>備註</span><input placeholder="例如：上班、私人行程"></label><label><span>開始時間</span><input type="time"></label><label><span>結束時間</span><input type="time"></label></div><button class="form-submit" type="button">新增不可預約</button></details>
            <div id="availability-days" class="availability-days"></div>
            <div id="availability-savebar" class="availability-savebar" hidden><span id="availability-save-status">尚未儲存</span><div><button id="revert-availability" class="secondary-action" type="button">返回</button><button id="save-availability" class="form-submit" type="button">儲存變更</button></div></div>
          </section>
        </main>

        <nav class="mobile-nav" aria-label="主要功能"><a class="active" href="#" data-view="dashboard">${icons.home}<span>主頁</span></a><a href="#" data-view="create">${icons.plus}<span>新增訂單</span></a><a href="#" data-view="pending">${icons.inbox}<span>待處理</span><b data-pending-badge>${pendingNotifications.length}</b></a></nav>
      </section>
    </div>

    <div class="avatar-picker-layer" aria-hidden="true">
      <button class="avatar-picker-scrim" type="button" aria-label="關閉頭像選單"></button>
      <section class="avatar-picker" role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title">
        <div><small>個人設定</small><h2 id="avatar-picker-title">選擇頭像</h2><p>此預覽會在這台裝置記住你的選擇。</p></div>
        <div class="avatar-options" role="list" aria-label="可選頭像">
          ${['🐶', '🐕', '🐾', '🌼', '💙', 'P'].map((avatar) => `<button type="button" data-avatar-option="${avatar}" aria-label="使用 ${avatar} 作為頭像">${avatar}</button>`).join('')}
        </div>
        <button class="avatar-picker-close" type="button">完成</button>
      </section>
    </div>

    <div class="detail-layer" aria-hidden="true">
      <button class="detail-scrim" type="button" aria-label="關閉訂單明細"></button>
      <section class="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <header><button class="detail-close" type="button" aria-label="返回訂單清單">‹</button><div><h2 id="detail-title">訂單明細</h2><small id="detail-id">訂單</small></div></header>
        <div class="detail-scroll">
          <section class="detail-hero"><div><strong id="detail-date">—</strong><span id="detail-hero-service">服務內容</span><em id="detail-hero-status" class="order-status tone-blue">待執行</em></div><b id="detail-amount">—</b></section>
          <section class="detail-card"><div class="detail-section-heading"><div><span class="detail-section-mark"></span><h3>訂單資料</h3></div><button class="detail-edit" type="button">修改訂單資料</button></div>
            <div class="detail-form-grid"><label><span>飼主</span><input id="detail-owner" disabled></label><label><span>毛孩</span><input id="detail-pet" disabled></label><label><span>家庭編號</span><input id="detail-family-id" disabled></label><label class="detail-wide"><span>服務日期</span><input id="detail-date-input" disabled></label><label class="detail-wide"><span>備註</span><textarea id="detail-note" rows="3" disabled></textarea></label></div>
            <button class="detail-save-edit" type="button" hidden>儲存修改</button>
          </section>
          <section class="detail-card detail-service-card"><div class="detail-section-heading"><div><span class="detail-section-mark"></span><h3>服務內容</h3></div></div>
            <div class="detail-service-item"><strong>服務 1</strong><div class="detail-service-grid"><label><span>服務類別</span><select id="detail-service-category" disabled></select></label><label><span>服務方案</span><select id="detail-service-plan" disabled></select></label><label><span>時長／規格</span><input id="detail-service-duration" readonly disabled></label><label><span>次數</span><input id="detail-service-times" type="number" min="1" value="1" disabled></label><label><span>標準單價</span><input id="detail-unit-price" type="number" min="0" readonly disabled></label><label><span>自訂單價</span><input id="detail-custom-price" type="number" min="0" placeholder="空白則用標準單價" disabled></label><label class="detail-service-wide"><span>服務日期</span><input id="detail-service-date" disabled></label><label><span>小計</span><output id="detail-subtotal">—</output></label></div></div>
          </section>
          <section class="detail-card detail-fee-card"><div class="detail-section-heading"><div><span class="detail-section-mark"></span><h3>費用摘要</h3></div></div><div class="detail-fee-box"><p><span>待付尾款</span><b id="detail-balance">—</b></p><p><strong>訂單總金額</strong><strong id="detail-total">—</strong></p></div></section>
          <section class="detail-card detail-note-card"><div class="detail-section-heading"><div><span class="detail-section-mark"></span><h3>備註</h3></div></div><p id="detail-note-display">—</p></section>
        </div>
        <footer class="detail-action-bar">
          <p id="detail-notify-status">通知：—</p>
          <div class="detail-workflow-actions"><select id="detail-status-select" aria-label="訂單狀態"><option>未付訂金</option><option>待執行</option><option>常客</option><option>常客-待付尾款</option><option>未付尾款</option><option>完成</option></select><button class="detail-save-status" type="button">儲存</button><button class="detail-send" type="button">發送通知</button></div>
          <output class="detail-feedback" aria-live="polite"></output>
        </footer>
      </section>
    </div>`;

  const root = document.documentElement;
  const loading = document.querySelector('.loading-screen');
  const titleMap = { dashboard: '主頁', recent: '近期訂單', create: '新增訂單', pending: '待處理', search: '搜尋訂單', test: '測試訂單', availability: '可預約時間' };
  let serviceSequence = 0;
  let currentOrder = null;
  const availabilityPendingChanges = new Map();

  function persistTestState() {
    savedTestState.orders = testOrders;
    savedTestState.availability = savedTestState.availability || {};
    window.localStorage.setItem(TEST_STATE_KEY, JSON.stringify(savedTestState));
  }

  function renderTestOrders() {
    const list = document.getElementById('test-order-list');
    if (!list) return;
    list.innerHTML = testOrders.length ? [...testOrders].sort((a, b) => orderTime(b) - orderTime(a)).map(orderCardHtml).join('') : '<div class="test-notice">目前沒有測試訂單。</div>';
    list.querySelectorAll('[data-order-id]').forEach((item) => item.addEventListener('click', () => openOrder(item.dataset.orderId)));
  }

  function money(value) {
    return Math.round(Number(value) || 0).toLocaleString('zh-TW');
  }

  function catalogCategory(service) {
    if (serviceCatalog[service]) return service;
    const normalized = String(service || '').replace(/[－–]/g, '-');
    return Object.keys(serviceCatalog).find((category) => category.replace(/[－–]/g, '-') === normalized) || '到府照顧';
  }

  function fillPlanOptions(categoryControl, planControl, selectedPlan) {
    const rules = serviceCatalog[categoryControl.value] || serviceCatalog['到府照顧'];
    planControl.innerHTML = rules.map(([name]) => `<option value="${name}">${name}</option>`).join('');
    if (selectedPlan && rules.some(([name]) => name === selectedPlan)) planControl.value = selectedPlan;
    return rules.find(([name]) => name === planControl.value) || rules[0];
  }

  function selectedCatalogRule(categoryControl, planControl) {
    const rules = serviceCatalog[categoryControl.value] || serviceCatalog['到府照顧'];
    return rules.find(([name]) => name === planControl.value) || rules[0];
  }

  function addServiceItem() {
    serviceSequence += 1;
    const card = document.createElement('article');
    card.className = 'service-item-card';
    const categoryOptions = Object.keys(serviceCatalog).map((category) => `<option value="${category}">${category}</option>`).join('');
    card.innerHTML = `<div class="service-item-heading"><strong>服務 ${serviceSequence}</strong><button class="remove-service" type="button">移除</button></div><div class="form-grid"><label><span>服務類別 *</span><select class="service-category">${categoryOptions}</select></label><label><span>服務方案 *</span><select class="service-plan"></select></label><label><span>時長／規格</span><input class="service-duration" type="text" readonly></label><label><span>次數</span><input class="service-times" type="number" min="1" value="1"></label><label><span>預約時段</span><select><option>晚上</option><option>早上</option><option>下午</option><option>指定時間</option></select></label><label><span>指定時間</span><input type="time" value="18:30"></label><label><span>標準單價</span><input class="service-price" type="number" min="0" readonly></label><label><span>自訂單價</span><input class="service-custom" type="number" min="0" placeholder="空白則用標準單價"></label></div>`;
    const category = card.querySelector('.service-category');
    const plan = card.querySelector('.service-plan');
    const syncPlans = () => {
      fillPlanOptions(category, plan);
      syncServicePrice(card);
    };
    category.addEventListener('change', syncPlans);
    plan.addEventListener('change', () => syncServicePrice(card));
    card.querySelector('.remove-service').addEventListener('click', () => { if (document.querySelectorAll('.service-item-card').length > 1) { card.remove(); updateCalculation(); } });
    card.querySelectorAll('input,select').forEach((control) => control.addEventListener('input', updateCalculation));
    document.getElementById('service-items').appendChild(card);
    syncPlans();
  }

  function syncServicePrice(card) {
    const category = card.querySelector('.service-category').value;
    const plan = card.querySelector('.service-plan').value;
    const rule = selectedCatalogRule(card.querySelector('.service-category'), card.querySelector('.service-plan'));
    card.querySelector('.service-duration').value = /^\d+$/.test(rule[1]) ? `${rule[1]} 分鐘` : rule[1];
    card.querySelector('.service-price').value = rule[2];
    updateCalculation();
  }

  function updateCalculation() {
    const items = [...document.querySelectorAll('.service-item-card')];
    const serviceTotal = items.reduce((sum, card) => {
      const standard = Number(card.querySelector('.service-price').value) || 0;
      const custom = Number(card.querySelector('.service-custom').value);
      const unit = Number.isFinite(custom) && card.querySelector('.service-custom').value !== '' ? custom : standard;
      return sum + unit * Math.max(1, Number(card.querySelector('.service-times').value) || 1);
    }, 0);
    const totalTimes = items.reduce((sum, card) => sum + Math.max(1, Number(card.querySelector('.service-times').value) || 1), 0);
    const travelTotal = (Number(document.getElementById('travel-fee').value) || 0) * totalTimes;
    const tip = Number(document.getElementById('tip').value) || 0;
    const discount = Math.max(0, Number(document.getElementById('discount').value) || 0);
    const total = Math.round((serviceTotal + travelTotal + tip) * discount);
    const deposit = Math.round(total * Math.max(0, Number(document.getElementById('deposit-rate').value) || 0));
    const paid = Number(document.getElementById('paid').value) || 0;
    document.getElementById('calculation').innerHTML = `<h3>費用試算</h3><p><span>服務費</span><strong>${money(serviceTotal)} 元</strong></p><p><span>車馬費（${totalTimes} 次）</span><strong>${money(travelTotal)} 元</strong></p><p><span>小費</span><strong>${money(tip)} 元</strong></p><p class="calculation-total"><span>訂單總額</span><strong>${money(total)} 元</strong></p><p><span>應收訂金</span><strong>${money(deposit)} 元</strong></p><p class="calculation-balance"><span>目前未收</span><strong>${money(Math.max(0, total - paid))} 元</strong></p>`;
  }

  function syncDepositRateToStatus() {
    const status = document.getElementById('order-status').value;
    document.getElementById('deposit-rate').value = status.includes('常客') ? '0' : '0.5';
    updateCalculation();
  }

  function renderAvailability(filterDate = '') {
    const dates = [
      ['2026-10-10', '國慶日', '全天可預約', ['可預約', '可預約', '少量']],
      ['2026-10-11', '星期日', '全天可預約', ['可預約', '少量', '可預約']],
      ['2026-10-12', '星期一', '平日晚上', ['不可預約', '不可預約', '可預約']],
      ['2026-10-13', '星期二', '平日晚上', ['不可預約', '不可預約', '少量']],
      ['2026-10-17', '星期六', '全天可預約', ['可預約', '可預約', '可預約']]
    ].filter((item) => !filterDate || item[0] === filterDate);
    const slotNames = ['早上', '下午', '晚上'];
    const savedAvailability = savedTestState.availability || {};
    document.getElementById('availability-days').innerHTML = dates.map((item) => `<article class="availability-day"><header><strong>${item[0]}｜${item[1]}</strong><span>${item[2]}</span></header><div>${item[3].map((originalStatus, index) => {
      const key = `${item[0]}|${index}`;
      const savedStatus = savedAvailability[key] || originalStatus;
      const status = availabilityPendingChanges.has(key) ? availabilityPendingChanges.get(key) : savedStatus;
      const pending = availabilityPendingChanges.has(key);
      return `<button type="button" data-slot-key="${key}" data-original-status="${savedStatus}" class="slot ${status === '可預約' ? 'open' : status === '少量' ? 'limited' : 'blocked'}${pending ? ' pending-change' : ''}"><b>${slotNames[index]}</b><small>${pending ? (status === '不可預約' ? '將設為不可預約' : '將恢復開放') : status}</small></button>`;
    }).join('')}</div></article>`).join('') || '<div class="test-notice">這一天目前沒有可預約資料。</div>';
    document.querySelectorAll('.slot').forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.slotKey;
      const original = button.dataset.originalStatus;
      const current = availabilityPendingChanges.has(key) ? availabilityPendingChanges.get(key) : original;
      const next = current === '不可預約' ? '可預約' : '不可預約';
      if (next === original) availabilityPendingChanges.delete(key); else availabilityPendingChanges.set(key, next);
      renderAvailability(filterDate);
      updateAvailabilitySavebar();
    }));
    updateAvailabilitySavebar();
  }

  function updateAvailabilitySavebar() {
    const bar = document.getElementById('availability-savebar');
    if (!bar) return;
    const count = availabilityPendingChanges.size;
    bar.hidden = count === 0;
    document.getElementById('availability-save-status').textContent = count ? `已修改 ${count} 個時段，尚未儲存` : '';
  }

  function updatePendingIndicators() {
    const remaining = document.querySelectorAll('.pending-list article:not(.done)').length;
    document.querySelectorAll('[data-pending-count]').forEach((item) => { item.textContent = String(remaining); });
    document.querySelectorAll('[data-pending-summary]').forEach((item) => { item.textContent = remaining ? `${remaining} 筆訂單通知尚未發送` : '目前沒有待處理通知'; });
    document.querySelectorAll('[data-pending-badge]').forEach((badge) => {
      badge.textContent = String(remaining);
      badge.hidden = remaining === 0;
    });
    document.querySelectorAll('[data-pending-mini]').forEach((item) => {
      const detail = document.querySelector(`[data-pending-id="${item.dataset.pendingMini}"]`);
      item.hidden = !detail || detail.classList.contains('done');
    });
    const bulkButton = document.getElementById('complete-all-pending');
    if (bulkButton && remaining === 0) { bulkButton.disabled = true; bulkButton.textContent = '全部已完成 ✓'; }
  }

  function playLoading() {
    loading.classList.remove('hidden');
    window.clearTimeout(playLoading.timer);
    playLoading.timer = window.setTimeout(() => loading.classList.add('hidden'), 900);
  }

  function closeDrawer() {
    document.body.classList.remove('mobile-drawer-open');
    document.body.style.overflow = '';
  }

  function switchView(name) {
    const target = document.querySelector(`[data-view-panel="${name}"]`);
    if (!target) return;
    document.querySelectorAll('[data-view-panel]').forEach((panel) => panel.classList.toggle('is-active', panel === target));
    document.querySelectorAll('.mobile-nav [data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
    document.querySelectorAll('.sidebar nav [data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === name || (name === 'create' && item.dataset.view === 'recent')));
    document.title = `快樂小狗｜${titleMap[name] || '訂單管理'}`;
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openOrder(orderId) {
    const order = allOrders.find((item) => item.id === orderId);
    if (!order) return;
    currentOrder = order;
    document.getElementById('detail-id').textContent = `訂單 ${order.id}`;
    document.getElementById('detail-title').textContent = `${order.owner}｜${order.pet}`;
    document.getElementById('detail-date').textContent = order.date;
    document.getElementById('detail-amount').textContent = order.amount;
    document.getElementById('detail-hero-service').textContent = order.service;
    const heroStatus = document.getElementById('detail-hero-status');
    heroStatus.textContent = order.status;
    heroStatus.className = `order-status ${statusTone(order.status)}`;
    document.getElementById('detail-owner').value = order.owner;
    document.getElementById('detail-pet').value = order.pet;
    document.getElementById('detail-family-id').value = order.familyId || '';
    document.getElementById('detail-date-input').value = order.date;
    document.getElementById('detail-note').value = order.note || '';
    document.getElementById('detail-note-display').textContent = order.note || '沒有備註';
    const detailCategory = document.getElementById('detail-service-category');
    const detailPlan = document.getElementById('detail-service-plan');
    detailCategory.innerHTML = Object.keys(serviceCatalog).map((category) => `<option value="${category}">${category}</option>`).join('');
    detailCategory.value = catalogCategory(order.service);
    fillPlanOptions(detailCategory, detailPlan, '30分');
    document.getElementById('detail-service-times').value = '1';
    document.getElementById('detail-custom-price').value = '';
    document.getElementById('detail-service-date').value = order.date;
    syncDetailService(false);
    document.getElementById('detail-subtotal').textContent = order.amount;
    document.getElementById('detail-balance').textContent = order.amount;
    document.getElementById('detail-total').textContent = order.amount;
    document.getElementById('detail-status-select').value = order.status;
    document.getElementById('detail-notify-status').textContent = `通知：${order.notifyStatus || '尚無通知紀錄'}`;
    document.querySelector('.detail-feedback').textContent = '';
    setDetailEditing(false);
    const layer = document.querySelector('.detail-layer');
    layer.classList.add('open');
    layer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeOrder() {
    const layer = document.querySelector('.detail-layer');
    layer.classList.remove('open');
    layer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentOrder = null;
  }

  function setDetailEditing(editing) {
    document.querySelectorAll('.detail-form-grid input,.detail-form-grid textarea').forEach((control) => { control.disabled = !editing; });
    document.querySelectorAll('.detail-service-grid select,.detail-service-grid input:not([readonly])').forEach((control) => { control.disabled = !editing; });
    document.querySelector('.detail-edit').hidden = editing;
    document.querySelector('.detail-save-edit').hidden = !editing;
  }

  function syncDetailService(recalculate = true) {
    const category = document.getElementById('detail-service-category');
    const plan = document.getElementById('detail-service-plan');
    const rule = selectedCatalogRule(category, plan);
    const duration = /^\d+$/.test(rule[1]) ? `${rule[1]} 分鐘` : rule[1];
    document.getElementById('detail-service-duration').value = duration;
    document.getElementById('detail-unit-price').value = rule[2];
    document.getElementById('detail-service-date').value = document.getElementById('detail-date-input').value;
    if (recalculate) updateDetailCalculation();
  }

  function updateDetailCalculation() {
    const standard = Number(document.getElementById('detail-unit-price').value) || 0;
    const customControl = document.getElementById('detail-custom-price');
    const custom = Number(customControl.value);
    const unit = customControl.value !== '' && Number.isFinite(custom) ? custom : standard;
    const times = Math.max(1, Number(document.getElementById('detail-service-times').value) || 1);
    const total = unit * times;
    const formatted = `${money(total)} 元`;
    document.getElementById('detail-subtotal').textContent = formatted;
    document.getElementById('detail-balance').textContent = formatted;
    document.getElementById('detail-total').textContent = formatted;
    document.getElementById('detail-amount').textContent = formatted;
    return total;
  }

  function updateOrderCards(order) {
    document.querySelectorAll(`[data-order-id="${order.id}"]`).forEach((card) => {
      const name = card.querySelector('.recent-name strong');
      const service = card.querySelector('.recent-name small');
      const status = card.querySelector('.recent-card-top>em');
      const date = card.querySelector('.recent-card-bottom strong');
      const amount = card.querySelector('.recent-card-bottom>b');
      if (name) name.textContent = `${order.owner}｜${order.pet}`;
      if (service) service.textContent = order.service;
      if (status) {
        status.textContent = order.status;
        status.className = `order-status ${statusTone(order.status)}`;
      }
      if (date) date.textContent = order.date;
      if (amount) amount.textContent = order.amount;
      const dashboardPet = card.querySelector('.dashboard-pet strong');
      const dashboardOwner = card.querySelector('.dashboard-owner');
      const dashboardService = card.querySelector('.dashboard-service');
      const dashboardStatus = card.querySelector('.dashboard-status');
      const dashboardDate = card.querySelector('.dashboard-date');
      const dashboardAmount = card.querySelector('.dashboard-amount');
      if (dashboardPet) dashboardPet.textContent = order.pet;
      if (dashboardOwner) dashboardOwner.textContent = order.owner;
      if (dashboardService) dashboardService.textContent = order.service;
      if (dashboardStatus) {
        dashboardStatus.textContent = order.status;
        dashboardStatus.className = `status dashboard-status ${dashboardStatusTone(order.status)}`;
      }
      if (dashboardDate) dashboardDate.textContent = order.date;
      if (dashboardAmount) dashboardAmount.textContent = order.amount;
      if (card.closest('[data-recent-results],.dashboard-recent-list,.desktop-order-table')) card.hidden = order.status === '完成';
    });
  }

  function saveDetailEdits() {
    if (!currentOrder) return;
    currentOrder.owner = document.getElementById('detail-owner').value.trim() || currentOrder.owner;
    currentOrder.pet = document.getElementById('detail-pet').value.trim() || currentOrder.pet;
    currentOrder.familyId = document.getElementById('detail-family-id').value.trim();
    currentOrder.service = document.getElementById('detail-service-category').value;
    currentOrder.date = document.getElementById('detail-date-input').value.trim() || currentOrder.date;
    currentOrder.note = document.getElementById('detail-note').value.trim();
    currentOrder.amount = `${money(updateDetailCalculation())} 元`;
    document.getElementById('detail-title').textContent = `${currentOrder.owner}｜${currentOrder.pet}`;
    document.getElementById('detail-date').textContent = currentOrder.date;
    document.getElementById('detail-hero-service').textContent = currentOrder.service;
    document.getElementById('detail-service-date').value = currentOrder.date;
    document.getElementById('detail-note-display').textContent = currentOrder.note || '沒有備註';
    updateOrderCards(currentOrder);
    if (currentOrder.isTestOrder) { persistTestState(); renderTestOrders(); }
    setDetailEditing(false);
    document.querySelector('.detail-feedback').textContent = currentOrder.isTestOrder ? '測試訂單資料已儲存 ✓' : '功能測試中已更新（未寫入正式資料）';
  }

  function saveDetailStatus(sendNotification) {
    if (!currentOrder) return;
    const status = document.getElementById('detail-status-select').value;
    currentOrder.status = status;
    if (sendNotification) currentOrder.notifyStatus = `測試完成「${status}」通知（未發送 LINE）`;
    document.getElementById('detail-notify-status').textContent = `通知：${currentOrder.notifyStatus || '尚無通知紀錄'}`;
    const heroStatus = document.getElementById('detail-hero-status');
    heroStatus.textContent = status;
    heroStatus.className = `order-status ${statusTone(status)}`;
    updateOrderCards(currentOrder);
    if (currentOrder.isTestOrder) { persistTestState(); renderTestOrders(); }
    const feedback = document.querySelector('.detail-feedback');
    feedback.textContent = sendNotification ? `狀態已更新為「${status}」，通知流程測試完成（未發送 LINE）✓` : `狀態已更新為「${status}」✓`;
  }

  function openAvatarPicker() {
    closeDrawer();
    const layer = document.querySelector('.avatar-picker-layer');
    layer.classList.add('open');
    layer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    layer.querySelector(`[data-avatar-option="${userProfile.avatar}"]`)?.focus();
  }

  function closeAvatarPicker() {
    const layer = document.querySelector('.avatar-picker-layer');
    layer.classList.remove('open');
    layer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function selectAvatar(avatar) {
    userProfile.avatar = avatar;
    window.localStorage.setItem('pinyu-admin-avatar', avatar);
    document.querySelectorAll('[data-user-avatar]').forEach((item) => { item.textContent = avatar; });
    document.querySelectorAll('[data-avatar-option]').forEach((item) => item.classList.toggle('selected', item.dataset.avatarOption === avatar));
  }

  playLoading();
  document.querySelector('.theme-toggle').addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; });
  document.querySelector('.refresh-demo').addEventListener('click', playLoading);
  document.querySelector('.mobile-menu').addEventListener('click', () => { document.body.classList.add('mobile-drawer-open'); document.body.style.overflow = 'hidden'; });
  document.querySelector('.sidebar-close').addEventListener('click', closeDrawer);
  document.querySelector('.sidebar-scrim').addEventListener('click', closeDrawer);
  document.querySelectorAll('[data-view]').forEach((item) => item.addEventListener('click', (event) => { event.preventDefault(); switchView(item.dataset.view); }));
  document.querySelectorAll('[data-order-id]').forEach((item) => item.addEventListener('click', () => openOrder(item.dataset.orderId)));
  document.querySelector('.detail-close').addEventListener('click', closeOrder);
  document.querySelector('.detail-scrim').addEventListener('click', closeOrder);
  document.querySelector('.detail-edit').addEventListener('click', () => setDetailEditing(true));
  document.querySelector('.detail-save-edit').addEventListener('click', saveDetailEdits);
  document.querySelector('.detail-save-status').addEventListener('click', () => saveDetailStatus(false));
  document.querySelector('.detail-send').addEventListener('click', () => saveDetailStatus(true));
  document.querySelectorAll('.avatar-picker-trigger').forEach((button) => button.addEventListener('click', openAvatarPicker));
  document.querySelector('.avatar-picker-scrim').addEventListener('click', closeAvatarPicker);
  document.querySelector('.avatar-picker-close').addEventListener('click', closeAvatarPicker);
  document.querySelectorAll('[data-avatar-option]').forEach((button) => button.addEventListener('click', () => selectAvatar(button.dataset.avatarOption)));
  document.querySelectorAll('[data-avatar-option]').forEach((button) => button.classList.toggle('selected', button.dataset.avatarOption === userProfile.avatar));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeAvatarPicker(); closeOrder(); } });
  document.querySelector('.family-trigger').addEventListener('click', (event) => {
    const options = document.querySelector('.family-options');
    options.hidden = !options.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!options.hidden));
  });
  document.querySelectorAll('[data-family]').forEach((item) => item.addEventListener('click', () => {
    document.querySelector('.selected-family').textContent = `已選擇：${item.dataset.family}｜車馬費 ${item.dataset.fee} 元／次`;
    document.querySelector('[name="owner"]').value = item.dataset.owner;
    document.querySelector('[name="pet"]').value = item.dataset.pet;
    document.getElementById('travel-fee').value = item.dataset.fee;
    document.querySelector('.family-trigger span').textContent = item.dataset.family;
    document.querySelector('.family-options').hidden = true;
    document.querySelector('.family-trigger').setAttribute('aria-expanded', 'false');
    updateCalculation();
  }));
  document.getElementById('add-service').addEventListener('click', addServiceItem);
  document.getElementById('order-status').addEventListener('change', syncDepositRateToStatus);
  ['travel-fee', 'tip', 'discount', 'deposit-rate', 'paid'].forEach((id) => document.getElementById(id).addEventListener('input', updateCalculation));
  document.querySelector('.preview-form').addEventListener('reset', () => window.setTimeout(() => { document.querySelector('.selected-family').textContent = '尚未選擇家庭'; document.querySelector('.family-trigger span').textContent = '輸入飼主、毛孩或家庭編號'; document.getElementById('service-items').innerHTML = ''; serviceSequence = 0; addServiceItem(); }, 0));
  document.querySelector('.preview-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!document.querySelector('[name="owner"]').value) { window.alert('請先選擇家庭。'); return; }
    const firstService = document.querySelector('.service-item-card');
    const start = form.querySelector('[name="start"]').value;
    const end = form.querySelector('[name="end"]').value || start;
    const owner = document.querySelector('[name="owner"]').value;
    const pet = document.querySelector('[name="pet"]').value || '未填毛孩';
    const totalText = document.querySelector('.calculation-total strong')?.textContent || '0';
    const order = { id: `T-${Date.now().toString().slice(-8)}`, avatar: pet.trim().charAt(0) || '測', owner, pet, familyId: 'TEST', service: firstService.querySelector('.service-category').value, startDate: start, date: start === end ? start.replaceAll('-', '/') : `${start.replaceAll('-', '/')}–${end.replaceAll('-', '/')}`, status: document.getElementById('order-status').value, amount: `${money(Number(totalText.replace(/[^\d]/g, '')))} 元`, notifyStatus: '測試環境・不發送 LINE', note: document.getElementById('order-note').value, isTestOrder: true };
    testOrders.push(order); allOrders.push(order); persistTestState(); renderTestOrders();
    const button = event.submitter; button.textContent = '測試訂單已建立 ✓';
    window.setTimeout(() => { button.textContent = '建立測試訂單'; switchView('test'); }, 700);
  });
  document.querySelectorAll('[data-pending-order]').forEach((button) => button.addEventListener('click', () => openOrder(button.dataset.pendingOrder)));
  const markPendingDone = (article, label = '已標示完成') => {
    article.classList.add('done');
    const status = article.querySelector('em');
    if (status) status.textContent = label;
    article.querySelectorAll('.pending-actions button,input').forEach((item) => { item.disabled = true; });
    savedTestState.completedPending = Array.from(new Set([...(savedTestState.completedPending || []), article.dataset.pendingId]));
    persistTestState();
    updatePendingIndicators();
  };
  const refreshPendingBulkLabel = () => {
    const selected = document.querySelectorAll('.pending-select:checked:not(:disabled)').length;
    document.getElementById('complete-all-pending').textContent = selected ? `✓ 標示已完成（${selected}）` : '✓ 一鍵標示已完成';
  };
  document.querySelectorAll('.pending-select').forEach((input) => input.addEventListener('change', refreshPendingBulkLabel));
  document.querySelectorAll('.mark-pending-complete').forEach((button) => button.addEventListener('click', () => {
    const article = button.closest('article');
    const name = article.querySelector('.pending-summary strong')?.textContent || '這筆待處理項目';
    if (!window.confirm(`確定要將「${name}」標示為已完成嗎？`)) return;
    markPendingDone(article);
    document.getElementById('pending-bulk-feedback').textContent = `已將「${name}」標示完成。`;
    refreshPendingBulkLabel();
  }));
  document.querySelectorAll('.send-notification').forEach((button) => button.addEventListener('click', () => {
    const article = button.closest('article');
    markPendingDone(article, '通知已發送');
    button.textContent = '已發送 ✓';
    refreshPendingBulkLabel();
  }));
  document.getElementById('complete-all-pending').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const selected = [...document.querySelectorAll('.pending-list article')].filter((article) => article.querySelector('.pending-select:checked:not(:disabled)'));
    const remaining = [...document.querySelectorAll('.pending-list article:not(.done)')];
    const targets = selected.length ? selected : remaining;
    if (!targets.length) return;
    const scope = selected.length ? `選取的 ${targets.length} 筆` : `全部 ${targets.length} 筆`;
    if (!window.confirm(`確定要將${scope}待處理項目標示為已完成嗎？`)) return;
    targets.forEach((article) => markPendingDone(article));
    const hasRemaining = document.querySelector('.pending-list article:not(.done)');
    button.disabled = !hasRemaining;
    button.textContent = hasRemaining ? '✓ 一鍵標示已完成' : '全部已完成 ✓';
    document.getElementById('pending-bulk-feedback').textContent = `已將 ${targets.length} 筆待處理項目標示完成。`;
    updatePendingIndicators();
  });
  document.getElementById('detail-service-category').addEventListener('change', () => {
    const category = document.getElementById('detail-service-category');
    const plan = document.getElementById('detail-service-plan');
    fillPlanOptions(category, plan);
    document.getElementById('detail-custom-price').value = '';
    syncDetailService();
  });
  document.getElementById('detail-service-plan').addEventListener('change', () => { document.getElementById('detail-custom-price').value = ''; syncDetailService(); });
  ['detail-service-times', 'detail-custom-price'].forEach((id) => document.getElementById(id).addEventListener('input', updateDetailCalculation));
  document.getElementById('detail-date-input').addEventListener('input', () => { document.getElementById('detail-service-date').value = document.getElementById('detail-date-input').value; });
  document.getElementById('detail-service-date').addEventListener('input', () => { document.getElementById('detail-date-input').value = document.getElementById('detail-service-date').value; });
  const recentSearch = document.querySelector('.recent-view .recent-search input');
  const runRecentSearch = () => {
    const key = recentSearch.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('[data-recent-results] .recent-order-card').forEach((card) => {
      const matches = card.textContent.toLowerCase().includes(key);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    document.querySelector('[data-recent-empty]').hidden = visible > 0;
  };
  recentSearch.addEventListener('input', runRecentSearch);
  const runSearch = () => { const key = document.getElementById('all-order-search').value.trim().toLowerCase(); const filter = document.querySelector('.filter-chips .active').dataset.filter; let visible = 0; document.querySelectorAll('#search-results .recent-order-card').forEach((card) => { const order = allOrders.find((item) => item.id === card.dataset.orderId); const filterOk = filter === 'all' || (filter === 'unfinished' && order.status !== '完成') || (filter === 'deposit' && order.status === '未付訂金') || (filter === 'complete' && order.status === '完成'); const matches = filterOk && card.textContent.toLowerCase().includes(key); card.hidden = !matches; if (matches) visible += 1; }); document.getElementById('all-order-empty').hidden = visible > 0; };
  document.getElementById('all-order-search').addEventListener('input', runSearch);
  document.querySelectorAll('.filter-chips button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.filter-chips button').forEach((item) => item.classList.toggle('active', item === button)); runSearch(); }));
  document.getElementById('jump-date-button').addEventListener('click', () => { const value = document.getElementById('jump-date').value; if (value) { document.getElementById('availability-month').value = value.slice(0, 7); renderAvailability(value); } });
  document.getElementById('show-month-button').addEventListener('click', () => renderAvailability());
  document.getElementById('availability-month').addEventListener('change', () => renderAvailability());
  document.getElementById('sync-calendar').addEventListener('click', (event) => { const button = event.currentTarget; button.textContent = '同步完成 ✓'; window.setTimeout(() => { button.textContent = '同步 Google 行事曆'; }, 1400); });
  document.querySelector('.unavailable-form .form-submit').addEventListener('click', (event) => { event.currentTarget.textContent = '測試資料已新增 ✓'; window.setTimeout(() => { event.currentTarget.textContent = '新增不可預約'; }, 1400); });
  document.getElementById('revert-availability').addEventListener('click', () => { availabilityPendingChanges.clear(); renderAvailability(); });
  document.getElementById('save-availability').addEventListener('click', (event) => {
    savedTestState.availability = savedTestState.availability || {};
    availabilityPendingChanges.forEach((status, key) => { savedTestState.availability[key] = status; });
    availabilityPendingChanges.clear(); persistTestState(); renderAvailability();
    event.currentTarget.textContent = '已儲存 ✓'; window.setTimeout(() => { event.currentTarget.textContent = '儲存變更'; }, 1100);
  });
  (savedTestState.completedPending || []).forEach((id) => {
    const article = document.querySelector(`[data-pending-id="${id}"]`);
    if (article) markPendingDone(article);
  });
  addServiceItem();
  renderTestOrders();
  renderAvailability();
  updatePendingIndicators();
})();
