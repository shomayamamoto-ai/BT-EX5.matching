// ============================================
// auth/profile-transfer.js — この端末だけに保存されたプロフィールを運び出す
//
// お試し版では、自分の情報の編集はその端末のブラウザの中(localStorage の kouryukai-auth-db)にだけ
// 保存される。ほかの端末からは読めないため、本人が「運営に送る」で文字(コード)にして送り、
// 運営が「取り込む」で戻す。共有サーバーに切り替えたあとは、ログインしたときに
// この端末に残っている内容を見つけて、送るかどうかを一度だけ聞く。
// ============================================

const ProfileTransfer = (function () {
  "use strict";

  const DB_KEY = "kouryukai-auth-db";
  const PREFIX = "BTEX5-PROFILE:";

  // この端末のお試し版のデータから、本人が編集したプロフィールを取り出す(なければ null)
  function localProfile(memberId) {
    try {
      const db = JSON.parse(localStorage.getItem(DB_KEY) || "null");
      const m = db && (db.referralMembers || []).find((x) => x.id === memberId);
      if (!m || m.editedBy !== "self" || !m.editedAt) return null;
      return m;
    } catch {
      return null;
    }
  }

  function pick(m) {
    const out = { id: m.id, name: m.name, editedAt: m.editedAt || 0 };
    BtexServerCore.SELF_EDITABLE.forEach((k) => { if (k in m) out[k] = m[k]; });
    return out;
  }

  function encode(m) {
    const json = JSON.stringify(pick(m));
    return PREFIX + btoa(unescape(encodeURIComponent(json)));
  }

  // 貼り付けた文章からコードをすべて取り出す
  function decodeAll(text) {
    const out = [];
    const re = new RegExp(PREFIX.replace(/[-]/g, "\\-") + "([A-Za-z0-9+/=]+)", "g");
    let m;
    while ((m = re.exec(String(text || "")))) {
      try { out.push(JSON.parse(decodeURIComponent(escape(atob(m[1]))))); } catch { /* 壊れたコードは飛ばす */ }
    }
    return out;
  }

  // 運営に送る文(人が読める内容 + 取り込み用のコード)
  function message(m) {
    return [
      `【BT-EX5 プロフィールの送付】${m.name}`,
      "お試し版で、この端末に入力したプロフィールです。運営の方は、会員アプリの管理者メニュー →「プロフィールを取り込む」に、この文をそのまま貼り付けてください。",
      "",
      m.business ? `事業内容:${String(m.business).slice(0, 80)}${String(m.business).length > 80 ? "…" : ""}` : "",
      m.wants ? `求める紹介:${String(m.wants).slice(0, 60)}${String(m.wants).length > 60 ? "…" : ""}` : "",
      "",
      encode(m),
    ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  }

  // 共有サーバーでログインしたとき: この端末に残っている、サーバーより新しい自分のプロフィールを送るか聞く(一度だけ)
  async function offerUpload(session, serverMember) {
    if (!AuthApi.isShared() || !session || !session.memberId) return;
    const flag = `btex5-local-profile-done-${session.memberId}`;
    try { if (localStorage.getItem(flag)) return; } catch { return; }
    const local = localProfile(session.memberId);
    if (!local || (serverMember && (serverMember.editedAt || 0) >= local.editedAt)) { try { localStorage.setItem(flag, "1"); } catch { /* noop */ } return; }
    const ok = confirm("お試し版のときに、この端末で入力したプロフィールが残っています。みんなが見られる共有サーバーに送りますか?(送ると、いまの内容が置き換わります)");
    try { localStorage.setItem(flag, "1"); } catch { /* noop */ }
    if (!ok) return;
    const profile = {};
    BtexServerCore.SELF_EDITABLE.forEach((k) => { if (k in local) profile[k] = local[k]; });
    const res = await AuthApi.updateMyProfile(AuthSession.getToken(), profile);
    alert(res.success ? "送りました。ほかのメンバーにも表示されます。" : res.error.userMessage);
  }

  return { localProfile, encode, decodeAll, message, offerUpload, PREFIX };
})();
