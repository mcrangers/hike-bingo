// Saves the app on the phone so it opens with no signal.
// Bump VERSION when you want to force everyone onto a fresh copy.
const VERSION = "trailbingo-v15";
const CORE = ["./", "index.html", "style.css", "app.js", "config.json", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/logo.png", "icons/logo-sm.png", "icons/favicon-64.png",
  "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700&f[]=satoshi@400,500,700&display=swap"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Serve the saved copy right away, and quietly fetch a fresh one when there's signal.
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  const ours = url.origin === location.origin;
  const fonts = /(^|\.)fontshare\.com$/.test(url.hostname);
  if (!ours && !fonts) return;
  // admin pages and the GitHub API are never cached
  if (ours && /\/admin[^/]*$/.test(url.pathname)) return;
  // settings: always try the network first so admin changes arrive quickly
  if (ours && url.pathname.endsWith("/config.json")) {
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put("config.json", copy)); } return res; })
      .catch(() => caches.match("config.json")));
    return;
  }
  e.respondWith(caches.open(VERSION).then(async cache => {
    const key = req.mode === "navigate" ? "index.html" : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === "navigate" });
    const fresh = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(key, res.clone()); return res; }).catch(() => null);
    return cached || (await fresh) || new Response("Offline", { status: 503 });
  }));
});
