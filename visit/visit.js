// ============================================
// visit/visit.js — ビジター(ゲスト)向けの定例会案内と申し込み
// メンバーが作った招待URL(?t=トークン)で開く。ログインは不要。
// ============================================
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const token = new URLSearchParams(location.search).get("t") || "";
  let isLink = false;
  const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  const AREA = { niigata: "新潟", tokyo: "東京", online: "オンライン", other: "" };

  function when(e) {
    const [y, m, d] = e.date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return `${y}年${m}月${d}日(${WEEK[dt.getDay()]}) ${e.start || ""}${e.end ? `〜${e.end}` : ""}`;
  }

  async function post(action, payload) {
    return AuthApi.call(action, Object.assign({ token }, payload || {}));
  }

  (async function init() {
    const res = await post("visitorInfo");
    if (!res.success) {
      $("visit-status").textContent = res.error.userMessage;
      return;
    }
    const d = res.data;
    const e = d.event;
    $("visit-inviter").textContent = d.inviter;
    $("visit-title").textContent = e.title;
    $("visit-when").textContent = when(e);
    $("visit-place").textContent = [AREA[e.area], e.place].filter(Boolean).join(" ") || "追ってご案内します";
    $("visit-fee").textContent = e.fee || "";
    $("visit-fee").hidden = $("visit-fee-label").hidden = !e.fee;
    $("visit-body").textContent = e.body || "";
    if (e.url) { $("visit-url").href = e.url; $("visit-url").hidden = false; }
    if (d.name) $("v-name").value = d.name;
    if (d.company) $("v-company").value = d.company;
    if (d.inviteMessage) { $("visit-msg").textContent = d.inviteMessage; $("visit-msg").hidden = false; }
    isLink = d.kind === "link";
    $("v-link").hidden = !isLink;
    $("visit-status").hidden = true;
    $("visit-content").hidden = false;
    if (d.past) {
      $("visit-form").hidden = true;
      $("visit-message").textContent = "この定例会は終了しました。次回のご案内は、招待したメンバーにお問い合わせください。";
    } else if (d.status !== "invited") {
      showDone();
    }
  })();

  function showDone() {
    $("visit-form").hidden = true;
    $("visit-done").hidden = false;
  }
  $("visit-edit").addEventListener("click", () => {
    $("visit-done").hidden = true;
    $("visit-form").hidden = false;
    $("v-name").focus();
  });

  $("visit-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = $("v-name").value.trim();
    if (!name) { $("visit-message").textContent = "お名前を入力してください。"; $("v-name").focus(); return; }
    $("visit-submit").disabled = true;
    const res = await post("visitorApply", {
      name, company: $("v-company").value.trim(), business: $("v-business").value.trim(),
      contact: $("v-contact").value.trim(), message: $("v-message").value.trim(),
      linkTeam: isLink ? $("v-team").value.trim() : "", linkUp: isLink ? $("v-up").value.trim() : "", linkAdvance: isLink ? $("v-advance").value.trim() : "",
    });
    $("visit-submit").disabled = false;
    if (!res.success) { $("visit-message").textContent = res.error.userMessage; return; }
    $("visit-message").textContent = "";
    showDone();
  });
})();
