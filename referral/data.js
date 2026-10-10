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
  { label: "話し方・声", words: ["人前で話す", "話すのが苦手", "プレゼンが苦手", "声が通らない", "滑舌", "イケボ", "いい声", "声を良くしたい", "声に自信がない", "声が小さい"], topics: ["voice", "mc", "coaching"] },
  { label: "音楽・ナレーション", words: ["曲を作りたい", "テーマソング", "BGMがほしい", "ナレーションを入れたい"], topics: ["music", "recording", "voice"] },
  { label: "税金・契約", words: ["税金が高い", "確定申告", "契約書", "トラブルになった", "許可が必要"], topics: ["tax", "legal"] },
  { label: "社会貢献", words: ["寄付したい", "ボランティア", "子ども食堂", "社会貢献したい"], topics: ["social"] },
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
  Object.assign(rosterMember("m02", "あまみや 七音", "echo studio 代表/声優・ナレーター・ボイストレーナー", "Over", "声・司会・キャスティング", ["voice", "mc", "recording", "casting", "video", "prvideo", "health"]), {
    // 本人のホームページ(amamiyanao.com)の内容から(2026年10月)
    business: "echo studio 代表。声優・ナレーター(会社案内・企業VP・CM・教材・イベントPVのナレーション、TVアニメ・海外ドラマ・洋画の吹き替え)、ボイストレーニング教室(複数のトレーナーが在籍)、声と話し方の講座「BVB(ビジネスボイスブースター)」「イケボスパルタ塾」、レコーディングスタジオ(ナレーション・歌の録音)、動画制作、声優・タレントのキャスティング。4オクターブの声で、中性的な低音ハスキーボイスから子ども・男性・おばあちゃんまで演じ分ける。ステージの専属ショーシンガーの経験があり、JAZZ・POPs・Soul・ROCK・ゴスペル・演歌・オペラ・アニメソングも歌うボーカリスト。失声症を乗り越えた経験から、声を聞けば出し方と改善法が分かるボイストレーナー。",
    customers: "会社案内・採用・研修・商品紹介の動画を作る企業の広報・人事/映像制作会社・広告代理店・TV局/人前で話す経営者・営業職・講師/声優・ナレーターを目指す人/歌の活動をしたい人/喉を痛めやすい人",
    note: "「長く喋ると喉が枯れる…原因は姿勢と口の開け方と呼吸量」。出演:TVアニメ『サザエさん』『ぐでたま』こども役、海外ドラマ『CSI:NY』『CSI:マイアミ』『プリズン・ブレイク』『デスパレートな妻たち』、TBSドラマ『きみはペット』、映画『アトム』、日本赤十字社『臍帯血バンクご案内』・価格.com・エステー化学・前田道路などの会社案内ナレーション、ハンドボール協会 2020 世界選手権のナレーション。著書が Amazon 売れ筋ランキング7部門で1位(2025年11月)。",
    wants: "会社案内・採用・研修・商品紹介の動画にナレーションを入れたい会社/プレゼン・営業・講演で声と話し方を良くしたい経営者・ビジネスパーソン/声優やナレーターを目指している人・もっと仕事を取りたい人/歌の活動をしていきたい人/喋ったり歌ったりすると声が枯れる人/イベントや映像に声優・タレント・歌手を起用したい人",
    triggers: ["声優になりたい", "ナレーションの仕事を増やしたい", "歌の活動をしたい", "喋ると声が枯れる", "録音スタジオを探している", "声優・タレントを起用したい", "会社案内の動画にナレーションを入れたい", "プレゼンで声が通らない", "人前で話すと緊張する", "声に自信がない", "イケボになりたい", "キャラクターの声を入れたい", "イベントに歌手を呼びたい"],
    targets: ["it", "personal"],
    prospects: ["individual", "owner", "staff"],
    links: [
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
  // 本人の依頼で、あまみや 七音さんのサービスのページ(BVB・イケボスパルタ塾)を追加(ほかのリンクはそのまま)
  { rev: "2026-10-amamiya-lp", ids: ["m02"], fields: ["links"], addLinks: ["website"] },
  // 本人のホームページの内容で、あまみや 七音さんの事業内容・実績・こんな話が出たら・ジャンルを充実(編集済みでも置き換える)。
  // 公式サイトのリンクも足す(ほかのリンクはそのまま)
  { rev: "2026-10-amamiya-profile", ids: ["m02"], fields: ["company", "business", "customers", "note", "wants", "triggers", "topics"], force: true },
  { rev: "2026-10-amamiya-hp", ids: ["m02"], fields: ["links"], addLinks: ["website"] },
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
