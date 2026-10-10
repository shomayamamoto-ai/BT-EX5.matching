// ============================================
// app/push.js — 通知(プッシュ通知)をこの端末で受け取る設定
// iPhone・iPad は iOS 16.4 以降で、ホーム画面に追加した BT-EX5 から開いたときだけ使える(Apple の決まり)。
// Android・パソコンは Chrome・Edge・Firefox・Safari でそのまま使える。
// 通知の中身は、合図を受けたサービスワーカー(sw.js)が共有サーバーから取りに行く。
// そのための設定(サーバーの URL・この端末の登録・読み取り用の鍵)をキャッシュに置く。
// ============================================

const BtexPush = (function () {
  "use strict";

  const CACHE = "btex5-push";
  const KEY = "push-config";

  const ua = () => navigator.userAgent || "";
  const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1);
  const standalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  function keyBytes(b64) {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function registration() {
    // 登録は auth/api.js が load のあとに行う。まだなら少し待つ
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 8000));
    return Promise.race([navigator.serviceWorker.ready, timeout]);
  }

  async function writeConfig(cfg) {
    try {
      const cache = await caches.open(CACHE);
      if (cfg) await cache.put(KEY, new Response(JSON.stringify(cfg), { headers: { "Content-Type": "application/json" } }));
      else await cache.delete(KEY);
    } catch { /* noop */ }
  }
  async function readConfig() {
    try {
      const res = await (await caches.open(CACHE)).match(KEY);
      return res ? await res.json() : null;
    } catch {
      return null;
    }
  }

  // いまの状態: { supported, shared, needsInstall, permission, on, devices }
  async function status() {
    const out = {
      supported: supported(),
      shared: AuthApi.isShared(),
      needsInstall: isIOS() && !standalone(),
      ios: isIOS(),
      permission: "Notification" in window ? Notification.permission : "unsupported",
      on: false,
      devices: 0,
    };
    if (!out.supported) return out;
    const reg = await registration();
    const sub = reg && (await reg.pushManager.getSubscription().catch(() => null));
    const cfg = await readConfig();
    out.on = !!(sub && cfg && cfg.endpoint === sub.endpoint && out.permission === "granted");
    return out;
  }

  // 通知をオンにする(ボタンを押したときに呼ぶ。許可のダイアログはユーザーの操作からしか出せない)
  async function enable() {
    if (!supported()) throw new Error(isIOS() ? "iPhone は「ホーム画面に追加」した BT-EX5 から開くと通知を設定できます(iOS 16.4 以降)。" : "このブラウザは通知に対応していません。");
    const conf = await AuthApi.call("pushConfig", {});
    if (!conf.success) throw new Error(conf.error.userMessage);
    if (!conf.data.available) throw new Error("いまはお試し版のため、通知はまだ届きません(共有サーバーに切り替えると使えます)。");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("通知が許可されませんでした。端末の設定で BT-EX5 の通知を許可してから、もう一度押してください。");
    const reg = await registration();
    if (!reg) throw new Error("準備に失敗しました。ページを開き直してから、もう一度押してください。");
    let sub = await reg.pushManager.getSubscription();
    const key = keyBytes(conf.data.publicKey);
    // 送り手の鍵が変わっていたら登録し直す
    if (sub && sub.options && sub.options.applicationServerKey) {
      const cur = new Uint8Array(sub.options.applicationServerKey);
      if (cur.length !== key.length || cur.some((b, i) => b !== key[i])) { await sub.unsubscribe(); sub = null; }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const res = await AuthApi.call("savePushSubscription", { subscription: sub.toJSON(), site: location.href });
    if (!res.success) throw new Error(res.error.userMessage);
    await writeConfig({ api: AuthApi.apiUrl(), endpoint: sub.endpoint, peekKey: res.data.peekKey });
    return res.data;
  }

  // 通知をオフにする(ログアウトのときも呼ぶ)
  async function disable() {
    const cfg = await readConfig();
    let endpoint = cfg ? cfg.endpoint : "";
    try {
      const reg = supported() ? await registration() : null;
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) { endpoint = endpoint || sub.endpoint; await sub.unsubscribe(); }
    } catch { /* noop */ }
    if (endpoint) await AuthApi.call("deletePushSubscription", { endpoint, peekKey: cfg ? cfg.peekKey : "" }).catch(() => null);
    await writeConfig(null);
  }

  // アプリを開いたら、ホーム画面のアイコンの数字を消す
  function clearBadge() {
    try { if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => {}); } catch { /* noop */ }
  }

  return { status, enable, disable, clearBadge, isIOS, standalone, supported };
})();
