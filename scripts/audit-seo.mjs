import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const manifest = JSON.parse(await readFile(resolve(dist, "public-site-manifest.json"), "utf8"));
const sitemap = await readFile(resolve(dist, "sitemap.xml"), "utf8");
const headers = await readFile(resolve(dist, "_headers"), "utf8");

function count(html, pattern) {
  return [...html.matchAll(pattern)].length;
}

function content(html, pattern) {
  return html.match(pattern)?.[1]?.trim() ?? "";
}

function fileFor(pathname) {
  return pathname === "/"
    ? resolve(dist, "public-site", "index.html")
    : resolve(dist, "public-site", pathname.slice(1), "index.html");
}

const results = [];
const titles = new Map();
const descriptions = new Map();
let failed = false;

for (const page of manifest) {
  const html = await readFile(fileFor(page.path), "utf8");
  const title = content(html, /<title>([\s\S]*?)<\/title>/i);
  const description = content(html, /<meta name="description" content="([^"]*)"/i);
  const canonical = content(html, /<link rel="canonical" href="([^"]*)"/i);
  const robots = content(html, /<meta name="robots" content="([^"]*)"/i);
  const h1Count = count(html, /<h1(?:\s[^>]*)?>/gi);
  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  const imageTags = [...html.matchAll(/<img\s[^>]*>/gi)].map((match) => match[0]);
  const imageAltOk = imageTags.every((tag) => /\salt="[^"]*"/i.test(tag));
  const jsonLdValid = jsonLdBlocks.every((match) => {
    try { JSON.parse(match[1]); return true; } catch { return false; }
  });
  const hasAggregateRating = html.includes('"AggregateRating"');
  const inSitemap = sitemap.includes(`<loc>https://pinyupets.com${page.path}</loc>`);

  const checks = {
    title: title === page.title && title.length >= 12,
    description: description === page.description && description.length >= 45,
    canonical: canonical === `https://pinyupets.com${page.path}`,
    oneH1: h1Count === 1,
    noMetaKeywords: !/<meta name="keywords"/i.test(html),
    imageAlt: imageAltOk,
    jsonLd: jsonLdValid,
    noSelfServingRatingSchema: !hasAggregateRating,
    sitemap: page.indexable ? inSitemap : !inSitemap,
    staticNoindex: robots.includes("noindex"),
  };

  if (titles.has(title)) checks.uniqueTitle = false;
  else { titles.set(title, page.path); checks.uniqueTitle = true; }
  if (descriptions.has(description)) checks.uniqueDescription = false;
  else { descriptions.set(description, page.path); checks.uniqueDescription = true; }

  const ok = Object.values(checks).every(Boolean);
  if (!ok) failed = true;
  results.push({ path: page.path, indexableOnProduction: page.indexable, title, descriptionLength: description.length, h1Count, jsonLdBlocks: jsonLdBlocks.length, checks, ok });
}

const privatePaths = ["/admin/*", "/admin-login/*", "/client-preview/*", "/sitter-preview/*", "/booking.html", "/history.html", "/bound.html", "/calendar.html", "/review.html"];
const privateHeadersOk = privatePaths.every((path) => {
  const section = headers.split(/\r?\n(?=\/)/).find((part) => part.startsWith(path));
  return section?.includes("X-Robots-Tag: noindex, nofollow, noarchive");
});
if (!privateHeadersOk) failed = true;

const topLevel = await readdir(resolve(dist, "public-site"));
console.log(JSON.stringify({ pages: results, sitemapUrls: count(sitemap, /<loc>/g), privateHeadersOk, generatedTopLevel: topLevel.sort() }, null, 2));
if (failed) process.exitCode = 1;
