// ============================================
// 紹介診断 - 一致度の計算(画面に依存しない)
// referral/data.js の定義(TOPICS など)を使う
// ============================================

const RefScoring = (function () {
  "use strict";

  const labelOf = (list, id) => (list.find((x) => x.id === id) || {}).label || "";

  // ---------- 一致度の計算 ----------
  // 配点: 話題50 + 業種15 + 相手のタイプ10 + 会い方・エリア25 = 100
  //   話題50 = 選んだ話題をどれだけ扱えるか42 + その話題がその人の本業に近いか8
  //   (扱う話題が少ない専門の人ほど高い。何でも扱う人ばかりが上に来ないようにする)
  // キーワード一致で+15(上限100。入力した言葉が本人の説明に含まれるのは最も具体的な一致なので、
  // 活動範囲の入力の有無より重くする。話題の言いかえでの一致は+8)。話題もキーワードも一致しない人は30%で頭打ち。
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

    const topicHits = [...a.topics].filter((t) => m.topics.includes(t));
    if (a.topics.size && topicHits.length) {
      s += (42 * topicHits.length) / a.topics.size;
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
    if (areaUnknown) {
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

    return { score: Math.round(Math.min(100, s)), raw: s, reasons, topicHits, keywordHits };
  }

  // 診断結果の順位。同点のときは、選んだ話題に絞った専門の人(扱う話題が少ない人)、
  // キーワードが多く一致した人の順。名簿の並び順では決めない
  function rankMembers(members, a, opts) {
    const o = Object.assign({ min: 40, limit: 5 }, opts);
    return members
      .map((m) => ({ m, sc: scoreMember(m, a) }))
      .filter((x) => x.sc.score >= o.min)
      .sort((x, y) =>
        y.sc.raw - x.sc.raw ||
        y.sc.keywordHits.length - x.sc.keywordHits.length ||
        x.m.topics.length - y.m.topics.length
      )
      .slice(0, o.limit);
  }

  return { keywordTokens, haystack, scoreMember, rankMembers };
})();
