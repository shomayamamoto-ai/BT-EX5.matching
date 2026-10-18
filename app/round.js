// ============================================
// app/round.js — 30秒プレゼン(下のメニューの「プレゼン」)
// 定例会の「30秒プレゼンテーション」を、顔写真と紹介つきの大きな画面で順番に進める。
// ・準備(#present): 定例会を選ぶ → 出る人を押して選ぶ(押した順が話す順番)→ 並べかえ(つかんで動かす・↑↓・シャッフル)
//   → 1人の時間(30秒・1分・2分・3分)→「全画面ではじめる」
// ・進行(全画面): 番号・名前・肩書き・活動範囲・つながりたい人・こんな話が出たら・顔写真・次の人、
//   下に時間のメーター(1目盛り=1秒。残り10秒でオレンジ、残り5秒で赤)と残り秒数。
//   残り10秒と 0秒で音(鐘)。「自動で次へ」なら 0秒のあと3秒で次の人へ。
//   キー操作: スペース=止める・つづける、→=次へ、←=前へ、F=全画面、Esc=終わる(会場のスクリーンや Meet の画面共有で映す想定)
// 連絡先は出さない(名簿でメンバーが見られる内容だけ)
// 顔写真: 本人(または運営)がこの画面で入れた写真 → 運営が用意した写真(REF_MEMBER_PHOTOS)→ 頭文字
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const PER = [[30, "30秒"], [60, "1分"], [120, "2分"], [180, "3分"]];
  const SEGMENTS = 30;
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
        area: areaLine(m), wants: clip(m.wants, 110), triggers: (m.triggers || []).slice(0, 4),
      };
    }
    return null;
  }

  // ---------- 準備(下のメニューの「プレゼン」) ----------
  App.views.present = {
    title: "30秒プレゼン",
    async render(el, parts, params) { await renderSetup(el, params); },
  };
  // 以前の入口(定例会の画面・ホーム)からは、この画面へ
  App.roundSheet = function (opts = {}) {
    App.go(opts.eventId ? `present?event=${encodeURIComponent(opts.eventId)}` : "present");
  };

  async function renderSetup(el, params) {
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
    const byKey = (k) => all.find((x) => x.key === k);
    const saveKey = `order-${ev ? ev.id : "none"}`;
    // はじめの順番: この定例会で前に決めた順番 → 出席予定の人(名簿の順)
    let order = (() => {
      try { const s = JSON.parse(store.get(saveKey, "null")); if (Array.isArray(s)) return s.filter((k) => byKey(k)); } catch { /* noop */ }
      return [...going];
    })();
    let per = Number(store.get("per", 30)) || 30;
    if (!PER.some(([v]) => v === per)) per = 30;
    let auto = store.get("auto", "1") === "1";
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
      h("span", { class: "pr-card-name" }, x.name),
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
        h("span", { class: "round-name" }, h("b", null, x.name), x.kind === "visitor" ? App.chip("ビジター", "info") : null, x.company ? h("small", null, x.company) : null),
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

    function draw() {
      saveOrder();
      App.fill(grid, all.map(card));
      App.fill(listEl, order.length ? order.map(row) : h("li", { class: "pr-order-empty" }, "上の一覧から、話す順に押してください"));
      const sec = order.length * per;
      total.textContent = order.length ? `${order.length}名 × ${PER.find(([v]) => v === per)[1]} = 約${Math.floor(sec / 60)}分${sec % 60 ? `${sec % 60}秒` : ""}` : "";
      goBtn.textContent = order.length ? `全画面ではじめる(${order.length}名)` : "出る人を選んでください";
      goBtn.disabled = !order.length;
    }

    const perRow = h("div", { class: "pitch-lens round-per" }, PER.map(([v, label]) =>
      h("button", { type: "button", class: `pitch-len${v === per ? " is-on" : ""}`, onclick: (e) => {
        per = v; store.set("per", v);
        perRow.querySelectorAll(".pitch-len").forEach((b) => b.classList.toggle("is-on", b === e.currentTarget));
        draw();
      } }, label)));
    const autoBox = h("input", { type: "checkbox", onchange: () => { auto = autoBox.checked; store.set("auto", auto ? "1" : "0"); } });
    autoBox.checked = auto;

    goBtn.addEventListener("click", () => {
      const people = order.map((k) => {
        const p = personOf(k, photos);
        if (p) return p;
        const x = byKey(k);
        return x ? { key: k, kind: x.kind, name: x.name, catch: x.company, photo: "", area: "", wants: "", triggers: [] } : null;
      }).filter(Boolean);
      if (!people.length) return;
      App.roundRun(people, per, auto, ev ? ev.title : "");
    });

    const me = App.session && App.memberById(App.session.memberId);
    const myPhoto = me ? photos[me.id] : "";
    const goingN = going.size;
    App.fill(el,
      h("section", { class: "app-section pr-intro" },
        h("p", { class: "app-lead" }, "定例会の30秒プレゼンを、顔写真と紹介つきの大きな画面で順番に進めます。会場のスクリーンや Meet の画面共有でそのまま映せます。"),
        me ? h("div", { class: "pr-me" },
          face(myPhoto, me.name, "pr-me-face"),
          h("div", { class: "pr-me-text" },
            h("b", null, myPhoto ? "あなたの写真が入っています" : "あなたの顔写真を入れましょう"),
            h("small", null, "プレゼンの画面に大きく出ます。縦長に切り抜いて、小さくして保存します。")),
          h("div", { class: "pr-me-btns" },
            App.btn(myPhoto ? "変える" : "写真を入れる", () => App.choosePhoto(me.id, () => App.route()), "ghost small"),
            myPhoto && memo[me.id] ? App.btn("外す", () => App.removePhoto(me.id, () => App.route()), "ghost small") : null)) : null),
      h("section", { class: "app-section" },
        h("p", { class: "round-label" }, "定例会"), evSel,
        h("div", { class: "round-head" },
          h("p", { class: "round-label" }, "出る人を選ぶ(押した順が話す順番)"),
          h("div", { class: "app-btn-row pr-quick" },
            goingN ? App.btn(`出席予定の人(${goingN}名)`, () => { order = [...going]; draw(); }, "ghost small") : null,
            App.btn(`全員(${members.length}名)`, () => { order = all.filter((x) => x.kind === "member" && !absent.has(x.key)).map((x) => x.key); draw(); }, "ghost small"),
            teamSel,
            App.btn("選び直す", () => { order = []; draw(); }, "ghost small"))),
        grid),
      h("section", { class: "app-section" },
        h("div", { class: "round-head" }, h("p", { class: "round-label" }, "話す順番"),
          h("div", { class: "app-btn-row" },
            App.btn("シャッフル", () => { order = shuffle(order); draw(); }, "ghost small"),
            App.btn("名前の順", () => { order = order.slice().sort((a, b) => byKey(a).name.localeCompare(byKey(b).name, "ja")); draw(); }, "ghost small"))),
        h("p", { class: "app-field-hint pr-drag-hint" }, "パソコンでは行をつかんで動かせます。スマホは ↑↓ で動かします。"),
        listEl, total),
      h("section", { class: "app-section" },
        h("p", { class: "round-label" }, "1人の時間"), perRow,
        h("label", { class: "pitch-sound" }, autoBox, h("span", null, "0秒になったら、3秒あけて自動で次の人へ")),
        h("p", { class: "app-field-hint" }, "残り10秒で小さな音、0秒で鐘の音が鳴ります。キーボードでは スペース=止める・つづける、→=次へ、←=前へ、F=全画面、Esc=終わる。")),
      h("div", { class: "pr-go-bar" }, goBtn));
    draw();
  }

  // ---------- 進行(全画面) ----------
  App.roundRun = function (people, per, auto, title) {
    App.timerSound.ready();
    let idx = 0, endAt = 0, left0 = per, timer = null, warned = false, gapUntil = 0, wake = null, done = false;
    const segs = Array.from({ length: SEGMENTS }, (_, i) => h("i", { class: i >= SEGMENTS - 5 ? "is-red" : i >= SEGMENTS - 10 ? "is-orange" : "" }));
    const meter = h("div", { class: "pr-meter", role: "progressbar", "aria-label": "経過時間", "aria-valuemin": "0", "aria-valuemax": String(per) }, segs);
    const secNum = h("b", { class: "pr-sec-num" });
    const secUnit = h("small", null, "秒");
    const sec = h("div", { class: "pr-sec", "aria-live": "off" }, secNum, secUnit);
    const count = h("p", { class: "pr-count" });
    const slide = h("div", { class: "pr-slide" });
    const pauseBtn = h("button", { type: "button", class: "round-btn is-main" });
    const prevBtn = h("button", { type: "button", class: "round-btn", onclick: () => go(idx - 1) }, "◀ 前へ");
    const nextBtn = h("button", { type: "button", class: "round-btn", onclick: () => go(idx + 1) }, "次へ ▶");
    const fullBtn = h("button", { type: "button", class: "round-btn pr-full", onclick: toggleFull }, "全画面");
    const endBtn = h("button", { type: "button", class: "round-btn round-end", onclick: () => finish(true) }, "終わる");
    const box = h("div", { class: "pr-run", role: "dialog", "aria-label": "30秒プレゼンの進行" },
      h("div", { class: "pr-top" }, h("p", { class: "pr-title" }, title ? `${title} ・ 30秒プレゼン` : "30秒プレゼン"), count),
      slide,
      h("div", { class: "pr-meter-row" }, meter, sec),
      h("div", { class: "round-ctrl pr-ctrl" }, prevBtn, pauseBtn, nextBtn, fullBtn, endBtn));
    document.body.append(box);
    document.documentElement.classList.add("round-open");
    try { if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then((w) => { wake = w; }).catch(() => {}); } catch { /* noop */ }
    // 押した流れのまま全画面にする(ブラウザが断ったときは、そのまま画面いっぱいで進める)
    function toggleFull() {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (box.requestFullscreen) box.requestFullscreen().catch(() => {});
      } catch { /* noop */ }
    }
    toggleFull();
    // 写真は先に読みこんでおく(切りかえたときにすぐ出るように)
    people.forEach((p) => { if (p.photo) { const im = new Image(); im.src = p.photo; } });

    function drawSlide() {
      const p = people[idx];
      const nexts = people.slice(idx + 1, idx + 4);
      App.fill(slide,
        h("div", { class: "pr-info" },
          h("p", { class: "pr-no", "aria-hidden": "true" }, two(idx + 1)),
          h("div", { class: "pr-body" },
            h("p", { class: "pr-teamname" }, p.kind === "visitor" ? "ビジター" : p.team || ""),
            h("h2", { class: "pr-name" }, p.name, h("small", null, "さん")),
            p.catch ? h("p", { class: "pr-catch" }, p.catch) : null,
            h("dl", { class: "pr-rows" },
              p.area ? h("div", null, h("dt", null, "活動範囲"), h("dd", null, p.area)) : null,
              p.wants ? h("div", null, h("dt", null, "つながりたい人"), h("dd", null, p.wants)) : null,
              p.triggers && p.triggers.length ? h("div", null, h("dt", null, "こんな話が出たら"), h("dd", { class: "pr-tags" }, p.triggers.map((t) => h("span", null, t)))) : null))),
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
      const elapsed = per - left;
      const on = Math.min(SEGMENTS, Math.ceil((elapsed / per) * SEGMENTS - 1e-6));
      segs.forEach((s, i) => s.classList.toggle("is-on", i < on));
      meter.setAttribute("aria-valuenow", String(Math.round(elapsed)));
      const s = Math.ceil(left);
      if (gap) { secNum.textContent = String(Math.ceil((gapUntil - Date.now()) / 1000)); secUnit.textContent = "秒後に次へ"; }
      else { secNum.textContent = fmt(s); secUnit.textContent = per >= 60 && s >= 60 ? "" : "秒"; }
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
        if (auto && idx < people.length - 1) { gapUntil = Date.now() + 3000; timer = setInterval(tick, 100); }
      }
      draw();
    }
    function go(i, autoStart) {
      halt(); gapUntil = 0;
      if (i >= people.length) { finish(false); return; }
      idx = Math.max(0, i); left0 = per;
      drawSlide();
      slide.classList.remove("is-in"); void slide.offsetWidth; slide.classList.add("is-in");
      if (autoStart) start(); else draw();
    }
    pauseBtn.addEventListener("click", () => {
      if (gapUntil) { halt(); gapUntil = 0; draw(); return; }
      if (running()) { left0 = Math.max(0.1, leftNow()); halt(); draw(); } else start();
    });
    function finish(early) {
      if (early && !confirm("進行を終わりますか?")) return;
      halt(); gapUntil = 0; done = true;
      const said = early ? idx : people.length;
      box.classList.remove("is-last", "is-red", "is-end", "is-gap");
      box.classList.add("is-done");
      App.fill(slide, h("div", { class: "pr-done" }, h("p", { class: "pr-name" }, "おつかれさまでした"), h("p", { class: "pr-catch" }, `${said}名の方が話しました`)));
      App.fill(box.querySelector(".pr-ctrl"), h("button", { type: "button", class: "round-btn is-main", onclick: closeRun }, "閉じる"));
    }
    function closeRun() {
      halt(); box.remove(); document.documentElement.classList.remove("round-open");
      document.removeEventListener("keydown", onKey);
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* noop */ }
      try { if (wake) wake.release(); } catch { /* noop */ }
    }
    function onKey(e) {
      if (e.target.closest && e.target.closest("input, textarea, select")) return;
      if (e.key === " ") { e.preventDefault(); if (!done) pauseBtn.click(); }
      else if (e.key === "ArrowRight" && !done) go(idx + 1);
      else if (e.key === "ArrowLeft" && !done && idx > 0) go(idx - 1);
      else if ((e.key === "f" || e.key === "F") && !done) toggleFull();
      else if (e.key === "Escape") { if (document.fullscreenElement) return; if (done) closeRun(); else finish(true); }
    }
    document.addEventListener("keydown", onKey);
    drawSlide();
    draw();
    pauseBtn.focus({ preventScroll: true });
  };
})();
