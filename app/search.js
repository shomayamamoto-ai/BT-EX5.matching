// ============================================
// app/search.js — アプリ内をまとめて探す(上の 🔍。パソコンは「/」か Ctrl+K でも開く)
// メンバー(名前・会社・事業・求める紹介・こんな話が出たら)・掲示板・運営連絡・定例会を一度に探す
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const norm = (s) => String(s || "").toLowerCase().normalize("NFKC");

  // 見つかった言葉のまわりだけを切り出し、言葉に印をつける
  function snippet(text, words, len = 60) {
    const src = String(text || "").replace(/\s+/g, " ").trim();
    // 1文字ずつ正規化し、正規化したあとの位置 → 元の文字の位置 の対応を作る
    // (全角・半角や「…」のように、正規化で長さが変わる文字があっても、印の位置がずれないように)
    let low = "";
    const at = [];
    for (let i = 0; i < src.length; i++) {
      const n = norm(src[i]);
      for (let k = 0; k < n.length; k++) at.push(i);
      low += n;
    }
    at.push(src.length);
    const hits = [];
    words.filter(Boolean).forEach((w) => {
      let i = low.indexOf(w);
      while (i >= 0) { hits.push([at[i], at[i + w.length]]); i = low.indexOf(w, i + w.length); }
    });
    hits.sort((a, b) => a[0] - b[0]);
    const first = hits.length ? hits[0][0] : 0;
    const from = first ? Math.max(0, first - 18) : 0;
    const to = Math.min(src.length, from + len);
    const out = h("span", { class: "srch-snip" });
    if (from) out.append("…");
    let pos = from;
    hits.forEach(([a, b]) => {
      if (a < pos || a >= to) return;
      out.append(src.slice(pos, a), h("mark", null, src.slice(a, Math.min(b, to))));
      pos = Math.min(b, to);
    });
    out.append(src.slice(pos, to));
    if (to < src.length) out.append("…");
    return out;
  }

  let cache = null;
  async function load() {
    if (cache && Date.now() - cache.at < 60 * 1000) return cache;
    const [board, news, events] = await Promise.all([
      App.api("listBoard", {}, { quiet: true }),
      App.api("listAnnouncements", {}, { quiet: true }),
      App.api("listEvents", {}, { quiet: true }),
    ]);
    cache = { at: Date.now(), posts: (board && board.items) || [], anns: (news && news.items) || [], events: (events && events.events) || [] };
    return cache;
  }

  function open() {
    App.openSheet("アプリ内を探す", (body, close) => {
      const input = h("input", { type: "search", class: "srch-input", placeholder: "人の名前・仕事・掲示板の言葉など", "aria-label": "探す言葉", autocomplete: "off", enterkeyhint: "search" });
      const results = h("div", { class: "srch-results", "aria-live": "polite" },
        h("p", { class: "srch-hint" }, "メンバー(名前・会社・事業・求める紹介)・掲示板・運営連絡・定例会をまとめて探します。"));
      body.append(input, results);
      setTimeout(() => input.focus(), 50);
      let data = null;
      load().then((d) => { data = d; draw(); });
      const go = (href) => { close(); location.href = href; };
      function section(title, rows) {
        return rows.length ? h("section", { class: "srch-sec" }, h("h3", null, `${title}(${rows.length})`), h("ul", { class: "app-list" }, rows)) : null;
      }
      function row(href, icon, title, sub) {
        return h("li", null, h("a", { class: "app-row", href, onclick: (e) => { e.preventDefault(); go(href); } }, icon, h("span", { class: "app-row-main" }, h("b", null, title), sub ? h("small", null, sub) : null)));
      }
      function draw() {
        const words = norm(input.value).split(/\s+/).filter(Boolean);
        if (!words.length) { App.fill(results, h("p", { class: "srch-hint" }, "メンバー(名前・会社・事業・求める紹介)・掲示板・運営連絡・定例会をまとめて探します。")); return; }
        const match = (text) => { const t = norm(text); return words.every((w) => t.includes(w)); };
        const mem = App.members.filter((m) => match([m.name, m.company, m.category, m.business, m.wants, (m.triggers || []).join(" "), m.team].join(" "))).slice(0, 10)
          .map((m) => row(App.profileHref(m.id, "home"), App.avatar(m.name), m.name, snippet([m.company, m.business, m.wants, (m.triggers || []).join(" ")].filter(Boolean).join(" ・ "), words)));
        const posts = data ? data.posts.filter((p) => match([p.body, p.byName, p.cat, ...(p.comments || []).map((c) => c.body)].join(" "))).slice(0, 8)
          .map((p) => row(`#board?post=${p.id}`, h("span", { class: "srch-ico" }, App.glyph("post")), `${p.byName}さん ・ ${p.cat}`, snippet(p.body, words))) : [];
        const anns = data ? data.anns.filter((a) => match([a.title, a.body].join(" "))).slice(0, 8)
          .map((a) => row(`#news?open=${a.id}`, h("span", { class: "srch-ico" }, App.glyph("ann")), a.title, snippet(a.body, words))) : [];
        const evs = data ? data.events.filter((e) => match([e.title, e.place, e.body, e.agenda, e.date].join(" "))).slice(0, 6)
          .map((e) => row(`#events/detail/${e.id}`, h("span", { class: "srch-ico" }, App.glyph("calendar")), `${App.fmtDate(e.date)} ${e.title}`, snippet([e.place, e.body, e.agenda].filter(Boolean).join(" ・ ") || e.title, words))) : [];
        const all = [section("メンバー", mem), section("掲示板", posts), section("運営連絡", anns), section("定例会", evs)].filter(Boolean);
        App.fill(results, all.length ? all : h("p", { class: "srch-hint" }, data ? "見つかりませんでした。言葉を短くするか、別の言い方で探してください。" : "読み込み中…"));
      }
      input.addEventListener("input", draw);
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const first = results.querySelector("a.app-row");
        if (first) { e.preventDefault(); first.click(); }
      });
    }, { noFocus: true });
  }

  document.addEventListener("click", (e) => { if (e.target.closest("#appSearchBtn")) open(); });
  // パソコン: 「/」か Ctrl+K(Mac は ⌘K)で開く(入力中は「/」をそのまま打てるように)
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
      if (document.querySelector(".app-sheet-wrap")) return;
      e.preventDefault();
      open();
    }
  });
  App.openSearch = open;
  // ほかのページの上の帯の「検索」から来たとき(#log/home?search=1)は、すぐ検索を開く
  if (/[?&]search=1/.test(location.hash)) {
    history.replaceState(null, "", "#log/home");
    window.addEventListener("load", () => setTimeout(open, 400));
  }
})();
