# SGG ポイント理由コード台帳

`point_grants.reason_code` の正式な語彙。形式は `A-Z0-9_` の 3〜64 文字。
新しいコードはこの表に追記してから使用する(付与後の行は書き換えない)。
コードは「制度を混ぜない」原則に従い、raw score / ranking / 外部 reward /
SGG Token とは対応しない。

## 命名規則

`<カテゴリ>_<内容>[_<修飾>]`

- カテゴリ: `TESTER` / `EVENT` / `TOURNAMENT` / `COMMUNITY` / `LOGIN` / `ADJUST`
- 修正(取り消し・誤付与訂正)は必ず `ADJUST_` プレフィクスの負値行で行う。

## 登録済みコード

| コード | 意味 | 付与経路 | 冪等キー規約 |
|---|---|---|---|
| `TESTER_REWARD` | テスター報奨 | 管理者 | `tester:<cohort>:<discord_id>` |
| `EVENT_PARTICIPATION` | イベント参加 | 管理者/自動 | `event:<event_id>:<discord_id>` |
| `TOURNAMENT_RESULT` | 大会成績報酬 | 管理者/自動 | `tournament:<tournament_id>:<discord_id>` |
| `COMMUNITY_CONTRIBUTION` | コミュニティ貢献 | 管理者 | `community:<case_id>:<discord_id>` |
| `LOGIN_STREAK` | ログイン継続報酬 | 自動 | `login:<yyyymmdd>:<discord_id>` |
| `ADJUST_CORRECTION` | 誤付与の訂正(負値) | 管理者 | `adjust:<original_key>` |

## 運用メモ

- 冪等キーは付与内容が決まった時点で送信側が決定的に生成する
  (乱数を使わない)。再送・リトライが安全になるのはこのため。
- 一括配布(大会報酬など)は対象リストを dry-run で確認 → 承認 → 実行の
  3 段階を踏み、実行記録を `WORKLOG.md` に残す。
- コードの意味変更は禁止。意味が変わる場合は新コードを追加する。

## 追加コード（2026-07-29 オーナー指示による通貨拡張）

台帳は `currency` 列で複数通貨を扱う。既存行はすべて `SGP`。

| コード | 通貨 | 意味 | 付与経路 | 冪等キー規約 |
|---|---|---|---|---|
| `GACHA_DRAW` | MAGATAMA | 図鑑ガチャ1回の消費（負値） | プレイヤー本人 | `gacha:<discord_id>:<client_key>` |
| `EVENT_STONE` | MAGATAMA | イベント・大会参加での勾玉授与 | 管理者/自動 | `stone:<event_id>:<discord_id>` |
