const PUBLIC_ORIGIN = "https://pinyupets.com";
const PUBLIC_PREFIXES = [
  "/services/",
  "/pricing/",
  "/service-area/",
  "/about/",
  "/reviews/",
  "/cases/",
  "/articles/",
  "/faq/",
  "/booking/",
] as const;

const TEXT_HEADERS = {
  "Cache-Control": "public, max-age=3600",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

function isProductionHost(hostname: string): boolean {
  return hostname === "pinyupets.com" || hostname === "www.pinyupets.com";
}

function isCleanPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function noIndex(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function publicHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function handleRobots(request: Request): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const { hostname } = new URL(request.url);
  const body = isProductionHost(hostname)
    ? [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /admin/",
        "Disallow: /admin-login/",
        "Disallow: /design-admin/",
        "Disallow: /sitter-preview/",
        "Disallow: /client-preview/",
        "Disallow: /booking.html",
        "Disallow: /bound.html",
        "Disallow: /calendar.html",
        "Disallow: /history.html",
        "Disallow: /review.html",
        `Sitemap: ${PUBLIC_ORIGIN}/sitemap.xml`,
        "",
      ].join("\n")
    : "User-agent: *\nDisallow: /\n";

  return new Response(request.method === "HEAD" ? null : body, { headers: TEXT_HEADERS });
}

export async function handleSitemap(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  if (!isProductionHost(url.hostname)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }

  const assetUrl = new URL("/sitemap.xml", url);
  const response = await env.ASSETS.fetch(new Request(assetUrl, request));
  return publicHeaders(response);
}

async function fetchPublicAsset(request: Request, env: Env, internalPath: string): Promise<Response> {
  const url = new URL(request.url);
  const assetUrl = new URL(internalPath, url);
  return env.ASSETS.fetch(new Request(assetUrl, request));
}

export async function handlePublicPage(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const production = isProductionHost(url.hostname);

  if (production && url.hostname === "www.pinyupets.com") {
    const canonical = new URL(request.url);
    canonical.hostname = "pinyupets.com";
    canonical.protocol = "https:";
    return Response.redirect(canonical, 308);
  }

  if (url.pathname === "/" && !production) return null;

  if (url.pathname === "/seo-preview") {
    return Response.redirect(new URL("/seo-preview/", url), 308);
  }

  if (isCleanPublicPath(`${url.pathname}/`) && !url.pathname.endsWith("/") && !url.pathname.includes(".")) {
    return Response.redirect(new URL(`${url.pathname}/`, url), 308);
  }

  let internalPath: string | null = null;
  if (url.pathname === "/" && production) internalPath = "/public-site/";
  else if (url.pathname === "/seo-preview/") internalPath = "/public-site/";
  else if (isCleanPublicPath(url.pathname)) {
    internalPath = `/public-site${url.pathname}`;
  }

  if (!internalPath) return null;

  let response = await fetchPublicAsset(request, env, internalPath);
  if (response.status === 404 && isCleanPublicPath(url.pathname)) {
    response = new Response("找不到這個頁面", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  if (request.method === "HEAD" && response.ok) {
    return production ? publicHeaders(response) : publicHeaders(noIndex(response));
  }

  if (!response.ok || !response.body) return publicHeaders(noIndex(response));

  if (!production) return publicHeaders(noIndex(response));

  const transformed = new HTMLRewriter()
    .on('meta[name="robots"][data-production-indexable="true"]', {
      element(element) {
        element.setAttribute("content", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
      },
    })
    .on("a[data-production-home]", {
      element(element) {
        element.setAttribute("href", "/");
      },
    })
    .transform(response);

  return publicHeaders(transformed);
}
