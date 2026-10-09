// ============================================
// BT-EX5 のサービスワーカー(電波の弱い会場でも開けるように)
// - ページ(HTML): まずネットから取り、つながらないときは前に保存したものを出す
// - JS・CSS・画像: 保存したものをすぐ出し、裏でネットから新しくする(?v= が変われば別物として取り直す)
// - 動画・ほかのサイト(フォント・共有サーバー)は扱わない
// ============================================
const CACHE = "btex5-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// 同じファイルの古い版(?v= 違い)を消して、保存がふくらまないようにする
async function putFresh(cache, req, res) {
  const url = new URL(req.url);
  for (const old of await cache.keys()) {
    const u = new URL(old.url);
    if (u.pathname === url.pathname && u.search !== url.search) await cache.delete(old);
  }
  await cache.put(req, res);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/\.(mp4|webm)$/i.test(url.pathname)) return;

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) await cache.put(new Request(url.origin + url.pathname), res.clone());
        return res;
      } catch {
        return (await cache.match(url.origin + url.pathname)) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const update = fetch(req).then(async (res) => {
      if (res.ok) await putFresh(cache, req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(update); return hit; }
    return (await update) || Response.error();
  })());
});
