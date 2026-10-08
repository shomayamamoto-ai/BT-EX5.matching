// ============================================
// 名簿の管理(管理者ページ)
// 追加・編集・削除はサーバー層で管理者権限を確認する(画面側の判定は表示用のみ)
// ============================================

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const form = $("#editorForm");

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  let members = [];
  let search = "";
  let status = "all"; // all / pending / done

  let toastTimer = null;
  function toast(msg) {
    const el = $("#refToast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  async function load() {
    const res = await AuthApi.listReferralMembers(AuthSession.getToken());
    members = res.success ? res.data.members : [];
    render();
  }

  // ---------- 一覧 ----------
  function render() {
    const done = members.filter(isProfileComplete).length;
    $("#stats").innerHTML =
      `<span><strong>${members.length}</strong>名</span>` +
      `<span>記入済み <strong>${done}</strong>名</span>` +
      `<span>準備中 <strong>${members.length - done}</strong>名</span>`;

    $("#statusChips").innerHTML = [
      ["all", "すべて"], ["pending", "準備中"], ["done", "記入済み"],
    ].map(([v, l]) => `<button type="button" class="ref-chip" data-status="${v}" aria-pressed="${status === v}">${l}</button>`).join("");

    const q = search.trim().toLowerCase();
    const list = members.filter((m) => {
      if (status === "pending" && isProfileComplete(m)) return false;
      if (status === "done" && !isProfileComplete(m)) return false;
      if (!q) return true;
      return [m.name, m.company, m.team, m.category].join(" ").toLowerCase().includes(q);
    });

    $("#memberList").innerHTML = list.length
      ? list.map((m) => `
        <div class="adm-row">
          <div class="adm-row-main">
            <div class="adm-row-name">${escapeHtml(m.name)}</div>
            <div class="adm-row-sub">${escapeHtml(m.company || "(肩書き未入力)")}</div>
            <div class="adm-row-tags">
              <span class="ref-tag">${escapeHtml(m.category)}</span>
              ${m.team ? `<span class="ref-tag team">${escapeHtml(m.team)}</span>` : ""}
              ${isProfileComplete(m) ? '<span class="ref-tag done">記入済み</span>' : '<span class="ref-tag pending">準備中</span>'}
            </div>
            ${missingProfileItems(m).length ? `<div class="adm-row-missing">足りない情報:${missingProfileItems(m).map((it) => escapeHtml(it.label)).join("・")}</div>` : ""}
          </div>
          <div class="adm-row-actions">
            ${missingProfileItems(m).length ? `<button type="button" class="ref-btn line" data-ask="${escapeHtml(m.id)}">お願い文をコピー</button>` : ""}
            <button type="button" class="ref-btn" data-edit="${escapeHtml(m.id)}">編集</button>
            <button type="button" class="ref-btn ghost danger" data-delete="${escapeHtml(m.id)}">削除</button>
          </div>
        </div>`).join("")
      : '<p class="ref-empty">該当するメンバーがいません。</p>';
  }

  // ---------- 足りない情報のお願い文 ----------
  function askText(m) {
    const items = missingProfileItems(m);
    return [
      `${m.name}さん`,
      "BT-EX5の紹介先早見表に載せる情報について、次の項目を教えていただけますか?紹介するときの参考にさせていただきます。",
      "",
      ...items.map((it) => `・${it.ask}`),
      "",
      "ご自身で入力することもできます(ログイン後「自分の情報を編集」):",
      new URL("../profile/", location.href).href,
    ].join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  // ---------- 編集フォーム ----------
  function checkboxes(container, name, options) {
    $(container).innerHTML = options
      .map((o) => `<label><input type="checkbox" name="${name}" value="${escapeHtml(o.id)}"> ${escapeHtml(o.label)}</label>`)
      .join("");
  }

  function setupForm() {
    // 業種はまとまりごとに選べるようにする(どのまとまりにも入らない業種は最後に)
    const opt = (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
    const grouped = REF_CATEGORY_GROUPS.flatMap((g) => g.categories);
    $("#fCategory").innerHTML = REF_CATEGORY_GROUPS.map((g) => `<optgroup label="${escapeHtml(g.label)}">${g.categories.map(opt).join("")}</optgroup>`).join("")
      + REF_CATEGORIES.filter((c) => !grouped.includes(c)).map(opt).join("");
    $("#fBase").innerHTML = REF_BASES.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
    checkboxes("#fTopics", "topics", TOPICS);
    checkboxes("#fTargets", "targets", [{ id: "any", label: "業種を問わない" }, ...INDUSTRIES]);
    checkboxes("#fProspects", "prospects", PROSPECTS);
  }

  const EMPTY = {
    id: "", name: "", company: "", team: "", base: "未設定", category: UNCATEGORIZED,
    business: "", customers: "", offer: "", selfIntro: "", note: "", wants: "", triggers: [], face: "", faceAreas: [], online: "unknown",
    topics: [], targets: [], prospects: [], links: [],
  };

  function openEditor(member) {
    const m = Object.assign({}, EMPTY, member || {});
    $("#editorTitle").textContent = member ? `${m.name}さんを編集` : "メンバーを追加";
    ["id", "name", "company", "team", "category", "base", "business", "customers", "offer", "selfIntro", "note", "wants", "face", "online"].forEach((k) => {
      form.elements[k].value = m[k];
    });
    form.elements.triggers.value = m.triggers.join("\n");
    LinksEditor.mount($("#fLinks"), m.links || []);
    ["faceAreas", "topics", "targets", "prospects"].forEach((k) => {
      form.querySelectorAll(`input[name="${k}"]`).forEach((cb) => { cb.checked = m[k].includes(cb.value); });
    });
    $("#teamList").innerHTML = [...new Set(members.map((x) => x.team).filter(Boolean))]
      .map((t) => `<option value="${escapeHtml(t)}"></option>`).join("");
    $("#editorError").textContent = "";
    form.elements.name.removeAttribute("aria-invalid");
    $("#editorOverlay").hidden = false;
    $("#editorOverlay").scrollTop = 0;
    document.body.style.overflow = "hidden";
    form.elements.name.focus();
  }

  function closeEditor() {
    $("#editorOverlay").hidden = true;
    document.body.style.overflow = "";
  }

  function readForm() {
    const v = (k) => form.elements[k].value.trim();
    const checked = (k) => [...form.querySelectorAll(`input[name="${k}"]:checked`)].map((cb) => cb.value);
    return {
      id: v("id"),
      name: v("name"),
      company: v("company"),
      team: v("team"),
      category: v("category"),
      base: v("base"),
      business: v("business"),
      customers: v("customers"),
      offer: v("offer"),
      selfIntro: v("selfIntro"),
      note: v("note"),
      wants: v("wants"),
      triggers: form.elements.triggers.value.split(/\r?\n/).map((t) => t.replace(/^[「『]|[」』]$/g, "").trim()).filter(Boolean),
      face: v("face"),
      faceAreas: checked("faceAreas"),
      online: v("online"),
      topics: checked("topics"),
      targets: checked("targets"),
      prospects: checked("prospects"),
      links: LinksEditor.read($("#fLinks")).links,
    };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const member = readForm();
    if (LinksEditor.read($("#fLinks")).error) {
      $("#editorError").textContent = "エラー:資料・リンクのURLを確認してください。";
      return;
    }
    if (!member.name) {
      form.elements.name.setAttribute("aria-invalid", "true");
      $("#editorError").textContent = "エラー:氏名を入力してください。";
      form.elements.name.focus();
      return;
    }
    const res = await AuthApi.adminSaveReferralMember(AuthSession.getToken(), member);
    if (!res.success) {
      $("#editorError").textContent = res.error.userMessage;
      return;
    }
    closeEditor();
    await load();
    toast(res.data.created ? `${res.data.member.name}さんを追加しました` : `${res.data.member.name}さんの情報を保存しました`);
  });

  // ---------- 書き出し・読み込み ----------
  function exportJson() {
    const blob = new Blob([JSON.stringify(members, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `referral-members-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importJson(file) {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast("JSONファイルを読み込めませんでした");
      return;
    }
    const list = Array.isArray(data) ? data : data && data.members;
    if (!Array.isArray(list)) {
      toast("名簿の形式ではありません");
      return;
    }
    if (!confirm(`今の名簿(${members.length}名)を、読み込んだ名簿(${list.length}名)で置き換えます。よろしいですか?`)) return;
    const res = await AuthApi.adminImportReferralMembers(AuthSession.getToken(), list);
    if (!res.success) {
      toast(res.error.userMessage);
      return;
    }
    await load();
    toast(`${res.data.count}名の名簿を読み込みました`);
  }

  // ---------- イベント ----------
  document.addEventListener("click", async (e) => {
    const st = e.target.closest("[data-status]");
    if (st) { status = st.dataset.status; render(); return; }

    const edit = e.target.closest("[data-edit]");
    if (edit) { openEditor(members.find((m) => m.id === edit.dataset.edit)); return; }

    const ask = e.target.closest("[data-ask]");
    if (ask) {
      const m = members.find((x) => x.id === ask.dataset.ask);
      const ok = await copyText(askText(m));
      toast(ok ? `${m.name}さんへのお願い文をコピーしました。LINEに貼り付けて送ってください` : "コピーできませんでした");
      return;
    }

    const del = e.target.closest("[data-delete]");
    if (del) {
      const m = members.find((x) => x.id === del.dataset.delete);
      if (!m || !confirm(`${m.name}さんを名簿から削除します。よろしいですか?`)) return;
      const res = await AuthApi.adminDeleteReferralMember(AuthSession.getToken(), m.id);
      if (!res.success) { toast(res.error.userMessage); return; }
      await load();
      toast(`${m.name}さんを削除しました`);
    }
  });

  $("#addMember").addEventListener("click", () => openEditor(null));
  $("#editorClose").addEventListener("click", closeEditor);
  $("#editorCancel").addEventListener("click", closeEditor);
  $("#editorOverlay").addEventListener("click", (e) => { if (e.target.id === "editorOverlay") closeEditor(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#editorOverlay").hidden) closeEditor(); });
  $("#admSearch").addEventListener("input", (e) => { search = e.target.value; render(); });
  $("#exportJson").addEventListener("click", exportJson);
  $("#importJsonBtn").addEventListener("click", () => $("#importJson").click());
  $("#importJson").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) importJson(file);
  });

  // ---------- 初期化(管理者のみ) ----------
  (async function init() {
    const session = await AuthSession.guardPage({ next: "admin", loginPath: "../login/" });
    if (!session) return;
    if (!session.user.isAdmin) {
      $("#denied").hidden = false;
    } else {
      $("#adminArea").hidden = false;
      $("#demoFootnote").hidden = AuthApi.isShared();
      setupForm();
      await load();
    }
    document.documentElement.classList.remove("guard-pending");
  })();
})();
