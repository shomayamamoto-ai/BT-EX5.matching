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
            o.showEvent && t.eventTitle ? ` ${t.eventTitle}` : null,
            t.by && !t.canEdit ? ` ・ ${t.byName}さんから` : null,
            many ? ` ・ 済 ${t.doneCount}/${t.assignees.length}` : null,
          ]),
          t.note ? h("small", { class: "task-note" }, t.note) : null,
          o.showPeople && many ? h("small", { class: "task-people" }, t.assignees.map((a) => `${a.done ? "✓" : "・"}${a.name}`).join(" ")) : null)),
      o.canManage || t.canEdit ? h("button", { type: "button", class: "app-icon-btn", "aria-label": "やることを消す", onclick: async (e) => {
        if (!confirm(`「${t.title}」を消しますか?`)) return;
        if (await App.api("deleteTask", { id: t.id })) { e.target.closest("li").remove(); App.toast("消しました"); }
      } }, "×") : null);
    return li;
  };

  // やることを追加する。admin なら担当者をだれでも選べる(選ばなければ自分)
  App.taskForm = function (opt, onSaved) {
    const o = opt || {};
    App.openSheet(o.eventTitle ? `やることを追加(${o.eventTitle})` : "やることを追加", (body, close) => {
      const title = h("input", { type: "text", maxlength: "100", placeholder: "例:プロフィールのリンクを登録する" });
      const due = h("input", { type: "date" });
      const quick = h("div", { class: "app-chips" }, [["今日", 0], ["明日", 1], ["1週間後", 7], ["次の定例会まで", 14]].map(([label, n]) =>
        h("button", { type: "button", class: "app-pill", onclick: () => {
          const d = new Date(`${App.todayKey()}T12:00:00`); d.setDate(d.getDate() + n);
          due.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        } }, label)));
      const note = h("textarea", { rows: "2", maxlength: "500", placeholder: "メモ(任意)" });
      const picker = App.isAdmin() ? App.memberPicker({ multiple: true, value: [], label: "担当" }) : null;
      const all = App.isAdmin() ? h("input", { type: "checkbox" }) : null;
      body.append(h("form", { class: "app-form", onsubmit: async (e) => {
        e.preventDefault();
        if (!title.value.trim()) { App.toast("やることを入れてください"); return; }
        const assignees = all && all.checked ? App.members.map((m) => m.id) : picker ? picker.getValue() : [];
        const d = await App.api("saveTask", { item: { title: title.value.trim(), due: due.value, note: note.value, assignees, eventId: o.eventId || "" } });
        if (!d) return;
        close();
        App.toast(d.item.assignees.length > 1 ? `${d.item.assignees.length}名に届けました` : d.item.mine ? "追加しました" : `${d.item.assignees[0].name}さんに届けました`);
        if (onSaved) onSaved(d.item);
      } },
      App.field("やること", title),
      App.field("期限(任意)", h("div", null, due, quick)),
      picker ? App.field("担当(選ばなければ自分)", h("div", null, h("label", { class: "app-check" }, all, " 全員"), picker)) : null,
      App.field("メモ", note),
      h("button", { type: "submit", class: "app-btn primary wide" }, "追加する")));
    }, { noFocus: true });
  };
})();
