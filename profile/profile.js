// ============================================
// 自分の情報を編集(会員本人)
// 保存はサーバー層の updateMyProfile が本人の行だけを書き換える
// (名前・所属チームは変えられない)
// ============================================

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const form = $("#profileForm");
  // 1on1シートの項目
  const SHEET_FIELDS = ["strengths", "pitch", "ng", "goals", "personal"];
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
    ["company", "category", "base", "business", "customers", "offer", "selfIntro", "note", "wants", "face", "online", ...SHEET_FIELDS].forEach((k) => {
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
      // ジャンルは登録してあった順(主な仕事が先)を保ち、新しく選んだものを後ろに足す
      topics: ((picked, before) => [...before.filter((t) => picked.includes(t)), ...picked.filter((t) => !before.includes(t))])(checked("topics"), (me && me.topics) || []),
      targets: checked("targets"),
      prospects: checked("prospects"),
      links: LinksEditor.read($("#fLinks")).links,
      ...Object.fromEntries(SHEET_FIELDS.map((k) => [k, v(k)])),
    };
  }

  // 紹介に効く項目の記入状況(referral/data.js の PROFILE_ITEMS と、診断用の話題)
  // jump: まだの項目を押したときに移動する入力欄
  const JUMP = { range: "#pfRange", wants: 'textarea[name="wants"]', business: 'textarea[name="business"]', triggers: 'textarea[name="triggers"]', customers: 'textarea[name="customers"]', offer: 'textarea[name="offer"]' };
  const CHECKS = [
    ...PROFILE_ITEMS.map((it) => ({ label: it.key === "triggers" ? `${it.label}(3つ以上)` : it.label, ok: it.ok, jump: JUMP[it.key] })),
    { label: "できること(ジャンル)", ok: (p) => p.topics.length > 0, jump: "#pfDiag" },
  ];

  function renderProgress() {
    const p = readForm();
    const done = CHECKS.filter((c) => c.ok(p)).length;
    const pct = Math.round((done / CHECKS.length) * 100);
    $("#profPercent").textContent = `${pct}%`;
    $("#profBar").style.width = `${pct}%`;
    $("#profTodo").innerHTML = CHECKS
      .map((c, i) => `<li class="${c.ok(p) ? "is-done" : ""}">${c.ok(p) ? escapeHtml(c.label) : `<button type="button" data-jump="${i}">${escapeHtml(c.label)}</button>`}</li>`)
      .join("");
    $("#topicCount").textContent = `(${p.topics.length}個選択中)`;
    renderDirty();
  }

  // 未保存の変更: 保存ボタンの横に出し、ページを離れるときは確認する
  let saved = "";
  const snapshot = () => JSON.stringify(readForm());
  const isDirty = () => !!saved && snapshot() !== saved;
  function renderDirty() { $("#profDirty").hidden = !isDirty(); }
  window.addEventListener("beforeunload", (e) => {
    if (isDirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  // まだの項目を押すと、その入力欄へ移動する
  $("#profTodo").addEventListener("click", (e) => {
    const b = e.target.closest("[data-jump]");
    if (!b) return;
    const target = document.querySelector(CHECKS[Number(b.dataset.jump)].jump);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const field = target.matches("textarea, input, select") ? target : target.querySelector("input, textarea, select");
    if (field) setTimeout(() => field.focus({ preventScroll: true }), 350);
  });

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
    saved = snapshot();
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
      $("#profView").href = `../referral/#member=${encodeURIComponent(me.id)}`;
    } else {
      $("#profileError").textContent = "名簿にあなたの情報が見つかりませんでした。運営者にご連絡ください。";
      $("#profileSave").disabled = true;
    }
    saved = snapshot();
    renderProgress();
    document.documentElement.classList.remove("guard-pending");
    if (me && typeof ProfileTransfer !== "undefined") {
      // お試し版: この端末で保存した内容を運営に送れるようにする
      $("#profSend").hidden = AuthApi.isShared();
      $("#profSendNote").hidden = AuthApi.isShared();
      // 共有サーバー: この端末に残っているお試し版の内容を送るか聞く
      ProfileTransfer.offerUpload(session, me);
    }
  })();

  // 運営に送る(LINE などで共有。共有できなければコピー)
  $("#profSendBtn").addEventListener("click", async () => {
    if (isDirty()) { toast("先に「保存する」を押してください"); return; }
    if (!me) return;
    const text = ProfileTransfer.message(me);
    if (navigator.share) {
      try { await navigator.share({ text, title: "BT-EX5 プロフィール" }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); toast("コピーしました。LINE などで運営に送ってください"); }
    catch { window.prompt("この文をコピーして運営に送ってください", text); }
  });
})();
