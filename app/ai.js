// ============================================
// app/ai.js — AI との連携(#ai)
// 自分の ChatGPT・Claude・Gemini に BT-EX5 をつなぐ手順と、MCP サーバーの URL。
// MCP サーバー(インターネット版)は mcp/worker(Cloudflare Workers)。公開したら、下の MCP_URL に入れる。
// ============================================
(function () {
  "use strict";
  const h = App.h;
  // 公開した MCP サーバーの URL(https://…/mcp)。空のあいだは「準備中」と出す
  const MCP_URL = "";
  // BT-EX 全体(bt-ex.jp)の AI 連携(公式)
  const BTEX_JP_MCP = "https://bt-ex.jp/mcp";

  const steps = (list) => h("ol", { class: "ai-steps" }, list.map((x) => h("li", null, x)));
  const card = (title, sub, body) => h("section", { class: "ai-card" }, h("h2", { class: "ai-card-title" }, title), sub ? h("p", { class: "ai-card-sub" }, sub) : null, ...body);
  const urlBox = (url, label) => h("div", { class: "ai-url" },
    h("p", { class: "ai-url-label" }, label || "MCP サーバーの URL"),
    h("div", { class: "ai-url-row" },
      h("input", { type: "text", readonly: true, value: url, "aria-label": label || "MCP サーバーの URL", onclick: (e) => e.currentTarget.select() }),
      App.btn("コピー", () => App.copyText(url, "URL をコピーしました"), "ghost small")));

  App.views.ai = {
    title: "AI との連携",
    tab: "",
    async render(el) {
      const ready = !!MCP_URL;
      el.append(
        h("h1", { class: "app-h1" }, "AI との連携"),
        h("p", { class: "app-lead" }, "自分の ChatGPT・Claude・Gemini に BT-EX5 をつなぐと、AI との会話から定例会の予定や自分の記録を調べたり、1on1・ありがとうマイル・リファーラルを登録したりできます。"),
        ready ? urlBox(MCP_URL) : h("p", { class: "ai-pending" }, "いまは準備中です。運営が公開すると、ここに MCP サーバーの URL が出ます。"),

        card("つなぎ方(ChatGPT)", "", [
          steps([
            "ChatGPT の「設定」→「アプリとコネクター」→「高度な設定」で「開発者モード」をオンにします。",
            "「アプリとコネクター」の「作成」を押し、名前に「BT-EX5」、MCP サーバーの URL に上の URL を入れ、認証は「OAuth」を選んで作成します。",
            "BT-EX5 のログイン画面が開くので、お名前とパスワードを入れて「許可する」を押します。",
            "会話の入力欄の「+」から BT-EX5 を選ぶと使えます。",
          ]),
        ]),
        card("つなぎ方(Claude)", "", [
          steps([
            "Claude(claude.ai)の「設定」→「コネクタ」で「カスタムコネクタを追加」を押します。",
            "名前に「BT-EX5」、URL に上の URL を入れて「追加」を押します。",
            "BT-EX5 の「連携する」を押すと BT-EX5 のログイン画面が開くので、お名前とパスワードを入れて「許可する」を押します。",
            "会話の入力欄の「+」(検索とツール)で BT-EX5 をオンにすると使えます。スマホの Claude アプリでも、同じアカウントならそのまま使えます。",
          ]),
          h("p", { class: "ai-note" }, "パソコンの Claude Desktop・Claude Code でも、同じ URL を「カスタムコネクタ」に入れればつながります。"),
        ]),
        card("つなぎ方(Gemini)", "", [
          steps([
            "Gemini(gemini.google.com)の「設定」→「接続済みアプリ」で「カスタムアプリを追加」を押します(パソコンのブラウザで行います)。",
            "名前に「BT-EX5」、MCP サーバーの URL に上の URL を入れて追加します。",
            "BT-EX5 のログイン画面が開くので、お名前とパスワードを入れて「許可する」を押します。",
            "会話で「@BT-EX5」と入れるか、BT-EX5 を選ぶと使えます。",
          ]),
          h("p", { class: "ai-note" }, "Gemini のカスタムアプリは、プランや地域によってまだ出ないことがあります。そのときは、パソコンの Gemini CLI で「gemini mcp add --transport http btex5 (上の URL)」と入れてもつながります。"),
        ]),
        h("p", { class: "ai-note" }, "ChatGPT・Claude・Gemini の画面の名前や場所は、それぞれの更新で変わることがあります。カスタムのコネクター(アプリ)は、プランによっては使えないことがあります。"),

        card("こんなふうに使えます", "", [
          h("ul", { class: "ai-examples" },
            ["次の定例会はいつ? 出席で答えておいて", "今月、私がした紹介と、もらったありがとうマイルを一覧にして", "大場さんに「A社の田中さん」を紹介したので、リファーラルを登録して", "吉原さんの紹介で決まった仕事のお礼に、ありがとうマイル 3万円を送って", "来週水曜の10時に、栁橋さんと Google Meet で 1on1 を入れて", "保険の仕事をしているメンバーはだれ?"]
              .map((t) => h("li", null, `「${t}」`))),
        ]),
        card("安心して使うために", "", [
          h("ul", { class: "ai-points" },
            h("li", null, "パスワードは、BT-EX5 のログイン画面に入れるだけで、AI には伝わりません。"),
            h("li", null, "登録・出欠など書きこむときは、AI が先に「この内容で登録します」と下見を見せます。あなたが OK と言ったときだけ登録します。"),
            h("li", null, "AI が使えるのは、あなたがアプリで見られる範囲・できる操作だけです。紹介した相手の連絡先は、AI には渡しません。"),
            h("li", null, "つないでから30日たつと、もう一度ログインを求められます。やめたいときは、その AI のアプリでコネクター(アプリ)を外してください。")),
        ]),
        card("bt-ex.jp の AI 連携と一緒に使う", "", [
          h("p", null, "BT-EX 全体のサイト(bt-ex.jp)の AI 連携も同じ AI につなぐと、2つをまとめて扱えます。たとえば「BT-EX5 に記録した紹介で、bt-ex.jp にまだ入れていないものを bt-ex.jp にも登録して」と頼むと、AI が両方を見て登録し、BT-EX5 側に「bt-ex.jp に登録ずみ」の印を付けます。"),
          urlBox(BTEX_JP_MCP, "bt-ex.jp の MCP サーバーの URL"),
        ]),
      );
    },
  };
})();
