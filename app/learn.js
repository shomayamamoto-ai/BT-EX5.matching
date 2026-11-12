// ============================================
// app/learn.js — AI を学ぶ(#learn)
// 仕事で AI を使いはじめるための6つのレッスン・伝え方(プロンプト)の型・ミニテスト・話題の AI ワザ・用語集。
// メンバー全員が見られる。「読んだ」の印はこの端末に覚える(人ごと)。
// 「話題の AI ワザ」は運営(山本 捷真)が共有した SNS の投稿・記事の内容(2026年11月)。名前や画面は変わることがあるので、
// 使う前に各社の公式の案内で確かめるよう添える
// ============================================
(function () {
  "use strict";
  const { h } = App;
  const store = {
    key: () => `btex5-learn-${(App.session && App.session.memberId) || "guest"}`,
    get() { try { return JSON.parse(localStorage.getItem(this.key()) || "{}") || {}; } catch { return {}; } },
    set(v) { try { localStorage.setItem(this.key(), JSON.stringify(v)); } catch { /* noop */ } },
  };

  const ul = (items) => h("ul", { class: "lr-list" }, items.map((x) => h("li", null, x)));
  const p = (t) => h("p", null, t);

  // ---------- 伝え方(プロンプト)の型 ----------
  const PROMPT_TEMPLATE = [
    "あなたは〇〇(例: 中小企業向けのマーケティングの専門家)です。",
    "【目的】〇〇のために、〇〇を作ってください。",
    "【材料】(ここに文章・メモ・数字などを貼る)",
    "【条件】読む人は〇〇。〇〇字くらい。専門用語は使わない。",
    "【形式】見出しと箇条書きで。最後に次にやることを3つ。",
    "わからない点があれば、作る前に質問してください。",
  ].join("\n");
  const PROMPT_EXAMPLES = [
    ["会議のメモをまとめる", "次の会議メモを、①決まったこと ②だれが・いつまでに何をするか ③持ち越しの3つに分けて、箇条書きでまとめてください。\n(ここにメモを貼る)"],
    ["お礼・営業のメールを書く", "交流会で名刺交換した〇〇業の社長に送る、お礼のメールを書いてください。売り込みはせず、次に30分お話しできる日を2つ提案する文にしてください。200字くらい、ていねいすぎない言い方で。"],
    ["SNS の投稿を考える", "〇〇(自分の商品・サービス)を、〇〇に悩んでいる人に向けて紹介する Instagram の投稿文を3案ください。1案ごとに、最初の1行で手を止めてもらえるようにしてください。"],
    ["比べて選ぶ", "〇〇と〇〇を、費用・手間・向いている会社の3つで比べる表を作ってください。わからないところは「要確認」と書き、推測で埋めないでください。"],
    ["定例会のプレゼン原稿", "BT-EX5 の定例会で話す1分のプレゼン原稿を作ってください。仕事の内容、どんな人を紹介してほしいか(具体的に1人の姿が浮かぶように)、ひとことの決めぜりふの順で。\n(ここに自分の事業の説明を貼る)"],
  ];

  // ---------- 6つのレッスン ----------
  const LESSONS = [
    {
      id: "basics", icon: "💡", title: "AI でできること・できないこと", time: "3分",
      body: () => [
        p("いま広く使われている AI(生成 AI)は、たくさんの文章を学んで「次に来そうなことば」を組み立てるしくみです。ことばを扱う仕事がとても得意です。"),
        h("div", { class: "lr-two" },
          h("div", { class: "lr-box is-good" }, h("b", null, "得意なこと"), ul(["文章を書く・直す・短くする", "長い資料の要約", "アイデアをたくさん出す", "表・箇条書きに整理する", "翻訳・言いかえ", "画像や資料の下書き"])),
          h("div", { class: "lr-box is-warn" }, h("b", null, "苦手なこと・注意"), ul(["もっともらしい間違いを言うことがある(ハルシネーション)", "正確な計算・数字", "検索をしない設定では、最新の出来事を知らない", "あなたの会社の事情は、教えないとわからない"]))),
        p("コツは「優秀だけど、あなたの会社に来たばかりの新人」だと思って頼むこと。背景を伝え、できあがりは必ず人が確かめます。"),
      ],
    },
    {
      id: "tools", icon: "🧭", title: "おもな AI の選び方", time: "3分",
      body: () => [
        p("代表的なのは次の3つです。どれも無料で試せます(くわしい機能や料金は各社の案内で確かめてください)。"),
        h("div", { class: "lr-tools" },
          [["ChatGPT", "OpenAI", "いちばん利用者が多い。画像づくりや音声の会話も"], ["Claude", "Anthropic", "長い文章を読む・書くのが得意。資料づくりやプログラムにも"], ["Gemini", "Google", "Gmail・ドキュメント・スプレッドシートなど Google のサービスと一緒に使える"]]
            .map(([n, c, d]) => h("div", { class: "lr-tool" }, h("b", null, n), h("small", null, c), h("span", null, d)))),
        p("同じ会社の AI にも、賢くてじっくり考える大きいモデルと、速くて軽いモデルがあります。ふだんは標準のモデル、むずかしい仕事のときだけ大きいモデル、という使い分けがおすすめです。"),
        p("まずは1つを決めて、毎日なにか1つ頼んでみるのがいちばんの近道です。"),
      ],
    },
    {
      id: "prompt", icon: "✍️", title: "伝え方(プロンプト)の型", time: "5分",
      body: () => [
        p("AI に頼む文を「プロンプト」といいます。人に仕事を頼むときと同じで、5つを伝えるだけで答えが見ちがえます。"),
        h("ol", { class: "lr-steps" },
          [["役割", "だれとして答えてほしいか"], ["目的", "何のために使うか"], ["材料", "元になる文章・メモ・数字"], ["条件", "読む人・長さ・言い方"], ["形式", "箇条書き・表・見出しなど"]]
            .map(([k, d]) => h("li", null, h("b", null, k), `: ${d}`))),
        h("div", { class: "lr-code" },
          h("pre", null, PROMPT_TEMPLATE),
          App.btn("型をコピー", () => App.copyText(PROMPT_TEMPLATE, "プロンプトの型をコピーしました"), "ghost small")),
        p("一度で完ぺきを目指さなくて大丈夫です。「もっと短く」「〇〇向けに」「別の案を3つ」と、会話で直していくのが上手な使い方です。"),
        h("h3", { class: "lr-h3" }, "そのまま使える例"),
        h("div", { class: "lr-examples" }, PROMPT_EXAMPLES.map(([t, body]) =>
          h("details", { class: "help-item" }, h("summary", null, t),
            h("div", { class: "lr-code" }, h("pre", null, body), App.btn("コピー", () => App.copyText(body, "コピーしました"), "ghost small"))))),
      ],
    },
    {
      id: "work", icon: "💼", title: "仕事で使う例", time: "4分",
      body: () => [
        h("div", { class: "lr-grid" },
          [
            ["文章", "メール・お礼状・提案書の下書き、言いまわしの見直し"],
            ["資料", "スライドの構成、チラシの文、プレゼン原稿"],
            ["表計算", "関数の作り方を聞く、データの集計・グラフの案"],
            ["調べもの", "業界の基本を教わる、比較表を作る(出典は自分で確かめる)"],
            ["お客さま対応", "よくある質問の回答案、クレームへの返信の下書き"],
            ["採用・教育", "求人票の文、マニュアル・研修資料のたたき台"],
          ].map(([k, d]) => h("div", { class: "lr-cell" }, h("b", null, k), h("span", null, d)))),
        p("「毎週やっている」「時間がかかる」「毎回にたような文を書く」仕事から始めると、効果がわかりやすいです。"),
      ],
    },
    {
      id: "agent", icon: "🤖", title: "一歩進んだ使い方(エージェント・連携)", time: "4分",
      body: () => [
        p("最近の AI は、会話で答えるだけでなく、パソコンの中のファイルを読み書きしたり、ほかのアプリを動かしたりして、仕事を最後まで進められるようになってきました。これを「エージェント」と呼びます。"),
        ul([
          "Claude Code(Anthropic)・Codex(OpenAI)・Antigravity(Google)などが代表的なエージェントです。",
          "「コネクター」「MCP」は、AI とほかのサービス(Gmail・カレンダー・Slack・Notion など)をつなぐしくみです。",
          "「スキル」は作業の手順をまとめたもの、「プラグイン」はスキルとつなぎ先をひとまとめにした追加機能です。",
        ]),
        p("はじめは「読むだけ」の連携から試し、送信・削除など取り消せない操作は、AI に任せる前に自分で確かめる設定にしておくと安心です。"),
        App.canAi && App.canAi() ? h("a", { class: "app-btn ghost", href: "#ai" }, "BT-EX5 と AI をつなぐ") : null,
      ],
    },
    {
      id: "safety", icon: "🔒", title: "安全に使う(セキュリティ)", time: "4分",
      body: () => [
        h("div", { class: "lr-box is-warn" }, h("b", null, "入れてはいけない情報"),
          ul(["お客さま・メンバーの個人情報(電話番号・住所・メールアドレスなど)", "パスワード・API キー・カードの番号", "公開前の契約・見積・社外秘の資料"])),
        ul([
          "仕事で使うときは、設定で「入力した内容を AI の学習に使わない」になっているか確かめましょう(会社向けのプランは、はじめから使わない設定のものが多いです)。",
          "AI の答えは、数字・固有名詞・法律や税金の話を特に確かめてから使います。",
          "画像や文章をそのまま公開するときは、ほかの人の作品・写真・名前に似ていないか気をつけます。",
          "知らない人から届いた文書やサイトに「AI への指示」がまぎれていることがあります。AI に読ませる資料の出どころにも注意しましょう。",
          "会社で使うなら、使ってよい AI・入れてよい情報を、かんたんなルールにしてみんなで共有しましょう。",
        ]),
      ],
    },
  ];

  // ---------- ミニテスト ----------
  const QUIZ = [
    { q: "AI がもっともらしい間違いを答えることを何という?", a: ["ハルシネーション", "プロンプト", "エージェント"], ok: 0, why: "AI は自信がありそうに間違えることがあります。数字や固有名詞は必ず確かめましょう。" },
    { q: "AI に入れてもよいのはどれ?", a: ["お客さまの電話番号つきの名簿", "自社の公開しているサービス紹介文", "社内システムのパスワード"], ok: 1, why: "公開している情報なら安心です。個人情報やパスワードは入れません。" },
    { q: "プロンプトの型「役割・目的・材料・条件・〇〇」。〇〇は?", a: ["形式", "金額", "日付"], ok: 0, why: "箇条書き・表・見出しなど、ほしい形を伝えると、そのまま使える答えになります。" },
    { q: "答えがいまいちのとき、いちばんよいのは?", a: ["あきらめて自分で書く", "「もっと短く」「〇〇向けに」と会話で直す", "同じ文をもう一度送る"], ok: 1, why: "会話を続けて直していくのが AI の上手な使い方です。" },
    { q: "ほかのアプリを動かして仕事を最後まで進める AI を何という?", a: ["チャットボット", "エージェント", "検索エンジン"], ok: 1, why: "Claude Code・Codex・Antigravity などがエージェントの代表です。" },
  ];

  // ---------- 話題の AI ワザ(運営が共有した SNS の投稿・記事より) ----------
  const TIPS = [
    {
      tag: "Claude", title: "いちばん賢いモデルを、本気のときだけ呼ぶ(/advisor fable)",
      body: () => [
        p("Claude Code で「/advisor fable」と入れると、ふだんは Opus 5.5 のまま、むずかしい仕事のときだけ最上位の Fable 5.2 が助言してくれる、という使い方が紹介されていました。"),
        p("賢いモデルはそのぶん時間や利用枠を多く使うので、「ふだんは標準、ここぞというときだけ最上位」という考え方は、どの AI でも役に立ちます。"),
      ],
    },
    {
      tag: "Codex", title: "Codex のプラグイン(スキル+アプリ連携)",
      body: () => [
        p("Codex は OpenAI の AI エージェントで、チャットで頼むと、パソコンの中でファイルを読み書きしながら作業を進めます。プラグインは、作業の手順(スキル)と外のアプリとの接続(MCP サーバー)をひとまとめにした追加機能です。"),
        p("記事では、試した24個のプラグインを6つに分けていました。"),
        h("div", { class: "lr-grid" },
          [
            ["資料・データを作る", "Spreadsheets・Presentations・Data Analytics・Documents"],
            ["仕事のアプリ連携", "Slack・Notion・Gmail・Google Calendar・Google Drive"],
            ["画面操作・開発", "Computer Use・Product Design・Build macOS Apps・Build Web Apps・Codex Security・OpenAI Developers・Game Studio"],
            ["デザイン・サイト", "Figma・Canva・Wix"],
            ["サイトを公開する", "Vercel・Netlify"],
            ["動画・画像を作る", "Remotion・HyperFrames・fal"],
          ].map(([k, d]) => h("div", { class: "lr-cell" }, h("b", null, k), h("span", null, d)))),
        h("h3", { class: "lr-h3" }, "試してわかった、入れる順番の目安(記事の筆者が2026年6月に試した感想)"),
        h("div", { class: "lr-order" },
          [
            ["まず入れたい", "頼んだ結果が、そのまま使える形で返ってきた", "Spreadsheets・Data Analytics・Documents・Slack・Notion・Gmail・Google Calendar", "is-first"],
            ["たたき台として使う", "形はできるが、デザインは手直しかスキルでの工夫がいる", "Presentations・Product Design・Canva・Remotion", ""],
            ["使いどころを選ぶ", "時間がかかる、または専門の知識があったほうが安心", "Computer Use・Build macOS Apps・OpenAI Developers", ""],
          ].map(([k, d, list, cls]) => h("div", { class: `lr-order-row ${cls}` }, h("b", null, k), h("span", null, d), h("small", null, list)))),
        h("h3", { class: "lr-h3" }, "頼んだことと、できたもの(記事の例)"),
        h("div", { class: "lr-table" },
          [
            ["Spreadsheets", "売上の CSV を月別・商品別に集計して Excel にまとめて", "集計ずみの Excel ファイル"],
            ["Presentations", "生成 AI セミナーの資料を20枚、演習スライドも入れて", "20枚の PowerPoint(デザインは手直しが必要)"],
            ["Data Analytics", "売上データを分析し、伸びた要因と落ちた要因を分けて", "グラフつきのレポート(PDF で保存できる)"],
            ["Documents", "メモを社内マニュアルにして、手順・注意点・FAQ に分けて", "整った Word ファイル"],
            ["Slack", "1週間分のチャンネルの内容を要約して投稿", "Slack にまとめが送られた"],
            ["Notion", "会議メモを決定事項と宿題に分けて整理", "Notion にページができた"],
            ["Gmail", "今日届いたメールから、返信が必要なものを優先度順に", "返信不要のメールまで仕分けた一覧"],
            ["Google Calendar", "来週60分の打ち合わせ候補を3つ、午前を優先して", "空き時間の候補3つ(押さえる予定の登録も頼める)"],
            ["Google Drive", "生成 AI セミナーの資料を探して候補を一覧に", "過去の資料の一覧"],
            ["Computer Use", "このサイトの表示崩れとボタン操作を確認して", "見つかった問題の一覧(ただしかなり時間がかかる)"],
          ].map(([k, ask, got]) => h("div", { class: "lr-tr" }, h("b", null, k), h("span", null, `「${ask}」`), h("em", null, `→ ${got}`)))),
        h("h3", { class: "lr-h3" }, "組み合わせると、毎朝のメール確認も任せられる"),
        h("ol", { class: "lr-steps" },
          [["Gmail", "返信が必要なメールを拾い、優先度の高い順に並べる"], ["Spreadsheets", "優先度を整理した表を作って残す"], ["Slack", "まとめを Slack に通知する"], ["スケジュールタスク", "決まった時刻に、Codex が同じ作業をくり返す"]]
            .map(([k, d]) => h("li", null, h("b", null, k), `: ${d}`))),
        p("資料づくりを任せるときは、いきなり完成のスライドを頼むより「構成 → 見出し → 図解 → 仕上げ」の順に頼むと、中身の濃い資料になりやすい、とも紹介されていました。"),
        p("全部を一度に入れる必要はありません。いつもの仕事に近いものから1つずつ試すのがおすすめです。"),
      ],
    },
    {
      tag: "Gemini", title: "Gemini でもエージェントの仕事ができる(Antigravity)",
      body: () => [
        p("Mac の Gemini アプリの右上にある「Antigravity」から使うと、Web 版とはスライドの出来がまったく違う、と紹介されていました。"),
        p("請求書の発行からメールの送信、スプレッドシートでのガントチャート(工程表)づくりまで任せられるそうです。"),
      ],
    },
    {
      tag: "連携", title: "Muse から Claude Code・Codex を動かす(Tailscale)",
      body: () => [
        p("Tailscale を使うと、Muse のクラウドのコンピューターから自分の Mac のターミナルを使えるようになり、そこから Claude Code や Codex を呼び出せる、という方法が紹介されていました。"),
        p("自分のパソコンを外から操作できるようにする方法なので、試すときは、つなぐ機器と権限をしぼって安全に使いましょう。"),
      ],
    },
    {
      tag: "デザイン", title: "UI/UX デザインの参考になるサイト5つ",
      body: () => [
        h("ul", { class: "lr-links" },
          [
            ["https://scrolltide.co", "scrolltide.co", "3D やスクロールで動く Web 向けの、デザイン用プロンプトとコンポーネント(コードつき)"],
            ["https://scrollshaders.com", "scrollshaders.com", "いろいろなスタイルのアニメーションの背景(シェーダー)"],
            ["https://footer.design", "footer.design", "サイトのいちばん下(フッター)のデザイン集"],
            ["https://cta.gallery", "cta.gallery", "「申し込む」などのボタンまわり(CTA)の参考集"],
            ["https://styles.refero.design", "styles.refero.design", "実際のサービスのデザインのスタイル集"],
          ].map(([u, n, d]) => h("li", null, h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, n), h("span", null, d)))),
        p("AI にサイトを作ってもらうとき、「このサイトのような雰囲気で」と参考を見せると、イメージどおりに仕上がりやすくなります。"),
      ],
    },
  ];

  // ---------- 用語集 ----------
  const GLOSSARY = [
    ["生成 AI", "文章・画像・音声などを新しく作り出す AI。ChatGPT・Claude・Gemini など。"],
    ["モデル", "AI の頭脳にあたる部分。同じ会社でも、賢さ・速さのちがう何種類かがあります。"],
    ["プロンプト", "AI への頼みごとの文。伝え方しだいで答えが大きく変わります。"],
    ["ハルシネーション", "AI がもっともらしい間違いを答えること。"],
    ["エージェント", "ファイルを読み書きしたり、アプリを動かしたりして、仕事を最後まで進める AI。"],
    ["コネクター・MCP", "AI をほかのサービス(メール・カレンダー・社内システムなど)につなぐしくみ。MCP はその共通の決まりごと。"],
    ["スキル・プラグイン", "スキルは作業の手順をまとめたもの。プラグインはスキルとつなぎ先をひとまとめにした追加機能。"],
    ["トークン", "AI が文章を数える単位。料金や、一度に読める長さの目安になります。"],
  ];

  function lessonCard(l, state, redraw) {
    const done = !!state[l.id];
    const d = h("details", { class: `lr-lesson${done ? " is-done" : ""}`, id: `lr-${l.id}` },
      h("summary", null,
        h("span", { class: "lr-lesson-icon", "aria-hidden": "true" }, l.icon),
        h("span", { class: "lr-lesson-title" }, l.title, h("small", null, done ? "✓ 読みました" : `読む時間 ${l.time}`))),
      h("div", { class: "lr-lesson-body" }, ...l.body(),
        h("div", { class: "app-btn-row" },
          App.btn(done ? "「読んだ」を取り消す" : "✓ 読んだ", () => {
            const s = store.get();
            if (s[l.id]) delete s[l.id]; else s[l.id] = Date.now();
            store.set(s);
            if (!s[l.id]) { redraw(l.id); return; }
            const next = LESSONS[LESSONS.indexOf(l) + 1];
            if (!next) App.toast("6つのレッスンをすべて読みました。最後にミニテストで確かめましょう");
            redraw(next ? next.id : "");
          }, done ? "ghost small" : "primary"))));
    return d;
  }

  function quizBox() {
    let right = 0, answered = 0;
    const score = h("p", { class: "lr-score", "aria-live": "polite" });
    const box = h("div", { class: "lr-quiz" });
    QUIZ.forEach((x, i) => {
      const why = h("p", { class: "lr-why", hidden: true });
      const btns = x.a.map((t, j) => h("button", {
        type: "button", class: "lr-choice",
        onclick: () => {
          if (btns[0].disabled) return;
          btns.forEach((b, k) => { b.disabled = true; if (k === x.ok) b.classList.add("is-ok"); });
          if (j !== x.ok) btns[j].classList.add("is-ng");
          answered += 1; if (j === x.ok) right += 1;
          why.hidden = false;
          why.textContent = `${j === x.ok ? "○ 正解" : "× ざんねん"} — ${x.why}`;
          if (answered === QUIZ.length) score.textContent = `${QUIZ.length}問中 ${right}問 正解${right === QUIZ.length ? "! すばらしい 🎉" : "。レッスンを読み返してみましょう"}`;
        },
      }, t));
      box.append(h("div", { class: "lr-q" }, h("p", { class: "lr-q-text" }, `Q${i + 1}. ${x.q}`), h("div", { class: "lr-choices" }, btns), why));
    });
    box.append(score);
    return box;
  }

  App.views.learn = {
    title: "AI を学ぶ",
    tab: "",
    async render(el) {
      const lessonsWrap = h("div", { class: "lr-lessons" });
      const bar = h("div", { class: "lr-progress" });
      const redraw = (openId) => {
        const state = store.get();
        const n = LESSONS.filter((l) => state[l.id]).length;
        bar.replaceChildren(
          h("div", { class: "lr-progress-top" }, h("b", null, "あなたの進み具合"), h("span", null, `${n} / ${LESSONS.length} レッスン`)),
          h("div", { class: "lr-progress-track", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(LESSONS.length), "aria-valuenow": String(n), "aria-label": "読んだレッスンの数" },
            h("i", { style: `width:${(n / LESSONS.length) * 100}%` })));
        lessonsWrap.replaceChildren(...LESSONS.map((l) => lessonCard(l, state, redraw)));
        if (openId) {
          const d = lessonsWrap.querySelector(`#lr-${openId}`);
          if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); }
        }
      };
      redraw("");

      const coach = App.memberById && App.memberById("yamamoto");
      el.append(
        h("h1", { class: "app-h1" }, "AI を学ぶ"),
        h("p", { class: "app-lead" }, "仕事で AI を使いはじめるための、短いレッスン集です。1つ3〜5分。上から順に読み、「読んだ」を押すと進み具合がたまります(この端末に覚えます)。"),
        bar,
        h("section", { class: "app-section" }, h("h2", { class: "app-h2" }, "6つのレッスン"), lessonsWrap),
        h("section", { class: "app-section" },
          h("h2", { class: "app-h2" }, "ミニテスト(5問)"),
          h("p", { class: "app-lead" }, "選ぶとすぐに答えが出ます。"),
          quizBox()),
        h("section", { class: "app-section" },
          h("h2", { class: "app-h2" }, "話題の AI ワザ"),
          h("p", { class: "lr-note" }, "運営が見つけた SNS の投稿・記事から紹介します(2026年11月)。AI の名前や画面はよく変わるので、使う前に各社の公式の案内で確かめてください。"),
          h("div", { class: "lr-tips" }, TIPS.map((t) =>
            h("details", { class: "lr-tip" },
              h("summary", null, h("span", { class: "lr-tag" }, t.tag), h("span", null, t.title)),
              h("div", { class: "lr-lesson-body" }, ...t.body()))))),
        h("section", { class: "app-section" },
          h("h2", { class: "app-h2" }, "用語集"),
          GLOSSARY.map(([k, d]) => h("details", { class: "help-item" }, h("summary", null, k), h("p", null, d)))),
        h("section", { class: "app-section lr-ask" },
          h("h2", { class: "app-h2" }, "わからないときは"),
          h("p", null, "AI の使い方は、メンバー同士で教え合うのがいちばんの近道です。1on1 で「自分の仕事ならどう使える?」を聞いてみましょう。"),
          h("div", { class: "app-btn-row" },
            coach ? h("a", { class: "app-btn primary", href: App.profileHref(coach.id, "learn") }, `AI 講師のメンバーに聞く(${coach.name})`) : null,
            h("a", { class: "app-btn ghost", href: "#log/1on1" }, "1on1 を予定する"))));
    },
  };
})();
