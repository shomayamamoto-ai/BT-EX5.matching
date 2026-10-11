// ============================================
// app/home.js — ホーム(今月のあなた・紹介先を探す・すぐできること・やること・次の定例会を1画面で)
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

      // ---------- あいさつ(下に、今日のまとめを1行) ----------
      const summary = h("p", { class: "home-sum" });
      el.append(h("div", { class: "home-hello" },
        h("p", { class: "home-date" }, App.fmtDateLong(d.today)),
        h("h1", null, `${d.me.name}さん、${hello}`),
        summary));

      // ---------- 今月のあなた(順位・数字を1枚に) ----------
      const s = d.stats;
      const r = d.teamRank;
      el.append(h("section", { class: "home-me", "aria-label": "今月のあなた" },
        r ? h("a", { class: "home-rank", href: "#log/rank" },
          h("span", { class: "home-rank-no" }, h("small", null, "BT-EX5 で"), h("span", null, h("b", null, String(r.rank)), "位"), h("small", null, `/ ${r.size}名`)),
          h("span", { class: "home-rank-main" },
            h("b", null, "今月の貢献ポイント ", h("em", null, `${r.points}pt`)),
            h("small", null, r.rank > 1 && r.gap ? `あと ${r.gap}pt で ${r.rank - 1}位(${r.gapName}さん)。紹介1件で +1pt・成約で +3pt` : r.points ? "1位です!この調子で" : "紹介を1件記録すると +1pt")),
          h("span", { class: "home-go", "aria-hidden": "true" }, "›")) : null,
        h("a", { class: "home-me-stats", href: "#log/stats", "aria-label": "今月の数字をくわしく見る" },
          meStat("紹介した", s.given, "件"),
          meStat("紹介された", s.received, "件"),
          meStat("成約", s.won, "件"),
          meStat("1on1", s.oneOnOnes, "回")),
        h("div", { class: "home-me-foot" },
          h("span", null, "ありがとうマイル ", h("b", null, App.yen(s.milesIn)), h("small", null, ` ・ 累計 ${App.yen(s.milesInAll)}`)),
          h("button", { type: "button", class: "home-share", onclick: () => App.shareText([
            `【BT-EX5 ${Number(d.today.slice(5, 7))}月の活動】${d.me.name}`,
            `紹介した ${s.given}件 ・ 紹介された ${s.received}件 ・ 成約 ${s.won}件`,
            `1on1 ${s.oneOnOnes}回 ・ ありがとうマイル ${App.yen(s.milesIn)}`,
            "来月もよろしくお願いします!",
          ].join("\n"), "今月の活動") }, "シェア"))));

      // ---------- 紹介先を探す(聞いた相談を入れてそのまま検索) ----------
      const ask = h("input", { type: "search", name: "ask", maxlength: "600", enterkeyhint: "search", placeholder: "聞いた相談を入れて、紹介先を探す", "aria-label": "聞いた相談", autocomplete: "off" });
      el.append(h("form", { class: "home-ask", role: "search", onsubmit: (e) => {
        e.preventDefault();
        const q = ask.value.trim();
        location.href = q ? `../referral/#ask=${encodeURIComponent(q)}` : "../referral/";
      } },
        App.icon("M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"),
        ask,
        h("button", { type: "submit" }, "探す")));

      // ---------- すぐできること(アイコンを横1列に) ----------
      el.append(h("nav", { class: "home-actions", "aria-label": "すぐできること" },
        action("#log/ref?new", "紹介を記録", "紹介を記録", "M4 12h12l-4-4 1.4-1.4L20 13l-6.6 6.4L12 18l4-4H4z"),
        action("#log/miles?new", "ありがとう", "ありがとうを送る", "M12 21s-7.5-4.6-9.3-9.4C1.4 8 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.5 4.3 7.1C19.5 16.4 12 21 12 21Z"),
        action("#log/1on1?new", "1on1記録", "1on1を記録", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1zm16.5-5.9c2.9.4 5.5 2.4 5.5 4.9v1h-4.2c0-2.3-.5-4.3-1.3-5.9Z"),
        action("#invite", "ビジター招待", "ビジターを招待", "M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2Zm9 4c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z"),
        action("#board?new", "掲示板に投稿", "掲示板に書く", "M4 4h16v12H7l-3 3z")));

      // パソコンでは左(やること・予定)と右(チャレンジ・お知らせ)の2列。スマホは上から順に
      const main = h("div", { class: "home-col is-main" });
      const side = h("div", { class: "home-col is-side" });
      el.append(h("div", { class: "home-grid" }, main, side));

      // ---------- やること(声かけ・お知らせ・自分のやることを1つに) ----------
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
        todo.push(alertLink("#news", `運営からの連絡が ${d.badges.announcements} 件あります`, "未読のお知らせを確認してください", "is-info"));
      }
      (d.followUps || []).forEach((f) => {
        if (f.type === "givenStale") {
          todo.push(alertLink(App.profileHref(f.with, "home"),
            `${f.withName}さんへの紹介が ${f.days} 日そのままです`, `${f.prospect || "紹介した方"}の件、ひと声かけましょう(LINE などの連絡先を開く)`));
        } else if (f.type === "inboxStale") {
          todo.push(alertLink("#log/ref", `${f.withName}さんからの紹介に ${f.days} 日返事をしていません`, `${f.prospect || "紹介された方"}へ連絡したら「連絡済み」にしてください`, "is-warn"));
        } else if (f.type === "thanksMissing") {
          todo.push(alertLink("#log/ref", `成約おめでとうございます。${f.withName}さんへお礼を送りましょう`, `${f.prospect || "紹介された方"}の件。「成約 → お礼」で金額を記録できます`, "is-good"));
        } else if (f.type === "refMeetToday") {
          todo.push(alertLink(f.meetUrl || "#log/ref", `今日は ${f.prospect || "お客様"} との顔合わせです(${f.withName}さん)`, f.meetUrl ? `${f.time} から Google Meet(押すと参加できます)` : [f.time, f.place].filter(Boolean).join(" ・ ") || "記録 → 紹介 で予定を確認できます", "is-info"));
          if (f.meetUrl) { const a = todo[todo.length - 1]; a.target = "_blank"; a.rel = "noopener"; }
        } else if (f.type === "rsvpSoon") {
          todo.push(alertLink(`#events/detail/${encodeURIComponent(f.id)}`, `${App.fmtDate(f.date)}${f.start ? ` ${f.start}` : ""} の定例会の出欠がまだです`, `${f.title}。押して「出席する」「欠席する」を選んでください`, "is-warn"));
        } else if (f.type === "visitorFollow") {
          todo.push(alertLink("#invite", `${f.name}さん(ビジター)が定例会に参加しました`, "熱いうちに入会のご案内を。入会が決まったら招待履歴で「入会」にしてください", "is-good"));
        } else if (f.type === "oneConfirm") {
          todo.push(alertLink(`#log/1on1?confirm=${encodeURIComponent(f.id)}`, `${f.withName}さんとの 1on1 は実施しましたか?`, `${App.fmtDate(f.date)}${f.time ? ` ${f.time}` : ""} の予定。押して「実施した」を選ぶと回数に数えます`, "is-warn"));
        } else if (f.type === "oneToday") {
          todo.push(alertLink(f.meetUrl || "#log/1on1", `今日は ${f.withName}さんと 1on1 です`, f.meetUrl ? `${f.time} から Google Meet(押すと参加できます)` : [f.time, f.place].filter(Boolean).join(" ・ ") || "終わったら「実施した」を押してください", "is-info"));
          if (f.meetUrl) { const a = todo[todo.length - 1]; a.target = "_blank"; a.rel = "noopener"; }
        } else if (f.type === "oneMemo") {
          todo.push(alertLink("#log/1on1", `${f.withName}さんとの 1on1 を「実施」にしました`, "忘れないうちにメモを残しましょう", "is-good"));
        }
      });
      if (!d.me.hasPassword) {
        todo.push(alertLink("#me/password", "あなた専用のパスワードを決めてください", "共通パスコードは近く使えなくなります。1分で終わります", "is-warn"));
      }
      const tasks = d.tasks || [];
      const taskList = h("ul", { class: "task-list" }, tasks.map((t) => App.taskRow(t, { showEvent: true, onChange: (x) => {
        if (x.myDone) setTimeout(() => { const li = taskList.querySelector(".task-row.is-done"); if (li) li.remove(); }, 600);
      } })));
      const count = todo.length + tasks.length;
      main.append(h("section", { class: "app-section home-sec" },
        h("div", { class: "home-sec-head" },
          h("h2", { class: "app-h2" }, `あなたのやること(${count})`),
          h("button", { type: "button", class: "home-sec-link", onclick: () => App.taskForm({}, () => App.route()) }, "＋ 追加")),
        todo.length ? h("div", { class: "home-todo" }, todo) : null,
        tasks.length ? taskList : null,
        count ? null : h("p", { class: "home-allclear" }, "いまやることはありません。定例会で決まったことや自分の予定は「＋ 追加」から入れておけます。")));

      // ---------- 次の定例会 ----------
      const next = d.events[0];
      const days = next ? App.daysUntil(next.date, d.today) : -1;
      App.fill(summary,
        count ? h("span", { class: "is-todo" }, `やること ${count}件`) : h("span", { class: "is-clear" }, "やることはありません"),
        next && days >= 0 ? h("span", null, days === 0 ? "今日は定例会です" : `次の定例会まであと${days}日`) : null,
        d.inboxNew.length ? h("span", { class: "is-todo" }, `新しい紹介 ${d.inboxNew.length}件`) : null);
      main.append(h("section", { class: "app-section home-sec" },
        h("div", { class: "home-sec-head" },
          h("h2", { class: "app-h2" }, "次の定例会"),
          h("a", { class: "home-sec-link", href: "#events" }, "予定をすべて見る")),
        next ? eventCard(next, d.today, (ev) => { Object.assign(next, ev); }, { noCheckIn: d.checkInOpen }) : App.empty("予定されている定例会はまだありません。")));

      // ---------- あなた宛ての新しい紹介・1on1 の予定(あるときだけ) ----------
      if (d.inboxNew.length) {
        main.append(App.section("あなた宛ての新しい紹介",
          h("ul", { class: "app-list" }, d.inboxNew.map((x) => h("li", null,
            h("a", { class: "app-row", href: "#log/ref" },
              App.avatar(x.fromName),
              h("span", { class: "app-row-main" }, h("b", null, `${x.fromName}さんから`), h("small", null, `${x.prospect || "お相手"} ${x.memo ? `— ${x.memo}` : ""}`)),
              App.chip("未対応", "warn")))))));
      }
      if (d.nextOneOnOnes.length) {
        main.append(App.section("1on1 の予定",
          h("ul", { class: "app-list" }, d.nextOneOnOnes.map((o) => h("li", null,
            h("a", { class: "app-row", href: "#log/1on1" },
              App.avatar(o.withName),
              h("span", { class: "app-row-main" }, h("b", null, `${o.withName}さん`), h("small", null, `${App.fmtDate(o.date)} ${o.time} ${o.place}`))))))));
      }

      // ---------- 今週の紹介チャレンジ(最近紹介を受けていない人から、週ごとに1人) ----------
      if (d.spotlight) {
        const sp = d.spotlight;
        const wants = h("p", { class: "home-spot-wants" }, sp.wants);
        const long = (sp.wants || "").length > 70;
        if (long) wants.classList.add("is-clamped");
        side.append(h("section", { class: "home-spot" },
          h("p", { class: "home-spot-label" }, "今週の紹介チャレンジ"),
          h("a", { class: "home-spot-head", href: App.profileHref(sp.id, "home") }, App.avatar(sp.name),
            h("span", null, h("b", null, `${sp.name}さん`), h("small", null, sp.company))),
          h("p", { class: "home-spot-q" }, "こんな人を紹介してほしい"),
          wants,
          long ? h("button", { type: "button", class: "home-spot-more", onclick: (e) => {
            const open = wants.classList.toggle("is-clamped");
            e.currentTarget.textContent = open ? "続きを読む" : "閉じる";
          } }, "続きを読む") : null,
          sp.triggers.length ? h("div", { class: "home-spot-trig", "aria-label": "こんな話が出たら" }, h("small", null, "こんな話が出たら"), sp.triggers.slice(0, 4).map((t) => h("span", null, t))) : null,
          sp.offer ? h("p", { class: "home-spot-offer" }, `🎁 紹介特典:${sp.offer}`) : null,
          h("div", { class: "app-btn-row" },
            h("a", { class: "app-btn primary small", href: `#log/ref?new&to=${encodeURIComponent(sp.id)}` }, "紹介を記録する"),
            h("a", { class: "app-btn ghost small", href: App.profileHref(sp.id, "home") }, "プロフィールを見る"))));
      }

      // ---------- 運営連絡(あるときだけ。新しい3件) ----------
      if (d.announcements.length) {
        side.append(h("section", { class: "app-section home-sec" },
          h("div", { class: "home-sec-head" },
            h("h2", { class: "app-h2" }, "運営連絡"),
            h("a", { class: "home-sec-link", href: "#news" }, "すべて見る")),
          h("ul", { class: "app-list" }, d.announcements.slice(0, 3).map((a) => h("li", null,
            h("a", { class: `app-row${a.read ? "" : " is-unread"}`, href: `#news?open=${encodeURIComponent(a.id)}` },
              h("span", { class: "app-row-main" }, h("b", null, a.pinned ? "📌 " : "", a.title), h("small", null, `${App.fmtTime(a.at)} ・ ${a.cat}`)),
              a.read ? null : App.chip("未読", "warn")))))));
      }

      // ---------- おすすめの設定(プロフィール・通知) ----------
      const tips = h("div", { class: "home-tips" });
      side.append(tips);
      if (d.missing.length) {
        tips.append(h("a", { class: "home-nudge", href: "../profile/" },
          h("span", { class: "home-nudge-icon", "aria-hidden": "true" }, "✍️"),
          h("span", { class: "home-nudge-main" },
            h("b", null, "紹介されやすくするために"),
            h("span", null, `まだ入っていない項目:${d.missing.slice(0, 4).join("・")}${d.missing.length > 4 ? " ほか" : ""}`)),
          h("span", { class: "home-go", "aria-hidden": "true" }, "›")));
      }
      // 通知(共有サーバーで、まだこの端末でオンにしていないとき)
      if (typeof BtexPush !== "undefined" && AuthApi.isShared()) {
        BtexPush.status().then((st) => {
          if (st.on || st.permission === "denied" || (!st.supported && !st.needsInstall)) return;
          tips.append(h("a", { class: "home-nudge", href: "#me/notify" },
            h("span", { class: "home-nudge-icon", "aria-hidden": "true" }, "🔔"),
            h("span", { class: "home-nudge-main" },
              h("b", null, "スマホに通知を受け取る"),
              h("span", null, st.needsInstall ? "iPhone はホーム画面に追加すると、紹介・掲示板・運営連絡の更新が通知で届きます" : "紹介・掲示板・運営連絡が届いたら、すぐにわかります")),
            h("span", { class: "home-go", "aria-hidden": "true" }, "›")));
        }).catch(() => {});
      }
    },
  };

  function alertLink(href, title, sub, cls) {
    return h("a", { class: `home-alert ${cls || ""}`, href }, h("b", null, title), h("span", null, sub));
  }
  function action(href, label, title, icon) {
    return h("a", { class: "home-action", href, title, "aria-label": title }, h("span", { class: "home-action-icon" }, App.icon(icon)), h("span", { class: "home-action-label" }, label));
  }
  function meStat(label, value, unit) {
    return h("span", { class: "home-me-stat" }, h("b", null, String(value), h("small", null, unit)), h("span", null, label));
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
        // 日付は「月」「日(大きく)」「曜日」「あと◯日」に分けて、狭い画面でもはみ出さないように
        (() => {
          const [, mo, da] = ev.date.split("-").map(Number);
          const wd = App.fmtDate(ev.date).replace(/^.*\((.)\).*$/, "$1");
          return h("div", { class: "ev-date", "aria-label": `${App.fmtDate(ev.date)} ${when}` },
            h("small", { class: "ev-date-m" }, `${mo}月`),
            h("b", null, String(da)),
            h("small", { class: "ev-date-w" }, wd),
            h("span", null, when));
        })(),
        h("div", { class: "ev-main" },
          h("h3", null, h("a", { href: `#events/detail/${ev.id}` }, ev.title)),
          h("p", { class: "ev-meta" }, [ev.start && `${ev.start}${ev.end ? `〜${ev.end}` : ""}`, ev.online ? "オンライン(Google Meet)" : App.AREA_LABELS[ev.area], ev.online ? "" : ev.place].filter(Boolean).join(" ・ ")),
          ev.fee ? h("p", { class: "ev-meta" }, `参加費 ${ev.fee}`) : null,
          ev.deadline && !ev.past ? h("p", { class: `ev-deadline${ev.deadlinePassed ? " is-closed" : ""}` }, ev.deadlinePassed ? "申込の受付は終了しました" : `申込締切 ${App.fmtStamp(ev.deadline)}`) : null,
          h("p", { class: "ev-count" }, `出席予定 ${ev.yesCount}名`, ev.visitorCount ? ` ・ ビジター ${ev.visitorCount}名` : "", ev.attended ? h("span", { class: "ev-done" }, ev.late ? "遅刻早退" : "出席済み") : null),
          ev.past || ev.attended || ev.deadlinePassed ? null : h("div", { class: "ev-rsvp", role: "group", "aria-label": "出欠" },
            rsvpBtn("yes", "出席する"), rsvpBtn("no", "欠席する")),
          !ev.past && !ev.myRsvp && !ev.deadlinePassed ? h("p", { class: "ev-must" }, "出席・欠席のどちらかを必ずご登録ください") : null,
          ev.meetUrl && !ev.past ? h("a", { class: "app-btn small ev-meet", href: ev.meetUrl, target: "_blank", rel: "noopener" }, "Google Meet に参加") : null,
          h("div", { class: "ev-links" },
            h("a", { class: "app-more ev-more", href: `#events/detail/${ev.id}` }, "詳細・出欠の一覧 →"),
            ev.past ? null : App.calendarButtons({ uid: ev.id, title: ev.title, date: ev.date, start: ev.start, end: ev.end, place: ev.online ? ev.meetUrl || "オンライン(Google Meet)" : ev.place, body: [ev.meetUrl ? `参加リンク:${ev.meetUrl}` : "", ev.agenda, ev.body].filter(Boolean).join("\n\n") })),
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
