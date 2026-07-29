# SGG User Dashboard — デプロイ経路引き継ぎ調査

調査日: 2026-07-28  
対象: `sgg-user-dashboard` / Sites Version 13  
調査方法: Sitesの読み取りAPI、Cloudflare Wranglerの読み取りコマンド、ローカル設定、Cloudflare公式資料  
変更: なし。Sites、Cloudflare、Worker、D1、環境変数、アクセス設定、ドメインには何も書き込んでいない。

## 結論

- Cloudflareは、Wranglerから既存Workerへdeployし、既存D1をbindingし、D1をSQLへexportする公式手段を提供している。
- ただし、現在のSites本番Workerは、このMacでWranglerにログイン済みのCloudflare accountには存在しない。
- Sites本番D1の物理`database_id`は、Sites API、保存Version、`.openai/hosting.json`、build成果物のいずれにも露出しておらず不明。
- したがって、現時点で「同じ本番Workerと同じ本番D1へ、Sitesを通さず直接deployできる」とは判断できない。現在の認証とrepo設定のままでは実行不能。
- owner側Cloudflare accountには`sgg-player-os`というD1が存在するが、現行production schemaと一致せず、Sites本番D1と同一だと確認できない。productionの移行元として扱ってはいけない。

## 1. 本番D1とCloudflare account

### 確認できた事実

| 項目 | 結果 | 根拠 |
|---|---|---|
| Sites本番Worker側 account ID | `7979fbd212715c4874b937da9cb25d4f` | production Worker log metadataの`account` |
| このMacでWranglerにログイン済みの account ID | `8b32932649804bcee9bbcd58c7ddd1a0` | `wrangler whoami` |
| 2つのaccount ID | 不一致 | 上記の直接比較 |
| owner側accountから本番Workerを参照 | 不可 | `wrangler deployments list --name axie-b-ac--sgg-player-archive --json`がCloudflare code `10007`、「このaccountにWorkerは存在しない」と返した |
| 本番D1 logical binding | `DB` | `.openai/hosting.json` |
| 本番D1 database ID | **不明** | Sitesとrepoの読み取り情報に物理IDなし |
| 本番D1がowner側accountに存在するか | **不明** | physical IDを照合できない。Worker accountはowner側accountと不一致 |
| 本番D1がCloudflare Dashboardから見えるか | **不明** | Dashboard画面は直接確認していない。本番D1のphysical IDとowner権限も未確認 |

### owner側accountに存在するD1候補

読み取り専用の`wrangler d1 list/info/execute`で、次のD1は確認できた。

| 項目 | 値 |
|---|---|
| account ID | `8b32932649804bcee9bbcd58c7ddd1a0` |
| database name | `sgg-player-os` |
| database ID | `d49f95b5-3f70-4f43-9673-9a1eb0ae1e02` |
| created at | `2026-07-17T03:32:54.353Z` |
| region | `APAC` |
| 確認できたapp table | `players`, `point_grants`, `audit_events` |

この候補には、現行migration 0001〜0004で追加されるsession、wallet、guild、DM challenge、game account link等のtableが確認できない。さらにSites本番Workerのaccount IDとも一致しない。したがって、これは「owner側accountにあるD1候補」までが確定事実であり、Sites本番D1ではないとも同一であるとも断定しない。

ローカルbuildの`database_id = 00000000-0000-4000-8000-000000000000`は、`vite.config.ts`で明示されたlocal placeholderであり、本番IDではない。

## 2. 本番Worker名とSites URL

| 項目 | 値 | 根拠 |
|---|---|---|
| production Worker名 | `axie-b-ac--sgg-player-archive` | Worker logsの`scriptName`、deploymentの`provider_deployment_id` |
| Sites production URL | `https://sgg-player-archive.axie-b-ac.chatgpt.site` | Sites project / Version 13 deployment |
| Sites project ID | `appgprj_6a54d2460e7c8191a92c00900d810ab1` | `.openai/hosting.json` |
| live Version | 13 | Sites project metadata |
| production source commit | `7e725f499cd47313b5bb1776b304873a99f71514` | Sites Version 13 provenance |

## 3. Sites runtime environment

Sites environment revision: `2`  
更新時刻: `2026-07-22T13:16:44.348145Z`

値は取得・表示・記録していない。以下は名前、secret区分、設定状態だけである。

| 変数名 | 区分 | 状態 |
|---|---|---|
| `ADMIN_DISCORD_IDS` | non-secret | 設定済み |
| `APP_ORIGIN` | non-secret | 設定済み |
| `DISCORD_BOT_TOKEN` | secret | 設定済み |
| `DISCORD_CLIENT_ID` | non-secret | 設定済み |
| `DISCORD_GUILD_ID` | non-secret | 設定済み |
| `DM_OTP_PEPPER` | secret | 設定済み |
| `INTEGRATION_ACTOR_ID` | non-secret | 設定済み |
| `INTEGRATION_GRANT_SECRET` | secret | 設定済み |
| `SESSION_SECRET` | secret | 設定済み |

