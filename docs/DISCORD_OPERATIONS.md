# Discord 連携 運用手順書

対象: `PRJ-202607-sgg-user-dashboard` / MY SGG — Player OS
関連: `docs/PLAYER_OS_ARCHITECTURE.md`(信頼境界), `docs/POINT_REASON_CODES.md`(理由コード)

このドキュメントは、Discord Passport・Bot DM本人確認・ギルド参加確認・自動ポイント付与を
本番運用するためにオーナー/管理者が行う手順を記録する。secret の実値は
決してこのリポジトリに書かない。

## 1. Discord Application の作成(オーナー作業)

環境ごとに別の Application を作る。redirect URI は完全一致で照合されるため、
環境の origin ごとに登録が必要。

| 環境 | Application 名の例 | Redirect URI |
|---|---|---|
| 開発 | `MY SGG (dev)` | `http://127.0.0.1:3000/api/auth/discord/callback` |
| 本番 | `MY SGG` | `https://<APP_ORIGIN>/api/auth/discord/callback` |

手順(https://discord.com/developers/applications):

1. New Application → 名称を入力。
2. OAuth2 → Redirects に上記 URI を登録。scope は `identify` のみ使用
   (コードが要求するのは identify だけ。余分な scope を付与しない)。
3. OAuth2 → Client ID を控える。高保証OAuthを有効にする場合だけClient Secretを
   発行する。一般プレイヤー向けBot DM認証にはClient Secretは不要。
4. Bot タブ → Bot を有効化し、Bot Token を発行。
   - Privileged Gateway Intents は **すべて不要**(単一メンバー取得の REST
     呼び出しのみ使用。Server Members Intent は不要)。
   - Public Bot を無効にする(自ギルド専用)。
5. Bot を SGG ギルドに招待する: OAuth2 URL Generator で scope `bot` のみ、
   Bot Permissions は **None**(メンバー読み取りに追加権限は不要)を選び、
   生成された URL をギルド管理者が開いて承認する。
6. ギルド ID を控える(Discord クライアントで開発者モードを有効化 →
   サーバー名を右クリック →「IDをコピー」)。

## 2. 環境変数の設定

Sites(本番)/ `.dev.vars`(ローカル)に設定する。未設定の機能は
fail-closed で「準備中」表示になる。

| 変数 | 種別 | 内容 |
|---|---|---|
| `DISCORD_CLIENT_ID` | 値 | OAuth Application の Client ID |
| `DISCORD_CLIENT_SECRET` | secret（任意） | 高保証OAuthを有効にする場合だけ設定するClient Secret。Bot DMには不要 |
| `SESSION_SECRET` | secret | 32byte 以上・文字多様性のある乱数 |
| `ADMIN_DISCORD_IDS` | 値 | 管理者 Discord ID のカンマ区切り |
| `APP_ORIGIN` | 値 | 正規 origin (`https://…`、path なし) |
| `DISCORD_BOT_TOKEN` | secret | ギルド参加確認用 Bot Token |
| `DISCORD_GUILD_ID` | 値 | SGG ギルドの ID |
| `DM_OTP_PEPPER` | secret | Bot DMコードとrate limit主体をHMAC化する専用乱数（32byte以上）。challengeとブラウザnonceはSHA-256 digest保存 |
| `INTEGRATION_GRANT_SECRET` | secret | 自動付与 API の共有 HMAC secret (32byte 以上) |
| `INTEGRATION_ACTOR_ID` | 値 | Bot ユーザーの Discord ID (`granted_by` に記録) |

secret 生成例: `openssl rand -base64 48`

## 3. secret ローテーション

- `DISCORD_CLIENT_SECRET` / `DISCORD_BOT_TOKEN`: Discord 側で再生成すると
  旧値は即時無効になる。無停止ローテーションは不可能なので、利用の少ない
  時間帯に「再生成 → Sites 更新」を連続して行い、`DECISIONS.md` に記録する。
  Client Secret不調時もBot DM認証を止めず、所有者へ再発行を繰り返し要求しない。
- `SESSION_SECRET`: ローテーションすると全セッションが即時無効になる
  (全ユーザー再ログイン)。インシデント対応時の一括失効手段でもある。
- `DM_OTP_PEPPER`: ローテーションすると進行中のDMコードが即時無効になる。
  `SESSION_SECRET` や Bot Token と共用しない。ローテーション後は5分以上待って
  旧challengeが失効したことを確認する。
- `INTEGRATION_GRANT_SECRET`: 送信側(ゲーム/キャンペーン基盤)と受信側を
  同時に更新する。更新中の付与失敗は冪等キーにより安全に再試行できる。

## 4. 管理者 ID の変更

`ADMIN_DISCORD_IDS` の追加・削除は 2 名の承認を得て `DECISIONS.md` に
記録してから Sites に反映する。管理操作には15分以内の高保証OAuth再認証が
必要という既存の制約を変更しないこと。Bot DMで作成した低保証セッションは、
IDがallowlistに含まれていてもロスター閲覧・ポイント付与へ昇格させない。

## 5. Bot DM本人確認（一般プレイヤー向けフォールバック）

- OAuthを標準経路として維持し、Client Secretが未設定でも、Bot Token・Guild ID・
  `DM_OTP_PEPPER`・D1が揃えば一般プレイヤーはDMコードでPassportへ接続できる。
- 入力されたユーザー名またはUser IDはSGGギルド内だけで解決する。送信前と検証時に
  メンバー在籍を再確認し、Botアカウントは拒否する。
- 応答は対象の存在・在籍・DM配送結果を区別せず、アカウント列挙を防ぐ。DM失敗時に
  公開チャンネルや別経路へコードを送らない。
- コードは最低10文字、5分、一度限り、最大5回。保存するのはHMAC digestだけで、
  ブラウザのHttpOnly・SameSite=Strict nonceへ結び付ける。ログへ生コードやIPを残さない。
- DMセッションは24時間の低保証。Player Passport・任意Wallet・本人のポイント確認には
  使用できるが、管理者APIと管理UIには使用できない。

## 6. ギルド参加確認の仕組み

- ログイン成功時に Bot Token で
  `GET /guilds/{DISCORD_GUILD_ID}/members/{discord_id}` を 1 回取得し、
  `players.guild_member / guild_joined_at / guild_roles / guild_synced_at`
  にスナップショットを保存する。取得失敗時は既存値を保持する
  (失敗を「未参加」と記録しない)。
- プレイヤーは Passport 画面の「参加状態を再確認」からも更新できる
  (`POST /api/guild/sync`、60 秒クールダウン)。
- `guild_member` が NULL の間は「未確認」。キャンペーン条件判定に使うのは
  0/1 が記録された行だけとする。

## 7. 自動ポイント付与 API (`POST /api/integration/grants`)

サーバー間専用。ブラウザ・クッキーは一切関与しない。

リクエスト:

- Header `x-sgg-timestamp`: Unix 秒。受信側で ±300 秒まで許容。
- Header `x-sgg-signature`: `v1=<hex>`。
  `hex = HMAC-SHA256(key, "SGG_INTEGRATION_GRANT_V1\n{timestamp}\n{rawBody}")`、
  key は `"SGG_INTEGRATION_GRANT_V1 " + INTEGRATION_GRANT_SECRET`。
- Body(JSON、4KB 以内): `{ discordId, amount, reasonCode, note?, idempotencyKey }`
  検証規則は管理者付与と同一(`server/grant-validation.ts`)。

運用規則:

- 冪等キーは `{campaign_id}:{discord_id}` 形式に統一する。同一キーの再送は
  `alreadyGranted: true` で成功応答になり、重複付与は構造的に起きない。
- 同一キー・異内容は 409 `IDEMPOTENCY_CONFLICT`。送信側のバグなので調査する。
- 付与対象は Discord 連携済みプレイヤーのみ(未連携は 404)。
- `granted_by` には `INTEGRATION_ACTOR_ID`(Bot ユーザー)が記録され、
  初回付与時に該当の players 行が自動登録される。管理者ロスターに
  `sgg-integration-service` として表示されるのは正常。

## 8. 定期照合(月次)

1. `SELECT SUM(amount) FROM point_grants` と各プレイヤー残高表示の一致確認。
2. `audit_events` の `POINTS_GRANT` 件数と `point_grants` 行数の突合。
3. 直近 30 日の `WALLET_UNLINK` → 別アカウント `WALLET_LINK` の移動履歴を
   確認し、キャンペーン抽選の除外リストに反映する。

## 9. 本番反映前チェック

- [ ] 2 つのテスト用 Discord アカウントで相互にデータが見えないこと(identity 分離)
- [ ] 管理者アカウントでのみ付与 UI が表示され、15 分再認証が要求されること
- [ ] DMログインしたallowlist対象IDでも管理ロスターとポイント付与が403になること
- [ ] DMコードが5分・1回・5回失敗で失効し、別ブラウザでは検証できないこと
- [ ] 不在・未参加・DM拒否のstart応答が同一で、ログに生コードとIPが残らないこと
- [ ] ギルド未参加アカウントが「未参加」、参加アカウントが「参加済み」になること
- [ ] Bot Token を外した状態でコミュニティ欄が「準備中」に戻ること(fail-closed)
- [ ] `x-sgg-signature` 不正・timestamp 期限切れの付与リクエストが 401 になること
- [ ] 同一冪等キーの再送が二重付与にならないこと
