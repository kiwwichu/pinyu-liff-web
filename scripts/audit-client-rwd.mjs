import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const widths = [320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1440];
const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const tempRoot = await mkdtemp(join(tmpdir(), "pinyu-rwd-cli-"));
const artifacts = resolve(root, "artifacts");
await mkdir(artifacts, { recursive: true });

const publicReviews = [
  { displayName: "小屁飼主", rating: 5, title: "這次服務後，飼主想說的話", text: "很細心，家裡寶貝們都很喜歡保姆姐姐🥰", tags: ["五星回饋"], sourceLabel: "Pinyu 服務後評價" },
  { displayName: "襪襪飼主", rating: 5, title: "人在外面，也能清楚知道毛孩的狀況", text: "很安心的一次合作，謝謝完整回報。", tags: ["回報清楚"], sourceLabel: "Pinyu 服務後評價" },
  { displayName: "毛孩家長", rating: 5, title: "照著毛孩的步調，慢慢建立信任", text: "照顧時很尊重毛孩的個性與距離。", tags: ["尊重毛孩步調"], sourceLabel: "Pinyu 服務後評價" },
  { displayName: "毛孩家長", rating: 5, title: "這次服務後，飼主想說的話", text: "非常棒，大推。", tags: ["五星回饋"], sourceLabel: "Pinyu 服務後評價" },
];

