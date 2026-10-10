// ============================================
// BT-EX5 会員サイト — 共有サーバー(Google Apps Script)
// このファイルは tools/build-gas.mjs が自動で作ったものです。直接編集しないでください。
// 元のファイル: referral/data.js / auth/server-core.js / auth/server-community.js / gas/webpush.js / gas/main.js
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
// (例: 本業がシステム開発でも、Web制作を扱う人は「Web制作」に出る)
const REF_CATEGORY_TOPICS = {
  "AI研修・AI活用": ["ai", "aitraining"],
  "システム開発": ["efficiency", "line"],
  "Web制作": ["web", "seo"],
  "SNS運用・集客": ["sns", "line"],
  "動画編集・映像制作": ["video", "prvideo"],
  "企業PR動画制作": ["prvideo"],
  "作詞作曲・音楽制作": ["music"],
  "声・司会・キャスティング": ["voice", "mc", "recording", "casting"],
  "デザイン・ブランディング": ["design", "branding", "photo"],
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
  { id: "efficiency", group: "it", label: "システム開発・業務効率化", tag: "システム開発" },
  { id: "line", group: "it", label: "公式LINE・LINE Bot構築", tag: "公式LINE構築" },
  { id: "web", group: "it", label: "ホームページ・LP制作", tag: "HP・LP制作" },
  { id: "seo", group: "it", label: "SEO・MEO・AIO対策", tag: "SEO・MEO・AIO" },
  { id: "ec", group: "it", label: "ネットショップ・EC", tag: "EC・ネットショップ" },
  { id: "ai", group: "it", label: "AI活用・AI導入", tag: "AI導入" },
  { id: "aitraining", group: "it", label: "AI研修・AI講座", tag: "AI研修" },
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
    { label: "社員の離職を減らす(定着)", desc: "辞めない職場・人が続く組織にする", topics: ["retention"] },
    { label: "求人ページ・採用サイトを作る", topics: ["web"] },
    { label: "SNSで採用を強くする", topics: ["sns"] },
    { label: "採用動画を作る", topics: ["prvideo"] },
    { label: "業務をシステム・AIで減らす", desc: "人を増やさずに回す", topics: ["efficiency", "ai"] },
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
    { label: "AIを導入する", topics: ["ai"] },
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

// 相談アシスタント(文章・音声で入れた相談を読み取る)で使う言葉
// CONSULT_PHRASES: 困りごとの言い方 → そのとき役に立つジャンル(どれか1つできればよい)
const CONSULT_PHRASES = [
  { label: "集客", words: ["集客", "お客様を増やしたい", "お客さんを増やしたい", "客が来ない", "お客が来ない", "新規客", "問い合わせを増やしたい", "売上が伸びない", "知名度"], topics: ["seo", "web", "sns", "consult", "ad"] },
  { label: "採用・人手不足", words: ["人が採れない", "人が足りない", "人手が足りない", "人手不足", "スタッフが足りない", "スタッフ採用", "求人", "採用したい"], topics: ["hiring", "sns", "prvideo", "efficiency"] },
  { label: "離職・定着", words: ["辞める", "辞めて", "離職", "定着しない", "人が続かない"], topics: ["retention", "org", "coaching"] },
  { label: "人材育成", words: ["育たない", "育てたい", "社員教育", "研修したい", "人材育成"], topics: ["org", "aitraining", "mindset", "coaching"] },
  { label: "単価アップ", words: ["高く売りたい", "単価", "値上げ", "安売り", "価格競争", "付加価値"], topics: ["branding", "consult", "design"] },
  { label: "業務効率化", words: ["効率化", "手作業", "忙しすぎ", "残業", "人手をかけずに", "Excel管理", "エクセル管理", "自動化したい"], topics: ["efficiency", "ai", "line"] },
  { label: "開業・独立", words: ["開業", "独立", "起業", "創業", "お店を出したい", "店を出す"], topics: ["funding", "tax", "legal", "realestate", "reform", "web"] },
  { label: "資金", words: ["資金繰り", "お金が足りない", "融資", "借入", "補助金", "助成金"], topics: ["funding", "labor"] },
  { label: "SNS発信", words: ["発信したい", "インスタを伸ばしたい", "フォロワーを増やしたい", "SNSを始めたい"], topics: ["sns", "video", "photo", "casting"] },
  { label: "AI活用", words: ["AIを使いたい", "AIを導入", "ChatGPT", "生成AI"], topics: ["ai", "aitraining"] },
  { label: "悩み・迷い", words: ["迷って", "悩んで", "モヤモヤ", "考えがまとまらない", "一歩が踏み出せない"], topics: ["mindset", "coaching"] },
  { label: "固定費", words: ["固定費", "携帯代", "携帯料金", "電気代", "光熱費", "節約"], topics: ["fixedcost"] },
  { label: "イベント", words: ["イベント", "パーティー", "懇親会", "周年", "式典", "結婚式", "二次会", "セミナーを開きたい"], topics: ["event", "mc", "catering", "venue"] },
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
  line: ["LINE", "公式LINE", "LINE Bot", "LINEボット", "ステップ配信"],
  web: ["ホームページ", "HP", "Web", "ウェブ", "サイト", "LP"],
  seo: ["SEO", "MEO", "AIO", "LLMO", "AI検索", "検索順位", "Googleマップ", "口コミ"],
  ec: ["EC", "ネットショップ", "通販", "楽天", "Amazon", "ネット販売"],
  ai: ["AI", "ChatGPT", "生成AI", "AI導入"],
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
  casting: ["キャスティング", "モデル", "タレント", "声優", "インフルエンサー", "キャスト"],
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
    company: "Lumenium(ルメニウム)代表",
    team: "フェリシア",
    base: "東京",
    category: "システム開発",
    business:
      "業務効率化システムの開発(予約・在庫・仕入れ・契約書・営業リスト・電話の自動応対・会員制マッチングなど/30万〜600万円)、自分で更新・分析できるホームページ・LP制作(サイト60万円〜・LP30万円〜)、社員向け生成AI研修・AI導入支援・教材制作(講師1回10万円〜)。動画制作・映像編集(PR・SNS・企業紹介・採用・AI動画/5万円〜)、SNS運用代行・LINE構築・LINE Bot(初期20万円〜・月額10万円〜)、ロゴ・バナー・ポスター・イラスト・作詞作曲(3万円〜)、モデル・アクター・MCの手配とイベント企画運営(キャスト1名5,000円〜)。",
    customers: "複数店舗の店舗オーナー/飲食チェーンの店舗統括/SNS運用代行会社/名刺交換の多い経営者/会員制の交流会の運営会社/雑貨店など小売・物販の経営者/士業事務所/研修を行いたい企業",
    note: "相談・見積り無料、48時間以内に返信。最低発注額なし、1業務・研修1回から。動画制作とキャスト手配は制作パートナー(AdvoVisions)と対応。",
    wants:
      "紙・Excel・電話で業務を回している中小企業や複数店舗の経営者(飲食・小売・サロン・士業事務所など)/AIを導入したいが何から始めるか決まっていない会社/動画・SNS・LINEで集客や採用を強くしたい会社",
    triggers: ["手作業に時間がかかる", "予約・在庫管理がバラバラ", "電話予約を取りこぼしている", "HPを作ったきり", "社員にAIを使わせたい", "動画を作りたい", "SNSの運用を任せたい", "公式LINEを作りたい", "ロゴ・チラシ・ポスターを作りたい", "モデル・MCを手配したい", "名刺を営業リストにしたい", "契約書づくりに時間がかかる"],
    face: "関東(東京拠点)",
    faceAreas: ["tokyo"],
    online: "all",
    topics: ["efficiency", "line", "web", "seo", "ai", "aitraining", "sns", "video", "prvideo", "music", "casting", "org", "hiring", "event", "fixedcost", "tutoring"],
    targets: ["restaurant", "retail", "salon", "pro", "build", "it"],
    prospects: ["owner", "staff"],
    // 「紹介文をコピー」に入る本人の自己紹介(本人の依頼で原文のまま)
    selfIntro: "初めまして！\n開発やホームページ制作のノウハウを元に、AI研修講師としてもお仕事させていただいております。\nヤマモトと申します\n以下自己紹介となります\n\n［自己紹介］\n\nお名前　山本捷真(しょーま)\n\n☑️出身　兵庫県\n\n☑️住まい🏠　神奈川県横浜市\n\n☑️お仕事\n\nシステム開発・Webページ制作・AI研修講師\n\nAI歴3年以上のAIのプロフェッショナル\n└ HP：https://lumenium.net\n\n☑️どんな人？\n「IT,AIに強い外部パートナーが欲しい。\nでも、どこに何を頼めばいいかわからない」\n\nそんな経営者様の”最初の窓口”として、\n企画・制作から人材、資金繰りのご相談まで、まとめてお受けしています😊\n\n✅事業内容\n①システム開発、ウェブサイト制作、LINE Bot制作\n└ HP：https://lumenium.net\n\n②企業向けAI関連各種\n→企業向けAI研修の講師\n→AI補助金対策用の解説動画制作\n→社内向けAIメルマガの執筆\n→AI教材／小中学生向け塾教材の制作\n\n③to C向け　携帯料金の見直しのご相談\n\n④小中高生と早慶レベルの家庭教師をつなぐマッチングサービス\n\n✅趣味\nAI💻・仮想通貨📈・ガジェット⌚️\n旅行✈️・温泉♨️・アニメ📺・ポーカー🃏\n\n新しいものを触って試すのが好きです\n\n✅こんな方とお話ししたいです🌼\n・AI活用を進めたい経営者様\n・社内の人手不足を感じている経営者様\n・Web／映像／SNSのパートナーをお探しの方\n \n\n↓【提携先(私の所属している芸能事務所)】↓\n■ 制作(映像・音楽)🎬\n・映像制作、PR動画\n　└ 合同会社AdvoVisions\n　　(芸能事務所・映像制作会社)と提携\n　└ 実績：リンガーハット様、\n　　　一つ星レストラン様 ほか、\n・映像スクール\n\n・芸能キャスト手配、MC、イベント出演\n\n\n\n(以下、作成可能なシステムに↓について)\n\n・Webサイトの裏側にWordpressのような文章編集やお知らせ投稿機能、サイトのアクセス解析、キーワード検索の際の他社との自社サイト出現率等の分析、以上の分析を元に改善案をAIが教えてくれる仕組み。\n\n・SNSアカウントを入れるとアカウント分析と市場分析を行い、動画の脚本・絵コンテを作成し、撮った素材を自動カットしテロップを入れ、各SNSに自動投稿、離脱率等を分析し、PDCAサイクルを回すSNS運用自動化ツール。\n\n・監視カメラと連携した暴力行為の感知システム。\n\n・携帯の番号①③を押して、①なら予約として席数を分析しながら適切な時間の予約を押さえてくれたり、③を押すとクレームやお客様の声を集音から文字起こしし、分析しながら改善案を提案してくれるシステム。\n\n・名刺を写真でアップロードし、営業リストを作成して、☑️を選択した人全てに一斉送信する機能。\n\n・Googleカレンダーと連携し、移動時間を含めた社員全体の予定管理ができるツール→管理職向け。\n\n・ログイン機能付き交流者マッチングツール。\n\n・商品の仕入れや備品管理ができるシステム。\n\n・契約書を作成してくれるシステム。\n\n\n→現在は、各文章系SNSで伸びる投稿文の傾向やパターンを分析し、SNS投稿を自動化するSNS運用ツールを開発中です。",
    links: [
      { type: "proposal", url: "materials/lumenium-proposal.pdf", label: "Lumenium 自己紹介・ご提案(14ページ)", cover: "materials/lumenium-proposal-cover.jpg" },
      { type: "website", url: "https://lumenium.net", label: "lumenium.net" },
      { type: "instagram", url: "https://www.instagram.com/showstagram.keio/", label: "@showstagram.keio" },
      { type: "line", url: "https://line.me/ti/p/2viaHtuXEu", label: "山本 捷真(LINE で友だち追加)" },
    ],
  },
  Object.assign(rosterMember("m02", "あまみや 七音", "echo studio 代表/声優ボイス・ドクター", "Over", "声・司会・キャスティング", ["voice", "mc", "recording", "casting", "video", "health"]), {
    business: "ボイストレーニング教室、レコーディングスタジオ、タレント・声優のキャスティング。",
    customers: "声優の卵、芸能プロダクション、カラオケ好きのビジネスマン、映像制作会社、TV局",
    note: "「長く喋ると喉が枯れる…原因は姿勢と口の開け方と呼吸量」",
    wants: "声優を目指している人/声優やナレーターとしてもっと仕事を取っていきたい人/歌の活動をしていきたい人/喋ったり歌ったりすると声が枯れる人",
    triggers: ["声優になりたい", "ナレーションの仕事を増やしたい", "歌の活動をしたい", "喋ると声が枯れる", "録音スタジオを探している", "声優・タレントを起用したい"],
    targets: ["it", "personal"],
    prospects: ["individual", "owner", "staff"],
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
  Object.assign(rosterMember("m05", "大藤 誠", "SFGビューティ株式会社 代表取締役/世界初・ハラール認証フェイスマスク", "CANOW", "美容・健康", ["beauty", "food"], "東京"), {
    business: "meirune glutathione intensive seat mask(世界初・ハラール認証フェイスマスク)、JUST ONE オールインワンタオル。",
    customers: "美容室・エステサロン・ホテル・温浴施設・介護施設など、衛生面やタオルの洗濯・管理コストに課題を抱えている事業者",
    wants: "美容・宿泊・介護・温浴施設の経営者や仕入れ担当者、複数店舗を展開する企業の購買担当者",
    triggers: ["タオルの洗濯・管理コスト", "衛生面が気になる", "備品の仕入れを見直したい", "フェイスマスク", "ハラール", "ホテル・温浴施設"],
    targets: ["salon", "medical", "retail"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m06", "吉原 優", "FJ 営業", "", "お金・保険", ["insurance", "fixedcost", "family"]), {
    business: "ライフプラン作成、保険提案、保険の見直し、家計の見直し。",
    customers: "誰でも",
    triggers: ["保険を見直したい", "家計を見直したい", "ライフプラン", "老後のお金が不安", "教育費の準備"],
    targets: ["any"],
    prospects: ["individual", "owner"],
  }),
  rosterMember("m07", "樺澤 一郎", "KBlab合同会社 代表", "", "美容・健康", ["health"]),
  Object.assign(rosterMember("m08", "床島 良夫", "非営利団体 人生工房 理事", "SunnyUp🌞", "暮らし・サービス", ["inbound", "kids", "event"]), {
    business: "月面タイムカプセル、パーソナルインバウンドツアー。",
    customers: "地域密着の中小企業、公立・私立学校、体験型講座をお持ちの方",
    note: "月面タイムカプセルとパーソナルインバウンドツアーで外貨を稼ごう!",
    wants: "1/2成人式や元服の儀の誓いなどで取り組んでくれる公立・私立学校と、そのエリアの中小企業/海外で人生工房の会員を募ってくれるインフルエンサー/日本国内でインバウンド客向けの体験型講座を開いてくれる方",
    triggers: ["1/2成人式", "元服", "学校の記念行事", "インバウンド", "外国人観光客", "体験型講座", "海外のインフルエンサー"],
    targets: ["any"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m09", "大場 雅俊", "Ghool株式会社/金融業界に特化したビジネスコンサルティング", "Over", "お金・保険", ["consult", "insurance"]), {
    business: "金融業界に特化したビジネスコンサルティング(集客・コンサル)。",
    wants: "生命保険営業の方",
    triggers: ["生命保険の営業をしている", "保険営業の集客", "金融業界のコンサル"],
    targets: ["pro"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m10", "大枝 篤志", "マイプラBT 代表/売上動線も作れる公式LINE専門家", "Team Bloom∞🌸", "SNS運用・集客", ["sns", "line", "hiring", "fixedcost", "life"]), {
    business: "売上を増やす(売上動線作りのサポート・LINE・SNS)/収入を増やす(副業・紹介案件・人材紹介)/支出を減らす(格安SIM・ガス・Wi-Fiなど固定費の削減)。",
    customers: "30〜50代の男女(特に40代が中心)/個人事業主・フリーランス・中小企業経営者/子育て世代・共働き世帯/会社員で副収入を作りたい人",
    wants: "皆さんが定期的に通われている美容室のオーナー/起業して3年以内の経営者・個人事業主",
    triggers: ["公式LINEを始めたい", "売上動線を作りたい", "副業を始めたい", "固定費を減らしたい", "格安SIM・Wi-Fi", "起業したばかり"],
    targets: ["salon", "any"],
    prospects: ["owner", "individual"],
  }),
  rosterMember("m11", "品川 瑞樹", "株式会社アドバンス/集客・コンサル", "", "SNS運用・集客", ["sns", "web", "consult"]),
  Object.assign(rosterMember("m12", "菅野 節子", "リンパレディアソック 代表者/誰でも健康アドバイザー", "Team Bloom∞🌸", "美容・健康", ["health"]), {
    business: "リンパレディ講座。",
    customers: "セラピスト、施術者、一般のお客様、OL、主婦",
    wants: "体験会の集客(体験会に参加してくれる方)",
    triggers: ["リンパケア", "むくみ・不調", "体験会に参加したい", "セラピスト・施術者", "健康講座"],
    targets: ["salon", "personal"],
    prospects: ["individual", "owner"],
  }),
  rosterMember("m13", "佐藤 慎哉", "", "", "", []),
  Object.assign(rosterMember("m14", "三村 隆", "株式会社エイレム・Guild Master株式会社 代表取締役", "Team Bloom∞🌸", "", ["beauty", "reform", "food"]), {
    business: "美容、リフォーム、飲食、プラットフォーム。",
    customers: "法人・個人問わず",
    wants: "幅広く対応可能です",
    triggers: ["美容", "リフォームしたい", "飲食店", "プラットフォーム"],
    targets: ["any"],
    prospects: ["owner", "staff", "individual"],
  }),
  Object.assign(rosterMember("m16", "桜羽 李果", "株式会社LEFANA/女性向けSNSブランディング", "Team Bloom∞🌸", "デザイン・ブランディング", ["branding", "sns", "web", "design", "video", "photo", "casting"]), {
    business: "女性向けに特化したデザイン会社。ブランディング、Web制作・運営・コンサルティング、グラフィックデザイン、SNS運用代行、インフルエンサー・モデルのキャスティング、写真・映像撮影、ビジネスマッチング。",
    customers: "女性向けの商材をお持ちの方、美容クリニック、お菓子・スイーツ業界、不動産",
    wants: "Webディレクター、Webデザイナー、SNS運用ディレクター、営業など(一緒に働く仲間)",
    triggers: ["女性向けの商品を売りたい", "ブランディング", "SNS運用を任せたい", "インフルエンサーを起用したい", "写真・動画の撮影", "Webデザイナーの仕事を探している"],
    targets: ["salon", "medical", "retail", "restaurant"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m17", "むらさき やえ", "COCOLOR(ココカラー)代表/波動を使った「あなた色ブランディング スタイリスト」", "", "美容・健康", ["color", "branding", "beauty", "spiritual"]), {
    business: "あなた色ブランディングプログラム/(内面)バースカラー診断/(外見)似合う色・質感・柄・形診断/(表現)ブランディングコンサル/スタイリング・ショッピング同行/(プロ養成)CoCoカラースタイリスト養成講座。",
    customers: "「すでに経験も実力もある。でも、まだ自分を活かし切れていない方」。自分の経験や能力をさらに活かし、自分らしく次のステージへ進みたい40〜60代の起業家・経営者・専門職・講師業の方。外見・発信・ブランディングを整え、仕事でも人生でも「自分らしく選ばれる存在」になりたい方。",
    wants: "【法人】アパレル&デザイン&広告関係/結婚相談所/起業支援事業 【個人】「実力はあるのに、なぜか選ばれない」「今の見せ方が本当の自分と合っていない」「これからの人生や仕事を自分らしくステージアップしたい」と感じている40〜60代の起業家・経営者・専門家",
    triggers: ["実力はあるのに選ばれない", "見せ方を変えたい", "似合う色を知りたい", "パーソナルカラー", "ショッピング同行", "セルフブランディング"],
    targets: ["retail", "pro", "any"],
    prospects: ["owner", "individual"],
  }),
  Object.assign(rosterMember("m18", "髙橋 誠二", "スポーツ用品EC事業者/EC運営支援", "CANOW", "EC・ネットショップ", ["ec", "web"]), {
    business: "スポーツ用品のEC事業、EC運営支援。",
    triggers: ["ネットショップを始めたい", "ECの売上を伸ばしたい", "スポーツ用品"],
    targets: ["retail"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m19", "岡本 伸", "株式会社 心灯/目標達成コーチング", "Team Bloom∞🌸", "Web制作", ["web", "seo", "sns", "video", "coaching", "branding", "consult"]), {
    business: "Web制作(HP・SNS運用・SEO・MEO対策・AI動画)、自己ブランディングビジネス(能力開発)。",
    customers: "10名前後の法人様/目標達成が苦手な人/3年目の個人事業主",
    triggers: ["HPを作りたい", "SNS運用を任せたい", "SEO・MEO対策", "AI動画", "目標が達成できない", "自分をブランディングしたい"],
    targets: ["any"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m20", "柏木 本徳", "株式会社REVE 取締役/資金調達コンサル(融資・借換・金策)", "", "お金・保険", ["funding", "beauty"]), {
    business: "資金調達(個人融資・事業融資・借金の借り換え)。脱毛・眉毛・エステ(大阪・心斎橋の都度払いサロン)。",
    customers: "資金調達:毎月の支払いが大変な人、まとまったお金がすぐ欲しい人、事業などで資金が必要な人、どこも審査が通らない人/サロン:清潔感が欲しい人、髭剃りが面倒な人、モテたい人",
    wants: "資金調達を希望の方/ブローカー(紹介業)の方/高単価商材を扱っている方",
    triggers: ["資金繰りが苦しい", "融資を受けたい", "借金を借り換えたい", "審査が通らない", "紹介業をしている", "高単価商材", "脱毛・エステ"],
    targets: ["any"],
    prospects: ["owner", "individual"],
  }),
  Object.assign(rosterMember("m21", "中川 敏和", "", "", "暮らし・サービス", ["family", "event"]), {
    business: "インクルーズ。",
    customers: "0〜5歳の子どものいるご家庭/新婚さん/65歳以上のご夫婦",
    wants: "結婚相談所/サロンオーナー/保険業",
    triggers: ["結婚相談所", "サロンを経営している", "保険の仕事", "新婚さん", "小さな子どものいる家庭", "シニアのご夫婦"],
    targets: ["salon", "pro"],
    prospects: ["owner"],
  }),
  Object.assign(rosterMember("m22", "小林 末季こばねぇ", "preseia 代表/心を整えるマインドコーチ", "SunnyUp🌞", "人材・組織", ["retention", "mindset", "coaching", "org", "consult", "health", "spiritual", "insurance"]), {
    business: "社員の離職率を下げる支援(辞めない職場・人が定着する組織づくり)、思考を整理するマインドセット(個別コーチング)、ビジネスコンサル、健康事業、共済保険。",
    customers: "社員の離職・定着に悩む経営者/頭の中を整理して前に進みたい人/人生に迷いながらも進み出したい人/セミナーを作りたい方/コーチの方/新潟・長野の方",
    wants: "社員がすぐ辞めてしまう・離職率を下げたい経営者/考えがまとまらず一歩が踏み出せない方/新潟・長野の方/コーチングをグレードアップしたい方/健康事業に興味のある方/スピリチュアルに興味のある方",
    triggers: ["社員がすぐ辞める", "離職率を下げたい", "人が定着しない", "頭の中を整理したい", "考えがまとまらない", "人生に迷っている", "セミナーを作りたい", "コーチング", "健康に興味がある", "スピリチュアル", "新潟・長野"],
    targets: ["any"],
    prospects: ["owner", "individual"],
  }),
  Object.assign(rosterMember("m23", "見上 恵", "ちきゅあそびくらぶ/AI絵本クリエイター、スクール講師、クリエイター募集", "Team Bloom∞🌸", "AI研修・AI活用", ["ai", "aitraining", "ehon", "design", "kids"]), {
    business: "AI絵本クリエイター、講座講師。",
    customers: "自分の想いを絵本にしたい方",
    triggers: ["想いを絵本にしたい", "自分史を絵本に残したい", "AI絵本", "クリエイターになりたい", "AIの講座を受けたい"],
    targets: ["any"],
    prospects: ["individual", "owner"],
  }),
  Object.assign(rosterMember("m24", "柳橋 雅也", "合同会社フライコア 代表社員/地方創生", "Team Bloom∞🌸", "暮らし・サービス", ["regional", "inbound", "ai", "efficiency", "reform", "realestate", "ad"]), {
    business: "地方創生コンサル、災害対策商材、AIシステム導入、内装造作費用0円、LED広告透過フィルム。",
    customers: "税収を上げるための働きかけ、余った駐車場スペースの活用、作業効率の向上、内装費用のコスト削減などを考えている方",
    triggers: ["地方創生", "税収を上げたい", "駐車場が余っている", "災害対策", "内装費用を抑えたい", "LED広告", "AIシステムを導入したい"],
    targets: ["any"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m25", "松田 依子", "株式会社Lift 代表取締役/ちきゅうあそびくらぶ", "Team Bloom∞🌸", "暮らし・サービス", ["ehon", "ai", "aitraining", "mc", "voice", "event", "consult", "kids", "health", "insurance"]), {
    business: "AI絵本(自分史絵本・エンディング絵本・感謝の絵本・子育て・親子・技術をわかりやすく等)、司会・MC、コンサル・プロデュース、コミュニケーション・ボイトレ・朗読、芦屋スマートラジオの企画運営・番組、イベント・パーティー企画、コミュニケーション講座、AI講座・AI動画、潜在意識・波動アップ、詐欺に遭わないための金融アドバイザー(本物か見抜く・海外保険・海外銀行等・税金対策)、美容・健康(Life wave・コロイドヨード)。",
    customers: "会社や自身や商品をもっと世に広めたい人、次世代に残したい思いのある人、自分史を絵本にしたい人、販売促進・集客したい人、自分を変えたい人、AI絵本クリエイター資格を学びたい人、AIを学びたい人、健康に困っている人、人生を変えたい人、ちきゅうあそびくらぶの理念に賛同し世界に羽ばたく活動に興味を持ってくれる人",
    wants: "会社や自身や商品をもっと世に広めたい人/次世代に残したい技術・思いのある企業・社長等/終活ビジネス(エンディング絵本)/AI絵本クリエイター資格をとって一緒に活動してくれるクリエイターになりたい人/新しいビジネススキルが欲しい人/ラジオ番組を持ちたい人",
    triggers: ["商品を世に広めたい", "自分史を残したい", "終活", "絵本を作りたい", "ラジオ番組を持ちたい", "司会を頼みたい", "AIを学びたい"],
    targets: ["any"],
    prospects: ["owner", "individual"],
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
];

// 代表・役職・役割と、その基礎ポイント(大きいほど上に出る)
// - マーク: 名前の下に表示する(kind: leader=代表 / post=役職 / role=役割)
// - 紹介診断: 話題かキーワードが合った人の点数に足す(合わない人を上げることはしない)
// - 検索・診断の前の一覧: 利用者本人を先頭にしたうえで、この点数の高い順。ほかは日替わり
const REF_BASE_POINTS = {
  m16: { points: 10, kind: "leader", role: "BT-EX5代表 / プライムリンカー" },
  m09: { points: 9, kind: "leader", role: "BT-EX5代表" },
  m22: { points: 8, kind: "post", role: "甲信越コミュニティ統括班長" },
  m02: { points: 7, kind: "role", role: "LINKセレモニーメイン司会" },
  m14: { points: 6, kind: "role", role: "BT-EX5副代表" },
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
];

// 紹介に効く項目(重要な順)。足りない項目は管理者ページの「お願い文」と、
// 本人への記入のお願いに使う
// BT-EX5 の定例会(はじめに一度だけ入れる。以降は会員アプリの管理者が作成・編集する)。
// 参加リンク(Zoom など)はここに置かない(このファイルは誰でも読めるため)。オンラインの回は Google Meet を作る
const REF_SEED_AGENDA = [
  "①はじめのあいさつ", "②BT-EXの理念", "③エデュケーションコーナー", "④30秒プレゼンテーション",
  "⑤テーブル商談15分 ×2", "⑥LINKのビジネス実績紹介", "⑦終わりの挨拶", "", "★貢献、ありがとう発表は11月以降から",
].join("\n");
const REF_SEED_GUIDE = "新潟メンバーとその他の地域メンバーの入っている日本海側最大マーケットを目指しているユニットです";
const REF_SEED_EVENTS = [
  { seedId: "2026-10-07", title: "日本海側最大のマーケット 新潟⇔東京", date: "2026-10-07", start: "13:00", end: "15:00", deadline: "2026-10-07T23:59" },
  { seedId: "2026-10-17", title: "日本海側最大のマーケット 新潟⇔東京", date: "2026-10-17", start: "20:00", end: "22:00", deadline: "2026-10-15T00:00" },
  { seedId: "2026-11-04", title: "日本海側最大のマーケット 新潟⇔東京", date: "2026-11-04", start: "13:00", end: "15:00", deadline: "2026-11-03T00:00" },
  { seedId: "2026-11-14", title: "日本海側最大のマーケット 新潟⇔東京", date: "2026-11-14", start: "20:00", end: "22:00", deadline: "" },
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
    cat: "雑談",
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

const PROFILE_ITEMS = [
  { key: "range", label: "活動範囲", ask: "活動範囲(新潟・東京/関東で対面できるか、オンラインで対応できるか)", ok: (m) => m.faceAreas.length > 0 || (m.online && m.online !== "unknown") },
  { key: "wants", label: "求める紹介", ask: "求める紹介(どんな悩みを持つ、どんな人を紹介してほしいか)", ok: (m) => Boolean(m.wants) },
  { key: "business", label: "事業内容", ask: "事業内容(取り扱っている商品・サービス)", ok: (m) => Boolean(m.business) },
  { key: "triggers", label: "こんな話が出たら", ask: "こんな話が出たら自分を思い出してほしい、という言葉(3つ以上。例:「HPを作ったきり」「人が採れない」)", ok: (m) => m.triggers.length >= 3 },
  { key: "customers", label: "主なお客様", ask: "主なお客様(どんな方がお客様になっているか)", ok: (m) => Boolean(m.customers) },
  { key: "offer", label: "紹介特典", ask: "紹介特典(BT-EX5のメンバーから紹介されたお客様への特典。例:初回相談無料、初回10%オフ)", ok: (m) => Boolean(m.offer) },
];

function missingProfileItems(m) {
  return PROFILE_ITEMS.filter((it) => !it.ok(m));
}

// プロフィールの記入状況(求める紹介・活動範囲が入っていれば「記入済み」)
function isProfileComplete(m) {
  return Boolean(m.wants) && (m.faceAreas.length > 0 || (m.online && m.online !== "unknown"));
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
//     以後は「お名前 + パスワード」で入る。5回まちがえると15分ロック(本人ごと)。
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
  var LOGIN_FAILURE_LIMIT = 5;
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
    "company", "base", "category", "business", "customers", "offer", "selfIntro", "note", "wants", "triggers",
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
          // まだないもの(同じ URL がないもの)だけを足す(本人が消したほかのリンクは戻さない)
          if (Array.isArray(r.addLinks)) {
            var have = (next.links || []).map(function (l) { return l.url; });
            var add = (seedMember.links || []).filter(function (l) { return r.addLinks.indexOf(l.type) !== -1 && have.indexOf(l.url) === -1; });
            next.links = (next.links || []).concat(clone(add)).slice(0, LINKS_MAX);
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
    }

    function findIndex(list, fn) {
      for (var i = 0; i < list.length; i++) if (fn(list[i])) return i;
      return -1;
    }
    function find(list, fn) {
      var i = findIndex(list, fn);
      return i < 0 ? null : list[i];
    }

    // 管理者かどうか: 管理者用パスコードで入ったセッション、または管理者に指定された会員
    function sessionIsAdmin(db, session, user) {
      if (session.isAdmin === true) return true;
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

    // セッショントークンから { session, user } を解決(無効なら null)
    function authSession(db, token) {
      var session = db.sessions[String(token || "")];
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
    function matchPasscode(code) {
      var normalized = String(code || "").trim().toLowerCase().replace(/[\s-]/g, "");
      var adminHash = sha256Hex(PASSCODES.admin.salt + ":" + normalized);
      var memberHash = sha256Hex(PASSCODES.member.salt + ":" + normalized);
      if (!normalized) return null;
      if (adminHash === PASSCODES.admin.hash) return "admin";
      if (memberHash === PASSCODES.member.hash) return "member";
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
        if (guard.failures >= LOGIN_FAILURE_LIMIT) {
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
      db.sessions[token] = session;
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
      if (memberId) {
        var mem = find(db.referralMembers || [], function (m) { return m.id === memberId; });
        if (!mem || !password) return fail("ACCOUNT_FAILED");
        var u0 = find(db.users, function (u) { return u.memberId === mem.id; });
        if (!u0 || !u0.pw) {
          if (db.passcodeGuard.lockedUntil > nowMs()) return fail("LOCKED");
          var role = db.settings.memberPasscode !== false ? matchPasscode(password) : null;
          if (role !== "member" && role !== "admin") {
            db.passcodeGuard.failures += 1;
            if (db.passcodeGuard.failures >= LOGIN_FAILURE_LIMIT) {
              db.passcodeGuard.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000;
              db.passcodeGuard.failures = 0;
              saveDb(db);
              return fail("LOCKED");
            }
            saveDb(db);
            return fail("ACCOUNT_FAILED", db.settings.memberPasscode !== false
              ? "パスワード(まだ決めていない方は共通パスコード)が正しくありません。"
              : "まだパスワードが決まっていません。運営者から届く招待コードで、パスワードを決めてください。");
          }
          db.passcodeGuard.failures = 0;
          var user0 = userForMember(db, mem);
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
          if (u.failures >= LOGIN_FAILURE_LIMIT) { u.lockedUntil = nowMs() + LOCK_DURATION_MINUTES * 60 * 1000; u.failures = 0; locked = true; }
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
        if (db.sessions[t].userId === user.userId && t !== String(body.sessionToken)) delete db.sessions[t];
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
      var token = String(body.sessionToken || "");
      if (db.sessions[token]) {
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
        company: cleanStr(m.company, 80),
        team: cleanStr(m.team, 40),
        base: !bases || bases.indexOf(base) !== -1 ? base || "未設定" : "未設定",
        category: !categories || categories.indexOf(category) !== -1 ? category : categories[categories.length - 1],
        business: cleanStr(m.business, 600),
        customers: cleanStr(m.customers, 400),
        offer: cleanStr(m.offer, 120),
        selfIntro: cleanStr(String(m.selfIntro || "").replace(/\r\n?/g, "\n"), 3000),
        note: cleanStr(m.note, 300),
        wants: cleanStr(m.wants, 400),
        triggers: cleanList(m.triggers, null, 12).map(function (t) { return t.slice(0, 40); }),
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
  var BOARD_CATS = ["紹介依頼", "イベント・募集", "成約・お礼", "質問・相談", "雑談"];
  var ANNOUNCE_CATS = ["お知らせ", "定例会", "重要", "その他"];
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
      "reportThanks", "deleteThanks", "save1on1", "delete1on1",
    ],
    // 書き込みのあとに、通知(プッシュ)を送るか確かめる操作(mutating に加えて)
    notifying: ["createPost", "commentPost", "adminSaveAnnouncement"],
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
        var s = c.cleanStr(v, 5);
        return /^\d{1,2}:\d{2}$/.test(s) ? s : "";
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
      function member(db, id) { return c.find(db.referralMembers || [], function (m) { return m.id === id; }); }
      function nameOf(db, id) { var m = member(db, id); return m ? m.name : "(退会したメンバー)"; }
      function memberIdOfUser(db, userId) {
        var u = c.find(db.users, function (x) { return x.userId === userId; });
        return u ? u.memberId : "";
      }
      function trim(list, max) { if (list.length > max) list.splice(0, list.length - max); }

      function migrate(db) {
        var changed = false;
        ["events", "visitors", "thanks", "oneOnOnes", "announcements", "posts", "threads", "feedback", "pushSubs"].forEach(function (k) {
          if (!Array.isArray(db[k])) { db[k] = []; changed = true; }
        });
        if (!db.seen || typeof db.seen !== "object") { db.seen = {}; changed = true; }
        if (autoComplete(db)) changed = true;
        // 初めの定例会(REF_SEED_EVENTS)を一度だけ入れる
        if (typeof REF_SEED_EVENTS !== "undefined") {
          if (!Array.isArray(db.eventSeeds)) { db.eventSeeds = []; changed = true; }
          REF_SEED_EVENTS.forEach(function (se) {
            if (db.eventSeeds.indexOf(se.seedId) !== -1) return;
            db.eventSeeds.push(se.seedId);
            var ev = {
              seedId: se.seedId, id: newId("ev_"), title: se.title, date: se.date, start: se.start, end: se.end, place: se.place || "", area: se.area,
              body: se.body || "", agenda: se.agenda || "", fee: se.fee || "", capacity: 0, url: "", deadline: se.deadline || "",
              meet: se.meet !== false, party: { enabled: false }, rsvps: {}, attended: [], createdAt: c.nowMs(), seed: true,
            };
            syncEventCalendar(db, ev); // 共有サーバーでカレンダーが使えれば、Meet もここで作る
            db.events.push(ev);
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
          id: e.id, title: e.title, date: e.date, start: e.start, end: e.end, place: e.place, area: e.area,
          body: e.body, agenda: e.agenda || "", fee: e.fee, capacity: e.capacity || 0, url: e.url || "",
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
        return c.ok({ event: eventView(w, e), members: members, visitors: visitors, isAdmin: w.isAdmin });
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
        var w = admin(body);
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
        var w = admin(body);
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
        };
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
        if (amount < 0 || amount > 1000000000) return c.fail("INVALID_REQUEST");
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
      function getStats(body) {
        var w = who(body);
        if (w.error) return w.error;
        var db = w.db;
        var from = cleanDate(body.from), to = cleanDate(body.to);
        if (!from || !to) { from = today().slice(0, 8) + "01"; to = lastDay(today().slice(0, 7)); }
        if (from > to) { var tmp = from; from = to; to = tmp; }
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
        var list = Object.keys(rows).map(function (k) { return rows[k]; });
        return c.ok({
          from: from, to: to, today: today(),
          me: rows[w.id] || null,
          members: list.map(function (r) {
            return { id: r.id, name: r.name, isMe: r.id === w.id, attended: r.attended, referrals: r.referrals, miles: r.milesGiven, oneOnOnes: r.oneOnOnes, visitors: r.visitors };
          }),
          total: total,
        });
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
      // 予定の時刻(時刻がなければその日)を過ぎた 1on1 は、中止にしていなければ自動で「実施」にする
      function autoComplete(db) {
        var changed = false;
        (db.oneOnOnes || []).forEach(function (o) {
          if (o.status !== "planned") return;
          if (c.nowMs() >= oneEndMs(o)) {
            o.status = "done";
            o.autoDone = true;
            o.doneAt = c.nowMs();
            changed = true;
          }
        });
        return changed;
      }
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
          id: o.id, with: other, withName: nameOf(db, other), date: o.date, time: o.time || "", end: endTime(o), endDate: endDate(o), duration: o.duration || 60,
          mode: o.mode || "onsite", place: o.place || "", meetUrl: o.meetUrl || "", calLink: o.calLink || "", synced: !!o.calId,
          status: o.status, autoDone: !!o.autoDone, note: (o.notes || {})[me] || "", next: (o.nexts || {})[me] || "", by: o.by, at: o.at,
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
          if (!member(db, other) || other === w.id) return c.fail("INVALID_REQUEST", "相手を選んでください。");
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
      function getMySettings(body) {
        var w = who(body);
        if (w.error) return w.error;
        return c.ok({ calendarEmail: w.user.calendarEmail || "", calendar: !!c.calendar, meetName: w.user.meetName || "", name: w.me.name });
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
        c.saveDb(w.db);
        return c.ok({ calendarEmail: w.user.calendarEmail || "", meetName: w.user.meetName || "" });
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
          canDelete: p.by === w.id || w.isAdmin,
          comments: (p.comments || []).map(function (cm) {
            return { id: cm.id, by: cm.by, byName: nameOf(w.db, cm.by), body: cm.body, at: cm.at, canDelete: cm.by === w.id || w.isAdmin };
          }),
        };
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
        var p = { id: newId("p_"), by: w.id, cat: oneOf(body.cat, BOARD_CATS, "雑談"), body: text, at: c.nowMs(), likes: [], comments: [] };
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
        return c.ok({ month: month, prevMonth: prev, totals: totals(month), prevTotals: totals(prev), events: monthEvents, members: members, now: c.nowMs() });
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
      function activityItems(db, me) {
        var items = [];
        db.referralLogs.forEach(function (l) {
          var giver = memberIdOfUser(db, l.fromUserId);
          if (l.toMemberId === me && giver !== me) {
            items.push({ type: "refIn", at: l.at, who: giver, whoName: nameOf(db, giver), text: l.prospect || "", link: "log/ref" });
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
          (p.comments || []).forEach(function (cm) {
            if (cm.by === me) return;
            var mine = p.by === me;
            var joined = !mine && (p.comments || []).some(function (x) { return x.by === me && x.at < cm.at; });
            if (mine || joined) items.push({ type: mine ? "comment" : "reply", at: cm.at, who: cm.by, whoName: nameOf(db, cm.by), text: cm.body.slice(0, 60), link: "board" });
          });
        });
        db.oneOnOnes.forEach(function (o) {
          if ((o.a === me || o.b === me) && o.by !== me) items.push({ type: "oneNew", at: o.at, who: o.by, whoName: nameOf(db, o.by), date: o.date, link: "log/1on1" });
        });
        db.visitors.forEach(function (v) {
          if (v.by === me && v.appliedAt) items.push({ type: "visitor", at: v.appliedAt, text: v.name, link: "events" });
        });
        db.announcements.forEach(function (a) {
          items.push({ type: "ann", at: a.at, text: a.title, link: "news?open=" + a.id });
        });
        db.events.forEach(function (e) {
          if (e.createdAt && e.date >= today()) items.push({ type: "event", at: e.createdAt, text: e.title, date: e.date, link: "events" });
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
          if (l.status === "new" && c.nowMs() - l.at > 3 * DAY) {
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
          if (o.date === t) followUps.push({ type: "oneToday", id: o.id, with: other, withName: nameOf(db, other), time: o.time || "", place: o.place || "", meetUrl: o.meetUrl || "" });
        });
        // 時刻を過ぎて自動で「実施」になった 1on1(1週間以内・自分のメモがまだ)
        ones.forEach(function (o) {
          if (!o.autoDone || (o.notes || {})[w.id] || c.nowMs() - (o.doneAt || 0) > 7 * DAY) return;
          var other = o.a === w.id ? o.b : o.a;
          followUps.push({ type: "oneMemo", id: o.id, with: other, withName: nameOf(db, other), date: o.date });
        });
        return c.ok({
          me: { id: w.id, name: w.me.name, team: w.me.team || "", isAdmin: w.isAdmin, hasPassword: !!w.user.pw },
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
            givenAll: myLogs.length,
            milesInAll: db.thanks.filter(function (x) { return x.to === w.id; }).reduce(function (s, x) { return s + x.amount; }, 0),
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
            return { rank: me.rank, size: ms.length, points: me.points, gap: me.gap, gapName: me.gapName };
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
      function latestActivityAt(db, memberId) {
        var items = activityItems(db, memberId);
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
          case "visitor": return { title: "🙋 ビジターの申込がありました", body: x.text + " さん" };
          case "ann": return { title: "📣 運営からのお知らせ", body: x.text };
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
        var fresh = activityItems(db, row.memberId).filter(function (x) { return x.at > lastSeen; });
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
        jobs: { syncMeet: jobSyncMeet, takePushOutbox: jobTakePushOutbox, dropPushSubs: jobDropPushSubs },
        actions: {
          getHome: getHome, getActivity: getActivity, adminDashboard: adminDashboard, adminExport: adminExport,
          listEvents: listEvents, getEvent: getEvent, rsvpEvent: rsvpEvent, checkIn: checkIn,
          adminSaveEvent: adminSaveEvent, adminDeleteEvent: adminDeleteEvent, adminOpenCheckIn: adminOpenCheckIn,
          adminEventDetail: adminEventDetail, adminMarkAttendance: adminMarkAttendance,
          adminSyncMeetAttendance: adminSyncMeetAttendance, adminMapMeetName: adminMapMeetName,
          createVisitorInvite: createVisitorInvite, listMyVisitors: listMyVisitors, updateVisitor: updateVisitor,
          visitorInfo: visitorInfo, visitorApply: visitorApply,
          listMyReferrals: listMyReferrals, reportThanks: reportThanks, deleteThanks: deleteThanks, getRankings: getRankings, getTeamRanking: getTeamRanking, getStats: getStats, adminSetTeamGoals: adminSetTeamGoals,
          list1on1: list1on1, save1on1: save1on1, delete1on1: delete1on1,
          getMySettings: getMySettings, updateMySettings: updateMySettings,
          listAnnouncements: listAnnouncements, markAnnouncementsRead: markAnnouncementsRead,
          adminSaveAnnouncement: adminSaveAnnouncement, adminDeleteAnnouncement: adminDeleteAnnouncement,
          listBoard: listBoard, createPost: createPost, deletePost: deletePost, commentPost: commentPost,
          deleteComment: deleteComment, likePost: likePost,
          sendFeedback: sendFeedback, listMyFeedback: listMyFeedback, adminListFeedback: adminListFeedback, adminUpdateFeedback: adminUpdateFeedback,
          pushConfig: pushConfig, savePushSubscription: savePushSubscription, deletePushSubscription: deletePushSubscription, pushPeek: pushPeek,
        },
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
var VISITOR_LABELS_JA = { invited: "招待中", applied: "参加申込", attended: "参加済み", joined: "入会", declined: "見送り" };
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
  return JSON.parse(text); // 壊れていたら例外 → SERVER_ERROR(データを上書きしない)
}

function saveDb_(db) {
  var sh = dataSheet_();
  var text = JSON.stringify(db);
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

var SERVER_ = BtexServerCore.createServer({
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Web アプリの入口 ----------
// サイトからは text/plain で JSON を POST する(プリフライトを避けるため §5)
function doPost(e) {
  var body = null;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "null");
  } catch (err) {
    body = null;
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ success: false, error: { code: "SERVER_ERROR", message: BtexServerCore.ERRORS.SERVER_ERROR } });
  }
  var result, pushJob = null;
  try {
    result = SERVER_.handle(body);
    if (result.success && body && BtexServerCore.MUTATING_ACTIONS.indexOf(body.action) !== -1) {
      try { refreshSheets_(); } catch (err) { console.error(err); }
    }
    if (result.success && body && BtexServerCore.NOTIFY_ACTIONS.indexOf(body.action) !== -1) {
      // 新しいお知らせが届く人の端末を選んでおく(送るのはロックを外してから)
      try { pushJob = SERVER_.runJob("takePushOutbox")[0]; } catch (err) { console.error(err); }
    }
  } finally {
    lock.releaseLock();
  }
  try { sendPushes_(pushJob); } catch (err) { console.error(err); }
  return json_(result);
}

function doGet() {
  return json_({ success: true, data: { service: "BT-EX5 会員サイト API", status: "ok" } });
}

// ---------- 定期実行(1時間ごと) ----------
// 定例会が終わったあと、Google Meet の参加記録から出欠をつける
function syncMeetAttendanceJob() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var r = SERVER_.runJob("syncMeet");
    if (r[0] && r[0].synced) refreshSheets_();
    return r;
  } finally {
    lock.releaseLock();
  }
}
function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "syncMeetAttendanceJob") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncMeetAttendanceJob").timeBased().everyHours(1).create();
}

// 初回に Apps Script のエディタから一度だけ実行する(権限の承認と、名簿の作成)
function setup() {
  SERVER_.handle({ action: "loginOptions" });
  // Google Calendar API を追加していれば、1on1 用のカレンダーを作っておく(権限の確認もここで出る)
  if (CALENDAR_) oneOnOneCalendarId_();
  // Meet の参加記録から出欠をつける処理を、1時間ごとに動かす(カレンダー連携を設定したときだけ)
  if (CALENDAR_) {
    try { installTriggers_(); } catch (err) { console.error("トリガーを入れられませんでした: " + err); }
  }
  SERVER_.handle({ action: "verifySession", sessionToken: "" });
  refreshSheets_();
  return "準備できました。名簿 " + (loadDb_().referralMembers || []).length + " 名";
}
