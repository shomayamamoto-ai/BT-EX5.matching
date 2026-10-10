// ============================================
// app/events.js — 予定(定例会・出欠・出席コード・ビジター招待)
// 管理者は定例会の作成・受付(出席コード)・出欠一覧もここで行う
// ============================================

(function () {
  "use strict";
  const { h } = App;

  App.views.events = {
    title: "予定",
    autoRefresh: (parts) => parts[0] !== "manage" && parts[0] !== "detail",
    async render(el, parts, params) {
      if (parts[0] === "manage" && parts[1]) return renderManage(el, parts[1]);
      if (parts[0] === "detail" && parts[1]) return renderDetail(el, parts[1]);
      // 会場の QR コードで開いたとき(#events?checkin=1234): そのまま出席にする
      const qrCode = (params.get("checkin") || "").replace(/\D/g, "");
      if (qrCode.length === 4) {
        history.replaceState(null, "", "#events");
        const r = await App.api("checkIn", { code: qrCode });
        if (r) App.toast(`${r.event.title} に出席しました`);
      }
      const d = await App.api("listEvents");
      if (!d) return;
      eventMeta = { calendar: d.calendar };
      const upcoming = d.events.filter((e) => !e.past);
      const past = d.events.filter((e) => e.past).reverse();

      // 出席コード(今日の受付が開いているときは目立たせる)
      const open = upcoming.some((e) => e.checkInOpen && !e.attended);
      const venueSoon = upcoming.some((e) => !e.online && App.daysUntil(e.date, d.today) <= 1);
      const rate = past.length ? h("p", { class: "checkin-rate" }, `あなたの出席率(最近 ${past.length} 回):${Math.round((past.filter((e) => e.attended).length / past.length) * 100)}%(${past.filter((e) => e.attended && !e.late).length}回出席${past.some((e) => e.late) ? `・${past.filter((e) => e.late).length}回遅刻早退` : ""})`) : null;
      if (open || venueSoon) {
        el.append(h("section", { class: `checkin-box${open ? " is-open" : ""}` },
          h("h2", null, open ? "受付中:出席コードを入れてください" : "会場の出席コード"),
          h("p", null, "会場の QR コードをスマホのカメラで読み取るか、案内される4桁の数字を入れると、出席が記録されます。"),
          App.checkInForm(), rate));
      } else {
        el.append(h("section", { class: "checkin-box" },
          h("h2", null, "出欠のつけ方"),
          h("p", null, "オンラインの定例会は、Google Meet に参加した時間で自動で出欠がつきます(100分以上で出席、60分以上100分未満は遅刻早退)。出席コードは要りません。"),
          rate));
      }

      if (App.isAdmin()) el.append(h("div", { class: "app-cta-row" }, App.btn("＋ 定例会を作る(管理者)", () => eventForm(null, d.events[d.events.length - 1]), "ghost wide")));

      el.append(App.section("これからの定例会",
        upcoming.length
          ? h("div", { class: "ev-list" }, upcoming.map((ev) => {
            const card = App.eventCard(ev, d.today);
            card.extra = (e) => h("div", { class: "ev-extra" },
              e.yesNames.length ? h("p", { class: "ev-names" }, `出席予定:${e.yesNames.join("、")}`) : null,
              h("div", { class: "ev-actions" },
                App.btn("ビジターを招待", () => App.go(`invite?event=${e.id}`), "small"),
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
              h("a", { class: "app-row-main", href: `#events/detail/${e.id}` }, h("b", null, e.title), h("small", null, `${App.fmtDate(e.date)} ・ 出席 ${e.yesCount}名`)),
              e.attended ? App.chip(e.late ? "遅刻早退" : "出席", e.late ? "warn" : "good") : e.myRsvp === "no" ? App.chip("欠席", "mute") : null,
              App.isAdmin() ? App.btn("管理", () => App.go(`events/manage/${e.id}`), "ghost small") : null))))));
      }

      if (params.has("invite")) App.go("invite");
    },
  };

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
  // ev: 編集する定例会 / tpl: 新しく作るときのひな形(直近の定例会。当日の流れなどをそのまま使う)
  let eventMeta = { calendar: false };
  function eventForm(ev, tpl) {
    const base = ev || tpl || null;
    App.openSheet(ev ? "定例会を編集" : "定例会を作る", (body, close) => {
      const f = {
        title: h("input", { type: "text", maxlength: "80", value: base ? base.title : "BT-EX5 定例会", required: true }),
        date: h("input", { type: "date", value: ev ? ev.date : "", required: true }),
        place: h("input", { type: "text", maxlength: "120", value: base && !base.online ? base.place : "", placeholder: "会場名・住所" }),
        fee: h("input", { type: "text", maxlength: "60", value: base ? base.fee : "会員 無料", placeholder: "例:会員 無料(ビジター 3,000円)" }),
        url: h("input", { type: "url", maxlength: "300", value: ev ? ev.url : "", placeholder: "https://(地図・案内ページ。任意)" }),
        agenda: h("textarea", { rows: "6", maxlength: "2000", placeholder: "①はじめのあいさつ\n②…" }),
        body: h("textarea", { rows: "3", maxlength: "2000", placeholder: "ご案内(どんな会か・持ち物など)" }),
      };
      f.agenda.value = base ? base.agenda : "";
      f.body.value = base ? base.body : "";
      const start = App.timeSelect(base ? base.start : "19:00", { label: "開始" });
      const end = App.timeSelect(base ? base.end : "21:00", { label: "終了" });

      // 開催方法: オンライン(Google Meet)か会場
      const meetUrl = h("input", { type: "url", maxlength: "200", placeholder: "https://meet.google.com/…", value: ev && ev.meetUrl ? ev.meetUrl : "" });
      const areaSel = h("select", { "aria-label": "エリア" }, ["niigata", "tokyo", "other"].map((k) => h("option", { value: k }, App.AREA_LABELS[k])));
      areaSel.value = base && !base.online ? base.area : "niigata";
      const onlineBox = h("div", { class: "one-mode-box" },
        eventMeta.calendar
          ? h("p", { class: "one-meet-note" }, ev && ev.hasMeet ? "Google Meet は作成済みです。日時を変えるとカレンダーの予定も変わります。" : "保存すると Google Meet を自動で作り、申し込んだメンバーに参加リンクを表示します。")
          : [h("p", { class: "one-meet-note" }, "いまはお試し版のため、Google Meet は自動で作れません(共有サーバーで Google カレンダーを連携すると、保存したときに自動で作られます)。下のボタンで作り、URL を貼り付けてください。"),
            h("div", { class: "app-btn-row" }, h("a", { class: "app-btn ghost small", href: "https://meet.google.com/new", target: "_blank", rel: "noopener" }, "Meet を作る")),
            meetUrl]);
      const venueBox = h("div", { class: "one-mode-box" }, areaSel, f.place);
      const how = App.toggle([{ id: "online", label: "オンライン(Google Meet)" }, { id: "venue", label: "会場" }], base && !base.online ? "venue" : "online", (v) => {
        onlineBox.hidden = v !== "online";
        venueBox.hidden = v !== "venue";
      });
      onlineBox.hidden = how.getValue() !== "online";
      venueBox.hidden = how.getValue() !== "venue";

      // 申込締切
      const dlKind = h("select", { "aria-label": "申込締切" },
        h("option", { value: "" }, "締切なし(当日まで)"),
        h("option", { value: "-1|23:59" }, "前日 23:59 まで"),
        h("option", { value: "-2|00:00" }, "2日前 0:00 まで"),
        h("option", { value: "-3|23:59" }, "3日前 23:59 まで"),
        h("option", { value: "custom" }, "日時を指定"));
      const dlDate = h("input", { type: "date" });
      const dlTime = App.timeSelect("23:30", { label: "締切の時刻", from: 0, to: 23 });
      if (![...dlTime.options].some((o) => o.value === "23:59")) dlTime.append(h("option", { value: "23:59" }, "23:59"));
      const dlCustom = h("div", { class: "app-grid2" }, dlDate, dlTime);
      const addDays = (key, n) => {
        const [y, m, d] = key.split("-").map(Number);
        const x = new Date(y, m - 1, d + n);
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
      };
      if (ev && ev.deadline) { dlKind.value = "custom"; dlDate.value = ev.deadline.slice(0, 10); dlTime.value = ev.deadline.slice(11); }
      else if (!ev && tpl && tpl.deadline) {
        const diff = App.daysUntil(tpl.deadline.slice(0, 10), tpl.date);
        const key = `${-diff}|${tpl.deadline.slice(11)}`;
        dlKind.value = [...dlKind.options].some((o) => o.value === key) ? key : "";
      }
      const syncDl = () => { dlCustom.hidden = dlKind.value !== "custom"; };
      dlKind.addEventListener("change", syncDl);
      syncDl();
      const deadline = () => {
        if (!dlKind.value || !f.date.value) return "";
        if (dlKind.value === "custom") return dlDate.value ? `${dlDate.value}T${dlTime.value}` : "";
        const [n, t] = dlKind.value.split("|");
        return `${addDays(f.date.value, Number(n))}T${t}`;
      };

      // 懇親会
      const party = (base && base.party) || null;
      const partyPlace = h("input", { type: "text", maxlength: "120", placeholder: "お店・場所", value: party ? party.place : "" });
      const partyFee = h("input", { type: "text", maxlength: "60", placeholder: "例:5,000円", value: party ? party.fee : "" });
      const partyTime = App.timeSelect(party && party.time ? party.time : "", { label: "懇親会の開始", none: "時刻未定", from: 11 });
      const partyBox = h("div", { class: "one-mode-box" }, partyPlace, h("div", { class: "app-grid2" }, partyTime, partyFee));
      const hasParty = App.toggle([{ id: "no", label: "懇親会なし" }, { id: "yes", label: "懇親会あり" }], party ? "yes" : "no", (v) => { partyBox.hidden = v !== "yes"; });
      partyBox.hidden = hasParty.getValue() !== "yes";

      const err = h("p", { class: "app-error", role: "alert" });
      // 繰り返し(新しく作るときだけ): 毎月同じ週の同じ曜日 / 毎週 / 隔週
      const repeat = h("select", null,
        h("option", { value: "" }, "繰り返さない"),
        h("option", { value: "monthly" }, "毎月(同じ週の同じ曜日)"),
        h("option", { value: "weekly" }, "毎週"),
        h("option", { value: "biweekly" }, "隔週"));
      const times = h("select", null, [2, 3, 4, 6, 8, 10, 12].map((n) => h("option", { value: String(n) }, `${n}回分`)));
      times.value = "6";
      const preview = h("p", { class: "app-field-hint" });
      const repeatDates = () => {
        if (!repeat.value || !f.date.value) return [];
        const [y, m, dd] = f.date.value.split("-").map(Number);
        const first = new Date(y, m - 1, dd);
        const nth = Math.ceil(dd / 7);
        const out = [];
        for (let i = 0; i < Number(times.value); i++) {
          let d;
          if (repeat.value === "monthly") {
            // その月の「第 n ○曜日」。第5週がない月は最後の○曜日
            const mb = new Date(y, m - 1 + i, 1);
            const shift = (first.getDay() - mb.getDay() + 7) % 7;
            d = new Date(mb.getFullYear(), mb.getMonth(), 1 + shift + (nth - 1) * 7);
            if (d.getMonth() !== mb.getMonth()) d.setDate(d.getDate() - 7);
          } else {
            d = new Date(y, m - 1, dd + i * (repeat.value === "weekly" ? 7 : 14));
          }
          out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
        }
        return out;
      };
      const drawPreview = () => {
        const ds = repeatDates();
        preview.textContent = ds.length ? `作る日:${ds.map((x) => App.fmtDate(x)).join("、")}` : "";
      };
      [repeat, times, f.date].forEach((x) => x.addEventListener("change", drawPreview));

      const save = h("button", { type: "submit", class: "app-btn primary wide" }, "保存する");
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        if (!f.title.value.trim() || !f.date.value) { err.textContent = "名前と日付を入れてください。"; return; }
        const online = how.getValue() === "online";
        const payload = {
          id: ev ? ev.id : "", title: f.title.value.trim(), date: f.date.value, start: start.value, end: end.value,
          area: online ? "online" : areaSel.value, place: online ? "" : f.place.value.trim(), fee: f.fee.value.trim(), url: f.url.value.trim(),
          agenda: f.agenda.value, body: f.body.value, deadline: deadline(), meet: online, meetUrl: meetUrl.value.trim(),
          party: hasParty.getValue() === "yes" ? { enabled: true, place: partyPlace.value.trim(), fee: partyFee.value.trim(), time: partyTime.value } : { enabled: false },
        };
        save.disabled = true;
        const d = await App.api("adminSaveEvent", { event: payload, dates: ev ? [] : repeatDates() });
        save.disabled = false;
        if (!d) return;
        close();
        App.toast(`${d.created > 1 ? `${d.created}回分の定例会を作りました` : "保存しました"}${online && d.event.meetUrl ? "(Google Meet を作りました)" : ""}`);
        App.route();
      } },
      App.field("名前", f.title),
      App.field("日付", f.date),
      h("div", { class: "app-grid2" }, App.field("開始", start), App.field("終了", end)),
      App.field("開催方法", h("div", null, how, onlineBox, venueBox)),
      App.field("申込締切", h("div", null, dlKind, dlCustom), "締切を過ぎると、メンバーは出欠を変えられません(管理者は変えられます)"),
      App.field("参加費", f.fee),
      App.field("当日の流れ", f.agenda),
      App.field("ご案内", f.body),
      App.field("懇親会", h("div", null, hasParty, partyBox)),
      App.field("案内ページ(任意)", f.url),
      ev ? null : h("div", { class: "app-grid2" }, App.field("繰り返し", repeat), App.field("回数", times)),
      ev ? null : preview,
      err, save));
    }, { noFocus: true });
  }

  // ---------- 定例会の詳細(全員): 出欠・参加リンク・メンバーの出欠一覧・ビジター ----------
  const KIND_LABELS = { general: "一般", link: "LINK会員" };
  function memberStatus(m) {
    if (m.attended && m.late) return { label: "遅刻早退", tone: "warn" };
    if (m.attended) return { label: "出席", tone: "good" };
    if (m.rsvp === "yes") return { label: "申込", tone: "info" };
    if (m.rsvp === "no") return { label: "事前欠席", tone: "warn" };
    return { label: "未回答", tone: "mute" };
  }
  async function renderDetail(el, id) {
    const d = await App.api("getEvent", { id });
    if (!d) return;
    const ev = d.event;
    document.getElementById("appTitle").textContent = "定例会の詳細";
    el.append(h("a", { class: "app-back", href: "#events" }, "← 定例会の一覧"));
    el.append(h("h1", { class: "app-h1" }, ev.title),
      h("p", { class: "app-lead" }, `${App.fmtDateLong(ev.date)} ${ev.start || ""}${ev.end ? `〜${ev.end}` : ""}`));
    const open = !ev.past && !ev.deadlinePassed;
    el.append(h("div", { class: "evd-badges" },
      App.chip(ev.online ? "オンライン" : App.AREA_LABELS[ev.area] || "会場", "info"),
      App.chip(ev.past ? "終了" : open ? "受付中" : "受付終了", ev.past || !open ? "mute" : "good"),
      ev.past ? null : App.chip(ev.myRsvp === "yes" ? "申込済" : ev.myRsvp === "no" ? "欠席で登録済" : "未申込", ev.myRsvp ? "good" : "warn"),
      ev.deadline && !ev.past ? App.chip(`申込締切 ${App.fmtStamp(ev.deadline)}`, ev.deadlinePassed ? "mute" : "warn") : null));

    const card = h("section", { class: "evd-card" });
    const yesN = d.members.filter((m) => m.rsvp === "yes").length;
    card.append(h("dl", { class: "evd-info" },
      h("div", null, h("dt", null, "開催日時"), h("dd", null, `${App.fmtDate(ev.date)} ${ev.start || ""}${ev.end ? `〜${ev.end}` : ""}`)),
      h("div", null, h("dt", null, "参加費"), h("dd", null, ev.fee || "—")),
      h("div", null, h("dt", null, "参加予定"), h("dd", null, `${yesN}名${d.visitors.length ? `(ビジター ${d.visitors.length}名)` : ""}`)),
      h("div", null, h("dt", null, "申込締切"), h("dd", null, ev.deadline ? App.fmtStamp(ev.deadline) : "当日まで"))));
    // 開催場所(オンラインは、申し込んだ人だけに参加リンク)
    card.append(h("div", { class: "evd-block" }, h("h2", null, "開催場所"),
      ev.online
        ? (ev.meetUrl
          ? h("div", null, h("p", null, "オンライン(Google Meet)"), h("a", { class: "app-btn primary", href: ev.meetUrl, target: "_blank", rel: "noopener" }, "Google Meet に参加する"), h("p", { class: "app-field-hint" }, ev.meetUrl))
          : h("p", null, ev.hasMeet ? "オンライン開催です。参加リンクはお申し込み後に表示されます。" : "オンライン開催です。参加リンクは運営からご案内します。"))
        : h("p", null, ev.place || "会場は追ってご案内します", ev.place ? h("a", { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.place)}`, target: "_blank", rel: "noopener", class: "evd-map" }, " 地図") : null)));
    if (ev.agenda) card.append(h("div", { class: "evd-block" }, h("h2", null, "当日の流れ"), App.richText(ev.agenda)));
    if (ev.body) card.append(h("div", { class: "evd-block" }, h("h2", null, "ご案内"), App.richText(ev.body)));
    if (ev.url) card.append(h("a", { class: "app-more", href: ev.url, target: "_blank", rel: "noopener" }, "案内ページを見る →"));

    // 出欠の登録
    const rsvpBox = h("div", { class: "evd-block evd-rsvp" });
    const drawRsvp = () => {
      const btns = (field, cur, items) => h("div", { class: "ev-rsvp" }, items.map(([val, label]) => h("button", {
        type: "button", class: `ev-rsvp-btn is-${val}${cur === val ? " is-on" : ""}`, "aria-pressed": cur === val ? "true" : "false",
        disabled: !open && !d.isAdmin,
        onclick: async () => {
          const payload = { eventId: ev.id };
          payload[field] = cur === val ? "" : val;
          const r = await App.api("rsvpEvent", payload);
          if (!r) return;
          App.toast(field === "answer" ? (r.event.myRsvp === "yes" ? "出席で申し込みました" : r.event.myRsvp === "no" ? "欠席で登録しました" : "取り消しました") : "懇親会の出欠を登録しました");
          App.route();
        },
      }, cur === val ? `✓ ${label}` : label)));
      App.fill(rsvpBox,
        h("h2", null, "定例会の出欠"),
        ev.past ? h("p", null, ev.attended ? "出席しました。" : ev.myRsvp === "yes" ? "申込済みでした。" : "この定例会は終了しました。")
          : [btns("answer", ev.myRsvp, [["yes", "出席する"], ["no", "欠席する"]]),
            !ev.myRsvp && open ? h("p", { class: "ev-must" }, "出席・欠席のどちらかを必ずご登録ください") : null,
            !open ? h("p", { class: "app-field-hint" }, d.isAdmin ? "申込締切を過ぎています(管理者は変更できます)" : "申込の受付は終了しました。変更は運営にご連絡ください。") : null],
        ev.party ? h("div", { class: "evd-party" },
          h("h2", null, "懇親会"),
          h("p", null, [ev.party.time && `${ev.party.time}〜`, ev.party.place, ev.party.fee && `会費 ${ev.party.fee}`].filter(Boolean).join(" ・ ") || "詳細は追ってご案内します"),
          ev.past ? null : btns("party", ev.myParty, [["yes", "参加する"], ["no", "参加しない"]]),
          h("p", { class: "app-field-hint" }, `参加予定 ${ev.partyYes}名`))
          : h("div", { class: "evd-party" }, h("h2", null, "懇親会"), h("p", { class: "app-field-hint" }, "この回は懇親会の設定がありません。")),
        ev.past ? null : App.calendarButtons({ uid: ev.id, title: ev.title, date: ev.date, start: ev.start, end: ev.end, place: ev.online ? ev.meetUrl || "オンライン(Google Meet)" : ev.place, body: [ev.meetUrl ? `参加リンク:${ev.meetUrl}` : "", ev.agenda, ev.body].filter(Boolean).join("\n\n") }));
    };
    drawRsvp();
    card.append(rsvpBox);
    el.append(card);

    el.append(h("div", { class: "app-btn-row" },
      ev.past ? null : App.btn("ビジターを招待", () => App.go(`invite?event=${ev.id}`), "small"),
      d.isAdmin ? App.btn("受付・出欠の管理", () => App.go(`events/manage/${ev.id}`), "ghost small") : null,
      d.isAdmin ? App.btn("編集", () => eventForm(ev), "ghost small") : null));

    // メンバーの出欠一覧(出席・欠席・未回答に分けて)
    const groups = [
      { label: "出席", tone: "good", list: d.members.filter((m) => m.rsvp === "yes" || m.attended) },
      { label: "欠席", tone: "warn", list: d.members.filter((m) => m.rsvp === "no" && !m.attended) },
      { label: "未回答", tone: "mute", list: d.members.filter((m) => !m.rsvp && !m.attended), note: "申込・欠席のいずれの回答もないメンバー" },
    ];
    el.append(App.section(`メンバー(出席 ${groups[0].list.length} / 欠席 ${groups[1].list.length} / 未回答 ${groups[2].list.length})`,
      ...groups.filter((g) => g.list.length).map((g) => h("div", { class: "evd-group" },
        h("p", { class: `evd-group-head tone-${g.tone}` }, `${g.label}(${g.list.length}名)`, g.note ? h("small", null, ` ${g.note}`) : null),
        h("ul", { class: "app-list evd-members" }, g.list.map((m, i) => {
          const st = memberStatus(m);
          return h("li", { class: m.isMe ? "is-me" : "" }, h("a", { class: "app-row", href: `../referral/#member=${encodeURIComponent(m.id)}` },
            h("span", { class: "evd-no" }, String(i + 1)),
            h("span", { class: "app-row-main" }, h("b", null, m.name, m.isMe ? "(あなた)" : ""), h("small", null, [m.team, m.category].filter(Boolean).join(" ・ ") || "—")),
            App.chip(st.label, st.tone),
            ev.party ? App.chip(m.party === "yes" ? "懇親会○" : m.party === "no" ? "懇親会×" : "懇親会—", m.party === "yes" ? "good" : "mute") : null));
        }))))));

    // 申込ビジター
    const visitorText = () => [`${ev.title}(${App.fmtDate(ev.date)})申込ビジター ${d.visitors.length}名`,
      ...d.visitors.map((v, i) => `${i + 1}. ${v.name || "(未入力)"} / ${[v.company, v.business].filter(Boolean).join(" ")} / ${KIND_LABELS[v.kind] || "一般"} / 紹介者:${v.byName} / ${App.VISITOR_STATUS[v.status] ? App.VISITOR_STATUS[v.status].label : v.status}${v.contact ? ` / ${v.contact}` : ""}`)].join("\n");
    el.append(App.section(`申込ビジター(${d.visitors.length})`,
      d.visitors.length
        ? [h("ul", { class: "app-list" }, d.visitors.map((v, i) => h("li", null, h("div", { class: "app-row" },
          h("span", { class: "evd-no" }, String(i + 1)),
          h("span", { class: "app-row-main" }, h("b", null, v.name || "(未入力)"), h("small", null, [v.company, v.business].filter(Boolean).join(" ・ ") || "—"), h("small", null, `紹介者:${v.byName}${v.contact ? ` ・ ${v.contact}` : ""}`)),
          App.chip(KIND_LABELS[v.kind] || "一般", v.kind === "link" ? "info" : "mute"),
          App.chip((App.VISITOR_STATUS[v.status] || { label: v.status }).label, (App.VISITOR_STATUS[v.status] || {}).tone)))))
          , d.isAdmin ? h("div", { class: "app-btn-row" },
            App.btn("テキストで書き出す", () => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([visitorText()], { type: "text/plain;charset=utf-8" }));
              a.download = `visitors-${ev.date}.txt`;
              document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
            }, "ghost small"),
            App.btn("コピー", () => App.copyText(visitorText()), "ghost small")) : null]
        : App.empty("まだ申込がありません。")));
  }

  // ---------- 定例会の管理(受付・出欠一覧) ----------
  async function renderManage(el, id) {
    const d = await App.api("adminEventDetail", { id });
    if (!d) return;
    const ev = d.event;
    el.append(h("a", { class: "app-back", href: "#events" }, "← 予定に戻る"));
    el.append(h("h1", { class: "app-h1" }, ev.title), h("p", { class: "app-lead" }, `${App.fmtDateLong(ev.date)} ${ev.start}〜${ev.end} ・ ${ev.online ? "オンライン(Google Meet)" : ev.place || "会場未定"}`));

    if (ev.online) {
      // オンライン: Google Meet の参加時間で出欠をつける(出席コードは使わない)
      const mt = d.meet;
      const box = h("div", { class: "code-box meet-att" },
        h("p", { class: "meet-rule" }, `Google Meet に ${mt.presentMin}分以上 → 出席 / ${mt.lateMin}分以上${mt.presentMin}分未満 → 遅刻早退 / ${mt.lateMin}分未満 → 欠席`),
        h("p", { class: "app-field-hint" }, mt.available
          ? (mt.syncedAt ? `最後に読み込んだ時刻:${App.fmtTime(mt.syncedAt)}(終わってから15分後〜3時間、1時間ごとに自動で読み込みます)` : "定例会が終わってから15分後に、自動で読み込みます。いますぐ読み込むこともできます。")
          : "いまはお試し版のため、Meet の参加記録は読み込めません(共有サーバーで設定すると、終わったあと自動で出欠がつきます)。下の一覧で手で付けられます。"),
        mt.error ? h("p", { class: "app-error" }, `前回の読み込みでエラー:${mt.error}`) : null,
        mt.available ? App.btn("いま Meet の参加記録から出欠をつける", async () => {
          const r = await App.api("adminSyncMeetAttendance", { id });
          if (r) { App.toast(`${r.matched}名の出欠をつけました${r.unmatched ? `(名簿に当てはまらない名前 ${r.unmatched}件)` : ""}`); App.route(); }
        }, "primary") : null);
      el.append(App.section("出欠の自動判定(Google Meet)", box));
      if (mt.unmatched.length) {
        el.append(App.section(`名簿に当てはまらなかった Meet の名前(${mt.unmatched.length})`,
          h("p", { class: "app-field-hint" }, "誰かを選ぶと、その人の出欠になります。次からは同じ名前を自動で当てはめます。"),
          h("ul", { class: "app-list" }, mt.unmatched.map((u) => {
            const sel = h("select", { "aria-label": `${u.name}を誰に当てはめるか` }, h("option", { value: "" }, "メンバーを選ぶ"),
              d.members.map((m) => h("option", { value: m.memberId }, m.name)));
            sel.addEventListener("change", async () => {
              if (!sel.value) return;
              if (await App.api("adminMapMeetName", { id, name: u.name, memberId: sel.value })) { App.toast("当てはめました"); App.route(); }
            });
            return h("li", null, h("div", { class: "app-row" }, h("span", { class: "app-row-main" }, h("b", null, u.name), h("small", null, `${u.minutes}分`)), sel));
          }))));
      }
    } else {
      const codeBox = h("div", { class: "code-box" });
      const drawCode = (code) => {
        App.fill(codeBox,
          code ? h("p", { class: "code-big", "aria-label": `出席コード ${code}` }, code) : h("p", { class: "code-off" }, "受付は閉じています"),
          code ? App.qrImage(App.siteUrl(`#events?checkin=${code}`), "出席の QR コード") : null,
          h("p", { class: "app-field-hint" }, code ? "数字か QR コードを会場で見せてください(当日だけ有効)。QR をスマホのカメラで読み取ると、そのまま出席になります。" : "会場で開くときは、当日に受付を開くと4桁の出席コードと QR コードが出ます。"),
          h("div", { class: "app-btn-row" },
            code ? App.btn("受付を閉じる", async () => { const r = await App.api("adminOpenCheckIn", { id, open: false }); if (r) drawCode(""); }, "ghost")
              : App.btn("受付を開く(コードを出す)", async () => { const r = await App.api("adminOpenCheckIn", { id, open: true }); if (r) drawCode(r.code); }, "primary"),
            code ? App.btn("コードを作り直す", async () => { const r = await App.api("adminOpenCheckIn", { id, open: true }); if (r) drawCode(r.code); }, "ghost") : null));
      };
      drawCode(d.code);
      el.append(App.section("受付(会場の出席コード)", codeBox));
    }

    const yes = d.members.filter((m) => m.rsvp === "yes").length;
    const att = d.members.filter((m) => m.attended).length;
    const noAns = d.members.filter((m) => !m.rsvp).length;
    // 運営の手間を減らす: 未回答の人への声かけ文・出欠の一覧をコピー
    const when = `${App.fmtDate(ev.date)} ${ev.start || ""}`.trim();
    const pending = d.members.filter((m) => !m.rsvp);
    const remindText = [
      `【出欠のお願い】${ev.title}(${when}${ev.place ? ` ${ev.place}` : ""})`,
      `まだ出欠の回答がない方:${pending.map((m) => `${m.name}さん`).join("、")}`,
      "",
      "会員サイトの「予定」から、出席・欠席をタップでお知らせください。",
      App.siteUrl("#events"),
    ].join("\n");
    const listText = [
      `${ev.title}(${when})`,
      `出席予定(${yes}名):${d.members.filter((m) => m.rsvp === "yes").map((m) => m.name).join("、") || "なし"}`,
      `欠席(${d.members.filter((m) => m.rsvp === "no").length}名):${d.members.filter((m) => m.rsvp === "no").map((m) => m.name).join("、") || "なし"}`,
      `未回答(${noAns}名):${pending.map((m) => m.name).join("、") || "なし"}`,
      `出席(${d.members.filter((m) => m.attendance === "present").length}名):${d.members.filter((m) => m.attendance === "present").map((m) => m.name).join("、") || "なし"}`,
      `遅刻早退(${d.members.filter((m) => m.attendance === "late").length}名):${d.members.filter((m) => m.attendance === "late").map((m) => m.name).join("、") || "なし"}`,
      d.visitors.length ? `ビジター(${d.visitors.length}名):${d.visitors.map((v) => `${v.name || "(未入力)"}(${v.byName}さん招待)`).join("、")}` : "",
    ].filter(Boolean).join("\n");
    el.append(h("div", { class: "app-btn-row" },
      pending.length ? App.btn(`未回答の ${pending.length} 名への声かけ文をコピー`, () => App.copyText(remindText, "コピーしました。LINE グループなどに貼り付けてください"), "small") : null,
      App.btn("出欠の一覧をコピー", () => App.copyText(listText), "ghost small")));

    const late = d.members.filter((m) => m.attendance === "late").length;
    el.append(App.section(`出欠(出席予定 ${yes} ・ 出席 ${att - late} ・ 遅刻早退 ${late} ・ 未回答 ${noAns})`,
      h("p", { class: "app-field-hint" }, ev.online ? "Meet の記録とちがうときや、名前で当てはまらなかった人は、ここで直せます(手で直した人は自動で上書きしません)。" : "コードを入れられなかった人は、ここで出席にできます。"),
      h("ul", { class: "app-list att-list" }, d.members.map((m) => {
        const t = App.toggle([{ id: "present", label: "出席" }, { id: "late", label: "遅刻早退" }, { id: "", label: "—" }], m.attendance, async (v) => {
          const r = await App.api("adminMarkAttendance", { id, memberId: m.memberId, status: v });
          if (!r) t.setValue(m.attendance); else m.attendance = v;
        });
        t.classList.add("att-toggle");
        return h("li", null, h("div", { class: "app-row att-row" },
          h("span", { class: "app-row-main" }, h("b", null, m.name),
            h("small", null, [m.team, typeof m.minutes === "number" ? `Meet ${m.minutes}分` : "", m.source === "manual" ? "手で修正" : ""].filter(Boolean).join(" ・ "))),
          m.rsvp === "yes" ? App.chip("申込", "info") : m.rsvp === "no" ? App.chip("事前欠席", "mute") : App.chip("未回答", "warn"),
          t));
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
