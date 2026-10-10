// ============================================
// BT-EX5 のサービスワーカー(電波の弱い会場でも開けるように)
// - ページ(HTML): まずネットから取り、つながらないときは前に保存したものを出す
// - JS・CSS・画像: 保存したものをすぐ出し、裏でネットから新しくする(?v= が変われば別物として取り直す)
// - 動画・ほかのサイト(フォント・共有サーバー)は扱わない
// - プッシュ通知: 共有サーバーから合図が来たら、自分あての最新のお知らせを取りに行って表示する
// ============================================
const CACHE = "btex5-v1";
// 通知の設定(共有サーバーの URL・この端末の登録・読み取り用の鍵)。ページ(app/push.js)が書く
const PUSH_CACHE = "btex5-push";
const PUSH_KEY = "push-config";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE && key !== PUSH_CACHE) await caches.delete(key);
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

// ---------- プッシュ通知 ----------
async function pushConfig() {
  try {
    const res = await (await caches.open(PUSH_CACHE)).match(PUSH_KEY);
    return res ? await res.json() : null;
  } catch {
    return null;
  }
}

async function peek(cfg) {
  try {
    const res = await fetch(cfg.api, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "pushPeek", endpoint: cfg.endpoint, peekKey: cfg.peekKey }),
    });
    const json = await res.json();
    return json && json.success ? json.data : null;
  } catch {
    return null;
  }
}

self.addEventListener("push", (e) => {
  // iPhone では合図ごとに必ず通知を出す決まり。取りに行けなくても一般の文で出す
  e.waitUntil((async () => {
    const cfg = await pushConfig();
    const data = cfg && cfg.api ? await peek(cfg) : null;
    const base = new URL("./", self.registration.scope).href;
    const title = (data && data.title) || "BT-EX5";
    let body = (data && data.body) || "新しいお知らせがあります";
    if (data && data.more > 0) body += `(ほか${data.more}件)`;
    const link = (data && data.link) || "feed";
    if (data && "setAppBadge" in self.navigator) {
      try { data.count ? await self.navigator.setAppBadge(data.count) : await self.navigator.clearAppBadge(); } catch { /* noop */ }
    }
    await self.registration.showNotification(title, {
      body,
      icon: base + "assets/icon-192.png",
      badge: base + "assets/icon-192.png",
      tag: "btex5",
      renotify: true,
      data: { url: base + "app/#" + link },
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || new URL("app/", self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const app = list.find((c) => new URL(c.url).pathname === new URL(url).pathname);
    if (app) {
      await app.focus();
      try { await app.navigate(url); } catch { app.postMessage({ type: "open", url }); }
      return;
    }
    await self.clients.openWindow(url);
  })());
});
