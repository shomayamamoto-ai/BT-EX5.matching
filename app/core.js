// ============================================
// app/core.js — 会員アプリの土台
// 画面の切り替え(#home など)・下のタブ・下から出る入力シート・メンバーの選択・
// 小さな表示の道具をまとめる。各画面は app/*.js が App.views に登録する。
// 文字はすべて textContent で入れる(利用者の入力を HTML として扱わない)。
// ============================================

const App = (function () {
  "use strict";

  // ---------- DOM を組み立てる ----------
  // h("div", { class: "x", onclick: fn }, "文字", 子要素...)
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "dataset") Object.assign(el.dataset, v);
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "text") el.textContent = v;
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      });
    }
    append(el, children);
    return el;
  }
  // 中身を入れ替える(null・false は飛ばす)
  function fill(el, ...children) {
    el.replaceChildren();
    return append(el, children);
  }
  function append(el, children) {
    children.flat(Infinity).forEach((c) => {
      if (c === undefined || c === null || c === false) return;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  // ---------- 表示の道具 ----------
  const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  function parseDate(d) { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd); }
  function fmtDate(d) {
    if (!d) return "";
    const x = parseDate(d);
    return `${x.getMonth() + 1}/${x.getDate()}(${WEEK[x.getDay()]})`;
  }
  function fmtDateLong(d) {
    const x = parseDate(d);
    return `${x.getFullYear()}年${x.getMonth() + 1}月${x.getDate()}日(${WEEK[x.getDay()]})`;
  }
  function fmtTime(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    const now = new Date();
    const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (d.toDateString() === now.toDateString()) return hm;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return `昨日 ${hm}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  }
  function yen(n) { return `¥${Number(n || 0).toLocaleString("ja-JP")}`; }
  function daysUntil(d, today) {
    return Math.round((parseDate(d) - parseDate(today)) / 86400000);
  }
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const AREA_LABELS = { niigata: "新潟", tokyo: "東京", online: "オンライン", other: "その他" };
  const REF_STATUS = {
    new: { label: "未対応", tone: "warn" },
    contacted: { label: "連絡済み", tone: "info" },
    meeting: { label: "商談中", tone: "info" },
    won: { label: "成約", tone: "good" },
    lost: { label: "見送り", tone: "mute" },
  };
  const VISITOR_STATUS = {
    invited: { label: "招待中", tone: "mute" },
    applied: { label: "参加申込", tone: "info" },
    attended: { label: "参加済み", tone: "good" },
    joined: { label: "入会", tone: "good" },
    declined: { label: "見送り", tone: "mute" },
  };
  function chip(label, tone) { return h("span", { class: `app-chip tone-${tone || "mute"}` }, label); }
  function initial(name) { return String(name || "?").replace(/\s/g, "").slice(0, 1); }
  function avatar(name, size) {
    // 名前から色を決める(同じ人はいつも同じ色)
    let n = 0;
    for (const ch of String(name || "")) n = (n * 31 + ch.charCodeAt(0)) % 360;
    return h("span", { class: `app-avatar${size ? ` is-${size}` : ""}`, style: `--hue:${n}`, "aria-hidden": "true" }, initial(name));
  }
  // 本文の改行を保ち、URL だけリンクにする
  function richText(text) {
    const out = h("p", { class: "app-rich" });
    String(text || "").split(/(https:\/\/[^\s<>"']+)/g).forEach((part, i) => {
      if (i % 2) out.append(h("a", { href: part, target: "_blank", rel: "noopener" }, part));
      else out.append(document.createTextNode(part));
    });
    return out;
  }

  // ---------- お知らせ(画面下に少し出る) ----------
  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById("appToast");
    if (!el) { el = h("div", { id: "appToast", class: "app-toast", role: "status" }); document.body.append(el); }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  async function copyText(text, done) {
    try { await navigator.clipboard.writeText(text); toast(done || "コピーしました"); }
    catch {
      const ta = h("textarea", { class: "visually-hidden" });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      try { document.execCommand("copy"); toast(done || "コピーしました"); } catch { toast("コピーできませんでした"); }
      ta.remove();
    }
  }
  // スマホなら LINE などに直接送れる共有、だめならコピー
  async function shareText(text, title) {
    if (navigator.share) {
      try { await navigator.share({ text, title }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    copyText(text, "コピーしました。LINE などに貼り付けて送ってください");
  }

  // ---------- 通信 ----------
  async function api(action, payload, opt) {
    const res = await AuthApi.call(action, payload);
    if (!res.success) {
      if (res.error.code === "SESSION_INVALID") {
        AuthSession.clearToken();
        location.replace(`../login/?next=home`);
        return null;
      }
      if (!(opt && opt.quiet)) toast(res.error.userMessage);
      return opt && opt.raw ? res : null;
    }
    return res.data;
  }

  // ---------- 下から出る入力シート ----------
  let sheetStack = [];
  function openSheet(title, build, opt) {
    const close = () => {
      if (opt && opt.confirmClose && opt.confirmClose() && !confirm("入力した内容は保存されていません。閉じますか?")) return;
      wrap.remove();
      sheetStack = sheetStack.filter((x) => x !== wrap);
      if (!sheetStack.length) document.body.classList.remove("app-sheet-open");
      if (opt && opt.onClose) opt.onClose();
    };
    const body = h("div", { class: "app-sheet-body" });
    const panel = h("div", { class: "app-sheet", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "app-sheet-head" },
        h("h2", null, title),
        h("button", { type: "button", class: "app-sheet-close", "aria-label": "閉じる", onclick: close }, "×")),
      body);
    // 入力中に枠外を触って閉じてしまわないよう、枠外では閉じない
    const wrap = h("div", { class: "app-sheet-wrap" }, panel);
    document.body.append(wrap);
    document.body.classList.add("app-sheet-open");
    sheetStack.push(wrap);
    build(body, close);
    const first = body.querySelector("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select");
    if (first && !(opt && opt.noFocus)) setTimeout(() => first.focus({ preventScroll: true }), 50);
    return close;
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !sheetStack.length) return;
    const top = sheetStack[sheetStack.length - 1];
    const btn = top.querySelector(".app-sheet-close");
    if (btn) btn.click();
  });

  // ---------- 入力欄 ----------
  function field(label, input, hint) {
    return h("label", { class: "app-field" }, h("span", { class: "app-field-label" }, label), hint ? h("span", { class: "app-field-hint" }, hint) : null, input);
  }
  function btn(label, onclick, cls) {
    return h("button", { type: "button", class: `app-btn ${cls || ""}`, onclick }, label);
  }
  function segmented(options, current, onchange) {
    const el = h("div", { class: "app-seg", role: "tablist" });
    options.forEach((o) => {
      el.append(h("button", {
        type: "button", role: "tab", class: o.id === current ? "is-on" : "", "aria-selected": o.id === current ? "true" : "false",
        onclick: () => onchange(o.id),
      }, o.label, o.badge ? h("span", { class: "app-badge" }, String(o.badge)) : null));
    });
    return el;
  }
  function empty(text, action) {
    return h("div", { class: "app-empty" }, h("p", null, text), action || null);
  }
  function section(title, ...children) {
    return h("section", { class: "app-section" }, title ? h("h2", { class: "app-h2" }, title) : null, ...children);
  }

  // ---------- メンバー ----------
  let members = [];
  let session = null;
  const memberById = (id) => members.find((m) => m.id === id);

  // メンバーを選ぶ(名前・会社・事業で絞り込み)。multiple なら複数選べる
  function memberPicker(opt) {
    const picked = new Set(opt.value ? [].concat(opt.value) : []);
    const wrap = h("div", { class: "app-picker" });
    const input = h("input", { type: "search", placeholder: "名前・会社名・仕事で探す", "aria-label": opt.label || "メンバーを探す", autocomplete: "off" });
    const chosen = h("div", { class: "app-picker-chosen" });
    const list = h("ul", { class: "app-picker-list", role: "listbox" });
    const pool = members.filter((m) => !opt.exclude || !opt.exclude.includes(m.id));
    function renderChosen() {
      chosen.replaceChildren(...[...picked].map((id) => {
        const m = memberById(id);
        return h("button", { type: "button", class: "app-picked", onclick: () => { picked.delete(id); renderChosen(); renderList(); if (opt.onchange) opt.onchange([...picked]); } },
          avatar(m ? m.name : "?", "sm"), m ? m.name : id, h("span", { "aria-hidden": "true" }, " ×"));
      }));
      chosen.hidden = picked.size === 0;
      input.hidden = !opt.multiple && picked.size > 0;
      list.hidden = !opt.multiple && picked.size > 0;
    }
    function renderList() {
      const q = input.value.trim().toLowerCase();
      const hits = pool.filter((m) => !picked.has(m.id) && (!q || [m.name, m.company, m.business, m.team].join(" ").toLowerCase().includes(q)));
      list.replaceChildren(...hits.slice(0, q ? 30 : 8).map((m) => h("li", null,
        h("button", { type: "button", role: "option", onclick: () => {
          if (!opt.multiple) picked.clear();
          picked.add(m.id);
          input.value = "";
          renderChosen();
          renderList();
          if (opt.onchange) opt.onchange([...picked]);
        } }, avatar(m.name, "sm"), h("span", null, h("b", null, m.name), h("small", null, m.company || m.category || ""))))));
      if (!hits.length) list.append(h("li", { class: "app-picker-none" }, "見つかりません"));
    }
    input.addEventListener("input", renderList);
    wrap.append(chosen, input, list);
    renderChosen();
    renderList();
    wrap.getValue = () => (opt.multiple ? [...picked] : [...picked][0] || "");
    return wrap;
  }

  // ---------- 画面の切り替え ----------
  const views = {};
  const TABS = [
    { id: "home", label: "ホーム", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
    { id: "search", label: "探す", href: "../referral/", icon: "M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" },
    { id: "log", label: "記録", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v4h4v2h-4v4h-2v-4H7v-2h4V7z" },
    { id: "events", label: "予定", icon: "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v9H5z" },
    { id: "talk", label: "つながる", icon: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Z" },
  ];
  let badges = {};
  let current = { view: "", parts: [], params: new URLSearchParams() };
  let cleanup = null;

  function parseHash() {
    const raw = location.hash.replace(/^#/, "") || "home";
    const [path, query] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    return { view: parts[0] || "home", parts: parts.slice(1), params: new URLSearchParams(query || "") };
  }
  function go(hash) {
    if (location.hash === `#${hash}`) route();
    else location.hash = hash;
  }

  async function route() {
    const r = parseHash();
    const view = views[r.view] ? r.view : "home";
    if (cleanup) { try { cleanup(); } catch { /* noop */ } cleanup = null; }
    current = { view, parts: r.parts, params: r.params };
    const tabId = views[view].tab || view;
    document.querySelectorAll(".app-tab").forEach((t) => {
      const on = t.dataset.tab === tabId;
      t.classList.toggle("is-on", on);
      if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    const main = document.getElementById("appView");
    document.getElementById("appTitle").textContent = views[view].title || "";
    main.replaceChildren(h("p", { class: "app-loading" }, "読み込み中…"));
    window.scrollTo({ top: 0, behavior: "instant" });
    const el = h("div", { class: `app-page page-${view}` });
    try {
      const result = await views[view].render(el, r.parts, r.params);
      if (typeof result === "function") cleanup = result;
    } catch (err) {
      console.error(err);
      el.replaceChildren(empty("表示できませんでした。画面を読み込み直してください。"));
    }
    refreshBadges();
    // 読み込み中に別の画面へ移っていたら捨てる
    if (current.view !== view || current.parts.join("/") !== r.parts.join("/")) return;
    main.replaceChildren(el);
  }

  function renderTabs() {
    const nav = document.getElementById("appTabs");
    nav.replaceChildren(...TABS.map((t) => {
      const count = t.id === "talk" ? (badges.announcements || 0) + (badges.messages || 0)
        : t.id === "log" ? badges.inbox || 0
        : t.id === "events" ? badges.rsvp || 0 : 0;
      return h("a", { class: "app-tab", href: t.href || `#${t.id}`, dataset: { tab: t.id } },
        icon(t.icon),
        h("span", null, t.label),
        count ? h("span", { class: "app-badge", "aria-label": `${count}件` }, count > 99 ? "99+" : String(count)) : null);
    }));
    const tabId = views[current.view] ? views[current.view].tab || current.view : "";
    nav.querySelectorAll(".app-tab").forEach((t) => t.classList.toggle("is-on", t.dataset.tab === tabId));
  }
  function icon(d) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.append(p);
    return svg;
  }
  // 未読の数: 1分より古ければ取り直す(ホーム・つながるは画面の中で取り直す)
  let badgesAt = 0;
  function refreshBadges() {
    if (Date.now() - badgesAt < 60 * 1000 || current.view === "home" || current.view === "talk") return;
    badgesAt = Date.now();
    AuthApi.call("getHome", {}).then((res) => { if (res.success) setBadges(res.data.badges); });
  }
  function setBadges(b) {
    badgesAt = Date.now();
    badges = b || {};
    try { sessionStorage.setItem("btex5-badges", JSON.stringify({ at: Date.now(), badges })); } catch { /* noop */ }
    renderTabs();
  }

  async function start() {
    const data = await AuthSession.guardPage({ next: "home" });
    if (!data) return;
    session = data;
    const res = await AuthApi.listReferralMembers(AuthSession.getToken());
    members = res.success ? res.data.members : [];
    document.getElementById("appMe").replaceChildren(avatar(data.displayName));
    document.getElementById("appMe").setAttribute("aria-label", `${data.displayName}さんのマイページ`);
    renderTabs();
    window.addEventListener("hashchange", route);
    await route();
    document.documentElement.classList.remove("guard-pending");
  }

  return {
    h, append, fill, fmtDate, fmtDateLong, fmtTime, yen, daysUntil, todayKey, chip, avatar, richText, toast, copyText, shareText,
    icon, api, openSheet, field, btn, segmented, empty, section, memberPicker,
    AREA_LABELS, REF_STATUS, VISITOR_STATUS,
    views, go, route, setBadges, start,
    get members() { return members; },
    memberById,
    get session() { return session; },
    get current() { return current; },
    isAdmin: () => !!(session && session.user && session.user.isAdmin),
    siteUrl: (path) => new URL(path, location.href).href,
  };
})();
