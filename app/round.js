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
  // inline: 横幅のあるスライドでは「小林 末季 こばねぇ さん」と1行にする
  function nameEl(name, tag, cls, suffix, inline) {
    const p = typeof refNameParts === "function" ? refNameParts(name) : { main: name, nick: "" };
    return p.nick
      ? h(tag, { class: `${cls}${inline ? " is-inline-nick" : ""}` }, h("span", { class: "nm-main" }, p.main), inline ? " " : h("br"), h("span", { class: "nm-nick" }, p.nick), suffix || null)
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
    async render(el, parts, params) {
      // 定例会の進行は、決まった人(山本)だけが使う。ほかの人は予定の画面へ
      if (App.canPresent && !App.canPresent()) { history.replaceState(null, "", "#events"); App.route(); return; }
      await renderSetup(el, params, parts);
    },
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
    // 定例会のスライドの内容(運営が書きかえたところ)
    const deckInfo = App.loadDeckConfig ? await App.loadDeckConfig() : { config: null, canEdit: false };
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
      // ほかの BT-EX のメンバーは、BT-EX の番号と一覧から押して選ぶ(お名前を入れて探すこともできる)
      const bx = kind === "other" && App.btexPicker ? App.btexPicker({ unit: 1, onUnit: (n) => { if (unitSel) unitSel.value = String(n); }, onChange: (v) => { if (v) add(); } }) : null;
      const add = () => {
        const v = bx ? bx.getValue() : null;
        const name = v ? v.name : nameIn.value.trim();
        if (!name) { (bx || nameIn).focus && nameIn.focus(); App.toast("お名前を選ぶか、入れてください", "error"); return; }
        if (extras.some((y) => y.kind === kind && y.name === name && (!v || y.unit === v.unit))) { App.toast(`${name}さんはもう入っています`); if (bx) bx.setUnit(v.unit); return; }
        const x = { key: `${kind === "guest" ? "g" : "o"}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind, name, company: v ? [`BT-EX${v.unit}`, coIn.value.trim()].filter(Boolean).join(" ・ ") : coIn.value.trim(), unit: v ? v.unit : 0, sec: 30 };
        extras.push(x); all.push(x); order.push(x.key); saveExtras();
        nameIn.value = ""; coIn.value = ""; if (bx) { const u = v.unit; bx.setUnit(0); bx.setUnit(u); } draw();
      };
      nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
      coIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
      const listBox = h("ul", { class: "pr-extra-list" });
      let unitSel = null;
      if (bx) {
        unitSel = h("select", { class: "pr-extra-unit", "aria-label": "BT-EX の番号", onchange: () => bx.setUnit(Number(unitSel.value)) },
          Array.from({ length: 14 }, (_, i) => i + 1).filter((n) => n !== 5).map((n) => h("option", { value: String(n) }, `BT-EX${n}`)));
        unitSel.value = "1";
      }
      const box = h("div", { class: `pr-extra is-${kind}` },
        h("p", { class: "round-label" }, title, h("small", null, hint)),
        bx ? h("details", { class: "pr-extra-pick-box" }, h("summary", null, "＋ BT-EX の番号と一覧から選んで足す"), h("div", { class: "pr-extra-bx" }, unitSel, bx))
          : h("div", { class: "pr-extra-add" }, nameIn, coIn, App.btn("＋ 足す", add, "ghost small")),
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
      const deckOn = typeof withDeck !== "undefined" && withDeck;
      goBtn.textContent = deckOn ? `定例会をはじめる(オープニングムービーから${order.length ? `・プレゼン ${order.length}名` : ""})` : order.length ? `プレゼンをはじめる(${order.length}名)` : "出る人を選んでください";
      goBtn.disabled = !deckOn && !order.length;
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

    // 定例会のスライド(オープニングムービー → 進行表の順)を前後に入れるか
    let withDeck = store.get("deck", "1") === "1";
    const deckBox = h("input", { type: "checkbox", onchange: () => { withDeck = deckBox.checked; store.set("deck", withDeck ? "1" : "0"); draw(); } });
    deckBox.checked = withDeck;
    goBtn.addEventListener("click", () => {
      const people = order.map((k) => {
        const p = personOf(k, photos);
        if (p) return p;
        const x = byKey(k);
        return x ? { key: k, kind: x.kind, name: x.name, catch: x.unit ? String(x.company || "").replace(/^BT-EX\d+( ・ )?/, "") : x.company, unit: x.unit || 0, photo: "", area: "", wants: "", triggers: [], sec: x.sec || 0 } : null;
      }).filter(Boolean);
      if (withDeck) {
        const D = App.deckData ? App.deckData(deckInfo.config) : {};
        App.roundRun(buildDeck(ev, people, photos, upcoming, deckInfo.config), per, auto ? gapSec : 0, ev ? ev.title : "BT-EX5 定例会",
          { deck: true, timing: { plan: D.timeplan || [], start: eventStartMs(ev), per, gap: auto ? gapSec : 0 } });
        return;
      }
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
        h("label", { class: "pitch-sound pr-deck-opt" }, deckBox, h("span", null, h("b", null, "定例会のスライドも入れる"), h("small", null, "オープニングムービー → はじめの挨拶 → BT-EXの理念 → … → 終わりの挨拶(定例会の進行表の順)。プレゼンは「1分プレゼンテーション」のところに入ります"))),
        deckInfo.canEdit && App.deckEditor ? h("div", { class: "app-btn-row pr-deck-edit" },
          App.btn("スライドの内容・時間の目安を編集", () => App.deckEditor(deckInfo.config, deckSteps(ev), (cfg) => { deckInfo.config = cfg; }), "ghost small")) : null,
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

  // ---------- 定例会の進行スライドを作る ----------
  // 進行表(①〜⑦の行)から区切りのスライドを作り、内容に合わせて中身を入れる:
  //   あいさつ → 代表の紹介 / 理念 → BT-EXとは・理念とビジョン / プレゼン → 出る人 / 商談 N分×M → タイマー / 最後 → おわり
  const NUMS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";
  // 定例会の開始時刻(ミリ秒)。開催日が今日でないときは null(進行を始めた時刻を使う)
  function eventStartMs(ev) {
    if (!ev || !ev.start || ev.date !== App.todayKey()) return null;
    const [y, m, d] = ev.date.split("-").map(Number);
    const [hh, mm] = ev.start.split(":").map(Number);
    return Date.UTC(y, m - 1, d, hh - 9, mm); // 日本時間
  }
  // 当日の流れ(①〜の行)
  function deckSteps(ev) {
    const agenda = String((ev && ev.agenda) || (typeof REF_SEED_AGENDA !== "undefined" ? REF_SEED_AGENDA : "")).split(/\n/).map((x) => x.trim()).filter(Boolean);
    return agenda.filter((x) => NUMS.includes(x[0])).map((x, i) => ({ no: i + 1, title: x.slice(1).trim() }));
  }
  // 「11月14日(土)」
  const mdw = (key) => { const [y, m, d] = String(key).split("-").map(Number); return y ? `${m}月${d}日(${"日月火水木金土"[new Date(y, m - 1, d).getDay()]})` : String(key); };
  function buildDeck(ev, people, photos, upcoming, cfg) {
    // 運営が編集した内容(cfg)を、元の内容(BTEX_DECK)の上に重ねる
    const D = App.deckData ? App.deckData(cfg) : (typeof BTEX_DECK !== "undefined" ? BTEX_DECK : {});
    const agenda = String((ev && ev.agenda) || (typeof REF_SEED_AGENDA !== "undefined" ? REF_SEED_AGENDA : "")).split(/\n/).map((x) => x.trim()).filter(Boolean);
    const steps = agenda.filter((x) => NUMS.includes(x[0])).map((x, i) => ({ no: i + 1, title: x.slice(1).trim() }));
    const notes = agenda.filter((x) => !NUMS.includes(x[0])).map((x) => x.replace(/^[★☆・*]\s*/, ""));
    const items = [];
    const deck = (type, extra) => items.push(Object.assign({ key: `d:${items.length}`, kind: "deck", type, name: "" }, extra));
    deck("movie", { name: "オープニングムービー", step: "オープニング" });
    deck("cover", { name: (ev && ev.title) || "BT-EX5 定例会", step: "定例会", date: ev ? `${App.fmtDateLong ? App.fmtDateLong(ev.date) : ev.date}${ev.start ? ` ${ev.start}〜${ev.end || ""}` : ""}` : "", notes });
    let pres = false, extra = false, rulesDone = false, raiseDone = false;
    // ⑤商談のあとの「このような人のお役に立てます」「それぞれの強み」。商談のタイマーは、これらを説明してから
    const extras = (label) => {
      extra = true;
      if (D.fits) deck("checks", { name: D.fits.title, step: label, items: D.fits.items });
      if (D.strengths) deck("strengths", { name: D.strengths.title, step: label, lead: "3つのコミュニティの強みを、ひとつに", groups: D.strengths.groups });
    };
    // ②理念の「主な3つの活動」のあとに、規定(一般・出席・倫理)とスケジュール
    const rulesAndSchedule = () => {
      rulesDone = true;
      const R = D.rules;
      if (R) {
        deck("section", { no: 0, name: R.title, step: "BT-EXの規定" });
        deck("rules", { name: "一般規定・出席規定", step: "BT-EXの規定", blocks: [["一般規定", R.general], ["出席規定", R.attendance]], note: R.note });
        deck("rules", { name: "倫理規定", step: "BT-EXの規定", blocks: [["倫理規定", R.ethics]], single: true });
      }
      if (D.schedule) {
        deck("schedule", { name: D.schedule.title, step: D.schedule.title, lead: D.schedule.lead, rows: D.schedule.rows, note: D.schedule.note });
        // 次回以降の日程は、予定に入っている定例会から
        const next = (upcoming || []).filter((e) => !ev || (e.id !== ev.id && (e.date + (e.start || "")) > (ev.date + (ev.start || "")))).slice(0, 4);
        if (next.length) deck("schedule", { name: D.schedule.title, step: D.schedule.title, lead: "次回以降のスケジュール", rows: next.map((e) => [mdw(e.date), e.start ? `${e.start}-${e.end || ""}` : ""]) });
      }
    };
    // ⑥LINKのビジネス実績紹介のあとに「挙手をお願いします」の2ページ(1on1・リファーラル・招待ビジター → ありがとうマイル)
    const raises = (label) => {
      raiseDone = true;
      (D.raise || []).forEach((r) => deck("raise", Object.assign({ step: label }, r, { name: r.title })));
    };
    // 見出しの後ろの時間(「15分×2」「(15分×2回)」「5分」)は、見出しの下の小さな行に分ける
    const TIME = /\s*[（(]?\s*(\d+)\s*分(?:\s*[×xX✕]\s*(\d+)\s*回?)?\s*[)）]?\s*$/;
    steps.forEach((st, i) => {
      const label = `${st.no}. ${st.title}`;
      const tm = TIME.exec(st.title);
      deck("section", { no: st.no, name: tm ? st.title.replace(TIME, "") : st.title, sub: tm ? `${tm[1]}分${tm[2] ? ` × ${tm[2]}回` : ""}` : "", step: label });
      if (i === 0 && /あいさつ|挨拶/.test(st.title) && D.leader) {
        const m = App.memberById(D.leader.memberId);
        if (m) deck("leader", { name: m.name, step: label, photo: (photos && photos[m.id]) || "", leader: D.leader });
      }
      if (/理念/.test(st.title) && D.about) {
        deck("about", { name: `${D.name || "BT-EX"}とは`, step: label, paras: D.about });
        deck("vision", { name: D.name || "BT-EX", step: label, en: D.en, philosophy: D.philosophy, vision: D.vision });
        // 一覧はカードにして並べる(layout: quad=2×2 / grid=3×3 / trio=横に3つ)
        if (D.purposes) deck("list", { name: `${D.name || "BT-EX"}の目的`, step: label, layout: "quad", lead: "BT-EX が目指す4つのこと", items: D.purposes.map((x) => ({ title: x })) });
        if (D.feature) deck("feature", { name: D.feature.title, step: label, lines: D.feature.lines });
        if (D.benefits) deck("list", { name: `${D.name || "BT-EX"}の仕組みとベネフィット`, step: label, layout: "grid", lead: "9つの仕組みが、ビジネスを加速させる", items: D.benefits.map((x) => (typeof x === "string" ? { title: x } : { title: x.head, lines: [x.text] })) });
        if (D.activities) deck("list", { name: `${D.name || "BT-EX"}の主な3つの活動`, step: label, layout: "trio", items: D.activities });
        rulesAndSchedule();
      }
      if (/プレゼン/.test(st.title) && !pres) {
        pres = true;
        people.forEach((p) => items.push(Object.assign({}, p, { step: label })));
      }
      if (/商談/.test(st.title) && !extra) extras(label);
      // 「エデュケーションコーナー 5分」のように時間だけが書いてあるときは、その時間のタイマー
      if (tm && !tm[2]) items.push({ key: `d:t${items.length}`, kind: "timer", name: st.title.replace(TIME, ""), sub: `${tm[1]}分`, sec: Number(tm[1]) * 60, step: label });
      if (tm && tm[2]) {
        const min = Number(tm[1]), times = Math.min(6, Number(tm[2]));
        const base = st.title.replace(TIME, "");
        // 商談の前に規定などのスライドが入るので、タイマーへは進行の選択からすぐ飛べるようにする
        for (let k = 1; k <= times; k++) items.push({ key: `d:t${items.length}`, kind: "timer", name: `${base} ${k}回目`, sub: `${min}分`, sec: min * 60, step: extra ? `${label}(タイマー)` : label });
      }
      if (/実績/.test(st.title) && !raiseDone) raises(label);
    });
    // 進行表にプレゼンの行がないときは、最後の区切りの前に入れる
    if (!pres && people.length) {
      const at = items.length;
      people.forEach((p, j) => items.splice(at + j, 0, Object.assign({}, p, { step: "プレゼンテーション" })));
    }
    // 進行表に商談の行がないときは、おわりの前に出す
    if (!extra) extras("BT-EXについて");
    if (!rulesDone) rulesAndSchedule();
    if (!raiseDone) raises("発表");
    deck("closing", { name: "本日もありがとうございました", step: "おわり" });
    // 表紙のあとに「本日の流れ」。どのスライドにも、流れの何番目かと流れの一覧を持たせる
    // (左上の小見出し・区切りのスライドの一覧・下の進行バーに使う)
    const stepList = steps.map((st) => { const tm = TIME.exec(st.title); return { no: st.no, title: tm ? st.title.replace(TIME, "") : st.title, sub: tm ? `${tm[1]}分${tm[2] ? ` × ${tm[2]}回` : ""}` : "" }; });
    if (stepList.length) items.splice(2, 0, { key: "d:agenda", kind: "deck", type: "agenda", name: "本日の流れ", step: "定例会" });
    let cur = 0;
    items.forEach((it) => {
      if (it.kind === "deck" && it.type === "section" && it.no) cur = it.no;
      it.stepNo = it.type === "closing" ? stepList.length + 1 : cur;
      if (it.kind === "deck") { it.steps = stepList; it.eyebrow = (stepList[cur - 1] || {}).title || ""; }
    });
    return items;
  }

  // ---------- 動かせるパネル(操作バー・タイムマネジメント) ----------
  // つまみ(⠿)をつかんで動かす。場所はこの端末に覚える(画面の大きさに対する割合)。つまみを2回押すと元の場所
  const NS_SVG = "http://www.w3.org/2000/svg";
  function gripIcon() {
    const svg = document.createElementNS(NS_SVG, "svg");
    svg.setAttribute("viewBox", "0 0 12 18"); svg.setAttribute("aria-hidden", "true");
    [[3, 3], [9, 3], [3, 9], [9, 9], [3, 15], [9, 15]].forEach(([x, y]) => {
      const c = document.createElementNS(NS_SVG, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", "1.5"); svg.append(c);
    });
    return svg;
  }
  function floatable(el, key, host) {
    if (!el) return;
    const KEY = `btex5-float-${key}`;
    // 画面の幅・高さ(スクロールバーを除く)
    // (進行の画面に縦のスクロールバーが出ているときは、その分を除く)
    const vw = () => (host && host.clientWidth) || document.documentElement.clientWidth || window.innerWidth;
    const vh = () => (host && host.clientHeight) || document.documentElement.clientHeight || window.innerHeight;
    const grip = h("button", { type: "button", class: "pr-grip", "aria-label": "つかんで動かす(2回押すと元の場所)", title: "つかんで動かす(2回押すと元の場所)" }, gripIcon());
    el.prepend(grip);
    el.classList.add("is-floatable");
    function place(fx, fy) {
      const r = el.getBoundingClientRect();
      const x = Math.max(4, Math.min(vw() - r.width - 4, fx * vw()));
      const y = Math.max(4, Math.min(vh() - r.height - 4, fy * vh()));
      el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`;
    }
    function apply() {
      let pos = null;
      try { pos = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* noop */ }
      if (pos && typeof pos.x === "number") { el.classList.add("is-floating"); place(pos.x, pos.y); }
      else { el.classList.remove("is-floating"); el.style.left = ""; el.style.top = ""; }
    }
    let drag = null;
    grip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const r = el.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grip.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.moved) { drag.moved = true; el.classList.add("is-floating", "is-dragging"); }
      const r = el.getBoundingClientRect();
      const x = Math.max(4, Math.min(vw() - r.width - 4, e.clientX - drag.dx));
      const y = Math.max(4, Math.min(vh() - r.height - 4, e.clientY - drag.dy));
      el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`;
    });
    const end = () => {
      if (!drag) return;
      el.classList.remove("is-dragging");
      if (drag.moved) {
        const r = el.getBoundingClientRect();
        try { localStorage.setItem(KEY, JSON.stringify({ x: r.left / vw(), y: r.top / vh() })); } catch { /* noop */ }
      }
      drag = null;
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    grip.addEventListener("dblclick", () => { try { localStorage.removeItem(KEY); } catch { /* noop */ } apply(); });
    // キーボード: 矢印キーで少しずつ動かす
    grip.addEventListener("keydown", (e) => {
      const d = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key];
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      const r = el.getBoundingClientRect();
      el.classList.add("is-floating");
      place((r.left + d[0]) / vw(), (r.top + d[1]) / vh());
      const r2 = el.getBoundingClientRect();
      try { localStorage.setItem(KEY, JSON.stringify({ x: r2.left / vw(), y: r2.top / vh() })); } catch { /* noop */ }
    });
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    requestAnimationFrame(apply);
    el.gripEl = grip;
    if (host) { const mo = new MutationObserver(() => { if (!host.isConnected) { window.removeEventListener("resize", onResize); mo.disconnect(); } }); mo.observe(document.documentElement, { childList: true }); }
  }

  // ---------- 2時間の定例会のタイムマネジメント ----------
  // 時間の目安(plan: 分。0 がオープニング、1〜 が流れの番号)を、その流れのスライド・プレゼン・タイマーに割りふり、
  // いま出しているものの「予定の時間帯」とくらべる: 予定より前 → 早い(緑)/ 予定の時間帯の中 → 定刻(灰)/ 過ぎている → 遅れ(赤)
  function timePanel(items, t, getIdx, host) {
    const plan = (t.plan || []).map((v) => Math.max(0, Number(v) || 0));
    const total = plan.reduce((a, b) => a + b, 0) * 60000;
    let start = t.start || Math.floor(Date.now() / 60000) * 60000;
    const lastStep = Math.max(0, plan.length - 1);
    const stepOf = (it) => Math.min(lastStep, it.stepNo || 0);
    // 項目ごとの予定の長さ(ミリ秒)
    const dur = new Array(items.length).fill(0);
    for (let k = 0; k <= lastStep; k++) {
      const idxs = items.map((it, i) => (stepOf(it) === k ? i : -1)).filter((i) => i >= 0);
      if (!idxs.length) continue;
      const want = plan[k] * 60000;
      const fixed = idxs.filter((i) => items[i].kind !== "deck");
      const fixedMs = fixed.reduce((a, i) => a + ((items[i].sec || t.per || 30) + (items[i].kind === "timer" ? 0 : t.gap || 0)) * 1000, 0);
      const decks = idxs.filter((i) => items[i].kind === "deck");
      if (fixedMs <= want) {
        fixed.forEach((i) => { dur[i] = ((items[i].sec || t.per || 30) + (items[i].kind === "timer" ? 0 : t.gap || 0)) * 1000; });
        const rest = want - fixedMs;
        if (decks.length) decks.forEach((i) => { dur[i] = rest / decks.length; });
        else if (fixed.length) dur[fixed[fixed.length - 1]] += rest;
      } else {
        fixed.forEach((i) => { dur[i] = ((items[i].sec || t.per || 30) + (items[i].kind === "timer" ? 0 : t.gap || 0)) * 1000 * (want / fixedMs); });
      }
    }
    const stepList = (items.find((it) => it.steps) || {}).steps || [];
    const offs = []; let acc = 0;
    dur.forEach((d, i) => { offs[i] = acc; acc += d; });

    const pad = (n) => String(n).padStart(2, "0");
    const jst = (ms) => new Date(ms + 9 * 3600000);
    const hm = (ms) => { const d = jst(ms); return `${d.getUTCHours()}:${pad(d.getUTCMinutes())}`; };
    const ms2 = (ms) => { const s = Math.round(Math.abs(ms) / 1000); return s >= 3600 ? `${Math.floor(s / 3600)}時間${Math.floor((s % 3600) / 60)}分${pad(s % 60)}秒` : `${Math.floor(s / 60)}分${pad(s % 60)}秒`; };
    const clock = h("p", { class: "pt-clock", "aria-live": "off" });
    const status = h("p", { class: "pt-status" });
    const statusText = h("span");
    status.append(h("i", { class: "pt-dot", "aria-hidden": "true" }), statusText);
    const now2 = h("p", { class: "pt-row" });
    const endRow = h("p", { class: "pt-row" });
    const bar = h("div", { class: "pt-bar", "aria-hidden": "true" }, h("i", { class: "pt-bar-plan" }), h("i", { class: "pt-bar-now" }));
    const startIn = h("input", { type: "time", class: "pt-start", "aria-label": "開始時刻", value: hm(start).padStart(5, "0"),
      onchange: () => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(startIn.value);
        if (!m) return;
        const d = jst(Date.now());
        start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]) - 9, Number(m[2]));
        tick();
      } });
    const toggle = h("button", { type: "button", class: "pt-min", "aria-label": "小さくする", title: "小さくする",
      onclick: () => { panel.classList.toggle("is-mini"); toggle.setAttribute("aria-label", panel.classList.contains("is-mini") ? "大きくする" : "小さくする"); } }, "－");
    const panel = h("section", { class: "pr-time", "aria-label": "タイムマネジメント" },
      h("div", { class: "pt-head" }, h("p", { class: "pt-label" }, "TIME MANAGEMENT"), toggle),
      clock, status,
      h("div", { class: "pt-more" }, now2, bar, endRow,
        h("label", { class: "pt-row pt-start-row" }, h("span", null, "開始"), startIn, h("span", null, `〜 ${Math.round(total / 60000)}分`))));
    // スマホなど狭い画面では、はじめは小さく(時刻とずれだけ)出す
    if ((document.documentElement.clientWidth || innerWidth) <= 760) { panel.classList.add("is-mini"); toggle.setAttribute("aria-label", "大きくする"); }
    host.append(panel);
    floatable(panel, "time", host);

    function tick() {
      const now = Date.now();
      const d = jst(now);
      clock.textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
      const i = Math.min(items.length - 1, Math.max(0, getIdx()));
      const ps = start + offs[i], pe = ps + dur[i];
      const lag = now < ps ? now - ps : now > pe ? now - pe : 0;
      const state = Math.abs(lag) < 10000 ? "ok" : lag > 0 ? "late" : "early";
      panel.dataset.state = state;
      statusText.textContent = state === "ok" ? "定刻どおり" : state === "late" ? `${ms2(lag)} 遅れ` : `${ms2(lag)} 早い`;
      const st = stepList.find((x) => x.no === items[i].stepNo);
      now2.replaceChildren(h("span", null, "いまの予定"), h("b", null, `${st ? `${two(st.no)} ${st.title}` : items[i].stepNo ? "おわり" : "オープニング"}  ${hm(ps)}〜${hm(pe)}`));
      endRow.replaceChildren(h("span", null, "終了予定"), h("b", null, `${hm(start + total)}`), h("span", { class: "pt-sep" }, "見込み"), h("b", { class: "pt-eta" }, hm(start + total + lag)));
      const span = total || 1;
      bar.firstChild.style.width = `${Math.max(0, Math.min(100, ((ps - start) / span) * 100))}%`;
      bar.lastChild.style.left = `${Math.max(0, Math.min(100, ((now - start) / span) * 100))}%`;
    }
    tick();
    const timer = setInterval(tick, 250);
    return { stop() { clearInterval(timer); panel.remove(); } };
  }

  // ---------- 進行(画面いっぱい) ----------
  // gap: 0秒のあと次の人へ移るまでの秒数(0 なら自動で移らない)
  App.roundRun = function (people, per0, gap, title, opts = {}) {
    App.timerSound.ready();
    const solo = !!opts.solo; // 自分だけのタイマー(人の紹介を出さない)
    const isDeck = (p) => p && p.kind === "deck";
    const isPerson = (p) => p && p.kind !== "deck" && p.kind !== "timer";
    const persons = people.filter(isPerson);
    // 定例会のスライドは時間を計らない(0)
    const durOf = (p) => (isDeck(p) ? 0 : (p && p.sec) || per0);
    let per = durOf(people[0]) || per0;
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
      if (!per || meterFor === per) return;
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
    // 定例会のスライド: 進行のどこへでも飛べる
    const jump = opts.deck ? h("select", { class: "pr-jump", "aria-label": "進行の場所へ移る", onchange: () => { const i = Number(jump.value); if (i >= 0) go(i); jump.blur(); } }) : null;
    if (jump) {
      const seen = new Set();
      people.forEach((p, i) => { if (p.step && !seen.has(p.step)) { seen.add(p.step); jump.append(h("option", { value: String(i) }, p.step)); } });
    }
    const slide = h("div", { class: "pr-slide" });
    // 定例会のスライドの下の進行バー: 流れの1〜7のどこにいるかと、ページ数
    const deckSteps = opts.deck ? ((people.find((p) => p.steps) || {}).steps || []) : [];
    const progress = opts.deck ? h("div", { class: "pd-progress", "aria-hidden": "true" }) : null;
    function drawProgress() {
      if (!progress) return;
      const p = people[idx] || {};
      App.fill(progress,
        h("ol", { class: "pd-progress-steps" }, deckSteps.map((st) => h("li", { class: st.no === p.stepNo ? "is-now" : st.no < p.stepNo ? "is-done" : "" },
          h("i"), h("span", null, st.title)))),
        h("span", { class: "pd-progress-page" }, `${two(idx + 1)} / ${two(people.length)}`));
    }
    // 下の操作バー(アプリの下のメニューと同じ形: 絵と文字のボタンを横に並べる)
    const ICONS = {
      prev: "M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z",
      next: "M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z",
      play: "M8 5v14l11-7z",
      pause: "M6 19h4V5H6zm8-14v14h4V5z",
      again: "M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z",
      end: "M6 6h12v12H6z",
      close: "M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z",
    };
    const NS = "http://www.w3.org/2000/svg";
    function setBtn(btn, icon, label) {
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(NS, "path"); path.setAttribute("d", ICONS[icon]); svg.append(path);
      btn.replaceChildren(svg, h("span", null, label));
      return btn;
    }
    const dockBtn = (icon, label, cls, onclick) => setBtn(h("button", { type: "button", class: `pr-dock-btn${cls ? ` ${cls}` : ""}`, onclick }), icon, label);
    const pauseBtn = dockBtn("play", "はじめる", "is-main");
    const prevBtn = dockBtn("prev", "戻る", "", () => go(idx - 1));
    const nextBtn = dockBtn("next", "進む", "", () => go(idx + 1));
    const endBtn = dockBtn("end", "終了", "is-end", () => finish(true));
    const box = h("div", { class: `pr-run is-entering${solo ? " is-solo" : ""}`, role: "dialog", "aria-label": solo ? "タイマー" : "プレゼンの進行" },
      h("div", { class: "pr-top" }, h("p", { class: "pr-title" }, title || `${(PER.find(([v]) => v === per) || [0, ""])[1]}プレゼン`), jump, count),
      slide,
      progress,
      h("div", { class: "pr-meter-row" }, meterBox, sec),
      h("div", { class: "pr-ctrl pr-dock", role: "toolbar", "aria-label": "進行の操作" }, prevBtn, pauseBtn, nextBtn, endBtn));
    // <body> ではなく <html> のすぐ下に置く(右上の「あ」で文字を大きくしても、この画面は大きくならない。
    // 文字の大きさは <body> を拡大して変えているため)
    document.documentElement.append(box);
    // 下の操作バーは、つまみ(⠿)をつかんで好きな場所へ動かせる
    const dock = box.querySelector(".pr-dock");
    floatable(dock, "dock", box);
    const dockGrip = dock.gripEl;
    // 定例会のスライドのときは、2時間の定例会のタイムマネジメント(動かせる)
    const timing = opts.deck && opts.timing ? timePanel(people, opts.timing, () => idx, box) : null;
    // 残り秒数の欄は、いちばん幅を取る表示(「残り 8:88 秒」「次の人まで 88 秒」)に合わせて幅を決めておく。
    // はじめる・止める・次の人までの待ちで、数字やメーターの位置が動かないように
    const gapLabel = solo ? "次まで" : "次の人まで";
    // 自分だけのタイマーは、まん中に「予定」の画面と同じアナログ時計(いまの時刻)を出す。項目が変わっても同じ時計を使う
    const soloClock = (solo || people.some((p) => p.kind === "timer")) && App.luxClock ? App.luxClock() : null;
    function fixSecWidth() {
      const keep = [secHead.textContent, secNum.textContent, box.classList.contains("is-gap")];
      sec.style.width = ""; secNum.style.minWidth = "";
      box.classList.remove("is-gap");
      secHead.textContent = "残り"; secNum.textContent = people.some((p) => durOf(p) >= 6000) ? "888:88" : people.some((p) => durOf(p) >= 600) ? "88:88" : people.some((p) => durOf(p) >= 60) ? "8:88" : "88";
      box.classList.toggle("is-long", people.some((p) => durOf(p) >= 600));
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

    // 定例会のスライド
    function deckSlide(p) {
      const L = p.leader || {};
      // 改行(\n)を <br> に
      const lines = (t) => String(t).split("\n").flatMap((x, i) => (i ? [h("br"), x] : [x]));
      // 《 》で囲んだところを強調
      const rich = (t) => String(t).split(/《|》/).map((x, i) => (i % 2 ? h("em", null, x) : x));
      // カードの文: 改行のある文は1行ずつ(行の途中では折り返さない)。
      // 「パターン1:リアル定例会⏎& オンライン定例会」のように「:」で始まる文は、続きの行を「:」のあとにそろえる
      const cardLines = (x) => {
        const t = String(x);
        if (!t.includes("\n")) return [t];
        const m = /^([^:：\n]{1,12}[:：])([\s\S]*)$/.exec(t);
        const rows = (m ? m[2] : t).split("\n").map((r) => h("span", { class: "pd-line" }, r.trim()));
        return m ? [h("span", { class: "pd-hang" }, h("span", { class: "pd-hang-l" }, m[1]), h("span", { class: "pd-hang-r" }, ...rows))] : rows;
      };
      // カードなどを順に浮かび上がらせる(--i は順番)
      const nth = (i) => ({ style: `--i:${i}` });
      // 中身のスライドの共通の形: 左上に「02 BT-EXの理念」の小見出し、題、(あれば)要点の一文、中身
      const frame = (cls, ...body) => h("div", { class: `pd pd-frame ${cls}` },
        h("header", { class: "pd-head" },
          p.eyebrow ? h("p", { class: "pd-eyebrow" }, h("span", { class: "pd-eyebrow-no" }, two(p.stepNo)), p.eyebrow) : null,
          h("h2", { class: `pd-title${String(p.name).length > 18 ? " is-long" : ""}` }, p.name),
          p.lead ? h("p", { class: "pd-lead" }, p.lead) : null),
        h("div", { class: "pd-body" }, ...body));
      // 流れの一覧(本日の流れ・区切りのスライド)。いまの所を光らせ、終わった所は控えめに
      const agendaList = (compact) => h("ol", { class: `pd-agenda${compact ? " is-compact" : ""}` }, (p.steps || []).map((st, i) =>
        h("li", { class: st.no === p.stepNo && p.type !== "agenda" ? "is-now" : st.no < p.stepNo ? "is-done" : "", ...nth(i) },
          h("span", { class: "pd-agenda-no" }, two(st.no)),
          h("span", { class: "pd-agenda-title" }, st.title),
          st.sub ? h("span", { class: "pd-agenda-sub" }, st.sub) : null)));
      if (p.type === "movie") {
        return h("div", { class: "pd pd-hero pd-movie" },
          h("p", { class: "pd-kicker" }, "BT-EX5"),
          h("p", { class: "pd-display" }, "オープニングムービー"),
          h("button", { type: "button", class: "round-btn is-main pd-play", onclick: playMovie }, "▶ もう一度流す"));
      }
      if (p.type === "cover") {
        return h("div", { class: "pd pd-hero pd-cover" },
          h("img", { class: "pd-mark", src: "../assets/bt-ex5-mark-3d-512.png", alt: "" }),
          h("p", { class: "pd-kicker" }, "BT-EX5 定例会"),
          // 「日本海側最大のマーケット 新潟⇔東京」のように空白で区切った題は、空白のところで改行する
          // 「の」のあとでだけ折り返せるようにする(入りきらないときは「日本海側最大の/マーケット」と分かれる)
          h("h2", { class: "pd-display" }, ...String(p.name).trim().split(/[\s　]+/).flatMap((x, i) => [i ? h("br") : null, ...x.replace(/の/g, "の\u0000").split("\u0000").filter(Boolean).flatMap((t, j) => (j ? [h("wbr"), t] : [t]))]).filter(Boolean)),
          h("span", { class: "pd-rule", "aria-hidden": "true" }),
          p.date ? h("p", { class: "pd-date" }, p.date) : null,
          p.notes && p.notes.length ? h("ul", { class: "pd-notes" }, p.notes.map((x) => h("li", null, x))) : null);
      }
      if (p.type === "agenda") {
        return h("div", { class: "pd pd-frame pd-agenda-slide" },
          h("header", { class: "pd-head" }, h("p", { class: "pd-eyebrow" }, "AGENDA"), h("h2", { class: "pd-title" }, p.name)),
          h("div", { class: "pd-body" }, agendaList(false)));
      }
      if (p.type === "section") {
        // 区切り: 左に大きな番号と題、右に流れの一覧(いまの所が光る)
        if (!p.no) {
          return h("div", { class: "pd pd-hero pd-subsection" },
            p.eyebrow ? h("p", { class: "pd-kicker" }, `${two(p.stepNo)}  ${p.eyebrow}`) : null,
            h("h2", { class: "pd-display" }, ...lines(p.name)),
            h("span", { class: "pd-rule", "aria-hidden": "true" }));
        }
        return h("div", { class: `pd pd-section${p.name.length > 12 ? " is-long-title" : ""}` },
          h("div", { class: "pd-section-main" },
            h("p", { class: "pd-no", "aria-hidden": "true" }, two(p.no)),
            h("h2", { class: "pd-display" }, p.name),
            p.sub ? h("p", { class: "pd-sub" }, p.sub) : null),
          p.steps && p.steps.length > 1 ? agendaList(true) : null);
      }
      if (p.type === "leader") {
        return h("div", { class: "pd pd-leader" },
          h("div", { class: "pd-leader-text" },
            p.eyebrow ? h("p", { class: "pd-eyebrow" }, h("span", { class: "pd-eyebrow-no" }, two(p.stepNo)), p.eyebrow) : null,
            h("p", { class: "pd-kicker" }, L.title || "BT-EX5 代表"),
            nameEl(p.name, "h2", "pd-title"),
            L.kana ? h("p", { class: "pd-kana" }, L.kana) : null,
            L.achievements && L.achievements.length ? h("ul", { class: "pd-badges" }, L.achievements.map((x, i) => h("li", nth(i), x))) : null,
            h("div", { class: "pd-leader-cols" },
              L.now && L.now.length ? h("div", { class: "pd-block" }, h("p", { class: "pd-h" }, "現在"), h("ul", null, L.now.map((x) => h("li", null, x)))) : null,
              L.dreams && L.dreams.length ? h("div", { class: "pd-block" }, h("p", { class: "pd-h" }, "想い・夢"), h("ul", null, L.dreams.map((x) => h("li", null, x)))) : null)),
          face(p.photo, p.name, "pr-photo pd-photo"));
      }
      if (p.type === "about") {
        return frame("pd-about", ...(p.paras || []).map((x, i) => h("p", { class: `pd-para${i ? "" : " is-first"}`, ...nth(i) }, ...lines(x))));
      }
      if (p.type === "vision") {
        return h("div", { class: "pd pd-hero pd-vision" },
          p.eyebrow ? h("p", { class: "pd-kicker" }, `${two(p.stepNo)}  ${p.eyebrow}`) : null,
          h("h2", { class: "pd-wordmark" }, p.name),
          p.en ? h("p", { class: "pd-en" }, p.en) : null,
          h("div", { class: "pd-vrow" },
            h("div", nth(0), h("p", { class: "pd-h" }, "理念"), h("p", { class: "pd-big" }, ...lines(p.philosophy || ""))),
            h("div", nth(1), h("p", { class: "pd-h" }, "ビジョン"), h("p", { class: "pd-big" }, ...lines(p.vision || "")))));
      }
      if (p.type === "feature") {
        // 「新潟 ⇔ 東京」は、2つの街を金の線でつないだ図にする
        const [head, ...rest] = p.lines || [];
        return h("div", { class: "pd pd-hero pd-feature" },
          p.eyebrow ? h("p", { class: "pd-kicker" }, `${two(p.stepNo)}  ${p.eyebrow}`) : null,
          h("p", { class: "pd-h" }, p.name),
          head ? h("h2", { class: "pd-display" }, head) : null,
          rest.map((x) => {
            const ends = String(x).split(/\s*[⇔↔]\s*/);
            return ends.length === 2
              ? h("div", { class: "pd-route", role: "img", "aria-label": x },
                h("span", { class: "pd-city" }, ends[0]), h("span", { class: "pd-route-line", "aria-hidden": "true" }), h("span", { class: "pd-city" }, ends[1]))
              : h("p", { class: "pd-big" }, x);
          }));
      }
      if (p.type === "list") {
        const layout = p.layout || "rows";
        return frame(`pd-list is-${layout}`,
          h("ol", { class: "pd-cards" }, (p.items || []).map((it, i) => h("li", Object.assign({ class: "pd-card" }, nth(i)),
            h("span", { class: "pd-card-no" }, two(i + 1)),
            h("p", { class: "pd-card-title" }, ...lines(it.title)),
            // 文は1行ずつ(行の途中では折り返さない。入りきらないときは fitDeck で文字を小さくする)
            (it.lines || []).map((x) => h("p", { class: "pd-card-text" }, ...cardLines(x)))))));
      }
      if (p.type === "checks") {
        return frame("pd-checks",
          h("ul", { class: "pd-check-items" }, (p.items || []).map((x, i) => h("li", nth(i), h("span", { class: "pd-check", "aria-hidden": "true" }), h("span", null, ...lines(x))))));
      }
      if (p.type === "raise") {
        // 挙手のお願い: 大きな手のマークと、何について発表するか
        const hand = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        hand.setAttribute("viewBox", "0 0 24 24"); hand.setAttribute("aria-hidden", "true");
        const hp = document.createElementNS("http://www.w3.org/2000/svg", "path");
        hp.setAttribute("d", "M12.5 2.5a1.5 1.5 0 0 1 1.5 1.5v6.2h.5V5a1.5 1.5 0 0 1 3 0v6.6h.4V7.6a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.3a7 7 0 0 1-5.6-2.8l-3.6-4.9a1.6 1.6 0 0 1 2.4-2.1l2.2 2.1V5a1.5 1.5 0 0 1 3 0v5.2h.5V4a1.5 1.5 0 0 1 1.5-1.5Z");
        hand.append(hp);
        return h("div", { class: "pd pd-hero pd-raise" },
          p.eyebrow ? h("p", { class: "pd-kicker" }, `${two(p.stepNo)}  ${p.eyebrow}`) : null,
          h("span", { class: "pd-raise-mark" }, hand),
          p.items && p.items.length ? h("ul", { class: "pd-raise-items" }, p.items.map((x, i) => h("li", nth(i), x))) : null,
          h("h2", { class: "pd-display" }, ...lines(p.text || "について、\n発表できる方は\n挙手をお願いします")),
          p.note ? h("p", { class: "pd-raise-note" }, ...rich(p.note)) : null);
      }
      if (p.type === "strengths") {
        return frame("pd-strengths",
          h("div", { class: "pd-groups" }, (p.groups || []).map((g, i) => h("section", Object.assign({ class: "pd-card pd-group" }, nth(i)),
            h("p", { class: "pd-card-title" }, g.name),
            h("ul", null, g.items.map((x) => h("li", null, x)))))));
      }
      if (p.type === "rules") {
        return frame(`pd-rules${p.single ? " is-single" : ""}`,
          h("div", { class: "pd-rule-cols" }, p.blocks.map(([head, rows], bi) => h("section", Object.assign({ class: "pd-card pd-rule-block" }, nth(bi)),
            p.blocks.length > 1 ? h("p", { class: "pd-card-title" }, head) : null,
            h("ol", null, rows.map((x, i) => h("li", null, h("span", { class: "pd-rule-no" }, NUMS[i]), h("span", null, ...String(x).split("\n").flatMap((t, k) => (k ? [h("br"), ...rich(t)] : rich(t)))))))))),
          p.note ? h("p", { class: "pd-note" }, `※ ${p.note}`) : null);
      }
      if (p.type === "schedule") {
        return frame("pd-schedule",
          h("div", { class: "pd-sched-cards" }, (p.rows || []).map(([a, b], i) => h("div", Object.assign({ class: "pd-card pd-sched-card" }, nth(i)),
            h("p", { class: "pd-sched-day" }, a), h("p", { class: "pd-sched-time" }, b)))),
          p.note ? h("p", { class: "pd-note is-center" }, p.note) : null);
      }
      return h("div", { class: "pd pd-hero pd-closing" },
        h("img", { class: "pd-mark", src: "../assets/bt-ex5-mark-3d-512.png", alt: "" }),
        h("h2", { class: "pd-display" }, p.name),
        h("span", { class: "pd-rule", "aria-hidden": "true" }),
        h("p", { class: "pd-kicker" }, "BT-EX5 ・ 突破から、拡張へ。"));
    }
    // 横長の画面では、スライドが枠に収まらないときだけ全体を縮めて収める(スマホなどの縦長は下へ送れる)
    const tallScreen = window.matchMedia("(max-aspect-ratio: 1/1), (max-width: 760px)");
    function fitDeck() {
      const el = slide.firstElementChild;
      if (!el || !el.classList.contains("pd")) return;
      el.style.transform = "";
      // カードの文: 1行が入りきらないときは、同じスライドのカードの文をそろって小さくする
      const texts = [...el.querySelectorAll(".pd-card-text")];
      texts.forEach((t) => { t.style.fontSize = ""; });
      // (行の左はしからカードの文の右はしまでを、使える幅とする。「パターン1:」の続きの行も同じ)
      const ratio = texts.reduce((r, t) => Math.min(r, [...t.querySelectorAll(".pd-line")].reduce((q, ln) => {
        const room = t.getBoundingClientRect().right - ln.getBoundingClientRect().left - (parseFloat(getComputedStyle(t).paddingRight) || 0);
        return ln.scrollWidth > room && room > 0 ? Math.min(q, room / ln.scrollWidth) : q;
      }, 1)), 1);
      if (ratio < 1) texts.forEach((t) => { t.style.fontSize = `${(parseFloat(getComputedStyle(t).fontSize) * ratio * 0.97).toFixed(2)}px`; });
      if (tallScreen.matches) return;
      const need = el.scrollHeight, room = slide.clientHeight;
      if (need > room && room > 0) el.style.transform = `scale(${Math.max(0.6, (room / need) * 0.97).toFixed(3)})`;
    }
    window.addEventListener("resize", fitDeck);
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitDeck); } catch { /* noop */ }
    // オープニングムービー(この画面の上に流す。終わったら次へ)
    let moviePlaying = false;
    function playMovie() {
      if (!window.BtexIntro || moviePlaying) { if (!window.BtexIntro) go(idx + 1); return; }
      moviePlaying = true;
      const at = idx;
      window.BtexIntro.open({ sound: true, zIndex: 400, onClose: () => { moviePlaying = false; if (!done && idx === at) go(at + 1); } });
    }
    function drawSlide() {
      const p = people[idx];
      const nexts = people.slice(idx + 1).filter(isPerson).slice(0, 3);
      box.classList.toggle("is-deck", isDeck(p));
      box.classList.toggle("is-timer", p.kind === "timer");
      ["movie", "cover", "agenda", "section", "leader", "about", "vision", "list", "feature", "checks", "strengths", "rules", "schedule", "raise", "closing"].forEach((t) => box.classList.toggle(`is-d-${t}`, isDeck(p) && p.type === t));
      drawProgress();
      if (isDeck(p)) { App.fill(slide, deckSlide(p)); fitDeck(); return; }
      // スライドの間は残り時間の欄が隠れていて幅を測れないので、出たときに測りなおす
      if (!sec.style.width || parseFloat(sec.style.width) < 20) fixSecWidth();
      // 自分だけのタイマー: まん中に大きく「集中」「休憩」などと、次にくるもの
      if (p.kind === "timer") {
        box.classList.toggle("is-rest", !!p.rest);
        App.fill(slide, h("div", { class: `pr-timer-slide${p.name ? "" : " is-plain"}` },
          soloClock ? h("div", { class: "pr-timer-clock" }, soloClock) : null,
          p.name ? h("p", { class: "pr-timer-name" }, p.name) : null,
          p.sub ? h("p", { class: "pr-timer-sub" }, p.sub) : null,
          // 次のタイマーの案内は、自分で使うタイマー(ポモドーロなど)のときだけ。定例会では出さない
          (() => { const nx = people[idx + 1]; return !opts.deck && nx && nx.kind === "timer" ? h("p", { class: "pr-timer-next" }, `次は ${nx.name}(${scaleTxt(durOf(nx))})`) : null; })()));
        // 時計は同じものを使い回すので、スライドを挟んでまた出したときに動かし直す
        if (soloClock && soloClock.restart) soloClock.restart();
        return;
      }
      App.fill(slide,
        h("div", { class: "pr-info" },
          h("p", { class: "pr-no", "aria-hidden": "true" }, two(persons.indexOf(p) + 1)),
          h("div", { class: "pr-body" },
            h("p", { class: "pr-teamname" },
              h("span", null, p.kind === "visitor" ? "ビジター" : p.kind === "guest" ? "ゲスト" : p.kind === "other" ? (p.unit ? `BT-EX${p.unit} メンバー` : "BT-EX メンバー") : p.team || ""),
              p.role ? roleBadge(p.role) : null),
            nameEl(p.name, "h2", "pr-name", h("small", null, "さん"), !solo),
            p.catch ? h("p", { class: "pr-catch" }, p.catch) : null,
            h("dl", { class: "pr-rows" },
              p.area ? h("div", { class: "pr-row-area" }, h("dt", null, "活動範囲"), h("dd", null, p.area)) : null,
              p.wants ? h("div", { class: "pr-row-wants" }, h("dt", null, "つながりたい人"), h("dd", null, p.wants)) : null,
              p.triggers && p.triggers.length ? h("div", { class: "pr-row-tags" }, h("dt", null, "こんな話が出たら"), h("dd", { class: "pr-tags" }, p.triggers.map((t) => h("span", null, t)))) : null))),
        h("div", { class: "pr-side" },
          face(p.photo, p.name, "pr-photo"),
          h("div", { class: "pr-next" },
            nexts.length
              ? nexts.map((n, i) => h("p", { class: i === 0 ? "is-first" : "" }, i === 0 ? h("b", null, "次 ▶ ") : null, `${two(persons.indexOf(n) + 1)} ${n.name}`))
              : h("p", { class: "is-first" }, h("b", null, "最後の方です")))));
    }
    const running = () => Boolean(timer);
    const leftNow = () => (running() ? (endAt - Date.now()) / 1000 : left0);
    function draw() {
      if (done) return;
      const cur = people[idx];
      const pi = persons.indexOf(cur);
      count.textContent = opts.deck ? (pi >= 0 ? `プレゼン ${two(pi + 1)} / ${two(persons.length)}` : "") : `${two(idx + 1)} / ${two(people.length)}`;
      if (jump) { let j = -1; jump.querySelectorAll("option").forEach((o) => { if (Number(o.value) <= idx) j = Number(o.value); }); jump.value = String(j); }
      pauseBtn.hidden = isDeck(cur);
      prevBtn.disabled = idx === 0;
      setBtn(nextBtn, "next", idx === people.length - 1 ? "おわり" : "進む");
      if (isDeck(cur)) { box.classList.remove("is-last", "is-red", "is-end", "is-gap"); return; }
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
      if (running() || gap) setBtn(pauseBtn, "pause", "とめる");
      else if (left0 < per && left0 > 0) setBtn(pauseBtn, "play", "つづける");
      else if (left <= 0) setBtn(pauseBtn, "again", "もう一度");
      else setBtn(pauseBtn, "play", "はじめる");
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
        // 自動で次へ: 次も人(またはタイマー)のときだけ。定例会のスライドへは押して進む
        if (gap > 0 && idx < people.length - 1 && !isDeck(people[idx + 1])) { gapUntil = Date.now() + gap * 1000; timer = setInterval(tick, 100); }
      }
      draw();
    }
    function go(i, autoStart) {
      halt(); gapUntil = 0;
      if (i >= people.length) { finish(false); return; }
      idx = Math.max(0, i); per = durOf(people[idx]) || per; left0 = per;
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
      App.fill(ctrl, dockGrip,
        h("p", { class: "pr-ask" }, "進行を終わりますか?"),
        dockBtn("play", "つづける", "", back),
        dockBtn("end", "終わる", "is-main", () => { asking = null; finish(false, true); }));
      ctrl.querySelector(".is-main").focus({ preventScroll: true });
    }
    function finish(early, confirmed) {
      if (early && !confirmed) { askEnd(); return; }
      halt(); gapUntil = 0; done = true;
      box.classList.remove("is-last", "is-red", "is-end", "is-gap");
      box.classList.add("is-done");
      App.fill(slide, h("div", { class: "pr-done" }, h("p", { class: "pr-name" }, "おつかれさまでした")));
      // 「おつかれさまでした」からも、最後のスライドへ戻れる
      App.fill(box.querySelector(".pr-ctrl"), dockGrip, dockBtn("prev", "戻る", "", reopen), dockBtn("close", "閉じる", "is-main", closeRun));
    }
    function reopen() {
      if (!done || closed) return;
      done = false;
      box.classList.remove("is-done");
      App.fill(box.querySelector(".pr-ctrl"), dockGrip, prevBtn, pauseBtn, nextBtn, endBtn);
      go(people.length - 1);
      prevBtn.focus({ preventScroll: true });
    }
    // 閉じる: ふわっと消してから、この画面を外す(下のプレゼンの準備の画面がそのまま見える)
    let closed = false;
    function closeRun() {
      if (closed) return;
      closed = true;
      window.removeEventListener("resize", fixSecWidth);
      if (timing) timing.stop();
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
      if (document.querySelector(".op-intro")) return; // オープニングムービーを流しているあいだはムービーの操作
      if (e.key === " ") { e.preventDefault(); if (!done) { if (isDeck(people[idx])) go(idx + 1); else pauseBtn.click(); } }
      else if (e.key === "ArrowRight" && !done) go(idx + 1);
      else if (e.key === "ArrowLeft" && done) reopen();
      else if (e.key === "ArrowLeft" && !done && idx > 0) go(idx - 1);
      else if (e.key === "Escape") { if (done) closeRun(); else if (asking) asking(); else finish(true); }
    }
    document.addEventListener("keydown", onKey);
    drawSlide();
    draw();
    pauseBtn.focus({ preventScroll: true });
    if (isDeck(people[0]) && people[0].type === "movie") { nextBtn.focus({ preventScroll: true }); playMovie(); }
  };
})();
