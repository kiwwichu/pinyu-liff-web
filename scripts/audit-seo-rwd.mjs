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
const tempRoot = await mkdtemp(join(tmpdir(), "pinyu-seo-rwd-"));
const artifacts = resolve(root, "artifacts");
await mkdir(artifacts, { recursive: true });

const pages = ["/seo-preview/", "/services/", "/pricing/", "/service-area/", "/about/", "/reviews/", "/cases/", "/articles/", "/articles/first-time-pet-sitter/", "/articles/pet-hotel-vs-home-sitting/", "/faq/", "/booking/"];
const widths = [320, 360, 375, 390, 412, 430, 768, 1024, 1440];
const representative = new Set(["/seo-preview/", "/pricing/", "/articles/first-time-pet-sitter/", "/faq/"]);
const quick = process.env.PINYU_SEO_AUDIT_QUICK === "1";
const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

const auditHook = `setTimeout(() => {
  const viewport = innerWidth;
  const insideScroller = element => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (['auto','scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
    }
    return false;
  };
  const offenders = [...document.querySelectorAll('body *')].filter(element => {
    if (insideScroller(element)) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && (rect.left < -1 || rect.right > viewport + 1);
  }).slice(0, 10).map(element => ({ tag: element.tagName, className: String(element.className || '').slice(0, 80), left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right) }));
  const result = {
    path: location.pathname,
    viewport,
    rootWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    overflow: document.documentElement.scrollWidth > viewport + 1 || document.body.scrollWidth > viewport + 1,
    offenders,
    h1Count: document.querySelectorAll('h1').length,
    title: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    description: document.querySelector('meta[name="description"]')?.content || '',
    imagesMissingDimensions: [...document.images].filter(image => !image.hasAttribute('width') || !image.hasAttribute('height')).map(image => image.src),
    reviewCards: document.querySelectorAll('.review').length,
  };
  const pre = top.document.createElement('pre');
  pre.id = 'seo-rwd-audit'; pre.hidden = true;
  pre.textContent = btoa(unescape(encodeURIComponent(JSON.stringify(result))));
  top.document.body.appendChild(pre);
}, 1400);`;

function fileForPath(pathname) {
  if (pathname === "/seo-preview/") return resolve(dist, "public-site", "index.html");
  return resolve(dist, "public-site", pathname.slice(1), "index.html");
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/api/public-reviews") return response.writeHead(200, { "Content-Type": mime[".json"] }).end(JSON.stringify({ reviews: [{ displayName: "毛孩家長", rating: 5, title: "服務期間能清楚知道毛孩狀況", text: "回報清楚，也尊重毛孩原本的生活步調。", tags: ["回報清楚"], sourceLabel: "Pinyu 服務後評價" }] }));
    if (url.pathname === "/audit-hook.js") return response.writeHead(200, { "Content-Type": mime[".js"] }).end(auditHook);
    if (url.pathname === "/audit-frame.html") {
      const width = Number(url.searchParams.get("width")) || 390;
      const path = url.searchParams.get("path") || "/seo-preview/";
      return response.writeHead(200, { "Content-Type": mime[".html"] }).end(`<!doctype html><html><body style="margin:0"><iframe title="SEO RWD audit" scrolling="no" src="${path}" style="display:block;width:${width}px;height:1000px;border:0"></iframe></body></html>`);
    }

    let absolute;
    if (pages.includes(url.pathname)) absolute = fileForPath(url.pathname);
    else absolute = normalize(resolve(dist, url.pathname.replace(/^\//, "")));
    if (!absolute.startsWith(dist)) throw new Error("invalid path");
    let body = await readFile(absolute);
    if (absolute.endsWith(".html")) body = Buffer.from(body.toString("utf8").replace("</body>", '<script src="/audit-hook.js"></script></body>'));
    response.writeHead(200, { "Content-Type": mime[extname(absolute)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
});

await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const port = server.address().port;
const tests = [];
if (quick) {
  tests.push({ page: "/seo-preview/", width: 390 }, { page: "/seo-preview/", width: 1440 });
} else {
  for (const page of pages) {
    const pageWidths = representative.has(page) ? widths : [390];
    for (const width of pageWidths) tests.push({ page, width });
  }
}

const results = [];
try {
  for (const [index, test] of tests.entries()) {
    const frame = `http://127.0.0.1:${port}/audit-frame.html?width=${test.width}&path=${encodeURIComponent(test.page)}`;
    const { stdout } = await run(chromePath, ["--headless=new", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${join(tempRoot, String(index))}`, "--window-size=1600,1100", "--virtual-time-budget=3200", "--dump-dom", frame], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 30000 });
    const match = stdout.match(/<pre id="seo-rwd-audit" hidden="">([^<]+)<\/pre>/);
    if (!match) throw new Error(`Missing audit result for ${test.page} at ${test.width}px`);
    results.push(JSON.parse(Buffer.from(match[1], "base64").toString("utf8")));
  }

  for (const width of [390, 1440]) {
    const frame = `http://127.0.0.1:${port}/audit-frame.html?width=${width}&path=${encodeURIComponent("/seo-preview/")}`;
    await run(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${join(tempRoot, `shot-${width}`)}`, `--window-size=${Math.max(520, width)},1000`, `--screenshot=${resolve(artifacts, `seo-home-${width}.png`)}`, frame], { timeout: 30000 });
  }

  console.log(JSON.stringify({ testCount: results.length, results }, null, 2));
  if (results.some((result) => result.overflow || result.offenders.length || result.h1Count !== 1 || !result.title || !result.description || !result.canonical || result.imagesMissingDimensions.length || (result.path === "/reviews/" && result.reviewCards < 1))) process.exitCode = 1;
} finally {
  server.close();
  await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
}
