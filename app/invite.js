// ============================================
// app/invite.js — ビジター招待(#invite)
// 招待の前に確認すること(クリエアドバンスへの事前共有)・招待を作成(招待URLの発行)・
// そのまま使える文(ボタンでコピー / LINE などで送る)・招待履歴
// ============================================

(function () {
  "use strict";
  const { h } = App;

  const KIND = {
    general: { label: "一般の方(LINK 以外)", short: "一般", tone: "mute" },
    link: { label: "LINK BT 会員の方", short: "LINK会員", tone: "info" },
  };

  // ---------- そのまま使える文 ----------
  // x: { name(相手のお名前), company, ev(定例会), url(招待URL), kind, message }
  function when(ev) {
    if (!ev) return "(定例会の日時)";
    return `${App.fmtDateLong(ev.date)} ${ev.start || ""}${ev.end ? `〜${ev.end}` : ""}`;
  }
  function where(ev) {
    if (!ev) return "";
    return ev.online ? "オンライン(参加リンクはお申し込み後にお送りします)" : ev.place || "";
  }
  function who(x) { return x.name ? `${x.name}さん` : "〇〇さん"; }
  const me = () => App.session.displayName;

  const TEMPLATES = [
    {
      id: "share-general",
      group: "まず、クリエアドバンスへ事前共有",
      title: "外部の方を招待したい(許可のお願い)",
      text: (x) => [
        `お疲れさまです。${me()}です。`,
        `${who(x)}${x.company ? `(${x.company})` : ""}を、BT-EX5 の定例会(${when(x.ev)})にビジターとしてご招待したいです。`,
        "ご確認のうえ、問題なければ許可をいただけますでしょうか。よろしくお願いいたします。",
      ].join("\n"),
    },
    {
      id: "share-link",
      group: "まず、クリエアドバンスへ事前共有",
      title: "LINK メンバーに案内し、参加したいと言ってもらえた(報告)",
      text: (x) => [
        `お疲れさまです。${me()}です。`,
        `LINK メンバーの${who(x)}に BT-EX をご案内し、定例会(${when(x.ev)})に参加したいと言ってもらえました。`,
        "ご把握・ご確認のうえ、ご招待してもよろしいでしょうか。よろしくお願いいたします。",
      ].join("\n"),
    },
    {
      id: "invite-line",
      group: "相手に送る",
      title: "招待(LINE 向けの短い文)",
      text: (x) => [
        `${who(x)}、こんにちは!${me()}です。`,
        `新潟と東京の経営者が集まって、お互いのお客様を紹介し合う「BT-EX5」の定例会があります。${who(x)}のお仕事にも合いそうな方がいるので、よかったら一度見学に来ませんか?`,
        "",
        `■ ${when(x.ev)}`,
        where(x.ev) ? `■ ${where(x.ev)}` : "",
        x.url ? `お申し込み(1分で終わります):${x.url}` : "(このあと、お申し込みのリンクをお送りします)",
      ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n"),
    },
    {
      id: "invite-mail",
      group: "相手に送る",
      title: "招待(メール向けの丁寧な文)",
      text: (x) => [
        `${x.company ? `${x.company}\n` : ""}${x.name ? `${x.name}様` : "〇〇様"}`,
        "",
        `いつもお世話になっております。${me()}です。`,
        "このたび、私が参加している経営者コミュニティ「BT-EX5」の定例会に、ビジターとしてご招待させていただきたくご連絡いたしました。",
        "BT-EX5 は、新潟と東京の経営者が集まり、お互いのお客様をご紹介し合う会です。新しいご縁や販路づくりのきっかけになれば幸いです。",
        "",
        `日時:${when(x.ev)}`,
        where(x.ev) ? `場所:${where(x.ev)}` : "",
        x.ev && x.ev.fee ? `参加費:${x.ev.fee}` : "",
        "",
        x.url ? `お申し込みは、こちらのページから1分ほどでできます。\n${x.url}` : "お申し込みのリンクは、追ってお送りいたします。",
        "",
        "ご不明な点がございましたら、お気軽にお問い合わせください。",
        "どうぞよろしくお願いいたします。",
        "",
        me(),
      ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n"),
    },
    {
      id: "invite-link",
      group: "相手に送る",
      title: "LINK メンバーへの案内",
      text: (x) => [
        `${who(x)}、お疲れさまです!${me()}です。`,
        `BT-EX5 の定例会(${when(x.ev)})にご案内します。新潟と東京のメンバーで、お互いのお客様を紹介し合っています。`,
        "お申し込みのときに、所属チーム・アップ・アドバンスを入れてください。",
        x.url ? x.url : "(お申し込みのリンクは追ってお送りします)",
      ].join("\n"),
    },
    {
      id: "remind",
      group: "そのあと",
      title: "前日のリマインド",
      text: (x) => [
        `${who(x)}、明日はよろしくお願いします!`,
        `■ ${when(x.ev)}`,
        where(x.ev) ? `■ ${where(x.ev)}` : "",
        "当日は30秒の自己紹介の時間があります。お仕事と「こんな方を紹介してほしい」を一言いただけるとつながりやすいです。",
        "お会いできるのを楽しみにしています。",
      ].filter(Boolean).join("\n"),
    },
    {
      id: "thanks",
      group: "そのあと",
      title: "参加のお礼",
      text: (x) => [
        `${who(x)}、本日は BT-EX5 の定例会にご参加いただき、ありがとうございました!`,
        "気になった方がいれば、個別におつなぎしますので気軽に言ってください。",
        "また次回もぜひご一緒できたらうれしいです。",
      ].join("\n"),
    },
  ];

  // 文のボタン(コピー・LINE などで送る)。getCtx は押したときの相手・定例会・URL を返す
  function templateList(getCtx) {
    const groups = {};
    TEMPLATES.forEach((t) => { (groups[t.group] = groups[t.group] || []).push(t); });
    return h("div", { class: "tpl-list" }, Object.keys(groups).map((g) => h("div", { class: "tpl-group" },
      h("p", { class: "tpl-group-title" }, g),
      groups[g].map((t) => {
        const preview = h("pre", { class: "tpl-preview", hidden: true });
        return h("div", { class: "tpl-item" },
          h("div", { class: "tpl-head" },
            h("b", null, t.title),
            h("div", { class: "tpl-btns" },
              App.btn("コピー", () => App.copyText(t.text(getCtx()), "コピーしました。そのまま貼り付けて送れます"), "small"),
              App.btn("送る", () => App.shareText(t.text(getCtx()), "BT-EX5"), "ghost small"),
              App.btn("見る", () => { preview.textContent = t.text(getCtx()); preview.hidden = !preview.hidden; }, "ghost small"))),
          preview);
      }))));
  }

  App.views.invite = {
    title: "ビジター招待",
    tab: "events",
    async render(el, parts, params) {
      const [d, mine] = await Promise.all([App.api("listEvents"), App.api("listMyVisitors", { mine: true }, { quiet: true })]);
      if (!d) return;
      const upcoming = d.events.filter((e) => !e.past && !e.deadlinePassed);
      el.append(h("h1", { class: "app-h1" }, "ビジター招待"),
        h("p", { class: "app-lead" }, "知人を次回の定例会に招待しましょう。あなたが紹介者として記録されます。"));

      // ---------- 招待の前に確認すること ----------
      let seen = false;
      try { seen = localStorage.getItem("btex5-invite-rules-seen") === "1"; } catch { /* noop */ }
      const rules = h("details", { class: "inv-rules", open: !seen },
        h("summary", null, "⚠️ 招待の前に、必ずクリエアドバンスへ共有・確認を"),
        h("p", null, h("b", null, "ビジター参加は、系列チームのクリエアドバンスが把握・承認した方のみが対象です。"), "お申し込みの前に、必ず共有・確認をお願いします。"),
        h("h3", null, "お声がけの前に確認すること"),
        h("ul", null,
          h("li", null, "直上クリエが、その方の BT-EX 参加希望を知っていますか"),
          h("li", null, "系列チームのクリエアドバンス(チームリーダー)の許可を得ていますか")),
        h("h3", null, "招待の手順"),
        h("ul", null,
          h("li", null, h("b", null, "外部の方:"), "お声がけ →「〇〇さんをビジターに招待したいです」とクリエアドバンスへ事前共有 → 許可が出てから、ご招待"),
          h("li", null, h("b", null, "LINK メンバーの方:"), "BT-EX をご案内 → 参加の意思を確認 →「〇〇さんに案内し、参加したいと言ってもらえました」とクリエアドバンスへ報告 → 把握・確認のうえ、ご招待")),
        h("h3", null, "やってはいけないこと"),
        h("ul", null,
          h("li", null, "他系列のメンバーへ、こちらからお声がけすること(直上クリエ・クリエアドバンスの方針で、BT-EX への参加を認めていない場合があります)"),
          h("li", null, "他系列の方から聞かれたときは「まずは、あなたのチームリーダーに聞いてみてください」とお伝えください。ご不明な点は運営までご連絡ください。")),
        h("p", { class: "inv-why" }, "事前の共有が必要なのは、運営から「誰が、どなたを招待しているのか」と確認があったときに、クリエアドバンスがきちんと把握して答えられるようにしておくためです。"),
        h("p", { class: "inv-tip" }, "下の「クリエアドバンスへ事前共有」の文を、ボタンでコピーして送れます。"));
      rules.addEventListener("toggle", () => { if (!rules.open) { try { localStorage.setItem("btex5-invite-rules-seen", "1"); } catch { /* noop */ } } });
      el.append(rules);

      // ---------- 招待を作成 ----------
      const evSel = h("select", { "aria-label": "対象定例会" },
        h("option", { value: "" }, "選択してください"),
        upcoming.map((e) => h("option", { value: e.id }, `${App.fmtDate(e.date)} ${e.start || ""} ${e.title}`)));
      const want = params.get("event");
      evSel.value = upcoming.some((e) => e.id === want) ? want : (upcoming[0] ? upcoming[0].id : "");
      const kindNote = h("p", { class: "app-field-hint" });
      const kind = App.toggle([{ id: "general", label: KIND.general.label }, { id: "link", label: KIND.link.label }], "general", (v) => drawKindNote(v));
      const drawKindNote = (v) => {
        kindNote.textContent = v === "link"
          ? "LINK BT 会員を選ぶと、お相手の申込フォームで所属チーム・アップ・アドバンスをうかがいます。参加者一覧では「LINK会員」として表示されます。"
          : "BT-EX や LINK に入っていない、外部の方です。";
      };
      drawKindNote("general");
      const name = h("input", { type: "text", maxlength: "40", placeholder: "例:佐々木 健太", autocomplete: "off" });
      const company = h("input", { type: "text", maxlength: "80", placeholder: "例:株式会社〇〇", autocomplete: "off" });
      const email = h("input", { type: "email", maxlength: "120", placeholder: "例:kenta@example.com", autocomplete: "off" });
      const message = h("textarea", { rows: "3", maxlength: "500", placeholder: "次回の BT-EX 定例会にぜひお越しください。" });
      const err = h("p", { class: "app-error", role: "alert" });
      const result = h("div", { class: "inv-result" });
      const issue = h("button", { type: "submit", class: "app-btn primary" }, "招待URL を発行");
      const mailBtn = h("button", { type: "button", class: "app-btn ghost" }, "URL 発行 + メールで送る");

      let issued = null; // 発行した招待
      const evOf = () => d.events.find((e) => e.id === evSel.value) || null;
      const ctx = () => ({ name: name.value.trim(), company: company.value.trim(), ev: evOf(), url: issued ? issued.url : "", kind: kind.getValue() });

      async function create(withMail) {
        err.textContent = "";
        if (!evSel.value) { err.textContent = "対象定例会を選んでください。"; return; }
        if (withMail && !/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email.value.trim())) { err.textContent = "メールで送るときは、メールアドレスを入れてください。"; email.focus(); return; }
        issue.disabled = true; mailBtn.disabled = true;
        const r = await App.api("createVisitorInvite", {
          eventId: evSel.value, kind: kind.getValue(), name: name.value.trim(), company: company.value.trim(),
          contact: email.value.trim(), inviteMessage: message.value.trim(),
        });
        issue.disabled = false; mailBtn.disabled = false;
        if (!r) return;
        issued = { url: App.siteUrl(`../visit/?t=${encodeURIComponent(r.visitor.token)}`), visitor: r.visitor };
        const tpl = TEMPLATES.find((t) => t.id === (kind.getValue() === "link" ? "invite-link" : "invite-line"));
        const text = [message.value.trim(), tpl.text(ctx())].filter(Boolean).join("\n\n");
        const box = h("textarea", { rows: "8", readonly: true, class: "invite-text" });
        box.value = text;
        App.fill(result,
          h("p", { class: "inv-done" }, "✓ 招待URL を発行しました"),
          h("p", { class: "app-field-hint" }, "この文を相手に送ってください(下の「そのまま使える文」もこの招待のURL入りになります)。"),
          box,
          h("div", { class: "app-btn-row" },
            App.btn("LINE などで送る", () => App.shareText(text, "BT-EX5 定例会のご招待"), "primary"),
            App.btn("コピー", () => App.copyText(text), "ghost"),
            App.btn("URL だけコピー", () => App.copyText(issued.url), "ghost"),
            email.value.trim() ? h("a", { class: "app-btn ghost", href: mailto(email.value.trim(), TEMPLATES.find((t) => t.id === "invite-mail").text(ctx()), message.value.trim()) }, "メールで送る") : null),
          h("details", { class: "qr-details" }, h("summary", null, "目の前の相手に QR コードで見せる"),
            h("div", { class: "qr-box" }, App.qrImage(issued.url, "招待の QR コード"), h("p", null, "相手のスマホのカメラで読み取ると、申込ページが開きます。"))),
          App.btn("続けて別の方を招待する", () => { issued = null; name.value = ""; company.value = ""; email.value = ""; message.value = ""; result.replaceChildren(); name.focus(); }, "ghost small"));
        if (withMail) location.href = mailto(email.value.trim(), TEMPLATES.find((t) => t.id === "invite-mail").text(ctx()), message.value.trim());
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
        loadHistory();
      }
      mailBtn.addEventListener("click", () => create(true));

      el.append(App.section("招待を作成",
        h("form", { class: "app-form inv-form", onsubmit: (e) => { e.preventDefault(); create(false); } },
          h("p", { class: "inv-unit" }, "ユニット:", h("b", null, "BT-EX5")),
          App.field("対象定例会 *", evSel, upcoming.length ? "申込締切前の定例会だけが表示されます。" : "招待できる定例会がまだありません。"),
          App.field("お招きする方 *", h("div", null, kind, kindNote)),
          h("p", { class: "inv-sub" }, "招待相手(任意。入れておくと、相手の申込フォームに最初から入ります)"),
          h("div", { class: "app-grid2" }, App.field("氏名", name), App.field("会社名", company)),
          App.field("メールアドレス", email, "「メールで送る」を押すと、メールアプリに招待文が入った状態で開きます"),
          App.field("メッセージ(任意)", message, "相手の申込ページにも表示されます"),
          err,
          h("div", { class: "app-btn-row" }, issue, mailBtn),
          result)));

      // ---------- そのまま使える文 ----------
      el.append(App.section("そのまま使える文(ボタンでコピー)",
        h("p", { class: "app-field-hint" }, "上の「招待を作成」で入れた相手の名前・定例会・招待URL が自動で入ります。"),
        templateList(ctx)));

      // ---------- 招待履歴 ----------
      const history = h("div");
      el.append(App.section("招待履歴", history));
      async function loadHistory() {
        const r = await App.api("listMyVisitors", { mine: true }, { quiet: true });
        drawHistory(r ? r.visitors : []);
      }
      function drawHistory(list) {
        if (!list.length) { App.fill(history, App.empty("まだ招待していません。")); return; }
        App.fill(history, h("ul", { class: "app-cards" }, list.map((v) => h("li", null, historyCard(v)))));
      }
      function historyCard(v) {
        const st = App.VISITOR_STATUS[v.status] || App.VISITOR_STATUS.invited;
        const url = App.siteUrl(`../visit/?t=${encodeURIComponent(v.token)}`);
        const k = KIND[v.kind] || KIND.general;
        const card = h("article", { class: `ref-card${v.status === "declined" ? " is-cancelled" : ""}` },
          h("p", { class: "inv-date" }, new Date(v.at).toLocaleDateString("ja-JP")),
          h("div", { class: "inv-name" }, h("b", null, v.name || "(相手の入力待ち)"), App.chip(k.short, k.tone)),
          v.company ? h("p", { class: "inv-company" }, v.company) : null,
          h("p", { class: "inv-event" }, "対象定例会:", h("b", null, `${App.fmtDate(v.eventDate)} ${v.eventTitle}`)),
          App.chip(st.label, st.tone),
          h("details", { class: "inv-detail" }, h("summary", null, "詳細"),
            h("dl", { class: "ref-card-body" },
              v.business ? [h("dt", null, "お仕事"), h("dd", null, v.business)] : null,
              v.contact ? [h("dt", null, "連絡先"), h("dd", null, v.contact)] : null,
              v.kind === "link" && (v.linkTeam || v.linkUp || v.linkAdvance) ? [h("dt", null, "所属"), h("dd", null, [v.linkTeam && `チーム:${v.linkTeam}`, v.linkUp && `アップ:${v.linkUp}`, v.linkAdvance && `アドバンス:${v.linkAdvance}`].filter(Boolean).join(" / "))] : null,
              v.message ? [h("dt", null, "ひとこと"), h("dd", null, v.message)] : null),
            h("div", { class: "app-btn-row" },
              App.btn("招待URL をコピー", () => App.copyText(url), "ghost small"),
              App.btn("リマインド文をコピー", () => App.copyText(TEMPLATES.find((t) => t.id === "remind").text({ name: v.name, ev: d.events.find((e) => e.id === v.eventId) })), "ghost small"),
              v.status !== "declined" ? App.btn("キャンセルにする", async () => {
                if (!confirm(`${v.name || "この方"}の招待をキャンセルにしますか?`)) return;
                if (await App.api("updateVisitor", { id: v.id, status: "declined" })) { App.toast("キャンセルにしました"); loadHistory(); }
              }, "ghost small danger") : App.btn("キャンセルを取り消す", async () => {
                if (await App.api("updateVisitor", { id: v.id, status: v.appliedAt ? "applied" : "invited" })) loadHistory();
              }, "ghost small"))));
        return card;
      }
      drawHistory(mine ? mine.visitors : []);
    },
  };

  function mailto(to, body, extra) {
    const text = [extra, body].filter(Boolean).join("\n\n");
    return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent("BT-EX5 定例会のご招待")}&body=${encodeURIComponent(text)}`;
  }

  App.inviteTemplates = TEMPLATES;
})();
