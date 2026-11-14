// ============================================
// app/ops.js — 運営(プレゼンを任された運営メンバーだけ)
// 運営会議を作ると Google Meet を自動で作り(共有サーバーでカレンダー連携のとき)、
// 会議のあとは Google Meet の「Gemini によるメモ」を読みこんで議事録として残す。
// 読みこめないときは、メモ(Gemini のメール・自分のメモ)を貼り付けて残せる
// ============================================
(function () {
  "use strict";
  const { h } = App;
  const two = (n) => String(n).padStart(2, "0");
  const todayKey = () => { const d = new Date(Date.now() + 9 * 3600000); return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`; };
  const stampOf = (ms) => { if (!ms) return ""; const d = new Date(ms + 9 * 3600000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}:${two(d.getUTCMinutes())}`; };
  const SOURCE = { gemini: "Gemini のメモ", transcript: "文字起こし", manual: "議事録" };

  App.views.ops = {
    title: "運営",
    tab: "ops",
    async render(el, parts, params) {
      if (!(App.canPresent && App.canPresent()) && !App.isAdmin()) { history.replaceState(null, "", "#events"); App.route(); return; }
      const d = await App.api("listOpsMeetings");
      if (!d) return;
      const today = todayKey();
      const q = (params.get("q") || "").trim();
      el.append(
        h("p", { class: "app-lead" }, "運営メンバーだけの画面です。定例会の役割早見表と、運営会議(Google Meet・議事録)をここで見られます。"));
      el.append(await rolesSection());
      el.append(
        h("div", { class: "app-cta-row" }, App.btn("＋ 運営会議を作る", () => meetingForm(null, d), "primary wide")));
      // 議事録をことばで探す
      const search = h("input", { type: "search", class: "ops-search", placeholder: "議事録をことばで探す(例: 定例会・ビジター)", value: q, "aria-label": "議事録を探す",
        onkeydown: (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); App.go(`ops${search.value.trim() ? `?q=${encodeURIComponent(search.value.trim())}` : ""}`); } } });
      el.append(search);
      const hit = (m) => !q || [m.title, m.agenda, ...m.notes.map((n) => `${n.title} ${n.text}`)].join(" ").toLowerCase().includes(q.toLowerCase());
      const items = d.items.filter(hit);
      const upcoming = items.filter((m) => m.date >= today).reverse();
      const past = items.filter((m) => m.date < today);
      if (upcoming.length) el.append(App.section("これからの運営会議", h("div", { class: "ops-list" }, upcoming.map((m) => card(m, d)))));
      el.append(App.section(q ? `「${q}」が出てくる会議` : "これまでの運営会議(議事録)",
        past.length ? h("div", { class: "ops-list" }, past.map((m) => card(m, d)))
          : App.empty(q ? "見つかりませんでした。" : "まだ会議がありません。上の「運営会議を作る」から作れます。")));
    },
  };

  // ---------- 定例会の役割早見表 ----------
  // はじめは運営から受け取った割り当て(2026年11月14日の写真)。担当は、行を開いて全メンバーから選ぶ(何人でも・もう一度押すと外れる)。
  // 共有サーバーに保存し、運営メンバーみんなが同じ表を見る(getOpsRoles / saveOpsRoles)。
  // 共有サーバーがまだ古いとき(GAS を再デプロイする前)は、この端末にだけ覚える
  const ROLE_DEFAULT = [
    ["r01", "01 はじめの挨拶", ["三村 隆"]],
    ["r02", "02 用語説明", ["床島 良夫"]],
    ["r03", "03 BT-EXの理念", ["三村 隆"]],
    ["r04", "04 仕組みとベネフィット", ["加藤 寛之"]],
    ["r05", "05 エデュケーションコーナー 5分", ["大場 雅俊"]],
    ["r06", "06 1分プレゼンテーション", []],
    ["r06b", "休憩(1分)", ["あまみや 七音"]],
    ["r07", "07 ブレイクアウトルーム商談(テーブル商談) 7分×3回", []],
    ["r08", "08 BT-EXの強み", ["小林 末季"]],
    ["r09", "09 LINKのビジネス実績紹介", ["大場 雅俊"]],
    ["r10", "10 BT-EX5のご案内", ["山本 捷真"]],
    ["r11", "11 BT-EXの規定", ["あまみや 七音"]],
    ["r12", "12 終わりの挨拶", ["三村 隆"]],
  ];
  const ROLE_TITLES = { m14: "副代表" }; // 名前の前に添える肩書き
  const flat = (t) => String(t || "").replace(/\s+/g, "");
  // ひらがなでもカタカナでも探せるように、ひらがなをカタカナにそろえる
  const kata = (t) => flat(t).replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  const idByName = (name) => { const m = (App.members || []).find((x) => flat(x.name) === flat(name) || flat(x.name).startsWith(flat(name))); return m ? m.id : ""; };
  const defaultRoles = () => ROLE_DEFAULT.map(([key, label, names]) => ({ key, label, ids: names.map(idByName).filter(Boolean) }));
  const LOCAL = "btex5-ops-roles";
  const nameOfId = (id) => { const m = App.memberById(id); return m ? m.name : ""; };
  const kanaOf = (m) => m.kana || m.name || "";

  async function rolesSection() {
    const res = await App.api("getOpsRoles", {}, { quiet: true, raw: true });
    // raw: 失敗のときは { success: false, error }、うまくいったときは中身({ roles })が返る
    const shared = !!res && res.success !== false;
    let saved = shared ? res.roles : null;
    if (!shared) { try { saved = JSON.parse(localStorage.getItem(LOCAL) || "null"); } catch { saved = null; } }
    let items = saved && Array.isArray(saved.items) && saved.items.length ? saved.items.map((x) => Object.assign({}, x, { ids: (x.ids || []).slice() })) : defaultRoles();
    const myId = (App.session && App.session.memberId) || "";
    let openKey = "";       // 開いている行(1つだけ)
    let filter = "all";     // all / mine / empty
    let query = "";
    const wrap = h("section", { class: "app-section ops-roles" });
    const info = h("p", { class: "ops-roles-info", "aria-live": "polite" });
    const stats = h("div", { class: "ops-roles-stats" });
    const filterBox = h("div", { class: "ops-roles-filter", role: "group", "aria-label": "表示する行" });
    const listBox = h("div", { class: "ops-roles-list" });
    const byPerson = h("div", { class: "ops-roles-people" });
    let timer = null;

    const people = () => (App.members || []).slice().sort((p, q) => kanaOf(p).localeCompare(kanaOf(q), "ja"));
    const titled = (id) => `${ROLE_TITLES[id] ? `${ROLE_TITLES[id]} ` : ""}${nameOfId(id)}`;
    // 「01 はじめの挨拶」→ 番号と名前に分ける(番号のない行は「・」)
    const split = (label) => { const m = /^(\d+)\s*(.*)$/.exec(label); return m ? [m[1], m[2]] : ["", label]; };

    function setInfo(text) {
      info.textContent = text || (shared
        ? (saved && saved.byName ? `最後に直した人: ${saved.byName}${saved.at ? `(${new Date(saved.at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })})` : ""}。直すとすぐ保存され、運営メンバーみんなの表が変わります。` : "運営から受け取った割り当てです。行を押すと、全メンバーから担当を選べます(直すとすぐ保存されます)。")
        : "いまは、この端末にだけ保存されます(共有サーバーの更新のあと、運営メンバーみんなで同じ表になります)。");
    }
    function save() {
      clearTimeout(timer);
      setInfo("保存しています…");
      timer = setTimeout(async () => {
        const out = items.map((x) => ({ key: x.key, label: x.label, ids: x.ids }));
        if (shared) {
          const r = await App.api("saveOpsRoles", { items: out });
          if (r) { saved = r.roles; setInfo(); } else setInfo("保存できませんでした。電波のよいところで、もう一度選んでください。");
        } else {
          try { localStorage.setItem(LOCAL, JSON.stringify({ items: out, at: Date.now() })); } catch { /* noop */ }
          setInfo();
        }
      }, 500);
    }
    // LINE などに貼る文(写真の表と同じ並び)
    function asText() {
      return ["【BT-EX5 定例会 役割早見表】", ...items.map((it) => {
        const [no, name] = split(it.label);
        return `${no ? `${no} ` : "　"}${name}${it.ids.length ? `:${it.ids.map(titled).join("・")}` : ""}`;
      })].join("\n");
    }
    function drawStats() {
      const empty = items.filter((x) => !x.ids.length).length;
      const mine = items.filter((x) => x.ids.includes(myId)).length;
      App.fill(stats, [
        h("span", { class: "ops-roles-stat" }, h("b", null, String(items.length)), "役割"),
        h("span", { class: `ops-roles-stat${empty ? " is-warn" : " is-good"}` }, h("b", null, String(empty)), "担当なし"),
        h("span", { class: `ops-roles-stat${mine ? " is-me" : ""}` }, h("b", null, String(mine)), "あなたの担当"),
      ]);
      App.fill(filterBox, [["all", "すべて"], ["mine", "自分の担当"], ["empty", "担当なし"]].map(([id, label]) =>
        h("button", { type: "button", class: `app-pill${filter === id ? " is-on" : ""}`, "aria-pressed": filter === id ? "true" : "false",
          onclick: () => { filter = id; openKey = ""; draw(); } }, label)));
    }
    function drawPeople() {
      const map = new Map();
      items.forEach((it) => it.ids.forEach((id) => { if (!map.has(id)) map.set(id, []); map.get(id).push(it.label); }));
      const rows = [...map.entries()].sort((p, q) => kanaOf(App.memberById(p[0]) || {}).localeCompare(kanaOf(App.memberById(q[0]) || {}), "ja"));
      App.fill(byPerson, rows.length ? rows.map(([id, roles]) => h("div", { class: `ops-roles-person${id === myId ? " is-me" : ""}` },
        App.avatar(nameOfId(id)),
        h("div", null, h("b", null, titled(id), id === myId ? h("i", null, "あなた") : null),
          h("div", { class: "ops-roles-tags" }, roles.map((r) => h("span", null, r))))))
        : [h("p", { class: "app-field-hint" }, "まだだれも割り当てられていません。")]);
    }
    // 開いた行の中: 名前でしぼる欄と、全メンバーのトグル(選んだ人が先頭)
    function picker(it) {
      const grid = h("div", { class: "ops-role-chips", role: "group", "aria-label": `${it.label}の担当` });
      const count = h("span", { class: "ops-role-count" });
      const drawChips = () => {
        const q = kata(query);
        const all = people();
        const on = it.ids.map((id) => all.find((m) => m.id === id)).filter(Boolean);
        const rest = all.filter((m) => !it.ids.includes(m.id) && (!q || kata(m.name).includes(q) || kata(m.kana).includes(q)));
        count.textContent = it.ids.length ? `${it.ids.length}人を選んでいます` : "まだ選んでいません";
        App.fill(grid, on.concat(rest).map((m) => {
          const sel = it.ids.includes(m.id);
          return h("button", { type: "button", class: `ops-role-chip${sel ? " is-on" : ""}`, "aria-pressed": sel ? "true" : "false",
            onclick: () => {
              it.ids = sel ? it.ids.filter((x) => x !== m.id) : it.ids.concat(m.id).slice(0, 10);
              drawChips(); drawHead(it); drawStats(); drawPeople(); save();
            } }, App.avatar(m.name, "sm"), h("span", null, m.name), sel ? h("i", { "aria-hidden": "true" }, "✓") : null);
        }));
        if (!on.length && !rest.length) grid.append(h("p", { class: "app-field-hint" }, "その名前のメンバーは見つかりませんでした。"));
      };
      const search = h("input", { type: "search", class: "ops-search", placeholder: "名前でしぼる(例: 三村)", value: query, "aria-label": "メンバーを名前でしぼる",
        oninput: () => { query = search.value; drawChips(); } });
      drawChips();
      return h("div", { class: "ops-role-pick" },
        h("div", { class: "ops-role-pick-top" }, search, count),
        grid,
        h("div", { class: "app-btn-row" },
          App.btn("担当を外す", () => { it.ids = []; drawChips(); drawHead(it); drawStats(); drawPeople(); save(); }, "ghost small"),
          App.btn("閉じる", () => { openKey = ""; draw(); }, "ghost small")));
    }
    // 行の頭(番号・役割・担当)だけを描き直す(選ぶたびに、開いた行を作り直さないため)
    const heads = new Map();
    function headInner(it) {
      const [no, name] = split(it.label);
      const mine = it.ids.includes(myId);
      return [
        h("span", { class: `ops-role-no${no ? "" : " is-sub"}`, "aria-hidden": "true" }, no || "・"),
        h("span", { class: "ops-role-main" },
          h("span", { class: "ops-role-label" }, name, mine ? h("i", { class: "ops-role-me" }, "あなた") : null),
          it.ids.length
            ? h("span", { class: "ops-role-who" }, it.ids.map((id) => h("span", { class: "ops-role-face" }, App.avatar(nameOfId(id), "sm"), titled(id))))
            : h("span", { class: "ops-role-who is-none" }, "担当なし(押して選ぶ)")),
        h("span", { class: "ops-role-toggle", "aria-hidden": "true" }, openKey === it.key ? "▲" : "▼"),
      ];
    }
    function drawHead(it) {
      const el = heads.get(it.key);
      if (!el) return;
      App.fill(el, headInner(it));
      el.parentNode.classList.toggle("is-empty", !it.ids.length);
      el.parentNode.classList.toggle("is-mine", it.ids.includes(myId));
    }
    function draw() {
      heads.clear();
      drawStats();
      const shown = items.filter((it) => filter === "all" || (filter === "mine" ? it.ids.includes(myId) : !it.ids.length));
      App.fill(listBox, shown.length ? shown.map((it) => {
        const isOpen = openKey === it.key;
        const row = h("div", { class: `ops-role${isOpen ? " is-open" : ""}${it.ids.length ? "" : " is-empty"}${it.ids.includes(myId) ? " is-mine" : ""}` });
        const head = h("button", { type: "button", class: "ops-role-head", "aria-expanded": isOpen ? "true" : "false",
          onclick: () => { openKey = isOpen ? "" : it.key; query = ""; draw(); if (!isOpen) { const r = listBox.querySelector(".ops-role.is-open"); if (r && r.scrollIntoView) r.scrollIntoView({ block: "nearest", behavior: "smooth" }); } } },
          ...headInner(it));
        heads.set(it.key, head);
        row.append(head);
        if (isOpen) row.append(picker(it));
        return row;
      }) : [App.empty(filter === "mine" ? "あなたの担当は、いまはありません。" : "担当なしの役割はありません。すべて決まっています。")]);
    }
    setInfo(); draw(); drawPeople();
    wrap.append(
      h("h2", { class: "app-h2" }, "定例会の役割早見表"),
      stats, filterBox, info, listBox,
      h("div", { class: "app-btn-row" },
        App.btn("LINE などで送る", () => App.shareText(asText(), "BT-EX5 定例会 役割早見表"), "primary small"),
        App.btn("文をコピー", () => App.copyText(asText(), "役割早見表をコピーしました"), "ghost small"),
        App.btn("最初の割り当てに戻す", async () => {
          if (!(await App.confirm("運営から受け取った最初の割り当て(写真の表)に戻しますか?", { ok: "戻す" }))) return;
          items = defaultRoles(); openKey = ""; draw(); drawPeople(); save();
        }, "ghost small")),
      h("details", { class: "ops-roles-more" }, h("summary", null, "人ごとに見る(だれが何を担当するか)"), byPerson));
    return wrap;
  }

  function card(m, d) {
    const notes = m.notes || [];
    return h("article", { class: "ops-card" },
      h("div", { class: "ops-card-head" },
        h("div", { class: "ops-date" }, h("b", null, App.fmtDate(m.date)), h("small", null, `${m.start}〜${m.end}`)),
        h("div", { class: "ops-ttl" }, h("h3", null, m.title), m.byName ? h("small", null, `作成: ${m.byName}`) : null)),
      m.agenda ? h("p", { class: "ops-agenda" }, m.agenda) : null,
      h("div", { class: "app-btn-row" },
        m.meetUrl ? h("a", { class: "app-btn primary small", href: m.meetUrl, target: "_blank", rel: "noopener" }, "Google Meet に参加") : null,
        m.link ? h("a", { class: "app-btn ghost small", href: m.link, target: "_blank", rel: "noopener" }, "カレンダーで開く") : null,
        App.btn("編集", () => meetingForm(m, d), "ghost small")),
      h("section", { class: "ops-notes" },
        h("h4", null, `議事録${notes.length ? `(${notes.length})` : ""}`),
        notes.length ? notes.map((n) => h("details", { class: "ops-note", open: notes.length === 1 },
          h("summary", null, App.chip(SOURCE[n.source] || "議事録", n.source === "manual" ? "mute" : "info"), h("b", null, n.title), h("small", null, stampOf(n.at))),
          n.text ? h("div", { class: "ops-note-text" }, n.text) : null,
          h("div", { class: "app-btn-row" },
            n.url ? h("a", { class: "app-btn ghost small", href: n.url, target: "_blank", rel: "noopener" }, "元のドキュメントを開く") : null,
            n.text ? App.btn("コピー", () => App.copyText(n.text, "議事録をコピーしました"), "ghost small") : null,
            App.btn("直す・消す", () => notesForm(m, n), "ghost small"))))
          : h("p", { class: "app-field-hint" }, d.autoNotes ? "会議が終わると、Gemini のメモを1時間ごとに読みこみます(Meet で「Gemini によるメモ」をオンにしてください)。" : "会議のあと、Gemini のメモ(メールで届く内容)や自分のメモを貼り付けて残せます。"),
        h("div", { class: "app-btn-row" },
          d.autoNotes ? App.btn("Gemini のメモを読みこむ", async () => {
            const r = await App.api("fetchOpsNotes", { id: m.id });
            if (r) { App.toast(r.added ? `${r.added}件の議事録を読みこみました` : "新しい議事録はまだありません"); App.route(); }
          }, "ghost small") : null,
          App.btn("＋ 議事録を貼り付ける", () => notesForm(m, null), "ghost small"))));
  }

  function meetingForm(m, d) {
    App.openSheet(m ? "運営会議を編集" : "運営会議を作る", (body, close) => {
      const title = h("input", { type: "text", maxlength: "80", value: m ? m.title : "運営会議" });
      const date = h("input", { type: "date", value: m ? m.date : todayKey() });
      const start = App.timeSelect(m ? m.start : "21:00", { label: "開始" });
      const end = App.timeSelect(m ? m.end : "22:00", { label: "終了" });
      const agenda = h("textarea", { rows: "4", maxlength: "2000", placeholder: "話すこと(例: 次回の定例会の準備・ビジターのフォロー)" });
      agenda.value = m ? m.agenda : "";
      const meetUrl = h("input", { type: "url", maxlength: "200", placeholder: "https://meet.google.com/…", value: m ? m.meetUrl : "" });
      const save = App.btn("保存する", async () => {
        save.disabled = true;
        const r = await App.api("saveOpsMeeting", { meeting: { id: m ? m.id : "", title: title.value.trim(), date: date.value, start: start.value, end: end.value, agenda: agenda.value, meetUrl: meetUrl.value.trim() } });
        save.disabled = false;
        if (!r) return;
        close();
        App.toast(r.meeting.meetUrl && d.calendar ? "保存しました(Google Meet を作り、運営メンバーを招待しました)" : "保存しました");
        App.route();
      }, "primary wide");
      body.append(
        App.field("会議の名前", title),
        App.field("日付", date),
        h("div", { class: "app-grid2" }, App.field("開始", start), App.field("終了", end)),
        App.field("話すこと(任意)", agenda),
        d.calendar ? h("p", { class: "app-field-hint" }, m && m.meetUrl ? "Google Meet は作成済みです。日時を変えるとカレンダーの予定も変わります。" : "保存すると Google Meet を自動で作り、カレンダー用のメールを入れている運営メンバーを招待します。")
          : h("div", null,
            h("p", { class: "app-field-hint" }, "いまはお試し版のため、Google Meet は自動で作れません。下のボタンで作り、URL を貼り付けてください(共有サーバーで Google カレンダーと連携すると、保存したときに自動で作られます)。"),
            h("div", { class: "app-btn-row" }, h("a", { class: "app-btn ghost small", href: "https://meet.google.com/new", target: "_blank", rel: "noopener" }, "Meet を作る")),
            App.field("Google Meet の URL", meetUrl)),
        save,
        m ? h("div", { class: "app-btn-row" }, App.btn("この会議を削除", async () => {
          if (!(await App.confirm(`「${m.title}」(${App.fmtDate(m.date)})を削除しますか?(議事録も消えます)`, { ok: "削除する", danger: true }))) return;
          if (await App.api("deleteOpsMeeting", { id: m.id })) { close(); App.toast("削除しました"); App.route(); }
        }, "ghost small danger")) : null);
    });
  }

  function notesForm(m, n) {
    App.openSheet(n ? "議事録を直す" : "議事録を貼り付ける", (body, close) => {
      const title = h("input", { type: "text", maxlength: "80", value: n ? n.title : `${m.title}の議事録` });
      const text = h("textarea", { rows: "12", maxlength: "40000", placeholder: "Gemini のメモ(概要・推奨される次のステップ)や、自分のメモを貼り付けてください" });
      text.value = n ? n.text : "";
      const url = h("input", { type: "url", maxlength: "500", placeholder: "https://docs.google.com/…(任意)", value: n ? n.url : "" });
      const save = App.btn("保存する", async () => {
        const r = await App.api("saveOpsNotes", { id: m.id, noteId: n ? n.id : "", title: title.value.trim(), text: text.value, url: url.value.trim() });
        if (r) { close(); App.toast("議事録を保存しました"); App.route(); }
      }, "primary wide");
      body.append(
        App.field("題", title),
        App.field("内容", text, "Gemini のメモは、メールの「会議メモを開く」から開いたドキュメントの文をそのまま貼り付けられます"),
        App.field("ドキュメントのリンク(任意)", url),
        save,
        n ? h("div", { class: "app-btn-row" }, App.btn("この議事録を消す", async () => {
          if (!(await App.confirm("この議事録を消しますか?", { ok: "消す", danger: true }))) return;
          const r = await App.api("saveOpsNotes", { id: m.id, noteId: n.id, text: "", url: "" });
          if (r) { close(); App.toast("消しました"); App.route(); }
        }, "ghost small danger")) : null);
    });
  }
})();
