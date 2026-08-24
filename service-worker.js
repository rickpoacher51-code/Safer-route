const CACHE_NAME = "saferoute-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./prepare.js",
  "./map.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// cache.addAll() fetches each asset subject to normal HTTP/CDN caching —
// on GitHub Pages that meant a version-bumped cache could still get
// populated with STALE content if the CDN's own cache window (up to 10
// minutes) hadn't rotated yet. A new cache NAME doesn't guarantee fresh
// cache CONTENTS. Fetching with {cache: "reload"} forces each request to
// bypass HTTP cache validation and hit the network for real, so what gets
// stored is genuinely current, not just newly-labelled.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          fetch(url, { cache: "reload" }).then((response) => cache.put(url, response))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Cache-first for app shell assets (all local, offline-critical).
// Network-first for anything else (e.g. Google Maps links open in a new tab,
// so they never route through here — this app makes no external API calls).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
