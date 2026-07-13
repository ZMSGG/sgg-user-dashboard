# SGG PLAYER ARCHIVE

SEVENGODS Games のプレイヤーダッシュボード用スターターです。公開LPとは役割を分け、Discord、任意ウォレット、大会履歴、保有アセット、SGGポイント、アカウント保護をまとめるログイン後の体験を想定しています。

現時点はフロントエンドのデモです。画面内のユーザー、戦績、残高、ポイントはすべて `DEMO DATA` で、実アカウント・実ウォレット・実トークンには接続しません。

## 起動

```bash
npm install
npm run dev
```

ローカルでは `http://localhost:3000` を開きます。

## 確認

```bash
npm run build
npm test
```

## スターターに含まれるもの

- 概要、大会、資産、ポイントのレスポンシブUI
- Discord・ウォレット・Passkeyの接続状態デモ
- 大会履歴、OTOMO三形態、SEVENGODS、SGG Tokenの表示例
- GAME / COMMUNITY を分けたポイント台帳
- 未接続・0件・確認中の状態
- 320pxからデスクトップまでのレイアウト
- モックデータを分離した `app/dashboard-data.ts`

## 本番連携前に必要なもの

このスターターは外部認証や資産取得を偽装しません。本番化にはDiscord OAuth、サーバーセッション、共有DB、SIWE/WalletConnect、オンチェーンindexer、ポイント台帳、大会結果API、監査ログを実装してください。設計境界は [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) にまとめています。

## 正式表記

- `SGG Token` — トークン。`SGG_GAME_POINTS`とは別。
- `SGG_GAME_POINTS` — 生結果と順位の確定後に計算するゲームポイント。
- `SPIRIT / INCARNATE / DOJI` — `精霊体 / 受肉体 / 童子`。
- `SEVENGODS` — ウォレット保有カテゴリ。

公開前に、チェーン、コントラクト、ポイント制度、Discord由来ポイントの加算方針、アカウント復旧ポリシーをオーナー承認で固定してください。
