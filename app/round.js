// ============================================
// app/round.js — プレゼン(下のメニューの「プレゼン」)
// 定例会の「プレゼンテーション」を、顔写真と紹介つきの大きな画面で順番に進める。
// ・準備(#present): 定例会を選ぶ → 出る人を押して選ぶ(押した順が話す順番)→ 並べかえ(つかんで動かす・↑↓・シャッフル)
//   → 1人の時間(30秒・1分・2分・5分)・次の人までの間(1〜10秒)→「プレゼンをはじめる」
// ・進行(画面いっぱい): 番号・名前・肩書き・活動範囲・つながりたい人・こんな話が出たら・顔写真・次の人、
//   下に残り時間のメーター(1分までは1目盛り=1秒。左の5秒が赤、次の5秒がオレンジ。目盛りの下に残り秒数の数字)と残り秒数。
//   残り10秒と 0秒で音(鐘)。「自動で次へ」なら 0秒のあと、選んだ秒数(はじめは5秒)で次の人へ。
//   キー操作: スペース=止める・つづける、→=次へ、←=前へ、Esc=終わる(会場のスクリーンや Meet の画面共有で映す想定)
// 連絡先は出さない(名簿でメンバーが見られる内容だけ)
// 顔写真: 本人(または運営)がこの画面で入れた写真 → 運営が用意した写真(REF_MEMBER_PHOTOS)→ 頭文字
// ============================================

