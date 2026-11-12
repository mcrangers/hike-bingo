// Saves the app on the phone so it opens with no signal.
// Change VERSION whenever you publish an updated offline copy.
const VERSION = "trailbingo-v18-demo-routing";

const CORE = [
  "./",
  "index.html",
  "demo.html",
  "style.css",
  "app.js",
  "config.json",
  "lockdown.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/logo.png",
  "icons/logo-sm.png",
  "icons/favicon-64.png",
  "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700&f[]=satoshi@400,500,700&display=swap"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then(cache =>
        Promise.allSettled(
          CORE.map(url => cache.add(url))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== VERSION)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const ours = url.origin === self.location.origin;
  const fonts = /(^|\.)fontshare\.com$/.test(url.hostname);

  if (!ours && !fonts) return;

  // Admin pages are never cached.
  if (ours && /\/admin[^/]*$/.test(url.pathname)) {
    return;
  }

  // Settings: try the network first.
  if (ours && url.pathname.endsWith("/config.json")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);

        try {
          const response = await fetch(request);

          if (response.ok) {
            await cache.put(
              new URL("config.json", self.registration.scope).href,
              response.clone()
            );
          }

          return response;
        } catch {
          const saved = await cache.match(
            new URL("config.json", self.registration.scope).href
          );

          return (
            saved ||
            new Response("Settings unavailable", {
              status: 503
            })
          );
        }
      })()
    );

    return;
  }

  // Keep each page in its own cache entry.
  // Only the app's root URL maps to index.html.
  let cacheKey = request;

  if (ours && request.mode === "navigate") {
    const pageURL = new URL(request.url);
    const appRoot = new URL(self.registration.scope);

    if (pageURL.pathname === appRoot.pathname) {
      pageURL.pathname += "index.html";
    }

    pageURL.search = "";
    pageURL.hash = "";
    cacheKey = pageURL.href;
  }

  const cachePromise = caches.open(VERSION);

  // Fetch a fresh copy while keeping the saved copy available.
  const fresh = cachePromise
    .then(async cache => {
      try {
        const response = await fetch(request);

        if (
          response &&
          (response.ok || response.type === "opaque")
        ) {
          await cache.put(cacheKey, response.clone());
        }

        return response;
      } catch {
        return null;
      }
    })
    .catch(() => null);

  // Keep the worker alive until the cache refresh finishes.
  event.waitUntil(
    fresh.then(() => undefined)
  );

  event.respondWith(
    (async () => {
      const cache = await cachePromise;
      const saved = await cache.match(cacheKey);

      if (saved) return saved;

      return (
        (await fresh) ||
        new Response("Offline", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        })
      );
    })()
  );
});
