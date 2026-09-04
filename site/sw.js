/* PIGWATCH service worker：缓存静态资源，支持离线查看 */
const CACHE = "pigwatch-v1";
const ASSETS = [
    "./",
    "./index.html",
    "./terminal.html",
    "./home.css",
    "./terminal.css",
    "./home.js",
    "./terminal.js",
    "./assets/echarts.min.js",
    "./data/terminal.json",
];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    // 数据文件用网络优先，其余缓存优先
    if (e.request.url.includes("/data/")) {
        e.respondWith(fetch(e.request).then((r) => {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return r;
        }).catch(() => caches.match(e.request)));
        return;
    }
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
