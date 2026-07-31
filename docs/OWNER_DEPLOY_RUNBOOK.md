# オーナー自前デプロイ・ランブック（Codex/Sites 非依存経路）

Sites が使えなくなった時、このダッシュボードをオーナーの Cloudflare アカウントで
運用するための完全な手順。前提事実は `docs/DEPLOY_HANDOVER_FACTS.md`。

検証済み: wrangler dry-run（bundle 2.1MB/gzip 401KB・assets 115・DB/ASSETS binding解決）、
export→import 往復（実データで件数一致）。

## 0. 前提

- この Mac の wrangler はオーナーの account (`8b32932…`) にログイン済み
- 設定は `wrangler.owner.jsonc`（`workers_dev: false` を維持=公開URLを持たない）

## 1. データの持ち出し（Sitesが生きているうちに）

1. 管理者として本番にログイン（OAuth・15分以内の高保証）
2. `GET /api/admin/export` を保存 → `my-sgg-export.json`
   （players / point_grants / gacha_pulls / game_account_links / audit_events。
    セッション類は含めない=移行後は全員再ログイン）

## 2. 新D1の作成と適用

```bash
# 実行済み 2026-07-30: database_id d64ba138-578d-4c4b-b16d-5150de56d992（APAC）
# npx wrangler d1 create my-sgg-player-os
# マイグレーションは 0000〜0006 を順に。新規追加時はここも伸ばすこと。
for f in drizzle/000*.sql; do
  npx wrangler d1 execute my-sgg-player-os --remote --config wrangler.owner.jsonc --file="$f"
done
node scripts/import-export.mjs my-sgg-export.json > import.sql
npx wrangler d1 execute my-sgg-player-os --remote --file=import.sql
```

## 3. シークレット設定（値はオーナーのパスワードマネージャから）

```bash
for name in SESSION_SECRET DISCORD_CLIENT_ID DISCORD_CLIENT_SECRET ADMIN_DISCORD_IDS \
            DISCORD_BOT_TOKEN DISCORD_GUILD_ID DM_OTP_PEPPER \
            INTEGRATION_GRANT_SECRET INTEGRATION_ACTOR_ID APP_ORIGIN; do
  npx wrangler secret put "$name" --config wrangler.owner.jsonc
done
```

注意: `APP_ORIGIN` は新ドメイン（例 `https://my.sevengodsgames.com`）。
`SESSION_SECRET` を同じ値にしても、セッション行はD1側に無いので全員再ログインになる。

## 4. デプロイ

```bash
npm run build
npx wrangler deploy --config wrangler.owner.jsonc
```

`workers_dev: false` のため、この時点では**どこからも到達できない**（意図どおり）。

## 5. 到達経路 = カスタムドメイン + Cloudflare Access

公開ゲート（BLK-PUBLICATION-001）を守るため、素の公開はしない。

1. Cloudflare Zero Trust → Access → Application を作成
   - ドメイン: `my.sevengodsgames.com`（DNSはオーナーのCloudflare管理下と確認済み）
   - ポリシー: オーナーのメール（＋後日コアメンバー）のみ許可
2. Workers → Custom Domains で `my.sevengodsgames.com` を Worker に接続
3. Discord Developer Portal で新 redirect URI を追加:
   `https://my.sevengodsgames.com/api/auth/discord/callback`

## 6. 切替の確認

- `/` がAccess越しに表示される / 許可外メールで拒否される
- 未ログインで `/api/passport` `/api/gacha` `/api/admin/export` が401
- Discord OAuthでログイン → SGP・勾玉残高が移行前と一致
- 旧Sites側は当面凍結（削除しない）。ロールバック先として保持

## 7. この経路の権限記録

実行前に rights/ へ新しい権限記録を1枚（新Worker運用の承認、Access対象者、
ドメイン使用）。DECISIONS.md の「Sitesを唯一の本番とする」決定はこのランブックの
実行をもって改定される。
