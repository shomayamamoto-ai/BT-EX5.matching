// ============================================
// BT-EX5 会員サイト — 共有サーバー(Google Apps Script)
// このファイルは tools/build-gas.mjs が自動で作ったものです。直接編集しないでください。
// 元のファイル: referral/data.js / auth/server-core.js / auth/server-community.js / auth/server-billing.js / gas/webpush.js / gas/main.js
// 設定方法は gas/README.md を参照してください。
// ============================================

// ---------- referral/data.js ----------
// ============================================
// 紹介先早見表 - データ
// REF_SEED_MEMBERS は名簿が未作成のときに一度だけサーバー層(auth/mock-server.js)へ
// 投入される初期名簿。投入後の追加・編集・削除は管理者ページ(/admin/)から行い、
// ここを書き換えても既存の名簿には反映されない。
// REF_SEED_REVISIONS に載せたメンバーは、既存の名簿にも一度だけ反映される
// (管理者ページで編集済みのメンバーは空欄だけを埋める)。
// 詳細を入力済みでないメンバーは、会員名簿に表示されている肩書きと所属チームのみ。
// ============================================

const COMMUNITY = {
  label: "BT-EX5 ／ 新潟・東京 紹介者制コミュニティ",
};

const UNCATEGORIZED = "その他・未分類";

// IT・Web・クリエイティブは広いので、仕事の中身ごとに分ける(一覧では1つのまとまりとして並べる)
const REF_CATEGORY_GROUPS = [
  {
    label: "IT・Web・クリエイティブ",
    categories: [
      "AI研修・AI活用",
      "システム開発",
      "Web制作",
      "SNS運用・集客",
      "動画編集・映像制作",
      "企業PR動画制作",
      "作詞作曲・音楽制作",
      "声・司会・キャスティング",
      "デザイン・ブランディング",
      "EC・ネットショップ",
    ],
  },
  {
    label: "そのほかの業種",
    categories: ["士業・専門家", "お金・保険", "住まい・不動産", "人材・組織", "美容・健康", "食・地域産品", "暮らし・サービス"],
  },
];

// 業種と話題の対応。業種で絞り込むと、その業種の人に加えて、この話題を扱う人も出る
// (例: 本業がシステム開発でも、Web制作を扱う人は「Web制作」に出る)。
// その業種の仕事を「自分で作れる」話題だけを入れる(公式LINEの運用・パーソナルブランディング・
// SEO だけの人が、システム開発・デザイン・Web制作に出ないように)。
// システム開発は「システム開発・業務効率化」を扱う人(山本さん・栁橋さん)
const REF_CATEGORY_TOPICS = {
  "AI研修・AI活用": ["ai", "aitraining"],
  "システム開発": ["efficiency"],
  "Web制作": ["web"],
  "SNS運用・集客": ["sns", "line"],
  "動画編集・映像制作": ["video", "prvideo"],
  "企業PR動画制作": ["prvideo"],
  "作詞作曲・音楽制作": ["music"],
  "声・司会・キャスティング": ["voice", "mc", "recording", "casting"],
  "デザイン・ブランディング": ["design", "photo"],
  "EC・ネットショップ": ["ec"],
};

// 前に使っていた業種名(保存済みの名簿は、読み込むときに新しい業種へ置き換える)
const REF_LEGACY_CATEGORIES = ["IT・Web・クリエイティブ", "音楽・作詞作曲・声"];

function refInCategory(m, c) {
  if (m.category === c) return true;
  const topics = REF_CATEGORY_TOPICS[c];
  return !!topics && (m.topics || []).some((t) => topics.includes(t));
}

const REF_CATEGORIES = [
  "AI研修・AI活用",
  "システム開発",
  "Web制作",
  "SNS運用・集客",
  "動画編集・映像制作",
  "企業PR動画制作",
  "作詞作曲・音楽制作",
  "声・司会・キャスティング",
  "デザイン・ブランディング",
  "EC・ネットショップ",
  "士業・専門家",
  "お金・保険",
  "住まい・不動産",
  "人材・組織",
  "美容・健康",
  "食・地域産品",
  "暮らし・サービス",
  UNCATEGORIZED,
];

const REF_BASES = ["東京", "新潟", "未設定"];

// 紹介診断の質問で使う選択肢。id はメンバーの topics / targets / prospects と対応する
// 話題はグループごとに表示する。ほかのメンバーと重ならない具体的な話題があるほど、
// その人が診断で上位に出やすくなる
const TOPIC_GROUPS = [
  { id: "it", label: "IT・AI・Web" },
  { id: "biz", label: "集客・販促・コンサル" },
  { id: "create", label: "制作・クリエイティブ" },
  { id: "stage", label: "声・司会・キャスト" },
  { id: "money", label: "お金・法律" },
  { id: "people", label: "人・組織・成長" },
  { id: "place", label: "住まい・地域" },
  { id: "life", label: "健康・美容・暮らし" },
  { id: "food", label: "食・イベント" },
];

// ジャンル(話題)。1人に当てはまるものをいくつでも付けられ、カードにはタグ(tag)として並ぶ。
// 紹介診断の「どんな話が出ましたか?」と「話題で探す」でも使う
const TOPICS = [
  { id: "pc", group: "it", label: "パソコン・スマホの買い替え・設定", tag: "PC・スマホ相談" },
  { id: "efficiency", group: "it", label: "システム開発・業務効率化(AI導入をふくむ)", tag: "システム開発" },
  { id: "line", group: "it", label: "公式LINE・LINE Bot構築", tag: "公式LINE構築" },
  { id: "web", group: "it", label: "ホームページ・LP制作", tag: "HP・LP制作" },
  { id: "seo", group: "it", label: "SEO・MEO・AIO対策", tag: "SEO・MEO・AIO" },
  { id: "ec", group: "it", label: "ネットショップ・EC", tag: "EC・ネットショップ" },
  // AI活用は個人がAIを使いこなす手伝い(個人向け)。AI研修は個人・法人のどちらも。
  // 会社へのAI導入は「システム開発」の枠に入れる(ただし一致度は下げる: match)
  { id: "ai", group: "it", label: "AI活用(個人向け・使い方のサポート)", tag: "AI活用" },
  { id: "aitraining", group: "it", label: "AI研修・AI講座(個人・法人)", tag: "AI研修" },
  { id: "sns", group: "biz", label: "SNS運用・集客", tag: "SNS運用" },
  { id: "ad", group: "biz", label: "広告・販促", tag: "広告・販促" },
  { id: "consult", group: "biz", label: "経営・集客コンサル", tag: "コンサル" },
  { id: "branding", group: "biz", label: "ブランディング・見せ方", tag: "ブランディング" },
  { id: "video", group: "create", label: "動画編集・撮影", tag: "動画編集" },
  { id: "prvideo", group: "create", label: "企業PR動画・採用動画", tag: "企業PR動画" },
  { id: "photo", group: "create", label: "写真撮影", tag: "写真撮影" },
  { id: "design", group: "create", label: "デザイン(ロゴ・チラシ・イラスト)", tag: "デザイン" },
  { id: "music", group: "create", label: "作詞作曲・音楽制作", tag: "作詞作曲" },
  { id: "ehon", group: "create", label: "絵本・AI絵本制作", tag: "絵本制作" },
  { id: "voice", group: "stage", label: "ボイストレーニング・話し方", tag: "ボイトレ" },
  { id: "mc", group: "stage", label: "司会・MC", tag: "司会・MC" },
  { id: "recording", group: "stage", label: "レコーディング・音声収録", tag: "レコーディング" },
  { id: "casting", group: "stage", label: "キャスティング(モデル・タレント・声優)", tag: "キャスティング" },
  { id: "liver", group: "stage", label: "ライバー・ライブ配信", tag: "ライバー" },
  { id: "tax", group: "money", label: "税金・会計", tag: "税金・会計" },
  { id: "legal", group: "money", label: "契約・法律・許認可", tag: "法律・許認可" },
  { id: "funding", group: "money", label: "資金調達・補助金・融資", tag: "資金調達" },
  { id: "insurance", group: "money", label: "保険・資産・相続", tag: "保険・資産" },
  { id: "fixedcost", group: "money", label: "固定費の見直し(携帯・光熱費・家計)", tag: "固定費の見直し" },
  { id: "hiring", group: "people", label: "採用・人材", tag: "採用・人材" },
  { id: "org", group: "people", label: "組織づくり・社員研修", tag: "社員研修" },
  { id: "labor", group: "people", label: "労務・助成金", tag: "労務" },
  { id: "retention", group: "people", label: "離職防止・社員の定着", tag: "離職防止" },
  { id: "mindset", group: "people", label: "マインドセット・思考整理", tag: "思考整理" },
  { id: "coaching", group: "people", label: "コーチング・人生相談", tag: "コーチング" },
  { id: "tutoring", group: "people", label: "家庭教師・塾・学習", tag: "家庭教師" },
  { id: "realestate", group: "place", label: "不動産・物件・空き家", tag: "不動産" },
  { id: "reform", group: "place", label: "リフォーム・内装", tag: "リフォーム" },
  { id: "cruise", group: "place", label: "旅行・豪華客船クルーズ", tag: "クルーズ旅行" },
  { id: "inbound", group: "place", label: "インバウンド・海外", tag: "インバウンド" },
  { id: "regional", group: "place", label: "地方創生・自治体", tag: "地方創生" },
  { id: "beauty", group: "life", label: "美容・エステ・脱毛", tag: "美容・エステ" },
  { id: "health", group: "life", label: "健康・体のケア", tag: "健康" },
  { id: "color", group: "life", label: "パーソナルカラー・スタイリング", tag: "カラー診断" },
  { id: "spiritual", group: "life", label: "スピリチュアル・癒やし", tag: "スピリチュアル" },
  { id: "handmade", group: "life", label: "ハンドメイド・雑貨", tag: "ハンドメイド" },
  { id: "life", group: "life", label: "暮らし(車・介護・家事)", tag: "暮らし" },
  { id: "family", group: "life", label: "結婚・子育て・家族", tag: "子育て・家族" },
  { id: "kids", group: "life", label: "子ども・学校・教育", tag: "子ども・教育" },
  { id: "food", group: "food", label: "食品・ギフト・仕入れ", tag: "食品・ギフト" },
  { id: "catering", group: "food", label: "ケータリング・パーティー料理", tag: "ケータリング" },
  { id: "event", group: "food", label: "イベント企画", tag: "イベント企画" },
  { id: "venue", group: "food", label: "会場・レンタルスペース", tag: "会場" },
  { id: "social", group: "food", label: "社会貢献・子ども食堂・寄付", tag: "社会貢献" },
];

// 紹介診断の入口: 相手の「困りごと(課題)」から、具体的な方法(ジャンル)へ進む。
// 方法は topics(ジャンル)に対応する。「まだ分からない」を選ぶと、その課題の方法すべてで探す。
// 課題の分け方は、中小企業の経営課題の整理(人材の確保・育成/販路・集客/単価・収益/業務効率化・コスト/資金)に、
// 暮らし・イベント・美容など会員の仕事に多い分野を足したもの
const REF_NEEDS = [
  { id: "hire", label: "人を採用したい・人手が足りない", desc: "求人・採用・人手不足", methods: [
    { label: "採用・人材紹介の相談", topics: ["hiring"] },
    { label: "システム開発で人手を補う", desc: "業務をシステム・AIで減らし、人を増やさずに回す", topics: ["efficiency"] },
    { label: "社員の離職を減らす(定着)", desc: "辞めない職場・人が続く組織にする", topics: ["retention"] },
    { label: "求人ページ・採用サイトを作る", topics: ["web"] },
    { label: "SNSで採用を強くする", topics: ["sns"] },
    { label: "採用動画を作る", topics: ["prvideo"] },
    { label: "助成金・労務の相談", topics: ["labor"] },
  ] },
  { id: "grow", label: "人を育てたい・組織を強くしたい", desc: "社員教育・マインド・チームづくり", methods: [
    { label: "AI研修", desc: "社員がAIを使えるように", topics: ["aitraining"] },
    { label: "マインドセット・思考整理", desc: "考えを整理して前に進めるようにする", topics: ["mindset", "coaching"] },
    { label: "離職を減らす・定着させる", topics: ["retention"] },
    { label: "ビジネスコンサル", topics: ["consult"] },
    { label: "社員研修・組織づくり", topics: ["org"] },
    { label: "話し方・プレゼン", topics: ["voice"] },
    { label: "労務・就業規則", topics: ["labor"] },
  ] },
  { id: "customers", label: "お客様を増やしたい(集客)", desc: "問い合わせ・来店・新規客を増やす", methods: [
    { label: "SEO・MEO・AIO対策", desc: "Google検索・マップ・AI検索で見つけてもらう", topics: ["seo"] },
    { label: "ホームページ・LPを作る・直す", topics: ["web"] },
    { label: "PR動画・会社紹介動画", topics: ["prvideo", "video"] },
    { label: "SNS運用", topics: ["sns"] },
    { label: "公式LINEでリピートを増やす", topics: ["line"] },
    { label: "広告・チラシ・看板", topics: ["ad", "design"] },
    { label: "集客のコンサル", topics: ["consult"] },
    { label: "ネットショップで売る", topics: ["ec"] },
  ] },
  { id: "price", label: "より高い価格で売りたい", desc: "単価を上げたい・安売りから抜けたい", methods: [
    { label: "ブランディング", desc: "選ばれる理由・世界観をつくる", topics: ["branding"] },
    { label: "ビジネスコンサルティング", desc: "商品・価格・売り方の見直し", topics: ["consult"] },
    { label: "デザイン・写真で見せ方を良くする", topics: ["design", "photo"] },
    { label: "PR動画で価値を伝える", topics: ["prvideo"] },
    { label: "本人の見せ方(カラー・スタイリング)", topics: ["color"] },
  ] },
  { id: "sns", label: "SNSで発信したい", desc: "Instagram・TikTok・YouTube・LINE", methods: [
    { label: "SNS運用(代行・相談)", topics: ["sns"] },
    { label: "動画編集・ショート動画", topics: ["video"] },
    { label: "芸能キャスト(モデル・タレント)の手配", topics: ["casting"] },
    { label: "写真撮影", topics: ["photo"] },
    { label: "公式LINE", topics: ["line"] },
    { label: "話し方・声の出し方", topics: ["voice"] },
  ] },
  { id: "efficiency", label: "業務を楽にしたい・コストを下げたい", desc: "手作業・Excel・人件費・固定費", methods: [
    { label: "業務システムを作る", desc: "予約・在庫・顧客管理など", topics: ["efficiency"] },
    { label: "AIを導入する", desc: "会社の仕事にAIのしくみを組みこむ", topics: ["efficiency"], match: 0.75 },
    { label: "社員にAIを教える", topics: ["aitraining"] },
    { label: "公式LINE・自動応答", topics: ["line"] },
    { label: "固定費(携帯・光熱費)を下げる", topics: ["fixedcost"] },
  ] },
  { id: "money", label: "お金のこと(資金・税金・保険)", desc: "資金繰り・融資・補助金・節税", methods: [
    { label: "資金調達・融資・補助金", topics: ["funding"] },
    { label: "税金・会計", topics: ["tax"] },
    { label: "保険・資産・相続", topics: ["insurance"] },
    { label: "契約・法律・許認可", topics: ["legal"] },
    { label: "固定費・家計の見直し", topics: ["fixedcost"] },
  ] },
  { id: "place", label: "お店・場所・地域のこと", desc: "物件・内装・会場・地方創生", methods: [
    { label: "物件・空き家・テナント", topics: ["realestate"] },
    { label: "リフォーム・内装", topics: ["reform"] },
    { label: "会場・レンタルスペース", topics: ["venue"] },
    { label: "地方創生・自治体", topics: ["regional"] },
    { label: "インバウンド・海外のお客様", topics: ["inbound"] },
  ] },
  { id: "make", label: "作ってほしいものがある", desc: "HP・動画・デザイン・曲・絵本など", methods: [
    { label: "ホームページ・LP", topics: ["web"] },
    { label: "動画", topics: ["video"] },
    { label: "企業PR動画・採用動画", topics: ["prvideo"] },
    { label: "写真", topics: ["photo"] },
    { label: "デザイン(ロゴ・チラシ・イラスト)", topics: ["design"] },
    { label: "作詞作曲・オリジナル曲", topics: ["music"] },
    { label: "ナレーション・音声収録", topics: ["recording", "voice"] },
    { label: "絵本・AI絵本", topics: ["ehon"] },
    { label: "システム・アプリ", topics: ["efficiency"] },
    { label: "ネットショップ", topics: ["ec"] },
  ] },
  { id: "event", label: "イベント・パーティーをしたい", desc: "企画・司会・料理・会場", methods: [
    { label: "イベント企画", topics: ["event"] },
    { label: "司会・MC", topics: ["mc"] },
    { label: "ケータリング・料理", topics: ["catering"] },
    { label: "会場", topics: ["venue"] },
    { label: "キャスト・タレントの手配", topics: ["casting"] },
    { label: "ギフト・食品", topics: ["food"] },
  ] },
  { id: "beauty", label: "美容・健康・心のこと", desc: "エステ・体のケア・人生相談", methods: [
    { label: "美容・エステ・脱毛", topics: ["beauty"] },
    { label: "健康・体のケア", topics: ["health"] },
    { label: "コーチング・人生相談", topics: ["coaching"] },
    { label: "思考の整理・マインドセット", topics: ["mindset"] },
    { label: "癒やし・スピリチュアル", topics: ["spiritual"] },
    { label: "パーソナルカラー・スタイリング", topics: ["color"] },
    { label: "ボイストレーニング", topics: ["voice"] },
  ] },
  { id: "family", label: "暮らし・家族・子どものこと", desc: "子育て・教育・介護・家計", methods: [
    { label: "結婚・子育て・家族", topics: ["family"] },
    { label: "子どもの教育・家庭教師", topics: ["kids", "tutoring"] },
    { label: "暮らし(車・介護・家事)", topics: ["life"] },
    { label: "携帯料金・固定費の見直し", topics: ["fixedcost"] },
    { label: "保険・相続", topics: ["insurance"] },
    { label: "ハンドメイド・雑貨", topics: ["handmade"] },
    { label: "社会貢献・子ども食堂", topics: ["social"] },
  ] },
  { id: "other", label: "その他・ジャンルから選ぶ", desc: "すべてのジャンルの一覧から選ぶ", methods: null },
];

// 紹介診断の1問目「相手がこう言っていたら」: 相手が口にしそうな言葉そのままで選べるようにする。
// 選ぶと「方法」の質問をとばして、そのジャンル(どれか1つ)とキーワード(本人の説明にあれば強く一致)で探す
const REF_SAY_PHRASES = [
  { group: "夢・やりたいこと", items: [
    { label: "モデルになりたい", topics: ["casting"], keyword: "モデル" },
    { label: "芸能界に入りたい・俳優になりたい", topics: ["casting"], keyword: "芸能" },
    { label: "ライバーになりたい・ライブ配信を始めたい", topics: ["liver"], keyword: "ライバー" },
    { label: "声優・ナレーターになりたい", topics: ["voice", "recording"], keyword: "声優" },
    { label: "人前で話すのが苦手", topics: ["voice"] },
    { label: "自分の強みが分からない・モヤモヤする", topics: ["coaching", "mindset"] },
  ] },
  { group: "仕事・お店・会社", items: [
    { label: "お客さんが来ない・売上が伸びない", topics: ["seo", "web", "sns", "consult", "ad"] },
    { label: "ホームページが古い・ない", topics: ["web"] },
    { label: "インスタのフォロワーを増やしたい", topics: ["sns"] },
    { label: "人が足りない・人が採れない", topics: ["hiring", "efficiency"] },
    { label: "スタッフがすぐ辞める", topics: ["retention", "org"] },
    { label: "手作業・事務作業が多くて大変", topics: ["efficiency"] },
    { label: "社員にAIを使わせたい", topics: ["aitraining"] },
    { label: "資金が足りない・融資を受けたい", topics: ["funding"] },
    { label: "インバウンド(外国人)のお客様を紹介できる", topics: ["inbound"], keyword: "インバウンド" },
    { label: "海外でお店を経営している", topics: ["inbound"], keyword: "海外" },
    { label: "外国人観光客を呼びたい", topics: ["inbound", "regional"], keyword: "外国人" },
    { label: "地域を盛り上げたい", topics: ["regional", "event"] },
    { label: "イベント・パーティーをしたい", topics: ["event", "catering"] },
  ] },
  { group: "暮らし・自分のこと", items: [
    { label: "パソコンを買い替えたい", topics: ["pc"], keyword: "パソコン" },
    { label: "パソコンが古い・遅い", topics: ["pc"], keyword: "パソコン" },
    { label: "スマホを買い替えたい", topics: ["pc"], keyword: "スマホ" },
    { label: "携帯代・光熱費が高い", topics: ["fixedcost"] },
    { label: "保険を見直したい", topics: ["insurance"] },
    { label: "家・空き家・土地のことで困っている", topics: ["realestate"] },
    { label: "家をリフォームしたい", topics: ["reform"] },
    { label: "子どもの成績が上がらない", topics: ["tutoring", "kids"], keyword: "成績" },
    { label: "痩せたい・体の不調がある", topics: ["health"] },
    { label: "肌・美容の悩みがある", topics: ["beauty"] },
    { label: "旅行・クルーズに行きたい", topics: ["cruise"] },
  ] },
];

// 3問目「相手はどんな方ですか?」の目盛り(左右に動かして選ぶ)。prospects は一致を見る相手のタイプ(どれか1つ)。
// wrap は狭い画面で折り返してよい位置(/)
const REF_WHO_SCALE = [
  { id: "general", label: "一般の方向け", wrap: "一般の方/向け", prospects: ["individual"] },
  { id: "freelance", label: "フリーランス", wrap: "フリー/ランス", prospects: ["owner", "individual"] },
  { id: "soloowner", label: "個人事業主", wrap: "個人/事業主", prospects: ["owner"] },
  { id: "sme", label: "中小企業", wrap: "中小/企業", prospects: ["owner", "staff"] },
  { id: "large", label: "大企業", prospects: ["staff"] },
];

// 相談アシスタント(文章・音声で入れた相談を読み取る)で使う言葉
// CONSULT_PHRASES: 困りごとの言い方 → そのとき役に立つジャンル(どれか1つできればよい)
const CONSULT_PHRASES = [
  { label: "集客", words: ["集客", "お客様を増やしたい", "お客さんを増やしたい", "客が来ない", "お客が来ない", "新規客", "問い合わせを増やしたい", "売上が伸びない", "知名度"], topics: ["seo", "web", "sns", "consult", "ad"] },
  { label: "採用・人手不足", words: ["人が採れない", "人が足りな", "人手が足りな", "人手不足", "スタッフが足りな", "従業員が足りな", "人員が足りな", "スタッフ採用", "求人", "採用したい", "雇いたい", "人を雇", "スタッフを雇"], topics: ["hiring", "sns", "prvideo", "efficiency"] },
  // 人手が足りないときは、採用だけでなく「仕組みで人手を補う」システム開発・業務効率化も出す(運営の依頼)
  { label: "システム開発で人手を補う", words: ["人が足りな", "人手が足りな", "人手不足", "スタッフが足りな", "人が採れない", "人員不足", "人員が足りな", "従業員が足りな", "手が回らな", "人が辞めて回らな", "少人数で回したい", "人件費を減らしたい", "人件費を抑えたい", "雇いたい", "人を雇"], topics: ["efficiency", "line"] },
  { label: "離職・定着", words: ["辞める", "辞めて", "離職", "定着しない", "人が続かない"], topics: ["retention", "org", "coaching"] },
  { label: "人材育成", words: ["育たない", "育てたい", "社員教育", "研修したい", "人材育成"], topics: ["org", "aitraining", "mindset", "coaching"] },
  { label: "単価アップ", words: ["高く売りたい", "単価", "値上げ", "安売り", "価格競争", "付加価値"], topics: ["branding", "consult", "design"] },
  { label: "業務効率化", words: ["効率化", "手作業", "忙しすぎ", "残業", "人手をかけずに", "Excel管理", "エクセル管理", "自動化したい"], topics: ["efficiency", "line"] },
  { label: "開業・独立", words: ["開業", "独立", "起業", "創業", "お店を出したい", "店を出す"], topics: ["funding", "tax", "legal", "realestate", "reform", "web"] },
  { label: "資金", words: ["資金繰り", "お金が足りない", "融資", "借入", "補助金", "助成金"], topics: ["funding", "labor"] },
  { label: "SNS発信", words: ["発信したい", "インスタを伸ばしたい", "フォロワーを増やしたい", "SNSを始めたい"], topics: ["sns", "video", "photo", "casting"] },
  { label: "AI活用", words: ["AIを使いたい", "AIを使いこなしたい", "AIの使い方", "ChatGPT", "生成AI", "AIを学びたい"], topics: ["ai", "aitraining"] },
  { label: "AI研修", words: ["AI研修", "社員にAI", "AIセミナー", "AI講座"], topics: ["aitraining"] },
  // 会社へのAI導入は「システム開発」の枠。AIだけの話なので、一致度は少し下げる(match)
  { label: "AI導入", words: ["AI導入", "AIを導入", "AIを入れたい", "AIシステム", "AIで自動化"], topics: ["efficiency"], match: 0.75 },
  { label: "悩み・迷い", words: ["迷って", "悩んで", "モヤモヤ", "考えがまとまらない", "一歩が踏み出せない"], topics: ["mindset", "coaching"] },
  { label: "固定費", words: ["固定費", "携帯代", "携帯料金", "電気代", "光熱費", "節約"], topics: ["fixedcost"] },
  { label: "イベント", words: ["イベント", "パーティー", "懇親会", "周年", "式典", "結婚式", "二次会", "セミナーを開きたい"], topics: ["event", "mc", "catering", "venue"] },
  // 暮らし・美容・食などの困りごと(会社の困りごと以外も、お客様の相談として出てくるもの)
  { label: "美容・見た目", words: ["肌荒れ", "シミ", "たるみ", "ムダ毛", "脱毛したい", "綺麗になりたい", "きれいになりたい", "見た目を変えたい", "若々しく", "似合う服", "似合う色", "イメチェン"], topics: ["beauty", "color", "health"] },
  { label: "体の不調", words: ["疲れが取れない", "肩こり", "腰痛", "眠れない", "体調が悪い", "冷え性", "むくみ", "体が重い"], topics: ["health", "beauty"] },
  { label: "心の疲れ・癒やし", words: ["癒されたい", "癒やされたい", "ストレス", "気持ちが落ち込む", "運気"], topics: ["spiritual", "coaching", "health"] },
  { label: "贈り物・食", words: ["贈り物", "プレゼント", "手土産", "お土産", "お中元", "お歳暮", "差し入れ", "おいしいもの", "美味しいもの", "名産"], topics: ["food", "catering", "handmade"] },
  { label: "販路・ネット販売", words: ["ネットで売りたい", "商品を売りたい", "販路", "通販を始めたい", "ネット販売したい", "売り場を増やしたい"], topics: ["ec", "sns", "web", "food"] },
  { label: "住まい・物件", words: ["家を買いたい", "家を建てたい", "引っ越し", "古い家", "雨漏り", "店舗を探している", "事務所を探している", "物件を探している"], topics: ["realestate", "reform"] },
  { label: "お金の将来", words: ["老後", "将来のお金", "相続", "保険を見直したい", "貯金", "資産運用", "年金"], topics: ["insurance", "fixedcost", "funding"] },
  { label: "子ども・教育", words: ["子どもの勉強", "子供の勉強", "成績", "受験", "子育て", "習い事", "不登校"], topics: ["tutoring", "kids", "family"] },
  { label: "結婚・家族", words: ["結婚したい", "婚活", "出会いがない", "家族のこと"], topics: ["family"] },
  { label: "介護・暮らし", words: ["親の介護", "介護", "車を買いたい", "車検", "家事が大変"], topics: ["life", "family"] },
  { label: "外国人・海外", words: ["外国人のお客", "観光客", "訪日", "海外に売りたい", "海外展開"], topics: ["inbound", "regional", "ec"] },
  { label: "地域を元気に", words: ["地域を盛り上げたい", "町おこし", "まちづくり", "地域活性"], topics: ["regional", "event", "social"] },
  { label: "話し方・声", words: ["人前で話す", "話すのが苦手", "プレゼンが苦手", "声が通らない", "滑舌", "イケボ", "いい声", "声を良くしたい", "声に自信がない", "声が小さい", "説得力のある話し方", "商談で引き込", "声がこもる", "聞き返される"], topics: ["voice", "mc", "coaching"] },
  { label: "音楽・ナレーション", words: ["曲を作りたい", "テーマソング", "BGMがほしい", "ナレーションを入れたい"], topics: ["music", "recording", "voice"] },
  { label: "税金・契約", words: ["税金が高い", "確定申告", "契約書", "トラブルになった", "許可が必要"], topics: ["tax", "legal"] },
  { label: "社会貢献", words: ["寄付したい", "ボランティア", "子ども食堂", "社会貢献したい"], topics: ["social"] },
  { label: "芸能・モデル", words: ["モデルになりたい", "芸能界", "芸能事務所", "俳優になりたい", "タレントになりたい", "女優になりたい"], topics: ["casting"] },
  { label: "ライバー", words: ["ライバー", "ライブ配信", "配信者になりたい", "投げ銭"], topics: ["liver"] },
  { label: "パソコン・スマホ", words: ["パソコンを買い替え", "パソコンが古い", "パソコンが遅い", "PCが古い", "スマホを買い替え", "スマホの機種変更", "パソコンの設定"], topics: ["pc"] },
  { label: "インバウンドの紹介", words: ["インバウンド客を紹介", "海外で店", "海外でお店", "海外の店舗", "外国人のお客様が多い"], topics: ["inbound"] },
];
const CONSULT_INDUSTRY_WORDS = {
  restaurant: ["飲食", "レストラン", "カフェ", "居酒屋", "ラーメン", "焼肉", "バー", "料理店"],
  retail: ["小売", "雑貨", "物販", "ショップ", "アパレル", "ネットショップ"],
  salon: ["サロン", "美容室", "美容院", "ヘアサロン"],
  pro: ["士業", "会計事務所", "法律事務所", "税理士事務所"],
  build: ["製造", "工場", "建設", "工務店", "建築", "リフォーム会社"],
  it: ["IT企業", "システム会社", "Web制作会社", "SaaS", "IT会社"],
  medical: ["医療", "クリニック", "病院", "介護", "歯科", "整骨院"],
  personal: ["主婦", "家庭", "夫婦", "子育て中", "家族のこと"],
};
const CONSULT_PROSPECT_WORDS = {
  owner: ["経営者", "社長", "代表", "オーナー", "個人事業主", "店主", "開業", "起業"],
  staff: ["担当者", "部長", "課長", "管理職", "人事部", "総務部", "会社員の方"],
  individual: ["主婦", "家族", "家庭", "夫婦", "子育て", "個人的に"],
};
const CONSULT_AREA_WORDS = {
  niigata: ["新潟", "長岡", "上越", "県央", "燕三条", "柏崎", "新発田"],
  tokyo: ["東京", "関東", "神奈川", "横浜", "埼玉", "千葉", "都内"],
};
const CONSULT_MEETING_WORDS = {
  online: ["オンライン", "Zoom", "リモート", "遠方"],
  face: ["対面", "直接会", "会いに行"],
};

// 話題ごとの言いかえ。診断のキーワードがこれに当たると、その話題を持つ人に一致する
// (本人の説明文にその言葉がなくても見つかるように)
const TOPIC_KEYWORDS = {
  efficiency: ["効率化", "システム", "自動化", "手作業", "Excel", "エクセル", "予約管理", "在庫", "DX", "アプリ", "開発"],
  pc: ["パソコン", "PC", "スマホ", "機種変更"],
  line: ["LINE", "公式LINE", "LINE Bot", "LINEボット", "ステップ配信"],
  web: ["ホームページ", "HP", "Web", "ウェブ", "サイト", "LP"],
  seo: ["SEO", "MEO", "AIO", "LLMO", "AI検索", "検索順位", "Googleマップ", "口コミ"],
  ec: ["EC", "ネットショップ", "通販", "楽天", "Amazon", "ネット販売"],
  ai: ["AI活用", "ChatGPT", "生成AI", "AIの使い方", "AIを使いこなす"],
  aitraining: ["AI研修", "AI講座", "AI講師", "AIセミナー", "AIを学びたい"],
  sns: ["SNS", "インスタ", "Instagram", "TikTok", "集客", "フォロワー", "運用代行"],
  ad: ["広告", "販促", "チラシ配布", "看板", "サイネージ"],
  consult: ["コンサル", "経営相談", "売上を上げたい", "集客の相談"],
  branding: ["ブランディング", "見せ方", "印象", "ブランド"],
  video: ["動画", "映像", "YouTube", "撮影", "編集", "ショート動画", "リール"],
  prvideo: ["PR動画", "企業PR", "会社紹介", "採用動画", "CM", "プロモーション", "PR"],
  photo: ["写真", "撮影", "カメラマン", "プロフィール写真"],
  design: ["デザイン", "ロゴ", "チラシ", "ポスター", "バナー", "印刷", "名刺", "パンフレット", "イラスト"],
  music: ["作詞", "作曲", "音楽制作", "BGM", "楽曲", "ジングル", "オリジナル曲"],
  ehon: ["絵本", "自分史"],
  voice: ["発声", "声が", "話し方", "ボイトレ", "ナレーション", "プレゼン", "喉"],
  mc: ["司会", "MC", "進行"],
  recording: ["レコーディング", "録音", "収録", "スタジオ"],
  casting: ["キャスティング", "モデル", "タレント", "声優", "インフルエンサー", "キャスト", "芸能"],
  liver: ["ライバー", "ライブ配信"],
  tax: ["税金", "税理士", "会計", "確定申告", "経理", "節税"],
  legal: ["契約", "法律", "弁護士", "行政書士", "許認可", "許可"],
  funding: ["資金", "融資", "補助金", "助成", "借入", "借り換え", "資金繰り"],
  insurance: ["保険", "資産", "相続", "年金", "老後", "ライフプラン"],
  fixedcost: ["固定費", "携帯料金", "格安SIM", "光熱費", "電気代", "ガス代", "Wi-Fi", "家計"],
  hiring: ["採用", "求人", "人材", "人手不足", "人が採れない"],
  org: ["研修", "組織", "社員教育", "チームづくり", "マネジメント"],
  labor: ["労務", "社労士", "就業規則", "給与計算"],
  retention: ["離職", "定着", "辞める", "辞めない", "辞めてしまう", "退職", "すぐ辞める", "人が続かない"],
  mindset: ["マインドセット", "思考整理", "考えがまとまらない", "頭の中を整理", "モヤモヤ", "マインド"],
  coaching: ["コーチング", "目標", "人生相談", "自己成長", "メンタル"],
  tutoring: ["家庭教師", "塾", "受験", "勉強", "学習"],
  realestate: ["不動産", "物件", "空き家", "テナント", "駐車場", "土地"],
  reform: ["リフォーム", "内装", "改装", "店舗工事"],
  inbound: ["インバウンド", "外国人", "海外", "観光"],
  regional: ["地方創生", "自治体", "町おこし", "税収", "地域活性"],
  beauty: ["美容", "サロン", "エステ", "肌", "脱毛", "眉毛", "フェイスマスク"],
  health: ["健康", "リンパ", "体のケア", "整体", "サプリ"],
  color: ["パーソナルカラー", "似合う色", "カラー診断", "スタイリング", "骨格"],
  handmade: ["ハンドメイド", "手作り", "雑貨", "オルゴナイト"],
  spiritual: ["スピリチュアル", "癒やし", "癒し", "波動", "パワーストーン", "占い"],
  life: ["暮らし", "家事", "介護", "自動車", "車検"],
  family: ["結婚", "婚活", "子育て", "家族", "新婚", "出産"],
  kids: ["子ども", "子供", "学校", "教育", "絵本", "成人式"],
  food: ["食品", "ギフト", "仕入れ", "お菓子", "スイーツ", "特産品"],
  catering: ["ケータリング", "料理", "パーティー", "懇親会", "お弁当", "食事"],
  event: ["イベント", "パーティー", "交流会", "セミナー", "企画"],
  venue: ["会場", "レンタルスペース", "貸し会議室", "場所を借りたい"],
  social: ["社会貢献", "子ども食堂", "寄付", "チャリティ"],
};

// 紹介し合える相手を探すときに見る「お客様・分野」の言葉。
// Aさんの「求める紹介」とBさんの事業・お客様に同じ言葉があれば、同じお客様を持つ相手
const SEGMENT_KEYWORDS = [
  "美容室", "サロン", "エステ", "美容", "クリニック", "飲食", "店舗", "複数店舗", "経営者", "個人事業主", "起業",
  "フリーランス", "中小企業", "法人", "学校", "子ども", "子育て", "家族", "新婚", "シニア", "介護", "ホテル",
  "旅館", "温浴", "宿泊", "保険", "不動産", "住宅", "結婚相談所", "セミナー", "講師", "コーチ", "スピリチュアル",
  "女性", "EC", "ネットショップ", "イベント", "地域", "新潟", "長野", "士業", "採用", "SNS", "LINE", "Web",
  "AI", "動画", "声優", "ナレーター", "営業", "金融", "資金", "ギフト", "食品", "スイーツ", "スポーツ", "体験",
  "インバウンド", "海外", "インフルエンサー", "メーカー", "商品", "小売",
];

const PROSPECTS = [
  { id: "owner", label: "経営者・個人事業主" },
  { id: "staff", label: "会社の担当者・管理職" },
  { id: "individual", label: "個人(家庭・暮らしのこと)" },
];

const INDUSTRIES = [
  { id: "restaurant", label: "飲食" },
  { id: "retail", label: "小売・EC" },
  { id: "salon", label: "美容・サロン" },
  { id: "pro", label: "士業・専門職" },
  { id: "build", label: "製造・建設" },
  { id: "it", label: "IT・サービス" },
  { id: "medical", label: "医療・介護" },
  { id: "personal", label: "個人・家庭" },
];

const AREAS = [
  { id: "niigata", label: "新潟" },
  { id: "tokyo", label: "東京・関東" },
  { id: "other", label: "その他の地域" },
];

const MEETINGS = [
  { id: "face", label: "対面で会いたい" },
  { id: "online", label: "オンラインでよい" },
  { id: "either", label: "どちらでもよい" },
];

// メンバーの資料・リンク(詳細画面に表示)。url は https:// か、サイト内の materials/ のファイル
// match: URL を貼ったとき、この種類に自動で切り替える目印
const LINK_TYPES = [
  { id: "proposal", label: "提案資料・パンフレット", kind: "material" },
  { id: "website", label: "ホームページ", kind: "web" },
  { id: "line", label: "LINE", kind: "contact", match: /(^|\.)(line\.me|lin\.ee)\//i },
  { id: "instagram", label: "Instagram", kind: "contact", match: /(^|\.)instagram\.com\//i },
  { id: "facebook", label: "Facebook", kind: "contact", match: /(^|\.)(facebook\.com|fb\.com|fb\.me)\//i },
  { id: "x", label: "X(旧Twitter)", kind: "contact", match: /(^|\.)(x\.com|twitter\.com)\//i },
  { id: "tiktok", label: "TikTok", kind: "contact", match: /(^|\.)tiktok\.com\//i },
  { id: "threads", label: "Threads", kind: "contact", match: /(^|\.)threads\.(net|com)\//i },
  { id: "youtube", label: "YouTube", kind: "contact", match: /(^|\.)(youtube\.com|youtu\.be)\//i },
  { id: "linkedin", label: "LinkedIn", kind: "contact", match: /(^|\.)linkedin\.com\//i },
  { id: "note", label: "note", kind: "contact", match: /(^|\.)note\.com\//i },
  { id: "sasaeai", label: "SASAEAI", kind: "contact", match: /(^|\.)sasaeai\.link-platform\.jp\//i },
  { id: "blog", label: "ブログ(アメブロなど)", kind: "contact", match: /(^|\.)(ameblo\.jp|hatenablog\.|livedoor\.blog|blog\.jp)/i },
  { id: "other", label: "その他のリンク", kind: "web" },
];

const ONLINE_LABELS = { all: "全国対応", partial: "打合せのみ可", none: "対面のみ", unknown: "未入力" };

// 名簿の肩書き・所属チームのみ分かっているメンバーの初期データを作る
function rosterMember(id, name, headline, team, category, topics, base) {
  return {
    id,
    name,
    company: headline || "",
    team: team || "",
    base: base || "未設定",
    category: category || UNCATEGORIZED,
    business: "",
    customers: "",
    offer: "",
    selfIntro: "",
    note: "",
    wants: "",
    triggers: [],
    face: "",
    faceAreas: [],
    online: "unknown",
    topics: topics || [],
    targets: [],
    prospects: [],
    links: [],
  };
}

const REF_SEED_MEMBERS = [
  {
    id: "yamamoto",
    name: "山本 捷真",
    // カードの名前の下に出る肩書き(本人から受け取った肩書き。2026年10月25日)
    company: "Lumenium 代表/AI事業者向けシステム開発、0から作るオリジナルWebサイト制作、セキュリティ特化のAI研修、有名監督による企業PR動画・SNS運用、元家電量販店店員によるスマホ・PC買い替え相談と携帯料金見直し、個々に合わせた苦手克服AIを用いたオンライン塾",
    team: "フェリシア",
    base: "東京",
    category: "システム開発",
    business:
      "①システム開発(いちばんの事業/Lumenium・法人向け):AI研修や教材制作から、自動化システム開発までワンストップで対応。AIを生業にしている個人・企業へのシステム導入とAIの指導。AI事業者向けのシステム開発、業務効率化システムの開発(予約・在庫・仕入れ・契約書・営業リスト・電話の自動応対・会員制マッチングなど/30万〜600万円)、セキュリティに特化した社員向け生成AI研修・AI導入支援・教材制作(講師1回10万円〜。システム開発のアドバイザーやAI講師としてAI企業に参画し、全国各地でAIのセキュリティを指導)、LINE構築・LINE Bot(初期20万円〜・月額10万円〜)。\n②Webサイト制作:0から作るオリジナルWebサイト制作。集客に強い、自分で更新・分析できるホームページ・LP制作(サイト60万円〜・LP30万円〜)。(https://lumenium.net)\n③教育(個人向け):個人に合わせて苦手単元を一つずつ克服していく、AIを用いたオンライン塾「Weak-Point Sniper」。慶應卒の人脈を活かした高学歴の講師が、大手に負けないサービスで指導。学校のテスト結果や独自のオンラインテスト(アセスメント)のデータをシステムで分析し「本当に苦手な単元・弱点」をピンポイントで特定、完全オリジナルの単語帳・専用問題集で1回30分の濃縮マンツーマン指導。基本プラン 月8回×30分 月額5万円(年額一括50万円)/集中オプション 月額9万円(年額一括80万円)。入会金・教材費・施設費・季節講習費は0円、月額プランはいつでも途中解約できる。大学受験向けのオンライン個別指導・家庭教師派遣・英会話講師派遣も。\n④パソコン・スマホ(携帯)にお困りの方(個人向けITサポート):元家電量販店店員のスキルを活かした「スマホ・PC買い替え相談」(あなたにちょうどいい1台を迷わず、おトクに。購入代行・設定まで丸投げOK)と「携帯料金見直し」。\n⑤映像制作・キャスティング(提携先の事業/所属する芸能事務所 AdvoVisions):ホラー系といえばこの監督と言われる有名な映画監督による本格的なPR映像制作(リンガーハット・地方自治体などのPR実績)、SNS運用代行、イベント時のMC・自社タレントから超有名タレントの手配まで対応(動画制作 5万円〜・キャスト1名5,000円〜)。ロゴ・バナー・ポスター・イラスト・作詞作曲(3万円〜)も。",
    customers: "複数店舗の店舗オーナー/飲食チェーンの店舗統括/士業事務所/会員制の交流会の運営会社/研修を行いたい企業/名刺交換の多い経営者/雑貨店など小売・物販の経営者/SNS運用代行会社/中高生・受験生のお子さんがいるご家庭(部活で忙しい・集中力が続きにくい生徒)/パソコン・スマホを買い替えたい方",
    note: "相談・見積り無料、48時間以内に返信。最低発注額なし、1業務・研修1回から。動画制作とキャスト手配は制作パートナー(AdvoVisions)と対応。",
    wants:
      "人手が足りない経営者/人を雇いたい経営者/紙・Excel・電話で業務を回している中小企業や複数店舗の経営者(飲食・小売・サロン・士業事務所など)/AIを導入したいが何から始めるか決まっていない会社/中高生・受験生のお子さんの成績や塾代に悩むご家庭/パソコン・スマホを買い替えたい方",
    triggers: ["人手が足りない", "人が採れない", "手作業に時間がかかる", "社員にAIを使わせたい", "予約・在庫管理がバラバラ", "電話予約を取りこぼしている", "HPを作ったきり", "動画を作りたい", "SNSの運用を任せたい", "ロゴ・チラシ・ポスターを作りたい", "モデル・MCを手配したい", "名刺を営業リストにしたい", "契約書づくりに時間がかかる", "人が足りない", "スタッフが足りない", "従業員が足りない", "人員が足りない", "成績が上がらない", "苦手な単元がある", "塾代が高い", "季節講習が高い", "家庭教師を探している", "オンライン家庭教師", "大学受験", "英会話の講師を探している", "パソコンを買い替えたい", "パソコンが古い", "スマホを買い替えたい", "パソコンの設定がわからない", "モデルになりたい", "芸能界に入りたい", "俳優・タレントになりたい", "芸能事務所を探している", "携帯料金が高い", "携帯料金を見直したい", "自社の業務をAIで楽にしたい", "人を雇わずにシステムで補いたい", "AIのセキュリティが心配", "公式LINEを作りたい"],
    face: "関東(東京拠点)",
    faceAreas: ["tokyo"],
    online: "all",
    topics: ["efficiency", "ai", "aitraining", "line", "web", "seo", "sns", "video", "prvideo", "tutoring", "kids", "pc", "music", "casting", "org", "hiring", "event", "fixedcost"],
    targets: ["restaurant", "retail", "salon", "pro", "build", "it"],
    prospects: ["owner", "staff", "individual"],
    // 「紹介文をコピー」に入る本人の自己紹介(本人の依頼で原文のまま)
    personal: "慶應義塾大学を2026年3月に卒業。自身で様々な事業を始めて7年以上。趣味はAI・仮想通貨・ガジェット・旅行・温泉・アニメ・ポーカーで、新しいものを試すのが大好き。趣味が合う方もお気軽に。",
    selfIntro: "初めまして！山本 捷真（しょーま）と申します。\n慶應義塾大学を今年の3月に卒業しました\nあなたの煩雑な作業を一括管理する、システム開発のプロフェッショナルです！\n自身で様々な事業を始めて7年以上活動しております。\nシステム開発のアドバイザーやAI講師としてAI企業に入ったり、全国各地にAI講師としてAIのセキュリティに関して指導させていただいております。\n\n【事業内容】\n🤖 ① 法人向けAI・Webシステム開発（Lumenium）\n AI研修や教材制作から、自動化システム開発、集客に強いWebサイト制作までワンストップで対応！（https://lumenium.net ）（AIを生業にしている個人や企業にシステム導入やAIを教えております）\n\n📱 ② 個人の方向けITサポート＆教育\n 元家電量販店店員のスキルを活かした「スマホ・PC買い替え相談」や「携帯料金見直し」、慶應卒の人脈を活かした高学歴の講師と個人に合わせた苦手単元を一つづつ克服していくシステムを用いて、大手に負けないサービスを展開✏️\n\n🎬 ③ 映像制作・キャスティング（提携先事業）\nホラー系といえばこの監督と言われるような有名な映画監督による本格的なPR映像制作から、SNS運用、イベント時のMC・自社タレントから超有名タレント手配まで対応可能です✨（リンガーハット、地方自治体などのPR実績）\n\n↑私の所属する芸能事務所になります\n\n\n🌟 趣味 ：AI💻・仮想通貨📈・ガジェット⌚️・旅行✈️・温泉♨️・アニメ📺・ポーカー🃏\n新しいものを試すのが大好きです！\n\n\n「自社の業務をAIで楽にできない？」「人を雇いたいんだけどシステムで補えない？」など、どんな切り口からでも大歓迎です😊 趣味が合う方もぜひお気軽に絡んでください！よろしくお願いいたします🌼",
    links: [
      { type: "proposal", url: "materials/yamamoto-branding.jpg", label: "山本 捷真 パーソナルブランディングシート", cover: "materials/yamamoto-branding.jpg" },
      { type: "proposal", url: "materials/lumenium-proposal.pdf", label: "Lumenium 自己紹介・ご提案(14ページ)", cover: "materials/lumenium-proposal-cover.jpg" },
      { type: "proposal", url: "materials/yamamoto-pc-kaikae.jpg", label: "パソコン買い替え相談・購入代行サービス", cover: "materials/yamamoto-pc-kaikae.jpg" },
      { type: "website", url: "https://lumenium.net", label: "lumenium.net" },
      { type: "instagram", url: "https://www.instagram.com/showstagram.keio/", label: "@showstagram.keio" },
      { type: "line", url: "https://line.me/ti/p/2viaHtuXEu", label: "山本 捷真(LINE で友だち追加)" },
      { type: "sasaeai", url: "https://sasaeai.link-platform.jp/mypage/profile/member?profile_id=30310" },
      { type: "facebook", url: "https://www.facebook.com/profile.php?id=61559604892676&mibextid=wwXIfr" },
    ],
  },
  Object.assign(rosterMember("m02", "あまみや 七音", "echo studio 代表/声優・ナレーター・ボイストレーナー", "Over", "声・司会・キャスティング", ["voice", "mc", "recording", "casting", "health"]), {
    // 本人のホームページ(amamiyanao.com)の内容から(2026年10月)
    business: "echo studio 代表。声優・ナレーター(会社案内・企業VP・CM・教材・イベントPVのナレーション、TVアニメ・海外ドラマ・洋画の吹き替え)、ボイストレーニング教室(複数のトレーナーが在籍)、「BVB(ビジネスボイスブースター)」=「あなたの声が、ビジネスの武器になる」ビジネス特化型のオンラインボイストレーニング(月16,500円・税込。ビジネスに必要な「通る声・聞きやすい声」、呼吸・姿勢・発声の基礎、発声・滑舌・声量・トーン・表現力。プレゼン・会議・商談での説得力・信頼感・好感度を上げる。会員はほかのイベントに会員価格で参加できる)、「イケボスパルタ塾」=「眠る声を、叩き起こせ」。男女問わず、自分の声を最大限に生かした魅力のある声(イケボ)をつくる期ごとの講座、レコーディングスタジオ(ナレーション・歌の録音)、動画制作、声優・タレントのキャスティング。4オクターブの声で、中性的な低音ハスキーボイスから子ども・男性・おばあちゃんまで演じ分ける。ステージの専属ショーシンガーの経験があり、JAZZ・POPs・Soul・ROCK・ゴスペル・演歌・オペラ・アニメソングも歌うボーカリスト。失声症を乗り越えた経験から、声を聞けば出し方と改善法が分かるボイストレーナー。",
    customers: "会社案内・採用・研修・商品紹介の動画を作る企業の広報・人事/映像制作会社・広告代理店・TV局/人前で話す経営者・営業職・講師/声優・ナレーターを目指す人/歌の活動をしたい人/喉を痛めやすい人",
    note: "「長く喋ると喉が枯れる…原因は姿勢と口の開け方と呼吸量」。出演:TVアニメ『サザエさん』『ぐでたま』こども役、海外ドラマ『CSI:NY』『CSI:マイアミ』『プリズン・ブレイク』『デスパレートな妻たち』、TBSドラマ『きみはペット』、映画『アトム』、日本赤十字社『臍帯血バンクご案内』・価格.com・エステー化学・前田道路などの会社案内ナレーション、ハンドボール協会 2020 世界選手権のナレーション。著書が Amazon 売れ筋ランキング7部門で1位(2025年11月)。そのほかの出演:TBS韓流セレクト『ネイルサロンパリス』、TVCM『ハグミン〜出川編』、教材CD『日本国憲法』ナレーション、VRコンテンツ『かりんと VR』。ボイストレーニングの実績:芸能プロダクションの俳優演技基礎指導、声優プロダクションの発声基礎指導、アナウンサーのオーディション特別対策指導、都内ミュージックスクールでリピート率1位、ビジネスプレゼン特別対策指導講師、オンラインビジネスボイス指導特別講師。",
    wants: "会社案内・採用・研修・商品紹介の動画にナレーションを入れたい会社/自分の声に自信がない・説得力のある話し方を身につけたい・プレゼンや商談で相手を引き込む声がほしい経営者・営業職・ビジネスパーソン(BVB)/自分の声の魅力を引き出したい人(イケボスパルタ塾)/声優やナレーターを目指している人・もっと仕事を取りたい人/アナウンサーや俳優を目指す人・オーディションを控えている人/歌の活動をしていきたい人/喋ったり歌ったりすると声が枯れる人/イベントや映像に声優・タレント・歌手を起用したい人",
    triggers: ["声優になりたい", "ナレーションの仕事を増やしたい", "歌の活動をしたい", "喋ると声が枯れる", "録音スタジオを探している", "声優・タレントを起用したい", "会社案内の動画にナレーションを入れたい", "プレゼンで声が通らない", "人前で話すと緊張する", "声に自信がない", "説得力のある話し方を身につけたい", "商談で相手を引き込みたい", "滑舌を良くしたい", "声がこもる・聞き返される", "イケボになりたい", "キャラクターの声を入れたい", "イベントに歌手を呼びたい", "アナウンサー試験・オーディション対策", "俳優の発声・演技の基礎を学びたい"],
    targets: ["it", "personal"],
    prospects: ["individual", "owner", "staff"],
    links: [
      { type: "proposal", url: "materials/amamiya-profile.jpg", label: "あまみや 七音 出演実績・ボイストレーニング実績", cover: "materials/amamiya-profile.jpg" },
      { type: "website", url: "https://amamiyanao.com", label: "echo studio(あまみや 七音 公式サイト・ボイスサンプル)" },
      { type: "website", url: "https://fsmk.co/t/BpzLxF-dknqxc?openExternalBrowser=1", label: "BVB(ビジネスボイスブースター)" },
      { type: "website", url: "https://sites.google.com/view/echo-studio/ikespa", label: "イケボスパルタ塾" },
    ],
  }),
  Object.assign(rosterMember("m03", "佐藤 志織", "アットハッピー/Canva・AI講師、LP・サイト制作", "All Win🏆", "AI研修・AI活用", ["ai", "aitraining", "web", "design"]), {
    business: "Canva・AI講師、LP・サイト制作、Webデザイン。",
    customers: "個人・フリーランス・事業主",
    wants: "いい活動をしているのに、発信・Web・LINE・申し込み導線がバラバラでうまく広がっていない人",
    triggers: ["発信がうまく広がらない", "申し込み導線がバラバラ", "LPを作りたい", "Canvaを覚えたい", "AIを使いこなしたい", "公式LINEを整えたい"],
    targets: ["any"],
    prospects: ["owner", "individual"],
  }),
  Object.assign(rosterMember("m04", "吉澤 美和子", "新潟県/ハンドメイド", "SunnyUp🌞", "暮らし・サービス", ["handmade", "spiritual", "health"], "新潟"), {
    business: "オルゴナイトの制作・販売。",
    customers: "スピリチュアルが好きな方、スピリチュアルのお仕事をされている方",
    wants: "スピリチュアルのお仕事をされている方",
    triggers: ["スピリチュアル", "オルゴナイト", "パワーストーン", "癒やしグッズ", "ハンドメイド作品"],
    targets: ["salon", "personal"],
    prospects: ["individual", "owner"],
  }),
  Object.assign(rosterMember("m05", "大藤 誠", "SFGビューティ株式会社 代表取締役/世界初・ハラール認証フェイスマスク", "CANOW", "美容・健康", ["beauty"], "東京"), {
    business: "meirune glutathione intensive seat mask(世界初・ハラール認証フェイスマスク)、JUST ONE オールインワンタオル。",
    customers: "美容室・エステサロン・ホテル・温浴施設・介護施設など、衛生面やタオルの洗濯・管理コストに課題を抱えている事業者",
    wants: "美容・宿泊・介護・温浴施設の経営者や仕入れ担当者、複数店舗を展開する企業の購買担当者",
    triggers: ["タオルの洗濯・管理コスト", "衛生面が気になる", "備品の仕入れを見直したい", "フェイスマスク", "ハラール", "ホテル・温浴施設"],
    targets: ["salon", "medical", "retail"],
    prospects: ["owner", "staff"],
  }),
  // 本人のプロフィール資料(2026年10月)で充実させる(電話番号は載せない)
  Object.assign(rosterMember("m06", "吉原 優", "FJ/ライフプラン・コンサルタント・ファイナンシャルプランナー", "SunnyUp🌞", "お金・保険", ["insurance", "fixedcost", "family", "life", "realestate"]), {
    business: "ライフプラン・コンサルタント/ファイナンシャルプランナー。介護保険相談、相続対策プランニング、家計見直し・キャッシュフロー分析、金融資産のセカンドオピニオン、新潟県内の住宅ローン相談。ライフプランの作成、保険の提案・見直し。",
    customers: "誰でも(介護や相続が気になる方、新潟県内で住宅ローンを考えている方、いまの資産運用を見直したい方、家計を見直したい方など)",
    note: "保有資格:生命保険協会認定FP、セミナーインストラクター、介護福祉士。",
    triggers: ["保険を見直したい", "家計を見直したい", "ライフプラン", "老後のお金が不安", "教育費の準備", "介護保険のことを知りたい", "親の介護が心配", "相続対策をしたい", "住宅ローンの相談をしたい", "資産運用のセカンドオピニオンがほしい", "キャッシュフローを見直したい"],
    targets: ["any"],
    prospects: ["individual", "owner"],
    links: [
      { type: "proposal", url: "materials/yoshihara-profile.jpg", label: "吉原 優 プロフィール(サービス内容・保有資格)", cover: "materials/yoshihara-profile.jpg" },
      { type: "line", url: "https://line.me/ti/p/o-5fmwF2Yu", label: "吉原 優(LINE で友だち追加)" },
      { type: "instagram", url: "https://www.instagram.com/yu_kaworu", label: "@yu_kaworu" },
    ],
  }),
  rosterMember("m07", "樺澤 一郎", "KBlab合同会社 代表", "Team Bloom∞🌸", "美容・健康", ["health"]),
  // 本人の資料「月面タイムカプセル」(12ページ・2026年10月)の内容で充実させる
  Object.assign(rosterMember("m08", "床島 良夫", "非営利団体 人生工房 理事/月面タイムカプセル・パーソナルインバウンドツアー", "SunnyUp🌞", "暮らし・サービス", ["inbound", "regional", "event", "kids"]), {
    business: "「月面タイムカプセル」(インバウンド × 地域連携 × 宇宙):日本を訪れた旅行者が、日本で体験した感動・気付きと、新たな夢や目標を込めたメッセージを、Astraport社の月面輸送で月へ届ける体験型プロジェクト(参加料 1人70ドル〜。2人120ドル・3人150ドル・4人180ドルの家族・グループ割引あり)。\n①地域連携 エリア登録プラン:ホテル・体験講座・観光地・商店会などが1つのエリアとして連携し、地域全体でインバウンド需要を取り込む。必要経費は1エリア・年間200万円(輸送事業費50万円・集客代行費120万円・賛助会費30万円)。約200人の申込みで経費を回収でき、それを超えた分はエリアの収入になる。完全成功報酬型の追加プラン(+100万円)は個別協議。\n②大手ホテルグループ向けプラン:全国・海外からの宿泊客への特別体験として提供し、ホテルのブランド価値向上と集客につなげる。企画協賛金1,000万円(税別)で、ホテル内の専用ブース設置・プロモーション支援・予約と運営のサポート・データ共有とレポート提供を含む。\nほかに、パーソナルインバウンドツアー。",
    customers: "ホテル・旅館などの宿泊施設/体験講座・アクティビティの事業者/観光地・観光施設/商店会・地域の事業者/大手ホテルグループ/地域密着の中小企業/公立・私立学校",
    note: "月面タイムカプセルとパーソナルインバウンドツアーで外貨を稼ごう! 観光に「+α」の特別な価値(旅の思い出が一生の記念に・日本でしかできない体験・夢や目標を未来へ残せる・SNSでシェアできるストーリー)を提供し、地域経済の活性化・国際交流・次世代への夢の継承にもつながります。参加するツアー客は、氏名・メールアドレスの登録と人生工房への会員登録(利用規約への同意)が必要です。",
    wants: "インバウンド客を増やしたいホテル・旅館・体験講座・観光施設・商店会(地域のみんなでエリア登録してくれる方)/宿泊客に特別な体験を提供して、ブランド価値を上げたい大手ホテルグループ/1/2成人式や元服の儀の誓いなどで取り組んでくれる公立・私立学校と、そのエリアの中小企業/海外で人生工房の会員を募ってくれるインフルエンサー/日本国内でインバウンド客向けの体験型講座を開いてくれる方",
    triggers: ["月面タイムカプセル", "インバウンド", "外国人観光客を呼びたい", "訪日客を増やしたい", "ホテル・旅館の集客", "宿泊客向けの特別な体験", "観光地を盛り上げたい", "商店会で集客したい", "地域活性化", "体験型講座", "宇宙ビジネス", "夢や目標を未来に残したい", "1/2成人式", "元服", "学校の記念行事", "海外のインフルエンサー", "インバウンド客を紹介できる", "海外で店舗を経営している", "外国人のお客様が多い", "海外にお客様・つながりがある"],
    targets: ["any"],
    prospects: ["owner", "staff"],
    links: [
      { type: "proposal", url: "materials/tokoshima-moon-time-capsule.pdf", label: "月面タイムカプセル ご案内資料(12ページ)", cover: "materials/tokoshima-moon-time-capsule-cover.jpg" },
    ],
  }),
  Object.assign(rosterMember("m09", "大場 雅俊", "Ghool株式会社/金融業界に特化したビジネスコンサルティング", "Over", "お金・保険", ["consult", "insurance"]), {
    business: "金融業界に特化したビジネスコンサルティング(集客・コンサル)。",
    wants: "生命保険営業の方",
    triggers: ["生命保険の営業をしている", "保険営業の集客", "金融業界のコンサル"],
    targets: ["pro"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m10", "大枝 篤志", "マイプラBT 代表/売上動線も作れる公式LINE専門家", "Team Bloom∞🌸", "SNS運用・集客", ["sns", "line", "fixedcost", "life"]), {
    business: "売上を増やす(売上動線作りのサポート・LINE・SNS)/収入を増やす(副業・紹介案件・人材紹介)/支出を減らす(格安SIM・ガス・Wi-Fiなど固定費の削減)。",
    customers: "30〜50代の男女(特に40代が中心)/個人事業主・フリーランス・中小企業経営者/子育て世代・共働き世帯/会社員で副収入を作りたい人",
    wants: "皆さんが定期的に通われている美容室のオーナー/起業して3年以内の経営者・個人事業主",
    triggers: ["公式LINEを始めたい", "売上動線を作りたい", "副業を始めたい", "固定費を減らしたい", "格安SIM・Wi-Fi", "起業したばかり"],
    targets: ["salon", "any"],
    prospects: ["owner", "individual"],
  }),
  // 本人のプロフィール資料(2026年10月)で充実させる(生年・出身は載せない)
  Object.assign(rosterMember("m11", "品川 瑞樹", "アドバンス株式会社 代表取締役/集客・コンサル", "", "SNS運用・集客", ["sns", "consult"]), {
    business: "集客・コンサルティング。営業、コンサルタント、経営企画と幅広い分野の経験をもとに、日本経済の再生と、国際市場で競争力を持つ企業づくりを目指しています。",
    note: "幼少期から20年間、水泳に打ちこみ、県大会・地方大会・全国大会で優勝。大学ではスポーツを軸にした教育と心理学を学び、在学中のアメリカ留学をきっかけに「日本経済の再生」のための起業を志す。大学卒業後はコンサルティング会社でキャリアをスタートし、営業・コンサルタント・経営企画の経験を積んで起業。",
    triggers: ["集客の相談をしたい", "営業を強くしたい", "経営企画の相談", "コンサルを頼みたい", "海外市場に挑戦したい"],
    targets: ["any"],
    prospects: ["owner"],
  }),
  // 本人のご案内資料(2026年10月)で充実させる
  Object.assign(rosterMember("m12", "菅野 節子", "リンパレディアソック 代表/リンパ節子(節子式リンパケア)", "Team Bloom∞🌸", "美容・健康", ["health"]), {
    business: "独自に生み出した『節子式リンパケア』(23年・3万人以上の施術実績)。リンパケア施術(心と身体を整え、本来の輝きを引き出す)、セラピスト・講師養成(技術と知識を学び、活躍できる人材を育成)、健康講座・ダイエットサポート(食事・栄養・セルフケア)、イベント・マルシェ出店、歌で笑顔と元気を届ける活動。リンパレディ講座。",
    customers: "セラピスト、施術者、一般のお客様、OL、主婦",
    note: "理念「健康な人を一人でも増やし、子どもたちへ健康な未来を届ける」。施術歴23年・延べ3万人以上を施術、節子式リンパケアを考案。愛媛県松山市を拠点に全国で活動。趣味はカラオケで、歌でも人を元気にする活動をしている。「身体が変わると、心が変わる。心が変わると、人生が変わる。」",
    wants: "体験会の集客(体験会に参加してくれる方)/リンパケアを学んでセラピスト・講師として活躍したい方/健康講座やマルシェに呼んでくれる方",
    triggers: ["リンパケア", "むくみ・不調", "体験会に参加したい", "セラピスト・施術者", "健康講座", "ダイエットしたい", "セルフケアを学びたい", "セラピストになりたい", "マルシェ・イベントに出店してほしい", "イベントで歌ってほしい"],
    targets: ["salon", "personal"],
    prospects: ["individual", "owner"],
    links: [
      { type: "proposal", url: "materials/kanno-lymph.jpg", label: "節子式リンパケア ご案内(活動内容・プロフィール)", cover: "materials/kanno-lymph.jpg" },
      { type: "instagram", url: "https://www.instagram.com/lymphlady.assoc?igsi=Nnc3YXl5NXVyMTgy&utm_source=qr" },
    ],
  }),
  Object.assign(rosterMember("m14", "三村 隆", "株式会社エイレム・Guild Master株式会社 代表取締役", "Team Bloom∞🌸", "", ["beauty", "reform", "food"]), {
    business: "美容、リフォーム、飲食、プラットフォーム。",
    customers: "法人・個人問わず",
    wants: "幅広く対応可能です",
    triggers: ["美容", "リフォームしたい", "飲食店", "プラットフォーム"],
    targets: ["any"],
    prospects: ["owner", "staff", "individual"],
  }),
  Object.assign(rosterMember("m16", "桜羽 李果", "株式会社LEFANA/女性向けSNSブランディング", "Team Bloom∞🌸", "デザイン・ブランディング", ["branding", "sns", "web", "design", "video", "photo"]), {
    business: "女性向けに特化したデザイン会社。ブランディング、Web制作・運営・コンサルティング、グラフィックデザイン、SNS運用代行、インフルエンサー・モデルのキャスティング、写真・映像撮影、ビジネスマッチング。",
    customers: "女性向けの商材をお持ちの方、美容クリニック、お菓子・スイーツ業界、不動産",
    wants: "Webディレクター、Webデザイナー、SNS運用ディレクター、営業など(一緒に働く仲間)",
    triggers: ["女性向けの商品を売りたい", "ブランディング", "SNS運用を任せたい", "インフルエンサーを起用したい", "写真・動画の撮影", "Webデザイナーの仕事を探している", "経営者のコミュニティに入りたい", "事業者の仲間がほしい", "資産形成を学びたい"],
    note: "過去の経歴・実績:4ヶ月で1万人フォロワー達成/3万人フォロワー/PR案件100件以上実施/5000人の事業者コミュニティの代表。\n現在:2万人を超える「経営者/事業者」のコミュニティ運営(内5000人の事業者コミュニティの代表)/SNS運用代行(株式会社LEFANA):東京ガールズコレクションのデザイン全般をやっていた企業と業務提携し、複数の企業様のSNS運用などを行う/心身の周波数を整える唯一無二のお水事業/「コスパ最高の事業支援&日本トップの資産形成スクール」の広報。\n想い・夢:精神的にも経済的にも自立した女性を増やす/お互いを応援し合える勝たせ合える環境を作る/一歩踏み出すキッカケになる。",
    personal: "趣味:温泉旅行、サウナ、カラオケ、自然、動物、神社",
    targets: ["salon", "medical", "retail", "restaurant"],
    prospects: ["owner", "staff"],
    links: [
      { type: "proposal", url: "materials/sakuraba-profile.jpg", label: "桜羽 李果 プロフィール(経歴・実績・現在の活動)", cover: "materials/sakuraba-profile.jpg" },
      { type: "website", url: "https://www.lefana.net" },
    ],
  }),
  Object.assign(rosterMember("m17", "むらさき やえ", "COCOLOR(ココカラー)代表/波動を使った「あなた色ブランディング スタイリスト」", "Over", "美容・健康", ["color", "branding", "beauty", "spiritual"]), {
    business: "あなた色ブランディングプログラム/(内面)バースカラー診断/(外見)似合う色・質感・柄・形診断/(表現)ブランディングコンサル/スタイリング・ショッピング同行/(プロ養成)CoCoカラースタイリスト養成講座。",
    customers: "「すでに経験も実力もある。でも、まだ自分を活かし切れていない方」。自分の経験や能力をさらに活かし、自分らしく次のステージへ進みたい40〜60代の起業家・経営者・専門職・講師業の方。外見・発信・ブランディングを整え、仕事でも人生でも「自分らしく選ばれる存在」になりたい方。",
    wants: "【法人】アパレル&デザイン&広告関係/結婚相談所/起業支援事業 【個人】「実力はあるのに、なぜか選ばれない」「今の見せ方が本当の自分と合っていない」「これからの人生や仕事を自分らしくステージアップしたい」と感じている40〜60代の起業家・経営者・専門家",
    note: "CoCo(個々)カラースタイリスト。30年間、1,000名以上の方の人生に寄り添い、「自分色で生きる」サポートをしてきた。商業出版13冊、最新刊『FASHION STYLE 「似合う」を見極め「なりたい」を目指す』(ごきげんビジネス出版)。あなた色ブランディングは「あなたの能力(内面)×あなたの魅力(外見)→あなたブランド」。3ステップ:①命のタネに気づく(自分軸・他人軸)②命の育て方と咲かせ方を知る(スタイリング・ブランディング)③命を最大限に咲かせる(人生の“第二章”が開花)。無料体験会(90分・人数限定)あり。",
    triggers: ["実力はあるのに選ばれない", "見せ方を変えたい", "似合う色を知りたい", "パーソナルカラー", "ショッピング同行", "セルフブランディング", "自分らしさが分からない", "売上が安定しない", "何を着ればいいか迷う", "SNSで発信しても伝わらない", "次のステージへ行きたい", "人生の第二章を始めたい"],
    targets: ["retail", "pro", "any"],
    prospects: ["owner", "individual"],
    links: [
      { type: "proposal", url: "materials/murasaki-cocolor.jpg", label: "あなた色ブランディング ご案内(無料体験会)", cover: "materials/murasaki-cocolor.jpg" },
      { type: "website", url: "https://www.cocolor.biz" },
    ],
  }),
  Object.assign(rosterMember("m18", "髙橋 誠二", "スポーツ用品EC事業者/EC運営支援", "CANOW", "EC・ネットショップ", ["ec", "web"]), {
    business: "スポーツ用品のEC事業、EC運営支援。",
    triggers: ["ネットショップを始めたい", "ECの売上を伸ばしたい", "スポーツ用品"],
    targets: ["retail"],
    prospects: ["owner", "staff"],
  }),
  // 本人のご案内資料(2026年10月)で充実させる(電話番号は載せない)
  Object.assign(rosterMember("m19", "岡本 伸", "株式会社 心灯(こころび) 代表取締役/WEBマーケティング・ウェルスダイナミクス・ライバー育成", "Team Bloom∞🌸", "Web制作", ["web", "seo", "sns", "video", "coaching", "branding", "consult", "mindset", "liver"]), {
    business: "「あなたの心に灯を灯す会社」〜私(会社)満足率100%の人生を〜。①WEBマーケティング:集客・売上アップを実現するWEB戦略をトータルサポート(HP制作・SNS運用・SEO・MEO対策・AI動画)。②ウェルスダイナミクス:才能を可視化し、強みを活かす人生とビジネスの羅針盤。③ライバー育成:個性を活かして輝ける次世代ライバーを全力サポート。自己ブランディングビジネス(能力開発)。無料相談受付中(LINE でも相談できます)。",
    customers: "10名前後の法人様/目標達成が苦手な人/3年目の個人事業主/自分の強みを知りたい人/収入の柱を増やしたい人/時間や場所を選ばない働き方をしたい人",
    note: "携帯業界10年・店長経験、訪販会社で30,000件以上の訪問実績、ウェルスダイナミクス認定講師。「変わりたい」その想いが、未来を変える第一歩。自分の強みがわかる・収入の柱が増える・自由な働き方が手に入る。",
    triggers: ["HPを作りたい", "SNS運用を任せたい", "SEO・MEO対策", "AI動画", "目標が達成できない", "自分をブランディングしたい", "集客・売上を上げたい", "自分の強み・才能を知りたい", "ウェルスダイナミクス", "ライバーになりたい", "ライブ配信を始めたい", "収入の柱を増やしたい", "自由な働き方をしたい"],
    targets: ["any"],
    prospects: ["owner", "staff", "individual"],
    links: [
      { type: "proposal", url: "materials/okamoto-kokorobi.jpg", label: "株式会社 心灯 ご案内(事業内容)", cover: "materials/okamoto-kokorobi.jpg" },
    ],
  }),
  // 本人の資料「金策コンサル」(2026年10月)で充実させる
  Object.assign(rosterMember("m20", "柏木 本徳", "株式会社REVE 取締役/資金調達コンサル(金策コンサル)・脱毛サロン", "Team Bloom∞🌸", "お金・保険", ["funding", "beauty"]), {
    business: "資金調達コンサル「金策コンサル」(金の悩みを解決するパートナー):個人融資・事業融資・借金の借り換え。やり方次第で、金利を安く、支払い期間を長く、着金までを最短にできます。最適な方法をご提案し、成功率を最大化。ブラックリストの方も可能・秘密厳守で安心。\n脱毛サロン:脱毛・眉毛・エステ(大阪・心斎橋の都度払いサロン)。",
    customers: "資金調達:毎月の支払いが大変な人、まとまったお金がすぐ欲しい人、事業などで資金が必要な人、どこも審査が通らない人/サロン:清潔感が欲しい人、髭剃りが面倒な人、モテたい人",
    wants: "資金調達を希望の方/ブローカー(紹介業)の方/高単価商材を扱っている方",
    note: "金策コンサルの実績:累計サポート実績1000人以上・調達総額5億以上・成功率90%以上。",
    triggers: ["資金繰りが苦しい", "融資を受けたい", "借金を借り換えたい", "審査が通らない", "金利を下げたい", "支払い期間を延ばしたい", "早くお金が必要", "ブラックリストでも相談したい", "紹介業をしている", "高単価商材", "脱毛・エステ"],
    targets: ["any"],
    prospects: ["owner", "individual"],
    links: [
      { type: "proposal", url: "materials/kashiwagi-kinsaku.jpg", label: "金策コンサル ご案内(実績・できること)", cover: "materials/kashiwagi-kinsaku.jpg" },
    ],
  }),
  Object.assign(rosterMember("m21", "中川 敏和", "豪華客船アドバイザー", "CANOW", "暮らし・サービス", ["cruise", "family", "event"]), {
    kana: "ナカガワトシカズ",
    business: "豪華客船アドバイザー(インクルーズ)。",
    customers: "0〜5歳の子どものいるご家庭/新婚さん/65歳以上のご夫婦",
    wants: "結婚相談所/サロンオーナー/保険業",
    triggers: ["結婚相談所", "サロンを経営している", "保険の仕事", "新婚さん", "小さな子どものいる家庭", "シニアのご夫婦"],
    targets: ["salon", "pro"],
    prospects: ["owner"],
    links: [
      { type: "website", url: "https://profile-m-lp.my.canva.site/cluiseadviser" },
    ],
  }),
  // 本人の回答(2026年10月)をもとに書き直し。オンラインは全国、対面は新潟
  Object.assign(rosterMember("m22", "小林 末季こばねぇ", "preseia 代表/心を整えるマインドコーチ", "SunnyUp🌞", "人材・組織", ["mindset", "coaching", "org", "retention", "hiring", "branding", "voice", "mc", "health", "spiritual", "family", "kids", "color"], "新潟"), {
    business: "サポートメニュー:マインドコーチング(心のブレーキを外し、自分らしく進めるマインドを育てる)/自分軸・価値観整理/起業初心者向けビジネスコンサル(何から始めればいいかを一緒に整理し、形にする)/ビジネスマインド講座/コミュニケーション講座(伝える力・聴く力を磨き、信頼される関係を築く)/オンライン・リアルセミナー開催(全国オンライン対応・新潟リアル開催あり・少人数セミナー)。オンラインコーチング(個人・法人)。話すだけで頭の中が整理でき、モヤモヤが晴れて次の一歩が見えるようになります。マインド・メンタル系のセミナー・講座・講演(自己肯定感・やる気・モチベーション・コミュニケーション)。研修やセミナーの前に入れる、場をほぐすコミュニケーションのワークもお伝えできます。",
    customers: "個人事業主/起業家/一般の社会人",
    wants: "考えを整理したい・気軽に話せる相談相手がほしい経営者の方/社内向けのセミナー・研修を探している会社の方/マインドを整えて自己肯定感を上げたい方",
    triggers: ["人生迷子", "セミナージプシー", "人間関係に悩んでいる", "アロマ講座", "女性起業家のイベント", "頑張っているのに満たされない", "自分の軸がわからない", "想いをうまく言葉にできない", "行動したいのに不安で止まる", "自分らしい働き方を見つけたい", "人と比べて苦しくなる", "起業したばかりで何から始めればいいか分からない", "社内のコミュニケーションを良くしたい", "自己肯定感を上げたい", "やる気・モチベーションが下がっている", "モチベーションを上げたい", "セミナーの壁打ち相手がほしい", "セミナーにフィードバックがほしい", "相談相手がほしい", "頭の中を整理したい", "モヤモヤしている", "社内向けのセミナーを探している", "研修の前のアイスブレイク"],
    note: "年間400名以上と個別セッションを実施、3ヶ月で新規61件・成約率55%の実績。「会うだけで元気になる」と言われ、10分で打ち解けることから別名【コミュ力おばけ】。人生迷子さんや、成長したい経営者・個人事業主の方へ、まずは自分軸を整えることからサポート。新潟県在住・全国オンライン対応(新潟・長野のご縁も歓迎)。公式LINE に登録すると「価値観のズレ」チェックシート(PDF)を無料でもらえる。誰とでもすぐ仲良くなれる「コミュ力おばけ」が強み。話すだけで思考が整理でき、モヤモヤを解消できます。マインドセットが得意なので、研修・セミナーの前に入れるコミュニケーションのワークもお伝えできます。\n講師紹介より:人生迷子やセミナージプシーの方へマインドの整え方を教えています。コミュニケーションの達人:コミュニケーションや人間関係では悩んだことがなく、人との交流が得意。その人の個性を活かした日常から使えるコミュ力をお伝えしています。コーチングの専門家:コーチとはクライアントの目指すゴールまで一緒に進むガイド役。コーチングで大切にしているのはお互いの信頼関係と諦めない心です。\n経歴:アロマアドバイザー、パーソナルカラー色彩心理インストラクター、ISD個性心理学アドバイザー、ハーブトリートメントアドバイザー、YCSコーチングプログラム終了生、初起業者向けのアドバイスサポート、女性起業家イベント主催運営、アロマ講座プロデュース。",
    face: "新潟",
    faceAreas: ["niigata"],
    online: "all",
    targets: ["any"],
    prospects: ["owner", "staff", "individual"],
    links: [
      { type: "proposal", url: "materials/kobane-profile.jpg", label: "こばねぇ(小林 末季)ご案内・サポートメニュー", cover: "materials/kobane-profile.jpg" },
      { type: "sasaeai", url: "https://sasaeai.link-platform.jp/mypage/profile/member?profile_id=8118" },
    ],
  }),
  Object.assign(rosterMember("m23", "見上 恵", "ちきゅあそびくらぶ/AI絵本クリエイター、スクール講師、クリエイター募集", "Team Bloom∞🌸", "AI研修・AI活用", ["ai", "aitraining", "ehon", "design", "kids"]), {
    business: "AI絵本クリエイター、講座講師。",
    customers: "自分の想いを絵本にしたい方",
    triggers: ["想いを絵本にしたい", "自分史を絵本に残したい", "AI絵本", "クリエイターになりたい", "AIの講座を受けたい"],
    targets: ["any"],
    prospects: ["individual", "owner"],
  }),
  // 本人のプロフィール資料・野外音楽フェスのご案内(2026年10月)で充実させる(生年月日・出身・在住は載せない)
  Object.assign(rosterMember("m24", "栁橋 雅也", "合同会社フライコア(FlyCore LLC) 代表/地方創生プランナー・音楽野外フェス", "Team Bloom∞🌸", "暮らし・サービス", ["regional", "event", "inbound", "funding", "kids", "social", "consult", "efficiency", "reform", "realestate", "insurance"]), {
    business: "【メイン事業】合同会社フライコア(FlyCore LLC)「音楽と旅で、地域の未来を創る。」:音楽野外フェスの企画・運営を中心に、旅行・移動インフラ・地域資源・地域未来交付金を組み合わせ、持続可能な地方創生をトータルでプロデュース(音楽 × 旅 × 地域資源 × 制度活用で、人を呼び込み、経済を回し、未来につながるまちづくりへ)。事業内容:①音楽野外フェスの企画・運営(地域の魅力を最大限に活かした野外音楽フェスで、交流人口の拡大と経済効果を生む)②旅行・移動インフラの連携支援(観光・宿泊・交通と連携し、地域への人の流れをつくり、滞在・消費を促す)③地域資源の発掘・ブランディング(自然・食・文化・歴史など地域ならではの資源を、魅力あるコンテンツに磨き上げる)④地域未来交付金の活用支援(申請支援から計画立案・効果検証まで、採択・実施・成果創出をトータルでサポート)⑤自治体向けコンサルティング(地域の課題に寄り添い、持続可能で自走できる地方創生戦略を共に描き、伴走支援)。強み:音楽×旅×地域資源の融合/地域未来交付金の最大活用(制度理解から申請・実施・効果検証まで一貫してサポートし、自治体の負担を最小化)/企画・集客・運営・広報・スポンサー開拓までワンストップで実行できるプロデュース体制/一過性ではなく地域に根ざした継続可能な仕組みづくり。音楽野外フェスの経済効果(1,000人規模の例):来場者 約1,000人・宿泊者 約600人・経済波及効果 約3,700万円・投資対効果(ROI)約14.8倍。地域にもたらす価値:交流人口の拡大(関係人口・移住定住のきっかけ)、地域経済の活性化(消費・投資・事業者の売上や雇用の拡大)、地域ブランドの向上(メディア・SNSで認知度と魅力が向上)、持続可能な地域づくり。事業実施までの流れ:①課題把握・ヒアリング → ②事業計画ご提案 → ③交付金申請サポート → ④採択・実施・フェス開催 → ⑤効果検証・次年度展開。Web:flycore-llc.pages.dev。【子ども達への体験の活動】「行ったことない世界が、子ども達の未来を変える。」親が「うちの家庭はお金ない、時間ない」と言うことで子ども達の夢が失われないように、家庭の経済状況に関係なく、すべての子ども達に“体験”という最高のプレゼントを届ける活動。目指すこと:体験の機会を届ける(旅行・自然体験・文化交流など普段できない体験)/子どもの可能性を広げる(「やってみたい!」「なりたい!」という自己肯定感を育てる)/地域の魅力を伝える(地方の自然・文化・人とのふれあいで、ふるさとへの誇りを育てる)/地域経済の活性化(体験プログラムや観光で産業・雇用・人口減少対策にも)/みんなでつくる未来(行政・企業・地域団体・個人が協力して、子ども達の未来を支える持続可能な仕組み)。ご支援・ご協力を募集中。【そのほか】災害対策商材、AIシステム導入、内装造作費用0円、LED広告透過フィルム、FP(ファイナンシャルプランナー)。",
    wants: "地域を元気にしたい自治体・地域の方(地域未来交付金を活用したい自治体)/音楽野外フェスに出演してくれるアーティスト/フェスを協賛・支援してくれる企業(スポンサー)/フェスに出店してくれる地元の飲食店・物販のお店/観光・宿泊・交通(旅行会社・ホテル・旅館・鉄道・バス)の事業者/地域の特産品・食・文化を発信したい生産者や事業者/一緒にフェスをつくるボランティア/子ども達に体験を届ける活動を支援・協力してくれる企業・団体・個人",
    customers: "地方創生・まちづくりに取り組む自治体、交流人口・関係人口や観光客・宿泊客を増やしたい地域、地域資源をブランドにしたい事業者、税収を上げるための働きかけ・余った駐車場スペースの活用・作業効率の向上・内装費用のコスト削減などを考えている方",
    note: "理念は『1人から多数へ!1人の笑顔がまた1人へと、生命を与える! 地方創生から、みなぎる世界へ!』。学生時代は活動停止状態の野球部で自ら部員を集めて部を再建。大学ではドラムを担当してバンド活動を始め、卒業後はメジャーデビューを目指して音楽に専念。その後、大東建託で不動産営業、明治牛乳の訪問販売では月間150件の契約を獲得。34歳で海外積立事業を始め、生命保険会社へ。2019年に合同会社フライコアを設立して代表社員に就任し、広告のテレアポ営業で月間売上860万円を樹立。地方創生プランナーとの出会いから地方創生事業を始める。",
    triggers: ["地方創生", "地域を盛り上げたい", "音楽フェス", "野外フェス", "フェスに出演したい", "イベントに協賛したい", "イベントに出店したい", "ボランティアをしたい", "地域未来交付金", "交付金を活用したい", "自治体の課題を解決したい", "交流人口を増やしたい", "関係人口を増やしたい", "観光客・宿泊客を増やしたい", "地域ブランディング", "地域の特産品を売り出したい", "まちづくり", "子どもに体験をさせたい", "子どもの夢を応援したい", "体験格差", "子どもの支援に協力したい", "税収を上げたい", "駐車場が余っている", "災害対策", "内装費用を抑えたい", "LED広告", "AIシステムを導入したい", "お金の相談をしたい", "ライフプラン", "保険を見直したい"],
    targets: ["any"],
    prospects: ["owner", "staff"],
    links: [
      { type: "proposal", url: "materials/yanagibashi-flycore.jpg", label: "合同会社フライコア「音楽と旅で、地域の未来を創る。」事業のご案内", cover: "materials/yanagibashi-flycore.jpg" },
      { type: "proposal", url: "materials/yanagibashi-kids-taiken.jpg", label: "子ども達に「行ったことない世界」を ― 体験を届ける活動(ご支援・ご協力募集)", cover: "materials/yanagibashi-kids-taiken.jpg" },
    ],
  }),
  Object.assign(rosterMember("m25", "松田 依子", "株式会社Lift 代表取締役/ちきゅうあそびくらぶ", "Team Bloom∞🌸", "暮らし・サービス", ["ehon", "ai", "aitraining", "mc", "voice", "event", "consult", "kids", "health", "insurance"]), {
    business: "AI絵本(自分史絵本・エンディング絵本・感謝の絵本・子育て・親子・技術をわかりやすく等)、司会・MC、コンサル・プロデュース、コミュニケーション・ボイトレ・朗読、芦屋スマートラジオの企画運営・番組、イベント・パーティー企画、コミュニケーション講座、AI講座・AI動画、潜在意識・波動アップ、詐欺に遭わないための金融アドバイザー(本物か見抜く・海外保険・海外銀行等・税金対策)、美容・健康(Life wave・コロイドヨード)。",
    customers: "会社や自身や商品をもっと世に広めたい人、次世代に残したい思いのある人、自分史を絵本にしたい人、販売促進・集客したい人、自分を変えたい人、AI絵本クリエイター資格を学びたい人、AIを学びたい人、健康に困っている人、人生を変えたい人、ちきゅうあそびくらぶの理念に賛同し世界に羽ばたく活動に興味を持ってくれる人",
    wants: "会社や自身や商品をもっと世に広めたい人/次世代に残したい技術・思いのある企業・社長等/終活ビジネス(エンディング絵本)/AI絵本クリエイター資格をとって一緒に活動してくれるクリエイターになりたい人/新しいビジネススキルが欲しい人/ラジオ番組を持ちたい人",
    triggers: ["商品を世に広めたい", "自分史を残したい", "終活", "絵本を作りたい", "ラジオ番組を持ちたい", "司会を頼みたい", "AIを学びたい"],
    targets: ["any"],
    prospects: ["owner", "individual"],
    links: [
      { type: "website", url: "https://ornate-cocada-1a442b.netlify.app" },
      { type: "line", url: "https://line.me/R/ti/p/@283stuiy?oat_content=url&ts=09101141" },
    ],
  }),
  Object.assign(rosterMember("m26", "坂上 智子", "OHANAの輪 代表/地域密着型", "All Win🏆", "食・地域産品", ["social", "food", "kids", "event"]), {
    business: "子ども食堂の寄付金付き商品の販売、子ども食堂のイベント。",
    wants: "子ども食堂の寄付金付き商品を探しています(商品をお持ちの方)",
    triggers: ["子ども食堂", "寄付金付きの商品", "社会貢献をしたい", "地域のイベント", "商品の販路を広げたい"],
    targets: ["retail", "restaurant", "any"],
    prospects: ["owner", "individual"],
  }),
  Object.assign(rosterMember("m27", "一場 ゆな", "東京ケータリング", "", "食・地域産品", ["catering", "event", "food"]), {
    business: "ケータリング(イベント)。",
    triggers: ["ケータリングを頼みたい", "パーティー・懇親会の料理", "イベントの食事", "周年記念・社内パーティー", "セミナー後の交流会"],
    targets: ["any"],
    prospects: ["owner", "staff", "individual"],
  }),
  // 2026年10月、bt-ex.jp の BT-EX5 の名簿に新しく入った方(プロフィールはご本人が入れる)
  rosterMember("m28", "長田 恵美子", "", "", "", []),
];

// 名前のうしろに付いた呼び名(例:「小林 末季こばねぇ」の「こばねぇ」)を分ける。
// 漢字の名前のすぐあとに、ひらがな・カタカナが続くときだけ分け、カードなどでは2行に出す
function refNameParts(name) {
  const m = /^(.*[\u4e00-\u9fff\u3005])([\u3041-\u3096\u30a1-\u30fa\u30fc]{2,})$/.exec(String(name || "").trim());
  return m ? { main: m[1], nick: m[2] } : { main: String(name || ""), nick: "" };
}

// ほかの BT-EX のユニットのメンバー(bt-ex.jp のメンバー一覧から。2026年10月25日)。1on1・プレゼンの相手を選ぶときに使う。
// BT-EX5 はこのアプリの名簿そのもの(ここにいない方は、お名前を手で入れられる)
const BTEX_UNIT_MEMBERS = {
  1: ["佐藤 大介", "日田 伸幸", "伊藤 剛", "藤嶺 淳子", "寺本 勲", "金澤 洸貴", "山﨑 美優希", "松岡衣美 (えみゅーず)", "藤原 泉", "島村 一輝", "田中 吾郎", "菊地 智美", "日向 恵", "近野 華世", "城谷 コウ", "飯島 太呂", "塙 将博", "内山 由依子", "中野 未佳子", "熊川 和彦", "石田 祐介", "水落 磨樹", "MASAKI", "岸 宏保", "中田 侑太郎", "福永 あみ", "吉兼 直哉", "池田 誠", "宮下 将一", "柳田 高広", "鳥越 美耶", "有松 健太", "大竹 直美", "小松 茂子", "大谷 有紀子|gerochan", "金子 徹男", "田邊 哲也", "武村 岳人", "ねこすけ 福井", "堀内 千尋", "ぎゅうちゃん 小松れいな", "榊原 豊", "伊藤 正樹", "深澤 歩", "田中 良行", "仲山 一真", "希月 秀光"],
  2: ["水澤 連", "須山 舞夏", "佐久知 あみ", "福井 貴子", "生谷 直美", "竹内 友喜", "中川 覚郎", "横田 あつし", "藤澤 博章", "仲田 昌弘", "OK!!ShowGo 柴崎翔吾", "川村 英紀", "水谷 美根子", "前田 千賀子", "桝室 和寛", "三浦 健二", "守國 寿記", "澁川 光宏", "木村 晶子", "張本 美有", "綿谷 美佳", "狩俣 良一", "前田 祐里", "櫻井 靖子", "金子 麻里子", "中谷 志奈子", "髙橋 亜津子", "太田 剛"],
  3: ["白鳥 伸一", "村野 秀二", "東 志穂", "室井 茉里", "山崎 麻峰", "天田 幸宏", "斎藤 邦治", "瀧北 富明", "宮長 紀", "粟飯原 裕来", "岩瀬 よしの", "尾田 衣子", "飯田 梨良", "安斎 永樹", "小林 ちかふみ", "村井 芳久", "ウエノ シンゴ", "小林 ゆか", "佐久間 健寿", "夏川 Sunday", "信貴 啓佑", "小笠原 志帆", "佐藤 勇樹", "谷口 美保", "嶋 えりか", "小島 政文", "中村 友美", "西村 有貴", "中峰 剛", "高橋 拓真", "長谷川 浩幸", "越口 哲信", "小澤 陽一", "谷口 貴信", "マカロン 広美", "田中 裕美子", "平井 友香子", "西村 和子", "増山 拓也", "鈴木 峰雄", "坂本 和保", "田中 清", "大西 茂之", "有安 寿斗", "橘 杏奈", "五十嵐 蓮", "アモーレ 石上", "あやくも 智華子", "水谷 美優", "中村 正剛"],
  4: ["東橋 達矢", "下市 知佳", "髙木 剛", "眞清水 よしこ", "望月 泰成", "尾田 笑子", "衛藤 祥一", "田中 吾一", "間 実夏", "山内 陽子", "岡田 翔伍", "松下 真紀子", "おぎの まさみ", "中村 あずさ", "高田 真志", "田中 梢", "栁田 加奈子", "ナンバ ユキコ", "荻原 豪", "とん とん", "伊東 亜由", "酒谷 薫", "杉沼 俊和", "寺脇 智子", "池田 恭朋", "足立 裕次朗", "松本 香鶴央", "打矢 健一", "川井 智貴", "保井 秀一", "山元 あゆみ", "小島 啓誉", "山下 文恵", "明治 成慈", "三枝 孝伊", "もふみ (友枝かすみ)", "横田 亜佐恵", "中山 裕貴", "白岩 成友", "八田 奈緒美", "秋葉 麻里", "内田 彩加", "勝見 喜樹", "宮里 阿彌華"],
  5: null, // このアプリの名簿
  6: ["ウィリス 朋子", "もり めぐみ", "村上 嘉朗", "岩井 久典", "原田 あつ子", "根本 小百合", "野口 晃", "青木 めぐみ", "西野 惠子", "春川 美鈴", "樺良 侑香里", "富岡 光城", "塩満 彩子", "長谷川 豊", "井上 信子", "石田 水央", "堺 典子", "大森 裕貴", "高麗 淳子", "川本 一希", "田村 正斗"],
  7: ["吉野 正悟", "礒部 昌之", "服部 好江", "市川 さちえ", "熊坂 亮浩", "黒澤 篤", "寺内 正樹", "関戸 朋子", "畔見 知子", "土屋 正路", "周藤 縁", "マジシャン DAI", "太田 ちえこ", "矢口 健彦", "古賀 有紀", "宮崎 豊久", "井上 信次", "豊田 大和", "渡辺 将人", "伊佐治 依子", "土田 浩美", "松岡 知宏"],
  8: ["丸山 その子", "北條 愛", "鈴木 雄久", "和地 峰子", "清水 洋子", "さかえ みきこ", "武田 一樹", "佐藤 勇士", "山﨑 貴博", "杉原 かおり", "木村 潤子", "渡部 玉枝", "渡部 靖史", "わたなべ 皓至", "小山 有香", "Maayan (まーやん)", "赤地 周作", "市原 由紀", "菅野 幸悦", "小川 了大", "黒沼 玲太", "福崎 芳枝", "寺口 真弘", "堀内 千尋", "旗手 愛", "廣松 寛子", "本多 俊一"],
  9: ["本澤 龍", "奥森 九月", "杜丞 なおん", "福田 耕治"],
  10: ["近藤 陽子", "多嶋 僚介", "山本 晴功", "大野 和哉", "寺本 美乃里", "川本 光輝", "小野 はるの", "坂川 和穂", "兼重 日奈子", "高井 ちずこ", "安田 尚生", "堀田 将伍", "西村 健太郎", "和田 拓巳", "川端 健支"],
  11: ["白川 由美子", "MAKI マキ", "四ヶ所 伸一", "横辻 悠太", "猪飼 玲子", "工藤 大和", "宮守 洋輔", "竪道 美智代", "川崎 怜央", "大森 由佳子", "若松 大祐", "瑞野 りあ", "橋本 あけみ", "田中 みっち", "妻鹿 正裕"],
  12: [],
  13: ["堂元 亜希子", "鏑木 仁美", "佐藤 準", "鈴木 貴博", "中山 由己", "下原 貴武", "松本 美樹"],
  14: [],
};
// ユニットごとの人数(bt-ex.jp のメンバー一覧の表示のまま。2つのユニットに入っている方は、それぞれで数える)
const BTEX_UNIT_COUNTS = { 1: 48, 2: 28, 3: 50, 4: 44, 5: 26, 6: 21, 7: 22, 8: 27, 9: 4, 10: 15, 11: 15, 12: 0, 13: 7, 14: 0 };
// 全ユニットの人数(bt-ex.jp の「全ユニット」の表示。同じ方は1名と数える)
const BTEX_ALL_UNITS_TOTAL = 306;

// ほかの BT-EX のユニットの方のフリガナ・仕事・系列({ ユニット: { お名前: [フリガナ, 仕事, 系列] } })。
// 仕事と系列は bt-ex.jp のメンバー一覧から(2026年10月25日)。フリガナは定例会の出欠一覧から読み取れた方だけ。
// 1on1・プレゼンでお名前を選ぶとき、カタカナでも探せて、仕事も出る
const BTEX_UNIT_PROFILES = {
  1: {
    "佐藤 大介": ["サトウダイスケ", "AI実務者", "CANOW"],
    "日田 伸幸": ["ヒダノブユキ", "【環境に優しい】ハウス・エアコンクリーニング◎", "フェリシア"],
    "伊藤 剛": ["イトウゴウ", "AIシステム開発", "M-CARAT"],
    "藤嶺 淳子": ["フジミネジュンコ", "無添加調味料製造販売/エステサロン経営", ""],
    "寺本 勲": ["テラモトイサオ", "声・話し方から在り方まで整えるコンサル", "Realize Dreams"],
    "金澤 洸貴": ["カナザワコウキ", "空調工事", ""],
    "山﨑 美優希": ["ヤマザキミユキ", "理学療法士・ダイエットコーチ", ""],
    "松岡衣美 (えみゅーず)": ["マツオカエミ", "TimeWaverアナリスト(あなた本来の能力を最大限に活かすサポーター)", "CANOW"],
    "藤原 泉": ["フジワライズミ", "ファイナンシャルアドバイザー、海外取引コンサル、クロスボーダー取引アドバイザー、国際金融教育", "チーム無限"],
    "島村 一輝": ["シマムラカズキ", "イベントディレクター/逸般人会", "Paradise Junction"],
    "田中 吾郎": ["タナカゴロウ", "弁護士", "M-CARAT"],
    "菊地 智美": ["キクチトモミ", "健康特化型人生変えるエステサロン", "チーム無限"],
    "日向 恵": ["ヒナタメグミ", "ヘアメイクアップアーティスト", ""],
    "近野 華世": ["コンノカヨ", "販促プロモーション全般", "綺絆"],
    "城谷 コウ": ["ジョウヤコウ", "意識と身体を整える専門家", "CANOW"],
    "飯島 太呂": ["イイジマタロ", "月島のもんじゃ焼き店", ""],
    "塙 将博": ["ハナワマサヒロ", "不動産", "CANOW"],
    "内山 由依子": ["ウチヤマユイコ", "人材育成企業研修・プロフィール写真プロデュース", "CANOW"],
    "中野 未佳子": ["ナカノミカコ", "フェミニンケア講師", "CANOW"],
    "熊川 和彦": ["クマカワカズヒコ", "プロモーション&再生医療", "チーム無限"],
    "石田 祐介": ["イシダユウスケ", "塾長が教える「日本一わかりやすい金融教育」", "CANOW"],
    "水落 磨樹": ["ミズオチマキ", "フェムケア・オムケア", ""],
    "MASAKI": ["マサキ", "収益ジャンププロデューサー", "Paradise Junction"],
    "岸 宏保": ["キシヒロヤス", "売上と人生のステージを上げる 歌う天命ビジネス講師", "CANOW"],
    "中田 侑太郎": ["ナカタユウタロウ", "ペルソナクリエイター/紹介研究所・所長", "CANOW"],
    "福永 あみ": ["フクナガアミ", "人の心のトリセツ案内人/タレント・女優(池永亜美)", "CANOW"],
    "吉兼 直哉": ["ヨシカネナオヤ", "人物専門カメラマン", "CANOW"],
    "池田 誠": ["イケダマコト", "胡蝶蘭専門販売", "M-CARAT"],
    "宮下 将一": ["ミヤシタマサカズ", "電子技術の事業化ファクトリー & 研修講師", "綺絆"],
    "柳田 高広": ["ヤナギダタカヒロ", "Fashion director, Remake designer, Personal stylist, Senior model", ""],
    "鳥越 美耶": ["トリゴエミヤ", "大門焼鳥屋/霊気・潜在意識セッション/己書師範", "チーム無限"],
    "有松 健太": ["アリマツケンタ", "ビジネスプロデュース", "CANOW"],
    "大竹 直美": ["オオタケナオミ", "", ""],
    "小松 茂子": ["コマツシゲコ", "保険 営業代行", "チーム無限"],
    "大谷 有紀子|gerochan": ["オオタニユキコ", "3秒であなたが伝わるブランディングデザイナー", "チーム無限"],
    "金子 徹男": ["カネコテツオ", "ウェブ集客 SEO", "チーム無限"],
    "田邊 哲也": ["タナベテツヤ", "地方創生不動産/排出量取引による農地デベロッパー", "M-CARAT"],
    "武村 岳人": ["タケムラガクト", "有名アスリート講演主催", ""],
    "ねこすけ 福井": ["ネコスケフクイ", "丁寧なリストマーケティングで顧客獲得", "CANOW"],
    "堀内 千尋": ["ホリウチチヒロ", "数秘術コンサルタント", "M-CARAT"],
    "ぎゅうちゃん 小松れいな": ["ギュウチャンコマツレイナ", "印象プロデューサー", "CANOW"],
    "榊原 豊": ["サカキバラユタカ", "小さなお店の月商100万突破コーチ", "チーム無限"],
    "伊藤 正樹": ["イトウマサキ", "建設業界向けシステム", "CANOW"],
    "深澤 歩": ["フカザワアユミ", "LP専門WEBデザイナー", "CANOW"],
    "田中 良行": ["タナカヨシユキ", "ナノコロイドシリカ水販売", ""],
    "仲山 一真": ["ナカヤマカズマ", "", ""],
    "希月 秀光": ["キヅキヒデミツ", "", ""],
  },
  2: {
    "水澤 連": ["", "採用・プロフィール動画専門クリエイター", ""],
    "須山 舞夏": ["", "映像制作", "陽凪-ひなぎ-"],
    "佐久知 あみ": ["", "組織マネジメントコンサルタント", "Realize Dreams"],
    "福井 貴子": ["", "人生の巡りを整える開運セラピスト", "フェリシア"],
    "生谷 直美": ["", "", ""],
    "竹内 友喜": ["", "想いを伝えるホームページ制作", "チーム無限"],
    "中川 覚郎": ["", "", ""],
    "横田 あつし": ["", "", ""],
    "藤澤 博章": ["", "自動車関連許認可手続き", "チーム無限"],
    "仲田 昌弘": ["", "パソコン販売、AIエージェント導入支援、ビジネス麻雀コミュニティ運営", "チーム無限"],
    "OK!!ShowGo 柴崎翔吾": ["", "筆文字アーティスト", "満天"],
    "川村 英紀": ["", "オンラインビジネス構築マーケター", "Symargy"],
    "水谷 美根子": ["", "講座運営サポート/事務局運営", "L.S/太陽"],
    "前田 千賀子": ["", "", ""],
    "桝室 和寛": ["", "コーティング", "チーム無限"],
    "三浦 健二": ["", "NISA、保険、固定費削減", "チーム無限"],
    "守國 寿記": ["", "社会貢献", "All Win🏆"],
    "澁川 光宏": ["", "飲食(焼肉、中華)", "チーム無限"],
    "木村 晶子": ["", "玄米酵素 健康 腸活 美容", ""],
    "張本 美有": ["", "グラフィックデザイナー", "チーム無限"],
    "綿谷 美佳": ["", "次世代型ネイルチップ販売", "センターラブ"],
    "狩俣 良一": ["", "Kindle出版プロデュース", "Symargy"],
    "前田 祐里": ["", "ブランディングデザイン", "陽凪-ひなぎ-"],
    "櫻井 靖子": ["", "美容と健康アンチエイジング", "チーム無限"],
    "金子 麻里子": ["", "", ""],
    "中谷 志奈子": ["", "新規開拓 交流", "Realize Dreams"],
    "髙橋 亜津子": ["", "子育てカウンセラー/起業サポート", "L.S/太陽"],
    "太田 剛": ["", "", ""],
  },
  3: {
    "白鳥 伸一": ["シラトリシンイチ", "成果に繋げる商空間ディレクション", "チーム無限"],
    "村野 秀二": ["ムラノシュウジ", "", ""],
    "東 志穂": ["アズマシホ", "フォトグラファー", "CANOW"],
    "室井 茉里": ["ムロイミサト", "集客整理サポーター", "CANOW"],
    "山崎 麻峰": ["ヤマサキマミネ", "中小企業アドバイザー", "フェリシア"],
    "天田 幸宏": ["アマダユキヒロ", "独自化戦略コンサルタント", "綺絆"],
    "斎藤 邦治": ["サイトウクニハル", "ビジネスPRライター", "🍀ティーエフレールー"],
    "瀧北 富明": ["タキキタトミアキ", "経営の壁 突破コンサル", "CANOW"],
    "宮長 紀": ["ミヤナガハジメ", "風呂釜配管クリーン", "CANOW"],
    "粟飯原 裕来": ["アイハラヒロキ", "農業支援、イベントサポート", "Over"],
    "岩瀬 よしの": ["イワセヨシノ", "人がらと人間関係の専門家", "綺絆"],
    "尾田 衣子": ["オダキヌコ", "料理研究家・栄養サポーター", "CANOW"],
    "飯田 梨良": ["イイダリラ", "", ""],
    "安斎 永樹": ["アンザイエイキ", "特定技能1号による外国籍人材紹介・SES", "Team Bloom∞🌸"],
    "小林 ちかふみ": ["コバヤシチカフミ", "保険代理店/FP", ""],
    "村井 芳久": ["ムライヨシヒサ", "日本の食料自給率(現在38%)をUPしたい! 8050問題を併せて解決目指す!", "AND-X"],
    "ウエノ シンゴ": ["ウエノシンゴ", "唯一無二・愛着1着オーダースーツ", "綺絆"],
    "小林 ゆか": ["コバヤシユカ", "生命保険", "M-CARAT"],
    "佐久間 健寿": ["サクマタケヒサ", "本気の思いを世界に届けるラジオ局", "CANOW"],
    "夏川 Sunday": ["ナツカワサンデー", "人生をブランドする/ブランディングプランナー", "センターラブ"],
    "信貴 啓佑": ["シギケイスケ", "", ""],
    "小笠原 志帆": ["オガサワラシホ", "お庭のデザイン", ""],
    "佐藤 勇樹": ["サトウユウキ", "ボディメイクコーチ リラクゼーションサロン経営", "CANOW"],
    "谷口 美保": ["タニグチミホ", "印刷と出版(歴史と思い出を本にします)", "M-CARAT"],
    "嶋 えりか": ["シマエリカ", "中小企業診断士(あなたのビジネスの【売上・利益・共感の向上】を実現します)", "チーム無限"],
    "小島 政文": ["コジママサフミ", "家族の老後とお金を守る応援団", "L.S/太陽"],
    "中村 友美": ["ナカムラトモミ", "世界一の豚しゃぶ屋", "CANOW"],
    "西村 有貴": ["ニシムラユウキ", "ホワイトニングサロン", "M-CARAT"],
    "中峰 剛": ["ナカミネゴウ", "和紅茶の製造と販売", "Realize Dreams"],
    "高橋 拓真": ["タカハシタクマ", "たくマッスル", ""],
    "長谷川 浩幸": ["ハセガワヒロユキ", "AIコンサル、企業向けAIツールの販売", "CANOW"],
    "越口 哲信": ["コシグチテツノブ", "クリエイター(動画/イラスト/グラフィックデザイン)", "綺絆"],
    "小澤 陽一": ["オザワヨウイチ", "マンガチラシ制作実績日本一", "チーム無限"],
    "谷口 貴信": ["タニグチタカノブ", "人生をより豊かにする資産形成アドバイザー", ""],
    "マカロン 広美": ["マカロンヒロミ", "スキンケアブランド経営", "CANOW"],
    "田中 裕美子": ["タナカユミコ", "怪しいBAR経営/主催者に優しいレンタルサロン", "CANOW"],
    "平井 友香子": ["ヒライユカコ", "香りと脳のセラピスト", "綺絆"],
    "西村 和子": ["ニシムラカズコ", "傾聴からの強み発掘", "センターラブ"],
    "増山 拓也": ["マシヤマタクヤ", "資産運用するDJ", "綺絆"],
    "鈴木 峰雄": ["スズキミネオ", "男女の夜のパートナーシップ教育事業", "CANOW"],
    "坂本 和保": ["サカモトカズホ", "固定費改善アドバイザー", "CANOW"],
    "田中 清": ["タナカキヨシ", "スキンケア、健康食品", "綺絆"],
    "大西 茂之": ["オオニシシゲユキ", "事業の最大化/資金調達", "CANOW"],
    "有安 寿斗": ["アリヤスカズト", "見えないズレを整えるエネルギーコンダクター", "CANOW"],
    "橘 杏奈": ["タチバナアンナ", "コーチングコンサルティング支援/資産運用保全/コミュニティ運営", ""],
    "五十嵐 蓮": ["イガラシレン", "みんなの脱毛TSURURIN/ホワイトスマイル協会/SUIREN SELECT STORE", "CANOW"],
    "アモーレ 石上": ["アモーレイシガミ", "男性向け恋愛アドバイザー/派遣合コン/営業代行・交流会参加代行/富裕層向け投資・運用提案", "All Win🏆"],
    "あやくも 智華子": ["アヤクモチカコ", "自走組織&マネージメントコーチ", "チーム無限"],
    "水谷 美優": ["ミズタニミユ", "", ""],
    "中村 正剛": ["ナカムラマサタケ", "翻訳(英日、日英)", ""],
  },
  4: {
    "東橋 達矢": ["トウハシタツヤ", "三方よしセミナープロデューサー", "🍀ティーエフレールー"],
    "下市 知佳": ["シモイチチカ", "", ""],
    "髙木 剛": ["タカキゴウ", "", ""],
    "眞清水 よしこ": ["マシミズヨシコ", "社交戦略コンサルタント", "M-CARAT"],
    "望月 泰成": ["モチヅキタイセイ", "", ""],
    "尾田 笑子": ["オダエミコ", "", ""],
    "衛藤 祥一": ["エトウショウイチ", "DXコンサルタント/Lark導入支援", "CANOW"],
    "田中 吾一": ["タナカゴイチ", "地域No.1を生み出す専門家", "CANOW"],
    "間 実夏": ["ハザマミカ", "AI/Webコンサルタント", "Realize Dreams"],
    "山内 陽子": ["ヤマウチヨウコ", "真の礼の心で社長の脳内整理のお手伝い", "センターラブ"],
    "岡田 翔伍": ["オカダショウゴ", "出版・メディア進出プロデュース", "CANOW"],
    "松下 真紀子": ["マツシタマキコ", "整備済リユース介護ベッド・ガラスコーティング", "チーム無限"],
    "おぎの まさみ": ["オギノマサミ", "45歳以上でも3ヶ月で話せる英語コーチ", "🍀ティーエフレールー"],
    "中村 あずさ": ["ナカムラアズサ", "フリーランス歯科衛生士", "CANOW"],
    "高田 真志": ["", "オーダー事業", ""],
    "田中 梢": ["タナカコズエ", "伴走型コンサル", ""],
    "栁田 加奈子": ["ヤナダカナコ", "ファイナンシャルコーチ", "One World🌏"],
    "ナンバ ユキコ": ["ナンバユキコ", "一人経営者のための集客導線とAI事務局構築サポート", "Realize Dreams"],
    "荻原 豪": ["オギハラツヨシ", "紫微斗数鑑定士/鑑定士養成講座運営", "Realize Dreams"],
    "とん とん": ["トントン", "中華圏専門SNSコンサルタント", "CANOW"],
    "伊東 亜由": ["イトウアユ", "タイルクリエーター&インスタ講師", "M-CARAT"],
    "酒谷 薫": ["サカタニカオル", "コマーシャルフォトグラファー", "センターラブ"],
    "杉沼 俊和": ["スギヌマトシカズ", "プロテイン販売", "🍀ティーエフレールー"],
    "寺脇 智子": ["テラワキトモコ", "SNS集客ひとり立ちコーチ", "陽凪-ひなぎ-"],
    "池田 恭朋": ["イケダヤストモ", "快眠鍼灸師", "CANOW"],
    "足立 裕次朗": ["アダチユウジロウ", "スピリチュアルカウンセラー", "CANOW"],
    "松本 香鶴央": ["マツモトカヅオ", "最初の一歩だけダイエットコーチ", "CANOW"],
    "打矢 健一": ["ウチヤケンイチ", "長期優良住宅、60年無結露保証/20年耐震保証/30年メンテナンスフリー/全棟換気測定実施", "M-CARAT"],
    "川井 智貴": ["カワイトモキ", "整体業・足と靴の専門家", "M-CARAT"],
    "保井 秀一": ["ヤスイシュウイチ", "業務改善からWebなど情報発信までAIも活用して対応します", "フェリシア"],
    "山元 あゆみ": ["ヤマモトアユミ", "骨格×食生活", ""],
    "小島 啓誉": ["コジマヒロタカ", "", ""],
    "山下 文恵": ["ヤマシタフミエ", "人間関係取説コンサル", "CANOW"],
    "明治 成慈": ["メイジセイジ", "", ""],
    "三枝 孝伊": ["サエグサタカタダ", "顧客心理セールスコンサル", "CANOW"],
    "もふみ (友枝かすみ)": ["モフミトモエダカスミ", "見える化プランナー", ""],
    "横田 亜佐恵": ["ヨコタアサエ", "ニオイの専門家", "M-CARAT"],
    "中山 裕貴": ["ナカヤマヒロキ", "", ""],
    "白岩 成友": ["シライワマサトモ", "記者もうなるプレスリリースで貴社を広くPRします。", "M-CARAT"],
    "八田 奈緒美": ["ハッタナオミ", "骨盤底筋体操導入サポート", "CANOW"],
    "秋葉 麻里": ["アキバマリ", "", ""],
    "内田 彩加": ["ウチダアヤカ", "恵比寿エリア唯一5年連続4つ星サロン", ""],
    "勝見 喜樹": ["カツミヨシキ", "", ""],
    "宮里 阿彌華": ["ミヤザトアヤカ", "", ""],
  },
  6: {
    "ウィリス 朋子": ["", "なりたい自分が叶うわがまま英語術™", "Smile😊"],
    "もり めぐみ": ["", "組織を支えるスーパー事務員さん", "AND-X"],
    "村上 嘉朗": ["", "ビジネスコーチ｜自分の軸から、経営と人生を動かす", "AND-X"],
    "岩井 久典": ["", "Tシャツプリント", "AND-X"],
    "原田 あつ子": ["", "和の心和のエクササイズ", "One World🌏"],
    "根本 小百合": ["", "信頼×良い目立ち集客力UPサポート", "AND-X"],
    "野口 晃": ["", "蛇口を捻ったら水素水/管理医療機器レンタル", "AND-X"],
    "青木 めぐみ": ["", "Mrs of the Year群馬大会統括プロデューサー", "AND-X"],
    "西野 惠子": ["", "", ""],
    "春川 美鈴": ["", "口腔ケア", "One World🌏"],
    "樺良 侑香里": ["", "香バラ数秘術鑑定家&障がい福祉支援", "♡STARS"],
    "富岡 光城": ["", "玄米酵素販売", "ミライア"],
    "塩満 彩子": ["", "ママも楽しめるおもちゃ作り", "♡STARS"],
    "長谷川 豊": ["", "健康×環境", "CANOW"],
    "井上 信子": ["", "大人の陽知苑「のっこ」", "♡STARS"],
    "石田 水央": ["", "元ソフトバンク企画職が手掛ける資料設計プロデュース", "Smile😊"],
    "堺 典子": ["", "顔も体もマイナス12歳!顔ヨガスペシャリスト!", "AND-X"],
    "大森 裕貴": ["", "クラウドファンディング伴走支援", "綺絆"],
    "高麗 淳子": ["", "群馬県", "All Win🏆"],
    "川本 一希": ["", "特殊印刷会社経営・経営者向けビジネスコーチ・FP", "L.S/太陽"],
    "田村 正斗": ["", "", ""],
  },
  7: {
    "吉野 正悟": ["", "カメラマン/コミュニティ運営/レンタルスタジオ事業", "M-CARAT"],
    "礒部 昌之": ["", "探偵", "M-CARAT"],
    "服部 好江": ["", "着物の家庭教師", "♡STARS"],
    "市川 さちえ": ["", "smileメンタルアドバイザー", "One World🌏"],
    "熊坂 亮浩": ["", "出張料理人", "Rankers🏆"],
    "黒澤 篤": ["", "カプセルアート", "M-CARAT"],
    "寺内 正樹": ["", "AI共存型 経営労務参謀/宇宙社労士・行政書士", "M-CARAT"],
    "関戸 朋子": ["", "着物スタイリスト", "♡STARS"],
    "畔見 知子": ["", "オンライン秘書サービス", "M-CARAT"],
    "土屋 正路": ["", "介護資金プランナー/サードライフティーチャー", "🍀ティーエフレールー"],
    "周藤 縁": ["", "", ""],
    "マジシャン DAI": ["", "マジシャン/研修講師", "M-CARAT"],
    "太田 ちえこ": ["", "ビューティー漢方の専門家 オンラインスクール", "CANOW"],
    "矢口 健彦": ["", "生産性アップの専門家/中小企業診断士", "綺絆"],
    "古賀 有紀": ["", "陰陽師", "チーム無限"],
    "宮崎 豊久": ["", "デジタルウェルビーイング教育講師", "M-CARAT"],
    "井上 信次": ["", "女性起業家限定ソーシャルビジネスモデル構築サポート", "M-CARAT"],
    "豊田 大和": ["", "代理店営業(負債、男性医療)", "CANOW"],
    "渡辺 将人": ["", "人、犬、猫、馬のオステオパシー", "M-CARAT"],
    "伊佐治 依子": ["", "あなたの人生設計をするライフコンサルタント/生命保険、損害保険", "♡STARS"],
    "土田 浩美": ["", "魔法のかけ汁料理家", "♡STARS"],
    "松岡 知宏": ["", "ボードゲームカフェ", "M-CARAT"],
  },
  8: {
    "丸山 その子": ["", "再生美容/レンタルサービス事業", "CANOW"],
    "北條 愛": ["", "余裕も生まれるSNSマインドコンサルタント", "CANOW"],
    "鈴木 雄久": ["", "シニアトライアスロンコーチ/触らない整体師", "CANOW"],
    "和地 峰子": ["", "レジンアクセサリー作家、講師", "AND-X"],
    "清水 洋子": ["", "肌&体の健康", "M-CARAT"],
    "さかえ みきこ": ["", "身体と意識のプロフェッショナル/セラピスト養成", "CANOW"],
    "武田 一樹": ["", "人生の晩年をサポートする司法書士", "M-CARAT"],
    "佐藤 勇士": ["", "オイスターバル", ""],
    "山﨑 貴博": ["", "頭蓋骨専門サロン / ZUGAI-BALANCE", "CANOW"],
    "杉原 かおり": ["", "ファッションスタイリスト/酸素ミスト代理店", "CANOW"],
    "木村 潤子": ["", "アロマディフューザーレンタルサービス", "CANOW"],
    "渡部 玉枝": ["", "メンタルトレーナー", "CANOW"],
    "渡部 靖史": ["", "港区タワマン内装リフォーム営業", "CANOW"],
    "わたなべ 皓至": ["", "", ""],
    "小山 有香": ["", "", ""],
    "Maayan (まーやん)": ["", "動画クリエイター", "CANOW"],
    "赤地 周作": ["", "AI導入", "CANOW"],
    "市原 由紀": ["", "フェムケア・オムケア/イメージングトレーナー", "CANOW"],
    "菅野 幸悦": ["", "ロケ出張フォトグラファー", "M-CARAT"],
    "小川 了大": ["", "ライブハウスオーナー", "CANOW"],
    "黒沼 玲太": ["", "事業・経営コンサルティング", "チーム無限"],
    "福崎 芳枝": ["", "ソプラノ歌手/ボイストレーナー", "M-CARAT"],
    "寺口 真弘": ["", "接骨院", "M-CARAT"],
    "堀内 千尋": ["ホリウチチヒロ", "数秘術コンサルタント", "M-CARAT"],
    "旗手 愛": ["", "犬服 カメラマン", "M-CARAT"],
    "廣松 寛子": ["", "絶対に美味しいと言ってもらえるお茶の販売", ""],
    "本多 俊一": ["", "フォトグラファー", "M-CARAT"],
  },
  9: {
    "本澤 龍": ["", "", ""],
    "奥森 九月": ["", "広告名刺®コンサルタント", "🍀ティーエフレールー"],
    "杜丞 なおん": ["", "事業コンシェルジュ", "CANOW"],
    "福田 耕治": ["", "お客さんから「欲しい」と言われる、セールス戦略コンサル", "CANOW"],
  },
  10: {
    "近藤 陽子": ["コンドウヨウコ", "会員制サードプレイス / カフェコスモス", "Realize Dreams"],
    "多嶋 僚介": ["タジマリョウスケ", "保険解体屋/子どものお金教育", "CANOW"],
    "山本 晴功": ["", "紹介するだけの不動産ビジネス", "Realize Dreams"],
    "大野 和哉": ["オオノカズヤ", "5万円からのホームページ制作", "翔"],
    "寺本 美乃里": ["テラモトミノリ", "人生の「次の一章」をデザインするライフキャリアコーチ", "Realize Dreams"],
    "川本 光輝": ["カワモトコウキ", "イベントプランナー", "CANOW"],
    "小野 はるの": ["オノハルノ", "性愛カウンセラー", "センターラブ"],
    "坂川 和穂": ["サカガワカズホ", "ビジネス系動画", "CANOW"],
    "兼重 日奈子": ["カネシゲヒナコ", "映画のような映像であなたをPR!脚本家の動画制作", "Realize Dreams"],
    "高井 ちずこ": ["タカイチズコ", "「よさカード」で安心感に満ちた場づくり・研修講師", "Realize Dreams"],
    "安田 尚生": ["", "", ""],
    "堀田 将伍": ["ホッタショウゴ", "AI×SNSコンサルタント", "CANOW"],
    "西村 健太郎": ["ニシムラケンタロウ", "営業商材の宝箱", "Challengers"],
    "和田 拓巳": ["ワダタクミ", "補助金・助成金/0→1/販路開拓", "CANOW"],
    "川端 健支": ["カワバタケンジ", "ペットのメモリアルムービー制作", "Realize Dreams"],
  },
  11: {
    "白川 由美子": ["シラカワユミコ", "印象設計スタイリスト/垢抜けない管理職世代の男性ファッションを素敵に見せる", "Realize Dreams"],
    "MAKI マキ": ["マキマキ", "ポチらせる集客デザインコンサルタント", ""],
    "四ヶ所 伸一": ["シカショシンイチ", "ゲームで不登校を支えるAI講師", "Realize Dreams"],
    "横辻 悠太": ["ヨコツジユウタ", "教育プラットフォーム/補助金×マーケティング", "Realize Dreams"],
    "猪飼 玲子": ["イカイレイコ", "オンライン片付けサポート", ""],
    "工藤 大和": ["クドウヤマト", "官民連携・公共調達支援", "チーム無限"],
    "宮守 洋輔": ["ミヤモリヨウスケ", "GoogleMAPクチコミ対策/集客支援/プロポーズ伴走支援サービス", "CANOW"],
    "竪道 美智代": ["タテミチミチヨ", "", ""],
    "川崎 怜央": ["カワサキレオ", "組織のブランディングを確立させる映像クリエイター", ""],
    "大森 由佳子": ["オオモリユカコ", "オンラインプロ家庭教師育成・学習相談", ""],
    "若松 大祐": ["ワカマツダイスケ", "資産の最適な出口をご提案するファイナンシャルプランナー", "CANOW"],
    "瑞野 りあ": ["ミズノリア", "事業家の想いを刺さる企画に変えるコピーライター", "Realize Dreams"],
    "橋本 あけみ": ["", "人との距離の縮め方♡コミュ力UP", "Realize Dreams"],
    "田中 みっち": ["タナカミッチ", "", ""],
    "妻鹿 正裕": ["メガマサヒロ", "あなたのためのホームページ制作/WEBのことならとりあえず相談できる人", "センターラブ"],
  },
  13: {
    "堂元 亜希子": ["", "水素ガス吸入器、風呂、水素水生成器/共同購買ネットワークを活用した製品の販売(消耗品、建材)", "CANOW"],
    "鏑木 仁美": ["", "占いカウンセラー", "♡STARS"],
    "佐藤 準": ["", "男性向け恋愛婚活サポート/商品作りサポート コーチング", "CANOW"],
    "鈴木 貴博": ["", "貴方のないたいを叶える専門家", "Onephoria🐼"],
    "中山 由己": ["", "", ""],
    "下原 貴武": ["", "ハウスクリーニング", "チーム無限"],
    "松本 美樹": ["", "ビジネス構築コンサルタント育成/サンキューセールス講師", "AND-X"],
  },
};
// 出欠一覧にいて、上の一覧にまだいない方を足す(お名前の空白・記号のちがいは同じ方とみなす)
Object.keys(BTEX_UNIT_PROFILES).forEach((u) => {
  const list = BTEX_UNIT_MEMBERS[u] || (BTEX_UNIT_MEMBERS[u] = []);
  const key = (x) => String(x).replace(/[\s　|｜()（）]/g, "");
  Object.keys(BTEX_UNIT_PROFILES[u]).forEach((name) => { if (!list.some((y) => key(y) === key(name))) list.push(name); });
});

// 定例会の進行スライド(プレゼンの画面の「定例会をはじめる」で、オープニングムービーのあとに進行表の順で出す)。
// 進行表(定例会の「進行」)の ①〜⑦ の行から、区切りのスライドを作る。下はその中に入れる中身
const BTEX_DECK = {
  // ①はじめのあいさつ: 代表の紹介(写真は本人がアプリで入れたもの)
  leader: {
    memberId: "m16",
    title: "BT-EX5 代表",
    kana: "サクラバ リカ",
    achievements: ["4ヶ月で\n1万人フォロワー達成", "3万人フォロワー", "PR案件 100件以上", "5000人の事業者コミュニティ\nの代表"],
    now: [
      "2万人を超える「経営者・事業者」のコミュニティ運営(うち5000人の事業者コミュニティの代表)",
      "SNS運用代行(株式会社LEFANA):\n東京ガールズコレクションの\nデザイン全般を手がけた企業と\n業務提携し、複数の企業の\nSNS 運用を行う",
      "心身の周波数を整える、唯一無二のお水事業",
      "「コスパ最高の事業支援 &\n日本トップの資産形成スクール」の広報",
    ],
    dreams: ["精神的にも経済的にも自立した女性を増やす", "お互いを応援し合える\n勝たせ合える環境をつくる", "一歩踏み出すキッカケになる"],
  },
  // ②BT-EXの理念
  // 段落ごと。\n のところで改行して出す
  about: [
    "LINK や BT の中の「BNI」「守成クラブ」「ニーズマッチ」の\nそれぞれの強みを取り入れた事業者コミュニティです",
    "LINK の市場としての価値や\nBT のビジネススキル向上の仕組みの上に成り立っている\n唯一無二のビジネスコミュニティと言えます",
    "それぞれの強みを掛け合わせることで\n事業主のビジネスや BT の拡大などにおいて\n相乗効果的な発展が見込めます",
  ],
  name: "BT-EX",
  en: "Breakthrough Expansion",
  philosophy: "突破から、拡張へ",
  vision: "貢献と成果が循環\nし続ける事業家集団へ", // \n のところで改行して出す(下の目的・ベネフィットも同じ)
  // 理念のあとに続くスライド(BT-EX の資料から)
  purposes: ["メンバーの事業拡大", "LINK・BT の\n仕組み活用の促進", "メンバーの協業の促進", "BT-EX の拡大"],
  feature: { title: "BT-EX5 の特徴", lines: ["日本海側最大のマーケット", "新潟 ⇔ 東京"] },
  // head は資料の文の要点(カードの見出し)
  benefits: [
    { head: "コミットで加速", text: "出席とリファーラルと\n1on1 のコミットにより\nビジネスを加速させる" },
    { head: "会中の発信と商談", text: "会中の 1分プレゼン、メインプレゼン、\nテーブル商談、プチマルシェにより\nビジネスを加速させる" },
    { head: "20,000人の市場", text: "会員拡大の仕組みに加え\nLINK の 20,000人の市場で\n告知やセミナー、テストマーケなど使い放題" },
    { head: "スキルの向上", text: "エデュケーションコーナー・\nBT スクール連携により\nビジネススキルの向上" },
    { head: "10,000人の人脈", text: "系列を超えて、BT 10,000人の中からポジティブな人脈の構築" },
    { head: "リアルな絆", text: "毎月のリアルな懇親会で\n絆を深くする" },
    { head: "強いチームづくり", text: "深い 1on1 により\n強固なビジネスチームや\nコラボレーションの構築" },
    { head: "市場をフル活用", text: "セールスイベントで\nLINK や BT の市場をフル活用" },
    { head: "信頼の証", text: "BT-EX のメンバーということ自体が\n信頼感につながる" },
  ],
  activities: [
    // 「パターン1:」のように「:」で始まる行の続きの行は、「:」のあとにそろえて出す
    { title: "月2回の定例会", lines: ["パターン1:リアル定例会\n& オンライン定例会", "パターン2:オンライン定例会 2回", "パターン3:リアル定例会 2回"] },
    { title: "会員拡大活動\n& 市場取り活動", lines: ["メンバーのプレゼンや\nメンバーサイト・\n日頃の 1on1 により\n常に紹介できる人脈を探す活動"] },
    { title: "1on1 ミーティング", lines: ["定型の 1on1 シートにより\n効果的なビジネスミーティング\nをしていく活動"] },
  ],
  // カードの絵(並び順に対応。round.js の LINE_ICONS の名前)
  purposeIcons: ["growth", "link", "users", "widen"],
  benefitIcons: ["target", "mic", "globe", "school", "network", "heart", "users", "cart", "shield"],
  activityIcons: ["calendar", "network", "chat"],
  // BT-EXとは の式(LINK の市場 × BT のスキル × 3つの強み = BT-EX)
  formula: [["globe", "LINK の市場"], ["school", "BT のビジネススキル"], ["spark", "BNI・守成クラブ・ニーズマッチの強み"]],
  // ⑤商談の区切りのあとに出すスライド(BT-EX の資料から)
  fits: {
    title: "BT-EXは、このような人のお役に立てます!",
    items: [
      "LINKで思うように集客できない方", "自分のチームメンバーが集客に困っている方", "LINKでお仕事の紹介がもらえない方",
      "マーケティングスキルを学びたい方", "B.T.でビジネスパートナーを見つけたい方", "B.T.で横のつながりが欲しい方",
      "前向きに組織構築したい方", "MLMに苦手意識がある方", "LINKの紹介を出すのが苦手な方", "LINKの紹介を出すのが苦手な\nチームメンバーがいる方",
    ],
  },
  strengths: {
    title: "BT-EXは、LINK、BNI、守成クラブのそれぞれの強み",
    groups: [
      { name: "LINKの強み", items: ["集客の市場がある", "出会いの場が多い", "全体告知ができる", "学びの場が多い", "講師をすることができる", "権利収入がもらえる", "影響力を持てる", "会費が安い", "ブランディング", "仲間ができる", "多馬力", "MLMがOK"] },
      { name: "BNIの強み", items: ["リファーラル・出席をコミット", "1to1文化", "パワーチームの形成", "メンバーシップ委員機能", "毎週のプレゼン(Weekとメイン)", "Givers Gainの精神", "毎回固定メンバー", "40年以上の歴史"] },
      { name: "守成クラブの強み", items: ["リアルな関係構築", "テーブル商談", "複数の定例会に参加できる", "都道府県ごとの団結力が強い", "定例会後の懇親会"] },
    ],
  },
  // 規定(《 》で囲んだところは強調して出す)
  rules: {
    title: "BT-EX の\n一般規定・倫理規定・出席規定",
    general: [
      "BT-EXメンバーは、LINKのB.T.会員とする",
      "BT-EXメンバーは、LINKの会員規約に\n準ずるものとする",
      "紹介活動+1on1の合計値が《3件/月》以上をコミットすること",
      "定例会中、交流会中の商品の売り込み、他社MLM・宗教・政治団体への勧誘を禁ずる",
      "不正または違法な事業者の入会を禁ずる",
      "金融商品においては、金融庁登録番号を\n取得している業者に限る",
      "ビジターと1on1をする際は、その招待者を通す\nまたは情報を共有すること\nメンバーと招待者はその責任において\n(アポの確認や規定の遵守など)ビジターを\nフォローまたは対応すること",
    ],
    attendance: [
      "所属ユニットの出席は月1回以上\n月2回のうち1回は他ユニットの\n出席もカウントとする",
      "無断欠席・遅刻早退は禁止\n《(2回の遅刻、早退で1回欠席扱い)》",
      "最低年《12回》は自ユニットに出席すること",
      "同一人物のビジター参加は2回までとする\n＊BT-EXフェスは何度でも参加可能",
    ],
    note: "規定に関しては必要に応じて6ヶ月タームで見直しの合議を設ける",
    // 数字で見る約束(規定の前のスライド)。[数字, 説明]
    kpis: [["3件/月", "紹介活動 + 1on1 の合計"], ["月1回以上", "所属ユニットへの出席"], ["年12回", "自ユニットへの最低出席"], ["2回まで", "同じ方のビジター参加"]],
    // 規定のカードの見出し(規定と同じ順。文はそのまま下に出す。《 》で囲んだところは下に波線)と絵(round.js の LINE_ICONS の名前。ban は禁止の印)
    heads: {
      general: ["LINK の B.T.会員", "LINK の会員規約に準ずる", "紹介活動+1on1 3件/月", "売り込み・勧誘の禁止", "不正・違法な事業者の禁止", "金融商品は登録業者のみ", "ビジターとの1on1は招待者を《必ず》通す"],
      attendance: ["所属ユニット 月1回以上", "無断欠席・遅刻早退の禁止", "自ユニット 年12回以上", "ビジター参加は2回まで"],
      ethics: ["誠実なサービスと価格", "誠実に向き合う", "信頼を積み重ねる", "前向きに支え合う", "プロとしての責任", "互いを尊重する"],
    },
    icons: {
      general: ["idcard", "doc", "target", "ban", "ban", "bank", "visitor"],
      attendance: ["users", "ban", "calendar", "visitor"],
      ethics: ["shield", "heart", "link", "spark", "award", "chat"],
    },
    ethics: [
      "安心して選んでいただけるように、誠実なサービスと分かりやすい価格を大切にします",
      "メンバーにも、その先の大切なご縁にも\nいつも誠実な気持ちで向き合います",
      "一つひとつの関わりを大切に\n信頼が積み重なる関係を育てていきます",
      "前向きな気持ちと、支え合う姿勢を大切にします",
      "自分の仕事に誇りを持ち\nプロとしての責任を大切に行動します",
      "公の場やチャットにおいても\nメンバーやグループへの否定的な発言は控え\n互いを尊重するコミュニケーションを大切にします",
    ],
  },
  // ⑥LINKのビジネス実績紹介のあとの「挙手をお願いします」(《 》は強調)
  raise: [
    {
      title: "1on1・リファーラル・招待ビジターの発表",
      items: ["1on1", "リファーラル", "招待ビジター"],
      text: "について\n発表できる方は\n挙手をお願いします",
      note: "※ ありがとうマイルは《次のページで発表》します\nここでは発表しないでください",
    },
    {
      title: "ありがとうマイルの発表",
      items: ["ありがとうマイル"],
      text: "について\n発表できる方は\n挙手をお願いします",
      note: "",
    },
    {
      title: "LINK内での実績紹介の発表",
      items: ["LINK内での実績紹介"],
      text: "について\n発表できる方は\n挙手をお願いします",
      note: "",
    },
  ],
  // ⑦終わりの挨拶: 入会への3ステップ → アンケート → 出席コード → おわり
  joinSteps: {
    title: "BT-EX5 入会への簡単な3ステップ",
    steps: [
      { head: "LINKへの入会", text: "" },
      { head: "BT-EX5 入会", text: "" },
      { head: "ユニット選択", text: "BT-EX5 を選択" },
    ],
    // カードの外(Step1・Step2 の下)にまとめて出す注意書き。noteSpan は、はじめから何枚目のカードまでにかかるか
    note: "入会希望の方はご紹介者の方へお聞きください",
    noteSpan: 2,
  },
  survey: {
    title: "定例会のアンケート",
    lead: "本日のBT-EX5の定例会の感想をお聞かせください(2〜3分)",
  },
  attend: {
    title: "出席コード",
    lead: "bt-ex.jp の「出席コード 入力」から\n本日の4桁のコードを入れてください",
    note: "出席コードの入力は、開催開始から24時間以内です",
    video: "assets/video/attendance-code-howto.mp4",
  },
  // エデュケーションコーナーの資料(はじめの値)。運営は「スライドの内容を編集」から毎回入れかえられる(画像・PDF)
  education: {
    title: "USPについて",
    pages: Array.from({ length: 12 }, (_, i) => `materials/edu/usp/s-${String(i + 1).padStart(2, "0")}.jpg`),
  },
  // ⑤商談の時間と回数(はじめの値。プレゼンをはじめる前の画面で変えられる)
  breakout: { min: 7, times: 4 },
  // いちばんはじめのページ: BT-EX でよく使う言葉
  glossary: {
    title: "BT-EX でよく使う言葉",
    items: [
      { head: "BT-EX", text: "LINK や BT の中の BNI・守成クラブ・\nニーズマッチの強みを取り入れた\n事業者コミュニティ" },
      { head: "ユニット", text: "BT-EX1〜14 の、それぞれの定例会のグループ(BT-EX5 は新潟⇔東京)" },
      { head: "定例会", text: "ユニットごとに月2回ひらく会\nプレゼンや商談で紹介を生み出す" },
      { head: "LINK", text: "20,000人の市場\n告知やセミナー、テストマーケができる" },
      { head: "B.T.", text: "ビジネススキル向上の仕組みと\n10,000人の人脈" },
      { head: "1on1", text: "メンバー同士が1対1で\nお互いの事業や紹介してほしい人を\n深く知るミーティング" },
      { head: "リファーラル", text: "メンバーへのお仕事の紹介" },
      { head: "ありがとうマイル", text: "紹介で仕事が決まったら\n紹介してくれた人へ\n成約金額を感謝として送る(1円＝1マイル)" },
      { head: "ビジター", text: "見学で定例会に参加する方\n(同じ方の参加は2回まで)\n＊BT-EXフェスは何度でも参加可能" },
      { head: "アップクリエ", text: "LINK で自分をサポートしてくれているメンバー" },
      { head: "系列", text: "B.T. の中のグループ" },
      { head: "出席コード", text: "定例会で画面に出る4桁のコード\nbt-ex.jp で入れると出席になる" },
    ],
  },
  // 時間の目安(分)。2時間の定例会のタイムマネジメントに使う(0: オープニング、1〜: 流れの番号)
  // オープニング1分・挨拶5分・用語説明2分・理念18分・エデュケーション(5分+α1分)6分・1分プレゼン32分・商談(7分×4回+α8分)36分・実績紹介15分・終わりの挨拶5分 = 120分
  timeplan: [1, 5, 2, 18, 6, 32, 36, 15, 5],
  // スケジュール(次回以降の日程は、予定に入っている定例会から出す)
  schedule: {
    title: "BT-EX5 スケジュール",
    lead: "月2回のオンライン定例会",
    rows: [["第一水曜日", "13:00-15:00"], ["第三土曜日", "20:00-22:00"]],
    note: "今後、新潟・東京各月でリアル定例会も開催予定\n＊LINKの公式スケジュールによってはスケジュールの変更あり",
  },
};

// 運営が用意した顔写真(本人がアプリで写真を入れていないときに使う。サイトの一番上からの場所)。
// 30秒プレゼンの画面などに出す。本人の了解があるものだけを置く
const REF_MEMBER_PHOTOS = {
  yamamoto: "assets/members/yamamoto.jpg",
  // 2026年10月、運営から受け取った顔写真
  m02: "assets/members/m02.jpg", // あまみや 七音
  m03: "assets/members/m03.jpg", // 佐藤 志織
  m04: "assets/members/m04.jpg", // 吉澤 美和子
  m05: "assets/members/m05.jpg", // 大藤 誠
  m08: "assets/members/m08.jpg", // 床島 良夫
  m09: "assets/members/m09-3.jpg", // 大場 雅俊
  m10: "assets/members/m10.jpg", // 大枝 篤志
  m11: "assets/members/m11.jpg", // 品川 瑞樹
  m12: "assets/members/m12.jpg", // 菅野 節子
  m14: "assets/members/m14.jpg", // 三村 隆
  m16: "assets/members/m16.jpg", // 桜羽 李果
  m17: "assets/members/m17.jpg", // むらさき やえ
  m18: "assets/members/m18.jpg", // 髙橋 誠二
  m19: "assets/members/m19.jpg", // 岡本 伸
  m20: "assets/members/m20.jpg", // 柏木 本徳
  m21: "assets/members/m21.jpg", // 中川 敏和
  m22: "assets/members/m22.jpg", // 小林 末季こばねぇ
  m23: "assets/members/m23.jpg", // 見上 恵
  m24: "assets/members/m24.jpg", // 栁橋 雅也
  m25: "assets/members/m25.jpg", // 松田 依子
  m26: "assets/members/m26.jpg", // 坂上 智子
  m27: "assets/members/m27.jpg", // 一場 ゆな
};

// 代表・役職・役割と、その基礎ポイント(大きいほど上に出る)
// - マーク: 名前の下に表示する(kind: leader=代表 / post=役職 / role=役割)
// - 紹介診断: 話題かキーワードが合った人の点数に足す(合わない人を上げることはしない)
// - 検索・診断の前の一覧: 利用者本人を先頭にしたうえで、この点数の高い順。ほかは日替わり
const REF_BASE_POINTS = {
  m16: { points: 10, kind: "leader", role: "BT-EX5代表 / プライムリンカー" },
  m09: { points: 9, kind: "leader", role: "BT-EX5代表" },
  m22: { points: 8, kind: "post", role: "甲信越コミュニティ統括班長" },
  m02: { points: 7, kind: "role", role: "LINKセレモニーメイン司会" },
  m14: { points: 6, kind: "leader", role: "BT-EX5副代表" }, // 代表と同じ金の枠・王冠(運営の依頼)
  yamamoto: { points: 5, kind: "role", role: "本システム開発者" },
};
const REF_ROLE_KINDS = { leader: "代表", post: "役職", role: "役割" };
function refBasePoints(id) {
  return (REF_BASE_POINTS[id] && REF_BASE_POINTS[id].points) || 0;
}
function refRoleOf(id) {
  return REF_BASE_POINTS[id] || null;
}

// 既存の名簿へ一度だけ反映する初期名簿の更新(古い順。反映済みの rev は名簿側に記録される)
const REF_SEED_REVISIONS = [
  { rev: "2026-10-profiles-1", ids: ["m02", "m03", "m04", "m05", "m08", "m09", "m16", "m20", "m22", "m25"] },
  { rev: "2026-10-profiles-2", ids: ["m10", "m12", "m14", "m18", "m19"] },
  { rev: "2026-10-profiles-3", ids: ["m17", "m26", "m27"] },
  { rev: "2026-10-profiles-4", ids: ["m06", "m07", "m11", "m15", "m21"] },
  { rev: "2026-10-profiles-5", ids: ["m23", "m24"] },
  // 診断の話題を細かくしたときの見直し(未編集のメンバーのみ置き換わる)
  { rev: "2026-10-topics-1", ids: ["m02", "m04", "m06", "m08", "m10", "m15", "m16", "m17", "m18", "m19", "m21", "m22", "m23", "m24", "m25", "m26", "m27"] },
  // m15 の登録内容を消す → 次の更新で名簿から削除
  { rev: "2026-10-clear-m15", ids: ["m15"], force: true },
  // remove: 名簿から削除し、そのメンバーのログイン情報も消す
  { rev: "2026-10-remove-m15", ids: [], remove: ["m15"] },
  // 資料・リンクの追加(空欄だけを埋める)
  { rev: "2026-10-links-1", ids: ["yamamoto"] },
  // 本人の依頼で、サービス内容を資料・ホームページに合わせて更新(編集済みでも置き換える)
  { rev: "2026-10-yamamoto-2", ids: ["yamamoto"], force: true },
  // 本人の依頼で、紹介文に入れる自己紹介を追加
  { rev: "2026-10-yamamoto-3", ids: ["yamamoto"], force: true },
  // IT・Web・クリエイティブを細かい業種に分けたときの見直し。業種と話題だけを見る。
  // 未編集のメンバーは置き換え、編集済みのメンバーには新しい話題(addTopics)だけを足す
  { rev: "2026-10-it-split-1", ids: ["yamamoto", "m02", "m03", "m10", "m11", "m16", "m18", "m19", "m23"], fields: ["category", "topics"], addTopics: ["sns", "prvideo", "music"] },
  // ジャンルをさらに細かく分け、1人に複数のジャンル(タグ)を付けたときの見直し。
  // removeTopics は編集済みの人からも外す(あまみやさんは作詞作曲をしない、など)
  {
    rev: "2026-10-genres-1",
    ids: ["yamamoto", "m02", "m03", "m04", "m05", "m06", "m09", "m10", "m11", "m14", "m16", "m17", "m19", "m20", "m22", "m23", "m24", "m25", "m26"],
    fields: ["category", "topics"],
    addTopics: ["line", "seo", "aitraining", "ad", "consult", "photo", "ehon", "mc", "recording", "casting", "fixedcost", "tutoring", "regional", "beauty", "color", "handmade", "social", "health"],
    removeTopics: { yamamoto: ["voice"], m02: ["music"], m05: ["health"], m14: ["health"], m17: ["health"], m20: ["health"] },
  },
  // 本人の依頼で、山本さんのジャンルから「デザイン」を外す
  { rev: "2026-10-yamamoto-design", ids: ["yamamoto"], fields: ["topics"], removeTopics: { yamamoto: ["design"] } },
  // こばねぇとの面談で分かった内容(離職率を下げる・思考整理のマインドセット)を反映(編集済みでも置き換える)
  { rev: "2026-10-kobane-1", ids: ["m22"], fields: ["business", "customers", "wants", "triggers", "topics"], force: true },
  // 山本 捷真のプロフィール(資料・リンク・自己紹介文・事業内容など)を、どの端末でも最新の内容にそろえる
  { rev: "2026-10-yamamoto-4", ids: ["yamamoto"], force: true },
  // 本人の依頼で、山本 捷真の LINE を連絡先に追加(本人が足したリンクは消さず、ないものだけを足す)
  { rev: "2026-10-yamamoto-line", ids: ["yamamoto"], fields: ["links"], addLinks: ["line"] },
  // 本人の依頼で、あまみや 七音さんのサービスのページ(BVB・イケボスパルタ塾)を追加(ほかのリンクはそのまま)
  { rev: "2026-10-amamiya-lp", ids: ["m02"], fields: ["links"], addLinks: ["website"] },
  // 本人のホームページの内容で、あまみや 七音さんの事業内容・実績・こんな話が出たら・ジャンルを充実(編集済みでも置き換える)。
  // 公式サイトのリンクも足す(ほかのリンクはそのまま)
  { rev: "2026-10-amamiya-profile", ids: ["m02"], fields: ["company", "business", "customers", "note", "wants", "triggers", "topics"], force: true },
  { rev: "2026-10-amamiya-hp", ids: ["m02"], fields: ["links"], addLinks: ["website"] },
  // BVB・イケボスパルタ塾のページの内容で、あまみや 七音さんの事業内容・求める紹介・こんな話が出たらをさらに充実
  { rev: "2026-10-amamiya-profile-2", ids: ["m02"], fields: ["business", "wants", "triggers"], force: true },
  // 運営の依頼で、品川さんを「Web制作」から、桜羽さんを「声・司会・キャスティング」から外す(編集済みでも外す)
  { rev: "2026-10-category-fix-1", ids: ["m11", "m16"], fields: ["topics"], removeTopics: { m11: ["web"], m16: ["casting"] } },
  // 本人の依頼で、人手が足りないなどの相談のとき、システム開発として山本 捷真が上位に出るように「こんな話が出たら」を足す
  { rev: "2026-10-yamamoto-hitode", ids: ["yamamoto"], fields: ["triggers"], addTriggers: ["人手が足りない", "人が足りない", "スタッフが足りない", "従業員が足りない", "人員が足りない", "人が採れない"] },
  // 本人の依頼で、山本 捷真のパーソナルブランディングシートを資料のいちばん上に追加(ほかのリンクはそのまま)
  { rev: "2026-10-yamamoto-branding", ids: ["yamamoto"], fields: ["links"], addLinks: ["proposal"], linksFirst: true },
  // 本人の依頼で、山本 捷真の肩書きをブランディングの表記にする(編集済みでも置き換える)
  { rev: "2026-10-yamamoto-headline", ids: ["yamamoto"], fields: ["company"], force: true },
  // 運営の依頼で、あまみや 七音さんから「動画編集」「企業PR動画」を外す(本人はできないため。編集済みでも外す)。
  // AI のジャンルの見直し: 会社への AI 導入は「システム開発」の枠に入れたので、栁橋さんの「AI活用」を外す
  { rev: "2026-10-genre-fix-2", ids: ["m02", "m24"], fields: ["topics"], removeTopics: { m02: ["video", "prvideo"], m24: ["ai"] } },
  // 運営の依頼で、大藤 誠さんのジャンルから「食品・ギフト」を外す
  { rev: "2026-10-ofuji-no-food", ids: ["m05"], fields: ["topics"], removeTopics: { m05: ["food"] } },
  // 運営の依頼で、菅野 節子さんのジャンルから「イベント企画」を外す
  { rev: "2026-10-sugano-no-event", ids: ["m12"], fields: ["topics"], removeTopics: { m12: ["event"] } },
  // 運営の依頼で、栁橋 雅也さんから「広告・販促」、大枝 篤志さんから「採用・人材」を外す
  { rev: "2026-10-genre-fix-3", ids: ["m24", "m10"], fields: ["topics"], removeTopics: { m24: ["ad"], m10: ["hiring"] } },
  // 本人の回答で、小林 末季こばねぇさんのプロフィールを書き直す(活動範囲・事業内容・求める紹介・こんな話が出たら・ジャンルなど。編集済みでも置き換える)
  { rev: "2026-10-kobane-2", ids: ["m22"], fields: ["base", "business", "customers", "wants", "triggers", "note", "face", "faceAreas", "online", "prospects", "topics"], force: true },
  // 本人の資料「月面タイムカプセル」で、床島 良夫さんの肩書き・事業内容・お客様・求める紹介・こんな話が出たら・ジャンルを充実(編集済みでも置き換える)。
  // 資料(PDF)を資料欄のいちばん上に足す(ほかのリンクはそのまま)
  { rev: "2026-10-tokoshima-1", ids: ["m08"], fields: ["company", "business", "customers", "note", "wants", "triggers", "topics"], force: true },
  { rev: "2026-10-tokoshima-pdf", ids: ["m08"], fields: ["links"], addLinks: ["proposal"], linksFirst: true },
  // 本人のプロフィール資料で、品川 瑞樹さん・栁橋 雅也さんを充実させる(編集済みでも置き換える)
  { rev: "2026-10-shinagawa-1", ids: ["m11"], fields: ["company", "business", "note", "triggers", "targets", "prospects"], force: true },
  { rev: "2026-10-yanagibashi-1", ids: ["m24"], fields: ["company", "business", "note", "triggers", "topics"], force: true },
  // 本人の資料(運営から受け取ったもの)で、栁橋さん・あまみやさん・吉原さん・岡本さん・むらさきさん・菅野さん・こばねぇさんを充実させ、資料欄に入れる
  { rev: "2026-10-materials-8", ids: ["m24", "m02", "m06", "m19", "m17", "m12", "m22"], fields: ["company", "business", "customers", "note", "wants", "triggers", "topics"], force: true },
  { rev: "2026-10-materials-8-links", ids: ["m24", "m02", "m06", "m19", "m17", "m12", "m22"], fields: ["links"], addLinks: ["proposal", "line", "instagram"], linksFirst: true },
  // 本人の依頼で、山本 捷真の求める紹介の先頭に「人手が足りない経営者」「人を雇いたい経営者」を足す(編集済みでも置き換える)
  { rev: "2026-10-yamamoto-wants-hitode", ids: ["yamamoto"], fields: ["wants"], force: true },
  // 本人の依頼で、山本 捷真の「こんな話が出たら」の先頭を「人手が足りない」「人が採れない」「手作業に時間がかかる」「社員にAIを使わせたい」に、
  // 求める紹介から「動画・SNS・LINEで集客や採用を強くしたい会社」を外す(編集済みでも置き換える)
  { rev: "2026-10-yamamoto-order-1", ids: ["yamamoto"], fields: ["triggers", "wants"], force: true },
  // 運営の依頼で、以前の面談の内容の「離職防止」を、小林 末季こばねぇさんのジャンルに戻す
  { rev: "2026-10-kobane-retention", ids: ["m22"], fields: ["topics"], addTopics: ["retention"] },
  // 運営の依頼で、栁橋 雅也さんのお名前の漢字を直す(「柳」→「栁」)
  { rev: "2026-10-yanagibashi-name", ids: ["m24"], fields: ["name"], force: true },
  // bt-ex.jp の BT-EX5 の名簿(26名)に合わせる: 長田 恵美子さんを足し、名簿にいない佐藤 慎哉さんを外す
  { rev: "2026-10-roster-sync-1", ids: [], add: ["m28"], remove: ["m13"] },
  // 運営の依頼で、チームを入れる(樺澤さん・吉原さん・むらさきさん・柏木さん・中川さん。編集済みでも置き換える)
  { rev: "2026-10-teams-1", ids: ["m07", "m06", "m17", "m20", "m21"], fields: ["team"], force: true },
  // 本人の資料で、柏木さん・桜羽さん・中川さん・こばねぇさんを充実させる(編集済みでも置き換える)。資料はいちばん上に足す
  { rev: "2026-10-materials-9", ids: ["m20"], fields: ["company", "business", "customers", "wants", "note", "triggers", "topics"], force: true },
  { rev: "2026-10-materials-9-m16", ids: ["m16"], fields: ["note", "personal", "triggers"], force: true },
  { rev: "2026-10-materials-9-m21", ids: ["m21"], fields: ["company", "kana", "business", "topics"], force: true },
  { rev: "2026-10-materials-9-m22", ids: ["m22"], fields: ["note", "triggers", "topics"], force: true },
  { rev: "2026-10-materials-9-links", ids: ["m20", "m16"], fields: ["links"], addLinks: ["proposal"], linksFirst: true },
  // 本人の資料(Weak-Point Sniper 企画書・事業内容・パソコン買い替え相談)で、山本 捷真を充実させる(編集済みでも置き換える)
  { rev: "2026-10-yamamoto-wps", ids: ["yamamoto"], fields: ["business", "customers", "wants", "triggers", "topics", "prospects"], force: true },
  { rev: "2026-10-yamamoto-pc-link", ids: ["yamamoto"], fields: ["links"], addLinks: ["proposal"] },
  // 紹介診断の「相手がこう言っていたら」から探せるように、言葉とジャンルを足す(本人の言葉はそのまま)
  { rev: "2026-10-say-phrases", ids: ["yamamoto"], fields: ["triggers"], addTriggers: ["モデルになりたい", "芸能界に入りたい", "俳優・タレントになりたい", "芸能事務所を探している"] },
  { rev: "2026-10-say-phrases-m08", ids: ["m08"], fields: ["triggers"], addTriggers: ["インバウンド客を紹介できる", "海外で店舗を経営している", "外国人のお客様が多い", "海外にお客様・つながりがある"] },
  { rev: "2026-10-say-phrases-m19", ids: ["m19"], fields: ["topics"], addTopics: ["liver"] },
  // 本人のホームページ・SNS(運営から受け取ったもの)を、詳細のリンクに足す(編集済みでも、まだないものだけ足す)
  // 本人の新しい肩書き・自己紹介で、山本 捷真を充実させる(編集済みでも置き換える)
  { rev: "2026-10-yamamoto-intro-2", ids: ["yamamoto"], fields: ["company", "business", "selfIntro", "personal", "triggers"], force: true },
  { rev: "2026-10-member-links-1", ids: ["yamamoto", "m16", "m12", "m17", "m21", "m22", "m25"], fields: ["links"], addLinks: ["website", "sasaeai", "instagram", "facebook", "line"] },
  // 山本 捷真の事業の順番(①システム開発 ②Webサイト制作 ③教育 ④パソコン・携帯)に、事業内容・主なお客様・ジャンルを並べかえる
  { rev: "2026-10-yamamoto-order-2", ids: ["yamamoto"], fields: ["business", "customers", "topics"], force: true },
  // 本人の依頼で、山本 捷真の「こんな話が出たら」の「公式LINEを作りたい」をいちばん最後に(プレゼンの画面には、代わりに次の言葉が出る)
  { rev: "2026-10-yamamoto-line-last", ids: ["yamamoto"], fields: ["triggers"], force: true },
  // 本人の新しい資料(フライコアの事業案内・子ども達への体験の活動)で、栁橋 雅也さんを充実させ、資料を入れかえる(編集済みでも置き換える)
  { rev: "2026-10-yanagibashi-flycore", ids: ["m24"], fields: ["company", "business", "wants", "customers", "triggers", "topics", "links"], force: true },
];

// 紹介に効く項目(重要な順)。足りない項目は管理者ページの「お願い文」と、
// 本人への記入のお願いに使う
// BT-EX5 の定例会(はじめに一度だけ入れる。以降は会員アプリの管理者が作成・編集する)。
// 参加リンク(Zoom など)はここに置かない(このファイルは誰でも読めるため)。オンラインの回は Google Meet を作る
// 当日の流れは BT-EX の指針(オンライン定例会)の順。①②③⑥⑦は BT-EX 共通、④⑤はユニットごとに変えてよい
// ⑤は今後の対面の定例会もふくめて「ブレイクアウトルーム商談(テーブル商談)」。時間と回数は、プレゼンをはじめる前の画面でも選べる
// ②は BT-EX でよく使う言葉の説明(はじめの挨拶のあと)
const REF_SEED_AGENDA = [
  "①はじめの挨拶", "②用語説明", "③BT-EXの理念", "④エデュケーションコーナー 5分", "⑤1分プレゼンテーション",
  "⑥ブレイクアウトルーム商談（テーブル商談） 7分×4", "⑦LINKのビジネス実績紹介", "⑧終わりの挨拶",
].join("\n");
// 以前の流れ(運営が書きかえていない定例会だけ、上の流れに置きかえる)
const REF_SEED_AGENDA_PREV = [
  [
    "①はじめの挨拶", "②BT-EXの理念", "③エデュケーションコーナー 5分", "④1分プレゼンテーション",
    "⑤ブレイクアウトルーム商談（テーブル商談） 7分×4", "⑥LINKのビジネス実績紹介", "⑦終わりの挨拶",
  ].join("\n"),
  [
    "①はじめの挨拶", "②BT-EXの理念", "③エデュケーションコーナー 5分", "④1分プレゼンテーション",
    "⑤ブレイクアウトルーム商談 10分×3", "⑥LINKのビジネス実績紹介", "⑦終わりの挨拶",
  ].join("\n"),
  [
    "①はじめの挨拶", "②BT-EXの理念", "③エデュケーションコーナー 6分", "④1分プレゼンテーション",
    "⑤ブレイクアウトルーム商談 10分×3", "⑥LINKのビジネス実績紹介", "⑦終わりの挨拶",
  ].join("\n"),
  [
    "①はじめの挨拶", "②BT-EXの理念", "③エデュケーションコーナー 5分", "④1分プレゼンテーション",
    "⑤ブレイクアウトルーム商談 15分×2", "⑥LINKのビジネス実績紹介", "⑦終わりの挨拶",
  ].join("\n"),
  [
    "①はじめの挨拶", "②BT-EXの理念", "③エデュケーションコーナー 5分", "④1分プレゼンテーション",
    "⑤ブレイクアウトルーム商談 15分×2", "⑥LINKのビジネス実績紹介", "⑦終わりの挨拶", "", "★貢献、ありがとう発表は11月以降から",
  ].join("\n"),
  [
    "①はじめのあいさつ", "②BT-EXの理念", "③エデュケーションコーナー", "④30秒プレゼンテーション",
    "⑤テーブル商談15分 ×2", "⑥LINKのビジネス実績紹介", "⑦終わりの挨拶", "", "★貢献、ありがとう発表は11月以降から",
  ].join("\n"),
];
const REF_SEED_GUIDE = "新潟メンバーとその他の地域メンバーの入っている日本海側最大マーケットを目指しているユニットです";
const REF_SEED_EVENTS = [
  { seedId: "2026-10-07", title: "日本海側最大のマーケット 新潟⇔東京", date: "2026-10-07", start: "13:00", end: "15:00", deadline: "2026-10-07T23:59" },
  { seedId: "2026-10-17", title: "日本海側最大のマーケット 新潟⇔東京", date: "2026-10-17", start: "20:00", end: "22:00", deadline: "2026-10-15T00:00" },
  { seedId: "2026-11-04", title: "日本海側最大のマーケット 新潟⇔東京", date: "2026-11-04", start: "13:00", end: "15:00", deadline: "2026-11-03T00:00" },
  { seedId: "2026-11-14", title: "日本海側最大のマーケット 新潟⇔東京", date: "2026-11-14", start: "20:00", end: "22:00", deadline: "" },
  // 特別会(運営から。2026年10月25日)
  {
    seedId: "2026-12-02-btex-fes", kind: "special", title: "第一回BT-EXフェス", date: "2026-12-02", start: "14:30", end: "16:30", doors: "14:00",
    area: "tokyo", place: "銀座Blossom", meet: false, fee: "2,200円", capacity: 144, deadline: "", agenda: "",
    body: [
      "定員 144名(メンバー 70名・ビジター 70名)",
      "14:00 受付 / 14:30 開始 〜 16:30 終了",
      "会場:銀座Blossom  参加費:2,200円",
      "",
      "■ 事前申し込みについて",
      "・ビジターを連れて来られる方が優先です",
      "・ユニットアピールがある予定のため、各ユニットの代表は優先的に参加できます",
      "",
      "☆メンバーは準備のため 13:00 集合、17:00 完全撤収です",
    ].join("\n"),
  },
].map((e) => Object.assign({ area: "online", meet: true, fee: "会員 無料", agenda: REF_SEED_AGENDA, body: REF_SEED_GUIDE }, e));

// 開いた前の定例会の出欠(bt-ex.jp の記録から。一度だけ反映する)。
// attended: 出席(申込のまま出席扱いの人を含む)/ absent: 事前欠席
const REF_SEED_EVENT_RECORDS = [
  {
    rev: "2026-10-07-attendance",
    seedId: "2026-10-07",
    attended: ["m22", "m02", "m16", "m08", "m20", "m14", "yamamoto", "m26", "m04", "m05", "m24", "m06", "m12", "m03", "m07"],
    absent: ["m18", "m10", "m25", "m17", "m19", "m13", "m09"],
  },
];

// お試し版のときに書かれた掲示板の投稿を、どの端末にも一度だけ入れる(同じ人の同じ本文が既にあれば入れない)
const REF_SEED_POSTS = [
  {
    seedId: "2026-10-10-advovisions",
    by: "yamamoto",
    cat: "告知",
    at: Date.UTC(2026, 9, 10, 4, 21), // 2026/10/10 13:21(日本時間)
    body: [
      "私の所属する芸能事務所兼映像制作会社で、私とアライアンスを組んでいる合同会社AdvoVisionsの告知です。",
      "",
      "告知失礼します！",
      "「ケンコバのバコバコナイト」の制作を担当させていただくこととなり、",
      "https://bakobako.tv",
      "",
      "10月2日放送分より弊社制作回がスタートいたしました。",
      "https://youtu.be/DZGILK1LwDI?si=-x72BVDV6mBvEyAb",
      "",
      "企画・台本から収録、編集、MAまで、番組制作の一連を行ってます。",
      "",
      "関西・東海・関東の計6局で放送中ですので、お時間のある際にご覧いただけましたら幸いです。",
      "",
      "AIや映像制作の講義動画をはじめ",
      "バラエティ番組に限らず、ドラマ・CM・PR映像など幅広いジャンルの映像制作を行っております。",
      "映像に関わるご相談がございましたら、企画段階からでもお気軽にお声がけください。",
      "",
      "今後ともどうぞよろしくお願いいたします。",
      "",
      "合同会社AdvoVisions",
      "代表　丸山弘太郎",
    ].join("\n"),
  },
];

// これまでのシステムの改善点を、日ごとに運営連絡へ一度だけ入れる(本人の依頼で、改善した日を投稿日にする)。
// 入れたあとで中身を直すときは rev を1つ上げる(共有サーバーの投稿も、件名・本文が新しくなる。既読はそのまま)
const REF_SEED_ANNOUNCEMENTS = [
  {
    seedId: "2026-10-08-changelog",
    at: Date.UTC(2026, 9, 8, 11, 0), // 2026/10/8 20:00(日本時間)
    title: "【システム改善】10月8日(木) 紹介先早見表がスタートしました",
    body: [
      "10月8日(木)に、BT-EX5 のメンバー同士で紹介し合うためのサイト「紹介先早見表」を作りました。この日に入れた主な内容です。",
      "",
      "■ 紹介先早見表",
      "・メンバーの事業内容・主なお客様・求める紹介を、1つの一覧で見られるようにしました。会話で「こんな話が出たら、この人へ」をすぐ探せます。",
      "・メンバーの詳細画面を作り、資料・ホームページ・SNS のリンクをまとめて見られるようにしました。",
      "・紹介文をコピーできるようにし、本人の「自己紹介文」も紹介文に入るようにしました。",
      "",
      "■ 紹介診断",
      "・相手の困りごとを選ぶと、紹介先の候補と一致度(%)がわかる「紹介診断」を作りました。専門の人ほど上に出るように調整しています。",
      "",
      "■ みんなの売上につながる工夫",
      "・紹介し合える相手、紹介特典、日替わりの並び順を入れました。毎回同じ人ばかりが上に出ないようにするためです。",
      "・「全体分析」のページで、BT-EX5 に足りない業種がわかるようにしました。",
      "",
      "■ ログインと見た目",
      "・会員登録をやめ、パスコードでログインする形にしました(会員だけが見られます)。",
      "・BT-EX5 のロゴ、オープニングムービー、ムービーをもう一度見るボタンを付けました。",
      "",
      "■ プロフィール",
      "・いただいた資料・ヒアリングをもとに、メンバー25名分のプロフィールを登録しました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-09-changelog",
    at: Date.UTC(2026, 9, 9, 11, 0), // 2026/10/9 20:00(日本時間)
    title: "【システム改善】10月9日(金) 紹介先を探しやすくしました",
    body: [
      "10月9日(金)に、紹介先早見表を「探しやすく・使いやすく」しました。",
      "",
      "■ ジャンルを細かく",
      "・ジャンルを48種類に分け、1人に複数のジャンルタグを付けました。IT・Web・クリエイティブは9つの業種に分けています。",
      "・代表などのマークを名前の下に出し、並び順にも反映しました。",
      "",
      "■ 紹介診断を答えやすく",
      "・「困りごと → 解決の方法」の順に選ぶ流れにしました。どの質問も「次へ」で進み、答えている途中で閉じないようにしています。",
      "・一致度(%)と並び順が食い違うことがあったので直しました。",
      "",
      "■ 便利な機能",
      "・言いかえ・関連ジャンルでも見つかる検索、お気に入り、上に戻るボタン、「/」キーで検索を付けました。",
      "・紹介をお願いするときの打診文や、上位の人をまとめてコピーできるようにしました。診断の結果も残ります。",
      "・自分だけのメモと、電波の弱い会場でも開ける仕組みを入れました。",
      "・スマホのホーム画面に追加して、アプリのように使えるようにしました。",
      "・マイページと「自分の情報の編集」、運営の名簿の管理を入力しやすくしました。",
      "",
      "■ 見た目",
      "・オープニングムービーを映画風に作り直し、ロゴを金の輪にしました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-10-changelog",
    at: Date.UTC(2026, 9, 10, 11, 0), // 2026/10/10 20:00(日本時間)
    title: "【システム改善】10月10日(土) 会員アプリができました",
    body: [
      "10月10日(土)に、紹介の記録・1on1・定例会・掲示板などを1つにまとめた「会員アプリ」を作りました。",
      "",
      "■ 相談アシスタント",
      "・聞いた相談を文章か音声で入れるだけで、紹介先と「この組み合わせで解決できる」チームを出します。",
      "・音声入力は、自分で止めるまで続くようにしました(途中で勝手に止まりません)。",
      "",
      "■ 会員アプリ",
      "・お名前を選んでパスワードでログインする形にしました。",
      "・紹介の記録とありがとうマイル、1on1、ビジター招待、運営連絡、掲示板を1つのアプリで使えます。",
      "・お知らせ(ベル)、アプリのアイコンの未読数、QRコードでの出席・招待・プロフィール表示を付けました。",
      "・書きかけの内容は自動で保存されます。声かけが必要なことはホームに出ます。",
      "",
      "■ 1on1",
      "・メンバー全員から相手を選べます。時刻は深夜まで選べ、時間は30分きざみで5時間までです。",
      "・現地か Google Meet かを選べます。Google カレンダーと連携し、Meet と予定を自動で作ります。",
      "・予定の時刻を過ぎると「実施しましたか?」と確認し、答えたら回数に数えます。",
      "",
      "■ 定例会",
      "・定例会4回分を登録し、詳細ページ(当日の流れ・申込締切・懇親会・出欠一覧)を作りました。",
      "・オンラインの回は、Google Meet に参加した時間で出欠が自動でつきます(100分以上で出席、60分以上100分未満は遅刻早退)。",
      "・10月7日の定例会の出欠を反映し、出席率を「◯回中◯回」で見られるようにしました。",
      "",
      "■ ビジター招待",
      "・事前に共有するルール、招待URLの発行、そのまま送れる文のコピー、招待履歴をまとめたページを作りました。",
      "",
      "■ ランキングと数字",
      "・貢献ポイント(紹介+1・成約+3・貢献金額1,000円ごと+0.1・1on1+1・出席+1・ビジター+2)で、個人の順位と「あと◯pt」がわかります。",
      "・記録 →「数字」で、期間を選んで自分とメンバー別の数字を見られます(ありがとうマイルの順が既定)。",
      "",
      "■ 掲示板・運営連絡と通知",
      "・掲示板の投稿が全員に届くようにし、更新をスマホに通知できるようにしました(iPhone はホーム画面に追加してから設定)。",
      "・メッセージ機能はやめ、掲示板と運営連絡を下のメニューに置きました。掲示板の「雑談」は「告知」に名前を変えました。",
      "",
      "■ 公平さと安心",
      "・検索で毎回同じ人ばかり出ないよう、上位2名以外は日替わりにしました。読み取れる言葉も増やしました。",
      "・退会したときのログイン停止と、毎日のバックアップを入れました。",
      "・メニューを上下左右に動かせるようにしました。Meet の作り方の案内と、プロフィールから元の画面に戻るボタンも付けました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-11-changelog",
    at: Date.UTC(2026, 9, 11, 7, 30), // 2026/10/11 16:30(日本時間)
    title: "【システム改善】10月11日(日) ホーム・予定・利用規約を新しくしました",
    body: [
      "10月11日(日)に改善した内容です。",
      "",
      "■ 利用規約",
      "・利用規約を本日直しました。全15条にして、プロフィールや記録の扱い、情報の取り扱い、会員同士の取引などのルールを分かりやすく書きました。",
      "・また、利用規約を読みやすくするために、高校生にもわかる「AI要約」と、使うメリット・デメリットを規約の下に載せました。",
      "",
      "■ ホーム画面を作り直しました",
      "・順位と今月の数字を1枚のカードにまとめました。",
      "・聞いた相談を入れて、そのまま紹介先を探せる検索欄を付けました。",
      "・よく使う操作(紹介を記録・ありがとう・1on1・ビジター招待・掲示板)をアイコン1列に並べました。",
      "・やることを1か所にまとめ、パソコンでは2列で見やすくしました。",
      "",
      "■ 予定にカレンダーと時計",
      "・定例会・1on1・紹介の顔合わせ・やることの期限を、月のカレンダーで見られるようにしました。日を押すと、その日の予定が出ます。",
      "・立体的な時計を付けました(日本時間)。",
      "",
      "■ 1on1・紹介",
      "・1on1 の日付に「昨日」「一昨日」を付けました。Meet を作ったあと、Google カレンダーへの追加と、相手に送る文のコピーができます。",
      "・紹介にも、顔合わせの予定・カレンダー追加・送る文のコピーを付けました。",
      "・予定のリマインド、予定の重なりの確認、紹介の絞り込み、自分の記録の書き出し(CSV)を入れました。",
      "",
      "■ 定例会・掲示板・やること",
      "・定例会の議事録・決定事項を残せるようにしました。",
      "・掲示板の投稿とコメントを、あとから直せるようにしました。",
      "・担当と期限つきの「やること」を作りました。運営は進み具合を確認できます。",
      "・最近紹介を受けていない人を週替わりで1人紹介する「今週の紹介チャレンジ」をホームに出しました。",
      "",
      "■ 直したところ",
      "・業種で絞り込んだとき、その仕事をしていない人が出ることがあったので直しました。",
      "・パソコンで見出しや本文が真ん中からずれていたのを直し、広い画面では2列で表示するようにしました。",
      "・メニューを好きな場所や画面の端に置けるようにし、動かしたあとに残像が出ることがあったのを直しました。",
      "・メンバーのプロフィールを、本人のホームページや資料の内容で充実させました。資料の画像は切れずに出ます。",
    ].join("\n"),
  },

  {
    seedId: "2026-10-11-changelog-2",
    at: Date.UTC(2026, 9, 11, 11, 0), // 2026/10/11 20:00(日本時間。まだその時刻でなければ、入れた時刻)
    title: "【システム改善】10月11日(日) 夜の更新:やること・紹介診断・デザインなど",
    body: [
      "10月11日(日)の夜に、さらに改善した内容です。",
      "",
      "■ やること(自分だけ・Google カレンダー)",
      "・カレンダーやホームから自分で入れる「やること」は、はじめから「自分だけが見られる」ようにしました。ほかのメンバーや運営には見えません。",
      "・時刻も入れられるようにしました。保存したあとに、Google カレンダー(iPhone・Outlook も)へそのまま入れられます。やることの一覧からも、あとでカレンダーに入れられます。",
      "",
      "■ 紹介診断・相談アシスタント",
      "・紹介診断の質問を6つから3つにしました(困りごと → 方法 → 相手はどんな方か)。業種・エリア・会い方の質問をなくし、約15秒で結果が出ます。",
      "・「人手が足りない」「スタッフが足りない」などの相談では、採用だけでなく「システム開発で人手を補う」方法と、その紹介先も出すようにしました。",
      "",
      "■ 定例会・予定",
      "・定例会の1時間前からは「開始まで あと◯分」と、大きな「いま Google Meet に参加する」ボタンが出ます。",
      "・予定の時計を大きくしました(スマホでは画面幅の約4分の3)。カレンダーは、指で左右にはらうと月が変わります。",
      "・スマホで定例会の日付が枠からはみ出していたので、「月・日・曜日・あと◯日」の縦並びにしました。",
      "",
      "■ LINE で共有",
      "・運営連絡と掲示板の投稿を、LINE にそのまま貼れる文でコピーできるようにしました(「LINE に貼る文をコピー」「LINE 用にコピー」)。貼ったリンクを開くと、その投稿が開きます。",
      "",
      "■ 見た目と使いやすさ",
      "・ロゴに合わせて、サイト全体を黒×金の落ち着いたデザインにしました。地はアイボリー、見出しは明朝体、上の見出しと下のメニューは墨色に金の線です。",
      "・長い画面では、右下に「↑」(いちばん上へ)ボタンが出ます。",
      "",
      "■ 直したところ",
      "・運営連絡の各投稿の下に「nullnull」という文字が出ていたのを直しました。入っていない部分が、そのまま文字として出ていたのが原因です。",
      "・ほかの画面で、入っていない項目が「null」と出ることがあったのも直しました。",
    ].join("\n"),
  },

  {
    seedId: "2026-10-11-features",
    at: Date.UTC(2026, 9, 11, 12, 0), // 2026/10/11 21:00(日本時間。まだその時刻でなければ、入れた時刻)
    title: "【新機能】アプリ内検索・今日明日の予定・最近の相手・3Dオープニング",
    body: [
      "もっと便利に使えるよう、新しい機能を入れました。",
      "",
      "■ アプリ内をまとめて探す",
      "・上の 🔍 を押すと、メンバー(名前・会社・仕事・求める紹介)、掲示板、運営連絡、定例会をまとめて探せます。パソコンでは「/」キーでも開きます。",
      "",
      "■ 今日・明日の予定をホームに",
      "・1on1、紹介の顔合わせ、やることを、今日と明日に分けて時刻順に表示します。今日の Google Meet はそこから参加できます。",
      "",
      "■ 最近の相手を1タップで",
      "・紹介や1on1、ありがとうを記録するとき、最近えらんだ相手が上に出るので、探さずに1タップで選べます。",
      "",
      "■ やることの直前にお知らせ",
      "・時刻を入れたやることは、その時刻の少し前(約3時間前から)にベルとスマホの通知でお知らせします。",
      "",
      "■ オープニングムービーを3Dに",
      "・金の光が5つに分かれて宙に五角形をつくり、金の糸で結ばれて、立体の金のロゴになるムービーに作り直しました。右上の ▶ からいつでも見られます。",
    ].join("\n"),
  },

  {
    seedId: "2026-10-11-features-2",
    rev: 2, // 2: 「さらに」(3D のロゴ・通知の種類・紹介の進み具合・オフライン)を書き足した
    at: Date.UTC(2026, 9, 11, 12, 30), // 2026/10/11 21:30(日本時間。まだその時刻でなければ、入れた時刻)
    title: "【新機能】30秒プレゼンの練習・今月の目標・新しいロゴ",
    body: [
      "さらに新しい機能を入れました。",
      "",
      "■ 30秒プレゼンの練習",
      "・マイページ →「30秒プレゼンの練習」で、定例会の30秒プレゼンの原稿を書いて、30秒タイマーで練習できます。",
      "・文字数から読む時間の目安が出ます(30秒は 250字くらい)。プロフィールからひな形も入れられます。原稿はあなただけが見られます。",
      "",
      "■ 今月の目標",
      "・紹介・成約・1on1・ビジター招待の数を決めると、ホームの「今月のあなた」に進み具合のバーが出ます。",
      "",
      "■ 新しいロゴとオープニングムービー",
      "・ロゴを、オープニングムービーと同じ立体的な金の輪にしました。スマホのホーム画面のアイコンも新しくなります(追加し直すと変わります)。",
      "・オープニングムービーの画質を上げました。パソコンでは 1080p で流れます。",
      "",
      "■ さらに",
      "・ロゴを、オープニングムービーの 3D の金のロゴそのものの画像にしました。",
      "・マイページ →「通知を受け取る」で、スマホに通知する種類(紹介・1on1・掲示板・運営連絡と定例会・やること・ビジター)を選べます。",
      "・記録 → 紹介の上に、出した紹介の進み具合と成約率が出ます。",
      "・電波がないときは「オフラインです」と出ます。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-11-features-3",
    at: Date.UTC(2026, 9, 11, 14, 0), // 2026/10/11 23:00(日本時間)
    title: "【新機能】@で名前を呼ぶ・BT-EX5 全体の今月・引っぱって更新",
    body: [
      "新しい機能を入れました。",
      "",
      "■ 掲示板で「@名前」",
      "・投稿やコメントに「@」と入れると、メンバーの候補が出ます。選ぶと「@山本捷真」のように入ります。",
      "・名前を出された人には、お知らせ(ベル)とスマホに「掲示板であなたの名前を出しました」と届きます。",
      "・届けたくない人は、マイページ →「通知を受け取る」で「＠ あなたの名前が出たとき」を切れます。",
      "",
      "■ ホームに「BT-EX5 全体の今月」",
      "・今月、メンバー全体で出た紹介・成約・1on1・掲示板の投稿の数が出ます。",
      "",
      "■ 引っぱって更新",
      "・スマホで、画面の一番上から下へ引っぱってはなすと、最新の内容に更新されます。",
      "",
      "■ 運営連絡の書き足し",
      "・前回の「【新機能】30秒プレゼンの練習・今月の目標・新しいロゴ」の「■ さらに」も、この更新から表示されるようになりました(既読はそのままです)。",
    ].join("\n"),
  },  {
    seedId: "2026-10-11-features-4",
    rev: 2, // 2: 続けて押すと足せる・ホームのタイマーを書き足した
    at: Date.UTC(2026, 9, 11, 14, 30), // 2026/10/11 23:30(日本時間)
    title: "【新機能】タイマー(1分〜25分のポモドーロ・足し算・ホームにも)・オープニングムービーを新しく",
    body: [
      "■ プレゼンの練習・タイマー",
      "・マイページ →「プレゼンの練習・タイマー」で、30秒・1分・3分・5分・10分・25分(ポモドーロ)から長さを選べるようになりました。",
      "・0秒になると鐘の音が鳴ります(残りわずかのときも小さく鳴ります)。音は切ることもできます。マナーモードのときは音が出ないことがあります。",
      "・とちゅうで止めて、つづきから始められます。動いているあいだは画面が消えません(対応する端末)。",
      "・長さのボタンは続けて押すと足せます。たとえば「10分」を3回押すと30分、「10分」3回と「5分」で35分です(最大3時間)。「もどす」で選び直せます。",
      "・ホームにも同じタイマーを置きました。ほかの画面に移っても動きつづけ、右上に残り時間が出ます(押すとホームのタイマーへ)。アプリを開き直しても続きからです。",
      "・ホーム画面に追加した BT-EX5 のアイコンを長押しすると「タイマー」から直接開けます(対応する端末)。",
      "",
      "■ オープニングムービー",
      "・はじめのほうで、光の左下に黒い線が見えていたのを直しました。",
      "・ロゴが決まる瞬間に、金の火の粉と、うしろで回る光の筋(後光)を加えました。ロゴはロゴの画像と同じ立体の形になり、最後は BT-EX5 の文字にも光が流れます。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-11-features-5",
    at: Date.UTC(2026, 9, 11, 15, 0), // 2026/10/12 0:00(日本時間)
    title: "【新機能】定例会の30秒プレゼンを、順番に進行できるように",
    body: [
      "■ 30秒プレゼンの進行(順番タイマー)",
      "・定例会の詳細の「当日の流れ」、ホームのタイマー、マイページの「プレゼンの練習・タイマー」から開けます。",
      "・出席予定の方が順番に並びます(ビジターも入れられます)。シャッフル・名前の順・上下の入れかえ・外す・足すができ、1人の時間は 30秒・1分・2分・3分から選べます。",
      "・「全画面ではじめる」で、いまの人の名前と会社・大きな残り時間・次の人が出ます。会場のスクリーンや Meet の画面共有でそのまま見せられます。",
      "・残り10秒で小さな音、0秒で鐘の音。3秒あけて自動で次の人へ進みます(切ることもできます)。パソコンでは スペース=止める、→=次へ、←=前へ、Esc=終わる。",
      "",
      "■ オープニングムービー",
      "・最後が黒まで落ちきらずに終わっていたのを、きれいに真っ黒になってから閉じるようにしました。",
      "・五角形の上を巡る光が、等しい間をあけて同じ速さで、辺から辺へ途切れずに巡るようにしました(頂点で2つ重なって見えていたのを直しました)。",
    ].join("\n"),
  },  {
    seedId: "2026-10-11-features-6",
    at: Date.UTC(2026, 9, 11, 15, 30), // 2026/10/12 0:30(日本時間)
    title: "【新機能】ホームの表示を自分好みに・1on1 のおすすめ",
    body: [
      "■ ホームの表示を変える",
      "・ホームのいちばん下の「⚙ ホームの表示を変える」で、ホームに出すもの(今月のあなた・やること・タイマー・次の定例会・運営連絡など)を選び、順番を並べかえられます。",
      "・チェックを外したものは出さなくなります。「はじめに戻す」でいつでも元の表示に戻せます(この端末に覚えます)。",
      "",
      "■ 1on1 のおすすめ",
      "・ホームに、まだ 1on1 をしていないメンバーを週ごとに3人おすすめします。「1on1 を予定」を押すと、相手が入った状態で予定を作れます。",
    ].join("\n"),
  },  {
    seedId: "2026-10-12-features",
    at: Date.UTC(2026, 9, 11, 23, 30), // 2026/10/12 8:30(日本時間)
    title: "【新機能】BT-EX5 シグナル・デジタル会員証・使い方ガイド",
    body: [
      "より安心して、より便利にお使いいただけるよう、全体を見直しました。",
      "",
      "■ BT-EX5 シグナル(ホーム)",
      "・直近6か月のあなたの活動(出席・1on1・紹介・紹介からの売上・ビジター招待)を100点で表示します。70点から緑・50点から黄・30点から赤。",
      "・「あと1件で +6点」のように、次にやるとよいことも出ます。あなたにだけ表示され、ほかのメンバーには見えません。",
      "",
      "■ デジタル会員証",
      "・マイページ →「デジタル会員証・QR コード」。交流会で QR を読み取ってもらうと、早見表であなたの詳細が開きます。",
      "",
      "■ はじめての方へ・使い方ガイド",
      "・ホームに、使いこなすための7つのステップを出しました(終わると消えます)。",
      "・マイページ →「使い方・よくある質問」に、できること・だれに何が見えるか・困ったときをまとめました。",
      "",
      "■ 見やすさ・使いやすさ",
      "・入力のまちがいは、その欄のすぐ下に出るようにしました。",
      "・ランキングで同じ点の方は「同率◯位」と出ます。",
      "・文字を少し大きく、補足の文字を濃くして読みやすくしました。マイページのメニューを4つのまとまりに分けました。",
      "",
      "■ 安心して使うために",
      "・ご自分のパスワードを決めた方には、共通パスコードでは入れなくなりました(なりすまし防止)。まだの方は、マイページ →「パスワードを決める」からどうぞ。",
      "・電波が弱いだけのときはログアウトせず、「もう一度読み込む」が出るようにしました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-12-features-2",
    at: Date.UTC(2026, 9, 12, 5, 45), // 2026/10/12 14:45(日本時間)
    title: "【更新】かんたんプロフィール・相談の結果にご自分も・会費と領収書・LINE 通知の準備",
    body: [
      "10月12日に入れた更新のまとめです。",
      "",
      "■ かんたんプロフィール(新機能)",
      "・紹介する側がいちばん知りたい3つ(どこで会えるか・どんな人を紹介してほしいか・どんな仕事ができるか)だけを、約1分で入れられます。",
      "・まだの方はホームの案内か「はじめての方へ」から、その場で開けます。マイページ →「かんたんプロフィール」からも開けます。ほかの項目はそのまま残ります。",
      "",
      "■ 紹介先早見表",
      "・相談・紹介診断の結果に、ご自分も出るようにしました(「あなた」の印つき。ご自分の仕事に合う相談かどうかがわかります)。",
      "・相談の言葉がその人の説明に1つもないときは、一致度を控えめ(70%まで)に出し、表示の%の順に並べます。",
      "・メンバーのいないジャンルは選べないようにし、見つからないときは次に試すことを出します。詳細の画面から「この人を共有」できます。",
      "・肩書きの印が言葉の途中で折り返さないように、スマホの結果のボタンを2列にそろえました。",
      "",
      "■ 会費・領収書(いまは 0円)",
      "・マイページ →「会費・領収書」で、会費のプランと明細を見られ、領収書・明細書を印刷・PDF で保存できます。",
      "",
      "■ LINE で通知(準備ができました)",
      "・運営が LINE 公式アカウントをつなぐと、マイページ →「通知を受け取る」から LINE でも通知を受け取れるようになります(6けたのコードでつなぎます)。始まるときは、あらためてお知らせします。",
      "",
      "■ 紹介を記録したあと",
      "・紹介先のメンバーと紹介した方それぞれに「LINE などで送る」「コピー」をまとめて出し、顔合わせの日時もその場で決められるようにしました。",
      "",
      "■ 見やすさ・使いやすさ",
      "・ランキングで、まだ記録がない方はまとめて1行に(押すと名前が出ます)。動いている方が見つけやすくなりました。",
      "・「数字」の画面の「リファーラル」を、ほかの画面と同じ「紹介」にそろえました。",
      "・「はじめての方へ」の丸は、押すと「済み」と「まだ」を切りかえられます(まちがえて押しても戻せます)。",
      "・出欠の登録のお願いを、「!」の印つきの帯で目立つようにしました。",
      "・お知らせの一覧で、時刻と「新着」がくっついて見えていたのを直しました。",
      "・絵文字のアイコンを線のアイコンにそろえ、パソコンのホームは「今月のあなた」とシグナルを横に並べました。",
      "・1on1 のおすすめのボタンが枠からはみ出していたのを直し、予定の画面の時計の文字を元の大きさに戻しました。",
      "",
      "■ 直した不具合",
      "・紹介を記録したあとの画面に「null」という文字が出ていたのを直しました(顔合わせの日時を入れなかったとき)。ほかの画面でも同じことが起きないようにしました。",
      "・下のメニューをつかんで動かすと、上に飛んでしまうことがあったのを直しました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-12-features-3",
    rev: 2, // 2: ログインのお名前は一覧から選ぶ形に戻した
    at: Date.UTC(2026, 9, 12, 12, 30), // 2026/10/12 21:30(日本時間)
    title: "【更新】使いやすさの総点検(確認の画面・削除は赤・早見表の見やすさ など)",
    body: [
      "10月12日の夜に、会員の画面・早見表やプロフィール・運営の画面を1つずつ点検し、見つかったところをまとめて直しました。",
      "",
      "■ 安心して使うために",
      "・削除などの取り消せない操作は、どの画面でも赤いボタンにし、確かめる画面を出すようにしました。",
      "・掲示板のコメントは、消す前に確かめるようにしました。直すときは下から出る画面で直せます。",
      "",
      "■ 直した不具合",
      "・プロフィールの「こんな話が出たら」が12個をこえていると、保存するたびに13個目からが消えていたのを直しました(24個まで入れられます。こえているときは保存の前にお知らせします)。",
      "・ありがとうを送ったあとに、空のフォームがもう一度開いていたのを直しました。金額に数字以外が入っているときは、お知らせします。",
      "・アプリ内の検索で、見つかった言葉の印が2文字ずれていたのを直しました。",
      "・入力のまちがいが「✓」のお知らせで出ていたのを、その欄のすぐ下に赤字で出すようにしました。",
      "",
      "■ 紹介先早見表・プロフィール",
      "・上の帯に、アプリと同じお知らせのベル(未読の数)とマイページの丸を出しました。ロゴを押すと、どこからでもアプリのホームに戻ります。ロゴの囲いも全ページでそろえました。",
      "・スマホの一覧のカードを短くしました(話題は3つ・ジャンルは4つまで。残りは「詳細・資料を見る」で)。",
      "・ほかの方のカードに「未入力」「まだ入力されていません」と出していたのをやめました。",
      "・パソコンで一覧の列がずれていたのを直しました。",
      "",
      "■ 見やすさ・使いやすさ",
      "・小さいボタンやベルも、指で押しやすい大きさにしました。薄くて読みにくかった文字を濃くしました。ボタンの形をすべての画面でそろえました。",
      "・お知らせの一覧は、運営連絡の題名がそのまま見出しに出ます。受け取ったありがとうの言葉は3行まで読めます。",
      "・予定の画面は、スマホでは時計を小さくして、カレンダーと出欠のボタンがすぐ見えるようにしました。",
      "・紹介の一覧では、長いメモは4行でたたみ、押すと全部読めます。",
      "・利用規約を開いたときは「前の画面に戻る」でアプリに戻れます。",
      "",
      "■ 運営の画面",
      "・スマホで隠れていた「LINE 連携」「バグ・要望」のタブを2段にして、すべて見えるようにしました。",
      "・定例会の出欠は「出席予定の人をまとめて出席にする」ボタンを付けました。開催前の定例会は「開催前」と出ます。",
      "・名簿の管理は、記入の状況を「入力待ち・あと少し・記入済み」の3段階で出します。",
      "・会費の一覧は名簿の順に、スマホでは名前が切れないようにしました。",
      "",
      "■ 共有サーバー",
      "・見るだけの操作(ホームや一覧)は、ほかの人の保存の順番を待たずに読めるようにしました(大勢で同時に使っても待たされにくくなります)。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-13-features",
    at: Date.UTC(2026, 9, 12, 16, 0), // 2026/10/13 1:00(日本時間)
    title: "【更新】ログインの制限をゆるやかに・早見表の結果を見やすく など",
    body: [
      "前回のお知らせのあとに入れた更新です。",
      "",
      "■ ログイン",
      "・パスワード(共通パスコード)は、5回まではまちがえてもログインが止まらないようにしました。6回目のまちがいで、15分だけ止まります。",
      "・これまでのまちがいの回数と、止まっていたログインは、いちど全員分を消しました。",
      "・お名前は、これまでどおり一覧から選ぶ形です(入力する形はやめました)。",
      "",
      "■ 紹介先早見表",
      "・「紹介診断」の入口を、相談を入れる箱の下にまとめました(「言葉が浮かばないときは、質問に答えて探す」)。",
      "・一致度の%の下に「とても合う(85%〜)」「合う(70%〜)」「参考に」の目安を出します。",
      "・結果と詳細では「紹介文をコピー」をいちばん押しやすく、ほかのボタンは控えめにしました。「カードを見る」は「詳細・資料を見る」にそろえました。",
      "・相談に合う人が見つからないときは、別の言い方の例と、紹介診断・ビジター招待のご案内を出します。",
      "・カードの小さな印(業種・拠点・チーム・資料の有無)の色をそろえ、すっきりさせました。",
      "",
      "■ プロフィール",
      "・ジャンルなどを選ぶところを、四角いチェックではなく、押すと色が変わるボタンにしました。",
      "・ページの名前を「プロフィール」にそろえ、「対応エリア」「対面で会えるエリア」は「活動範囲」にそろえました。",
      "",
      "■ 運営の画面",
      "・運営連絡の運営だけの操作(声かけ文・もう一度通知・編集・削除)を「運営の操作」にまとめ、未読の人数を目立たせました。",
      "・運営連絡を新しく出すときは、全員に届く前に内容を確かめる画面を出します。",
      "・バグ・要望は「まだ・受付・対応中・対応済み」で絞りこめ、どの画面から送られたかがわかるようにしました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-features",
    rev: 4,
    at: Date.UTC(2026, 9, 17, 16, 0), // 2026/10/18 1:00(日本時間)
    title: "【更新】30秒プレゼンを顔写真つきの大きな画面に・AIのジャンルの整理 など",
    body: [
      "前回のお知らせ(ログインの制限をゆるやかに・早見表の結果を見やすく など)のあとに入れた更新です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:30秒プレゼン(下のメニューに「プレゼン」を追加)",
      "・定例会の30秒プレゼンを、名前・肩書き・活動範囲・つながりたい人・こんな話が出たら・顔写真つきの大きな画面で順番に進められます。会場のスクリーンや Meet の画面共有でそのまま映せます。",
      "・時間は、下の「残り時間」のメーターと大きな残り秒数で見えます。1目盛りが1秒(2分・5分のときは2秒・5秒)で、目盛りの下に残りの秒数が出ます。残り10秒でオレンジ、残り5秒で赤になり、音でもお知らせします。",
      "・出る人は、顔の一覧を押すだけで選べます。押した順が話す順番です。「出席予定の人」「全員」「チームで足す」でまとめて選ぶこともでき、順番は ↑↓・つかんで動かす・シャッフルで変えられます。",
      "・右には次の3人が出ます。0秒になったら、選んだ秒数(1〜10秒。はじめは5秒)をあけて自動で次の人へ進みます。1人の時間は30秒・1分・2分・5分から選べます。",
      "・「プレゼン」の画面で、ご自分の顔写真を入れられます(縦長に切り抜いて小さくして保存します)。ぜひ入れてください。",
      "",
      "■ 今回:紹介先早見表のジャンル",
      "・「AI活用」は個人の方向け(AIの使い方のサポート)、「AI研修」は個人・法人どちらも、に分けました。2つは同じ「AI研修・AI活用」の業種です。",
      "・会社への「AI導入」は「システム開発」の枠に入れました。AI導入だけで合ったときは、一致度を少し低めに出します。システム開発の相談に、AIの使い方を教える方が出ないようにしました。",
      "・メンバーのジャンル・プロフィールの誤りを直し、内容を充実させました。",
      "・床島 良夫さんの「月面タイムカプセル」の資料(12ページ)を、紹介先早見表の資料欄に入れました。事業内容(地域連携のエリア登録プラン・大手ホテルグループ向けプラン)や求める紹介も、資料に合わせて充実させました。",
      "",
      "■ 今回:見やすさ",
      "・どの画面でも、右上の「ぁ|あ」で文字の大きさを切りかえられます(「あ」で大きく、「ぁ」で元の大きさ)。この端末のすべての画面に効きます。マイページの「文字を大きくする」は、これに置きかえました。",
      "・名前のうしろに呼び名が付いている方(例:小林 末季 / こばねぇ)は、名前と呼び名を2行に分けて出します。",
      "",
      "■ 前回:ログイン",
      "・パスワード(共通パスコード)は、5回まではまちがえてもログインが止まりません。6回目のまちがいで、15分だけ止まります。",
      "・お名前は、これまでどおり一覧から選ぶ形です。",
      "",
      "■ 前回:紹介先早見表・プロフィール・運営の画面",
      "・紹介診断の入口を相談の箱の下にまとめ、一致度に「とても合う」「合う」「参考に」の目安を出しました。",
      "・結果と詳細では「紹介文をコピー」をいちばん押しやすくしました。",
      "・プロフィールのジャンルなどは、押すと色が変わるボタンで選べます。",
      "・運営連絡・バグ・要望の運営の画面を使いやすくしました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-features-2",
    rev: 2,
    at: Date.UTC(2026, 9, 18, 0, 40), // 2026/10/18 9:40(日本時間)
    title: "【更新】プレゼンのメーターを見やすく・文字の大きさの切りかえ・床島さんの資料 など",
    body: [
      "前回のお知らせ(30秒プレゼンを顔写真つきの大きな画面に・AIのジャンルの整理 など)のあとに入れた更新です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:30秒プレゼン",
      "・下のメーターを「残り時間」にしました。1目盛りが残り1秒で、時間がたつと右から消えていきます。目盛りの下に残りの秒数(0・5・10…)が出るので、あと何秒あるかがひと目でわかります。左の5秒は赤、その次の5秒はオレンジです。",
      "・大きな数字の前に「残り」と出します。",
      "・0秒になったら、次の人へ自動で移るまでの間を1〜10秒から選べます(はじめは5秒)。待っているあいだは「次の人まで 5秒」と数えます。",
      "・1人の時間は 30秒・1分・2分・5分 から選べます(3分を5分にしました)。",
      "・下の「全画面」のボタンはなくしました。はじめると自動で全画面になります(パソコンは F キーでも切りかえられます)。",
      "・はじめたとき・数字が変わったときに、残り秒数とメーターの位置が動かないように固定しました。",
      "・進行の画面の上には、定例会の名前だけを出します(「・30秒プレゼン」の表記はなくしました)。",
      "",
      "■ 今回:見やすさ",
      "・どの画面でも、右上の「ぁ|あ」で文字の大きさを切りかえられます(「あ」で大きく、「ぁ」で元の大きさ)。この端末のすべての画面に効きます。マイページの「文字を大きくする」は、これに置きかえました。",
      "・名前のうしろに呼び名が付いている方(例:小林 末季 / こばねぇ)は、名前と呼び名を2行に分けて出します。",
      "・オープニングムービーは、右上の「▶」のボタンから見られます(スマホでも出します)。マイページの「オープニングムービー」は、これに置きかえました。",
      "",
      "■ 今回:紹介先早見表",
      "・床島 良夫さんの「月面タイムカプセル」の資料(12ページ)を、資料欄に入れました。事業内容(地域連携のエリア登録プラン・大手ホテルグループ向けプラン)や求める紹介も、資料に合わせて充実させました。",
      "・山本 捷真さんの求める紹介の先頭に「人手が足りない経営者」「人を雇いたい経営者」を入れました。",
      "・相談の箱で「人を雇いたい」と入れたときも、採用・人手不足の相談として読み取るようにしました。",
      "・小林 末季こばねぇさんのジャンルに「離職防止」を戻しました。",
      "",
      "■ 前回:30秒プレゼン(下のメニューの「プレゼン」)",
      "・顔写真と紹介(肩書き・活動範囲・つながりたい人・こんな話が出たら)つきの大きな画面で、順番に進められます。顔の一覧を押した順が話す順番です。",
      "・「プレゼン」の画面で、ご自分の顔写真を入れられます。ぜひ入れてください。",
      "",
      "■ 前回:紹介先早見表のジャンル",
      "・「AI活用」は個人の方向け、「AI研修」は個人・法人どちらも、に分けました。会社への「AI導入」は「システム開発」の枠に入れ、AI導入だけで合ったときは一致度を少し低めに出します。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-fix-1",
    at: Date.UTC(2026, 9, 18, 1, 10), // 2026/10/18 10:10(日本時間)
    title: "【修正】30秒プレゼンの画面の不具合を直しました",
    body: [
      "前回のお知らせ(プレゼンのメーターを見やすく・文字の大きさの切りかえ・床島さんの資料 など)のあとに直した不具合です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:30秒プレゼンの修正",
      "・右上の「あ」で文字を大きくしていると、プレゼンの画面まで大きくなり、文字がメーターに重なって見えなくなっていました。プレゼンの画面は、文字の大きさの切りかえに関係なく、いつも同じ大きさで出します。",
      "・ノートパソコンなど高さの少ない画面でも、文字がメーターに重ならないようにしました。画面の高さに合わせて、肩書き・つながりたい人は2行まで、こんな話が出たらは2つまでにして、途中で切れずに収めます。",
      "・プレゼンを終えて「閉じる」を押すと、画面が真っ白になり元の画面に戻れないことがありました(Safari など)。全画面をやめてから閉じるようにして、元の画面にきちんと戻るように直しました。",
      "",
      "■ 前回:30秒プレゼン",
      "・下のメーターを「残り時間」にし、目盛りの下に残りの秒数を出すようにしました。左の5秒は赤、その次の5秒はオレンジです。",
      "・次の人へ自動で移るまでの間を1〜10秒から選べます(はじめは5秒)。1人の時間は 30秒・1分・2分・5分 です。",
      "・はじめたとき・数字が変わったときに、残り秒数とメーターの位置が動かないように固定しました。",
      "",
      "■ 前回:見やすさ・紹介先早見表",
      "・右上の「ぁ|あ」で文字の大きさを切りかえられます。オープニングムービーは右上の「▶」から見られます。",
      "・床島 良夫さんの「月面タイムカプセル」の資料を資料欄に入れ、山本 捷真さんの求める紹介の先頭に「人手が足りない経営者」「人を雇いたい経営者」を入れました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-fix-2",
    rev: 12,
    at: Date.UTC(2026, 9, 18, 1, 25), // 2026/10/18 10:25(日本時間)
    title: "【修正】プレゼンを閉じたあと、プレゼンの画面に戻るようにしました",
    body: [
      "前回のお知らせ(30秒プレゼンの画面の不具合を直しました)のあとに直した内容です。前回の内容もあわせて載せます。",
      "",
      "■ 今回",
      "・プレゼンを終えて「閉じる」を押すと、Safari などで画面が真っ白のまま残ることがまだありました。「閉じる」を押したら、プレゼンの準備の画面(出る人を選ぶ画面)を読み込み直して出すようにしました。選んだ人と順番はそのまま残ります。",
      "・途中で「終わる」を押したときの確認を、ブラウザの確認の窓ではなく、プレゼンの画面の中に「つづける/終わる」で出すようにしました(全画面のときに確認の窓を出すと、画面が戻らないことがあるため)。",
      "・「おつかれさまでした」の画面で「閉じる」のボタンが一度画面の外へずれて戻る動きをなくしました(全画面は「閉じる」を押したときにやめます)。",
      "・「おつかれさまでした」の画面は、文字を画面のまん中に出し、「〇名の方が話しました」の表示はなくしました。",
      "・プレゼンの画面は、ブラウザの全画面には切りかえず、ブラウザの窓いっぱいに出すようにしました(全画面への切りかえで上下にブレる・閉じたあと真っ白になる原因だったため)。はじめるときも閉じるときも、ふわっと表示・消えて、すぐにプレゼンの画面に戻ります。",
      "・人が変わっても、名前・写真の位置が上下に動かないようにそろえました。次の人に移るときは、上下に動かさずにふわっと切りかえます。",
      "・プレゼンをはじめるとき・閉じたあとに、プレゼンの準備の画面が左右に少し動いていたのを直しました(スクロールバーを消さないようにしました)。",
      "・メニューの「探す」を「早見表」という名前にして、いちばん左に置きました。",
      "・ホームの「〇〇さんへの紹介が N 日そのままです」に、「声をかけた(7日後にまた)」「もう終わった(消す)」のボタンを付けました。30日たったものは自動で出なくなります。",
      "・ホームなどから紹介先早見表の詳しい画面を開いたときは、右上の × を押すと元の画面(ホームなど)に戻ります。",
      "・アプリを開いたままにしていると、更新が入っても古い画面(メニューの並びなど)のままになることがありました。画面を切りかえたときに新しい版があれば、自動で読み直すようにしました。",
      "・メニューを上か下に置いたとき、どのページでも同じまん中の位置に出るようにしました(ページによって少し左右にずれていました)。",
      "・上の帯を、すべてのページで同じ形にしました(左に「BT-EX5 新潟・東京 紹介者制コミュニティ」、右に 検索・ムービー・文字の大きさ・ベル・名前の丸)。帯にあった「紹介診断」「全体分析」などのボタンは外しました(紹介診断は早見表の相談の箱の下から、全体分析は早見表の「あなたと紹介し合えそうな人」の下から開けます)。",
      "・会場のスクリーンで画面いっぱいに映すときは、ブラウザの全画面(Mac は control+command+F、Windows は F11)を使ってください。",
      "・画面の表記を「30秒プレゼン」から「プレゼン」にそろえました(1人の時間は30秒〜5分から選べるため)。",
      "・スマホの紹介先早見表の上の帯から「紹介診断」のボタンを外し、ロゴの「BT-EX5」の文字を戻しました(紹介診断は、相談の箱の下の「言葉が浮かばないときは、質問に答えて探す」から開けます)。",
      "",
      "■ 前回",
      "・右上の「あ」で文字を大きくしていても、プレゼンの画面は大きくならないようにしました。",
      "・ノートパソコンなど高さの少ない画面でも、文字がメーターに重ならないようにしました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-menu-1",
    rev: 3,
    at: Date.UTC(2026, 9, 18, 2, 55), // 2026/10/18 11:55(日本時間)
    title: "【変更】下のメニューの「ホーム」をなくし、「記録」の「まとめ」にまとめました",
    body: [
      "前回のお知らせ(プレゼンを閉じたあと、プレゼンの画面に戻るようにしました)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:メニューの整理",
      "・下のメニューから「ホーム」をなくしました。並びは「早見表・記録・予定・プレゼン・掲示板・運営連絡」です。",
      "・これまでホームにあったもの(今月のあなた・BT-EX5 シグナル・あなたのやること・次の定例会・全体の今月・今週の紹介チャレンジ など)は、「記録」のいちばん左の「まとめ」に出ます。ログインしたあとや、左上のロゴを押したときも「まとめ」が開きます。",
      "・ホームにあったタイマーは、「プレゼン」の画面の時間の選び方と一つにしました。30秒・1分・2分・3分・5分・10分・25分(ポモドーロ)から選び、「〇分のタイマーをはじめる(自分で使う)」で、プレゼンと同じ大きなメーターの画面でタイマーが使えます。",
      "・25分を選ぶと、ポモドーロ(25分集中+5分休憩 を4回)を自動で続けて進めます。",
      "・自分で使うタイマー・ポモドーロの画面のまん中に、「予定」の画面と同じアナログ時計(いまの時刻)を出しました。",
      "",
      "■ 前回",
      "・上の帯を、すべてのページで同じ形にしました(左に「BT-EX5 新潟・東京 紹介者制コミュニティ」、右に 検索・ムービー・文字の大きさ・ベル・名前の丸)。",
      "・「〇〇さんへの紹介が N 日そのままです」に、「声をかけた(7日後にまた)」「もう終わった(消す)」のボタンを付けました。",
      "・紹介先早見表の詳しい画面をほかの画面から開いたときは、右上の × で元の画面に戻ります。",
      "・プレゼンは、ブラウザの全画面に切りかえず、窓いっぱいにふわっと出し入れするようにしました(上下のブレ・閉じたあとの真っ白をなくしました)。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-menu-2",
    rev: 3,
    at: Date.UTC(2026, 9, 18, 5, 0), // 2026/10/18 14:00(日本時間)
    title: "【変更】「まとめ」をなくし、それぞれの画面に移しました・プレゼンにゲスト など",
    body: [
      "前回のお知らせ(下のメニューの「ホーム」をなくし、「記録」の「まとめ」にまとめました)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:「まとめ」をなくしました",
      "・「あなたのやること」「はじめての方へ」「紹介されやすくするために」は「予定」のいちばん上に出ます。ログインしたあとや、左上のロゴを押したときは「予定」が開きます。",
      "・「今月のあなた」「BT-EX5 シグナル」「BT-EX5 全体の今月」は「記録」→「数字」に、「今週の紹介チャレンジ」は「記録」→「紹介」に出ます。",
      "・次の定例会・運営連絡・1on1 のおすすめは、それぞれ「予定」「運営連絡」「記録」→「1on1」で見られるので、ほかの画面からは外しました。",
      "・「記録」の「マイル」を「ありがとうマイル」という名前にしました。",
      "",
      "■ 今回:プレゼン",
      "・「1. 定例会のプレゼン」と「2. 自分で使うタイマー(プレゼンの練習・ポモドーロ)」に分けて、見やすくしました。",
      "・出る人に「ほかの BT-EX のメンバー」と「ゲスト」を足せます。時間ははじめ30秒で、1人ずつ5秒きざみで変えられます。",
      "・名前の上に、代表・役職・役割のマーク(例:BT-EX5代表、本システム開発者)を出します。",
      "・自分で使うタイマーは、時間のボタンを押すたびに足せます(例:10分を2回で20分)。画面はアナログ時計を大きく出します。",
      "・「つながりたい人」を、途中で切らずに出すようにしました。",
      "",
      "■ 今回:1on1",
      "・ほかの BT-EX のユニットの方との 1on1 も記録できるようにしました。「相手」で BT-EX の番号(1〜14)を選び、一覧からお名前を選ぶか、お名前を入れてください。あなたの 1on1 の回数に数えます(相手のアプリには届きません)。BT-EX5 を選ぶと、これまでどおりこのアプリのメンバーから選べます。",
      "・ほかのユニットの方は、BT-EX1〜14 の全員(BT-EX5 をのぞく277名)の一覧から押して選べます。お名前を少し入れると、すべてのユニットからすぐ探せます(選ぶと番号も切りかわります)。一覧にいない方は、入れたお名前のまま記録できます。",
      "・プレゼンの「ほかの BT-EX のメンバー」も、同じように番号と一覧から押して足せます。スライドには「BT-EX7 メンバー」のように番号が出ます。",
      "",
      "■ 今回:そのほか",
      "・右上の「あ」で文字を大きくしたとき、下(横)のメニューが消えてしまうことがあったのを直しました。",
      "・BT-EX5副代表のマークを、代表と同じ金の枠・王冠にしました。",
      "・山本 捷真さんの「こんな話が出たら」の先頭を「人手が足りない」「人が採れない」「手作業に時間がかかる」「社員にAIを使わせたい」にしました。",
      "",
      "■ 前回",
      "・下のメニューは「早見表・記録・予定・プレゼン・掲示板・運営連絡」です。",
      "・「〇〇さんへの紹介が N 日そのままです」は、「声をかけた」「もう終わった」で消せます。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-3",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 5, 45), // 2026/10/18 14:45(日本時間)
    title: "【アップデート】ほかの BT-EX の方との 1on1・「記録」に「分析」 など",
    body: [
      "前回のアップデート(「まとめ」をなくし、それぞれの画面に移しました・プレゼンにゲスト など)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:1on1",
      "・ほかの BT-EX のユニットの方との 1on1 も記録できます。「1on1 を予定・記録する」で「ほかの BT-EX の方と 1on1 をした →」を押し、BT-EX の番号(1〜14)を選んでください。",
      "・BT-EX1〜14 の全員(BT-EX5 をのぞく277名)の一覧から、お名前を押すだけで選べます。お名前を少し入れると、すべてのユニットからすぐ探せます(選ぶと番号も切りかわります)。",
      "・一覧にいない方は、お名前を入れて記録できます。あなたの 1on1 の回数に数えます(相手のアプリには届きません)。",
      "",
      "■ 今回:プレゼン",
      "・「ほかの BT-EX のメンバー」も、番号と一覧から押して足せます。スライドには「BT-EX7 メンバー」のように番号が出ます。",
      "",
      "■ 今回:記録",
      "・「数字」を「分析」という名前にして、「紹介」の左に置きました。",
      "",
      "■ 前回",
      "・「まとめ」をなくしました。あなたのやることは「予定」のいちばん上、今月のあなた・BT-EX5 シグナルは「記録」→「分析」、今週の紹介チャレンジは「記録」→「紹介」に出ます。",
      "・「マイル」を「ありがとうマイル」という名前にしました。",
      "・プレゼンは「1. 定例会のプレゼン」と「2. 自分で使うタイマー(プレゼンの練習・ポモドーロ)」に分け、ゲストやほかの BT-EX のメンバーを1人ずつの時間(5秒きざみ)で足せるようにしました。名前の上には代表・役職・役割のマークが出ます。",
      "・右上の「あ」で文字を大きくしたとき、メニューが消えてしまうことがあったのを直しました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-4",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 8, 30), // 2026/10/18 17:30(日本時間)
    title: "【アップデート】定例会の進行スライド(オープニングムービーから終わりの挨拶まで)・メンバー情報",
    body: [
      "前回のアップデート(ほかの BT-EX の方との 1on1・「記録」に「分析」 など)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:定例会の進行スライド",
      "・「プレゼン」→「1. 定例会のプレゼン」で「定例会のスライドも入れる」にチェックを入れて始めると、BT-EX のオープニングムービーから始まり、当日の流れの順にスライドが進みます。",
      "・流れは BT-EX の指針の順です:1. はじめの挨拶(代表の紹介)/ 2. BT-EXの理念(BT-EXとは・理念とビジョン・目的・BT-EX5 の特徴・仕組みとベネフィット・主な3つの活動)/ 3. エデュケーションコーナー(5分のタイマー)/ 4. 1分プレゼンテーション(出る人のスライド)/ 5. ブレイクアウトルーム商談(このような人のお役に立てます・それぞれの強み・規定・スケジュールのあとに 15分×2回のタイマー)/ 6. LINKのビジネス実績紹介 / 7. 終わりの挨拶。",
      "・スケジュールのスライドの「次回以降」は、「予定」に入っている定例会から自動で出ます。",
      "・上の選択から、流れのどこへでもすぐ移れます(商談のタイマーにもすぐ飛べます)。",
      "・定例会の「当日の流れ」を、指針の順に書きかえました(運営が書きかえた回はそのままです)。",
      "・10分をこえるタイマーで、スマホでは残り時間とメーターを2段に分けて見やすくしました。",
      "",
      "■ 今回:メンバー情報",
      "・品川 瑞樹さん・栁橋 雅也さんのプロフィールを、ご本人の資料をもとに充実させました(経歴・理念・事業内容・こんな話が出たら)。",
      "",
      "■ 前回",
      "・ほかの BT-EX のユニットの方との 1on1 も記録できます(BT-EX1〜14 の一覧から選ぶか、お名前を入れる)。",
      "・プレゼンの「ほかの BT-EX のメンバー」も一覧から足せて、スライドには「BT-EX7 メンバー」のように番号が出ます。",
      "・「数字」を「分析」という名前にして、「紹介」の左に置きました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-5",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 9, 30), // 2026/10/18 18:30(日本時間)
    title: "【アップデート】定例会スライドの文字の改行など",
    body: [
      "前回のアップデート(定例会の進行スライド・メンバー情報)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回",
      "・はじめのスライドの題を「日本海側最大のマーケット」「新潟⇔東京」の2行に分けました。",
      "・「BT-EXとは」の文章を、資料と同じところで改行しました。",
      "・定例会の「当日の流れ」から「★貢献、ありがとう発表は11月以降から」を消しました。",
      "",
      "■ 前回",
      "・「プレゼン」→「1. 定例会のプレゼン」で「定例会のスライドも入れる」にチェックを入れると、オープニングムービーから終わりの挨拶まで、BT-EX の指針の順にスライドが進みます(代表の紹介・理念・規定・スケジュール・商談のタイマーなど)。",
      "・上の選択から、流れのどこへでもすぐ移れます。スケジュールの「次回以降」は「予定」の定例会から自動で出ます。",
      "・品川 瑞樹さん・栁橋 雅也さんのプロフィールを、ご本人の資料をもとに充実させました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-6",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 11, 0), // 2026/10/18 20:00(日本時間)
    title: "【アップデート】定例会スライドのデザインを一新しました",
    body: [
      "前回のアップデート(定例会スライドの文字の改行など)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:定例会スライドのデザイン",
      "プレゼン資料づくりの定番の考え方(1枚に1つのこと・色は3色まで・書体は2種類まで・余白をとる・箇条書きより図で見せる・いまどこかを示す)に合わせて作り直しました。",
      "・表紙のあとに「本日の流れ」を入れました。",
      "・区切りのスライドの右に流れの一覧を出し、いまの所が光るようにしました。",
      "・どのスライドも左上に「02 BT-EXの理念」のように、いまの流れを出します。",
      "・下に進行バー(流れの1〜7とページ数)を付けました。",
      "・目的は 2×2、仕組みとベネフィットは要点つきの 3×3、主な3つの活動・それぞれの強みは横に3つのカードにしました。",
      "・BT-EX5 の特徴は、新潟と東京を金の線でつないだ図にしました。",
      "・規定は一般規定と出席規定を左右に並べ、大事な数字に金のマーカーを引きました。",
      "・スケジュールは日ごとのカードにしました。",
      "・パソコンでは、スライドが画面に収まらないときに自動で縮めて収めます。",
      "",
      "■ 前回",
      "・表紙の題を「日本海側最大のマーケット」「新潟⇔東京」の2行に分けました。",
      "・「BT-EXとは」の文章を、資料と同じところで改行しました。",
      "・定例会の「当日の流れ」から「★貢献、ありがとう発表は11月以降から」を消しました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-7",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 11, 30), // 2026/10/18 20:30(日本時間)
    title: "【アップデート】プレゼン中の操作を下のバーにまとめました",
    body: [
      "前回のアップデート(定例会スライドのデザインを一新)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:プレゼン中の操作",
      "・「戻る」「はじめる/とめる」「進む」「終了」を、アプリの下のメニューと同じ形のバーにまとめました。絵と文字の大きなボタンで、押しやすくしています。",
      "・「おつかれさまでした」の画面からも「戻る」で最後のスライドに戻れるようにしました(キーボードの ← でも戻れます)。",
      "",
      "■ 前回",
      "・定例会スライドを、プレゼン資料づくりの定番の考え方に合わせて作り直しました(本日の流れ・いまの流れの表示・下の進行バー・カードや図での見せ方)。",
      "・パソコンでは、スライドが画面に収まらないときに自動で縮めて収めます。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-8",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 12, 0), // 2026/10/18 21:00(日本時間)
    title: "【アップデート】顔写真・定例会のタイムマネジメント・スライドの編集 など",
    body: [
      "前回のアップデート(プレゼン中の操作を下のバーにまとめました)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:顔写真",
      "・運営から受け取った12名の顔写真を入れました(桜羽さん・栁橋さん・あまみやさん・三村さん・岡本さん・こばねぇさん・大枝さん・床島さん・菅野さん・品川さん・吉澤さん・むらさきさん)。紹介先早見表のくわしい画面と、定例会のプレゼンの画面に出ます。",
      "",
      "■ 今回:定例会の進行",
      "・2時間の定例会のタイムマネジメントを付けました。いまの時刻と、予定より遅れていれば赤で「○分○秒 遅れ」、早ければ緑で「○分○秒 早い」、定刻どおりなら灰色で表示します。",
      "・タイムマネジメントと下の操作バーは、左のつまみ(⠿)をつかんで好きな場所に動かせます(2回押すと元の場所)。",
      "・ブレイクアウトルーム商談のときに、アナログ時計が止まっていたのを直しました。商談の画面の「次は…」の表示は消しました。",
      "・規定(一般・出席・倫理)とスケジュールのスライドを、「BT-EXの主な3つの活動」のすぐあとに移しました。",
      "・「LINKのビジネス実績紹介」のあとに、「1on1・リファーラル・招待ビジターの発表」と「ありがとうマイルの発表」の挙手のお願いを入れました。",
      "・プレゼンのスライドでは、呼び名のある方のお名前を「小林 末季 こばねぇ さん」のように1行で出します。",
      "・スライドの内容(スケジュール・規定・代表の紹介など)と時間の目安を、アプリの中で編集できるようにしました(進行役のみ)。",
      "",
      "■ 今回:そのほか",
      "・下のメニューの「運営連絡」を「アップデート」という名前にしました。",
      "・プレゼン(定例会の進行)の画面は、進行役だけが使えるようにしました。",
      "",
      "■ 前回",
      "・プレゼン中の「戻る」「はじめる/とめる」「進む」「終了」を、下のメニューと同じ形のバーにまとめました。",
      "・「おつかれさまでした」の画面からも「戻る」で最後のスライドに戻れます。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-9",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 12, 30), // 2026/10/18 21:30(日本時間)
    title: "【アップデート】7名の資料を追加し、プロフィールを充実させました",
    body: [
      "前回のアップデート(顔写真・定例会のタイムマネジメント・スライドの編集 など)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:資料とプロフィール",
      "・栁橋さん(野外音楽フェス×地方創生のご案内・プロフィールシート)、あまみやさん、吉原さん、岡本さん、むらさきさん、菅野さん、こばねぇさんの資料を、紹介先早見表のくわしい画面の「資料」に入れました。",
      "・資料の内容をもとに、事業内容・実績・こんな話が出たら などを充実させました。",
      "・吉原さんの LINE・Instagram を「連絡先・SNS」に入れました。",
      "・資料の中の電話番号・生年月日などは、見えないようにしています。",
      "",
      "■ 前回",
      "・12名の顔写真を入れました(早見表のくわしい画面と、定例会のプレゼンの画面)。",
      "・定例会のタイムマネジメント(遅れは赤・早いと緑・定刻は灰色)と、動かせる操作バーを付けました。",
      "・挙手のお願いの2ページを足し、規定とスケジュールを「主な3つの活動」のあとに移しました。",
      "・下のメニューの「運営連絡」を「アップデート」という名前にしました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-10",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 13, 0), // 2026/10/18 22:00(日本時間)
    title: "【アップデート】定例会の時間配分を決め直しました(商談は10分×3回)",
    body: [
      "前回のアップデート(7名の資料を追加し、プロフィールを充実)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:定例会の時間配分(合計2時間)",
      "・オープニング 1分/① はじめの挨拶 5分/② BT-EXの理念 20分/③ エデュケーションコーナー 6分/④ 1分プレゼンテーション 32分/⑤ ブレイクアウトルーム商談 10分×3回=30分+α 6分/⑥ LINKのビジネス実績紹介 15分/⑦ 終わりの挨拶 5分",
      "・ブレイクアウトルーム商談のタイマーを、15分×2回から10分×3回にしました。エデュケーションコーナーのタイマーは6分です。",
      "・タイムマネジメントの「遅れ・早い」は、この時間配分で計算します。",
      "",
      "■ 前回",
      "・栁橋さん・あまみやさん・吉原さん・岡本さん・むらさきさん・菅野さん・こばねぇさんの資料を、紹介先早見表の「資料」に入れ、プロフィールを充実させました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-11",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 13, 30), // 2026/10/18 22:30(日本時間)
    title: "【アップデート】定例会スライドの文字の改行を整えました",
    body: [
      "前回のアップデート(定例会の時間配分を決め直しました)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回",
      "・はじめのスライドの題は「日本海側最大のマーケット」を1行で出し、入りきらない画面では「日本海側最大の/マーケット」と分けます(言葉の途中では改行しません)。",
      "・ビジョンを「貢献と成果が循環/し続ける事業家集団へ。」と改行しました。",
      "・目的の「LINK・BT の/仕組み活用の促進」、ベネフィットの「出席とリファーラルと/1on1 のコミットにより、/ビジネスを加速させる。」「エデュケーションコーナー、/BT スクール連携により、/ビジネススキルの向上。」「会員拡大の仕組みに加え、/LINK の 20,000人の市場で/告知やセミナー、テストマーケなど使い放題!」「深い 1on1 により、/強固なビジネスチームや/コラボレーションの構築!」「セールスイベントで、/LINK や BT の市場をフル活用!」を改行しました。",
      "・ベネフィットの文は、1行の途中では折り返しません(入りきらない画面では、文字を少し小さくして収めます)。",
      "・スライドの内容の編集でも、改行をそのまま入れられるようにしました。",
      "",
      "■ 前回",
      "・定例会の時間配分を決め直しました(合計2時間)。ブレイクアウトルーム商談は10分×3回=30分+α 6分、エデュケーションコーナーは6分です。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-12",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 14, 0), // 2026/10/18 23:00(日本時間)
    title: "【アップデート】定例会スライドの改行をさらに整えました",
    body: [
      "前回のアップデート(定例会スライドの文字の改行を整えました)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回",
      "・主な3つの活動:「パターン1:リアル定例会/& オンライン定例会」(続きの行は「:」のあとにそろえます)、「会員拡大活動/& 市場取り活動」、「メンバーのプレゼンや/メンバーサイト、/日頃の 1on1 により、/常に紹介できる人脈を探す活動。」、「定型の 1on1 シートにより、/効果的なビジネスミーティング/をしていく活動。」",
      "・規定:「BT-EX の/一般規定・倫理規定・出席規定」、「金融商品においては、金融庁登録番号を/取得している業者に限る。」、「公の場やチャットにおいても、メンバーやグループへの否定的な発言は控え、/互いを尊重するコミュニケーションを大切にします。」",
      "・お役に立てます:「LINKの紹介を出すのが苦手な/チームメンバーがいる方」",
      "・挙手のお願い:「について、/発表できる方は/挙手をお願いします」",
      "・スライドの内容の編集では、1行に1つずつ書く欄でも「↵」を入れるとそこで改行できます。",
      "",
      "■ 前回",
      "・表紙の題、ビジョン、目的、ベネフィットの文を指定の位置で改行し、ベネフィットの文は1行の途中で折り返さないようにしました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-13",
    cat: "アップデート",
    at: Date.UTC(2026, 9, 18, 14, 30), // 2026/10/18 23:30(日本時間)
    title: "【アップデート】プレゼン画面のアイコンとデザインを磨きました",
    body: [
      "前回のアップデート(定例会スライドの改行をさらに整えました)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回:プレゼン画面のデザイン(Apple・Google のデザインの指針にならいました)",
      "・アイコンを、線の太さと形をそろえた上品な線のアイコンに作り直しました(戻る・はじめる・とめる・進む・終了・閉じる、チェック、タイムマネジメントの状態)。",
      "・挙手のマークを、金の輪とガラスの円盤に線の手を重ねたデザインにし、うしろの光がゆっくり呼吸するようにしました。",
      "・下の操作バーとタイムマネジメントを、うしろが透けるガラスの板にしました。いま押すボタンには丸い下地が付き、触れる・押すと明るくなります。",
      "・操作バーを左右のはしへ動かすと、縦に並ぶようにしました。",
      "・タイムマネジメントの「遅れ・早い・定刻」に、それぞれの絵を付けました。",
      "・「について、発表できる方は…」などの見出しが、言葉の途中で改行されないようにしました。",
      "",
      "■ 前回",
      "・主な3つの活動・規定・お役に立てます・挙手のお願いの文を、指定の位置で改行しました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-18-update-14",
    cat: "アップデート",
    rev: 2,
    at: Date.UTC(2026, 9, 18, 15, 0), // 2026/10/19 0:00(日本時間)
    title: "【アップデート】エデュケーションコーナーを5分(+α1分)にしました",
    body: [
      "前回のアップデート(プレゼン画面のアイコンとデザインを磨きました)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回",
      "・エデュケーションコーナーのタイマーを5分にしました。時間の目安は、5分+α1分の6分のままです(合計2時間は変わりません)。",
      "・「LINKの紹介を出すのが苦手な/チームメンバーがいる方」を、どの画面でも2行で出すようにしました(入りきらないときは、一覧の文字をそろって少し小さくします)。",
      "・プレゼン(定例会の進行)の画面を、こばねぇさんも使えるようにしました。",
      "・操作バーの「進む」などの位置が、スライドによって動かないようにしました(「はじめる」が出ないスライドでも、場所はそのまま)。",
      "・区切りのスライドの題を「ブレイクアウト/ルーム商談」と改行しました。",
      "・操作バーとタイムマネジメントを、機能はそのままに小さくまとめました(タイムマネジメントは、小さくすると時刻とずれだけの1行になります)。",
      "・プレゼンの「ほかの BT-EX のメンバー」で、参加する方を押すと金色になり ✓ が付くようにしました。もう一度押すと外れます。",
      "・BT-EX のメンバーをお名前で探すとき、日本語の変換中に Enter や Shift+Enter を押しても、勝手に選ばれたり戻ったりしないようにしました(1on1 の記録も同じ)。",
      "・アプリ全体のアイコンを、線の太さと形をそろえた上品な線のアイコンに作り直しました(下のメニュー・検索・お知らせ・ムービー・一覧の矢印・チェックなど)。",
      "・下のメニューは、いま開いているタブの絵のうしろに金色の丸い下地が付くようにしました。ボタンや一覧は、触れる・押すと少し明るくなり、キーボードで選ぶと金のリングが出ます。",
      "・プレゼン中の「とめる」「進む」が、押しても反応しないことがあったのを直しました。",
      "・時間の途中で話し終わったときは、そのまま「進む」を押すと次の人へ移り、次の人の時間もそのまま始まります(先に「とめる」を押す必要はありません)。",
      "・パソコンなど広い画面では、タイムマネジメントを左はし、操作バーを右はし(縦)の、どちらも下のメーターのすぐ上をはじめの場所にしました(つまみを2回押すと、この場所に戻ります)。",
      "・プレゼンの「ほかの BT-EX のメンバー」「ゲスト」の欄を見やすくしました。BT-EX のメンバーは大きなボタンで開き、①番号を押す → ②お名前を押す の順で選べます。ゲストは「お名前」「会社・肩書き」の欄と「ゲストを足す」ボタンにしました。入っている人数も出ます。",
      "・どの画面の入力欄でも、日本語の変換中・変換を決めた直後の Enter や、Shift+Enter で、勝手に検索・追加・画面の移動がされないようにしました(アプリ内の検索、ゲストの追加など)。",
      "・上の🔍(アプリ内を探す)では、アップデート(運営からのお知らせ)を出さないようにしました。メンバー・掲示板・定例会だけを探します。",
      "",
      "■ 前回",
      "・プレゼン画面のアイコンを線の太さと形をそろえた線のアイコンに作り直し、挙手のマーク・操作バー・タイムマネジメントのデザインを磨きました。",
      "・操作バーを左右のはしへ動かすと、縦に並ぶようにしました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-19-update-15",
    cat: "アップデート",
    rev: 5,
    at: Date.UTC(2026, 9, 18, 16, 0), // 2026/10/19 1:00(日本時間)
    title: "【アップデート】話す順番を「BT-EX5 → ほかの BT-EX → ゲスト」に固定しました",
    body: [
      "前回のアップデート(エデュケーションコーナーを5分(+α1分)にしました)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回",
      "・定例会スライドを、インフォグラフィックで見やすくしました:本日の流れに時間配分の帯と始まる時刻、代表の実績を大きな数字に、BT-EXとはに「LINK の市場 × BT のスキル × 3つの強み = BT-EX」の式、目的・ベネフィット・3つの活動に絵、3つの強みのベン図、「数字で見る BT-EX の約束」、スケジュールに絵を付けました。",
      "・BT-EX5 の特徴のスライドで、飛行機が東京から新潟へ飛び(通ったあとに点線が出ます)、新幹線が新潟から東京へ線路を走るようにしました。",
      "・プレゼンの「シャッフル」は、BT-EX5 のメンバーだけを入れかえるようにしました。",
      "・「数字で見る BT-EX の約束」などの大きな数字が、枠からはみ出さないようにしました(入りきらないときは数字を少し小さくします)。",
      "・定例会のスライドは「おつかれさまでした」を出さず、最後のスライド(本日もありがとうございました)の「閉じる」でそのまま終わるようにしました。",
      "・表紙の日時と本日の流れの時刻・時間配分・タイムマネジメントは、「予定」に登録した定例会の日時(開始〜終了)から出します。2時間でない回は、時間配分を同じ割合でのばす・ちぢめます。",
      "・仕組みとベネフィットのカードの中身を中央にそろえ、主な3つの活動の「パターン1・2・3」を1つずつ枠で囲みました。3つの強みのベン図の説明を3行に分けました。",
      "・ベン図の強み・下の進行バーの名前・タイムマネジメントの「いま」を「…」で切らず、最後まで出すようにしました(長いものはことばの切れ目で2行に分けます)。",
      "・プレゼンで足した「ゲスト」「ほかの BT-EX のメンバー」に「編集」ボタンを付けました。お名前・会社・肩書き(ほかの BT-EX の方は BT-EX の番号も)をあとから直せます。",
      "・プレゼンの話す順番は、必ず「BT-EX5 のメンバー → ほかの BT-EX のメンバー(BT-EX1 から 14 の順)→ ゲスト」になるようにしました。シャッフル・名前の順・↑↓・つかんで動かすときも、この順番は変わりません(それぞれの中で並べかえられます)。話す順番には組ごとの見出しも出ます。",
      "・本日の流れの時刻を左にそろえ、「ブレイクアウト/ルーム商談」のように、ことばの切れ目で改行するようにしました。",
      "・代表の紹介の「現在」(SNS運用代行・資産形成スクールの広報)を、指定の位置で改行しました。入りきらないときは、スライド全体を少し小さくして枠に収めます。",
      "・BT-EXとはの文の「、」「。」、理念・ビジョン・仕組みとベネフィット・主な3つの活動の「。」「!」、規定(一般・出席・倫理)の「。」を消しました(改行の位置はそのまま)。",
      "・出席規定を「所属ユニットの出席は月1回以上/月2回のうち1回は他ユニットの/出席もカウントとする」「無断欠席・遅刻早退は禁止/(2回の遅刻、早退で1回欠席扱い)」と改行しました。",
      "・スケジュールの注意書きを「今後、新潟・東京各月でリアル定例会も開催予定」に、BNI の強みを「リファーラル・出席をコミット」にしました。ベン図の説明の「、」と、最後のスライドの「。」も消しました。",
      "・挙手のお願いを「について/発表できる方は/挙手をお願いします」にし、注意書きを「※ ありがとうマイルは次のページで発表します/ここでは発表しないでください」と改行して「。」を消しました。",
      "・プレゼンの「ゲスト」「ほかの BT-EX のメンバー」に、フリガナ(カタカナ)を入れられるようにしました。スライドではお名前のすぐ下に出ます。ゲストは足すときの「フリガナ」の欄、ほかの BT-EX の方は「編集」から入れられます。「加藤寛之(カトウヒロユキ)」のようにカッコで入れたものも、お名前とフリガナに分けて出します。",
      "・「数字で見る BT-EX の約束」を「BT-EX の約束」にし、数字の下の線をカードの端から端まで引くようにしました。",
      "・一般規定・出席規定・倫理規定を、それぞれ1枚のスライドにし、絵・番号・見出しのついたカードで見やすくしました(禁止のものは赤い印と「禁止」の札)。規定の文はそのままです。カードの見出しは「スライドの内容を編集」で変えられます。",
      "・主な3つの活動の「パターン1・2・3」を枠で囲んだ札にし、「:」を消しました。",
      "・代表の紹介の「「コスパ最高の事業支援 &/日本トップの資産形成スクール」の広報」を、必ず2行で出すようにしました。",
      "・仕組みとベネフィットの文の「、」を消し(「エデュケーションコーナー・BT スクール連携により」)、「毎月のリアルな懇親会で/絆を深くする」と改行しました。",
      "・主な3つの活動の文の「、」を消し、「メンバーのプレゼンや/メンバーサイト・/日頃の 1on1 により/常に紹介できる人脈を探す活動」としました。",
      "・スライドの題の下線を、題の文字の端から端まで引くようにしました。",
      "・大場さん・一場さん・佐藤 志織さん・大藤さん・見上さん・柏木さん・松田さん・坂上さん・髙橋さんの顔写真を入れました(30秒プレゼンのスライドなどに出ます)。",
      "・大場さんの顔写真を、新しくいただいた鮮明な写真に差しかえました。",
      "・プレゼン(定例会の進行)の画面と、スライドの内容の編集を、あまみやさん・桜羽さん・床島さん・三村さん・大場さん・大枝さん・栁橋さん・吉澤さんも使えるようにしました。",
      "・タイムマネジメントを新しい形にしました。開いたときは、いまの部の名前と「オンタイム・◯分遅れ・◯分早い」の札、理想(いまの部の予定の時間)、現在の時刻、いまのスライド、部の進み具合のバーを出します。閉じたときは「◯分遅れ」などの札の1行だけになり、札を押すと開きます。",
      "・栁橋 雅也さんのお名前の漢字を直しました(「柳」→「栁」)。",
      "・BT-EX5 の名簿を bt-ex.jp の名簿(26名)に合わせました。長田 恵美子さんが加わり、佐藤 慎哉さんが名簿から外れました。",
      "・【新機能】「欲しい紹介 ランキング」:プロフィールの「求める紹介」の下で、欲しい紹介を1位〜5位まで登録できるようにしました。早見表・プロフィールの詳細・定例会の30秒プレゼンのスライド・紹介を記録する画面(紹介先を選ぶと出ます)に、順位つきで出ます。",
      "・倫理規定の「否定的な発言は控え」のあとの「、」を消しました。表紙の日時と、本日の流れの見出しの下の「13:00 〜 15:00(120分)」を出さないようにしました(時間配分の帯と各行の時刻はそのまま)。",
      "",
      "■ 前回",
      "・エデュケーションコーナーのタイマーを5分にしました(時間の目安は5分+α1分の6分)。",
      "・プレゼン(定例会の進行)の画面を、こばねぇさんも使えるようにしました。",
      "・操作バーとタイムマネジメントを小さくまとめ、広い画面でははじめから左右のはしに置くようにしました。",
      "・「とめる」「進む」の反応をよくし、時間の途中でも「進む」で次の人へ移れるようにしました。",
      "・「ほかの BT-EX のメンバー」「ゲスト」の欄を見やすくし、日本語の変換中の Enter で勝手に追加・検索されないようにしました。",
      "・アプリ全体のアイコンを、線の太さと形をそろえた線のアイコンに作り直しました。",
      "・上の🔍では、アップデートを出さないようにしました。",
    ].join("\n"),
  },
  {
    seedId: "2026-10-25-update-16",
    cat: "アップデート",
    rev: 38,
    at: Date.UTC(2026, 9, 25, 4, 0), // 2026/10/25 13:00(日本時間)
    title: "【アップデート】紹介診断に「相手がこう言っていたら」・アンケート・運営タブ など",
    body: [
      "前回のアップデート(話す順番を「BT-EX5 → ほかの BT-EX → ゲスト」に固定)のあとに入れた変更です。前回の内容もあわせて載せます。",
      "",
      "■ 今回",
      "【紹介診断】",
      "・1問目に「相手がこう言っていたら」を足しました。「モデルになりたい」「ライバーになりたい」「パソコンが古い」「インバウンドのお客様を紹介できる」「海外でお店を経営している」など、相手が口にしそうな言葉のまま選べます。選ぶと2問目をとばして、合う人を探します。",
      "・3問目「相手はどんな方ですか?」を、青い丸を左右に動かして選ぶ形にしました(一般の方向け/フリーランス/個人事業主/中小企業/大企業)。",
      "・ジャンルに「ライバー・ライブ配信」「パソコン・スマホの買い替え・設定」を足しました。",
      "【定例会のスライド】",
      "・12月2日(水)の予定を「第一回BT-EXフェス」(特別会)にしました。14:30〜16:30(14:00受付)・銀座Blossom・参加費2,200円・定員144名(メンバー70名・ビジター70名)。事前申し込みは、ビジターを連れて来られる方と、ユニットアピールのある各ユニットの代表が優先です。メンバーは準備のため13:00集合・17:00完全撤収です。同じ日の20:00の定例会は消しました。",
      "・予定に「特別会」の種類・受付の時刻・定員を入れられるようにしました(特別会は金の枠と「特別会」の札で出ます)。",
      "・はじめの挨拶のあとに「本日の運営メンバー」のスライドを足しました(ファシリテーター・エデュケーション・スライド・ブレイクアウトルーム)。担当の方は、はじめる前にプレゼンの画面で、プレゼンを使える方から押して選びます(もう一度押すと外れます。複数選べます)。",
      "・すべてのスライドで、題の位置と大きさをそろえました(挙手・入会フォーム・特徴などのスライドも、題は左上のいつもの位置です)。",
      "・出席コードのやり方の動画を押すと、画面いっぱい(全画面)に出るようにしました。もう一度押すと元に戻ります。",
      "・用語説明の説明文と、一般規定・倫理規定の文を、指定の位置で改行しました。",
      "・用語説明のポップアップで、言葉(「ありがとうマイル」など)を必ず1行で出すようにしました(入りきらない画面では文字を少し小さくします)。",
      "・用語説明のポップアップの下の「「進む」で次の言葉へ」の表記をなくしました。",
      "・30秒・1分プレゼンの画面の「こんな話が出たら」を、4つまでではなく、画面の下(メーター)に重ならない範囲で入るだけ出すようにしました。",
      "・商談の前の「休憩しませんか?」で「このまま続ける」を押すと、ウイルスに入られたような警告の画面で覆い、「休む(1分)」のボタンだけになるようにしました(この間は下の操作バーも隠れ、「進む」や Esc でも閉じません)。",
      "・休憩中の残り時間が、はじめ「0:60」と出ていたのを「1:00」にしました。",
      "・「BT-EX5 入会への簡単な3ステップ」を「LINKへの入会 → BT-EX5 入会 → ユニット選択(BT-EX5 を選択)」の順にし、Step1・Step2 の下にまとめて「入会希望の方はご紹介者の方へお聞きください」と出すようにしました。",
      "・終わりの挨拶の「BT-EX5 入会申し込みフォーム」のページをなくしました。",
      "・アンケートのスライドの説明を「本日のBT-EX5の定例会の感想をお聞かせください」にしました。",
      "・用語説明の「ビジター」に「＊BT-EXフェスは何度でも参加可能」を足しました。",
      "・「本日の運営メンバー」の役の名前「本システム・スライド」を「スライド」にしました。",
      "・一般規定⑦の見出しを「ビジターとの1on1は招待者を必ず通す」にし、「必ず」の下に赤い波線を入れました(スライドの編集で、見出しの《 》で囲んだところに波線が付きます)。",
      "・出席規定④(ビジター参加は2回まで)の文の下に「＊BT-EXフェスは何度でも参加可能」を足しました。",
      "・スケジュールの注意書きの下に「＊LINKの公式スケジュールによってはスケジュールの変更あり」を足しました。",
      "・「本日の運営メンバー」に「本システム（スライド含む）山本 捷真」を別の枠で足しました(作った人なので固定。選ぶ必要はありません)。",
      "・代表の紹介のスライドで、文が長いと下が切れていたのを直しました(入りきらないときは全体を少し小さくして、最後の行まで出します)。",
      "・1枚ずつ送るカードのスライド(仕組みとベネフィット・一般規定・出席規定・倫理規定)で、カードの大きさと位置をすべて同じにしました。文の長いカードは、そのカードだけ文字を少し小さくして収めます。",
      "・出席規定の「※ 規定に関しては必要に応じて6ヶ月タームで見直しの合議を設ける」を、カードの下の番号と同じ列に並べました。",
      "・代表の紹介の実績を「4ヶ月で/フォロワー達成」「事業者コミュニティ/の代表」、想い・夢を「お互いを応援し合える/勝たせ合える環境をつくる」と改行しました。",
      "・スライドの文の強調(「3件/月」など、これまで金色の蛍光ペンの線だったところ)を、すべて赤い波線にしました。一般規定⑦の「必ず」の波線も赤にそろえました。",
      "・山本 捷真さんの「こんな話が出たら」の「公式LINEを作りたい」をいちばん最後にしました(プレゼンの画面には、代わりに「ロゴ・チラシ・ポスターを作りたい」が出ます)。",
      "・1分プレゼンの画面のフリガナを、BT-EX5 のメンバーだけにしました(ほかの BT-EX の方・ゲスト・ビジターの方は出しません)。",
      "・1分プレゼンの画面の「活動範囲」の欄をなくし、肩書き(会社・事業の説明)を最後まで出すようにしました(長いときは文字を少し小さくします)。",
      "・休憩をスキップしようとしたときの警告の題を「休憩をスキップ/できません」と改行しました。",
      "・ジャンルを外しました(大藤 誠さん「食品・ギフト」、菅野 節子さん「イベント企画」、栁橋 雅也さん「広告・販促」、大枝 篤志さん「採用・人材」)。",
      "・紹介先早見表の「言葉が浮かばないときは、質問に答えて探す」(紹介診断)と「BT-EX5 全体で仕事が回る業種は「全体分析」へ」を、押せるとひと目で分かるボタンの形にしました。",
      "・予定の定例会のカード(これからの定例会・これまでの定例会)に「編集」「削除」のボタンを付けました(プレゼンを使える運営メンバーに出ます。削除は確かめてから行い、出欠の記録も消えます)。",
      "・定例会を作る・編集する画面の名前を、定例会は「日本海側最大のマーケット 新潟⇔東京」がはじめから入るようにし、特別会は回の数字だけを入れる形(「第 1 回BT-EXフェス」)にしました。",
      "・予定の「＋ 定例会の日程を追加」を、色のついた押しやすいボタンにしました。",
      "・プレゼンの「ほかの BT-EX」のユニットの人数の合計を、BT-EX5 も入れた全ユニットの合計(306名)だけにしました。",
      "・メンバーのカードのチーム名で、名前に「Team」が入っているときは前の「チーム」を付けないようにしました(「チーム Team Bloom∞🌸」→「Team Bloom∞🌸」)。",
      "・エデュケーションコーナーの資料を、上の帯と下のタイマー・操作バーの間に収まる大きさにしました(資料の下のはしまで見えます)。",
      "・操作バーの「終了」を押したときの「進行を終わりますか?」を、「つづける」「終わる」のボタンの上に出すようにしました。",
      "・本日の流れの「はじめの挨拶」のあとに「②用語説明」を入れ、用語説明のスライドを足しました。言葉を押すか「進む」で、1つずつ大きく出ます(「戻る」で1つ前へ。最後の言葉のあとの「進む」で次のスライドへ)。",
      "・「ブレイクアウトルーム商談(テーブル商談) 7分×4」にし、はじめる前に1回の分数と回数を選べるようにしました。商談のあいだに休憩を入れるかを聞き、1分の休憩画面を出します(「進む」でとばせます)。",
      "・ベネフィットと規定のカードを、1枚ずつ大きく出して左右に送る形にしました。3つの強みのスライドは、スケジュールのあとに移しました。",
      "・タイマーを大きな数字の表示にしました(時計の絵はなくしました)。",
      "・挙手のページの前に入会フォームのページ(説明は「BT-EX5 への入会をご希望の方は/こちらのフォームからお申し込みください」の2行)を、挙手のページに「LINK内での実績紹介」を足しました。一般規定に⑦を足しました。",
      "・おわりのページに「入会までの3ステップ」「アンケートのQRコード」「出席コード(やり方の動画つき。押すと大きくなります)」を足しました。",
      "・スライドの文字が左右の操作パネルに重ならないようにし、題の高さをどのスライドでもそろえました。下の進行バーの名前は、ことばの切れ目で改行します。",
      "・規定の注意書き(※)を、明るい色の太字にして読みやすくしました。",
      "・「BT-EX の約束」のカードを2×2で大きく出し、数字の下の線の位置をそろえました(「月1回以上」の線がずれていたのを直しました)。",
      "・一般規定の⑦(ビジターとの1on1)と、倫理規定の「一つひとつの関わりを大切に、」「自分の仕事に誇りを持ち、」「公の場やチャットにおいても」を、指定の位置で改行しました。",
      "・エデュケーションコーナーのスライドに資料(「USPについて」12枚)を出しました。資料は画面の上のはしから下のはしまで大きく出し、上の帯(タイムマネジメント)と下のタイマー(メーターと残り時間)は、資料の上に細く重ねます。資料は「エデュケーションの資料を入れかえる」から、画像かPDFで毎回入れかえられます。",
      "・タイムマネジメントのはじめの場所を「左上の1行の帯」に、戻る・進むの操作バーを「右下」にしました。スライドの中身に重ならず、画面の左右いっぱいを使います(帯の ⌄ でくわしく開けます。これまでどおり、つかんで動かすこともできます)。",
      "・1分プレゼンテーションの1人の時間を、はじめから1分にしました(ゲスト・ほかの BT-EX の方も、はじめは1分)。",
      "【直したところ】",
      "・予定の「カレンダーに追加」を直しました。iPhone・Mac・Outlook 用(.ics)のファイルの時刻の書き方を、どのカレンダーでも読める形にしました。iPhone では押すと「カレンダーに追加」の画面が出ます。LINE などのアプリの中のブラウザでは追加できないため、そのときは「ブラウザで開く」の案内が出ます。",
      "・「アンケートの結果」に、共有サーバーにつながっていない間はほかの方のスマホの回答が届かないことの案内を出すようにしました(共有サーバーの URL を設定すると、全員の回答が集まります)。",
      "・「アンケートの結果」の説明文と「まだ回答がありません」の文を、指定の位置で改行しました。",
      "【新機能】",
      "・記録の「分析」を、ひと目で分かるダッシュボードにしました。数字のカード(前の月とくらべた増減つき)、活動の推移(6か月の折れ線。出した紹介・受けた紹介・1on1・出席・ビジターを切りかえ)、出した紹介の状況(ドーナツ図と成約率)、メンバー TOP5、ありがとうマイルの推移(6か月の棒グラフ)が並びます。点や棒にふれると、その月の数字が出ます。",
      "・全体分析の「今コミュニティ内で回る紹介」の下に「ほかの BT-EX の方とも合いそう」を足しました。BT-EX5 のメンバーの「求める紹介」に、ほかのユニット(BT-EX1・3・4・10・11)の方の仕事が当てはまる組を出します(同じ仕事の方は出しません)。",
      "・定例会アンケート(メンバー用・ビジター用)。結果はアプリの「アンケートの結果」で、数字・グラフ・改善のヒント・CSVで見られます。",
      "・下のメニューの「アップデート」を「運営」にしました(プレゼンを使える運営メンバーだけに出ます)。アップデートはマイページから見られます。",
      "・運営タブ:運営会議の日程を入れると Google Meet を自動で作り、議事録の貼りつけ、Gemini のメモ・文字起こしの取りこみ、あとからの検索ができます。",
      "・プレゼンを使える方が、定例会の日程を追加・編集・削除できるようにしました(「＋ 定例会の日程を追加」「日時・内容を編集」)。",
      "【メンバー】",
      "・柏木さん(金策コンサルの資料)・桜羽さん(プロフィールシート)・中川さん(顔写真・豪華客船アドバイザー)・こばねぇさん(講師の経歴)の情報を充実させました。",
      "・チームを直しました(樺澤さん Team Bloom、吉原さん SunnyUp、むらさきさん Over)。",
      "・お名前のフリガナを入れられるようにしました(早見表・詳細・スライドに出ます)。",
      "・ほかの BT-EX(1・3・4・10・11)の方を、ふりがな(ひらがなでも可)で探せるようにし、お仕事も出すようにしました。プレゼンに足すと、フリガナとお仕事が自動で入ります。",
      "・ほかの BT-EX(BT-EX1〜4・6〜11・13)の方の一覧を、bt-ex.jp のメンバー一覧(2026年10月25日)に合わせて入れ直しました。お名前の下に仕事と系列が出ます。番号のボタンには人数と、合計(281名。BT-EX5 を入れた全ユニットは306名)を出しました。",
      "・メンバーの詳細(詳細・資料を見る)に、ホームページ・Instagram・Facebook・LINE・SASAEAI の札を出しました。押すとそのページが開きます(山本・桜羽さん・菅野さん・むらさきさん・中川さん・こばねぇさん・松田さんのリンクを入れました)。",
      "・自分の詳細には「自分の情報を編集する」「ホームページ・SNS を追加・変更」のボタンを出しました。プロフィールのページで、肩書き・自己紹介・事業内容・ホームページ・SNS をそれぞれ自分で変えられます(肩書きは200文字まで)。",
      "・山本 捷真の肩書き・自己紹介・事業内容を、本人の新しい自己紹介に合わせて充実させました。",
      "・山本 捷真の事業内容と主なお客様を、①システム開発 ②Webサイト制作 ③教育(Weak-Point Sniper:オンライン個別指導)④パソコン・携帯にお困りの方 の順にまとめました(パソコン買い替え相談の資料も追加)。",
      "・栁橋 雅也さんの資料を、フライコアの事業案内と、子ども達に体験を届ける活動の資料に入れかえ、事業内容を詳しくしました。",
      "・プロフィールの事業内容は2000文字まで、「こんな話が出たら」は40個まで入れられるようにしました。",
      "【そのほか】",
      "・全体を軽くしました。小さい顔写真には軽い縮小版を使い、画面の書きかえを減らし、プレゼン画面の読みこみを同時に行うようにしました(内容は変えていません)。",
      "",
      "■ 前回",
      "・プレゼンの話す順番を、必ず「BT-EX5 のメンバー → ほかの BT-EX のメンバー → ゲスト」にしました。",
      "・定例会スライドを、インフォグラフィックで見やすくしました(時間配分の帯・大きな数字・規定を1枚ずつのカードに など)。",
      "・タイムマネジメントを新しい形にしました。",
      "・「ゲスト」「ほかの BT-EX のメンバー」に「編集」ボタンとフリガナを付けました。",
      "・顔写真を追加し、名簿を bt-ex.jp の名簿(26名)に合わせました。",
      "・「欲しい紹介 ランキング」(1位〜5位)を登録できるようにしました。",
    ].join("\n"),
  },
];

// 改善のお知らせ(件名が【更新】【修正】【変更】【アップデート】で始まるもの)は、種類を「アップデート」にする
REF_SEED_ANNOUNCEMENTS.forEach((a) => { if (!a.cat && /^【(更新|修正|変更|アップデート)】/.test(a.title)) a.cat = "アップデート"; });

const PROFILE_ITEMS = [
  { key: "range", label: "活動範囲", ask: "活動範囲(新潟・東京/関東で対面できるか、オンラインで対応できるか)", ok: (m) => m.faceAreas.length > 0 || (m.online && m.online !== "unknown") },
  { key: "wants", label: "求める紹介", ask: "求める紹介(どんな悩みを持つ、どんな人を紹介してほしいか)", ok: (m) => Boolean(m.wants) },
  { key: "business", label: "事業内容", ask: "事業内容(取り扱っている商品・サービス)", ok: (m) => Boolean(m.business) },
  { key: "triggers", label: "こんな話が出たら", ask: "こんな話が出たら自分を思い出してほしい、という言葉(3つ以上。例:「HPを作ったきり」「人が採れない」)", ok: (m) => m.triggers.length >= 3 },
  { key: "customers", label: "主なお客様", ask: "主なお客様(どんな方がお客様になっているか)", ok: (m) => Boolean(m.customers) },
  { key: "links", label: "ホームページ・SNS", ask: "ホームページ・SNS・LINE などのリンク(紹介するときに送る文に自動で入ります)", ok: (m) => (m.links || []).length > 0 },
  { key: "offer", label: "紹介特典", ask: "紹介特典(BT-EX5のメンバーから紹介されたお客様への特典。例:初回相談無料、初回10%オフ)", ok: (m) => Boolean(m.offer) },
];

function missingProfileItems(m) {
  return PROFILE_ITEMS.filter((it) => !it.ok(m));
}

// プロフィールの記入の割合(どの画面でも同じ数え方: PROFILE_ITEMS の7項目 + できること(ジャンル)の8項目)
const PROFILE_SCORE_ITEMS = [...PROFILE_ITEMS, { key: "topics", label: "できること(ジャンル)", ok: (m) => (m.topics || []).length > 0 }];
function profileScore(m) {
  const missing = PROFILE_SCORE_ITEMS.filter((it) => !it.ok(Object.assign({ faceAreas: [], triggers: [], topics: [], links: [] }, m)));
  return { pct: Math.round(((PROFILE_SCORE_ITEMS.length - missing.length) / PROFILE_SCORE_ITEMS.length) * 100), missing };
}
// 「記入済み」= すべての項目(100%)
function isProfileComplete(m) {
  return profileScore(m).pct === 100;
}


// ---------- auth/server-core.js ----------
// ============================================
// auth/server-core.js — サーバー側判定の本体(実行環境に依存しない)
// 仕様: docs/specs/login-page-detailed-spec-v3.md §5, §8
//
// 同じコードを2か所で動かす。
//   ・ブラウザ内のデモ(auth/mock-server.js が localStorage に保存)
//   ・共有サーバー(gas/ の Google Apps Script がスプレッドシートに保存)
// そのため同期処理だけで書き、ブラウザ固有の API(crypto.subtle・btoa など)は
// 使わない。保存先と乱数は createServer({ load, save, randomBytes }) で受け取る。
//
// 認証は2通り。
//   ・会員ごとのアカウント(本番): 運営者が発行した招待コードで本人がパスワードを決め、
//     以後は「お名前 + パスワード」で入る。5回まではまちがえても入れ、6回目のまちがいで15分ロック(本人ごと)。
//   ・共通パスコード(移行期間用): パスコードが正しければ名簿から自分の名前を選ぶ。
//     会員用パスコードは管理者が設定で止められる。管理者用パスコードは非常用に常に使える。
// 管理者は、管理者用パスコードで入ったセッションか、管理者に指定された会員のアカウント。
// 失敗理由は AUTH_FAILED / LOCKED、verifySession の失敗は SESSION_INVALID 単一コード(§5.4 / §5.5)。
//
// 機能の追加: BtexServerCore.registerModule(...) で操作(action)のまとまりを足せる
// (auth/server-community.js が定例会・掲示板などを足す)。createServer より前に登録する。
//
// 紹介先早見表: 名簿の閲覧は会員、追加・編集・削除は管理者のみ。
// 会員は自分のプロフィール(名前・所属チーム以外)だけを編集できる。
// 紹介の記録は会員が自分の名義でのみ追加・取り消しでき、紹介を受けた本人だけが
// 対応状況(未対応・連絡済み・成約・見送り)を更新できる。
// ============================================

var BtexServerCore = (function () {
  "use strict";

  // 設定値(§8)。この4値は仕様で固定
  var LOGIN_FAILURE_LIMIT = 5; // この回数まではまちがえてもロックしない(これをこえたらロック)
  var LOCK_DURATION_MINUTES = 15;
  var SESSION_TTL_HOURS = 12;
  var SESSION_REMEMBER_DAYS = 30;

  // パスコードは平文を置かず、ソルト付き SHA-256 のハッシュだけを持つ。
  // 照合前に小文字化し、ハイフンと空白を取り除く
  var PASSCODES = {
    member: { salt: "0fdad7ca2a02b6424d2fda1d85d36c3a", hash: "c2bd4fe026b60aed343fe5d9547119167f92dcec1a5fb8a7df44f41c65f79595" },
    admin: { salt: "208b4fd8211062d5ced31e63c9e4626e", hash: "9e47ede3415ac83b0fc215d0780ecabd8cb9a7da124aa19c5facd44d23c9438a" },
  };

  // サーバー由来エラー文言(§9: Response.gs ERRORS 相当)
  var ERRORS = {
    AUTH_FAILED: "パスコードが正しくありません。",
    LOCKED: "ログインを一時的に制限しています。時間をおいて再度お試しください。",
    SESSION_INVALID: "セッションが無効です。もう一度ログインしてください。",
    INVALID_REQUEST: "リクエストの形式が正しくありません。",
    INVALID_ACTION: "不明な操作が指定されました。",
    FORBIDDEN_ADMIN: "この操作は管理者のみ行えます。",
    SELF_REFERRAL: "ご自身への紹介は記録できません。",
    ACCOUNT_FAILED: "お名前またはパスワードが正しくありません。",
    INVITE_INVALID: "招待コードが正しくないか、期限が切れています。運営者に新しいコードをお願いしてください。",
    PASSWORD_WEAK: "パスワードは8文字以上で、お名前とは違うものにしてください。",
    PASSCODE_DISABLED: "共通パスコードでのログインは終了しました。お名前とパスワードでログインしてください。",
    NOT_FOUND: "対象が見つかりませんでした。画面を読み込み直してください。",
    CHECKIN_FAILED: "出席コードが正しくないか、受付時間外です。",
    SERVER_ERROR: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
  };

  // 紹介の対応状況(紹介を受けた本人が更新する)
  // new 未対応 / contacted 連絡済み / meeting 商談中 / won 成約 / lost 見送り
  var REFERRAL_STATUSES = ["new", "contacted", "meeting", "won", "lost"];

  // 会員アカウント
  var INVITE_DAYS = 14;
  var PASSWORD_ITERATIONS = 1500;
  var INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 見まちがえやすい I・O・0・1 は使わない

  // 本人が編集できる項目(名前・所属チーム・ID は管理者のみ)
  var SELF_EDITABLE = [
    "kana", "company", "base", "category", "business", "customers", "offer", "selfIntro", "note", "wants", "wantsRank", "triggers",
    "face", "faceAreas", "online", "topics", "targets", "prospects", "links",
    "strengths", "pitch", "ng", "goals", "personal",
  ];

  // 追加の機能(registerModule で登録)
  var MODULES = [];
  function registerModule(mod) { MODULES.push(mod); }

  // お名前の照合用: 全角・半角、空白、大文字小文字の違いをそろえる
  function normalizeName(v) {
    var s = String(v || "");
    if (s.normalize) s = s.normalize("NFKC");
    return s.replace(/[\s\u3000・]/g, "").toLowerCase();
  }

  // ---------- SHA-256(UTF-8 文字列 → 16進) ----------
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  function utf8Bytes(text) {
    var s = unescape(encodeURIComponent(String(text)));
    var out = new Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function sha256Hex(text) {
    var bytes = utf8Bytes(text);
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    bytes.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    for (var off = 0; off < bytes.length; off += 64) {
      for (var t = 0; t < 16; t++) {
        var j = off + t * 4;
        w[t] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) | 0;
      }
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (k + S1 + ch + K[t] + w[t]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + k) | 0;
    }
    return h.map(function (v) { return ("00000000" + (v >>> 0).toString(16)).slice(-8); }).join("");
  }

  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function base64url(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
      if (i + 1 < bytes.length) out += B64[(n >>> 6) & 63];
      if (i + 2 < bytes.length) out += B64[n & 63];
    }
    return out;
  }

  function hashPassword(salt, password, iterations) {
    var h = String(password);
    for (var i = 0; i < iterations; i++) h = sha256Hex(salt + ":" + h);
    return h;
  }

  // データ定義(referral/data.js)は読み込まれていない環境もあるため typeof で参照する
  function dataList(name) {
    var lists = {
      TOPICS: typeof TOPICS === "undefined" ? null : TOPICS,
      INDUSTRIES: typeof INDUSTRIES === "undefined" ? null : INDUSTRIES,
      PROSPECTS: typeof PROSPECTS === "undefined" ? null : PROSPECTS,
      REF_CATEGORIES: typeof REF_CATEGORIES === "undefined" ? null : REF_CATEGORIES,
      REF_BASES: typeof REF_BASES === "undefined" ? null : REF_BASES,
      REF_SEED_MEMBERS: typeof REF_SEED_MEMBERS === "undefined" ? null : REF_SEED_MEMBERS,
      REF_SEED_REVISIONS: typeof REF_SEED_REVISIONS === "undefined" ? null : REF_SEED_REVISIONS,
      LINK_TYPES: typeof LINK_TYPES === "undefined" ? null : LINK_TYPES,
      REF_LEGACY_CATEGORIES: typeof REF_LEGACY_CATEGORIES === "undefined" ? null : REF_LEGACY_CATEGORIES,
      REF_CATEGORY_TOPICS: typeof REF_CATEGORY_TOPICS === "undefined" ? null : REF_CATEGORY_TOPICS,
    };
    return lists[name];
  }
  function idsOf(name) {
    var list = dataList(name);
    return list ? list.map(function (x) { return x.id; }) : null;
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function createServer(env) {
    var LINKS_MAX = 12; // 1人あたりの資料・リンクの上限
    var nowMs = env.now || function () { return Date.now(); };

    function randomHex(n) {
      return env.randomBytes(n).map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    }
    function randomToken() { return base64url(env.randomBytes(32)); } // base64url 43文字(§5.3)

    function saveDb(db) { env.save(db); }

    function ensureDb() {
      var db = env.load();
      var migrated = false;
      if (!db || !db.users) {
        db = { users: [], sessions: {}, referralLogs: [], passcodeGuard: { failures: 0, lockedUntil: 0 } };
        migrated = true;
      }
      // 旧バージョンからの移行: マッチング機能のデータ、メールアドレスで作った
      // アカウントとそのセッションを削除する(パスコード方式に一本化)
      ["likes", "messages", "botsSeeded", "dummy"].forEach(function (k) {
        if (k in db) { delete db[k]; migrated = true; }
      });
      if (!db.sessions) { db.sessions = {}; migrated = true; }
      if (db.users.some(function (u) { return !u.memberId; })) {
        db.users = db.users.filter(function (u) { return u.memberId; });
        migrated = true;
      }
      // 期限切れ・ログアウト済み・持ち主のいないセッションを片付ける(保存量を抑える)
      Object.keys(db.sessions).forEach(function (t) {
        var s = db.sessions[t];
        var owner = db.users.some(function (u) { return u.userId === s.userId; });
        if (!owner || s.revoked || s.expiresAt <= nowMs()) { delete db.sessions[t]; migrated = true; }
      });
      if (!db.referralLogs) { db.referralLogs = []; migrated = true; }
      if (!db.passcodeGuard) { db.passcodeGuard = { failures: 0, lockedUntil: 0 }; migrated = true; }
      if (!db.inviteGuard) { db.inviteGuard = { failures: 0, lockedUntil: 0 }; migrated = true; }
      if (!db.settings) { db.settings = { memberPasscode: true, admins: [] }; migrated = true; }
      if (!Array.isArray(db.settings.admins)) { db.settings.admins = []; migrated = true; }
      db.referralLogs.forEach(function (l) {
        if (REFERRAL_STATUSES.indexOf(l.status) === -1) { l.status = "new"; migrated = true; }
      });

      // 紹介先早見表の名簿(名簿が未作成のときだけ初期名簿を投入)
      var seed = dataList("REF_SEED_MEMBERS");
      if (!db.referralMembers && seed) {
        db.referralMembers = clone(seed);
        db.seedRevisions = seedRevisionIds();
        migrated = true;
      }
      if (applySeedRevisions(db)) migrated = true;
      if (remapLegacyCategories(db)) migrated = true;
      // 2026/10/12: それまでのログインのまちがいとロックを、全員分いちど消す(1回だけ)
      if (!db.settings.loginFailReset20261012) {
        db.settings.loginFailReset20261012 = true;
        db.passcodeGuard = { failures: 0, lockedUntil: 0 };
        (db.users || []).forEach(function (u) { u.failures = 0; u.lockedUntil = 0; });
        migrated = true;
      }
      MODULE_INSTANCES.forEach(function (m) { if (m.migrate && m.migrate(db)) migrated = true; });

      if (migrated) saveDb(db);
      return db;
    }

    function seedRevisionIds() {
      var revs = dataList("REF_SEED_REVISIONS");
      return revs ? revs.map(function (r) { return r.rev; }) : [];
    }

    function isBlankField(key, value) {
      if (Array.isArray(value)) return value.length === 0;
      if (key === "base") return !value || value === "未設定";
      if (key === "online") return !value || value === "unknown";
      if (key === "category") return !value || (typeof UNCATEGORIZED !== "undefined" && value === UNCATEGORIZED);
      return !value;
    }

    // 初期名簿の更新(REF_SEED_REVISIONS)を既存の名簿に一度だけ反映する。
    // 管理者ページ・本人が編集していないメンバーは初期名簿の内容に置き換え、
    // 編集済みのメンバーは空欄だけを埋める(force: true の更新は編集済みでも置き換える)。
    // fields があればその項目だけを見る。addTopics は、置き換えなかった(編集済みの)メンバーに
    // 初期名簿のその話題だけを足す。removeTopics({id: [話題]})はその人から外す。削除済みのメンバーは戻さない
    function applySeedRevisions(db) {
      var revs = dataList("REF_SEED_REVISIONS");
      var seedMembers = dataList("REF_SEED_MEMBERS");
      if (!db.referralMembers || !revs || !seedMembers) return false;
      if (!Array.isArray(db.seedRevisions)) db.seedRevisions = [];
      var changed = false;
      revs.forEach(function (r) {
        if (db.seedRevisions.indexOf(r.rev) !== -1) return;
        (r.remove || []).forEach(function (id) { removeMember(db, id); });
        // add: 初期名簿に新しく入った人を、既にある名簿にも足す(まだいないときだけ)
        (r.add || []).forEach(function (id) {
          var sm = seedMembers.filter(function (m) { return m.id === id; })[0];
          if (sm && findIndex(db.referralMembers, function (m) { return m.id === id; }) < 0) db.referralMembers.push(clone(sm));
        });
        r.ids.forEach(function (id) {
          var seedMember = seedMembers.filter(function (m) { return m.id === id; })[0];
          var index = findIndex(db.referralMembers, function (m) { return m.id === id; });
          if (!seedMember || index < 0) return;
          var current = db.referralMembers[index];
          var next = Object.assign({}, current);
          Object.keys(seedMember).forEach(function (k) {
            if (k === "id") return;
            if (r.fields && r.fields.indexOf(k) === -1) return;
            if (r.force || !current.editedAt || isBlankField(k, current[k])) next[k] = clone(seedMember[k]);
          });
          // addLinks: ["line"] など。編集済みのメンバーにも、初期名簿のその種類のリンクのうち
          // まだないもの(同じ URL がないもの)だけを足す(本人が消したほかのリンクは戻さない)。linksFirst なら先頭に足す
          if (Array.isArray(r.addLinks)) {
            var have = (next.links || []).map(function (l) { return l.url; });
            var add = clone((seedMember.links || []).filter(function (l) { return r.addLinks.indexOf(l.type) !== -1 && have.indexOf(l.url) === -1; }));
            next.links = (r.linksFirst ? add.concat(next.links || []) : (next.links || []).concat(add)).slice(0, LINKS_MAX);
          }
          // addTriggers: 編集済みのメンバーにも、「こんな話が出たら」の言葉をないものだけ足す(ほかの言葉はそのまま)
          if (Array.isArray(r.addTriggers)) {
            next.triggers = (Array.isArray(next.triggers) ? next.triggers : []).slice();
            r.addTriggers.forEach(function (t) { if (next.triggers.indexOf(t) === -1) next.triggers.push(t); });
          }
          if (r.addTopics && Array.isArray(next.topics)) {
            next.topics = next.topics.concat((seedMember.topics || []).filter(function (t) {
              return r.addTopics.indexOf(t) !== -1 && next.topics.indexOf(t) === -1;
            }));
          }
          var removeTopics = r.removeTopics && r.removeTopics[id];
          if (removeTopics && Array.isArray(next.topics)) {
            next.topics = next.topics.filter(function (t) { return removeTopics.indexOf(t) === -1; });
          }
          db.referralMembers[index] = next;
        });
        db.seedRevisions.push(r.rev);
        changed = true;
      });
      return changed;
    }

    // 使わなくなった業種名(REF_LEGACY_CATEGORIES)のメンバーを新しい業種に置き換える。
    // 初期名簿にいる人は初期名簿の業種、いない人は扱う話題から決め、決まらなければ未分類
    function remapLegacyCategories(db) {
      var legacy = dataList("REF_LEGACY_CATEGORIES");
      var categories = dataList("REF_CATEGORIES");
      if (!legacy || !categories || !db.referralMembers) return false;
      var seedMembers = dataList("REF_SEED_MEMBERS") || [];
      var catTopics = dataList("REF_CATEGORY_TOPICS") || {};
      var changed = false;
      db.referralMembers.forEach(function (m) {
        if (legacy.indexOf(m.category) === -1) return;
        var seedMember = seedMembers.filter(function (x) { return x.id === m.id; })[0];
        var next = seedMember && categories.indexOf(seedMember.category) !== -1 ? seedMember.category : null;
        if (!next) {
          next = Object.keys(catTopics).filter(function (c) {
            return categories.indexOf(c) !== -1 && (m.topics || []).some(function (t) { return catTopics[c].indexOf(t) !== -1; });
          })[0] || categories[categories.length - 1];
        }
        m.category = next;
        changed = true;
      });
      return changed;
    }

    // メンバーを名簿から消し、そのメンバーとして作られたログイン情報・セッション・
    // 紹介の記録もあわせて消す
    // 名簿から外した人は、ログインできないようにする(アカウント・ログイン中の端末・通知の登録を消す)。
    // 紹介・マイル・1on1 などの記録は残す(名前は「退会したメンバー」と出る)
    function revokeMemberAccess(db, id) {
      var userIds = db.users.filter(function (u) { return u.memberId === id; }).map(function (u) { return u.userId; });
      db.users = db.users.filter(function (u) { return u.memberId !== id; });
      Object.keys(db.sessions).forEach(function (t) {
        if (userIds.indexOf(db.sessions[t].userId) !== -1) delete db.sessions[t];
      });
      if (Array.isArray(db.pushSubs)) db.pushSubs = db.pushSubs.filter(function (s) { return s.memberId !== id; });
      // やることの担当から外す(担当がいなくなったものは消す)
      if (Array.isArray(db.tasks)) {
        db.tasks.forEach(function (t) { t.assignees = (t.assignees || []).filter(function (x) { return x !== id; }); });
        db.tasks = db.tasks.filter(function (t) { return t.assignees.length; });
      }
    }

    function removeMember(db, id) {
      var userIds = db.users.filter(function (u) { return u.memberId === id; }).map(function (u) { return u.userId; });
      db.referralMembers = db.referralMembers.filter(function (m) { return m.id !== id; });
      db.users = db.users.filter(function (u) { return u.memberId !== id; });
      Object.keys(db.sessions).forEach(function (t) {
        if (userIds.indexOf(db.sessions[t].userId) !== -1) delete db.sessions[t];
      });
      db.referralLogs = db.referralLogs.filter(function (l) {
        return l.toMemberId !== id && userIds.indexOf(l.fromUserId) === -1;
      });
      if (Array.isArray(db.pushSubs)) db.pushSubs = db.pushSubs.filter(function (s) { return s.memberId !== id; });
    }

    function findIndex(list, fn) {
      for (var i = 0; i < list.length; i++) if (fn(list[i])) return i;
      return -1;
    }
    function find(list, fn) {
      var i = findIndex(list, fn);
      return i < 0 ? null : list[i];
    }

    // 管理者かどうか: 管理者用パスコードで入ったセッション、または管理者に指定された会員が「自分のパスワード」で入ったセッション
    // (会員用の共通パスコードで入ったセッションは、管理者に指定された人の名前でも管理者にしない)
    function sessionIsAdmin(db, session, user) {
      if (session.isAdmin === true) return true;
      if (session.via === "passcode") return false;
      return !!(db.settings && db.settings.admins.indexOf(user.memberId) !== -1);
    }

    function toPublicUser(u, session, db) {
      // §5.3 の7フィールド
      var admin = db ? sessionIsAdmin(db, session, u) : session.isAdmin === true;
      return {
        userId: u.userId,
        email: "",
        role: admin ? "admin" : "member",
        accountStatus: "active",
        subscriptionStatus: "active",
        paymentExempt: false,
        isAdmin: admin,
      };
    }

    function ok(data) { return { success: true, data: data }; }
    function fail(code, message) {
      return {
        success: false,
        error: { code: code || "UNKNOWN", message: message || ERRORS[code] || ERRORS.SERVER_ERROR },
      };
    }

    // セッションは、トークンそのものではなくハッシュで保存する(保存データを見られてもなりすませない)。
    // 前の版で保存した(トークンそのままの)セッションも、期限まではそのまま使える
    function tokenKey(token) { return "h:" + sha256Hex("btex5-session:" + String(token || "")); }
    function sessionKeyOf(db, token) {
      var t = String(token || "");
      if (!t) return "";
      var k = tokenKey(t);
      if (db.sessions[k]) return k;
      return db.sessions[t] ? t : "";
    }

    // セッショントークンから { session, user } を解決(無効なら null)
    function authSession(db, token) {
      var session = db.sessions[sessionKeyOf(db, token)];
      if (!session || session.revoked || session.expiresAt <= nowMs()) return null;
      var user = find(db.users, function (u) { return u.userId === session.userId; });
      if (!user) return null;
      // 名簿から削除されたメンバーのセッションは無効
      if (db.referralMembers && !db.referralMembers.some(function (m) { return m.id === user.memberId; })) return null;
      return { session: session, user: user, isAdmin: sessionIsAdmin(db, session, user) };
    }

    function authUser(db, token) {
      var a = authSession(db, token);
      return a ? a.user : null;
    }

    // 入力されたパスコードの種類を返す("admin" / "member" / null)。
    // どちらの照合も必ず行い、どちらに一致したかで処理時間が変わらないようにする
    // 共有サーバー(GAS)では、パスコードのハッシュを Script Properties から渡せる(env.passcodes)。
    // そうすると、ページから配っているこのファイルのハッシュは使われない
    function matchPasscode(code) {
      var PC = (env.passcodes && env.passcodes.member && env.passcodes.admin) ? env.passcodes : PASSCODES;
      var normalized = String(code || "").trim().toLowerCase().replace(/[\s-]/g, "");
      var adminHash = sha256Hex(PC.admin.salt + ":" + normalized);
      var memberHash = sha256Hex(PC.member.salt + ":" + normalized);
      if (!normalized) return null;
      if (adminHash === PC.admin.hash) return "admin";
      if (memberHash === PC.member.hash) return "member";
      return null;
    }

    // ---------- passcodeLogin ----------
    // 1回目: { passcode } → 正しければ名簿の名前一覧を返す
    // 2回目: { passcode, memberId, remember } → セッションを発行する
    function passcodeLogin(body) {
      var db = ensureDb();
      var guard = db.passcodeGuard;

      // ロック中は照合しない(§8 判定順序3)
      if (guard.lockedUntil > nowMs()) return fail("LOCKED");

      var role = matchPasscode(body.passcode);
      if (!role) {
        guard.failures += 1;
        if (guard.failures > LOGIN_FAILURE_LIMIT) {
          guard.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000;
          guard.failures = 0;
          saveDb(db);
          return fail("LOCKED");
        }
        saveDb(db);
        return fail("AUTH_FAILED");
      }
      guard.failures = 0;
      guard.lockedUntil = 0;
      if (role === "member" && db.settings.memberPasscode === false) {
        saveDb(db);
        return fail("PASSCODE_DISABLED");
      }

      var roster = db.referralMembers || [];
      var memberId = String(body.memberId || "").trim();
      if (!memberId) {
        saveDb(db);
        return ok({ step: "chooseMember", members: roster.map(function (m) { return { id: m.id, name: m.name }; }) });
      }
      var member = find(roster, function (m) { return m.id === memberId; });
      if (!member) return fail("INVALID_REQUEST");

      var user = find(db.users, function (u) { return u.memberId === member.id; });
      // 自分のパスワードを決めた人・管理者に指定された人には、会員用の共通パスコードでは入れない(なりすまし防止)
      if (role === "member" && ((user && user.pw) || db.settings.admins.indexOf(member.id) !== -1)) {
        saveDb(db);
        return fail("ACCOUNT_FAILED", "この方は、ご自分のパスワードでログインしてください(共通パスコードでは入れません)。");
      }
      if (!user) {
        user = { userId: "usr_" + randomHex(16), memberId: member.id, name: member.name, createdAt: nowMs() };
        db.users.push(user);
      }
      user.name = member.name;

      // Session fixation 対策(§7): 成功のたびに必ず新規トークンを発行
      // remember は === true の厳密判定(§5.2)。
      // Boolean()正規化は不可。Boolean("false")===true となり
      // 30日セッションが誤発行される(docs/specs §14)
      var remember = body.remember === true;
      var ttlMs = remember
        ? SESSION_REMEMBER_DAYS * 24 * 60 * 60 * 1000
        : SESSION_TTL_HOURS * 60 * 60 * 1000;

      return issueSession(db, user, { isAdmin: role === "admin", remember: remember, userAgent: body.userAgent, via: "passcode" });
    }

    // セッションを発行して保存する(ログイン成功時の共通処理)
    function issueSession(db, user, opt) {
      var ttlMs = opt.remember
        ? SESSION_REMEMBER_DAYS * 24 * 60 * 60 * 1000
        : SESSION_TTL_HOURS * 60 * 60 * 1000;
      var token = randomToken();
      var session = {
        userId: user.userId,
        isAdmin: opt.isAdmin === true,
        via: opt.via,
        issuedAt: nowMs(),
        expiresAt: nowMs() + ttlMs,
        remember: opt.remember,
        revoked: false,
        userAgent: String(opt.userAgent || "").slice(0, 300),
      };
      db.sessions[tokenKey(token)] = session;
      user.lastLoginAt = nowMs();
      saveDb(db);
      return ok({
        sessionToken: token,
        expiresAt: new Date(session.expiresAt).toISOString(),
        remember: opt.remember,
        user: toPublicUser(user, session, db),
        displayName: user.name,
        memberId: user.memberId,
      });
    }

    // ============================================
    // 会員ごとのアカウント
    // ============================================

    function userForMember(db, member) {
      var user = find(db.users, function (u) { return u.memberId === member.id; });
      if (!user) {
        user = { userId: "usr_" + randomHex(16), memberId: member.id, name: member.name, createdAt: nowMs() };
        db.users.push(user);
      }
      user.name = member.name;
      return user;
    }

    function inviteHash(code) {
      return sha256Hex("invite:" + String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));
    }

    function findInvite(db, code) {
      var h = inviteHash(code);
      return find(db.users, function (u) { return u.invite && u.invite.hash === h && u.invite.expiresAt > nowMs(); });
    }

    // 招待コードの総当たりを防ぐ(全体で20回まちがえると15分止める)
    function inviteGuardFail(db) {
      var g = db.inviteGuard;
      g.failures += 1;
      if (g.failures >= 20) { g.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000; g.failures = 0; }
      saveDb(db);
      return fail(g.lockedUntil > nowMs() ? "LOCKED" : "INVITE_INVALID");
    }

    // ログイン画面の表示に使う(共通パスコードを受け付けているか)
    function loginOptions() {
      var db = ensureDb();
      return ok({ memberPasscode: db.settings.memberPasscode !== false });
    }

    // 招待コードの確認 → 本人の名前を返す
    function inviteInfo(body) {
      var db = ensureDb();
      if (db.inviteGuard.lockedUntil > nowMs()) return fail("LOCKED");
      var user = findInvite(db, body.code);
      if (!user) return inviteGuardFail(db);
      return ok({ name: user.name, hasPassword: !!user.pw });
    }

    function passwordOk(password, name) {
      var p = String(password || "");
      return p.length >= 8 && p.length <= 128 && normalizeName(p) !== normalizeName(name);
    }

    function setPassword(user, password) {
      var salt = randomHex(16);
      user.pw = { salt: salt, iter: PASSWORD_ITERATIONS, hash: hashPassword(salt, password, PASSWORD_ITERATIONS) };
      user.failures = 0;
      user.lockedUntil = 0;
    }

    // 招待コードで本人がパスワードを決める(再発行されたコードならパスワードの再設定)
    function activateAccount(body) {
      var db = ensureDb();
      if (db.inviteGuard.lockedUntil > nowMs()) return fail("LOCKED");
      var user = findInvite(db, body.code);
      if (!user) return inviteGuardFail(db);
      if (!passwordOk(body.password, user.name)) return fail("PASSWORD_WEAK");
      setPassword(user, body.password);
      delete user.invite;
      user.activatedAt = nowMs();
      // パスワードを決め直したら、ほかの端末のログインは切る
      Object.keys(db.sessions).forEach(function (t) { if (db.sessions[t].userId === user.userId) delete db.sessions[t]; });
      return issueSession(db, user, { remember: body.remember === true, userAgent: body.userAgent, via: "account" });
    }

    // ログイン画面の「お名前」の選択肢(名簿の名前だけ。名簿は早見表と同じもの)
    function loginMembers() {
      var db = ensureDb();
      return ok({
        members: (db.referralMembers || []).map(function (m) { return { id: m.id, name: m.name }; }),
        memberPasscode: db.settings.memberPasscode !== false,
      });
    }

    // お名前(名簿から選ぶ。memberId)+ パスワード。
    // まだパスワードを決めていない人は、移行期間のあいだ共通パスコードでも入れる
    function accountLogin(body) {
      var db = ensureDb();
      var password = String(body.password || "");
      var memberId = cleanStr(body.memberId, 40);
      // 入力されたお名前(空白・全角半角のちがいは見ない)が名簿の1人に決まれば、その人としてログインする
      if (!memberId && body.name) {
        var nk = normalizeName(cleanStr(body.name, 60));
        var hits = (db.referralMembers || []).filter(function (m) { return nk && normalizeName(m.name) === nk; });
        if (hits.length === 1) memberId = hits[0].id;
      }
      if (memberId) {
        var mem = find(db.referralMembers || [], function (m) { return m.id === memberId; });
        if (!mem || !password) return fail("ACCOUNT_FAILED");
        var u0 = find(db.users, function (u) { return u.memberId === mem.id; });
        if (!u0 || !u0.pw) {
          // 失敗の回数はその人ごとに数える(だれかが間違えても、ほかの人は入れる)
          var g0 = userForMember(db, mem);
          if ((g0.lockedUntil || 0) > nowMs()) return fail("LOCKED");
          var role = db.settings.memberPasscode !== false ? matchPasscode(password) : null;
          if (role === "member" && db.settings.admins.indexOf(mem.id) !== -1) role = null; // 管理者に指定された人は自分のパスワードで
          if (role !== "member" && role !== "admin") {
            g0.failures = (g0.failures || 0) + 1;
            if (g0.failures > LOGIN_FAILURE_LIMIT) {
              g0.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000;
              g0.failures = 0;
              saveDb(db);
              return fail("LOCKED");
            }
            saveDb(db);
            return fail("ACCOUNT_FAILED", db.settings.memberPasscode !== false
              ? "パスワード(まだ決めていない方は共通パスコード)が正しくありません。"
              : "まだパスワードが決まっていません。運営者から届く招待コードで、パスワードを決めてください。");
          }
          g0.failures = 0;
          var user0 = g0;
          // ここは会員としてのログイン(管理者用パスコードでも、管理者にはしない)
          return issueSession(db, user0, { remember: body.remember === true, userAgent: body.userAgent, via: "passcode" });
        }
        body.name = mem.name;
        body._only = mem.id;
      }
      var key = normalizeName(body.name);
      if (!key || !password) return fail("ACCOUNT_FAILED");
      var candidates = (db.referralMembers || [])
        .filter(function (m) { return normalizeName(m.name) === key && (!body._only || m.id === body._only); })
        .map(function (m) { return find(db.users, function (u) { return u.memberId === m.id && u.pw; }); })
        .filter(Boolean);
      if (!candidates.length) return fail("ACCOUNT_FAILED");
      if (candidates.every(function (u) { return (u.lockedUntil || 0) > nowMs(); })) return fail("LOCKED");
      var user = null;
      candidates.forEach(function (u) {
        if (user || (u.lockedUntil || 0) > nowMs()) return;
        if (hashPassword(u.pw.salt, password, u.pw.iter) === u.pw.hash) user = u;
      });
      if (!user) {
        var locked = false;
        candidates.forEach(function (u) {
          u.failures = (u.failures || 0) + 1;
          if (u.failures > LOGIN_FAILURE_LIMIT) { u.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000; u.failures = 0; locked = true; }
        });
        saveDb(db);
        return fail(locked ? "LOCKED" : "ACCOUNT_FAILED");
      }
      user.failures = 0;
      user.lockedUntil = 0;
      return issueSession(db, user, { remember: body.remember === true, userAgent: body.userAgent, via: "account" });
    }

    function changePassword(body) {
      var db = ensureDb();
      var a = authSession(db, body.sessionToken);
      if (!a) return fail("SESSION_INVALID");
      var user = a.user;
      if (user.pw && hashPassword(user.pw.salt, String(body.current || ""), user.pw.iter) !== user.pw.hash) {
        return fail("ACCOUNT_FAILED", "いまのパスワードが正しくありません。");
      }
      if (!passwordOk(body.password, user.name)) return fail("PASSWORD_WEAK");
      setPassword(user, body.password);
      user.activatedAt = user.activatedAt || nowMs();
      // このセッション以外のログインは切る
      Object.keys(db.sessions).forEach(function (t) {
        if (db.sessions[t].userId === user.userId && t !== sessionKeyOf(db, body.sessionToken)) delete db.sessions[t];
      });
      saveDb(db);
      return ok({});
    }

    // 招待コードを発行する(コードはこのときだけ返す。保存するのはハッシュだけ)
    function adminIssueInvite(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var ids = Array.isArray(body.memberIds) ? body.memberIds : [body.memberId];
      var out = [];
      ids.slice(0, 500).forEach(function (raw) {
        var id = cleanStr(raw, 40);
        var member = find(db.referralMembers || [], function (m) { return m.id === id; });
        if (!member) return;
        var user = userForMember(db, member);
        var code = env.randomBytes(10).map(function (b) { return INVITE_ALPHABET[b % INVITE_ALPHABET.length]; }).join("");
        code = code.slice(0, 5) + "-" + code.slice(5);
        user.invite = { hash: inviteHash(code), expiresAt: nowMs() + INVITE_DAYS * 24 * 60 * 60 * 1000, issuedAt: nowMs() };
        out.push({ memberId: member.id, name: member.name, code: code, expiresAt: user.invite.expiresAt, reset: !!user.pw });
      });
      if (!out.length) return fail("NOT_FOUND");
      saveDb(db);
      return ok({ invites: out });
    }

    function adminListAccounts(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var accounts = (db.referralMembers || []).map(function (m) {
        var u = find(db.users, function (x) { return x.memberId === m.id; });
        var status = u && u.pw ? "active" : u && u.invite && u.invite.expiresAt > nowMs() ? "invited" : u && u.invite ? "expired" : "none";
        return {
          memberId: m.id,
          name: m.name,
          team: m.team,
          status: status,
          inviteExpiresAt: u && u.invite ? u.invite.expiresAt : 0,
          activatedAt: (u && u.activatedAt) || 0,
          lastLoginAt: (u && u.lastLoginAt) || 0,
          locked: !!(u && u.lockedUntil > nowMs()),
          admin: db.settings.admins.indexOf(m.id) !== -1,
        };
      });
      return ok({ accounts: accounts, settings: { memberPasscode: db.settings.memberPasscode !== false } });
    }

    function adminSetSettings(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      if (typeof body.memberPasscode === "boolean") db.settings.memberPasscode = body.memberPasscode;
      saveDb(db);
      return ok({ settings: { memberPasscode: db.settings.memberPasscode !== false } });
    }

    function adminSetAdmin(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var id = cleanStr(body.memberId, 40);
      if (!find(db.referralMembers || [], function (m) { return m.id === id; })) return fail("NOT_FOUND");
      db.settings.admins = db.settings.admins.filter(function (x) { return x !== id; });
      if (body.admin === true) db.settings.admins.push(id);
      saveDb(db);
      return ok({ admins: db.settings.admins });
    }

    // ロックの解除・ログアウトさせる(端末をなくしたときなど)
    function adminResetAccount(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var id = cleanStr(body.memberId, 40);
      var user = find(db.users, function (u) { return u.memberId === id; });
      if (!user) return fail("NOT_FOUND");
      user.failures = 0;
      user.lockedUntil = 0;
      if (body.signOut === true) {
        Object.keys(db.sessions).forEach(function (t) { if (db.sessions[t].userId === user.userId) delete db.sessions[t]; });
      }
      saveDb(db);
      return ok({});
    }

    // ---------- verifySession(失敗は常に SESSION_INVALID §5.5) ----------
    function verifySession(body) {
      var db = ensureDb();
      var a = authSession(db, body.sessionToken);
      if (!a) return fail("SESSION_INVALID");

      // 期限判定はサーバー時刻のみ・検証時の延長は行わない(§8)
      return ok({
        expiresAt: new Date(a.session.expiresAt).toISOString(),
        remember: a.session.remember,
        user: toPublicUser(a.user, a.session, db),
        displayName: a.user.name,
        memberId: a.user.memberId,
        hasPassword: !!a.user.pw,
      });
    }

    // ---------- logout ----------
    function logout(body) {
      var db = ensureDb();
      var token = sessionKeyOf(db, body.sessionToken);
      if (token && db.sessions[token]) {
        delete db.sessions[token];
        saveDb(db);
      }
      return ok({});
    }

    // ============================================
    // 紹介先早見表の名簿
    // ============================================

    function cleanStr(v, max) {
      return String(v === undefined || v === null ? "" : v).trim().slice(0, max);
    }

    function cleanList(v, allowed, max) {
      if (!Array.isArray(v)) return [];
      var out = [];
      v.forEach(function (x) {
        var t = cleanStr(x, 60);
        if (!t || out.indexOf(t) !== -1) return;
        if (allowed && allowed.indexOf(t) === -1) return;
        out.push(t);
      });
      return out.slice(0, max);
    }

    function sanitizeReferralMember(input, id) {
      var m = input || {};
      var categories = dataList("REF_CATEGORIES");
      var bases = dataList("REF_BASES");
      var category = cleanStr(m.category, 40);
      var base = cleanStr(m.base, 10);
      var online = cleanStr(m.online, 10);
      var industries = idsOf("INDUSTRIES");
      return {
        id: id,
        name: cleanStr(m.name, 40),
        kana: cleanStr(m.kana, 40),
        company: cleanStr(m.company, 200),
        team: cleanStr(m.team, 40),
        base: !bases || bases.indexOf(base) !== -1 ? base || "未設定" : "未設定",
        category: !categories || categories.indexOf(category) !== -1 ? category : categories[categories.length - 1],
        business: cleanStr(m.business, 2000),
        customers: cleanStr(m.customers, 400),
        offer: cleanStr(m.offer, 120),
        selfIntro: cleanStr(String(m.selfIntro || "").replace(/\r\n?/g, "\n"), 3000),
        note: cleanStr(m.note, 300),
        wants: cleanStr(m.wants, 400),
        // 欲しい紹介の順位(1位〜5位。上から順に)
        wantsRank: cleanList(m.wantsRank, null, 5),
        triggers: cleanList(m.triggers, null, 40).map(function (t) { return t.slice(0, 40); }),
        face: cleanStr(m.face, 60),
        faceAreas: cleanList(m.faceAreas, ["niigata", "tokyo"], 2),
        online: ["all", "partial", "none", "unknown"].indexOf(online) !== -1 ? online : "unknown",
        topics: cleanList(m.topics, idsOf("TOPICS"), 20),
        targets: cleanList(m.targets, industries ? industries.concat("any") : null, 10),
        prospects: cleanList(m.prospects, idsOf("PROSPECTS"), 3),
        links: cleanLinks(m.links),
        // 1on1シート(人柄が伝わる項目)
        strengths: cleanStr(m.strengths, 400),
        pitch: cleanStr(m.pitch, 200),
        ng: cleanStr(m.ng, 300),
        goals: cleanStr(m.goals, 300),
        personal: cleanStr(m.personal, 400),
      };
    }

    // 資料・リンク: https:// のURLか、サイト内の materials/ のファイルだけを受け付ける
    function cleanUrl(v) {
      var u = cleanStr(v, 500);
      if (/^https:\/\/[^\s"'<>]+$/i.test(u)) return u;
      if (/^materials\/[\w.-]+$/.test(u) && u.indexOf("..") === -1) return u;
      return "";
    }
    function cleanLinks(v) {
      if (!Array.isArray(v)) return [];
      var types = idsOf("LINK_TYPES");
      var out = [];
      v.forEach(function (x) {
        if (!x || typeof x !== "object" || out.length >= LINKS_MAX) return;
        var type = cleanStr(x.type, 20);
        var url = cleanUrl(x.url);
        if (!url || (types && types.indexOf(type) === -1)) return;
        var link = { type: type, url: url, label: cleanStr(x.label, 60) };
        var cover = cleanUrl(x.cover);
        if (cover) link.cover = cover;
        out.push(link);
      });
      return out;
    }

    function requireAdmin(db, token) {
      var a = authSession(db, token);
      if (!a) return { error: fail("SESSION_INVALID") };
      if (!a.isAdmin) return { error: fail("FORBIDDEN_ADMIN") };
      return { user: a.user };
    }

    function listReferralMembers(body) {
      var db = ensureDb();
      if (!authUser(db, body.sessionToken)) return fail("SESSION_INVALID");
      return ok({ members: db.referralMembers || [] });
    }

    // 本人によるプロフィール編集。名前・所属チームは変えられない
    function updateMyProfile(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var index = findIndex(db.referralMembers || [], function (m) { return m.id === me.memberId; });
      if (index < 0) return fail("INVALID_REQUEST");
      var current = db.referralMembers[index];
      var input = body.profile && typeof body.profile === "object" ? body.profile : {};
      var merged = Object.assign({}, current);
      SELF_EDITABLE.forEach(function (k) { if (k in input) merged[k] = input[k]; });
      var member = sanitizeReferralMember(merged, current.id);
      member.name = current.name;
      member.team = current.team;
      member.editedAt = nowMs();
      member.editedBy = "self";
      db.referralMembers[index] = member;
      saveDb(db);
      return ok({ member: member });
    }

    function adminSaveReferralMember(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      if (!db.referralMembers) db.referralMembers = [];

      var requestedId = cleanStr(body.member && body.member.id, 40);
      var index = findIndex(db.referralMembers, function (x) { return x.id === requestedId; });
      var id = index >= 0 ? requestedId : "m_" + randomHex(5);
      // 送られてこなかった項目(1on1シートなど)は今の値を残す
      var input = index >= 0 ? Object.assign({}, db.referralMembers[index], body.member || {}) : body.member;
      var member = sanitizeReferralMember(input, id);
      if (!member.name) return fail("INVALID_REQUEST");
      member.editedAt = nowMs();
      member.editedBy = "admin";

      if (index >= 0) db.referralMembers[index] = member;
      else db.referralMembers.push(member);
      saveDb(db);
      return ok({ member: member, created: index < 0 });
    }

    function adminDeleteReferralMember(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      var id = cleanStr(body.id, 40);
      var before = (db.referralMembers || []).length;
      db.referralMembers = (db.referralMembers || []).filter(function (x) { return x.id !== id; });
      if (db.referralMembers.length === before) return fail("INVALID_REQUEST");
      revokeMemberAccess(db, id);
      saveDb(db);
      return ok({});
    }

    function adminImportReferralMembers(body) {
      var db = ensureDb();
      var auth = requireAdmin(db, body.sessionToken);
      if (auth.error) return auth.error;
      if (!Array.isArray(body.members) || body.members.length > 500) return fail("INVALID_REQUEST");
      var seen = {};
      var members = [];
      body.members.forEach(function (raw) {
        var id = cleanStr(raw && raw.id, 40);
        if (!id || seen[id]) id = "m_" + randomHex(5);
        seen[id] = true;
        var m = sanitizeReferralMember(raw, id);
        m.editedAt = nowMs();
        m.editedBy = "admin";
        if (m.name) members.push(m);
      });
      db.referralMembers = members;
      saveDb(db);
      return ok({ count: members.length });
    }

    // ============================================
    // 紹介の記録
    // ============================================

    function displayName(u) {
      return u.name || "会員";
    }

    function recordReferral(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var memberId = cleanStr(body.toMemberId, 40);
      var member = find(db.referralMembers || [], function (m) { return m.id === memberId; });
      if (!member) return fail("INVALID_REQUEST");
      if (member.id === me.memberId) return fail("SELF_REFERRAL");
      var log = {
        id: "r_" + randomHex(6),
        fromUserId: me.userId,
        toMemberId: member.id,
        prospect: cleanStr(body.prospect, 60),
        // 紹介した相手の連絡先: 紹介した人と紹介を受けた人だけが見る
        contact: cleanStr(body.contact, 120),
        memo: cleanStr(body.memo, 300),
        topics: cleanList(body.topics, idsOf("TOPICS"), 10),
        status: "new",
        at: nowMs(),
        statusAt: 0,
      };
      db.referralLogs.push(log);
      saveDb(db);
      return ok({ log: log });
    }

    function deleteReferral(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var id = cleanStr(body.id, 40);
      var log = find(db.referralLogs, function (l) { return l.id === id; });
      if (!log || log.fromUserId !== me.userId) return fail("INVALID_REQUEST");
      db.referralLogs = db.referralLogs.filter(function (l) { return l.id !== id; });
      saveDb(db);
      return ok({});
    }

    // 紹介を受けた本人だけが対応状況を更新できる
    function updateReferralStatus(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var id = cleanStr(body.id, 40);
      var status = cleanStr(body.status, 20);
      if (REFERRAL_STATUSES.indexOf(status) === -1) return fail("INVALID_REQUEST");
      var log = find(db.referralLogs, function (l) { return l.id === id; });
      if (!log || log.toMemberId !== me.memberId) return fail("INVALID_REQUEST");
      log.status = status;
      log.statusAt = nowMs();
      saveDb(db);
      return ok({ id: log.id, status: log.status });
    }

    function getReferralStats(body) {
      var db = ensureDb();
      var me = authUser(db, body.sessionToken);
      if (!me) return fail("SESSION_INVALID");
      var logs = db.referralLogs;
      var monthStart = new Date(nowMs());
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      var received = {};
      var byGiver = {};
      logs.forEach(function (l) {
        received[l.toMemberId] = (received[l.toMemberId] || 0) + 1;
        var g = byGiver[l.fromUserId] || (byGiver[l.fromUserId] = { count: 0, won: 0 });
        g.count += 1;
        if (l.status === "won") g.won += 1;
      });
      var ranking = Object.keys(byGiver)
        .map(function (userId) {
          var u = find(db.users, function (x) { return x.userId === userId; });
          return {
            name: u ? displayName(u) : "退会した会員",
            count: byGiver[userId].count,
            won: byGiver[userId].won,
            isMe: userId === me.userId,
          };
        })
        .sort(function (a, b) { return b.count - a.count || b.won - a.won; })
        .slice(0, 5);
      var memberName = function (id) {
        var m = find(db.referralMembers || [], function (x) { return x.id === id; });
        return m ? m.name : "(削除されたメンバー)";
      };
      var giverName = function (userId) {
        var u = find(db.users, function (x) { return x.userId === userId; });
        return u ? displayName(u) : "退会した会員";
      };
      var mine = logs.filter(function (l) { return l.fromUserId === me.userId; });
      var inbox = logs.filter(function (l) { return l.toMemberId === me.memberId; });

      return ok({
        myCount: mine.length,
        myWonCount: mine.filter(function (l) { return l.status === "won"; }).length,
        totalCount: logs.length,
        wonCount: logs.filter(function (l) { return l.status === "won"; }).length,
        monthCount: logs.filter(function (l) { return l.at >= monthStart.getTime(); }).length,
        received: received,
        ranking: ranking,
        myRecent: mine
          .slice(-10)
          .reverse()
          .map(function (l) {
            return { id: l.id, toName: memberName(l.toMemberId), toMemberId: l.toMemberId, prospect: l.prospect, memo: l.memo || "", status: l.status, at: l.at };
          }),
        inboxNewCount: inbox.filter(function (l) { return l.status === "new"; }).length,
        inbox: inbox
          .slice(-30)
          .reverse()
          .map(function (l) {
            return { id: l.id, fromName: giverName(l.fromUserId), prospect: l.prospect, contact: l.contact || "", memo: l.memo || "", topics: l.topics || [], status: l.status, at: l.at };
          }),
      });
    }

    var ACTIONS = {
      passcodeLogin: passcodeLogin,
      verifySession: verifySession,
      logout: logout,
      listReferralMembers: listReferralMembers,
      updateMyProfile: updateMyProfile,
      adminSaveReferralMember: adminSaveReferralMember,
      adminDeleteReferralMember: adminDeleteReferralMember,
      adminImportReferralMembers: adminImportReferralMembers,
      recordReferral: recordReferral,
      deleteReferral: deleteReferral,
      updateReferralStatus: updateReferralStatus,
      getReferralStats: getReferralStats,
      loginOptions: loginOptions,
      loginMembers: loginMembers,
      inviteInfo: inviteInfo,
      activateAccount: activateAccount,
      accountLogin: accountLogin,
      changePassword: changePassword,
      adminIssueInvite: adminIssueInvite,
      adminListAccounts: adminListAccounts,
      adminSetSettings: adminSetSettings,
      adminSetAdmin: adminSetAdmin,
      adminResetAccount: adminResetAccount,
    };

    // 追加の機能に渡す道具
    var ctx = {
      ensureDb: ensureDb, saveDb: saveDb, ok: ok, fail: fail, nowMs: nowMs,
      randomHex: randomHex, randomToken: randomToken, sha256Hex: sha256Hex,
      authSession: authSession, requireAdmin: requireAdmin,
      cleanStr: cleanStr, cleanList: cleanList, find: find, findIndex: findIndex,
      dataList: dataList, idsOf: idsOf, clone: clone, ERRORS: ERRORS,
      // Google カレンダー(共有サーバーで設定したときだけ。なければ null)
      calendar: env.calendar || null,
      // Google Meet の参加記録(共有サーバーで設定したときだけ。なければ null)
      meet: env.meet || null,
      // プッシュ通知の鍵(共有サーバーで動くときだけ。なければ null)
      push: env.push || null,
      // LINE 公式アカウント(共有サーバーで、運営が設定したときだけ。{ addUrl } など。なければ null)
      line: env.line || null,
      // 写真などの大きなデータの置き場所(共有サーバーでは別のシート。なければ null=本体に入れる)
      blobs: env.blobs || null,
    };
    var MODULE_INSTANCES = MODULES.map(function (m) {
      var inst = m.create(ctx) || {};
      Object.keys(inst.actions || {}).forEach(function (name) { ACTIONS[name] = inst.actions[name]; });
      return inst;
    });

    function handle(body) {
      try {
        if (!body || typeof body !== "object" || !body.action) return fail("INVALID_REQUEST");
        var fn = Object.prototype.hasOwnProperty.call(ACTIONS, body.action) ? ACTIONS[body.action] : null;
        if (!fn) return fail("INVALID_ACTION");
        return fn(body);
      } catch (err) {
        if (env.onError) env.onError(err);
        return fail("SERVER_ERROR");
      }
    }

    // 定期実行の処理(外からは呼べない。GAS の時間主導トリガーから呼ぶ)
    function runJob(name, arg) {
      var done = [];
      MODULE_INSTANCES.forEach(function (m) {
        if (m.jobs && typeof m.jobs[name] === "function") done.push(m.jobs[name](arg));
      });
      return done;
    }

    return { handle: handle, runJob: runJob };
  }

  // 書き込みを伴う操作(共有サーバーでスプレッドシートの一覧を更新する対象)
  var MUTATING_ACTIONS = [
    "updateMyProfile", "adminSaveReferralMember", "adminDeleteReferralMember", "adminImportReferralMembers",
    "recordReferral", "deleteReferral", "updateReferralStatus",
  ];
  // 書き込みのあとに、プッシュ通知を送るか確かめる操作
  var NOTIFY_ACTIONS = MUTATING_ACTIONS.slice();

  return {
    createServer: createServer,
    registerModule: function (mod) {
      registerModule(mod);
      (mod.mutating || []).forEach(function (a) { MUTATING_ACTIONS.push(a); NOTIFY_ACTIONS.push(a); });
      (mod.notifying || []).forEach(function (a) { NOTIFY_ACTIONS.push(a); });
    },
    sha256Hex: sha256Hex,
    normalizeName: normalizeName,
    SELF_EDITABLE: SELF_EDITABLE,
    ERRORS: ERRORS,
    REFERRAL_STATUSES: REFERRAL_STATUSES,
    MUTATING_ACTIONS: MUTATING_ACTIONS,
    NOTIFY_ACTIONS: NOTIFY_ACTIONS,
  };
})();


// ---------- auth/server-community.js ----------
// ============================================
// auth/server-community.js — コミュニティ機能(サーバー側)
//
// auth/server-core.js に registerModule で足す操作のまとまり。
// ブラウザ内のデモと共有サーバー(GAS)の両方で同じコードが動く(同期処理のみ)。
//
//   ホーム         getHome(未読・次の定例会・今月の数字をまとめて返す)/ getActivity(自分に関係する出来事)
//   定例会         listEvents / rsvpEvent / checkIn / adminSaveEvent / adminDeleteEvent / adminOpenCheckIn / adminEventDetail / adminMarkAttendance
//   ビジター招待   createVisitorInvite / listMyVisitors / updateVisitor / visitorInfo(公開)/ visitorApply(公開)
//   紹介・マイル   listMyReferrals / reportThanks / deleteThanks / getRankings
//   1on1           list1on1 / save1on1 / delete1on1
//   運営連絡       listAnnouncements / markAnnouncementsRead / adminSaveAnnouncement / adminDeleteAnnouncement
//   掲示板         listBoard / createPost / deletePost / commentPost / deleteComment / likePost
//   バグ・要望     sendFeedback / listMyFeedback / adminListFeedback / adminUpdateFeedback
//
// 人は名簿の ID(memberId)で持つ。日付は日本時間の "YYYY-MM-DD"。
// ============================================

(function () {
  "use strict";

  var JST = 9 * 60 * 60 * 1000;
  var DAY = 24 * 60 * 60 * 1000;
  // 掲示板の種類(以前の「雑談」は「告知」に変えた)
  var BOARD_CATS = ["紹介依頼", "イベント・募集", "成約・お礼", "質問・相談", "告知"];
  var ANNOUNCE_CATS = ["お知らせ", "アップデート", "定例会", "重要", "その他"];
  // invited 招待中 / applied 参加申込 / confirmed 参加確定 / attended 参加済み / joined 入会 / declined キャンセル
  var VISITOR_STATUSES = ["invited", "applied", "confirmed", "attended", "joined", "declined"];
  var FEEDBACK_KINDS = ["bug", "idea", "other"];
  var FEEDBACK_STATUSES = ["new", "doing", "done"];
  var LIMITS = { posts: 400, comments: 100, msgs: 500, threads: 2000, announcements: 300, events: 300, feedback: 500 };

  BtexServerCore.registerModule({
    mutating: [
      "rsvpEvent", "checkIn", "adminSaveEvent", "adminDeleteEvent", "adminOpenCheckIn", "adminMarkAttendance",
      "adminSyncMeetAttendance", "adminMapMeetName",
      "createVisitorInvite", "updateVisitor", "visitorApply",
      "reportThanks", "deleteThanks", "save1on1", "delete1on1", "confirm1on1", "muteReferralNudge",
    ],
    // 書き込みのあとに、通知(プッシュ)を送るか確かめる操作(mutating に加えて)
    notifying: ["createPost", "commentPost", "adminSaveAnnouncement", "adminRemindAnnouncement", "setReferralMeeting", "adminSaveMinutes", "saveTask"],
    create: function (c) {
      function dateKey(ms) {
        var d = new Date(ms + JST);
        return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
      }
      function today() { return dateKey(c.nowMs()); }
      function monthKey(ms) { return dateKey(ms).slice(0, 7); }
      function cleanDate(v) {
        var s = c.cleanStr(v, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
      }
      function cleanTime(v) {
        // 0:00〜23:59 だけを受け付け、「7:00」は「07:00」にそろえる(カレンダー連携が時刻を読めるように)
        var m = /^(\d{1,2}):(\d{2})$/.exec(c.cleanStr(v, 5));
        if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return "";
        return ("0" + Number(m[1])).slice(-2) + ":" + m[2];
      }
      function cleanText(v, max) {
        return c.cleanStr(String(v === undefined || v === null ? "" : v).replace(/\r\n?/g, "\n"), max);
      }
      function newId(prefix) { return prefix + c.randomHex(6); }
      function oneOf(v, list, fallback) { return list.indexOf(v) !== -1 ? v : fallback; }

      // セッション → { db, me(名簿の行), id, isAdmin }。無効なら { error }
      function who(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        if (!a) return { error: c.fail("SESSION_INVALID") };
        var me = c.find(db.referralMembers || [], function (m) { return m.id === a.user.memberId; });
        if (!me) return { error: c.fail("SESSION_INVALID") };
        return { db: db, me: me, id: me.id, user: a.user, isAdmin: a.isAdmin };
      }
      function admin(body) {
        var w = who(body);
        if (w.error) return w;
        if (!w.isAdmin) return { error: c.fail("FORBIDDEN_ADMIN") };
        return w;
      }
      // 定例会の日程の追加・編集・削除: 管理者と、プレゼン(定例会の進行)を任された運営メンバー
      function planner(body) {
        var w = who(body);
        if (w.error) return w;
        if (!w.isAdmin && DECK_OWNERS.indexOf(w.id) === -1) return { error: c.fail("FORBIDDEN_ADMIN") };
        return w;
      }
      function member(db, id) { return c.find(db.referralMembers || [], function (m) { return m.id === id; }); }
      function nameOf(db, id) {
        var m = member(db, id);
        if (m) return m.name;
        // ほかの BT-EX のユニットの方(1on1 の相手)
        var x = db.extPeople && db.extPeople[id];
        if (x) return x.name;
        return "(退会したメンバー)";
      }
      function memberIdOfUser(db, userId) {
        var u = c.find(db.users, function (x) { return x.userId === userId; });
        return u ? u.memberId : "";
      }
      function trim(list, max) { if (list.length > max) list.splice(0, list.length - max); }

      function migrate(db) {
        var changed = false;
        ["events", "visitors", "thanks", "oneOnOnes", "announcements", "posts", "threads", "feedback", "pushSubs", "searchMisses", "tasks"].forEach(function (k) {
          if (!Array.isArray(db[k])) { db[k] = []; changed = true; }
        });
        if (!db.seen || typeof db.seen !== "object") { db.seen = {}; changed = true; }
        if (!db.searchLog || typeof db.searchLog !== "object") { db.searchLog = {}; changed = true; }
        // 掲示板の「雑談」は「告知」に変えた
        db.posts.forEach(function (p) { if (p.cat === "雑談") { p.cat = "告知"; changed = true; } });
        if (autoComplete(db)) changed = true;
        // 初めの定例会(REF_SEED_EVENTS)を一度だけ入れる
        if (typeof REF_SEED_EVENTS !== "undefined") {
          if (!Array.isArray(db.eventSeeds)) { db.eventSeeds = []; changed = true; }
          REF_SEED_EVENTS.forEach(function (se) {
            if (db.eventSeeds.indexOf(se.seedId) !== -1) return;
            db.eventSeeds.push(se.seedId);
            var ev = {
              seedId: se.seedId, id: newId("ev_"), title: se.title, date: se.date, start: se.start, end: se.end, place: se.place || "", area: se.area,
              body: se.body || "", agenda: se.agenda || "", fee: se.fee || "", capacity: se.capacity || 0, url: "", deadline: se.deadline || "",
              kind: se.kind === "special" ? "special" : "", doors: se.doors || "",
              meet: se.meet !== false, party: { enabled: false }, rsvps: {}, attended: [], createdAt: c.nowMs(), seed: true,
            };
            syncEventCalendar(db, ev); // 共有サーバーでカレンダーが使えれば、Meet もここで作る
            db.events.push(ev);
            changed = true;
          });
        }
        // 12/2(水)20:00 の定例会は、運営の依頼で消す(同じ日は「第一回BT-EXフェス」の特別会。2026年10月25日)
        if (db.eventSeeds && db.eventSeeds.indexOf("remove-2026-12-02-regular") === -1) {
          db.eventSeeds.push("remove-2026-12-02-regular");
          db.events = db.events.filter(function (ev) {
            var drop = ev.date === "2026-12-02" && ev.kind !== "special" && /日本海側最大のマーケット/.test(ev.title || "");
            if (drop && ev.calId && c.calendar) { try { c.calendar.remove(ev.calId); } catch (err) { /* 予定が消せなくても消す */ } }
            return !drop;
          });
          changed = true;
        }
        // 初めに入れた定例会の「当日の流れ」を BT-EX の指針の順にする(運営が書きかえた回はそのまま)
        if (typeof REF_SEED_AGENDA_PREV !== "undefined" && typeof REF_SEED_AGENDA !== "undefined" && db.eventSeeds && db.eventSeeds.indexOf("agenda-shishin-4") === -1) {
          db.eventSeeds.push("agenda-shishin-4");
          db.events.forEach(function (ev) { if (ev.seed && REF_SEED_AGENDA_PREV.indexOf(ev.agenda) !== -1) ev.agenda = REF_SEED_AGENDA; });
          changed = true;
        }
        // ⑤を「ブレイクアウトルーム商談(テーブル商談) 7分×4」にする(2026年10月。運営の依頼で、すべての定例会)
        if (db.eventSeeds && db.eventSeeds.indexOf("agenda-breakout-7x4") === -1) {
          db.eventSeeds.push("agenda-breakout-7x4");
          db.events.forEach(function (ev) {
            if (typeof ev.agenda !== "string") return;
            ev.agenda = ev.agenda.replace(/^([①-⑳]\s*)ブレイクアウトルーム商談\s*(?:[(（]テーブル商談[)）])?\s*\d+\s*分\s*[×xX✕]\s*\d+\s*回?\s*$/m, "$1ブレイクアウトルーム商談（テーブル商談） 7分×4");
          });
          changed = true;
        }
        // はじめの挨拶のあとに「②用語説明」を入れ、そのあとの番号を1つずつ送る(2026年10月。運営の依頼で、すべての定例会)
        if (db.eventSeeds && db.eventSeeds.indexOf("agenda-glossary") === -1) {
          db.eventSeeds.push("agenda-glossary");
          var CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
          db.events.forEach(function (ev) {
            if (typeof ev.agenda !== "string" || /用語説明/.test(ev.agenda)) return;
            var lines = ev.agenda.split("\n");
            var at = -1;
            lines.forEach(function (l, i) { if (at < 0 && /^①/.test(l.trim()) && /挨拶|あいさつ/.test(l)) at = i; });
            if (at < 0) return;
            var out = [];
            lines.forEach(function (l, i) {
              var t = l.trim(), n = CIRC.indexOf(t.charAt(0));
              if (i > at && n >= 1 && n < CIRC.length - 1) l = l.replace(t.charAt(0), CIRC.charAt(n + 1));
              out.push(l);
              if (i === at) out.push("②用語説明");
            });
            ev.agenda = out.join("\n");
          });
          changed = true;
        }
        // 入っていない値がつながって保存された「null」「nullnull」などの文字を、一度だけ消す
        // (ログイン・通知の登録・鍵などは触らない)
        if (!Array.isArray(db.cleanups)) { db.cleanups = []; changed = true; }
        if (db.cleanups.indexOf("nullish-1") === -1) {
          db.cleanups.push("nullish-1");
          changed = true;
          var SKIP = { users: 1, sessions: 1, pushSubs: 1, passcodeGuard: 1, vapid: 1, seen: 1, searchLog: 1, cleanups: 1 };
          var scrub = function (v) {
            if (typeof v === "string") {
              if (/^\s*(?:null|undefined)+\s*$/.test(v)) return "";
              return v.indexOf("nullnull") !== -1 || v.indexOf("undefinedundefined") !== -1 ? v.replace(/(?:null|undefined){2,}/g, "") : v;
            }
            if (Array.isArray(v)) {
              // 一覧の中で「nullnull」だけだったもの(キーワードなど)は、空のまま残さず取り除く
              return v.map(function (x) { return [x, scrub(x)]; })
                .filter(function (p) { return !(typeof p[0] === "string" && p[0] !== "" && p[1] === ""); })
                .map(function (p) { return p[1]; });
            }
            if (v && typeof v === "object") { Object.keys(v).forEach(function (k) { v[k] = scrub(v[k]); }); return v; }
            return v;
          };
          Object.keys(db).forEach(function (k) { if (!SKIP[k]) db[k] = scrub(db[k]); });
          // 中身が空になった投稿・やることは消す
          db.posts = db.posts.filter(function (p) { return String(p.body || "").trim(); });
          db.tasks = db.tasks.filter(function (t) { return String(t.title || "").trim(); });
          db.announcements = db.announcements.filter(function (a) { return String(a.title || "").trim(); });
        }
        // これまでの改善点の運営連絡(REF_SEED_ANNOUNCEMENTS)を一度だけ入れる(投稿日は改善した日)
        if (typeof REF_SEED_ANNOUNCEMENTS !== "undefined") {
          if (!Array.isArray(db.announcementSeeds)) { db.announcementSeeds = []; changed = true; }
          if (!db.announcementSeedRevs || typeof db.announcementSeedRevs !== "object") { db.announcementSeedRevs = {}; changed = true; }
          REF_SEED_ANNOUNCEMENTS.forEach(function (sa) {
            var rev = sa.rev || 1;
            if (db.announcementSeeds.indexOf(sa.seedId) !== -1) {
              // 種類(アップデート など)だけを変えたとき
              var had = sa.cat ? c.find(db.announcements, function (a) { return a.seedId === sa.seedId; }) : null;
              if (had && had.cat !== sa.cat && ANNOUNCE_CATS.indexOf(sa.cat) !== -1) { had.cat = sa.cat; changed = true; }
              // すでに入っている投稿: 中身を直した(rev を上げた)ときだけ、件名・本文を新しくする。
              // 既読・投稿日はそのまま。運営が消した投稿は戻さない
              if ((db.announcementSeedRevs[sa.seedId] || 1) >= rev) return;
              db.announcementSeedRevs[sa.seedId] = rev;
              var cur = c.find(db.announcements, function (a) { return a.seedId === sa.seedId; });
              if (cur) { cur.title = sa.title; cur.body = sa.body; cur.editedAt = c.nowMs(); }
              changed = true;
              return;
            }
            db.announcementSeeds.push(sa.seedId);
            db.announcementSeedRevs[sa.seedId] = rev;
            db.announcements.push({ id: newId("a_"), at: Math.min(sa.at, c.nowMs()), readBy: [], by: "yamamoto", byName: "山本 捷真", title: sa.title, body: sa.body, cat: ANNOUNCE_CATS.indexOf(sa.cat) !== -1 ? sa.cat : "お知らせ", pinned: false, seedId: sa.seedId });
            trim(db.announcements, LIMITS.announcements);
            changed = true;
          });
        }
        // お試し版のときの掲示板の投稿(REF_SEED_POSTS)を一度だけ入れる。
        // 書いた本人の端末には同じ投稿が既にあるので、本文の書き出しが同じなら入れない
        if (typeof REF_SEED_POSTS !== "undefined") {
          if (!Array.isArray(db.postSeeds)) { db.postSeeds = []; changed = true; }
          REF_SEED_POSTS.forEach(function (sp) {
            if (db.postSeeds.indexOf(sp.seedId) !== -1) return;
            db.postSeeds.push(sp.seedId);
            changed = true;
            var key = sp.body.replace(/\s/g, "").slice(0, 40);
            var dup = db.posts.some(function (p) { return p.by === sp.by && String(p.body).replace(/\s/g, "").slice(0, 40) === key; });
            if (dup || !member(db, sp.by)) return;
            db.posts.push({ id: newId("p_"), by: sp.by, cat: sp.cat, body: sp.body, at: sp.at, likes: [], comments: [], seedId: sp.seedId });
            db.posts.sort(function (a, b) { return a.at - b.at; });
          });
        }
        // 開く前の定例会の出欠(REF_SEED_EVENT_RECORDS)を一度だけ反映する。手で直した出欠は変えない
        if (typeof REF_SEED_EVENT_RECORDS !== "undefined") {
          if (!Array.isArray(db.eventRecordRevs)) { db.eventRecordRevs = []; changed = true; }
          REF_SEED_EVENT_RECORDS.forEach(function (r) {
            if (db.eventRecordRevs.indexOf(r.rev) !== -1) return;
            var e = c.find(db.events, function (x) { return x.seedId === r.seedId; })
              || c.find(db.events, function (x) { return x.seed && x.date === r.seedId; });
            if (!e) return;
            e.rsvps = e.rsvps || {};
            e.attendSource = e.attendSource || {};
            (r.attended || []).forEach(function (id) {
              if (!member(db, id) || e.attendSource[id] === "manual") return;
              if (!e.rsvps[id]) e.rsvps[id] = "yes";
              if ((e.attended || []).indexOf(id) === -1) setAttendance(e, id, "present", "record");
            });
            (r.absent || []).forEach(function (id) {
              if (!member(db, id) || e.attendSource[id] === "manual" || (e.attended || []).indexOf(id) !== -1) return;
              if (!e.rsvps[id]) e.rsvps[id] = "no";
            });
            db.eventRecordRevs.push(r.rev);
            changed = true;
          });
        }
        return changed;
      }
      function seen(db, id) { return db.seen[id] || (db.seen[id] = { board: 0 }); }

      // ============================================
      // 定例会
      // ============================================
      // いまの日本時間 "YYYY-MM-DDTHH:MM"(申込締切と比べる)
      function nowStamp() {
        var d = new Date(c.nowMs() + JST);
        return dateKey(c.nowMs()) + "T" + ("0" + d.getUTCHours()).slice(-2) + ":" + ("0" + d.getUTCMinutes()).slice(-2);
      }
      function cleanStamp(v) {
        var x = c.cleanStr(v, 16);
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x) ? x : "";
      }
      function deadlinePassed(e) { return !!e.deadline && nowStamp() > e.deadline; }

      function eventView(w, e) {
        var rsvps = e.rsvps || {};
        var yes = Object.keys(rsvps).filter(function (k) { return rsvps[k] === "yes"; });
        var my = rsvps[w.id] || "";
        var party = e.party && e.party.enabled ? e.party : null;
        var v = {
          id: e.id, title: e.title, date: e.date, start: e.start, end: e.end, place: e.place, area: e.area, hasMinutes: !!e.minutes,
          body: e.body, agenda: e.agenda || "", fee: e.fee, capacity: e.capacity || 0, url: e.url || "",
          kind: e.kind === "special" ? "special" : "", doors: e.doors || "",
          online: e.area === "online",
          deadline: e.deadline || "", deadlinePassed: deadlinePassed(e),
          // 参加リンク(Meet)は、申し込んだ人と管理者にだけ見せる
          meetUrl: e.meetUrl && (my === "yes" || w.isAdmin) ? e.meetUrl : "",
          hasMeet: !!e.meetUrl,
          calLink: w.isAdmin ? e.calLink || "" : "",
          party: party ? { place: party.place || "", fee: party.fee || "", time: party.time || "" } : null,
          myParty: (e.partyRsvps || {})[w.id] || "",
          partyYes: party ? Object.keys(e.partyRsvps || {}).filter(function (k) { return e.partyRsvps[k] === "yes"; }).length : 0,
          yesCount: yes.length,
          noCount: Object.keys(rsvps).filter(function (k) { return rsvps[k] === "no"; }).length,
          yesNames: yes.map(function (id) { return nameOf(w.db, id); }),
          myRsvp: my,
          attended: (e.attended || []).indexOf(w.id) !== -1,
          late: (e.late || []).indexOf(w.id) !== -1,
          checkInOpen: !!e.checkIn && e.date === today() && e.area !== "online",
          visitorCount: w.db.visitors.filter(function (x) { return x.eventId === e.id && x.status !== "declined" && x.status !== "invited"; }).length,
          past: e.date < today(),
        };
        return v;
      }

      // 定例会の詳細(全員に見せる): メンバーの出欠一覧とビジター
      function getEvent(body) {
        var w = who(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        var rs = e.rsvps || {}, pr = e.partyRsvps || {};
        var members = (w.db.referralMembers || []).map(function (m) {
          var att = (e.attended || []).indexOf(m.id) !== -1;
          return {
            id: m.id, name: m.name, team: m.team || "", category: m.company || m.category || "",
            rsvp: rs[m.id] || "", attended: att, late: (e.late || []).indexOf(m.id) !== -1, party: pr[m.id] || "", isMe: m.id === w.id,
          };
        });
        var visitors = w.db.visitors
          .filter(function (v) { return v.eventId === e.id && v.status !== "invited"; })
          .map(function (v) {
            var out = { id: v.id, name: v.name, company: v.company, business: v.business, kind: v.kind || "general", byName: nameOf(w.db, v.by), status: v.status };
            if (w.isAdmin || v.by === w.id) out.contact = v.contact || "";
            return out;
          });
        return c.ok({
          event: eventView(w, e), members: members, visitors: visitors, isAdmin: w.isAdmin,
          minutes: e.minutes ? { text: e.minutes.text, at: e.minutes.at, byName: nameOf(w.db, e.minutes.by), annId: e.minutes.annId || "" } : null,
        });
      }

      // 定例会の議事録・決定事項(管理者が書く。publish で運営連絡として全員に配る)
      function adminSaveMinutes(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        var text = cleanText(body.text, 4000);
        if (!text) {
          delete e.minutes;
          c.saveDb(w.db);
          return c.ok({ minutes: null });
        }
        e.minutes = { text: text, at: c.nowMs(), by: w.id, annId: (e.minutes && e.minutes.annId) || "" };
        if (body.publish === true) {
          var a = e.minutes.annId && c.find(w.db.announcements, function (x) { return x.id === e.minutes.annId; });
          if (!a) {
            a = { id: newId("a_"), at: c.nowMs(), readBy: [], by: w.id, byName: w.me.name, pinned: false };
            w.db.announcements.push(a);
            trim(w.db.announcements, LIMITS.announcements);
          } else {
            // 直したときは、もう一度読んでもらう
            a.at = c.nowMs();
            a.readBy = [];
          }
          a.title = e.date.slice(5).replace("-", "/") + " " + e.title + " の議事録・決定事項";
          a.body = text;
          a.cat = "定例会";
          a.readBy.push(w.id);
          e.minutes.annId = a.id;
        }
        c.saveDb(w.db);
        return c.ok({ minutes: { text: e.minutes.text, at: e.minutes.at, byName: w.me.name, annId: e.minutes.annId } });
      }

      function listEvents(body) {
        var w = who(body);
        if (w.error) return w.error;
        var from = dateKey(c.nowMs() - 120 * DAY);
        var events = w.db.events
          .filter(function (e) { return e.date >= from; })
          .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); })
          .map(function (e) { return eventView(w, e); });
        return c.ok({ events: events, today: today(), calendar: !!c.calendar });
      }

      function rsvpEvent(body) {
        var w = who(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.eventId; });
        if (!e) return c.fail("NOT_FOUND");
        if ((deadlinePassed(e) || e.date < today()) && !w.isAdmin) return c.fail("INVALID_REQUEST", "申込の受付は終了しました。変更は運営にご連絡ください。");
        if ("answer" in body) {
          var answer = oneOf(body.answer, ["yes", "no", ""], "");
          e.rsvps = e.rsvps || {};
          if (answer) e.rsvps[w.id] = answer; else delete e.rsvps[w.id];
          // 欠席にしたら懇親会も不参加に
          if (answer === "no" && e.partyRsvps && e.partyRsvps[w.id]) e.partyRsvps[w.id] = "no";
        }
        if ("party" in body && e.party && e.party.enabled) {
          var p = oneOf(body.party, ["yes", "no", ""], "");
          e.partyRsvps = e.partyRsvps || {};
          if (p) e.partyRsvps[w.id] = p; else delete e.partyRsvps[w.id];
        }
        c.saveDb(w.db);
        return c.ok({ event: eventView(w, e) });
      }

      // 出席コード: 定例会の当日、管理者が受付を開いている間だけ受け付ける
      function checkIn(body) {
        var w = who(body);
        if (w.error) return w.error;
        var guard = w.db.seen[w.id] = w.db.seen[w.id] || { board: 0 };
        if ((guard.checkInLockedUntil || 0) > c.nowMs()) return c.fail("LOCKED");
        var code = String(body.code || "").replace(/\D/g, "");
        var e = c.find(w.db.events, function (x) {
          return x.date === today() && x.checkIn && x.checkIn.code === code && (!body.eventId || x.id === body.eventId);
        });
        if (!code || !e) {
          guard.checkInFailures = (guard.checkInFailures || 0) + 1;
          if (guard.checkInFailures >= 5) { guard.checkInLockedUntil = c.nowMs() + 10 * 60 * 1000; guard.checkInFailures = 0; }
          c.saveDb(w.db);
          return c.fail(guard.checkInLockedUntil > c.nowMs() ? "LOCKED" : "CHECKIN_FAILED");
        }
        guard.checkInFailures = 0;
        if ((e.attended || []).indexOf(w.id) === -1) setAttendance(e, w.id, "present", "code");
        e.rsvps = e.rsvps || {};
        e.rsvps[w.id] = "yes";
        c.saveDb(w.db);
        return c.ok({ event: eventView(w, e) });
      }

      function daysBetween(a, b) {
        var pa = a.split("-").map(Number), pb = b.split("-").map(Number);
        return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / DAY);
      }
      function shiftStamp(stamp, days) {
        var p = stamp.slice(0, 10).split("-").map(Number);
        var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + days));
        return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2) + stamp.slice(10);
      }
      // 定例会を Google カレンダー(運営のカレンダー)に入れ、オンラインなら Google Meet も作る
      function syncEventCalendar(db, e) {
        if (!c.calendar || e.date < today()) return null;
        if (e.area !== "online" && !e.calId) return null;
        try {
          var r = c.calendar.upsert({
            id: e.calId || "", title: e.title + "(BT-EX5 定例会)", date: e.date, start: e.start || "", end: e.end || e.start || "",
            meet: e.area === "online" && e.meet !== false, location: e.area === "online" ? "" : e.place,
            description: [e.agenda, e.body].filter(Boolean).join("\n\n"), guests: [],
          });
          e.calId = r.id || e.calId || "";
          e.calLink = r.link || e.calLink || "";
          if (r.meetUrl) e.meetUrl = r.meetUrl;
          return "synced";
        } catch (err) {
          return "error";
        }
      }

      function adminSaveEvent(body) {
        var w = planner(body);
        if (w.error) return w.error;
        var input = body.event || {};
        var e = c.find(w.db.events, function (x) { return x.id === input.id; });
        var next = {
          title: c.cleanStr(input.title, 80),
          date: cleanDate(input.date),
          start: cleanTime(input.start),
          end: cleanTime(input.end),
          place: c.cleanStr(input.place, 120),
          area: oneOf(input.area, ["niigata", "tokyo", "online", "other"], "other"),
          body: cleanText(input.body, 2000),
          fee: c.cleanStr(input.fee, 60),
          capacity: Math.max(0, Math.min(999, Number(input.capacity) || 0)),
          url: /^https:\/\/[^\s"'<>]+$/i.test(String(input.url || "")) ? c.cleanStr(input.url, 300) : "",
          agenda: cleanText(input.agenda, 2000),
          deadline: cleanStamp(input.deadline),
          meet: input.meet === true,
          // 種類(特別会)と受付の時刻
          kind: input.kind === "special" ? "special" : "",
          doors: cleanTime(input.doors),
          party: input.party && input.party.enabled ? { enabled: true, place: c.cleanStr(input.party.place, 120), fee: c.cleanStr(input.party.fee, 60), time: c.cleanStr(input.party.time, 20) } : { enabled: false },
        };
        // Meet の URL を手で入れた(自動で作れないとき)
        var manualMeet = c.cleanStr(input.meetUrl, 200);
        if (!next.title || !next.date) return c.fail("INVALID_REQUEST");
        var applyMeet = function (x) {
          if (next.area === "online" && /^https:\/\/meet\.google\.com\/[\w-]+$/.test(manualMeet)) x.meetUrl = manualMeet;
          if (next.area !== "online") x.meetUrl = "";
        };
        if (e) {
          Object.keys(next).forEach(function (k) { e[k] = next[k]; });
          applyMeet(e);
          syncEventCalendar(w.db, e);
        }
        else {
          // 繰り返し: dates(最初の日を含む日付の一覧)があれば、同じ内容でまとめて作る
          var dates = [next.date];
          if (Array.isArray(body.dates)) {
            body.dates.slice(0, 24).forEach(function (d) {
              var k = cleanDate(d);
              if (k && dates.indexOf(k) === -1) dates.push(k);
            });
          }
          dates.forEach(function (d, i) {
            var x = c.clone(next);
            x.date = d;
            // 申込締切は、開催日との差を保って各回にずらす
            if (next.deadline && i > 0) x.deadline = shiftStamp(next.deadline, daysBetween(next.date, d));
            x.id = newId("ev_");
            x.rsvps = {};
            x.attended = [];
            x.createdAt = c.nowMs();
            applyMeet(x);
            syncEventCalendar(w.db, x);
            w.db.events.push(x);
            if (i === 0) e = x;
          });
          trim(w.db.events, LIMITS.events);
          c.saveDb(w.db);
          return c.ok({ event: eventView(w, e), created: dates.length });
        }
        c.saveDb(w.db);
        return c.ok({ event: eventView(w, e) });
      }

      function adminDeleteEvent(body) {
        var w = planner(body);
        if (w.error) return w.error;
        var target = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!target) return c.fail("NOT_FOUND");
        if (target.calId && c.calendar) { try { c.calendar.remove(target.calId); } catch (err) { /* 予定が消せなくても定例会は消す */ } }
        w.db.events = w.db.events.filter(function (x) { return x.id !== body.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // 受付を開く(4桁のコードを作る)・閉じる
      function adminOpenCheckIn(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        if (body.open === false) e.checkIn = null;
        else {
          var n = 0;
          c.randomHex(4).match(/../g).forEach(function (h) { n = (n * 256 + parseInt(h, 16)) % 10000; });
          e.checkIn = { code: ("000" + n).slice(-4), openedAt: c.nowMs() };
        }
        c.saveDb(w.db);
        return c.ok({ code: e.checkIn ? e.checkIn.code : "" });
      }

      // ---------- 出欠(出席・遅刻早退) ----------
      // attended: 出席した人(遅刻早退を含む) / late: そのうち遅刻早退 / meetMinutes: Meet に参加した分数
      var MEET_PRESENT_MIN = 100; // 100分以上 → 出席
      var MEET_LATE_MIN = 60;     // 60分以上100分未満 → 遅刻早退
      function setAttendance(e, memberId, status, source, minutes) {
        e.attended = (e.attended || []).filter(function (x) { return x !== memberId; });
        e.late = (e.late || []).filter(function (x) { return x !== memberId; });
        e.attendSource = e.attendSource || {};
        if (status === "present" || status === "late") {
          e.attended.push(memberId);
          if (status === "late") e.late.push(memberId);
          e.attendSource[memberId] = source;
        } else {
          delete e.attendSource[memberId];
        }
        if (typeof minutes === "number") { e.meetMinutes = e.meetMinutes || {}; e.meetMinutes[memberId] = minutes; }
      }
      function attendanceOf(e, memberId) {
        if ((e.attended || []).indexOf(memberId) === -1) return "";
        return (e.late || []).indexOf(memberId) !== -1 ? "late" : "present";
      }
      function statusByMinutes(min) { return min >= MEET_PRESENT_MIN ? "present" : min >= MEET_LATE_MIN ? "late" : ""; }

      // Meet の参加者(表示名と分数)を名簿に当てはめる。手で付けた出欠は上書きしない
      function applyMeetParticipants(db, e, list) {
        var keys = {};
        (db.referralMembers || []).forEach(function (m) {
          keys[BtexServerCore.normalizeName(m.name)] = m.id;
          var u = userOf(db, m.id);
          if (u && u.meetName) keys[BtexServerCore.normalizeName(u.meetName)] = m.id;
        });
        Object.keys(db.meetAliases || {}).forEach(function (k) { keys[k] = db.meetAliases[k]; });
        var byMember = {};
        var unmatched = {};
        list.forEach(function (p) {
          var k = BtexServerCore.normalizeName(p.name);
          var id = keys[k];
          if (id) byMember[id] = (byMember[id] || 0) + p.minutes;
          else if (k) unmatched[p.name] = (unmatched[p.name] || 0) + p.minutes;
        });
        e.attendSource = e.attendSource || {};
        Object.keys(byMember).forEach(function (id) {
          if (e.attendSource[id] === "manual") { e.meetMinutes = e.meetMinutes || {}; e.meetMinutes[id] = byMember[id]; return; }
          setAttendance(e, id, statusByMinutes(byMember[id]), "meet", byMember[id]);
        });
        e.meetUnmatched = Object.keys(unmatched).map(function (n) { return { name: n, minutes: unmatched[n] }; })
          .filter(function (x) { return x.minutes > 0; });
        e.meetSyncedAt = c.nowMs();
        return { matched: Object.keys(byMember).length, unmatched: e.meetUnmatched.length };
      }
      function syncMeetFor(db, e) {
        if (!c.meet || !e.meetUrl) return { error: "unavailable" };
        try {
          var list = c.meet.attendance(e.meetUrl) || [];
          return applyMeetParticipants(db, e, list);
        } catch (err) {
          e.meetSyncError = String(err && err.message ? err.message : err).slice(0, 200);
          return { error: "failed" };
        }
      }
      // 終わった時刻(日本時間のミリ秒)
      function eventStartMs(e) {
        var p = e.date.split("-").map(Number);
        var hm = (e.start || "00:00").split(":").map(Number);
        return Date.UTC(p[0], p[1] - 1, p[2], hm[0], hm[1]) - JST;
      }
      // 予定の開始(日本時間)。時刻がなければ null
      var SOON = 3 * 60 * 60 * 1000;
      function startMs(date, time) {
        if (!date || !time) return null;
        return Date.parse(date + "T" + (time.length === 4 ? "0" + time : time) + ":00+09:00");
      }
      function startsSoon(date, time) {
        var s0 = startMs(date, time);
        return s0 !== null && c.nowMs() >= s0 - SOON && c.nowMs() < s0;
      }
      // 2日以内に始まり、出欠の締切前の定例会
      function eventSoon(e) {
        var start = eventStartMs(e);
        return c.nowMs() >= start - 2 * DAY && c.nowMs() < start && !deadlinePassed(e);
      }
      function eventEndMs(e) {
        var t = e.end || e.start || "23:59";
        var p = e.date.split("-").map(Number);
        var hm = t.split(":").map(Number);
        return Date.UTC(p[0], p[1] - 1, p[2], hm[0], hm[1]) - JST;
      }
      // 定期実行: 終わってから15分〜3時間の間、Meet の参加記録から出欠をつける(何度実行しても同じ結果)
      function jobSyncMeet() {
        var db = c.ensureDb();
        if (!c.meet) return { skipped: "no meet" };
        var count = 0;
        db.events.forEach(function (e) {
          if (!e.meetUrl || e.area !== "online") return;
          var end = eventEndMs(e);
          var now = c.nowMs();
          if (now < end + 15 * 60 * 1000 || now > end + 3 * 60 * 60 * 1000) return;
          syncMeetFor(db, e);
          count++;
        });
        if (count) c.saveDb(db);
        return { synced: count };
      }

      function adminEventDetail(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        var rsvps = e.rsvps || {};
        var rows = (w.db.referralMembers || []).map(function (m) {
          var a = attendanceOf(e, m.id);
          return {
            memberId: m.id, name: m.name, team: m.team, rsvp: rsvps[m.id] || "", attended: !!a, attendance: a,
            minutes: (e.meetMinutes || {})[m.id], source: (e.attendSource || {})[m.id] || "",
          };
        });
        var visitors = w.db.visitors.filter(function (v) { return v.eventId === e.id; }).map(function (v) { return visitorView(w.db, v, true); });
        return c.ok({
          event: eventView(w, e), code: e.checkIn ? e.checkIn.code : "", members: rows, visitors: visitors,
          meet: { available: !!c.meet, syncedAt: e.meetSyncedAt || 0, unmatched: e.meetUnmatched || [], error: e.meetSyncError || "", presentMin: MEET_PRESENT_MIN, lateMin: MEET_LATE_MIN },
        });
      }

      function adminMarkAttendance(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e || !member(w.db, body.memberId)) return c.fail("NOT_FOUND");
        var status = "status" in body ? oneOf(body.status, ["present", "late", ""], "") : (body.attended === true ? "present" : "");
        setAttendance(e, body.memberId, status, "manual");
        if (!status) { e.attendSource = e.attendSource || {}; e.attendSource[body.memberId] = "manual"; }
        c.saveDb(w.db);
        return c.ok({});
      }

      // 管理者: いますぐ Meet の参加記録から出欠をつける
      function adminSyncMeetAttendance(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e) return c.fail("NOT_FOUND");
        if (!c.meet) return c.fail("INVALID_REQUEST", "共有サーバーで Google Meet の参加記録を使う設定をすると、自動で出欠をつけられます(gas/README.md)。");
        if (!e.meetUrl) return c.fail("INVALID_REQUEST", "この定例会には Google Meet がありません。");
        var r = syncMeetFor(w.db, e);
        c.saveDb(w.db);
        if (r.error) return c.fail("SERVER_ERROR", "Google Meet の参加記録を読めませんでした。" + (e.meetSyncError || ""));
        return c.ok(r);
      }

      // 管理者: 名簿に当てはまらなかった Meet の表示名を、メンバーに結びつける(次からは自動)
      function adminMapMeetName(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.id; });
        if (!e || !member(w.db, body.memberId)) return c.fail("NOT_FOUND");
        var name = c.cleanStr(body.name, 80);
        var row = c.find(e.meetUnmatched || [], function (x) { return x.name === name; });
        if (!row) return c.fail("NOT_FOUND");
        w.db.meetAliases = w.db.meetAliases || {};
        w.db.meetAliases[BtexServerCore.normalizeName(name)] = body.memberId;
        var total = ((e.meetMinutes || {})[body.memberId] || 0) + row.minutes;
        setAttendance(e, body.memberId, statusByMinutes(total), "meet", total);
        e.meetUnmatched = e.meetUnmatched.filter(function (x) { return x.name !== name; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // ============================================
      // ビジター招待
      // ============================================
      function visitorView(db, v, withContact) {
        var out = {
          id: v.id, eventId: v.eventId, name: v.name, company: v.company, business: v.business, message: v.message,
          status: v.status, at: v.at, appliedAt: v.appliedAt || 0, by: v.by, byName: nameOf(db, v.by), token: v.token, kind: v.kind || "general",
          inviteMessage: v.inviteMessage || "", linkTeam: v.linkTeam || "", linkUp: v.linkUp || "", linkAdvance: v.linkAdvance || "",
        };
        var e = c.find(db.events, function (x) { return x.id === v.eventId; });
        out.eventTitle = e ? e.title : "";
        out.eventDate = e ? e.date : "";
        if (withContact) out.contact = v.contact || "";
        return out;
      }

      function createVisitorInvite(body) {
        var w = who(body);
        if (w.error) return w.error;
        var e = c.find(w.db.events, function (x) { return x.id === body.eventId; });
        if (!e || e.date < today()) return c.fail("NOT_FOUND");
        var v = {
          id: newId("v_"), token: c.randomToken().slice(0, 22), eventId: e.id, by: w.id,
          name: c.cleanStr(body.name, 40), company: c.cleanStr(body.company, 80), business: "", contact: c.cleanStr(body.contact, 120), message: "",
          // 招待する人から相手へのひとこと(申込ページに出す)
          inviteMessage: cleanText(body.inviteMessage, 500),
          note: c.cleanStr(body.note, 200), status: "invited", at: c.nowMs(),
          // general 一般の方(LINK 以外) / link LINK BT 会員の方(申込で所属チーム・アップ・アドバンスを聞く)
          kind: oneOf(body.kind, ["general", "link"], "general"),
        };
        w.db.visitors.push(v);
        c.saveDb(w.db);
        return c.ok({ visitor: visitorView(w.db, v, true) });
      }

      function listMyVisitors(body) {
        var w = who(body);
        if (w.error) return w.error;
        var list = w.db.visitors
          .filter(function (v) { return v.by === w.id || (w.isAdmin && !body.mine); })
          .slice().reverse().slice(0, 200)
          .map(function (v) { return visitorView(w.db, v, true); });
        return c.ok({ visitors: list });
      }

      // 招待した本人か管理者が状況を変える
      function updateVisitor(body) {
        var w = who(body);
        if (w.error) return w.error;
        var v = c.find(w.db.visitors, function (x) { return x.id === body.id; });
        if (!v || (v.by !== w.id && !w.isAdmin)) return c.fail("NOT_FOUND");
        if (body.remove === true) {
          w.db.visitors = w.db.visitors.filter(function (x) { return x.id !== v.id; });
        } else {
          v.status = oneOf(body.status, VISITOR_STATUSES, v.status);
        }
        c.saveDb(w.db);
        return c.ok({});
      }

      // 公開(ログイン不要): 招待URLのトークンで定例会の案内を返す
      function visitorInfo(body) {
        var db = c.ensureDb();
        var v = c.find(db.visitors, function (x) { return x.token === String(body.token || ""); });
        var e = v && c.find(db.events, function (x) { return x.id === v.eventId; });
        if (!v || !e) return c.fail("NOT_FOUND", "招待のリンクが見つかりませんでした。招待してくれた方にご確認ください。");
        return c.ok({
          event: { title: e.title, date: e.date, start: e.start, end: e.end, place: e.place, area: e.area, fee: e.fee, body: e.body, url: e.url || "" },
          inviter: nameOf(db, v.by),
          name: v.name,
          company: v.company || "",
          kind: v.kind || "general",
          inviteMessage: v.inviteMessage || "",
          status: v.status,
          past: e.date < today(),
        });
      }

      function visitorApply(body) {
        var db = c.ensureDb();
        var v = c.find(db.visitors, function (x) { return x.token === String(body.token || ""); });
        var e = v && c.find(db.events, function (x) { return x.id === v.eventId; });
        if (!v || !e) return c.fail("NOT_FOUND", "招待のリンクが見つかりませんでした。招待してくれた方にご確認ください。");
        if (e.date < today()) return c.fail("INVALID_REQUEST", "この定例会の受付は終了しました。");
        var name = c.cleanStr(body.name, 40);
        if (!name) return c.fail("INVALID_REQUEST", "お名前を入力してください。");
        v.name = name;
        v.company = c.cleanStr(body.company, 80);
        v.business = c.cleanStr(body.business, 300);
        v.contact = c.cleanStr(body.contact, 120);
        v.message = c.cleanStr(body.message, 300);
        if (v.kind === "link") {
          v.linkTeam = c.cleanStr(body.linkTeam, 60);
          v.linkUp = c.cleanStr(body.linkUp, 40);
          v.linkAdvance = c.cleanStr(body.linkAdvance, 40);
        }
        if (v.status === "invited" || v.status === "declined") v.status = "applied";
        v.appliedAt = c.nowMs();
        c.saveDb(db);
        return c.ok({ status: v.status });
      }

      // ============================================
      // 紹介(リファーラル)とありがとうマイル
      // ============================================
      // ありがとうマイル: 紹介で仕事が決まった人が、紹介してくれた人へ「成約金額」をお礼として記録する。
      // 1円 = 1マイル(紹介から生まれた売上)
      function referralView(db, l, me) {
        var giver = memberIdOfUser(db, l.fromUserId);
        var thanks = c.find(db.thanks, function (t) { return t.referralId === l.id; });
        return {
          id: l.id, at: l.at, status: l.status, statusAt: l.statusAt || 0,
          fromId: giver, fromName: nameOf(db, giver), toId: l.toMemberId, toName: nameOf(db, l.toMemberId),
          prospect: l.prospect, contact: l.contact || "", memo: l.memo || "", topics: l.topics || [],
          mine: giver === me, received: l.toMemberId === me,
          thanksAmount: thanks ? thanks.amount : 0,
          meeting: meetingView(db, l.meeting),
        };
      }

      // 紹介の顔合わせの予定(紹介した人・紹介を受けた人のどちらでも決められる)
      function meetingView(db, mt) {
        if (!mt || !mt.date) return null;
        var o = { date: mt.date, time: mt.time || "", duration: mt.duration || 60 };
        return {
          date: mt.date, time: mt.time || "", duration: o.duration, end: endTime(o), endDate: endDate(o),
          mode: mt.mode || "onsite", place: mt.place || "", meetUrl: mt.meetUrl || "", setByName: mt.setBy ? nameOf(db, mt.setBy) : "",
        };
      }
      function setReferralMeeting(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var l = c.find(db.referralLogs, function (x) { return x.id === body.id; });
        if (!l || (memberIdOfUser(db, l.fromUserId) !== w.id && l.toMemberId !== w.id)) return c.fail("NOT_FOUND");
        var m = body.meeting;
        if (!m) {
          delete l.meeting;
        } else {
          var date = cleanDate(m.date);
          if (!date) return c.fail("INVALID_REQUEST", "顔合わせの日付を入れてください。");
          var mode = oneOf(m.mode, ["onsite", "meet"], "onsite");
          var url = c.cleanStr(m.meetUrl, 200);
          l.meeting = {
            date: date, time: cleanTime(m.time),
            duration: DURATIONS.indexOf(Number(m.duration)) !== -1 ? Number(m.duration) : 60,
            mode: mode, place: mode === "meet" ? "" : c.cleanStr(m.place, 80),
            meetUrl: mode === "meet" && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : "",
            setBy: w.id, setAt: c.nowMs(),
          };
        }
        c.saveDb(db);
        return c.ok({ item: referralView(db, l, w.id) });
      }

      function thanksView(db, t) {
        return { id: t.id, at: t.at, from: t.from, fromName: nameOf(db, t.from), to: t.to, toName: nameOf(db, t.to), amount: t.amount, message: t.message, referralId: t.referralId || "" };
      }

      function listMyReferrals(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var given = [], received = [];
        db.referralLogs.forEach(function (l) {
          var v = referralView(db, l, w.id);
          if (v.mine) given.push(v);
          if (v.received) received.push(v);
        });
        var thanksIn = db.thanks.filter(function (t) { return t.to === w.id; }).map(function (t) { return thanksView(db, t); });
        var thanksOut = db.thanks.filter(function (t) { return t.from === w.id; }).map(function (t) { return thanksView(db, t); });
        return c.ok({ given: given.reverse(), received: received.reverse(), thanksIn: thanksIn.reverse(), thanksOut: thanksOut.reverse() });
      }

      // 紹介で決まった仕事のお礼(ありがとうマイル)を記録する。
      // referralId があれば、その紹介を受けた本人だけが記録でき、紹介は「成約」になる
      function reportThanks(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var amount = Math.round(Number(String(body.amount || "").replace(/[^\d.]/g, "")) || 0);
        // 1件は1億円まで。1日に記録できるのは20件まで(打ちまちがい・いたずらでランキングがこわれないように)
        if (amount < 0 || amount > 100000000) return c.fail("INVALID_REQUEST", "金額は1億円までで入れてください。");
        var dayAgo = c.nowMs() - 24 * 60 * 60 * 1000;
        if (db.thanks.filter(function (x) { return x.from === w.id && x.at > dayAgo; }).length >= 20) return c.fail("RATE_LIMITED", "今日はたくさん記録しています。続きは明日にお願いします。");
        var to = c.cleanStr(body.toMemberId, 40);
        var referralId = c.cleanStr(body.referralId, 40);
        if (referralId) {
          var l = c.find(db.referralLogs, function (x) { return x.id === referralId; });
          if (!l || l.toMemberId !== w.id) return c.fail("NOT_FOUND");
          to = memberIdOfUser(db, l.fromUserId);
          l.status = "won";
          l.statusAt = c.nowMs();
          db.thanks = db.thanks.filter(function (t) { return t.referralId !== referralId; });
        }
        if (!member(db, to)) return c.fail("NOT_FOUND");
        if (to === w.id) return c.fail("SELF_REFERRAL");
        var t = { id: newId("t_"), at: c.nowMs(), from: w.id, to: to, amount: amount, message: c.cleanStr(body.message, 300), referralId: referralId };
        db.thanks.push(t);
        c.saveDb(db);
        return c.ok({ thanks: thanksView(db, t) });
      }

      function deleteThanks(body) {
        var w = who(body);
        if (w.error) return w.error;
        var t = c.find(w.db.thanks, function (x) { return x.id === body.id; });
        if (!t || (t.from !== w.id && !w.isAdmin)) return c.fail("NOT_FOUND");
        w.db.thanks = w.db.thanks.filter(function (x) { return x.id !== t.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // ランキング(個人・チーム): 紹介した数・成約・ありがとうマイル・1on1・出席
      function getRankings(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var period = oneOf(body.period, ["month", "year", "all"], "month");
        var nowKey = dateKey(c.nowMs());
        var inPeriod = function (ms) {
          if (period === "all") return true;
          var k = dateKey(ms);
          return period === "month" ? k.slice(0, 7) === nowKey.slice(0, 7) : k.slice(0, 4) === nowKey.slice(0, 4);
        };
        var inPeriodDate = function (d) {
          if (period === "all") return true;
          return period === "month" ? d.slice(0, 7) === nowKey.slice(0, 7) : d.slice(0, 4) === nowKey.slice(0, 4);
        };
        var rows = {};
        (db.referralMembers || []).forEach(function (m) {
          rows[m.id] = { id: m.id, name: m.name, team: m.team || "", referrals: 0, won: 0, miles: 0, oneOnOnes: 0, attended: 0 };
        });
        db.referralLogs.forEach(function (l) {
          var r = rows[memberIdOfUser(db, l.fromUserId)];
          if (!r || !inPeriod(l.at)) return;
          r.referrals += 1;
          if (l.status === "won") r.won += 1;
        });
        db.thanks.forEach(function (t) { if (rows[t.to] && inPeriod(t.at)) rows[t.to].miles += t.amount; });
        db.oneOnOnes.forEach(function (o) {
          if (o.status !== "done" || !inPeriodDate(o.date)) return;
          [o.a, o.b].forEach(function (id) { if (rows[id]) rows[id].oneOnOnes += 1; });
        });
        db.events.forEach(function (e) {
          if (e.date > today() || !inPeriodDate(e.date)) return;
          (e.attended || []).forEach(function (id) { if (rows[id]) rows[id].attended += 1; });
        });
        var list = Object.keys(rows).map(function (k) { return rows[k]; });
        var teams = {};
        list.forEach(function (r) {
          var key = r.team || "チーム未設定";
          var t = teams[key] || (teams[key] = { team: key, members: 0, referrals: 0, won: 0, miles: 0, oneOnOnes: 0, attended: 0 });
          t.members += 1;
          ["referrals", "won", "miles", "oneOnOnes", "attended"].forEach(function (f) { t[f] += r[f]; });
        });
        return c.ok({
          period: period,
          members: list,
          teams: Object.keys(teams).map(function (k) { return teams[k]; }),
          totals: {
            referrals: list.reduce(function (s, r) { return s + r.referrals; }, 0),
            won: list.reduce(function (s, r) { return s + r.won; }, 0),
            miles: list.reduce(function (s, r) { return s + r.miles; }, 0),
            oneOnOnes: db.oneOnOnes.filter(function (o) { return o.status === "done" && inPeriodDate(o.date); }).length,
          },
        });
      }

      // ============================================
      // チームのランキング(貢献ポイント)
      // ============================================
      // 貢献ポイント: 何をするとポイントになるかを画面で見せ、紹介と貢献金額が増えるようにする
      // 紹介 +1 / 成約 +3 / 貢献金額 1,000円ごとに +0.1 / 1on1 +1 / 定例会に出席 +1 / ビジターの申込 +2
      var POINTS = { referral: 1, won: 3, milesPer: 1000, mile: 0.1, oneOnOne: 1, attended: 1, visitor: 2 };
      function round1(x) { return Math.round(x * 10) / 10; }
      var VISITOR_COUNTED = ["applied", "confirmed", "attended", "joined"];
      function monthShift(ym, n) {
        var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
        y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
        return y + "-" + ("0" + (m + 1)).slice(-2);
      }
      function lastDay(ym) {
        var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
        return ym + "-" + ("0" + new Date(Date.UTC(y, m, 0)).getUTCDate()).slice(-2);
      }
      // 期間(日付 "YYYY-MM-DD" の from〜to)の、メンバーごとの数字とポイント
      function memberStats(db, from, to) {
        var inRange = function (key) { return key >= from && key <= to; };
        var rows = {};
        (db.referralMembers || []).forEach(function (m) {
          rows[m.id] = { id: m.id, name: m.name, team: m.team || "チーム未設定", referrals: 0, won: 0, miles: 0, oneOnOnes: 0, attended: 0, visitors: 0, points: 0 };
        });
        db.referralLogs.forEach(function (l) {
          var r = rows[memberIdOfUser(db, l.fromUserId)];
          if (!r) return;
          if (inRange(dateKey(l.at))) r.referrals += 1;
          if (l.status === "won" && inRange(dateKey(l.statusAt || l.at))) r.won += 1;
        });
        db.thanks.forEach(function (t) { if (rows[t.to] && inRange(dateKey(t.at))) rows[t.to].miles += t.amount; });
        db.oneOnOnes.forEach(function (o) {
          if (o.status !== "done" || !inRange(o.date)) return;
          [o.a, o.b].forEach(function (id) { if (rows[id]) rows[id].oneOnOnes += 1; });
        });
        db.events.forEach(function (e) {
          if (e.date > today() || !inRange(e.date)) return;
          (e.attended || []).forEach(function (id) { if (rows[id]) rows[id].attended += 1; });
        });
        db.visitors.forEach(function (v) {
          if (rows[v.by] && VISITOR_COUNTED.indexOf(v.status) !== -1 && inRange(dateKey(v.at))) rows[v.by].visitors += 1;
        });
        Object.keys(rows).forEach(function (k) {
          var r = rows[k];
          r.points = round1(r.referrals * POINTS.referral + r.won * POINTS.won + Math.floor(r.miles / POINTS.milesPer) * POINTS.mile
            + r.oneOnOnes * POINTS.oneOnOne + r.attended * POINTS.attended + r.visitors * POINTS.visitor);
        });
        return rows;
      }
      // 点の高い順に順位をつける(同点は同じ順位)。gap は1つ上の順位まであと何点か
      function rankRows(list, key) {
        var sorted = list.slice().sort(function (a, b) { return b[key] - a[key] || b.referrals - a.referrals || (a.name || "").localeCompare(b.name || ""); });
        sorted.forEach(function (r, i) {
          r.rank = i > 0 && sorted[i - 1][key] === r[key] ? sorted[i - 1].rank : i + 1;
          var above = null;
          for (var j = i - 1; j >= 0; j--) { if (sorted[j][key] > r[key]) { above = sorted[j]; break; } }
          r.gap = above ? round1(above[key] - r[key]) : 0;
          r.gapName = above ? (above.name || above.team) : "";
        });
        // 同じ順位の人数(「同率1位(15名)」と出すため)
        var same = {};
        sorted.forEach(function (r) { same[r.rank] = (same[r.rank] || 0) + 1; });
        sorted.forEach(function (r) { r.tied = same[r.rank]; });
        return sorted;
      }
      // BT-EX5 全体の月の目標(管理者が設定。決めていなければ紹介は1人1件)
      function communityGoal(db, size) {
        var d = ((db.settings.teamGoals || {}).default) || {};
        return { referrals: d.referrals || size, miles: d.miles || 0 };
      }
      // ランキング(BT-EX5 の中の個人の順位。チームでは分けない)
      // ============================================
      // 自分の数字・メンバー別の数字(期間を選んで集計)
      // 出席・1on1 は開催日、紹介・マイルは記録した日、ビジターは参加する定例会の日で数える
      // ============================================
      // 期間(from〜to)の、メンバーごとの数字と全体の数字
      function countRange(db, from, to) {
        var inRange = function (key) { return key >= from && key <= to; };
        var rows = {};
        (db.referralMembers || []).forEach(function (m) {
          rows[m.id] = { id: m.id, name: m.name, attended: 0, referrals: 0, received: 0, oneOnOnes: 0, milesGiven: 0, milesReceived: 0, visitors: 0, visitorsGeneral: 0, visitorsLink: 0, joined: 0 };
        });
        var total = { attended: 0, referrals: 0, miles: 0, oneOnOnes: 0, visitors: 0, joined: 0 };
        db.events.forEach(function (e) {
          if (e.date > today() || !inRange(e.date)) return;
          (e.attended || []).forEach(function (id) { if (rows[id]) { rows[id].attended += 1; total.attended += 1; } });
        });
        db.referralLogs.forEach(function (l) {
          if (!inRange(dateKey(l.at))) return;
          var g = rows[memberIdOfUser(db, l.fromUserId)];
          if (g) g.referrals += 1;
          if (rows[l.toMemberId]) rows[l.toMemberId].received += 1;
          total.referrals += 1;
        });
        // ありがとうマイル: to = 紹介した人(自分の紹介で相手が成約した分)/ from = 仕事を受けた人(メンバーの紹介で自分が成約できた分)
        db.thanks.forEach(function (t) {
          if (!inRange(dateKey(t.at))) return;
          if (rows[t.to]) rows[t.to].milesGiven += t.amount;
          if (rows[t.from]) rows[t.from].milesReceived += t.amount;
          total.miles += t.amount;
        });
        db.oneOnOnes.forEach(function (o) {
          if (o.status !== "done" || !inRange(o.date)) return;
          [o.a, o.b].forEach(function (id) { if (rows[id]) rows[id].oneOnOnes += 1; });
          total.oneOnOnes += 1;
        });
        // ビジター: 招待の URL から申し込み、参加が決まった方。同じ方は何回来ても1人
        var eventDate = {};
        db.events.forEach(function (e) { eventDate[e.id] = e.date; });
        var seenBy = {}, seenAll = {};
        db.visitors.forEach(function (v) {
          var d = eventDate[v.eventId];
          if (!d || !inRange(d) || VISITOR_COUNTED.indexOf(v.status) === -1) return;
          var person = BtexServerCore.normalizeName(v.name) + "|" + BtexServerCore.normalizeName(v.company);
          var r = rows[v.by];
          if (r && !seenBy[v.by + "|" + person]) {
            seenBy[v.by + "|" + person] = true;
            r.visitors += 1;
            if (v.kind === "link") r.visitorsLink += 1; else r.visitorsGeneral += 1;
            if (v.status === "joined") r.joined += 1;
          }
          if (!seenAll[person]) {
            seenAll[person] = true;
            total.visitors += 1;
            if (v.status === "joined") total.joined += 1;
          }
        });
        return { rows: rows, total: total };
      }
      // 日付("YYYY-MM-DD")を n 日ずらす
      function shiftDay(key, n) {
        var d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)) + n));
        return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
      }
      // くらべる前の期間: ひと月ちょうど(1日〜月末)なら前の月、それ以外は同じ日数だけ前
      function prevRange(from, to) {
        if (from.slice(8) === "01" && to === lastDay(to.slice(0, 7))) {
          var months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
          var pf = monthShift(from.slice(0, 7), -months);
          return { from: pf + "-01", to: lastDay(monthShift(to.slice(0, 7), -months)) };
        }
        var days = Math.round((Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10))) - Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)))) / 86400000) + 1;
        return { from: shiftDay(from, -days), to: shiftDay(from, -1) };
      }
      var MY_KEYS = ["attended", "referrals", "received", "oneOnOnes", "milesGiven", "milesReceived", "visitors", "joined"];
      function pickMine(r) {
        var o = {};
        MY_KEYS.forEach(function (k) { o[k] = r ? r[k] : 0; });
        return o;
      }
      function getStats(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var from = cleanDate(body.from), to = cleanDate(body.to);
        if (!from || !to) { from = today().slice(0, 8) + "01"; to = lastDay(today().slice(0, 7)); }
        if (from > to) { var tmp = from; from = to; to = tmp; }
        var cur = countRange(db, from, to);
        var rows = cur.rows, total = cur.total;
        var list = Object.keys(rows).map(function (k) { return rows[k]; });
        var sc = searchCounts(db, from, to);
        if (rows[w.id]) {
          rows[w.id].searchShown = (sc.m[w.id] || [0, 0])[0];
          rows[w.id].searchTop = (sc.m[w.id] || [0, 0])[1];
          rows[w.id].searchTotal = sc.n;
        }
        // 前の期間の自分の数字(前の期間とくらべた増減に使う)
        var pr = prevRange(from, to);
        var prev = pickMine(countRange(db, pr.from, pr.to).rows[w.id]);
        // 期間の終わりの月までの6か月の、自分の数字(月ごと)と、BT-EX5 全体のマイル
        var endYm = to.slice(0, 7);
        var series = [];
        for (var i = 5; i >= 0; i--) {
          var ym = monthShift(endYm, -i);
          var mr = countRange(db, ym + "-01", lastDay(ym));
          series.push(Object.assign({ ym: ym, allMiles: mr.total.miles }, pickMine(mr.rows[w.id])));
        }
        // この期間に自分が出した紹介の、いまの状況
        var mix = { new: 0, contacted: 0, meeting: 0, won: 0, lost: 0 };
        db.referralLogs.forEach(function (l) {
          if (memberIdOfUser(db, l.fromUserId) !== w.id || dateKey(l.at) < from || dateKey(l.at) > to) return;
          if (mix[l.status] !== undefined) mix[l.status] += 1;
        });
        return c.ok({
          from: from, to: to, today: today(),
          me: rows[w.id] || null,
          prev: prev, prevFrom: pr.from, prevTo: pr.to,
          series: series,
          refMix: mix,
          members: list.map(function (r) {
            return { id: r.id, name: r.name, isMe: r.id === w.id, attended: r.attended, referrals: r.referrals, miles: r.milesGiven, oneOnOnes: r.oneOnOnes, visitors: r.visitors };
          }),
          total: total,
        });
      }

      // ============================================
      // 検索の記録(だれが何回、検索結果に出たか)
      // 紹介診断・相談アシスタント・ジャンルで探す の結果に出た人を、日ごとに数える。
      // searchLog: { "YYYY-MM-DD": { n: 検索の回数, m: { メンバーID: [出た回数, 1位の回数] } } }(400日分)
      // 読み取れなかった相談は searchMisses(最新100件。管理者が言葉の辞書を足すのに使う)
      // ============================================
      var SEARCH_KINDS = ["diag", "consult", "genre"];
      function logSearch(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var kind = oneOf(body.kind, SEARCH_KINDS, "");
        if (!kind) return c.fail("INVALID_REQUEST");
        if (body.miss) {
          var text = c.cleanStr(body.text, 120);
          if (text) {
            db.searchMisses.push({ at: c.nowMs(), by: w.id, text: text });
            trim(db.searchMisses, 100);
          }
          c.saveDb(db);
          return c.ok({});
        }
        var ids = c.cleanList(body.shown, null, 10).filter(function (id) { return member(db, id); });
        var day = db.searchLog[today()] || (db.searchLog[today()] = { n: 0, m: {} });
        // 1人1日200回まで数える(押しすぎ・いたずらで数字がふくらまないように)
        day.u = day.u || {};
        day.u[w.id] = (day.u[w.id] || 0) + 1;
        if (day.u[w.id] > 200) return c.ok({ skipped: true });
        day.n += 1;
        ids.forEach(function (id, i) {
          var row = day.m[id] || (day.m[id] = [0, 0]);
          row[0] += 1;
          if (i === 0) row[1] += 1;
        });
        // 古い日を消す
        var keys = Object.keys(db.searchLog).sort();
        if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete db.searchLog[k]; });
        c.saveDb(db);
        return c.ok({});
      }
      // 期間の、メンバーごとの [出た回数, 1位の回数] と検索の回数
      function searchCounts(db, from, to) {
        var out = { n: 0, m: {} };
        Object.keys(db.searchLog || {}).forEach(function (k) {
          if (k < from || k > to) return;
          var d = db.searchLog[k];
          out.n += d.n || 0;
          Object.keys(d.m || {}).forEach(function (id) {
            var r = out.m[id] || (out.m[id] = [0, 0]);
            r[0] += d.m[id][0];
            r[1] += d.m[id][1];
          });
        });
        return out;
      }

      function getTeamRanking(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var t = today();
        var ym = t.slice(0, 7);
        var period = oneOf(body.period, ["month", "prev", "year", "all"], "month");
        var range = period === "month" ? [ym + "-01", t]
          : period === "prev" ? [monthShift(ym, -1) + "-01", lastDay(monthShift(ym, -1))]
          : period === "year" ? [t.slice(0, 4) + "-01-01", t] : ["2000-01-01", t];
        var rows = memberStats(db, range[0], range[1]);
        var members = rankRows(Object.keys(rows).map(function (k) { return rows[k]; }), "points");
        members.forEach(function (r) { r.isMe = r.id === w.id; });
        var total = { referrals: 0, won: 0, miles: 0, points: 0 };
        members.forEach(function (r) { total.referrals += r.referrals; total.won += r.won; total.miles += r.miles; total.points += r.points; });
        total.points = round1(total.points);

        // 自分の直近6か月(今月を含む)と、何か月つづけて紹介しているか
        var history = [];
        for (var i = 5; i >= 0; i--) {
          var mon = monthShift(ym, -i);
          var r1 = memberStats(db, mon + "-01", mon === ym ? t : lastDay(mon))[w.id] || {};
          history.push({ month: mon, referrals: r1.referrals || 0, miles: r1.miles || 0, points: r1.points || 0 });
        }
        var streak = 0;
        for (var j = 0; j < 24; j++) {
          var m2 = monthShift(ym, -j);
          var r2 = memberStats(db, m2 + "-01", m2 === ym ? t : lastDay(m2))[w.id];
          if (r2 && r2.referrals > 0) streak++;
          else if (j === 0) continue; // 今月まだなら先月から数える
          else break;
        }
        // 今月の BT-EX5 全体の目標
        var monthRows = period === "month" ? members : (function () {
          var mr = memberStats(db, ym + "-01", t);
          return Object.keys(mr).map(function (k) { return mr[k]; });
        })();
        var monthTotal = { referrals: 0, miles: 0 };
        monthRows.forEach(function (r) { monthTotal.referrals += r.referrals; monthTotal.miles += r.miles; });
        return c.ok({
          period: period, range: range, points: POINTS,
          members: members,
          me: members.filter(function (r) { return r.isMe; })[0] || null,
          total: total,
          goal: { target: communityGoal(db, members.length), referrals: monthTotal.referrals, miles: monthTotal.miles },
          history: history,
          streak: streak,
          canEditGoals: w.isAdmin,
        });
      }
      // 管理者: BT-EX5 全体の月の目標(紹介数・貢献金額)
      function adminSetTeamGoals(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var g = w.db.settings.teamGoals = w.db.settings.teamGoals || { default: {}, byTeam: {} };
        g.byTeam = g.byTeam || {};
        var goal = {
          referrals: Math.max(0, Math.min(999, Math.round(Number(body.referrals) || 0))),
          miles: Math.max(0, Math.min(1000000000, Math.round(Number(String(body.miles || "").replace(/[^\d]/g, "")) || 0))),
        };
        var team = c.cleanStr(body.team, 60);
        if (team) g.byTeam[team] = goal; else g.default = goal;
        c.saveDb(w.db);
        return c.ok({ goals: g });
      }

      // ============================================
      // 1on1(予定と記録)。メモは書いた本人だけが読める
      // ============================================
      // 30分きざみで5時間まで(45分は以前の記録のため残す)
      var DURATIONS = [30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300];
      function toMin(t) { var p = String(t || "").split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); }
      // 予定の時刻(時刻がなければその日)を過ぎた 1on1 は「確認待ち」。2人のどちらかが
      // 「実施した」と答えると実施になり、1on1 の回数に数える(「実施しなかった」なら中止)。
      // 以前は自動で実施にしていた(その記録は autoDone のまま残す)
      function autoComplete() { return false; }
      function awaitingConfirm(o) { return o.status === "planned" && c.nowMs() >= oneEndMs(o); }
      function endTime(o) {
        if (!o.time) return "";
        var m = toMin(o.time) + (o.duration || 60);
        return ("0" + Math.floor(m / 60) % 24).slice(-2) + ":" + ("0" + (m % 60)).slice(-2);
      }
      // 終わりが日付をまたぐ(例:22:30 から 4時間半 → 翌 3:00)とき、終わりの日付
      function endDate(o) {
        if (!o.time || toMin(o.time) + (o.duration || 60) < 24 * 60) return o.date;
        return dateKey(Date.parse(o.date + "T12:00:00+09:00") + DAY);
      }
      // 終わる時刻(時刻がなければその日の終わり)
      function oneEndMs(o) {
        var min = o.time ? toMin(o.time) + (o.duration || 60) : 24 * 60;
        return Date.parse(o.date + "T00:00:00+09:00") + min * 60000;
      }
      function oneView(db, o, me) {
        var other = o.a === me ? o.b : o.a;
        return {
          id: o.id, with: other, withName: nameOf(db, other), ext: db.extPeople && db.extPeople[other] ? "BT-EX" + db.extPeople[other].unit : "", date: o.date, time: o.time || "", end: endTime(o), endDate: endDate(o), duration: o.duration || 60,
          mode: o.mode || "onsite", place: o.place || "", meetUrl: o.meetUrl || "", calLink: o.calLink || "", synced: !!o.calId,
          status: o.status, autoDone: !!o.autoDone, awaiting: awaitingConfirm(o), confirmedByName: o.confirmedBy ? nameOf(db, o.confirmedBy) : "", note: (o.notes || {})[me] || "", next: (o.nexts || {})[me] || "", by: o.by, at: o.at,
        };
      }
      function userOf(db, memberId) { return c.find(db.users, function (u) { return u.memberId === memberId; }); }

      // Google カレンダーに予定を作る・直す・消す(共有サーバーでカレンダーを使えるときだけ)。
      // Google Meet を選んだときは Meet の会議も作り、2人のカレンダー用メールアドレスに招待を送る
      function syncCalendar(db, o, appUrl) {
        if (!c.calendar) return null;
        try {
          if (o.status === "cancelled") {
            if (o.calId) c.calendar.remove(o.calId);
            o.calId = ""; o.calLink = "";
            if (o.mode === "meet") o.meetUrl = "";
            return "removed";
          }
          if (o.status !== "planned") return null;
          var guests = [o.a, o.b].map(function (id) { var u = userOf(db, id); return u && u.calendarEmail; }).filter(Boolean);
          var r = c.calendar.upsert({
            id: o.calId || "",
            title: "1on1:" + nameOf(db, o.a) + " × " + nameOf(db, o.b) + "(BT-EX5)",
            date: o.date, start: o.time || "", end: endTime(o), endDate: endDate(o),
            meet: o.mode === "meet", location: o.mode === "meet" ? "" : o.place,
            description: "BT-EX5 の 1on1 です。" + (appUrl ? "\n会員サイト:" + appUrl : ""),
            guests: guests,
          });
          o.calId = r.id || o.calId || "";
          o.calLink = r.link || o.calLink || "";
          if (o.mode === "meet" && r.meetUrl) o.meetUrl = r.meetUrl;
          return "synced";
        } catch (err) {
          return "error";
        }
      }

      function list1on1(body) {
        var w = who(body);
        if (w.error) return w.error;
        var list = w.db.oneOnOnes
          .filter(function (o) { return o.a === w.id || o.b === w.id; })
          .sort(function (a, b) { return (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")); })
          .map(function (o) { return oneView(w.db, o, w.id); });
        return c.ok({ items: list, today: today(), calendar: !!c.calendar, hasCalendarEmail: !!w.user.calendarEmail });
      }
      function save1on1(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var o = body.id ? c.find(db.oneOnOnes, function (x) { return x.id === body.id && (x.a === w.id || x.b === w.id); }) : null;
        if (body.id && !o) return c.fail("NOT_FOUND");
        var date = cleanDate(body.date);
        if (!date) return c.fail("INVALID_REQUEST", "日付を入れてください。");
        if (!o) {
          var other = c.cleanStr(body.withMemberId, 40);
          // ほかの BT-EX のユニットの方: ユニットの番号(1〜14)とお名前で記録する(相手には届かず、自分の 1on1 として数える)
          var ext = body.ext && typeof body.ext === "object" ? body.ext : null;
          if (ext) {
            var unit = Math.round(Number(ext.unit));
            var extName = c.cleanStr(ext.name, 40);
            if (!(unit >= 1 && unit <= 14) || !extName) return c.fail("INVALID_REQUEST", "BT-EX の番号とお名前を入れてください。");
            if (!db.extPeople) db.extPeople = {};
            var known = Object.keys(db.extPeople).filter(function (k) { var p = db.extPeople[k]; return p.unit === unit && p.name === extName; })[0];
            other = known || ("x_" + c.randomHex(6));
            if (!known) db.extPeople[other] = { unit: unit, name: extName };
          } else if (!member(db, other) || other === w.id) return c.fail("INVALID_REQUEST", "相手を選んでください。");
          o = { id: newId("o_"), a: w.id, b: other, by: w.id, at: c.nowMs(), notes: {}, nexts: {} };
          db.oneOnOnes.push(o);
        }
        var before = JSON.stringify([o.date, o.time, o.duration, o.mode, o.place, o.status]);
        o.date = date;
        o.time = cleanTime(body.time);
        o.duration = DURATIONS.indexOf(Number(body.duration)) !== -1 ? Number(body.duration) : (o.duration || 60);
        o.mode = oneOf(body.mode, ["onsite", "meet"], o.mode || "onsite");
        o.place = o.mode === "meet" ? "Google Meet" : c.cleanStr(body.place, 80);
        // 共有サーバーで自動作成できないときは、自分で作った Meet の URL を入れられる
        var manualMeet = c.cleanStr(body.meetUrl, 200);
        if (o.mode === "meet" && /^https:\/\/meet\.google\.com\/[\w-]+$/.test(manualMeet)) o.meetUrl = manualMeet;
        if (o.mode !== "meet") o.meetUrl = "";
        var past = c.nowMs() >= oneEndMs(o);
        o.status = oneOf(body.status, ["planned", "done", "cancelled"], past ? "done" : "planned");
        if (o.status !== "done") { o.autoDone = false; }
        o.notes = o.notes || {};
        o.nexts = o.nexts || {};
        if ("note" in body) o.notes[w.id] = cleanText(body.note, 2000);
        if ("next" in body) o.nexts[w.id] = c.cleanStr(body.next, 200);
        var cal = null;
        var changedPlan = before !== JSON.stringify([o.date, o.time, o.duration, o.mode, o.place, o.status]);
        if (changedPlan || (o.status === "planned" && !o.calId)) cal = syncCalendar(db, o, c.cleanStr(body.appUrl, 300));
        c.saveDb(db);
        return c.ok({ item: oneView(db, o, w.id), calendar: cal });
      }
      // 時刻を過ぎた 1on1 に「実施した / 実施しなかった」と答える(2人のどちらでもよい)
      function confirm1on1(body) {
        var w = who(body);
        if (w.error) return w.error;
        var o = c.find(w.db.oneOnOnes, function (x) { return x.id === body.id && (x.a === w.id || x.b === w.id); });
        if (!o) return c.fail("NOT_FOUND");
        if (o.status !== "planned") return c.ok({ item: oneView(w.db, o, w.id), already: true });
        if (body.held === true) {
          o.status = "done";
          o.autoDone = false;
          o.doneAt = c.nowMs();
          o.confirmedBy = w.id;
        } else if (body.held === false) {
          o.status = "cancelled";
          o.confirmedBy = w.id;
          if (o.calId && c.calendar) syncCalendar(w.db, o, "");
        } else {
          return c.fail("INVALID_REQUEST");
        }
        c.saveDb(w.db);
        return c.ok({ item: oneView(w.db, o, w.id) });
      }

      function delete1on1(body) {
        var w = who(body);
        if (w.error) return w.error;
        var o = c.find(w.db.oneOnOnes, function (x) { return x.id === body.id && (x.a === w.id || x.b === w.id); });
        if (!o) return c.fail("NOT_FOUND");
        if (o.calId && c.calendar) { try { c.calendar.remove(o.calId); } catch (err) { /* 予定が消せなくても記録は消す */ } }
        w.db.oneOnOnes = w.db.oneOnOnes.filter(function (x) { return x.id !== o.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // 自分だけの設定(Google カレンダーの招待を受け取るメールアドレス)。ほかの会員には返さない
      // ホームの「〇〇さんへの紹介が N 日そのままです」を、紹介した本人が消す・あとにする
      //   mode: "done"(もう終わった・表示を消す)/ "later"(声をかけた。7日あとにまた知らせる)
      function muteReferralNudge(body) {
        var w = who(body);
        if (w.error) return w.error;
        var id = c.cleanStr(body.id, 40);
        var l = c.find(w.db.referralLogs, function (x) { return x.id === id; });
        if (!l || memberIdOfUser(w.db, l.fromUserId) !== w.id) return c.fail("NOT_FOUND");
        if (body.mode === "done") l.giverDone = true;
        else if (body.mode === "later") l.giverSnoozeUntil = c.nowMs() + 7 * DAY;
        else return c.fail("INVALID_REQUEST");
        c.saveDb(w.db);
        return c.ok({ id: l.id });
      }
      function getMySettings(body) {
        var w = who(body);
        if (w.error) return w.error;
        return c.ok({ calendarEmail: w.user.calendarEmail || "", calendar: !!c.calendar, meetName: w.user.meetName || "", name: w.me.name, goals: w.user.goals || null, pitchScript: w.user.pitchScript || "", notifyOff: w.user.notifyOff || [], line: lineState(w.user) });
      }
      function updateMySettings(body) {
        var w = who(body);
        if (w.error) return w.error;
        if ("calendarEmail" in body) {
          var email = c.cleanStr(body.calendarEmail, 120).toLowerCase();
          if (email && !/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email)) return c.fail("INVALID_REQUEST", "メールアドレスの形を確認してください。");
          w.user.calendarEmail = email;
        }
        if ("meetName" in body) w.user.meetName = c.cleanStr(body.meetName, 60);
        // 今月の目標(紹介・成約・1on1・ビジター。0 は目標なし)
        if (body.goals && typeof body.goals === "object") {
          var g = {};
          ["given", "won", "oneOnOnes", "visitors"].forEach(function (k) { var n = Math.round(Number(body.goals[k]) || 0); g[k] = Math.max(0, Math.min(99, n)); });
          w.user.goals = g;
        }
        // スマホに通知しない種類
        if (Array.isArray(body.notifyOff)) w.user.notifyOff = body.notifyOff.filter(function (g, i, a) { return PUSH_GROUPS[g] && a.indexOf(g) === i; });
        // 30秒プレゼンの原稿(本人だけが見る)
        if ("pitchScript" in body) w.user.pitchScript = cleanText(body.pitchScript, 2000);
        c.saveDb(w.db);
        return c.ok({ calendarEmail: w.user.calendarEmail || "", meetName: w.user.meetName || "", goals: w.user.goals || null, pitchScript: w.user.pitchScript || "", notifyOff: w.user.notifyOff || [] });
      }

      // ============================================
      // 運営連絡
      // ============================================
      function annView(w, a) {
        var v = { id: a.id, title: a.title, body: a.body, cat: a.cat, pinned: !!a.pinned, at: a.at, byName: a.byName || "運営", read: (a.readBy || []).indexOf(w.id) !== -1 };
        if (w.isAdmin) {
          v.readCount = (a.readBy || []).length;
          v.memberCount = (w.db.referralMembers || []).length;
          v.unreadNames = (w.db.referralMembers || []).filter(function (m) { return (a.readBy || []).indexOf(m.id) === -1; }).map(function (m) { return m.name; });
        }
        return v;
      }
      function listAnnouncements(body) {
        var w = who(body);
        if (w.error) return w.error;
        var list = w.db.announcements.slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at; });
        return c.ok({ items: list.map(function (a) { return annView(w, a); }), cats: ANNOUNCE_CATS });
      }
      function markAnnouncementsRead(body) {
        var w = who(body);
        if (w.error) return w.error;
        var ids = Array.isArray(body.ids) ? body.ids : null;
        var changed = false;
        w.db.announcements.forEach(function (a) {
          if (ids && ids.indexOf(a.id) === -1) return;
          a.readBy = a.readBy || [];
          if (a.readBy.indexOf(w.id) === -1) { a.readBy.push(w.id); changed = true; }
        });
        if (changed) c.saveDb(w.db);
        return c.ok({});
      }
      // まだ読んでいない人に、もう一度お知らせする(ベルとスマホ。通知の種類「運営連絡」を切っている人には送らない)。
      // 同じ運営連絡では6時間に1回まで
      function adminRemindAnnouncement(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var a = c.find(w.db.announcements, function (x) { return x.id === c.cleanStr(body.id, 40); });
        if (!a) return c.fail("NOT_FOUND");
        a.reminders = a.reminders || [];
        var last = a.reminders[a.reminders.length - 1];
        if (last && c.nowMs() - last.at < 6 * 60 * 60 * 1000) return c.fail("RATE_LIMITED", "この運営連絡は、さきほどお知らせしたばかりです。6時間あけてからにしてください。");
        var to = (w.db.referralMembers || []).filter(function (m) { return (a.readBy || []).indexOf(m.id) === -1 && m.id !== w.id; }).map(function (m) { return m.id; });
        if (!to.length) return c.fail("INVALID_REQUEST", "全員が読んでいます。");
        a.reminders.push({ at: c.nowMs(), to: to });
        if (a.reminders.length > 10) a.reminders = a.reminders.slice(-10);
        c.saveDb(w.db);
        return c.ok({ count: to.length });
      }

      function adminSaveAnnouncement(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var input = body.item || {};
        var title = c.cleanStr(input.title, 100);
        if (!title) return c.fail("INVALID_REQUEST", "件名を入れてください。");
        var a = c.find(w.db.announcements, function (x) { return x.id === input.id; });
        if (!a) {
          a = { id: newId("a_"), at: c.nowMs(), readBy: [], by: w.id, byName: w.me.name };
          w.db.announcements.push(a);
          trim(w.db.announcements, LIMITS.announcements);
        }
        a.title = title;
        a.body = cleanText(input.body, 4000);
        a.cat = oneOf(input.cat, ANNOUNCE_CATS, "お知らせ");
        a.pinned = input.pinned === true;
        // 書いた人は既読
        if (a.readBy.indexOf(w.id) === -1) a.readBy.push(w.id);
        c.saveDb(w.db);
        return c.ok({ item: annView(w, a) });
      }
      function adminDeleteAnnouncement(body) {
        var w = admin(body);
        if (w.error) return w.error;
        w.db.announcements = w.db.announcements.filter(function (a) { return a.id !== body.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // ============================================
      // 掲示板
      // ============================================
      function postView(w, p) {
        return {
          id: p.id, by: p.by, byName: nameOf(w.db, p.by), cat: p.cat, body: p.body, at: p.at,
          likes: (p.likes || []).length, liked: (p.likes || []).indexOf(w.id) !== -1,
          canDelete: p.by === w.id || w.isAdmin, canEdit: p.by === w.id, editedAt: p.editedAt || 0,
          comments: (p.comments || []).map(function (cm) {
            return { id: cm.id, by: cm.by, byName: nameOf(w.db, cm.by), body: cm.body, at: cm.at, canDelete: cm.by === w.id || w.isAdmin, canEdit: cm.by === w.id, edited: !!cm.editedAt };
          }),
        };
      }
      // ============================================
      // やること(担当者・期限つき)。管理者はだれにでも、メンバーは自分に割り当てられる。
      // 定例会の議事録から作ると、その定例会にひもづく
      // ============================================
      function taskView(db, t, me) {
        var done = t.done || {};
        return {
          id: t.id, title: t.title, note: t.note || "", due: t.due || "", time: t.time || "", private: !!t.private, eventId: t.eventId || "",
          eventTitle: (function () { var e = t.eventId && c.find(db.events, function (x) { return x.id === t.eventId; }); return e ? e.date.slice(5).replace("-", "/") + " " + e.title : ""; })(),
          by: t.by, byName: nameOf(db, t.by), at: t.at,
          assignees: t.assignees.map(function (id) { return { id: id, name: nameOf(db, id), done: !!done[id] }; }),
          mine: t.assignees.indexOf(me) !== -1, myDone: !!done[me], doneCount: t.assignees.filter(function (id) { return done[id]; }).length,
          canEdit: t.by === me,
        };
      }
      function listTasks(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var list = db.tasks.filter(function (t) {
          if (t.private && t.by !== w.id) return false;
          if (body.eventId) return t.eventId === body.eventId;
          return t.assignees.indexOf(w.id) !== -1 || t.by === w.id;
        });
        list.sort(function (a, b) { return (a.due || "9999").localeCompare(b.due || "9999") || a.at - b.at; });
        return c.ok({ items: list.map(function (t) { return taskView(db, t, w.id); }), today: today() });
      }
      function saveTask(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var input = body.item || {};
        var title = c.cleanStr(input.title, 100);
        if (!title) return c.fail("INVALID_REQUEST", "やることを入れてください。");
        var assignees = c.cleanList(input.assignees, null, 40).filter(function (id) { return member(db, id); });
        if (!w.isAdmin) assignees = assignees.filter(function (id) { return id === w.id; });
        if (!assignees.length) assignees = [w.id];
        var t = input.id ? c.find(db.tasks, function (x) { return x.id === input.id; }) : null;
        // 自分だけのやることは、書いた本人しか直せない(管理者も)
        if (input.id && (!t || (t.by !== w.id && (!w.isAdmin || t.private)))) return c.fail("NOT_FOUND");
        if (!t) {
          t = { id: newId("t_"), by: w.id, at: c.nowMs(), done: {} };
          db.tasks.push(t);
          trim(db.tasks, 1000);
        }
        t.title = title;
        t.note = cleanText(input.note, 500);
        t.due = cleanDate(input.due);
        t.time = t.due ? cleanTime(input.time) : "";
        var ev = input.eventId && c.find(db.events, function (x) { return x.id === input.eventId; });
        t.eventId = ev ? ev.id : (t.eventId || "");
        // 自分だけのやること: 担当は自分だけ、定例会にもつなげない(ほかの人・運営には見えない)
        t.private = input.private === true && !t.eventId;
        t.assignees = t.private ? [w.id] : assignees;
        c.saveDb(db);
        return c.ok({ item: taskView(db, t, w.id) });
      }
      function toggleTask(body) {
        var w = who(body);
        if (w.error) return w.error;
        var t = c.find(w.db.tasks, function (x) { return x.id === body.id; });
        if (!t || t.assignees.indexOf(w.id) === -1) return c.fail("NOT_FOUND");
        t.done = t.done || {};
        if (body.done === true) t.done[w.id] = c.nowMs(); else delete t.done[w.id];
        c.saveDb(w.db);
        return c.ok({ item: taskView(w.db, t, w.id) });
      }
      function deleteTask(body) {
        var w = who(body);
        if (w.error) return w.error;
        var t = c.find(w.db.tasks, function (x) { return x.id === body.id; });
        if (!t || (t.by !== w.id && (!w.isAdmin || t.private))) return c.fail("NOT_FOUND");
        w.db.tasks = w.db.tasks.filter(function (x) { return x.id !== t.id; });
        c.saveDb(w.db);
        return c.ok({});
      }

      // 自分のコメントを直す
      function editComment(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.postId; });
        var cm = p && c.find(p.comments || [], function (x) { return x.id === body.id; });
        if (!cm || cm.by !== w.id) return c.fail("NOT_FOUND");
        var text = c.cleanStr(body.body, 1000);
        if (!text) return c.fail("INVALID_REQUEST", "コメントを入れてください。");
        cm.body = text;
        cm.editedAt = c.nowMs();
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }

      // 自分の投稿を直す(種類と本文)
      function editPost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.id; });
        if (!p || p.by !== w.id) return c.fail("NOT_FOUND");
        var text = cleanText(body.body, 2000);
        if (!text) return c.fail("INVALID_REQUEST", "本文を入れてください。");
        p.body = text;
        p.cat = oneOf(body.cat === "雑談" ? "告知" : body.cat, BOARD_CATS, p.cat);
        p.editedAt = c.nowMs();
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }
      function listBoard(body) {
        var w = who(body);
        if (w.error) return w.error;
        var s = seen(w.db, w.id);
        var lastSeen = s.board || 0;
        var items = w.db.posts.slice().reverse().map(function (p) {
          var v = postView(w, p);
          v.isNew = p.by !== w.id && p.at > lastSeen;
          return v;
        });
        if (body.markSeen !== false) { s.board = c.nowMs(); c.saveDb(w.db); }
        return c.ok({ items: items, cats: BOARD_CATS });
      }
      function createPost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var text = cleanText(body.body, 2000);
        if (!text) return c.fail("INVALID_REQUEST", "本文を入れてください。");
        var p = { id: newId("p_"), by: w.id, cat: oneOf(body.cat === "雑談" ? "告知" : body.cat, BOARD_CATS, "告知"), body: text, at: c.nowMs(), likes: [], comments: [] };
        w.db.posts.push(p);
        trim(w.db.posts, LIMITS.posts);
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }
      function deletePost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.id; });
        if (!p || (p.by !== w.id && !w.isAdmin)) return c.fail("NOT_FOUND");
        w.db.posts = w.db.posts.filter(function (x) { return x.id !== p.id; });
        c.saveDb(w.db);
        return c.ok({});
      }
      function commentPost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.postId; });
        if (!p) return c.fail("NOT_FOUND");
        var text = cleanText(body.body, 1000);
        if (!text) return c.fail("INVALID_REQUEST", "コメントを入れてください。");
        p.comments = p.comments || [];
        p.comments.push({ id: newId("c_"), by: w.id, body: text, at: c.nowMs() });
        trim(p.comments, LIMITS.comments);
        p.activeAt = c.nowMs();
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }
      function deleteComment(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.postId; });
        var cm = p && c.find(p.comments || [], function (x) { return x.id === body.id; });
        if (!cm || (cm.by !== w.id && !w.isAdmin)) return c.fail("NOT_FOUND");
        p.comments = p.comments.filter(function (x) { return x.id !== cm.id; });
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }
      function likePost(body) {
        var w = who(body);
        if (w.error) return w.error;
        var p = c.find(w.db.posts, function (x) { return x.id === body.id; });
        if (!p) return c.fail("NOT_FOUND");
        p.likes = p.likes || [];
        var i = p.likes.indexOf(w.id);
        if (i === -1) p.likes.push(w.id); else p.likes.splice(i, 1);
        c.saveDb(w.db);
        return c.ok({ item: postView(w, p) });
      }

      // ============================================
      // バグ・要望
      // ============================================
      function fbView(db, f, full) {
        var v = { id: f.id, kind: f.kind, body: f.body, at: f.at, status: f.status, reply: f.reply || "", replyAt: f.replyAt || 0 };
        if (full) { v.by = f.by; v.byName = nameOf(db, f.by); v.page = f.page || ""; }
        return v;
      }
      function sendFeedback(body) {
        var w = who(body);
        if (w.error) return w.error;
        var text = cleanText(body.body, 2000);
        if (!text) return c.fail("INVALID_REQUEST", "内容を入れてください。");
        var f = { id: newId("f_"), by: w.id, kind: oneOf(body.kind, FEEDBACK_KINDS, "other"), body: text, page: c.cleanStr(body.page, 120), at: c.nowMs(), status: "new" };
        w.db.feedback.push(f);
        trim(w.db.feedback, LIMITS.feedback);
        c.saveDb(w.db);
        return c.ok({ item: fbView(w.db, f) });
      }
      function listMyFeedback(body) {
        var w = who(body);
        if (w.error) return w.error;
        return c.ok({ items: w.db.feedback.filter(function (f) { return f.by === w.id; }).reverse().map(function (f) { return fbView(w.db, f); }) });
      }
      function adminListFeedback(body) {
        var w = admin(body);
        if (w.error) return w.error;
        return c.ok({ items: w.db.feedback.slice().reverse().map(function (f) { return fbView(w.db, f, true); }) });
      }
      function adminUpdateFeedback(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var f = c.find(w.db.feedback, function (x) { return x.id === body.id; });
        if (!f) return c.fail("NOT_FOUND");
        f.status = oneOf(body.status, FEEDBACK_STATUSES, f.status);
        if ("reply" in body) { f.reply = cleanText(body.reply, 1000); f.replyAt = c.nowMs(); }
        c.saveDb(w.db);
        return c.ok({ item: fbView(w.db, f, true) });
      }

      // ============================================
      // 運営ダッシュボード(管理者): 月ごとの数字・動きの少ない人・定例会ごとの出席
      // ============================================
      function adminDashboard(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var db = w.db;
        var month = /^\d{4}-\d{2}$/.test(String(body.month || "")) ? body.month : today().slice(0, 7);
        var prev = (function () {
          var y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)) - 1;
          if (m === 0) { y -= 1; m = 12; }
          return y + "-" + ("0" + m).slice(-2);
        })();
        function totals(mon) {
          var inMon = function (ms) { return monthKey(ms) === mon; };
          return {
            referrals: db.referralLogs.filter(function (l) { return inMon(l.at); }).length,
            won: db.referralLogs.filter(function (l) { return l.status === "won" && inMon(l.statusAt || l.at); }).length,
            miles: db.thanks.filter(function (t) { return inMon(t.at); }).reduce(function (s2, t) { return s2 + t.amount; }, 0),
            oneOnOnes: db.oneOnOnes.filter(function (o) { return o.status === "done" && o.date.slice(0, 7) === mon; }).length,
            visitors: db.visitors.filter(function (v) { var e = c.find(db.events, function (x) { return x.id === v.eventId; }); return e && e.date.slice(0, 7) === mon && v.status !== "invited" && v.status !== "declined"; }).length,
            posts: db.posts.filter(function (p) { return inMon(p.at); }).length,
          };
        }
        var monthEvents = db.events.filter(function (e) { return e.date.slice(0, 7) === month; })
          .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
          .map(function (e) {
            var rs = e.rsvps || {};
            return {
              id: e.id, title: e.title, date: e.date,
              yes: Object.keys(rs).filter(function (k) { return rs[k] === "yes"; }).length,
              no: Object.keys(rs).filter(function (k) { return rs[k] === "no"; }).length,
              attended: (e.attended || []).length,
              late: (e.late || []).length,
              visitors: db.visitors.filter(function (v) { return v.eventId === e.id && (v.status === "applied" || v.status === "attended" || v.status === "joined"); }).length,
            };
          });
        var members = (db.referralMembers || []).map(function (m) {
          var u = c.find(db.users, function (x) { return x.memberId === m.id; });
          var gave = db.referralLogs.filter(function (l) { return memberIdOfUser(db, l.fromUserId) === m.id; });
          var lastAct = 0;
          gave.forEach(function (l) { lastAct = Math.max(lastAct, l.at); });
          db.oneOnOnes.forEach(function (o) { if (o.a === m.id || o.b === m.id) lastAct = Math.max(lastAct, o.at); });
          db.posts.forEach(function (p) { if (p.by === m.id) lastAct = Math.max(lastAct, p.at); });
          var pastEvents = db.events.filter(function (e) { return e.date < today() && e.date >= dateKey(c.nowMs() - 120 * DAY); });
          var att = pastEvents.filter(function (e) { return (e.attended || []).indexOf(m.id) !== -1; }).length;
          return {
            id: m.id, name: m.name, team: m.team || "",
            lastLoginAt: (u && u.lastLoginAt) || 0,
            account: u && u.pw ? "active" : "none",
            monthGiven: gave.filter(function (l) { return monthKey(l.at) === month; }).length,
            monthReceived: db.referralLogs.filter(function (l) { return l.toMemberId === m.id && monthKey(l.at) === month; }).length,
            monthMiles: db.thanks.filter(function (t) { return t.to === m.id && monthKey(t.at) === month; }).reduce(function (s2, t) { return s2 + t.amount; }, 0),
            monthOnes: db.oneOnOnes.filter(function (o) { return (o.a === m.id || o.b === m.id) && o.status === "done" && o.date.slice(0, 7) === month; }).length,
            attendRate: pastEvents.length ? Math.round((att / pastEvents.length) * 100) : null,
            lastActivityAt: lastAct,
          };
        });
        var sc = searchCounts(db, month + "-01", month + "-31");
        // やることの進み具合(終わっていないもの)
        var openTasks = db.tasks.filter(function (t) { return !t.private && t.assignees.some(function (id) { return !(t.done || {})[id]; }); });
        members.forEach(function (row) {
          var mine = openTasks.filter(function (t) { return t.assignees.indexOf(row.id) !== -1 && !(t.done || {})[row.id]; });
          row.openTasks = mine.length;
          row.overdueTasks = mine.filter(function (t) { return t.due && t.due < today(); }).length;
        });
        members.forEach(function (row) {
          var m = member(db, row.id);
          row.topicCount = m && Array.isArray(m.topics) ? m.topics.length : 0;
          row.searchShown = (sc.m[row.id] || [0, 0])[0];
          row.searchTop = (sc.m[row.id] || [0, 0])[1];
        });
        return c.ok({
          month: month, prevMonth: prev, totals: totals(month), prevTotals: totals(prev), events: monthEvents, members: members, now: c.nowMs(),
          tasks: openTasks.sort(function (a, b) { return (a.due || "9999").localeCompare(b.due || "9999"); }).slice(0, 30).map(function (t) {
            var v = taskView(db, t, w.id);
            return { id: v.id, title: v.title, due: v.due, eventTitle: v.eventTitle, byName: v.byName, doneCount: v.doneCount, total: v.assignees.length,
              notDone: v.assignees.filter(function (a) { return !a.done; }).map(function (a) { return a.name; }) };
          }),
          search: { total: sc.n, misses: db.searchMisses.slice(-20).reverse().map(function (x) { return { at: x.at, text: x.text, byName: nameOf(db, x.by) }; }) },
        });
      }

      // データの書き出し(管理者)。紹介した相手の連絡先は当事者だけのものなので含めない
      function adminExport(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var db = w.db;
        var kind = oneOf(body.kind, ["referrals", "thanks", "attendance", "visitors", "oneOnOnes"], "referrals");
        var rows = [];
        if (kind === "referrals") {
          rows.push(["日時", "紹介した人", "紹介先", "紹介した方", "相談内容", "状況"]);
          db.referralLogs.forEach(function (l) {
            var g = memberIdOfUser(db, l.fromUserId);
            rows.push([l.at, nameOf(db, g), nameOf(db, l.toMemberId), l.prospect, l.memo || "", l.status]);
          });
        } else if (kind === "thanks") {
          rows.push(["日時", "お礼をした人", "紹介してくれた人", "金額(円)", "メッセージ"]);
          db.thanks.forEach(function (t) { rows.push([t.at, nameOf(db, t.from), nameOf(db, t.to), t.amount, t.message]); });
        } else if (kind === "attendance") {
          rows.push(["日付", "定例会", "氏名", "チーム", "出欠の回答", "出席"]);
          db.events.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (e) {
            (db.referralMembers || []).forEach(function (m) {
              rows.push([e.date, e.title, m.name, m.team || "", (e.rsvps || {})[m.id] || "", (e.attended || []).indexOf(m.id) !== -1 ? "出席" : ""]);
            });
          });
        } else if (kind === "visitors") {
          rows.push(["招待した日", "招待した人", "定例会", "お名前", "会社名", "事業内容", "連絡先", "ひとこと", "状況"]);
          db.visitors.forEach(function (v) {
            var e = c.find(db.events, function (x) { return x.id === v.eventId; });
            rows.push([v.at, nameOf(db, v.by), e ? e.date + " " + e.title : "", v.name, v.company, v.business, v.contact, v.message, v.status]);
          });
        } else {
          rows.push(["日付", "時刻", "メンバー", "相手", "場所", "状況"]);
          db.oneOnOnes.forEach(function (o) { rows.push([o.date, o.time || "", nameOf(db, o.a), nameOf(db, o.b), o.place || "", o.status]); });
        }
        return c.ok({ kind: kind, rows: rows });
      }

      // ============================================
      // お知らせ(自分に関係する出来事)。保存はせず、記録から毎回組み立てる
      // ============================================
      // 「@名前」で呼ばれたか(フルネーム・空白なし・名字だけ。名字だけは同じ名字の人がいないときだけ。全角の＠も)
      function mentions(db, me, text) {
        var t = String(text || "").replace(/＠/g, "@");
        if (t.indexOf("@") === -1) return false;
        var m = member(db, me);
        if (!m || !m.name) return false;
        var full = String(m.name).trim(), flat = full.replace(/\s+/g, ""), fam = full.split(/\s+/)[0];
        var famUnique = fam && fam !== full && (db.referralMembers || []).filter(function (x) { return String(x.name || "").split(/\s+/)[0] === fam; }).length === 1;
        return t.indexOf("@" + full) !== -1 || t.indexOf("@" + flat) !== -1 || (famUnique && t.indexOf("@" + fam) !== -1);
      }
      function activityItems(db, me) {
        var items = [];
        db.referralLogs.forEach(function (l) {
          var giver = memberIdOfUser(db, l.fromUserId);
          if (l.toMemberId === me && giver !== me) {
            items.push({ type: "refIn", at: l.at, who: giver, whoName: nameOf(db, giver), text: l.prospect || "", link: "log/ref" });
          }
          // もうすぐ始まる紹介の顔合わせ(3時間前から。紹介した人・受けた人の両方)
          if (l.meeting && l.status !== "lost" && (giver === me || l.toMemberId === me) && startsSoon(l.meeting.date, l.meeting.time)) {
            var other = giver === me ? l.toMemberId : giver;
            items.push({ type: "refMeetSoon", at: startMs(l.meeting.date, l.meeting.time) - SOON, who: other, whoName: nameOf(db, other), text: l.prospect || "", date: l.meeting.date, time: l.meeting.time, meetUrl: l.meeting.meetUrl || "", link: "log/ref" });
          }
          // 紹介の顔合わせの予定(相手が決めた・直したとき)
          if (l.meeting && l.meeting.setBy && l.meeting.setBy !== me && (giver === me || l.toMemberId === me)) {
            items.push({ type: "refMeet", at: l.meeting.setAt, who: l.meeting.setBy, whoName: nameOf(db, l.meeting.setBy), text: l.prospect || "", date: l.meeting.date, link: "log/ref" });
          }
          if (giver === me && l.statusAt && l.status !== "new") {
            items.push({ type: "refStatus", at: l.statusAt, who: l.toMemberId, whoName: nameOf(db, l.toMemberId), status: l.status, text: l.prospect || "", link: "log/ref" });
          }
        });
        db.thanks.forEach(function (t) {
          if (t.to === me) items.push({ type: "thanks", at: t.at, who: t.from, whoName: nameOf(db, t.from), amount: t.amount, text: t.message || "", link: "log/miles" });
        });
        db.posts.forEach(function (p) {
          // 掲示板の新しい投稿(自分以外)
          if (p.by !== me) items.push({ type: "post", at: p.at, who: p.by, whoName: nameOf(db, p.by), text: String(p.body).replace(/\s+/g, " ").slice(0, 60), cat: p.cat, link: "board" });
          if (p.by !== me && mentions(db, me, p.body)) items.push({ type: "mention", at: p.at + 1, who: p.by, whoName: nameOf(db, p.by), text: String(p.body).replace(/\s+/g, " ").slice(0, 60), link: "board?post=" + p.id });
          (p.comments || []).forEach(function (cm) {
            if (cm.by === me) return;
            if (mentions(db, me, cm.body)) { items.push({ type: "mention", at: cm.at + 1, who: cm.by, whoName: nameOf(db, cm.by), text: String(cm.body).slice(0, 60), link: "board?post=" + p.id }); return; }
            var mine = p.by === me;
            var joined = !mine && (p.comments || []).some(function (x) { return x.by === me && x.at < cm.at; });
            if (mine || joined) items.push({ type: mine ? "comment" : "reply", at: cm.at, who: cm.by, whoName: nameOf(db, cm.by), text: cm.body.slice(0, 60), link: "board" });
          });
        });
        db.oneOnOnes.forEach(function (o) {
          if ((o.a === me || o.b === me) && o.by !== me) items.push({ type: "oneNew", at: o.at, who: o.by, whoName: nameOf(db, o.by), date: o.date, link: "log/1on1" });
          // もうすぐ始まる 1on1(3時間前から)
          if ((o.a === me || o.b === me) && o.status === "planned" && startsSoon(o.date, o.time)) {
            var withId = o.a === me ? o.b : o.a;
            items.push({ type: "oneSoon", at: startMs(o.date, o.time) - SOON, who: withId, whoName: nameOf(db, withId), date: o.date, time: o.time, meetUrl: o.meetUrl || "", link: "log/1on1" });
          }
          // 時刻を過ぎた 1on1: 実施したかの確認
          if ((o.a === me || o.b === me) && awaitingConfirm(o)) {
            var other = o.a === me ? o.b : o.a;
            items.push({ type: "oneAsk", at: oneEndMs(o), who: other, whoName: nameOf(db, other), date: o.date, link: "log/1on1?confirm=" + o.id });
          }
        });
        db.visitors.forEach(function (v) {
          if (v.by === me && v.appliedAt) items.push({ type: "visitor", at: v.appliedAt, text: v.name, link: "events" });
        });
        // やること: 人から割り当てられた/期限が明日・今日でまだ
        db.tasks.forEach(function (tk) {
          if (tk.assignees.indexOf(me) === -1 || (tk.done || {})[me]) return;
          if (tk.by !== me) items.push({ type: "taskNew", at: tk.at, who: tk.by, whoName: nameOf(db, tk.by), text: tk.title, date: tk.due || "", link: "home" });
          if (tk.due) {
            var remind = Date.parse(tk.due + "T09:00:00+09:00") - DAY;
            if (c.nowMs() >= remind && tk.due >= today()) items.push({ type: "taskDue", at: remind, text: tk.title, date: tk.due, link: "home" });
            // 時刻つきのやることは、その時刻の少し前(1on1 と同じく3時間前から)にもお知らせ
            if (tk.time) {
              var s0 = startMs(tk.due, tk.time);
              if (s0 !== null && c.nowMs() >= s0 - SOON && c.nowMs() < s0) items.push({ type: "taskSoon", at: s0 - SOON, text: tk.title, date: tk.due, time: tk.time, link: "home" });
            }
          }
        });
        db.announcements.forEach(function (a) {
          items.push({ type: "ann", at: a.at, text: a.title, link: "news?open=" + a.id });
          // 運営からの「まだ読んでいない方へ」(まだ読んでいなければ)
          (a.reminders || []).forEach(function (r) {
            if (r.to.indexOf(me) !== -1 && (a.readBy || []).indexOf(me) === -1) items.push({ type: "annRemind", at: r.at, text: a.title, link: "news?open=" + a.id });
          });
        });
        db.events.forEach(function (e) {
          if (e.createdAt && e.date >= today()) items.push({ type: "event", at: e.createdAt, text: e.title, date: e.date, link: "events" });
          // 2日前になっても出欠がまだ → 確認(スマホにも通知)
          if (eventSoon(e) && !(e.rsvps || {})[me]) items.push({ type: "rsvpSoon", at: eventStartMs(e) - 2 * DAY, text: e.title, date: e.date, link: "events/detail/" + e.id });
        });
        var from = c.nowMs() - 60 * DAY;
        return items.filter(function (x) { return x.at >= from; }).sort(function (a, b) { return b.at - a.at; });
      }

      function getActivity(body) {
        var w = who(body);
        if (w.error) return w.error;
        var s = seen(w.db, w.id);
        var lastSeen = s.feed || 0;
        var items = activityItems(w.db, w.id).slice(0, 50).map(function (x) { x.isNew = x.at > lastSeen; return x; });
        if (body.markSeen !== false) { s.feed = c.nowMs(); c.saveDb(w.db); }
        return c.ok({ items: items });
      }

      // ============================================
      // ホーム: 1回の通信で、やること・未読・予定・数字をまとめて返す
      // ============================================
      // BT-EX5 シグナル(直近6か月の、自分の活動の信号。本人にだけ返す)
      // 参加(出席・1on1)と、価値の提供(紹介・ありがとうマイル・ビジター)を 100点で見る。緑 70〜・黄 50〜・赤 30〜・灰 〜29
      var SIGNAL_RULES = [
        { key: "attend", label: "定例会の出席", unit: "%", steps: [[90, 20], [75, 15], [50, 10], [0.01, 5]], tip: "定例会に出席する" },
        { key: "ones", label: "1on1", unit: "回/月", steps: [[2, 20], [1, 15], [0.5, 10], [0.01, 5]], tip: "1on1 をする", count: "回" },
        { key: "given", label: "出した紹介", unit: "件/月", steps: [[2, 25], [1, 20], [0.5, 12], [0.01, 6]], tip: "紹介を記録する", count: "件" },
        { key: "miles", label: "紹介からの売上", unit: "円", steps: [[1000000, 15], [300000, 10], [1, 5]], tip: "紹介が成約したら、お礼(ありがとうマイル)の記録をお願いする" },
        { key: "visitors", label: "ビジター招待", unit: "人", steps: [[3, 20], [2, 15], [1, 10]], tip: "ビジターを招待する", count: "人" },
      ];
      function signalOf(db, memberId) {
        var since = c.nowMs() - 182 * DAY;
        var t = today();
        var sinceDate = dateKey(since);
        var held = db.events.filter(function (e) { return e.date >= sinceDate && e.date <= t; });
        var attended = held.filter(function (e) { return (e.attended || []).indexOf(memberId) !== -1; }).length;
        var vals = {
          attend: held.length ? Math.round((attended / held.length) * 100) : 100,
          ones: Math.round((db.oneOnOnes.filter(function (o) { return o.status === "done" && (o.a === memberId || o.b === memberId) && o.date >= sinceDate; }).length / 6) * 10) / 10,
          given: Math.round((db.referralLogs.filter(function (l) { return memberIdOfUser(db, l.fromUserId) === memberId && l.at >= since; }).length / 6) * 10) / 10,
          miles: db.thanks.filter(function (x) { return x.to === memberId && x.at >= since; }).reduce(function (sum, x) { return sum + x.amount; }, 0),
          visitors: db.visitors.filter(function (v) { return v.by === memberId && v.at >= since && v.status !== "declined" && v.status !== "invited"; }).length,
        };
        var total = 0;
        var items = SIGNAL_RULES.map(function (r) {
          var v = vals[r.key], pt = 0, next = null;
          for (var i = 0; i < r.steps.length; i++) { if (v >= r.steps[i][0]) { pt = r.steps[i][1]; break; } }
          // 次の段まであといくつ(いちばん上ならなし)
          for (var j = r.steps.length - 1; j >= 0; j--) { if (r.steps[j][1] > pt) { next = { at: r.steps[j][0], pt: r.steps[j][1] - pt }; break; } }
          total += pt;
          // 次の段まで「あと何回・何件」(月あたりのものは6か月の回数に直す)
          if (next && r.count) next.more = Math.max(1, Math.ceil(r.unit.indexOf("/月") !== -1 ? next.at * 6 - v * 6 - 1e-9 : next.at - v));
          return { key: r.key, label: r.label, unit: r.unit, value: v, points: pt, max: r.steps[0][1], next: next, tip: r.tip, count: r.count || "" };
        });
        var color = total >= 70 ? "green" : total >= 50 ? "yellow" : total >= 30 ? "red" : "gray";
        return { total: total, color: color, items: items, held: held.length, attended: attended };
      }

      function getHome(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var t = today();
        var month = t.slice(0, 7);
        var upcoming = db.events
          .filter(function (e) { return e.date >= t; })
          .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
        var unreadAnn = db.announcements.filter(function (a) { return (a.readBy || []).indexOf(w.id) === -1; });
        var lastBoard = seen(db, w.id).board || 0;
        var newPosts = db.posts.filter(function (p) { return p.by !== w.id && p.at > lastBoard; }).length;
        var myLogs = db.referralLogs.filter(function (l) { return memberIdOfUser(db, l.fromUserId) === w.id; });
        var inbox = db.referralLogs.filter(function (l) { return l.toMemberId === w.id; });
        var monthMs = function (ms) { return monthKey(ms) === month; };
        var ones = db.oneOnOnes.filter(function (o) { return o.a === w.id || o.b === w.id; });
        var nextOnes = ones
          .filter(function (o) { return o.status === "planned" && o.date >= t; })
          .sort(function (a, b) { return (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")); })
          .slice(0, 3)
          .map(function (o) { return oneView(db, o, w.id); });
        var missing = typeof missingProfileItems === "function" ? missingProfileItems(Object.assign({ triggers: [], faceAreas: [] }, w.me)).map(function (it) { return it.label; }) : [];
        if (!(w.me.topics || []).length) missing.push("できること(ジャンル)");

        // 声かけが必要なこと(放っておくと紹介が止まるもの)
        var followUps = [];
        myLogs.forEach(function (l) {
          // 自分で「もう終わった」にしたもの・「あとで」にしたもの・30日より前のものは出さない
          if (l.status === "new" && !l.giverDone && !(l.giverSnoozeUntil > c.nowMs()) && c.nowMs() - l.at > 3 * DAY && c.nowMs() - l.at <= 30 * DAY) {
            followUps.push({ type: "givenStale", id: l.id, with: l.toMemberId, withName: nameOf(db, l.toMemberId), prospect: l.prospect, days: Math.floor((c.nowMs() - l.at) / DAY) });
          }
        });
        inbox.forEach(function (l) {
          var giver = memberIdOfUser(db, l.fromUserId);
          if (l.status === "won" && !c.find(db.thanks, function (t) { return t.referralId === l.id; })) {
            followUps.push({ type: "thanksMissing", id: l.id, with: giver, withName: nameOf(db, giver), prospect: l.prospect });
          } else if (l.status === "new" && c.nowMs() - l.at > 2 * DAY) {
            followUps.push({ type: "inboxStale", id: l.id, with: giver, withName: nameOf(db, giver), prospect: l.prospect, days: Math.floor((c.nowMs() - l.at) / DAY) });
          }
        });
        ones.forEach(function (o) {
          if (o.status !== "planned") return;
          var other = o.a === w.id ? o.b : o.a;
          if (awaitingConfirm(o)) followUps.push({ type: "oneConfirm", id: o.id, with: other, withName: nameOf(db, other), date: o.date, time: o.time || "" });
          else if (o.date === t) followUps.push({ type: "oneToday", id: o.id, with: other, withName: nameOf(db, other), time: o.time || "", place: o.place || "", meetUrl: o.meetUrl || "" });
        });
        // 今日の紹介の顔合わせ(紹介した人・受けた人)
        db.referralLogs.forEach(function (l) {
          if (!l.meeting || l.meeting.date !== t || l.status === "lost") return;
          var giver = memberIdOfUser(db, l.fromUserId);
          if (giver !== w.id && l.toMemberId !== w.id) return;
          var end = startMs(l.meeting.date, l.meeting.time);
          if (end !== null && c.nowMs() > end + (l.meeting.duration || 60) * 60000) return;
          followUps.push({ type: "refMeetToday", id: l.id, prospect: l.prospect || "", withName: nameOf(db, giver === w.id ? l.toMemberId : giver), time: l.meeting.time || "", place: l.meeting.mode === "meet" ? "Google Meet" : l.meeting.place || "", meetUrl: l.meeting.meetUrl || "" });
        });
        // 自分が招いたビジターが参加した(入会・見送りがまだ・参加から14日以内) → 入会の声かけ
        db.visitors.forEach(function (v) {
          if (v.by !== w.id || v.status !== "attended") return;
          var e = c.find(db.events, function (x) { return x.id === v.eventId; });
          if (!e || e.date > t || c.nowMs() - eventEndMs(e) > 14 * DAY) return;
          followUps.push({ type: "visitorFollow", id: v.id, name: v.name || "ビジター", date: e.date });
        });
        // 定例会が近いのに出欠がまだ(2日以内・締切前)
        db.events.forEach(function (e) {
          if (!eventSoon(e) || (e.rsvps || {})[w.id]) return;
          followUps.push({ type: "rsvpSoon", id: e.id, title: e.title, date: e.date, start: e.start || "" });
        });
        // 時刻を過ぎて自動で「実施」になった 1on1(1週間以内・自分のメモがまだ)
        ones.forEach(function (o) {
          if (!(o.autoDone || o.confirmedBy) || (o.notes || {})[w.id] || c.nowMs() - (o.doneAt || 0) > 7 * DAY) return;
          var other = o.a === w.id ? o.b : o.a;
          followUps.push({ type: "oneMemo", id: o.id, with: other, withName: nameOf(db, other), date: o.date });
        });
        // 今週の紹介チャレンジ: 最近(60日)紹介を受けていない人を優先し、週ごとに1人。自分は除く。
        // 求める紹介が入っている人だけ(紹介のしようがないため)
        var spotlight = (function () {
          var since = c.nowMs() - 60 * DAY;
          var week = Math.floor((c.nowMs() + JST) / (7 * DAY));
          var pool = (db.referralMembers || []).filter(function (m) { return m.id !== w.id && m.wants; }).map(function (m) {
            var got = db.referralLogs.filter(function (l) { return l.toMemberId === m.id && l.at >= since; }).length;
            var h = 0, key = m.id + ":" + week;
            for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100003;
            return { m: m, got: got, h: h };
          });
          if (!pool.length) return null;
          pool.sort(function (a, b) { return a.got - b.got || a.h - b.h; });
          var p = pool[0].m;
          return { id: p.id, name: p.name, company: p.company || "", wants: p.wants, triggers: (p.triggers || []).slice(0, 4), offer: p.offer || "", received: pool[0].got };
        })();
        var myTasks = db.tasks.filter(function (tk) { return tk.assignees.indexOf(w.id) !== -1 && !(tk.done || {})[w.id]; })
          .sort(function (a, b) { return (a.due || "9999").localeCompare(b.due || "9999") || a.at - b.at; })
          .map(function (tk) { return taskView(db, tk, w.id); });
        return c.ok({
          tasks: myTasks,
          spotlight: spotlight,
          me: { id: w.id, name: w.me.name, team: w.me.team || "", isAdmin: w.isAdmin, hasPassword: !!w.user.pw, goals: w.user.goals || null },
          today: t,
          events: upcoming.slice(0, 3).map(function (e) { return eventView(w, e); }),
          checkInOpen: upcoming.some(function (e) { return e.date === t && e.checkIn; }),
          announcements: db.announcements.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, 3).map(function (a) { return annView(w, a); }),
          badges: {
            announcements: unreadAnn.length,
            board: newPosts,
            inbox: inbox.filter(function (l) { return l.status === "new"; }).length,
            rsvp: upcoming.filter(function (e) { return !(e.rsvps || {})[w.id]; }).length,
            feed: activityItems(db, w.id).filter(function (x) { return x.at > (seen(db, w.id).feed || 0); }).length,
          },
          stats: {
            given: myLogs.filter(function (l) { return monthMs(l.at); }).length,
            received: inbox.filter(function (l) { return monthMs(l.at); }).length,
            won: myLogs.filter(function (l) { return l.status === "won" && monthMs(l.statusAt || l.at); }).length,
            milesIn: db.thanks.filter(function (x) { return x.to === w.id && monthMs(x.at); }).reduce(function (s, x) { return s + x.amount; }, 0),
            milesOut: db.thanks.filter(function (x) { return x.from === w.id && monthMs(x.at); }).reduce(function (s, x) { return s + x.amount; }, 0),
            oneOnOnes: ones.filter(function (o) { return o.status === "done" && o.date.slice(0, 7) === month; }).length,
            visitors: db.visitors.filter(function (v) { return v.by === w.id && monthMs(v.at); }).length,
            givenAll: myLogs.length,
            milesInAll: db.thanks.filter(function (x) { return x.to === w.id; }).reduce(function (s, x) { return s + x.amount; }, 0),
          },
          signal: signalOf(db, w.id),
          // BT-EX5 全体の今月(みんなの動き)
          community: {
            given: db.referralLogs.filter(function (l) { return monthMs(l.at); }).length,
            won: db.referralLogs.filter(function (l) { return l.status === "won" && monthMs(l.statusAt || l.at); }).length,
            miles: db.thanks.filter(function (x) { return monthMs(x.at); }).reduce(function (s2, x) { return s2 + x.amount; }, 0),
            ones: db.oneOnOnes.filter(function (o) { return o.status === "done" && o.date.slice(0, 7) === month; }).length,
            posts: db.posts.filter(function (p) { return monthMs(p.at); }).length,
            members: (db.referralMembers || []).length,
          },
          inboxNew: inbox.filter(function (l) { return l.status === "new"; }).slice(-3).reverse().map(function (l) { return referralView(db, l, w.id); }),
          nextOneOnOnes: nextOnes,
          missing: missing,
          followUps: followUps.slice(0, 6),
          teamRank: (function () {
            var rows = memberStats(db, t.slice(0, 7) + "-01", t);
            if (!rows[w.id]) return null;
            var ms = rankRows(Object.keys(rows).map(function (k) { return rows[k]; }), "points");
            var me = ms.filter(function (r) { return r.id === w.id; })[0];
            return { rank: me.rank, size: ms.length, points: me.points, gap: me.gap, gapName: me.gapName, tied: me.tied || 1 };
          })(),
        });
      }

      // ============================================
      // プッシュ通知(iPhone・Android・パソコンの通知)
      // サーバーから送るのは中身のない「合図」だけ。合図を受けた端末(sw.js)が pushPeek で
      // 自分あての最新のお知らせを取りに来て表示する。pushPeek はその端末だけが知る鍵で読む
      // (ログインのトークンを端末の裏側に置かない)。お知らせの中身は activityItems と同じ
      // ============================================
      var PUSH_MAX_PER_MEMBER = 10;
      function cleanEndpoint(v) {
        var s = String(v || "").trim();
        return /^https:\/\/[^\s"'<>]+$/.test(s) && s.length <= 1000 ? s : "";
      }
      function cleanKey(v) {
        var s = String(v || "");
        return /^[A-Za-z0-9_-]{1,200}$/.test(s) ? s : "";
      }
      // スマホの通知の種類(本人が切ったものは通知しない。ベルのお知らせには、これまでどおり全部出す)
      var PUSH_GROUPS = {
        ref: ["refIn", "refStatus", "refMeet", "refMeetSoon", "thanks"],
        one: ["oneNew", "oneSoon", "oneAsk"],
        board: ["post", "comment", "reply"],
        mention: ["mention"],
        news: ["ann", "annRemind", "rsvpSoon", "event"],
        task: ["taskNew", "taskDue", "taskSoon"],
        visitor: ["visitor"],
      };
      function pushItems(db, memberId) {
        var u = userOf(db, memberId);
        var off = (u && Array.isArray(u.notifyOff)) ? u.notifyOff : [];
        var muted = [];
        off.forEach(function (g) { (PUSH_GROUPS[g] || []).forEach(function (t) { muted.push(t); }); });
        var items = activityItems(db, memberId);
        return muted.length ? items.filter(function (x) { return muted.indexOf(x.type) === -1; }) : items;
      }
      function latestActivityAt(db, memberId) {
        var items = pushItems(db, memberId);
        return items.length ? items[0].at : 0;
      }

      function pushConfig(body) {
        var w = who(body);
        if (w.error) return w.error;
        var available = !!(c.push && c.push.publicKey);
        return c.ok({
          available: available,
          publicKey: available ? c.push.publicKey() : "",
          devices: w.db.pushSubs.filter(function (s) { return s.memberId === w.id; }).length,
        });
      }

      function savePushSubscription(body) {
        var w = who(body);
        if (w.error) return w.error;
        if (!c.push) return c.fail("INVALID_REQUEST", "通知は共有サーバーで動いているときだけ使えます。");
        var sub = body.subscription || {};
        var endpoint = cleanEndpoint(sub.endpoint);
        if (!endpoint) return c.fail("INVALID_REQUEST");
        var db = w.db;
        var peekKey = c.randomToken();
        var row = c.find(db.pushSubs, function (s) { return s.endpoint === endpoint; });
        if (!row) {
          row = { endpoint: endpoint, at: c.nowMs() };
          db.pushSubs.push(row);
        }
        row.memberId = w.id;
        row.peek = c.sha256Hex(peekKey);
        row.ua = c.cleanStr(body.userAgent, 120);
        row.seenAt = c.nowMs();
        // 登録した時点より前の出来事では鳴らさない
        row.notified = Math.max(row.notified || 0, latestActivityAt(db, w.id));
        // 古い端末から消す(1人あたり上限まで)
        var mine = db.pushSubs.filter(function (s) { return s.memberId === w.id; }).sort(function (a, b) { return a.seenAt - b.seenAt; });
        var drop = mine.slice(0, Math.max(0, mine.length - PUSH_MAX_PER_MEMBER)).map(function (s) { return s.endpoint; });
        if (drop.length) db.pushSubs = db.pushSubs.filter(function (s) { return drop.indexOf(s.endpoint) === -1; });
        var site = String(body.site || "").match(/^https:\/\/[A-Za-z0-9.-]+(:\d+)?/);
        if (site) db.pushSite = site[0];
        c.saveDb(db);
        return c.ok({ peekKey: peekKey, devices: mine.length - drop.length });
      }

      function deletePushSubscription(body) {
        var db = c.ensureDb();
        var endpoint = cleanEndpoint(body.endpoint);
        var a = c.authSession(db, body.sessionToken);
        var peek = cleanKey(body.peekKey);
        var before = db.pushSubs.length;
        db.pushSubs = db.pushSubs.filter(function (s) {
          if (s.endpoint !== endpoint) return true;
          var mine = (a && a.user.memberId === s.memberId) || (peek && s.peek === c.sha256Hex(peek));
          return !mine;
        });
        if (db.pushSubs.length !== before) c.saveDb(db);
        return c.ok({ removed: before - db.pushSubs.length });
      }

      // 通知に出す文(app/feed.js の表示と同じ言い回し)
      var REF_STATUS_JA = { contacted: "連絡しました", meeting: "商談中です", won: "成約しました", lost: "見送りになりました" };
      function pushText(x) {
        var n = (x.whoName || "") + "さん";
        switch (x.type) {
          case "refIn": return { title: "🤝 " + n + "から紹介が届きました", body: x.text };
          case "refStatus": return { title: "🤝 紹介の進み具合", body: n + "への紹介(" + x.text + ")が" + (REF_STATUS_JA[x.status] || "更新されました") };
          case "thanks": return { title: "🎉 " + n + "からありがとうマイル", body: (x.amount ? Number(x.amount).toLocaleString("ja-JP") + "円 " : "") + x.text };
          case "post": return { title: "📝 " + n + "が掲示板に投稿しました", body: x.text };
          case "comment": return { title: "💬 " + n + "があなたの投稿にコメント", body: x.text };
          case "reply": return { title: "💬 " + n + "も掲示板でコメント", body: x.text };
          case "oneNew": return { title: "☕ " + n + "と1on1の予定", body: x.date || "" };
          case "rsvpSoon": return { title: "📅 " + (x.date || "") + " の定例会の出欠がまだです", body: x.text + "(押して出席・欠席を選んでください)" };
          case "refMeet": return { title: "🤝 " + n + "が紹介の顔合わせの予定を入れました", body: (x.date || "") + " " + x.text };
          case "oneSoon": return { title: "☕ " + (x.time || "") + " から " + n + "と 1on1 です", body: x.meetUrl ? "Google Meet:" + x.meetUrl : "押すと予定を確認できます" };
          case "refMeetSoon": return { title: "🤝 " + (x.time || "") + " から紹介の顔合わせです", body: x.text + " × " + n + (x.meetUrl ? "(Google Meet:" + x.meetUrl + ")" : "") };
          case "taskNew": return { title: "✅ " + n + "から やること", body: x.text + (x.date ? "(期限 " + x.date.slice(5).replace("-", "/") + ")" : "") };
          case "taskDue": return { title: "⏰ やることの期限が近づいています", body: x.text + "(期限 " + x.date.slice(5).replace("-", "/") + ")" };
          case "mention": return { title: "＠ " + n + "が掲示板であなたの名前を出しました", body: x.text };
          case "taskSoon": return { title: "⏰ " + (x.time || "") + " から:" + x.text, body: "やることの時刻が近づいています" };
          case "oneAsk": return { title: "☕ " + n + "との1on1 は実施しましたか?", body: "「実施した」を押すと 1on1 の回数に数えます" };
          case "visitor": return { title: "🙋 ビジターの申込がありました", body: x.text + " さん" };
          case "ann": return { title: "📣 運営からのお知らせ", body: x.text };
          case "annRemind": return { title: "📣 まだ読んでいない運営連絡があります", body: x.text };
          case "event": return { title: "📅 定例会の予定が出ました", body: (x.date || "") + " " + x.text };
          default: return { title: "BT-EX5", body: "新しいお知らせがあります" };
        }
      }

      // 端末(sw.js)が通知に出す中身を取りに来る。ログインは不要で、登録時に渡した鍵で読む
      function pushPeek(body) {
        var db = c.ensureDb();
        var endpoint = cleanEndpoint(body.endpoint);
        var peek = cleanKey(body.peekKey);
        var row = endpoint && peek ? c.find(db.pushSubs, function (s) { return s.endpoint === endpoint; }) : null;
        if (!row || row.peek !== c.sha256Hex(peek)) return c.fail("SESSION_INVALID");
        var lastSeen = seen(db, row.memberId).feed || 0;
        var fresh = pushItems(db, row.memberId).filter(function (x) { return x.at > lastSeen; });
        var top = fresh[0];
        var t = top ? pushText(top) : { title: "BT-EX5", body: "新しいお知らせがあります" };
        return c.ok({
          title: t.title,
          body: String(t.body || "").slice(0, 120),
          link: top ? top.link : "feed",
          count: fresh.length,
          more: Math.max(0, fresh.length - 1),
        });
      }

      // ============================================
      // LINE で受け取る(LINE 公式アカウント + Messaging API)
      // 運営が LINE 公式アカウントを用意して共有サーバーに設定すると使える(c.line)。
      // つなぎ方: 会員がアプリで6けたのコードを出す → 公式アカウントを友だち追加して、そのコードを送る →
      // 共有サーバーが受け取った(Webhook)LINE のユーザー ID を、その会員にひもづける。
      // 送る内容はスマホの通知と同じ(通知の種類で切ったものは送らない)。月の上限(無料プランは200通)をこえたら止める
      // ============================================
      var LINE_CODE_MINUTES = 30;
      function lineState(u) {
        return { available: !!c.line, linked: !!(u && u.lineUserId), on: !!(u && u.lineUserId && u.lineOn !== false), addUrl: (c.line && c.line.addUrl) || "" };
      }
      function lineLinkCode(body) {
        var w = who(body);
        if (w.error) return w.error;
        if (!c.line) return c.fail("INVALID_REQUEST", "LINE での通知は、まだ準備中です(運営が LINE 公式アカウントを用意すると使えます)。");
        var code = String(100000 + (parseInt(c.randomHex(4), 16) % 900000));
        w.user.lineCode = { hash: c.sha256Hex("line:" + code), exp: c.nowMs() + LINE_CODE_MINUTES * 60 * 1000 };
        var site = String(body.appUrl || "").match(/^https:\/\/[^\s"'<>#?]+\/app\//);
        if (site) w.db.lineAppUrl = site[0];
        c.saveDb(w.db);
        return c.ok({ code: code, minutes: LINE_CODE_MINUTES, addUrl: c.line.addUrl || "" });
      }
      function lineSetting(body) {
        var w = who(body);
        if (w.error) return w.error;
        if (body.unlink === true) { delete w.user.lineUserId; delete w.user.lineOn; delete w.user.lineCode; }
        else if (typeof body.on === "boolean") w.user.lineOn = body.on;
        c.saveDb(w.db);
        return c.ok({ line: lineState(w.user) });
      }
      // LINE から届いたできごと(Webhook)。返すのは「返信する文」の一覧(送るのは GAS 側)
      function jobLineWebhook(events) {
        var db = c.ensureDb();
        var replies = [];
        var changed = false;
        (Array.isArray(events) ? events : []).forEach(function (ev) {
          var uid = ev && ev.source && ev.source.userId;
          if (!uid || !ev.replyToken) return;
          if (ev.type === "follow") {
            replies.push({ replyToken: ev.replyToken, text: "BT-EX5 の公式アカウントです。\n通知を受け取るには、会員アプリの「マイページ → 通知を受け取る → LINE とつなぐ」に出る6けたのコードを、このトークに送ってください。" });
            return;
          }
          if (ev.type !== "message" || !ev.message || ev.message.type !== "text") return;
          var m = /(\d{6})/.exec(String(ev.message.text || "").replace(/[０-９]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 0xfee0); }));
          if (!m) {
            var known = c.find(db.users, function (u) { return u.lineUserId === uid; });
            replies.push({ replyToken: ev.replyToken, text: known ? "このアカウントには、BT-EX5 からのお知らせが届きます。ご返信はアプリからお願いします。" : "会員アプリに出る6けたのコードを送ってください。" });
            return;
          }
          var hash = c.sha256Hex("line:" + m[1]);
          var user = c.find(db.users, function (u) { return u.lineCode && u.lineCode.hash === hash && u.lineCode.exp > c.nowMs(); });
          if (!user) { replies.push({ replyToken: ev.replyToken, text: "コードが正しくないか、期限(30分)が切れています。アプリでもう一度コードを出してください。" }); return; }
          // 同じ LINE がほかの会員にひもづいていたら外す(1つの LINE は1人だけ)
          db.users.forEach(function (u) { if (u !== user && u.lineUserId === uid) { delete u.lineUserId; } });
          user.lineUserId = uid; user.lineOn = true; delete user.lineCode;
          user.lineNotified = latestActivityAt(db, user.memberId); // つないだ時点より前のお知らせは送らない
          changed = true;
          replies.push({ replyToken: ev.replyToken, text: (nameOf(db, user.memberId) || "") + "さん、つながりました。これから BT-EX5 のお知らせ(紹介・1on1・運営連絡など)を LINE でもお届けします。止めるときはアプリの「通知を受け取る」から。" });
        });
        if (changed) c.saveDb(db);
        return { replies: replies };
      }
      // 書き込みのあとに呼ぶ: LINE で送るお知らせ(1人1通にまとめる)
      function jobTakeLineOutbox() {
        if (!c.line) return { messages: [] };
        var db = c.ensureDb();
        var month = today().slice(0, 7);
        db.lineSent = db.lineSent && db.lineSent.month === month ? db.lineSent : { month: month, count: 0 };
        var limit = Number((db.settings && db.settings.lineMonthlyLimit) || c.line.monthlyLimit || 200);
        var out = [];
        db.users.forEach(function (u) {
          if (!u.lineUserId || u.lineOn === false || !member(db, u.memberId)) return;
          var fresh = pushItems(db, u.memberId).filter(function (x) { return x.at > (u.lineNotified || 0); });
          if (!fresh.length) return;
          if (db.lineSent.count >= limit) return;
          u.lineNotified = fresh.reduce(function (mx, x) { return Math.max(mx, x.at); }, 0);
          var t = pushText(fresh[0]);
          var url = (db.lineAppUrl || "") ? db.lineAppUrl + "#" + (fresh[0].link || "feed") : "";
          var text = t.title + "\n" + String(t.body || "").slice(0, 200) + (fresh.length > 1 ? "\n(ほか " + (fresh.length - 1) + " 件)" : "") + (url ? "\n" + url : "");
          out.push({ to: u.lineUserId, text: text });
          db.lineSent.count += 1;
        });
        if (out.length) c.saveDb(db);
        return { messages: out };
      }
      // 管理者: LINE の状態(つないだ人数・今月送った数)と、月の上限
      function adminLineStatus(body) {
        var w = admin(body);
        if (w.error) return w.error;
        if (typeof body.monthlyLimit === "number" && body.monthlyLimit >= 0 && body.monthlyLimit <= 100000) { w.db.settings.lineMonthlyLimit = Math.round(body.monthlyLimit); c.saveDb(w.db); }
        var month = today().slice(0, 7);
        var sent = w.db.lineSent && w.db.lineSent.month === month ? w.db.lineSent.count : 0;
        var linked = w.db.users.filter(function (u) { return u.lineUserId && member(w.db, u.memberId); });
        return c.ok({
          available: !!c.line, addUrl: (c.line && c.line.addUrl) || "",
          linked: linked.length, members: (w.db.referralMembers || []).length,
          linkedNames: linked.map(function (u) { return nameOf(w.db, u.memberId); }),
          sentThisMonth: sent, monthlyLimit: Number(w.db.settings.lineMonthlyLimit || (c.line && c.line.monthlyLimit) || 200),
        });
      }

      // 書き込みのあとに呼ぶ: 新しいお知らせがある端末を選び、送り先として返す(中身は返さない)
      function jobTakePushOutbox() {
        var db = c.ensureDb();
        if (!db.pushSubs || !db.pushSubs.length) return { subs: [] };
        var latest = {};
        var out = [];
        db.pushSubs.forEach(function (s) {
          if (!(s.memberId in latest)) latest[s.memberId] = member(db, s.memberId) ? latestActivityAt(db, s.memberId) : 0;
          var at = latest[s.memberId];
          if (at > (s.notified || 0)) {
            s.notified = at;
            out.push({ endpoint: s.endpoint });
          }
        });
        if (out.length) c.saveDb(db);
        return { subs: out, subject: db.pushSite || "" };
      }

      // 届かなくなった端末(404・410)を消す
      function jobDropPushSubs(endpoints) {
        var list = Array.isArray(endpoints) ? endpoints : [];
        if (!list.length) return { removed: 0 };
        var db = c.ensureDb();
        var before = db.pushSubs.length;
        db.pushSubs = db.pushSubs.filter(function (s) { return list.indexOf(s.endpoint) === -1; });
        if (db.pushSubs.length !== before) c.saveDb(db);
        return { removed: before - db.pushSubs.length };
      }

      return {
        migrate: migrate,
        jobs: { syncMeet: jobSyncMeet, takePushOutbox: jobTakePushOutbox, dropPushSubs: jobDropPushSubs, lineWebhook: jobLineWebhook, takeLineOutbox: jobTakeLineOutbox },
        actions: {
          getHome: getHome, getActivity: getActivity, adminDashboard: adminDashboard, adminExport: adminExport,
          listEvents: listEvents, getEvent: getEvent, rsvpEvent: rsvpEvent, checkIn: checkIn,
          adminSaveEvent: adminSaveEvent, adminDeleteEvent: adminDeleteEvent, adminSaveMinutes: adminSaveMinutes, adminOpenCheckIn: adminOpenCheckIn,
          adminEventDetail: adminEventDetail, adminMarkAttendance: adminMarkAttendance,
          adminSyncMeetAttendance: adminSyncMeetAttendance, adminMapMeetName: adminMapMeetName,
          createVisitorInvite: createVisitorInvite, listMyVisitors: listMyVisitors, updateVisitor: updateVisitor,
          visitorInfo: visitorInfo, visitorApply: visitorApply,
          listMyReferrals: listMyReferrals, setReferralMeeting: setReferralMeeting, reportThanks: reportThanks, deleteThanks: deleteThanks, getRankings: getRankings, getTeamRanking: getTeamRanking, getStats: getStats, logSearch: logSearch, adminSetTeamGoals: adminSetTeamGoals,
          list1on1: list1on1, save1on1: save1on1, delete1on1: delete1on1, confirm1on1: confirm1on1,
          getMySettings: getMySettings, updateMySettings: updateMySettings, muteReferralNudge: muteReferralNudge, lineLinkCode: lineLinkCode, lineSetting: lineSetting, adminLineStatus: adminLineStatus,
          listAnnouncements: listAnnouncements, markAnnouncementsRead: markAnnouncementsRead,
          adminSaveAnnouncement: adminSaveAnnouncement, adminDeleteAnnouncement: adminDeleteAnnouncement, adminRemindAnnouncement: adminRemindAnnouncement,
          listTasks: listTasks, saveTask: saveTask, toggleTask: toggleTask, deleteTask: deleteTask,
          listBoard: listBoard, createPost: createPost, editPost: editPost, editComment: editComment, deletePost: deletePost, commentPost: commentPost,
          deleteComment: deleteComment, likePost: likePost,
          sendFeedback: sendFeedback, listMyFeedback: listMyFeedback, adminListFeedback: adminListFeedback, adminUpdateFeedback: adminUpdateFeedback,
          pushConfig: pushConfig, savePushSubscription: savePushSubscription, deletePushSubscription: deletePushSubscription, pushPeek: pushPeek,
        },
      };
    },
  });

  // ---------- 顔写真(30秒プレゼンの画面・名簿で使う) ----------
  // 写真は小さな JPEG(data:image/jpeg;base64,…)。名簿の本体とは別の置き場所(env.blobs)に入れ、
  // 本体には「いつ変えたか」(photoRevs)だけを持つ。置き場所がないとき(お試し版の古い形)は本体に入れる。
  //   getPhotoRevs(写真のある人と更新日時)/ getPhotos(写真そのもの。最大40人)
  //   setMyPhoto(自分の写真)/ adminSetMemberPhoto(運営がほかの人の写真を入れる)。photo を空にすると消す
  var PHOTO_MAX = 48000; // 文字数(スプレッドシートの1セルに収まる大きさ)
  BtexServerCore.registerModule({
    create: function (c) {
      function blobGet(db, key) {
        if (c.blobs) return c.blobs.get(key) || "";
        return (db.photoBlobs && db.photoBlobs[key]) || "";
      }
      function blobSet(db, key, value) {
        if (c.blobs) { c.blobs.set(key, value); return; }
        if (!db.photoBlobs) db.photoBlobs = {};
        if (value) db.photoBlobs[key] = value; else delete db.photoBlobs[key];
      }
      function cleanPhoto(v) {
        var s = String(v || "");
        if (!s) return "";
        if (s.length > PHOTO_MAX || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s)) return null;
        return s;
      }
      function session(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        return a ? { db: db, a: a } : null;
      }
      function save(db, memberId, photo) {
        var p = cleanPhoto(photo);
        if (p === null) return c.fail("INVALID_REQUEST", "写真が大きすぎるか、形式が読めません。別の写真でお試しください。");
        blobSet(db, "photo:" + memberId, p);
        if (!db.photoRevs) db.photoRevs = {};
        if (p) db.photoRevs[memberId] = c.nowMs(); else delete db.photoRevs[memberId];
        c.saveDb(db);
        return c.ok({ memberId: memberId, rev: db.photoRevs[memberId] || 0 });
      }
      function getPhotoRevs(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        return c.ok({ revs: x.db.photoRevs || {} });
      }
      function getPhotos(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        var revs = x.db.photoRevs || {};
        var ids = (Array.isArray(body.ids) ? body.ids : []).map(function (v) { return c.cleanStr(v, 40); })
          .filter(function (id, i, a) { return id && revs[id] && a.indexOf(id) === i; }).slice(0, 40);
        var photos = {};
        ids.forEach(function (id) { var p = blobGet(x.db, "photo:" + id); if (p) photos[id] = { data: p, rev: revs[id] }; });
        return c.ok({ photos: photos });
      }
      function setMyPhoto(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        return save(x.db, x.a.user.memberId, body.photo);
      }
      function adminSetMemberPhoto(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        if (!x.a.isAdmin) return c.fail("FORBIDDEN_ADMIN");
        var id = c.cleanStr(body.memberId, 40);
        if (!c.find(x.db.referralMembers || [], function (m) { return m.id === id; })) return c.fail("NOT_FOUND");
        return save(x.db, id, body.photo);
      }
      return { actions: { getPhotoRevs: getPhotoRevs, getPhotos: getPhotos, setMyPhoto: setMyPhoto, adminSetMemberPhoto: adminSetMemberPhoto } };
    },
  });

  // ---------- 定例会のスライドの内容(日にち・スケジュール・規定・時間の目安など) ----------
  // 元の内容は referral/data.js の BTEX_DECK。ここには運営が書きかえたところだけを入れる。
  //   getDeckConfig(だれでも読める)/ saveDeckConfig(進行役だけ。config を空にすると元に戻す)
  var DECK_OWNERS = ["yamamoto", "m22", "m02", "m16", "m08", "m14", "m09", "m10", "m24", "m04"]; // 山本 捷真・小林 末季(こばねぇ)・あまみや 七音・桜羽 李果・床島 良夫・三村 隆・大場 雅俊・大枝 篤志・栁橋 雅也・吉澤 美和子
  var DECK_MAX = 60000; // 文字数
  BtexServerCore.registerModule({
    mutating: ["saveDeckConfig"],
    create: function (c) {
      function session(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        return a ? { db: db, a: a } : null;
      }
      function readCfg(db) {
        var raw = c.blobs ? c.blobs.get("deck:config") || "" : db.deckConfig || "";
        try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
      }
      function getDeckConfig(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        return c.ok({ config: readCfg(x.db), at: x.db.deckConfigAt || 0, canEdit: DECK_OWNERS.indexOf(x.a.user.memberId) !== -1 });
      }
      function saveDeckConfig(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        if (DECK_OWNERS.indexOf(x.a.user.memberId) === -1) return c.fail("FORBIDDEN_ADMIN");
        var cfg = body.config;
        var raw = "";
        if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
          try { raw = JSON.stringify(cfg); } catch (e) { return c.fail("INVALID_REQUEST"); }
          if (raw.length > DECK_MAX) return c.fail("INVALID_REQUEST", "内容が長すぎます。");
          if (raw === "{}") raw = "";
        } else if (cfg) return c.fail("INVALID_REQUEST");
        if (c.blobs) c.blobs.set("deck:config", raw);
        else if (raw) x.db.deckConfig = raw; else delete x.db.deckConfig;
        x.db.deckConfigAt = c.nowMs();
        c.saveDb(x.db);
        return c.ok({ config: raw ? JSON.parse(raw) : null, at: x.db.deckConfigAt });
      }
      function writeCfg(db, cfg) {
        var raw = cfg && Object.keys(cfg).length ? JSON.stringify(cfg) : "";
        if (c.blobs) c.blobs.set("deck:config", raw);
        else if (raw) db.deckConfig = raw; else delete db.deckConfig;
      }
      // 運営の依頼で決めた改行(2026年10月)。前に保存したスライドの内容に同じ文が残っていれば、同じように改行する
      var TEXT_BREAKS = [
        ["ビジターと1on1をする際は、その招待者を通す、または情報を共有すること\nメンバーと招待者はその責任において(アポの確認や規定の遵守など)ビジターをフォローまたは対応すること", "ビジターと1on1をする際は、その招待者を通す\nまたは情報を共有すること\nメンバーと招待者はその責任において\n(アポの確認や規定の遵守など)ビジターを\nフォローまたは対応すること"],
        ["一つひとつの関わりを大切に、信頼が積み重なる関係を育てていきます", "一つひとつの関わりを大切に\n信頼が積み重なる関係を育てていきます"],
        ["自分の仕事に誇りを持ち、プロとしての責任を大切に行動します", "自分の仕事に誇りを持ち\nプロとしての責任を大切に行動します"],
        ["公の場やチャットにおいても、メンバーやグループへの否定的な発言は控え\n互いを尊重するコミュニケーションを大切にします", "公の場やチャットにおいても\nメンバーやグループへの否定的な発言は控え\n互いを尊重するコミュニケーションを大切にします"],
        ["LINK や BT の中の BNI・守成クラブ・ニーズマッチの強みを取り入れた事業者コミュニティ", "LINK や BT の中の BNI・守成クラブ・\nニーズマッチの強みを取り入れた\n事業者コミュニティ"],
        ["ユニットごとに月2回ひらく会プレゼンや商談で紹介を生み出す", "ユニットごとに月2回ひらく会\nプレゼンや商談で紹介を生み出す"],
        ["20,000人の市場告知やセミナー、テストマーケができる", "20,000人の市場\n告知やセミナー、テストマーケができる"],
        ["ビジネススキル向上の仕組みと10,000人の人脈", "ビジネススキル向上の仕組みと\n10,000人の人脈"],
        ["メンバー同士が1対1でお互いの事業や紹介してほしい人を深く知るミーティング", "メンバー同士が1対1で\nお互いの事業や紹介してほしい人を\n深く知るミーティング"],
        ["紹介で仕事が決まったら紹介してくれた人へ成約金額を感謝として送る(1円＝1マイル)", "紹介で仕事が決まったら\n紹介してくれた人へ\n成約金額を感謝として送る(1円＝1マイル)"],
        ["見学で定例会に参加する方(同じ方の参加は2回まで)", "見学で定例会に参加する方\n(同じ方の参加は2回まで)"],
        ["定例会で画面に出る4桁のコードbt-ex.jp で入れると出席になる", "定例会で画面に出る4桁のコード\nbt-ex.jp で入れると出席になる"],
        ["BT-EXメンバーは、LINKの会員規約に準ずるものとする", "BT-EXメンバーは、LINKの会員規約に\n準ずるものとする"],
        ["メンバーにも、その先の大切なご縁にも、いつも誠実な気持ちで向き合います", "メンバーにも、その先の大切なご縁にも\nいつも誠実な気持ちで向き合います"],
      ];
      // 改行・読点・句点・空白の入れ方がちがうだけの同じ文も、指定の形にそろえる
      function flatText(t) { return String(t).replace(/[\s、。,]/g, ""); }
      function breakTexts(v) {
        if (typeof v === "string") { TEXT_BREAKS.forEach(function (p) { if (v !== p[1] && flatText(v) === flatText(p[1])) v = p[1]; }); return v; }
        if (Array.isArray(v)) return v.map(breakTexts);
        if (v && typeof v === "object") { Object.keys(v).forEach(function (k) { v[k] = breakTexts(v[k]); }); return v; }
        return v;
      }
      function migrate(db) {
        if (!db.cleanups) db.cleanups = [];
        var changed = false;
        // 運営が時間の目安を決め直したとき(2026年10月: 商談7分×4回・用語説明を足した)、前に保存した時間の目安を一度だけ外す
        if (db.cleanups.indexOf("deck-timeplan-3") === -1) {
          db.cleanups.push("deck-timeplan-3");
          var cfg = readCfg(db);
          if (cfg && "timeplan" in cfg) { delete cfg.timeplan; writeCfg(db, cfg); }
          changed = true;
        }
        if (db.cleanups.indexOf("deck-text-breaks-5") === -1) {
          db.cleanups.push("deck-text-breaks-5");
          var cfg2 = readCfg(db);
          if (cfg2) {
            breakTexts(cfg2);
            // 入会申し込みフォームの説明: 同じ文なら、改行・読点の入れ方にかかわらず2行にそろえる
            var jf = cfg2.joinForm;
            var JOIN_LEAD = "BT-EX5 への入会をご希望の方は\nこちらのフォームからお申し込みください";
            var flat = function (t) { return String(t || "").replace(/[\s、,]/g, ""); };
            if (jf && typeof jf.lead === "string" && flat(jf.lead) === flat(JOIN_LEAD)) jf.lead = JOIN_LEAD;
            writeCfg(db, cfg2);
          }
          changed = true;
        }
        // 入会の3ステップ(2026年10月): 順番を「LINKへの入会 → BT-EX5 入会 → ユニット選択」にし、Step1・2 の説明はカードの外の「入会希望の方はご紹介者の方へお聞きください」にまとめた。
        // 前に保存したステップが元のままなら、一度だけ外して新しい形にする(書きかえていたときはそのまま)
        if (db.cleanups.indexOf("deck-joinsteps-2") === -1) {
          db.cleanups.push("deck-joinsteps-2");
          var cfg3 = readCfg(db);
          var isOld = function (v) { return Array.isArray(v) && v.map(function (x) { return String((x && x.head) || "").replace(/\s/g, ""); }).join("|") === "LINKへの入会|ユニット選択|BT-EX5入会"; };
          // 保存の形は「joinSteps.steps」(編集画面)と「joinSteps: { steps }」の2通り
          if (cfg3 && isOld(cfg3["joinSteps.steps"])) { delete cfg3["joinSteps.steps"]; writeCfg(db, cfg3); }
          else if (cfg3 && cfg3.joinSteps && isOld(cfg3.joinSteps.steps)) { delete cfg3.joinSteps.steps; writeCfg(db, cfg3); }
          changed = true;
        }
        // 用語説明のビジター(2026年10月): 「＊BT-EXフェスは何度でも参加可能」を足す。前に保存した説明が元の文のままなら書きかえる
        if (db.cleanups.indexOf("deck-visitor-fes-1") === -1) {
          db.cleanups.push("deck-visitor-fes-1");
          var cfg5 = readCfg(db);
          if (cfg5) {
            var OLD_V = "見学で定例会に参加する方\n(同じ方の参加は2回まで)", NEW_V = OLD_V + "\n＊BT-EXフェスは何度でも参加可能";
            var addFes = function (v) {
              if (typeof v === "string") return flatText(v) === flatText(OLD_V) ? NEW_V : v;
              if (Array.isArray(v)) return v.map(addFes);
              if (v && typeof v === "object") { Object.keys(v).forEach(function (k) { v[k] = addFes(v[k]); }); return v; }
              return v;
            };
            writeCfg(db, addFes(cfg5));
          }
          changed = true;
        }
        // ビジターの規定(2026年10月): 一般規定⑦の見出し「招待者を通す」を「招待者を《必ず》通す」(必ずの下に波線)に、
        // 出席規定④の文の下に「＊BT-EXフェスは何度でも参加可能」を、スケジュールの注意書きの下に「＊LINKの公式スケジュールによっては…」を足す。
        // 前に保存した文が元のままなら書きかえる
        if (db.cleanups.indexOf("deck-visitor-rules-1") === -1) {
          db.cleanups.push("deck-visitor-rules-1");
          var cfg6 = readCfg(db);
          if (cfg6) {
            var addMust = function (v) {
              if (typeof v === "string") {
                var f = v.replace(/\s/g, "");
                if (f === "ビジターとの1on1は招待者を通す") return "ビジターとの1on1は招待者を《必ず》通す";
                if (f === "同一人物のビジター参加は2回までとする") return "同一人物のビジター参加は2回までとする\n＊BT-EXフェスは何度でも参加可能";
                if (f === "今後、新潟・東京各月でリアル定例会も開催予定") return "今後、新潟・東京各月でリアル定例会も開催予定\n＊LINKの公式スケジュールによってはスケジュールの変更あり";
                return v;
              }
              if (Array.isArray(v)) return v.map(addMust);
              if (v && typeof v === "object") { Object.keys(v).forEach(function (k) { v[k] = addMust(v[k]); }); return v; }
              return v;
            };
            writeCfg(db, addMust(cfg6));
          }
          changed = true;
        }
        // 代表の紹介の改行(2026年10月)。前に保存した文が同じ文なら、指定の位置で改行する
        if (db.cleanups.indexOf("deck-leader-breaks-1") === -1) {
          db.cleanups.push("deck-leader-breaks-1");
          var cfg7 = readCfg(db);
          if (cfg7) {
            var LEADER_BREAKS = ["4ヶ月で\n1万人フォロワー達成", "5000人の事業者コミュニティ\nの代表", "お互いを応援し合える\n勝たせ合える環境をつくる"];
            var brk = function (v) {
              if (typeof v === "string") { LEADER_BREAKS.forEach(function (t) { if (v !== t && flatText(v) === flatText(t)) v = t; }); return v; }
              if (Array.isArray(v)) return v.map(brk);
              if (v && typeof v === "object") { Object.keys(v).forEach(function (k) { v[k] = brk(v[k]); }); return v; }
              return v;
            };
            writeCfg(db, brk(cfg7));
          }
          changed = true;
        }
        // アンケートの説明(2026年10月): 「本日の定例会の…」を「本日のBT-EX5の定例会の…」に。前に保存した説明が元の文のままなら書きかえる
        if (db.cleanups.indexOf("deck-survey-lead-1") === -1) {
          db.cleanups.push("deck-survey-lead-1");
          var cfg4 = readCfg(db);
          var OLD_LEAD = "本日の定例会の感想をお聞かせください", NEW_LEAD = "本日のBT-EX5の定例会の感想をお聞かせください";
          var fixLead = function (t) { return typeof t === "string" && t.indexOf(OLD_LEAD) === 0 ? NEW_LEAD + t.slice(OLD_LEAD.length) : t; };
          if (cfg4) {
            if (typeof cfg4["survey.lead"] === "string") cfg4["survey.lead"] = fixLead(cfg4["survey.lead"]);
            if (cfg4.survey && typeof cfg4.survey.lead === "string") cfg4.survey.lead = fixLead(cfg4.survey.lead);
            writeCfg(db, cfg4);
          }
          changed = true;
        }
        return changed;
      }
      return { migrate: migrate, actions: { getDeckConfig: getDeckConfig, saveDeckConfig: saveDeckConfig } };
    },
  });
  // ============================================
  // 定例会のアンケート(BT-EX メンバー向け・ビジター向け)
  //   submitSurvey(公開・ログイン不要)/ listSurveys・adminDeleteSurvey(プレゼンの進行役・管理者)
  //   同じ定例会の日・同じメールアドレス・同じ種類の回答は、あとの回答で上書きする
  // ============================================
  var SURVEY_SCORES = ["とても感じた", "感じた", "どちらともいえない", "あまり感じなかった", "感じなかった"];
  var SURVEY_INTEREST = ["ぜひ入会したい", "詳しく話を聞きたい", "今は考えていない"];
  var SURVEY_MAX = 3000; // 保存しておく回答の数
  var SURVEY_DAY_MAX = 600; // 1日に受け付ける回答の数(いたずら対策)
  BtexServerCore.registerModule({
    mutating: ["submitSurvey", "adminDeleteSurvey"],
    create: function (c) {
      function canRead(db, token) {
        var a = c.authSession(db, token);
        if (!a) return c.fail("SESSION_INVALID");
        if (!a.isAdmin && DECK_OWNERS.indexOf(a.user.memberId) === -1) return c.fail("FORBIDDEN_ADMIN");
        return null;
      }
      function submitSurvey(body) {
        var db = c.ensureDb();
        if (!Array.isArray(db.surveys)) db.surveys = [];
        if (c.cleanStr(body.website, 10)) return c.ok({}); // 見えない欄に入っているのは機械の送信
        var kind = body.kind === "visitor" ? "visitor" : "member";
        var day = new Date(c.nowMs() + 9 * 3600000).toISOString().slice(0, 10);
        if (!db.surveyGuard || db.surveyGuard.day !== day) db.surveyGuard = { day: day, count: 0 };
        if (db.surveyGuard.count >= SURVEY_DAY_MAX) return c.fail("INVALID_REQUEST", "ただいま回答を受け付けられません。時間をおいてお試しください。");
        var date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? String(body.date) : "";
        var last = c.cleanStr(body.last, 30), first = c.cleanStr(body.first, 30);
        var email = c.cleanStr(body.email, 120);
        var score = SURVEY_SCORES.indexOf(String(body.score || ""));
        var reason = c.cleanStr(body.reason, 800), comment = c.cleanStr(body.comment, 1200);
        var program = c.cleanStr(body.program, 80);
        if (!date || !last || !first || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || score < 0 || !program || !reason || !comment) {
          return c.fail("INVALID_REQUEST", "必須の項目を入れてください。");
        }
        var r = {
          kind: kind, eventId: c.cleanStr(body.eventId, 40), date: date, last: last, first: first, email: email,
          score: score, program: program, reason: reason, comment: comment,
        };
        if (kind === "member") {
          r.unit = c.cleanStr(body.unit, 12); r.lineage = c.cleanStr(body.lineage, 60); r.job = c.cleanStr(body.job, 80);
          r.upcre = c.cleanStr(body.upcre, 40); r.adopt = c.cleanStr(body.adopt, 800);
          if (!r.unit || !r.lineage || !r.job || !r.upcre) return c.fail("INVALID_REQUEST", "必須の項目を入れてください。");
        } else {
          r.job = c.cleanStr(body.job, 80); r.inviter = c.cleanStr(body.inviter, 40); r.link = ["yes", "no"].indexOf(body.link) !== -1 ? body.link : "";
          r.interest = SURVEY_INTEREST.indexOf(String(body.interest || "")) !== -1 ? String(body.interest) : "";
          if (!r.job || !r.inviter || !r.interest) return c.fail("INVALID_REQUEST", "必須の項目を入れてください。");
        }
        var same = c.find(db.surveys, function (x) { return x.kind === kind && x.date === date && x.email.toLowerCase() === email.toLowerCase(); });
        if (same) { Object.assign(same, r, { updatedAt: c.nowMs() }); }
        else {
          r.id = "sv_" + c.randomHex(6); r.at = c.nowMs();
          db.surveys.push(r);
          if (db.surveys.length > SURVEY_MAX) db.surveys.splice(0, db.surveys.length - SURVEY_MAX);
        }
        db.surveyGuard.count += 1;
        c.saveDb(db);
        return c.ok({ updated: !!same });
      }
      function listSurveys(body) {
        var db = c.ensureDb();
        var e = canRead(db, body.sessionToken);
        if (e) return e;
        var list = (db.surveys || []).slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
        return c.ok({ items: list, scores: SURVEY_SCORES, interests: SURVEY_INTEREST });
      }
      function adminDeleteSurvey(body) {
        var db = c.ensureDb();
        var e = canRead(db, body.sessionToken);
        if (e) return e;
        var before = (db.surveys || []).length;
        db.surveys = (db.surveys || []).filter(function (x) { return x.id !== body.id; });
        if (db.surveys.length === before) return c.fail("NOT_FOUND");
        c.saveDb(db);
        return c.ok({});
      }
      return { actions: { submitSurvey: submitSurvey, listSurveys: listSurveys, adminDeleteSurvey: adminDeleteSurvey } };
    },
  });
  // ============================================
  // エデュケーションコーナーの資料(毎回入れかえる)
  //   getEducation(ログインした人)/ getEduPage(1枚ずつ)/ saveEducation(プレゼンの進行役。pages を空にすると元の資料に戻す)
  //   1枚の画像は、スプレッドシートの1セルに収まる大きさに分けて置く
  // ============================================
  var EDU_PAGES_MAX = 40, EDU_PAGE_MAX = 600000, EDU_CHUNK = 45000;
  BtexServerCore.registerModule({
    mutating: ["saveEducation"],
    create: function (c) {
      function bget(db, k) { return c.blobs ? c.blobs.get(k) || "" : ((db.eduBlobs || {})[k] || ""); }
      function bset(db, k, v) {
        if (c.blobs) { c.blobs.set(k, v); return; }
        if (!db.eduBlobs) db.eduBlobs = {};
        if (v) db.eduBlobs[k] = v; else delete db.eduBlobs[k];
      }
      function session(body) { var db = c.ensureDb(); var a = c.authSession(db, body.sessionToken); return a ? { db: db, a: a } : null; }
      function info(db) { var e = db.education || null; return e && e.pages ? { title: e.title || "", pages: e.pages.length, rev: e.rev || 0 } : null; }
      function getEducation(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        return c.ok({ education: info(x.db), canEdit: DECK_OWNERS.indexOf(x.a.user.memberId) !== -1 });
      }
      function getEduPage(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        var e = x.db.education, i = Number(body.i);
        if (!e || !e.pages || !(i >= 0 && i < e.pages.length)) return c.fail("NOT_FOUND");
        var data = "";
        for (var k = 0; k < e.pages[i]; k++) data += bget(x.db, "edu:" + e.rev + ":" + i + ":" + k);
        return c.ok({ data: data, rev: e.rev });
      }
      function saveEducation(body) {
        var x = session(body);
        if (!x) return c.fail("SESSION_INVALID");
        if (DECK_OWNERS.indexOf(x.a.user.memberId) === -1) return c.fail("FORBIDDEN_ADMIN");
        var db = x.db, old = db.education;
        // 題だけを変える
        if (body.titleOnly) {
          if (!old) return c.fail("INVALID_REQUEST", "先に資料を入れてください。");
          old.title = c.cleanStr(body.title, 60) || old.title; c.saveDb(db);
          return c.ok({ education: info(db) });
        }
        var pages = Array.isArray(body.pages) ? body.pages : [];
        if (pages.length > EDU_PAGES_MAX) return c.fail("INVALID_REQUEST", "資料は" + EDU_PAGES_MAX + "枚までです。");
        for (var j = 0; j < pages.length; j++) {
          var s = String(pages[j] || "");
          if (s.length > EDU_PAGE_MAX || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s)) return c.fail("INVALID_REQUEST", (j + 1) + "枚目の画像が大きすぎるか、形式が読めません。");
        }
        // 前の資料を消す
        if (old && old.pages) old.pages.forEach(function (n, i) { for (var k = 0; k < n; k++) bset(db, "edu:" + old.rev + ":" + i + ":" + k, ""); });
        if (!pages.length) { delete db.education; c.saveDb(db); return c.ok({ education: null }); }
        var rev = c.nowMs(), counts = [];
        pages.forEach(function (s, i) {
          var n = Math.ceil(s.length / EDU_CHUNK);
          for (var k = 0; k < n; k++) bset(db, "edu:" + rev + ":" + i + ":" + k, s.slice(k * EDU_CHUNK, (k + 1) * EDU_CHUNK));
          counts.push(n);
        });
        db.education = { title: c.cleanStr(body.title, 60) || "エデュケーションコーナー", pages: counts, rev: rev, by: x.a.user.memberId };
        c.saveDb(db);
        return c.ok({ education: info(db) });
      }
      return { actions: { getEducation: getEducation, getEduPage: getEduPage, saveEducation: saveEducation } };
    },
  });
  // ============================================
  // 運営会議(プレゼンを任された運営メンバーだけ)
  //   listOpsMeetings / saveOpsMeeting / deleteOpsMeeting / saveOpsNotes / fetchOpsNotes
  //   会議を作ると Google Meet を自動で作り(カレンダー連携のとき)、運営メンバーを招待する。
  //   会議のあと、Google Meet の「Gemini によるメモ」・文字起こしを読みこんで議事録にする(共有サーバーのとき)。
  //   読みこめないときは、メモを貼り付けて残せる
  // ============================================
  var OPS_MAX = 300, OPS_NOTE_MAX = 40000;
  BtexServerCore.registerModule({
    mutating: ["saveOpsMeeting", "deleteOpsMeeting", "saveOpsNotes", "fetchOpsNotes"],
    create: function (c) {
      function ops(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        if (!a) return { error: c.fail("SESSION_INVALID") };
        if (DECK_OWNERS.indexOf(a.user.memberId) === -1 && !a.isAdmin) return { error: c.fail("FORBIDDEN_ADMIN") };
        if (!Array.isArray(db.opsMeetings)) db.opsMeetings = [];
        return { db: db, a: a, id: a.user.memberId };
      }
      function nameOf(db, id) { var m = c.find(db.referralMembers || [], function (x) { return x.id === id; }); return m ? m.name : ""; }
      function view(db, m) {
        return { id: m.id, title: m.title, date: m.date, start: m.start, end: m.end, agenda: m.agenda || "", meetUrl: m.meetUrl || "", link: m.link || "",
          notes: (m.notes || []).map(function (n) { return { id: n.id, source: n.source, title: n.title || "", text: n.text || "", url: n.url || "", at: n.at, byName: n.by ? nameOf(db, n.by) : "" }; }),
          byName: nameOf(db, m.by), at: m.at };
      }
      function cleanDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : ""; }
      function cleanTime(v) { return /^\d{2}:\d{2}$/.test(String(v || "")) ? String(v) : ""; }
      function listOpsMeetings(body) {
        var x = ops(body); if (x.error) return x.error;
        var list = x.db.opsMeetings.slice().sort(function (p, q) { return (q.date + q.start).localeCompare(p.date + p.start); });
        return c.ok({ items: list.map(function (m) { return view(x.db, m); }), calendar: !!c.calendar, autoNotes: !!(c.meet && c.meet.notes) });
      }
      function saveOpsMeeting(body) {
        var x = ops(body); if (x.error) return x.error;
        var input = body.meeting || {};
        var date = cleanDate(input.date), start = cleanTime(input.start), end = cleanTime(input.end) || start;
        var title = c.cleanStr(input.title, 80) || "運営会議";
        if (!date || !start) return c.fail("INVALID_REQUEST", "日付と開始の時刻を入れてください。");
        var m = input.id ? c.find(x.db.opsMeetings, function (y) { return y.id === input.id; }) : null;
        if (input.id && !m) return c.fail("NOT_FOUND");
        if (!m) { m = { id: "op_" + c.randomHex(6), by: x.id, at: c.nowMs(), notes: [] }; x.db.opsMeetings.push(m); if (x.db.opsMeetings.length > OPS_MAX) x.db.opsMeetings.shift(); }
        m.title = title; m.date = date; m.start = start; m.end = end;
        m.agenda = c.cleanStr(input.agenda, 2000);
        if (!c.calendar) m.meetUrl = /^https:\/\/meet\.google\.com\/[a-z0-9-]+/i.test(String(input.meetUrl || "")) ? c.cleanStr(input.meetUrl, 200) : (m.meetUrl || "");
        if (c.calendar) {
          // 運営メンバーのうち、カレンダー用のメールを入れている人を招待する
          var guests = (x.db.users || []).filter(function (u) { return DECK_OWNERS.indexOf(u.memberId) !== -1 && u.calendarEmail; }).map(function (u) { return u.calendarEmail; });
          try {
            var r = c.calendar.upsert({ id: m.calId, title: "【BT-EX5 運営会議】" + title, date: date, start: start, end: end, meet: true, description: m.agenda, guests: guests });
            m.calId = r.id; m.meetUrl = r.meetUrl || m.meetUrl || ""; m.link = r.link || "";
          } catch (err) { /* カレンダーに入れられなくても、会議は保存する */ }
        }
        c.saveDb(x.db);
        return c.ok({ meeting: view(x.db, m) });
      }
      function deleteOpsMeeting(body) {
        var x = ops(body); if (x.error) return x.error;
        var m = c.find(x.db.opsMeetings, function (y) { return y.id === body.id; });
        if (!m) return c.fail("NOT_FOUND");
        if (m.calId && c.calendar) { try { c.calendar.remove(m.calId); } catch (err) { /* noop */ } }
        x.db.opsMeetings = x.db.opsMeetings.filter(function (y) { return y.id !== m.id; });
        c.saveDb(x.db);
        return c.ok({});
      }
      // 議事録を貼り付けて残す(Gemini のメモ・自分のメモ)。noteId があれば直す、text を空にすると消す
      function saveOpsNotes(body) {
        var x = ops(body); if (x.error) return x.error;
        var m = c.find(x.db.opsMeetings, function (y) { return y.id === body.id; });
        if (!m) return c.fail("NOT_FOUND");
        if (!m.notes) m.notes = [];
        var text = c.cleanStr(String(body.text || "").replace(/\r\n?/g, "\n"), OPS_NOTE_MAX);
        var url = /^https:\/\/[^\s"'<>]+$/.test(String(body.url || "")) ? c.cleanStr(body.url, 500) : "";
        var n = body.noteId ? c.find(m.notes, function (y) { return y.id === body.noteId; }) : null;
        if (n && !text && !url) { m.notes = m.notes.filter(function (y) { return y.id !== n.id; }); c.saveDb(x.db); return c.ok({ meeting: view(x.db, m) }); }
        if (!text && !url) return c.fail("INVALID_REQUEST", "議事録の内容か、リンクを入れてください。");
        if (!n) { n = { id: "nt_" + c.randomHex(5), source: "manual" }; m.notes.push(n); }
        n.title = c.cleanStr(body.title, 80) || "議事録"; n.text = text; n.url = url; n.by = x.id; n.at = c.nowMs();
        c.saveDb(x.db);
        return c.ok({ meeting: view(x.db, m) });
      }
      // Google Meet の「Gemini によるメモ」・文字起こしを読みこむ(共有サーバーで Meet・ドキュメントが使えるとき)
      function pullNotes(db, m) {
        if (!c.meet || !c.meet.notes || (!m.calId && !m.meetUrl)) return 0;
        var got = c.meet.notes({ calId: m.calId || "", meetUrl: m.meetUrl || "" }) || [];
        var added = 0;
        if (!m.notes) m.notes = [];
        got.forEach(function (g) {
          if (!g || !g.text) return;
          var key = String(g.url || g.title);
          var cur = c.find(m.notes, function (y) { return y.source !== "manual" && (y.url || y.title) === key; });
          if (cur) { cur.text = c.cleanStr(g.text, OPS_NOTE_MAX); cur.at = c.nowMs(); return; }
          m.notes.push({ id: "nt_" + c.randomHex(5), source: g.kind === "transcript" ? "transcript" : "gemini", title: c.cleanStr(g.title, 120), text: c.cleanStr(g.text, OPS_NOTE_MAX), url: c.cleanStr(g.url, 500), at: c.nowMs() });
          added++;
        });
        m.notesCheckedAt = c.nowMs();
        return added;
      }
      function fetchOpsNotes(body) {
        var x = ops(body); if (x.error) return x.error;
        var m = c.find(x.db.opsMeetings, function (y) { return y.id === body.id; });
        if (!m) return c.fail("NOT_FOUND");
        if (!c.meet || !c.meet.notes) return c.fail("INVALID_REQUEST", "共有サーバーで Google Meet と連携すると、会議のあとに議事録を自動で読みこめます。いまはメモを貼り付けてください。");
        var added = 0;
        try { added = pullNotes(x.db, m); } catch (err) { return c.fail("INVALID_REQUEST", "議事録を読みこめませんでした。会議の主催者の Google アカウントで、Gemini のメモがオンになっていたか確かめてください。"); }
        c.saveDb(x.db);
        return c.ok({ meeting: view(x.db, m), added: added });
      }
      // 1時間ごと: 終わってから3日以内の会議で、まだ議事録のないものを読みこむ
      function jobOpsNotes() {
        var db = c.ensureDb();
        if (!c.meet || !c.meet.notes || !Array.isArray(db.opsMeetings)) return 0;
        var now = c.nowMs(), n = 0;
        db.opsMeetings.forEach(function (m) {
          var endMs = Date.parse(m.date + "T" + (m.end || m.start || "23:59") + ":00+09:00");
          if (!(endMs < now && now - endMs < 3 * 86400000)) return;
          if ((m.notes || []).some(function (y) { return y.source === "gemini"; })) return;
          if (m.notesCheckedAt && now - m.notesCheckedAt < 50 * 60000) return;
          try { n += pullNotes(db, m); } catch (err) { m.notesCheckedAt = now; }
        });
        c.saveDb(db);
        return n;
      }
      return {
        actions: { listOpsMeetings: listOpsMeetings, saveOpsMeeting: saveOpsMeeting, deleteOpsMeeting: deleteOpsMeeting, saveOpsNotes: saveOpsNotes, fetchOpsNotes: fetchOpsNotes },
        jobs: { syncMeet: jobOpsNotes },
      };
    },
  });
})();


// ---------- auth/server-billing.js ----------
// ============================================
// auth/server-billing.js — 会費と領収書(ひな形)
// いまは会費 0円で動かし、あとから金額・決済リンク(Stripe の Payment Links など)を入れるだけで有料にできる。
//
//   会員       getMyBilling(会費のプランと、自分の明細の一覧。今の期間の明細はこのとき作る)
//   管理者     adminBilling(期間ごとの全員の明細と合計)/ adminSaveBilling(プラン・発行者・決済リンク)/
//              adminSetInvoice(支払い済み・未払い・免除にする。支払い済みにすると領収書の番号をつける)
//
// 保存の形 db.billing = {
//   plan: { name, amount(円・税込), cycle: "monthly" | "yearly", taxRate(%) },
//   issuer: { name, regNo(インボイスの登録番号 T+13けた), address, contact },
//   payUrl(決済のページ。空なら「お支払い方法は運営からご案内します」), note,
//   invoices: [{ id, memberId, period("2026-10" か "2026"), amount, status: "free" | "unpaid" | "paid" | "exempt",
//                issuedAt, paidAt, method, receiptNo }],
//   seq: 領収書の番号の連番
// }
// ============================================

(function () {
  "use strict";
  var JST = 9 * 60 * 60 * 1000;
  var STATUSES = ["free", "unpaid", "paid", "exempt"];
  var CYCLES = ["monthly", "yearly"];
  var METHODS = ["", "カード", "振込", "現金", "その他"];

  BtexServerCore.registerModule({
    mutating: ["adminSaveBilling", "adminSetInvoice"],
    create: function (c) {
      function today() { return new Date(c.nowMs() + JST).toISOString().slice(0, 10); }
      function who(body) {
        var db = c.ensureDb();
        var a = c.authSession(db, body.sessionToken);
        if (!a) return { error: c.fail("SESSION_INVALID") };
        var me = c.find(db.referralMembers || [], function (m) { return m.id === a.user.memberId; });
        if (!me) return { error: c.fail("SESSION_INVALID") };
        return { db: db, me: me, id: me.id, isAdmin: a.isAdmin };
      }
      function admin(body) {
        var w = who(body);
        if (w.error) return w;
        if (!w.isAdmin) return { error: c.fail("FORBIDDEN_ADMIN") };
        return w;
      }
      function billing(db) {
        if (!db.billing || typeof db.billing !== "object") {
          db.billing = {
            plan: { name: "BT-EX5 会員", amount: 0, cycle: "monthly", taxRate: 10 },
            issuer: { name: "BT-EX5 運営", regNo: "", address: "", contact: "" },
            payUrl: "", note: "", invoices: [], seq: 0,
          };
        }
        return db.billing;
      }
      function periodOf(b, dateKey) { return b.plan.cycle === "yearly" ? dateKey.slice(0, 4) : dateKey.slice(0, 7); }
      function periodLabel(b, p) { return p.length === 4 ? p + "年分" : Number(p.slice(0, 4)) + "年" + Number(p.slice(5, 7)) + "月分"; }
      // その期間の明細がなければ作る(金額は、そのときのプランの金額)
      function ensureInvoice(db, memberId, period) {
        var b = billing(db);
        var inv = c.find(b.invoices, function (x) { return x.memberId === memberId && x.period === period; });
        if (inv) return { inv: inv, created: false };
        var amount = Number(b.plan.amount) || 0;
        inv = { id: "inv_" + c.randomHex(6), memberId: memberId, period: period, amount: amount, status: amount > 0 ? "unpaid" : "free", issuedAt: c.nowMs(), paidAt: 0, method: "", receiptNo: "" };
        b.invoices.push(inv);
        // 古い明細は 26人×5年分ほどで切る(保存の量を抑える)
        if (b.invoices.length > 3000) b.invoices.splice(0, b.invoices.length - 3000);
        return { inv: inv, created: true };
      }
      // 税込の金額から、うち消費税(10%などの切り捨て)
      function taxOf(amount, rate) { return Math.floor((Number(amount) || 0) * rate / (100 + rate)); }
      function invView(db, b, x) {
        var m = c.find(db.referralMembers || [], function (r) { return r.id === x.memberId; });
        return {
          id: x.id, memberId: x.memberId, name: m ? m.name : "(退会したメンバー)", company: m ? (m.company || "") : "",
          period: x.period, periodLabel: periodLabel(b, x.period), amount: x.amount, tax: taxOf(x.amount, b.plan.taxRate || 10),
          status: x.status, issuedAt: x.issuedAt, paidAt: x.paidAt || 0, method: x.method || "", receiptNo: x.receiptNo || "",
        };
      }
      function publicPlan(b) {
        return {
          plan: { name: b.plan.name, amount: b.plan.amount, cycle: b.plan.cycle, taxRate: b.plan.taxRate || 10 },
          issuer: { name: b.issuer.name, regNo: b.issuer.regNo, address: b.issuer.address, contact: b.issuer.contact },
          payUrl: b.payUrl || "", note: b.note || "",
        };
      }

      function getMyBilling(body) {
        var w = who(body);
        if (w.error) return w.error;
        var b = billing(w.db);
        var cur = ensureInvoice(w.db, w.id, periodOf(b, today()));
        if (cur.created) c.saveDb(w.db);
        var mine = b.invoices.filter(function (x) { return x.memberId === w.id; })
          .sort(function (a, z) { return z.period.localeCompare(a.period); })
          .map(function (x) { return invView(w.db, b, x); });
        return c.ok(Object.assign(publicPlan(b), { current: invView(w.db, b, cur.inv), items: mine }));
      }

      function adminBilling(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var b = billing(w.db);
        var period = String(body.period || "");
        if (!/^\d{4}(-\d{2})?$/.test(period)) period = periodOf(b, today());
        var changed = false;
        (w.db.referralMembers || []).forEach(function (m) { if (ensureInvoice(w.db, m.id, period).created) changed = true; });
        if (changed) c.saveDb(w.db);
        // 並びは名簿の順(ほかの画面と同じ)
        var order = {};
        (w.db.referralMembers || []).forEach(function (m, i) { order[m.id] = i; });
        var orderOf = function (id) { return id in order ? order[id] : 1e6; };
        var rows = b.invoices.filter(function (x) { return x.period === period; }).map(function (x) { return invView(w.db, b, x); })
          .sort(function (a, z) { return orderOf(a.memberId) - orderOf(z.memberId); });
        var sum = function (st) { return rows.filter(function (r) { return r.status === st; }).reduce(function (s, r) { return s + r.amount; }, 0); };
        return c.ok(Object.assign(publicPlan(b), {
          period: period, periodLabel: periodLabel(b, period), rows: rows,
          totals: { paid: sum("paid"), unpaid: sum("unpaid"), count: rows.length, unpaidCount: rows.filter(function (r) { return r.status === "unpaid"; }).length },
          methods: METHODS.slice(1),
        }));
      }

      function adminSaveBilling(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var b = billing(w.db);
        var p = body.plan || {}, iss = body.issuer || {};
        var amount = Math.round(Number(String(p.amount === undefined ? b.plan.amount : p.amount).replace(/[^\d]/g, "")) || 0);
        if (amount > 10000000) return c.fail("INVALID_REQUEST", "会費は1,000万円までで入れてください。");
        var regNo = c.cleanStr(iss.regNo, 20).toUpperCase().replace(/[\s-]/g, "");
        if (regNo && !/^T\d{13}$/.test(regNo)) return c.fail("INVALID_REQUEST", "登録番号は「T」と13けたの数字で入れてください(例: T1234567890123)。");
        var payUrl = c.cleanStr(body.payUrl, 500);
        if (payUrl && !/^https:\/\/[^\s"'<>]+$/.test(payUrl)) return c.fail("INVALID_REQUEST", "決済のページの URL は https:// から入れてください。");
        b.plan = {
          name: c.cleanStr(p.name, 60) || "BT-EX5 会員",
          amount: amount,
          cycle: CYCLES.indexOf(p.cycle) !== -1 ? p.cycle : b.plan.cycle,
          taxRate: [8, 10].indexOf(Number(p.taxRate)) !== -1 ? Number(p.taxRate) : 10,
        };
        b.issuer = { name: c.cleanStr(iss.name, 80) || "BT-EX5 運営", regNo: regNo, address: c.cleanStr(iss.address, 160), contact: c.cleanStr(iss.contact, 120) };
        b.payUrl = payUrl;
        b.note = c.cleanStr(body.note, 300);
        // まだ払われていない今の期間の明細は、新しい金額に合わせる
        var period = periodOf(b, today());
        b.invoices.forEach(function (x) {
          if (x.period === period && (x.status === "unpaid" || x.status === "free")) { x.amount = amount; x.status = amount > 0 ? "unpaid" : "free"; }
        });
        c.saveDb(w.db);
        return c.ok(publicPlan(b));
      }

      function adminSetInvoice(body) {
        var w = admin(body);
        if (w.error) return w.error;
        var b = billing(w.db);
        var x = c.find(b.invoices, function (i) { return i.id === c.cleanStr(body.id, 40); });
        if (!x) return c.fail("NOT_FOUND");
        var st = STATUSES.indexOf(body.status) !== -1 ? body.status : x.status;
        if (st === "free" && x.amount > 0) st = "unpaid";
        x.status = st;
        x.method = METHODS.indexOf(body.method) !== -1 ? body.method : x.method;
        if (st === "paid") {
          if (!x.paidAt) x.paidAt = c.nowMs();
          // 領収書の番号は、はじめて支払い済みにしたときに1回だけつける(R-2026-0001)
          if (!x.receiptNo) { b.seq = (b.seq || 0) + 1; x.receiptNo = "R-" + today().slice(0, 4) + "-" + ("000" + b.seq).slice(-4); }
        } else { x.paidAt = 0; }
        c.saveDb(w.db);
        return c.ok({ item: invView(w.db, b, x) });
      }

      return {
        actions: { getMyBilling: getMyBilling, adminBilling: adminBilling, adminSaveBilling: adminSaveBilling, adminSetInvoice: adminSetInvoice },
      };
    },
  });
})();


// ---------- gas/webpush.js ----------
// ============================================
// gas/webpush.js — Web プッシュ通知(iPhone・Android・パソコン)を送るための署名
//
// Web プッシュでは、送り手であることを示す VAPID(ES256 = P-256 の ECDSA 署名)が必要。
// Apps Script には ES256 の署名がないため、ここで P-256 の計算を BigInt で行う。
// 送るのは「中身のない合図」だけ(中身の暗号化はしない)。合図を受けた端末の
// サービスワーカー(sw.js)が、会員サイトから最新のお知らせを取りに来て表示する。
//
// 使い方(gas/main.js):
//   var keys = WebPush.generateKeys(randomBytes)      // { privateHex, publicKey }(初回だけ)
//   var auth = WebPush.vapidHeader(endpoint, keys, subject, nowSec, hmacSha256)
//   → Authorization ヘッダーの値("vapid t=..., k=...")
// ============================================

var WebPush = (function () {
  "use strict";

  // ---------- P-256(secp256r1) ----------
  var P = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff");
  var N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
  var A = P - BigInt(3);
  var GX = BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296");
  var GY = BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5");
  var ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2), THREE = BigInt(3);

  function mod(a, m) { var r = a % m; return r < ZERO ? r + m : r; }
  function inv(a, m) {
    // 拡張ユークリッド
    var lm = ONE, hm = ZERO, low = mod(a, m), high = m;
    while (low > ONE) {
      var r = high / low;
      var nm = hm - lm * r, nw = high - low * r;
      hm = lm; high = low; lm = nm; low = nw;
    }
    return mod(lm, m);
  }

  // ヤコビアン座標 [X, Y, Z]
  function dbl(p) {
    var X = p[0], Y = p[1], Z = p[2];
    if (Y === ZERO || Z === ZERO) return [ZERO, ONE, ZERO];
    var YY = mod(Y * Y, P);
    var S = mod(BigInt(4) * X * YY, P);
    var ZZ = mod(Z * Z, P);
    var M = mod(THREE * X * X + A * ZZ * ZZ, P);
    var X3 = mod(M * M - TWO * S, P);
    var Y3 = mod(M * (S - X3) - BigInt(8) * YY * YY, P);
    var Z3 = mod(TWO * Y * Z, P);
    return [X3, Y3, Z3];
  }
  function add(p, q) {
    if (p[2] === ZERO) return q;
    if (q[2] === ZERO) return p;
    var Z1Z1 = mod(p[2] * p[2], P), Z2Z2 = mod(q[2] * q[2], P);
    var U1 = mod(p[0] * Z2Z2, P), U2 = mod(q[0] * Z1Z1, P);
    var S1 = mod(p[1] * q[2] * Z2Z2, P), S2 = mod(q[1] * p[2] * Z1Z1, P);
    if (U1 === U2) return S1 === S2 ? dbl(p) : [ZERO, ONE, ZERO];
    var H = mod(U2 - U1, P), R = mod(S2 - S1, P);
    var HH = mod(H * H, P), HHH = mod(H * HH, P), V = mod(U1 * HH, P);
    var X3 = mod(R * R - HHH - TWO * V, P);
    var Y3 = mod(R * (V - X3) - S1 * HHH, P);
    var Z3 = mod(H * p[2] * q[2], P);
    return [X3, Y3, Z3];
  }
  function mul(k, x, y) {
    var R = [ZERO, ONE, ZERO], Q = [x, y, ONE];
    var bits = k.toString(2);
    for (var i = 0; i < bits.length; i++) {
      R = dbl(R);
      if (bits[i] === "1") R = add(R, Q);
    }
    if (R[2] === ZERO) throw new Error("point at infinity");
    var zi = inv(R[2], P), zi2 = mod(zi * zi, P);
    return [mod(R[0] * zi2, P), mod(R[1] * zi2 * zi, P)];
  }

  // ---------- 文字・バイト ----------
  function hexToBytes(h) { var o = []; for (var i = 0; i < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; }
  function bytesToHex(b) { return b.map(function (x) { return ((x & 255) < 16 ? "0" : "") + (x & 255).toString(16); }).join(""); }
  function bigToBytes(n, len) { var h = n.toString(16); while (h.length < len * 2) h = "0" + h; return hexToBytes(h); }
  function bytesToBig(b) { return b.length ? BigInt("0x" + bytesToHex(b)) : ZERO; }
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function b64url(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var n = ((bytes[i] & 255) << 16) | (((bytes[i + 1] || 0) & 255) << 8) | ((bytes[i + 2] || 0) & 255);
      out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
      if (i + 1 < bytes.length) out += B64[(n >>> 6) & 63];
      if (i + 2 < bytes.length) out += B64[n & 63];
    }
    return out;
  }
  function utf8(s) {
    var t = unescape(encodeURIComponent(String(s)));
    var o = new Array(t.length);
    for (var i = 0; i < t.length; i++) o[i] = t.charCodeAt(i);
    return o;
  }

  // ---------- 鍵 ----------
  // randomBytes(n) → 0〜255 の配列
  function generateKeys(randomBytes) {
    var d = ZERO;
    while (d === ZERO || d >= N) d = bytesToBig(randomBytes(32));
    var Q = mul(d, GX, GY);
    return { privateHex: d.toString(16), publicKey: b64url([4].concat(bigToBytes(Q[0], 32), bigToBytes(Q[1], 32))) };
  }

  // ---------- ECDSA 署名(k は RFC 6979 で決める。乱数の質に頼らない) ----------
  // hmac(keyBytes, msgBytes) → 32バイトの配列
  function sign(msgBytes, privateHex, sha256Bytes, hmac) {
    var d = BigInt("0x" + privateHex);
    var h1 = sha256Bytes(msgBytes);
    var e = bytesToBig(h1);
    var x = bigToBytes(d, 32), hb = bigToBytes(mod(e, N), 32);
    var V = [], K = [], i;
    for (i = 0; i < 32; i++) { V.push(1); K.push(0); }
    K = hmac(K, V.concat([0], x, hb)); V = hmac(K, V);
    K = hmac(K, V.concat([1], x, hb)); V = hmac(K, V);
    for (;;) {
      V = hmac(K, V);
      var k = bytesToBig(V);
      if (k > ZERO && k < N) {
        var R = mul(k, GX, GY);
        var r = mod(R[0], N);
        var s = mod(inv(k, N) * (e + r * d), N);
        if (r !== ZERO && s !== ZERO) return bigToBytes(r, 32).concat(bigToBytes(s, 32));
      }
      K = hmac(K, V.concat([0])); V = hmac(K, V);
    }
  }

  // VAPID の Authorization ヘッダー(RFC 8292)
  function vapidHeader(endpoint, keys, subject, nowSec, sha256Bytes, hmac) {
    var aud = String(endpoint).match(/^https:\/\/[^/]+/)[0];
    var header = b64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
    var payload = b64url(utf8(JSON.stringify({ aud: aud, exp: nowSec + 12 * 60 * 60, sub: subject })));
    var input = header + "." + payload;
    var sig = sign(utf8(input), keys.privateHex, sha256Bytes, hmac);
    return "vapid t=" + input + "." + b64url(sig) + ", k=" + keys.publicKey;
  }

  return { generateKeys: generateKeys, sign: sign, vapidHeader: vapidHeader, b64url: b64url, utf8: utf8 };
})();


// ---------- gas/main.js ----------
// ============================================
// gas/main.js — 共有サーバー(Google Apps Script)の入口
//
// スプレッドシートに紐づいた Apps Script として動かす。判定の本体は
// auth/server-core.js(ブラウザ内デモと同じコード)で、ここではデータの
// 保存先をスプレッドシートにして、Web アプリとして公開する。
// tools/build-gas.mjs が referral/data.js・auth/server-core.js と
// このファイルをつないで gas/Code.gs を作る(Code.gs を直接編集しない)。
//
// 保存:
//   「_data」シート … 全データの JSON を 4万文字ずつ A 列に分けて保存(非表示)
//   「名簿」「紹介の記録」「ありがとうマイル」「定例会の出欠」「ビジター」「1on1」シート
//     … 運営者が見るための一覧(書き込みのたびに更新。ここを書き換えてもサイトには反映されない)
// 同時アクセスはスクリプトロックで1件ずつ処理する。
// ============================================

/**
 * @OnlyCurrentDoc
 */

var DATA_SHEET = "_data";
var CHUNK_SIZE = 40000; // セルの上限(5万文字)より小さく
var STATUS_LABELS_JA = { new: "未対応", contacted: "連絡済み", meeting: "商談中", won: "成約", lost: "見送り" };
var VISITOR_LABELS_JA = { invited: "招待中", applied: "参加申込", confirmed: "参加確定", attended: "参加済み", joined: "入会", declined: "見送り" };
var RSVP_LABELS_JA = { yes: "出席", no: "欠席" };

function spreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function dataSheet_() {
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DATA_SHEET);
    sh.getRange("A:A").setNumberFormat("@");
    sh.hideSheet();
  }
  return sh;
}

function loadDb_() {
  var sh = dataSheet_();
  var last = sh.getLastRow();
  if (last < 1) return null;
  // 各セルの先頭1文字は目印("j")。数式や数値として解釈されるのを防ぐ
  var text = sh.getRange(1, 1, last, 1).getValues()
    .map(function (r) { return String(r[0]).slice(1); })
    .join("");
  if (!text) return null;
  var db = JSON.parse(text); // 壊れていたら例外 → SERVER_ERROR(データを上書きしない)
  LAST_TEXT_ = JSON.stringify(db);
  return db;
}

// 読んだときと中身が同じなら書かない(見るだけの操作で、シートへの書きこみを待たせない)
var LAST_TEXT_ = null;
// ロックなしで読んでいるとき(NO_LOCK_)は書かずに目印だけ立て、ロックを取ってやり直す
var NO_LOCK_ = false;
var NEEDS_LOCK_ = false;
function saveDb_(db) {
  var text = JSON.stringify(db);
  if (text === LAST_TEXT_) return;
  if (NO_LOCK_) { NEEDS_LOCK_ = true; return; }
  var sh = dataSheet_();
  LAST_TEXT_ = text;
  var rows = [];
  for (var i = 0; i < text.length; i += CHUNK_SIZE) rows.push(["j" + text.slice(i, i + CHUNK_SIZE)]);
  sh.getRange(1, 1, rows.length, 1).setValues(rows);
  var last = sh.getLastRow();
  if (last > rows.length) sh.getRange(rows.length + 1, 1, last - rows.length, 1).clearContent();
}

// Utilities.getUuid()(UUID v4)から乱数を取り出す。版・種別の桁を含むバイトは使わない
function randomBytes_(n) {
  var out = [];
  while (out.length < n) {
    var hex = Utilities.getUuid().replace(/-/g, "");
    for (var i = 0; i + 1 < hex.length; i += 2) {
      if (i === 12 || i === 16) continue;
      out.push(parseInt(hex.substr(i, 2), 16));
    }
  }
  return out.slice(0, n);
}

// ---------- Google カレンダー(定例会・1on1 の予定と Google Meet) ----------
// Apps Script の「サービス」で「Google Calendar API」を追加すると使える(gas/README.md)。
// 予定は運営者のアカウントに作る専用カレンダー「BT-EX5 定例会・1on1」に入れる(1on1 は2人に招待を送る)
var CALENDAR_PROP = "BTEX5_1ON1_CALENDAR_ID";
function oneOnOneCalendarId_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CALENDAR_PROP);
  if (id && CalendarApp.getCalendarById(id)) return id;
  var cal = CalendarApp.createCalendar("BT-EX5 定例会・1on1", { timeZone: "Asia/Tokyo" });
  props.setProperty(CALENDAR_PROP, cal.getId());
  return cal.getId();
}
function calTime_(date, time) {
  return { dateTime: date + "T" + time + ":00+09:00", timeZone: "Asia/Tokyo" };
}
var CALENDAR_ = typeof Calendar === "undefined" ? null : {
  upsert: function (x) {
    var calId = oneOnOneCalendarId_();
    var nextDay = function (d) {
      var t = new Date(d + "T00:00:00+09:00");
      t.setDate(t.getDate() + 1);
      return Utilities.formatDate(t, "Asia/Tokyo", "yyyy-MM-dd");
    };
    var ev = {
      summary: x.title,
      description: x.description,
      location: x.location || "",
      start: x.start ? calTime_(x.date, x.start) : { date: x.date },
      // 日付をまたぐ 1on1(22:30〜翌3:00 など)は、終わりの日付 x.endDate を使う
      end: x.start ? calTime_(x.endDate || x.date, x.end) : { date: nextDay(x.date) },
      attendees: (x.guests || []).map(function (e) { return { email: e }; }),
      // 招待された人どうしで、相手のメールアドレスが見えないようにする(カレンダー用のメールは本人だけのもの)
      guestsCanSeeOtherGuests: false,
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
    };
    var opts = { conferenceDataVersion: 1, sendUpdates: "all" };
    var result;
    if (x.meet) {
      ev.conferenceData = { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
    }
    if (x.id) {
      // 既にある Meet はそのまま使う(作り直すと URL が変わるため)
      try {
        var cur = Calendar.Events.get(calId, x.id);
        if (x.meet && cur.conferenceData) ev.conferenceData = cur.conferenceData;
        if (!x.meet) ev.conferenceData = null;
        result = Calendar.Events.patch(ev, calId, x.id, opts);
      } catch (err) {
        result = Calendar.Events.insert(ev, calId, opts);
      }
    } else {
      result = Calendar.Events.insert(ev, calId, opts);
    }
    return { id: result.id, meetUrl: result.hangoutLink || "", link: result.htmlLink || "" };
  },
  remove: function (id) {
    Calendar.Events.remove(oneOnOneCalendarId_(), id, { sendUpdates: "all" });
  },
};

// ---------- Google Meet の参加記録(出欠の自動判定) ----------
// Google Meet REST API で、会議に参加した人の表示名と参加時間(分)を読む。
// 使うには gas/README.md の手順(Google Cloud のプロジェクトで「Google Meet REST API」を有効にする)が必要
function meetGet_(url) {
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error("Meet API " + res.getResponseCode() + " " + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText());
}
function meetList_(url, key) {
  var out = [], token = "";
  do {
    var page = meetGet_(url + (url.indexOf("?") === -1 ? "?" : "&") + "pageSize=100" + (token ? "&pageToken=" + encodeURIComponent(token) : ""));
    out = out.concat(page[key] || []);
    token = page.nextPageToken || "";
  } while (token);
  return out;
}
var MEET_ = {
  attendance: function (meetUrl) {
    var m = String(meetUrl).match(/meet\.google\.com\/([a-z0-9-]+)/i);
    if (!m) return [];
    var API = "https://meet.googleapis.com/v2/";
    var space = meetGet_(API + "spaces/" + m[1]);
    var records = meetList_(API + "conferenceRecords?filter=" + encodeURIComponent('space.name="' + space.name + '"'), "conferenceRecords");
    var totals = {};
    records.forEach(function (rec) {
      meetList_(API + rec.name + "/participants", "participants").forEach(function (p) {
        var name = (p.signedinUser && p.signedinUser.displayName) || (p.anonymousUser && p.anonymousUser.displayName) || (p.phoneUser && p.phoneUser.displayName) || "";
        var ms = 0;
        meetList_(API + p.name + "/participantSessions", "participantSessions").forEach(function (sess) {
          if (!sess.startTime) return;
          var end = sess.endTime ? new Date(sess.endTime) : new Date();
          ms += Math.max(0, end - new Date(sess.startTime));
        });
        if (name) totals[name] = (totals[name] || 0) + ms;
      });
    });
    return Object.keys(totals).map(function (n) { return { name: n, minutes: Math.round(totals[n] / 60000) }; });
  },
  // 運営会議の議事録: カレンダーの予定に付いた「Gemini によるメモ」・文字起こし(Google ドキュメント)の中身を読む。
  // 予定に付いていないときは、Meet REST API の文字起こし(transcripts)から読む
  notes: function (x) {
    var out = [];
    var docText = function (id) { return DocumentApp.openById(id).getBody().getText(); };
    if (x.calId) {
      try {
        var ev = Calendar.Events.get(oneOnOneCalendarId_(), x.calId);
        (ev.attachments || []).forEach(function (at) {
          if (!at.fileId || !/document/.test(String(at.mimeType || ""))) return;
          try {
            out.push({ kind: /文字起こし|transcript/i.test(at.title || "") ? "transcript" : "gemini", title: at.title || "議事録", text: docText(at.fileId), url: at.fileUrl || "" });
          } catch (e) { /* 読めないファイルは飛ばす */ }
        });
      } catch (e) { /* 予定が見つからないときは Meet の文字起こしへ */ }
    }
    var m = String(x.meetUrl || "").match(/meet\.google\.com\/([a-z0-9-]+)/i);
    if (!out.length && m) {
      var API = "https://meet.googleapis.com/v2/";
      var space = meetGet_(API + "spaces/" + m[1]);
      meetList_(API + "conferenceRecords?filter=" + encodeURIComponent('space.name="' + space.name + '"'), "conferenceRecords").forEach(function (rec) {
        meetList_(API + rec.name + "/transcripts", "transcripts").forEach(function (t) {
          var d = t.docsDestination;
          if (!d || !d.document) return;
          try { out.push({ kind: "transcript", title: "文字起こし " + String(rec.startTime || "").slice(0, 10), text: docText(d.document), url: d.exportUri || "" }); } catch (e) { /* noop */ }
        });
      });
    }
    return out;
  },
};

// ---------- プッシュ通知(iPhone・Android・パソコン) ----------
// 送り手の鍵(VAPID)は初回に作ってスクリプトのプロパティに保存する(サイトには公開鍵だけを渡す)。
// 送るのは中身のない合図だけで、端末が会員サイトから中身を取りに来る(gas/webpush.js)
var VAPID_PROP = "BTEX5_VAPID_KEYS";
function vapidKeys_() {
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty(VAPID_PROP);
  if (saved) return JSON.parse(saved);
  var keys = WebPush.generateKeys(randomBytes_);
  props.setProperty(VAPID_PROP, JSON.stringify(keys));
  return keys;
}
// Apps Script のバイト列は -128〜127。0〜255 との相互変換
function toSigned_(bytes) { return bytes.map(function (b) { return b > 127 ? b - 256 : b; }); }
function toUnsigned_(bytes) { return bytes.map(function (b) { return b & 255; }); }
function sha256Bytes_(bytes) { return toUnsigned_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, toSigned_(bytes))); }
function hmacBytes_(key, msg) { return toUnsigned_(Utilities.computeHmacSha256Signature(toSigned_(msg), toSigned_(key))); }

// 送り先のサービス(Apple・Google・Mozilla)ごとの署名は 11時間使い回す(署名の計算は重いため)
function vapidAuth_(endpoint, subject) {
  var aud = String(endpoint).match(/^https:\/\/[^/]+/)[0];
  var cache = CacheService.getScriptCache();
  var key = "vapid:" + aud;
  var hit = cache.get(key);
  if (hit) return hit;
  var header = WebPush.vapidHeader(endpoint, vapidKeys_(), subject, Math.floor(Date.now() / 1000), sha256Bytes_, hmacBytes_);
  cache.put(key, header, 11 * 60 * 60);
  return header;
}

// 合図を送る(スクリプトロックを外してから呼ぶ)。届かなくなった端末は名簿から消す
function sendPushes_(job) {
  if (!job || !job.subs || !job.subs.length) return;
  var subject = job.subject || "https://github.com/";
  var requests = job.subs.map(function (s) {
    return {
      url: s.endpoint,
      method: "post",
      headers: { TTL: "86400", Urgency: "normal", Authorization: vapidAuth_(s.endpoint, subject) },
      payload: "",
      muteHttpExceptions: true,
    };
  });
  var gone = [];
  UrlFetchApp.fetchAll(requests).forEach(function (res, i) {
    var code = res.getResponseCode();
    if (code === 404 || code === 410) gone.push(job.subs[i].endpoint);
    else if (code >= 300) console.warn("push " + code + " " + res.getContentText().slice(0, 200));
  });
  if (gone.length) {
    var lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
      try { SERVER_.runJob("dropPushSubs", gone); } finally { lock.releaseLock(); }
    }
  }
}

// パスコードのハッシュ(ソルトと SHA-256)を Script Properties に置くと、そちらを使う。
// ページから配っている auth/server-core.js のハッシュは使われなくなる(総当たりで当てられないように)。
// プロパティ: BTEX5_PASSCODE_MEMBER_SALT / BTEX5_PASSCODE_MEMBER_HASH / BTEX5_PASSCODE_ADMIN_SALT / BTEX5_PASSCODE_ADMIN_HASH
// 作り方は gas/README.md の「パスコードを変える」
function passcodes_() {
  if (typeof PropertiesService === "undefined") return null;
  var p = PropertiesService.getScriptProperties();
  var ms = p.getProperty("BTEX5_PASSCODE_MEMBER_SALT"), mh = p.getProperty("BTEX5_PASSCODE_MEMBER_HASH");
  var as = p.getProperty("BTEX5_PASSCODE_ADMIN_SALT"), ah = p.getProperty("BTEX5_PASSCODE_ADMIN_HASH");
  if (!ms || !mh || !as || !ah) return null;
  return { member: { salt: ms, hash: mh }, admin: { salt: as, hash: ah } };
}

// パスコードを新しくするとき(おすすめ): 下の2行に新しいパスコードを書いて、エディタでこの関数を1回実行する。
// 実行したら、2行は必ず空に戻して保存する(平文を残さない)。ハッシュだけが Script Properties に入る
function setupPasscodes() {
  var MEMBER = ""; // 会員用の共通パスコード(例: abcd-efgh)
  var ADMIN = "";  // 管理者用パスコード(例: abcd-efgh-ijkl)
  if (!MEMBER || !ADMIN) throw new Error("MEMBER と ADMIN に新しいパスコードを書いてから実行してください");
  var hex = function (bytes) { return bytes.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join(""); };
  var norm = function (c) { return String(c).trim().toLowerCase().replace(/[\s-]/g, ""); };
  var digest = function (t) { return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)); };
  var p = PropertiesService.getScriptProperties();
  var ms = hex(randomBytes_(16)), as = hex(randomBytes_(16));
  p.setProperties({
    BTEX5_PASSCODE_MEMBER_SALT: ms, BTEX5_PASSCODE_MEMBER_HASH: digest(ms + ":" + norm(MEMBER)),
    BTEX5_PASSCODE_ADMIN_SALT: as, BTEX5_PASSCODE_ADMIN_HASH: digest(as + ":" + norm(ADMIN)),
  });
  Logger.log("パスコードを設定しました。MEMBER と ADMIN の行を空に戻して保存し、「新しいバージョン」でデプロイしてください。");
}

// ---------- LINE 公式アカウント(任意) ----------
// LINE で通知を送るときだけ使う。設定は setupLine を1回実行するだけ(手順は gas/README.md の「LINE で通知を送る」)
// Script Properties: BTEX5_LINE_TOKEN(チャネルアクセストークン)/ BTEX5_LINE_ADD_URL(友だち追加の URL)/ BTEX5_LINE_HOOK(Webhook の合言葉)
function lineConfig_() {
  if (typeof PropertiesService === "undefined") return null;
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty("BTEX5_LINE_TOKEN");
  if (!token) return null;
  return { addUrl: p.getProperty("BTEX5_LINE_ADD_URL") || "", monthlyLimit: Number(p.getProperty("BTEX5_LINE_LIMIT") || 200) };
}
function setupLine() {
  var TOKEN = "";   // LINE Developers →「Messaging API設定」のチャネルアクセストークン(長期)
  var ADD_URL = ""; // 友だち追加の URL(例: https://lin.ee/xxxx または https://line.me/R/ti/p/@xxxx)
  if (!TOKEN || !ADD_URL) throw new Error("TOKEN と ADD_URL を書いてから実行してください");
  var p = PropertiesService.getScriptProperties();
  var hook = Utilities.getUuid().replace(/-/g, "");
  p.setProperties({ BTEX5_LINE_TOKEN: TOKEN, BTEX5_LINE_ADD_URL: ADD_URL, BTEX5_LINE_HOOK: hook });
  var url = ScriptApp.getService().getUrl();
  Logger.log("LINE の設定を保存しました。TOKEN と ADD_URL の行を空に戻して保存し、「新しいバージョン」でデプロイしてください。\n"
    + "LINE Developers の「Webhook URL」に次を入れて、「Webhookの利用」をオンにしてください:\n" + (url || "(ウェブアプリの URL)") + "?line=" + hook);
}
function lineToken_() { return PropertiesService.getScriptProperties().getProperty("BTEX5_LINE_TOKEN"); }
function lineFetch_(path, payload) {
  return {
    url: "https://api.line.me/v2/bot/message/" + path, method: "post", contentType: "application/json",
    headers: { Authorization: "Bearer " + lineToken_() }, payload: JSON.stringify(payload), muteHttpExceptions: true,
  };
}
// LINE で送る(スクリプトロックを外してから呼ぶ)
function sendLine_(job) {
  if (!job || !job.messages || !job.messages.length || !lineToken_()) return;
  UrlFetchApp.fetchAll(job.messages.map(function (m) { return lineFetch_("push", { to: m.to, messages: [{ type: "text", text: m.text.slice(0, 4900) }] }); }))
    .forEach(function (res) { if (res.getResponseCode() >= 300) console.warn("line " + res.getResponseCode() + " " + res.getContentText().slice(0, 200)); });
}
// LINE からの Webhook(?line=合言葉 のときだけ受け付ける。GAS ではヘッダーの署名を読めないため、URL の合言葉で確かめる)
function handleLineWebhook_(e) {
  var hook = PropertiesService.getScriptProperties().getProperty("BTEX5_LINE_HOOK");
  if (!hook || e.parameter.line !== hook) return json_({ success: false });
  var body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || "{}"); } catch (err) { body = {}; }
  var lock = LockService.getScriptLock();
  var result = { replies: [] };
  if (lock.tryLock(20000)) {
    try { result = SERVER_.runJob("lineWebhook", body.events || [])[0] || result; } catch (err) { console.error(err); } finally { lock.releaseLock(); }
  }
  if (result.replies.length && lineToken_()) {
    UrlFetchApp.fetchAll(result.replies.map(function (r) { return lineFetch_("reply", { replyToken: r.replyToken, messages: [{ type: "text", text: r.text }] }); }));
  }
  return json_({ success: true });
}

// ---------- 写真の置き場所(名簿の本体とは別の隠しシート「_photos」。A列=名前(photo:メンバーID)、B列=写真) ----------
var PHOTO_SHEET = "_photos";
function photoSheet_(create) {
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(PHOTO_SHEET);
  if (!sh && create) {
    sh = ss.insertSheet(PHOTO_SHEET);
    sh.getRange("A:B").setNumberFormat("@");
    sh.hideSheet();
  }
  return sh;
}
var BLOBS_ = {
  get: function (key) {
    var sh = photoSheet_(false);
    if (!sh || sh.getLastRow() < 1) return "";
    var keys = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      // 先頭1文字は目印("j")。数式として読まれないように
      if (String(keys[i][0]) === key) return String(sh.getRange(i + 1, 2).getValue()).slice(1);
    }
    return "";
  },
  set: function (key, value) {
    var sh = photoSheet_(true);
    var last = sh.getLastRow();
    var keys = last ? sh.getRange(1, 1, last, 1).getValues() : [];
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === key) {
        if (value) sh.getRange(i + 1, 2).setValue("j" + value);
        else sh.deleteRow(i + 1);
        return;
      }
    }
    if (value) sh.getRange(last + 1, 1, 1, 2).setValues([[key, "j" + value]]);
  },
};

var SERVER_ = BtexServerCore.createServer({
  blobs: BLOBS_,
  passcodes: passcodes_(),
  line: lineConfig_(),
  load: loadDb_,
  save: saveDb_,
  randomBytes: randomBytes_,
  calendar: CALENDAR_,
  meet: MEET_,
  push: { publicKey: function () { return vapidKeys_().publicKey; } },
  onError: function (err) { console.error(err && err.stack ? err.stack : err); },
});

// ---------- 運営者向けの一覧シート ----------
// 入力値が「=」「+」「-」「@」で始まると数式として扱われるため、先頭に ' を付ける
function cell_(v) {
  var s = Array.isArray(v) ? v.join("、") : String(v === undefined || v === null ? "" : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function writeSheet_(name, header, rows) {
  var ss = spreadsheet_();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  var values = [header].concat(rows);
  sh.getRange(1, 1, values.length, header.length).setValues(values);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight("bold");
}

function fmtTime_(ms) {
  return ms ? Utilities.formatDate(new Date(ms), "Asia/Tokyo", "yyyy/MM/dd HH:mm") : "";
}

function refreshSheets_() {
  var db = loadDb_();
  if (!db) return;
  var members = db.referralMembers || [];
  var onlineLabels = { all: "全国対応", partial: "打合せのみ可", none: "対面のみ", unknown: "未入力" };
  writeSheet_(
    "名簿",
    ["ID", "氏名", "会社名・肩書き", "所属チーム", "拠点", "業種", "事業内容", "主なお客様", "紹介特典", "自己紹介文", "求める紹介", "こんな話が出たら", "対面", "オンライン", "資料・リンク", "最終更新", "更新した人"],
    members.map(function (m) {
      var links = (m.links || []).map(function (l) { return (l.label || l.type) + " " + l.url; }).join("\n");
      return [m.id, m.name, m.company, m.team, m.base, m.category, m.business, m.customers, m.offer, m.selfIntro, m.wants, m.triggers, m.face, onlineLabels[m.online] || "", links, fmtTime_(m.editedAt), m.editedBy === "self" ? "本人" : m.editedBy === "admin" ? "管理者" : ""].map(cell_);
    })
  );
  var memberName = function (id) {
    var m = members.filter(function (x) { return x.id === id; })[0];
    return m ? m.name : "(削除されたメンバー)";
  };
  var userName = function (userId) {
    var u = (db.users || []).filter(function (x) { return x.userId === userId; })[0];
    return u ? u.name : "退会した会員";
  };
  writeSheet_(
    "紹介の記録",
    ["日時", "紹介した人", "紹介先", "紹介した相手", "メモ", "状況", "状況の更新"],
    (db.referralLogs || []).slice().reverse().map(function (l) {
      return [fmtTime_(l.at), userName(l.fromUserId), memberName(l.toMemberId), l.prospect, l.memo, STATUS_LABELS_JA[l.status] || "", fmtTime_(l.statusAt)].map(cell_);
    })
  );
  writeSheet_(
    "ありがとうマイル",
    ["日時", "お礼をした人(仕事を受けた人)", "紹介してくれた人", "金額(円)", "メッセージ"],
    (db.thanks || []).slice().reverse().map(function (t) {
      return [fmtTime_(t.at), memberName(t.from), memberName(t.to), String(t.amount), t.message].map(cell_);
    })
  );
  var events = (db.events || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var rsvpRows = [];
  events.forEach(function (e) {
    members.forEach(function (m) {
      var r = (e.rsvps || {})[m.id] || "";
      var att = (e.attended || []).indexOf(m.id) !== -1;
      if (!r && !att && (e.meetMinutes || {})[m.id] === undefined) return;
      var late = (e.late || []).indexOf(m.id) !== -1;
      var min = (e.meetMinutes || {})[m.id];
      rsvpRows.push([e.date, e.title, m.name, m.team, RSVP_LABELS_JA[r] || "", att ? (late ? "遅刻早退" : "出席") : "", min === undefined ? "" : String(min)].map(cell_));
    });
  });
  writeSheet_("定例会の出欠", ["日付", "定例会", "氏名", "チーム", "出欠の回答", "出欠(結果)", "Meet の参加(分)"], rsvpRows);
  // 会費(auth/server-billing.js の明細。新しい期間から)
  var bill = db.billing || { invoices: [] };
  var BILL_LABELS = { free: "無料", unpaid: "未払い", paid: "支払い済み", exempt: "免除" };
  var nameById = {};
  members.forEach(function (m) { nameById[m.id] = m.name; });
  writeSheet_("会費", ["期間", "氏名", "金額(税込)", "状態", "支払い日", "方法", "領収書番号"],
    (bill.invoices || []).slice().sort(function (a, b) { return b.period.localeCompare(a.period) || String(nameById[a.memberId] || "").localeCompare(String(nameById[b.memberId] || "")); })
      .map(function (x) { return [cell_(x.period), cell_(nameById[x.memberId] || "(退会したメンバー)"), x.amount, BILL_LABELS[x.status] || x.status, x.paidAt ? fmtTime_(x.paidAt) : "", cell_(x.method || ""), cell_(x.receiptNo || "")]; }));
  var eventTitle = function (id) {
    var e = events.filter(function (x) { return x.id === id; })[0];
    return e ? e.date + " " + e.title : "";
  };
  writeSheet_(
    "ビジター",
    ["招待した日", "招待した人", "定例会", "お名前", "会社名", "事業内容", "連絡先", "ひとこと", "状況"],
    (db.visitors || []).slice().reverse().map(function (v) {
      return [fmtTime_(v.at), memberName(v.by), eventTitle(v.eventId), v.name, v.company, v.business, v.contact, v.message, VISITOR_LABELS_JA[v.status] || ""].map(cell_);
    })
  );
  writeSheet_(
    "1on1",
    ["日付", "時刻", "メンバー", "相手", "場所", "状況"],
    (db.oneOnOnes || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (o) {
      return [o.date, o.time, memberName(o.a), memberName(o.b), o.place, { planned: "予定", done: "実施", cancelled: "中止" }[o.status] || ""].map(cell_);
    })
  );
}

// ロックなしで先に読んでよい操作(書きこみが要るときは saveDb_ が目印を立て、ロックを取ってやり直す)
var READ_ACTION_RE_ = /^(get|list|verify|search)[A-Z]/;

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Web アプリの入口 ----------
// サイトからは text/plain で JSON を POST する(プリフライトを避けるため §5)
function doPost(e) {
  if (e && e.parameter && e.parameter.line) return handleLineWebhook_(e);
  var body = null;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "null");
  } catch (err) {
    body = null;
  }
  // 見るだけの操作(get・list・verify・search)は、まずロックを待たずに読む(書き込みの順番待ちで見る人を待たせない)。
  // 読んだあとに書きこみが必要になったとき・書きこみの途中で読めなかったときは、ロックを取ってやり直す
  if (body && typeof body.action === "string" && READ_ACTION_RE_.test(body.action)) {
    NO_LOCK_ = true; NEEDS_LOCK_ = false;
    var quick = null;
    try { quick = SERVER_.handle(body); } catch (err) { quick = null; }
    NO_LOCK_ = false;
    var retry = NEEDS_LOCK_ || !quick || (!quick.success && quick.error && quick.error.code === "SERVER_ERROR");
    NEEDS_LOCK_ = false;
    if (!retry) return json_(quick);
    LAST_TEXT_ = null;
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ success: false, error: { code: "SERVER_ERROR", message: BtexServerCore.ERRORS.SERVER_ERROR } });
  }
  var result, pushJob = null, lineJob = null, changed = false;
  try {
    result = SERVER_.handle(body);
    changed = result.success && body && BtexServerCore.MUTATING_ACTIONS.indexOf(body.action) !== -1;
    if (result.success && body && BtexServerCore.NOTIFY_ACTIONS.indexOf(body.action) !== -1) {
      // 新しいお知らせが届く人の端末を選んでおく(送るのはロックを外してから)
      try { pushJob = SERVER_.runJob("takePushOutbox")[0]; } catch (err) { console.error(err); }
      try { lineJob = SERVER_.runJob("takeLineOutbox")[0]; } catch (err) { console.error(err); }
    }
  } finally {
    lock.releaseLock();
  }
  try { sendPushes_(pushJob); } catch (err) { console.error(err); }
  try { sendLine_(lineJob); } catch (err) { console.error(err); }
  // 運営者向けの一覧シートは、ロックを外してから、多くても1分に1回だけ作り直す
  // (定例会の受付などで一度に多くの人が押しても、待たせない。残りは1時間ごとの処理で作り直す)
  if (changed) {
    try {
      var cache = typeof CacheService === "undefined" ? null : CacheService.getScriptCache();
      if (!cache || !cache.get("btex5-sheets")) { if (cache) cache.put("btex5-sheets", "1", 60); refreshSheets_(); }
      else PropertiesService.getScriptProperties().setProperty("BTEX5_SHEETS_DIRTY", "1");
    } catch (err) { console.error(err); }
  }
  return json_(result);
}

function doGet() {
  return json_({ success: true, data: { service: "BT-EX5 会員サイト API", status: "ok" } });
}

// ---------- 定期実行(1時間ごと) ----------
// 定例会が終わったあと、Google Meet の参加記録から出欠をつける。
// あわせて、時刻を過ぎた 1on1 の「実施しましたか?」などをスマホに通知する
function syncMeetAttendanceJob() {
  // 後回しにした一覧シートの作り直し
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty("BTEX5_SHEETS_DIRTY")) { props.deleteProperty("BTEX5_SHEETS_DIRTY"); refreshSheets_(); }
  } catch (err) { console.error(err); }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var r, pushJob = null, lineJob = null;
  try {
    r = SERVER_.runJob("syncMeet");
    if (r[0] && r[0].synced) refreshSheets_();
    try { pushJob = SERVER_.runJob("takePushOutbox")[0]; } catch (err) { console.error(err); }
    try { lineJob = SERVER_.runJob("takeLineOutbox")[0]; } catch (err) { console.error(err); }
  } finally {
    lock.releaseLock();
  }
  try { sendPushes_(pushJob); } catch (err) { console.error(err); }
  try { sendLine_(lineJob); } catch (err) { console.error(err); }
  return r;
}
// ---------- 毎日のバックアップ(午前3時ごろ) ----------
// 「_data」シート(全データ)を、曜日ごとの非表示シート「_backup_日」〜「_backup_土」に写す(7日分)。
// 間違えて消した・壊れたときは、Apps Script のエディタで restoreLatestBackup を実行すると、
// いちばん新しいバックアップに戻る(戻す前の状態も「_backup_戻す前」に残す)
var BACKUP_DAYS = ["日", "月", "火", "水", "木", "金", "土"];
function copySheetValues_(from, toName) {
  var ss = spreadsheet_();
  var to = ss.getSheetByName(toName);
  if (!to) {
    to = ss.insertSheet(toName);
    to.getRange("A:A").setNumberFormat("@");
    to.hideSheet();
  }
  to.clearContents();
  var last = from.getLastRow();
  if (last < 1) return 0;
  to.getRange(1, 1, last, 1).setValues(from.getRange(1, 1, last, 1).getValues());
  return last;
}
function backupJob() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var name = "_backup_" + BACKUP_DAYS[new Date().getDay()];
    var rows = copySheetValues_(dataSheet_(), name);
    PropertiesService.getScriptProperties().setProperty("BTEX5_LAST_BACKUP", JSON.stringify({ sheet: name, at: Date.now(), rows: rows }));
    return name;
  } finally {
    lock.releaseLock();
  }
}
// いちばん新しいバックアップに戻す(エディタから手で実行する)
function restoreLatestBackup() {
  var info = JSON.parse(PropertiesService.getScriptProperties().getProperty("BTEX5_LAST_BACKUP") || "null");
  if (!info) throw new Error("バックアップがまだありません");
  var ss = spreadsheet_();
  var from = ss.getSheetByName(info.sheet);
  if (!from) throw new Error("バックアップのシートが見つかりません: " + info.sheet);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    copySheetValues_(dataSheet_(), "_backup_戻す前");
    var sh = dataSheet_();
    sh.clearContents();
    copySheetValues_(from, DATA_SHEET);
    loadDb_(); // 読めるか確かめる(壊れていたら例外)
  } finally {
    lock.releaseLock();
  }
  refreshSheets_();
  return Utilities.formatDate(new Date(info.at), "Asia/Tokyo", "yyyy/MM/dd HH:mm") + " のバックアップに戻しました";
}

function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === "syncMeetAttendanceJob" || fn === "backupJob") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncMeetAttendanceJob").timeBased().everyHours(1).create();
  ScriptApp.newTrigger("backupJob").timeBased().everyDays(1).atHour(3).create();
}

// 初回に Apps Script のエディタから一度だけ実行する(権限の承認と、名簿の作成)
function setup() {
  SERVER_.handle({ action: "loginOptions" });
  // Google Calendar API を追加していれば、1on1 用のカレンダーを作っておく(権限の確認もここで出る)
  if (CALENDAR_) oneOnOneCalendarId_();
  // 1時間ごとの処理(Meet の参加記録から出欠をつける・時刻を過ぎた 1on1 の確認を通知する)と、
  // 毎日のバックアップを入れる
  try { installTriggers_(); } catch (err) { console.error("トリガーを入れられませんでした: " + err); }
  SERVER_.handle({ action: "verifySession", sessionToken: "" });
  refreshSheets_();
  return "準備できました。名簿 " + (loadDb_().referralMembers || []).length + " 名";
}