コードまたは運用記録で参照されるが、Sites environment entriesに存在しない名前:

| 変数名 | 状態 |
|---|---|
| `DISCORD_CLIENT_SECRET` | 未設定 |
| `OTOMO_CHAIN_EXPORT_URL` | 未設定 |
| `OTOMO_CHAIN_ADMIN_SECRET` | 未設定 |

`DB`は環境変数ではなくD1 bindingである。

## 4. Sites以外から同じWorkerとD1へdeployできるか

### Cloudflareの一般的な公式手段

Cloudflareは次を公式に提供している。

- `wrangler deploy --name <WORKER_NAME>`またはWrangler設定の`name`で、認証先account内のWorkerへdeployする。
- D1はWrangler設定に`binding`、`database_name`、`database_id`を指定してWorkerへbindingする。
- Dashboard側のnon-secret変数を維持する必要がある場合は`keep_vars = true`または`--keep-vars`を使う。通常deployはDashboard側のnon-secret変数を上書きし得る。secretは通常deployでは削除されない。
- Worker書き込み権限とD1権限が必要。

公式資料:

- [Wrangler Workers commands — deploy](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy)
- [Wrangler configuration — D1 databases / keep_vars](https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases)
- [Cloudflare D1 getting started — bind a Worker](https://developers.cloudflare.com/d1/get-started/#3-bind-your-worker-to-your-d1-database)

### このprojectでの判断

現状のrepoには次がない。

- production Worker accountを指定するowner権限
- production D1のreal `database_id`
- `wrangler.toml`、`wrangler.json`、`wrangler.jsonc`
- direct production deploy script
- production Worker、D1、runtime環境変数を同時に再現するWrangler設定

現在のWrangler accountからproduction Workerを読むこともできない。そのため、一般的な公式機能は存在しても、**同じSites本番Workerと同じSites本番D1へ直接deployするproject固有の経路は、現時点では用意されていない／確認できない**。

新しいowner管理Workerと新しいowner管理D1へ移すこと自体はCloudflareの一般機能で構成できる。ただし、それは「同じWorker/D1へのdeploy」ではなく、新しいresourceへのmigrationである。production D1のexportまたは移管が得られるまで、データを保った移行可否は確定しない。

## 5. D1のexport手段

Cloudflareはremote D1をSQLへexportする公式手段を提供している。

```sh
npx wrangler d1 export <DATABASE_NAME> --remote --output=./database.sql
```

schemaのみは`--no-data`、dataのみは`--no-schema`、単一tableは`--table`を使える。

主な公式制約:

- virtual tableを含むdatabaseはexport非対応
- export中は他のdatabase requestをblockする
- 数値はJavaScriptの52-bit精度の影響を受ける
- source D1があるaccountへの認証権限が必要

公式資料:

- [Cloudflare D1 — Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/#export-an-existing-d1-database)
- [Cloudflare API — Export D1 Database as SQL](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/)

### Sites本番D1に対する現状

公式export機能はあるが、Sites本番D1については次が欠けている。

- physical `database_id`
- source database name
- production Worker側 account `7979fbd212715c4874b937da9cb25d4f`へのowner認証
- SitesからD1 exportを取得する専用APIまたはUIの確認

したがって、**現在のowner credentialからSites本番D1を直接exportする手段は確認できない**。owner側accountの`sgg-player-os`はexport可能だが、productionと確認できないため代替export元にはできない。

## 引き継ぎ判断

| 選択肢 | 現在の可否 |
|---|---|
| Sitesの同じWorker/D1をWranglerで直接管理 | 不明。現在のowner accountからWorkerを参照できず、production D1 IDも不明 |
| owner accountへ新しいWorkerをdeploy | Cloudflareの一般機能として可能。ただし現在のproduction URL・access gate・Sites管理とは別resourceになる |
| owner accountへ新しいD1を作成してschemaを再現 | Cloudflareの一般機能として可能。production dataの移行元が未確定 |
| Sites本番D1をSQL export | Cloudflareには公式機能あり。ただしsource account権限とdatabase識別子がないため、現状は実行不能 |
| owner側D1候補をproductionとして継続利用 | 不可。production同一性が未確認でschemaも現行と一致しない |

次に必要なのは、Sites/OpenAI側から本番D1の`database_id`とexportまたはresource移管方法を取得できるかの確認である。それが得られない限り、データを保持した直接handoverは「不明」のままになる。
