// ============================================
// 紹介先早見表 - データ
// REF_SEED_MEMBERS は名簿が未作成のときに一度だけサーバー層(auth/mock-server.js)へ
// 投入される初期名簿。投入後の追加・編集・削除は管理者ページ(/admin/)から行い、
// ここを書き換えても既存の名簿には反映されない。
// 山本 捷真以外の詳細(求める紹介・活動範囲など)は未入力で、
// 肩書きと所属チームは会員名簿の表示内容のみを反映している。
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
  rosterMember("m02", "あまみや 七音", "声優ボイス・ドクター", "Over", "美容・健康", ["health"]),
  rosterMember("m03", "佐藤 志織", "Canva・AI講師/LP・サイト制作", "All Win🏆", "IT・Web・クリエイティブ", ["ai", "web", "design"]),
  rosterMember("m04", "吉澤 美和子", "新潟県/ハンドメイド", "SunnyUp🌞", "暮らし・サービス", [], "新潟"),
  rosterMember("m05", "大藤 誠", "世界初・ハラール認証フェイスマスク", "CANOW", "美容・健康", ["health"]),
  rosterMember("m06", "吉原 優", "", "", "", []),
  rosterMember("m07", "樺澤 一郎", "", "", "", []),
  rosterMember("m08", "床島 良夫", "月面タイムカプセルとパーソナルインバウンドツアーで外貨を稼ごう!", "SunnyUp🌞", "暮らし・サービス", ["event"]),
  rosterMember("m09", "大場 雅俊", "金融業界に特化したビジネスコンサルティング", "Over", "お金・保険", []),
  rosterMember("m10", "大枝 篤志", "売上動線も作れる公式LINE専門家", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["web"]),
  rosterMember("m11", "品川 瑞樹", "", "", "", []),
  rosterMember("m12", "菅野 節子", "誰でも健康アドバイザー", "Team Bloom∞🌸", "美容・健康", ["health"]),
  rosterMember("m13", "佐藤 慎哉", "", "", "", []),
  rosterMember("m14", "三村 隆", "美容、建設、飲食、プラットフォーム", "Team Bloom∞🌸", "", []),
  rosterMember("m15", "安田 和真", "", "", "", []),
  rosterMember("m16", "桜羽 李果", "女性向けSNSブランディング", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["web"]),
  rosterMember("m17", "むらさき やえ", "波動を使った『あなた色ブランディング スタイリスト』", "", "美容・健康", []),
  rosterMember("m18", "髙橋 誠二", "スポーツ用品EC事業者/EC運営支援", "CANOW", "IT・Web・クリエイティブ", ["web"]),
  rosterMember("m19", "岡本 伸", "目標達成コーチング", "Team Bloom∞🌸", "人材・組織", ["org"]),
  rosterMember("m20", "柏木 本徳", "資金調達コンサル(融資・借換・金融)", "", "お金・保険", ["funding"]),
  rosterMember("m21", "中川 敏和", "", "", "", []),
  rosterMember("m22", "小林 末季こばねぇ", "心を整えるマインドコーチ", "SunnyUp🌞", "美容・健康", ["health"]),
  rosterMember("m23", "見上 恵", "AI絵本クリエイター、スクール講師、クリエイター募集", "Team Bloom∞🌸", "IT・Web・クリエイティブ", ["ai", "design"]),
  rosterMember("m24", "柳橋 雅也", "地方創生", "Team Bloom∞🌸", "暮らし・サービス", []),
  rosterMember("m25", "松田 依子", "ちきゅうあそびくらぶ", "Team Bloom∞🌸", "暮らし・サービス", []),
  rosterMember("m26", "坂上 智子", "地域密着型", "All Win🏆", "", []),
  rosterMember("m27", "一場 ゆな", "東京ケータリング", "", "食・地域産品", ["food", "event"]),
];

// プロフィールの記入状況(求める紹介・活動範囲が入っていれば「記入済み」)
function isProfileComplete(m) {
  return Boolean(m.wants) && (m.faceAreas.length > 0 || (m.online && m.online !== "unknown"));
}
