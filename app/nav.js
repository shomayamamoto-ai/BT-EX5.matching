// ============================================
// app/nav.js — 会員アプリの下のタブを、早見表などほかのページにも出す
// <script src="../app/nav.js" data-tab="search"></script> のように、いまのタブを渡す。
// 未読の数はアプリが保存したもの(5分以内)を使い、古ければ1回だけ取りに行く。
// ============================================
(function () {
  "use strict";
  // 文字を大きく(会員アプリのマイページで切り替え)
  try { if (localStorage.getItem("btex5-big-text") === "1") document.documentElement.classList.add("big-text"); } catch { /* noop */ }
  const script = document.currentScript;
  const currentTab = (script && script.dataset.tab) || "";
  const base = new URL("../app/", script ? script.src : location.href);
  const TABS = [
    { id: "search", label: "早見表", href: new URL("../referral/", base).pathname, icon: "M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" },
    { id: "log", label: "記録", href: `${base.pathname}#log`, icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v4h4v2h-4v4h-2v-4H7v-2h4V7z" },
    { id: "events", label: "予定", href: `${base.pathname}#events`, icon: "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v9H5z" },
    { id: "present", label: "プレゼン", href: `${base.pathname}#present`, icon: "M3 3h18v2h-1v10a1 1 0 0 1-1 1h-6v2.3l3.6 2.4-1.1 1.6L12 20.1l-3.5 2.2-1.1-1.6L11 18.3V16H5a1 1 0 0 1-1-1V5H3zm3 2v9h12V5zm2 6h3v2H8zm0-3h8v2H8z" },
    { id: "board", label: "掲示板", href: `${base.pathname}#board`, icon: "M4 3h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4V4a1 1 0 0 1 1-1Zm3 4v2h10V7Zm0 4v2h7v-2Z" },
    { id: "news", label: "アップデート", href: `${base.pathname}#news`, icon: "M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" },
  ];
  const NS = "http://www.w3.org/2000/svg";
  const TAB_GLYPH = { search: "search", log: "log", events: "calendar", present: "present", board: "board", news: "news" };
  // 線のアイコン(assets/icons.js)があれば、ヘッダーの検索・ベルもそれにする
  const lineIcon = (name) => (typeof BtexIcons !== "undefined" && BtexIcons.has(name) ? BtexIcons.svg(name) : null);

  function render(badges) {
    let nav = document.getElementById("appTabs");
    if (!nav) {
      nav = document.createElement("nav");
      nav.id = "appTabs";
      nav.className = "app-tabs";
      nav.setAttribute("aria-label", "メインメニュー");
      document.body.append(nav);
      document.body.classList.add("has-app-tabs");
    }
    // プレゼンのタブは、アプリで使える人だと分かっているときだけ出す
    let presentOk = false;
    try { presentOk = sessionStorage.getItem("btex5-present") === "1"; } catch { /* noop */ }
    const tabs = TABS.filter((t) => t.id !== "present" || presentOk);
    nav.style.setProperty("--tab-n", String(tabs.length));
    nav.replaceChildren(...tabs.map((t) => {
      const a = document.createElement("a");
      a.className = `app-tab${t.id === currentTab ? " is-on" : ""}`;
      a.draggable = false;
      a.href = t.href;
      if (t.id === currentTab) a.setAttribute("aria-current", "page");
      let svg;
      if (typeof BtexIcons !== "undefined" && BtexIcons.has(TAB_GLYPH[t.id])) svg = BtexIcons.svg(TAB_GLYPH[t.id]);
      else {
        svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", t.icon);
        svg.append(p);
      }
      // 絵は丸い下地(選んでいるタブ)の中に
      const ind = document.createElement("span");
      ind.className = "app-tab-ind";
      ind.append(svg);
      const label = document.createElement("span");
      label.textContent = t.label;
      a.append(ind, label);
      const n = t.id === "news" ? badges.announcements || 0 : t.id === "board" ? badges.board || 0
        : t.id === "log" ? badges.inbox || 0 : t.id === "events" ? badges.rsvp || 0 : 0;
      if (n) {
        const b = document.createElement("span");
        b.className = "app-badge";
        b.textContent = n > 99 ? "99+" : String(n);
        b.setAttribute("aria-label", `${n}件`);
        a.append(b);
      }
      return a;
    }));
    if (typeof TabDock !== "undefined") TabDock.attach(nav);
  }

  // 早見表・プロフィールなどの上の帯にも、アプリと同じ「お知らせ(ベル)」と「マイページ(名前の丸)」を出す。
  // ロゴはどのページでもアプリのホームへ
  function header(badges, name) {
    const nav = document.querySelector(".ref-header .ref-header-nav");
    if (!nav) return;
    const logo = document.querySelector(".ref-header .ref-logo");
    // ムービーのボタンの絵も、ほかと同じ線のアイコンに
    const mv = document.querySelector(".ref-header .op-movie-btn svg");
    if (mv && lineIcon("play")) mv.replaceWith(lineIcon("play"));
    if (logo) { logo.href = `${base.pathname}#events`; logo.setAttribute("aria-label", "予定"); }
    // アプリと同じ「検索」(押すとアプリの検索を開く)。ムービーの左に置く
    if (!nav.querySelector(".nav-search")) {
      const sr = document.createElement("a");
      sr.className = "nav-search";
      sr.href = `${base.pathname}#events?search=1`;
      sr.setAttribute("aria-label", "アプリ内を検索");
      sr.title = "アプリ内を検索";
      const ss = document.createElementNS(NS, "svg");
      ss.setAttribute("viewBox", "0 0 24 24");
      ss.setAttribute("aria-hidden", "true");
      const sp = document.createElementNS(NS, "path");
      sp.setAttribute("d", "M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z");
      ss.append(sp);
      sr.append(lineIcon("search") || ss);
      nav.insertBefore(sr, nav.firstChild);
    }
    let bell = nav.querySelector(".nav-bell");
    if (!bell) {
      bell = document.createElement("a");
      bell.className = "nav-bell";
      bell.href = `${base.pathname}#feed`;
      bell.setAttribute("aria-label", "お知らせ");
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", "M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1z");
      svg.append(p);
      bell.append(lineIcon("bell") || svg);
      nav.append(bell);
    }
    let count = bell.querySelector(".app-badge");
    const n = badges.feed || 0;
    if (n && !count) { count = document.createElement("span"); count.className = "app-badge"; bell.append(count); }
    if (count) { count.hidden = !n; count.textContent = n > 99 ? "99+" : String(n); }
    if (!name) return;
    let me = nav.querySelector(".nav-me");
    if (!me) {
      me = document.createElement("a");
      me.className = "nav-me";
      me.href = `${base.pathname}#me`;
      nav.append(me);
    }
    me.setAttribute("aria-label", `${name}さんのマイページ`);
    me.textContent = String(name).replace(/\s/g, "").slice(0, 1);
  }

  function cached() {
    try {
      const c = JSON.parse(sessionStorage.getItem("btex5-badges") || "null");
      return c && Date.now() - c.at < 5 * 60 * 1000 ? c.badges : null;
    } catch { return null; }
  }

  function myName() { try { return sessionStorage.getItem("btex5-my-name") || ""; } catch { return ""; } }
  function start() {
    const c = cached();
    render(c || {});
    header(c || {}, myName());
    if ((c && myName()) || typeof AuthApi === "undefined" || typeof AuthSession === "undefined" || !AuthSession.getToken()) return;
    AuthApi.call("getHome", {}).then((res) => {
      if (!res.success) return;
      try {
        sessionStorage.setItem("btex5-badges", JSON.stringify({ at: Date.now(), badges: res.data.badges }));
        if (res.data.me && res.data.me.name) sessionStorage.setItem("btex5-my-name", res.data.me.name);
      } catch { /* noop */ }
      render(res.data.badges);
      header(res.data.badges, res.data.me && res.data.me.name);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
