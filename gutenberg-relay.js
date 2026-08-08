/**
 * gutenberg-relay — a CORS relay for The Snug.
 *
 * WHY THIS EXISTS
 * Project Gutenberg serves its files without an Access-Control-Allow-Origin
 * header. Browsers therefore refuse to let JavaScript on your GitHub Pages
 * site read the response, even though the file is public and the request
 * succeeds. Server-to-server requests have no such restriction, so this
 * Worker fetches the file and hands it back with the header attached.
 *
 * It is not a general-purpose open proxy: requests are restricted to an
 * allow-list of book hosts and to your own site, so it can't be conscripted
 * into relaying someone else's traffic.
 *
 * DEPLOY (about five minutes, free tier)
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler deploy gutenberg-relay.js --name gutenberg-relay --compatibility-date 2026-08-01
 *   4. Edit ALLOWED_ORIGINS below to your Pages origin, then deploy again.
 *   5. In The Snug: Link tab -> "Set relay" -> paste https://gutenberg-relay.<you>.workers.dev/
 *
 * Or paste this file into the editor at dash.cloudflare.com -> Workers -> Create.
 */

/* Sites permitted to call this relay. "*" lets any site use it — fine while
   testing, but set it to your own origin so you aren't paying for other
   people's bandwidth. */
const ALLOWED_ORIGINS = [
  "https://nickcarbone.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

/* Hosts whose files may be fetched. Suffix match on the hostname. */
const ALLOWED_HOSTS = [
  "gutenberg.org",
  "www.gutenberg.org",
  "aleph.gutenberg.org",
  "gutenberg.pglaf.org",
  "gutenberg.readingroo.ms",
  "standardebooks.org",
  "archive.org",
  "ia600000.us.archive.org",
  "gutendex.com",
];

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — larger than any Gutenberg text

function originAllowed(origin) {
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return null;
}

function hostAllowed(hostname) {
  const h = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((a) => h === a || h.endsWith("." + a));
}

function corsHeaders(allowOrigin) {
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function fail(status, message, allowOrigin) {
  return new Response(message + "\n", {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders(allowOrigin || "*"),
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");
    const allow = originAllowed(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(allow || "*") });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return fail(405, "Only GET and HEAD are relayed.", allow);
    }
    if (origin && !allow) {
      return fail(403, "This relay does not serve " + origin + ".", "*");
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return fail(400, "Add ?url= followed by the encoded address of the book.", allow);
    }

    let dest;
    try {
      dest = new URL(target);
    } catch {
      return fail(400, "That is not a valid URL.", allow);
    }
    if (dest.protocol !== "https:" && dest.protocol !== "http:") {
      return fail(400, "Only http and https addresses are relayed.", allow);
    }
    if (!hostAllowed(dest.hostname)) {
      return fail(
        403,
        "This relay only fetches from: " + ALLOWED_HOSTS.join(", ") + ".",
        allow
      );
    }

    // Serve from the edge cache when possible — Gutenberg texts never change.
    const cacheKey = new Request(dest.toString(), { method: "GET" });
    const cache = caches.default;
    let upstream = await cache.match(cacheKey);

    if (!upstream) {
      try {
        upstream = await fetch(dest.toString(), {
          method: "GET",
          headers: {
            // Identify honestly; Gutenberg asks that bulk tools say who they are.
            "User-Agent": "TheSnug/1.0 (personal reader; +https://github.com/)",
            Accept: "*/*",
          },
          redirect: "follow",
          cf: { cacheTtl: 86400, cacheEverything: true },
        });
      } catch (err) {
        return fail(502, "Could not reach " + dest.hostname + ".", allow);
      }

      if (!upstream.ok) {
        return fail(
          upstream.status,
          dest.hostname + " returned " + upstream.status + ".",
          allow
        );
      }

      const len = Number(upstream.headers.get("Content-Length") || 0);
      if (len && len > MAX_BYTES) {
        return fail(413, "That file is larger than this relay will pass through.", allow);
      }

      upstream = new Response(upstream.body, upstream);
      upstream.headers.set("Cache-Control", "public, max-age=86400");
      ctx.waitUntil(cache.put(cacheKey, upstream.clone()));
    }

    const out = new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
    const ch = corsHeaders(allow || "*");
    for (const k in ch) out.headers.set(k, ch[k]);
    out.headers.delete("Set-Cookie");
    out.headers.set("X-Relayed-From", dest.hostname);
    return out;
  },
};
