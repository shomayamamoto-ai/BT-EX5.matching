// ============================================
// 紹介診断 - 一致度の計算(画面に依存しない)
// referral/data.js の定義(TOPICS など)を使う
// ============================================

const RefScoring = (function () {
  "use strict";

  const labelOf = (list, id) => (list.find((x) => x.id === id) || {}).label || "";

  // ---------- 一致度の計算 ----------
  // 配点: 話題50 + 業種15 + 相手のタイプ10 + 会い方・エリア25 = 100
  //   話題50 = 選んだ方法(ジャンル)をどれだけ扱えるか42 + そのジャンルがその人の本業に近いか8
  //   (扱う話題が少ない専門の人ほど高い。何でも扱う人ばかりが上に来ないようにする)
  // キーワード一致で+15(上限100。入力した言葉が本人の説明に含まれるのは最も具体的な一致なので、
  // 活動範囲の入力の有無より重くする。話題の言いかえでの一致は+8)。話題もキーワードも一致しない人は30%で頭打ち。
  // 話題かキーワードが合った人には、役職・役割の基礎ポイント(REF_BASE_POINTS、+5〜+10)を足す。
  // 未入力の項目は中立の点数(活動範囲は25点中15点)にして、入力済みの人だけが
  // 大きく有利にならないようにする
  function keywordTokens(text) {
    return String(text || "")
      .split(/[\s、,,・/]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
  }

  function haystack(m) {
    return [m.name, m.company, m.category, m.business, m.customers || "", m.selfIntro || "", m.note, m.wants, ...m.triggers].join(" ");
  }

  function scoreMember(m, a) {
    const reasons = [];
    let s = 0;

    // 選んだ方法(topicGroups: 方法ごとのジャンルの組)のうち、いくつに対応できるか。
    // 1つの方法が複数のジャンルにまたがるときは、どれか1つに対応していれば対応とみなす。
    // anyTopic(「まだ分からない」)のときは、どれか1つに対応していれば高い点、多いほど少し上がる
    const topicHits = [...a.topics].filter((t) => m.topics.includes(t));
    const groups = a.topicGroups && a.topicGroups.length ? a.topicGroups : [...a.topics].map((t) => [t]);
    const covered = groups.filter((g) => g.some((t) => m.topics.includes(t))).length;
    if (groups.length && covered) {
      const coverage = a.anyTopic ? Math.min(1, 0.85 + 0.075 * (covered - 1)) : covered / groups.length;
      s += 42 * coverage;
      s += (8 * topicHits.length) / Math.max(m.topics.length, topicHits.length);
    }
    topicHits.forEach((t) => reasons.push(`「${labelOf(TOPICS, t)}」に対応`));

    if (a.industry === "unknown" || !m.targets.length) {
      s += 9;
    } else if (m.targets.includes(a.industry)) {
      s += 15;
      reasons.push(`${labelOf(INDUSTRIES, a.industry)}の紹介を求めている`);
    } else if (m.targets.includes("any")) {
      s += 11;
    }

    if (a.who === "unknown" || !m.prospects.length) {
      s += 6;
    } else if (m.prospects.includes(a.who)) {
      s += 10;
    }

    const faceOK = a.area !== "other" && m.faceAreas.includes(a.area);
    const onlineAll = m.online === "all";
    const onlinePartial = m.online === "partial";
    const areaUnknown = !m.faceAreas.length && m.online === "unknown";
    let areaScore = 0;
    if (areaUnknown || a.area === "any") {
      // 活動範囲が未入力の人、またはエリアを問わないとき(話題で探す)は中立の点数
      areaScore = 15;
    } else if (a.meeting === "face") {
      areaScore = faceOK ? 25 : onlineAll ? 8 : onlinePartial ? 5 : 0;
    } else if (a.meeting === "online") {
      areaScore = onlineAll ? 25 : onlinePartial ? 14 : faceOK ? 8 : 0;
    } else {
      areaScore = faceOK || onlineAll ? 25 : onlinePartial ? 14 : 0;
    }
    s += areaScore;
    if (faceOK && a.meeting !== "online") reasons.push(`${labelOf(AREAS, a.area)}で対面可`);
    if (onlineAll && (a.meeting !== "face" || !faceOK)) reasons.push("オンライン全国対応");

    // キーワード: 本人の説明文にその言葉がある(+15)か、その人の話題の言いかえ(TOPIC_KEYWORDS)を
    // 含む(+8)。本人の言葉そのものの一致を、言いかえでの一致より重くする
    const hay = haystack(m);
    const tokens = keywordTokens(a.keyword);
    const textHits = tokens.filter((t) => hay.includes(t));
    const synonymHits = typeof TOPIC_KEYWORDS === "undefined" ? [] : tokens
      .filter((t) => !textHits.includes(t))
      // 選んだ話題の言いかえは、話題の点ですでに数えているので二重に数えない
      .map((t) => ({ t, topic: m.topics.find((id) => !a.topics.has(id) && (TOPIC_KEYWORDS[id] || []).some((k) => t.includes(k))) }))
      .filter((x) => x.topic);
    const keywordHits = [...textHits, ...synonymHits.map((x) => x.t)];
    if (textHits.length) {
      s += 15;
      textHits.forEach((t) => reasons.push(`「${t}」がキーワードに一致`));
    } else if (synonymHits.length) {
      s += 8;
      synonymHits.forEach((x) => reasons.push(`「${x.t}」は「${labelOf(TOPICS, x.topic)}」の話`));
    }

    if (!topicHits.length && !keywordHits.length) s = Math.min(s, 30);
    // 役職・役割の基礎ポイント(data.js の REF_BASE_POINTS)。話題かキーワードが合った人だけに足す
    else if (typeof refBasePoints === "function" && refBasePoints(m.id)) s += refBasePoints(m.id);

    return { score: Math.round(Math.min(100, s)), raw: s, reasons, topicHits, keywordHits };
  }

  // 日替わりの並び用(同じ日・同じ人は同じ値)
  function dayHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  // 診断結果の順位。同点のときは、選んだ話題に絞った専門の人(扱う話題が少ない人)、
  // キーワードが多く一致した人の順。名簿の並び順では決めない。
  // 公平に出るように: 上位2名は一致度の順のまま、3位から下の枠は「3位との差が5点以内の人」から
  // 日替わりで選ぶ(合う人が多いときに、毎回同じ人ばかりが出ないようにする。選んだ人は一致度の順に並べる)
  const FAIR_KEEP = 2;
  const FAIR_MARGIN = 5;
  function rankMembers(members, a, opts) {
    const o = Object.assign({ min: 40, limit: 5, fair: true, day: todayKey() }, opts);
    const byScore = (x, y) =>
      y.sc.raw - x.sc.raw ||
      y.sc.keywordHits.length - x.sc.keywordHits.length ||
      x.m.topics.length - y.m.topics.length;
    const all = members
      .map((m) => ({ m, sc: scoreMember(m, a) }))
      .filter((x) => x.sc.score >= o.min)
      .sort(byScore);
    if (!o.fair || all.length <= o.limit || o.limit <= FAIR_KEEP) return all.slice(0, o.limit);
    const head = all.slice(0, FAIR_KEEP);
    const cut = all[FAIR_KEEP].sc.score - FAIR_MARGIN;
    const pool = all.slice(FAIR_KEEP).filter((x) => x.sc.score >= cut)
      .sort((x, y) => dayHash(x.m.id + o.day) - dayHash(y.m.id + o.day));
    const rest = all.slice(FAIR_KEEP).filter((x) => x.sc.score < cut);
    const tail = [...pool, ...rest].slice(0, o.limit - FAIR_KEEP).sort(byScore);
    return [...head, ...tail];
  }

  // 話題で探すときの一致度。その話題だけを選んだ診断と同じ計算(相手のタイプ・業種・エリアは
  // 問わない=中立の点数)なので、専門の人(扱う話題が少ない人)と役職・役割の基礎ポイントが順番に入る
  function topicAnswers(topicId, keyword) {
    return { topics: new Set([topicId]), industry: "unknown", who: "unknown", area: "any", meeting: "any", keyword: keyword || "" };
  }

  return { keywordTokens, haystack, scoreMember, rankMembers, topicAnswers, dayHash, todayKey };
})();
