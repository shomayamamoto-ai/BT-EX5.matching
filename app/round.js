// ============================================
// app/round.js — プレゼン(下のメニューの「プレゼン」)
// 定例会の「プレゼンテーション」を、顔写真と紹介つきの大きな画面で順番に進める。
// ・準備(#present): 定例会を選ぶ → 出る人を押して選ぶ(押した順が話す順番)→ 並べかえ(つかんで動かす・↑↓・シャッフル)
//   → 1人の時間(30秒・1分・2分・5分。はじめは1分)・次の人までの間(1〜10秒)→「プレゼンをはじめる」
// ・進行(画面いっぱい): 番号・名前・肩書き・つながりたい人・こんな話が出たら・顔写真・次の人、
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
  // 文字が変わったときだけ書きかえる(1秒に何回も同じ文字を書くと、そのたびに画面の計算が走って重くなるため)
  const setText = (el, v) => { const t = String(v); if (el.textContent !== t) el.textContent = t; };
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
  // 小さく出す顔写真(一覧の丸・自分の写真)は、運営が用意した写真なら小さい版(thumbs/)を使う(読み込みを軽く)
  const SMALL_FACE = /^(pr-card-face|pr-row-face|pr-me-face|pd-staff-face)$/;
  // 本日の運営メンバーの役(はじめの挨拶のあとのスライド)
  // 3つ目があるのは担当が決まっている役(選べない)。本システム(スライド含む)制作は山本 捷真なので固定
  const STAFF_ROLES = [["facilitator", "ファシリテーター"], ["education", "エデュケーション"], ["system", "スライド進行"], ["breakout", "ブレイクアウトルーム"], ["builder", "本システム（スライド含む）制作", ["yamamoto"]]];
  const thumbOf = (url) => String(url).replace(/assets\/members\/([^/?#]+\.jpg)/, "assets/members/thumbs/$1");
  function face(url, name, cls) {
    return url
      ? h("img", { class: cls, src: SMALL_FACE.test(cls) ? thumbOf(url) : url, alt: "", loading: "lazy", decoding: "async",
        // 小さい版がまだないとき(あとから足した写真)は、元の写真を出す
        onerror: (e) => { if (e.target.getAttribute("src") !== url) e.target.src = url; } })
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
        key, kind: "member", memberId: id, name: m.name, kana: m.kana || "", photo: photos[id] || "",
        catch: m.company || m.category || "", team: m.team || "",
        area: areaLine(m), wants: clip(m.wants, 240), wantsRank: (m.wantsRank || []).slice(0, 5), triggers: (m.triggers || []).slice(0, 24),
        role: typeof refRoleOf === "function" ? refRoleOf(id) : null,
      };
    }
    return null;
  }

  // ---------- 準備(下のメニューの「プレゼン」) ----------
  App.views.present = {
    title: "プレゼン",
    async render(el, parts, params) {
      // 定例会の進行は、決まった人(山本・こばねぇ)だけが使う。ほかの人は予定の画面へ
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
    const members = (App.members || []).slice();
    // 定例会の出欠・顔写真・スライドの内容(運営が書きかえたところ)・エデュケーションの資料は、まとめて読みこむ(待ち時間を短く)
    const [d, photos, deckInfo, eduInfo] = await Promise.all([
      ev ? App.api("getEvent", { id: ev.id }, { quiet: true }) : null,
      App.photos(members.map((m) => m.id)),
      App.loadDeckConfig ? App.loadDeckConfig() : { config: null, canEdit: false },
      App.loadEducation ? App.loadEducation() : { info: null, canEdit: false },
    ]);
    const going = new Set(d ? d.members.filter((m) => m.rsvp === "yes" || m.attended).map((m) => `m:${m.id}`) : []);
    const absent = new Set(d ? d.members.filter((m) => m.rsvp === "no" && !m.attended).map((m) => `m:${m.id}`) : []);
    const visitors = d ? (d.visitors || []).filter((v) => v.name && ["applied", "confirmed", "attended", "joined"].includes(v.status))
      .map((v) => ({ key: `v:${v.id}`, name: v.name, company: v.company || "" })) : [];
    const all = [
      ...members.map((m) => ({ key: `m:${m.id}`, id: m.id, name: m.name, company: m.company || m.category || "", team: m.team || "", kind: "member" })),
      ...visitors.map((v) => ({ ...v, kind: "visitor" })),
    ];
    // 名簿にいないBT-EXのメンバー・ゲスト(この端末に定例会ごとに覚える)。時間は1人ずつ(はじめは1分・5秒きざみ)
    const extraKey = `extras-${ev ? ev.id : "none"}`;
    let extras = (() => { try { const s = JSON.parse(store.get(extraKey, "[]")); return Array.isArray(s) ? s.filter((x) => x && x.key && x.name) : []; } catch { return []; } })();
    const saveExtras = () => store.set(extraKey, JSON.stringify(extras));
    // 「加藤寛之(カトウヒロユキ)」のように、お名前のうしろのカッコにカタカナがあるときは、お名前とフリガナに分ける
    const splitKana = (name) => {
      const m = /^(.+?)\s*[(（]\s*([ァ-ヴー・\s　]+?)\s*[)）]\s*$/.exec(String(name || "").trim());
      return m ? { name: m[1].trim(), kana: m[2].trim() } : { name: String(name || "").trim(), kana: "" };
    };
    if (extras.some((x) => !x.kana && splitKana(x.name).kana)) {
      extras.forEach((x) => { if (!x.kana) { const k = splitKana(x.name); if (k.kana) { x.name = k.name; x.kana = k.kana; } } });
      saveExtras();
    }
    extras.forEach((x) => all.push(x));
    const byKey = (k) => all.find((x) => x.key === k);
    const saveKey = `order-${ev ? ev.id : "none"}`;
    // はじめの順番: この定例会で前に決めた順番 → 出席予定の人(名簿の順)
    let order = (() => {
      try { const s = JSON.parse(store.get(saveKey, "null")); if (Array.isArray(s)) return s.filter((k) => byKey(k)); } catch { /* noop */ }
      return [...going];
    })();
    // 1分プレゼンテーションなので、はじめは1分(前の「30秒がはじめ」の時に覚えた値は使わず、選び直した値だけ覚える)
    let per = Number(store.get("per-v2", 60)) || 60;
    if (!MEET_PER.some(([v]) => v === per)) per = 60;
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
        h("span", { class: "round-name" }, nameEl(x.name, "b"), x.kind === "visitor" ? App.chip("ビジター", "info") : x.kind === "guest" ? App.chip(`ゲスト・${secLabel(x.sec || 60)}`, "info") : x.kind === "other" ? App.chip(`BT-EX・${secLabel(x.sec || 60)}`, "mute") : null, x.company ? h("small", null, x.company) : null),
        canPhoto ? h("button", { type: "button", class: "pr-photo-btn", onclick: () => App.choosePhoto(x.id, (url) => { photos[x.id] = url; draw(); }) }, photos[x.id] ? "写真を変える" : "写真を入れる") : null,
        h("span", { class: "round-move" },
          h("button", { type: "button", "aria-label": `${x.name}さんを上へ`, disabled: i === 0 || groupRank(order[i - 1]) !== groupRank(k), onclick: () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; draw(); } }, "↑"),
          h("button", { type: "button", "aria-label": `${x.name}さんを下へ`, disabled: i === order.length - 1 || groupRank(order[i + 1]) !== groupRank(k), onclick: () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; draw(); } }, "↓"),
          h("button", { type: "button", "aria-label": `${x.name}さんを外す`, onclick: () => { order.splice(i, 1); draw(); } }, "×")));
      // パソコン: つかんで動かす
      li.addEventListener("dragstart", (e) => { dragFrom = i; li.classList.add("is-drag"); try { e.dataTransfer.setData("text/plain", k); e.dataTransfer.effectAllowed = "move"; } catch { /* noop */ } });
      li.addEventListener("dragend", () => { li.classList.remove("is-drag"); dragFrom = -1; });
      li.addEventListener("dragover", (e) => { if (dragFrom >= 0 && groupRank(order[dragFrom]) === groupRank(k)) { e.preventDefault(); li.classList.add("is-over"); } });
      li.addEventListener("dragleave", () => li.classList.remove("is-over"));
      li.addEventListener("drop", (e) => {
        e.preventDefault(); li.classList.remove("is-over");
        if (dragFrom < 0 || dragFrom === i || groupRank(order[dragFrom]) !== groupRank(k)) return;
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
    // ほかの BT-EX の方の会社の欄は「BT-EX7 ・ 会社・肩書き」。編集では番号と会社・肩書きに分けて出す
    const extraCompany = (unit, co) => [unit ? `BT-EX${unit}` : "", co].filter(Boolean).join(" ・ ");
    const extraCo = (x) => (x.kind === "other" ? String(x.company || "").replace(/^BT-EX\d+(\s*・\s*)?/, "") : String(x.company || ""));
    // 足したあとの方を編集する(お名前・会社・肩書き。ほかの BT-EX の方は番号も)
    function editExtra(x) {
      App.openSheet(x.kind === "guest" ? "ゲストを編集" : "ほかの BT-EX のメンバーを編集", (body, close) => {
        const nameIn = h("input", { type: "text", maxlength: "30", value: x.name, autocomplete: "off" });
        const kanaIn = h("input", { type: "text", maxlength: "40", value: x.kana || "", placeholder: "例: タナカ タロウ", autocomplete: "off" });
        const coIn = h("input", { type: "text", maxlength: "60", value: extraCo(x), placeholder: "例: 株式会社〇〇 代表", autocomplete: "off" });
        const unitIn = x.kind === "other" ? h("select", null, Array.from({ length: 14 }, (_, i) => i + 1).filter((n) => n !== 5).map((n) => h("option", { value: String(n) }, `BT-EX${n}`))) : null;
        if (unitIn) unitIn.value = String(x.unit || 1);
        const save = () => {
          const sp = splitKana(nameIn.value);
          const name = sp.name;
          if (!name) { nameIn.focus(); App.toast("お名前を入れてください", "error"); return; }
          const unit = unitIn ? Number(unitIn.value) || 0 : 0;
          if (extras.some((y) => y.key !== x.key && y.kind === x.kind && y.name === name && (!unitIn || y.unit === unit))) { App.toast(`${name}さんはもう入っています`, "error"); return; }
          x.name = name;
          x.kana = kanaIn.value.trim() || sp.kana;
          if (unitIn) { x.unit = unit; x.company = extraCompany(unit, coIn.value.trim()); } else x.company = coIn.value.trim();
          saveExtras(); close(); draw(); App.toast(`${name}さんを直しました`);
        };
        [nameIn, kanaIn, coIn].forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }));
        body.append(
          unitIn ? App.field("BT-EX の番号", unitIn) : "",
          App.field("お名前", nameIn),
          App.field("フリガナ(カタカナ・なくてもよい。スライドのお名前の下に出ます)", kanaIn),
          App.field("会社・肩書き(なくてもよい)", coIn),
          App.btn("保存する", save, "primary wide"));
        setTimeout(() => nameIn.focus(), 50);
      });
    }
    function extraBox(kind, title, hint) {
      const nameIn = h("input", { type: "text", maxlength: "30", placeholder: "例: 田中 太郎", autocomplete: "off" });
      const kanaIn = h("input", { type: "text", maxlength: "40", placeholder: "例: タナカ タロウ", autocomplete: "off" });
      const coIn = h("input", { type: "text", maxlength: "60", placeholder: "例: 株式会社〇〇 代表", autocomplete: "off" });
      // ほかの BT-EX のメンバーは、BT-EX の番号と一覧から押して選ぶ(お名前を入れて探すこともできる)
      // 参加する方は一覧で色が付き、もう一度押すと外れる
      const bx = kind === "other" && App.btexPicker ? App.btexPicker({
        unit: 1, onUnit: (n) => { if (unitSel) unitSel.value = String(n); drawUnits(n); }, onChange: (v) => { if (v) add(); },
        selected: () => extras.filter((y) => y.kind === "other").map((y) => ({ unit: y.unit, name: y.name })),
        onRemove: (v) => {
          const x = extras.find((y) => y.kind === "other" && y.unit === v.unit && y.name === v.name);
          if (!x) return;
          extras = extras.filter((y) => y.key !== x.key); saveExtras();
          const ai = all.findIndex((y) => y.key === x.key); if (ai >= 0) all.splice(ai, 1);
          const oi = order.indexOf(x.key); if (oi >= 0) order.splice(oi, 1);
          draw();
        },
      }) : null;
      const add = () => {
        const v = bx ? bx.getValue() : null;
        const sp = v ? { name: v.name, kana: "" } : splitKana(nameIn.value);
        const name = sp.name;
        if (!name) { (bx || nameIn).focus && nameIn.focus(); App.toast("お名前を選ぶか、入れてください", "error"); return; }
        if (extras.some((y) => y.kind === kind && y.name === name && (!v || y.unit === v.unit))) { App.toast(`${name}さんはもう入っています`); if (bx) bx.setUnit(v.unit); return; }
        const x = { key: `${kind === "guest" ? "g" : "o"}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind, name, company: v ? extraCompany(v.unit, coIn.value.trim() || ((bx.profileOf && bx.profileOf(v.unit, v.name)) || [])[1] || "") : coIn.value.trim(), kana: v ? ((bx.profileOf && bx.profileOf(v.unit, v.name)) || [])[0] || "" : kanaIn.value.trim() || sp.kana, unit: v ? v.unit : 0, sec: 60 };
        extras.push(x); all.push(x); order.push(x.key); saveExtras();
        nameIn.value = ""; kanaIn.value = ""; coIn.value = ""; if (bx) { const u = v.unit; bx.setUnit(0); bx.setUnit(u); } draw();
        if (!bx) { nameIn.focus(); App.toast(`${name}さんを足しました`); }
      };
      nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
      coIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
      kanaIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
      const listBox = h("ul", { class: "pr-extra-list" });
      let unitSel = null;
      // BT-EX の番号は、押して選ぶボタンを並べる(いまの番号に色)。select は番号を覚えておくためだけに残す
      const unitRow = bx ? h("div", { class: "pr-unit-row", role: "radiogroup", "aria-label": "BT-EX の番号" }) : null;
      function drawUnits(cur) {
        if (!unitRow) return;
        // 番号の下に人数(bt-ex.jp のメンバー一覧の人数)。最後に合計
        const COUNTS = typeof BTEX_UNIT_COUNTS !== "undefined" ? BTEX_UNIT_COUNTS : {};
        const nums = Array.from({ length: 14 }, (_, i) => i + 1).filter((n) => n !== 5);
        // 合計は BT-EX5 も入れた全ユニットの人数(2つのユニットに入っている方は1名と数える)
        const total = typeof BTEX_ALL_UNITS_TOTAL !== "undefined" ? BTEX_ALL_UNITS_TOTAL : Array.from({ length: 14 }, (_, i) => COUNTS[i + 1] || 0).reduce((a, b) => a + b, 0);
        App.fill(unitRow, ...nums.map((n) =>
          h("button", { type: "button", class: `pr-unit-chip${n === cur ? " is-on" : ""}`, role: "radio", "aria-checked": n === cur ? "true" : "false", dataset: { unit: String(n) },
            "aria-label": `BT-EX${n}(${COUNTS[n] || 0}名)`,
            onclick: () => { unitSel.value = String(n); bx.setUnit(n); drawUnits(n); } }, h("small", null, "BT-EX"), h("b", null, String(n)), h("small", { class: "pr-unit-n" }, `${COUNTS[n] || 0}名`))),
          h("p", { class: "pr-unit-total" }, h("span", null, "合計"), h("b", null, `${total}名`)));
      }
      if (bx) {
        unitSel = h("select", { class: "pr-extra-unit", hidden: true, "aria-hidden": "true", tabindex: "-1", onchange: () => { bx.setUnit(Number(unitSel.value)); drawUnits(Number(unitSel.value)); } },
          Array.from({ length: 14 }, (_, i) => i + 1).filter((n) => n !== 5).map((n) => h("option", { value: String(n) }, `BT-EX${n}`)));
        unitSel.value = "1";
        drawUnits(1);
      }
      // 見出し: 絵・題・説明・入っている人数
      const countEl = h("span", { class: "pr-extra-count" });
      const head = h("div", { class: "pr-extra-head" },
        h("span", { class: "pr-extra-ico", "aria-hidden": "true" }, App.glyph(kind === "guest" ? "visitor" : "one")),
        h("div", { class: "pr-extra-ttl" }, h("b", null, title), h("small", null, hint)),
        countEl);
      let body;
      if (bx) {
        // 大きなボタンで開く → ① 番号を押す → ② お名前を押す(押した方は金色)
        const panel = h("div", { class: "pr-extra-panel", hidden: true },
          h("p", { class: "pr-step" }, h("span", { class: "pr-step-no" }, "1"), "BT-EX の番号を押す"), unitSel, unitRow,
          h("p", { class: "pr-step" }, h("span", { class: "pr-step-no" }, "2"), "参加する方のお名前を押す", h("small", null, "押した方は金色になります。お名前で探すこともできます")), bx);
        const toggle = h("button", { type: "button", class: "pr-extra-open", "aria-expanded": "false" },
          h("span", { class: "pr-extra-open-ico", "aria-hidden": "true" }, App.glyph("plus")), h("span", null, "BT-EX のメンバーを選んで足す"),
          h("span", { class: "pr-extra-open-chev", "aria-hidden": "true" }, App.glyph("chevron")));
        toggle.addEventListener("click", () => { const open = panel.hidden; panel.hidden = !open; toggle.setAttribute("aria-expanded", open ? "true" : "false"); box.classList.toggle("is-open", open); });
        body = h("div", null, toggle, panel);
      } else {
        // ゲスト: 名前と会社をそれぞれ見出しつきの欄に、足すボタンは大きく
        body = h("div", { class: "pr-extra-add" },
          h("label", { class: "pr-extra-field" }, h("span", null, "お名前", h("em", null, "必須")), nameIn),
          h("label", { class: "pr-extra-field" }, h("span", null, "フリガナ", h("em", { class: "is-opt" }, "なくてもよい")), kanaIn),
          h("label", { class: "pr-extra-field" }, h("span", null, "会社・肩書き", h("em", { class: "is-opt" }, "なくてもよい")), coIn),
          h("button", { type: "button", class: "app-btn primary pr-extra-addbtn", onclick: add }, App.glyph("plus"), "ゲストを足す"));
      }
      const box = h("div", { class: `pr-extra is-${kind}` }, head, body, listBox);
      box.drawList = () => {
        if (bx && bx.refresh) bx.refresh();
        const mine = extras.filter((x) => x.kind === kind);
        countEl.textContent = mine.length ? `${mine.length}名` : "";
        countEl.hidden = !mine.length;
        App.fill(listBox, mine.map((x) => {
          const sel = h("select", { class: "pr-extra-sec", "aria-label": `${x.name}さんの時間`, onchange: () => { x.sec = Number(sel.value) || 60; saveExtras(); draw(); } },
            EXTRA_SECS.map((v) => h("option", { value: String(v) }, secLabel(v))));
          sel.value = String(x.sec || 60);
          const n = order.indexOf(x.key);
          return h("li", { class: `pr-extra-item${n >= 0 ? " is-on" : ""}` },
            h("button", { type: "button", class: "pr-extra-pick", "aria-pressed": n >= 0 ? "true" : "false", onclick: () => { const i = order.indexOf(x.key); if (i >= 0) order.splice(i, 1); else order.push(x.key); draw(); } },
              h("span", { class: "pr-extra-no" }, n >= 0 ? String(n + 1) : "＋"),
              h("span", { class: "pr-extra-name" }, h("b", null, x.name, x.kana ? h("span", { class: "pr-extra-kana" }, x.kana) : null), x.company ? h("small", null, x.company) : null)),
            h("label", { class: "pr-extra-time" }, h("span", null, "時間"), sel),
            h("button", { type: "button", class: "pr-extra-edit", "aria-label": `${x.name}さんを編集`, title: "編集", onclick: () => editExtra(x) }, App.glyph("post"), h("span", null, "編集")),
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
    const otherBox = extraBox("other", "ほかの BT-EX のメンバー", "BT-EX5 の名簿にいない方。1人の時間ははじめ1分(あとで変えられます)");
    const guestBox = extraBox("guest", "ゲスト", "BT-EX 以外の方。1人の時間ははじめ1分(あとで変えられます)");

    // 話す順番は必ず BT-EX5 のメンバー → ほかの BT-EX(BT-EX1 → BT-EX14 の順)→ ゲスト・ビジター。
    // それぞれの組の中では、押した順・↑↓・つかんで動かす・シャッフル・名前の順で並べかえられる
    const groupRank = (k) => { const x = byKey(k) || {}; return x.kind === "member" ? 0 : x.kind === "other" ? x.unit || 15 : 100; };
    const GROUP_NAMES = { member: "BT-EX5 のメンバー", other: "ほかの BT-EX のメンバー", guest: "ゲスト・ビジター" };
    const groupOf = (k) => { const r = groupRank(k); return r === 0 ? "member" : r < 100 ? "other" : "guest"; };
    function draw() {
      order = order.map((k, i) => [k, i]).sort((a, b) => groupRank(a[0]) - groupRank(b[0]) || a[1] - b[1]).map(([k]) => k);
      saveOrder();
      App.fill(grid, all.filter((x) => x.kind === "member" || x.kind === "visitor").map(card));
      otherBox.drawList(); guestBox.drawList();
      App.fill(listEl, order.length ? order.flatMap((k, i) => (i === 0 || groupOf(order[i - 1]) !== groupOf(k)
        ? [h("li", { class: "pr-order-group", "aria-hidden": "true" }, GROUP_NAMES[groupOf(k)]), row(k, i)] : [row(k, i)]))
        : h("li", { class: "pr-order-empty" }, "上の一覧から、話す順に押してください"));
      const sec = order.reduce((t, k) => t + secOf(k), 0);
      const odd = order.filter((k) => secOf(k) !== per).length;
      total.textContent = order.length ? `${order.length}名(${odd ? `${order.length - odd}名 × ${PER.find(([v]) => v === per)[1]} ほか` : `× ${PER.find(([v]) => v === per)[1]}`}) = 約${Math.floor(sec / 60)}分${sec % 60 ? `${sec % 60}秒` : ""}` : "";
      const deckOn = typeof withDeck !== "undefined" && withDeck;
      goBtn.textContent = deckOn ? `定例会をはじめる(オープニングムービーから${order.length ? `・プレゼン ${order.length}名` : ""})` : order.length ? `プレゼンをはじめる(${order.length}名)` : "出る人を選んでください";
      goBtn.disabled = !deckOn && !order.length;
    }

    const perRow = h("div", { class: "pitch-lens round-per" }, MEET_PER.map(([v, label]) =>
      h("button", { type: "button", class: `pitch-len${v === per ? " is-on" : ""}`, onclick: (e) => {
        per = v; store.set("per-v2", v);
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
    // 商談(ブレイクアウトルーム商談)の1回の時間と回数。はじめは 7分×4回(この端末に覚える)
    const BO0 = (App.deckData ? App.deckData(deckInfo.config).breakout : null) || { min: 7, times: 4 };
    const boMin = h("select", { class: "pr-bo-min", "aria-label": "商談の1回の時間(分)", onchange: () => store.set("bo-min", boMin.value) },
      Array.from({ length: 20 }, (_, i) => i + 1).map((v) => h("option", { value: String(v) }, `${v}分`)));
    const boTimes = h("select", { class: "pr-bo-times", "aria-label": "商談の回数", onchange: () => store.set("bo-times", boTimes.value) },
      Array.from({ length: 6 }, (_, i) => i + 1).map((v) => h("option", { value: String(v) }, `${v}回`)));
    boMin.value = String(store.get("bo-min", BO0.min) || 7);
    boTimes.value = String(store.get("bo-times", BO0.times) || 4);
    // 出席コード(定例会ごと。この端末に覚える)。終わりの挨拶の「出席コード」のスライドに大きく出す
    const codeKey = `attcode-${ev ? ev.id : "none"}`;
    const codeIn = h("input", { type: "text", class: "pr-code-in", inputmode: "numeric", maxlength: "8", placeholder: "例: 1506", autocomplete: "off", "aria-label": "出席コード",
      oninput: () => { codeIn.value = codeIn.value.replace(/[^0-9０-９]/g, "").replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)); store.set(codeKey, codeIn.value); } });
    codeIn.value = store.get(codeKey, "") || "";
    // 本日の運営メンバー(はじめの挨拶のあとのスライド)。プレゼンを使える人から、役ごとに押して選ぶ(もう一度押すと外す)。
    // 定例会ごとにこの端末に覚える(はじめて開く定例会は、前の定例会の選び方から)
    const staffKey = `staff-${ev ? ev.id : "none"}`;
    let staff = (() => {
      try { const v = JSON.parse(store.get(staffKey, "") || store.get("staff-last", "") || "null"); if (v && typeof v === "object") return v; } catch { /* noop */ }
      return {};
    })();
    const owners = (App.presentOwners ? App.presentOwners() : []).map((id) => App.memberById(id)).filter(Boolean);
    const staffBox = h("div", { class: "pr-staff" });
    function drawStaff() {
      App.fill(staffBox, STAFF_ROLES.map(([key, label, fixed]) => {
        if (fixed) {
          return h("div", { class: "pr-staff-row" },
            h("span", { class: "pr-staff-role" }, label),
            h("div", { class: "pr-staff-chips" }, fixed.map((id) => App.memberById(id)).filter(Boolean).map((m) => h("span", { class: "pr-staff-chip is-on is-fixed" }, m.name)),
              h("small", { class: "pr-staff-fixed" }, "固定")));
        }
        const sel = new Set(staff[key] || []);
        return h("div", { class: "pr-staff-row" },
          h("span", { class: "pr-staff-role" }, label),
          h("div", { class: "pr-staff-chips", role: "group", "aria-label": `${label}の担当` }, owners.map((m) =>
            h("button", { type: "button", class: `pr-staff-chip${sel.has(m.id) ? " is-on" : ""}`, "aria-pressed": sel.has(m.id) ? "true" : "false",
              onclick: () => {
                const list = (staff[key] || []).filter((x) => x !== m.id);
                if (!sel.has(m.id)) list.push(m.id);
                staff = Object.assign({}, staff, { [key]: list });
                const raw = JSON.stringify(staff);
                store.set(staffKey, raw); store.set("staff-last", raw);
                drawStaff();
              } }, sel.has(m.id) ? "✓ " : "", m.name))));
      }));
    }
    drawStaff();
    goBtn.addEventListener("click", () => {
      const people = order.map((k) => {
        const p = personOf(k, photos);
        if (p) return p;
        const x = byKey(k);
        return x ? { key: k, kind: x.kind, name: x.name, kana: x.kana || "", catch: x.unit ? String(x.company || "").replace(/^BT-EX\d+( ・ )?/, "") : x.company, unit: x.unit || 0, photo: "", area: "", wants: "", triggers: [], sec: x.sec || 0 } : null;
      }).filter(Boolean);
      if (withDeck) {
        const D = App.deckData ? App.deckData(deckInfo.config) : {};
        App.roundRun(buildDeck(ev, people, photos, upcoming, deckInfo.config, { edu: eduInfo.info, bo: { min: Number(boMin.value) || 7, times: Number(boTimes.value) || 4 }, code: codeIn.value, staff }), per, auto ? gapSec : 0, ev ? ev.title : "BT-EX5 定例会",
          { deck: true, timing: { plan: eventPlan(ev, D.timeplan), start: eventStartMs(ev), per, gap: auto ? gapSec : 0 } });
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
            // シャッフルは BT-EX5 のメンバーだけ(ほかの BT-EX の方は BT-EX1 → 14 の順、ゲスト・ビジターは最後のまま)
            App.btn("シャッフル", () => {
              const isMember = (k) => (byKey(k) || {}).kind === "member";
              const mixed = shuffle(order.filter(isMember));
              order = order.map((k) => (isMember(k) ? mixed.shift() : k));
              draw();
            }, "ghost small"),
            App.btn("名前の順", () => { order = order.slice().sort((a, b) => byKey(a).name.localeCompare(byKey(b).name, "ja")); draw(); }, "ghost small"))),
        h("p", { class: "app-field-hint pr-drag-hint" }, "順番は必ず BT-EX5 のメンバー → ほかの BT-EX(BT-EX1 から 14 の順)→ ゲストです。それぞれの中で、パソコンでは行をつかんで、スマホは ↑↓ で動かせます。"),
        listEl, total,
        h("p", { class: "round-label" }, "1人の時間"), perRow,
        h("div", { class: "pr-auto" },
          h("label", { class: "pitch-sound" }, autoBox, h("span", null, "0秒になったら、自動で次の人へ")),
          h("label", { class: "pr-gap-row" }, h("span", null, "次の人までの間"), gapSel)),
        h("label", { class: "pitch-sound pr-deck-opt" }, deckBox, h("span", null, h("b", null, "定例会のスライドも入れる"), h("small", null, "オープニングムービー → はじめの挨拶 → BT-EXの理念 → … → 終わりの挨拶(定例会の進行表の順)。プレゼンは「1分プレゼンテーション」のところに入ります"))),
        h("div", { class: "pr-deck-more" },
          h("label", { class: "pr-deck-field" }, h("span", null, "ブレイクアウトルーム商談(テーブル商談)"), h("span", { class: "pr-bo" }, boMin, h("b", null, "×"), boTimes)),
          h("label", { class: "pr-deck-field" }, h("span", null, "出席コード(4桁)"), codeIn, h("small", null, "終わりの挨拶の「出席コード」のスライドに大きく出ます")),
          h("div", { class: "pr-deck-field is-staff" }, h("span", null, "本日の運営メンバー"), h("small", null, "はじめの挨拶のあとのスライドに出ます。役ごとに、担当の方を押して選んでください(もう一度押すと外します。複数選べます)"), staffBox)),
        h("div", { class: "app-btn-row pr-deck-edit" },
          deckInfo.canEdit && App.deckEditor ? App.btn("スライドの内容・時間の目安を編集", () => App.deckEditor(deckInfo.config, deckSteps(ev), (cfg) => { deckInfo.config = cfg; }), "ghost small") : null,
          eduInfo.canEdit && App.eduEditor ? App.btn(`エデュケーションの資料を入れかえる(いま: ${(eduInfo.info && eduInfo.info.title) || ((App.deckData ? App.deckData(deckInfo.config) : {}).education || {}).title || "なし"})`, () => App.eduEditor(eduInfo.info, (info) => { eduInfo.info = info; App.route(); }), "ghost small") : null,
          // アンケートの結果は、いちばん目立つボタンに(グラフの絵・新しい回答の数つき)
          App.surveyResults ? (() => {
            const b = h("button", { type: "button", class: "pr-survey-btn", onclick: () => App.surveyResults() },
            h("span", { class: "pr-survey-ic", "aria-hidden": "true" }),
            h("span", { class: "pr-survey-txt" }, h("b", null, "アンケートの結果を見る"), h("small", null, "集計・グラフ・改善点のまとめ")),
            h("span", { class: "pr-survey-go", "aria-hidden": "true" }, "›"));
            // 棒グラフの絵(線のアイコン)
            b.querySelector(".pr-survey-ic").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M7 16v-5"/><path d="M12 16V6"/><path d="M17 16v-8"/></svg>';
            return b;
          })() : null),
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
  // 時間の目安を、登録した定例会の時間(開始〜終了)に合わせる。
  // 長さがちがう回(例: 90分)は、各項目の分を同じ割合でのばす・ちぢめる(合計は定例会の長さにそろえる)
  function eventPlan(ev, plan) {
    const base = (plan || []).map((v) => Math.max(0, Number(v) || 0));
    const total = base.reduce((a, b) => a + b, 0);
    const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const a = toMin(ev && ev.start), b = toMin(ev && ev.end);
    if (a === null || b === null || !total) return base;
    const len = b > a ? b - a : b + 1440 - a;
    if (len === total || len < 10) return base;
    const out = base.map((v) => Math.floor((v * len) / total));
    let rest = len - out.reduce((x, y) => x + y, 0);
    base.map((v, i) => [((v * len) / total) % 1, i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (rest > 0 && base[i]) { out[i]++; rest--; } });
    return out;
  }
  // 当日の流れ(①〜の行)
  function deckSteps(ev) {
    const agenda = String((ev && ev.agenda) || (typeof REF_SEED_AGENDA !== "undefined" ? REF_SEED_AGENDA : "")).split(/\n/).map((x) => x.trim()).filter(Boolean);
    return agenda.filter((x) => NUMS.includes(x[0])).map((x, i) => ({ no: i + 1, title: x.slice(1).trim() }));
  }
  // 「11月14日(土)」
  const mdw = (key) => { const [y, m, d] = String(key).split("-").map(Number); return y ? `${m}月${d}日(${"日月火水木金土"[new Date(y, m - 1, d).getDay()]})` : String(key); };
  // more: { bo: {min, times}(商談の時間と回数), code(出席コード) }
  function buildDeck(ev, people, photos, upcoming, cfg, more) {
    more = more || {};
    // 運営が編集した内容(cfg)を、元の内容(BTEX_DECK)の上に重ねる
    const D = App.deckData ? App.deckData(cfg) : (typeof BTEX_DECK !== "undefined" ? BTEX_DECK : {});
    const agenda = String((ev && ev.agenda) || (typeof REF_SEED_AGENDA !== "undefined" ? REF_SEED_AGENDA : "")).split(/\n/).map((x) => x.trim()).filter(Boolean);
    const steps = agenda.filter((x) => NUMS.includes(x[0])).map((x, i) => ({ no: i + 1, title: x.slice(1).trim() }));
    const notes = agenda.filter((x) => !NUMS.includes(x[0])).map((x) => x.replace(/^[★☆・*]\s*/, ""));
    const items = [];
    const deck = (type, extra) => items.push(Object.assign({ key: `d:${items.length}`, kind: "deck", type, name: "" }, extra));
    // BT-EX でよく使う言葉: 進行表の「用語説明」のところ(はじめの挨拶のあと)。進行表にないときは、いちばんはじめ
    const hasGloss = D.glossary && (D.glossary.items || []).length;
    let glossDone = false;
    const glossary = (label) => { glossDone = true; deck("glossary", { name: D.glossary.title, step: label, items: D.glossary.items }); };
    deck("movie", { name: "オープニングムービー", step: "オープニング" });
    deck("cover", { name: (ev && ev.title) || "BT-EX5 定例会", step: "定例会", date: ev ? `${App.fmtDateLong ? App.fmtDateLong(ev.date) : ev.date}${ev.start ? ` ${ev.start}〜${ev.end || ""}` : ""}` : "", notes });
    let pres = false, extra = false, rulesDone = false, raiseDone = false;
    // 「このような人のお役に立てます」「3つの強み」「それぞれの強み」は、②理念のスケジュールのあとに
    const extras = (label) => {
      extra = true;
      if (D.fits) deck("checks", { name: D.fits.title, step: label, items: D.fits.items });
      if (D.strengths) {
        deck("venn", { name: "3つのコミュニティの強みを、ひとつに", step: label, groups: D.strengths.groups, center: D.name || "BT-EX" });
        deck("strengths", { name: D.strengths.title, step: label, groups: D.strengths.groups });
      }
    };
    // ②理念の「主な3つの活動」のあとに、規定(一般・出席・倫理)とスケジュール
    const rulesAndSchedule = () => {
      rulesDone = true;
      const R = D.rules;
      if (R) {
        deck("section", { no: 0, name: R.title, step: "BT-EXの規定" });
        if (R.kpis && R.kpis.length) deck("kpis", { name: "BT-EX の約束", step: "BT-EXの規定", items: R.kpis });
        // 規定は1つずつのスライドに、絵・番号・見出しつきのカードで出す(文はそのまま)
        const H = R.heads || {}, I = R.icons || {};
        deck("rules", { name: "一般規定", step: "BT-EXの規定", rows: R.general, heads: H.general, icons: I.general, cols: 3, carousel: true });
        deck("rules", { name: "出席規定", step: "BT-EXの規定", rows: R.attendance, heads: H.attendance, icons: I.attendance, cols: 2, note: R.note, carousel: true });
        deck("rules", { name: "倫理規定", step: "BT-EXの規定", rows: R.ethics, heads: H.ethics, icons: I.ethics, cols: 3, carousel: true });
      }
      if (D.schedule) {
        deck("schedule", { name: D.schedule.title, step: D.schedule.title, lead: D.schedule.lead, rows: D.schedule.rows, note: D.schedule.note });
        // 次回以降の日程は、予定に入っている定例会から
        const next = (upcoming || []).filter((e) => !ev || (e.id !== ev.id && (e.date + (e.start || "")) > (ev.date + (ev.start || "")))).slice(0, 4);
        if (next.length) deck("schedule", { name: D.schedule.title, step: D.schedule.title, lead: "次回以降のスケジュール", rows: next.map((e) => [mdw(e.date), e.start ? `${e.start}-${e.end || ""}` : ""]) });
      }
    };
    // ⑥LINKのビジネス実績紹介: 入会申し込みフォーム → 挙手のお願い(1on1・リファーラル・招待ビジター → ありがとうマイル → LINK内での実績紹介)
    const raises = (label) => {
      raiseDone = true;
      (D.raise || []).forEach((r) => deck("raise", Object.assign({ step: label }, r, { name: r.title })));
    };
    // 見出しの後ろの時間(「15分×2」「(15分×2回)」「5分」)は、見出しの下の小さな行に分ける
    const TIME = /\s*[（(]?\s*(\d+)\s*分(?:\s*[×xX✕]\s*(\d+)\s*回?)?\s*[)）]?\s*$/;
    // 商談の時間と回数: プレゼンをはじめる前に選んだ値(なければ進行表の値)
    // エデュケーションコーナーの資料: 運営が入れた資料(サーバー)→ 元の資料(BTEX_DECK.education)
    const material = more.edu && more.edu.pages
      ? { title: more.edu.title, pages: Array.from({ length: more.edu.pages }, (_, i) => ({ rev: more.edu.rev, i })) }
      : D.education && (D.education.pages || []).length ? { title: D.education.title, pages: D.education.pages.map((u) => ({ url: `../${u}` })) } : null;
    const boOf = (st, tm) => (more.bo && /商談/.test(st.title) && tm && tm[2]
      ? [more.bo.min, more.bo.times] : [Number(tm[1]), Math.min(6, Number(tm[2] || 1))]);
    const subOf = (st, tm) => { if (!tm) return ""; if (!tm[2]) return `${tm[1]}分`; const [m, t] = boOf(st, tm); return `${m}分 × ${t}回`; };
    steps.forEach((st, i) => {
      const label = `${st.no}. ${st.title}`;
      const tm = TIME.exec(st.title);
      deck("section", { no: st.no, name: tm ? st.title.replace(TIME, "") : st.title, sub: subOf(st, tm), step: label });
      // はじめの挨拶の次: 本日の運営メンバー(開始前に選んだ方)
      if (i === 0 && /あいさつ|挨拶/.test(st.title)) {
        const st0 = more.staff || {};
        deck("staff", { name: "本日の運営メンバー", step: label, roles: STAFF_ROLES.map(([key, role, fixed]) => ({ role, fixed: !!fixed, people: (fixed || st0[key] || []).map((id) => App.memberById(id)).filter(Boolean).map((m) => ({ name: m.name, photo: (photos && photos[m.id]) || "" })) })) });
      }
      if (i === 0 && /あいさつ|挨拶/.test(st.title) && D.leader) {
        const m = App.memberById(D.leader.memberId);
        if (m) deck("leader", { name: m.name, step: label, photo: (photos && photos[m.id]) || "", leader: D.leader });
      }
      if (/用語/.test(st.title) && hasGloss && !glossDone) glossary(label);
      if (/理念/.test(st.title) && D.about) {
        deck("about", { name: `${D.name || "BT-EX"}とは`, step: label, paras: D.about, formula: D.formula, center: D.name || "BT-EX" });
        deck("vision", { name: D.name || "BT-EX", step: label, en: D.en, philosophy: D.philosophy, vision: D.vision });
        // 一覧はカードにして並べる(layout: quad=2×2 / grid=3×3 / trio=横に3つ)
        const withIcon = (arr, icons) => arr.map((x, i) => Object.assign(x, { icon: (icons || [])[i] || "" }));
        if (D.purposes) deck("list", { name: `${D.name || "BT-EX"}の目的`, step: label, layout: "quad", lead: "BT-EX が目指す4つのこと", items: withIcon(D.purposes.map((x) => ({ title: x })), D.purposeIcons) });
        if (D.feature) deck("feature", { name: D.feature.title, step: label, lines: D.feature.lines });
        if (D.benefits) deck("list", { name: `${D.name || "BT-EX"}の仕組みとベネフィット`, step: label, layout: "grid", carousel: true, lead: "9つの仕組みが、ビジネスを加速させる", items: withIcon(D.benefits.map((x) => (typeof x === "string" ? { title: x } : { title: x.head, lines: [x.text] })), D.benefitIcons) });
        if (D.activities) deck("list", { name: `${D.name || "BT-EX"}の主な3つの活動`, step: label, layout: "trio", items: withIcon(D.activities.map((x) => Object.assign({}, x)), D.activityIcons) });
        rulesAndSchedule();
        if (!extra) extras(label);
      }
      if (/プレゼン/.test(st.title) && !pres) {
        pres = true;
        people.forEach((p) => items.push(Object.assign({}, p, { step: label })));
      }
      // 商談: 区切りのスライドで「休憩しませんか?」を出す
      if (/商談/.test(st.title)) { const sec = items[items.length - 1]; if (sec && sec.type === "section") sec.breakAsk = true; }
      // 「エデュケーションコーナー 5分」のように時間だけが書いてあるときは、その時間のタイマー
      if (tm && !tm[2]) items.push({ key: `d:t${items.length}`, kind: "timer", name: st.title.replace(TIME, ""), sub: `${tm[1]}分`, sec: Number(tm[1]) * 60, step: label, material: /エデュケーション/.test(st.title) ? material : null });
      if (tm && tm[2]) {
        const [min, times] = boOf(st, tm);
        const base = st.title.replace(TIME, "");
        for (let k = 1; k <= times; k++) items.push({ key: `d:t${items.length}`, kind: "timer", name: `${base} ${k}回目`, sub: `${min}分`, sec: min * 60, step: label });
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
    if (hasGloss && !glossDone) { glossary("用語説明"); items.unshift(items.pop()); }
    // 終わりの挨拶: 入会への3ステップ → アンケート(BT-EX メンバー / ビジター) → 出席コード → おわり
    const endLabel = steps.length ? `${steps[steps.length - 1].no}. ${steps[steps.length - 1].title}` : "おわり";
    if (D.joinSteps) deck("joinsteps", { name: D.joinSteps.title, step: endLabel, cards: D.joinSteps.steps || [], note: D.joinSteps.note || "", noteSpan: D.joinSteps.noteSpan || 2 });
    if (D.survey) {
      const url = (k) => { try { return new URL(`../survey/?k=${k}${ev ? `&e=${encodeURIComponent(ev.id)}` : ""}`, location.href).href; } catch { return ""; } };
      deck("survey", { name: D.survey.title, step: endLabel, lead: D.survey.lead, urls: [["BT-EX メンバーの方", url("member")], ["ビジターの方", url("visitor")]] });
    }
    if (D.attend) deck("attend", Object.assign({ step: endLabel }, D.attend, { name: D.attend.title, msg: D.attend.lead, lead: "", code: more.code || "" }));
    deck("closing", { name: "本日もありがとうございました", step: "おわり" });
    // 表紙のあとに「本日の流れ」。どのスライドにも、流れの何番目かと流れの一覧を持たせる
    // (左上の小見出し・区切りのスライドの一覧・下の進行バーに使う)
    const stepList = steps.map((st) => { const tm = TIME.exec(st.title); return { no: st.no, title: tm ? st.title.replace(TIME, "") : st.title, sub: subOf(st, tm) }; });
    const coverAt = items.findIndex((x) => x.type === "cover");
    if (stepList.length) items.splice(coverAt + 1, 0, { key: "d:agenda", kind: "deck", type: "agenda", name: "本日の流れ", step: "定例会", plan: eventPlan(ev, D.timeplan), start: (ev && ev.start) || "", end: (ev && ev.end) || "" });
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
  // ---------- アイコン(プレゼンの画面で使う線のアイコン) ----------
  // Apple の SF Symbols・Material Symbols と同じ考え方でそろえる:
  //   24×24 の枠・線の太さ 1.75・線の端と角は丸く。
  //   「sec」は2つ目の層(うすい塗り。hierarchical)で、形に奥行きを出す
  const LINE_ICONS = {
    prev: { d: ["M14.5 5.5 8 12l6.5 6.5"] },
    next: { d: ["M9.5 5.5 16 12l-6.5 6.5"] },
    play: { d: ["M8.2 5.3v13.4a.9.9 0 0 0 1.37.77l10.7-6.7a.9.9 0 0 0 0-1.54L9.57 4.53a.9.9 0 0 0-1.37.77Z"], sec: ["M8.2 5.3v13.4a.9.9 0 0 0 1.37.77l10.7-6.7a.9.9 0 0 0 0-1.54L9.57 4.53a.9.9 0 0 0-1.37.77Z"] },
    pause: { d: ["M8.25 5.5v13", "M15.75 5.5v13"], heavy: true },
    again: { d: ["M4.75 12a7.25 7.25 0 1 0 2.2-5.2", "M4.6 4.4v3.9h3.9"] },
    end: { d: ["M7.6 6h8.8A1.6 1.6 0 0 1 18 7.6v8.8a1.6 1.6 0 0 1-1.6 1.6H7.6A1.6 1.6 0 0 1 6 16.4V7.6A1.6 1.6 0 0 1 7.6 6Z"], sec: ["M7.6 6h8.8A1.6 1.6 0 0 1 18 7.6v8.8a1.6 1.6 0 0 1-1.6 1.6H7.6A1.6 1.6 0 0 1 6 16.4V7.6A1.6 1.6 0 0 1 7.6 6Z"] },
    close: { d: ["M6.5 6.5l11 11", "M17.5 6.5l-11 11"] },
    check: { d: ["M7.9 12.3l2.75 2.75 5.45-5.6"], ring: true },
    ok: { d: ["M7.9 12.3l2.75 2.75 5.45-5.6"], ring: true },
    late: { d: ["M12 7.6v5.1", "M12 16.3v.1"], ring: true },
    early: { d: ["M4.5 16.5l5-5 3.2 3.2 6.3-6.3", "M14.4 8.4h4.6V13"] },
    collapse: { d: ["M7 14.5 12 9.5l5 5"] },
    // スライドのカードの絵(インフォグラフィック用)
    growth: { d: ["M4.75 19.25h14.5", "M6.25 15.5l4-4 3 3 5.25-5.75", "M14.75 8.75h3.75v3.75"] },
    link: { d: ["M10.25 13.75a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1", "M13.75 10.25a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1"] },
    users: { d: ["M9 5.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z", "M4 18.75v-.5a5 5 0 0 1 10 0v.5", "M15.5 5.6a2.5 2.5 0 1 1 0 4.8", "M17 13.3a4.5 4.5 0 0 1 3 4.2v1.25"], sec: ["M9 5.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z"] },
    widen: { d: ["M4.75 9.25v-4.5h4.5", "M19.25 9.25v-4.5h-4.5", "M4.75 14.75v4.5h4.5", "M19.25 14.75v4.5h-4.5", "M4.75 4.75l4.5 4.5", "M19.25 4.75l-4.5 4.5", "M4.75 19.25l4.5-4.5", "M19.25 19.25l-4.5-4.5"] },
    target: { d: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z", "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z", "M12 11.4v1.2"], sec: ["M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"] },
    mic: { d: ["M12 3.75a2.75 2.75 0 0 0-2.75 2.75v5a2.75 2.75 0 0 0 5.5 0v-5A2.75 2.75 0 0 0 12 3.75Z", "M6.5 11a5.5 5.5 0 0 0 11 0", "M12 16.5v3.75", "M9 20.25h6"], sec: ["M12 3.75a2.75 2.75 0 0 0-2.75 2.75v5a2.75 2.75 0 0 0 5.5 0v-5A2.75 2.75 0 0 0 12 3.75Z"] },
    globe: { d: ["M12 3.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Z", "M3.75 12h16.5", "M12 3.75c2.3 2.3 3.4 5 3.4 8.25s-1.1 5.95-3.4 8.25", "M12 3.75c-2.3 2.3-3.4 5-3.4 8.25s1.1 5.95 3.4 8.25"] },
    school: { d: ["M2.75 9.25 12 5l9.25 4.25L12 13.5Z", "M6.5 11.2v4.3c1.6 1.5 3.4 2.25 5.5 2.25s3.9-.75 5.5-2.25v-4.3", "M21.25 9.25v5"], sec: ["M2.75 9.25 12 5l9.25 4.25L12 13.5Z"] },
    network: { d: ["M12 4.25a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z", "M5.5 15.75a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z", "M18.5 15.75a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z", "M11 8.1l-4.5 7.8", "M13 8.1l4.5 7.8", "M7.5 17.75h9"] },
    heart: { d: ["M12 19.25s-7-4.2-7-9.2A3.8 3.8 0 0 1 8.8 6.25c1.4 0 2.5.7 3.2 1.8.7-1.1 1.8-1.8 3.2-1.8A3.8 3.8 0 0 1 19 10.05c0 5-7 9.2-7 9.2Z"], sec: ["M12 19.25s-7-4.2-7-9.2A3.8 3.8 0 0 1 8.8 6.25c1.4 0 2.5.7 3.2 1.8.7-1.1 1.8-1.8 3.2-1.8A3.8 3.8 0 0 1 19 10.05c0 5-7 9.2-7 9.2Z"] },
    cart: { d: ["M3.75 4.75h2l2 10.5h10l1.75-7.5H6.6", "M9 19.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z", "M17 19.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"] },
    shield: { d: ["M12 3.75 5.25 6.5v5c0 4.2 2.9 7.6 6.75 8.75 3.85-1.15 6.75-4.55 6.75-8.75v-5Z", "M9.2 12.1l2 2 3.6-3.7"], sec: ["M12 3.75 5.25 6.5v5c0 4.2 2.9 7.6 6.75 8.75 3.85-1.15 6.75-4.55 6.75-8.75v-5Z"] },
    calendar: { d: ["M6.75 5.25h10.5a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2V7.25a2 2 0 0 1 2-2Z", "M4.75 9.75h14.5", "M8.5 3.5v3.5", "M15.5 3.5v3.5", "M9 14h.01", "M12 14h.01", "M15 14h.01"], sec: ["M6.75 5.25h10.5a2 2 0 0 1 2 2v2.5H4.75v-2.5a2 2 0 0 1 2-2Z"] },
    chat: { d: ["M5.75 4.75h12.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.25 3.5v-3.5h-1a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z", "M8.5 9.25h7", "M8.5 12.25h4.5"], sec: ["M5.75 4.75h12.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.25 3.5v-3.5h-1a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"] },
    clock: { d: ["M12 3.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Z", "M12 7.75V12l2.75 1.75"] },
    spark: { d: ["M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9L12 20.5l-1.9-6.6L3.5 12l6.6-1.9Z"], sec: ["M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9L12 20.5l-1.9-6.6L3.5 12l6.6-1.9Z"] },
    expand: { d: ["M7 9.5l5 5 5-5"] },
    pin: { d: ["M12 20.75s-6.25-5.55-6.25-10.75a6.25 6.25 0 0 1 12.5 0c0 5.2-6.25 10.75-6.25 10.75Z", "M12 7.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"], sec: ["M12 20.75s-6.25-5.55-6.25-10.75a6.25 6.25 0 0 1 12.5 0c0 5.2-6.25 10.75-6.25 10.75Z"] },
    idcard: { d: ["M5.75 5.75h12.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Z", "M8.75 9.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z", "M6.5 15.25c.5-1.1 1.3-1.6 2.25-1.6s1.75.5 2.25 1.6", "M13.5 10h4", "M13.5 13h3"], sec: ["M5.75 5.75h12.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Z"] },
    doc: { d: ["M7 3.75h6.5l4.5 4.5v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z", "M13.5 3.75v4.5H18", "M8.5 12.5h7", "M8.5 15.5h5"], sec: ["M7 3.75h6.5l4.5 4.5v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z"] },
    ban: { d: ["M5.6 5.6l12.8 12.8"], ring: true },
    bank: { d: ["M3.75 9.25 12 4.75l8.25 4.5Z", "M6 10v6.75", "M10 10v6.75", "M14 10v6.75", "M18 10v6.75", "M3.75 19.25h16.5"], sec: ["M3.75 9.25 12 4.75l8.25 4.5Z"] },
    award: { d: ["M12 3.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5Z", "M8.9 13.25 7.75 20.25 12 18.1l4.25 2.15-1.15-7"], sec: ["M12 3.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5Z"] },
    visitor: { d: ["M10 4.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z", "M4.25 19.25v-.5a5.75 5.75 0 0 1 9.4-4.45", "M18 13.5v6", "M15 16.5h6"], sec: ["M10 4.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"] },
    // 挙手(SF Symbols の hand.raised のように、指を1本ずつ丸い線で)。右上の2本の弧は「手をあげる」動き
    hand: {
      d: [
        "M7.6 12.2V7.1a1.3 1.3 0 0 1 2.6 0V11",
        "M10.2 11V4.9a1.3 1.3 0 0 1 2.6 0V11",
        "M12.8 11V5.9a1.3 1.3 0 0 1 2.6 0v5.6",
        "M15.4 11.5V8.4a1.3 1.3 0 0 1 2.6 0v6.1a6.6 6.6 0 0 1-6.6 6.6h-.5a6.3 6.3 0 0 1-4.9-2.35l-2.6-3.3a1.35 1.35 0 0 1 2.05-1.75l1.95 1.9v-3.4",
      ],
      sec: ["M7.6 12.2V7.1a1.3 1.3 0 0 1 2.6 0V4.9a1.3 1.3 0 0 1 2.6 0v1a1.3 1.3 0 0 1 2.6 0v2.5a1.3 1.3 0 0 1 2.6 0v6.1a6.6 6.6 0 0 1-6.6 6.6h-.5a6.3 6.3 0 0 1-4.9-2.35l-2.6-3.3a1.35 1.35 0 0 1 2.05-1.75l1.95 1.9Z"],
      wave: ["M19.4 3.3a4.6 4.6 0 0 1 2.1 3.3", "M18.1 1.2a7.2 7.2 0 0 1 3.3 1.7"],
    },
  };
  function lineIcon(name, cls) {
    const def = LINE_ICONS[name] || LINE_ICONS.next;
    const svg = document.createElementNS(NS_SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", `pr-icon${cls ? ` ${cls}` : ""}`);
    const add = (d, c) => { const el = document.createElementNS(NS_SVG, "path"); el.setAttribute("d", d); el.setAttribute("class", c); svg.append(el); };
    if (def.ring) { const c = document.createElementNS(NS_SVG, "circle"); c.setAttribute("cx", "12"); c.setAttribute("cy", "12"); c.setAttribute("r", "9.25"); c.setAttribute("class", "ic-ring"); svg.append(c); }
    (def.sec || []).forEach((d) => add(d, "ic-sec"));
    (def.d || []).forEach((d) => add(d, `ic-line${def.heavy ? " is-heavy" : ""}`));
    (def.wave || []).forEach((d) => add(d, "ic-line ic-wave"));
    return svg;
  }
  function gripIcon() {
    const svg = document.createElementNS(NS_SVG, "svg");
    svg.setAttribute("viewBox", "0 0 12 18"); svg.setAttribute("aria-hidden", "true");
    [[3, 3], [9, 3], [3, 9], [9, 9], [3, 15], [9, 15]].forEach(([x, y]) => {
      const c = document.createElementNS(NS_SVG, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", "1.5"); svg.append(c);
    });
    return svg;
  }
  // opt.sides: 左右のはしに寄せたら、縦に並べる(操作バー)
  // opt.defaultPlace: まだ動かしていないときの場所。{ side, inset, bottom } か、その場で計算する関数({ left, top } も使える)
  // opt.onHome(true/false): はじめの場所にいるかどうか(大きさを変えるときに使う。場所を測る前に呼ぶ)
  function floatable(el, key, host, opt = {}) {
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
    // 左右のはし(縦に並べる)。side: "left" / "right" / ""
    const EDGE = 96;
    function setSide(side) {
      el.classList.toggle("is-vertical", !!side);
      el.classList.toggle("is-left", side === "left");
      el.classList.toggle("is-right", side === "right");
    }
    function snapSide(side) {
      const r = el.getBoundingClientRect();
      if (side === "left") el.style.left = "8px";
      if (side === "right") el.style.left = `${Math.round(vw() - r.width - 8)}px`;
      const y = Math.max(4, Math.min(vh() - r.height - 4, r.top));
      el.style.top = `${Math.round(y)}px`;
    }
    const home = (on) => { if (opt.onHome) opt.onHome(on); };
    function apply() {
      let pos = null;
      try { pos = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { /* noop */ }
      setSide(opt.sides && pos && pos.side ? pos.side : "");
      if (pos && typeof pos.x === "number") { home(false); el.classList.add("is-floating"); place(pos.x, pos.y); if (opt.sides && pos.side) snapSide(pos.side); }
      else if (opt.defaultPlace && vw() > 760) {
        // まだ動かしていないときの場所(広い画面)
        home(true);
        el.classList.add("is-floating");
        const d0 = typeof opt.defaultPlace === "function" ? null : opt.defaultPlace;
        setSide(opt.sides && d0 && d0.side ? d0.side : "");
        const r = el.getBoundingClientRect();
        const d = d0 || opt.defaultPlace(r) || {};
        const top = typeof d.top === "number" ? d.top : vh() - r.height - (d.bottom || 0);
        const left = typeof d.left === "number" ? d.left : d.side === "right" ? vw() - r.width - (d.inset || 0) : (d.inset || 0);
        el.style.left = `${Math.round(Math.max(0, Math.min(vw() - r.width, left)))}px`; el.style.top = `${Math.round(Math.max(4, Math.min(vh() - r.height - 4, top)))}px`;
      }
      else { home(false); el.classList.remove("is-floating"); el.style.left = ""; el.style.top = ""; }
    }
    function save() {
      const r = el.getBoundingClientRect();
      const side = el.classList.contains("is-left") ? "left" : el.classList.contains("is-right") ? "right" : "";
      try { localStorage.setItem(KEY, JSON.stringify({ x: r.left / vw(), y: r.top / vh(), side })); } catch { /* noop */ }
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
      if (!drag.moved) { drag.moved = true; home(false); el.classList.add("is-floating", "is-dragging"); }
      // 左右のはしへ持っていくと縦に並ぶ(つまみの位置はそのまま指の下に)
      if (opt.sides) {
        const side = e.clientX < EDGE ? "left" : e.clientX > vw() - EDGE ? "right" : "";
        const was = el.classList.contains("is-left") ? "left" : el.classList.contains("is-right") ? "right" : "";
        if (side !== was) { setSide(side); const g = grip.getBoundingClientRect(), r0 = el.getBoundingClientRect(); drag.dx = g.left - r0.left + g.width / 2; drag.dy = g.top - r0.top + g.height / 2; }
      }
      const r = el.getBoundingClientRect();
      const x = Math.max(4, Math.min(vw() - r.width - 4, e.clientX - drag.dx));
      const y = Math.max(4, Math.min(vh() - r.height - 4, e.clientY - drag.dy));
      el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`;
    });
    const end = () => {
      if (!drag) return;
      el.classList.remove("is-dragging");
      if (drag.moved) {
        if (el.classList.contains("is-left")) snapSide("left");
        if (el.classList.contains("is-right")) snapSide("right");
        save();
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
      home(false);
      const r = el.getBoundingClientRect();
      el.classList.add("is-floating");
      place((r.left + d[0]) / vw(), (r.top + d[1]) / vh());
      if (opt.sides) { const r2 = el.getBoundingClientRect(); setSide(r2.left < 12 ? "left" : r2.right > vw() - 12 ? "right" : ""); }
      save();
    });
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    requestAnimationFrame(apply);
    el.gripEl = grip;
    if (host) { const mo = new MutationObserver(() => { if (!host.isConnected) { window.removeEventListener("resize", onResize); mo.disconnect(); } }); mo.observe(document.documentElement, { childList: true }); }
  }

  // ---------- 「新潟 ⇔ 東京」の図(BT-EX5 の特徴) ----------
  // 上: 飛行機の航路(だ円の弧)。飛行機が東京から新潟へ飛び、通ったあとに点線が順に出る
  // 下: 線路。新幹線が新潟から東京へ走る。動きを減らす設定では、着いたところで止めて出す
  let routeId = 0;
  function routeMap(left, right, label) {
    const id = `rt${++routeId}`;
    const NS = NS_SVG;
    const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
    const FLY = "M810 146 C700 6 300 6 190 146";   // 東京 → 新潟(上)
    const RAIL = "M190 174 C300 300 700 300 810 174"; // 新潟 → 東京(下)
    const svg = el("svg", { viewBox: "0 0 1000 320", class: "pd-route-map", role: "img", "aria-label": label });
    const defs = el("defs");
    defs.innerHTML = `
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c9"/><stop offset=".45" stop-color="#e2b866"/><stop offset="1" stop-color="#a87a35"/></linearGradient>
      <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#e9dcc2"/></linearGradient>
      <filter id="${id}s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".55"/></filter>
      <filter id="${id}glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6"/></filter>
      <mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="320"><path d="${FLY}" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/></mask>`;
    svg.append(defs);
    // 航路のうすい下書きと、飛行機が通ったあとに出る点線
    svg.append(el("path", { d: FLY, class: "rt-guide" }));
    const trail = el("path", { d: FLY, class: "rt-trail", mask: `url(#${id}m)` });
    svg.append(trail);
    const reveal = defs.querySelector("mask path");
    // 線路: 枕木 → 2本のレール(太い金の線の上に、背景の色の細い線を重ねて2本に見せる)
    svg.append(el("path", { d: RAIL, class: "rt-sleepers" }), el("path", { d: RAIL, class: "rt-rails" }), el("path", { d: RAIL, class: "rt-rails-gap" }));
    // 街の印と名前
    [[190, 160, left, 92], [810, 160, right, 908]].forEach(([x, y, name, tx]) => {
      svg.append(el("circle", { cx: x, cy: y, r: 18, class: "rt-halo", filter: `url(#${id}glow)` }), el("circle", { cx: x, cy: y, r: 8, fill: `url(#${id}g)` }));
      const t = el("text", { x: tx, y: y + 20, class: "rt-city", "text-anchor": "middle" }); t.textContent = name; svg.append(t);
    });
    // 飛行機(上から見た旅客機。機首が上 = -90°)
    const plane = el("g", { class: "rt-plane", filter: `url(#${id}s)` });
    plane.innerHTML = `<g transform="scale(2.6) translate(-12 -12)"><path fill="url(#${id}g)" stroke="#5b3f17" stroke-width=".35" stroke-linejoin="round" d="M12 1.6c.7 0 1.25.9 1.25 2.05v5.1l8.35 5.05c.25.15.4.42.4.72v1.15c0 .3-.3.5-.58.41l-8.17-2.6v5.08l2.15 1.55c.15.11.24.29.24.48v.83c0 .24-.23.42-.46.36L12 20.9l-3.18.88a.37.37 0 0 1-.46-.36v-.83c0-.19.09-.37.24-.48l2.15-1.55v-5.08l-8.17 2.6a.43.43 0 0 1-.58-.41v-1.15c0-.3.15-.57.4-.72l8.35-5.05v-5.1C10.75 2.5 11.3 1.6 12 1.6Z"/><path d="M11.35 4.4h1.3" stroke="#3a2a12" stroke-width=".5" stroke-linecap="round"/></g>`;
    svg.append(plane);
    // 新幹線(横から見た形。鼻先が進む向き = 右)
    const train = el("g", { class: "rt-train", filter: `url(#${id}s)` });
    train.innerHTML = `<g transform="scale(1.35)">
      <path fill="url(#${id}t)" stroke="#6b5530" stroke-width=".6" d="M-34 7.5V-3.5c0-2.2 1.8-4 4-4h32c9 0 17.5 4.2 22 10.4 1.1 1.5.4 3.6-1.4 4.2-1 .3-2 .4-3 .4Z"/>
      <path fill="#1c140c" d="M-30 -4h24c4 0 8 .9 11.5 2.6l-1.2 2.4H-30Z"/>
      <path fill="none" stroke="#c9963f" stroke-width="1.6" d="M-34 3.2h50.5"/>
      <path fill="none" stroke="#2f5b8f" stroke-width="1.1" d="M-34 5.4h48"/>
      <circle cx="-24" cy="8.2" r="1.6" fill="#3a2a12"/><circle cx="-14" cy="8.2" r="1.6" fill="#3a2a12"/><circle cx="6" cy="8.2" r="1.6" fill="#3a2a12"/></g>`;
    svg.append(train);
    const wrap = h("div", { class: "pd-route" }, svg);

    // 動き
    const fly = el("path", { d: FLY }), rail = el("path", { d: RAIL });
    const flyLen = 820, railLen = 760; // おおよその長さ(はじめに測りなおす)
    let fL = flyLen, rL = railLen;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const clamp = (t) => Math.max(0, Math.min(1, t));
    function at(path, len, t, ahead) {
      const p = path.getPointAtLength(len * t);
      const q = path.getPointAtLength(Math.min(len, len * t + (ahead || 1)));
      const r = path.getPointAtLength(Math.max(0, len * t - 1));
      const a = Math.atan2((q.y - r.y), (q.x - r.x)) * 180 / Math.PI;
      return { x: p.x, y: p.y, a };
    }
    const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const CYCLE = 7600;
    let t0 = 0;
    function frame(now) {
      if (!svg.isConnected) { if (t0) return; requestAnimationFrame(frame); return; }
      if (!t0) {
        t0 = now;
        try { svg.append(fly, rail); fL = fly.getTotalLength(); rL = rail.getTotalLength(); fly.remove(); rail.remove(); } catch { /* noop */ }
        reveal.setAttribute("stroke-dasharray", `${fL} ${fL}`);
      }
      const e = calm ? CYCLE * 0.8 : (now - t0) % CYCLE;
      const tp = ease(clamp(e / 4200)), tt = ease(clamp((e - 900) / 4800));
      const fade = e > CYCLE - 700 ? clamp((CYCLE - e) / 700) : 1;
      const pp = at(svg.contains(fly) ? fly : svg.querySelector(".rt-guide"), fL, tp);
      plane.setAttribute("transform", `translate(${pp.x.toFixed(1)} ${pp.y.toFixed(1)}) rotate(${(pp.a + 90).toFixed(1)})`);
      plane.style.opacity = String(fade);
      reveal.setAttribute("stroke-dashoffset", String(fL * (1 - tp)));
      trail.style.opacity = String(fade);
      const tr = at(svg.querySelector(".rt-rails"), rL, tt);
      train.setAttribute("transform", `translate(${tr.x.toFixed(1)} ${(tr.y).toFixed(1)}) rotate(${tr.a.toFixed(1)}) translate(0 -9)`);
      train.style.opacity = String(fade);
      if (!calm) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return wrap;
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
      const fixedMs = fixed.reduce((a, i) => a + ((items[i].sec || t.per || 60) + (items[i].kind === "timer" ? 0 : t.gap || 0)) * 1000, 0);
      const decks = idxs.filter((i) => items[i].kind === "deck");
      if (fixedMs <= want) {
        fixed.forEach((i) => { dur[i] = ((items[i].sec || t.per || 60) + (items[i].kind === "timer" ? 0 : t.gap || 0)) * 1000; });
        const rest = want - fixedMs;
        if (decks.length) decks.forEach((i) => { dur[i] = rest / decks.length; });
        else if (fixed.length) dur[fixed[fixed.length - 1]] += rest;
      } else {
        fixed.forEach((i) => { dur[i] = ((items[i].sec || t.per || 60) + (items[i].kind === "timer" ? 0 : t.gap || 0)) * 1000 * (want / fixedMs); });
      }
    }
    const stepList = (items.find((it) => it.steps) || {}).steps || [];
    const offs = []; let acc = 0;
    dur.forEach((d, i) => { offs[i] = acc; acc += d; });

    const pad = (n) => String(n).padStart(2, "0");
    const jst = (ms) => new Date(ms + 9 * 3600000);
    const hm = (ms) => { const d = jst(ms); return `${d.getUTCHours()}:${pad(d.getUTCMinutes())}`; };
    const ms2 = (ms) => { const s = Math.round(Math.abs(ms) / 1000); return s >= 3600 ? `${Math.floor(s / 3600)}時間${Math.floor((s % 3600) / 60)}分${pad(s % 60)}秒` : `${Math.floor(s / 60)}分${pad(s % 60)}秒`; };
    // 開いたとき: 📍いまの部・状態の札 / 理想(いまの部の予定の時間)/ 現在の時刻 / いまのスライド / いまの部の進み具合
    // 閉じたとき: 状態(オンタイム・◯分遅れ・◯分早い)の1行だけ
    const stepName = h("b", { class: "pt2-step" });
    const status = h("p", { class: "pt-status pt2-badge" });
    const statusText = h("span");
    const statusIcon = h("span", { class: "pt-ic" });
    status.append(statusIcon, statusText);
    let lastState = "";
    const ideal = h("b", { class: "pt2-ideal" });
    const nowEl = h("b", { class: "pt2-now" });
    const sub = h("p", { class: "pt2-sub" });
    const bar = h("div", { class: "pt2-bar", "aria-hidden": "true" }, h("i"));
    const endRow = h("p", { class: "pt2-foot" });
    const startIn = h("input", { type: "time", class: "pt-start", "aria-label": "開始時刻", value: hm(start).padStart(5, "0"),
      onchange: () => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(startIn.value);
        if (!m) return;
        const d = jst(Date.now());
        start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]) - 9, Number(m[2]));
        tick();
      } });
    const setMini = (mini) => {
      panel.classList.toggle("is-mini", mini);
      const label = mini ? "大きくする" : "小さくする";
      toggle.setAttribute("aria-label", label); toggle.title = label;
      toggle.replaceChildren(lineIcon(mini ? "expand" : "collapse"));
    };
    // はじめの場所(広い画面の左上)では1行の帯(is-bar)。押すと下にくわしく開く(is-open)
    const setOpen = (open) => {
      panel.classList.toggle("is-open", open);
      const label = open ? "とじる" : "くわしく見る";
      toggle.setAttribute("aria-label", label); toggle.title = label;
      toggle.replaceChildren(lineIcon(open ? "collapse" : "expand"));
    };
    const toggle = h("button", { type: "button", class: "pt-min", onclick: () => {
      if (panel.classList.contains("is-bar")) setOpen(!panel.classList.contains("is-open"));
      else setMini(!panel.classList.contains("is-mini"));
    } });
    // 閉じているときは、状態の札を押しても開く
    status.addEventListener("click", () => { if (panel.classList.contains("is-mini")) { setMini(false); window.dispatchEvent(new Event("resize")); } });
    const panel = h("section", { class: "pr-time is-v2", "aria-label": "タイムマネジメント" },
      h("div", { class: "pt2-head" }, h("span", { class: "pt2-title" }, h("span", { class: "pt2-pin" }, lineIcon("pin")), stepName), status), toggle,
      h("div", { class: "pt-more pt2-body" },
        h("p", { class: "pt2-row" }, h("span", null, "理想"), ideal),
        h("p", { class: "pt2-row is-now" }, h("span", null, "現在"), nowEl),
        sub, bar,
        h("div", { class: "pt2-foot-row" }, endRow,
          h("label", { class: "pt2-start" }, h("span", null, "開始"), startIn))));
    // スマホなど狭い画面では、はじめは小さく(状態だけ)出す
    setMini((document.documentElement.clientWidth || innerWidth) <= 760);
    host.append(panel);
    // はじめの場所(広い画面): 左上の帯(上の題のところ)。スライドの中身に重ならない
    floatable(panel, "time-v2", host, { // 前の置き場所(左下・右はし)は使わず、新しいはじめの場所から
      onHome: (on) => {
        const was = panel.classList.contains("is-bar");
        panel.classList.toggle("is-bar", on);
        host.classList.toggle("time-home", on);
        if (on && !was) { setMini(false); setOpen(false); }
        if (!on && was) { panel.classList.remove("is-open"); setMini(false); }
        fitBar();
      },
      defaultPlace: (r) => {
        // 上の帯の高さは CSS で決めておく(帯の高さで、スライドの題の位置が動かないように)
        const top = host.querySelector(".pr-top");
        const tr = top ? top.getBoundingClientRect() : { top: 12, height: 40, left: 16 };
        return { left: Math.max(8, tr.left), top: tr.top + (tr.height - r.height) / 2 };
      },
    });
    // 小さく・大きくしたときも、下のはしの位置をそろえる
    toggle.addEventListener("click", () => window.dispatchEvent(new Event("resize")));

    // 部(流れの番号)ごとの予定の時間: その部の最初の項目の始まり 〜 最後の項目の終わり
    const stepSpan = (i) => {
      const k = stepOf(items[i]);
      let f = i, l = i;
      while (f > 0 && stepOf(items[f - 1]) === k) f--;
      while (l < items.length - 1 && stepOf(items[l + 1]) === k) l++;
      return [start + offs[f], start + offs[l] + dur[l]];
    };
    // 帯は、右の「進行の場所」の選択の手前までに収める(選択の位置はスライドによって変わるので、そのつど合わせる)
    function fitBar() {
      const jumpEl = host.querySelector(".pr-top .pr-jump");
      const on = panel.classList.contains("is-bar");
      const room = on && jumpEl ? Math.max(240, Math.round(jumpEl.getBoundingClientRect().left - panel.getBoundingClientRect().left - 12)) : 0;
      const mw = room ? `${room}px` : "";
      if (panel.style.maxWidth !== mw) panel.style.maxWidth = mw;
      // 幅が足りないときは「現在」の時刻を省く(状態の札と理想の時間を優先)
      panel.classList.toggle("is-tight", !!room && room < 470);
    }
    function tick() {
      fitBar();
      const now = Date.now();
      const d = jst(now);
      const i = Math.min(items.length - 1, Math.max(0, getIdx()));
      const ps = start + offs[i], pe = ps + dur[i];
      const lag = now < ps ? now - ps : now > pe ? now - pe : 0;
      const state = Math.abs(lag) < 10000 ? "ok" : lag > 0 ? "late" : "early";
      panel.dataset.state = state;
      if (state !== lastState) { lastState = state; statusIcon.replaceChildren(lineIcon(state)); }
      setText(statusText, state === "ok" ? "オンタイム" : state === "late" ? `${ms2(lag)} 遅れ` : `${ms2(lag)} 早い`);
      const st = stepList.find((x) => x.no === items[i].stepNo);
      setText(stepName, st ? `${two(st.no)} ${String(st.title).replace(/\s*[(（]?\s*\d+\s*分(?:\s*[×xX✕]\s*\d+\s*回?)?\s*[)）]?\s*$/, "")}` : items[i].stepNo ? "おわり" : "オープニング");
      const [ss, se] = stepSpan(i);
      setText(ideal, `${hm(ss)}〜${hm(se)}`);
      setText(nowEl, `${d.getUTCHours()}:${pad(d.getUTCMinutes())}`);
      const it = items[i];
      setText(sub, it.kind === "deck" ? String(it.name || "").replace(/\n/g, " ") : it.kind === "timer" ? it.name || "" : it.name ? `${it.name}さん` : "");
      sub.hidden = !sub.textContent;
      const w = `${Math.max(0, Math.min(100, ((now - ss) / Math.max(1, se - ss)) * 100)).toFixed(1)}%`;
      if (bar.firstChild.style.width !== w) bar.firstChild.style.width = w;
      // 終了・見込みは、時刻が変わったときだけ作り直す
      const endKey = `${hm(start + total)}|${hm(start + total + lag)}`;
      if (endRow.dataset.key !== endKey) {
        endRow.dataset.key = endKey;
        endRow.replaceChildren(h("span", null, "終了"), h("b", null, hm(start + total)), h("span", null, "見込み"), h("b", { class: "pt-eta" }, hm(start + total + lag)));
      }
    }
    tick();
    const timer = setInterval(tick, 250);
    return { el: panel, stop() { clearInterval(timer); panel.remove(); } };
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
    // 進行バーの名前を、ことばの切れ目でだけ折り返す(「エデュケーション/コーナー」「ブレイクアウト/ルーム商談/(テーブル商談)」)
    // ことばのかたまりは1行のまま(途中で折り返さない)
    const stepWords = (title) => String(title || "")
      .replace(/(エデュケーション|ブレイクアウト|ビジネス|プレゼン(?=テーション)|1分|の)(?=.)/g, "$1\u0000").replace(/(.)(?=[（(])/g, "$1\u0000")
      .split("\u0000").filter(Boolean).flatMap((part, i) => (i ? [h("wbr"), h("span", { class: "pd-nw" }, part)] : [h("span", { class: "pd-nw" }, part)]));
    const progress = opts.deck ? h("div", { class: "pd-progress", "aria-hidden": "true" }) : null;
    function drawProgress() {
      if (!progress) return;
      const p = people[idx] || {};
      App.fill(progress,
        h("ol", { class: "pd-progress-steps" }, deckSteps.map((st) => h("li", { class: st.no === p.stepNo ? "is-now" : st.no < p.stepNo ? "is-done" : "" },
          h("i"), h("span", null, ...stepWords(st.title))))),
        h("span", { class: "pd-progress-page" }, `${two(idx + 1)} / ${two(people.length)}`));
    }
    // 下の操作バー(アプリの下のメニューと同じ形: 絵と文字のボタンを横に並べる)
    // 絵は丸い下地(いま押すもの)の中に、その下に文字(Material 3 のナビゲーションバーと同じ形)
    // 絵と文字が変わるときだけ作り直す(時間を計っているあいだは1秒に10回ほど描き直すので、
    // 毎回作り直すと、押した瞬間に中身が入れかわって「押しても反応しない」ことがあるため)
    function setBtn(btn, icon, label) {
      const key = `${icon}|${label}`;
      if (btn.dataset.face === key) return btn;
      btn.dataset.face = key;
      btn.replaceChildren(h("span", { class: "pr-dock-ind" }, lineIcon(icon)), h("span", { class: "pr-dock-label" }, label));
      btn.setAttribute("aria-label", label);
      return btn;
    }
    const dockBtn = (icon, label, cls, onclick) => setBtn(h("button", { type: "button", class: `pr-dock-btn${cls ? ` ${cls}` : ""}`, onclick }), icon, label);
    const pauseBtn = dockBtn("play", "はじめる", "is-main");
    // スライドの中のカード(カルーセル)
    const carNow = () => { const el = slide.querySelector(".pd-car, .pd-gl-seq"); return el && el.car; };
    function backward() {
      if (breakLayer) { closeBreak(); return; }
      const c = carNow();
      if (c && c.i > 0) { c.show(c.i - 1); return; }
      if (idx > 0) go(idx - 1, false, true);
    }
    function forward(keepRunning) {
      if (breakLayer) { closeBreak(); return; }
      const c = carNow();
      if (c && c.i < c.n - 1) { c.show(c.i + 1); return; }
      go(idx + 1, keepRunning && idx + 1 < people.length && !isDeck(people[idx + 1]));
    }
    const prevBtn = dockBtn("prev", "戻る", "", () => backward());
    // 時間の途中で話し終わったとき: 計っている最中に「進む」を押すと、次の人の時間もそのまま始まる
    const nextBtn = dockBtn("next", "進む", "", () => forward(running() || gapUntil > 0));
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
    // はじめの場所(広い画面): 右下に横に並べる。下のメーター・進行バーは、その分だけ右をあける(スライドの中身に重ならない)
    floatable(dock, "dock-v2", box, {
      sides: true,
      onHome: (on) => {
        box.classList.toggle("dock-home", on);
        if (!on) return;
        const r = dock.getBoundingClientRect();
        box.style.setProperty("--dock-w", `${Math.ceil(r.width)}px`);
        box.style.setProperty("--dock-h", `${Math.ceil(r.height)}px`);
      },
      defaultPlace: (r) => {
        box.style.setProperty("--dock-w", `${Math.ceil(r.width)}px`);
        box.style.setProperty("--dock-h", `${Math.ceil(r.height)}px`);
        const vw = box.clientWidth || document.documentElement.clientWidth;
        const vh = box.clientHeight || document.documentElement.clientHeight;
        return { left: vw - r.width - 12, top: vh - r.height - 12 };
      },
    });
    const dockGrip = dock.gripEl;
    // 定例会のスライドのときは、2時間の定例会のタイムマネジメント(動かせる)
    const timing = opts.deck && opts.timing ? timePanel(people, opts.timing, () => idx, box) : null;
    // 残り秒数の欄は、いちばん幅を取る表示(「残り 8:88 秒」「次の人まで 88 秒」)に合わせて幅を決めておく。
    // はじめる・止める・次の人までの待ちで、数字やメーターの位置が動かないように
    const gapLabel = solo ? "次まで" : "次の人まで";
    // 自分だけのタイマーは、まん中に「予定」の画面と同じアナログ時計(いまの時刻)を出す。項目が変わっても同じ時計を使う
    const soloClock = solo && App.luxClock ? App.luxClock() : null;
    // 定例会のタイマー(エデュケーションコーナー・商談): 残り時間を画面いっぱいに大きく(Zoom のピン留めでも読める)
    const bigTime = h("p", { class: "pr-big-time", "aria-live": "off" });
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

    // カードの多いスライド: カードを1ページくらいの大きさにして、スライドの中で1枚ずつ送る
    // (左右の矢印・下の点・指でなぞる。「進む」「戻る」も、まずカードを送る)
    function makeCarousel(cards) {
      const n = cards.length;
      let cur = 0;
      const track = h("div", { class: "pd-car-track" }, cards.map((c) => h("div", { class: "pd-car-cell" }, c)));
      const dots = h("div", { class: "pd-car-dots", role: "tablist" }, cards.map((_, i) => h("button", { type: "button", role: "tab", "aria-label": `${i + 1}枚目`, onclick: () => show(i) }, String(i + 1))));
      const prevB = h("button", { type: "button", class: "pd-car-btn is-prev", "aria-label": "前のカード", onclick: () => show(cur - 1) }, lineIcon("prev"));
      const nextB = h("button", { type: "button", class: "pd-car-btn is-next", "aria-label": "次のカード", onclick: () => show(cur + 1) }, lineIcon("next"));
      const count = h("span", { class: "pd-car-count" });
      const mark = () => {
        [...dots.children].forEach((d, i) => { d.classList.toggle("is-on", i === cur); d.setAttribute("aria-selected", i === cur ? "true" : "false"); });
        count.textContent = `${cur + 1} / ${n}`;
        prevB.disabled = cur === 0; nextB.disabled = cur === n - 1;
      };
      // ボタンで送っている途中(なめらかに動いているあいだ)は、動きの途中の位置で番号を戻さない
      let lockUntil = 0;
      function show(i, instant) {
        cur = Math.max(0, Math.min(n - 1, i));
        lockUntil = instant ? 0 : Date.now() + 700;
        track.scrollTo({ left: cur * track.clientWidth, behavior: instant ? "auto" : "smooth" });
        mark();
      }
      track.addEventListener("scroll", () => {
        if (Date.now() < lockUntil) return;
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (i !== cur && i >= 0 && i < n) { cur = i; mark(); }
      }, { passive: true });
      const el = h("div", { class: "pd-car" }, h("div", { class: "pd-car-stage" }, prevB, track, nextB), h("div", { class: "pd-car-foot" }, dots, count));
      el.car = { n, get i() { return cur; }, show };
      mark();
      return el;
    }
    // 定例会のスライド
    function deckSlide(p) {
      const L = p.leader || {};
      // 改行(\n)を <br> に
      const lines = (t) => String(t).split("\n").flatMap((x, i) => (i ? [h("br"), x] : [x]));
      // 《 》で囲んだところを強調
      const rich = (t) => String(t).split(/《|》/).map((x, i) => (i % 2 ? h("em", null, x) : x));
      // 規定のカードの見出しは、《 》で囲んだところの下に波線(例: 招待者を《必ず》通す)
      const wavy = (t) => String(t).split(/《|》/).map((x, i) => (i % 2 ? h("span", { class: "pd-wavy" }, x) : x));
      // カードの文: 改行のある文は1行ずつ(行の途中では折り返さない)。
      // 「パターン1:リアル定例会⏎& オンライン定例会」のように「:」で始まる文は、続きの行を「:」のあとにそろえる
      // 「パターン1:」の「パターン1」は枠で囲んだ札にして、「:」は出さない
      const cardLines = (x) => {
        const t = String(x);
        const m = /^([^:：\n]{1,12})[:：]\s*([\s\S]*)$/.exec(t);
        if (!m && !t.includes("\n")) return [t];
        const rows = (m ? m[2] : t).split("\n").map((r) => h("span", { class: "pd-line" }, r.trim()));
        return m ? [h("span", { class: "pd-hang is-tagged" }, h("span", { class: "pd-hang-l pd-tag" }, m[1]), h("span", { class: "pd-hang-r" }, ...rows))] : rows;
      };
      // 長いカタカナの言葉は、決めたところで改行する(「ブレイクアウト/ルーム商談」)
      const softBreaks = (t) => String(t).split(/(?=ルーム商談|[（(]テーブル)/).flatMap((x, i) => (i ? [h("br"), x] : [x]));
      // カードなどを順に浮かび上がらせる(--i は順番)
      const nth = (i) => ({ style: `--i:${i}` });
      const carousel = makeCarousel;
      // 中身のスライドの共通の形: 左上に「02 BT-EXの理念」の小見出し、題、(あれば)要点の一文、中身
      // どのスライドも、題は同じ位置(左上)・同じ大きさにそろえる(運営の依頼)。lead: 題の下の要点の一文(なければ出さない)
      const frameL = (cls, lead, ...body) => h("div", { class: `pd pd-frame ${cls}` },
        h("header", { class: "pd-head" },
          p.eyebrow ? h("p", { class: "pd-eyebrow" }, h("span", { class: "pd-eyebrow-no" }, two(p.stepNo)), p.eyebrow) : null,
          h("h2", { class: `pd-title${String(p.name).length > 18 ? " is-long" : ""}` }, p.name),
          lead ? h("p", { class: "pd-lead" }, lead)
            // カードを1枚ずつ送るスライドは、要点の行がなくても同じ高さをあけて、カードの位置をそろえる
            : /\bis-carousel\b/.test(cls) ? h("p", { class: "pd-lead is-blank", "aria-hidden": "true" }, "\u00a0") : null),
        h("div", { class: "pd-body" }, ...body));
      const frame = (cls, ...body) => frameL(cls, p.lead, ...body);
      // 流れの一覧(本日の流れ・区切りのスライド)。いまの所を光らせ、終わった所は控えめに
      const agendaList = (compact) => h("ol", { class: `pd-agenda${compact ? " is-compact" : ""}` }, (p.steps || []).map((st, i) =>
        h("li", { class: st.no === p.stepNo && p.type !== "agenda" ? "is-now" : st.no < p.stepNo ? "is-done" : "", ...nth(i) },
          h("span", { class: "pd-agenda-no" }, two(st.no)),
          h("span", { class: "pd-agenda-title" }, ...stepWords(st.title)),
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
          p.notes && p.notes.length ? h("ul", { class: "pd-notes" }, p.notes.map((x) => h("li", null, x))) : null);
      }
      if (p.type === "agenda") {
        // 時間の配分(タイムマネジメントと同じ時間の目安)を、長さが分の割合の帯で見せ、各行に始まる時刻と分を添える
        const plan = (p.plan || []).map((v) => Math.max(0, Number(v) || 0));
        const total = plan.reduce((a, b) => a + b, 0);
        const m0 = /^(\d{1,2}):(\d{2})$/.exec(p.start || "");
        const startMin = m0 ? Number(m0[1]) * 60 + Number(m0[2]) : null;
        const clock = (min) => `${Math.floor(min / 60) % 24}:${String(min % 60).padStart(2, "0")}`;
        let acc = plan[0] || 0;
        const at = (p.steps || []).map((st) => { const s0 = acc; acc += plan[st.no] || 0; return { from: s0, min: plan[st.no] || 0 }; });
        const bar = total ? h("div", { class: "pd-tbar", role: "img", "aria-label": `合計${total}分の時間配分` },
          plan[0] ? h("span", { class: "pd-tseg is-op", style: `flex:${plan[0]}` }, h("small", null, "OP")) : null,
          (p.steps || []).map((st, i) => (plan[st.no] ? h("span", Object.assign({ class: "pd-tseg", style: `flex:${plan[st.no]};--i:${i}` }), h("b", null, two(st.no)), h("small", null, `${plan[st.no]}分`)) : null))) : null;
        return h("div", { class: "pd pd-frame pd-agenda-slide" },
          h("header", { class: "pd-head" }, h("p", { class: "pd-eyebrow" }, "AGENDA"), h("h2", { class: "pd-title" }, p.name)),
          h("div", { class: "pd-body" }, bar,
            h("ol", { class: "pd-agenda" }, (p.steps || []).map((st, i) =>
              h("li", nth(i),
                h("span", { class: "pd-agenda-no" }, two(st.no)),
                h("span", { class: "pd-agenda-title" }, ...stepWords(st.title)),
                h("span", { class: "pd-agenda-time" },
                  startMin !== null && total ? h("b", null, clock(startMin + at[i].from)) : null,
                  at[i].min ? h("small", null, `${at[i].min}分`) : st.sub ? h("small", null, st.sub) : null))))));
      }
      if (p.type === "section") {
        // 区切り: 左に大きな番号と題、右に流れの一覧(いまの所が光る)
        if (!p.no) {
          // 番号のない区切り(規定など): ほかの区切りと同じく左にそろえる
          return h("div", { class: "pd pd-section pd-subsection" },
            h("div", { class: "pd-section-main" },
              p.eyebrow ? h("p", { class: "pd-eyebrow" }, h("span", { class: "pd-eyebrow-no" }, two(p.stepNo)), p.eyebrow) : null,
              h("h2", { class: "pd-display" }, ...lines(p.name))));
        }
        return h("div", { class: `pd pd-section${p.name.length > 10 ? " is-long-title" : ""}` },
          h("div", { class: "pd-section-main" },
            h("p", { class: "pd-no", "aria-hidden": "true" }, two(p.no)),
            h("h2", { class: "pd-display" }, ...softBreaks(p.name)),
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
            // 実績は数字を大きく(「4ヶ月で1万人フォロワー達成」→ 1万人 / 4ヶ月でフォロワー達成)
            L.achievements && L.achievements.length ? h("ul", { class: "pd-stats" }, L.achievements.map((x, i) => {
              const m = /\d[\d,.]*\s*(?:万|千)?\s*(?:人|件)(?:以上)?/.exec(String(x));
              if (!m) return h("li", nth(i), h("small", null, x));
              // 説明の改行(「4ヶ月で↵フォロワー達成」)はそのまま
              const rest = String(x).replace(m[0], "").replace(/^[\sの]+|[\s]+$/g, "").replace(/[ \t]{2,}/g, " ").replace(/[ \t]*\n[ \t]*/g, "\n");
              return h("li", nth(i), h("b", null, m[0].replace(/\s+/g, "")), h("small", null, ...lines(rest)));
            })) : null,
            h("div", { class: "pd-leader-cols" },
              L.now && L.now.length ? h("div", { class: "pd-block" }, h("p", { class: "pd-h" }, "現在"), h("ul", null, L.now.map((x) => h("li", null, ...(String(x).includes("\n") ? String(x).split("\n").map((r) => h("span", { class: "pd-line" }, r)) : [x]))))) : null,
              L.dreams && L.dreams.length ? h("div", { class: "pd-block" }, h("p", { class: "pd-h" }, "想い・夢"), h("ul", null, L.dreams.map((x) => h("li", null, ...lines(x))))) : null)),
          face(p.photo, p.name, "pr-photo pd-photo"));
      }
      if (p.type === "about") {
        // 上に「LINK の市場 × BT のスキル × 3つの強み = BT-EX」の式
        const f = p.formula || [];
        const formula = f.length ? h("div", { class: "pd-formula", role: "img", "aria-label": `${f.map((x) => x[1]).join(" × ")} = ${p.center}` },
          ...f.flatMap(([ic, label], i) => [i ? h("span", { class: "pd-op", "aria-hidden": "true" }, "×") : null,
            h("span", Object.assign({ class: "pd-fterm" }, nth(i)), h("span", { class: "pd-ficon" }, lineIcon(ic)), h("span", null, label))]),
          h("span", { class: "pd-op", "aria-hidden": "true" }, "="),
          h("span", Object.assign({ class: "pd-fterm is-result" }, nth(f.length)), h("b", null, p.center))) : null;
        return frame("pd-about", formula, ...(p.paras || []).map((x, i) => h("p", { class: `pd-para${i ? "" : " is-first"}`, ...nth(i + 1) }, ...lines(x))));
      }
      if (p.type === "vision") {
        return frameL("pd-vision", p.en || "",
          h("div", { class: "pd-vrow" },
            h("div", nth(0), h("p", { class: "pd-h" }, "理念"), h("p", { class: "pd-big" }, ...lines(p.philosophy || ""))),
            h("div", nth(1), h("p", { class: "pd-h" }, "ビジョン"), h("p", { class: "pd-big" }, ...lines(p.vision || "")))));
      }
      if (p.type === "feature") {
        // 「新潟 ⇔ 東京」は、2つの街を金の線でつないだ図にする
        const [head, ...rest] = p.lines || [];
        return frameL("pd-feature is-centered", "",
          head ? h("p", { class: "pd-display" }, head) : null,
          rest.map((x) => {
            const ends = String(x).split(/\s*[⇔↔]\s*/);
            return ends.length === 2 ? routeMap(ends[0], ends[1], x) : h("p", { class: "pd-big" }, x);
          }));
      }
      if (p.type === "list" && p.carousel) {
        return frame("pd-list is-carousel", carousel((p.items || []).map((it, i) => h("article", { class: "pd-card pd-big-card" },
          h("div", { class: "pd-big-top" }, it.icon ? h("span", { class: "pd-big-ic" }, lineIcon(it.icon)) : null, h("span", { class: "pd-big-no" }, two(i + 1))),
          h("p", { class: "pd-big-head" }, ...lines(it.title)),
          (it.lines || []).map((x) => h("p", { class: "pd-big-text" }, ...lines(x)))))));
      }
      if (p.type === "list") {
        const layout = p.layout || "rows";
        return frame(`pd-list is-${layout}`,
          h("ol", { class: "pd-cards" }, (p.items || []).map((it, i) => h("li", Object.assign({ class: `pd-card${it.icon ? " has-icon" : ""}` }, nth(i)),
            it.icon ? h("span", { class: "pd-card-ic" }, lineIcon(it.icon)) : null,
            h("span", { class: "pd-card-no" }, two(i + 1)),
            h("p", { class: "pd-card-title" }, ...lines(it.title)),
            // 文は1行ずつ(行の途中では折り返さない。入りきらないときは fitDeck で文字を小さくする)
            // 3つの活動で文が複数あるとき(パターン1・2・3)は、1つずつ枠で囲む
            (it.lines || []).map((x) => h("p", { class: `pd-card-text${layout === "trio" && (it.lines || []).length > 1 ? " is-boxed" : ""}` }, ...cardLines(x)))))));
      }
      if (p.type === "checks") {
        return frame("pd-checks",
          h("ul", { class: "pd-check-items" }, (p.items || []).map((x, i) => h("li", nth(i), h("span", { class: "pd-check", "aria-hidden": "true" }, lineIcon("check")), h("span", { class: "pd-check-text" }, ...cardLines(x))))));
      }
      if (p.type === "raise") {
        // 挙手のお願い: 大きな手のマークと、何について発表するか
        const hand = lineIcon("hand", "is-hand");
        return frameL("pd-raise is-centered", "",
          h("span", { class: "pd-raise-mark" }, h("span", { class: "pd-raise-halo", "aria-hidden": "true" }), hand),
          p.items && p.items.length ? h("ul", { class: "pd-raise-items" }, p.items.map((x, i) => h("li", nth(i), x))) : null,
          h("p", { class: "pd-display" }, ...lines(p.text || "について\n発表できる方は\n挙手をお願いします")),
          // 注意書き: 改行(\n)はそのまま。「※」で始まるときは、続きの行を「※」のあとにそろえる
          p.note ? h("p", { class: "pd-raise-note" }, ...(() => {
            const m = /^※\s*([\s\S]*)$/.exec(p.note);
            const rows = String(m ? m[1] : p.note).split("\n").map((t) => h("span", { class: "pd-line" }, ...rich(t.trim())));
            return m ? [h("span", { class: "pd-hang" }, h("span", { class: "pd-hang-l" }, "※"), h("span", { class: "pd-hang-r" }, ...rows))] : rows;
          })()) : null);
      }
      if (p.type === "venn") {
        // ベン図: 3つの円(LINK・BNI・守成クラブ)が重なるまん中が BT-EX。円の中に強みの数と代表的な強み
        const g = (p.groups || []).slice(0, 3);
        const C = [[300, 205], [500, 205], [400, 365]];
        const NSv = NS_SVG;
        const svg = document.createElementNS(NSv, "svg");
        svg.setAttribute("viewBox", "0 0 800 610"); svg.setAttribute("class", "pd-venn"); svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", `${g.map((x) => x.name).join("・")} の強みが重なるところが ${p.center}`);
        const mk = (tag, attrs, text) => { const e = document.createElementNS(NSv, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text) e.textContent = text; return e; };
        const LBL = [[205, 120, "end"], [595, 120, "start"], [400, 545, "middle"]];
        g.forEach((x, i) => {
          svg.append(mk("circle", { cx: C[i][0], cy: C[i][1], r: 165, class: `vn-c vn-c${i}`, style: `--i:${i}` }));
        });
        g.forEach((x, i) => {
          const name = x.name.replace(/の強み$/, "");
          const [lx, ly] = [C[i][0] + [-62, 62, 0][i], C[i][1] + [-38, -38, 80][i]];
          svg.append(mk("text", { x: lx, y: ly, class: "vn-name", "text-anchor": "middle" }, name));
          svg.append(mk("text", { x: lx, y: ly + 34, class: "vn-count", "text-anchor": "middle" }, `${x.items.length}の強み`));
          // 強みは省略せず最後まで。長いものは「、」「・」のあと(なければまん中)で2行に分ける
          let yy = ly + 62;
          (x.items || []).slice(0, 2).forEach((t) => {
            let parts = [t];
            if (t.length > 9) { const c = t.search(/[、・]/); const at = c > 0 && c < t.length - 1 ? c + 1 : Math.ceil(t.length / 2); parts = [t.slice(0, at), t.slice(at)]; }
            parts.forEach((part) => { svg.append(mk("text", { x: lx, y: yy, class: "vn-item", "text-anchor": "middle" }, part)); yy += 22; });
            yy += 4;
          });
          void LBL;
        });
        svg.append(mk("circle", { cx: 400, cy: 262, r: 54, class: "vn-core" }));
        svg.append(mk("text", { x: 400, y: 272, class: "vn-center", "text-anchor": "middle" }, p.center || "BT-EX"));
        return frame("pd-vennslide", h("div", { class: "pd-venn-wrap" }, svg,
          h("p", { class: "pd-venn-note" },
            h("span", { class: "pd-line" }, h("b", null, `${g.reduce((a, x) => a + x.items.length, 0)}の強み`), "を掛け合わせ"),
            h("span", { class: "pd-line" }, "事業主のビジネスと"),
            h("span", { class: "pd-line" }, "BT の拡大に相乗効果を生む"))));
      }
      if (p.type === "kpis") {
        // 数字で見る約束: 大きな数字のタイル
        return frame("pd-kpis", h("ul", { class: "pd-kpi-grid" }, (p.items || []).map(([num, label], i) =>
          h("li", Object.assign({ class: "pd-kpi" }, nth(i)), h("b", null, num), h("span", { class: "pd-kpi-rule", "aria-hidden": "true" }), h("small", null, label)))));
      }
      if (p.type === "strengths") {
        return frame("pd-strengths",
          h("div", { class: "pd-groups" }, (p.groups || []).map((g, i) => h("section", Object.assign({ class: "pd-card pd-group" }, nth(i)),
            h("p", { class: "pd-card-title" }, g.name),
            h("ul", null, g.items.map((x) => h("li", null, x)))))));
      }
      if (p.type === "rules" && p.carousel) {
        const rows = p.rows || [];
        const car = carousel(rows.map((x, i) => {
          const ic = (p.icons || [])[i] || "check";
          return h("article", { class: `pd-card pd-big-card${ic === "ban" ? " is-ban" : ""}` },
            h("div", { class: "pd-big-top" }, h("span", { class: "pd-big-ic" }, lineIcon(ic)), ic === "ban" ? h("span", { class: "pd-rule-tag" }, "禁止") : null, h("span", { class: "pd-big-no" }, two(i + 1))),
            (p.heads || [])[i] ? h("p", { class: "pd-big-head" }, ...wavy(p.heads[i])) : null,
            h("p", { class: "pd-big-text" }, ...String(x).split("\n").flatMap((t, k) => (k ? [h("br"), ...rich(t)] : rich(t)))));
        }));
        // 注意書きは、カードの下の番号の列に並べる(カードの位置をほかのスライドとそろえるため)
        if (p.note) car.querySelector(".pd-car-foot").append(h("p", { class: "pd-note pd-car-note" }, `※ ${p.note}`));
        return frame("pd-rules is-carousel", car);
      }
      if (p.type === "rules") {
        // 規定のカード: 絵(禁止は赤い印)・番号・見出し・文(改行と《 》の強調はそのまま)
        const rows = p.rows || [];
        return frame(`pd-rules is-cols-${p.cols || 3}`,
          h("ol", { class: "pd-rule-grid" }, rows.map((x, i) => {
            const ic = (p.icons || [])[i] || "check";
            const head = (p.heads || [])[i] || "";
            return h("li", Object.assign({ class: `pd-card pd-rule-card${ic === "ban" ? " is-ban" : ""}` }, nth(i)),
              h("div", { class: "pd-rule-top" },
                h("span", { class: "pd-rule-ic" }, lineIcon(ic)),
                ic === "ban" ? h("span", { class: "pd-rule-tag" }, "禁止") : null,
                h("span", { class: "pd-rule-no" }, two(i + 1))),
              head ? h("p", { class: "pd-rule-head" }, ...wavy(head)) : null,
              h("p", { class: "pd-rule-text" }, ...String(x).split("\n").flatMap((t, k) => (k ? [h("br"), ...rich(t)] : rich(t)))));
          })),
          p.note ? h("p", { class: "pd-note" }, `※ ${p.note}`) : null);
      }
      if (p.type === "glossary") {
        // BT-EX でよく使う言葉。言葉を押すか「進む」で、1つずつ大きく出す(ポップアップ)。
        // 最後の言葉のあとの「進む」で次のスライドへ。「戻る」は1つ前の言葉、最初の言葉ならポップアップを閉じる
        const items = p.items || [];
        const pop = h("div", { class: "pd-gloss-pop", hidden: true, role: "dialog", "aria-modal": "false", "aria-live": "polite" });
        const cells = items.map((x, i) => h("div", Object.assign({ class: "pd-gloss-item", role: "button", tabindex: "0", "aria-label": `${x.head}を大きく見る`,
          onclick: () => seq.show(i + 1), onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); seq.show(i + 1); } } }, nth(i)),
          h("dt", null, x.head), h("dd", null, String(x.text || "").split("\n").map((t) => h("span", { class: "pd-line" }, t)))));
        // i: 0 = 閉じている / 1〜n = その番号の言葉を出している(カードの送りと同じ形で、進む・戻るから動かす)
        const seq = { n: items.length + 1, i: 0, show(k) {
          seq.i = Math.max(0, Math.min(items.length, k));
          cells.forEach((c, j) => { c.classList.toggle("is-on", j === seq.i - 1); c.classList.toggle("is-seen", j < seq.i - 1); });
          if (!seq.i) { pop.hidden = true; return; }
          const x = items[seq.i - 1];
          App.fill(pop, h("div", { class: "pd-gloss-card", key: String(seq.i) },
            h("p", { class: "pd-gloss-no" }, `${two(seq.i)} / ${two(items.length)}`),
            h("p", { class: "pd-gloss-term" }, x.head),
            h("p", { class: "pd-gloss-text" }, ...lines(x.text || "")),
            h("button", { type: "button", class: "pd-gloss-close", "aria-label": "閉じる", onclick: () => seq.show(0) }, lineIcon("close"))));
          pop.hidden = false;
          // 言葉は1行で出す(入りきらないときは文字を小さくする)
          const term = pop.querySelector(".pd-gloss-term");
          if (term && term.scrollWidth > term.clientWidth) term.style.fontSize = `${parseFloat(getComputedStyle(term).fontSize) * (term.clientWidth / term.scrollWidth) * 0.98}px`;
        } };
        pop.addEventListener("click", (e) => { if (e.target === pop) seq.show(0); });
        const wrap = h("div", { class: "pd-gl-seq" }, h("dl", { class: "pd-gloss" }, cells), pop);
        wrap.car = seq;
        return frame("pd-glossary", wrap);
      }
      if (p.type === "staff") {
        // 本日の運営メンバー: 役ごとのカードに、担当の方の顔写真とお名前
        return frame("pd-staff", h("ul", { class: "pd-staff-grid" }, (p.roles || []).map((r, i) => h("li", Object.assign({ class: `pd-staff-card${r.fixed ? " is-fixed" : ""}` }, nth(i)),
          h("p", { class: "pd-staff-role" }, r.role),
          r.people.length ? h("div", { class: "pd-staff-people" }, r.people.map((x) => h("span", { class: "pd-staff-person" }, face(x.photo, x.name, "pd-staff-face"), h("b", null, x.name))))
            : h("p", { class: "pd-staff-none" }, "—")))));
      }
      if (p.type === "joinsteps") {
        // 入会への3ステップ: Step のカードを矢印でつなぐ
        return frame("pd-joinsteps", h("ol", { class: "pd-steps" }, (p.cards || []).flatMap((st, i) => [
          i ? h("li", { class: "pd-step-arrow", "aria-hidden": "true" }, lineIcon("next")) : null,
          h("li", Object.assign({ class: "pd-step-card" }, nth(i)), h("span", { class: "pd-step-no" }, `Step${i + 1}`), h("b", null, ...lines(st.head || "")), st.text ? h("small", null, String(st.text).split("\n").map((t) => h("span", { class: "pd-line" }, t))) : null),
        ]).filter(Boolean).concat(
          // カードの外の注意書き(「入会希望の方はご紹介者の方へお聞きください」)。はじめの何枚かのカードの下に、かっこでまとめて出す
          p.note ? [h("li", { class: "pd-step-note", style: `grid-column: 1 / ${Math.min(p.cards.length, Math.max(1, p.noteSpan || 2)) * 2}` }, h("span", null, p.note))] : [])));
      }
      if (p.type === "survey") {
        // アンケート: BT-EX メンバーの方・ビジターの方で分けた QR コード
        return frame("pd-survey",
          h("div", { class: "pd-survey-cards" }, (p.urls || []).map(([label, url], i) => h("div", Object.assign({ class: "pd-card pd-survey-card" }, nth(i)),
            h("p", { class: "pd-survey-who" }, label), url && App.qrImage ? App.qrImage(url, `${label}のアンケート`) : null))));
      }
      if (p.type === "attend") {
        // 出席コード: 4桁のコードを大きく。やり方の動画をとなりに
        const code = String(p.code || "").replace(/\D/g, "").slice(0, 8);
        const digits = (code || "----").split("");
        return frame("pd-attend",
          h("div", { class: "pd-attend-row" },
            h("div", { class: "pd-attend-main" },
              h("p", { class: "pd-attend-lead" }, ...lines(p.msg || "")),
              h("div", { class: `pd-attend-code${code ? "" : " is-empty"}`, "aria-label": code ? `出席コード ${code.split("").join(" ")}` : "出席コード(未設定)" }, digits.map((d) => h("span", null, d === "-" ? "" : d))),
              p.note ? h("p", { class: "pd-note" }, `※ ${p.note}`) : null),
            p.video ? h("figure", { class: "pd-attend-video", title: "押すと大きくなります", onclick: (e) => attendZoom(e.currentTarget) },
              (() => { const v = h("video", { src: `../${p.video}`, poster: `../${String(p.video).replace(/\.mp4$/, ".jpg")}`, autoplay: true, muted: true, loop: true, playsinline: true, preload: "auto", "aria-label": "出席コードの入れ方の動画" }); v.muted = true; return v; })(),
              h("figcaption", null, "入れ方がわからない方はこちら(押すと大きくなります)")) : null));
      }
      if (p.type === "schedule") {
        return frame("pd-schedule",
          h("div", { class: "pd-sched-cards" }, (p.rows || []).map(([a, b], i) => h("div", Object.assign({ class: "pd-card pd-sched-card" }, nth(i)),
            h("span", { class: "pd-sched-ic" }, lineIcon("calendar")), h("p", { class: "pd-sched-day" }, a), h("p", { class: "pd-sched-time" }, b)))),
          p.note ? h("p", { class: "pd-note is-center" }, p.note) : null);
      }
      return h("div", { class: "pd pd-hero pd-closing" },
        h("img", { class: "pd-mark", src: "../assets/bt-ex5-mark-3d-512.png", alt: "" }),
        h("h2", { class: "pd-display" }, p.name),
        h("span", { class: "pd-rule", "aria-hidden": "true" }),
        h("p", { class: "pd-kicker" }, "BT-EX5 ・ 突破から、拡張へ"));
    }
    // 出席コードのやり方の動画: 押すと画面いっぱい(全画面)に。もう一度押すか Esc で元に戻る
    function attendZoom(f) {
      const on = !f.classList.contains("is-zoom");
      const set = (v) => {
        f.classList.toggle("is-zoom", v);
        const pd = f.closest(".pd"); if (pd) pd.classList.toggle("is-video-zoom", v);
        const cap = f.querySelector("figcaption"); if (cap) cap.textContent = v ? "押すと元の大きさに戻ります" : "入れ方がわからない方はこちら(押すと大きくなります)";
      };
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (on) {
        set(true);
        const req = f.requestFullscreen || f.webkitRequestFullscreen;
        if (req && !fsEl) {
          try {
            const pr = req.call(f);
            const off = () => { if (!(document.fullscreenElement || document.webkitFullscreenElement)) { set(false); document.removeEventListener("fullscreenchange", off); document.removeEventListener("webkitfullscreenchange", off); } };
            document.addEventListener("fullscreenchange", off); document.addEventListener("webkitfullscreenchange", off);
            if (pr && pr.catch) pr.catch(() => {});
          } catch { /* 全画面にできない端末は、画面いっぱいの表示だけ */ }
        }
      } else {
        set(false);
        if (fsEl) { const ex = document.exitFullscreen || document.webkitExitFullscreen; try { const pr = ex.call(document); if (pr && pr.catch) pr.catch(() => {}); } catch { /* noop */ } }
      }
    }
    // 横長の画面では、スライドが枠に収まらないときだけ全体を縮めて収める(スマホなどの縦長は下へ送れる)
    const tallScreen = window.matchMedia("(max-aspect-ratio: 1/1), (max-width: 760px)");
    function fitDeck() {
      const el = slide.firstElementChild;
      if (!el || !el.classList.contains("pd")) return;
      el.style.transform = ""; el.style.transformOrigin = "";
      const body = el.classList.contains("pd-frame") ? el.querySelector(":scope > .pd-body") : null;
      if (body) { body.style.transform = ""; body.style.transformOrigin = ""; }
      // 大きな数字(約束・実績のタイル): 枠に入りきらないときは、その数字だけ小さくする(枠に触れない)
      el.querySelectorAll(".pd-kpi b, .pd-stats b").forEach((b) => {
        b.style.fontSize = ""; b.style.height = "";
        const box = b.parentElement;
        const cs = getComputedStyle(box);
        const room = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (room > 0 && b.scrollWidth > room) {
          // 小さくしても、数字の欄の高さは元のまま(下の線の位置が、ほかのカードとそろうように)
          const h0 = b.getBoundingClientRect().height;
          b.style.fontSize = `${(parseFloat(getComputedStyle(b).fontSize) * (room / b.scrollWidth) * 0.96).toFixed(2)}px`;
          b.style.height = `${h0}px`;
        }
      });
      // カードの文: 1行が入りきらないときは、同じスライドのカードの文をそろって小さくする
      // 用語説明の言葉(dt)は1行で。入りきらないときは、その言葉だけ小さくする
      el.querySelectorAll(".pd-gloss dt").forEach((t) => {
        t.style.fontSize = "";
        if (t.clientWidth > 0 && t.scrollWidth > t.clientWidth) t.style.fontSize = `${(parseFloat(getComputedStyle(t).fontSize) * (t.clientWidth / t.scrollWidth) * 0.97).toFixed(2)}px`;
      });
      const texts = [...el.querySelectorAll(".pd-card-text, .pd-check-text, .pd-block ul, .pd-gloss dd")];
      texts.forEach((t) => { t.style.fontSize = ""; });
      // (行の左はしからカードの文の右はしまでを、使える幅とする。「パターン1:」の続きの行も同じ)
      const ratio = texts.reduce((r, t) => Math.min(r, [...t.querySelectorAll(".pd-line")].reduce((q, ln) => {
        const room = Math.min(t.getBoundingClientRect().right - ln.getBoundingClientRect().left - (parseFloat(getComputedStyle(t).paddingRight) || 0), t.clientWidth);
        return ln.scrollWidth > room && room > 0 ? Math.min(q, room / ln.scrollWidth) : q;
      }, 1)), 1);
      if (ratio < 1) texts.forEach((t) => { t.style.fontSize = `${(parseFloat(getComputedStyle(t).fontSize) * ratio * 0.97).toFixed(2)}px`; });
      if (tallScreen.matches) return;
      // カードを1枚ずつ送るスライド: どのスライドでもカードを同じ大きさ・同じ位置にする。
      // カードの高さは画面に入る高さで固定し、文が入りきらないカードは(全体を縮めずに)そのカードの文字を小さくする
      if (body && el.classList.contains("is-carousel")) {
        const stage = body.querySelector(".pd-car-stage"), foot = body.querySelector(".pd-car-foot");
        const cards = [...body.querySelectorAll(".pd-big-card")];
        if (stage && cards.length) {
          const padB = parseFloat(getComputedStyle(slide).paddingBottom) || 0;
          // 番号の列の高さ(注意書きのあるスライドも、ないスライドと同じに数える。カードの高さがスライドでちがわないように)
          const dots = foot && foot.querySelector(".pd-car-dots");
          const footH = dots ? dots.getBoundingClientRect().height + (parseFloat(getComputedStyle(body.querySelector(".pd-car")).rowGap) || 0) : 0;
          const room = slide.getBoundingClientRect().bottom - padB - stage.getBoundingClientRect().top - footH - 10;
          const cap = Math.min(520, Math.max(220, innerHeight * 0.46));
          el.style.setProperty("--big-h", `${Math.round(Math.max(160, Math.min(cap, room)))}px`);
          // 文が入りきらないカードだけ、そのカードの文字を小さくする(ほかのカードの文字はそのまま)
          cards.forEach((c) => {
            const fonts = [...c.querySelectorAll(".pd-big-head, .pd-big-text")];
            fonts.forEach((f) => { f.style.fontSize = ""; });
            // まずは絵と番号を小さく、すき間をつめる(文字はなるべく大きいまま)
            c.classList.remove("is-tight");
            if (c.scrollHeight > c.clientHeight) c.classList.add("is-tight");
            for (let pass = 0; pass < 6; pass++) {
              const k = c.clientHeight / Math.max(1, c.scrollHeight);
              if (k >= 1) break;
              fonts.forEach((f) => { f.style.fontSize = `${(parseFloat(getComputedStyle(f).fontSize) * Math.max(0.6, k) * 0.95).toFixed(2)}px`; });
            }
          });
        }
        return;
      }
      // 中身の上はし・下はし(段が枠の外へはみ出すこともあるので、段ごとに見る)を測り、
      // 入りきらないときは縮めて、枠の上下のまん中に置く
      const sr = slide.getBoundingClientRect(), er = el.getBoundingClientRect();
      // 題のあるスライド(pd-frame): 題(小見出し・題・要点)は縮めず、中身だけを縮める。
      // どのスライドでも題が同じ位置・同じ大きさになるように(運営の依頼)
      if (body) {
        const br = body.getBoundingClientRect();
        const kids = [br, ...[...body.children].map((c) => c.getBoundingClientRect())];
        const bottom = Math.max(...kids.map((r) => r.bottom), br.top + body.scrollHeight);
        const need = bottom - br.top, room = sr.bottom - br.top;
        if (need > room && room > 0) {
          const k = Math.max(0.55, (room / need) * 0.97);
          body.style.transformOrigin = "50% 0";
          body.style.transform = `scale(${k.toFixed(3)})`;
        }
        return;
      }
      const rects = [er, ...[...el.children].map((c) => c.getBoundingClientRect())];
      const top = Math.min(...rects.map((r) => r.top)), bottom = Math.max(...rects.map((r) => r.bottom), er.top + el.scrollHeight);
      // 代表の紹介: 左上を動かさずに、文の最後の行までスライドの下の余白の手前に収める(文が長いと下が切れていたため)
      if (el.classList.contains("pd-leader")) {
        const deep = Math.max(bottom, ...[...el.querySelectorAll("li, p")].map((x) => x.getBoundingClientRect().bottom));
        const limit = sr.bottom - (parseFloat(getComputedStyle(slide).paddingBottom) || 0);
        if (deep > limit && limit > top) {
          const k = Math.max(0.55, ((limit - top) / (deep - top)) * 0.98);
          el.style.transformOrigin = "0 0"; el.style.transform = `scale(${k.toFixed(3)})`;
        }
        return;
      }
      const need = bottom - top, room = slide.clientHeight - (el.classList.contains("pd-frame") ? Math.max(0, er.top - sr.top) : 0);
      if (need > room && room > 0) {
        const k = Math.max(0.6, (room / need) * 0.97);
        // 題のあるスライド(pd-frame)は上にそろえる(スライドを送っても題の位置が動かないように)。ほかは上下のまん中
        // 代表の紹介は左上を動かさずに縮める(小見出しの位置を、ほかのスライドとそろえる)
        const dy = el.classList.contains("pd-frame") ? Math.max(sr.top - er.top, (er.top - top) * k)
          : (sr.top + sr.bottom) / 2 - er.top - ((top + bottom) / 2 - er.top) * k;
        el.style.transformOrigin = "50% 0";
        el.style.transform = `translateY(${dy.toFixed(1)}px) scale(${k.toFixed(3)})`;
      }
    }
    window.addEventListener("resize", fitDeck);
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitDeck); } catch { /* noop */ }
    // 「こんな話が出たら」は、スライドの下(メーター)に重ならない範囲で、入るだけ出す(入らない分は後ろから省く)
    function fitTags() {
      // 肩書きが長くて入りきらないときは、肩書きの文字を少し小さくして最後まで出す
      const cat = slide.querySelector(".pr-catch");
      if (cat) {
        cat.style.fontSize = "";
        for (let n = 0; n < 6 && cat.scrollHeight > cat.clientHeight + 1; n++) {
          cat.style.fontSize = `${(parseFloat(getComputedStyle(cat).fontSize) * 0.93).toFixed(2)}px`;
        }
      }
      const tags = slide.querySelector(".pr-tags");
      if (!tags) return;
      const spans = [...tags.children];
      const row = tags.closest(".pr-row-tags");
      if (row) row.hidden = false;
      spans.forEach((s) => s.classList.remove("is-cut"));
      // 縦長の画面(スマホ)はスライドを下へ送って読めるので、高さでは省かず6つまで
      if (tallScreen.matches) { spans.forEach((s, i) => s.classList.toggle("is-cut", i >= 6)); return; }
      const sr = slide.getBoundingClientRect();
      if (!sr.height || !tags.getBoundingClientRect().height) return;
      const limit = sr.bottom - (parseFloat(getComputedStyle(slide).paddingBottom) || 0) - 4;
      for (let i = spans.length - 1; i > 0 && tags.getBoundingClientRect().bottom > limit; i--) spans[i].classList.add("is-cut");
      // 1つも入らないときは、欄ごと出さない
      if (row) row.hidden = tags.getBoundingClientRect().bottom > limit;
    }
    window.addEventListener("resize", fitTags);
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTags); } catch { /* noop */ }
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
      ["movie", "cover", "agenda", "section", "leader", "about", "vision", "list", "feature", "checks", "strengths", "venn", "kpis", "rules", "schedule", "raise", "closing", "glossary", "joinsteps", "survey", "attend", "staff"].forEach((t) => box.classList.toggle(`is-d-${t}`, isDeck(p) && p.type === t));
      box.classList.remove("is-edu");
      // スライドとプレゼンで操作バーの幅が変わる(スライドでは「はじめる」の場所をつめる)ので、置き直す
      if (box.dataset.kindWas !== String(isDeck(p))) { box.dataset.kindWas = String(isDeck(p)); if (box.classList.contains("dock-home")) requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))); }
      drawProgress();
      if (isDeck(p)) { App.fill(slide, deckSlide(p)); fitDeck(); return; }
      // スライドの間は残り時間の欄が隠れていて幅を測れないので、出たときに測りなおす
      if (!sec.style.width || parseFloat(sec.style.width) < 20) fixSecWidth();
      // 自分だけのタイマー: まん中に大きく「集中」「休憩」などと、次にくるもの
      if (p.kind === "timer" && opts.deck && p.material && (p.material.pages || []).length) {
        // エデュケーションコーナー: 資料を画面いっぱいに(1枚ずつ送る)。下のタイマー(メーター・残り時間)は資料の下のほうに重ねる
        box.classList.remove("is-rest");
        box.classList.add("is-edu");
        const topBar = box.querySelector(".pr-top");
        if (topBar) box.style.setProperty("--edu-top", `${Math.round(topBar.getBoundingClientRect().bottom + 6)}px`);
        const imgs = p.material.pages.map((pg, i) => {
          const img = h("img", { class: "pd-edu-img", alt: `${p.material.title} ${i + 1}枚目`, loading: i < 2 ? "eager" : "lazy", decoding: "async" });
          if (pg.url) img.src = pg.url;
          else if (App.eduPageUrl) App.eduPageUrl(pg.rev, pg.i).then((u) => { if (u) img.src = u; });
          return h("figure", { class: "pd-edu-page" }, img);
        });
        App.fill(slide, h("div", { class: "pd-edu" },
          h("p", { class: "pd-edu-title" }, h("span", null, p.name), h("b", null, p.material.title)),
          makeCarousel(imgs)));
        requestAnimationFrame(eduInsets);
        return;
      }
      if (p.kind === "timer" && opts.deck) {
        box.classList.remove("is-rest");
        App.fill(slide, h("div", { class: "pr-timer-slide is-big" },
          p.name ? h("p", { class: "pr-timer-name" }, p.name) : null,
          bigTime,
          p.sub && /回目/.test(p.name || "") ? h("p", { class: "pr-timer-sub" }, `1回 ${p.sub}`) : null));
        return;
      }
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
            // フリガナは BT-EX5 のメンバーだけ(ほかの BT-EX・ゲスト・ビジターの方は出さない)
            p.kana && p.kind === "member" ? h("p", { class: "pr-kana" }, p.kana) : null,
            // 肩書きは最後まで出す(活動範囲の欄はなくした。運営の依頼)
            p.catch ? h("p", { class: "pr-catch" }, p.catch) : null,
            h("dl", { class: "pr-rows" },
              // 欲しい紹介 ランキングがあるときは順位つきで(なければ「つながりたい人」の文)
              p.wantsRank && p.wantsRank.length
                ? h("div", { class: "pr-row-wants" }, h("dt", null, "欲しい紹介 ランキング"), h("dd", { class: "is-rank" }, h("ol", { class: "pr-rank" }, p.wantsRank.map((t, i) => h("li", { class: `is-r${i + 1}` }, h("b", null, `${i + 1}位`), h("span", null, t))))))
                : p.wants ? h("div", { class: "pr-row-wants" }, h("dt", null, "つながりたい人"), h("dd", null, p.wants)) : null,
              p.triggers && p.triggers.length ? h("div", { class: "pr-row-tags" }, h("dt", null, "こんな話が出たら"), h("dd", { class: "pr-tags" }, p.triggers.map((t) => h("span", null, t)))) : null))),
        h("div", { class: "pr-side" },
          face(p.photo, p.name, "pr-photo"),
          h("div", { class: "pr-next" },
            nexts.length
              ? nexts.map((n, i) => h("p", { class: i === 0 ? "is-first" : "" }, i === 0 ? h("b", null, "次 ▶ ") : null, `${two(persons.indexOf(n) + 1)} ${n.name}`))
              : h("p", { class: "is-first" }, h("b", null, "最後の方です")))));
      requestAnimationFrame(fitTags);
    }
    const running = () => Boolean(timer);
    const leftNow = () => (running() ? (endAt - Date.now()) / 1000 : left0);
    function draw() {
      if (done) return;
      const cur = people[idx];
      const pi = persons.indexOf(cur);
      setText(count, opts.deck ? (pi >= 0 ? `プレゼン ${two(pi + 1)} / ${two(persons.length)}` : "") : `${two(idx + 1)} / ${two(people.length)}`);
      if (jump) { let j = -1; jump.querySelectorAll("option").forEach((o) => { if (Number(o.value) <= idx) j = Number(o.value); }); if (jump.value !== String(j)) jump.value = String(j); }
      // スライドの間は「はじめる」を見えなくするだけ(場所は残す。「進む」などの位置が動かないように)
      const noTimer = isDeck(cur);
      pauseBtn.classList.toggle("is-slot", noTimer);
      pauseBtn.disabled = noTimer;
      if (noTimer) pauseBtn.setAttribute("aria-hidden", "true"); else pauseBtn.removeAttribute("aria-hidden");
      prevBtn.disabled = idx === 0;
      if (idx === people.length - 1 && opts.deck) setBtn(nextBtn, "close", "閉じる");
      else setBtn(nextBtn, "next", idx === people.length - 1 ? "おわり" : "進む");
      if (isDeck(cur)) { box.classList.remove("is-last", "is-red", "is-end", "is-gap"); return; }
      const gap = gapUntil > Date.now();
      const left = gap ? 0 : Math.max(0, leftNow());
      const on = Math.min(n, Math.ceil(left / unit - 1e-6));
      segs.forEach((s, i) => s.classList.toggle("is-on", i < on));
      if (meter.getAttribute("aria-valuenow") !== String(Math.ceil(left))) meter.setAttribute("aria-valuenow", String(Math.ceil(left)));
      const s = Math.ceil(left);
      // 「秒」は1分以上のとき見えなくするだけ(場所は残す。数字や文字が変わっても位置が動かないように)
      if (gap) { setText(secHead, gapLabel); setText(secNum, Math.ceil((gapUntil - Date.now()) / 1000)); secUnit.style.visibility = "visible"; }
      else { setText(secHead, "残り"); setText(secNum, fmt(s)); secUnit.style.visibility = s >= 60 ? "hidden" : "visible"; }
      if (opts.deck && cur.kind === "timer") setText(bigTime, s >= 60 ? fmt(s) : `0:${String(s).padStart(2, "0")}`);
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
    // back: 戻ってきたとき(カードは最後の1枚から見せる)
    function go(i, autoStart, back) {
      halt(); gapUntil = 0;
      closeBreak();
      if (i >= people.length) { finish(false); return; }
      const from = idx;
      idx = Math.max(0, i); per = durOf(people[idx]) || per; left0 = per;
      buildMeter();
      drawSlide();
      slide.classList.remove("is-in"); void slide.offsetWidth; slide.classList.add("is-in");
      const c = carNow();
      if (c && back) requestAnimationFrame(() => c.show(c.n - 1, true));
      if (autoStart) start(); else draw();
      const p = people[idx];
      // 先へ進んで来たとき: オープニングムービーは流す。商談の区切りでは「休憩しませんか?」
      if (idx > from && isDeck(p) && p.type === "movie" && from >= 0) playMovie();
      if (idx > from && isDeck(p) && p.breakAsk && !breakAsked) { breakAsked = true; askBreak(); }
    }
    // ---------- 休憩のおさそい(商談の区切りのスライドに入ったとき) ----------
    // 「休む」を押すと1分の休憩の画面。「進む」(または画面のボタン)ですぐに終えられる
    let breakLayer = null, breakTimer = null, breakAsked = false, breakForced = false, breakAsking = false;
    function closeBreak() {
      if (breakForced) { nudgeBreak(); return; }
      // 「休憩しませんか?」のあいだに「進む」「戻る」・Esc などを押したら、閉じずに警告の画面にする(進めません)
      if (breakAsking) { forceBreak("next"); return; }
      clearInterval(breakTimer); breakTimer = null;
      if (breakLayer) { const el = breakLayer; breakLayer = null; el.classList.add("is-out"); setTimeout(() => el.remove(), 220); }
    }
    function askBreak() {
      closeBreak();
      breakLayer = h("div", { class: "pr-break", role: "dialog", "aria-modal": "true", "aria-label": "休憩のおさそい" },
        h("div", { class: "pr-break-card" },
          h("div", { class: "pr-break-cup", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("span", { class: "pr-break-mug" })),
          h("p", { class: "pr-break-kicker" }, "ちょっと待って!"),
          h("h2", { class: "pr-break-title" }, "休憩しませんか?"),
          h("p", { class: "pr-break-text" }, "ここから商談がはじまります。", h("br"), "お水を飲んだり、体を伸ばしたりして、ひと息つきましょう"),
          h("div", { class: "pr-break-btns" },
            h("button", { type: "button", class: "pr-break-btn is-main", onclick: startBreak }, "休む(1分)"),
            h("button", { type: "button", class: "pr-break-btn", onclick: forceBreak }, "このまま続ける"))));
      box.append(breakLayer);
      breakAsking = true;
      breakLayer.querySelector(".is-main").focus({ preventScroll: true });
    }
    // 「このまま続ける」を押したとき: ウイルスに入られたような画面で覆い、「休む」しか押せないようにする
    // (この間は「進む」「戻る」・Esc では閉じず、カードをゆらすだけ)
    function forceBreak(via) {
      if (!breakLayer) return;
      breakAsking = false;
      breakForced = true;
      box.classList.add("is-break-forced"); // 下の操作バーも隠して、「休む」だけにする
      const ALERTS = ["休憩不足を検知しました", "集中力が低下しています", "水分が足りていません", "肩こりが進行中です", via === "next" ? "「進む」では進めません" : "「このまま続ける」は無効です", "休憩プロトコルを起動します", "深呼吸が必要です", "ERROR: 休憩をスキップできません"];
      // 警告の窓の場所(画面の割合)。順番に開いていく
      const SPOTS = [[6, 10], [58, 6], [14, 62], [64, 58], [36, 18], [4, 38], [70, 32], [40, 70]];
      const wins = ALERTS.map((t, i) => h("div", { class: "pr-hack-win", style: `left:${SPOTS[i][0]}%;top:${SPOTS[i][1]}%;animation-delay:${(i * 0.12).toFixed(2)}s`, "aria-hidden": "true" },
        h("p", { class: "pr-hack-win-bar" }, h("span", null, "⚠ SYSTEM ALERT"), h("i"), h("i"), h("i")),
        h("p", { class: "pr-hack-win-text" }, t)));
      breakLayer.classList.add("is-hacked");
      breakLayer.setAttribute("aria-label", "休憩が必要です");
      App.fill(breakLayer,
        h("div", { class: "pr-hack-noise", "aria-hidden": "true" }),
        h("div", { class: "pr-hack-wins" }, wins),
        h("div", { class: "pr-hack-card" },
          h("p", { class: "pr-hack-kicker" }, "⚠ WARNING ⚠"),
          h("h2", { class: "pr-hack-title", "data-text": "休憩をスキップ\nできません" }, "休憩をスキップ\nできません"),
          h("p", { class: "pr-hack-text" }, "体と頭を守るため、休憩を強制的に実行します。", h("br"), "下のボタンを押してください"),
          h("button", { type: "button", class: "pr-break-btn is-main pr-hack-btn", onclick: startBreak }, "休む(1分)")));
      breakLayer.querySelector(".pr-hack-btn").focus({ preventScroll: true });
    }
    // 休むしか選べないときに、ほかの操作をしたら、カードをゆらして知らせる
    function nudgeBreak() {
      const card = breakLayer && breakLayer.querySelector(".pr-hack-card");
      if (!card) return;
      card.classList.remove("is-shake"); void card.offsetWidth; card.classList.add("is-shake");
      const btn = card.querySelector(".pr-hack-btn");
      if (btn) btn.focus({ preventScroll: true });
    }
    function startBreak() {
      if (!breakLayer) return;
      breakAsking = false;
      breakForced = false;
      box.classList.remove("is-break-forced");
      breakLayer.classList.remove("is-hacked");
      breakLayer.setAttribute("aria-label", "休憩中");
      const TOTAL = 60, until = Date.now() + TOTAL * 1000;
      const TIPS = ["お水を一杯どうぞ", "肩をゆっくり回してみましょう", "深呼吸を3回", "次の商談で話したいことを1つ決めておきましょう", "まもなく商談がはじまります"];
      const num = h("b", { class: "pr-break-num" });
      const bar = h("i");
      const tip = h("p", { class: "pr-break-tip" });
      App.fill(breakLayer, h("div", { class: "pr-break-load" },
        h("div", { class: "pr-break-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
        h("p", { class: "pr-break-now" }, "休憩中"), num,
        h("div", { class: "pr-break-bar", "aria-hidden": "true" }, bar), tip,
        h("button", { type: "button", class: "pr-break-btn is-main", onclick: closeBreak }, "休憩を終えて進む"),
        h("p", { class: "pr-break-hint" }, "下の「進む」でも、すぐに再開できます")));
      const upd = () => {
        const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        num.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
        bar.style.width = `${((TOTAL - left) / TOTAL) * 100}%`;
        tip.textContent = TIPS[Math.min(TIPS.length - 1, Math.floor(((TOTAL - left) / TOTAL) * TIPS.length))];
        if (left <= 0) { try { App.timerSound.end(); } catch { /* noop */ } closeBreak(); }
      };
      upd();
      breakTimer = setInterval(upd, 250);
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
      const topWas = ctrl.style.top;
      const back = () => { asking = null; ctrl.classList.remove("is-asking"); ctrl.style.top = topWas; ctrl.replaceChildren(...before); pauseBtn.focus({ preventScroll: true }); };
      asking = back;
      // 「進行を終わりますか?」は、「つづける」「終わる」の上に出す
      ctrl.classList.add("is-asking");
      App.fill(ctrl, dockGrip,
        h("p", { class: "pr-ask" }, "進行を終わりますか?"),
        dockBtn("play", "つづける", "", back),
        dockBtn("end", "終わる", "is-main", () => { asking = null; ctrl.classList.remove("is-asking"); finish(false, true); }));
      // 上の段がふえた分、画面の下からはみ出すときは上へずらす(「つづける」で元の場所に戻す)
      const over = ctrl.getBoundingClientRect().bottom - (innerHeight - 8);
      if (over > 0 && topWas) ctrl.style.top = `${Math.max(8, parseFloat(topWas) - over)}px`;
      ctrl.querySelector(".is-main").focus({ preventScroll: true });
    }
    function finish(early, confirmed) {
      if (early && !confirmed) { askEnd(); return; }
      // 定例会のスライドは「おつかれさまでした」を出さず、最後のスライドからそのまま閉じる
      if (opts.deck) { halt(); gapUntil = 0; closeRun(); return; }
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
      if (e.key === " ") { e.preventDefault(); if (!done) { if (isDeck(people[idx]) || breakLayer) forward(); else pauseBtn.click(); } }
      else if (e.key === "ArrowRight" && !done) forward();
      else if (e.key === "ArrowLeft" && done) reopen();
      else if (e.key === "ArrowLeft" && !done) backward();
      else if (e.key === "Escape") { if (breakLayer) closeBreak(); else if (done) closeRun(); else if (asking) asking(); else finish(true); }
    }
    document.addEventListener("keydown", onKey);
    drawSlide();
    draw();
    pauseBtn.focus({ preventScroll: true });
    if (isDeck(people[0]) && people[0].type === "movie") { nextBtn.focus({ preventScroll: true }); playMovie(); }
    // タイムマネジメント・操作バーが、スライドの文字に重ならないように(広い画面で左右のはしにあるとき、スライドの中身をよける)
    const avoidTimer = opts.deck ? setInterval(avoidFloaters, 800) : 0;
    function avoidFloaters() {
      if (closed) { clearInterval(avoidTimer); return; }
      const wide = (document.documentElement.clientWidth || innerWidth) > 760 && innerWidth > innerHeight;
      let padL = 0, padR = 0;
      // 資料を画面いっぱいに出すとき(エデュケーションコーナー)は、よけない(タイマー・操作バーは資料の上に重ねる)
      if (wide && !box.classList.contains("is-edu")) {
        const sr = slide.getBoundingClientRect();
        [timing && timing.el, dock].forEach((el) => {
          if (!el || !el.isConnected) return;
          const r = el.getBoundingClientRect();
          if (!r.width || r.bottom < sr.top + 12 || r.top > sr.bottom - 12) return;
          if (r.left - sr.left < sr.width * 0.3) padL = Math.max(padL, r.right - sr.left + 14);
          else if (sr.right - r.right < sr.width * 0.3) padR = Math.max(padR, sr.right - r.left + 14);
        });
        padL = Math.min(padL, sr.width * 0.32); padR = Math.min(padR, sr.width * 0.32);
      }
      const key = `${Math.round(padL)}|${Math.round(padR)}`;
      if (slide.dataset.avoid === key) return;
      slide.dataset.avoid = key;
      slide.style.paddingLeft = padL ? `${Math.round(padL)}px` : "";
      slide.style.paddingRight = padR ? `${Math.round(padR)}px` : "";
      if (isDeck(people[idx])) fitDeck();
      if (box.classList.contains("is-edu")) eduInsets();
    }
    // エデュケーションコーナーの資料: 上の帯(タイムマネジメントなど)と下のタイマー・操作バーの間に収める(資料の下のはしまで見えるように)
    function eduInsets() {
      const vh = innerHeight;
      let top = 0, bottom = vh;
      const rect = (el) => (el && el.isConnected && el.offsetParent !== null ? el.getBoundingClientRect() : null);
      [timing && timing.el, ...box.querySelectorAll(".pr-top > *")].forEach((el) => {
        const r = rect(el);
        if (r && r.height && getComputedStyle(el).visibility !== "hidden" && r.top < vh * 0.25) top = Math.max(top, r.bottom);
      });
      [meterBox, sec, dock].forEach((el) => {
        const r = rect(el);
        if (r && r.height && r.bottom > vh * 0.75) bottom = Math.min(bottom, r.top);
      });
      const t = `${Math.round(top ? top + 8 : 0)}px`, b = `${Math.round(bottom < vh ? vh - bottom + 8 : 0)}px`;
      if (box.style.getPropertyValue("--edu-t") !== t) box.style.setProperty("--edu-t", t);
      if (box.style.getPropertyValue("--edu-b") !== b) box.style.setProperty("--edu-b", b);
    }
    if (opts.deck) avoidFloaters();
  };
})();
