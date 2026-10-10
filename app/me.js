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

      el.append(h("nav", { class: "me-menu", "aria-label": "マイページのメニュー" },
        menu("../profile/", "プロフィール・1on1シートを編集", "紹介されるための情報。入れるほど紹介が届きます"),
        menu(me ? `../referral/#member=${encodeURIComponent(me.id)}` : "../referral/", "ほかのメンバーからの見え方", "早見表のあなたのカード"),
        menu("#me/password", s.hasPassword ? "パスワードを変える" : "パスワードを決める", s.hasPassword ? "" : "共通パスコードの代わりに、あなた専用のパスワードで入れます", !s.hasPassword),
        h("button", { type: "button", class: "me-item", onclick: (e) => {
          const on = !document.documentElement.classList.contains("big-text");
          document.documentElement.classList.toggle("big-text", on);
          try { localStorage.setItem("btex5-big-text", on ? "1" : "0"); } catch { /* noop */ }
          e.currentTarget.querySelector("b").textContent = on ? "文字を元の大きさに戻す" : "文字を大きくする";
          App.toast(on ? "文字を大きくしました(この端末のすべての画面)" : "元の大きさに戻しました");
        } }, h("b", null, document.documentElement.classList.contains("big-text") ? "文字を元の大きさに戻す" : "文字を大きくする"), h("small", null, "小さい文字が読みにくいときに")),
        menu("#me/notify", "通知を受け取る(iPhone・Android)", "紹介・メッセージ・掲示板・お知らせが届いたら、スマホに通知します"),
        menu("#me/calendar", "Google カレンダー・Meet の設定", "1on1 の招待を受け取るアドレスと、Meet で表示される名前(定例会の出欠に使います)"),
        menu("#invite", "ビジター招待", "招待URL の発行・そのまま使える文・招待履歴"),
        menu("#me/qr", "あなたのプロフィールの QR コード", "交流会でメンバーに読み取ってもらうと、あなたの詳細が開きます"),
        menu("#me/feedback", "バグ・要望を送る", "使いにくいところ・ほしい機能を運営へ"),
        menu("../teams/", "全体分析", "仕事が回る業種・紹介の流れ"),
        menu("#me/install", "スマホのホーム画面に追加", "アプリのようにすぐ開けます"),
        h("button", { type: "button", class: "me-item", "data-open-movie": "" }, h("b", null, "オープニングムービー"), h("small", null, "BT-EX5 の紹介動画")),
        App.isAdmin() ? menu("#admin", "管理者メニュー", "会員の招待・ログイン設定・要望への返信", true) : null,
        App.isAdmin() ? menu("../admin/", "名簿の管理", "メンバーの追加・編集") : null));

      // お気に入り(早見表のカードの☆。この端末に保存)
      let favIds = [];
      try { favIds = JSON.parse(localStorage.getItem(`btex5-favorites-${s.memberId || "guest"}`) || "[]"); } catch { favIds = []; }
      const favs = favIds.map((id) => App.memberById(id)).filter(Boolean);
      el.append(App.section("お気に入りのメンバー",
        favs.length
          ? h("ul", { class: "app-list me-favs" }, favs.map((m) => h("li", null,
            h("a", { class: "app-row", href: `../referral/#member=${encodeURIComponent(m.id)}` },
              App.avatar(m.name), h("span", { class: "app-row-main" }, h("b", null, m.name), h("small", null, m.company || m.category || ""))))))
          : App.empty("早見表のカード右上の☆を押すと、ここに並びます。")));

      el.append(h("div", { class: "app-cta-row" }, App.btn("ログアウト", async () => {
        const token = AuthSession.getToken();
        // この端末への通知も止める(共有の端末で、ほかの人に通知が出ないように)
        if (typeof BtexPush !== "undefined") await BtexPush.disable().catch(() => null);
        if (token) await AuthApi.logout(token);
        AuthSession.clearToken();
        location.replace("../login/");
      }, "ghost wide")));
      el.append(h("p", { class: "me-expire" }, `ログインの有効期限:${new Date(s.expiresAt).toLocaleString("ja-JP")}`));

      if (parts[0] === "password") passwordForm();
      if (parts[0] === "feedback") feedbackSheet();
      if (parts[0] === "install") installSheet();
      if (parts[0] === "calendar") calendarSheet();
      if (parts[0] === "notify") notifySheet();
      if (parts[0] === "qr") {
        const url = App.siteUrl(`../referral/#member=${encodeURIComponent(s.memberId)}`);
        App.openSheet("あなたのプロフィールの QR コード", (body) => {
          body.append(h("div", { class: "qr-box" }, App.qrImage(url, "プロフィールの QR コード"),
            h("p", null, "BT-EX5 のメンバーがスマホのカメラで読み取ると、早見表であなたの詳細が開きます(メンバーだけが見られます)。")),
            h("div", { class: "app-btn-row" }, App.btn("リンクをコピー", () => App.copyText(url), "ghost")));
        }, { noFocus: true, onClose: () => { if (location.hash === "#me/qr") history.replaceState(null, "", "#me"); } });
      }
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
      body.append(
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
        h("button", { type: "submit", class: "app-btn primary wide" }, "保存する")));
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
        state.textContent = on ? "🔔 この端末で通知を受け取っています" : "🔕 この端末ではまだ受け取っていません";
      };
      drawState(st.on);
      body.append(
        h("p", { class: "app-lead" }, "次のことがあると、この端末に通知が届きます。通知を押すと、その画面が開きます。"),
        h("ul", { class: "notify-list" },
          h("li", null, "🤝 あなたあての紹介・紹介した案件の進み具合"),
          h("li", null, "✉️ メッセージ"),
          h("li", null, "📝 掲示板の新しい投稿・あなたの投稿へのコメント"),
          h("li", null, "📣 運営からのお知らせ・📅 定例会の予定"),
          h("li", null, "🎉 ありがとうマイル・☕ 1on1 の予定・🙋 ビジターの申込")),
        state);

      if (!st.shared) {
        body.append(h("p", { class: "one-meet-note" }, "いまはお試し版のため、通知はまだ届きません。共有サーバーに切り替えると、ここから設定できます(アプリ内のベル🔔と、タブの数字ではいまも確認できます)。"));
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
        h("p", { class: "app-field-hint" }, "スマホ・パソコンなど、端末ごとにオンにします。ログアウトすると、その端末の通知は止まります。"));
    }, { noFocus: true, onClose: () => { if (location.hash === "#me/notify") history.replaceState(null, "", "#me"); } });
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
        if (!text.value.trim()) { App.toast("内容を入れてください"); return; }
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
    title: "管理者メニュー",
    tab: "",
    async render(el, parts) {
      if (!App.isAdmin()) { el.append(App.empty("管理者のみ使えます。")); return; }
      const tab = ["dashboard", "accounts", "feedback"].includes(parts[0]) ? parts[0] : "dashboard";
      el.append(h("a", { class: "app-back", href: "#me" }, "← マイページ"));
      el.append(App.segmented([{ id: "dashboard", label: "ダッシュボード" }, { id: "accounts", label: "会員アカウント" }, { id: "feedback", label: "バグ・要望" }], tab, (id) => App.go(`admin/${id}`)));
      const body = h("div");
      el.append(body);
      if (tab === "dashboard") await App.renderDashboard(body, parts[1]);
      else if (tab === "accounts") await renderAccounts(body);
      else await renderFeedback(body);
    },
  };

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
      if (!pass.checked && counts.active < d.accounts.length && !confirm(`まだパスワードを決めていない会員が ${d.accounts.length - counts.active} 名います。止めると、その人たちはログインできなくなります。止めますか?`)) { pass.checked = true; return; }
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
        if (!confirm(`${notActive.length} 名分の招待コードを発行します。招待中の人のコードは新しいものに変わります。`)) return;
        const r = await App.api("adminIssueInvite", { memberIds: notActive.map((a) => a.memberId) });
        if (r) { await App.route(); showInvites(r.invites); }
      }, "primary wide")) : null,
      h("ul", { class: "app-list acc-list" }, d.accounts.map((a) => {
        const st = ACCOUNT_STATUS[a.status];
        return h("li", null, h("div", { class: "app-row" },
          App.avatar(a.name),
          h("span", { class: "app-row-main" }, h("b", null, a.name, a.admin ? " 👑" : ""),
            h("small", null, a.status === "active" ? `最終ログイン ${a.lastLoginAt ? App.fmtTime(a.lastLoginAt) : "—"}` : a.status === "invited" ? `${new Date(a.inviteExpiresAt).toLocaleDateString("ja-JP")}まで有効` : a.team || "")),
          a.locked ? App.chip("ロック中", "warn") : App.chip(st.label, st.tone),
          h("details", { class: "acc-more" }, h("summary", { "aria-label": `${a.name}さんの操作` }, "…"),
            h("div", { class: "acc-menu" },
              App.btn(a.status === "active" ? "パスワード再設定のコードを発行" : "招待コードを発行", async () => {
                const r = await App.api("adminIssueInvite", { memberId: a.memberId });
                if (r) { await App.route(); showInvites(r.invites); }
              }, "small"),
              a.locked ? App.btn("ロックを解除", async () => { if (await App.api("adminResetAccount", { memberId: a.memberId })) { App.toast("解除しました"); App.route(); } }, "ghost small") : null,
              a.status === "active" ? App.btn("すべての端末からログアウトさせる", async () => {
                if (!confirm(`${a.name}さんをすべての端末からログアウトさせますか?`)) return;
                if (await App.api("adminResetAccount", { memberId: a.memberId, signOut: true })) App.toast("ログアウトさせました");
              }, "ghost small") : null,
              App.btn(a.admin ? "管理者から外す" : "管理者にする", async () => {
                if (!confirm(a.admin ? `${a.name}さんを管理者から外しますか?` : `${a.name}さんを管理者にしますか?名簿の編集・招待・運営連絡ができるようになります。`)) return;
                if (await App.api("adminSetAdmin", { memberId: a.memberId, admin: !a.admin })) App.route();
              }, "ghost small")))));
      }))));
  }

  async function renderFeedback(el) {
    const d = await App.api("adminListFeedback");
    if (!d) return;
    if (!d.items.length) { el.append(App.empty("まだ届いていません。")); return; }
    el.append(h("ul", { class: "app-cards" }, d.items.map((f) => {
      const status = h("select", { "aria-label": "状況" }, Object.keys(FB_STATUS).map((k) => h("option", { value: k }, FB_STATUS[k].label)));
      status.value = f.status;
      const reply = h("textarea", { rows: "2", maxlength: "1000", placeholder: "返信(送った本人に表示されます)" });
      reply.value = f.reply;
      return h("li", null, h("article", { class: "ref-card" },
        h("div", { class: "ref-card-head" }, App.avatar(f.byName), h("div", null, h("b", null, f.byName), h("small", null, `${FB_KINDS[f.kind]} ・ ${App.fmtTime(f.at)}`)), App.chip(FB_STATUS[f.status].label, FB_STATUS[f.status].tone)),
        h("p", { class: "fb-body" }, f.body),
        f.page ? h("p", { class: "app-field-hint" }, f.page) : null,
        h("div", { class: "app-form" }, status, reply,
          App.btn("保存", async () => {
            if (await App.api("adminUpdateFeedback", { id: f.id, status: status.value, reply: reply.value })) { App.toast("保存しました"); App.route(); }
          }, "small"))));
    })));
  }
})();
