// ============================================
// 自分の情報を編集(会員本人)
// 保存はサーバー層の updateMyProfile が本人の行だけを書き換える
// (名前・所属チームは変えられない)
// ============================================

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const form = $("#profileForm");
  let me = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("#refToast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function checkboxes(container, name, options) {
    const one = (o) => `<label><input type="checkbox" name="${name}" value="${escapeHtml(o.id)}"> ${escapeHtml(o.label)}</label>`;
    // ジャンル(話題)は数が多いので、まとまりごとに見出しをつける
    $(container).innerHTML = options === TOPICS && typeof TOPIC_GROUPS !== "undefined"
      ? TOPIC_GROUPS.map((g) => `<p class="adm-check-group">${escapeHtml(g.label)}</p>${options.filter((o) => o.group === g.id).map(one).join("")}`).join("")
      : options.map(one).join("");
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

  function fill(m) {
    ["company", "category", "base", "business", "customers", "offer", "selfIntro", "note", "wants", "face", "online"].forEach((k) => {
      form.elements[k].value = m[k] || "";
    });
    if (!form.elements.online.value) form.elements.online.value = "unknown";
    form.elements.triggers.value = (m.triggers || []).join("\n");
    LinksEditor.mount($("#fLinks"), m.links || []);
    ["faceAreas", "topics", "targets", "prospects"].forEach((k) => {
      form.querySelectorAll(`input[name="${k}"]`).forEach((cb) => { cb.checked = (m[k] || []).includes(cb.value); });
    });
  }

  function readForm() {
    const v = (k) => form.elements[k].value.trim();
    const checked = (k) => [...form.querySelectorAll(`input[name="${k}"]:checked`)].map((cb) => cb.value);
    return {
      company: v("company"),
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

  // 紹介に効く項目の記入状況(referral/data.js の PROFILE_ITEMS と、診断用の話題)
  const CHECKS = [
    ...PROFILE_ITEMS.map((it) => ({ label: it.key === "triggers" ? `${it.label}(3つ以上)` : it.label, ok: it.ok })),
    { label: "対応できる話題", ok: (p) => p.topics.length > 0 },
  ];

  function renderProgress() {
    const p = readForm();
    const done = CHECKS.filter((c) => c.ok(p)).length;
    const pct = Math.round((done / CHECKS.length) * 100);
    $("#profPercent").textContent = `${pct}%`;
    $("#profBar").style.width = `${pct}%`;
    $("#profTodo").innerHTML = CHECKS
      .map((c) => `<li class="${c.ok(p) ? "is-done" : ""}">${escapeHtml(c.label)}</li>`)
      .join("");
  }

  form.addEventListener("input", renderProgress);
  form.addEventListener("change", renderProgress);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#profileError").textContent = "";
    if (LinksEditor.read($("#fLinks")).error) {
      $("#profileError").textContent = "資料・リンクのURLを確認してください(https:// から始まるURL)。";
      return;
    }
    $("#profileSave").disabled = true;
    const res = await AuthApi.updateMyProfile(AuthSession.getToken(), readForm());
    $("#profileSave").disabled = false;
    if (!res.success) {
      $("#profileError").textContent = res.error.userMessage;
      return;
    }
    me = res.data.member;
    fill(me);
    renderProgress();
    toast("保存しました。紹介先早見表に反映されています");
  });

  (async function init() {
    const session = await AuthSession.guardPage({ next: "profile", loginPath: "../login/" });
    if (!session) return;
    const res = await AuthApi.listReferralMembers(AuthSession.getToken());
    me = res.success ? res.data.members.find((m) => m.id === session.memberId) : null;
    setupForm();
    if (me) {
      $("#profName").textContent = me.name;
      fill(me);
    } else {
      $("#profileError").textContent = "名簿にあなたの情報が見つかりませんでした。運営者にご連絡ください。";
      $("#profileSave").disabled = true;
    }
    renderProgress();
    document.documentElement.classList.remove("guard-pending");
  })();
})();
