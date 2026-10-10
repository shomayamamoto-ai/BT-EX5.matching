// ============================================
// app/home.js — ホーム(やること・未読・次の定例会・今月の数字を1画面で)
// ============================================

(function () {
  "use strict";
  const { h } = App;

  App.views.home = {
    title: "ホーム",
    autoRefresh: true,
    async render(el) {
      const d = await App.api("getHome");
      if (!d) return;
      App.setBadges(d.badges);
      const hour = new Date().getHours();
      const hello = hour < 11 ? "おはようございます" : hour < 18 ? "こんにちは" : "おつかれさまです";

      el.append(h("div", { class: "home-hello" },
        h("p", { class: "home-date" }, App.fmtDateLong(d.today)),
        h("h1", null, `${d.me.name}さん、${hello}`)));

      // ---------- いまやること(あるものだけ出す) ----------
      const todo = [];
      if (d.checkInOpen) {
        todo.push(h("div", { class: "home-alert is-hot" },
          h("b", null, "定例会の受付中です"),
          h("span", null, "会場で案内された4桁の出席コードを入れてください"),
          checkInForm()));
      }
      if (d.badges.inbox) {
        todo.push(alertLink("#log/ref", `あなた宛ての紹介が ${d.badges.inbox} 件あります`, "連絡したら状況を「連絡済み」にしてください", "is-warn"));
      }
      if (d.badges.announcements) {
        todo.push(alertLink("#talk/news", `運営からの連絡が ${d.badges.announcements} 件あります`, "未読のお知らせを確認してください"));
      }
      if (d.badges.messages) {
        todo.push(alertLink("#talk/msg", `新しいメッセージが ${d.badges.messages} 件あります`, "メッセージを開く"));
      }
      // 声かけが必要なこと
      (d.followUps || []).forEach((f) => {
        if (f.type === "givenStale") {
          todo.push(alertLink(`#talk/msg/new?to=${encodeURIComponent(f.with)}&tpl=follow&p=${encodeURIComponent(f.prospect || "")}`,
            `${f.withName}さんへの紹介が ${f.days} 日そのままです`, `${f.prospect || "紹介した方"}の件、ひと声かけましょう(メッセージを開く)`));
        } else if (f.type === "inboxStale") {
          todo.push(alertLink("#log/ref", `${f.withName}さんからの紹介に ${f.days} 日返事をしていません`, `${f.prospect || "紹介された方"}へ連絡したら「連絡済み」にしてください`, "is-warn"));
        } else if (f.type === "thanksMissing") {
          todo.push(alertLink("#log/ref", `成約おめでとうございます。${f.withName}さんへお礼を送りましょう`, `${f.prospect || "紹介された方"}の件。「成約 → お礼」で金額を記録できます`, "is-good"));
        } else if (f.type === "oneToday") {
          todo.push(alertLink("#log/1on1", `今日は ${f.withName}さんと 1on1 です`, [f.time, f.place].filter(Boolean).join(" ・ ") || "終わったらメモを残しましょう"));
        } else if (f.type === "onePast") {
          todo.push(alertLink("#log/1on1", `${f.withName}さんとの 1on1 はどうでしたか?`, `${App.fmtDate(f.date)} の予定のままです。「実施した」にしてメモを残しましょう`));
        }
      });
      if (!d.me.hasPassword) {
        todo.push(alertLink("#me/password", "あなた専用のパスワードを決めてください", "共通パスコードは近く使えなくなります。1分で終わります", "is-warn"));
      }
      if (todo.length) el.append(h("div", { class: "home-todo" }, todo));

      // ---------- 次の定例会 ----------
      const next = d.events[0];
      el.append(App.section("次の定例会",
        next ? eventCard(next, d.today, (ev) => { Object.assign(next, ev); }, { noCheckIn: d.checkInOpen }) : App.empty("予定されている定例会はまだありません。", App.btn("予定を見る", () => App.go("events"), "ghost"))));

      // ---------- すぐできること ----------
      el.append(App.section("すぐできること",
        h("div", { class: "home-actions" },
          action("../referral/", "紹介先を探す", "相談からぴったりの人を", "M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z", true),
          action("#log/ref?new", "紹介を記録", "誰を誰につないだか", "M4 12h12l-4-4 1.4-1.4L20 13l-6.6 6.4L12 18l4-4H4z"),
          action("#log/miles?new", "ありがとうを送る", "紹介で決まった仕事のお礼", "M12 21s-7.5-4.6-9.3-9.4C1.4 8 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.5 4.3 7.1C19.5 16.4 12 21 12 21Z"),
          action("#log/1on1?new", "1on1を記録", "会った・会う予定", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1zm16.5-5.9c2.9.4 5.5 2.4 5.5 4.9v1h-4.2c0-2.3-.5-4.3-1.3-5.9Z"),
          action("#events?invite", "ビジターを招待", "招待URLを送るだけ", "M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2Zm9 4c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z"),
          action("#talk/board?new", "掲示板に書く", "紹介依頼・募集・お礼", "M4 4h16v12H7l-3 3z"))));

      // ---------- 今月の数字 ----------
      const s = d.stats;
      el.append(App.section("今月のあなたの数字",
        h("div", { class: "home-stats" },
          stat("紹介した", s.given, "件"),
          stat("紹介された", s.received, "件"),
          stat("成約", s.won, "件"),
          stat("1on1", s.oneOnOnes, "回"),
          h("div", { class: "home-stat is-wide" }, h("span", null, "ありがとうマイル(受け取った)"), h("b", null, App.yen(s.milesIn)), h("small", null, `これまでの合計 ${App.yen(s.milesInAll)}`))),
        h("a", { class: "app-more", href: "#log/rank" }, "ランキングを見る →")));

      // ---------- あなた宛ての紹介 ----------
      if (d.inboxNew.length) {
        el.append(App.section("あなた宛ての新しい紹介",
          h("ul", { class: "app-list" }, d.inboxNew.map((r) => h("li", null,
            h("a", { class: "app-row", href: "#log/ref" },
              App.avatar(r.fromName),
              h("span", { class: "app-row-main" }, h("b", null, `${r.fromName}さんから`), h("small", null, `${r.prospect || "お相手"} ${r.memo ? `— ${r.memo}` : ""}`)),
              App.chip("未対応", "warn")))))));
      }

      // ---------- 1on1 の予定 ----------
      if (d.nextOneOnOnes.length) {
        el.append(App.section("1on1 の予定",
          h("ul", { class: "app-list" }, d.nextOneOnOnes.map((o) => h("li", null,
            h("a", { class: "app-row", href: "#log/1on1" },
              App.avatar(o.withName),
              h("span", { class: "app-row-main" }, h("b", null, `${o.withName}さん`), h("small", null, `${App.fmtDate(o.date)} ${o.time} ${o.place}`))))))));
      }

      // ---------- 運営連絡 ----------
      el.append(App.section("運営連絡",
        d.announcements.length
          ? h("ul", { class: "app-list" }, d.announcements.map((a) => h("li", null,
            h("a", { class: "app-row", href: `#talk/news?open=${encodeURIComponent(a.id)}` },
              h("span", { class: "app-row-main" }, h("b", null, a.pinned ? "📌 " : "", a.title), h("small", null, `${App.fmtTime(a.at)} ・ ${a.cat}`)),
              a.read ? null : App.chip("未読", "warn")))))
          : App.empty("運営からの連絡はまだありません。"),
        h("a", { class: "app-more", href: "#talk/news" }, "すべての運営連絡 →")));

      // ---------- プロフィール ----------
      if (d.missing.length) {
        el.append(h("a", { class: "home-nudge", href: "../profile/" },
          h("b", null, "紹介されやすくするために"),
          h("span", null, `まだ入っていない項目:${d.missing.slice(0, 4).join("・")}${d.missing.length > 4 ? " ほか" : ""}`),
          h("span", { class: "home-nudge-go" }, "自分の情報を入れる →")));
      }
    },
  };

  function alertLink(href, title, sub, cls) {
    return h("a", { class: `home-alert ${cls || ""}`, href }, h("b", null, title), h("span", null, sub));
  }
  function action(href, title, sub, icon, primary) {
    return h("a", { class: `home-action${primary ? " is-primary" : ""}`, href },
      App.icon(icon), h("b", null, title), h("small", null, sub));
  }
  function stat(label, value, unit) {
    return h("div", { class: "home-stat" }, h("span", null, label), h("b", null, String(value), h("small", null, unit)));
  }

  // 出席コードの入力(ホームと予定で使う)
  function checkInForm(eventId, onDone) {
    const input = h("input", { type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: "4", placeholder: "0000", "aria-label": "出席コード(4桁)", autocomplete: "one-time-code", class: "checkin-input" });
    const form = h("form", { class: "checkin-form", onsubmit: async (e) => {
      e.preventDefault();
      const code = input.value.replace(/\D/g, "");
      if (code.length !== 4) { App.toast("4桁の数字を入れてください"); return; }
      const d = await App.api("checkIn", { code, eventId: eventId || "" });
      if (!d) { input.select(); return; }
      App.toast(`${d.event.title} に出席しました`);
      if (onDone) onDone(d.event); else App.route();
    } }, input, h("button", { type: "submit", class: "app-btn" }, "出席する"));
    return form;
  }

  // 定例会のカード(出欠はその場で1タップ)
  function eventCard(ev, today, onUpdate, opt) {
    const card = h("article", { class: "ev-card" });
    function draw() {
      const days = App.daysUntil(ev.date, today);
      const when = days === 0 ? "今日" : days === 1 ? "明日" : days > 0 ? `あと${days}日` : "終了";
      App.fill(card, 
        h("div", { class: "ev-date" }, h("b", null, App.fmtDate(ev.date)), h("span", null, when)),
        h("div", { class: "ev-main" },
          h("h3", null, ev.title),
          h("p", { class: "ev-meta" }, [ev.start && `${ev.start}${ev.end ? `〜${ev.end}` : ""}`, App.AREA_LABELS[ev.area], ev.place].filter(Boolean).join(" ・ ")),
          ev.fee ? h("p", { class: "ev-meta" }, `参加費 ${ev.fee}`) : null,
          h("p", { class: "ev-count" }, `出席予定 ${ev.yesCount}名`, ev.visitorCount ? ` ・ ビジター ${ev.visitorCount}名` : "", ev.attended ? h("span", { class: "ev-done" }, "出席済み") : null),
          ev.past || ev.attended ? null : h("div", { class: "ev-rsvp", role: "group", "aria-label": "出欠" },
            rsvpBtn("yes", "出席する"), rsvpBtn("no", "欠席する")),
          ev.past ? null : App.calendarButtons({ uid: ev.id, title: ev.title, date: ev.date, start: ev.start, end: ev.end, place: ev.place, body: ev.body }),
          ev.checkInOpen && !ev.attended && !(opt && opt.noCheckIn) ? checkInForm(ev.id, (e2) => { Object.assign(ev, e2); draw(); if (onUpdate) onUpdate(ev); }) : null,
          card.extra ? card.extra(ev) : null));
    }
    function rsvpBtn(answer, label) {
      const on = ev.myRsvp === answer;
      return h("button", { type: "button", class: `ev-rsvp-btn is-${answer}${on ? " is-on" : ""}`, "aria-pressed": on ? "true" : "false", onclick: async () => {
        const d = await App.api("rsvpEvent", { eventId: ev.id, answer: on ? "" : answer });
        if (!d) return;
        Object.assign(ev, d.event);
        draw();
        if (onUpdate) onUpdate(ev);
        App.toast(ev.myRsvp === "yes" ? "出席で登録しました" : ev.myRsvp === "no" ? "欠席で登録しました" : "出欠を取り消しました");
      } }, on ? `✓ ${label.replace("する", "")}` : label);
    }
    card.redraw = draw;
    draw();
    return card;
  }

  App.eventCard = eventCard;
  App.checkInForm = checkInForm;
})();
