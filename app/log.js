// ============================================
// app/log.js — 記録(紹介・ありがとうマイル・1on1・ランキング)
// ============================================

(function () {
  "use strict";
  const { h } = App;

  const TABS = [
    { id: "ref", label: "紹介" },
    { id: "miles", label: "マイル" },
    { id: "1on1", label: "1on1" },
    { id: "rank", label: "ランキング" },
  ];

  App.views.log = {
    title: "記録",
    async render(el, parts, params) {
      const tab = TABS.some((t) => t.id === parts[0]) ? parts[0] : "ref";
      el.append(App.segmented(TABS, tab, (id) => App.go(`log/${id}`)));
      const body = h("div");
      el.append(body);
      if (tab === "ref") await renderRefs(body, params);
      if (tab === "miles") await renderMiles(body, params);
      if (tab === "1on1") await renderOnes(body, params);
      if (tab === "rank") await renderRank(body, params);
    },
  };

  // ============================================
  // 紹介
  // ============================================
  async function renderRefs(el, params) {
    const d = await App.api("listMyReferrals");
    if (!d) return;
    el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 紹介を記録する", () => referralForm(params.get("to")), "primary wide")));

    el.append(App.section(`あなた宛ての紹介(${d.received.length})`,
      d.received.length
        ? h("ul", { class: "app-cards" }, d.received.map((r) => h("li", null, receivedCard(r))))
        : App.empty("まだありません。プロフィールの「求める紹介」を具体的にすると届きやすくなります。", h("a", { class: "app-btn ghost", href: "../profile/" }, "プロフィールを見直す"))));

    el.append(App.section(`あなたが出した紹介(${d.given.length})`,
      d.given.length
        ? h("ul", { class: "app-cards" }, d.given.map((r) => h("li", null, givenCard(r))))
        : App.empty("紹介したら記録しておくと、相手の対応状況とお礼(マイル)がここに届きます。")));

    if (params.has("new")) referralForm(params.get("to"));
  }

  function receivedCard(r) {
    const card = h("article", { class: "ref-card" });
    function draw() {
      const st = App.REF_STATUS[r.status] || App.REF_STATUS.new;
      App.fill(card, 
        h("div", { class: "ref-card-head" }, App.avatar(r.fromName), h("div", null, h("b", null, `${r.fromName}さんから`), h("small", null, App.fmtTime(r.at))), App.chip(st.label, st.tone)),
        h("dl", { class: "ref-card-body" },
          h("dt", null, "紹介された方"), h("dd", null, r.prospect || "(未記入)"),
          r.contact ? [h("dt", null, "連絡先"), h("dd", null, contactLink(r.contact))] : null,
          r.memo ? [h("dt", null, "メモ"), h("dd", null, r.memo)] : null,
          r.thanksAmount ? [h("dt", null, "お礼"), h("dd", null, App.yen(r.thanksAmount))] : null),
        h("div", { class: "ref-status-row", role: "group", "aria-label": "対応状況" },
          ["contacted", "meeting", "lost"].map((s) => h("button", {
            type: "button", class: `app-pill${r.status === s ? " is-on" : ""}`, "aria-pressed": r.status === s ? "true" : "false",
            onclick: async () => {
              const res = await AuthApi.updateReferralStatus(AuthSession.getToken(), r.id, r.status === s ? "new" : s);
              if (!res.success) { App.toast(res.error.userMessage); return; }
              r.status = res.data.status;
              draw();
            },
          }, App.REF_STATUS[s].label)),
          h("button", { type: "button", class: `app-pill is-won${r.status === "won" ? " is-on" : ""}`, onclick: () => thanksForm({ referral: r, onDone: (t) => { r.status = "won"; r.thanksAmount = t.amount; draw(); } }) }, r.status === "won" ? "成約(お礼を直す)" : "成約 → お礼")),
        App.btn(`${r.fromName}さんにメッセージ`, () => App.go(`talk/msg/new?to=${encodeURIComponent(r.fromId)}`), "ghost small"));
    }
    draw();
    return card;
  }

  function givenCard(r) {
    const st = App.REF_STATUS[r.status] || App.REF_STATUS.new;
    return h("article", { class: "ref-card" },
      h("div", { class: "ref-card-head" }, App.avatar(r.toName), h("div", null, h("b", null, `${r.toName}さんへ`), h("small", null, App.fmtTime(r.at))), App.chip(st.label, st.tone)),
      h("dl", { class: "ref-card-body" },
        h("dt", null, "紹介した方"), h("dd", null, r.prospect || "(未記入)"),
        r.memo ? [h("dt", null, "メモ"), h("dd", null, r.memo)] : null,
        r.thanksAmount ? [h("dt", null, "お礼"), h("dd", { class: "is-good" }, `${App.yen(r.thanksAmount)} のありがとうマイル`)] : null),
      h("div", { class: "ref-card-actions" },
        App.btn("取り消す", async (e) => {
          if (!confirm("この紹介の記録を取り消しますか?")) return;
          const res = await AuthApi.deleteReferral(AuthSession.getToken(), r.id);
          if (!res.success) { App.toast(res.error.userMessage); return; }
          e.target.closest("li").remove();
          App.toast("取り消しました");
        }, "ghost small")));
  }

  function contactLink(c) {
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(c)) return h("a", { href: `mailto:${c}` }, c);
    if (/^[0-9０-９()+\- ]{9,}$/.test(c)) return h("a", { href: `tel:${c.replace(/[^\d+]/g, "")}` }, c);
    return c;
  }

  // 紹介の記録(紹介先 → 紹介した相手 → 連絡先 → メモ)
  function referralForm(toId) {
    App.openSheet("紹介を記録", (body, close) => {
      const picker = App.memberPicker({ value: toId && App.memberById(toId) ? toId : null, exclude: [App.session.memberId], label: "紹介先のメンバー" });
      const prospect = h("input", { type: "text", maxlength: "60", placeholder: "例:株式会社〇〇 佐藤社長" });
      const contact = h("input", { type: "text", maxlength: "120", placeholder: "電話・メール・LINE など(任意)" });
      const memo = h("textarea", { rows: "3", maxlength: "300", placeholder: "例:ホームページのリニューアルを検討中。来月までに話を聞きたい" });
      const err = h("p", { class: "app-error", role: "alert" });
      const save = h("button", { type: "submit", class: "app-btn primary wide" }, "記録して知らせる");
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        const to = picker.getValue();
        if (!to) { err.textContent = "紹介先のメンバーを選んでください。"; return; }
        if (!prospect.value.trim()) { err.textContent = "紹介した方のお名前を入れてください。"; prospect.focus(); return; }
        save.disabled = true;
        const res = await AuthApi.recordReferral(AuthSession.getToken(), to, prospect.value.trim(), [], memo.value.trim(), contact.value.trim());
        save.disabled = false;
        if (!res.success) { err.textContent = res.error.userMessage; return; }
        close();
        App.toast(`${App.memberById(to).name}さんに紹介を記録しました`);
        App.go("log/ref");
      } },
      App.field("紹介先のメンバー", picker),
      App.field("紹介した方", prospect, "会社名・お名前"),
      App.field("連絡先", contact, "紹介先のメンバーとあなただけが見られます"),
      App.field("どんな相談か", memo),
      err, save));
    }, { noFocus: true });
  }

  // ============================================
  // ありがとうマイル
  // ============================================
  async function renderMiles(el, params) {
    const d = await App.api("listMyReferrals");
    if (!d) return;
    const sum = (list) => list.reduce((s, t) => s + t.amount, 0);
    el.append(h("p", { class: "app-lead" }, "紹介で仕事が決まったら、紹介してくれた人へ「ありがとう」と成約金額を送ります。紹介から生まれた売上が見えるようになります(1円 = 1マイル)。"));
    el.append(h("div", { class: "home-stats" },
      h("div", { class: "home-stat is-wide" }, h("span", null, "受け取ったマイル"), h("b", null, App.yen(sum(d.thanksIn)))),
      h("div", { class: "home-stat is-wide" }, h("span", null, "送ったマイル"), h("b", null, App.yen(sum(d.thanksOut))))));
    el.append(h("div", { class: "app-cta-row" }, App.btn("＋ ありがとうを送る", () => thanksForm({}), "primary wide")));
    const list = (items, inbound) => items.length
      ? h("ul", { class: "app-list" }, items.map((t) => h("li", null,
        h("div", { class: "app-row" },
          App.avatar(inbound ? t.fromName : t.toName),
          h("span", { class: "app-row-main" },
            h("b", null, inbound ? `${t.fromName}さんから` : `${t.toName}さんへ`),
            h("small", null, `${App.fmtTime(t.at)}${t.message ? ` ・ ${t.message}` : ""}`)),
          h("b", { class: "mile-amount" }, App.yen(t.amount)),
          inbound ? null : h("button", { type: "button", class: "app-icon-btn", "aria-label": "取り消す", onclick: async (e) => {
            if (!confirm("このありがとうを取り消しますか?")) return;
            if (await App.api("deleteThanks", { id: t.id })) { e.target.closest("li").remove(); App.toast("取り消しました"); }
          } }, "×")))))
      : App.empty(inbound ? "まだありません。" : "まだ送っていません。");
    el.append(App.section("受け取ったありがとう", list(d.thanksIn, true)));
    el.append(App.section("送ったありがとう", list(d.thanksOut, false)));
    if (params.has("new")) thanksForm({ to: params.get("to") });
  }

  function thanksForm(opt) {
    const r = opt.referral;
    App.openSheet(r ? "成約!紹介のお礼を送る" : "ありがとうを送る", (body, close) => {
      const picker = r ? null : App.memberPicker({ value: opt.to && App.memberById(opt.to) ? opt.to : null, exclude: [App.session.memberId], label: "お礼を送る相手" });
      const amount = h("input", { type: "text", inputmode: "numeric", placeholder: "例:300000", value: r && r.thanksAmount ? String(r.thanksAmount) : "" });
      const message = h("textarea", { rows: "3", maxlength: "300", placeholder: "例:ご紹介いただいた〇〇様、ご契約いただけました!ありがとうございます" });
      const err = h("p", { class: "app-error", role: "alert" });
      const shown = h("p", { class: "app-field-hint mile-preview" });
      amount.addEventListener("input", () => {
        const n = Number(amount.value.replace(/[^\d]/g, ""));
        shown.textContent = n ? `${App.yen(n)}(${n.toLocaleString("ja-JP")} マイル)` : "";
      });
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        const to = r ? "" : picker.getValue();
        if (!r && !to) { err.textContent = "お礼を送る相手を選んでください。"; return; }
        const d = await App.api("reportThanks", { referralId: r ? r.id : "", toMemberId: to, amount: amount.value, message: message.value.trim() }, { raw: true, quiet: true });
        if (!d || d.success === false) { err.textContent = d ? d.error.userMessage : "送れませんでした。"; return; }
        close();
        App.toast("ありがとうを送りました");
        if (opt.onDone) opt.onDone(d.thanks); else App.route();
      } },
      r ? h("p", { class: "app-lead" }, `${r.fromName}さんからの紹介(${r.prospect || "お相手"})が成約になったことを記録し、お礼を送ります。`) : App.field("お礼を送る相手(紹介してくれた人)", picker),
      App.field("成約金額(円)", amount, "わかる範囲で。0円でも送れます"), shown,
      App.field("ひとこと", message),
      err, h("button", { type: "submit", class: "app-btn primary wide" }, "送る")));
    }, { noFocus: !r });
  }

  // ============================================
  // 1on1
  // ============================================
  async function renderOnes(el, params) {
    const d = await App.api("list1on1");
    if (!d) return;
    el.append(h("p", { class: "app-lead" }, "1on1 は、メンバー同士がお互いの仕事を深く知るための面談です。予定を入れておくと前日にホームに出ます。メモはあなただけが見られます。"));
    el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 1on1 を記録・予定する", () => oneForm(null, params.get("with")), "primary wide")));
    const planned = d.items.filter((o) => o.status === "planned").reverse();
    const done = d.items.filter((o) => o.status !== "planned");
    const row = (o) => h("li", null, h("button", { type: "button", class: "app-row", onclick: () => oneForm(o) },
      App.avatar(o.withName),
      h("span", { class: "app-row-main" }, h("b", null, `${o.withName}さん`), h("small", null, `${App.fmtDate(o.date)} ${o.time} ${o.place}${o.note ? " ・ メモあり" : ""}`)),
      o.status === "cancelled" ? App.chip("中止", "mute") : o.status === "done" ? App.chip("実施", "good") : App.chip(App.daysUntil(o.date, d.today) === 0 ? "今日" : "予定", "info")));
    el.append(App.section(`予定(${planned.length})`, planned.length ? h("ul", { class: "app-list" }, planned.map(row)) : App.empty("予定はありません。")));
    el.append(App.section(`これまで(${done.length})`, done.length ? h("ul", { class: "app-list" }, done.map(row)) : App.empty("まだ記録がありません。")));
    if (params.has("new")) oneForm(null, params.get("with"));
  }

  function oneForm(o, withId) {
    App.openSheet(o ? `${o.withName}さんとの 1on1` : "1on1 を記録・予定する", (body, close) => {
      const picker = o ? null : App.memberPicker({ value: withId && App.memberById(withId) ? withId : null, exclude: [App.session.memberId], label: "相手" });
      const date = h("input", { type: "date", value: o ? o.date : App.todayKey(), required: true });
      const time = h("input", { type: "time", value: o ? o.time : "" });
      const place = h("input", { type: "text", maxlength: "80", placeholder: "例:新潟駅前のカフェ / Zoom", value: o ? o.place : "" });
      const status = h("select", null,
        h("option", { value: "planned" }, "予定"), h("option", { value: "done" }, "実施した"), h("option", { value: "cancelled" }, "中止"));
      status.value = o ? o.status : "done";
      date.addEventListener("change", () => { if (!o) status.value = date.value > App.todayKey() ? "planned" : "done"; });
      const note = h("textarea", { rows: "5", maxlength: "2000", placeholder: "相手の強み・紹介してほしい人・印象に残った話など(あなただけが見られます)" });
      note.value = o ? o.note : "";
      const next = h("input", { type: "text", maxlength: "200", placeholder: "例:〇〇さんを紹介する", value: o ? o.next : "" });
      const err = h("p", { class: "app-error", role: "alert" });
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        const payload = { id: o ? o.id : "", withMemberId: o ? o.with : picker.getValue(), date: date.value, time: time.value, place: place.value.trim(), status: status.value, note: note.value, next: next.value.trim() };
        if (!payload.withMemberId) { err.textContent = "相手を選んでください。"; return; }
        const d = await App.api("save1on1", payload, { raw: true, quiet: true });
        if (!d || d.success === false) { err.textContent = d ? d.error.userMessage : "保存できませんでした。"; return; }
        close();
        App.toast("保存しました");
        App.go("log/1on1");
      } },
      o ? null : App.field("相手", picker),
      h("div", { class: "app-grid2" }, App.field("日付", date), App.field("時刻", time)),
      App.field("場所", place),
      App.field("状況", status),
      App.field("メモ", note),
      App.field("次にやること", next),
      err,
      h("button", { type: "submit", class: "app-btn primary wide" }, "保存する"),
      o ? h("div", { class: "app-form-foot" },
        App.btn(`${o.withName}さんのプロフィール`, () => { location.href = `../referral/#member=${encodeURIComponent(o.with)}`; }, "ghost small"),
        App.btn("削除", async () => {
          if (!confirm("この 1on1 を削除しますか?")) return;
          if (await App.api("delete1on1", { id: o.id })) { close(); App.toast("削除しました"); App.route(); }
        }, "ghost small danger")) : null));
    }, { noFocus: true });
  }

  // ============================================
  // ランキング(個人・チーム)
  // ============================================
  const METRICS = [
    { id: "referrals", label: "紹介した数", unit: "件" },
    { id: "miles", label: "ありがとうマイル", unit: "円" },
    { id: "won", label: "成約", unit: "件" },
    { id: "oneOnOnes", label: "1on1", unit: "回" },
    { id: "attended", label: "出席", unit: "回" },
  ];
  async function renderRank(el, params) {
    const period = ["month", "year", "all"].includes(params.get("p")) ? params.get("p") : "month";
    const metric = METRICS.some((m) => m.id === params.get("m")) ? params.get("m") : "referrals";
    const by = params.get("by") === "team" ? "team" : "member";
    const d = await App.api("getRankings", { period });
    if (!d) return;
    const set = (k, v) => { const p = new URLSearchParams({ p: period, m: metric, by }); p.set(k, v); App.go(`log/rank?${p}`); };
    el.append(h("div", { class: "rank-controls" },
      App.segmented([{ id: "month", label: "今月" }, { id: "year", label: "今年" }, { id: "all", label: "すべて" }], period, (v) => set("p", v)),
      App.segmented([{ id: "member", label: "個人" }, { id: "team", label: "チーム" }], by, (v) => set("by", v)),
      h("div", { class: "rank-metrics" }, METRICS.map((m) => h("button", { type: "button", class: `app-pill${m.id === metric ? " is-on" : ""}`, onclick: () => set("m", m.id) }, m.label)))));
    const t = d.totals;
    el.append(h("p", { class: "rank-total" }, `コミュニティ全体:紹介 ${t.referrals}件 ・ 成約 ${t.won}件 ・ ${App.yen(t.miles)} ・ 1on1 ${t.oneOnOnes}回`));
    const m = METRICS.find((x) => x.id === metric);
    const rows = (by === "team" ? d.teams.map((x) => ({ name: x.team, sub: `${x.members}名`, v: x[metric] })) : d.members.map((x) => ({ name: x.name, sub: x.team, v: x[metric], me: x.id === App.session.memberId })))
      .sort((a, b) => b.v - a.v);
    const top = rows[0] ? rows[0].v : 0;
    const shown = rows.filter((r, i) => r.v > 0 || i < 3 || r.me);
    el.append(h("ol", { class: "rank-list" }, shown.slice(0, 50).map((r, i) => h("li", { class: r.me ? "is-me" : "" },
      h("span", { class: `rank-no${i < 3 && r.v > 0 ? ` top${i + 1}` : ""}` }, String(i + 1)),
      h("span", { class: "rank-name" }, h("b", null, r.name), r.sub ? h("small", null, r.sub) : null),
      h("span", { class: "rank-bar", "aria-hidden": "true" }, h("span", { style: `width:${top && r.v ? Math.max(4, (r.v / top) * 100) : 0}%` })),
      h("b", { class: "rank-v" }, metric === "miles" ? App.yen(r.v) : `${r.v}${m.unit}`)))));
    if (!rows.some((r) => r.v > 0)) el.append(App.empty("この期間の記録はまだありません。"));
  }

  App.referralForm = referralForm;
  App.thanksForm = thanksForm;
  App.oneForm = oneForm;
})();
