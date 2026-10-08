# docs/specs — 仕様書ディレクトリ

このディレクトリの仕様書を実装の**正**とします。仕様書と実装が食い違う場合は、黙って乖離させず、どちらを直すか判断して**両方を同期**させてください。

## 現在の有効版

| 仕様書 | 対象 | 状態 |
|--------|------|------|
| [login-page-detailed-spec-v3.md](login-page-detailed-spec-v3.md) | ログインページ + 認証共通層 | 有効(下記の適用注記を参照) |

## 当リポジトリへの適用注記(重要)

`login-page-detailed-spec-v3.md` は元々 **TSAM AI プロジェクト**(GitHub Pages + GAS バックエンド構成、`gas-auth/`・既存テスト571件を持つコードベース)向けに書かれた文書です。当リポジトリ(kouryukai.matching)には該当する既存実装・テスト・GAS バックエンドが存在しないため、本仕様書は「整合作業の正」ではなく **新規実装の設計仕様** として適用しています。

適用方針:

- 画面仕様(§1〜§4、§10、§11)、API 契約の形状(§5)、リダイレクト仕様(§6)、セッション取り扱い(§7)、サーバー側判定ロジック(§8)は仕様書に準拠して実装
- GAS バックエンドは存在しないため、§8 のサーバー側判定は `auth/mock-server.js`(ブラウザ内デモ実装)として同一契約・同一判定順序で実装。実 API への差し替え点は仕様書 §5.1 の記載どおり `auth/api.js` に限定(`API_BASE_URL` を設定するとモックの代わりに text/plain POST で実 API を呼ぶ)
- 固有名の読み替え: セッション保存キーは `tsam-auth-session` → `kouryukai-auth-session`。`/pricing/` への導線は当アプリの無料登録(トップページ)へ読み替え
- 保護対象画面: 仕様書 §6 の現行 ALLOWED_NEXT は `['portal']` だが、当アプリではトップページ(アプリ本体)もログイン必須とする要件のため、§6 記載の手順(guardPage 明示指定 + リスト追加)に従い `home` / `portal` / `referral`(紹介先早見表)/ `admin`(管理者ページ)の4画面。3画面を超えたため §6 の将来拡張 1 に従い、ALLOWED_NEXT は `auth/session.js` の画面定義 `SCREENS` から導出する(任意URLを受け取らない原則は維持)。既定の遷移先は `home`
- 仕様書中の TSAM AI 固有の記述(Stripe 連携、listPlans/checkout 系 action、settings シート等)は当リポジトリでは対象外
