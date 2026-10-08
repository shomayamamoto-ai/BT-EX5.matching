// ============================================
// 紹介し合える相手(パワーパートナー)の候補
// 同じお客様を持ち、別のサービスを出せる人どうしは、お互いにお客様を紹介し合える。
//   ・Aさんの「求める紹介」の言葉が、Bさんの事業・お客様にも出てくる(逆向きも)
//   ・Aさんの「求める紹介」に、Bさんの扱う話題の言葉が出てくる(「保険業」→保険の人 など)
//   ・2人の「主なお客様」に同じ言葉がある/紹介してほしい業種が同じで、扱う話題は違う
//   ・扱う話題がほとんど同じ人(競合しやすい人)は下げる
// 画面に依存しないので、名簿全体での出方を確かめられる
// ============================================

const RefPartners = (function () {
  "use strict";

  function segmentsIn(text) {
    const t = String(text || "");
    // 長い言葉を先に見て、短い言葉の重複(「美容」と「美容室」など)を避ける
    const found = [];
    SEGMENT_KEYWORDS.slice().sort((a, b) => b.length - a.length).forEach((k) => {
      if (t.includes(k) && !found.some((f) => f.includes(k))) found.push(k);
    });
    return found;
  }

  function profileText(m) {
    return [m.company, m.business, m.customers || "", m.category].join(" ");
  }

  function overlap(a, b) {
    return a.filter((x) => b.includes(x));
  }

  const topicLabel = (id) => ((typeof TOPICS !== "undefined" && TOPICS.find((t) => t.id === id)) || {}).label || id;
  const industryLabel = (id) => ((typeof INDUSTRIES !== "undefined" && INDUSTRIES.find((t) => t.id === id)) || {}).label || id;

  // wants の文に、その人の話題の言いかえが出てくる話題
  function topicsWanted(wants, topics) {
    const w = String(wants || "");
    if (!w || typeof TOPIC_KEYWORDS === "undefined") return [];
    return topics.filter((t) => (TOPIC_KEYWORDS[t] || []).some((k) => w.includes(k)));
  }

  // A と B の相性(数値と理由)
  // get: a が b から紹介してもらえそうなもの / give: a から b へ紹介できそうなもの / shared: 共通のお客様
  function pairScore(a, b) {
    let score = 0;
    const reasons = [];
    const get = [];
    const give = [];
    const aWants = segmentsIn(a.wants);
    const bWants = segmentsIn(b.wants);
    const aProfile = segmentsIn(profileText(a));
    const bProfile = segmentsIn(profileText(b));

    const aToB = overlap(aWants, bProfile);
    if (aToB.length) {
      score += Math.min(3, 1.5 * aToB.length);
      reasons.push(`${a.name}さんが求める紹介と、${b.name}さんの事業・お客様が「${aToB.slice(0, 2).join("・")}」で重なる`);
      get.push(...aToB);
    }
    const bToA = overlap(bWants, aProfile);
    if (bToA.length) {
      score += Math.min(3, 1.5 * bToA.length);
      reasons.push(`${b.name}さんが求める紹介と、${a.name}さんの事業・お客様が「${bToA.slice(0, 2).join("・")}」で重なる`);
      give.push(...bToA);
    }
    if (!aToB.length) {
      const ts = topicsWanted(a.wants, b.topics);
      if (ts.length) {
        score += Math.min(3, 1.5 * ts.length);
        reasons.push(`${a.name}さんが求める紹介に、${b.name}さんの「${topicLabel(ts[0])}」が当てはまる`);
        get.push(topicLabel(ts[0]));
      }
    }
    if (!bToA.length) {
      const ts = topicsWanted(b.wants, a.topics);
      if (ts.length) {
        score += Math.min(3, 1.5 * ts.length);
        reasons.push(`${b.name}さんが求める紹介に、${a.name}さんの「${topicLabel(ts[0])}」が当てはまる`);
        give.push(topicLabel(ts[0]));
      }
    }
    const sameTargets = overlap(a.targets.filter((t) => t !== "any"), b.targets.filter((t) => t !== "any"));
    if (sameTargets.length && overlap(a.topics, b.topics).length === 0) {
      score += 1;
      reasons.push(`紹介してほしい業種(${sameTargets.slice(0, 2).map(industryLabel).join("・")})が同じで、扱う分野は違う`);
    }
    const shared = overlap(segmentsIn(a.customers), segmentsIn(b.customers)).filter((k) => !aToB.includes(k) && !bToA.includes(k));
    if (shared.length) {
      score += Math.min(2, shared.length);
      reasons.push(`同じお客様(${shared.slice(0, 3).join("・")})を持っている`);
    }

    // 扱う話題がほとんど同じなら競合しやすいので下げる
    const common = overlap(a.topics, b.topics).length;
    const minTopics = Math.min(a.topics.length, b.topics.length);
    // (どちらかの「求める紹介」が相手の事業を名指ししているときは、競合ではなくお客様・仲間なので下げない)
    if (minTopics && common / minTopics >= 0.6 && a.category === b.category && !aToB.length && !bToA.length) score *= 0.4;

    return { score, reasons, get, give, shared: shared.slice(0, 3) };
  }

  // me と紹介し合えそうな人を、相性の高い順に返す
  function findPartners(members, me, limit) {
    if (!me) return [];
    return members
      .filter((m) => m.id !== me.id)
      .map((m) => Object.assign({ m }, pairScore(me, m)))
      .filter((x) => x.score >= 2)
      .sort((x, y) => y.score - x.score)
      .slice(0, limit || 3);
  }

  return { findPartners, pairScore, segmentsIn };
})();
