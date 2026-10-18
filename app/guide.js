// ============================================
// app/guide.js — デジタル会員証・はじめての方へ(チェックリスト)・使い方とよくある質問
// ・会員証(#me/card): 黒と金のカード。名前・会社・チーム・QR(早見表のあなたの詳細が開く。メンバーだけが見られる)
// ・はじめての方へ(ホーム): パスワード・プロフィール・通知・ホーム画面・プレゼン・1on1・紹介の7つ。
//   終わったものに印がつき、全部終わるか「閉じる」で出なくなる(この端末に覚える)
// ・使い方(#help): できること・だれに何が見えるか・困ったとき。運営への問い合わせ(バグ・要望)へ
// ============================================

(function () {
  "use strict";
  const { h } = App;
  const local = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* noop */ } },
  };
  const standalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;

  // ---------- デジタル会員証 ----------
  App.memberCardSheet = function () {
    const s = App.session;
    const me = App.memberById(s.memberId) || {};
    const url = App.siteUrl(`../referral/#member=${encodeURIComponent(s.memberId)}`);
    App.openSheet("デジタル会員証", (body) => {
      const card = h("div", { class: "mcard", role: "img", "aria-label": `BT-EX5 会員証 ${s.displayName}` },
        h("div", { class: "mcard-shine", "aria-hidden": "true" }),
        h("div", { class: "mcard-top" },
          h("img", { class: "mcard-logo", src: "../assets/bt-ex5-mark-3d.png", alt: "", width: "44", height: "44" }),
          h("div", { class: "mcard-brand" }, h("b", null, "BT-EX5"), h("small", null, "MEMBERSHIP CARD"))),
        h("div", { class: "mcard-main" },
          h("p", { class: "mcard-name" }, s.displayName),
          me.company ? h("p", { class: "mcard-company" }, me.company) : null,
          h("p", { class: "mcard-meta" }, [me.team ? `${me.team}` : "", me.category || "", App.isAdmin() ? "運営" : ""].filter(Boolean).join(" ・ "))),
        h("div", { class: "mcard-foot" },
          h("small", null, "新潟・東京 紹介者制コミュニティ"),
          h("div", { class: "mcard-qr" }, App.qrImage(url, "プロフィールの QR コード"))));
      // 指でなぞると光が動く(パソコンはマウス)
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
      body.append(card,
        h("p", { class: "app-lead mcard-lead" }, "交流会でメンバーに QR を読み取ってもらうと、早見表であなたの詳細が開きます(メンバーだけが見られます)。電波がなくても、一度開いた会員証は表示できます。"),
        h("div", { class: "app-btn-row" },
          App.btn("リンクをコピー", () => App.copyText(url), "ghost"),
          App.btn("プロフィールを直す", () => { location.href = "../profile/"; }, "ghost")));
    }, { noFocus: true, onClose: () => { if (/^#me\/(card|qr)$/.test(location.hash)) history.replaceState(null, "", "#me"); } });
  };

  // ---------- かんたんプロフィール(#me/quick) ----------
  // 紹介に効くのに空いている人が多い3項目(活動範囲・求める紹介・ジャンル)だけを、1枚で入れる。
  // ほかの項目は今の値のまま(サーバーは送った項目だけを書きかえる)
  App.QUICK_PROFILE_LABELS = ["活動範囲", "求める紹介", "できること(ジャンル)"];
  App.quickProfileSheet = function () {
    const s = App.session;
    const me = App.memberById(s.memberId);
    const back = () => { if (location.hash === "#me/quick") history.replaceState(null, "", "#me"); };
    if (!me) { App.toast("プロフィールを読み込めませんでした", "error"); back(); return; }
    const areas = new Set(me.faceAreas || []);
    const topics = (me.topics || []).slice();
    let online = me.online && me.online !== "unknown" ? me.online : "";
    let saved = false;
    let wantsBox = null;
    const snap = () => JSON.stringify([[...areas].sort(), online, wantsBox ? wantsBox.value.trim() : (me.wants || "").trim(), topics]);
    const first = snap();
    App.openSheet("かんたんプロフィール", (body, close) => {
      const steps = h("p", { class: "qp-progress", "aria-live": "polite" });
      const pill = (label, on, onclick) => h("button", { type: "button", class: `app-pill${on ? " is-on" : ""}`, "aria-pressed": on ? "true" : "false", onclick }, label);

      // 1. 活動範囲
      const areaRow = h("div", { class: "app-chips" });
      const drawAreas = () => areaRow.replaceChildren(
        ...[["niigata", "新潟で対面できる"], ["tokyo", "東京・関東で対面できる"]].map(([id, label]) =>
          pill(label, areas.has(id), () => { if (areas.has(id)) areas.delete(id); else areas.add(id); drawAreas(); count(); })));
      drawAreas();
      const onlineSel = App.toggle([{ id: "all", label: "全国対応" }, { id: "partial", label: "打合せのみ" }, { id: "none", label: "対面のみ" }], online, (v) => { online = v; count(); });

      // 2. 求める紹介
      const wants = h("textarea", { rows: "3", maxlength: "400", placeholder: "例: ホームページを作ったきり更新できていない会社の社長さん。「問い合わせが来ない」と話している方" });
      wants.value = me.wants || "";
      wants.addEventListener("input", count);
      wantsBox = wants;

      // 3. ジャンル(グループごと。選んであるグループは開いておく)
      const topicCount = h("span", { class: "app-field-hint" });
      const groups = h("div", { class: "qp-groups" }, TOPIC_GROUPS.map((g) => {
        const list = TOPICS.filter((t) => t.group === g.id);
        if (!list.length) return null;
        const row = h("div", { class: "app-chips" });
        const draw = () => row.replaceChildren(...list.map((t) => pill(t.label, topics.includes(t.id), () => {
          const i = topics.indexOf(t.id);
          if (i >= 0) topics.splice(i, 1); else topics.push(t.id);
          draw(); count();
        })));
        draw();
        return h("details", { class: "qp-group", open: list.some((t) => topics.includes(t.id)) || null }, h("summary", null, g.label), row);
      }));

      const filled = () => [areas.size > 0 || !!online, wants.value.trim().length > 0, topics.length > 0];
      function count() {
        const n = filled().filter(Boolean).length;
        steps.textContent = n === 3 ? "3つとも入りました。保存すると、紹介診断・早見表に反映されます" : `3つの質問のうち ${n} つ入っています(約1分)`;
        topicCount.textContent = topics.length ? `${topics.length}個えらんでいます。主な仕事を先に選ぶと、カードの先頭に出ます` : "あてはまるものをいくつでも";
      }
      count();

      const saveBtn = App.btn("保存する", async () => {
        saveBtn.disabled = true;
        const res = await App.api("updateMyProfile", { profile: { faceAreas: [...areas], online: online || "unknown", wants: wants.value.trim(), topics } });
        saveBtn.disabled = false;
        if (!res) return;
        const i = App.members.findIndex((m) => m.id === s.memberId);
        if (i >= 0 && res.member) App.members[i] = res.member;
        saved = true;
        App.toast("プロフィールを保存しました");
        close();
        if (App.current && (App.current.view === "home" || App.current.view === "log")) App.route();
      }, "primary wide");

      body.append(
        h("p", { class: "app-lead" }, "紹介する側がいちばん知りたい3つです。ほかの項目(事業内容・紹介特典など)は、あとでプロフィールの画面から入れられます。"),
        steps,
        h("div", { class: "app-form" },
        App.field("1. どこで会えますか?", h("div", null, areaRow, h("div", { class: "qp-online" }, h("span", { class: "app-field-hint" }, "遠方の方には"), onlineSel)), "紹介する人が「会える距離か」を判断するのに使います"),
        App.field("2. どんな人を紹介してほしいですか?", wants, "悩み・業種・状況で書くと、紹介する側が思い出しやすくなります"),
        App.field("3. どんな仕事ができますか?(ジャンル)", h("div", null, topicCount, groups)),
        saveBtn),
        h("p", { class: "qp-more" }, h("a", { href: "../profile/" }, "すべての項目を入れる(プロフィールの画面) ›")));
    }, {
      noFocus: true,
      confirmClose: () => !saved && snap() !== first,
      onClose: back,
    });
  };

  // ---------- はじめての方へ(ホーム) ----------
  // d: getHome の結果。終わったかどうかは、わかるものは自動で、わからないもの(ホーム画面)は押して印をつける
  App.welcomeCard = function (d) {
    const key = `btex5-welcome-${(App.session && App.session.memberId) || "guest"}`;
    if (local.get(`${key}-closed`) === "1") return null;
    // marks[id]: 1 = 自分で「済み」にした / 0 = 自分で「まだ」に戻した(自動で済みと判断したものも、押して外せる)
    const marks = (() => { try { return JSON.parse(local.get(key) || "{}"); } catch { return {}; } })();
    const s = d.stats || {};
    const steps = [
      { id: "password", label: "あなた専用のパスワードを決める", href: "#me/password", auto: !!(d.me && d.me.hasPassword) },
      // 紹介に効く3項目が空いていれば、まず「かんたんプロフィール」(その場で開く)
      Object.assign({ id: "profile", label: "プロフィールを入れる(紹介されやすくなります)", href: "../profile/", auto: !(d.missing || []).length },
        (d.missing || []).some((x) => App.QUICK_PROFILE_LABELS.includes(x)) ? { label: "プロフィールの3つの質問に答える(約1分)", href: "#me/quick", open: () => App.quickProfileSheet() } : {}),
      { id: "notify", label: window.matchMedia("(pointer: coarse)").matches ? "スマホに通知を受け取る" : "通知を受け取る", href: "#me/notify", auto: false },
      { id: "home", label: window.matchMedia("(pointer: coarse)").matches ? "スマホのホーム画面に追加する" : "スマホのホーム画面にも追加する(スマホで開いたとき)", href: "#me/install", auto: standalone() },
      { id: "pitch", label: "プレゼンの原稿を書いておく", href: "#me/pitch", auto: false },
      { id: "one", label: "はじめての 1on1 を予定する", href: "#log/1on1?new", auto: (s.oneOnOnes || 0) > 0 },
      { id: "ref", label: "はじめての紹介を記録する", href: "#log/ref?new", auto: (s.givenAll || 0) > 0 },
    ];
    const isDone = (x) => marks[x.id] === 1 || (marks[x.id] !== 0 && x.auto);
    if (steps.every(isDone)) { local.set(`${key}-closed`, "1"); return null; }
    const save = () => local.set(key, JSON.stringify(marks));
    const close = () => { local.set(`${key}-closed`, "1"); box.remove(); App.toast("「マイページ → 使い方」からいつでも見られます"); };
    const box = h("section", { class: "app-section home-sec home-welcome", "data-home": "welcome" });
    function draw() {
      const n = steps.filter(isDone).length;
      const all = n === steps.length;
      App.fill(box,
        h("div", { class: "home-sec-head" },
          h("h2", { class: "app-h2" }, "はじめての方へ"),
          h("button", { type: "button", class: "home-sec-link", onclick: close }, "閉じる")),
        h("p", { class: "home-welcome-lead" }, all ? "7つすべて終わりました。おつかれさまでした。" : `BT-EX5 を使いこなす7つのステップ。いま ${n} / ${steps.length}(左の丸を押すと、済み・まだを切りかえられます)`),
        h("span", { class: "home-goal-bar home-welcome-bar", "aria-hidden": "true" }, h("i", { style: `width:${Math.round((n / steps.length) * 100)}%` })),
        h("ol", { class: "home-welcome-list" }, steps.map((x) => {
          const done = isDone(x);
          return h("li", { class: done ? "is-done" : "" },
            // 丸: 押すと「済み」と「まだ」を切りかえる(まちがえて押したときも戻せる)
            h("button", { type: "button", class: "home-welcome-check", role: "checkbox", "aria-checked": done ? "true" : "false", "aria-label": `${x.label}(${done ? "済み" : "まだ"})`,
              onclick: () => { marks[x.id] = done ? 0 : 1; save(); draw(); } }, done ? "✓" : ""),
            // 文: 押すと、その画面へ
            h("a", { href: x.href, onclick: x.open ? (e) => { e.preventDefault(); x.open(); } : null }, h("span", null, x.label), done ? h("small", null, "済み") : h("small", { class: "is-go" }, "開く ›")));
        })),
        all ? h("div", { class: "app-btn-row" }, App.btn("このお知らせを閉じる", close, "primary small")) : null);
    }
    draw();
    // 自動でわかるもの(通知・プレゼン)はあとから確かめる
    if (typeof BtexPush !== "undefined" && typeof AuthApi !== "undefined" && AuthApi.isShared && AuthApi.isShared()) {
      BtexPush.status().then((st) => { if (st.on) { steps[2].auto = true; draw(); } }).catch(() => {});
    }
    App.api("getMySettings", {}, { quiet: true }).then((st) => { if (st && st.pitchScript) { steps[4].auto = true; draw(); } }).catch(() => {});
    return box;
  };

  // ---------- 使い方とよくある質問 ----------
  const FAQ = [
    ["はじめに", [
      ["BT-EX5 アプリでできること", "紹介の記録とお礼(ありがとうマイル)、1on1 の予定と記録、定例会の出欠と出席コード、ビジターの招待、掲示板、運営連絡、紹介先早見表(相談から紹介先を探す)をひとつにまとめています。「予定」のいちばん上に、今日やることが出ます。あなたの数字は「記録」→「分析」に出ます。"],
      ["「記録」→「分析」の「BT-EX5 シグナル」とは", "直近6か月のあなたの活動(出席・1on1・紹介・紹介から生まれた売上・ビジター招待)を100点で見た信号です。70点から緑・50点から黄・30点から赤です。あなたにだけ表示され、ほかのメンバーには見えません。"],
      ["スマホのホーム画面に入れるには", "iPhone は Safari の共有ボタン(□に↑)→「ホーム画面に追加」、Android は Chrome のメニュー(︙)→「ホーム画面に追加」。アプリのようにすぐ開けて、通知も受け取れます。"],
    ]],
    ["紹介とお礼", [
      ["紹介を記録するには", "下のメニューの「記録」→「紹介」→「＋ 紹介を記録」。紹介先・紹介した方・相談の内容を入れると相手に届きます。早見表や相談アシスタントの結果から「紹介を記録」を押すと、入力が少なくてすみます。"],
      ["紹介の状況(連絡済み・商談中・成約)は誰が変えるの", "紹介を受けた人が変えます。成約したら「成約 → お礼」で金額を記録すると、紹介してくれた人のありがとうマイルになります。"],
      ["ありがとうマイルとは", "紹介で決まった仕事の金額を、紹介してくれた人へのお礼として記録するものです(1円 = 1マイル)。金額は1件1億円までです。"],
    ]],
    ["定例会と1on1", [
      ["出席の記録のしかた", "定例会の当日、会場で運営が見せる4桁の出席コードを「予定」の画面に入れます。オンラインの回は、Google Meet の参加記録から自動でつく場合もあります。"],
      ["プレゼンの練習と進行", "マイページ →「プレゼンの練習・タイマー」で原稿を書いて時間を計れます。定例会では「プレゼンを順番に進行する」で、出席者の名前と残り時間を全画面に出せます。"],
      ["1on1 を予定するには", "「記録」→「1on1」→「＋ 1on1 を予定・記録する」。Google カレンダーに予定と Meet の招待を入れることもできます。ホームの「1on1 のおすすめ」からも始められます。"],
    ]],
    ["見える範囲(プライバシー)", [
      ["ほかのメンバーに見えるもの", "名前・会社・事業内容・求める紹介などのプロフィール、掲示板の投稿、ランキングの数字です。電話番号・メールアドレス・住所・誕生日は表示しません。"],
      ["あなたにしか見えないもの", "1on1 のメモ・次にやること、「自分だけ」のやること、プレゼンの原稿、今月の目標、BT-EX5 シグナル、Google カレンダー用のメールアドレス。"],
      ["紹介の連絡先は誰に見えるの", "紹介を記録した人と、紹介を受けた人の2人だけです。"],
    ]],
    ["困ったとき", [
      ["パスワードを忘れた", "運営者に「パスワードの再設定」をお願いしてください。再設定のコードが届いたら、ログイン画面の「招待コード・再設定コードをお持ちの方」から新しいパスワードを決められます。"],
      ["「いまサーバーにつながりません」と出る", "電波の弱い場所や、サーバーが混んでいるときに出ます。ログインはそのままなので、少し待ってから「もう一度読み込む」を押してください。"],
      ["通知が届かない", "マイページ →「通知を受け取る」で、オンになっているか、種類が切られていないかを確かめてください。iPhone はホーム画面に追加した BT-EX5 から設定したときだけ届きます。"],
      ["文字が小さくて読みにくい", "画面の右上の「ぁ|あ」で「あ」を押すと、この端末のすべての画面の文字が大きくなります。「ぁ」で元の大きさに戻ります。"],
    ]],
  ];
  App.views.help = {
    title: "使い方",
    tab: "",
    async render(el) {
      el.append(h("h1", { class: "app-h1" }, "使い方・よくある質問"),
        h("p", { class: "app-lead" }, "わからないことがあれば、まずここを見てください。解決しないときは、いちばん下から運営に送れます。"));
      FAQ.forEach(([sec, items]) => {
        el.append(h("section", { class: "app-section help-sec" }, h("h2", { class: "app-h2" }, sec),
          items.map(([q, a]) => h("details", { class: "help-item" }, h("summary", null, q), h("p", null, a)))));
      });
      el.append(h("section", { class: "app-section help-contact" },
        h("h2", { class: "app-h2" }, "運営への問い合わせ"),
        h("p", null, "使いにくいところ・不具合・ほしい機能は、運営に直接送れます。返信はマイページの「バグ・要望を送る」で見られます。"),
        h("a", { class: "app-btn primary", href: "#me/feedback" }, "運営に送る")));
    },
  };
})();
