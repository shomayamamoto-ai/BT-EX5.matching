// ============================================
// app/me.js — マイページ(プロフィール・パスワード・要望・ホーム画面に追加)と
// 管理者メニュー(会員アカウントの招待・設定・要望への返信)
// ============================================

(function () {
  "use strict";
  const { h } = App;

  App.views.me = {
    title: "マイページ",
    tab: "",
    async render(el, parts) {
      const s = App.session;
      const me = App.memberById(s.memberId);
      el.append(h("div", { class: "me-head" }, App.avatar(s.displayName, "lg"),
        h("div", null, h("h1", null, `${s.displayName}さん`), h("p", null, [me && me.company, me && me.team, App.isAdmin() ? "管理者" : ""].filter(Boolean).join(" ・ ")))));

      // メニューは4つのまとまりに分ける(パソコンでは2列)
      const group = (title, ...items) => h("section", { class: "me-group" }, h("h2", { class: "me-group-title" }, title), h("div", { class: "me-menu" }, items.filter(Boolean)));
      el.append(h("nav", { class: "me-groups", "aria-label": "マイページのメニュー" },
        group("プロフィール",
          menu("../profile/", "プロフィール・1on1シートを編集", "紹介されるための情報。入れるほど紹介が届きます"),
          menu("#me/quick", "かんたんプロフィール(3つの質問)", "活動範囲・求める紹介・ジャンルだけを1分で"),
          menu(me ? App.profileHref(me.id, "me") : "../referral/", "ほかのメンバーからの見え方", "早見表のあなたのカード"),
          menu("#me/card", "デジタル会員証・QR コード", "交流会でメンバーに QR を読み取ってもらうと、あなたの詳細が開きます"),
          menu("#me/billing", "会費・領収書", "会費のプランと明細。領収書・明細書を PDF で保存")),
        group("記録・目標",
          menu("#me/goals", "今月の目標", "紹介・成約・1on1・ビジターの数を決めて、「記録」→「分析」で進み具合を見る"),
          menu("#me/pitch", "プレゼンの練習・タイマー", "プレゼンの原稿と、30秒〜25分(ポモドーロ)のタイマー。0秒で音が鳴ります"),
          menu("#present", "プレゼンの進行・顔写真", "定例会で、顔写真と紹介つきの大きな画面で順番に進めます。自分の顔写真もここで入れられます"),
          menu("#invite", "ビジター招待", "招待URL の発行・そのまま使える文・招待履歴"),
          menu("#me/export", "自分の記録を書き出す(CSV・Excel で開けます)", "紹介・ありがとうマイル・1on1 の記録を CSV で保存"),
          menu("../teams/", "全体分析", "仕事が回る業種・紹介の流れ")),
        group("通知・設定",
          menu("#me/password", s.hasPassword ? "パスワードを変える" : "パスワードを決める", s.hasPassword ? "" : "共通パスコードの代わりに、あなた専用のパスワードで入れます", !s.hasPassword),
          menu("#me/notify", "通知を受け取る(iPhone・Android)", "紹介・掲示板・運営連絡が届いたら、スマホに通知します"),
          menu("#me/calendar", "Google カレンダー・Meet の設定", "1on1 の招待を受け取るアドレスと、Meet で表示される名前"),
          menu("#me/install", "スマホのホーム画面に追加", "アプリのようにすぐ開けます")),
        group("サポート",
          menu("#help", "使い方・よくある質問", "できること・だれに何が見えるか・困ったとき"),
          menu("#me/feedback", "バグ・要望を送る", "使いにくいところ・ほしい機能を運営へ")),
        App.isAdmin() ? group("運営",
          menu("#admin", "管理者メニュー", "会員の招待・ログイン設定・要望への返信", true),
          menu("../admin/", "名簿の管理", "メンバーの追加・編集")) : null));

      // お気に入り(早見表のカードの☆。この端末に保存)
      let favIds = [];
      try { favIds = JSON.parse(localStorage.getItem(`btex5-favorites-${s.memberId || "guest"}`) || "[]"); } catch { favIds = []; }
      const favs = favIds.map((id) => App.memberById(id)).filter(Boolean);
      el.append(App.section("お気に入りのメンバー",
        favs.length
          ? h("ul", { class: "app-list me-favs" }, favs.map((m) => h("li", null,
            h("a", { class: "app-row", href: App.profileHref(m.id, "me") },
              App.avatar(m.name), h("span", { class: "app-row-main" }, h("b", null, m.name), h("small", null, m.company || m.category || ""))))))
          : App.empty("早見表のカード右上の☆を押すと、ここに並びます。", h("a", { class: "app-btn ghost small", href: "../referral/" }, "早見表を開く"))));

      el.append(h("div", { class: "app-cta-row" }, App.btn("ログアウト", async () => {
        const token = AuthSession.getToken();
        // この端末への通知も止める(共有の端末で、ほかの人に通知が出ないように)
        if (typeof BtexPush !== "undefined") await BtexPush.disable().catch(() => null);
        if (token) await AuthApi.logout(token);
        AuthSession.clearToken();
        location.replace("../login/");
      }, "ghost wide")));
      el.append(h("p", { class: "me-expire" }, `このログインは ${new Date(s.expiresAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" })} まで有効です(そのあとは、もう一度ログイン)`));

      if (parts[0] === "password") passwordForm();
      if (parts[0] === "feedback") feedbackSheet();
      if (parts[0] === "install") installSheet();
      if (parts[0] === "calendar") calendarSheet();
      if (parts[0] === "notify") notifySheet();
      if (parts[0] === "export") exportSheet();
      if (parts[0] === "pitch") App.pitchSheet();
      if (parts[0] === "goals") {
        const st = await App.api("getMySettings", {}, { quiet: true });
        App.goalsSheet(st && st.goals, () => App.go("log/stats"));
      }
      if (parts[0] === "card" || parts[0] === "qr") App.memberCardSheet();
      if (parts[0] === "quick") App.quickProfileSheet();
      if (parts[0] === "billing" && App.billingSheet) App.billingSheet();
    },
  };

  function menu(href, title, sub, hot) {
    return h("a", { class: `me-item${hot ? " is-hot" : ""}`, href }, h("b", null, title), sub ? h("small", null, sub) : null);
  }

  // ---------- パスワード ----------
  function passwordForm() {
    const has = App.session.hasPassword;
    App.openSheet(has ? "パスワードを変える" : "パスワードを決める", (body, close) => {
      const cur = h("input", { type: "password", autocomplete: "current-password" });
      const pw = h("input", { type: "password", autocomplete: "new-password", minlength: "8" });
      const pw2 = h("input", { type: "password", autocomplete: "new-password" });
      const err = h("p", { class: "app-error", role: "alert" });
      // ブラウザのパスワード保存が名前とひもづけられるよう、ログイン名を隠し項目で持つ
      const user = h("input", { type: "text", autocomplete: "username", value: App.session.displayName, class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = "";
        if (pw.value.length < 8) { err.textContent = "8文字以上にしてください。"; return; }
        if (pw.value !== pw2.value) { err.textContent = "確認用のパスワードが一致しません。"; return; }
        const res = await AuthApi.call("changePassword", { current: cur.value, password: pw.value });
        if (!res.success) { err.textContent = res.error.userMessage; return; }
        App.session.hasPassword = true;
        close();
        App.toast("パスワードを保存しました。次からはお名前とパスワードで入れます");
        App.go("me");
      } },
      user,
      has ? App.field("いまのパスワード", cur) : h("p", { class: "app-lead" }, `次からは「${App.session.displayName}」とこのパスワードでログインできます。`),
      App.field("新しいパスワード", pw, "8文字以上。お名前とは別のもの"),
      App.field("もう一度", pw2),
      err, h("button", { type: "submit", class: "app-btn primary wide" }, "保存する")));
    }, { onClose: () => { if (location.hash === "#me/password") history.replaceState(null, "", "#me"); } });
  }

  // ---------- Google カレンダーとの連携 ----------
  async function calendarSheet() {
    const d = await App.api("getMySettings");
    if (!d) return;
    App.openSheet("Google カレンダー・Meet の設定", (body, close) => {
      const email = h("input", { type: "email", maxlength: "120", autocomplete: "email", placeholder: "例:yourname@gmail.com", value: d.calendarEmail });
      const meetName = h("input", { type: "text", maxlength: "60", placeholder: d.name, value: d.meetName });
      const err = h("p", { class: "app-error", role: "alert" });
      App.append(body, [
        h("p", { class: "app-lead" }, "1on1 を予定すると、運営の Google カレンダーから、このメールアドレスあてに招待が届きます。Gmail・Google Workspace のアドレスなら、あなたの Google カレンダーに自動で入ります(Google Meet を選んだときは参加用のリンクつき)。"),
        h("p", { class: "app-field-hint" }, "このアドレスはカレンダーの招待にだけ使い、ほかのメンバーには表示しません。"),
        d.calendar ? null : h("p", { class: "one-meet-note" }, "いまはお試し版のため、まだ自動では送られません(共有サーバーに切り替えると送られます)。先に登録しておけます。"),
        h("form", { class: "app-form", onsubmit: async (e) => {
          e.preventDefault();
          const r = await App.api("updateMySettings", { calendarEmail: email.value.trim(), meetName: meetName.value.trim() }, { raw: true, quiet: true });
          if (!r || r.success === false) { err.textContent = r ? r.error.userMessage : "保存できませんでした。"; return; }
          close();
          App.toast(r.calendarEmail ? "登録しました。次の 1on1 から招待が届きます" : "連携を外しました");
        } }, App.field("カレンダー用のメールアドレス", email),
        App.field("Google Meet で表示される名前", meetName, `定例会の出欠は、Meet に表示される名前で判定します。名簿の名前(${d.name})とちがう名前で参加するときは入れてください(例:ローマ字・ニックネーム)。`),
        err,
        h("button", { type: "submit", class: "app-btn primary wide" }, "保存する"))]);
    }, { onClose: () => { if (location.hash === "#me/calendar") history.replaceState(null, "", "#me"); } });
  }

  // ---------- 通知(プッシュ通知) ----------
  async function notifySheet() {
    const st = await BtexPush.status();
    App.openSheet("通知を受け取る", (body) => {
      const msg = h("p", { class: "app-error", role: "alert" });
      const state = h("p", { class: "notify-state" });
      const drawState = (on) => {
        state.className = `notify-state${on ? " is-on" : ""}`;
        state.textContent = on ? "この端末で通知を受け取っています" : "この端末ではまだ受け取っていません";
      };
      drawState(st.on);
      // 通知する内容を選ぶ(切ったものはスマホに通知しない。ベルには出る)
      const KINDS = [
        ["ref", "紹介・ありがとうマイル", "あなたあての紹介、紹介した案件の進み具合、顔合わせの予定", "ref"],
        ["one", "1on1", "1on1 の予定・もうすぐ・実施の確認", "one"],
        ["board", "掲示板", "新しい投稿、あなたの投稿へのコメント", "post"],
        ["mention", "あなたの名前が出たとき", "掲示板で「@あなたの名前」と書かれたとき", "mention"],
        ["news", "運営連絡・定例会", "運営からのお知らせ、定例会の予定・出欠のお願い", "ann"],
        ["task", "やること", "届いたやること、期限・時刻が近いとき", "task"],
        ["visitor", "ビジター", "あなたが招待したビジターの申込", "visitor"],
      ];
      const kinds = h("div", { class: "notify-kinds", "aria-label": "通知する内容" });
      let off = [];
      const drawKinds = () => App.fill(kinds, KINDS.map(([id, label, sub, g]) => {
        const box = h("input", { type: "checkbox", checked: !off.includes(id) });
        box.addEventListener("change", async () => {
          off = box.checked ? off.filter((x) => x !== id) : [...off, id];
          const r = await App.api("updateMySettings", { notifyOff: off }, { quiet: true });
          App.toast(r ? (box.checked ? `「${label}」を通知します` : `「${label}」は通知しません(ベルには出ます)`) : "保存できませんでした", r ? "" : "error");
        });
        return h("label", { class: "notify-kind" }, box, h("span", { class: "notify-kind-icon", "aria-hidden": "true" }, App.glyph(g)), h("span", null, h("b", null, label), h("small", null, sub)));
      }));
      drawKinds();
      App.api("getMySettings", {}, { quiet: true }).then((d) => { if (d && Array.isArray(d.notifyOff)) { off = d.notifyOff; drawKinds(); } });
      body.append(
        h("p", { class: "app-lead" }, "チェックした内容があると、この端末に通知が届きます。通知を押すと、その画面が開きます(チェックを外しても、アプリ内のベルには出ます)。"),
        kinds,
        state);

      if (!st.shared) {
        body.append(h("p", { class: "one-meet-note" }, "いまはお試し版のため、通知はまだ届きません。共有サーバーに切り替えると、ここから設定できます(アプリ内のベルと、タブの数字ではいまも確認できます)。"));
      }
      if (st.needsInstall) {
        body.append(h("div", { class: "notify-ios" },
          h("b", null, "iPhone・iPad の方へ"),
          h("ol", null,
            h("li", null, "Safari でこの画面を開き、下の共有ボタン(□に↑)を押す"),
            h("li", null, "「ホーム画面に追加」を押す"),
            h("li", null, "ホーム画面の BT-EX5 のアイコンから開き、マイページ →「通知を受け取る」でオンにする")),
          h("small", null, "iOS 16.4 以降が必要です。Apple の決まりで、Safari のままでは通知を受け取れません。")));
      } else if (!st.supported) {
        body.append(h("p", { class: "one-meet-note" }, "このブラウザは通知に対応していません。iPhone は Safari、Android は Chrome でお試しください。"));
      }
      if (st.permission === "denied") {
        body.append(h("p", { class: "one-meet-note" }, st.ios ? "通知が止められています。iPhone の「設定」→「通知」→「BT-EX5」で許可してください。" : "通知が止められています。ブラウザのアドレス欄の🔒(または端末の設定)から、このサイトの通知を許可してください。"));
      }

      const row = h("div", { class: "app-btn-row" });
      const draw = (on) => {
        drawState(on);
        row.replaceChildren(on
          ? App.btn("この端末の通知を止める", async () => {
            await BtexPush.disable();
            draw(false);
            App.toast("この端末の通知を止めました");
          }, "ghost wide")
          : App.btn("通知をオンにする", async (e) => {
            msg.textContent = "";
            const b = e.currentTarget;
            b.disabled = true;
            try {
              await BtexPush.enable();
              draw(true);
              App.toast("通知をオンにしました");
            } catch (err) {
              msg.textContent = err.message;
            } finally {
              b.disabled = false;
            }
          }, "primary wide"));
        const b = row.querySelector("button");
        if (!on && (!st.supported || st.needsInstall || !st.shared)) b.disabled = true;
      };
      draw(st.on);
      body.append(msg, row,
        h("p", { class: "app-field-hint" }, "スマホ・パソコンなど、端末ごとにオンにします。ログアウトすると、その端末の通知は止まります。"),
        lineBlock());
    }, { noFocus: true, onClose: () => { if (lineTimer) clearInterval(lineTimer); if (location.hash === "#me/notify") history.replaceState(null, "", "#me"); } });
  }

  // ---------- LINE で受け取る(運営が LINE 公式アカウントを用意したとき) ----------
  let lineTimer = null;
  function lineBlock() {
    const box = h("section", { class: "line-box", "aria-label": "LINE で受け取る" }, h("p", { class: "app-loading" }, "読み込み中…"));
    const head = h("div", { class: "line-head" }, h("span", { class: "line-logo", "aria-hidden": "true" }, "LINE"), h("b", null, "LINE でも受け取る"));
    async function draw() {
      const d = await App.api("getMySettings", {}, { quiet: true });
      const ln = (d && d.line) || { available: false };
      if (!ln.available) {
        App.fill(box, head, h("p", { class: "line-note" }, "運営が LINE 公式アカウントを用意すると、ここから LINE につなげます。つなぐと、紹介・1on1・運営連絡などのお知らせが LINE のトークにも届きます(上で選んだ種類だけ)。"));
        return;
      }
      if (ln.linked) {
        const on = h("input", { type: "checkbox", checked: ln.on });
        on.addEventListener("change", async () => {
          const r = await App.api("lineSetting", { on: on.checked });
          if (r) App.toast(on.checked ? "LINE でのお知らせを再開しました" : "LINE でのお知らせを止めました");
        });
        App.fill(box, head,
          h("p", { class: "line-state is-on" }, "✓ LINE とつながっています"),
          h("label", { class: "notify-kind" }, on, h("span", null, h("b", null, "LINE にお知らせを送る"), h("small", null, "上で選んだ種類のお知らせを、LINE のトークにも送ります"))),
          h("div", { class: "app-btn-row" }, App.btn("LINE とのつながりを外す", async () => {
            if (!(await App.confirm("LINE とのつながりを外しますか?(LINE にお知らせが届かなくなります)", { ok: "外す", danger: true }))) return;
            if (await App.api("lineSetting", { unlink: true })) { App.toast("LINE とのつながりを外しました"); draw(); }
          }, "ghost small")));
        return;
      }
      App.fill(box, head,
        h("p", { class: "line-note" }, "紹介・1on1・運営連絡などのお知らせを、LINE のトークでも受け取れます。"),
        App.btn("LINE とつなぐ", async (e) => {
          e.currentTarget.disabled = true;
          const r = await App.api("lineLinkCode", { appUrl: App.siteUrl("") });
          if (!r) { e.currentTarget.disabled = false; return; }
          App.fill(box, head,
            h("ol", { class: "line-steps" },
              h("li", null, "BT-EX5 の公式アカウントを友だち追加する", r.addUrl ? h("a", { class: "app-btn small line-add", href: r.addUrl, target: "_blank", rel: "noopener" }, "友だち追加") : null),
              h("li", null, "トークに、下の6けたのコードを送る")),
            h("p", { class: "line-code", "aria-label": `コード ${r.code.split("").join(" ")}` }, r.code),
            h("div", { class: "app-btn-row" }, App.btn("コードをコピー", () => App.copyText(r.code), "ghost small")),
            h("p", { class: "app-field-hint" }, `コードは${r.minutes}分有効です。送るとこの画面が「つながっています」に変わります。`));
          // つながったかを数秒ごとに確かめる
          clearInterval(lineTimer);
          let n = 0;
          lineTimer = setInterval(async () => {
            if (++n > 120 || !box.isConnected) { clearInterval(lineTimer); return; }
            const s = await App.api("getMySettings", {}, { quiet: true });
            if (s && s.line && s.line.linked) { clearInterval(lineTimer); App.toast("LINE とつながりました"); draw(); }
          }, 5000);
        }, "primary"));
    }
    draw();
    return box;
  }

  // ---------- 自分の記録を書き出す(Excel で開ける CSV) ----------
  function exportSheet() {
    const stamp = App.todayKey().replace(/-/g, "");
    const ST = (s) => (App.REF_STATUS[s] || { label: s }).label;
    const meetText = (mt) => (mt ? `${mt.date} ${mt.time || ""} ${mt.mode === "meet" ? `Google Meet ${mt.meetUrl || ""}` : mt.place || ""}`.trim() : "");
    const kinds = [
      { id: "given", label: "出した紹介", run: async () => {
        const d = await App.api("listMyReferrals");
        return d && [["日時", "紹介先", "紹介した方", "相談の内容", "状況", "お礼(円)", "顔合わせ"],
          ...d.given.map((r) => [r.at, r.toName, r.prospect, r.memo, ST(r.status), r.thanksAmount || "", meetText(r.meeting)])];
      } },
      { id: "received", label: "受けた紹介", run: async () => {
        const d = await App.api("listMyReferrals");
        return d && [["日時", "紹介してくれた人", "紹介された方", "連絡先", "相談の内容", "状況", "お礼(円)", "顔合わせ"],
          ...d.received.map((r) => [r.at, r.fromName, r.prospect, r.contact, r.memo, ST(r.status), r.thanksAmount || "", meetText(r.meeting)])];
      } },
      { id: "miles", label: "ありがとうマイル", run: async () => {
        const d = await App.api("listMyReferrals");
        return d && [["日時", "受け取った/送った", "相手", "金額(円)", "メッセージ"],
          ...d.thanksIn.map((t) => [t.at, "受け取った", t.fromName, t.amount, t.message]),
          ...d.thanksOut.map((t) => [t.at, "送った", t.toName, t.amount, t.message])];
      } },
      { id: "1on1", label: "1on1", run: async () => {
        const d = await App.api("list1on1");
        const S = { planned: "予定", done: "実施", cancelled: "中止" };
        return d && [["日付", "時刻", "相手", "場所", "状況", "メモ(自分だけ)", "次にやること"],
          ...d.items.map((o) => [o.date, o.time ? `${o.time}〜${o.end}` : "", o.withName, o.mode === "meet" ? "Google Meet" : o.place, S[o.status] || o.status, o.note, o.next])];
      } },
    ];
    App.openSheet("自分の記録を書き出す", (body) => {
      body.append(h("p", { class: "app-lead" }, "押すと CSV ファイルを保存します。Excel・Google スプレッドシート・Numbers で開けます。あなたが見られる記録だけが入ります。"),
        h("div", { class: "app-btn-row" }, kinds.map((k) => App.btn(k.label, async () => {
          const rows = await k.run();
          if (!rows) return;
          App.downloadCsv(`BT-EX5-${k.id}-${stamp}.csv`, rows);
          App.toast(`${k.label}(${rows.length - 1}件)を保存しました`);
        }, "ghost"))));
    }, { noFocus: true, onClose: () => { if (location.hash === "#me/export") history.replaceState(null, "", "#me"); } });
  }

  // ---------- バグ・要望 ----------
  const FB_KINDS = { bug: "不具合", idea: "要望・アイデア", other: "その他" };
  const FB_STATUS = { new: { label: "受付", tone: "mute" }, doing: { label: "対応中", tone: "info" }, done: { label: "対応済み", tone: "good" } };
  async function feedbackSheet() {
    const mine = await App.api("listMyFeedback", {}, { quiet: true });
    App.openSheet("バグ・要望を送る", (body, close) => {
      let kind = "idea";
      const kinds = h("div", { class: "board-cats" });
      const drawKinds = () => kinds.replaceChildren(...Object.keys(FB_KINDS).map((k) => h("button", { type: "button", class: `app-pill${k === kind ? " is-on" : ""}`, onclick: () => { kind = k; drawKinds(); } }, FB_KINDS[k])));
      drawKinds();
      const text = h("textarea", { rows: "5", maxlength: "2000", placeholder: "例:スマホで〇〇の画面のボタンが押しにくい / 〇〇ができると便利" });
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        if (!text.value.trim()) { App.fieldError(text, "内容を入れてください。"); return; }
        const d = await App.api("sendFeedback", { kind, body: text.value, page: navigator.userAgent.slice(0, 120) });
        if (!d) return;
        close();
        App.toast("送りました。ありがとうございます");
        App.go("me");
      } }, App.field("種類", kinds), App.field("内容", text), h("button", { type: "submit", class: "app-btn primary wide" }, "送る")));
      if (mine && mine.items.length) {
        body.append(App.section("これまでに送ったもの", h("ul", { class: "app-list" }, mine.items.map((f) => h("li", { class: "fb-item" },
          h("div", null, App.chip(FB_STATUS[f.status].label, FB_STATUS[f.status].tone), " ", h("small", null, `${FB_KINDS[f.kind]} ・ ${App.fmtTime(f.at)}`)),
          h("p", null, f.body),
          f.reply ? h("p", { class: "fb-reply" }, h("b", null, "運営より:"), f.reply) : null)))));
      }
    }, { onClose: () => { if (location.hash === "#me/feedback") history.replaceState(null, "", "#me"); } });
  }

  // ---------- ホーム画面に追加 ----------
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
  function installSheet() {
    App.openSheet("ホーム画面に追加", (body) => {
      const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
      const ua = navigator.userAgent;
      body.append(h("p", { class: "app-lead" }, standalone ? "すでにホーム画面から開いています。"
        : installPrompt ? "下のボタンを押すと、ホーム画面にアイコンが追加されます。"
        : /iPhone|iPad|iPod/.test(ua) ? "Safari の下にある共有ボタン(□に↑)→「ホーム画面に追加」を押してください。"
        : /Android/.test(ua) ? "Chrome の右上のメニュー(︙)→「ホーム画面に追加」を押してください。"
        : "スマホで開き、iPhone は共有ボタン →「ホーム画面に追加」、Android は Chrome のメニュー(︙)→「ホーム画面に追加」を押してください。"));
      if (installPrompt && !standalone) {
        body.append(App.btn("ホーム画面に追加する", async () => {
          installPrompt.prompt();
          await installPrompt.userChoice.catch(() => null);
          installPrompt = null;
        }, "primary wide"));
      }
    }, { onClose: () => { if (location.hash === "#me/install") history.replaceState(null, "", "#me"); } });
  }

  // ============================================
  // 管理者メニュー
  // ============================================
  const ACCOUNT_STATUS = {
    active: { label: "利用中", tone: "good" },
    invited: { label: "招待中", tone: "info" },
    expired: { label: "招待の期限切れ", tone: "warn" },
    none: { label: "未招待", tone: "mute" },
  };

  App.views.admin = {
    title: "運営",
    tab: "",
    async render(el, parts) {
      if (!App.isAdmin()) { el.append(App.empty("管理者のみ使えます。")); return; }
      const tab = ["dashboard", "accounts", "billing", "connect", "feedback"].includes(parts[0]) ? parts[0] : "dashboard";
      el.append(h("a", { class: "app-back", href: "#me" }, "← マイページ"));
      el.append(App.segmented([{ id: "dashboard", label: "ダッシュボード" }, { id: "accounts", label: "会員アカウント" }, { id: "billing", label: "会費" }, { id: "connect", label: "LINE 連携" }, { id: "feedback", label: "バグ・要望" }], tab, (id) => App.go(`admin/${id}`)));
      const body = h("div");
      el.append(body);
      if (tab === "dashboard") await App.renderDashboard(body, parts[1]);
      else if (tab === "accounts") await renderAccounts(body);
      else if (tab === "billing" && App.renderBillingAdmin) await App.renderBillingAdmin(body);
      else if (tab === "connect") await renderLineAdmin(body);
      else await renderFeedback(body);
    },
  };

  // ---------- LINE 連携(管理者) ----------
  async function renderLineAdmin(body) {
    const d = await App.api("adminLineStatus");
    if (!d) return;
    if (!d.available) {
      body.append(App.section("LINE 公式アカウントでの通知",
        h("p", { class: "app-lead" }, "LINE 公式アカウントを用意すると、会員が自分の LINE とつなぎ、紹介・1on1・運営連絡などのお知らせを LINE のトークでも受け取れるようになります(スマホの通知と同じ内容・同じ種類の設定)。"),
        h("p", { class: "line-state" }, "いまは未設定です。LINE 公式アカウントを作ったら、設定はシステムの開発者に依頼してください(10分ほどで終わります)。"),
        h("details", { class: "app-more-box" }, h("summary", null, "設定の手順(開発者向け)"), h("ol", { class: "line-steps" },
          h("li", null, "LINE 公式アカウントを作る(無料プランは月200通まで。26名に週1〜2回なら収まります)"),
          h("li", null, "LINE Developers で Messaging API を有効にし、チャネルアクセストークン(長期)を発行する"),
          h("li", null, "Apps Script エディタで setupLine を開き、トークンと友だち追加の URL を書いて1回実行する(gas/README.md の「LINE で通知を送る」)"),
          h("li", null, "実行ログに出た Webhook URL を LINE Developers に入れて「Webhookの利用」をオンにし、新しいバージョンでデプロイする"))),
        h("p", { class: "app-field-hint" }, "設定が終わると、この画面に「つないだ人数」と「今月送った数」が出ます。")));
      return;
    }
    const limit = h("input", { type: "number", min: "0", max: "100000", value: String(d.monthlyLimit), inputmode: "numeric" });
    body.append(App.section("LINE 公式アカウントでの通知",
      h("div", { class: "dash-kpis" },
        App.kpi("つないだ会員", `${d.linked}`, `${d.members}名のうち`),
        App.kpi("今月送った数", `${d.sentThisMonth}`, `上限 ${d.monthlyLimit}通`)),
      d.linkedNames.length ? h("p", { class: "app-field-hint" }, `つないだ人:${d.linkedNames.join("、")}`) : null,
      d.addUrl ? h("p", { class: "app-field-hint" }, "友だち追加の URL:", h("a", { href: d.addUrl, target: "_blank", rel: "noopener" }, d.addUrl)) : null,
      h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        const r = await App.api("adminLineStatus", { monthlyLimit: Number(limit.value) });
        if (r) App.toast("月の上限を保存しました");
      } }, App.field("月に送る上限(通)", limit, "上限をこえると、その月は LINE で送りません(スマホの通知・ベルには出ます)。無料プランは200通"),
        h("button", { type: "submit", class: "app-btn" }, "保存")),
      h("p", { class: "app-field-hint" }, "会員には「マイページ → 通知を受け取る → LINE とつなぐ」から案内してください。")));
  }

  function inviteMessage(inv) {
    const url = App.siteUrl(`../login/?invite=${encodeURIComponent(inv.code)}`);
    return [
      `${inv.name}さん`,
      `BT-EX5 の会員サイトに、あなた専用のログインを用意しました。`,
      `下のリンクを開いて、パスワードを決めてください(1分で終わります)。`,
      url,
      ``,
      `招待コード:${inv.code}(${new Date(inv.expiresAt).toLocaleDateString("ja-JP")}まで有効)`,
      `次からは「お名前」と「決めたパスワード」でログインできます。`,
    ].join("\n");
  }

  function showInvites(invites) {
    App.openSheet(invites.length > 1 ? `招待文(${invites.length}名分)` : "招待文", (body) => {
      const all = invites.map(inviteMessage).join("\n\n――――――――\n\n");
      body.append(h("p", { class: "app-lead" }, "コードはこの画面でしか表示されません。本人に LINE などで送ってください。もう一度発行すると、前のコードは使えなくなります。"));
      if (invites.length > 1) body.append(h("div", { class: "app-btn-row" }, App.btn("全員分をコピー", () => App.copyText(all), "primary")));
      invites.forEach((inv) => {
        const text = inviteMessage(inv);
        const box = h("textarea", { rows: "7", readonly: true, class: "invite-text" });
        box.value = text;
        body.append(h("div", { class: "invite-item" },
          h("p", { class: "app-field-label" }, inv.name, inv.reset ? "(パスワードの再設定)" : ""), box,
          h("div", { class: "app-btn-row" }, App.btn("送る(共有)", () => App.shareText(text), "small"), App.btn("コピー", () => App.copyText(text), "ghost small"))));
      });
    });
  }

  async function renderAccounts(el) {
    const d = await App.api("adminListAccounts");
    if (!d) return;
    const counts = { active: 0, invited: 0, expired: 0, none: 0 };
    d.accounts.forEach((a) => { counts[a.status] += 1; });

    // 共通パスコードの受付
    const pass = h("input", { type: "checkbox", checked: d.settings.memberPasscode, onchange: async () => {
      if (!pass.checked && counts.active < d.accounts.length && !(await App.confirm(`まだパスワードを決めていない会員が ${d.accounts.length - counts.active} 名います。止めると、その人たちはログインできなくなります。止めますか?`, { ok: "止める", danger: true }))) { pass.checked = true; return; }
      const r = await App.api("adminSetSettings", { memberPasscode: pass.checked });
      if (r) App.toast(pass.checked ? "共通パスコードでのログインを受け付けます" : "共通パスコードでのログインを止めました");
      else pass.checked = !pass.checked;
    } });
    el.append(App.section("ログインの設定",
      h("label", { class: "app-check" }, pass, " 会員用の共通パスコードでのログインを受け付ける(移行期間)"),
      h("p", { class: "app-field-hint" }, "全員がパスワードを決めたら止めてください。管理者用パスコードは非常用としていつでも使えます。")));

    const notActive = d.accounts.filter((a) => a.status !== "active");
    el.append(App.section(`会員アカウント(利用中 ${counts.active} / ${d.accounts.length}名)`,
      h("p", { class: "app-field-hint" }, `招待中 ${counts.invited} ・ 期限切れ ${counts.expired} ・ 未招待 ${counts.none}`),
      notActive.length ? h("div", { class: "app-cta-row" }, App.btn(`まだの ${notActive.length} 名に招待コードをまとめて発行`, async () => {
        if (!(await App.confirm(`${notActive.length} 名分の招待コードを発行します。招待中の人のコードは新しいものに変わります。`, { ok: "発行する" }))) return;
        const r = await App.api("adminIssueInvite", { memberIds: notActive.map((a) => a.memberId) });
        if (r) { await App.route(); showInvites(r.invites); }
      }, "primary wide")) : null,
      h("ul", { class: "app-list acc-list" }, d.accounts.map((a) => {
        const st = ACCOUNT_STATUS[a.status];
        // いまログインしている自分(管理者パスコードで入っているときは、アカウントがなくても「ログイン中」)
        const self = a.memberId === App.session.memberId;
        const viaPass = self && a.status !== "active";
        const isAdmin = a.admin || (self && App.isAdmin());
        return h("li", { class: self ? "is-me" : "" }, h("div", { class: "app-row" },
          App.avatar(a.name),
          h("span", { class: "app-row-main" }, h("b", null, a.name, self ? "(あなた)" : "", isAdmin ? h("span", { class: "acc-admin", title: "管理者" }, " ", App.glyph("crown"), " 管理者") : ""),
            h("small", null, viaPass ? "管理者パスコードでログイン中(ご自分のパスワードは マイページ →「パスワードを決める」)" : a.status === "active" ? `最終ログイン ${a.lastLoginAt ? App.fmtTime(a.lastLoginAt) : "—"}` : a.status === "invited" ? `${new Date(a.inviteExpiresAt).toLocaleDateString("ja-JP")}まで有効` : a.team || "")),
          a.locked ? App.chip("ロック中", "warn") : viaPass ? App.chip("ログイン中", "good") : App.chip(st.label, st.tone),
          h("details", { class: "acc-more" }, h("summary", { "aria-label": `${a.name}さんの操作` }, "…"),
            h("div", { class: "acc-menu" },
              App.btn(a.status === "active" ? "パスワード再設定のコードを発行" : "招待コードを発行", async () => {
                const r = await App.api("adminIssueInvite", { memberId: a.memberId });
                if (r) { await App.route(); showInvites(r.invites); }
              }, "small"),
              a.locked ? App.btn("ロックを解除", async () => { if (await App.api("adminResetAccount", { memberId: a.memberId })) { App.toast("解除しました"); App.route(); } }, "ghost small") : null,
              a.status === "active" ? App.btn("すべての端末からログアウトさせる", async () => {
                if (!(await App.confirm(`${a.name}さんをすべての端末からログアウトさせますか?`, { ok: "ログアウトさせる", danger: true }))) return;
                if (await App.api("adminResetAccount", { memberId: a.memberId, signOut: true })) App.toast("ログアウトさせました");
              }, "ghost small") : null,
              self ? null : App.btn(a.admin ? "管理者から外す" : "管理者にする", async () => {
                if (!(await App.confirm(a.admin ? `${a.name}さんを管理者から外しますか?` : `${a.name}さんを管理者にしますか?名簿の編集・招待・運営連絡ができるようになります。`, { ok: a.admin ? "外す" : "管理者にする", danger: !!a.admin }))) return;
                if (await App.api("adminSetAdmin", { memberId: a.memberId, admin: !a.admin })) App.route();
              }, "ghost small")))));
      }))));
  }

  // 送られた画面の場所(#events など)を、画面の名前に
  const PAGE_NAMES = { home: "予定", log: "記録", events: "予定", board: "掲示板", news: "運営連絡", me: "マイページ", feed: "お知らせ", invite: "ビジター招待", admin: "運営", help: "使い方", referral: "紹介先早見表", profile: "プロフィール", teams: "全体分析" };
  function pageName(p) {
    const m = String(p || "").match(/#?([a-z]+)/i);
    return (m && PAGE_NAMES[m[1]]) || p;
  }
  async function renderFeedback(el) {
    const d = await App.api("adminListFeedback");
    if (!d) return;
    if (!d.items.length) { el.append(App.empty("まだ届いていません。")); return; }
    // 状況で絞る(はじめは まだのもの = 受付・対応中)
    let show = "open";
    const count = (k) => d.items.filter((f) => (k === "open" ? f.status !== "done" : k === "all" ? true : f.status === k)).length;
    const chips = h("div", { class: "app-chips fb-filter" });
    const list = h("ul", { class: "app-cards" });
    function draw() {
      App.fill(chips, [["open", "まだ"], ["new", "受付"], ["doing", "対応中"], ["done", "対応済み"], ["all", "すべて"]].map(([k, label]) =>
        h("button", { type: "button", class: `app-pill${show === k ? " is-on" : ""}`, "aria-pressed": show === k ? "true" : "false", onclick: () => { show = k; draw(); } }, `${label} ${count(k)}`)));
      const items = d.items.filter((f) => (show === "open" ? f.status !== "done" : show === "all" ? true : f.status === show));
      App.fill(list, items.length ? items.map(card) : [App.empty("この状況のものはありません。")]);
    }
    function card(f) {
      const status = h("select", { "aria-label": "状況" }, Object.keys(FB_STATUS).map((k) => h("option", { value: k }, FB_STATUS[k].label)));
      status.value = f.status;
      const reply = h("textarea", { rows: "3", maxlength: "1000", placeholder: "返信(送った本人のマイページに表示されます)" });
      reply.value = f.reply;
      return h("li", null, h("article", { class: "ref-card" },
        h("div", { class: "ref-card-head" }, App.avatar(f.byName), h("div", null, h("b", null, f.byName), h("small", null, [FB_KINDS[f.kind], App.fmtTime(f.at), f.page ? `「${pageName(f.page)}」の画面から` : ""].filter(Boolean).join(" ・ "))), App.chip(FB_STATUS[f.status].label, FB_STATUS[f.status].tone)),
        h("p", { class: "fb-body" }, f.body),
        f.reply ? h("p", { class: "fb-reply" }, h("b", null, "返信:"), f.reply) : null,
        h("details", { class: "app-more-box" },
          h("summary", null, f.reply ? "返信・状況を直す" : "返信する・状況を変える"),
          h("div", { class: "app-form" }, App.field("状況", status), App.field("返信", reply),
            App.btn("保存", async () => {
              if (await App.api("adminUpdateFeedback", { id: f.id, status: status.value, reply: reply.value })) { App.toast("保存しました"); App.route(); }
            }, "primary small")))));
    }
    el.append(chips, list);
    draw();
  }
})();
