// ============================================
// ほかの BT-EX のユニットの方と、BT-EX5 のメンバーの相性(全体分析の「相性」)
// ほかのユニットの方は、お名前と仕事(BTEX_UNIT_PROFILES)しか分からないので、向きは1つだけ:
//   BT-EX5 のメンバーの「求める紹介」が、その方の仕事に当てはまる(言葉・扱う話題のどちらか)
// 同じ仕事をしている人(競合しやすい人)は出さない
// ============================================

const RefBxPartners = (function () {
  "use strict";

  // 仕事の文から、扱う話題(TOPICS の id)を読み取る
  function topicsOf(work) {
    const w = String(work || "");
    if (!w || typeof TOPIC_KEYWORDS === "undefined") return [];
    const found = Object.keys(TOPIC_KEYWORDS).filter((t) => TOPIC_KEYWORDS[t].some((k) => w.includes(k)));
    // 「AI実務者」「AIシステム開発」のように AI だけが書かれた仕事も、AI の話題として扱う
    if (/AI/.test(w) && !found.includes("ai")) found.push("ai");
    return found;
  }

  // ほかのユニットの方の一覧(仕事が分かる方だけ)
  function people() {
    if (typeof BTEX_UNIT_PROFILES === "undefined") return [];
    const list = [];
    Object.keys(BTEX_UNIT_PROFILES).forEach((unit) => {
      Object.entries(BTEX_UNIT_PROFILES[unit]).forEach(([name, v]) => {
        const work = String((v && v[1]) || "").trim();
        if (!work) return;
        list.push({ id: `bx:${unit}:${name}`, unit: Number(unit), name, kana: (v && v[0]) || "", work, topics: topicsOf(work) });
      });
    });
    return list;
  }

  const topicLabel = (id) => ((typeof TOPICS !== "undefined" && TOPICS.find((t) => t.id === id)) || {}).label || id;

  // a(BT-EX5 のメンバー)が x(ほかのユニットの方)を紹介してもらうと、うれしいか
  function score(a, x) {
    if (!a.wants) return null;
    // 同じ仕事(扱う話題が重なる)の人は、お客様の取り合いになりやすいので出さない
    if (x.topics.some((t) => (a.topics || []).includes(t))) return null;
    // 肩書き(会社・業種)の言葉が、その方の仕事と重なる人(例: AI の人どうし)も出さない
    const own = RefPartners.segmentsIn(`${a.company || ""} ${a.category || ""}`);
    if (RefPartners.segmentsIn(x.work).some((k) => own.includes(k))) return null;
    const segs = RefPartners.segmentsIn(a.wants).filter((k) => x.work.includes(k));
    if (segs.length) return { score: 1.5 * Math.min(2, segs.length) + 0.5, why: `「${segs.slice(0, 2).join("・")}」` };
    const w = String(a.wants);
    const ts = x.topics.filter((t) => (TOPIC_KEYWORDS[t] || []).some((k) => w.includes(k)));
    if (ts.length) return { score: 1.5, why: `「${topicLabel(ts[0])}」` };
    return null;
  }

  // 相性の高い組を、多くの人が見えるように(BT-EX5 の同じ人は2組まで、ほかのユニットの同じ方は1組まで)
  function pairs(members, limit) {
    const xs = people();
    const all = [];
    members.forEach((a) => {
      xs.forEach((x) => {
        const s = score(a, x);
        if (s) all.push({ a, x, score: s.score, reason: `${a.name}さんの求める紹介${s.why}に、${x.name}さん(${x.work})が当てはまる` });
      });
    });
    const usedA = {}, usedX = {};
    return all
      .sort((p, q) => q.score - p.score || p.x.unit - q.x.unit)
      .filter((p) => {
        if ((usedA[p.a.id] || 0) >= 2 || usedX[p.x.id]) return false;
        usedA[p.a.id] = (usedA[p.a.id] || 0) + 1;
        usedX[p.x.id] = 1;
        return true;
      })
      // 同じ点のなかでは、ユニットが偏らないように順番に並べる(BT-EX1 → 3 → 4 → 10 → 11 → BT-EX1 …)
      .map((p, i, arr) => Object.assign(p, { turn: arr.filter((q, j) => j < i && q.score === p.score && q.x.unit === p.x.unit).length }))
      .sort((p, q) => q.score - p.score || p.turn - q.turn || p.x.unit - q.x.unit)
      .slice(0, limit || 10);
  }

  return { pairs, people, topicsOf };
})();
