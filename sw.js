// Kairoute offline support: keep the app and its fonts on the device so it opens with no signal.
const CACHE = "kairoute-v4";
const KEEP = /^kairoute-maps-/; // the map store (tiles and label fonts) is managed by the app and survives app updates
const CORE = ["./index.html", "./manifest.webmanifest", "./icons/web-192.png", "./icons/web-512.png", "./icons/apple-touch-icon-180.png", "./lib/maplibre-gl.js", "./lib/maplibre-gl.css"];
// The copy of index.html kept in the repository is only a placeholder (the real app is built and published by
// the "Publish website" workflow). GitHub can briefly serve that placeholder right after an update; it must
// never replace the real app on a device.
const PLACEHOLDER = "kairoute-placeholder";
const isPlaceholder = r => r.clone().text().then(t => t.includes(PLACEHOLDER)).catch(() => false);
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).then(() => c.match("./index.html")).then(r => r && isPlaceholder(r).then(p => p && c.delete("./index.html")))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  const ready = caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && !KEEP.test(k)).map(k => caches.delete(k)))).then(() => self.clients.claim());
  e.waitUntil(ready);
  // Only once activation is finished: a page reloaded before then would wait on this worker forever.
  ready.then(() => setTimeout(refreshOld, 0));
});
// After an update, every open page that is current answers and checks for a newer version itself (it waits if a
// tour is running). A page that doesn't answer is an old build without that check, so it is reloaded.
const alive = new Set();
self.addEventListener("message", e => { if (e.data && e.data.type === "kairoute-alive" && e.source) alive.add(e.source.id); });
function refreshOld() {
  return self.clients.matchAll({ type: "window" }).then(cs => { cs.forEach(c => c.postMessage({ type: "kairoute-sw" }));
    setTimeout(() => cs.filter(c => !alive.has(c.id) && c.navigate).forEach(c => c.navigate(c.url).catch(() => {})), 2500); });
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.endsWith("/version.txt")) return; // always ask the network, so new versions are noticed
  // The app page: try the network first so updates arrive, fall back to the saved copy offline (or while GitHub
  // is briefly serving the placeholder).
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith("/index.html"))) {
    // "no-cache" checks with the server every time, so a copy the browser kept from an earlier visit is never shown once a new version is out.
    // On a weak signal (a cruise port, a train) the saved copy opens after 3 seconds instead of waiting on the
    // network; the network answer still refreshes the saved copy, and the page's own update check then moves to
    // the newer version.
    const net = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(r => isPlaceholder(r).then(p => {
      if (p) return caches.match("./index.html").then(hit => hit || r);
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
      return r;
    }));
    const slow = new Promise(res => setTimeout(res, 3000)).then(() => caches.match("./index.html")).then(hit => hit || net);
    e.respondWith(Promise.race([net, slow]).catch(() => caches.match("./index.html")).then(r => r || net));
    e.waitUntil(net.catch(() => {}));
    return;
  }
  // Fonts, icons and other files: use the saved copy, refresh it in the background.
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