(function () {
  "use strict";
  const { h } = App;
  // 時間(プレゼンの1人あたり・自分だけのタイマー)。25分はポモドーロ(25分集中+5分休憩 を4回)
  const PER = [[30, "30秒"], [60, "1分"], [120, "2分"], [180, "3分"], [300, "5分"], [600, "10分"], [1500, "25分"]];
  const POMODORO = 1500, POMO_BREAK = 300, POMO_ROUNDS = 4;
  // 定例会のプレゼンの1人あたりの時間(1つ選ぶ)と、自分で使うタイマーの時間(押すたびに足す)
  const MEET_PER = PER.filter(([v]) => v <= 300);
  const SOLO_STEPS = [[30, "30秒"], [60, "1分"], [180, "3分"], [300, "5分"], [600, "10分"]];
  const SOLO_MAX = 3 * 60 * 60; // 自分で使うタイマーは3時間まで
  // 「1時間5分」「13分30秒」のように
  const fmtLong = (sec) => {
    const hr = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
    return [hr ? `${hr}時間` : "", m ? `${m}分` : "", x ? `${x}秒` : ""].join("") || "0秒";
  };
  // 0秒のあと、次の人へ移るまであける秒数(選べる範囲)
  const GAPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // メーターの目盛り: 1分までは1目盛り=1秒、それより長いときは60目盛りに分ける(2分=2秒、5分=5秒)
  const meterUnit = (per) => (per <= 60 ? 1 : per / 60);
  // 目盛りの下の数字(残り時間)の間隔。数字が12個以下になる、切りのよい秒数
  const labelStep = (per) => {
    const u = meterUnit(per);
    const steps = [5, 10, 15, 20, 30, 60, 120, 150, 300, 600, 900, 1200, 1800];
    // 目盛りの区切りにそろう間隔 → なければ(足した時間など)切りのよい間隔
    return steps.find((v) => per / v <= 12 && v % u === 0) || steps.find((v) => per / v <= 12 && per / v >= 3) || per;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(`btex5-round-${k}`); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(`btex5-round-${k}`, String(v)); } catch { /* noop */ } },
  };
  const fmt = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : String(sec));
  const two = (n) => String(n).padStart(2, "0");
  const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

  // ---------- 顔写真 ----------
  const PHOTO_W = 300, PHOTO_H = 400, PHOTO_MAX = 46000;
  let revsCache = null, revsAt = 0;
  const memo = {};
  async function photoRevs(force) {
    if (!force && revsCache && Date.now() - revsAt < 60 * 1000) return revsCache;
    const d = await App.api("getPhotoRevs", {}, { quiet: true });
    revsCache = (d && d.revs) || revsCache || {};
    revsAt = Date.now();
    return revsCache;
  }
  function cached(id) { try { return JSON.parse(localStorage.getItem(`btex5-photo-${id}`) || "null"); } catch { return null; } }
  function keep(id, rev, data) { try { localStorage.setItem(`btex5-photo-${id}`, JSON.stringify({ rev, data })); } catch { /* 端末の容量がいっぱいなら保存しない */ } }
  function forget(id) { try { localStorage.removeItem(`btex5-photo-${id}`); } catch { /* noop */ } }
  const stockPhoto = (id) => (typeof REF_MEMBER_PHOTOS !== "undefined" && REF_MEMBER_PHOTOS[id] ? `../${REF_MEMBER_PHOTOS[id]}` : "");

  // メンバーの顔写真の URL(無ければ "")。端末に保存しておき、変わったときだけ取り直す
  App.photos = async function (ids, force) {
    const revs = await photoRevs(force);
    const out = {};
    const need = [];
    ids.forEach((id) => {
      const rev = revs[id];
      if (!rev) { if (memo[id]) { delete memo[id]; forget(id); } out[id] = stockPhoto(id); return; }
      if (memo[id] && memo[id].rev === rev) { out[id] = memo[id].data; return; }
      const c = cached(id);
      if (c && c.rev === rev) { memo[id] = c; out[id] = c.data; return; }
      need.push(id);
    });
    for (let i = 0; i < need.length; i += 40) {
      const d = await App.api("getPhotos", { ids: need.slice(i, i + 40) }, { quiet: true });
      Object.entries((d && d.photos) || {}).forEach(([id, p]) => { memo[id] = p; keep(id, p.rev, p.data); out[id] = p.data; });
    }
    need.forEach((id) => { if (!out[id]) out[id] = stockPhoto(id); });
    return out;
  };

  // 選んだ画像を縦長(3:4)に切り抜き、小さな JPEG にする(顔が上のほうにある写真が多いので、少し上寄りに切る)
  async function shrinkPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const r = PHOTO_W / PHOTO_H;
      let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
      if (sw / sh > r) { const w = sh * r; sx = (sw - w) / 2; sw = w; } else { const hh = sw / r; sy = (sh - hh) * 0.3; sh = hh; }
      const cv = document.createElement("canvas");
      cv.width = PHOTO_W; cv.height = PHOTO_H;
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, PHOTO_W, PHOTO_H);
      g.drawImage(img, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H);
      for (let q = 0.86; q >= 0.4; q -= 0.08) {
        const data = cv.toDataURL("image/jpeg", q);
        if (data.length <= PHOTO_MAX) return data;
      }
      return null;
    } finally { URL.revokeObjectURL(url); }
  }

  // 写真を選んで入れる(自分の写真、または運営がほかの人の写真)。入れたら done(写真の URL)
  App.choosePhoto = function (memberId, done) {
    const isMe = App.session && memberId === App.session.memberId;
    if (!isMe && !App.isAdmin()) return;
    const input = h("input", { type: "file", accept: "image/*", style: "display:none" });
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      let photo = null;
      try { photo = await shrinkPhoto(file); } catch { photo = null; }
      if (!photo) { App.toast("この画像は読みこめませんでした。JPEG・PNG の写真でお試しください", "error"); return; }
      const d = await App.api(isMe ? "setMyPhoto" : "adminSetMemberPhoto", isMe ? { photo } : { memberId, photo });
      if (!d) return;
      memo[memberId] = { rev: d.rev, data: photo };
      keep(memberId, d.rev, photo);
      if (revsCache) revsCache[memberId] = d.rev;
      App.toast("写真を入れました");
      if (done) done(photo);
    });
    document.body.append(input);
    input.click();
  };
  App.removePhoto = async function (memberId, done) {
    const isMe = App.session && memberId === App.session.memberId;
    if (!(await App.confirm("写真を外しますか?", { ok: "外す", danger: true }))) return;
    const d = await App.api(isMe ? "setMyPhoto" : "adminSetMemberPhoto", isMe ? { photo: "" } : { memberId, photo: "" });
    if (!d) return;
    delete memo[memberId]; forget(memberId);
    if (revsCache) delete revsCache[memberId];
    App.toast("写真を外しました");
    if (done) done(stockPhoto(memberId));
  };

  // 名前(呼び名が付いているときは2行。例: 小林 末季 / こばねぇ)
  function nameEl(name, tag, cls, suffix) {
    const p = typeof refNameParts === "function" ? refNameParts(name) : { main: name, nick: "" };
    return p.nick
      ? h(tag, { class: cls }, h("span", { class: "nm-main" }, p.main), h("br"), h("span", { class: "nm-nick" }, p.nick), suffix || null)
      : h(tag, { class: cls }, p.main, suffix || null);
  }
  // 代表・役職・役割のマーク(早見表と同じ形)
  const ROLE_PATHS = {
    leader: "M2 11.5h12L15 4.5l-3.6 2.7L8 2 4.6 7.2 1 4.5z",
    post: "M8 1.2 14 3.6v4.1c0 3.5-2.6 6.1-6 7.1-3.4-1-6-3.6-6-7.1V3.6z",
    role: "m8 1.4 1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.2l-4 2.2 1-4.4-3.4-3 4.5-.5z",
  };
  function roleBadge(r) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path"); path.setAttribute("d", ROLE_PATHS[r.kind] || ROLE_PATHS.role); svg.append(path);
    return h("span", { class: `pr-role is-${r.kind}` }, svg, r.role);
  }
  function face(url, name, cls) {
    return url
      ? h("img", { class: cls, src: url, alt: "", loading: "lazy", decoding: "async" })
      : h("span", { class: `${cls} is-initial`, "aria-hidden": "true" }, String(name || "?").replace(/\s/g, "").slice(0, 1));
  }

  // 活動範囲を1行に(例: 新潟で対面 ・ オンラインは全国対応)
  function areaLine(m) {
    const names = { niigata: "新潟", tokyo: "東京・関東" };
    const faceTxt = (m.faceAreas || []).map((a) => names[a]).filter(Boolean).join("・");
    const online = m.online === "all" ? "オンラインは全国対応" : m.online === "partial" ? "打合せはオンライン可" : m.online === "none" ? "対面のみ" : "";
    return [faceTxt ? `${faceTxt}で対面` : "", online].filter(Boolean).join(" ・ ");
  }
  // 進行の画面に出す人の情報
  function personOf(key, photos) {
    if (key.startsWith("m:")) {
      const id = key.slice(2);
      const m = App.memberById(id);
      if (!m) return null;
      return {
        key, kind: "member", memberId: id, name: m.name, photo: photos[id] || "",
        catch: m.company || m.category || "", team: m.team || "",
        area: areaLine(m), wants: clip(m.wants, 240), triggers: (m.triggers || []).slice(0, 4),
        role: typeof refRoleOf === "function" ? refRoleOf(id) : null,
      };
    }
    return null;
  }

  // ---------- 準備(下のメニューの「プレゼン」) ----------
  App.views.present = {
    title: "プレゼン",
    async render(el, parts, params) { await renderSetup(el, params, parts); },
  };
  // 以前の入口(定例会の画面・ホーム)からは、この画面へ
  App.roundSheet = function (opts = {}) {
    App.go(opts.eventId ? `present?event=${encodeURIComponent(opts.eventId)}` : "present");
  };

  async function renderSetup(el, params, parts) {
    const today = App.todayKey();
    const list = await App.api("listEvents", {}, { quiet: true });
    const upcoming = ((list && list.events) || []).filter((e) => e.date >= today)
      .sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")));
    const wanted = params.get("event");
    const ev = (wanted && ((list && list.events) || []).find((e) => e.id === wanted)) || (wanted === "none" ? null : upcoming[0] || null);
    const d = ev ? await App.api("getEvent", { id: ev.id }, { quiet: true }) : null;
    const members = (App.members || []).slice();
    const photos = await App.photos(members.map((m) => m.id));
    const going = new Set(d ? d.members.filter((m) => m.rsvp === "yes" || m.attended).map((m) => `m:${m.id}`) : []);
    const absent = new Set(d ? d.members.filter((m) => m.rsvp === "no" && !m.attended).map((m) => `m:${m.id}`) : []);
    const visitors = d ? (d.visitors || []).filter((v) => v.name && ["applied", "confirmed", "attended", "joined"].includes(v.status))
      .map((v) => ({ key: `v:${v.id}`, name: v.name, company: v.company || "" })) : [];
    const all = [
      ...members.map((m) => ({ key: `m:${m.id}`, id: m.id, name: m.name, company: m.company || m.category || "", team: m.team || "", kind: "member" })),
      ...visitors.map((v) => ({ ...v, kind: "visitor" })),
    ];
    // 名簿にいないBT-EXのメンバー・ゲスト(この端末に定例会ごとに覚える)。時間は1人ずつ(はじめは30秒・5秒きざみ)
    const extraKey = `extras-${ev ? ev.id : "none"}`;
    let extras = (() => { try { const s = JSON.parse(store.get(extraKey, "[]")); return Array.isArray(s) ? s.filter((x) => x && x.key && x.name) : []; } catch { return []; } })();
    const saveExtras = () => store.set(extraKey, JSON.stringify(extras));
    extras.forEach((x) => all.push(x));
    const byKey = (k) => all.find((x) => x.key === k);
    const saveKey = `order-${ev ? ev.id : "none"}`;
    // はじめの順番: この定例会で前に決めた順番 → 出席予定の人(名簿の順)
    let order = (() => {
      try { const s = JSON.parse(store.get(saveKey, "null")); if (Array.isArray(s)) return s.filter((k) => byKey(k)); } catch { /* noop */ }
      return [...going];
    })();
    let per = Number(store.get("per", 30)) || 30;
    if (!MEET_PER.some(([v]) => v === per)) per = 30;
    let auto = store.get("auto", "1") === "1";
    let gapSec = Number(store.get("gap", 5)) || 5;
    if (!GAPS.includes(gapSec)) gapSec = 5;
    const saveOrder = () => store.set(saveKey, JSON.stringify(order));

    const evSel = h("select", { class: "pr-ev", "aria-label": "定例会", onchange: () => App.go(`present?event=${encodeURIComponent(evSel.value)}`) },
      upcoming.map((e) => h("option", { value: e.id }, `${App.fmtDate(e.date)} ${e.start || ""} ${e.title}`)),
      h("option", { value: "none" }, "定例会を選ばない(メンバーから選ぶ)"));
    evSel.value = ev ? ev.id : "none";

    const grid = h("div", { class: "pr-pick", role: "group", "aria-label": "出る人" });
    const listEl = h("ol", { class: "round-list pr-order" });
    const total = h("p", { class: "round-total" });
    const goBtn = h("button", { type: "button", class: "app-btn primary wide pr-go" });
    const teamSel = h("select", { class: "pr-team", "aria-label": "チームで足す", onchange: () => {
      all.filter((x) => x.kind === "member" && x.team === teamSel.value && !order.includes(x.key)).forEach((x) => order.push(x.key));
      teamSel.value = ""; draw();
    } }, h("option", { value: "" }, "チームで足す"),
    [...new Set(members.map((m) => m.team).filter(Boolean))].map((t) => h("option", { value: t }, t)));

    function card(x) {
      const n = order.indexOf(x.key);
      const on = n >= 0;
      return h("button", {
        type: "button", class: `pr-card${on ? " is-on" : ""}${absent.has(x.key) ? " is-absent" : ""}`, "aria-pressed": on ? "true" : "false",
        onclick: () => { if (on) order.splice(n, 1); else order.push(x.key); draw(); },
      },
      face(x.kind === "member" ? photos[x.id] : "", x.name, "pr-card-face"),
      on ? h("span", { class: "pr-card-no", "aria-label": `${n + 1}番目` }, String(n + 1)) : null,
      nameEl(x.name, "span", "pr-card-name"),
      h("span", { class: "pr-card-sub" }, x.kind === "visitor" ? "ビジター" : going.has(x.key) ? "出席予定" : absent.has(x.key) ? "欠席" : x.team || ""));
    }

    let dragFrom = -1;
    function row(k, i) {
      const x = byKey(k);
      const canPhoto = x.kind === "member" && (App.isAdmin() || (App.session && x.id === App.session.memberId));
      const li = h("li", { class: "round-item pr-row", draggable: "true" },
        h("span", { class: "pr-grip", "aria-hidden": "true" }, "⋮⋮"),
        h("span", { class: "round-no" }, String(i + 1)),
        face(x.kind === "member" ? photos[x.id] : "", x.name, "pr-row-face"),
        h("span", { class: "round-name" }, nameEl(x.name, "b"), x.kind === "visitor" ? App.chip("ビジター", "info") : x.kind === "guest" ? App.chip(`ゲスト・${secLabel(x.sec || 30)}`, "info") : x.kind === "other" ? App.chip(`BT-EX・${secLabel(x.sec || 30)}`, "mute") : null, x.company ? h("small", null, x.company) : null),
        canPhoto ? h("button", { type: "button", class: "pr-photo-btn", onclick: () => App.choosePhoto(x.id, (url) => { photos[x.id] = url; draw(); }) }, photos[x.id] ? "写真を変える" : "写真を入れる") : null,
        h("span", { class: "round-move" },
          h("button", { type: "button", "aria-label": `${x.name}さんを上へ`, disabled: i === 0, onclick: () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; draw(); } }, "↑"),
          h("button", { type: "button", "aria-label": `${x.name}さんを下へ`, disabled: i === order.length - 1, onclick: () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; draw(); } }, "↓"),
          h("button", { type: "button", "aria-label": `${x.name}さんを外す`, onclick: () => { order.splice(i, 1); draw(); } }, "×")));
      // パソコン: つかんで動かす
      li.addEventListener("dragstart", (e) => { dragFrom = i; li.classList.add("is-drag"); try { e.dataTransfer.setData("text/plain", k); e.dataTransfer.effectAllowed = "move"; } catch { /* noop */ } });
      li.addEventListener("dragend", () => { li.classList.remove("is-drag"); dragFrom = -1; });
      li.addEventListener("dragover", (e) => { if (dragFrom >= 0) { e.preventDefault(); li.classList.add("is-over"); } });
      li.addEventListener("dragleave", () => li.classList.remove("is-over"));
      li.addEventListener("drop", (e) => {
        e.preventDefault(); li.classList.remove("is-over");
        if (dragFrom < 0 || dragFrom === i) return;
        const [m] = order.splice(dragFrom, 1);
        order.splice(i, 0, m);
        dragFrom = -1; draw();
      });
      return li;
    }

    // 1人ずつの時間(ほかのBT-EXのメンバー・ゲスト)。5秒きざみで選ぶ
    const EXTRA_SECS = []; for (let v = 5; v <= 300; v += 5) EXTRA_SECS.push(v);
    const secLabel = (v) => (v >= 60 ? `${Math.floor(v / 60)}分${v % 60 ? `${v % 60}秒` : ""}` : `${v}秒`);
    const secOf = (k) => { const x = byKey(k); return x && x.sec ? x.sec : per; };
    function extraBox(kind, title, hint) {
      const nameIn = h("input", { type: "text", maxlength: "30", placeholder: kind === "guest" ? "お名前(例: 田中 太郎)" : "お名前", "aria-label": `${title}のお名前` });
      const coIn = h("input", { type: "text", maxlength: "60", placeholder: "会社・肩書き(なくてもよい)", "aria-label": `${title}の会社・肩書き` });
      const add = () => {
        const name = nameIn.value.trim();
        if (!name) { nameIn.focus(); App.toast("お名前を入れてください", "error"); return; }
        const x = { key: `${kind === "guest" ? "g" : "o"}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind, name, company: coIn.value.trim(), sec: 30 };
        extras.push(x); all.push(x); order.push(x.key); saveExtras();
        nameIn.value = ""; coIn.value = ""; draw(); nameIn.focus();
      };
      nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
      coIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
      const listBox = h("ul", { class: "pr-extra-list" });
      const box = h("div", { class: `pr-extra is-${kind}` },
        h("p", { class: "round-label" }, title, h("small", null, hint)),
        h("div", { class: "pr-extra-add" }, nameIn, coIn, App.btn("＋ 足す", add, "ghost small")),
        listBox);
      box.drawList = () => {
        const mine = extras.filter((x) => x.kind === kind);
        App.fill(listBox, mine.map((x) => {
          const sel = h("select", { class: "pr-extra-sec", "aria-label": `${x.name}さんの時間`, onchange: () => { x.sec = Number(sel.value) || 30; saveExtras(); draw(); } },
            EXTRA_SECS.map((v) => h("option", { value: String(v) }, secLabel(v))));
          sel.value = String(x.sec || 30);
          const n = order.indexOf(x.key);
          return h("li", { class: `pr-extra-item${n >= 0 ? " is-on" : ""}` },
            h("button", { type: "button", class: "pr-extra-pick", "aria-pressed": n >= 0 ? "true" : "false", onclick: () => { const i = order.indexOf(x.key); if (i >= 0) order.splice(i, 1); else order.push(x.key); draw(); } },
              h("span", { class: "pr-extra-no" }, n >= 0 ? String(n + 1) : "＋"),
              h("span", { class: "pr-extra-name" }, h("b", null, x.name), x.company ? h("small", null, x.company) : null)),
            h("label", { class: "pr-extra-time" }, h("span", null, "時間"), sel),
            h("button", { type: "button", class: "pr-extra-del", "aria-label": `${x.name}さんを消す`, onclick: () => {
              extras = extras.filter((y) => y.key !== x.key); saveExtras();
              const ai = all.findIndex((y) => y.key === x.key); if (ai >= 0) all.splice(ai, 1);
              const oi = order.indexOf(x.key); if (oi >= 0) order.splice(oi, 1);
              draw();
            } }, "×"));
        }));
      };
      return box;
    }
    const otherBox = extraBox("other", "ほかの BT-EX のメンバー", "(名簿にいない方。はじめは30秒)");
    const guestBox = extraBox("guest", "ゲスト", "(はじめは30秒)");

    function draw() {
      saveOrder();
      App.fill(grid, all.filter((x) => x.kind === "member" || x.kind === "visitor").map(card));
      otherBox.drawList(); guestBox.drawList();
      App.fill(listEl, order.length ? order.map(row) : h("li", { class: "pr-order-empty" }, "上の一覧から、話す順に押してください"));
      const sec = order.reduce((t, k) => t + secOf(k), 0);
      const odd = order.filter((k) => secOf(k) !== per).length;
      total.textContent = order.length ? `${order.length}名(${odd ? `${order.length - odd}名 × ${PER.find(([v]) => v === per)[1]} ほか` : `× ${PER.find(([v]) => v === per)[1]}`}) = 約${Math.floor(sec / 60)}分${sec % 60 ? `${sec % 60}秒` : ""}` : "";
      goBtn.textContent = order.length ? `プレゼンをはじめる(${order.length}名)` : "出る人を選んでください";
      goBtn.disabled = !order.length;
    }

    const perRow = h("div", { class: "pitch-lens round-per" }, MEET_PER.map(([v, label]) =>
      h("button", { type: "button", class: `pitch-len${v === per ? " is-on" : ""}`, onclick: (e) => {
        per = v; store.set("per", v);
        perRow.querySelectorAll(".pitch-len").forEach((b) => b.classList.toggle("is-on", b === e.currentTarget));
        draw();
      } }, label)));

    // ---------- 自分で使うタイマー(プレゼンの練習・作業)。時間のボタンは押すたびに足せる ----------
    const soloCount = {};
    const soloTotal = () => Object.entries(soloCount).reduce((t, [v, n]) => t + Number(v) * n, 0);
    const soloRow = h("div", { class: "pitch-lens round-per pr-solo-row" }, SOLO_STEPS.map(([v, label]) => {
      const b = h("button", { type: "button", class: "pitch-len", onclick: () => {
        if (soloTotal() + v > SOLO_MAX) { App.toast("タイマーは3時間までです", "error"); return; }
        soloCount[v] = (soloCount[v] || 0) + 1; drawSolo();
      } }, label, h("span", { class: "pr-solo-n", "aria-hidden": "true" }));
      b.dataset.v = String(v);
      return b;
    }));
    const soloSum = h("p", { class: "pr-solo-sum", "aria-live": "polite" });
    const soloClear = App.btn("リセット", () => { Object.keys(soloCount).forEach((k) => delete soloCount[k]); drawSolo(); }, "ghost small");
    const soloGo = h("button", { type: "button", class: "app-btn primary wide pr-solo", onclick: () => {
      const total = soloTotal();
      if (!total) return;
      App.roundRun([{ key: "t:1", kind: "timer", name: "", sec: total }], total, 0, "タイマー", { solo: true });
    } });
    const pomoBtn = h("button", { type: "button", class: "app-btn ghost wide pr-pomo", onclick: () => {
      const items = [];
      for (let r = 1; r <= POMO_ROUNDS; r++) {
        items.push({ key: `t:f${r}`, kind: "timer", name: "集中", sub: `ポモドーロ ${r} / ${POMO_ROUNDS} ・ 25分`, sec: POMODORO });
        items.push({ key: `t:b${r}`, kind: "timer", name: "休憩", sub: r < POMO_ROUNDS ? "5分 ・ 体を伸ばして、目を休めましょう" : "5分 ・ おつかれさまでした", sec: POMO_BREAK, rest: true });
      }
      App.roundRun(items, POMODORO, 5, "ポモドーロ", { solo: true });
    } }, "ポモドーロをはじめる(25分集中+5分休憩 を4回)");
    function drawSolo() {
      const total = soloTotal();
      soloRow.querySelectorAll(".pitch-len").forEach((b) => {
        const n = soloCount[b.dataset.v] || 0;
        b.classList.toggle("is-on", n > 0);
        b.querySelector(".pr-solo-n").textContent = n > 1 ? `×${n}` : "";
      });
      const parts = SOLO_STEPS.filter(([v]) => soloCount[v]).map(([v, label]) => (soloCount[v] > 1 ? `${label}×${soloCount[v]}` : label));
      App.fill(soloSum, total ? [h("b", null, `合計 ${fmtLong(total)}`), h("small", null, `(${parts.join(" + ")})`)] : h("small", null, "押すたびに時間を足せます(例: 10分を2回で20分)"));
      soloClear.hidden = !total;
      soloGo.disabled = !total;
      soloGo.textContent = total ? `タイマーをはじめる(${fmtLong(total)})` : "時間を選んでください";
    }
    const autoBox = h("input", { type: "checkbox", onchange: () => { auto = autoBox.checked; store.set("auto", auto ? "1" : "0"); } });
    autoBox.checked = auto;
    const gapSel = h("select", { class: "pr-gap", "aria-label": "次の人へ移るまでの秒数", onchange: () => { gapSec = Number(gapSel.value) || 5; store.set("gap", gapSec); } },
      GAPS.map((v) => h("option", { value: String(v) }, `${v}秒`)));
    gapSel.value = String(gapSec);

    goBtn.addEventListener("click", () => {
      const people = order.map((k) => {
        const p = personOf(k, photos);
        if (p) return p;
        const x = byKey(k);
        return x ? { key: k, kind: x.kind, name: x.name, catch: x.company, photo: "", area: "", wants: "", triggers: [], sec: x.sec || 0 } : null;
      }).filter(Boolean);
      if (!people.length) return;
      App.roundRun(people, per, auto ? gapSec : 0, ev ? ev.title : "");
    });

    const me = App.session && App.memberById(App.session.memberId);
    const myPhoto = me ? photos[me.id] : "";
    const goingN = going.size;
    App.fill(el,
      h("section", { class: "app-section pr-intro" },
        h("p", { class: "app-lead" }, "「1. 定例会のプレゼン」は、顔写真と紹介つきの大きな画面で順番に進めます(会場のスクリーンや Meet の画面共有でそのまま映せます)。「2. 自分で使うタイマー」は、プレゼンの練習やポモドーロに使えます。"),
        me ? h("div", { class: "pr-me" },
          face(myPhoto, me.name, "pr-me-face"),
          h("div", { class: "pr-me-text" },
            h("b", null, myPhoto ? "あなたの写真が入っています" : "あなたの顔写真を入れましょう"),
            h("small", null, "プレゼンの画面に大きく出ます。縦長に切り抜いて、小さくして保存します。")),
          h("div", { class: "pr-me-btns" },
            App.btn(myPhoto ? "変える" : "写真を入れる", () => App.choosePhoto(me.id, () => App.route()), "ghost small"),
            myPhoto && memo[me.id] ? App.btn("外す", () => App.removePhoto(me.id, () => App.route()), "ghost small") : null)) : null),
      // ---------- 1. 定例会のプレゼン ----------
      h("section", { class: "app-section pr-block is-meet" },
        h("div", { class: "pr-block-head" },
          h("span", { class: "pr-block-no", "aria-hidden": "true" }, "1"),
          h("div", null, h("h2", { class: "pr-block-title" }, "定例会のプレゼン"),
            h("p", { class: "pr-block-lead" }, "出る人を選んで、顔写真と紹介つきの大きな画面で順番に進めます"))),
        h("p", { class: "round-label" }, "定例会"), evSel,
        h("div", { class: "round-head" },
          h("p", { class: "round-label" }, "出る人を選ぶ(押した順が話す順番)"),
          h("div", { class: "app-btn-row pr-quick" },
            goingN ? App.btn(`出席予定の人(${goingN}名)`, () => { order = [...going]; draw(); }, "ghost small") : null,
            App.btn(`全員(${members.length}名)`, () => { order = all.filter((x) => x.kind === "member" && !absent.has(x.key)).map((x) => x.key); draw(); }, "ghost small"),
            teamSel,
            App.btn("選び直す", () => { order = []; draw(); }, "ghost small"))),
        grid,
        otherBox, guestBox,
        h("div", { class: "round-head" }, h("p", { class: "round-label" }, "話す順番"),
          h("div", { class: "app-btn-row" },
            App.btn("シャッフル", () => { order = shuffle(order); draw(); }, "ghost small"),
            App.btn("名前の順", () => { order = order.slice().sort((a, b) => byKey(a).name.localeCompare(byKey(b).name, "ja")); draw(); }, "ghost small"))),
        h("p", { class: "app-field-hint pr-drag-hint" }, "パソコンでは行をつかんで動かせます。スマホは ↑↓ で動かします。"),
        listEl, total,
        h("p", { class: "round-label" }, "1人の時間"), perRow,
        h("div", { class: "pr-auto" },
          h("label", { class: "pitch-sound" }, autoBox, h("span", null, "0秒になったら、自動で次の人へ")),
          h("label", { class: "pr-gap-row" }, h("span", null, "次の人までの間"), gapSel)),
        h("p", { class: "app-field-hint" }, "残り10秒で小さな音、0秒で鐘の音が鳴ります。キーボードでは スペース=止める・つづける、→=次へ、←=前へ、Esc=終わる。会場のスクリーンで画面いっぱいに映すときは、ブラウザの全画面(Mac は control+command+F、Windows は F11)を使ってください。"),
        h("div", { class: "pr-go-bar" }, goBtn)),
      // ---------- 2. 自分で使うタイマー ----------
      h("section", { class: "app-section pr-block is-solo", id: "present-timer" },
        h("div", { class: "pr-block-head" },
          h("span", { class: "pr-block-no", "aria-hidden": "true" }, "2"),
          h("div", null, h("h2", { class: "pr-block-title" }, "自分で使うタイマー"),
            h("p", { class: "pr-block-lead" }, "プレゼンの練習や作業に。大きな時計とメーターの画面で使えます"))),
        h("p", { class: "round-label" }, "時間(押すたびに足せます)"), soloRow,
        h("div", { class: "pr-solo-line" }, soloSum, soloClear),
        soloGo,
        h("div", { class: "pr-pomo" },
          h("p", { class: "round-label" }, "ポモドーロ"),
          h("p", { class: "app-field-hint" }, "25分集中して5分休む、を4回くり返します(自動で次へ進みます)。"),
          pomoBtn)));
    // #present/timer(タイマーのショートカットなど)で開いたときは、時間の選び方まで動かす
    if (parts && parts[0] === "timer") setTimeout(() => { const t = el.querySelector("#present-timer"); if (t && t.isConnected) t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120);
    draw();
    drawSolo();
  }

  // ---------- 進行(画面いっぱい) ----------
  // gap: 0秒のあと次の人へ移るまでの秒数(0 なら自動で移らない)
  App.roundRun = function (people, per0, gap, title, opts = {}) {
    App.timerSound.ready();
    const solo = !!opts.solo; // 自分だけのタイマー(人の紹介を出さない)
    const durOf = (p) => (p && p.sec) || per0;
    let per = durOf(people[0]);
    let idx = 0, endAt = 0, left0 = per, timer = null, warned = false, gapUntil = 0, wake = null, done = false;
    // メーターは「残り時間」: 左から1目盛りずつが残りの1秒(長い時間は数秒)。時間がたつと右から消えていく。
    // 左の5秒は赤、その次の5秒はオレンジ(残りが少ないところが一目でわかる)
    // 時間がちがう項目(ポモドーロの集中25分・休憩5分)に移るときは、メーターを作り直す
    let unit = 1, n = 0, segs = [], meterFor = 0;
    const scaleTxt = (v) => (v >= 60 ? (v % 60 ? `${Math.floor(v / 60)}:${two(v % 60)}` : `${v / 60}分`) : `${v}`);
    const meter = h("div", { class: "pr-meter", role: "progressbar", "aria-label": "残り時間", "aria-valuemin": "0" });
    const scale = h("div", { class: "pr-scale", "aria-hidden": "true" });
    const meterBox = h("div", { class: "pr-meter-box" }, meter, scale);
    function buildMeter() {
      if (meterFor === per) return;
      meterFor = per;
      unit = meterUnit(per); n = Math.round(per / unit);
      segs = Array.from({ length: n }, (_, i) => {
        const upTo = (i + 1) * unit;
        return h("i", { class: upTo <= Math.max(5, unit) ? "is-red" : upTo <= Math.max(10, unit * 2) ? "is-orange" : "" });
      });
      meter.style.setProperty("--n", String(n));
      meter.setAttribute("aria-valuemax", String(per));
      meter.replaceChildren(...segs);
      const step = labelStep(per);
      scale.replaceChildren(h("span", { style: "left:0%" }, "0"),
        ...Array.from({ length: Math.floor(per / step) }, (_, k) => (k + 1) * step).map((v, k) => h("span", { class: k % 2 ? "" : "is-minor", style: `left:${(v / per) * 100}%` }, scaleTxt(v))));
    }
    buildMeter();
    const secNum = h("b", { class: "pr-sec-num" });
    const secUnit = h("small", null, "秒");
    const secHead = h("small", { class: "pr-sec-head" }, "残り");
    const sec = h("div", { class: "pr-sec", "aria-live": "off" }, secHead, secNum, secUnit);
    const count = h("p", { class: "pr-count" });
    const slide = h("div", { class: "pr-slide" });
    const pauseBtn = h("button", { type: "button", class: "round-btn is-main" });
    const prevBtn = h("button", { type: "button", class: "round-btn", onclick: () => go(idx - 1) }, "◀ 前へ");
    const nextBtn = h("button", { type: "button", class: "round-btn", onclick: () => go(idx + 1) }, "次へ ▶");
    const endBtn = h("button", { type: "button", class: "round-btn round-end", onclick: () => finish(true) }, "終わる");
    const box = h("div", { class: `pr-run is-entering${solo ? " is-solo" : ""}`, role: "dialog", "aria-label": solo ? "タイマー" : "プレゼンの進行" },
      h("div", { class: "pr-top" }, h("p", { class: "pr-title" }, title || `${(PER.find(([v]) => v === per) || [0, ""])[1]}プレゼン`), count),
      slide,
      h("div", { class: "pr-meter-row" }, meterBox, sec),
      h("div", { class: "round-ctrl pr-ctrl" }, prevBtn, pauseBtn, nextBtn, endBtn));
    // <body> ではなく <html> のすぐ下に置く(右上の「あ」で文字を大きくしても、この画面は大きくならない。
    // 文字の大きさは <body> を拡大して変えているため)
    document.documentElement.append(box);
    // 残り秒数の欄は、いちばん幅を取る表示(「残り 8:88 秒」「次の人まで 88 秒」)に合わせて幅を決めておく。
    // はじめる・止める・次の人までの待ちで、数字やメーターの位置が動かないように
    const gapLabel = solo ? "次まで" : "次の人まで";
    // 自分だけのタイマーは、まん中に「予定」の画面と同じアナログ時計(いまの時刻)を出す。項目が変わっても同じ時計を使う
    const soloClock = solo && App.luxClock ? App.luxClock() : null;
    function fixSecWidth() {
      const keep = [secHead.textContent, secNum.textContent, box.classList.contains("is-gap")];
      sec.style.width = ""; secNum.style.minWidth = "";
      box.classList.remove("is-gap");
      secHead.textContent = "残り"; secNum.textContent = people.some((p) => durOf(p) >= 6000) ? "888:88" : people.some((p) => durOf(p) >= 600) ? "88:88" : people.some((p) => durOf(p) >= 60) ? "8:88" : "88";
      const numW = secNum.getBoundingClientRect().width;
      secNum.style.minWidth = `${Math.ceil(numW)}px`;
      const wA = sec.getBoundingClientRect().width;
      box.classList.add("is-gap");
      secHead.textContent = gapLabel; secNum.textContent = "88";
      const wB = sec.getBoundingClientRect().width;
      box.classList.toggle("is-gap", keep[2]);
      secHead.textContent = keep[0]; secNum.textContent = keep[1];
      sec.style.width = `${Math.ceil(Math.max(wA, wB)) + 2}px`;
    }
    fixSecWidth();
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fixSecWidth); } catch { /* noop */ }
    window.addEventListener("resize", fixSecWidth);
    document.documentElement.classList.add("round-open");
    // 下のページがスクロールしないように、この画面の上のホイール・指の動きを止める
    // (スクロールバーを消すとページの幅が変わって左右に動くので、overflow: hidden は使わない)
    const stopScroll = (e) => {
      const sl = e.target.closest && e.target.closest(".pr-slide");
      if (sl && sl.scrollHeight > sl.clientHeight + 1) return; // スマホの縦画面で長い紹介文を読むときは動かせる
      e.preventDefault();
    };
    box.addEventListener("wheel", stopScroll, { passive: false });
    box.addEventListener("touchmove", stopScroll, { passive: false });
    try { if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then((w) => { wake = w; }).catch(() => {}); } catch { /* noop */ }
    // ブラウザの「全画面」には切りかえない(切りかえのあいだに画面の大きさが変わって上下にブレる・
    // 閉じたあとに Safari で真っ白になる、の原因になるため)。この画面はブラウザの窓いっぱいに出し、ふわっと表示する。
    // プロジェクターなどで本当の全画面にしたいときは、ブラウザの全画面(Mac は control+command+F)を使う
    requestAnimationFrame(() => requestAnimationFrame(() => { fixSecWidth(); box.classList.remove("is-entering"); }));
    // 写真は先に読みこんでおく(切りかえたときにすぐ出るように)
    people.forEach((p) => { if (p.photo) { const im = new Image(); im.src = p.photo; } });

    function drawSlide() {
      const p = people[idx];
      const nexts = people.slice(idx + 1, idx + 4);
      // 自分だけのタイマー: まん中に大きく「集中」「休憩」などと、次にくるもの
      if (p.kind === "timer") {
        box.classList.toggle("is-rest", !!p.rest);
        App.fill(slide, h("div", { class: `pr-timer-slide${p.name ? "" : " is-plain"}` },
          soloClock ? h("div", { class: "pr-timer-clock" }, soloClock) : null,
          p.name ? h("p", { class: "pr-timer-name" }, p.name) : null,
          p.sub ? h("p", { class: "pr-timer-sub" }, p.sub) : null,
          nexts[0] ? h("p", { class: "pr-timer-next" }, `次は ${nexts[0].name}(${scaleTxt(durOf(nexts[0]))})`) : null));
        return;
      }
      App.fill(slide,
        h("div", { class: "pr-info" },
          h("p", { class: "pr-no", "aria-hidden": "true" }, two(idx + 1)),
          h("div", { class: "pr-body" },
            h("p", { class: "pr-teamname" },
              h("span", null, p.kind === "visitor" ? "ビジター" : p.kind === "guest" ? "ゲスト" : p.kind === "other" ? "BT-EX メンバー" : p.team || ""),
              p.role ? roleBadge(p.role) : null),
            nameEl(p.name, "h2", "pr-name", h("small", null, "さん")),
            p.catch ? h("p", { class: "pr-catch" }, p.catch) : null,
            h("dl", { class: "pr-rows" },
              p.area ? h("div", { class: "pr-row-area" }, h("dt", null, "活動範囲"), h("dd", null, p.area)) : null,
              p.wants ? h("div", { class: "pr-row-wants" }, h("dt", null, "つながりたい人"), h("dd", null, p.wants)) : null,
              p.triggers && p.triggers.length ? h("div", { class: "pr-row-tags" }, h("dt", null, "こんな話が出たら"), h("dd", { class: "pr-tags" }, p.triggers.map((t) => h("span", null, t)))) : null))),
        h("div", { class: "pr-side" },
          face(p.photo, p.name, "pr-photo"),
          h("div", { class: "pr-next" },
            nexts.length
              ? nexts.map((n, i) => h("p", { class: i === 0 ? "is-first" : "" }, i === 0 ? h("b", null, "次 ▶ ") : null, `${two(idx + 2 + i)} ${n.name}`))
              : h("p", { class: "is-first" }, h("b", null, "最後の方です")))));
    }
    const running = () => Boolean(timer);
    const leftNow = () => (running() ? (endAt - Date.now()) / 1000 : left0);
    function draw() {
      if (done) return;
      count.textContent = `${two(idx + 1)} / ${two(people.length)}`;
      const gap = gapUntil > Date.now();
      const left = gap ? 0 : Math.max(0, leftNow());
      const on = Math.min(n, Math.ceil(left / unit - 1e-6));
      segs.forEach((s, i) => s.classList.toggle("is-on", i < on));
      meter.setAttribute("aria-valuenow", String(Math.ceil(left)));
      const s = Math.ceil(left);
      // 「秒」は1分以上のとき見えなくするだけ(場所は残す。数字や文字が変わっても位置が動かないように)
      if (gap) { secHead.textContent = gapLabel; secNum.textContent = String(Math.ceil((gapUntil - Date.now()) / 1000)); secUnit.style.visibility = "visible"; }
      else { secHead.textContent = "残り"; secNum.textContent = fmt(s); secUnit.style.visibility = s >= 60 ? "hidden" : "visible"; }
      box.classList.toggle("is-last", !gap && left <= 10 && left > 5);
      box.classList.toggle("is-red", !gap && left <= 5 && left > 0);
      box.classList.toggle("is-end", !gap && left <= 0);
      box.classList.toggle("is-gap", gap);
      pauseBtn.textContent = running() || gap ? "Ⅱ とめる" : left0 < per && left0 > 0 ? "▶ つづける" : left <= 0 ? "▶ もう一度" : "▶ はじめる";
      prevBtn.disabled = idx === 0;
      nextBtn.textContent = idx === people.length - 1 ? "おわり ▶" : "次へ ▶";
    }
    function halt() { clearInterval(timer); timer = null; }
    function start() {
      if (left0 <= 0) left0 = per;
      endAt = Date.now() + left0 * 1000; warned = left0 <= 10;
      timer = setInterval(tick, 100); draw();
    }
    function tick() {
      if (gapUntil) {
        if (Date.now() >= gapUntil) { gapUntil = 0; halt(); go(idx + 1, true); }
        else draw();
        return;
      }
      const left = leftNow();
      if (left <= 10 && !warned) { warned = true; App.timerSound.warn(); }
      if (left <= 0) {
        halt(); left0 = 0;
        App.timerSound.end();
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch { /* noop */ }
        if (gap > 0 && idx < people.length - 1) { gapUntil = Date.now() + gap * 1000; timer = setInterval(tick, 100); }
      }
      draw();
    }
    function go(i, autoStart) {
      halt(); gapUntil = 0;
      if (i >= people.length) { finish(false); return; }
      idx = Math.max(0, i); per = durOf(people[idx]); left0 = per;
      buildMeter();
      drawSlide();
      slide.classList.remove("is-in"); void slide.offsetWidth; slide.classList.add("is-in");
      if (autoStart) start(); else draw();
    }
    pauseBtn.addEventListener("click", () => {
      if (gapUntil) { halt(); gapUntil = 0; draw(); return; }
      if (running()) { left0 = Math.max(0.1, leftNow()); halt(); draw(); } else start();
    });
    // 途中で終わるときは、この画面の中で確かめる(全画面のときにブラウザの確認の窓を出すと、
    // Safari では画面が真っ白のまま戻らないことがあるため)
    let asking = null;
    function askEnd() {
      if (asking || done) return;
      const ctrl = box.querySelector(".pr-ctrl");
      const before = [...ctrl.childNodes];
      const back = () => { asking = null; ctrl.replaceChildren(...before); pauseBtn.focus({ preventScroll: true }); };
      asking = back;
      App.fill(ctrl,
        h("p", { class: "pr-ask" }, "進行を終わりますか?"),
        h("button", { type: "button", class: "round-btn", onclick: back }, "つづける"),
        h("button", { type: "button", class: "round-btn is-main", onclick: () => { asking = null; finish(false, true); } }, "終わる"));
      ctrl.querySelector(".is-main").focus({ preventScroll: true });
    }
    function finish(early, confirmed) {
      if (early && !confirmed) { askEnd(); return; }
      halt(); gapUntil = 0; done = true;
      box.classList.remove("is-last", "is-red", "is-end", "is-gap");
      box.classList.add("is-done");
      App.fill(slide, h("div", { class: "pr-done" }, h("p", { class: "pr-name" }, "おつかれさまでした")));
      App.fill(box.querySelector(".pr-ctrl"), h("button", { type: "button", class: "round-btn is-main", onclick: closeRun }, "閉じる"));
    }
    // 閉じる: ふわっと消してから、この画面を外す(下のプレゼンの準備の画面がそのまま見える)
    let closed = false;
    function closeRun() {
      if (closed) return;
      closed = true;
      window.removeEventListener("resize", fixSecWidth);
      document.removeEventListener("keydown", onKey);
      halt();
      try { if (wake) wake.release(); } catch { /* noop */ }
      box.classList.add("is-closing");
      setTimeout(() => {
        box.remove();
        document.documentElement.classList.remove("round-open");
        if (!/^#present/.test(location.hash)) { try { history.replaceState(null, "", "#present"); } catch { /* noop */ } App.route(); }
      }, 300);
    }
    function onKey(e) {
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.key === " ") { e.preventDefault(); if (!done) pauseBtn.click(); }
      else if (e.key === "ArrowRight" && !done) go(idx + 1);
      else if (e.key === "ArrowLeft" && !done && idx > 0) go(idx - 1);
      else if (e.key === "Escape") { if (done) closeRun(); else if (asking) asking(); else finish(true); }
    }
    document.addEventListener("keydown", onKey);
    drawSlide();
    draw();
    pauseBtn.focus({ preventScroll: true });
  };
})();
