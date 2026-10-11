// ============================================
// app/tasks.js — やること(担当者・期限つき)
// ホームの「あなたのやること」と、定例会の議事録の「やること」で使う
// ============================================

(function () {
  "use strict";
  const { h } = App;

  // 期限の表示(あと◯日・今日・期限切れ)
  function dueLabel(due) {
    if (!due) return null;
    const n = App.daysUntil(due, App.todayKey());
    const text = n < 0 ? `期限切れ(${App.fmtDate(due)})` : n === 0 ? "今日まで" : n === 1 ? "明日まで" : `${App.fmtDate(due)}まで(あと${n}日)`;
    return h("span", { class: `task-due${n < 0 ? " is-over" : n <= 1 ? " is-soon" : ""}` }, text);
  }

  // 1件の行。mine: 自分の分にチェックできる
  App.taskRow = function (t, opt) {
    const o = opt || {};
    const box = h("input", { type: "checkbox", checked: t.myDone, disabled: !t.mine, "aria-label": `「${t.title}」を終えた` });
    box.addEventListener("change", async () => {
      const d = await App.api("toggleTask", { id: t.id, done: box.checked });
      if (!d) { box.checked = !box.checked; return; }
      Object.assign(t, d.item);
      li.classList.toggle("is-done", box.checked);
      App.toast(box.checked ? "おつかれさまでした!完了にしました" : "未完了に戻しました");
      if (o.onChange) o.onChange(t);
    });
    const many = t.assignees.length > 1;
    const li = h("li", { class: `task-row${t.myDone ? " is-done" : ""}` },
      h("label", { class: "task-main" }, box,
        h("span", null, h("b", null, t.title),
          h("small", null, [
            dueLabel(t.due),
            t.time ? ` ${t.time}` : null,
            o.showEvent && t.eventTitle ? ` ${t.eventTitle}` : null,
            t.by && !t.canEdit ? ` ・ ${t.byName}さんから` : null,
            many ? ` ・ 済 ${t.doneCount}/${t.assignees.length}` : null,
          ]),
          t.note ? h("small", { class: "task-note" }, t.note) : null,
          t.private ? h("small", { class: "task-private" }, "🔒 自分だけ") : null,
          t.due && t.mine && !t.myDone ? App.calendarButtons(calItem(t)) : null,
          o.showPeople && many ? h("small", { class: "task-people" }, t.assignees.map((a) => `${a.done ? "✓" : "・"}${a.name}`).join(" ")) : null)),
      o.canManage || t.canEdit ? h("button", { type: "button", class: "app-icon-btn", "aria-label": "やることを消す", onclick: async (e) => {
        if (!confirm(`「${t.title}」を消しますか?`)) return;
        if (await App.api("deleteTask", { id: t.id })) { e.target.closest("li").remove(); App.toast("消しました"); }
      } }, "×") : null);
    return li;
  };

  // カレンダーに入れる形(時刻があればその時刻から1時間、なければ期限の日の終日)
  function calItem(t) {
    return { uid: `task-${t.id}`, title: `やること:${t.title}`, date: t.due, start: t.time || "", allDay: !t.time, body: [t.note, "BT-EX5 のやること"].filter(Boolean).join("\n\n") };
  }

  // 保存のあと: Google カレンダー(と iPhone・Outlook)に入れるか聞く
  function offerCalendar(t) {
    App.openSheet("カレンダーにも入れますか?", (body, close) => {
      body.append(
        h("p", { class: "app-lead" }, `「${t.title}」を ${App.fmtDate(t.due)}${t.time ? ` ${t.time}` : "(終日)"} の予定として入れます。${t.private ? "あなたのカレンダーに入るだけで、ほかの人には見えません。" : ""}`),
        h("div", { class: "app-btn-row" },
          h("a", { class: "app-btn primary", href: App.googleCalUrl(calItem(t)), target: "_blank", rel: "noopener", onclick: () => setTimeout(close, 300) }, "Google カレンダーに入れる"),
          App.btn("iPhone・Outlook(.ics)", () => { App.icsFile(calItem(t)); close(); }, "ghost")),
        App.btn("入れない", close, "ghost wide"));
    }, { noFocus: true });
  }

  // やることを追加する。admin なら担当者をだれでも選べる(選ばなければ自分)。opt.due で期限を先に入れておける(カレンダーから)。
  // 定例会のやること以外は、はじめから「自分だけが見られる」。保存したら、カレンダーに入れるか聞く
  App.taskForm = function (opt, onSaved) {
    const o = opt || {};
    App.openSheet(o.eventTitle ? `やることを追加(${o.eventTitle})` : "やることを追加", (body, close) => {
      const title = h("input", { type: "text", maxlength: "100", placeholder: "例:プロフィールのリンクを登録する" });
      const due = h("input", { type: "date", value: /^\d{4}-\d{2}-\d{2}$/.test(o.due || "") ? o.due : undefined });
      const quick = h("div", { class: "app-chips" }, [["今日", 0], ["明日", 1], ["1週間後", 7], ["次の定例会まで", 14]].map(([label, n]) =>
        h("button", { type: "button", class: "app-pill", onclick: () => {
          const d = new Date(`${App.todayKey()}T12:00:00`); d.setDate(d.getDate() + n);
          due.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        } }, label)));
      const time = h("input", { type: "time", step: "300", "aria-label": "時刻(任意)" });
      const note = h("textarea", { rows: "2", maxlength: "500", placeholder: "メモ(任意)" });
      // 定例会のやること以外は、はじめから「自分だけ」(ほかの人・運営には見えない)
      const priv = o.eventId ? null : h("input", { type: "checkbox", checked: o.private !== false });
      const picker = App.isAdmin() ? App.memberPicker({ multiple: true, value: [], label: "担当" }) : null;
      const all = App.isAdmin() ? h("input", { type: "checkbox" }) : null;
      const pickerBox = picker ? App.field("担当(選ばなければ自分)", h("div", null, h("label", { class: "app-check" }, all, " 全員"), picker)) : null;
      const syncPicker = () => { if (pickerBox) pickerBox.hidden = !!(priv && priv.checked); };
      if (priv) priv.addEventListener("change", syncPicker);
      syncPicker();
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        if (!title.value.trim()) { App.fieldError(title, "やることを入れてください。"); return; }
        const isPrivate = !!(priv && priv.checked);
        const assignees = isPrivate ? [] : all && all.checked ? App.members.map((m) => m.id) : picker ? picker.getValue() : [];
        const d = await App.api("saveTask", { item: { title: title.value.trim(), due: due.value, time: due.value ? time.value : "", note: note.value, assignees, eventId: o.eventId || "", private: isPrivate } });
        if (!d) return;
        close();
        App.toast(d.item.assignees.length > 1 ? `${d.item.assignees.length}名に届けました` : d.item.mine ? "追加しました" : `${d.item.assignees[0].name}さんに届けました`);
        if (onSaved) onSaved(d.item);
        // 期限があれば、自分のカレンダーにも入れられる
        if (d.item.due && d.item.mine) offerCalendar(d.item);
      } },
      App.field("やること", title),
      App.field("期限(任意)", h("div", null, due, quick)),
      App.field("時刻(任意)", time, "入れると、カレンダーにその時刻の予定として入ります(入れなければ終日)"),
      priv ? h("label", { class: "app-check task-private-check" }, priv, " 自分だけが見られる(ほかのメンバー・運営には見えません)") : null,
      pickerBox,
      App.field("メモ", note),
      h("button", { type: "submit", class: "app-btn primary wide" }, "追加する")));
    }, { noFocus: true });
  };
})();
