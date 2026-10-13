import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://pinyupets.com";
const SITE_NAME = "快樂小狗 Pinyu";

const nav = [
  ["服務", "/services/"],
  ["價格", "/pricing/"],
  ["服務範圍", "/service-area/"],
  ["認識 Pinyu", "/about/"],
  ["真實評價", "/reviews/"],
  ["照顧筆記", "/articles/"],
  ["常見問題", "/faq/"],
];

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${ORIGIN}/#organization`,
  name: "快樂小狗 Pinyu 到府寵物保姆",
  alternateName: ["快樂小狗 Pinyu", "Pinyu 寵物保姆"],
  url: `${ORIGIN}/`,
  sameAs: ["https://www.instagram.com/pinyu.petsitter/"],
  areaServed: {
    "@type": "Place",
    name: "台北市中正區中正紀念堂周邊，實際依距離與檔期評估",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${ORIGIN}/#website`,
  url: `${ORIGIN}/`,
  name: "快樂小狗 Pinyu",
  alternateName: "快樂小狗 Pinyu 到府寵物保姆",
  publisher: { "@id": `${ORIGIN}/#organization` },
  inLanguage: "zh-Hant-TW",
};

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${ORIGIN}/about/#pinyu`,
  name: "Pinyu",
  jobTitle: "到府寵物保姆",
  worksFor: { "@id": `${ORIGIN}/#organization` },
  url: `${ORIGIN}/about/`,
  sameAs: ["https://www.instagram.com/pinyu.petsitter/"],
  knowsAbout: ["到府寵物照顧", "寵物行為觀察", "寵物 CPR", "服務回報"],
};

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: `${ORIGIN}${path}`,
    })),
  };
}

function serviceSchema(name, description, path) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url: `${ORIGIN}${path}`,
    provider: { "@id": `${ORIGIN}/#organization` },
    areaServed: "台北市中正區中正紀念堂周邊，實際依距離與檔期評估",
    audience: { "@type": "Audience", audienceType: "貓狗飼主" },
  };
}

function articleSchema(page) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.h1,
    description: page.description,
    mainEntityOfPage: `${ORIGIN}${page.path}`,
    datePublished: page.published,
    dateModified: page.updated,
    inLanguage: "zh-Hant-TW",
    author: { "@id": `${ORIGIN}/about/#pinyu` },
    publisher: { "@id": `${ORIGIN}/#organization` },
  };
}

