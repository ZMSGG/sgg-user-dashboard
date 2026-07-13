# SGG Dashboard Architecture v0.1

Status: `STARTER / NOT PRODUCTION`

## 1. LPとダッシュボード

公開LPとダッシュボードは分離する。LPは検索・世界観・参加導線、ダッシュボードは認証済みユーザーの個人情報と操作を担当する。最初は同じリポジトリでもよいが、route、cookie、performance budget、access policyを混ぜない。

推奨URL例:

- `sevengodsgames.com` — 公開LP
- `app.sevengodsgames.com` または `/dashboard` — プレイヤーダッシュボード

## 2. 本人確認と復旧

現行SGG Foundationに従い、正式プレイの本人軸はDiscord user IDとする。表示名やアバターを本人キーにしない。内部では不変の `player_accounts.id` を持ち、現行Discord ID、過去の監査対象identity、任意wallet linkを明示的に関連付ける。

Discordを失った場合の自動復旧は現行規範に定義されていない。本番では次を新しい承認済みポリシーとして追加する。

1. Discord OAuth + PKCEで通常ログインする。
2. ログイン後にPasskeyとワンタイム復旧コードを登録できる。
3. Wallet署名は補助証明にできるが、単独でDiscordを自動差し替えない。
4. Discord差し替えは再認証、待機期間、全経路への通知、既存session失効、append-only監査を必須にする。
5. 既に別playerへ紐付くDiscord / walletを自動mergeしない。

## 3. データ境界

```text
PlayerAccount
  ├─ DiscordIdentityLink (active + audit history)
  ├─ WalletLink (optional, 1:1, ownership verified)
  ├─ PasskeyCredential / RecoveryCode
  ├─ TournamentParticipation → FinalizedGameResult → RankingEntry
  ├─ HoldingSnapshot (immutable after finalization)
  ├─ PointCalculation → PointLedgerEntry (append-only)
  └─ AuditEvent
```

### 必ず分ける値

- `RAW_GAMEPLAY_SCORE` — ゲームルールだけで決まる生結果。
- 順位 — 生結果だけで確定。
- `SGG_GAME_POINTS` — 結果確定後の別計算・別台帳。
- Community points — Discord活動由来。加算方針が承認されるまで別bucket。
- `SGG Token` — オンチェーン資産。ポイントではない。
- Reward candidate — ポイントやToken残高から暗黙に作らない。

## 4. 推奨テーブル

- `player_accounts`
- `discord_identity_links`
- `sessions`
- `passkey_credentials`
- `recovery_codes`
- `wallet_links`
- `tournaments`
- `tournament_participations`
- `game_results`
- `ranking_entries`
- `holding_snapshots`
- `asset_balance_cache`
- `point_calculations`
- `point_ledger_entries`
- `community_point_ledger_entries`
- `audit_events`

## 5. サーバー境界

- 公式writeのuserはserver sessionから解決する。body/queryのuser IDを信頼しない。
- Discord OAuthはAuthorization Code + PKCE S256、使い捨てstate、session rotationを使う。
- WalletはDiscord login後にserver発行nonceを署名し、domain、URI、chain、expiry、user binding、replayをserverで検証する。
- wallet addressは画面ではmaskし、Discordとの対応を不要なlog / analyticsへ出さない。
- 大会結果、順位、ポイントはclient申告値を採用しない。
- 公式記録、OAuth state、nonce、idempotency、rate limitは共有永続storeへ保存する。
- productionでsecret、chain、contract、providerが不足した場合はmockへfallbackせずfail-closedにする。

## 6. MVPの実装順

1. Discord OAuth、server session、共有DB、監査ログ
2. player profileと大会結果read model
3. 任意Wallet link + SIWE、live asset balance
4. finalized holding snapshotとSGG_GAME_POINTS台帳
5. Passkey、復旧コード、承認済みDiscord移行フロー
6. Discord由来Community pointsの独立台帳と統合表示方針

## 7. このスターターの状態

- UI/レスポンシブ: 実装済み
- デモinteraction: 実装済み
- Discord OAuth: 未接続
- WalletConnect / SIWE: 未接続
- DB / D1: 未接続
- 大会結果API: 未接続
- on-chain indexer: 未接続
- points ledger backend: 未接続
- account recovery policy: 要承認
