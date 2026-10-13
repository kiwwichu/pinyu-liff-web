import { handleAdmin } from "./admin";
import { handleAvailability } from "./availability";
import { handleBooking } from "./booking";
import { handleOrderHistory } from "./order-history";
import { handlePortal } from "./portal";
import { handlePublicReviews } from "./public-reviews";
import { handlePublicPage, handleRobots, handleSitemap } from "./seo";
import { handleSitter } from "./sitter";
import { handleSiteSettings } from "./site-settings";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...init.headers },
  });
}

function methodNotAllowed(allowed: string): Response {
  return json(
    { success: false, message: "Method not allowed" },
    { status: 405, headers: { Allow: allowed } },
  );
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const pathname = new URL(request.url).pathname;

  // API requests originate from pages on this Worker. Browsers that identify
  // a request as cross-site are rejected; clients that do not send Fetch
  // Metadata headers (including some LINE webviews) remain compatible.
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return json({ success: false, message: "Cross-site request blocked" }, { status: 403 });
  }

  if (pathname === "/api/avail") return await handleAvailability(request, env);
  if (pathname === "/api/booking") return handleBooking(request, env);
  if (pathname === "/api/site-settings") return handleSiteSettings(request, env);
  if (pathname === "/api/admin") return handleAdmin(request, env);
  if (pathname === "/api/portal") return handlePortal(request, env);
  if (pathname === "/api/sitter") return handleSitter(request, env);
  if (pathname === "/api/order-history") return handleOrderHistory(request, env);
  if (pathname === "/api/public-reviews") return handlePublicReviews(request, env);

  if (pathname === "/api/sendLineMessage") {
    return json(
      {
        success: false,
        message: "LINE sending is disabled until authorization is ready",
      },
      { status: 501 },
    );
  }

  return json(
    { success: false, message: "API route not found" },
    { status: 404 },
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/health") {
        // Public liveness must not trigger a privileged database request or
        // reveal internal dependencies. Authenticated flows verify Supabase
        // when they actually use it.
        return json({ ok: true });
      }

      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        return await handleApi(request, env);
      }

      if (url.pathname === "/robots.txt") {
        return handleRobots(request);
      }

      if (url.pathname === "/sitemap.xml") {
        return await handleSitemap(request, env);
      }

      const publicPage = await handlePublicPage(request, env);
      if (publicPage) return publicPage;

      if (url.pathname === "/") {
        return Response.redirect(new URL("/client-preview/", url), 302);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "Unhandled Worker request error",
          error: error instanceof Error ? error.message : String(error),
          path: url.pathname,
        }),
      );
      return json(
        { success: false, message: "Internal server error" },
        { status: 500 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
