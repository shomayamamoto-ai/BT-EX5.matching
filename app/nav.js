// ============================================
// app/nav.js — 会員アプリの下のタブを、早見表などほかのページにも出す
// <script src="../app/nav.js" data-tab="search"></script> のように、いまのタブを渡す。
// 未読の数はアプリが保存したもの(5分以内)を使い、古ければ1回だけ取りに行く。
// ============================================
(function () {
  "use strict";
  const script = document.currentScript;
  const currentTab = (script && script.dataset.tab) || "";
  const base = new URL("../app/", script ? script.src : location.href);
  const TABS = [
    { id: "home", label: "ホーム", href: `${base.pathname}#home`, icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
    { id: "search", label: "探す", href: new URL("../referral/", base).pathname, icon: "M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" },
    { id: "log", label: "記録", href: `${base.pathname}#log`, icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v4h4v2h-4v4h-2v-4H7v-2h4V7z" },
    { id: "events", label: "予定", href: `${base.pathname}#events`, icon: "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v9H5z" },
    { id: "talk", label: "つながる", href: `${base.pathname}#talk`, icon: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Z" },
  ];
  const NS = "http://www.w3.org/2000/svg";

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
    nav.replaceChildren(...TABS.map((t) => {
      const a = document.createElement("a");
      a.className = `app-tab${t.id === currentTab ? " is-on" : ""}`;
      a.href = t.href;
      if (t.id === currentTab) a.setAttribute("aria-current", "page");
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", t.icon);
      svg.append(p);
      const label = document.createElement("span");
      label.textContent = t.label;
      a.append(svg, label);
      const n = t.id === "talk" ? (badges.announcements || 0) + (badges.messages || 0)
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
  }

  function cached() {
    try {
      const c = JSON.parse(sessionStorage.getItem("btex5-badges") || "null");
      return c && Date.now() - c.at < 5 * 60 * 1000 ? c.badges : null;
    } catch { return null; }
  }

  function start() {
    const c = cached();
    render(c || {});
    if (c || typeof AuthApi === "undefined" || typeof AuthSession === "undefined" || !AuthSession.getToken()) return;
    AuthApi.call("getHome", {}).then((res) => {
      if (!res.success) return;
      try { sessionStorage.setItem("btex5-badges", JSON.stringify({ at: Date.now(), badges: res.data.badges })); } catch { /* noop */ }
      render(res.data.badges);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
