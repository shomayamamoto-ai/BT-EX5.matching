# BT-EX5 会員サイトの MCP サーバー

2つの版があります。

- **インターネット版**(`worker/`、Cloudflare Workers): ChatGPT・Claude・Gemini のアプリに URL を入れるだけでつながります。
  つなぐときに BT-EX5 のログイン画面が開き、「許可する」でその AI が使えるようになります(OAuth)。会員サイトの「マイページ → AI との連携」に手順があります。
- **パソコン版**(`btex5-mcp.mjs`): ご自分のパソコンの Claude Desktop・Claude Code などで動かします(下の「設定のしかた」)。

道具の中身は2つとも同じ `core.mjs` です。

Claude などの AI から、BT-EX5 会員サイト(共有サーバー)の名簿・定例会・出欠を読んだり、
**bt-ex.jp の名簿・出席とくらべて、会員サイトに反映**したりできるようにするためのものです。

- 追加のインストールは不要です(Node.js 18 以上があれば動きます)。
- 動かすのは、ご自分のパソコンの AI のアプリ(Claude Desktop・Claude Code など)です。
- bt-ex.jp には、このサーバーからはつなぎません。bt-ex.jp のログイン情報も持ちません。
  bt-ex.jp の名簿・出席は、**AI がご本人のブラウザで開いた bt-ex.jp の画面**(または貼り付けた文)から読み取り、
  このサーバーの「くらべる」道具に渡します。

## できること(道具)

| 道具 | 内容 | 書きこみ |
|---|---|---|
| `btex5_whoami` | だれとしてログインしているか(管理者か) | なし |
| `btex5_list_members` | 会員サイトの名簿(お名前・フリガナ・チーム・業種・事業内容・求める紹介)。電話・メール・住所は返しません | なし |
| `btex5_list_events` | 定例会・特別会の一覧(日にち・時間・出欠の人数) | なし |
| `btex5_get_event` | 1回分の出欠の回答と、出席・遅刻の記録 | なし |
| `btex5_referral_stats` | 紹介・ありがとうマイルの集計 | なし |
| `btex5_compare_roster` | bt-ex.jp の名簿と会員サイトの名簿をくらべる(足りない人・業種のちがい) | なし |
| `btex5_add_members` | bt-ex.jp にいて会員サイトにいない方を名簿に足す(管理者) | `apply: true` のときだけ |
| `btex5_compare_attendance` | bt-ex.jp の出席と会員サイトの出席をくらべる | なし |
| `btex5_mark_attendance` | 会員サイトの定例会に出席・遅刻を付ける(管理者) | `apply: true` のときだけ |
| `btex5_list_referrals_for_btex` | 自分が記録した紹介・送ったありがとうマイルのうち、まだ bt-ex.jp に登録していないもの(紹介した相手の連絡先は返しません) | なし |
| `btex5_mark_btex_posted` | 紹介・ありがとうマイルの記録に「bt-ex.jp に登録ずみ」の印を付ける(自分の記録だけ) | `apply: true` のときだけ |

書きこむ道具は、はじめは「こうなります」という下見だけを返します。内容を確かめて OK と言ったときだけ、
AI が `apply: true` を付けて書きこみます。だれかを名簿から消す・出席を外すことはしません(運営が管理画面で)。

## 設定のしかた

ログインには、会員サイトと同じ **お名前** と **パスワード**(まだ決めていない方は共通パスコード)を使います。
名簿に足す・出席を付けるには、管理者のアカウントが必要です。
パスワードは、下の設定ファイル(ご自分のパソコンの中)だけに書き、リポジトリやチャットには書かないでください。

### Claude Desktop

設定 → 開発者 → 「構成を編集」で開く `claude_desktop_config.json` に足します
(`/path/to/` は、このリポジトリを置いた場所に読みかえてください)。

```json
{
  "mcpServers": {
    "btex5": {
      "command": "node",
      "args": ["/path/to/kouryukai.matching/mcp/btex5-mcp.mjs"],
      "env": {
        "BTEX5_NAME": "山本 捷真",
        "BTEX5_PASSWORD": "ここにご自分のパスワード"
      }
    }
  }
}
```

