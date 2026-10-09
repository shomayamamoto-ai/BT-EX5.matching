// ============================================
// auth/portal.js — 保護ページ(マイページ)のロジック
// 仕様: docs/specs/login-page-detailed-spec-v3.md §6, §7
// 表示内容は毎回 verifySession の結果を正とする(§5.3)。
// user を localStorage へ保存しない。
// ============================================

(function () {
  "use strict";

  const statusEl = document.getElementById("portal-status");
  const contentEl = document.getElementById("portal-content");
  const messageEl = document.getElementById("portal-message");

  const ROLE_LABELS = { member: "一般会員", admin: "管理者" };

  (async function init() {
    // guardPage: 無効ならログインページへ遷移して戻らない(§6)
    const data = await AuthSession.guardPage({ next: "portal" });
    if (!data) return;

    // 未サニタイズ innerHTML は使わない。textContent のみ(§11)
    document.getElementById("portal-name").textContent = data.displayName || "";
    document.getElementById("portal-role").textContent =
      ROLE_LABELS[data.user.role] || data.user.role;
    // expiresAt は表示・参考値に限定(§5.3)。認可判断には使わない
    document.getElementById("portal-expires").textContent = new Date(
      data.expiresAt
    ).toLocaleString("ja-JP");

    // 自分の情報の記入状況とお気に入り(名簿は会員限定の API から読む)
    const res = await AuthApi.listReferralMembers(AuthSession.getToken());
    const members = res.success ? res.data.members : [];
    const me = members.find((m) => m.id === data.memberId);
    if (me && typeof PROFILE_ITEMS !== "undefined") {
      const items = [...PROFILE_ITEMS, { label: "できること(ジャンル)", ok: (m) => m.topics.length > 0 }];
      const done = items.filter((it) => it.ok(me)).length;
      const pct = Math.round((done / items.length) * 100);
      document.getElementById("portal-percent").textContent = `${pct}%`;
      document.getElementById("portal-bar").style.width = `${pct}%`;
      const missing = items.filter((it) => !it.ok(me)).map((it) => it.label);
      document.getElementById("portal-missing").textContent = missing.length
        ? `まだ入っていない項目:${missing.join("・")}。入れるほど紹介されやすくなります。`
        : "すべて入力済みです。内容が変わったら更新してください。";
    }
    let favIds = [];
    try { favIds = JSON.parse(localStorage.getItem(`btex5-favorites-${data.memberId || "guest"}`) || "[]"); } catch { favIds = []; }
    const favs = favIds.map((id) => members.find((m) => m.id === id)).filter(Boolean);
    const list = document.getElementById("portal-favs");
    list.replaceChildren(...favs.map((m) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `../referral/#member=${encodeURIComponent(m.id)}`;
      a.textContent = m.name;
      const sub = document.createElement("span");
      sub.textContent = m.company || "";
      li.append(a, sub);
      return li;
    }));
    document.getElementById("portal-favs-empty").hidden = favs.length > 0;

    statusEl.hidden = true;
    contentEl.hidden = false;
    setupInstall();
  })();

  // ---------- ホーム画面に追加 ----------
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    setupInstall();
  });
  function setupInstall() {
    const box = document.getElementById("portal-install");
    const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    if (standalone) { box.hidden = true; return; }
    box.hidden = false;
    const btn = document.getElementById("portal-install-btn");
    btn.hidden = !installPrompt;
    const ua = navigator.userAgent;
    document.getElementById("portal-install-how").textContent = installPrompt ? ""
      : /iPhone|iPad|iPod/.test(ua) ? "iPhone:Safari で下の共有ボタン(□に↑)→「ホーム画面に追加」を押してください。"
      : /Android/.test(ua) ? "Android:Chrome の右上のメニュー(︙)→「ホーム画面に追加」を押してください。"
      : "スマホで開き、iPhone は共有ボタン →「ホーム画面に追加」、Android は Chrome のメニュー(︙)→「ホーム画面に追加」を押してください。";
  }
  document.getElementById("portal-install-btn").addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    setupInstall();
  });

  document.getElementById("logout-button").addEventListener("click", async () => {
    const token = AuthSession.getToken();
    if (token) await AuthApi.logout(token);
    AuthSession.clearToken();
    location.replace("../login/");
  });
})();
