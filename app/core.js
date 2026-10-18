// ============================================
// app/core.js — 会員アプリの土台
// 画面の切り替え(#home など)・下のタブ・下から出る入力シート・メンバーの選択・
// 小さな表示の道具をまとめる。各画面は app/*.js が App.views に登録する。
// 文字はすべて textContent で入れる(利用者の入力を HTML として扱わない)。
// ============================================

const App = (function () {
  "use strict";

  // 文字を大きく(マイページで切り替え。この端末に保存)
  try { if (localStorage.getItem("btex5-big-text") === "1") document.documentElement.classList.add("big-text"); } catch { /* noop */ }

  // 画面の部品は「条件に合わなければ null」を渡して組み立てるため、ブラウザの append などが
  // null・undefined・false を「null」の文字として出してしまわないようにする(全画面の安全網)
  [Element.prototype, DocumentFragment.prototype].forEach((proto) => {
    ["append", "prepend", "replaceChildren", "after", "before"].forEach((name) => {
      const orig = proto[name];
      if (typeof orig !== "function" || orig.__btexSafe) return;
      const safe = function (...nodes) { return orig.apply(this, nodes.filter((n) => n !== null && n !== undefined && n !== false)); };
      safe.__btexSafe = true;
      proto[name] = safe;
    });
  });

  // 4行でたたんだ紹介カードのメモなどは、押すと全部出す
  document.addEventListener("click", (e) => {
    const dd = e.target.closest && e.target.closest(".ref-card-body dd");
    if (dd && !e.target.closest("a, button")) dd.classList.toggle("is-open");
  });

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
  const NULLISH = /(?:null|undefined){2,}/g;
  function append(el, children) {
    children.flat(Infinity).forEach((c) => {
      if (c === undefined || c === null || c === false) return;
      // 入っていない値をつないだ「null」「nullnull」などの文字は出さない(文の中にあっても消す)
      if (!(c instanceof Node)) {
        const t = String(c).replace(NULLISH, "");
        if (!t || /^(?:null|undefined)$/.test(t.trim())) return;
        el.append(document.createTextNode(t));
        return;
      }
      el.append(c);
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
  // "YYYY-MM-DDTHH:MM" → "10/15(木) 0:00(あと4日)"
  function fmtStamp(stamp) {
    if (!stamp) return "";
    let date = stamp.slice(0, 10), time = stamp.slice(11);
    // 「0:00 まで」は前の日の「23:59 まで」と書く(どちらの日か迷わないように)
    if (time === "00:00") {
      const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - 1);
      date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      time = "23:59";
    }
    const days = daysUntil(date, todayKey());
    return `${fmtDate(date)} ${Number(time.slice(0, 2))}:${time.slice(3)}${days > 0 ? `(あと${days}日)` : days === 0 ? "(今日まで)" : ""}`;
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
    confirmed: { label: "参加確定", tone: "good" },
    attended: { label: "参加済み", tone: "good" },
    joined: { label: "入会", tone: "good" },
    declined: { label: "キャンセル", tone: "mute" },
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
    String(text || "").replace(NULLISH, "").split(/(https:\/\/[^\s<>"']+)/g).forEach((part, i) => {
      if (i % 2) out.append(h("a", { href: part, target: "_blank", rel: "noopener" }, part));
      else out.append(document.createTextNode(part));
    });
    return out;
  }

  // ---------- お知らせ(画面下に少し出る) ----------
  let toastTimer = null;
  // 画面の下に短いお知らせ。kind が "error" のときは赤い印で、少し長めに出す
  function toast(msg, kind) {
    let el = document.getElementById("appToast");
    if (!el) { el = h("div", { id: "appToast", class: "app-toast", role: "status" }); document.body.append(el); }
    const isError = kind === "error";
    el.className = `app-toast${isError ? " is-error" : ""}`;
    el.replaceChildren(h("span", { class: "app-toast-icon", "aria-hidden": "true" }, isError ? "!" : "✓"), h("span", { class: "app-toast-text" }, msg));
    el.setAttribute("role", isError ? "alert" : "status");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 4500 : 2800);
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

  // ---------- 入力の下書き(閉じても、電波が切れても消えない) ----------
  // 入力欄ごとに、この端末・ログインした人ごとに保存する。送ったら clearDraft で消す
  function draftKey(key) { return `btex5-draft-${(session && session.memberId) || "guest"}-${key}`; }
  function draft(key, el) {
    try {
      const saved = localStorage.getItem(draftKey(key));
      if (saved && !el.value) {
        el.value = saved;
        el.classList.add("has-draft");
      }
    } catch { /* noop */ }
    let timer = null;
    el.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          if (el.value.trim()) localStorage.setItem(draftKey(key), el.value);
          else localStorage.removeItem(draftKey(key));
        } catch { /* noop */ }
      }, 400);
    });
    return el;
  }
  function clearDraft(...keys) {
    keys.forEach((key) => { try { localStorage.removeItem(draftKey(key)); } catch { /* noop */ } });
  }

  // ---------- カレンダーに追加(Google カレンダー / iPhone などの .ics) ----------
  // item: { title, date: "YYYY-MM-DD", start: "HH:MM", end, endDate(日付をまたぐとき), place, body }
  function calStamp(date, time) {
    return `${date.replace(/-/g, "")}T${(time || "00:00").replace(":", "").padStart(4, "0")}00`;
  }
  // 終日(時刻なし)の予定は、その日1日として入れる(やることの期限など)
  function nextDay(date) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }
  function calRange(item) {
    if (item.allDay) return [item.date.replace(/-/g, ""), nextDay(item.date)];
    const start = item.start || "10:00";
    let end = item.end;
    if (!end) {
      const [hh, mm] = start.split(":").map(Number);
      end = `${String(Math.min(23, hh + 1)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
    // 終わりが始まりより前の時刻なら翌日(22:30〜3:00 など)
    let endDate = item.endDate || item.date;
    if (!item.endDate && end <= start) {
      const d = new Date(`${item.date}T12:00:00`);
      d.setDate(d.getDate() + 1);
      endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return [calStamp(item.date, start), calStamp(endDate, end)];
  }
  function googleCalUrl(item) {
    const [a, b] = calRange(item);
    const p = new URLSearchParams({ action: "TEMPLATE", text: item.title, dates: `${a}/${b}`, ctz: "Asia/Tokyo" });
    if (item.place) p.set("location", item.place);
    if (item.body) p.set("details", item.body.slice(0, 800));
    return `https://calendar.google.com/calendar/render?${p}`;
  }
  function icsFile(item) {
    const [a, b] = calRange(item);
    const esc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const text = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BT-EX5//JA", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      `UID:${item.uid || `${a}-${Math.random().toString(36).slice(2)}`}@bt-ex5`, `DTSTAMP:${now}`,
      item.allDay ? `DTSTART;VALUE=DATE:${a}` : `DTSTART;TZID=Asia/Tokyo:${a}`, item.allDay ? `DTEND;VALUE=DATE:${b}` : `DTEND;TZID=Asia/Tokyo:${b}`,
      `SUMMARY:${esc(item.title)}`, item.place ? `LOCATION:${esc(item.place)}` : "", item.body ? `DESCRIPTION:${esc(item.body)}` : "",
      "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${esc(item.title)}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const a2 = document.createElement("a");
    a2.href = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    a2.download = `btex5-${item.date}.ics`;
    document.body.append(a2);
    a2.click();
    setTimeout(() => { URL.revokeObjectURL(a2.href); a2.remove(); }, 1000);
  }
  function calendarButtons(item) {
    return h("details", { class: "cal-add" },
      h("summary", null, glyph("calendar"), "カレンダーに追加"),
      h("div", { class: "cal-add-menu" },
        h("a", { href: googleCalUrl(item), target: "_blank", rel: "noopener", class: "app-btn ghost small" }, "Google カレンダー"),
        h("button", { type: "button", class: "app-btn ghost small", onclick: () => icsFile(item) }, "iPhone・Outlook(.ics)")));
  }

  // ---------- QR コード(app/vendor/qrcode.js。MIT ライセンス) ----------
  function qrImage(text, label) {
    if (typeof qrcode === "undefined") return h("p", { class: "app-field-hint" }, text);
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    const q = qrcode(0, "M");
    q.addData(text, "Byte");
    q.make();
    const cell = Math.max(3, Math.floor(240 / q.getModuleCount()));
    return h("img", { class: "qr-img", src: q.createDataURL(cell, cell * 2), alt: label || "QRコード", width: String(q.getModuleCount() * cell + cell * 4) });
  }

  // ---------- 通信 ----------
  // 書きこむ操作は、同じ内容を送っている途中にもう一度押されても、2回送らない(2重の投稿・通知を防ぐ)
  const inflight = new Map();
  const READ_ONLY = /^(get|list|verify|search)/;
  function call(action, payload) {
    if (READ_ONLY.test(action)) return AuthApi.call(action, payload);
    let key;
    try { key = `${action}:${JSON.stringify(payload || {})}`; } catch { return AuthApi.call(action, payload); }
    if (inflight.has(key)) return inflight.get(key);
    const p = AuthApi.call(action, payload).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  async function api(action, payload, opt) {
    const res = await call(action, payload);
    if (!res.success) {
      if (res.error.code === "SESSION_INVALID") {
        AuthSession.clearToken();
        location.replace(`../login/?next=home`);
        return null;
      }
      if (!(opt && opt.quiet)) toast(res.error.userMessage, "error");
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
    // すでにどこかの入力欄で書き始めていたら、カーソルを動かさない
    if (first && !(opt && opt.noFocus)) setTimeout(() => { if (!panel.contains(document.activeElement)) first.focus({ preventScroll: true }); }, 50);
    return close;
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !sheetStack.length) return;
    const top = sheetStack[sheetStack.length - 1];
    const btn = top.querySelector(".app-sheet-close");
    if (btn) btn.click();
  });

  // 確かめるシート(ブラウザの灰色の確認ダイアログの代わり)。消すなど戻せない操作は danger で赤いボタン
  function confirmSheet(message, opt) {
    const o = Object.assign({ title: "確認", ok: "はい", cancel: "やめる", danger: false }, opt || {});
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      openSheet(o.title, (body, close) => {
        body.append(h("p", { class: "app-lead confirm-text" }, message),
          h("div", { class: "confirm-row" },
            btn(o.cancel, close, "ghost"),
            btn(o.ok, () => { finish(true); close(); }, o.danger ? "danger-fill" : "primary")));
        setTimeout(() => { const b = body.querySelector(".confirm-row .app-btn"); if (b) b.focus({ preventScroll: true }); }, 50);
      }, { noFocus: true, onClose: () => finish(false) });
    });
  }

  // 記録したあとに「LINE などでも知らせる」(サイトの通知に気づかない人もいるため)
  function doneSheet(title, lead, text) {
    openSheet(title, (body, close) => {
      const box = h("textarea", { rows: "7", readonly: true, class: "invite-text" });
      box.value = text;
      body.append(
        h("p", { class: "done-check", "aria-hidden": "true" }, "✓"),
        h("p", { class: "app-lead" }, lead),
        box,
        h("div", { class: "app-btn-row" },
          btn("LINE などで送る", () => shareText(text), "primary"),
          btn("コピー", () => copyText(text), "ghost")),
        btn("閉じる", close, "ghost wide"));
    }, { noFocus: true });
  }

  // ---------- 入力欄 ----------
  // 入力欄1つなら <label>。ボタンの並び(メンバーの選択・種類など)は <label> に入れると
  // 押したときにブラウザが先頭のボタンも押してしまうため、<div> + 見出しにする
  function field(label, input, hint) {
    const single = input instanceof Element && /^(INPUT|SELECT|TEXTAREA)$/.test(input.tagName);
    if (single) return h("label", { class: "app-field" }, h("span", { class: "app-field-label" }, label), hint ? h("span", { class: "app-field-hint" }, hint) : null, input);
    return h("div", { class: "app-field", role: "group", "aria-label": label }, h("span", { class: "app-field-label" }, label), hint ? h("span", { class: "app-field-hint" }, hint) : null, input);
  }
  // 入力のまちがいを、その欄のすぐ下に出す(枠を赤く・画面をその欄まで動かす・入力欄へ)。
  // 直すと消える。target は入力欄・メンバー選び(App.memberPicker の結果)・その欄を包む要素のどれでもよい
  function fieldError(target, message) {
    if (!target) { toast(message, "error"); return; }
    const box = (target.closest && target.closest(".app-field")) || target;
    const old = box.querySelector(":scope > .app-field-error");
    if (old) old.remove();
    const id = `fe-${Math.random().toString(36).slice(2, 8)}`;
    const msg = h("p", { class: "app-field-error", id, role: "alert" }, message);
    box.append(msg);
    box.classList.add("is-invalid");
    const focusEl = /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName) ? target : box.querySelector("input:not([hidden]):not([type=hidden]), select, textarea, button");
    if (focusEl) focusEl.setAttribute("aria-describedby", id);
    const clear = () => { msg.remove(); box.classList.remove("is-invalid"); box.removeEventListener("input", clear); box.removeEventListener("change", clear); box.removeEventListener("click", clearSoon); };
    const clearSoon = () => setTimeout(clear, 0);
    box.addEventListener("input", clear);
    box.addEventListener("change", clear);
    box.addEventListener("click", clearSoon);
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    if (focusEl) setTimeout(() => focusEl.focus({ preventScroll: true }), 250);
  }

  // 選んで切り替えるボタンの並び(押したものが選ばれる)
  function toggle(options, value, onchange) {
    let cur = value;
    const el = h("div", { class: "app-toggle", role: "radiogroup" });
    const draw = () => el.replaceChildren(...options.map((o) => h("button", {
      type: "button", role: "radio", class: o.id === cur ? "is-on" : "", "aria-checked": o.id === cur ? "true" : "false",
      onclick: () => { cur = o.id; draw(); if (onchange) onchange(cur); },
    }, o.label)));
    draw();
    el.getValue = () => cur;
    el.setValue = (v) => { cur = v; draw(); };
    return el;
  }
  // 時刻の選択肢(from〜to 時、step 分ごと)
  function timeSelect(value, opt) {
    const o = Object.assign({ from: 6, to: 23, step: 30, none: "" }, opt || {});
    const sel = h("select", { "aria-label": o.label || "時刻" }, o.none ? h("option", { value: "" }, o.none) : null);
    for (let m = o.from * 60; m <= o.to * 60 + 30; m += o.step) {
      const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      sel.append(h("option", { value: t }, t));
    }
    if (value && ![...sel.options].some((x) => x.value === value)) sel.append(h("option", { value }, value));
    sel.value = value || (o.none ? "" : sel.options[0].value);
    return sel;
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
  // 数字のカード(ラベル・大きな数字・補足)。管理画面の集計などで使う
  function kpi(label, value, note) {
    return h("div", { class: "home-stat" }, h("span", null, label), h("b", null, value), note ? h("small", null, note) : null);
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
  // 最近えらんだ相手(この端末・ログインした人ごと。新しい順に8人まで)
  function recentKey() { return `btex5-recent-members-${(session && session.memberId) || "guest"}`; }
  function recentIds() { try { return JSON.parse(localStorage.getItem(recentKey()) || "[]"); } catch { return []; } }
  function rememberRecent(id) {
    try { localStorage.setItem(recentKey(), JSON.stringify([id, ...recentIds().filter((x) => x !== id)].slice(0, 8))); } catch { /* noop */ }
  }

  function memberPicker(opt) {
    const picked = new Set(opt.value ? [].concat(opt.value) : []);
    const wrap = h("div", { class: "app-picker" });
    const recent = h("div", { class: "app-picker-recent" });
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
      renderRecent();
    }
    // 最近の相手を1タップで選べるように(探す前に出す)
    function choose(m) {
      if (!opt.multiple) picked.clear();
      picked.add(m.id);
      rememberRecent(m.id);
      input.value = "";
      renderChosen();
      renderList();
      if (opt.onchange) opt.onchange([...picked]);
    }
    function renderRecent() {
      const ids = recentIds().filter((id) => !picked.has(id) && pool.some((m) => m.id === id) && !(session && id === session.memberId)).slice(0, 6);
      const show = ids.length && !input.value.trim() && (opt.multiple || picked.size === 0);
      recent.hidden = !show;
      if (!show) return;
      recent.replaceChildren(h("small", null, "最近の相手"), ...ids.map((id) => {
        const m = memberById(id);
        return h("button", { type: "button", class: "app-recent-chip", onclick: () => choose(m) }, avatar(m.name, "sm"), m.name);
      }));
    }
    function renderList() {
      const q = input.value.trim().toLowerCase();
      const hits = pool.filter((m) => !picked.has(m.id) && (!q || [m.name, m.company, m.business, m.team].join(" ").toLowerCase().includes(q)));
      list.replaceChildren(...hits.map((m) => h("li", null,
        h("button", { type: "button", role: "option", onclick: () => choose(m) }, avatar(m.name, "sm"), h("span", null, h("b", null, m.name), h("small", null, m.company || m.category || ""))))));
      if (!hits.length) list.append(h("li", { class: "app-picker-none" }, "見つかりません"));
    }
    input.addEventListener("input", () => { renderList(); renderRecent(); });
    wrap.append(chosen, recent, input, list);
    renderChosen();
    renderList();
    wrap.getValue = () => (opt.multiple ? [...picked] : [...picked][0] || "");
    return wrap;
  }

  // ---------- ほかの BT-EX のユニットの方を選ぶ(1on1・プレゼン) ----------
  // ユニット(BT-EX1〜14、5 はこのアプリの名簿なので除く)の一覧から押して選ぶ。お名前を入れると、
  // すべてのユニットから探す(選ぶとユニットも切りかわる)。一覧にいない方は、入れたお名前のまま使える。
  // getValue() → { unit, name } か null / setUnit(n) / onChange(v)
  function btexPicker(opt) {
    opt = opt || {};
    const UNITS = typeof BTEX_UNIT_MEMBERS !== "undefined" ? BTEX_UNIT_MEMBERS : {};
    const norm = (x) => String(x || "").replace(/[\s　|｜()（）]/g, "").toLowerCase();
    let unit = opt.unit && opt.unit !== 5 ? opt.unit : 0;
    let picked = "";
    const q = h("input", { type: "search", class: "bx-q", maxlength: "40", autocomplete: "off", placeholder: "お名前で探す(すべてのユニットから)", "aria-label": "お名前で探す" });
    const list = h("ul", { class: "bx-list", role: "listbox", "aria-label": "お名前" });
    const chosen = h("p", { class: "bx-chosen", "aria-live": "polite" });
    const wrap = h("div", { class: "bx-picker" }, q, chosen, list);
    const fire = () => { if (opt.onChange) opt.onChange(wrap.getValue()); };
    function pick(u, name) {
      picked = name;
      if (u && u !== unit) { unit = u; if (opt.onUnit) opt.onUnit(u); }
      q.value = "";
      draw(); fire();
    }
    function row(u, name, tag) {
      const on = picked === name && u === unit;
      return h("li", null, h("button", { type: "button", class: `bx-item${on ? " is-on" : ""}`, role: "option", "aria-selected": on ? "true" : "false", onclick: () => pick(u, name) },
        h("span", { class: "bx-name" }, name), tag ? h("span", { class: "bx-tag" }, `BT-EX${u}`) : null));
    }
    function draw() {
      const words = norm(q.value);
      App.fill(chosen, picked ? [h("span", null, "選んだ方:"), h("b", null, `${picked}さん`), unit ? h("span", { class: "bx-tag" }, `BT-EX${unit}`) : null,
        h("button", { type: "button", class: "bx-clear", onclick: () => { picked = ""; draw(); fire(); } }, "選び直す")] : h("span", { class: "bx-hint" }, "下の一覧から押して選ぶか、お名前を入れてください"));
      const rows = [];
      if (words) {
        // すべてのユニットから探す(いまのユニットの方を先に)
        const hits = [];
        Object.keys(UNITS).forEach((k) => (UNITS[k] || []).forEach((name) => { if (norm(name).includes(words)) hits.push([Number(k), name]); }));
        hits.sort((a, b) => (b[0] === unit) - (a[0] === unit) || a[0] - b[0]);
        hits.slice(0, 30).forEach(([u, name]) => rows.push(row(u, name, true)));
        const typed = q.value.trim();
        if (unit && !hits.some(([, name]) => norm(name) === words)) {
          rows.push(h("li", null, h("button", { type: "button", class: "bx-item is-new", onclick: () => pick(unit, typed) },
            h("span", { class: "bx-name" }, `「${typed}」さんとして入れる`), h("span", { class: "bx-tag" }, `BT-EX${unit}`))));
        }
        if (!rows.length) rows.push(h("li", { class: "bx-empty" }, "見つかりません。上で BT-EX の番号を選ぶと、入れたお名前のまま使えます"));
      } else if (unit) {
        const names = (UNITS[unit] || []).slice().sort((a, b) => a.localeCompare(b, "ja"));
        names.forEach((name) => rows.push(row(unit, name, false)));
        if (!names.length) rows.push(h("li", { class: "bx-empty" }, `BT-EX${unit} の一覧はまだありません。上でお名前を入れてください`));
      } else {
        rows.push(h("li", { class: "bx-empty" }, "BT-EX の番号を選ぶと、そのユニットの方の一覧が出ます"));
      }
      App.fill(list, rows);
    }
    q.addEventListener("input", draw);
    q.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const first = list.querySelector(".bx-item");
      if (first) first.click();
    });
    wrap.getValue = () => (picked && unit ? { unit, name: picked } : null);
    wrap.setUnit = (n) => { if (n !== unit) { unit = n; picked = ""; q.value = ""; draw(); fire(); } };
    wrap.focusInput = () => q.focus();
    draw();
    return wrap;
  }

  // ---------- 画面の切り替え ----------
  const views = {};
  const TABS = [
    { id: "search", label: "早見表", href: "../referral/", icon: "M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" },
    { id: "log", label: "記録", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v4h4v2h-4v4h-2v-4H7v-2h4V7z" },
    { id: "events", label: "予定", icon: "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v9H5z" },
    { id: "present", label: "プレゼン", icon: "M3 3h18v2h-1v10a1 1 0 0 1-1 1h-6v2.3l3.6 2.4-1.1 1.6L12 20.1l-3.5 2.2-1.1-1.6L11 18.3V16H5a1 1 0 0 1-1-1V5H3zm3 2v9h12V5zm2 6h3v2H8zm0-3h8v2H8z" },
    { id: "board", label: "掲示板", icon: "M4 3h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4V4a1 1 0 0 1 1-1Zm3 4v2h10V7Zm0 4v2h7v-2Z" },
    { id: "news", label: "アップデート", icon: "M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" },
  ];
  // プレゼン(定例会の進行)のタブは、この人だけに出す
  const PRESENT_OWNERS = ["yamamoto", "m22"]; // 山本 捷真・小林 末季(こばねぇ)
  const canPresent = () => !!(session && PRESENT_OWNERS.includes(session.memberId));
  let badges = {};
  let current = { view: "", parts: [], params: new URLSearchParams() };
  let cleanup = null;
  let hiddenAt = Date.now();

  function parseHash() {
    const raw = location.hash.replace(/^#/, "") || "home";
    const [path, query] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    return { view: parts[0] || "home", parts: parts.slice(1), params: new URLSearchParams(query || "") };
  }
  // 画面を移る。描き終わるまで待てる(移ったあとにシートを出すときに使う)
  function go(hash) {
    if (location.hash !== `#${hash}`) history.pushState(null, "", `#${hash}`);
    return route();
  }

  // 新しい版の確認: アプリは一度開くとページを読み直さずに画面を切りかえるので、更新しても古い画面のままになる。
  // 画面を切りかえるとき(2分に1回まで)に、このページの最新の版(?v=)を確かめ、変わっていれば読み直す
  const MY_VERSION = (() => { const m = /[?&]v=(\d+)/.exec((document.currentScript && document.currentScript.src) || ""); return m ? m[1] : ""; })();
  let versionCheckedAt = Date.now();
  async function newerVersion() {
    if (!MY_VERSION || Date.now() - versionCheckedAt < 2 * 60 * 1000) return false;
    versionCheckedAt = Date.now();
    try {
      const res = await fetch(location.pathname, { cache: "no-cache", credentials: "same-origin" });
      if (!res.ok) return false;
      const m = /core\.js\?v=(\d+)/.exec(await res.text());
      return Boolean(m && m[1] !== MY_VERSION);
    } catch { return false; }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || document.querySelector(".app-sheet-wrap, .pr-run")) return;
    newerVersion().then((yes) => { if (yes) location.reload(); });
  });

  async function route() {
    // 画面の切りかえは待たせずに、裏で確かめる(新しい版があれば、入力中のシートやプレゼン中でないときに読み直す)
    newerVersion().then((yes) => { if (yes && !document.querySelector(".app-sheet-wrap, .pr-run")) location.reload(); });
    const r = parseHash();
    const view = views[r.view] ? r.view : "home";
    if (cleanup) { try { cleanup(); } catch { /* noop */ } cleanup = null; }
    // 開いていたシートは閉じる(書きかけは下書きに残っている)
    sheetStack.splice(0).forEach((w) => w.remove());
    document.body.classList.remove("app-sheet-open");
    current = { view, parts: r.parts, params: r.params };
    const tabId = views[view].tab || view;
    document.querySelectorAll(".app-tab").forEach((t) => {
      const on = t.dataset.tab === tabId;
      t.classList.toggle("is-on", on);
      if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    const main = document.getElementById("appView");
    document.getElementById("appTitle").textContent = views[view].title || "";
    // 読み込みのあいだは、カードの形の薄いひな形を出す(文字だけの「読み込み中」より落ち着いて見える)
    main.replaceChildren(h("div", { class: "app-skel", role: "status", "aria-label": "読み込み中" },
      h("div", { class: "app-skel-line is-title" }), h("div", { class: "app-skel-card" }), h("div", { class: "app-skel-card is-short" }), h("div", { class: "app-skel-card" })));
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
    const tabs = TABS.filter((t) => t.id !== "present" || canPresent());
    nav.style.setProperty("--tab-n", String(tabs.length));
    nav.replaceChildren(...tabs.map((t) => {
      const count = t.id === "news" ? badges.announcements || 0
        : t.id === "board" ? badges.board || 0
        : t.id === "log" ? badges.inbox || 0
        : t.id === "events" ? badges.rsvp || 0 : 0;
      return h("a", { class: "app-tab", href: t.href || `#${t.id}`, draggable: "false", dataset: { tab: t.id } },
        icon(t.icon),
        h("span", null, t.label),
        count ? h("span", { class: "app-badge", "aria-label": `${count}件` }, count > 99 ? "99+" : String(count)) : null);
    }));
    const tabId = views[current.view] ? views[current.view].tab || current.view : "";
    nav.querySelectorAll(".app-tab").forEach((t) => t.classList.toggle("is-on", t.dataset.tab === tabId));
    if (typeof TabDock !== "undefined") TabDock.attach(nav);
  }
  // 絵文字の代わりに使う線のアイコン(タブと同じ形の仲間)。App.glyph("ref") のように名前で呼ぶ
  const GLYPHS = {
    ref: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm.6 4.6 4.4 4.4-4.4 4.4-1.4-1.4 2-2H7v-2h6.2l-2-2z",
    won: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z",
    thanks: "M12 21s-7.5-4.6-9.3-9.4C1.4 8 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.5 4.3 7.1C19.5 16.4 12 21 12 21Z",
    comment: "M4 3h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4V4a1 1 0 0 1 1-1Zm3 4v2h10V7Zm0 4v2h7v-2Z",
    post: "M3 17.2V21h3.8L17.8 10l-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z",
    calendar: "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v9H5z",
    one: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1zm16.5-5.9c2.9.4 5.5 2.4 5.5 4.9v1h-4.2c0-2.3-.5-4.3-1.3-5.9Z",
    task: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
    clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.4l4 2.4-.8 1.3L11 13V7z",
    mention: "M12 2a10 10 0 1 0 5 18.7l-1-1.7A8 8 0 1 1 20 12v1.4a1.6 1.6 0 0 1-3.2 0V12a4.8 4.8 0 1 0-1.4 3.4A3.6 3.6 0 0 0 22 13.4V12A10 10 0 0 0 12 2Zm0 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z",
    visitor: "M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2Zm9 4c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z",
    ann: "M3 10v4a1 1 0 0 0 1 1h2l5 4V5L6 9H4a1 1 0 0 0-1 1Zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z",
    dot: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    lock: "M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3Z",
    search: "M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z",
    warn: "M12 2 1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z",
    crown: "M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z",
  };
  function glyph(name) { return icon(GLYPHS[name] || GLYPHS.dot); }

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
  // 未読の数: 1分より古ければ取り直す(ホームは画面の中で取り直す)
  let badgesAt = 0;
  function refreshBadges() {
    // 予定(あなたのやること)は画面の中で取り直す
    if (Date.now() - badgesAt < 60 * 1000 || current.view === "events") return;
    badgesAt = Date.now();
    AuthApi.call("getHome", {}).then((res) => { if (res.success) setBadges(res.data.badges); });
  }
  function setBadges(b) {
    badgesAt = Date.now();
    badges = b || {};
    const bell = document.getElementById("appBellCount");
    if (bell) {
      const n = badges.feed || 0;
      bell.hidden = !n;
      bell.textContent = n > 99 ? "99+" : String(n);
      document.getElementById("appBell").setAttribute("aria-label", n ? `お知らせ(新着 ${n} 件)` : "お知らせ");
    }
    // ホーム画面に追加したアイコンにも未読の数を出す(対応している端末のみ)
    const total = (badges.announcements || 0) + (badges.inbox || 0);
    try {
      if (navigator.setAppBadge) { if (total) navigator.setAppBadge(total).catch(() => {}); else navigator.clearAppBadge().catch(() => {}); }
    } catch { /* noop */ }
    try { sessionStorage.setItem("btex5-badges", JSON.stringify({ at: Date.now(), badges })); } catch { /* noop */ }
    renderTabs();
  }

  async function start() {
    // QR などで開いたリンク(#events?checkin=… など)を、ログインをはさんでも失わないようにする
    const PENDING = "btex5-app-pending-hash";
    try { if (location.hash.length > 1) sessionStorage.setItem(PENDING, location.hash); } catch { /* noop */ }
    const data = await AuthSession.guardPage({ next: "home" });
    if (!data) return;
    try {
      const pending = sessionStorage.getItem(PENDING);
      sessionStorage.removeItem(PENDING);
      if (pending && location.hash.length <= 1) history.replaceState(null, "", pending);
    } catch { /* noop */ }
    session = data;
    try { sessionStorage.setItem("btex5-my-name", data.displayName || ""); sessionStorage.setItem("btex5-present", canPresent() ? "1" : "0"); } catch { /* noop */ }
    const res = await AuthApi.listReferralMembers(AuthSession.getToken());
    members = res.success ? res.data.members : [];
    document.getElementById("appMe").replaceChildren(avatar(data.displayName));
    // 共有サーバーに切り替えたあと: この端末に残っているお試し版のプロフィールを送るか聞く
    if (typeof ProfileTransfer !== "undefined") ProfileTransfer.offerUpload(data, memberById(data.memberId));
    document.getElementById("appMe").setAttribute("aria-label", `${data.displayName}さんのマイページ`);
    renderTabs();
    // 電波がないときは、上に「オフライン」と出す(保存できないことがわかるように)
    const offline = h("div", { class: "app-offline", role: "status", hidden: navigator.onLine !== false }, "オフラインです。電波が戻ると、また保存できます(見るだけならこのまま使えます)");
    document.body.append(offline);
    window.addEventListener("offline", () => { offline.hidden = false; });
    window.addEventListener("online", () => { offline.hidden = true; toast("オンラインに戻りました"); });
    // いちばん上で下に引っぱると、読み込み直す(ホーム画面に追加したアプリには再読み込みのボタンがないため)
    const ptr = h("div", { class: "app-ptr", "aria-hidden": "true" }, h("span", null, "↓"), h("small", null, "引っぱって更新"));
    document.body.append(ptr);
    let pull = null;
    document.addEventListener("touchstart", (e) => {
      if (window.scrollY > 0 || e.touches.length !== 1 || e.target.closest(".app-tabs, .app-sheet-wrap, textarea, .cal-grid, input")) { pull = null; return; }
      pull = { y: e.touches[0].clientY, dy: 0 };
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      if (!pull) return;
      pull.dy = Math.max(0, e.touches[0].clientY - pull.y);
      if (window.scrollY > 0) { pull = null; ptr.classList.remove("is-show", "is-ready"); return; }
      const k = Math.min(1, pull.dy / 90);
      ptr.classList.toggle("is-show", pull.dy > 12);
      ptr.classList.toggle("is-ready", pull.dy > 90);
      ptr.style.setProperty("--k", String(k));
      ptr.querySelector("small").textContent = pull.dy > 90 ? "はなすと更新" : "引っぱって更新";
    }, { passive: true });
    document.addEventListener("touchend", async () => {
      if (!pull) return;
      const go = pull.dy > 90;
      pull = null;
      if (!go) { ptr.classList.remove("is-show", "is-ready"); return; }
      ptr.classList.add("is-loading");
      ptr.querySelector("small").textContent = "更新しています…";
      badgesAt = 0;
      await route();
      ptr.classList.remove("is-show", "is-ready", "is-loading");
    });
    // 長い画面で、下までいったら「上へ」ボタンを出す
    const toTop = h("button", { type: "button", class: "app-to-top", "aria-label": "いちばん上へ", hidden: true, onclick: () => window.scrollTo({ top: 0, behavior: "smooth" }) }, "↑");
    document.body.append(toTop);
    let topTick = false;
    window.addEventListener("scroll", () => {
      if (topTick) return;
      topTick = true;
      requestAnimationFrame(() => { toTop.hidden = window.scrollY < 900; topTick = false; });
    }, { passive: true });
    window.addEventListener("hashchange", route);
    // 通知から開いたとき: ホーム画面のアイコンの数字を消し、通知の画面へ移る
    if (typeof BtexPush !== "undefined") {
      BtexPush.clearBadge();
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", (e) => {
          if (e.data && e.data.type === "open" && typeof e.data.url === "string") {
            const u = new URL(e.data.url, location.href);
            if (u.origin === location.origin && u.pathname === location.pathname) go(u.hash.slice(1) || "home");
          }
        });
      }
    }
    // ほかのアプリから戻ってきたら、入力中でなければ最新にする(1分以上たっていたら)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      const v = views[current.view];
      const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (!v || !v.autoRefresh || sheetStack.length || typing || Date.now() - hiddenAt < 60 * 1000) return;
      if (typeof v.autoRefresh === "function" && !v.autoRefresh(current.parts)) return;
      route();
    });
    await route();
    document.documentElement.classList.remove("guard-pending");
  }

  // Excel で文字化けしない CSV(先頭に BOM)。数式として読まれないよう = + - @ で始まる値は ' を付ける。
  // 日時(ミリ秒)は読める形にする
  function downloadCsv(name, rows) {
    const cell = (v) => {
      let s;
      if (typeof v === "number" && v > 1e12) {
        const d = new Date(v);
        s = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
      } else s = String(v === undefined || v === null ? "" : v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const text = "\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // 早見表でメンバーの詳細を開くリンク。詳細に「← ◯◯に戻る」が出て、いまの画面へ戻れる
  // back: 戻り先(#のあと)。省くといまの画面
  function profileHref(memberId, back) {
    const to = back === undefined ? location.hash.replace(/^#/, "") : back;
    return `../referral/#member=${encodeURIComponent(memberId)}${to ? `&back=${encodeURIComponent(to)}` : ""}`;
  }

  // Google Meet の会議の作り方(トグルで開く)
  function meetHowTo() {
    return h("details", { class: "meet-howto" },
      h("summary", null, "Meet の作り方"),
      h("ol", null,
        h("li", null, "上の「Meet を作る」を押す(Google Meet が新しいタブで開きます)"),
        h("li", null, "Google アカウントでログインしていなければ、ログインする"),
        h("li", null, "会議の画面が開いたら、上のアドレス欄の URL(https://meet.google.com/xxx-xxxx-xxx)をコピーする。「参加に必要な情報」の欄にある URL のコピーボタンでも同じです"),
        h("li", null, "この画面に戻り、下の入力欄に URL を貼り付けて「保存する」"),
        h("li", null, "Meet のタブは閉じてかまいません。当日は同じ URL(「Meet に参加」ボタン)から入れます")),
      h("p", { class: "app-field-hint" }, "スマホは Google Meet アプリが開くことがあります。そのときは「会議に参加するための情報を共有」→「コピー」で URL を取り出せます。"));
  }

  return {
    profileHref, meetHowTo, downloadCsv, btexPicker,
    h, append, fill, confirm: confirmSheet, fmtStamp, fmtDate, fmtDateLong, fmtTime, yen, daysUntil, todayKey, chip, avatar, richText, toast, copyText, shareText,
    icon, glyph, qrImage, draft, clearDraft, fieldError, calendarButtons, googleCalUrl, icsFile, api, openSheet, doneSheet, field, btn, toggle, timeSelect, segmented, kpi, empty, section, memberPicker,
    AREA_LABELS, REF_STATUS, VISITOR_STATUS,
    views, go, route, setBadges, start,
    get members() { return members; },
    memberById,
    get session() { return session; },
    get current() { return current; },
    isAdmin: () => !!(session && session.user && session.user.isAdmin),
    canPresent,
    siteUrl: (path) => new URL(path, location.href).href,
  };
})();
