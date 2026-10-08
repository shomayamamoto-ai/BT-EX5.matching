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
  pendingNote: "「準備中」のメンバーは、求める紹介や活動範囲を管理者が順次追加します。",
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
const TOPICS = [
  { id: "efficiency", label: "業務の効率化・システム化" },
  { id: "web", label: "ホームページ・集客・SNS" },
  { id: "ai", label: "AI活用・AI研修" },
  { id: "video", label: "動画・PR" },
  { id: "design", label: "デザイン・印刷物" },
  { id: "tax", label: "税金・会計" },
  { id: "legal", label: "契約・法律・許認可" },
  { id: "funding", label: "資金調達・補助金・融資" },
  { id: "insurance", label: "保険・資産・相続" },
  { id: "realestate", label: "不動産・物件・空き家" },
  { id: "reform", label: "リフォーム・内装" },
  { id: "hiring", label: "採用・人材" },
  { id: "org", label: "組織づくり・社員研修" },
  { id: "labor", label: "労務・助成金" },
  { id: "health", label: "健康・美容" },
  { id: "food", label: "食・ギフト・仕入れ" },
  { id: "event", label: "イベント・会場" },
  { id: "life", label: "暮らし(車・介護・家事)" },
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
  },
  Object.assign(rosterMember("m02", "あまみや 七音", "echo studio 代表/声優ボイス・ドクター", "Over", "IT・Web・クリエイティブ", ["video", "health"]), {
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
  Object.assign(rosterMember("m04", "吉澤 美和子", "新潟県/ハンドメイド", "SunnyUp🌞", "暮らし・サービス", ["health"], "新潟"), {
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
  rosterMember("m06", "吉原 優", "", "", "", []),
  rosterMember("m07", "樺澤 一郎", "", "", "", []),
  Object.assign(rosterMember("m08", "床島 良夫", "非営利団体 人生工房 理事", "SunnyUp🌞", "暮らし・サービス", ["event", "org"]), {
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
  rosterMember("m10", "大枝 篤志", "売上動線も作れる公式LINE専門家", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["web"]),
  rosterMember("m11", "品川 瑞樹", "", "", "", []),
  rosterMember("m12", "菅野 節子", "誰でも健康アドバイザー", "Team Bloom∞🌸", "美容・健康", ["health"]),
  rosterMember("m13", "佐藤 慎哉", "", "", "", []),
  rosterMember("m14", "三村 隆", "美容、建設、飲食、プラットフォーム", "Team Bloom∞🌸", "", []),
  rosterMember("m15", "安田 和真", "", "", "", []),
  Object.assign(rosterMember("m16", "桜羽 李果", "株式会社LEFANA/女性向けSNSブランディング", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["web", "design", "video"]), {
    business: "女性向けに特化したデザイン会社。ブランディング、Web制作・運営・コンサルティング、グラフィックデザイン、SNS運用代行、インフルエンサー・モデルのキャスティング、写真・映像撮影、ビジネスマッチング。",
    customers: "女性向けの商材をお持ちの方、美容クリニック、お菓子・スイーツ業界、不動産",
    wants: "Webディレクター、Webデザイナー、SNS運用ディレクター、営業など(一緒に働く仲間)",
    triggers: ["女性向けの商品を売りたい", "ブランディング", "SNS運用を任せたい", "インフルエンサーを起用したい", "写真・動画の撮影", "Webデザイナーの仕事を探している"],
    targets: ["salon", "medical", "retail", "restaurant"],
    prospects: ["owner", "staff"],
  }),
  rosterMember("m17", "むらさき やえ", "波動を使った『あなた色ブランディング スタイリスト』", "", "美容・健康", []),
  rosterMember("m18", "髙橋 誠二", "スポーツ用品EC事業者/EC運営支援", "CANOW", "IT・Web・クリエイティブ", ["web"]),
  rosterMember("m19", "岡本 伸", "目標達成コーチング", "Team Bloom∞🌸", "人材・組織", ["org"]),
  Object.assign(rosterMember("m20", "柏木 本徳", "株式会社REVE 取締役/資金調達コンサル(融資・借換・金策)", "", "お金・保険", ["funding", "health"]), {
    business: "資金調達(個人融資・事業融資・借金の借り換え)。脱毛・眉毛・エステ(大阪・心斎橋の都度払いサロン)。",
    customers: "資金調達:毎月の支払いが大変な人、まとまったお金がすぐ欲しい人、事業などで資金が必要な人、どこも審査が通らない人/サロン:清潔感が欲しい人、髭剃りが面倒な人、モテたい人",
    wants: "資金調達を希望の方/ブローカー(紹介業)の方/高単価商材を扱っている方",
    triggers: ["資金繰りが苦しい", "融資を受けたい", "借金を借り換えたい", "審査が通らない", "紹介業をしている", "高単価商材", "脱毛・エステ"],
    targets: ["any"],
    prospects: ["owner", "individual"],
  }),
  rosterMember("m21", "中川 敏和", "", "", "", []),
  Object.assign(rosterMember("m22", "小林 末季こばねぇ", "preseia 代表/心を整えるマインドコーチ", "SunnyUp🌞", "人材・組織", ["org", "health", "insurance"]), {
    business: "個別コーチング、ビジネスコンサル、健康事業、共済保険。",
    customers: "新潟・長野の方/人生に迷いながらも進み出したい人/セミナーを作りたい方/コーチの方",
    wants: "新潟・長野の方/コーチングをグレードアップしたい方/健康事業に興味のある方/スピリチュアルに興味のある方",
    triggers: ["人生に迷っている", "セミナーを作りたい", "コーチング", "健康に興味がある", "スピリチュアル", "新潟・長野"],
    targets: ["any"],
    prospects: ["owner", "individual"],
  }),
  rosterMember("m23", "見上 恵", "AI絵本クリエイター、スクール講師、クリエイター募集", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["ai", "design"]),
  rosterMember("m24", "柳橋 雅也", "地方創生", "Team Bloom∞🌸", "暮らし・サービス", []),
  Object.assign(rosterMember("m25", "松田 依子", "株式会社Lift 代表取締役/ちきゅうあそびくらぶ", "Team Bloom∞🌸", "暮らし・サービス", ["ai", "video", "event", "web", "insurance", "health"]), {
    business: "AI絵本(自分史絵本・エンディング絵本・感謝の絵本・子育て・親子・技術をわかりやすく等)、司会・MC、コンサル・プロデュース、コミュニケーション・ボイトレ・朗読、芦屋スマートラジオの企画運営・番組、イベント・パーティー企画、コミュニケーション講座、AI講座・AI動画、潜在意識・波動アップ、詐欺に遭わないための金融アドバイザー(本物か見抜く・海外保険・海外銀行等・税金対策)、美容・健康(Life wave・コロイドヨード)。",
    customers: "会社や自身や商品をもっと世に広めたい人、次世代に残したい思いのある人、自分史を絵本にしたい人、販売促進・集客したい人、自分を変えたい人、AI絵本クリエイター資格を学びたい人、AIを学びたい人、健康に困っている人、人生を変えたい人、ちきゅうあそびくらぶの理念に賛同し世界に羽ばたく活動に興味を持ってくれる人",
    wants: "会社や自身や商品をもっと世に広めたい人/次世代に残したい技術・思いのある企業・社長等/終活ビジネス(エンディング絵本)/AI絵本クリエイター資格をとって一緒に活動してくれるクリエイターになりたい人/新しいビジネススキルが欲しい人/ラジオ番組を持ちたい人",
    triggers: ["商品を世に広めたい", "自分史を残したい", "終活", "絵本を作りたい", "ラジオ番組を持ちたい", "司会を頼みたい", "AIを学びたい"],
    targets: ["any"],
    prospects: ["owner", "individual"],
  }),
  rosterMember("m26", "坂上 智子", "地域密着型", "All Win🏆", "", []),
  rosterMember("m27", "一場 ゆな", "東京ケータリング", "", "食・地域産品", ["food", "event"]),
];

// 既存の名簿へ一度だけ反映する初期名簿の更新(古い順。反映済みの rev は名簿側に記録される)
const REF_SEED_REVISIONS = [
  { rev: "2026-10-profiles-1", ids: ["m02", "m03", "m04", "m05", "m08", "m09", "m16", "m20", "m22", "m25"] },
];

// プロフィールの記入状況(求める紹介・活動範囲が入っていれば「記入済み」)
function isProfileComplete(m) {
  return Boolean(m.wants) && (m.faceAreas.length > 0 || (m.online && m.online !== "unknown"));
}
