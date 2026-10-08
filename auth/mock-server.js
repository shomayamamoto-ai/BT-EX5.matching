// ============================================
// auth/mock-server.js — サーバー層のブラウザ内デモ
// 仕様: docs/specs/login-page-detailed-spec-v3.md §5, §8
//
// 判定の本体は auth/server-core.js(共有サーバーと同じコード)。
// ここではデータの保存先を localStorage にして、ブラウザ内で動かす。
// データはこのブラウザの中だけに保存されるため、別の端末・別のブラウザとは
// 共有されない。共有するには gas/ の共有サーバーを用意し、
// auth/api.js の API_BASE_URL を設定する(このファイルは使われなくなる)。
// ============================================

const AuthMockServer = (function () {
  "use strict";

  const DB_KEY = "kouryukai-auth-db";

  let channel = null;
  try {
    channel = new BroadcastChannel("kouryukai-sync");
  } catch {
    channel = null;
  }

  const server = BtexServerCore.createServer({
    load() {
      try {
        return JSON.parse(localStorage.getItem(DB_KEY) || "null");
      } catch {
        return null;
      }
    },
    save(db) {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      // 別タブへ即時通知(storage イベントの補完)
      if (channel) {
        try { channel.postMessage("db-updated"); } catch { /* noop */ }
      }
    },
    randomBytes(n) {
      return Array.from(crypto.getRandomValues(new Uint8Array(n)));
    },
  });

  async function handle(body) {
    return server.handle(body);
  }

  return { handle, ERRORS: BtexServerCore.ERRORS };
})();
