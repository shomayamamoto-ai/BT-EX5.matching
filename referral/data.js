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
    // カードの名前の下に出る肩書き(本人の依頼で、ブランディングの表記にそろえる)
    company: "Lumenium 代表/夢を叶えるシステム開発屋、売れるAI集客システム付きWebサイト制作、セキュリティ特化のAI研修、有名監督による企業PR動画・SNS運用",
    team: "フェリシア",
    base: "東京",
    category: "システム開発",
    business:
      "業務効率化システムの開発(予約・在庫・仕入れ・契約書・営業リスト・電話の自動応対・会員制マッチングなど/30万〜600万円)、自分で更新・分析できるホームページ・LP制作(サイト60万円〜・LP30万円〜)、社員向け生成AI研修・AI導入支援・教材制作(講師1回10万円〜)。動画制作・映像編集(PR・SNS・企業紹介・採用・AI動画/5万円〜)、SNS運用代行・LINE構築・LINE Bot(初期20万円〜・月額10万円〜)、ロゴ・バナー・ポスター・イラスト・作詞作曲(3万円〜)、モデル・アクター・MCの手配とイベント企画運営(キャスト1名5,000円〜)。",
    customers: "複数店舗の店舗オーナー/飲食チェーンの店舗統括/SNS運用代行会社/名刺交換の多い経営者/会員制の交流会の運営会社/雑貨店など小売・物販の経営者/士業事務所/研修を行いたい企業",
    note: "相談・見積り無料、48時間以内に返信。最低発注額なし、1業務・研修1回から。動画制作とキャスト手配は制作パートナー(AdvoVisions)と対応。",
    wants:
      "人手が足りない経営者/人を雇いたい経営者/紙・Excel・電話で業務を回している中小企業や複数店舗の経営者(飲食・小売・サロン・士業事務所など)/AIを導入したいが何から始めるか決まっていない会社",
    triggers: ["人手が足りない", "人が採れない", "手作業に時間がかかる", "社員にAIを使わせたい", "予約・在庫管理がバラバラ", "電話予約を取りこぼしている", "HPを作ったきり", "動画を作りたい", "SNSの運用を任せたい", "公式LINEを作りたい", "ロゴ・チラシ・ポスターを作りたい", "モデル・MCを手配したい", "名刺を営業リストにしたい", "契約書づくりに時間がかかる", "人が足りない", "スタッフが足りない", "従業員が足りない", "人員が足りない"],
    face: "関東(東京拠点)",
    faceAreas: ["tokyo"],
    online: "all",
    topics: ["efficiency", "line", "web", "seo", "ai", "aitraining", "sns", "video", "prvideo", "music", "casting", "org", "hiring", "event", "fixedcost", "tutoring"],
    targets: ["restaurant", "retail", "salon", "pro", "build", "it"],
    prospects: ["owner", "staff"],
    // 「紹介文をコピー」に入る本人の自己紹介(本人の依頼で原文のまま)
    selfIntro: "初めまして！\n開発やホームページ制作のノウハウを元に、AI研修講師としてもお仕事させていただいております。\nヤマモトと申します\n以下自己紹介となります\n\n［自己紹介］\n\nお名前　山本捷真(しょーま)\n\n☑️出身　兵庫県\n\n☑️住まい🏠　神奈川県横浜市\n\n☑️お仕事\n\nシステム開発・Webページ制作・AI研修講師\n\nAI歴3年以上のAIのプロフェッショナル\n└ HP：https://lumenium.net\n\n☑️どんな人？\n「IT,AIに強い外部パートナーが欲しい。\nでも、どこに何を頼めばいいかわからない」\n\nそんな経営者様の”最初の窓口”として、\n企画・制作から人材、資金繰りのご相談まで、まとめてお受けしています😊\n\n✅事業内容\n①システム開発、ウェブサイト制作、LINE Bot制作\n└ HP：https://lumenium.net\n\n②企業向けAI関連各種\n→企業向けAI研修の講師\n→AI補助金対策用の解説動画制作\n→社内向けAIメルマガの執筆\n→AI教材／小中学生向け塾教材の制作\n\n③to C向け　携帯料金の見直しのご相談\n\n④小中高生と早慶レベルの家庭教師をつなぐマッチングサービス\n\n✅趣味\nAI💻・仮想通貨📈・ガジェット⌚️\n旅行✈️・温泉♨️・アニメ📺・ポーカー🃏\n\n新しいものを触って試すのが好きです\n\n✅こんな方とお話ししたいです🌼\n・AI活用を進めたい経営者様\n・社内の人手不足を感じている経営者様\n・Web／映像／SNSのパートナーをお探しの方\n \n\n↓【提携先(私の所属している芸能事務所)】↓\n■ 制作(映像・音楽)🎬\n・映像制作、PR動画\n　└ 合同会社AdvoVisions\n　　(芸能事務所・映像制作会社)と提携\n　└ 実績：リンガーハット様、\n　　　一つ星レストラン様 ほか、\n・映像スクール\n\n・芸能キャスト手配、MC、イベント出演\n\n\n\n(以下、作成可能なシステムに↓について)\n\n・Webサイトの裏側にWordpressのような文章編集やお知らせ投稿機能、サイトのアクセス解析、キーワード検索の際の他社との自社サイト出現率等の分析、以上の分析を元に改善案をAIが教えてくれる仕組み。\n\n・SNSアカウントを入れるとアカウント分析と市場分析を行い、動画の脚本・絵コンテを作成し、撮った素材を自動カットしテロップを入れ、各SNSに自動投稿、離脱率等を分析し、PDCAサイクルを回すSNS運用自動化ツール。\n\n・監視カメラと連携した暴力行為の感知システム。\n\n・携帯の番号①③を押して、①なら予約として席数を分析しながら適切な時間の予約を押さえてくれたり、③を押すとクレームやお客様の声を集音から文字起こしし、分析しながら改善案を提案してくれるシステム。\n\n・名刺を写真でアップロードし、営業リストを作成して、☑️を選択した人全てに一斉送信する機能。\n\n・Googleカレンダーと連携し、移動時間を含めた社員全体の予定管理ができるツール→管理職向け。\n\n・ログイン機能付き交流者マッチングツール。\n\n・商品の仕入れや備品管理ができるシステム。\n\n・契約書を作成してくれるシステム。\n\n\n→現在は、各文章系SNSで伸びる投稿文の傾向やパターンを分析し、SNS投稿を自動化するSNS運用ツールを開発中です。",
    links: [
      { type: "proposal", url: "materials/yamamoto-branding.jpg", label: "山本 捷真 パーソナルブランディングシート", cover: "materials/yamamoto-branding.jpg" },
      { type: "proposal", url: "materials/lumenium-proposal.pdf", label: "Lumenium 自己紹介・ご提案(14ページ)", cover: "materials/lumenium-proposal-cover.jpg" },
      { type: "website", url: "https://lumenium.net", label: "lumenium.net" },
      { type: "instagram", url: "https://www.instagram.com/showstagram.keio/", label: "@showstagram.keio" },
      { type: "line", url: "https://line.me/ti/p/2viaHtuXEu", label: "山本 捷真(LINE で友だち追加)" },
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
  Object.assign(rosterMember("m05", "大藤 誠", "SFGビューティ株式会社 代表取締役/世界初・ハラール認証フェイスマスク", "CANOW", "美容・健康", ["beauty", "food"], "東京"), {
    business: "meirune glutathione intensive seat mask(世界初・ハラール認証フェイスマスク)、JUST ONE オールインワンタオル。",
    customers: "美容室・エステサロン・ホテル・温浴施設・介護施設など、衛生面やタオルの洗濯・管理コストに課題を抱えている事業者",
    wants: "美容・宿泊・介護・温浴施設の経営者や仕入れ担当者、複数店舗を展開する企業の購買担当者",
    triggers: ["タオルの洗濯・管理コスト", "衛生面が気になる", "備品の仕入れを見直したい", "フェイスマスク", "ハラール", "ホテル・温浴施設"],
    targets: ["salon", "medical", "retail"],
    prospects: ["owner", "staff"],
  }),
  // 本人のプロフィール資料(2026年10月)で充実させる(電話番号は載せない)
  Object.assign(rosterMember("m06", "吉原 優", "FJ/ライフプラン・コンサルタント・ファイナンシャルプランナー", "", "お金・保険", ["insurance", "fixedcost", "family", "life", "realestate"]), {
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
  rosterMember("m07", "樺澤 一郎", "KBlab合同会社 代表", "", "美容・健康", ["health"]),
  // 本人の資料「月面タイムカプセル」(12ページ・2026年10月)の内容で充実させる
  Object.assign(rosterMember("m08", "床島 良夫", "非営利団体 人生工房 理事/月面タイムカプセル・パーソナルインバウンドツアー", "SunnyUp🌞", "暮らし・サービス", ["inbound", "regional", "event", "kids"]), {
    business: "「月面タイムカプセル」(インバウンド × 地域連携 × 宇宙):日本を訪れた旅行者が、日本で体験した感動・気付きと、新たな夢や目標を込めたメッセージを、Astraport社の月面輸送で月へ届ける体験型プロジェクト(参加料 1人70ドル〜。2人120ドル・3人150ドル・4人180ドルの家族・グループ割引あり)。\n①地域連携 エリア登録プラン:ホテル・体験講座・観光地・商店会などが1つのエリアとして連携し、地域全体でインバウンド需要を取り込む。必要経費は1エリア・年間200万円(輸送事業費50万円・集客代行費120万円・賛助会費30万円)。約200人の申込みで経費を回収でき、それを超えた分はエリアの収入になる。完全成功報酬型の追加プラン(+100万円)は個別協議。\n②大手ホテルグループ向けプラン:全国・海外からの宿泊客への特別体験として提供し、ホテルのブランド価値向上と集客につなげる。企画協賛金1,000万円(税別)で、ホテル内の専用ブース設置・プロモーション支援・予約と運営のサポート・データ共有とレポート提供を含む。\nほかに、パーソナルインバウンドツアー。",
    customers: "ホテル・旅館などの宿泊施設/体験講座・アクティビティの事業者/観光地・観光施設/商店会・地域の事業者/大手ホテルグループ/地域密着の中小企業/公立・私立学校",
    note: "月面タイムカプセルとパーソナルインバウンドツアーで外貨を稼ごう! 観光に「+α」の特別な価値(旅の思い出が一生の記念に・日本でしかできない体験・夢や目標を未来へ残せる・SNSでシェアできるストーリー)を提供し、地域経済の活性化・国際交流・次世代への夢の継承にもつながります。参加するツアー客は、氏名・メールアドレスの登録と人生工房への会員登録(利用規約への同意)が必要です。",
    wants: "インバウンド客を増やしたいホテル・旅館・体験講座・観光施設・商店会(地域のみんなでエリア登録してくれる方)/宿泊客に特別な体験を提供して、ブランド価値を上げたい大手ホテルグループ/1/2成人式や元服の儀の誓いなどで取り組んでくれる公立・私立学校と、そのエリアの中小企業/海外で人生工房の会員を募ってくれるインフルエンサー/日本国内でインバウンド客向けの体験型講座を開いてくれる方",
    triggers: ["月面タイムカプセル", "インバウンド", "外国人観光客を呼びたい", "訪日客を増やしたい", "ホテル・旅館の集客", "宿泊客向けの特別な体験", "観光地を盛り上げたい", "商店会で集客したい", "地域活性化", "体験型講座", "宇宙ビジネス", "夢や目標を未来に残したい", "1/2成人式", "元服", "学校の記念行事", "海外のインフルエンサー"],
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
  Object.assign(rosterMember("m10", "大枝 篤志", "マイプラBT 代表/売上動線も作れる公式LINE専門家", "Team Bloom∞🌸", "SNS運用・集客", ["sns", "line", "hiring", "fixedcost", "life"]), {
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
  Object.assign(rosterMember("m12", "菅野 節子", "リンパレディアソック 代表/リンパ節子(節子式リンパケア)", "Team Bloom∞🌸", "美容・健康", ["health", "event"]), {
    business: "独自に生み出した『節子式リンパケア』(23年・3万人以上の施術実績)。リンパケア施術(心と身体を整え、本来の輝きを引き出す)、セラピスト・講師養成(技術と知識を学び、活躍できる人材を育成)、健康講座・ダイエットサポート(食事・栄養・セルフケア)、イベント・マルシェ出店、歌で笑顔と元気を届ける活動。リンパレディ講座。",
    customers: "セラピスト、施術者、一般のお客様、OL、主婦",
    note: "理念「健康な人を一人でも増やし、子どもたちへ健康な未来を届ける」。施術歴23年・延べ3万人以上を施術、節子式リンパケアを考案。愛媛県松山市を拠点に全国で活動。趣味はカラオケで、歌でも人を元気にする活動をしている。「身体が変わると、心が変わる。心が変わると、人生が変わる。」",
    wants: "体験会の集客(体験会に参加してくれる方)/リンパケアを学んでセラピスト・講師として活躍したい方/健康講座やマルシェに呼んでくれる方",
    triggers: ["リンパケア", "むくみ・不調", "体験会に参加したい", "セラピスト・施術者", "健康講座", "ダイエットしたい", "セルフケアを学びたい", "セラピストになりたい", "マルシェ・イベントに出店してほしい", "イベントで歌ってほしい"],
    targets: ["salon", "personal"],
    prospects: ["individual", "owner"],
    links: [
      { type: "proposal", url: "materials/kanno-lymph.jpg", label: "節子式リンパケア ご案内(活動内容・プロフィール)", cover: "materials/kanno-lymph.jpg" },
    ],
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
  Object.assign(rosterMember("m16", "桜羽 李果", "株式会社LEFANA/女性向けSNSブランディング", "Team Bloom∞🌸", "デザイン・ブランディング", ["branding", "sns", "web", "design", "video", "photo"]), {
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
    note: "CoCo(個々)カラースタイリスト。30年間、1,000名以上の方の人生に寄り添い、「自分色で生きる」サポートをしてきた。商業出版13冊、最新刊『FASHION STYLE 「似合う」を見極め「なりたい」を目指す』(ごきげんビジネス出版)。あなた色ブランディングは「あなたの能力(内面)×あなたの魅力(外見)→あなたブランド」。3ステップ:①命のタネに気づく(自分軸・他人軸)②命の育て方と咲かせ方を知る(スタイリング・ブランディング)③命を最大限に咲かせる(人生の“第二章”が開花)。無料体験会(90分・人数限定)あり。",
    triggers: ["実力はあるのに選ばれない", "見せ方を変えたい", "似合う色を知りたい", "パーソナルカラー", "ショッピング同行", "セルフブランディング", "自分らしさが分からない", "売上が安定しない", "何を着ればいいか迷う", "SNSで発信しても伝わらない", "次のステージへ行きたい", "人生の第二章を始めたい"],
    targets: ["retail", "pro", "any"],
    prospects: ["owner", "individual"],
    links: [
      { type: "proposal", url: "materials/murasaki-cocolor.jpg", label: "あなた色ブランディング ご案内(無料体験会)", cover: "materials/murasaki-cocolor.jpg" },
    ],
  }),
  Object.assign(rosterMember("m18", "髙橋 誠二", "スポーツ用品EC事業者/EC運営支援", "CANOW", "EC・ネットショップ", ["ec", "web"]), {
    business: "スポーツ用品のEC事業、EC運営支援。",
    triggers: ["ネットショップを始めたい", "ECの売上を伸ばしたい", "スポーツ用品"],
    targets: ["retail"],
    prospects: ["owner", "staff"],
  }),
  // 本人のご案内資料(2026年10月)で充実させる(電話番号は載せない)
  Object.assign(rosterMember("m19", "岡本 伸", "株式会社 心灯(こころび) 代表取締役/WEBマーケティング・ウェルスダイナミクス・ライバー育成", "Team Bloom∞🌸", "Web制作", ["web", "seo", "sns", "video", "coaching", "branding", "consult", "mindset"]), {
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
  // 本人の回答(2026年10月)をもとに書き直し。オンラインは全国、対面は新潟
  Object.assign(rosterMember("m22", "小林 末季こばねぇ", "preseia 代表/心を整えるマインドコーチ", "SunnyUp🌞", "人材・組織", ["mindset", "coaching", "org", "retention", "hiring", "branding", "voice", "mc", "health", "spiritual", "family", "kids"], "新潟"), {
    business: "サポートメニュー:マインドコーチング(心のブレーキを外し、自分らしく進めるマインドを育てる)/自分軸・価値観整理/起業初心者向けビジネスコンサル(何から始めればいいかを一緒に整理し、形にする)/ビジネスマインド講座/コミュニケーション講座(伝える力・聴く力を磨き、信頼される関係を築く)/オンライン・リアルセミナー開催(全国オンライン対応・新潟リアル開催あり・少人数セミナー)。オンラインコーチング(個人・法人)。話すだけで頭の中が整理でき、モヤモヤが晴れて次の一歩が見えるようになります。マインド・メンタル系のセミナー・講座・講演(自己肯定感・やる気・モチベーション・コミュニケーション)。研修やセミナーの前に入れる、場をほぐすコミュニケーションのワークもお伝えできます。",
    customers: "個人事業主/起業家/一般の社会人",
    wants: "考えを整理したい・気軽に話せる相談相手がほしい経営者の方/社内向けのセミナー・研修を探している会社の方/マインドを整えて自己肯定感を上げたい方",
    triggers: ["頑張っているのに満たされない", "自分の軸がわからない", "想いをうまく言葉にできない", "行動したいのに不安で止まる", "自分らしい働き方を見つけたい", "人と比べて苦しくなる", "起業したばかりで何から始めればいいか分からない", "社内のコミュニケーションを良くしたい", "自己肯定感を上げたい", "やる気・モチベーションが下がっている", "モチベーションを上げたい", "セミナーの壁打ち相手がほしい", "セミナーにフィードバックがほしい", "相談相手がほしい", "頭の中を整理したい", "モヤモヤしている", "社内向けのセミナーを探している", "研修の前のアイスブレイク"],
    note: "年間400名以上と個別セッションを実施、3ヶ月で新規61件・成約率55%の実績。「会うだけで元気になる」と言われ、10分で打ち解けることから別名【コミュ力おばけ】。人生迷子さんや、成長したい経営者・個人事業主の方へ、まずは自分軸を整えることからサポート。新潟県在住・全国オンライン対応(新潟・長野のご縁も歓迎)。公式LINE に登録すると「価値観のズレ」チェックシート(PDF)を無料でもらえる。誰とでもすぐ仲良くなれる「コミュ力おばけ」が強み。話すだけで思考が整理でき、モヤモヤを解消できます。マインドセットが得意なので、研修・セミナーの前に入れるコミュニケーションのワークもお伝えできます。",
    face: "新潟",
    faceAreas: ["niigata"],
    online: "all",
    targets: ["any"],
    prospects: ["owner", "staff", "individual"],
    links: [
      { type: "proposal", url: "materials/kobane-profile.jpg", label: "こばねぇ(小林 末季)ご案内・サポートメニュー", cover: "materials/kobane-profile.jpg" },
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
  Object.assign(rosterMember("m24", "栁橋 雅也", "合同会社フライコア 代表社員/地方創生・FP", "Team Bloom∞🌸", "暮らし・サービス", ["regional", "event", "inbound", "efficiency", "reform", "realestate", "ad", "insurance"]), {
    business: "地方創生事業(地方創生コンサル、災害対策商材、AIシステム導入、内装造作費用0円、LED広告透過フィルム)と FP(ファイナンシャルプランナー)。野外音楽フェス×地方創生「音楽でつながる地域の未来。」:音楽・自然・人がひとつになる野外音楽フェスで、交流人口の拡大、宿泊・飲食・交通・物販など地域全体の売上の向上、地元の飲食店や店舗の出店・連携、地域の魅力の全国への発信、子どもたちの夢や希望につながる地域づくりを目指す。出演者・協賛・支援・出店・ボランティアを募集。",
    wants: "野外音楽フェスに出演してくれるアーティスト/フェスを協賛・支援してくれる企業/フェスに出店してくれる地元の飲食店・物販のお店/一緒にフェスをつくるボランティア/地域を元気にしたい自治体・地域の方",
    customers: "税収を上げるための働きかけ、余った駐車場スペースの活用、作業効率の向上、内装費用のコスト削減などを考えている方",
    note: "理念は『1人から多数へ!1人の笑顔がまた1人へと、生命を与える! 地方創生から、みなぎる世界へ!』。学生時代は活動停止状態の野球部で自ら部員を集めて部を再建。大学ではドラムを担当してバンド活動を始め、卒業後はメジャーデビューを目指して音楽に専念。その後、大東建託で不動産営業、明治牛乳の訪問販売では月間150件の契約を獲得。34歳で海外積立事業を始め、生命保険会社へ。2019年に合同会社フライコアを設立して代表社員に就任し、広告のテレアポ営業で月間売上860万円を樹立。地方創生プランナーとの出会いから地方創生事業を始める。",
    triggers: ["地方創生", "地域を盛り上げたい", "音楽フェス", "フェスに出演したい", "イベントに協賛したい", "イベントに出店したい", "ボランティアをしたい", "税収を上げたい", "駐車場が余っている", "災害対策", "内装費用を抑えたい", "LED広告", "AIシステムを導入したい", "お金の相談をしたい", "ライフプラン", "保険を見直したい"],
    targets: ["any"],
    prospects: ["owner", "staff"],
    links: [
      { type: "proposal", url: "materials/yanagibashi-music-fes.jpg", label: "野外音楽フェス×地方創生「音楽でつながる地域の未来。」ご案内", cover: "materials/yanagibashi-music-fes.jpg" },
      { type: "proposal", url: "materials/yanagibashi-profile.jpg", label: "栁橋 雅也 プロフィールシート(理念・事業内容・経歴)", cover: "materials/yanagibashi-profile.jpg" },
    ],
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

// 名前のうしろに付いた呼び名(例:「小林 末季こばねぇ」の「こばねぇ」)を分ける。
// 漢字の名前のすぐあとに、ひらがな・カタカナが続くときだけ分け、カードなどでは2行に出す
function refNameParts(name) {
  const m = /^(.*[\u4e00-\u9fff\u3005])([\u3041-\u3096\u30a1-\u30fa\u30fc]{2,})$/.exec(String(name || "").trim());
  return m ? { main: m[1], nick: m[2] } : { main: String(name || ""), nick: "" };
}

// ほかの BT-EX のユニットのメンバー(BT-EX のメンバー一覧から。2026年10月)。1on1 の相手を選ぶときに使う。
// BT-EX5 はこのアプリの名簿そのもの
// (ここにいない方は、1on1 の記録でお名前を手で入れられる)
const BTEX_UNIT_MEMBERS = {
  1: ["石田 祐介", "伊藤 剛", "水落 磨樹", "佐藤 大介", "中野 未佳子", "MASAKI", "岸 宏保", "中田 侑太郎", "菊地 智美", "福永 あみ", "吉兼 直哉", "池田 誠", "内山 由依子", "城谷 コウ", "日田 伸幸", "塙 将博", "藤嶺 淳子", "宮下 将一", "柳田 高広", "寺本 勲", "鳥越 美耶", "有松健太｜ありけん", "大竹 直美", "小松 茂子", "大谷 有紀子|gerochan", "金子 徹男", "田邊 哲也", "松岡衣美 (えみゅーず)", "武村 岳人", "ねこすけ 福井", "島村 一輝", "山﨑 美優希", "熊川 和彦", "堀内 千尋", "田中 吾郎", "近野 華世", "ぎゅうちゃん 小松れいな", "榊原 豊", "伊藤 正樹", "深澤 歩", "田中 良行", "金澤 洸貴", "飯島 太呂", "日向 恵", "藤原 泉", "仲山 一真", "希月 秀光"],
  2: ["佐久知 あみ", "福井 貴子", "生谷 直美", "須山 舞夏", "竹内 友喜", "中川 覚郎", "横田 あつし", "藤澤 博章", "仲田 昌弘", "OK!!ShowGo 柴崎翔吾", "川村 英紀", "水谷 美根子", "前田 千賀子", "桝室 和寛", "三浦 健二", "守國 寿記", "澁川 光宏", "木村 晶子", "張本 美有", "綿谷 美佳", "狩俣 良一", "前田 祐里", "櫻井 靖子", "金子 麻里子", "中谷 志奈子", "髙橋 亜津子", "太田 剛"],
  3: ["佐久間 健寿", "夏川 Sunday", "岩瀬 よしの", "信貴 啓佑", "小笠原 志帆", "佐藤 勇樹", "谷口 美保", "嶋 えりか", "山崎 麻峰", "小島 政文", "中村 友美", "室井 茉里", "粟飯原 裕来", "西村 有貴", "中峰 剛", "高橋 拓真", "長谷川 浩幸", "越口 哲信", "小澤 陽一", "谷口 貴信", "飯田 梨良", "マカロン 広美", "村野 秀二", "田中 裕美子", "平井 友香子", "西村 和子", "天田 幸宏", "白鳥 伸一", "増山 拓也", "東 志穂", "鈴木 峰雄", "村井 芳久", "坂本 和保", "田中 清", "大西 茂之", "有安 寿斗", "橘 杏奈", "瀧北 富明", "安斎 永樹", "五十嵐 蓮", "アモーレ 石上", "小林 ちかふみ", "あやくも 智華子", "水谷 美優", "中村 正剛", "斎藤 邦治", "ウエノ シンゴ", "尾田 衣子", "宮長 紀", "小林 ゆか"],
  4: ["伊東 亜由", "酒谷 薫", "杉沼 俊和", "岡田 翔伍", "寺脇 智子", "衛藤 祥一", "松下 真紀子", "池田 恭朋", "足立 裕次朗", "松本 香鶴央", "打矢 健一", "川井 智貴", "尾田 笑子", "保井 秀一", "山元 あゆみ", "小島 啓誉", "眞清水 よしこ", "山下 文恵", "田中 吾一", "山内 陽子", "ナンバ ユキコ", "明治 成慈", "荻原 豪", "三枝 孝伊", "もふみ (友枝かすみ)", "中村 あずさ", "東橋 達矢", "髙木 剛", "おぎの まさみ", "横田 亜佐恵", "中山 裕貴", "栁田 加奈子", "白岩 成友", "下市 知佳", "とん とん", "間 実夏", "望月 泰成", "八田 奈緒美", "秋葉 麻里", "内田 彩加", "勝見 喜樹", "宮里 阿彌華", "田中 梢"],
  5: null, // このアプリの名簿
  6: ["もり めぐみ", "村上 嘉朗", "岩井 久典", "原田 あつ子", "根本 小百合", "野口 晃", "青木 めぐみ", "ウィリス 朋子", "西野 恵子", "春川 美鈴", "樺良 侑香里", "富岡 光城", "塩満 彩子", "長谷川 豊", "井上 信子", "石田 水央", "堺 典子", "大森 裕貴", "高麗 淳子", "川本 一希", "田村 正斗"],
  7: ["熊坂 亮浩", "黒澤 篤", "服部 好江", "寺内 正樹", "関戸 朋子", "畔見 知子", "土屋 正路", "周藤 緑", "礒部 昌之", "マジシャン DAI", "太田 ちえこ", "矢口 健彦", "古賀 有紀", "宮崎 豊久", "井上 信次", "豊田 大和", "渡辺 将人", "伊佐治 依子", "土田 浩美", "吉野 正悟", "松岡 知宏", "市川 さちえ"],
  8: ["杉原 かおり", "木村 潤子", "渡部 玉枝", "渡部 靖史", "わたなべ 皓至", "和地 峰子", "さかえ みきこ", "小山 有香", "Maayan (まーやん)", "北條 愛", "赤地 周作", "佐藤 勇士", "市原 由紀", "鈴木 雄久", "菅野 幸悦", "小川 了大", "黒沼 玲太", "武田 一樹", "福崎 芳枝", "寺口 真弘", "堀内 千尋", "丸山 その子", "旗手 愛", "廣松 寛子", "山崎 貴博", "清水 洋子", "本多 俊一"],
  9: ["杜丞 なおん", "福田 耕治", "奥森 九月"],
  10: ["川端 健支", "近藤 陽子", "多嶋 僚介", "山本 晴功", "兼重 日奈子", "坂川 和穂", "大野 和哉", "高井 ちずこ", "寺本 美乃里", "堀田 将伍", "川本 光輝", "小野 はるの", "西村 健太郎", "和田 拓巳"],
  11: ["横辻 悠太", "猪飼 玲子", "MAKI マキ", "工藤 大和", "宮守 洋輔", "竪道 美智代", "川崎 怜央", "大森 由佳子", "若松 大祐", "瑞野 りあ", "橋本 あけみ", "白川 由美子", "田中 みっち", "妻鹿 正裕", "四ヶ所 伸一"],
  12: [],
  13: ["堂元 亜希子", "鏑木 仁美", "佐藤 準", "小野 珠実(たまちゃん先生)", "鈴木 貴博", "中山 由己", "下原 貴武", "松本 美樹"],
  14: [],
};

// 定例会の進行スライド(プレゼンの画面の「定例会をはじめる」で、オープニングムービーのあとに進行表の順で出す)。
// 進行表(定例会の「進行」)の ①〜⑦ の行から、区切りのスライドを作る。下はその中に入れる中身
const BTEX_DECK = {
  // ①はじめのあいさつ: 代表の紹介(写真は本人がアプリで入れたもの)
  leader: {
    memberId: "m16",
    title: "BT-EX5 代表",
    kana: "サクラバ リカ",
    achievements: ["4ヶ月で1万人フォロワー達成", "3万人フォロワー", "PR案件 100件以上", "5000人の事業者コミュニティの代表"],
    now: [
      "2万人を超える「経営者・事業者」のコミュニティ運営(うち5000人の事業者コミュニティの代表)",
      "SNS運用代行(株式会社LEFANA):\n東京ガールズコレクションの\nデザイン全般を手がけた企業と\n業務提携し、複数の企業の\nSNS 運用を行う",
      "心身の周波数を整える、唯一無二のお水事業",
      "「コスパ最高の事業支援 &\n日本トップの資産形成スクール」の広報",
    ],
    dreams: ["精神的にも経済的にも自立した女性を増やす", "お互いを応援し合える、勝たせ合える環境をつくる", "一歩踏み出すキッカケになる"],
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
      "BT-EXメンバーは、LINKの会員規約に準ずるものとする",
      "紹介活動+1on1の合計値が《3件/月》以上をコミットすること",
      "定例会中、交流会中の商品の売り込み、他社MLM・宗教・政治団体への勧誘を禁ずる",
      "不正または違法な事業者の入会を禁ずる",
      "金融商品においては、金融庁登録番号を\n取得している業者に限る",
    ],
    attendance: [
      "所属ユニットの出席は月1回以上\n月2回のうち1回は他ユニットの\n出席もカウントとする",
      "無断欠席・遅刻早退は禁止\n《(2回の遅刻、早退で1回欠席扱い)》",
      "最低年《12回》は自ユニットに出席すること",
      "同一人物のビジター参加は2回までとする",
    ],
    note: "規定に関しては必要に応じて6ヶ月タームで見直しの合議を設ける",
    // 数字で見る約束(規定の前のスライド)。[数字, 説明]
    kpis: [["3件/月", "紹介活動 + 1on1 の合計"], ["月1回以上", "所属ユニットへの出席"], ["年12回", "自ユニットへの最低出席"], ["2回まで", "同じ方のビジター参加"]],
    // 規定のカードの見出し(規定と同じ順。文はそのまま下に出す)と絵(round.js の LINE_ICONS の名前。ban は禁止の印)
    heads: {
      general: ["LINK の B.T.会員", "LINK の会員規約に準ずる", "紹介活動+1on1 3件/月", "売り込み・勧誘の禁止", "不正・違法な事業者の禁止", "金融商品は登録業者のみ"],
      attendance: ["所属ユニット 月1回以上", "無断欠席・遅刻早退の禁止", "自ユニット 年12回以上", "ビジター参加は2回まで"],
      ethics: ["誠実なサービスと価格", "誠実に向き合う", "信頼を積み重ねる", "前向きに支え合う", "プロとしての責任", "互いを尊重する"],
    },
    icons: {
      general: ["idcard", "doc", "target", "ban", "ban", "bank"],
      attendance: ["users", "ban", "calendar", "visitor"],
      ethics: ["shield", "heart", "link", "spark", "award", "chat"],
    },
    ethics: [
      "安心して選んでいただけるように、誠実なサービスと分かりやすい価格を大切にします",
      "メンバーにも、その先の大切なご縁にも、いつも誠実な気持ちで向き合います",
      "一つひとつの関わりを大切に、信頼が積み重なる関係を育てていきます",
      "前向きな気持ちと、支え合う姿勢を大切にします",
      "自分の仕事に誇りを持ち、プロとしての責任を大切に行動します",
      "公の場やチャットにおいても、メンバーやグループへの否定的な発言は控え\n互いを尊重するコミュニケーションを大切にします",
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
  ],
  // 時間の目安(分)。2時間の定例会のタイムマネジメントに使う(0: オープニング、1〜: 流れの番号)
  // オープニング1分・挨拶5分・理念20分・エデュケーション(5分+α1分)6分・1分プレゼン32分・商談(10分×3回+α6分)36分・実績紹介15分・終わりの挨拶5分 = 120分
  timeplan: [1, 5, 20, 6, 32, 36, 15, 5],
  // スケジュール(次回以降の日程は、予定に入っている定例会から出す)
  schedule: {
    title: "BT-EX5 スケジュール",
    lead: "月2回のオンライン定例会",
    rows: [["第一水曜日", "13:00-15:00"], ["第三土曜日", "20:00-22:00"]],
    note: "今後、新潟・東京各月でリアル定例会も開催予定",
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
  m09: "assets/members/m09.jpg", // 大場 雅俊
  m10: "assets/members/m10.jpg", // 大枝 篤志
  m11: "assets/members/m11.jpg", // 品川 瑞樹
  m12: "assets/members/m12.jpg", // 菅野 節子
  m14: "assets/members/m14.jpg", // 三村 隆
  m16: "assets/members/m16.jpg", // 桜羽 李果
  m17: "assets/members/m17.jpg", // むらさき やえ
  m19: "assets/members/m19.jpg", // 岡本 伸
  m20: "assets/members/m20.jpg", // 柏木 本徳
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
];

// 紹介に効く項目(重要な順)。足りない項目は管理者ページの「お願い文」と、
// 本人への記入のお願いに使う
// BT-EX5 の定例会(はじめに一度だけ入れる。以降は会員アプリの管理者が作成・編集する)。
// 参加リンク(Zoom など)はここに置かない(このファイルは誰でも読めるため)。オンラインの回は Google Meet を作る
// 当日の流れは BT-EX の指針(オンライン定例会)の順。①②③⑥⑦は BT-EX 共通、④⑤はユニットごとに変えてよい
const REF_SEED_AGENDA = [
  "①はじめの挨拶", "②BT-EXの理念", "③エデュケーションコーナー 5分", "④1分プレゼンテーション",
  "⑤ブレイクアウトルーム商談 10分×3", "⑥LINKのビジネス実績紹介", "⑦終わりの挨拶",
].join("\n");
// 以前の流れ(運営が書きかえていない定例会だけ、上の流れに置きかえる)
const REF_SEED_AGENDA_PREV = [
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
      "・「数字で見る BT-EX の約束」を「BT-EX の約束」にしました。",
      "・一般規定・出席規定・倫理規定を、それぞれ1枚のスライドにし、絵・番号・見出しのついたカードで見やすくしました(禁止のものは赤い印と「禁止」の札)。規定の文はそのままです。カードの見出しは「スライドの内容を編集」で変えられます。",
      "・主な3つの活動の「パターン1・2・3」を枠で囲んだ札にし、「:」を消しました。",
      "・代表の紹介の「「コスパ最高の事業支援 &/日本トップの資産形成スクール」の広報」を、必ず2行で出すようにしました。",
      "・仕組みとベネフィットの文の「、」を消し(「エデュケーションコーナー・BT スクール連携により」)、「毎月のリアルな懇親会で/絆を深くする」と改行しました。",
      "・主な3つの活動の文の「、」を消し、「メンバーのプレゼンや/メンバーサイト・/日頃の 1on1 により/常に紹介できる人脈を探す活動」としました。",
      "・スライドの題の下線を、題の文字の端から端まで引くようにしました。",
      "・大場さん・一場さん・佐藤 志織さん・大藤さん・見上さん・柏木さん・松田さん・坂上さんの顔写真を入れました(30秒プレゼンのスライドなどに出ます)。",
      "・栁橋 雅也さんのお名前の漢字を直しました(「柳」→「栁」)。",
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
