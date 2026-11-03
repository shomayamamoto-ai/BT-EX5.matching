// ============================================
// app/seeds.js — 紹介のタネ帳(自分だけが見られるメモ)
// 定例会でプレゼンを聞きながら「この人に紹介できそう」を残し(定例会メモ #meeting)、
// あとで「記録 → 紹介のタネ」から、紹介の記録・1on1 にする。
// 共有サーバーに保存する(saveSeed / listSeeds / deleteSeed)。サーバーがまだ古いときは、この端末に保存し、
// 新しくなったら自動でサーバーへ移す
// ============================================
(function () {
  "use strict";
  const h = App.h;

  // ---------- 保存のしくみ ----------
  const canLog = () => !!(App.canLog && App.canLog());
  const localKey = () => `btex5-seeds-${(App.session && App.session.memberId) || "me"}`;
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(localKey()) || "[]"); } catch { return []; } };
  const writeLocal = (list) => { try { localStorage.setItem(localKey(), JSON.stringify(list)); } catch { /* noop */ } };
  let mode = null; // "server" | "local"
  let cache = null, cacheAt = 0;

  async function list(force) {
    if (cache && !force && Date.now() - cacheAt < 60000) return cache;
    const res = await AuthApi.call("listSeeds", {});
    if (res.success) {
      mode = "server";
      // この端末に残っていたメモを、サーバーへ移す
      const local = readLocal();
      if (local.length) {
        for (const x of local) await AuthApi.call("saveSeed", { seed: { toId: x.toId, note: x.note, eventId: x.eventId, eventTitle: x.eventTitle, eventDate: x.eventDate, done: x.done } });
        writeLocal([]);
        return list(true);
      }
      cache = res.data.items;
    } else {
      // 共有サーバーがまだ古い(この機能がない)・電波がない: この端末の保存を使う
      mode = "local";
      cache = readLocal().slice().sort((a, b) => b.at - a.at);
    }
    cacheAt = Date.now();
    return cache;
  }
  async function save(seed) {
    if (mode === null) await list();
    if (mode === "server") {
      const res = await AuthApi.call("saveSeed", { seed });
      if (!res.success) { App.toast((res.error && res.error.message) || "保存できませんでした", "error"); return null; }
      cache = null;
      return res.data.item;
    }
    const all = readLocal();
    const m = App.memberById(seed.toId);
    let x = seed.id ? all.find((s) => s.id === seed.id) : null;
    if (!x) { x = { id: `ls_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() }; all.push(x); }
    Object.assign(x, { toId: seed.toId, toName: m ? m.name : seed.toName || "", note: String(seed.note || "").slice(0, 400), eventId: seed.eventId || "", eventTitle: seed.eventTitle || "", eventDate: seed.eventDate || "", done: !!seed.done });
    writeLocal(all.slice(-300));
    cache = null;
    return x;
  }
  async function remove(id) {
    if (mode === null) await list();
    if (mode === "server") { const res = await AuthApi.call("deleteSeed", { id }); cache = null; return res.success; }
    writeLocal(readLocal().filter((s) => s.id !== id));
    cache = null;
    return true;
  }
  async function pendingCount() {
    try { return (await list()).filter((s) => !s.done).length; } catch { return 0; }
  }
  App.Seeds = { list, save, remove, pendingCount };

  // ---------- メモを書く ----------
  // ev: { id, title, date } はどの定例会のメモか(なくてもよい)
  function seedForm(opt, onDone) {
    const o = opt || {};
    App.openSheet(o.id ? "紹介のタネを直す" : "紹介できそう!をメモ", (body, close) => {
      const picker = App.memberPicker({ value: o.toId || null, exclude: [App.session.memberId], label: "紹介できそうなメンバー" });
      const note = h("textarea", { rows: "4", maxlength: "400", placeholder: "例:知り合いの〇〇社長が、社員研修の講師を探していた" });
      note.value = o.note || "";
      const err = h("p", { class: "app-error", role: "alert" });
      const m = o.toId ? App.memberById(o.toId) : null;
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        const toId = picker.getValue();
        if (!toId) { err.textContent = "紹介できそうなメンバーを選んでください。"; return; }
        const saved = await save({ id: o.id, toId, note: note.value.trim(), eventId: o.eventId || "", eventTitle: o.eventTitle || "", eventDate: o.eventDate || "", done: !!o.done });
        if (!saved) return;
        close();
        App.toast(o.id ? "直しました" : "メモしました。「紹介のタネ」にたまります");
        if (onDone) onDone(saved);
      } },
      m && m.wants ? h("p", { class: "app-lead seed-wants" }, h("b", null, `${m.name}さんの求める紹介:`), m.wants.length > 140 ? `${m.wants.slice(0, 140)}…` : m.wants) : null,
      o.toId ? null : App.field("だれに紹介できそう?", picker),
      App.field("メモ(だれを・どんな話を)", note, "自分だけが見られます。思いついたことを短くで大丈夫です"),
      err,
      h("button", { type: "submit", class: "app-btn primary wide" }, "メモする")));
      if (o.toId) body.querySelector("form").prepend(h("p", { class: "seed-to" }, App.avatar(m ? m.name : ""), h("b", null, `${m ? m.name : ""}さんに紹介できそう`)));
      setTimeout(() => note.focus({ preventScroll: true }), 80);
    });
  }
  App.seedForm = seedForm;

  // ---------- 定例会メモ(#meeting / #meeting/<定例会のID>) ----------
  App.views.meeting = {
    title: "定例会メモ",
    tab: "events",
    async render(el, parts) {
      const d = await App.api("listEvents", {}, { quiet: true });
      const events = (d && d.events) || [];
      const ev = (parts[0] && events.find((e) => e.id === parts[0])) || events.find((e) => !e.past) || events[events.length - 1] || null;
      const detail = ev ? await App.api("getEvent", { id: ev.id }, { quiet: true }) : null;
      const going = new Set(detail ? detail.members.filter((m) => m.rsvp === "yes" || m.attended).map((m) => m.id) : []);
      const absent = new Set(detail ? detail.members.filter((m) => m.rsvp === "no" && !m.attended).map((m) => m.id) : []);
      const seeds = await list(true);
      const meId = App.session.memberId;
      const members = (App.members || []).filter((m) => m.id !== meId)
        .sort((a, b) => (going.has(b.id) - going.has(a.id)) || (absent.has(a.id) - absent.has(b.id)));

      el.append(h("h1", { class: "app-h1", "data-en": "Meeting Memo" }, "定例会メモ"),
        h("p", { class: "app-lead" }, "プレゼンを聞きながら「この人に紹介できそう」と思ったら、", h("b", null, "💡 紹介できそう"), " を押してメモ。", canLog() ? "あとで「記録 → 紹介のタネ」から、紹介の記録や 1on1 にできます。メモは自分だけが見られます。" : "あとで「紹介のタネ」で見返せます。メモは自分だけが見られます。"),
        ev ? h("p", { class: "mtg-ev" }, App.chip(ev.past ? "終わった定例会" : App.daysUntil(ev.date, d.today) === 0 ? "今日" : "次の定例会", ev.past ? "mute" : "good"), ` ${App.fmtDateLong(ev.date)} ${ev.title}`) : null);
      if (mode === "local") el.append(h("p", { class: "app-field-hint mtg-local" }, "※ いまは、この端末にだけ保存されます(共有サーバーを新しくすると、自動でサーバーに移ります)。"));

      const q = h("input", { type: "search", class: "mtg-q", placeholder: "名前・会社名・キーワードで探す", "aria-label": "メンバーを探す" });
      const grid = h("ul", { class: "mtg-grid" });
      const countOf = (id) => seeds.filter((s) => s.toId === id && (!ev || s.eventId === ev.id)).length;
      const draw = () => {
        const k = q.value.trim().toLowerCase();
        const shown = members.filter((m) => !k || [m.name, m.kana, m.company, m.category, m.wants, (m.triggers || []).join(" ")].join(" ").toLowerCase().includes(k));
        App.fill(grid, shown.map((m) => {
          const n = countOf(m.id);
          return h("li", { class: `mtg-card${n ? " has-seed" : ""}` },
            h("div", { class: "mtg-head" }, App.avatar(m.name),
              h("div", { class: "mtg-name" }, h("b", null, m.name), h("small", null, m.company || m.category || "")),
              going.has(m.id) ? App.chip("出席予定", "good") : absent.has(m.id) ? App.chip("欠席", "mute") : null),
            m.wants ? h("p", { class: "mtg-wants" }, h("span", null, "求める紹介"), m.wants.length > 90 ? `${m.wants.slice(0, 90)}…` : m.wants) : null,
            (m.triggers || []).length ? h("p", { class: "mtg-trig" }, (m.triggers || []).slice(0, 3).map((t) => h("span", null, t))) : null,
            h("div", { class: "mtg-acts" },
              h("button", { type: "button", class: "app-btn primary small mtg-seed", onclick: () => seedForm({ toId: m.id, eventId: ev ? ev.id : "", eventTitle: ev ? ev.title : "", eventDate: ev ? ev.date : "" }, (x) => { seeds.unshift(x); draw(); }) },
                "💡 紹介できそう", n ? h("span", { class: "mtg-n" }, String(n)) : null),
              h("a", { class: "app-btn ghost small", href: App.profileHref(m.id) }, "くわしく")));
        }));
        if (!shown.length) grid.append(h("li", { class: "app-empty" }, "見つかりませんでした。"));
      };
      q.addEventListener("input", draw);
      draw();
      const pending = seeds.filter((s) => !s.done).length;
      el.append(h("div", { class: "mtg-tools" }, q),
        grid,
        h("div", { class: "app-cta-row" }, h("a", { class: "app-btn primary wide", href: (App.canLog && App.canLog()) ? "#log/seeds" : "#seeds" }, pending ? `紹介のタネを見る(${pending}件)` : "紹介のタネを見る")));
    },
  };

  // 紹介のタネ(記録のタブが使えない方も、ここから見られる)
  App.views.seeds = { title: "紹介のタネ", tab: "events", async render(el) { el.append(h("h1", { class: "app-h1", "data-en": "Seeds" }, "紹介のタネ")); await App.renderSeeds(el); } };
  // 記録が使えない方が、リンクから記録を開いたとき
  App.views.logLocked = {
    title: "記録", tab: "log",
    async render(el) {
      el.append(h("section", { class: "app-section locked-box" },
        h("h1", { class: "app-h1" }, "記録は準備中です"),
        h("p", { class: "app-lead" }, "紹介・ありがとうマイル・1on1 の記録は、いまは準備中のため、一部の方だけが使えます。使えるようになったら、お知らせでご案内します。"),
        h("div", { class: "app-btn-row" }, h("a", { class: "app-btn primary", href: "#seeds" }, "紹介のタネを見る"), h("a", { class: "app-btn ghost", href: "#events" }, "予定に戻る"))));
    },
  };

  // ---------- 記録 → 紹介のタネ ----------
  App.renderSeeds = async function (el) {
    const items = await list(true);
    const todo = items.filter((s) => !s.done), done = items.filter((s) => s.done);
    el.append(h("p", { class: "app-lead" }, canLog() ? "定例会などで「この人に紹介できそう」とメモしたものです。紹介したら記録に、まずは話を聞くなら 1on1 に。メモは自分だけが見られます。" : "定例会などで「この人に紹介できそう」とメモしたものです。紹介したら「済みにする」を押してください。メモは自分だけが見られます。"));
    if (mode === "local") el.append(h("p", { class: "app-field-hint" }, "※ いまは、この端末にだけ保存されます(共有サーバーを新しくすると、自動でサーバーに移ります)。"));
    el.append(h("div", { class: "app-cta-row" },
      App.btn("＋ タネをメモする", () => seedForm({}, () => App.route()), "primary wide"),
      h("a", { class: "app-btn ghost wide", href: "#meeting" }, "定例会メモを開く")));
    const row = (s) => {
      const m = App.memberById(s.toId);
      const name = (m && m.name) || s.toName || "メンバー";
      const toggle = async () => { if (await save(Object.assign({}, s, { done: !s.done }))) App.route(); };
      return h("li", { class: `seed-row${s.done ? " is-done" : ""}` },
        h("div", { class: "seed-main" }, App.avatar(name),
          h("div", null, h("b", null, `${name}さんに紹介できそう`),
            s.note ? h("p", { class: "seed-note" }, s.note) : null,
            h("small", null, [s.eventDate ? `${App.fmtDate(s.eventDate)} の定例会` : "", s.at ? `${new Date(s.at).getMonth() + 1}/${new Date(s.at).getDate()} メモ` : ""].filter(Boolean).join(" ・ ")))),
        h("div", { class: "seed-acts" },
          s.done || !canLog() ? null : App.btn("紹介を記録する", async () => {
            await save(Object.assign({}, s, { done: true }));
            App.go(`log/ref?new&to=${encodeURIComponent(s.toId)}&memo=${encodeURIComponent(s.note || "")}`);
          }, "primary small"),
          s.done || !canLog() ? null : h("a", { class: "app-btn ghost small", href: `#log/1on1?new&with=${encodeURIComponent(s.toId)}` }, "1on1 を予定"),
          App.btn(s.done ? "未にもどす" : "済みにする", toggle, "ghost small"),
          App.btn("直す", () => seedForm(s, () => App.route()), "ghost small"),
          App.btn("削除", async () => {
            if (!(await App.confirm("このメモを削除しますか?", { ok: "削除する", danger: true }))) return;
            if (await remove(s.id)) { App.toast("削除しました"); App.route(); }
          }, "ghost small danger")));
    };
    el.append(App.section(`これから(${todo.length})`,
      todo.length ? h("ul", { class: "seed-list" }, todo.map(row))
        : App.empty("まだありません。定例会でプレゼンを聞きながら「💡 紹介できそう」を押すと、ここにたまります。", h("a", { class: "app-btn primary small", href: "#meeting" }, "定例会メモを開く"))));
    if (done.length) el.append(h("details", { class: "app-more-box" }, h("summary", null, `済み(${done.length})`), h("ul", { class: "seed-list" }, done.map(row))));
  };
})();
