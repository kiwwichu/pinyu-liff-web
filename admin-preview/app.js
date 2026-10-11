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

  const orders = [
    { id: 'O-261212-01', avatar: '未', owner: '可/Jun', pet: '未填毛孩', service: '04新－客價格', date: '2026/12/12–2026/12/15', status: '待服務', amount: '2,200 元' },
    { id: 'O-261027-02', avatar: '歐', owner: '熊', pet: '歐拉', service: '到府照顧', date: '2026/10/27–2026/10/29', status: '待服務', amount: '1,500 元' },
    { id: 'O-261018-03', avatar: 'C', owner: 'Sandra', pet: 'Clyde', service: '04熟－客價格', date: '2026/10/18–2026/10/20', status: '待服務', amount: '1,800 元' },
    { id: 'O-261014-04', avatar: '豆', owner: '王小姐', pet: '豆豆', service: '到府照顧', date: '2026/10/14・18:30', status: '待執行', amount: '1,800 元' }
  ];
  const allOrders = [...orders, { id: 'O-260928-05', avatar: '奶', owner: '林小姐', pet: '奶茶', service: '散步服務', date: '2026/09/28・19:00', status: '完成', amount: '650 元' }];

  const orderCardHtml = (order) => `
    <button class="recent-order-card" type="button" data-order-id="${order.id}">
      <span class="recent-card-top">
        <b class="recent-avatar">${order.avatar}</b>
        <span class="recent-name"><strong>${order.owner}｜${order.pet}</strong><small>${order.service}</small></span>
        <em>${order.status}</em>
      </span>
      <span class="recent-card-bottom">${icons.clock}<strong>${order.date}</strong><b>${order.amount}</b><i>›</i></span>
    </button>`;
  const orderCards = orders.map(orderCardHtml).join('');
  const allOrderCards = allOrders.map(orderCardHtml).join('');

  document.getElementById('app').innerHTML = `
    <div class="loading-screen" role="status" aria-live="polite">
      <div class="loader-card"><span>加載中…</span><div class="loader-dots"><i></i><i></i><i></i></div></div>
    </div>

    <div class="dashboard-shell">
      <aside class="sidebar" aria-label="完整功能選單">
        <a class="brand" href="#" data-view="dashboard" aria-label="返回儀表板"><span class="brand-pet">🐶</span><span><strong>快樂小狗</strong><small>寵物保母管理後台</small></span></a>
        <button class="sidebar-close" type="button" aria-label="關閉功能選單">×</button>
        <nav>
          <a class="active" href="#" data-view="dashboard">${icons.home}<span>儀表板</span></a>
          <a href="#" data-view="recent">${icons.orders}<span>近期訂單</span></a>
          <a href="#" data-view="availability">${icons.calendar}<span>可預約時間</span></a>
          <a href="#" data-view="search">${icons.search}<span>搜尋訂單</span></a>
          <a href="#" data-view="dashboard">${icons.chart}<span>報表分析</span></a>
          <a href="#" data-view="pending">${icons.inbox}<span>待處理</span><b>3</b></a>
        </nav>
        <div class="sidebar-bottom"><button class="test-orders" type="button" data-view="test">🧪 <span>測試訂單</span><small>2</small></button><div class="admin"><span>品</span><div><strong>品妤</strong><small>管理員</small></div></div></div>
      </aside>
      <button class="sidebar-scrim" type="button" aria-label="關閉功能選單"></button>

      <section class="workspace">
        <header class="topbar">
          <button class="mobile-menu" type="button" aria-label="開啟選單">${icons.menu}</button>
          <div class="mobile-brand"><span>🐶</span><div><small>快樂小狗 Pinyu</small><strong data-page-title>儀表板</strong></div></div>
          <label class="search"><span>⌕</span><input aria-label="搜尋" placeholder="搜尋訂單、飼主或毛孩…"></label>
          <button class="theme-toggle" type="button" aria-label="切換明暗模式"><span class="sun">☀</span><span class="moon">☾</span></button>
          <button class="refresh-demo" type="button" title="重新播放載入動畫" aria-label="重新播放載入動畫">↻</button>
          <span class="avatar">品</span>
        </header>

        <main class="content">
          <section class="app-view is-active" data-view-panel="dashboard">
            <section class="hero">
              <div><span class="eyebrow">工作總覽</span><h1>早安，今天也一起照顧毛孩吧！</h1><p>近期未完成訂單已依服務日期排序。</p></div>
              <button class="primary-action" type="button" data-view="create">${icons.plus}<span>新增訂單</span></button>
            </section>
            <section class="metrics">
              <article class="metric metric-blue"><span>全部未完成</span><strong>12</strong><small>筆訂單</small><i>▣</i></article>
              <article class="metric metric-yellow"><span>需要處理</span><strong>5</strong><small>筆通知</small><i>✓</i></article>
              <article class="metric metric-coral"><span>服務家庭</span><strong>28</strong><small>本月新增 2</small><i>♡</i></article>
              <article class="metric metric-plain"><span>本月營收</span><strong>NT$ 24,560</strong><small>比上月 ＋18%</small><i>↗</i></article>
            </section>
            <section class="dashboard-grid">
              <article class="panel orders-panel">
                <div class="panel-heading"><div><h2>近期訂單</h2><span>最近未完成優先</span></div><button type="button" data-view="recent">查看全部 ›</button></div>
                <div class="order-head"><span>毛孩／飼主</span><span>服務時間</span><span>服務項目</span><span>狀態</span><span>金額</span></div>
                <button class="order-row" type="button" data-order-id="O-261014-04"><span class="pet"><b>豆</b><span><strong>豆豆</strong><small>王小姐<span class="mobile-date">・10/14 18:30</span></small></span></span><span>10/14・18:30</span><span>到府照顧</span><em class="status blue">待執行</em><strong>$1,800</strong></button>
                <button class="order-row" type="button" data-order-id="O-261027-02"><span class="pet"><b>歐</b><span><strong>歐拉</strong><small>熊<span class="mobile-date">・10/27–10/29</span></small></span></span><span>10/27–10/29</span><span>到府照顧</span><em class="status yellow">待服務</em><strong>$1,500</strong></button>
                <button class="order-row" type="button" data-order-id="O-261212-01"><span class="pet"><b>未</b><span><strong>未填毛孩</strong><small>可/Jun<span class="mobile-date">・12/12–12/15</span></small></span></span><span>12/12–12/15</span><span>04新－客價格</span><em class="status blue">待服務</em><strong>$2,200</strong></button>
              </article>
              <article class="panel tasks-panel">
                <div class="panel-heading"><div><h2>待處理</h2><span>3 件需要動作</span></div><button type="button" data-view="pending">查看全部 ›</button></div>
                <label><input type="checkbox"><span><strong>回覆奶茶飼主</strong><small>今天 12:00 前</small></span><em>訊息</em></label>
                <label><input type="checkbox"><span><strong>確認豆豆訂金</strong><small>訂單 #1028</small></span><em>收款</em></label>
                <label><input type="checkbox" checked><span><strong>準備備品清單</strong><small>10/16 服務</small></span><em>完成</em></label>
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
            <div class="recent-heading"><div><span class="eyebrow">近期訂單</span><h1>未完成訂單</h1></div><small>最近服務日期優先</small></div>
            <label class="recent-search">${icons.search}<input type="search" placeholder="搜尋飼主或毛孩" aria-label="搜尋近期訂單"></label>
            <div class="recent-list">${orderCards}</div>
          </section>

          <section class="app-view create-view" data-view-panel="create">
            <div class="view-title"><span class="eyebrow">建立資料</span><h1>新增訂單</h1><p>這是操作預覽，不會寫入正式資料。</p></div>
            <form class="preview-form" id="create-order-form">
              <section class="form-card"><div class="form-card-title"><b>1</b><span><strong>選擇家庭與毛孩</strong><small>搜尋既有家庭，選取後自動帶入車馬費</small></span></div>
                <label class="field-label">搜尋家庭 *</label><button class="family-trigger" type="button">${icons.search}<span>輸入飼主、毛孩或家庭編號</span><i>⌄</i></button>
                <div class="family-options" hidden><button type="button" data-family="王小姐｜豆豆、米米" data-owner="王小姐" data-pet="豆豆" data-fee="100">王小姐｜豆豆、米米<small>F-1028・車馬費 100 元／次</small></button><button type="button" data-family="熊｜歐拉" data-owner="熊" data-pet="歐拉" data-fee="150">熊｜歐拉<small>F-0916・車馬費 150 元／次</small></button><button type="button" data-family="Sandra｜Clyde" data-owner="Sandra" data-pet="Clyde" data-fee="120">Sandra｜Clyde<small>F-0882・車馬費 120 元／次</small></button><button class="family-collapse" type="button">⌃ 收回家庭選單</button></div>
                <output class="selected-family">尚未選擇家庭</output>
                <div class="form-grid compact-grid"><label><span>飼主姓名 *</span><input name="owner" required placeholder="選擇家庭後帶入"></label><label><span>毛孩 *</span><input name="pet" required placeholder="選擇或直接輸入"></label></div>
              </section>
              <section class="form-card"><div class="form-card-title"><b>2</b><span><strong>日期與訂單狀態</strong><small>沿用正式版欄位與狀態</small></span></div><div class="form-grid"><label><span>服務開始日期 *</span><input name="start" type="date" value="2026-10-27" required></label><label><span>服務結束日期</span><input name="end" type="date" value="2026-10-29"></label><label><span>訂單狀態</span><select name="status"><option>未付訂金</option><option selected>待執行</option><option>常客</option><option>常客-待付尾款</option><option>未付尾款</option><option>完成</option></select></label><label><span>客戶類型</span><select><option>新客</option><option>常客</option></select></label><label><span>執行保姆</span><select><option>品妤</option><option>協力保姆</option></select></label><label class="check-control"><input type="checkbox"><span>這是測試訂單</span></label></div></section>
              <section class="form-card"><div class="form-card-title"><b>3</b><span><strong>服務項目</strong><small>可加入多個服務，價格即時計算</small></span></div><div id="service-items" class="service-items"></div><button id="add-service" class="secondary-action" type="button">＋ 再加一個服務項目</button></section>
              <section class="form-card"><div class="form-card-title"><b>4</b><span><strong>費用與付款</strong><small>計算方式沿用正式版本</small></span></div><div class="pricing-grid"><div class="form-grid"><label><span>訂單來源</span><select><option>LINE</option><option>IG</option><option>毛小愛</option><option>Petbacker</option><option>其他</option></select></label><label><span>車馬費（每次）</span><input id="travel-fee" type="number" min="0" value="0"></label><label><span>小費</span><input id="tip" type="number" min="0" value="0"></label><label><span>折扣倍率</span><input id="discount" type="number" min="0" max="1" step="0.01" value="1"></label><label><span>訂金比例</span><input id="deposit-rate" type="number" min="0" max="1" step="0.01" value="0.5"></label><label><span>已付款金額</span><input id="paid" type="number" min="0" value="0"></label></div><aside id="calculation" class="calculation"></aside></div></section>
              <section class="form-card"><label class="field-label" for="order-note">備註</label><textarea id="order-note" rows="4" placeholder="輸入照顧事項或其他備註"></textarea></section>
              <div class="form-actions"><button class="secondary-action" type="reset">清除</button><button class="form-submit" type="submit">預覽新增訂單</button></div>
            </form>
          </section>

          <section class="app-view pending-view" data-view-panel="pending">
            <div class="view-title"><span class="eyebrow">需要你的動作</span><h1>待處理</h1><p>完成後可直接標記，正式版會同步後台資料。</p></div>
            <div class="pending-list"><article><span>💬</span><div><strong>回覆奶茶飼主</strong><small>今天 12:00 前・訊息</small></div><button type="button">標示完成</button></article><article><span>＄</span><div><strong>確認豆豆訂金</strong><small>訂單 #1028・收款</small></div><button type="button">標示完成</button></article><article><span>📷</span><div><strong>回傳歐拉服務照片</strong><small>今天 20:00 前</small></div><button type="button">標示完成</button></article></div>
          </section>

          <section class="app-view search-view" data-view-panel="search">
            <div class="view-title"><span class="eyebrow">訂單資料</span><h1>搜尋訂單</h1><p>未完成優先，完成訂單置後。</p></div>
            <label class="recent-search">${icons.search}<input id="all-order-search" type="search" placeholder="搜尋飼主、毛孩、日期或編號" aria-label="搜尋所有訂單"></label>
            <div class="filter-chips"><button class="active" type="button" data-filter="all">全部訂單</button><button type="button" data-filter="unfinished">全部未完成</button><button type="button" data-filter="deposit">未付訂金</button><button type="button" data-filter="complete">完成</button></div>
            <div id="search-results" class="recent-list">${allOrderCards}</div>
          </section>

          <section class="app-view test-view" data-view-panel="test">
            <div class="view-title"><span class="eyebrow">獨立資料區</span><h1>測試訂單</h1><p>不與正式訂單混合，也不計入待處理。</p></div>
            <div class="test-notice">🧪 以下僅為測試資料</div><div class="recent-list">${orders.slice(0, 2).map(orderCardHtml).join('')}</div>
          </section>

          <section class="app-view availability-view" data-view-panel="availability">
            <div class="view-title"><span class="eyebrow">行事曆同步</span><h1>可預約時間</h1><p>平日晚上有空，假日與國定假日全天可預約。</p></div>
            <div class="availability-toolbar"><label><span>選擇年月</span><input id="availability-month" type="month" value="2026-10"></label><button id="sync-calendar" class="secondary-action" type="button">同步 Google 行事曆</button></div>
            <div class="calendar-legend"><span><i class="dot open"></i>可預約</span><span><i class="dot limited"></i>少量</span><span><i class="dot blocked"></i>不可預約</span></div>
            <div class="date-jump"><label><span>搜尋日期</span><input id="jump-date" type="date" value="2026-10-10"></label><button id="jump-date-button" class="secondary-action" type="button">切到該日</button><button id="show-month-button" class="secondary-action" type="button">顯示整月</button></div>
            <details class="form-card unavailable-form"><summary>＋ 新增不可預約時段</summary><div class="form-grid"><label><span>日期</span><input type="date"></label><label><span>備註</span><input placeholder="例如：上班、私人行程"></label><label><span>開始時間</span><input type="time"></label><label><span>結束時間</span><input type="time"></label></div><button class="form-submit" type="button">新增不可預約</button></details>
            <div id="availability-days" class="availability-days"></div>
          </section>
        </main>

        <nav class="mobile-nav" aria-label="主要功能"><a href="#" data-view="recent">${icons.orders}<span>近期</span></a><a href="#" data-view="create">${icons.plus}<span>新增訂單</span></a><a href="#" data-view="pending">${icons.inbox}<span>待處理</span><b>3</b></a></nav>
      </section>
    </div>

    <div class="detail-layer" aria-hidden="true">
      <button class="detail-scrim" type="button" aria-label="關閉訂單明細"></button>
      <section class="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <header><div><small id="detail-id">訂單</small><h2 id="detail-title">訂單明細</h2></div><button class="detail-close" type="button" aria-label="關閉訂單明細">${icons.close}</button></header>
        <div class="detail-status"><span>狀態</span><strong id="detail-status">待服務</strong></div>
        <dl><div><dt>飼主／毛孩</dt><dd id="detail-family">—</dd></div><div><dt>服務項目</dt><dd id="detail-service">—</dd></div><div><dt>服務日期</dt><dd id="detail-date">—</dd></div><div><dt>訂單金額</dt><dd id="detail-amount">—</dd></div></dl>
        <button class="detail-action" type="button">前往完整訂單</button>
      </section>
    </div>`;

  const root = document.documentElement;
  const loading = document.querySelector('.loading-screen');
  const pageTitle = document.querySelector('[data-page-title]');
  const titleMap = { dashboard: '儀表板', recent: '訂單管理', create: '新增訂單', pending: '待處理', search: '搜尋訂單', test: '測試訂單', availability: '可預約時間' };
  let serviceSequence = 0;

  function money(value) {
    return Math.round(Number(value) || 0).toLocaleString('zh-TW');
  }

  function addServiceItem() {
    serviceSequence += 1;
    const card = document.createElement('article');
    card.className = 'service-item-card';
    card.innerHTML = `<div class="service-item-heading"><strong>服務 ${serviceSequence}</strong><button class="remove-service" type="button">移除</button></div><div class="form-grid"><label><span>服務類別 *</span><select class="service-category"><option>到府照顧</option><option>散步服務</option><option>陪伴照顧</option></select></label><label><span>服務方案</span><select><option>04新－客價格</option><option>04熟－客價格</option><option>單次服務</option></select></label><label><span>時數</span><input type="number" min="0" step="0.5" value="1"></label><label><span>次數</span><input class="service-times" type="number" min="1" value="1"></label><label><span>預約時段</span><select><option>晚上</option><option>早上</option><option>下午</option><option>指定時間</option></select></label><label><span>指定時間</span><input type="time" value="18:30"></label><label><span>標準單價</span><input class="service-price" type="number" min="0" value="800"></label><label><span>自訂單價</span><input class="service-custom" type="number" min="0" placeholder="空白則用標準單價"></label></div>`;
    card.querySelector('.remove-service').addEventListener('click', () => { if (document.querySelectorAll('.service-item-card').length > 1) { card.remove(); updateCalculation(); } });
    card.querySelectorAll('input,select').forEach((control) => control.addEventListener('input', updateCalculation));
    document.getElementById('service-items').appendChild(card);
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

  function renderAvailability(filterDate = '') {
    const dates = [
      ['2026-10-10', '國慶日', '全天可預約', ['可預約', '可預約', '少量']],
      ['2026-10-11', '星期日', '全天可預約', ['可預約', '少量', '可預約']],
      ['2026-10-12', '星期一', '平日晚上', ['不可預約', '不可預約', '可預約']],
      ['2026-10-13', '星期二', '平日晚上', ['不可預約', '不可預約', '少量']],
      ['2026-10-17', '星期六', '全天可預約', ['可預約', '可預約', '可預約']]
    ].filter((item) => !filterDate || item[0] === filterDate);
    const slotNames = ['早上', '下午', '晚上'];
    document.getElementById('availability-days').innerHTML = dates.map((item) => `<article class="availability-day"><header><strong>${item[0]}｜${item[1]}</strong><span>${item[2]}</span></header><div>${item[3].map((status, index) => `<button type="button" class="slot ${status === '可預約' ? 'open' : status === '少量' ? 'limited' : 'blocked'}"><b>${slotNames[index]}</b><small>${status}</small></button>`).join('')}</div></article>`).join('') || '<div class="test-notice">這一天目前沒有可預約資料。</div>';
    document.querySelectorAll('.slot').forEach((button) => button.addEventListener('click', () => { button.classList.toggle('blocked'); button.classList.toggle('open'); button.querySelector('small').textContent = button.classList.contains('blocked') ? '將設為不可預約' : '可預約'; }));
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
    pageTitle.textContent = titleMap[name] || '訂單管理';
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openOrder(orderId) {
    const order = allOrders.find((item) => item.id === orderId);
    if (!order) return;
    document.getElementById('detail-id').textContent = `訂單 ${order.id}`;
    document.getElementById('detail-title').textContent = `${order.owner}｜${order.pet}`;
    document.getElementById('detail-status').textContent = order.status;
    document.getElementById('detail-family').textContent = `${order.owner}／${order.pet}`;
    document.getElementById('detail-service').textContent = order.service;
    document.getElementById('detail-date').textContent = order.date;
    document.getElementById('detail-amount').textContent = order.amount;
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
  document.querySelector('.family-trigger').addEventListener('click', () => { document.querySelector('.family-options').hidden = false; });
  document.querySelector('.family-collapse').addEventListener('click', () => { document.querySelector('.family-options').hidden = true; });
  document.querySelectorAll('[data-family]').forEach((item) => item.addEventListener('click', () => {
    document.querySelector('.selected-family').textContent = `已選擇：${item.dataset.family}｜車馬費 ${item.dataset.fee} 元／次`;
    document.querySelector('[name="owner"]').value = item.dataset.owner;
    document.querySelector('[name="pet"]').value = item.dataset.pet;
    document.getElementById('travel-fee').value = item.dataset.fee;
    document.querySelector('.family-trigger span').textContent = item.dataset.family;
    document.querySelector('.family-options').hidden = true;
    updateCalculation();
  }));
  document.getElementById('add-service').addEventListener('click', addServiceItem);
  ['travel-fee', 'tip', 'discount', 'deposit-rate', 'paid'].forEach((id) => document.getElementById(id).addEventListener('input', updateCalculation));
  document.querySelector('.preview-form').addEventListener('reset', () => window.setTimeout(() => { document.querySelector('.selected-family').textContent = '尚未選擇家庭'; document.querySelector('.family-trigger span').textContent = '輸入飼主、毛孩或家庭編號'; document.getElementById('service-items').innerHTML = ''; serviceSequence = 0; addServiceItem(); }, 0));
  document.querySelector('.preview-form').addEventListener('submit', (event) => { event.preventDefault(); const button = event.submitter; button.textContent = '預覽建立完成 ✓'; window.setTimeout(() => { button.textContent = '預覽新增訂單'; }, 1500); });
  document.querySelectorAll('.pending-list button').forEach((button) => button.addEventListener('click', () => { button.textContent = '已完成'; button.disabled = true; button.closest('article').classList.add('done'); }));
  document.querySelector('.recent-search input').addEventListener('input', (event) => { const key = event.target.value.trim().toLowerCase(); document.querySelectorAll('.recent-order-card').forEach((card) => { card.hidden = !card.textContent.toLowerCase().includes(key); }); });
  const runSearch = () => { const key = document.getElementById('all-order-search').value.trim().toLowerCase(); const filter = document.querySelector('.filter-chips .active').dataset.filter; document.querySelectorAll('#search-results .recent-order-card').forEach((card) => { const order = allOrders.find((item) => item.id === card.dataset.orderId); const filterOk = filter === 'all' || (filter === 'unfinished' && order.status !== '完成') || (filter === 'deposit' && order.status === '未付訂金') || (filter === 'complete' && order.status === '完成'); card.hidden = !filterOk || !card.textContent.toLowerCase().includes(key); }); };
  document.getElementById('all-order-search').addEventListener('input', runSearch);
  document.querySelectorAll('.filter-chips button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.filter-chips button').forEach((item) => item.classList.toggle('active', item === button)); runSearch(); }));
  document.getElementById('jump-date-button').addEventListener('click', () => { const value = document.getElementById('jump-date').value; if (value) { document.getElementById('availability-month').value = value.slice(0, 7); renderAvailability(value); } });
  document.getElementById('show-month-button').addEventListener('click', () => renderAvailability());
  document.getElementById('availability-month').addEventListener('change', () => renderAvailability());
  document.getElementById('sync-calendar').addEventListener('click', (event) => { const button = event.currentTarget; button.textContent = '同步完成 ✓'; window.setTimeout(() => { button.textContent = '同步 Google 行事曆'; }, 1400); });
  document.querySelector('.unavailable-form .form-submit').addEventListener('click', (event) => { event.currentTarget.textContent = '預覽已新增 ✓'; window.setTimeout(() => { event.currentTarget.textContent = '新增不可預約'; }, 1400); });
  addServiceItem();
  renderAvailability();
})();
