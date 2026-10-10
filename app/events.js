// ============================================
// app/events.js — 予定(定例会・出欠・出席コード・ビジター招待)
// 管理者は定例会の作成・受付(出席コード)・出欠一覧もここで行う
// ============================================

(function () {
  "use strict";
  const { h } = App;

  App.views.events = {
    title: "予定",
    async render(el, parts, params) {
      if (parts[0] === "manage" && parts[1]) return renderManage(el, parts[1]);
      const d = await App.api("listEvents");
      if (!d) return;
      const upcoming = d.events.filter((e) => !e.past);
      const past = d.events.filter((e) => e.past).reverse();

      // 出席コード(今日の受付が開いているときは目立たせる)
      const open = upcoming.some((e) => e.checkInOpen && !e.attended);
      el.append(h("section", { class: `checkin-box${open ? " is-open" : ""}` },
        h("h2", null, open ? "受付中:出席コードを入れてください" : "出席コード"),
        h("p", null, "会場で案内される4桁の数字を入れると、出席が記録されます。"),
        App.checkInForm()));

      if (App.isAdmin()) el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 定例会を作る(管理者)", () => eventForm(null), "ghost wide")));

      el.append(App.section("これからの定例会",
        upcoming.length
          ? h("div", { class: "ev-list" }, upcoming.map((ev) => {
            const card = App.eventCard(ev, d.today);
            card.extra = (e) => h("div", { class: "ev-extra" },
              e.body ? h("details", { class: "ev-detail" }, h("summary", null, "くわしく"), App.richText(e.body), e.url ? h("a", { href: e.url, target: "_blank", rel: "noopener" }, "案内ページ") : null) : null,
              e.yesNames.length ? h("p", { class: "ev-names" }, `出席予定:${e.yesNames.join("、")}`) : null,
              h("div", { class: "ev-actions" },
                App.btn("ビジターを招待", () => inviteForm(e), "small"),
                App.isAdmin() ? App.btn("管理", () => App.go(`events/manage/${e.id}`), "ghost small") : null));
            card.redraw();
            return card;
          }))
          : App.empty("予定されている定例会はまだありません。")));

      await renderVisitors(el);

      if (past.length) {
        el.append(App.section("これまでの定例会",
          h("ul", { class: "app-list" }, past.map((e) => h("li", null,
            h("div", { class: "app-row" },
              h("span", { class: "app-row-main" }, h("b", null, e.title), h("small", null, `${App.fmtDate(e.date)} ・ 出席 ${e.yesCount}名`)),
              e.attended ? App.chip("出席", "good") : e.myRsvp === "no" ? App.chip("欠席", "mute") : null,
              App.isAdmin() ? App.btn("管理", () => App.go(`events/manage/${e.id}`), "ghost small") : null))))));
      }

      if (params.has("invite")) {
        const target = upcoming[0];
        if (target) inviteForm(target); else App.toast("招待できる定例会がまだありません");
      }
    },
  };

  // ---------- ビジター招待 ----------
  function inviteText(url, ev, guest) {
    return [
      `${guest ? `${guest}様\n` : ""}BT-EX5 の定例会にご招待します。`,
      `新潟・東京の経営者が集まり、お互いに仕事を紹介し合う会です。`,
      ``,
      `■ ${ev.title}`,
      `日時:${App.fmtDateLong(ev.date)} ${ev.start || ""}${ev.end ? `〜${ev.end}` : ""}`,
      ev.place ? `場所:${ev.place}` : "",
      ev.fee ? `参加費:${ev.fee}` : "",
      ``,
      `参加のお申し込みはこちら(1分で終わります)`,
      url,
    ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  }

  function inviteForm(ev) {
    App.openSheet("ビジターを招待", (body, close) => {
      const name = h("input", { type: "text", maxlength: "40", placeholder: "例:佐藤様(あとで相手が入力するので空でも可)" });
      const result = h("div");
      const make = h("button", { type: "submit", class: "app-btn primary wide" }, "招待URLを作る");
      body.append(h("p", { class: "app-lead" }, `${ev.title}(${App.fmtDate(ev.date)})に招待します。URL を送るだけで、相手はスマホから申し込めます。申込状況はここで見られます。`),
        h("form", { class: "app-form", onsubmit: async (e) => {
          e.preventDefault();
          make.disabled = true;
          const d = await App.api("createVisitorInvite", { eventId: ev.id, name: name.value.trim() });
          make.disabled = false;
          if (!d) return;
          const url = App.siteUrl(`../visit/?t=${encodeURIComponent(d.visitor.token)}`);
          const text = inviteText(url, ev, name.value.trim());
          make.hidden = true;
          const box = h("textarea", { rows: "9", readonly: true, class: "invite-text" });
          box.value = text;
          App.fill(result, 
            h("p", { class: "app-field-label" }, "この文を LINE などで送ってください"),
            box,
            h("div", { class: "app-btn-row" },
              App.btn("送る(共有)", () => App.shareText(text, "BT-EX5 定例会のご招待"), "primary"),
              App.btn("コピー", () => App.copyText(text), "ghost")),
            App.btn("閉じる", () => { close(); App.route(); }, "ghost wide"));
        } }, App.field("相手のお名前(任意)", name), make, result));
    });
  }

  async function renderVisitors(el) {
    const d = await App.api("listMyVisitors", {}, { quiet: true });
    if (!d || !d.visitors.length) return;
    el.append(App.section(App.isAdmin() ? "ビジター(全員分)" : "あなたが招待したビジター",
      h("ul", { class: "app-cards" }, d.visitors.slice(0, 30).map((v) => h("li", null, visitorCard(v))))));
  }

  function visitorCard(v) {
    const st = App.VISITOR_STATUS[v.status] || App.VISITOR_STATUS.invited;
    const url = App.siteUrl(`../visit/?t=${encodeURIComponent(v.token)}`);
    const sel = h("select", { "aria-label": "状況", onchange: async () => {
      if (await App.api("updateVisitor", { id: v.id, status: sel.value })) App.toast("更新しました");
    } }, Object.keys(App.VISITOR_STATUS).map((k) => h("option", { value: k }, App.VISITOR_STATUS[k].label)));
    sel.value = v.status;
    return h("article", { class: "ref-card" },
      h("div", { class: "ref-card-head" }, App.avatar(v.name || "?"), h("div", null, h("b", null, v.name || "(未入力)"), h("small", null, `${App.fmtDate(v.eventDate)} ${v.eventTitle}`)), App.chip(st.label, st.tone)),
      h("dl", { class: "ref-card-body" },
        v.company ? [h("dt", null, "会社"), h("dd", null, v.company)] : null,
        v.business ? [h("dt", null, "事業"), h("dd", null, v.business)] : null,
        v.contact ? [h("dt", null, "連絡先"), h("dd", null, v.contact)] : null,
        v.message ? [h("dt", null, "ひとこと"), h("dd", null, v.message)] : null,
        App.isAdmin() ? [h("dt", null, "招待した人"), h("dd", null, v.byName)] : null),
      h("div", { class: "ref-card-actions" }, sel, App.btn("URLをコピー", () => App.copyText(url), "ghost small")));
  }

  // ---------- 定例会の作成・編集(管理者) ----------
  function eventForm(ev) {
    App.openSheet(ev ? "定例会を編集" : "定例会を作る", (body, close) => {
      const f = {
        title: h("input", { type: "text", maxlength: "80", value: ev ? ev.title : "BT-EX5 定例会", required: true }),
        date: h("input", { type: "date", value: ev ? ev.date : "", required: true }),
        start: h("input", { type: "time", value: ev ? ev.start : "19:00" }),
        end: h("input", { type: "time", value: ev ? ev.end : "21:00" }),
        area: h("select", null, Object.keys(App.AREA_LABELS).map((k) => h("option", { value: k }, App.AREA_LABELS[k]))),
        place: h("input", { type: "text", maxlength: "120", value: ev ? ev.place : "", placeholder: "会場名・住所" }),
        fee: h("input", { type: "text", maxlength: "60", value: ev ? ev.fee : "", placeholder: "例:3,000円(ビジター無料)" }),
        url: h("input", { type: "url", maxlength: "300", value: ev ? ev.url : "", placeholder: "https://(地図・案内ページ。任意)" }),
        body: h("textarea", { rows: "4", maxlength: "2000", placeholder: "内容・持ち物など" }),
      };
      f.area.value = ev ? ev.area : "niigata";
      f.body.value = ev ? ev.body : "";
      const err = h("p", { class: "app-error", role: "alert" });
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        if (!f.title.value.trim() || !f.date.value) { err.textContent = "名前と日付を入れてください。"; return; }
        const payload = { id: ev ? ev.id : "" };
        Object.keys(f).forEach((k) => { payload[k] = f[k].value.trim(); });
        const d = await App.api("adminSaveEvent", { event: payload });
        if (!d) return;
        close();
        App.toast("保存しました");
        App.route();
      } },
      App.field("名前", f.title),
      h("div", { class: "app-grid2" }, App.field("日付", f.date), App.field("エリア", f.area)),
      h("div", { class: "app-grid2" }, App.field("開始", f.start), App.field("終了", f.end)),
      App.field("会場", f.place), App.field("参加費", f.fee), App.field("案内ページ", f.url), App.field("内容", f.body),
      err, h("button", { type: "submit", class: "app-btn primary wide" }, "保存する")));
    });
  }

  // ---------- 定例会の管理(受付・出欠一覧) ----------
  async function renderManage(el, id) {
    const d = await App.api("adminEventDetail", { id });
    if (!d) return;
    const ev = d.event;
    el.append(h("a", { class: "app-back", href: "#events" }, "← 予定に戻る"));
    el.append(h("h1", { class: "app-h1" }, ev.title), h("p", { class: "app-lead" }, `${App.fmtDateLong(ev.date)} ${ev.start}〜${ev.end} ・ ${ev.place}`));

    const codeBox = h("div", { class: "code-box" });
    function drawCode(code) {
      App.fill(codeBox, 
        code ? h("p", { class: "code-big", "aria-label": `出席コード ${code}` }, code) : h("p", { class: "code-off" }, "受付は閉じています"),
        h("p", { class: "app-field-hint" }, code ? "この数字を会場で見せてください(当日だけ有効)。スマホを横にすると大きく見せられます。" : "当日、受付を開くと4桁の出席コードが出ます。"),
        h("div", { class: "app-btn-row" },
          code ? App.btn("受付を閉じる", async () => { const r = await App.api("adminOpenCheckIn", { id, open: false }); if (r) drawCode(""); }, "ghost")
            : App.btn("受付を開く(コードを出す)", async () => { const r = await App.api("adminOpenCheckIn", { id, open: true }); if (r) drawCode(r.code); }, "primary"),
          code ? App.btn("コードを作り直す", async () => { const r = await App.api("adminOpenCheckIn", { id, open: true }); if (r) drawCode(r.code); }, "ghost") : null));
    }
    drawCode(d.code);
    el.append(App.section("受付(出席コード)", codeBox));

    const yes = d.members.filter((m) => m.rsvp === "yes").length;
    const att = d.members.filter((m) => m.attended).length;
    const noAns = d.members.filter((m) => !m.rsvp).length;
    el.append(App.section(`出欠(出席予定 ${yes} ・ 出席 ${att} ・ 未回答 ${noAns})`,
      h("p", { class: "app-field-hint" }, "コードを入れられなかった人は、ここで出席にできます。"),
      h("ul", { class: "app-list att-list" }, d.members.map((m) => {
        const cb = h("input", { type: "checkbox", checked: m.attended, onchange: async () => {
          const r = await App.api("adminMarkAttendance", { id, memberId: m.memberId, attended: cb.checked });
          if (!r) cb.checked = !cb.checked;
        } });
        return h("li", null, h("label", { class: "app-row" },
          h("span", { class: "app-row-main" }, h("b", null, m.name), h("small", null, m.team || "")),
          m.rsvp === "yes" ? App.chip("出席予定", "info") : m.rsvp === "no" ? App.chip("欠席", "mute") : App.chip("未回答", "warn"),
          cb, h("span", { class: "att-label" }, "出席")));
      }))));

    if (d.visitors.length) {
      el.append(App.section(`ビジター(${d.visitors.length})`, h("ul", { class: "app-cards" }, d.visitors.map((v) => h("li", null, visitorCard(v))))));
    }
    el.append(h("div", { class: "app-btn-row" },
      App.btn("定例会を編集", () => eventForm(ev), "ghost"),
      App.btn("削除", async () => {
        if (!confirm(`「${ev.title}」を削除しますか?出欠の記録も消えます。`)) return;
        if (await App.api("adminDeleteEvent", { id })) { App.toast("削除しました"); App.go("events"); }
      }, "ghost danger")));
  }
})();
