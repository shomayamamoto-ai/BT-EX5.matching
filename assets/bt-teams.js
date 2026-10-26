// ============================================
// assets/bt-teams.js — B.T. のチームと直上の方の一覧と、押して選ぶ入力(トグル)
// アンケートの「B.T.内系列名」、ビジター申し込みの「所属チーム」で使う。
// すべての系列のチームを系列ごとに並べて出し、1つ押して選ぶ。結果は隠し入力(input)に
// 「系列 / チーム / 直上の方」の文字で入る。一覧にないときは「一覧にない」から文字で入れる。
// ============================================
const BtTeams = (function () {
  "use strict";

  // [系列の代表, 系列名, [[チーム, 直上の方], ...]]
  const GROUPS = [
    ["村田大樹", "フェイムパソ系列", [["チーム無限", "村田大樹"]]],
    ["桜羽李果", "プライムパソ系列", [["Team Bloom∞🌸", "桜羽李果"], ["Onephoria🐼", "みやちゃん"], ["CANOW", "坂本和保"]]],
    ["大場さん", "パソ系列", [["Over", "大場雅俊"]]],
    ["関口ありさ", "プライムパソ/篠原フェイム系列", [["Rankers🏆", "関口ありさ"], ["Next Rise", "畑竜介"], ["GLANZ", "飯田崇秀"], ["Smile😊", "関隆行"], ["結宙", "能瀬千恵"], ["掌 -TANAGOKORO-", "河西慧"], ["Crew Plus", "佐野宗吾朗"], ["綺絆", "坂本明綺子"], ["ミライア", "吉武知家良"], ["Playground", "小川真由美（まゆげ⤴️⤴️ちゃん）"], ["J", "砂田ママ"]]],
    ["さとうひろこ", "フェイム系列", [["V-Blaze❤️‍🔥", "さとうひろこ"], ["Symargy", "川村英紀"]]],
    ["和田真希", "フェイム系列", [["SunnyUp☀️", "やまさきみき"], ["Challengers", "Momoko"], ["フェリシア", "シャイア"], ["アバンダンティア", "手塚勇輔"], ["Orion", "KAYOKO"], ["グランディア", "はやしえいこ"], ["Legends🦁", "Hideka"]]],
    ["pikaru", "フェイムパソ系列", [["High Speed🚀", "上村洋平"], ["All Win🏆", "アモーレ石上"], ["WILDSPEED🃏", "こやありさ"], ["Paradise Junction", "もずく"]]],
    ["佐々木真美", "プライムパソ系列", [["🍀ティーエフレールー", "佐々木真美"], ["♡STARS", "ゆかりん"], ["AND-X", "堺典子"], ["翔", "たかすぎかずみ"], ["M-CARAT", "堀内千尋"], ["One World🌏", "谷口直美"]]],
    ["辰巳眞玄", "フェイム系列", [["FirstPlace", "酒井寛至"], ["Realize Dreams", "横辻悠太"], ["環", "山本理恵"], ["センターラブ", "田中みっち"], ["陽凪-ひなぎ-", "前田祐里"]]],
  ];
  const groupLabel = (g) => `${g[0]}(${g[1]})`;
  const OTHER = "一覧にない";

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); });
    kids.flat().forEach((k) => k != null && e.append(k));
    return e;
  }

  // input: 結果を入れる input(type=hidden にする)。すべての系列のチームを一度に出し、1つ押して選ぶ
  function mount(input) {
    input.type = "hidden";
    let pick = null, other = false; // pick: [系列, チーム]
    const otherInput = el("input", { type: "text", class: "bt-other", maxlength: "60", placeholder: "系列・チーム名・直上の方のお名前" });
    const root = el("div", { class: "bt-pick" });
    input.after(root);

    const chip = (label, sub, on, onclick) => el("button", { type: "button", class: "bt-chip" + (on ? " is-on" : ""), "aria-pressed": on ? "true" : "false", onclick },
      el("span", { class: "bt-chip-main" }, label), sub ? el("span", { class: "bt-chip-sub" }, sub) : null);

    function write() {
      input.value = other ? otherInput.value.trim() : pick ? [groupLabel(pick[0]), pick[1][0], pick[1][1]].join(" / ") : "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function draw() {
      root.replaceChildren(...[
        ...GROUPS.map((g) => el("div", { class: "bt-group", role: "group", "aria-label": groupLabel(g) },
          el("p", { class: "bt-group-head" }, el("b", null, g[0]), el("span", null, g[1])),
          el("div", { class: "bt-chips is-teams" },
            ...g[2].map((t) => chip(t[0], t[1], !!pick && pick[1] === t, () => { other = false; pick = pick && pick[1] === t ? null : [g, t]; draw(); }))))),
        el("div", { class: "bt-chips" }, chip(OTHER, null, other, () => { pick = null; other = !other; draw(); if (other) otherInput.focus(); })),
        other ? otherInput : null].filter(Boolean));
      write();
    }
    otherInput.addEventListener("input", write);
    draw();
    return {
      root,
      // 入力の確認: 足りなければ文言を返す
      problem(required) {
        if (other) return otherInput.value.trim() ? "" : "系列・チーム名・直上の方のお名前を入れてください。";
        return !pick && required ? "チームを選んでください。" : "";
      },
      reset() { pick = null; other = false; otherInput.value = ""; draw(); },
    };
  }

  return { GROUPS, mount };
})();
