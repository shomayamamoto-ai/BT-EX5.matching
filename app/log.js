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
    { id: "stats", label: "数字" },
  ];

  App.views.log = {
    title: "記録",
    autoRefresh: true,
    async render(el, parts, params) {
      const tab = TABS.some((t) => t.id === parts[0]) ? parts[0] : "ref";
      el.append(App.segmented(TABS, tab, (id) => App.go(`log/${id}`)));
      const body = h("div");
      el.append(body);
      if (tab === "ref") await renderRefs(body, params);
      if (tab === "miles") await renderMiles(body, params);
      if (tab === "1on1") await renderOnes(body, params);
      if (tab === "rank") await renderRank(body, params);
      if (tab === "stats") await App.renderStats(body, params);
    },
  };

  // ============================================
  // 紹介
  // ============================================
  async function renderRefs(el, params) {
    const d = await App.api("listMyReferrals");
    if (!d) return;
    el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 紹介を記録する", () => referralForm(params.get("to"), params.get("memo")), "primary wide")));

    el.append(App.section(`あなた宛ての紹介(${d.received.length})`,
      d.received.length
        ? h("ul", { class: "app-cards" }, d.received.map((r) => h("li", null, receivedCard(r))))
        : App.empty("まだありません。プロフィールの「求める紹介」を具体的にすると届きやすくなります。", h("a", { class: "app-btn ghost", href: "../profile/" }, "プロフィールを見直す"))));

    el.append(App.section(`あなたが出した紹介(${d.given.length})`,
      d.given.length
        ? h("ul", { class: "app-cards" }, d.given.map((r) => h("li", null, givenCard(r))))
        : App.empty("紹介したら記録しておくと、相手の対応状況とお礼(マイル)がここに届きます。")));

    if (params.has("new")) referralForm(params.get("to"), params.get("memo"));
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
  // memoText: 早見表の相談アシスタント・紹介診断から来たときの相談内容(入れ直さなくてよいように)
  function referralForm(toId, memoText) {
    App.openSheet("紹介を記録", (body, close) => {
      const picker = App.memberPicker({ value: toId && App.memberById(toId) ? toId : null, exclude: [App.session.memberId], label: "紹介先のメンバー" });
      const prospect = App.draft("ref-prospect", h("input", { type: "text", maxlength: "60", placeholder: "例:株式会社〇〇 佐藤社長" }));
      const contact = App.draft("ref-contact", h("input", { type: "text", maxlength: "120", placeholder: "電話・メール・LINE など(任意)" }));
      const memo = h("textarea", { rows: "3", maxlength: "300", placeholder: "例:ホームページのリニューアルを検討中。来月までに話を聞きたい" });
      if (memoText) memo.value = String(memoText).slice(0, 300);
      App.draft("ref-memo", memo);
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
        App.clearDraft("ref-prospect", "ref-contact", "ref-memo");
        close();
        const toName = App.memberById(to).name;
        await App.go("log/ref");
        App.doneSheet("紹介を記録しました", `${toName}さんのホームに届きました。LINE などでもひと言送っておくと確実です。`, [
          `${toName}さん`,
          `${prospect.value.trim()}様をご紹介させていただきました。`,
          memo.value.trim() ? `ご相談の内容:${memo.value.trim()}` : "",
          contact.value.trim() ? `連絡先:${contact.value.trim()}` : "",
          "会員サイトの「記録」にも入れています。どうぞよろしくお願いします!",
          App.siteUrl("#log/ref"),
        ].filter(Boolean).join("\n"));
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
      const message = App.draft("thanks-msg", h("textarea", { rows: "3", maxlength: "300", placeholder: "例:ご紹介いただいた〇〇様、ご契約いただけました!ありがとうございます" }));
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
        App.clearDraft("thanks-msg");
        close();
        if (opt.onDone) opt.onDone(d.thanks); else await App.route();
        const t = d.thanks;
        App.doneSheet("ありがとうを送りました", `${t.toName}さんに届きました。LINE などでも直接お礼を伝えましょう。`, [
          `${t.toName}さん`,
          r ? `ご紹介いただいた${r.prospect ? `${r.prospect}様の` : ""}件、成約しました!` : "おかげさまで、お仕事につながりました!",
          t.message || "本当にありがとうございます。",
          "これからもよろしくお願いします。",
        ].join("\n"));
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
    oneMeta = { calendar: d.calendar, hasCalendarEmail: d.hasCalendarEmail };
    el.append(h("p", { class: "app-lead" }, "1on1 は、メンバー同士がお互いの仕事を深く知るための面談です。予定を入れておくと、時刻を過ぎたときに自動で「実施」になり、回数に数えられます。メモはあなただけが見られます。"));
    el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 1on1 を予定・記録する", () => oneForm(null, params.get("with")), "primary wide")));
    if (d.calendar && !d.hasCalendarEmail) {
      el.append(h("a", { class: "home-alert", href: "#me/calendar" }, h("b", null, "Google カレンダーと連携しましょう"), h("span", null, "メールアドレスを登録すると、1on1 の予定と Meet の招待があなたのカレンダーに自動で入ります")));
    }
    const planned = d.items.filter((o) => o.status === "planned").reverse();
    const done = d.items.filter((o) => o.status !== "planned");
    const when = (o) => `${App.fmtDate(o.date)} ${o.time ? `${o.time}〜${o.endDate && o.endDate !== o.date ? "翌" : ""}${o.end}` : "時刻未定"}`;
    const where = (o) => (o.mode === "meet" ? "Google Meet" : o.place || "場所未定");
    const row = (o) => h("li", null, h("button", { type: "button", class: "app-row", onclick: () => oneForm(o) },
      App.avatar(o.withName),
      h("span", { class: "app-row-main" }, h("b", null, `${o.withName}さん`), h("small", null, `${when(o)} ・ ${where(o)}${o.note ? " ・ メモあり" : ""}`)),
      o.status === "cancelled" ? App.chip("中止", "mute") : o.status === "done" ? App.chip(o.autoDone ? "実施(自動)" : "実施", "good") : App.chip(App.daysUntil(o.date, d.today) === 0 ? "今日" : "予定", "info")));
    el.append(App.section(`予定(${planned.length})`, planned.length ? h("ul", { class: "app-list" }, planned.map((o) => {
      const li = row(o);
      li.append(h("div", { class: "one-cal" },
        o.meetUrl ? h("a", { class: "app-btn small", href: o.meetUrl, target: "_blank", rel: "noopener" }, "Meet に参加") : null,
        o.synced && o.calLink ? h("a", { class: "app-btn ghost small", href: o.calLink, target: "_blank", rel: "noopener" }, "カレンダーで開く")
          : App.calendarButtons({ uid: o.id, title: `1on1:${o.withName}さん`, date: o.date, start: o.time, end: o.end, endDate: o.endDate, place: o.mode === "meet" ? o.meetUrl || "Google Meet" : o.place })));
      return li;
    })) : App.empty("予定はありません。")));
    el.append(recommendSection(d.items));
    el.append(App.section(`これまで(${done.length})`, done.length ? h("ul", { class: "app-list" }, done.map(row)) : App.empty("まだ記録がありません。")));
    if (params.has("new")) oneForm(null, params.get("with"));
  }

  // 次に 1on1 するとよい人: まだ会っていない人のうち、紹介し合えそうな人を先に
  function recommendSection(items) {
    const met = new Set(items.filter((o) => o.status !== "cancelled").map((o) => o.with));
    const me = App.memberById(App.session.memberId);
    const others = App.members.filter((m) => m.id !== App.session.memberId && !met.has(m.id));
    if (!others.length) return App.section("次に 1on1 するとよい人", App.empty("全員と 1on1 をしました。すばらしいです!"));
    let picks = [];
    if (typeof RefPartners !== "undefined" && me) {
      picks = RefPartners.findPartners(others.concat(me), me, 3).map((p) => ({ m: p.m, why: p.reasons[0] }));
    }
    // 足りなければ、まだ会っていない人を日替わりで
    const day = Number(App.todayKey().replace(/-/g, ""));
    others.slice().sort((a, b) => ((a.id.charCodeAt(a.id.length - 1) * 31 + day) % 97) - ((b.id.charCodeAt(b.id.length - 1) * 31 + day) % 97))
      .forEach((m) => { if (picks.length < 3 && !picks.some((p) => p.m.id === m.id)) picks.push({ m, why: m.company || m.category || "" }); });
    return App.section(`次に 1on1 するとよい人(まだ会っていない ${others.length}名)`,
      h("ul", { class: "app-list" }, picks.map((p) => h("li", { class: "rec-item" },
        h("div", { class: "app-row" }, App.avatar(p.m.name),
          h("span", { class: "app-row-main" }, h("b", null, `${p.m.name}さん`), h("small", null, p.why))),
        h("div", { class: "rec-actions" },
          h("a", { class: "app-btn small", href: `#talk/msg/new?to=${encodeURIComponent(p.m.id)}&tpl=1on1` }, "1on1 を申し込む"),
          h("a", { class: "app-btn ghost small", href: `../referral/#member=${encodeURIComponent(p.m.id)}` }, "プロフィール"))))));
  }

  // 1on1 の設定(共有サーバーで Google カレンダーが使えるか・自分のメールを登録済みか)
  let oneMeta = { calendar: false, hasCalendarEmail: false };

  // 選んで切り替えるボタンの並び(押したものが選ばれる)
  function toggleGroup(options, value, onchange) {
    let current = value;
    const el = h("div", { class: "app-toggle", role: "radiogroup" });
    const draw = () => el.replaceChildren(...options.map((o) => h("button", {
      type: "button", role: "radio", class: o.id === current ? "is-on" : "", "aria-checked": o.id === current ? "true" : "false",
      onclick: () => { current = o.id; draw(); if (onchange) onchange(current); },
    }, o.label)));
    draw();
    el.getValue = () => current;
    el.setValue = (v) => { current = v; draw(); };
    return el;
  }
  function durLabel(n) {
    const hh = Math.floor(n / 60), mm = n % 60;
    if (!hh) return `${mm}分`;
    return `${hh}時間${mm === 30 ? "半" : mm ? `${mm}分` : ""}`;
  }
  // 0:00〜23:30 を30分きざみで(夜遅く・深夜の 1on1 も選べるように)
  function timeOptions() {
    const out = [h("option", { value: "" }, "未定")];
    for (let m = 0; m < 24 * 60; m += 30) {
      const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      out.push(h("option", { value: t }, t));
    }
    return out;
  }
  function addDays(key, n) {
    const [y, m, d] = key.split("-").map(Number);
    const x = new Date(y, m - 1, d + n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }

  function oneForm(o, withId) {
    App.openSheet(o ? `${o.withName}さんとの 1on1` : "1on1 を予定・記録する", (body, close) => {
      const picker = o ? null : App.memberPicker({ value: withId && App.memberById(withId) ? withId : null, exclude: [App.session.memberId], label: "相手" });
      const today = App.todayKey();
      const date = h("input", { type: "date", value: o ? o.date : today, required: true });
      const quick = h("div", { class: "app-chips" }, [["今日", 0], ["明日", 1], ["あさって", 2], ["1週間後", 7]].map(([label, n]) =>
        h("button", { type: "button", class: "app-pill", onclick: () => { date.value = addDays(today, n); date.dispatchEvent(new Event("change")); } }, label)));
      const time = h("select", { "aria-label": "開始時刻" }, timeOptions());
      time.value = o ? o.time : "";
      if (o && o.time && time.value !== o.time) time.append(h("option", { value: o.time }, o.time)), time.value = o.time;
      // 30分きざみで5時間まで(以前の 45分 の記録はそのまま出す)
      const durs = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
      if (o && o.duration && !durs.includes(o.duration)) durs.push(o.duration), durs.sort((a, b) => a - b);
      const duration = h("select", { "aria-label": "時間" }, durs.map((n) => h("option", { value: String(n) }, durLabel(n))));
      duration.value = String(o ? o.duration : 60);
      // 終わりの時刻(日付をまたぐときは「翌」)
      const endNote = h("p", { class: "app-field-hint one-end", "aria-live": "polite" });
      const drawEnd = () => {
        if (!time.value) { endNote.textContent = ""; return; }
        const [hh, mm] = time.value.split(":").map(Number);
        const m = hh * 60 + mm + Number(duration.value);
        endNote.textContent = `終わり:${m >= 24 * 60 ? "翌" : ""}${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      };
      time.addEventListener("change", drawEnd);
      duration.addEventListener("change", drawEnd);
      drawEnd();

      // 場所: 現地(対面)か Google Meet
      const place = h("input", { type: "text", maxlength: "80", placeholder: "例:新潟駅前のカフェ", value: o && o.mode !== "meet" ? o.place : "" });
      const meetUrl = h("input", { type: "url", maxlength: "200", placeholder: "https://meet.google.com/…", value: o ? o.meetUrl : "" });
      const onsiteBox = h("div", { class: "one-mode-box" }, place);
      const meetBox = h("div", { class: "one-mode-box" },
        oneMeta.calendar
          ? h("p", { class: "one-meet-note" }, "保存すると Google Meet の会議と Google カレンダーの予定を自動で作り、2人に招待を送ります。",
            oneMeta.hasCalendarEmail ? null : h("a", { href: "#me/calendar" }, "(招待を受け取るメールアドレスを登録する)"))
          : [h("p", { class: "one-meet-note" }, "いまはお試し版のため、Meet は自動で作れません(共有サーバーに切り替えると自動になります)。下のボタンで作り、URL を貼り付けてください。"),
            h("div", { class: "app-btn-row" }, h("a", { class: "app-btn ghost small", href: "https://meet.google.com/new", target: "_blank", rel: "noopener" }, "Meet を作る")),
            meetUrl],
        o && o.meetUrl ? h("a", { class: "app-btn small", href: o.meetUrl, target: "_blank", rel: "noopener" }, "Meet に参加する") : null);
      const mode = toggleGroup([{ id: "onsite", label: "現地(対面)" }, { id: "meet", label: "Google Meet" }], o ? o.mode : "onsite", (v) => {
        onsiteBox.hidden = v !== "onsite";
        meetBox.hidden = v !== "meet";
      });
      onsiteBox.hidden = mode.getValue() !== "onsite";
      meetBox.hidden = mode.getValue() !== "meet";

      // 状況: 予定の時刻を過ぎると自動で「実施」になる
      const isPast = () => date.value < today;
      const status = toggleGroup([{ id: "planned", label: "予定" }, { id: "done", label: "実施した" }, { id: "cancelled", label: "中止" }], o ? o.status : "planned");
      date.addEventListener("change", () => { if (!o) status.setValue(isPast() ? "done" : "planned"); });

      const note = h("textarea", { rows: "4", maxlength: "2000", placeholder: "相手の強み・紹介してほしい人・印象に残った話など(あなただけが見られます)" });
      note.value = o ? o.note : "";
      const next = h("input", { type: "text", maxlength: "200", placeholder: "例:〇〇さんを紹介する", value: o ? o.next : "" });
      const err = h("p", { class: "app-error", role: "alert" });
      const save = h("button", { type: "submit", class: "app-btn primary wide" }, "保存する");
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        const payload = {
          id: o ? o.id : "", withMemberId: o ? o.with : picker.getValue(), date: date.value, time: time.value, duration: Number(duration.value),
          mode: mode.getValue(), place: place.value.trim(), meetUrl: meetUrl.value.trim(), status: status.getValue(),
          note: note.value, next: next.value.trim(), appUrl: App.siteUrl("#log/1on1"),
        };
        if (!payload.withMemberId) { err.textContent = "相手を選んでください。"; return; }
        if (!payload.date) { err.textContent = "日付を選んでください。"; return; }
        save.disabled = true;
        const d = await App.api("save1on1", payload, { raw: true, quiet: true });
        save.disabled = false;
        if (!d || d.success === false) { err.textContent = d ? d.error.userMessage : "保存できませんでした。"; return; }
        close();
        App.toast(d.calendar === "synced" ? (payload.mode === "meet" ? "Google Meet と Google カレンダーの予定を作りました" : "Google カレンダーに予定を入れました")
          : d.calendar === "error" ? "保存しました(Google カレンダーには入れられませんでした)" : "保存しました");
        App.go("log/1on1");
      } },
      o ? null : App.field("相手", picker),
      App.field("日付", h("div", null, date, quick)),
      h("div", { class: "app-grid2" }, App.field("開始時刻", time), App.field("時間", duration)), endNote,
      App.field("場所", h("div", null, mode, onsiteBox, meetBox)),
      App.field("状況", status, "予定の時刻を過ぎると、自動で「実施」になります(中止したときは「中止」に)"),
      App.field("メモ", note),
      App.field("次にやること", next),
      err,
      save,
      o ? h("div", { class: "app-form-foot" },
        App.btn(`${o.withName}さんのプロフィール`, () => { location.href = `../referral/#member=${encodeURIComponent(o.with)}`; }, "ghost small"),
        App.btn("削除", async () => {
          if (!confirm("この 1on1 を削除しますか?(Google カレンダーの予定も消えます)")) return;
          if (await App.api("delete1on1", { id: o.id })) { close(); App.toast("削除しました"); App.route(); }
        }, "ghost small danger")) : null));
    }, { noFocus: true });
  }

  // ============================================
  // ランキング(チーム内・チーム対抗)— 貢献ポイントで、紹介と貢献金額が増えるように見える化
  // ============================================
  const PERIODS = [{ id: "month", label: "今月" }, { id: "prev", label: "先月" }, { id: "year", label: "今年" }, { id: "all", label: "すべて" }];
  const METRICS = [
    { id: "points", label: "貢献ポイント", unit: "pt" },
    { id: "referrals", label: "紹介", unit: "件" },
    { id: "miles", label: "貢献金額", yen: true },
    { id: "won", label: "成約", unit: "件" },
    { id: "oneOnOnes", label: "1on1", unit: "回" },
    { id: "attended", label: "出席", unit: "回" },
    { id: "visitors", label: "ビジター", unit: "名" },
  ];
  const fmtV = (m, v) => (m.yen ? App.yen(v) : `${v}${m.unit}`); // pt は小数1けた(0.1pt 単位)
  const ymLabel = (ym) => `${Number(ym.slice(5, 7))}月`;

  async function renderRank(el, params) {
    const period = PERIODS.some((p) => p.id === params.get("p")) ? params.get("p") : "month";
    const metric = METRICS.find((m) => m.id === params.get("m")) || METRICS[0];
    const d = await App.api("getTeamRanking", { period });
    if (!d) return;
    const set = (k, v) => { const p = new URLSearchParams({ p: period, m: metric.id }); p.set(k, v); App.go(`log/rank?${p}`); };
    const P = d.points;
    const me = d.me;

    el.append(App.segmented(PERIODS, period, (v) => set("p", v)));

    // ---------- 貢献ポイントのつけ方(開いて確かめる) ----------
    el.append(h("details", { class: "rk-howto" },
      h("summary", null, "貢献ポイントのつけ方(タップで開く)"),
      h("table", { class: "rk-pt-table" }, h("tbody", null,
        [["紹介 1件", `+${P.referral}pt`, "紹介を記録したとき"],
          ["成約 1件", `+${P.won}pt`, "紹介した相手が成約にしたとき"],
          [`貢献金額 ${P.milesPer.toLocaleString("ja-JP")}円ごと`, `+${P.mile}pt`, "あなたの紹介から生まれた売上(ありがとうマイル)"],
          ["1on1 1回", `+${P.oneOnOne}pt`, ""],
          ["定例会に出席", `+${P.attended}pt`, ""],
          ["ビジターの申込 1名", `+${P.visitor}pt`, ""]].map(([k, v, note]) => h("tr", null,
          h("th", { scope: "row" }, k, note ? h("small", null, note) : null), h("td", null, v))))),
      h("p", { class: "app-field-hint" }, "例:紹介を2件して、そのうち1件が10万円で成約 → 1+1+3+10 = 15pt")));

    // ---------- あなた ----------
    if (me) {
      const next = me.rank > 1 && me.gap ? `あと ${me.gap}pt で ${me.rank - 1}位(${me.gapName}さん)` : me.points > 0 ? "1位です!" : `紹介を1件記録すると +${P.referral}pt`;
      el.append(h("section", { class: "rk-me" },
        h("div", { class: "rk-me-rank" }, h("span", null, "BT-EX5 の中で"), h("b", null, `${me.rank}`, h("small", null, `位 / ${d.members.length}名`))),
        h("div", { class: "rk-me-main" },
          h("p", { class: "rk-me-pt" }, h("b", null, String(me.points)), " pt"),
          h("p", { class: "rk-me-next" }, next),
          d.streak > 1 ? h("p", { class: "rk-streak" }, `🔥 ${d.streak}か月つづけて紹介しています`) : null),
        h("div", { class: "rk-me-quick" },
          h("a", { class: "app-btn small", href: "#log/ref?new" }, `紹介を記録 +${P.referral}pt`),
          h("a", { class: "app-btn ghost small", href: "../referral/" }, "紹介先を探す"))));
    }

    // ---------- BT-EX5 全体の今月の目標 ----------
    const g = d.goal;
    const bar = (label, v, goal, fmt) => {
      const pct = goal ? Math.min(100, Math.round((v / goal) * 100)) : 0;
      return h("div", { class: "rk-goal" },
        h("div", { class: "rk-goal-head" }, h("span", null, label), h("b", null, `${fmt(v)} / ${fmt(goal)}`), h("small", null, `${pct}%`)),
        h("div", { class: "rk-goal-bar", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": `${label}の達成率` },
          h("span", { style: `width:${pct}%` })),
        v < goal ? h("p", { class: "rk-goal-left" }, `目標まであと ${fmt(goal - v)}`) : h("p", { class: "rk-goal-left is-done" }, "目標達成!"));
    };
    el.append(App.section("BT-EX5 みんなの今月の目標",
      h("div", { class: "rk-goals" },
        bar("紹介", g.referrals, g.target.referrals, (v) => `${v}件`),
        g.target.miles ? bar("貢献金額", g.miles, g.target.miles, App.yen) : null),
      d.canEditGoals ? App.btn("目標を変える(管理者)", () => goalForm(g.target), "ghost small") : null));

    // ---------- ランキング(個人) ----------
    el.append(App.section("ランキング",
      h("div", { class: "rank-metrics" }, METRICS.map((m) => h("button", { type: "button", class: `app-pill${m.id === metric.id ? " is-on" : ""}`, onclick: () => set("m", m.id) }, m.label))),
      rankList(d.members.slice().sort((a, b) => b[metric.id] - a[metric.id] || b.points - a.points), metric, (r) => r.name, ptBreakdown)));

    // ---------- あなたの推移(直近6か月) ----------
    el.append(App.section("あなたの推移(直近6か月)",
      h("div", { class: "rk-charts" },
        barChart("紹介の件数", d.history.map((x) => ({ label: ymLabel(x.month), value: x.referrals, text: `${x.referrals}件` }))),
        barChart("貢献金額", d.history.map((x) => ({ label: ymLabel(x.month), value: x.miles, text: App.yen(x.miles) }))))));
  }

  // 1人ずつの順位(指標を選べる)
  function rankList(rows, metric, nameOf, detailOf) {
    const top = rows.length ? rows[0][metric.id] : 0;
    // 選んだ指標での順位(同じ値は同じ順位)
    let prev = null, rank = 0;
    return h("ol", { class: "rank-list rk-members" }, rows.map((r, i) => {
      if (prev === null || r[metric.id] !== prev) rank = i + 1;
      prev = r[metric.id];
      return h("li", { class: r.isMe ? "is-me" : "" },
        h("span", { class: `rank-no${rank <= 3 && r[metric.id] > 0 ? ` top${rank}` : ""}` }, String(rank)),
        h("span", { class: "rank-name" }, h("b", null, nameOf(r), r.isMe ? "(あなた)" : ""), h("small", null, detailOf(r))),
        h("span", { class: "rank-bar", "aria-hidden": "true" }, h("span", { style: `width:${top && r[metric.id] ? Math.max(4, (r[metric.id] / top) * 100) : 0}%` })),
        h("b", { class: "rank-v" }, fmtV(metric, r[metric.id])));
    }));
  }
  function ptBreakdown(r) {
    return [r.referrals && `紹介${r.referrals}`, r.won && `成約${r.won}`, r.miles && App.yen(r.miles), r.oneOnOnes && `1on1 ${r.oneOnOnes}`, r.attended && `出席${r.attended}`, r.visitors && `ビジター${r.visitors}`]
      .filter(Boolean).join(" ・ ") || "まだ記録がありません";
  }

  // 縦棒グラフ(1系列。最新の月だけ値を表示し、ほかは押す・重ねると値が出る)
  function barChart(title, data) {
    const W = 300, H = 140, padB = 22, padT = 18, gap = 10;
    const max = Math.max(1, ...data.map((x) => x.value));
    const bw = (W - gap * (data.length - 1)) / data.length;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${title}:${data.map((x) => `${x.label} ${x.text}`).join("、")}`);
    const base = H - padB;
    const line = document.createElementNS(NS, "line");
    Object.entries({ x1: 0, x2: W, y1: base, y2: base, class: "rk-axis" }).forEach(([k, v]) => line.setAttribute(k, v));
    svg.append(line);
    const tip = h("div", { class: "rk-tip", hidden: true });
    data.forEach((x, i) => {
      const bh = x.value ? Math.max(4, ((base - padT) * x.value) / max) : 0;
      const bx = i * (bw + gap);
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", `rk-bar${i === data.length - 1 ? " is-last" : ""}`);
      g.setAttribute("tabindex", "0");
      if (bh) {
        // 上の角だけ丸く(4px)、下はベースラインにつける
        const r = Math.min(4, bw / 2, bh);
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", `M${bx},${base}V${base - bh + r}Q${bx},${base - bh} ${bx + r},${base - bh}H${bx + bw - r}Q${bx + bw},${base - bh} ${bx + bw},${base - bh + r}V${base}Z`);
        g.append(p);
      }
      // 押しやすいよう、見えない大きな当たり判定
      const hit = document.createElementNS(NS, "rect");
      Object.entries({ x: bx, y: 0, width: bw, height: H, fill: "transparent" }).forEach(([k, v]) => hit.setAttribute(k, v));
      g.append(hit);
      const lab = document.createElementNS(NS, "text");
      Object.entries({ x: bx + bw / 2, y: H - 6, "text-anchor": "middle", class: "rk-xlab" }).forEach(([k, v]) => lab.setAttribute(k, v));
      lab.textContent = x.label;
      g.append(lab);
      if (i === data.length - 1) {
        const v = document.createElementNS(NS, "text");
        Object.entries({ x: bx + bw / 2, y: base - bh - 5, "text-anchor": "middle", class: "rk-vlab" }).forEach(([k, val]) => v.setAttribute(k, val));
        v.textContent = x.text;
        g.append(v);
      }
      const show = () => { tip.textContent = `${x.label}:${x.text}`; tip.hidden = false; tip.style.left = `${((bx + bw / 2) / W) * 100}%`; };
      g.addEventListener("pointerenter", show);
      g.addEventListener("focus", show);
      g.addEventListener("click", show);
      g.addEventListener("pointerleave", () => { tip.hidden = true; });
      g.addEventListener("blur", () => { tip.hidden = true; });
      svg.append(g);
    });
    return h("figure", { class: "rk-chart" }, h("figcaption", null, title), h("div", { class: "rk-chart-box" }, svg, tip),
      h("table", { class: "visually-hidden" }, h("tbody", null, data.map((x) => h("tr", null, h("th", null, x.label), h("td", null, x.text))))));
  }

  function goalForm(target) {
    App.openSheet("BT-EX5 みんなの今月の目標", (body, close) => {
      const refs = h("input", { type: "text", inputmode: "numeric", value: String(target.referrals || "") });
      const miles = h("input", { type: "text", inputmode: "numeric", placeholder: "例:1000000(0なら表示しない)", value: target.miles ? String(target.miles) : "" });
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        if (await App.api("adminSetTeamGoals", { team: "", referrals: refs.value, miles: miles.value })) { close(); App.toast("目標を保存しました"); App.route(); }
      } }, App.field("紹介の件数(月)", refs, "決めていないときは、人数 × 1件"), App.field("貢献金額(月・円)", miles),
      h("button", { type: "submit", class: "app-btn primary wide" }, "保存する")));
    });
  }

  App.referralForm = referralForm;
  App.thanksForm = thanksForm;
  App.oneForm = oneForm;
})();
