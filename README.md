# MY SGG — Player OS

SEVENGODS Gamesの公開ゲーム、公開ランキング、キャラクター図鑑、公式アップデート、将来のプレイヤーデータ統合を一つの操作面へまとめるユーザーダッシュボードです。

## 現在実装しているもの

- `PLAY`: 公開確認済み4タイトルと開発中1タイトルの正本連動カタログ
- `ARENA`: Oracle / Questのpublic APIをserver-sideで正規化したライブ番付、Farmの公開番付導線
- `COLLECTION`: 7 GODS × 7 OTOMO × 3形態の正規カタログと資産ソース境界
- `MY SGG`: Discord identity、任意Wallet、記録・ポイント・報酬・Tokenを混ぜないPlayer Passport
- `COMMUNITY`: publish ledgerで公開確認できた公式X投稿、準備中channel、公開イベントの安全な空状態
- `TODAY`: 公開中ゲームの次アクション、検索、通知、deep link、端末内のフォロー設定

## データの扱い

画面は存在しない大会、参加人数、資産、残高、ポイント、イベントを生成しません。

- 公開状態はSGG migration audit、project state、4タイトルの実URL healthを分けて扱う
- 公開ランキングは `/api/live` がOracleの現在日とQuest seasonをschema検証し、内部IDを除去して正規化
- 個人データは共通identity bridge未接続のため「未接続」と表示
- ゲーム資源、raw score、ranking、`SGG_GAME_POINTS`、reward、SDT、`SGG Token`を別制度として表示
- 端末内に保存するのは通知既読、開発通知、フォローchannelなどのdevice preferenceだけ

Quest / Farmの既存 `/api/me` は参照時にゲームstateを更新するため、Dashboardからpollしません。本番の個人データ統合には、各ゲームへside-effect-freeな署名済み `GET /api/integration/v1/player-snapshot` を追加します。詳細は `docs/PLAYER_OS_ARCHITECTURE.md` を参照してください。

## ローカル確認

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run lint
```

## 主要な状態

- `PUBLIC`: 公開URLまたはpublic APIが確認できる情報
- `AUTH_REQUIRED`: ゲーム側のDiscord sessionが必要な個人情報
- `UNAVAILABLE`: 公開・統合条件が未成立
- `PLANNED`: 仕様・値・日程を確定表示しない構想

サイトはprivate previewとして運用し、検索indexを拒否します。