const pages = [
  {
    path: "/",
    title: "台北到府寵物保姆｜快樂小狗 Pinyu",
    description: "快樂小狗 Pinyu 提供台北中正紀念堂周邊的到府寵物照顧、遛狗散步與長時間陪伴。流程與價格透明，依毛孩個性客製照顧並提供完整回報。",
    h1: "安心，從你找到我的那刻——就開始。",
    eyebrow: "台北中正紀念堂周邊・到府寵物保姆",
    indexable: true,
    schemas: [websiteSchema, organizationSchema],
    body: `
      <section class="hero"><div><p class="eyebrow">台北中正紀念堂周邊・到府寵物保姆</p><h1><span>安心，</span><span class="hero-title-line">從你找到我的那刻——就開始。</span></h1><p class="lead">第一次把毛孩和家裡的鑰匙交給原本不認識的人，本來就會有很多擔心。從詢問、家訪、正式服務到完整回報，每一步都會先說清楚。</p><div class="actions"><a class="button primary" href="/booking/">先幫我評估看看</a><a class="button secondary" href="/services/">看看服務方式</a></div><ul class="trust-list"><li><b>300+</b> 趟到府經驗</li><li><b>200 小時</b>專業訓練</li><li><b>寵物 CPR</b> 訓練與證書</li></ul></div><figure class="portrait photo-placeholder" aria-label="真實服務照片待補"><div aria-hidden="true"><span></span><span></span><span></span></div><figcaption><b>真實服務照片待補</b><small>Pinyu 與毛孩自然互動、不擺拍，且不露出住家資訊。</small></figcaption></figure></section>
      <section class="section"><header><p class="eyebrow">照顧毛孩，也接住你的擔心</p><h2>不是完成一張清單，而是看懂牠今天的狀態</h2></header><div class="card-grid three"><article class="card"><span>01</span><h3>先觀察，再靠近</h3><p>怕生、慢熟或躲起來都不是不乖。我會依牠的呼吸、姿勢、距離與日常習慣調整互動。</p></article><article class="card"><span>02</span><h3>完整但不打擾的回報</h3><p>透過照片、影片與文字，回報飲食、飲水、排泄、精神與互動狀況。</p></article><article class="card"><span>03</span><h3>異常不等到最後才說</h3><p>需要注意的變化會在服務中清楚說明，必要時立即和你討論下一步。</p></article></div></section>
      <section class="section split"><div><p class="eyebrow">先找到你現在最需要的答案</p><h2>服務、價格與範圍都分開說清楚</h2><p>不用在一個很長的首頁裡找資料。你可以先看服務內容、費用與車馬費，再確認目前位置是否適合進入承接評估。</p></div><div class="link-list"><a href="/services/"><b>服務介紹</b><span>到府照顧、遛狗與長時間陪伴</span></a><a href="/pricing/"><b>價格與車馬費</b><span>新客基準與實際費用變因</span></a><a href="/service-area/"><b>服務範圍</b><span>中正紀念堂為中心的距離規則</span></a></div></section>
      <section class="section quote"><p>「床底觀察我沒關係，我先去鏟砂🤣」</p><h2>溫柔，是尊重牠的步調；專業，是知道每個細節為什麼重要。</h2><a class="text-link" href="/about/">認識 Pinyu 的照顧方式 →</a></section>
      <section class="section"><header><p class="eyebrow">第一次找保姆也沒關係</p><h2>先理解，再決定要不要詢問</h2></header><div class="card-grid three"><article class="card"><h3>第一次找保姆指南</h3><p>從案例、家訪、價格到第一次合作長度，整理真正需要確認的事情。</p><a href="/articles/first-time-pet-sitter/">閱讀指南</a></article><article class="card"><h3>旅館還是到府？</h3><p>沒有唯一答案，從怕生程度、醫療需求與環境適應判斷。</p><a href="/articles/pet-hotel-vs-home-sitting/">查看比較</a></article><article class="card"><h3>還有其他疑問</h3><p>家訪、鑰匙、連假、餵藥與服務回報都整理在 FAQ。</p><a href="/faq/">查看常見問題</a></article></div></section>
      <section class="section cta"><p class="eyebrow">不需要現在就決定</p><h2>先把日期、距離與毛孩需求告訴我。</h2><p>送出初步需求不等於訂單成立；確認能承接後，才會進一步討論家訪、正式費用與完整資料。</p><a class="button primary" href="/booking/">先幫我評估看看</a></section>`,
  },
  {
    path: "/services/",
    title: "到府寵物照顧服務｜貓狗照顧・遛狗・長時間陪伴｜Pinyu",
    description: "了解快樂小狗 Pinyu 的到府寵物照顧、遛狗散步、長時間陪伴與家訪內容，以及各服務適合的毛孩與家庭。",
    h1: "到府照顧不是把工作做完，而是讓毛孩維持熟悉的生活。",
    eyebrow: "服務介紹",
    indexable: true,
    schemas: [serviceSchema("到府寵物照顧服務", "到府照顧貓狗、遛狗散步、長時間陪伴與服務前家訪。", "/services/"), breadcrumbSchema([["首頁", "/"], ["服務介紹", "/services/"]])],
    body: `<section class="page-hero"><p class="eyebrow">服務介紹</p><h1>到府照顧不是把工作做完，<br>而是讓毛孩維持熟悉的生活。</h1><p class="lead">服務內容會依毛孩數量、個性、生活習慣與實際需求確認。以下先讓你知道每一類服務在做什麼、適合誰。</p></section><section class="section"><div class="service-list"><article id="pet-sitting"><p class="eyebrow">01 到府照顧</p><h2>餵食、飲水、清潔、陪玩與狀態觀察</h2><p>依家訪確認的內容執行，包括餵飯、換水、鏟砂、環境簡單整理、互動陪伴，以及飲食、排泄、精神與環境狀況回報。怕生毛孩會先以不打擾為原則。</p><a href="/pricing/">查看時間方案與價格</a></article><article id="dog-walking"><p class="eyebrow">02 遛狗散步</p><h2>不是只計步數，也要留意情緒與環境</h2><p>散步前確認裝備、路線與毛孩狀態；過程中留意拉扯、刺激源、天氣與排泄狀況。實際時間與是否適合承接需先評估。</p></article><article id="long-stay"><p class="eyebrow">03 長時間陪伴</p><h2>給慢熟、敏感或需要較長照顧節奏的毛孩</h2><p>適合需要更長互動、環境整理或觀察時間的家庭。不是住宿服務，保姆會依約定時段到府陪伴。</p></article><article id="home-visit"><p class="eyebrow">04 服務前家訪</p><h2>正式合作前，把環境、習慣與緊急處理說清楚</h2><p>確認毛孩狀況、用品位置、門窗動線、鑰匙交接、聯絡方式與緊急處置。家訪是正式保留的工作時段，不是免費估價拜訪。</p><a href="/articles/first-time-pet-sitter/#home-visit">第一次合作要確認什麼？</a></article></div></section><section class="section cta"><h2>不確定該選哪一種服務？</h2><p>先描述毛孩數量與需要做的事情，由 Pinyu 依時間和內容協助判斷。</p><a class="button primary" href="/booking/">先送出評估需求</a></section>`,
  },
  {
    path: "/pricing/",
    title: "台北到府寵物保姆價格與車馬費｜快樂小狗 Pinyu",
    description: "查看 Pinyu 2026 新客到府照顧時間方案、長時間陪伴、家訪與車馬費基準，並了解毛孩數量與客製需求如何影響正式報價。",
    h1: "價格先說清楚，實際需求再一起確認。",
    eyebrow: "價格與車馬費",
    indexable: true,
    schemas: [serviceSchema("到府寵物保姆價格與方案", "新客到府照顧、長時間陪伴、家訪與車馬費基準。", "/pricing/"), breadcrumbSchema([["首頁", "/"], ["價格與車馬費", "/pricing/"]])],
    body: `<section class="page-hero"><p class="eyebrow">價格與車馬費</p><h1>價格先說清楚，<br>實際需求再一起確認。</h1><p class="lead">以下為 2026 年 7 月新客基準。正式費用會依毛孩數量、照顧難度、日期、距離與保姆安排評估；公開價格不代表尚未評估就保證承接。</p></section><section class="section"><h2>新客到府照顧基準</h2><div class="price-grid"><article><b>30 分鐘</b><strong>NT$550</strong><p>單純餵食、簡單清潔與狀態回報。</p></article><article><b>45 分鐘</b><strong>NT$750</strong><p>有較多照顧項目，或需要多一些互動與整理。</p></article><article><b>60 分鐘</b><strong>NT$800</strong><p>完整照顧、互動與環境整理。</p></article><article><b>120 分鐘起</b><strong>NT$1,500 起</strong><p>敏感慢熟或需要較長適應與陪伴。</p></article></div></section><section class="section split"><div><p class="eyebrow">其他費用</p><h2>家訪與車馬費</h2></div><div class="facts"><p><b>家訪：</b>3 公里內 NT$200；超過 3 公里另計車馬費，正式合作可折抵服務費。</p><p><b>車馬費：</b>3 公里內 0 元；3–5 公里 50 元；5–7 公里 100 元。</p><p><b>多貓家庭：</b>每增加一隻基準加 50 元，仍依實際照顧內容確認。</p><p><b>小費：</b>全額歸負責保姆，不納入平台抽成。</p></div></section><section class="section"><h2>為什麼最後價格可能不同？</h2><div class="card-grid three"><article class="card"><h3>毛孩與工作量</h3><p>毛孩數量、清潔項目、餵藥協助與互動需求不同，所需時間也會不同。</p></article><article class="card"><h3>距離與交通</h3><p>以中正紀念堂為中心評估距離，也會考慮捷運、停車與實際移動時間。</p></article><article class="card"><h3>客製與既有合作</h3><p>舊客可能有既有合作價格，因此登入後只送需求，不在公開頁重新試算。</p></article></div></section><section class="section cta"><h2>先知道大方向，再確認這一單。</h2><a class="button primary" href="/booking/">開始承接評估</a></section>`,
  },
  {
    path: "/service-area/",
    title: "台北到府寵物保姆服務範圍｜中正紀念堂周邊｜Pinyu",
    description: "Pinyu 以台北市中正區中正紀念堂為服務中心，依 3、5、7 公里距離評估車馬費；超出範圍仍可送出需求並協助詢問合作保姆。",
    h1: "先確認距離與交通，再決定能不能好好承接。",
    eyebrow: "服務範圍",
    indexable: true,
    schemas: [breadcrumbSchema([["首頁", "/"], ["服務範圍", "/service-area/"]])],
    body: `<section class="page-hero"><p class="eyebrow">服務範圍</p><h1>先確認距離與交通，<br>再決定能不能好好承接。</h1><p class="lead">目前以台北市中正區／中正紀念堂為中心。距離只是第一層判斷，最終仍需確認日期、移動方式、毛孩需求與保姆檔期。</p></section><section class="section"><div class="range-grid"><article><b>0–3 km</b><h2>優先評估範圍</h2><p>車馬費基準 0 元；仍需確認檔期與服務內容。</p></article><article><b>3–5 km</b><h2>近距離評估</h2><p>車馬費基準 50 元；若交通條件不同，以正式回覆為準。</p></article><article><b>5–7 km</b><h2>延伸評估範圍</h2><p>車馬費基準 100 元；需一併評估來回交通時間。</p></article><article><b>7 km+</b><h2>仍可送出詢問</h2><p>可能由 Pinyu 協助詢問合適的合作保姆，不代表一定無法承接。</p></article></div></section><section class="section split"><div><p class="eyebrow">怎麼計算</p><h2>先用 Google Maps 看概略距離</h2></div><div class="facts"><p>預約評估會請你填寫行政區、距離、最近捷運站，以及步行 10 分鐘內是否可到捷運。</p><p>初步階段不需要填完整門牌；確認可承接後才補充必要地址，降低個資暴露。</p><p>本頁不列大量行政區名稱，因為沒有真實承接紀錄與專屬資訊前，不建立只有地名不同的 SEO 頁面。</p></div></section><section class="section cta"><h2>超過 7 公里也不用自己猜。</h2><p>把概略位置與需求送來，我們會回覆承接或轉介方向。</p><a class="button primary" href="/booking/">先做距離評估</a></section>`,
  },
  {
    path: "/about/",
    title: "關於 Pinyu｜300+ 趟到府經驗與寵物 CPR 訓練",
    description: "認識快樂小狗 Pinyu 的到府照顧理念、300+ 趟服務經驗、200 小時寵物照護訓練、寵物 CPR 與完整回報方式。",
    h1: "活力滿滿，但照顧時會把步調放慢。",
    eyebrow: "認識 Pinyu",
    indexable: true,
    schemas: [personSchema, breadcrumbSchema([["首頁", "/"], ["認識 Pinyu", "/about/"]])],
    body: `<section class="page-hero about-hero"><div><p class="eyebrow">認識 Pinyu</p><h1>活力滿滿，<br>但照顧時會把步調放慢。</h1><p class="lead">不是每隻貓都喜歡被摸，也不是每個孩子都需要一直陪玩。我會先觀察牠的狀態與界線，再用適合牠的方式互動。</p></div><figure class="portrait small"><img src="/site-assets/about-pinyu.jpg" alt="快樂小狗 Pinyu 到府寵物保姆的品牌自介照" width="1080" height="1350"><figcaption>快樂小狗 Pinyu・到府寵物保姆</figcaption></figure></section><section class="section quote"><p>「床底觀察我沒關係，我先去鏟砂🤣」</p><h2>不強迫親近，也不為了拍照打擾牠。</h2></section><section class="section"><h2>讓溫柔有值得信任的底氣</h2><div class="proof-grid"><article><strong>300+</strong><span>趟到府服務經驗</span></article><article><strong>200h</strong><span>寵物相關專業訓練</span></article><article><strong>CPR</strong><span>寵物 CPR 訓練與證書</span></article><article><strong>SOP</strong><span>服務前、中、後清楚流程</span></article></div></section><section class="section split"><div><p class="eyebrow">服務中的判斷</p><h2>不是憑感覺說「牠看起來很好」</h2></div><div class="facts"><p>回報會包含飲食、飲水、排泄、精神、互動與環境狀況。</p><p>遇到需要注意的變化，會先客觀描述、留下紀錄，再和飼主討論；不以保姆意見取代獸醫診斷。</p><p>服務結束前會再次確認毛孩、門窗、門鎖、用品與環境狀態。</p></div></section><section class="section cta"><h2>先看看真實服務，再決定合不合適。</h2><div class="actions"><a class="button primary" href="/reviews/">看飼主回饋</a><a class="button secondary" href="https://www.instagram.com/pinyu.petsitter/" target="_blank" rel="noopener">看 Instagram 案例</a></div></section>`,
  },
  {
    path: "/reviews/",
    title: "到府寵物保姆評價與飼主回饋｜快樂小狗 Pinyu",
    description: "查看已取得公開同意的 Pinyu 到府寵物保姆服務評價。評價保留來源，公開名稱經安全處理，不揭露飼主聯絡方式、地址或訂單資料。",
    h1: "比起說自己很細心，更希望讓實際服務過的飼主告訴你。",
    eyebrow: "真實評價",
    indexable: true,
    schemas: [breadcrumbSchema([["首頁", "/"], ["真實評價", "/reviews/"]])],
    extraScript: "/site-assets/reviews.js",
    body: `<section class="page-hero"><p class="eyebrow">真實評價</p><h1>比起說自己很細心，<br>更希望讓實際服務過的飼主告訴你。</h1><p class="lead">這裡只顯示已取得公開同意的內容。公開平台評價、服務後表單與私訊回饋會分開標示，不把不同來源假裝成同一種驗證。</p></section><section class="section"><div class="review-policy"><p><b>公開名稱：</b>優先使用飼主指定的公開稱呼；沒有時才顯示毛孩名＋家長或「毛孩家長」。</p><p><b>隱私：</b>不公開 LINE UID、電話、地址、家庭編號或訂單識別資料。</p><p><b>星等：</b>官網不加入自家 AggregateRating 結構化資料，不用自家評價向 Google 取得商家星星摘要。</p></div><div id="publicReviews" class="reviews-grid" aria-live="polite"><p class="loading">正在讀取已授權的公開評價⋯</p></div><noscript><p class="notice">開啟 JavaScript 後可讀取已授權的公開評價；你也可以先到 Instagram 查看真實服務案例。</p></noscript></section><section class="section cta"><h2>想看服務過程，而不只是一句好評？</h2><a class="button primary" href="https://www.instagram.com/pinyu.petsitter/" target="_blank" rel="noopener">前往 @快樂小狗Pinyu</a></section>`,
  },
  {
    path: "/cases/",
    title: "Pinyu 到府寵物照顧案例｜真實素材整理中",
    description: "Pinyu 到府寵物照顧案例頁正在整理已取得公開授權的毛孩照片、服務前準備、照顧紀錄、完整回報與飼主回饋。",
    h1: "真實案例需要真實素材，也需要公開同意。",
    eyebrow: "服務案例",
    indexable: false,
    schemas: [breadcrumbSchema([["首頁", "/"], ["服務案例", "/cases/"]])],
    body: `<section class="page-hero"><p class="eyebrow">服務案例・暫不索引</p><h1>真實案例需要真實素材，<br>也需要公開同意。</h1><p class="lead">這個頁面已建立，但在照片、服務情境與飼主授權整理完成前，不用假案例或通用圖片填滿，也不放進正式 Sitemap。</p></section><section class="section"><h2>每個正式案例會回答</h2><div class="card-grid three"><article class="card"><h3>服務開始前</h3><p>毛孩個性、家訪確認、環境與這次最需要注意的事情。</p></article><article class="card"><h3>服務進行中</h3><p>實際如何互動、回報哪些狀況，以及遇到變化時怎麼處理。</p></article><article class="card"><h3>服務結束後</h3><p>安全巡檢、客觀觀察與後續照護提醒。</p></article></div></section><section class="section cta"><h2>目前先看已公開的 IG 案例。</h2><a class="button primary" href="https://www.instagram.com/pinyu.petsitter/" target="_blank" rel="noopener">查看 Instagram</a></section>`,
  },
  {
    path: "/articles/",
    title: "寵物保姆與到府照顧知識｜Pinyu 寵物照顧筆記",
    description: "從第一次找寵物保姆、家訪與鑰匙安全，到怕生貓咪、旅館與到府照顧比較，整理 Pinyu 的真實服務經驗與照顧觀察。",
    h1: "把服務中反覆遇到的問題，整理成你找得到的答案。",
    eyebrow: "Pinyu 寵物照顧筆記",
    indexable: true,
    schemas: [breadcrumbSchema([["首頁", "/"], ["照顧筆記", "/articles/"]])],
    body: `<section class="page-hero"><p class="eyebrow">Pinyu 寵物照顧筆記</p><h1>把服務中反覆遇到的問題，<br>整理成你找得到的答案。</h1><p class="lead">不是為了塞關鍵字大量生文章，而是把真實服務經驗、流程與飼主會擔心的事情說清楚。</p></section><section class="section"><div class="article-grid"><article><p class="eyebrow">第一次找保姆</p><h2><a href="/articles/first-time-pet-sitter/">第一次找寵物保姆要注意什麼？</a></h2><p>從案例、價格、家訪、第一次合作長度到彼此適不適合，整理五個真正重要的判斷。</p><time datetime="2026-08-25">2026/08/25</time></article><article><p class="eyebrow">選擇照顧方式</p><h2><a href="/articles/pet-hotel-vs-home-sitting/">寵物旅館還是到府保姆？</a></h2><p>從環境適應、社交壓力、醫療需求、回報方式與備援能力做平衡比較。</p><time datetime="2026-08-25">2026/08/25</time></article></div></section><section class="section"><h2>接下來依真實需求整理</h2><ul class="topic-list"><li>寵物保姆家訪會做什麼？</li><li>把鑰匙交給到府保姆前，要確認哪些安全細節？</li><li>到府寵物保姆費用怎麼算？</li><li>怕生貓咪躲床底時，應該怎麼互動？</li><li>多貓家庭家訪要確認哪些事情？</li></ul><p class="notice">以上先列入內容地圖，不會一次用 AI 批量生成。</p></section>`,
  },
  {
    path: "/articles/first-time-pet-sitter/",
    title: "第一次找寵物保姆要注意什麼？挑選與家訪指南｜Pinyu",
    description: "第一次找寵物保姆，先看真實案例、價格流程、短期合作、服務方式與持續進修；家訪時也要確認鑰匙、緊急聯絡與毛孩習慣。",
    h1: "第一次找寵物保姆，要先確認哪些事情？",
    eyebrow: "第一次找保姆指南",
    indexable: true,
    published: "2026-08-25",
    updated: "2026-08-25",
    schemas: [],
    article: true,
    body: `<article class="article"><header><p class="eyebrow">第一次找保姆指南</p><h1>第一次找寵物保姆，<br>要先確認哪些事情？</h1><p class="lead"><b>先不要只看價格或自我介紹。</b>把毛孩與家裡鑰匙交給原本不認識的人，最重要的是能不能信任，以及服務過程能不能真正安心。</p><p class="byline">Pinyu 撰寫・2026/08/25 更新</p></header><nav class="toc" aria-label="本文目錄"><b>快速前往</b><a href="#cases">1. 看真實案例</a><a href="#transparent">2. 價格流程透明</a><a href="#trial">3. 先短期合作</a><a href="#fit">4. 服務方式合不合</a><a href="#learning">5. 持續進修</a><a href="#home-visit">家訪還要確認什麼</a></nav><section id="cases"><h2>1. 先看過去的真實服務案例</h2><p>除了自我介紹，更建議看保姆實際如何回報、怎麼描述毛孩狀況，以及遇到不同情境時如何處理。照片很可愛是一件事，能不能從案例看出觀察與判斷，則是另一件事。</p></section><section id="transparent"><h2>2. 價格與服務流程是否清楚透明</h2><p>服務內容、計費方式、家訪、取消政策與臨時狀況怎麼處理，最好在正式服務前說清楚。規則越清楚，越不容易在出發後才發現雙方理解不同。</p><p>透明不代表所有家庭都用同一價格；客製需求可以有不同報價，但計算理由與最後內容要能被確認。</p></section><section id="trial"><h2>3. 正式長期服務前，先合作一次</h2><p><b>不建議第一次合作，就直接把十幾天的服務全部交出去。</b>如果之後才發現不適合，而飼主已經在外地或國外，臨時找其他人接手會非常困難。</p><p>可以先從一次家訪、短期服務或較短的旅行開始，看看溝通、回報與毛孩反應，也確認自己是不是真的能放心。</p></section><section id="fit"><h2>4. 服務方式是不是你喜歡的</h2><p>每位保姆的互動方式、回報頻率與工作習慣都不同，沒有單一標準答案。有人需要大量影音，有人更重視固定時間與簡潔紀錄；找到合作起來舒服、重要事情能被說清楚的保姆比較重要。</p></section><section id="learning"><h2>5. 有沒有持續進修，也能不能落實在服務中</h2><p>證書多不一定等於比較專業。真正重要的是服務時能否觀察、判斷、知道自己的能力邊界，遇到醫療問題時不逞強，也不以保姆意見取代獸醫。</p></section><section id="home-visit"><h2>家訪時，還要確認哪些事情？</h2><ul><li>毛孩的飲食、排泄、互動與害怕的事物。</li><li>用品、外出籠、牽繩、清潔工具與緊急物資位置。</li><li>門窗、門鎖、監視器與鑰匙交接方式。</li><li>平常獸醫院與 24 小時急診醫院。</li><li>緊急聯絡人、可接受的處置方式與聯絡順序。</li><li>服務回報方式、時間與異常狀況怎麼通知。</li></ul></section><section><h2>簡短結論</h2><p>適合的寵物保姆，不只是毛孩有人餵飯，也是讓飼主出門後真的能放心。先看真實工作方式、把規則說清楚，再用一次較短的合作確認彼此，通常比只比較價格更有幫助。</p></section><aside class="related"><h2>接著看</h2><a href="/services/">Pinyu 的服務方式</a><a href="/pricing/">價格與車馬費</a><a href="/booking/">先做承接評估</a></aside></article>`,
  },
  {
    path: "/articles/pet-hotel-vs-home-sitting/",
    title: "寵物旅館還是到府保姆？貓狗照顧方式比較｜Pinyu",
    description: "寵物旅館與到府保姆沒有絕對好壞。從毛孩怕生程度、環境適應、醫療需求、社交狀況、回報與備援安排判斷適合方式。",
    h1: "寵物旅館還是到府保姆？先看毛孩適合哪一種。",
    eyebrow: "照顧方式比較",
    indexable: true,
    published: "2026-08-25",
    updated: "2026-08-25",
    schemas: [],
    article: true,
    body: `<article class="article"><header><p class="eyebrow">照顧方式比較</p><h1>寵物旅館還是到府保姆？<br>先看毛孩適合哪一種。</h1><p class="lead"><b>沒有一種方式適合所有毛孩。</b>旅館的優點是有人員與場地集中管理；到府的優點是毛孩留在熟悉環境。真正要比較的是毛孩個性、照護需求與兩邊的實際管理能力。</p><p class="byline">Pinyu 撰寫・2026/08/25 更新</p></header><section><h2>快速比較</h2><div class="comparison"><div><h3>到府寵物保姆</h3><ul><li>毛孩留在熟悉的氣味與生活動線。</li><li>減少外出移動與陌生動物刺激。</li><li>需要把住家與鑰匙交給可信任的人。</li><li>非服務時段通常沒有持續現場人員。</li></ul></div><div><h3>寵物旅館</h3><ul><li>人員、設備與毛孩集中在固定場地。</li><li>有些旅館能提供較密集的現場照看。</li><li>需適應移動、陌生空間、聲音與其他動物。</li><li>不同旅館的人力、隔離與夜間管理差異很大。</li></ul></div></div></section><section><h2>怕生或對環境變化敏感的貓咪</h2><p>如果貓咪看到陌生人會躲起來，但在自己家仍能正常進食與使用貓砂，到府照顧通常能減少換環境的壓力。保姆也不應為了互動或拍照，把牠從躲藏處硬拉出來。</p><p>但如果毛孩需要持續醫療監測、頻繁處置或狀況不穩定，單純到府保姆可能並不適合，應先詢問獸醫與具備相應能力的照護選項。</p></section><section><h2>喜歡社交、適應力好的狗狗</h2><p>有些狗狗能適應優良旅館的空間、人員與活動安排；有些則在陌生狗、聲音或籠舍環境中壓力很大。不要只用「狗狗比較外向」判斷，最好先參觀環境、詢問分區與夜間管理，也觀察毛孩短時間體驗後的反應。</p></section><section><h2>不論選哪一種，都要問的問題</h2><ul><li>夜間、臨時生病或人員無法到場時，有什麼備援？</li><li>如何記錄飲食、排泄、精神與異常狀況？</li><li>是否有隔離、消毒、鑰匙或門禁管理規則？</li><li>緊急狀況由誰聯絡、送去哪間醫院、費用如何處理？</li><li>服務內容與價格是否能在出發前確認？</li></ul></section><section><h2>結論：先選適合毛孩的壓力來源</h2><p>如果毛孩最大的壓力是離開熟悉環境，到府照顧可能比較適合；如果牠需要更密集、具備適當設備的人員照看，合格旅館或其他專業照護可能更合理。選擇不是為了證明哪個方案最好，而是把風險與需求看清楚。</p></section><aside class="related"><h2>相關資訊</h2><a href="/services/">查看到府服務內容</a><a href="/articles/first-time-pet-sitter/">第一次找保姆指南</a><a href="/booking/">先描述毛孩需求</a></aside></article>`,
  },
  {
    path: "/faq/",
    title: "到府寵物保姆常見問題｜家訪、鑰匙、餵藥與回報｜Pinyu",
    description: "整理 Pinyu 到府寵物保姆的家訪、鑰匙安全、服務次數、連假、餵藥協助、傳染病限制、回報與緊急處理常見問題。",
    h1: "第一次詢問前，你可能會想知道這些。",
    eyebrow: "常見問題",
    indexable: true,
    schemas: [breadcrumbSchema([["首頁", "/"], ["常見問題", "/faq/"]])],
    body: `<section class="page-hero"><p class="eyebrow">常見問題</p><h1>第一次詢問前，<br>你可能會想知道這些。</h1><p class="lead">以下是服務與安全的概略原則。每隻毛孩和每筆需求仍會在家訪與正式報價時確認。</p></section><section class="section faq-list"><details open><summary>寵物保姆家訪會做什麼？</summary><p>確認毛孩習慣、用品位置、環境動線、門窗門鎖、鑰匙、緊急聯絡與回報方式。家訪需要預留正式時段，3 公里內收 NT$200，正式合作可折抵服務費。</p></details><details><summary>把鑰匙交給保姆安全嗎？</summary><p>應在合作前確認身分、鑰匙交接與歸還方式、監視器告知、誰能接觸資料，以及異常時的聯絡流程。初步預約不會要求完整地址；確認可承接後才收必要資訊。</p></details><details><summary>一天需要服務幾次？</summary><p>取決於毛孩飲食、用藥、排泄、活動與獨處狀況，沒有固定答案。長時間旅行前建議先短期合作，並討論非服務時段的風險與備援。</p></details><details><summary>可以協助餵藥嗎？</summary><p>只限毛孩狀態穩定、有清楚獸醫指示，而且保姆評估能安全執行的非醫療性協助。需要醫療判斷、持續監測或侵入性處置的情況不承接。</p></details><details><summary>什麼情況不承接？</summary><p>不承接具傳染性疾病，或病況嚴重、不穩定、需要持續醫療監測的毛孩。緊急或重症狀況應由獸醫院與合格醫療人員處理。</p></details><details><summary>服務會怎麼回報？</summary><p>依約定提供照片、影片與文字，包含飲食、飲水、排泄、精神、互動與環境狀況。異常不會等到服務結束才說。</p></details><details><summary>超過 7 公里可以詢問嗎？</summary><p>可以。系統會提示可能超出 Pinyu 優先範圍，但仍可送出需求，後續評估是否由合作保姆承接或轉介。</p></details><details><summary>舊客為什麼不直接顯示價格？</summary><p>舊客可能有既有合作內容與客製價格。登入後只需送出本次需求，再依家庭資料與既有方案確認。</p></details></section><section class="section cta"><h2>沒有看到你的問題？</h2><p>先送概略需求，不用在第一步提供完整地址或敏感資料。</p><a class="button primary" href="/booking/">先詢問看看</a></section>`,
  },
  {
    path: "/booking/",
    title: "預約到府寵物保姆承接評估｜快樂小狗 Pinyu",
    description: "先提供毛孩數量、照顧內容、日期與概略地區，Pinyu 會確認距離、車馬費、檔期與是否適合承接；送出需求不等於正式訂單。",
    h1: "先評估能不能好好承接，再進入正式預約。",
    eyebrow: "承接評估",
    indexable: false,
    schemas: [breadcrumbSchema([["首頁", "/"], ["承接評估", "/booking/"]])],
    body: `<section class="page-hero"><p class="eyebrow">承接評估・轉換頁暫不索引</p><h1>先評估能不能好好承接，<br>再進入正式預約。</h1><p class="lead">第一步只需要毛孩數量、照顧內容、日期與概略地區；確認距離、檔期與服務方向後，才補完整家庭資料。</p></section><section class="section"><ol class="booking-flow"><li><b>1</b><div><h2>描述毛孩與照顧需求</h2><p>例如鏟砂、餵飯、遛狗、陪玩、環境清潔或依醫囑協助餵藥。</p></div></li><li><b>2</b><div><h2>填日期、服務與概略地區</h2><p>系統會依中正紀念堂距離、捷運與車馬費規則提供初步方向。</p></div></li><li><b>3</b><div><h2>Pinyu 人工確認</h2><p>送出不代表訂單成立；確認可承接後再安排家訪、正式報價與後續資料。</p></div></li></ol><div class="center-actions"><a class="button primary" href="/client-preview/#inquiry">開啟測試版評估表單</a><a class="button secondary" href="/pricing/">先看價格</a></div><p class="notice">目前仍是測試流程，資料會進入測試後台，不等於正式訂單。</p></section>`,
  },
];

