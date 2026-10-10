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
        if (token) await AuthApi.logout(token);
        AuthSession.clearToken();
        location.replace("../login/");
      }, "ghost wide")));
      el.append(h("p", { class: "me-expire" }, `ログインの有効期限:${new Date(s.expiresAt).toLocaleString("ja-JP")}`));

      if (parts[0] === "password") passwordForm();
      if (parts[0] === "feedback") feedbackSheet();
      if (parts[0] === "install") installSheet();
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
      const tab = ["accounts", "feedback"].includes(parts[0]) ? parts[0] : "accounts";
      el.append(h("a", { class: "app-back", href: "#me" }, "← マイページ"));
      el.append(App.segmented([{ id: "accounts", label: "会員アカウント" }, { id: "feedback", label: "バグ・要望" }], tab, (id) => App.go(`admin/${id}`)));
      const body = h("div");
      el.append(body);
      if (tab === "accounts") await renderAccounts(body);
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
