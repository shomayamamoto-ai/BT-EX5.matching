// ============================================
// auth/guard-home.js — トップページ(アプリ本体)のガード
// 仕様: docs/specs/login-page-detailed-spec-v3.md §6
// 未ログインなら ?next=home 付きでログインページへ遷移し、
// 検証が通るまで本文を表示しない(html.guard-pending)。
// ============================================

(async function () {
  "use strict";

  const data = await AuthSession.guardPage({ next: "home", loginPath: "login/" });
  if (!data) return; // リダイレクト済み

  document.documentElement.classList.remove("guard-pending");

  // ヘッダーにログイン中ユーザーを表示(textContent のみ使用 §11)
  const label = document.getElementById("loggedInUser");
  if (label) label.textContent = data.user.email;

  // 管理者だけ名簿の管理への導線を出す(権限の判定はサーバー側で行う)
  const adminLink = document.getElementById("drawerAdmin");
  if (adminLink) adminLink.hidden = !data.user.isAdmin;
})();
