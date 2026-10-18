// ============================================
// app/home.js — ホーム(今月のあなた・紹介先を探す・すぐできること・やること・次の定例会を1画面で)
// ============================================

(function () {
  "use strict";
  const { h } = App;

  // ホーム・まとめの画面はなくした。以前のリンク(#home・#log/home)は「予定」へ、#home/timer はプレゼンのタイマーへ
  App.views.home = {
    title: "予定",
    tab: "events",
    async render(el, parts) {
      history.replaceState(null, "", parts && parts[0] === "timer" ? "#present/timer" : "#events");
      await App.route();
    },
  };
  // 以前のホームの中身を、それぞれの画面に出す。show: 出すまとまり
  //   mine(今月のあなた・BT-EX5 シグナル)/ pulse(BT-EX5 全体の今月)… 記録 → 数字
  //   todo(はじめての方へ・あなたのやること・おすすめの設定)… 予定
  //   spot(今週の紹介チャレンジ)… 記録 → 紹介
  App.renderHome = async function (el, parts, show) {
    show = show || new Set();
    {
      const d = await App.api("getHome");
      if (!d) return;
      App.setBadges(d.badges);
      const hour = new Date().getHours();
      const hello = hour < 11 ? "おはようございます" : hour < 18 ? "こんにちは" : "おつかれさまです";

      // ---------- あいさつ(下に、今日のまとめを1行) ----------
      const summary = h("p", { class: "home-sum" });
      void hello;

      // ---------- 今月のあなた(順位・数字を1枚に) ----------
      const s = d.stats;
      const r = d.teamRank;
      if (show.has("mine")) el.append(h("section", { class: "home-me", "aria-label": "今月のあなた", "data-home": "me" },
        r ? h("a", { class: "home-rank", href: "#log/rank" },
          // 0pt のうちは順位を出さない。同点は「同率」と出す
          r.points ? h("span", { class: "home-rank-no" }, h("small", null, r.tied > 1 ? "BT-EX5 で同率" : "BT-EX5 で"), h("span", null, h("b", null, String(r.rank)), "位"), h("small", null, r.tied > 1 ? `${r.tied}名 / ${r.size}名` : `/ ${r.size}名`))
            : h("span", { class: "home-rank-no is-none" }, h("small", null, "今月の順位"), h("span", null, h("b", null, "—")), h("small", null, "これから")),
          h("span", { class: "home-rank-main" },
            h("b", null, "今月の貢献ポイント ", h("em", null, `${r.points}pt`)),
            h("small", null, !r.points ? "紹介を1件記録すると +1pt。今月の順位がつきます"
              : r.rank > 1 && r.gap ? `あと ${r.gap}pt で ${r.rank - 1}位(${r.gapName}さん)。紹介1件で +1pt・成約で +3pt`
              : r.tied > 1 ? `${r.tied}名が同じ点です。紹介1件で +1pt、ひとつ抜け出しましょう` : "1位です!この調子で")),
          h("span", { class: "home-go", "aria-hidden": "true" }, "›")) : null,
        h("a", { class: "home-me-stats", href: "#log/stats", "aria-label": "今月の数字をくわしく見る" },
          meStat("紹介した", s.given, "件"),
          meStat("紹介された", s.received, "件"),
          meStat("成約", s.won, "件"),
          meStat("1on1", s.oneOnOnes, "回")),
        goalsBlock(d.me.goals, s),
        h("div", { class: "home-me-foot" },
          h("span", null, "ありがとうマイル ", h("b", null, App.yen(s.milesIn)), h("small", null, ` ・ 累計 ${App.yen(s.milesInAll)}`)),
          h("button", { type: "button", class: "home-share", onclick: () => App.shareText([
            `【BT-EX5 ${Number(d.today.slice(5, 7))}月の活動】${d.me.name}`,
            `紹介した ${s.given}件 ・ 紹介された ${s.received}件 ・ 成約 ${s.won}件`,
            `1on1 ${s.oneOnOnes}回 ・ ありがとうマイル ${App.yen(s.milesIn)}`,
            "来月もよろしくお願いします!",
          ].join("\n"), "今月の活動") }, "シェア"))));

      // ---------- BT-EX5 シグナル(直近6か月の活動の信号。本人だけに表示) ----------
      if (show.has("mine") && d.signal) el.append(signalCard(d.signal));

      // パソコンでは左(やること・予定)と右(チャレンジ・お知らせ)の2列。スマホは上から順に
      const main = el, side = el;

      // ---------- はじめての方へ(終わるか閉じるまで) ----------
      if (show.has("todo") && App.welcomeCard) { const wc = App.welcomeCard(d); if (wc) main.append(wc); }

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
          // 押すと相手の連絡先。終わっている・声をかけた ときは、この場で消せる
          const box = h("div", { class: "home-alert-wrap" });
          const mute = async (mode) => {
            const r = await App.api("muteReferralNudge", { id: f.id, mode });
            if (!r) return;
            box.remove();
            App.toast(mode === "done" ? "表示を消しました" : "7日後にまた知らせます");
          };
          box.append(
            alertLink(App.profileHref(f.with, "events"),
              `${f.withName}さんへの紹介が ${f.days} 日そのままです`, `${f.prospect || "紹介した方"}の件、ひと声かけましょう(LINE などの連絡先を開く)`),
            h("div", { class: "home-alert-acts" },
              h("button", { type: "button", class: "app-btn ghost small", onclick: () => mute("later") }, "声をかけた(7日後にまた)"),
              h("button", { type: "button", class: "app-btn ghost small", onclick: () => mute("done") }, "もう終わった(消す)")));
          todo.push(box);
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
      if (show.has("todo")) main.append(h("section", { class: "app-section home-sec", "data-home": "todo" },
        h("div", { class: "home-sec-head" },
          h("h2", { class: "app-h2" }, `あなたのやること(${count})`),
          h("button", { type: "button", class: "home-sec-link", onclick: () => App.taskForm({}, () => App.route()) }, "＋ 追加")),
        todo.length ? h("div", { class: "home-todo" }, todo) : null,
        tasks.length ? taskList : null,
        count ? null : h("p", { class: "home-allclear" }, "いまやることはありません。定例会で決まったことや自分の予定は「＋ 追加」から入れておけます。")));

      // ---------- 今日・明日の予定(1on1・顔合わせ・やること。定例会は下のカードで) ----------
      const sched = h("section", { class: "app-section home-sec home-sched", hidden: true, "data-home": "sched" });
      if (show.has("sched")) main.append(sched);
      if (show.has("sched") && App.collectSchedule) {
        const tmr = (() => { const x = new Date(`${d.today}T12:00:00`); x.setDate(x.getDate() + 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
        App.collectSchedule([]).then((items) => {
          const soon = items.filter((x) => x.kind !== "event" && (x.date === d.today || x.date === tmr));
          if (!soon.length) return;
          const group = (date, label) => {
            const list = soon.filter((x) => x.date === date);
            if (!list.length) return null;
            return h("div", { class: "home-sched-day" },
              h("p", { class: "home-sched-label" }, label, h("small", null, App.fmtDate(date))),
              h("ul", { class: "cal-day-list" }, list.map((x) => h("li", { class: App.SCHEDULE_KINDS[x.kind].cls },
                h("a", { href: x.href },
                  h("span", { class: "cal-day-time" }, x.time || (x.kind === "task" ? "期限" : "終日")),
                  h("span", { class: "cal-day-main" }, h("small", null, App.SCHEDULE_KINDS[x.kind].label), h("b", null, x.title), x.sub ? h("span", null, x.sub) : null)),
                x.meetUrl && date === d.today ? h("a", { class: "cal-day-meet", href: x.meetUrl, target: "_blank", rel: "noopener" }, "Meet に参加") : null))));
          };
          App.fill(sched,
            h("div", { class: "home-sec-head" },
              h("h2", { class: "app-h2" }, "今日・明日の予定"),
              h("a", { class: "home-sec-link", href: "#events" }, "カレンダーを見る")),
            group(d.today, "今日"), group(tmr, "明日"));
          sched.hidden = false;
        }).catch(() => {});
      }

      // ---------- 次の定例会 ----------
      const next = d.events[0];
      const days = next ? App.daysUntil(next.date, d.today) : -1;
      App.fill(summary,
        count ? h("span", { class: "is-todo" }, `やること ${count}件`) : h("span", { class: "is-clear" }, "やることはありません"),
        next && days >= 0 ? h("span", null, days === 0 ? "今日は定例会です" : `次の定例会まであと${days}日`) : null,
        d.inboxNew.length ? h("span", { class: "is-todo" }, `新しい紹介 ${d.inboxNew.length}件`) : null);
      if (show.has("event")) main.append(h("section", { class: "app-section home-sec", "data-home": "event" },
        h("div", { class: "home-sec-head" },
          h("h2", { class: "app-h2" }, "次の定例会"),
          h("a", { class: "home-sec-link", href: "#events" }, "予定をすべて見る")),
        next ? eventCard(next, d.today, (ev) => { Object.assign(next, ev); }, { noCheckIn: d.checkInOpen }) : App.empty("予定されている定例会はまだありません。")));

      // ---------- あなた宛ての新しい紹介・1on1 の予定(あるときだけ) ----------
      if (show.has("inbox") && d.inboxNew.length) {
        main.append(tag("inbox", App.section("あなた宛ての新しい紹介",
          h("ul", { class: "app-list" }, d.inboxNew.map((x) => h("li", null,
            h("a", { class: "app-row", href: "#log/ref" },
              App.avatar(x.fromName),
              h("span", { class: "app-row-main" }, h("b", null, `${x.fromName}さんから`), h("small", null, `${x.prospect || "お相手"} ${x.memo ? `— ${x.memo}` : ""}`)),
              App.chip("未対応", "warn"))))))));
      }
      if (show.has("ones") && d.nextOneOnOnes.length) {
        main.append(tag("ones", App.section("1on1 の予定",
          h("ul", { class: "app-list" }, d.nextOneOnOnes.map((o) => h("li", null,
            h("a", { class: "app-row", href: "#log/1on1" },
              App.avatar(o.withName),
              h("span", { class: "app-row-main" }, h("b", null, `${o.withName}さん`), h("small", null, `${App.fmtDate(o.date)} ${o.time} ${o.place}`)))))))));
      }

      // ---------- BT-EX5 全体の今月(みんなの動き) ----------
      // 全体の今月は、まだ何も動いていない(すべて0)ときは出さない
      if (show.has("pulse") && d.community && (d.community.given || d.community.won || d.community.ones || d.community.posts || d.community.miles)) {
        const cm = d.community;
        side.append(h("section", { class: "home-pulse", "aria-label": "BT-EX5 全体の今月", "data-home": "pulse" },
          h("p", { class: "home-pulse-head" }, h("b", null, "BT-EX5 全体の今月"), h("small", null, `メンバー ${cm.members}名`)),
          h("div", { class: "home-pulse-grid" },
            pulse("紹介", cm.given, "件"), pulse("成約", cm.won, "件"), pulse("1on1", cm.ones, "回"), pulse("掲示板", cm.posts, "件")),
          h("p", { class: "home-pulse-miles" }, "ありがとうマイル ", h("b", null, App.yen(cm.miles)), h("small", null, " がメンバーの間で生まれました"))));
      }

      // ---------- 今週の紹介チャレンジ(最近紹介を受けていない人から、週ごとに1人) ----------
      if (show.has("spot") && d.spotlight) {
        const sp = d.spotlight;
        const wants = h("p", { class: "home-spot-wants" }, sp.wants);
        const long = (sp.wants || "").length > 70;
        if (long) wants.classList.add("is-clamped");
        side.append(h("section", { class: "home-spot", "data-home": "spot" },
          h("p", { class: "home-spot-label" }, "今週の紹介チャレンジ"),
          h("a", { class: "home-spot-head", href: App.profileHref(sp.id, "log/ref") }, App.avatar(sp.name),
            h("span", null, h("b", null, `${sp.name}さん`), h("small", null, sp.company))),
          h("p", { class: "home-spot-q" }, "こんな人を紹介してほしい"),
          wants,
          long ? h("button", { type: "button", class: "home-spot-more", onclick: (e) => {
            const open = wants.classList.toggle("is-clamped");
            e.currentTarget.textContent = open ? "続きを読む" : "閉じる";
          } }, "続きを読む") : null,
          sp.triggers.length ? h("div", { class: "home-spot-trig", "aria-label": "こんな話が出たら" }, h("small", null, "こんな話が出たら"), sp.triggers.slice(0, 4).map((t) => h("span", null, t))) : null,
          sp.offer ? h("p", { class: "home-spot-offer" }, `紹介特典:${sp.offer}`) : null,
          h("div", { class: "app-btn-row" },
            h("a", { class: "app-btn primary small", href: `#log/ref?new&to=${encodeURIComponent(sp.id)}` }, "紹介を記録する"),
            h("a", { class: "app-btn ghost small", href: App.profileHref(sp.id, "log/ref") }, "プロフィールを見る"))));
      }

      // ---------- 運営連絡(あるときだけ。新しい3件) ----------
      if (show.has("news") && d.announcements.length) {
        side.append(h("section", { class: "app-section home-sec", "data-home": "news" },
          h("div", { class: "home-sec-head" },
            h("h2", { class: "app-h2" }, "運営連絡"),
            h("a", { class: "home-sec-link", href: "#news" }, "すべて見る")),
          h("ul", { class: "app-list" }, d.announcements.slice(0, 3).map((a) => h("li", null,
            h("a", { class: `app-row${a.read ? "" : " is-unread"}`, href: `#news?open=${encodeURIComponent(a.id)}` },
              h("span", { class: "app-row-main" }, h("b", null, a.pinned ? "【固定】" : "", a.title), h("small", null, `${App.fmtTime(a.at)} ・ ${a.cat}`)),
              a.read ? null : App.chip("未読", "warn")))))));
      }

      // ---------- おすすめの設定(プロフィール・通知) ----------
      // ---------- 1on1 のおすすめ(まだ 1on1 をしていない人から、週ごとに3人) ----------
      const oneSug = h("section", { class: "app-section home-sec home-onesug", hidden: true, "data-home": "onesug" });
      if (show.has("onesug")) { side.append(oneSug); oneSuggest(oneSug, d.today); }

      const tips = h("div", { class: "home-tips", "data-home": "tips" });
      if (show.has("todo")) side.append(tips);
      if (d.missing.length) {
        // サーバーの missing は PROFILE_ITEMS の7項目 + できること(ジャンル)。早見表・プロフィールと同じ数え方
        const total = typeof PROFILE_SCORE_ITEMS !== "undefined" ? PROFILE_SCORE_ITEMS.length : d.missing.length + 1;
        const pct = Math.max(0, Math.round(((total - d.missing.length) / total) * 100));
        // 紹介に効く3項目(活動範囲・求める紹介・ジャンル)が空いていれば、その場で「かんたんプロフィール」を開く
        const quick = d.missing.some((x) => App.QUICK_PROFILE_LABELS && App.QUICK_PROFILE_LABELS.includes(x));
        tips.append(h("a", { class: "home-nudge", href: quick ? "#me/quick" : "../profile/", onclick: quick ? (e) => { e.preventDefault(); App.quickProfileSheet(); } : null },
          h("span", { class: "home-nudge-icon", "aria-hidden": "true" }, App.glyph("post")),
          h("span", { class: "home-nudge-main" },
            h("b", null, `紹介されやすくするために(プロフィール ${pct}%)`),
            h("span", { class: "home-goal-bar is-profile", "aria-hidden": "true" }, h("i", { style: `width:${pct}%` })),
            h("span", null, quick ? "3つの質問に答えるだけ(約1分)。紹介診断で候補に出やすくなります" : `まだ入っていない項目:${d.missing.slice(0, 4).join("・")}${d.missing.length > 4 ? " ほか" : ""}`)),
          h("span", { class: "home-go", "aria-hidden": "true" }, "›")));
      }
      // 通知(共有サーバーで、まだこの端末でオンにしていないとき)
      if (typeof BtexPush !== "undefined" && AuthApi.isShared()) {
        BtexPush.status().then((st) => {
          if (st.on || st.permission === "denied" || (!st.supported && !st.needsInstall)) return;
          tips.append(h("a", { class: "home-nudge", href: "#me/notify" },
            h("span", { class: "home-nudge-icon", "aria-hidden": "true" }, App.glyph("ann")),
            h("span", { class: "home-nudge-main" },
              h("b", null, "スマホに通知を受け取る"),
              h("span", null, st.needsInstall ? "iPhone はホーム画面に追加すると、紹介・掲示板・運営連絡の更新が通知で届きます" : "紹介・掲示板・運営連絡が届いたら、すぐにわかります")),
            h("span", { class: "home-go", "aria-hidden": "true" }, "›")));
        }).catch(() => {});
      }

      // ---------- まとめの表示(出すもの・順番。この端末に覚える) ----------
      void applyLayout; void layoutSheet;
    }
  };

  // ---------- まとめの表示を選ぶ ----------
  // 同じ列(上・左・右)の中で並べかえる。消したものは「まとめの表示を変える」からいつでも戻せる
  const HOME_PARTS = [
    ["me", "今月のあなた(順位・数字・目標)", "top"],
    ["signal", "BT-EX5 シグナル(直近6か月の信号)", "top"],
    ["ask", "紹介先を探す", "top"],
    ["actions", "すぐできること", "top"],
    ["welcome", "はじめての方へ(7つのステップ)", "main"],
    ["todo", "あなたのやること", "main"],
    ["sched", "今日・明日の予定", "main"],
    ["timer", "タイマー", "main"],
    ["event", "次の定例会", "main"],
    ["inbox", "あなた宛ての新しい紹介", "main"],
    ["ones", "1on1 の予定", "main"],
    ["pulse", "BT-EX5 全体の今月", "side"],
    ["spot", "今週の紹介チャレンジ", "side"],
    ["news", "アップデート", "side"],
    ["onesug", "1on1 のおすすめ", "side"],
    ["tips", "おすすめの設定(プロフィール・通知)", "side"],
  ];
  const COLS = { top: "上", main: "左の列(スマホは上から)", side: "右の列(スマホは下)" };
  function layoutKey() { return `btex5-home-layout-${(App.session && App.session.memberId) || "guest"}`; }
  function loadLayout() {
    try {
      const v = JSON.parse(localStorage.getItem(layoutKey()) || "null");
      if (v && Array.isArray(v.order) && Array.isArray(v.hide)) return v;
    } catch { /* noop */ }
    return { order: HOME_PARTS.map(([k]) => k), hide: [] };
  }
  function saveLayout(v) { try { localStorage.setItem(layoutKey(), JSON.stringify(v)); } catch { /* noop */ } }
  function applyLayout(root) {
    const lay = loadLayout();
    const rank = (k) => { const i = lay.order.indexOf(k); return i === -1 ? HOME_PARTS.findIndex(([x]) => x === k) + 100 : i; };
    const parts = [...root.querySelectorAll("[data-home]")];
    parts.forEach((p) => { if (lay.hide.includes(p.dataset.home)) p.classList.add("is-home-off"); });
    // 親ごとに、並べる順へ入れなおす(ほかの要素の位置は変えない)
    const parents = [...new Set(parts.map((p) => p.parentNode))];
    parents.forEach((parent) => {
      const mine = parts.filter((p) => p.parentNode === parent);
      const slots = mine.map((p) => { const mark = document.createComment("home"); parent.insertBefore(mark, p); return mark; });
      mine.slice().sort((a, b) => rank(a.dataset.home) - rank(b.dataset.home)).forEach((p, i) => slots[i].replaceWith(p));
    });
  }
  function layoutSheet() {
    App.openSheet("まとめの表示を変える", (body, close) => {
      const lay = loadLayout();
      let order = HOME_PARTS.map(([k]) => k).sort((a, b) => {
        const ia = lay.order.indexOf(a), ib = lay.order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      const hide = new Set(lay.hide);
      const list = h("div", { class: "home-layout" });
      function draw() {
        App.fill(list, Object.keys(COLS).map((col) => {
          const keys = order.filter((k) => HOME_PARTS.find(([x]) => x === k)[2] === col);
          return h("div", { class: "home-layout-col" }, h("p", { class: "home-layout-head" }, COLS[col]),
            keys.map((k, i) => {
              const label = HOME_PARTS.find(([x]) => x === k)[1];
              const box = h("input", { type: "checkbox", onchange: () => { if (box.checked) hide.delete(k); else hide.add(k); } });
              box.checked = !hide.has(k);
              const move = (dir) => {
                const other = keys[i + dir]; if (!other) return;
                const a = order.indexOf(k), b = order.indexOf(other);
                [order[a], order[b]] = [order[b], order[a]]; draw();
              };
              return h("div", { class: "home-layout-row" },
                h("label", null, box, h("span", null, label)),
                h("span", { class: "round-move" },
                  h("button", { type: "button", "aria-label": `${label}を上へ`, disabled: i === 0, onclick: () => move(-1) }, "↑"),
                  h("button", { type: "button", "aria-label": `${label}を下へ`, disabled: i === keys.length - 1, onclick: () => move(1) }, "↓")));
            }));
        }));
      }
      draw();
      body.append(
        h("p", { class: "app-lead" }, "まとめに出すものと順番を選べます。チェックを外したものは出しません(あとから戻せます)。この端末に覚えます。"),
        list,
        h("div", { class: "app-btn-row" },
          h("button", { type: "button", class: "app-btn primary", onclick: () => { saveLayout({ order, hide: [...hide] }); close(); App.toast("まとめの表示を変えました"); App.route(); } }, "この表示にする"),
          h("button", { type: "button", class: "app-btn ghost", onclick: () => { saveLayout({ order: HOME_PARTS.map(([k]) => k), hide: [] }); close(); App.toast("はじめの表示に戻しました"); App.route(); } }, "はじめに戻す")));
    }, { noFocus: true });
  }
  function tag(key, node) { node.setAttribute("data-home", key); return node; }

  // ---------- BT-EX5 シグナル ----------
  const SIGNAL = {
    green: ["緑", "とてもよい活動です"],
    yellow: ["黄", "あと少しで緑です"],
    red: ["赤", "まずは1つ、できることから"],
    gray: ["これから", "はじめの一歩を"],
  };
  function signalCard(sg) {
    const [label, lead] = SIGNAL[sg.color] || SIGNAL.gray;
    const goal = sg.total >= 70 ? null : sg.total >= 50 ? 70 : sg.total >= 30 ? 50 : 30;
    const fmtV = (it) => (it.unit === "円" ? App.yen(it.value) : it.unit === "%" ? `${it.value}%` : `${it.value}${it.unit}`);
    const tipText = (it) => (it.next.more ? `あと${it.next.more}${it.count}で` : it.unit === "%" ? `出席率が ${it.next.at}% になると` : `${App.yen(it.next.at)}に届くと`);
    // 次の段に上がるといちばん点が増えるものから、おすすめを2つ
    const tips = sg.items.filter((it) => it.next).sort((a, b) => b.next.pt - a.next.pt).slice(0, 2);
    const how = h("div", { class: "home-signal-how", hidden: true },
      h("p", null, "直近6か月のあなたの活動を、100点で見たものです(BNI の「信号」と同じ考え方)。点数はあなたにだけ表示され、ほかのメンバーには見えません。"),
      h("ul", null,
        h("li", null, "定例会の出席(最大20点):出席率 90%で20点・75%で15点・50%で10点"),
        h("li", null, "1on1(最大20点):月2回で20点・月1回で15点・2か月に1回で10点"),
        h("li", null, "出した紹介(最大25点):月2件で25点・月1件で20点・2か月に1件で12点"),
        h("li", null, "紹介からの売上(あなたの紹介で決まった仕事の金額=受け取ったありがとうマイル。最大15点):100万円で15点・30万円で10点・1円から5点"),
        h("li", null, "ビジター招待(最大20点):3人で20点・2人で15点・1人で10点")),
      h("p", null, "70点から緑・50点から黄・30点から赤です。"));
    return h("section", { class: `home-signal is-${sg.color}`, "data-home": "signal", "aria-label": "BT-EX5 シグナル" },
      h("div", { class: "home-signal-head" },
        h("span", { class: "home-signal-light", "aria-hidden": "true" }),
        h("span", { class: "home-signal-title" }, h("b", null, "BT-EX5 シグナル ", h("em", null, label)), h("small", null, `直近6か月 ・ あなただけに表示 ・ ${lead}`)),
        h("span", { class: "home-signal-score" }, h("b", null, String(sg.total)), h("small", null, "/100点"))),
      h("div", { class: "home-signal-bars" }, sg.items.map((it) => h("div", { class: "home-signal-row" },
        h("span", { class: "home-signal-label" }, it.label),
        h("span", { class: "home-goal-bar", "aria-hidden": "true" }, h("i", { style: `width:${Math.round((it.points / it.max) * 100)}%` })),
        h("span", { class: "home-signal-val" }, fmtV(it), h("small", null, ` ${it.points}/${it.max}`))))),
      tips.length && goal ? h("div", { class: "home-signal-tips" },
        h("p", null, `あと ${goal - sg.total}点で次の段階(${label === "これから" ? "赤" : label === "赤" ? "黄" : "緑"})へ。おすすめ:`),
        h("ul", null, tips.map((it) => h("li", null, `${it.tip}(${tipText(it)} +${it.next.pt}点)`)))) : null,
      h("button", { type: "button", class: "home-signal-more", onclick: (e) => { how.hidden = !how.hidden; e.currentTarget.textContent = how.hidden ? "点数のつけ方" : "閉じる"; } }, "点数のつけ方"),
      how);
  }

  // ---------- 1on1 のおすすめ ----------
  // まだ 1on1 をしていない(予定もない)メンバーから、週ごとに決まった3人。その週のあいだは同じ人が出る
  async function oneSuggest(box, today) {
    const d = await App.api("list1on1", {}, { quiet: true });
    if (!d || !box.isConnected && !box.parentNode) return;
    const met = new Set(d.items.filter((o) => o.status !== "canceled" && o.status !== "cancelled").map((o) => o.with));
    const me = App.session && App.session.memberId;
    const cand = (App.members || []).filter((m) => m.id !== me && !met.has(m.id));
    if (!cand.length) return;
    const week = Math.floor(new Date(`${today}T12:00:00`).getTime() / (7 * 86400000));
    const score = (id) => { let x = week * 2654435761; for (const ch of String(id)) x = Math.imul(x ^ ch.charCodeAt(0), 2246822519) >>> 0; return x; };
    const pick = cand.slice().sort((a, b) => score(a.id) - score(b.id)).slice(0, 3);
    App.fill(box,
      h("div", { class: "home-sec-head" },
        h("h2", { class: "app-h2" }, "1on1 のおすすめ"),
        h("a", { class: "home-sec-link", href: "#log/1on1" }, "1on1 を見る")),
      h("p", { class: "home-onesug-lead" }, `まだ 1on1 をしていないメンバーが ${cand.length}名います。今週はこの方々はいかがですか?`),
      h("ul", { class: "app-list" }, pick.map((m) => h("li", { class: "home-onesug-row" },
        h("a", { class: "app-row", href: App.profileHref(m.id, "events") },
          App.avatar(m.name),
          h("span", { class: "app-row-main" }, h("b", null, `${m.name}さん`), h("small", null, m.company || ""))),
        h("a", { class: "app-btn ghost small", href: `#log/1on1?new&with=${encodeURIComponent(m.id)}` }, "1on1 を予定")))));
    box.hidden = false;
  }

  // 今月の目標の進み具合(目標がなければ「決める」だけ)
  function goalsBlock(goals, s) {
    const list = (App.GOALS || []).filter(([k]) => goals && goals[k] > 0);
    if (!list.length) return h("button", { type: "button", class: "home-goal-set", onclick: () => App.goalsSheet(goals, () => App.route()) }, "＋ 今月の目標を決める");
    return h("div", { class: "home-goals" },
      list.map(([k, label, unit]) => {
        const now = s[k] || 0, goal = goals[k];
        const done = now >= goal;
        return h("div", { class: `home-goal${done ? " is-done" : ""}` },
          h("span", { class: "home-goal-label" }, label),
          h("span", { class: "home-goal-bar", "aria-hidden": "true" }, h("i", { style: `width:${Math.min(100, Math.round((now / goal) * 100))}%` })),
          h("span", { class: "home-goal-num" }, done ? `達成 ${now}${unit}` : `${now} / ${goal}${unit}`));
      }),
      h("button", { type: "button", class: "home-goal-edit", onclick: () => App.goalsSheet(goals, () => App.route()) }, "目標を変える"));
  }

  function alertLink(href, title, sub, cls) {
    return h("a", { class: `home-alert ${cls || ""}`, href }, h("b", null, title), h("span", null, sub));
  }
  function action(href, label, title, icon) {
    return h("a", { class: "home-action", href, title, "aria-label": title }, h("span", { class: "home-action-icon" }, App.icon(icon)), h("span", { class: "home-action-label" }, label));
  }
  function pulse(label, value, unit) {
    return h("span", { class: "home-pulse-item" }, h("b", null, String(value), h("small", null, unit)), h("span", null, label));
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
      if (code.length !== 4) { App.toast("4桁の数字を入れてください", "error"); return; }
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
          ev.deadline && !ev.past ? h("p", { class: `ev-deadline${ev.deadlinePassed ? " is-closed" : ""}` }, ev.deadlinePassed ? "申込の受付は終了しました" : `申込締切 ${App.fmtStamp(ev.deadline).replace(/(\d+:\d+)/, "$1まで")}`) : null,
          h("p", { class: "ev-count" }, `出席予定 ${ev.yesCount}名`, ev.visitorCount ? ` ・ ビジター ${ev.visitorCount}名` : "", ev.attended ? h("span", { class: "ev-done" }, ev.late ? "遅刻早退" : "出席済み") : null),
          ev.past || ev.attended || ev.deadlinePassed ? null : h("div", { class: "ev-rsvp", role: "group", "aria-label": "出欠" },
            rsvpBtn("yes", "出席する"), rsvpBtn("no", "欠席する")),
          !ev.past && !ev.myRsvp && !ev.deadlinePassed ? h("p", { class: "ev-must" }, "出席・欠席のどちらかを必ずご登録ください") : null,
          ev.meetUrl && !ev.past ? meetButton(ev) : null,
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

  // Google Meet の参加ボタン。開始1時間前から終わるまでは大きく出し、開始までの残り時間を添える
  function meetButton(ev) {
    const start = ev.start ? Date.parse(`${ev.date}T${ev.start}:00+09:00`) : NaN;
    const end = ev.end ? Date.parse(`${ev.date}T${ev.end}:00+09:00`) : start + 2 * 3600 * 1000;
    const now = Date.now();
    const live = isFinite(start) && now >= start - 60 * 60 * 1000 && now <= end;
    if (!live) return h("a", { class: "app-btn small ev-meet", href: ev.meetUrl, target: "_blank", rel: "noopener" }, "Google Meet に参加");
    const mins = Math.ceil((start - now) / 60000);
    return h("div", { class: "ev-live" },
      h("p", null, mins > 0 ? `開始まで あと${mins}分` : "ただいま開催中です"),
      h("a", { class: "app-btn primary wide ev-meet", href: ev.meetUrl, target: "_blank", rel: "noopener" }, "いま Google Meet に参加する"));
  }

  App.eventCard = eventCard;
  App.checkInForm = checkInForm;
})();