for (const page of pages) {
  if (page.article) {
    page.schemas = [articleSchema(page), breadcrumbSchema([["首頁", "/"], ["照顧筆記", "/articles/"], [page.h1, page.path]])];
  }
}

function jsonLd(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function renderHeader() {
  return `<header class="site-header"><a class="brand" href="/seo-preview/" data-production-home><img src="/site-assets/about-pinyu.jpg" alt="" width="1080" height="1350"><span><b>快樂小狗 Pinyu</b><small>到府寵物保姆</small></span></a><nav aria-label="主要導覽">${nav.map(([label, path]) => `<a href="${path}">${label}</a>`).join("")}</nav><a class="header-cta" href="/booking/">先評估看看</a></header>`;
}

function renderFooter() {
  return `<footer><div><b>快樂小狗 Pinyu 到府寵物保姆</b><p>安心，從你找到我的那刻——就開始。</p></div><nav aria-label="頁尾導覽"><a href="/services/">服務</a><a href="/pricing/">價格</a><a href="/service-area/">範圍</a><a href="/reviews/">評價</a><a href="/articles/">照顧筆記</a><a href="/faq/">FAQ</a><a href="/security/">隱私與安全</a><a href="https://www.instagram.com/pinyu.petsitter/" target="_blank" rel="noopener">Instagram</a></nav><small>公開網站不顯示飼主地址、電話、LINE UID、家庭編號或私人合約內容。</small></footer>`;
}

function renderPage(page) {
  const canonical = `${ORIGIN}${page.path}`;
  const schemas = page.schemas.map((schema) => `<script type="application/ld+json">${jsonLd(schema)}</script>`).join("\n");
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow" data-production-indexable="${page.indexable}">
  <meta name="description" content="${page.description}">
  <meta name="theme-color" content="#2f91cf">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:type" content="${page.article ? "article" : "website"}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${page.title}">
  <meta property="og:description" content="${page.description}">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${page.title}">
  <meta name="twitter:description" content="${page.description}">
  <link rel="canonical" href="${canonical}">
  <link rel="stylesheet" href="/site-assets/style.css">
  <title>${page.title}</title>
  ${schemas}
</head>
<body>
  <a class="skip-link" href="#content">跳到主要內容</a>
  ${renderHeader()}
  <main id="content">${page.body}</main>
  ${renderFooter()}
  ${page.extraScript ? `<script src="${page.extraScript}" defer></script>` : ""}
</body>
</html>`;
}

function outputPath(outputRoot, pagePath) {
  if (pagePath === "/") return resolve(outputRoot, "public-site", "index.html");
  return resolve(outputRoot, "public-site", pagePath.slice(1), "index.html");
}

export async function buildPublicSite(outputRoot) {
  await mkdir(resolve(outputRoot, "public-site"), { recursive: true });
  await mkdir(resolve(outputRoot, "site-assets"), { recursive: true });

  for (const page of pages) {
    const destination = outputPath(outputRoot, page.path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, renderPage(page), "utf8");
  }

  await copyFile(resolve(sourceRoot, "public-site", "style.css"), resolve(outputRoot, "site-assets", "style.css"));
  await copyFile(resolve(sourceRoot, "public-site", "reviews.js"), resolve(outputRoot, "site-assets", "reviews.js"));
  await copyFile(resolve(sourceRoot, "client-preview", "assets", "about-pinyu.jpg"), resolve(outputRoot, "site-assets", "about-pinyu.jpg"));

  const sitemapPages = pages.filter((page) => page.indexable);
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapPages.flatMap((page) => ["  <url>", `    <loc>${ORIGIN}${page.path}</loc>`, "  </url>"]),
    "</urlset>",
    "",
  ].join("\n");
  await writeFile(resolve(outputRoot, "sitemap.xml"), sitemap, "utf8");

  const manifest = pages.map(({ path, title, description, h1, indexable }) => ({ path, title, description, h1, indexable }));
  await writeFile(resolve(outputRoot, "public-site-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}
