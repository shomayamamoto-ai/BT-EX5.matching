// ============================================
// 相談アシスタント - 文章(音声入力も可)で入れた相談を読み取り、紹介先の候補を出す
// 外部の AI は使わず、ジャンルの言いかえ(TOPIC_KEYWORDS)と困りごとの言い方(CONSULT_PHRASES)で読み取る。
// 画面に依存しない(referral/data.js と scoring.js を使う)
// ============================================

const RefConsult = (function () {
  "use strict";

  const norm = (s) => String(s || "").toLowerCase();
  const hits = (text, words) => (words || []).filter((w) => text.includes(norm(w)));
  const firstMatch = (text, table) => {
    let best = null;
    Object.entries(table).forEach(([id, words]) => {
      const n = hits(text, words).length;
      if (n && (!best || n > best.n)) best = { id, n };
    });
    return best ? best.id : null;
  };

  // 相談の文章 → 読み取った内容
  // groups: 解決したいこと(それぞれ、どれか1つのジャンルができればよい)。重い順
  function analyze(raw) {
    const text = norm(raw);
    const groups = [];
    const words = new Set();
    const add = (g) => {
      const key = g.topics.slice().sort().join(",");
      const same = groups.find((x) => x.topics.slice().sort().join(",") === key);
      if (same) { same.weight += g.weight; g.words.forEach((w) => same.words.push(w)); return; }
      groups.push(g);
    };
    // 相手の業種を表す言葉(「美容室のオーナー」の美容室など)。この言葉の一部だけで当たったジャンルは外す
    const industryHits = hits(text, Object.values(CONSULT_INDUSTRY_WORDS).flat()).map(norm);
    const onlyIndustry = (ws) => ws.every((w) => industryHits.some((iw) => iw.includes(norm(w))));
    const rest = text;
    // 1) 困りごとの言い方(集客・採用・開業 など)。読み取った言葉は、次のジャンルの読み取りから外す
    CONSULT_PHRASES.forEach((p) => {
      const w = hits(rest, p.words);
      if (w.length) { add({ label: p.label, topics: p.topics.slice(), weight: 2 + w.length, words: w }); w.forEach((x) => words.add(x)); }
    });
    let rest2 = rest;
    words.forEach((w) => { rest2 = rest2.split(norm(w)).join(" "); });
    // 2) ジャンルそのものの言葉(ホームページ・SEO・税理士 など)
    TOPICS.forEach((t) => {
      const parts = [t.tag, ...t.label.split(/[・()()、]/)].filter((x) => x && x.length >= 2);
      const w = [...new Set([...hits(rest2, TOPIC_KEYWORDS[t.id]), ...hits(rest2, parts)])];
      if (!w.length || onlyIndustry(w)) return;
      // 困りごとの組にすでに入っているジャンルは、その組を重くする
      const inGroup = groups.find((g) => g.topics.length > 1 && g.topics.includes(t.id));
      if (inGroup) { inGroup.weight += w.length; inGroup.topics = [t.id, ...inGroup.topics.filter((x) => x !== t.id)]; }
      else add({ label: t.tag || t.label, topics: [t.id], weight: 1 + w.length, words: w });
      w.forEach((x) => words.add(x));
    });
    groups.sort((a, b) => b.weight - a.weight);
    const top = groups.slice(0, 5);
    return {
      groups: top,
      industry: firstMatch(text, CONSULT_INDUSTRY_WORDS),
      who: firstMatch(text, CONSULT_PROSPECT_WORDS),
      area: firstMatch(text, CONSULT_AREA_WORDS),
      meeting: firstMatch(text, CONSULT_MEETING_WORDS),
      words: [...words],
    };
  }

  // 読み取った内容 → 紹介診断と同じ形の回答
  function toAnswers(a) {
    const topics = new Set(a.groups.flatMap((g) => g.topics));
    return {
      need: null,
      methods: new Set(),
      // 解決したいことが2つ以上なら、どれかに対応できれば高い点(多く対応できるほど上)
      anyTopic: a.groups.length >= 2,
      topicGroups: a.groups.map((g) => g.topics),
      topics,
      keyword: a.words.join(" "),
      who: a.who || "unknown",
      industry: a.industry || "unknown",
      area: a.area || "any",
      meeting: a.meeting || (a.area ? "either" : "any"),
    };
  }

  // その困りごとへの合い方: 困りごとの中心のジャンル(先に並ぶもの)を、本業として(先に登録して)いるほど高い
  function fit(m, g) {
    let best = 0;
    g.topics.forEach((t, gi) => {
      const mi = m.topics.indexOf(t);
      if (mi < 0) return;
      best = Math.max(best, (1 - Math.min(gi, 3) * 0.22) * (1 - Math.min(mi, 6) * 0.08));
    });
    return best;
  }

  // 解決したいことごとに、いちばん合う人を1人ずつ。できるだけ別の人にし、ほかにいなければ同じ人が兼ねる
  function team(members, a, answers) {
    if (a.groups.length < 2) return [];
    const scored = members.map((m) => ({ m, sc: RefScoring.scoreMember(m, answers) }));
    const used = new Set();
    return a.groups.map((g) => {
      const rank = (list) => list
        .map((x) => ({ ...x, f: fit(x.m, g) }))
        .filter((x) => x.f > 0)
        .sort((x, y) => y.f - x.f || y.sc.raw - x.sc.raw)[0];
      const cand = rank(scored.filter((x) => !used.has(x.m.id))) || rank(scored);
      if (!cand) return null;
      used.add(cand.m.id);
      return { group: g, m: cand.m, sc: cand.sc };
    }).filter(Boolean)
      // 同じ人が2つ以上を受け持つときは1行にまとめる
      .reduce((list, x) => {
        const same = list.find((y) => y.m.id === x.m.id);
        if (same) {
          same.group = { ...same.group, label: `${same.group.label}、${x.group.label}`, topics: [...same.group.topics, ...x.group.topics] };
          same.multi = true;
        } else list.push({ ...x });
        return list;
      }, []);
  }

  return { analyze, toAnswers, team };
})();
