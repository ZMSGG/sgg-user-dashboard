# MY SGG — Player OS

Status: `REVIEW`

Project ID: `PRJ-202607-sgg-user-dashboard`

Owner: `SGG product owner`
Approver: `SGG creative and release approver`

SEVENGODS Gamesの公開ゲーム、公開ランキング、キャラクター図鑑、公式アップデート、将来のプレイヤーデータ統合を一つの操作面へまとめるユーザーダッシュボードです。

## 現在実装しているもの

- `PLAY`: プレイ可能3タイトル、公開レビュー待ち1タイトル、仕様開発中1タイトルを正本状態と分離したカタログ
- `ARENA`: Oracle / Questのpublic APIをserver-sideで正規化したライブ番付、Farmの公開番付導線
- `COLLECTION`: 7 GODS × 7 OTOMO × 3形態の正規カタログと資産ソース境界
- `MY SGG`: Discord OAuth(必須identity)、任意WalletのEVM署名連携、SGGポイント台帳を備えたPlayer Passport。ポイント付与は管理者のみ・append-only・冪等キー付き
- `COMMUNITY`: publish ledgerで公開確認できた公式X投稿、準備中channel、公開イベントの安全な空状態
- `TODAY`: 公開中ゲームの次アクション、検索、通知、deep link、端末内のフォロー設定

## データの扱い

画面は存在しない大会、参加人数、資産、残高、ポイント、イベントを生成しません。

- 公開状態はSGG migration audit、project state、4タイトルの実URL healthを分けて扱う
- 公開ランキングは `/api/live` がOracleの現在日とQuest seasonをschema検証し、内部IDを除去して正規化
- `/api/live` は45秒の共有snapshot、single-flight、手動再同期の15秒cooldownで上流ゲームへの負荷を抑制。応答は `servedFrom` / `cacheAgeSeconds` で取得経路を明示
- 画面は可視タブのみ90秒間隔で自動再同期し、再同期失敗時は前回の確認済みデータを保持して失敗を通知
- Player PassportはDiscord OAuthとD1-backed revocable sessionで本人を解決し、browserからのID自己申告を受け付けない。game bridge未接続の個人データは引き続き「未接続」と表示
- Wallet署名challengeはaddress・session・originへ束縛し、D1で一度だけconsume。SGGポイントはappend-only台帳と監査recordを同一batchで記録し、冪等keyの異内容再利用を拒否
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
npm run db:check
```

`.dev.vars.example` を `.dev.vars` へコピーし、32 bytes以上の十分にランダムな `SESSION_SECRET` とDiscord OAuth設定を入力します。本番値はSitesのruntime environmentで管理し、repositoryや`.openai/hosting.json`へ保存しません。D1 migrationは`drizzle/`へ保存され、配備はSitesのsource/version workflowだけを使用します。

## 主要な状態

- `PUBLIC`: 公開URLまたはpublic APIが確認できる情報
- `AUTH_REQUIRED`: ゲーム側のDiscord sessionが必要な個人情報
- `UNAVAILABLE`: 公開・統合条件が未成立
- `PLANNED`: 仕様・値・日程を確定表示しない構想

サイトはowner-only private deploymentとして運用し、検索indexを拒否します。公開、custom domain、creative承認は別gateです。