const auditHook = `setTimeout(() => {
  const viewport = window.innerWidth;
  const auditParams = new URLSearchParams(window.location.search);
  if (auditParams.get('focus') === 'gallery') document.querySelector('.ig-gallery')?.scrollIntoView({ block: 'start' });
  const scrollerContains = element => {
    let parent = element.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && parent.scrollWidth > parent.clientWidth + 1) return true;
      parent = parent.parentElement;
    }
    return false;
  };
  const offenders = [...document.querySelectorAll('body *')].filter(element => {
    const style = getComputedStyle(element);
    if (element.classList.contains('booking-honeypot')) return false;
    if (style.display === 'none' || style.visibility === 'hidden' || element.closest('dialog:not([open])')) return false;
    if (scrollerContains(element)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && (rect.right > viewport + 1 || rect.left < -1);
  }).slice(0, 12).map(element => ({ tag: element.tagName, className: String(element.className || '').slice(0, 90), left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) }));

  const result = {
    viewport,
    rootWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    overflow: document.documentElement.scrollWidth > viewport + 1 || document.body.scrollWidth > viewport + 1,
    offenders,
    reviewCards: document.querySelectorAll('.review-card:not(.review-loading)').length,
    reviewScrollable: document.getElementById('reviewsTrack').scrollWidth > document.getElementById('reviewsTrack').clientWidth,
    bookingSteps: document.querySelectorAll('[data-booking-step]').length,
    imagesMissingDimensions: [...document.images].filter(image => image.id !== 'galleryImage' && (!image.hasAttribute('width') || !image.hasAttribute('height'))).map(image => image.getAttribute('src')),
    stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.getAttribute('href')),
    layout: (() => {
      const main = document.querySelector('main');
      const mainRect = main.getBoundingClientRect();
      const sections = [...main.children].filter(element => element.matches('section')).map(element => {
        const rect = element.getBoundingClientRect();
        return {
          id: element.id || element.className,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          aligned: Math.abs(rect.left - mainRect.left) <= 1 && Math.abs(rect.right - mainRect.right) <= 1,
        };
      });
      const images = [...document.images].filter(image => image.id !== 'galleryImage').map(image => {
        const rect = image.getBoundingClientRect();
        const parentRect = image.parentElement.getBoundingClientRect();
        const widthAttribute = Number(image.getAttribute('width'));
        const heightAttribute = Number(image.getAttribute('height'));
        const intrinsicRatio = image.naturalHeight ? image.naturalWidth / image.naturalHeight : null;
        const declaredRatio = widthAttribute && heightAttribute ? widthAttribute / heightAttribute : null;
        const parentClipsOverflow = ['hidden', 'clip'].includes(getComputedStyle(image.parentElement).overflow);
        const shouldKeepFourByFive = image.matches('.pinyu-portrait img, .ig-gallery img');
        return {
          src: image.getAttribute('src'),
          renderedWidth: Math.round(rect.width),
          renderedHeight: Math.round(rect.height),
          objectFit: getComputedStyle(image).objectFit,
          contained: parentClipsOverflow || (rect.left >= parentRect.left - 1 && rect.right <= parentRect.right + 1 && rect.top >= parentRect.top - 1 && rect.bottom <= parentRect.bottom + 1),
          ratioMatchesFile: intrinsicRatio && declaredRatio ? Math.abs(intrinsicRatio - declaredRatio) < .002 : false,
          renderedRatioCorrect: !shouldKeepFourByFive || Math.abs((rect.width / rect.height) - .8) < .01,
        };
      });
      const textOverflow = [...document.querySelectorAll('h1,h2,h3,p,a,button,figcaption')].filter(element => element.scrollWidth > element.clientWidth + 1).slice(0, 12).map(element => ({ tag: element.tagName, className: String(element.className || ''), text: element.textContent.trim().slice(0, 50), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
      const ctaOverflow = [...document.querySelectorAll('.hero-actions a,.soft-cta-actions a,.header-booking,.portal-button,.mobile-actions a,.mobile-actions button')].filter(element => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        const parentRect = element.parentElement.getBoundingClientRect();
        return rect.left < parentRect.left - 1 || rect.right > parentRect.right + 1;
      }).map(element => element.textContent.trim());
      return {
        main: { left: Math.round(mainRect.left), right: Math.round(mainRect.right), width: Math.round(mainRect.width) },
        sections,
        images,
        textOverflow,
        ctaOverflow,
        heroColumns: getComputedStyle(document.querySelector('.hero')).gridTemplateColumns,
        reviewTrack: (() => {
          const track = document.getElementById('reviewsTrack');
          const rect = track.getBoundingClientRect();
          return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), clientWidth: track.clientWidth, scrollWidth: track.scrollWidth };
        })(),
      };
    })(),
    fonts: {
      ready: document.fonts.check('16px "Chiron GoRound TC WS"'),
      loadedResourceCount: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/fonts/')).length,
      transferSize: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/fonts/')).reduce((total, entry) => total + entry.transferSize, 0),
    },
    interaction: null,
  };

  if (viewport === 390 && auditParams.get('interaction') === '1') {
    document.querySelector('[data-open-review="0"]')?.click();
    const reviewOpen = document.getElementById('reviewDialog').open;
    document.getElementById('reviewDialog').close();
    document.querySelector('[data-gallery-index="0"]')?.click();
    const galleryOpen = document.getElementById('galleryDialog').open;
    document.getElementById('galleryDialog').close();
    const form = document.getElementById('inquiryForm');
    form.elements.catCount.value = '1';
    form.elements.careNeeds.value = '鏟砂、餵飯與陪玩';
    document.querySelector('[data-booking-next]')?.click();
    const movedToStepTwo = document.querySelector('[data-booking-step="2"]').classList.contains('active');
    form.elements.customerType.value = 'returning';
    form.elements.customerType.dispatchEvent(new Event('change', { bubbles: true }));
    const returningLoginOpen = document.getElementById('returningLoginDialog').open;
    result.interaction = { reviewOpen, galleryOpen, movedToStepTwo, returningLoginOpen };
  }

  const targetDocument = window.top !== window ? window.top.document : document;
  const pre = targetDocument.createElement('pre');
  pre.id = 'rwd-audit';
  pre.hidden = true;
  pre.textContent = btoa(unescape(encodeURIComponent(JSON.stringify(result))));
  targetDocument.body.appendChild(pre);
}, 1200);`;

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (pathname === "/api/site-settings") return response.writeHead(200, { "Content-Type": mime[".json"] }).end(JSON.stringify({ success: true, siteDesign: null }));
    if (pathname === "/api/public-reviews") return response.writeHead(200, { "Content-Type": mime[".json"] }).end(JSON.stringify({ success: true, reviews: publicReviews }));
    if (pathname === "/api/booking") return response.writeHead(200, { "Content-Type": mime[".json"] }).end(JSON.stringify({ success: true, requestNumber: "REQ-RWD-TEST" }));
    if (pathname === "/audit-hook.js") return response.writeHead(200, { "Content-Type": mime[".js"] }).end(auditHook);
    if (pathname === "/audit-frame.html") {
      const auditUrl = new URL(request.url, "http://127.0.0.1");
      const requestedWidth = Number(auditUrl.searchParams.get("width"));
      const frameWidth = widths.includes(requestedWidth) ? requestedWidth : 390;
      const requestedAnchor = auditUrl.searchParams.get("anchor");
      const anchor = ["about", "reviews", "services"].includes(requestedAnchor) ? `#${requestedAnchor}` : "";
      const interaction = auditUrl.searchParams.get("interaction") === "1" ? "&interaction=1" : "";
      const focus = auditUrl.searchParams.get("focus") === "gallery" ? "&focus=gallery" : "";
      return response.writeHead(200, { "Content-Type": mime[".html"] }).end(`<!doctype html><html><body style="margin:0"><iframe title="RWD audit" scrolling="no" src="/client-preview/?audit=1${interaction}${focus}${anchor}" style="display:block;width:${frameWidth}px;height:900px;border:0"></iframe></body></html>`);
    }
    const relative = pathname === "/" ? "client-preview/index.html" : pathname.endsWith("/") ? `${pathname.replace(/^\//, "")}index.html` : pathname.replace(/^\//, "");
    const absolute = normalize(resolve(dist, relative));
    if (!absolute.startsWith(dist)) throw new Error("invalid path");
    let body = await readFile(absolute);
    if (absolute.endsWith("client-preview\\index.html")) body = Buffer.from(body.toString("utf8").replace("</body>", '<script src="/audit-hook.js"></script></body>'));
    response.writeHead(200, { "Content-Type": mime[extname(absolute)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
});

await new Promise(resolveReady => server.listen(0, "127.0.0.1", resolveReady));
const port = server.address().port;
const results = [];

try {
  for (const width of widths) {
    const profile = join(tempRoot, String(width));
    const url = `http://127.0.0.1:${port}/audit-frame.html?width=${width}${width === 390 ? "&interaction=1" : ""}`;
    const { stdout } = await run(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--in-process-gpu",
      "--disable-gpu-sandbox",
      "--use-angle=swiftshader",
      "--disable-background-networking",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      "--window-size=1600,1000",
      "--virtual-time-budget=3000",
      "--dump-dom",
      url,
    ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 30000 });
    const match = stdout.match(/<pre id="rwd-audit" hidden="">([^<]+)<\/pre>/);
    if (!match) throw new Error(`Missing audit result at ${width}px`);
    results.push(JSON.parse(Buffer.from(match[1], "base64").toString("utf8")));
  }

  for (const width of widths) {
    const url = `http://127.0.0.1:${port}/audit-frame.html?width=${width}`;
    await run(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--in-process-gpu",
      "--disable-gpu-sandbox",
      "--use-angle=swiftshader",
      "--no-first-run",
      "--virtual-time-budget=3000",
      `--user-data-dir=${join(tempRoot, `shot-${width}`)}`,
      `--window-size=${Math.max(520, width)},900`,
      `--screenshot=${resolve(artifacts, `layout-regression-${width}.png`)}`,
      url,
    ], { timeout: 30000 });
  }

  for (const width of [390, 1440]) {
    for (const anchor of ["about", "reviews", "services"]) {
      const focus = anchor === "services" ? "&focus=gallery" : "";
      const url = `http://127.0.0.1:${port}/audit-frame.html?width=${width}&anchor=${anchor}${focus}`;
      await run(chromePath, [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--in-process-gpu",
        "--disable-gpu-sandbox",
        "--use-angle=swiftshader",
        "--no-first-run",
        "--virtual-time-budget=3000",
        `--user-data-dir=${join(tempRoot, `shot-${width}-${anchor}`)}`,
        `--window-size=${Math.max(520, width)},900`,
        `--screenshot=${resolve(artifacts, `layout-regression-${anchor}-${width}.png`)}`,
        url,
      ], { timeout: 30000 });
    }
  }

  process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
  const interaction = results.find(result => result.viewport === 390)?.interaction;
  if (results.some(result => result.overflow || result.offenders.length || result.reviewCards !== 4 || result.bookingSteps !== 4 || result.imagesMissingDimensions.length || result.layout.sections.some(section => !section.aligned) || result.layout.images.some(image => !image.contained || !image.ratioMatchesFile || !image.renderedRatioCorrect) || result.layout.textOverflow.length || result.layout.ctaOverflow.length || !result.fonts.ready) || !interaction || Object.values(interaction).some(value => !value)) process.exitCode = 1;
} finally {
  server.close();
  await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
}