保存して Claude Desktop を開き直すと、道具の一覧に `btex5` が出ます。

### Claude Code

```sh
claude mcp add btex5 --scope user \
  -e BTEX5_NAME="山本 捷真" -e BTEX5_PASSWORD="ここにご自分のパスワード" \
  -- node /path/to/kouryukai.matching/mcp/btex5-mcp.mjs
```

## 使い方の例

bt-ex.jp は、**ご本人がふだんのブラウザでログインしたまま**、AI に画面を読ませます
(Claude in Chrome などのブラウザの拡張機能を使うか、bt-ex.jp の画面の文をコピーして貼り付けます)。

- 「bt-ex.jp の BT-EX5 のメンバー一覧を読んで、会員サイトの名簿とくらべて。足りない人がいたら下見を見せて」
- 「bt-ex.jp の 11月14日の出席を読んで、会員サイトの出席とくらべて。ちがうところに出席を付けて(先に下見)」
- 「会員サイトに記録した紹介で、まだ bt-ex.jp に入れていないものを、bt-ex.jp の入力画面に1件ずつ書き写して。送信の前に見せて」
  (AI が bt-ex.jp の画面に書き写し、山本さんが確かめて送信 → 送れたものに AI が「bt-ex.jp に登録ずみ」の印を付けます。
  次からは、まだ登録していないものだけが出るので、二重に入れることはありません)
- 「次の定例会に、まだ出欠を答えていない人はだれ?」
- 「保険の仕事の人を名簿から探して」

## 注意

- bt-ex.jp の画面を読むのは、ご本人がログインして見られる範囲だけです。bt-ex.jp の決まり(利用規約)と運営の方針に従ってください。
  自動で定期的に bt-ex.jp を読みに行く仕組みや、bt-ex.jp のパスワードを預かる仕組みは入れていません。
- 将来 bt-ex.jp の運営から API や書き出し(CSV など)をもらえたら、その形で自動の同期にできます。
- 共有サーバーの URL を変えたときは、`env` に `"BTEX5_API": "新しい URL"` を足します(ふだんは不要)。
- 動かないとき: `node --version` が 18 以上か、お名前・パスワードが会員サイトに入れるものかを確かめてください。
  パスワードを何度もまちがえると、しばらくログインできなくなります。

## インターネット版を公開する(運営・はじめの1回)

Cloudflare の無料のアカウントを作っておきます(https://dash.cloudflare.com/sign-up)。パソコンで:

```sh
cd mcp/worker
npm install
npx wrangler login                              # ブラウザで Cloudflare にログイン
npx wrangler kv namespace create OAUTH_KV       # 出てきた id を wrangler.jsonc の "ここに KV の id を入れる" と置きかえる
npx wrangler deploy                             # https://btex5-mcp.<あなたのサブドメイン>.workers.dev が出る
```

出てきた URL の後ろに `/mcp` を付けたもの(例: `https://btex5-mcp.example.workers.dev/mcp`)が、AI に入れる「MCP サーバーの URL」です。
これを `app/ai.js` の `MCP_URL` に入れると、会員サイトの「AI との連携」に出ます。

- 共有サーバーの URL を変えたときは `wrangler.jsonc` の `BTEX5_API` を直して、もう一度 `npx wrangler deploy`。
- ここに残るのは、AI ごとの許可(共有サーバーのログインの合いことば。暗号化して KV に保存)だけです。名簿や記録は共有サーバーにあります。
- 許可は30日で切れ、AI がもう一度 BT-EX5 のログイン画面を出します。
- 自分の独自ドメインで出したいときは、Cloudflare の画面で Workers にドメインを付け、`wrangler.jsonc` の `vars` に `"PUBLIC_URL": "https://そのドメイン"` を足します。

### ためし方(公開する前に、パソコンで)

```sh
cd mcp/worker
npx wrangler dev          # http://localhost:8787/mcp で動く(共有サーバーは本番につながる)
npx @modelcontextprotocol/inspector   # 画面で URL に http://localhost:8787/mcp を入れて「Connect」
```
