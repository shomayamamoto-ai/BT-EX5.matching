// ============================================
// BT-EX5 紹介先早見表 — 共有サーバー(Google Apps Script)
// このファイルは tools/build-gas.mjs が自動で作ったものです。直接編集しないでください。
// 元のファイル: referral/data.js / auth/server-core.js / gas/main.js
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
  pendingNote: "「準備中」のメンバーは、求める紹介や活動範囲がまだ入っていません。ご自身の情報は、マイページの「自分の情報を編集」からいつでも入力できます。",
};

const UNCATEGORIZED = "その他・未分類";

const REF_CATEGORIES = [
  "IT・Web・クリエイティブ",
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
  { id: "biz", label: "仕事・集客" },
  { id: "money", label: "お金・法律" },
  { id: "people", label: "人・組織・成長" },
  { id: "place", label: "住まい・地域" },
  { id: "life", label: "健康・暮らし" },
  { id: "food", label: "食・イベント" },
];

const TOPICS = [
  { id: "efficiency", group: "biz", label: "業務の効率化・システム化" },
  { id: "web", group: "biz", label: "ホームページ・集客・SNS" },
  { id: "ec", group: "biz", label: "ネットショップ・EC" },
  { id: "ai", group: "biz", label: "AI活用・AI研修" },
  { id: "video", group: "biz", label: "動画・PR" },
  { id: "design", group: "biz", label: "デザイン・印刷物" },
  { id: "branding", group: "biz", label: "ブランディング・見せ方" },
  { id: "tax", group: "money", label: "税金・会計" },
  { id: "legal", group: "money", label: "契約・法律・許認可" },
  { id: "funding", group: "money", label: "資金調達・補助金・融資" },
  { id: "insurance", group: "money", label: "保険・資産・相続" },
  { id: "hiring", group: "people", label: "採用・人材" },
  { id: "org", group: "people", label: "組織づくり・社員研修" },
  { id: "labor", group: "people", label: "労務・助成金" },
  { id: "coaching", group: "people", label: "コーチング・人生相談" },
  { id: "voice", group: "people", label: "声・話し方・司会" },
  { id: "realestate", group: "place", label: "不動産・物件・空き家" },
  { id: "reform", group: "place", label: "リフォーム・内装" },
  { id: "inbound", group: "place", label: "インバウンド・海外・地方創生" },
  { id: "health", group: "life", label: "健康・美容" },
  { id: "spiritual", group: "life", label: "スピリチュアル・癒やし" },
  { id: "life", group: "life", label: "暮らし(車・介護・家事・固定費)" },
  { id: "family", group: "life", label: "結婚・子育て・家族" },
  { id: "kids", group: "life", label: "子ども・学校・教育" },
  { id: "food", group: "food", label: "食品・ギフト・仕入れ" },
  { id: "catering", group: "food", label: "ケータリング・パーティー料理" },
  { id: "event", group: "food", label: "イベント企画" },
  { id: "venue", group: "food", label: "会場・レンタルスペース" },
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
const LINK_TYPES = [
  { id: "proposal", label: "提案資料・パンフレット", kind: "material" },
  { id: "website", label: "ホームページ", kind: "web" },
  { id: "instagram", label: "Instagram", kind: "contact" },
  { id: "line", label: "LINE", kind: "contact" },
  { id: "facebook", label: "Facebook", kind: "contact" },
  { id: "x", label: "X(旧Twitter)", kind: "contact" },
  { id: "youtube", label: "YouTube", kind: "web" },
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
    category: "IT・Web・クリエイティブ",
    business:
      "業務効率化システムの開発(予約・在庫・契約書・営業リストなど/30万〜600万円)、ホームページ・LP制作、社員向け生成AI研修・AI導入支援(講師1回10万円〜)。動画・SNS運用・LINE構築も対応。",
    note: "相談・見積り無料、48時間以内に返信。最低発注額なし、1業務・研修1回から。",
    wants:
      "紙・Excel・電話で業務を回している中小企業や複数店舗の経営者(飲食・小売・サロン・士業事務所など)/AIを導入したいが何から始めるか決まっていない会社",
    triggers: ["手作業に時間がかかる", "予約・在庫管理がバラバラ", "HPを作ったきり", "社員にAIを使わせたい", "AI研修", "LINEで集客"],
    face: "関東(東京拠点)",
    faceAreas: ["tokyo"],
    online: "all",
    topics: ["efficiency", "web", "ai", "video", "design", "org"],
    targets: ["restaurant", "retail", "salon", "pro", "build", "it"],
    prospects: ["owner", "staff"],
    links: [
      { type: "proposal", url: "materials/lumenium-proposal.pdf", label: "Lumenium 自己紹介・ご提案(14ページ)", cover: "materials/lumenium-proposal-cover.jpg" },
      { type: "website", url: "https://lumenium.net", label: "lumenium.net" },
      { type: "instagram", url: "https://www.instagram.com/showstagram.keio/", label: "@showstagram.keio" },
    ],
  },
  Object.assign(rosterMember("m02", "あまみや 七音", "echo studio 代表/声優ボイス・ドクター", "Over", "IT・Web・クリエイティブ", ["voice", "video", "health"]), {
    business: "ボイストレーニング教室、レコーディングスタジオ、タレント・声優のキャスティング。",
    customers: "声優の卵、芸能プロダクション、カラオケ好きのビジネスマン、映像制作会社、TV局",
    note: "「長く喋ると喉が枯れる…原因は姿勢と口の開け方と呼吸量」",
    wants: "声優を目指している人/声優やナレーターとしてもっと仕事を取っていきたい人/歌の活動をしていきたい人/喋ったり歌ったりすると声が枯れる人",
    triggers: ["声優になりたい", "ナレーションの仕事を増やしたい", "歌の活動をしたい", "喋ると声が枯れる", "録音スタジオを探している", "声優・タレントを起用したい"],
    targets: ["it", "personal"],
    prospects: ["individual", "owner", "staff"],
  }),
  Object.assign(rosterMember("m03", "佐藤 志織", "アットハッピー/Canva・AI講師、LP・サイト制作", "All Win🏆", "IT・Web・クリエイティブ", ["ai", "web", "design"]), {
    business: "Canva・AI講師、LP・サイト制作、Webデザイン。",
    customers: "個人・フリーランス・事業主",
    wants: "いい活動をしているのに、発信・Web・LINE・申し込み導線がバラバラでうまく広がっていない人",
    triggers: ["発信がうまく広がらない", "申し込み導線がバラバラ", "LPを作りたい", "Canvaを覚えたい", "AIを使いこなしたい", "公式LINEを整えたい"],
    targets: ["any"],
    prospects: ["owner", "individual"],
  }),
  Object.assign(rosterMember("m04", "吉澤 美和子", "新潟県/ハンドメイド", "SunnyUp🌞", "暮らし・サービス", ["spiritual", "health"], "新潟"), {
    business: "オルゴナイトの制作・販売。",
    customers: "スピリチュアルが好きな方、スピリチュアルのお仕事をされている方",
    wants: "スピリチュアルのお仕事をされている方",
    triggers: ["スピリチュアル", "オルゴナイト", "パワーストーン", "癒やしグッズ", "ハンドメイド作品"],
    targets: ["salon", "personal"],
    prospects: ["individual", "owner"],
  }),
  Object.assign(rosterMember("m05", "大藤 誠", "SFGビューティ株式会社 代表取締役/世界初・ハラール認証フェイスマスク", "CANOW", "美容・健康", ["health", "food"], "東京"), {
    business: "meirune glutathione intensive seat mask(世界初・ハラール認証フェイスマスク)、JUST ONE オールインワンタオル。",
    customers: "美容室・エステサロン・ホテル・温浴施設・介護施設など、衛生面やタオルの洗濯・管理コストに課題を抱えている事業者",
    wants: "美容・宿泊・介護・温浴施設の経営者や仕入れ担当者、複数店舗を展開する企業の購買担当者",
    triggers: ["タオルの洗濯・管理コスト", "衛生面が気になる", "備品の仕入れを見直したい", "フェイスマスク", "ハラール", "ホテル・温浴施設"],
    targets: ["salon", "medical", "retail"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m06", "吉原 優", "FJ 営業", "", "お金・保険", ["insurance", "family"]), {
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
  Object.assign(rosterMember("m09", "大場 雅俊", "Ghool株式会社/金融業界に特化したビジネスコンサルティング", "Over", "お金・保険", ["insurance"]), {
    business: "金融業界に特化したビジネスコンサルティング(集客・コンサル)。",
    wants: "生命保険営業の方",
    triggers: ["生命保険の営業をしている", "保険営業の集客", "金融業界のコンサル"],
    targets: ["pro"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m10", "大枝 篤志", "マイプラBT 代表/売上動線も作れる公式LINE専門家", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["web", "hiring", "life"]), {
    business: "売上を増やす(売上動線作りのサポート・LINE・SNS)/収入を増やす(副業・紹介案件・人材紹介)/支出を減らす(格安SIM・ガス・Wi-Fiなど固定費の削減)。",
    customers: "30〜50代の男女(特に40代が中心)/個人事業主・フリーランス・中小企業経営者/子育て世代・共働き世帯/会社員で副収入を作りたい人",
    wants: "皆さんが定期的に通われている美容室のオーナー/起業して3年以内の経営者・個人事業主",
    triggers: ["公式LINEを始めたい", "売上動線を作りたい", "副業を始めたい", "固定費を減らしたい", "格安SIM・Wi-Fi", "起業したばかり"],
    targets: ["salon", "any"],
    prospects: ["owner", "individual"],
  }),
  rosterMember("m11", "品川 瑞樹", "株式会社アドバンス/集客・コンサル", "", "IT・Web・クリエイティブ", ["web"]),
  Object.assign(rosterMember("m12", "菅野 節子", "リンパレディアソック 代表者/誰でも健康アドバイザー", "Team Bloom∞🌸", "美容・健康", ["health"]), {
    business: "リンパレディ講座。",
    customers: "セラピスト、施術者、一般のお客様、OL、主婦",
    wants: "体験会の集客(体験会に参加してくれる方)",
    triggers: ["リンパケア", "むくみ・不調", "体験会に参加したい", "セラピスト・施術者", "健康講座"],
    targets: ["salon", "personal"],
    prospects: ["individual", "owner"],
  }),
  rosterMember("m13", "佐藤 慎哉", "", "", "", []),
  Object.assign(rosterMember("m14", "三村 隆", "株式会社エイレム・Guild Master株式会社 代表取締役", "Team Bloom∞🌸", "", ["health", "reform", "food"]), {
    business: "美容、リフォーム、飲食、プラットフォーム。",
    customers: "法人・個人問わず",
    wants: "幅広く対応可能です",
    triggers: ["美容", "リフォームしたい", "飲食店", "プラットフォーム"],
    targets: ["any"],
    prospects: ["owner", "staff", "individual"],
  }),
  Object.assign(rosterMember("m16", "桜羽 李果", "株式会社LEFANA/女性向けSNSブランディング", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["branding", "web", "design", "video"]), {
    business: "女性向けに特化したデザイン会社。ブランディング、Web制作・運営・コンサルティング、グラフィックデザイン、SNS運用代行、インフルエンサー・モデルのキャスティング、写真・映像撮影、ビジネスマッチング。",
    customers: "女性向けの商材をお持ちの方、美容クリニック、お菓子・スイーツ業界、不動産",
    wants: "Webディレクター、Webデザイナー、SNS運用ディレクター、営業など(一緒に働く仲間)",
    triggers: ["女性向けの商品を売りたい", "ブランディング", "SNS運用を任せたい", "インフルエンサーを起用したい", "写真・動画の撮影", "Webデザイナーの仕事を探している"],
    targets: ["salon", "medical", "retail", "restaurant"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m17", "むらさき やえ", "COCOLOR(ココカラー)代表/波動を使った「あなた色ブランディング スタイリスト」", "", "美容・健康", ["branding", "health", "spiritual"]), {
    business: "あなた色ブランディングプログラム/(内面)バースカラー診断/(外見)似合う色・質感・柄・形診断/(表現)ブランディングコンサル/スタイリング・ショッピング同行/(プロ養成)CoCoカラースタイリスト養成講座。",
    customers: "「すでに経験も実力もある。でも、まだ自分を活かし切れていない方」。自分の経験や能力をさらに活かし、自分らしく次のステージへ進みたい40〜60代の起業家・経営者・専門職・講師業の方。外見・発信・ブランディングを整え、仕事でも人生でも「自分らしく選ばれる存在」になりたい方。",
    wants: "【法人】アパレル&デザイン&広告関係/結婚相談所/起業支援事業 【個人】「実力はあるのに、なぜか選ばれない」「今の見せ方が本当の自分と合っていない」「これからの人生や仕事を自分らしくステージアップしたい」と感じている40〜60代の起業家・経営者・専門家",
    triggers: ["実力はあるのに選ばれない", "見せ方を変えたい", "似合う色を知りたい", "パーソナルカラー", "ショッピング同行", "セルフブランディング"],
    targets: ["retail", "pro", "any"],
    prospects: ["owner", "individual"],
  }),
  Object.assign(rosterMember("m18", "髙橋 誠二", "スポーツ用品EC事業者/EC運営支援", "CANOW", "IT・Web・クリエイティブ", ["ec", "web"]), {
    business: "スポーツ用品のEC事業、EC運営支援。",
    triggers: ["ネットショップを始めたい", "ECの売上を伸ばしたい", "スポーツ用品"],
    targets: ["retail"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m19", "岡本 伸", "株式会社 心灯/目標達成コーチング", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["coaching", "branding", "web", "video"]), {
    business: "Web制作(HP・SNS運用・SEO・MEO対策・AI動画)、自己ブランディングビジネス(能力開発)。",
    customers: "10名前後の法人様/目標達成が苦手な人/3年目の個人事業主",
    triggers: ["HPを作りたい", "SNS運用を任せたい", "SEO・MEO対策", "AI動画", "目標が達成できない", "自分をブランディングしたい"],
    targets: ["any"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m20", "柏木 本徳", "株式会社REVE 取締役/資金調達コンサル(融資・借換・金策)", "", "お金・保険", ["funding", "health"]), {
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
  Object.assign(rosterMember("m22", "小林 末季こばねぇ", "preseia 代表/心を整えるマインドコーチ", "SunnyUp🌞", "人材・組織", ["coaching", "health", "spiritual", "insurance"]), {
    business: "個別コーチング、ビジネスコンサル、健康事業、共済保険。",
    customers: "新潟・長野の方/人生に迷いながらも進み出したい人/セミナーを作りたい方/コーチの方",
    wants: "新潟・長野の方/コーチングをグレードアップしたい方/健康事業に興味のある方/スピリチュアルに興味のある方",
    triggers: ["人生に迷っている", "セミナーを作りたい", "コーチング", "健康に興味がある", "スピリチュアル", "新潟・長野"],
    targets: ["any"],
    prospects: ["owner", "individual"],
  }),
  Object.assign(rosterMember("m23", "見上 恵", "ちきゅあそびくらぶ/AI絵本クリエイター、スクール講師、クリエイター募集", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["ai", "design", "kids"]), {
    business: "AI絵本クリエイター、講座講師。",
    customers: "自分の想いを絵本にしたい方",
    triggers: ["想いを絵本にしたい", "自分史を絵本に残したい", "AI絵本", "クリエイターになりたい", "AIの講座を受けたい"],
    targets: ["any"],
    prospects: ["individual", "owner"],
  }),
  Object.assign(rosterMember("m24", "柳橋 雅也", "合同会社フライコア 代表社員/地方創生", "Team Bloom∞🌸", "暮らし・サービス", ["inbound", "ai", "efficiency", "reform", "realestate"]), {
    business: "地方創生コンサル、災害対策商材、AIシステム導入、内装造作費用0円、LED広告透過フィルム。",
    customers: "税収を上げるための働きかけ、余った駐車場スペースの活用、作業効率の向上、内装費用のコスト削減などを考えている方",
    triggers: ["地方創生", "税収を上げたい", "駐車場が余っている", "災害対策", "内装費用を抑えたい", "LED広告", "AIシステムを導入したい"],
    targets: ["any"],
    prospects: ["owner", "staff"],
  }),
  Object.assign(rosterMember("m25", "松田 依子", "株式会社Lift 代表取締役/ちきゅうあそびくらぶ", "Team Bloom∞🌸", "暮らし・サービス", ["ai", "kids", "voice", "event", "insurance"]), {
    business: "AI絵本(自分史絵本・エンディング絵本・感謝の絵本・子育て・親子・技術をわかりやすく等)、司会・MC、コンサル・プロデュース、コミュニケーション・ボイトレ・朗読、芦屋スマートラジオの企画運営・番組、イベント・パーティー企画、コミュニケーション講座、AI講座・AI動画、潜在意識・波動アップ、詐欺に遭わないための金融アドバイザー(本物か見抜く・海外保険・海外銀行等・税金対策)、美容・健康(Life wave・コロイドヨード)。",
    customers: "会社や自身や商品をもっと世に広めたい人、次世代に残したい思いのある人、自分史を絵本にしたい人、販売促進・集客したい人、自分を変えたい人、AI絵本クリエイター資格を学びたい人、AIを学びたい人、健康に困っている人、人生を変えたい人、ちきゅうあそびくらぶの理念に賛同し世界に羽ばたく活動に興味を持ってくれる人",
    wants: "会社や自身や商品をもっと世に広めたい人/次世代に残したい技術・思いのある企業・社長等/終活ビジネス(エンディング絵本)/AI絵本クリエイター資格をとって一緒に活動してくれるクリエイターになりたい人/新しいビジネススキルが欲しい人/ラジオ番組を持ちたい人",
    triggers: ["商品を世に広めたい", "自分史を残したい", "終活", "絵本を作りたい", "ラジオ番組を持ちたい", "司会を頼みたい", "AIを学びたい"],
    targets: ["any"],
    prospects: ["owner", "individual"],
  }),
  Object.assign(rosterMember("m26", "坂上 智子", "OHANAの輪 代表/地域密着型", "All Win🏆", "食・地域産品", ["food", "kids", "event"]), {
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
];

// 紹介に効く項目(重要な順)。足りない項目は管理者ページの「お願い文」と、
// 本人への記入のお願いに使う
const PROFILE_ITEMS = [
  { key: "range", label: "活動範囲", ask: "活動範囲(新潟・東京/関東で対面できるか、オンラインで対応できるか)", ok: (m) => m.faceAreas.length > 0 || (m.online && m.online !== "unknown") },
  { key: "wants", label: "求める紹介", ask: "求める紹介(どんな悩みを持つ、どんな人を紹介してほしいか)", ok: (m) => Boolean(m.wants) },
  { key: "business", label: "事業内容", ask: "事業内容(取り扱っている商品・サービス)", ok: (m) => Boolean(m.business) },
  { key: "triggers", label: "こんな話が出たら", ask: "こんな話が出たら自分を思い出してほしい、という言葉(3つ以上。例:「HPを作ったきり」「人が採れない」)", ok: (m) => m.triggers.length >= 3 },
  { key: "customers", label: "主なお客様", ask: "主なお客様(どんな方がお客様になっているか)", ok: (m) => Boolean(m.customers) },
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
// 認証: 会員登録はなく、コミュニティ共通のパスコードで入る。
// パスコードが正しければ名簿から自分の名前を選んでセッションを発行する
// (紹介の記録を本人名義で集計するため)。管理者用パスコードで入った
// セッションだけが名簿を編集できる。失敗理由は AUTH_FAILED / LOCKED の2種、
// verifySession の失敗は SESSION_INVALID 単一コード(§5.4 / §5.5)。
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
    SERVER_ERROR: "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
  };

  // 紹介の対応状況(紹介を受けた本人が更新する)
  var REFERRAL_STATUSES = ["new", "contacted", "won", "lost"];

  // 本人が編集できる項目(名前・所属チーム・ID は管理者のみ)
  var SELF_EDITABLE = [
    "company", "base", "category", "business", "customers", "note", "wants", "triggers",
    "face", "faceAreas", "online", "topics", "targets", "prospects", "links",
  ];

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
    };
    return lists[name];
  }
  function idsOf(name) {
    var list = dataList(name);
    return list ? list.map(function (x) { return x.id; }) : null;
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function createServer(env) {
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
    // 削除済みのメンバーは戻さない
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
            if (r.force || !current.editedAt || isBlankField(k, current[k])) next[k] = clone(seedMember[k]);
          });
          db.referralMembers[index] = next;
        });
        db.seedRevisions.push(r.rev);
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

    function toPublicUser(u, session) {
      // §5.3 の7フィールド。管理者かどうかはセッション単位(入ったパスコード)で決まる
      return {
        userId: u.userId,
        email: "",
        role: session.isAdmin ? "admin" : "member",
        accountStatus: "active",
        subscriptionStatus: "active",
        paymentExempt: false,
        isAdmin: session.isAdmin === true,
      };
    }

    function ok(data) { return { success: true, data: data }; }
    function fail(code) {
      return {
        success: false,
        error: { code: code || "UNKNOWN", message: ERRORS[code] || ERRORS.SERVER_ERROR },
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
      return { session: session, user: user };
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

      var token = randomToken();
      var session = {
        userId: user.userId,
        isAdmin: role === "admin",
        issuedAt: nowMs(),
        expiresAt: nowMs() + ttlMs,
        remember: remember,
        revoked: false,
        userAgent: String(body.userAgent || "").slice(0, 300),
      };
      db.sessions[token] = session;
      saveDb(db);

      return ok({
        sessionToken: token,
        expiresAt: new Date(session.expiresAt).toISOString(),
        remember: remember,
        user: toPublicUser(user, session),
        displayName: user.name,
      });
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
        user: toPublicUser(a.user, a.session),
        displayName: a.user.name,
        memberId: a.user.memberId,
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
        if (!x || typeof x !== "object" || out.length >= 8) return;
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
      if (!a.session.isAdmin) return { error: fail("FORBIDDEN_ADMIN") };
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
      var member = sanitizeReferralMember(body.member, id);
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
            return { id: l.id, fromName: giverName(l.fromUserId), prospect: l.prospect, memo: l.memo || "", topics: l.topics || [], status: l.status, at: l.at };
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
    };

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

    return { handle: handle };
  }

  return {
    createServer: createServer,
    sha256Hex: sha256Hex,
    ERRORS: ERRORS,
    REFERRAL_STATUSES: REFERRAL_STATUSES,
    // 書き込みを伴う操作(共有サーバーでスプレッドシートの一覧を更新する対象)
    MUTATING_ACTIONS: [
      "updateMyProfile", "adminSaveReferralMember", "adminDeleteReferralMember", "adminImportReferralMembers",
      "recordReferral", "deleteReferral", "updateReferralStatus",
    ],
  };
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
//   「名簿」「紹介の記録」シート … 運営者が見るための一覧(書き込みのたびに更新)
// 同時アクセスはスクリプトロックで1件ずつ処理する。
// ============================================

/** @OnlyCurrentDoc */

var DATA_SHEET = "_data";
var CHUNK_SIZE = 40000; // セルの上限(5万文字)より小さく
var STATUS_LABELS_JA = { new: "未対応", contacted: "連絡済み", won: "成約", lost: "見送り" };

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

var SERVER_ = BtexServerCore.createServer({
  load: loadDb_,
  save: saveDb_,
  randomBytes: randomBytes_,
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
    ["ID", "氏名", "会社名・肩書き", "所属チーム", "拠点", "業種", "事業内容", "主なお客様", "求める紹介", "こんな話が出たら", "対面", "オンライン", "資料・リンク", "最終更新", "更新した人"],
    members.map(function (m) {
      var links = (m.links || []).map(function (l) { return (l.label || l.type) + " " + l.url; }).join("\n");
      return [m.id, m.name, m.company, m.team, m.base, m.category, m.business, m.customers, m.wants, m.triggers, m.face, onlineLabels[m.online] || "", links, fmtTime_(m.editedAt), m.editedBy === "self" ? "本人" : m.editedBy === "admin" ? "管理者" : ""].map(cell_);
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
  try {
    var result = SERVER_.handle(body);
    if (result.success && body && BtexServerCore.MUTATING_ACTIONS.indexOf(body.action) !== -1) {
      try { refreshSheets_(); } catch (err) { console.error(err); }
    }
    return json_(result);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ success: true, data: { service: "BT-EX5 紹介先早見表 API", status: "ok" } });
}

// 初回に Apps Script のエディタから一度だけ実行する(権限の承認と、名簿の作成)
function setup() {
  SERVER_.handle({ action: "verifySession", sessionToken: "" });
  refreshSheets_();
  return "準備できました。名簿 " + (loadDb_().referralMembers || []).length + " 名";
}
