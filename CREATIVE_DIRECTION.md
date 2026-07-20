# Creative Direction: MY SGG — Player OS

## Character lock

- Family: `OTOMO`
- OTOMO: `taimaru` (`DOJI`)
- Canon reference: `SGG createve/canon/characters.json`
- Creative rights: `PENDING`

## Tone

- 神話的
- プレイヤー中心
- 高密度だが明快
- truthful
- mobile first

## Must include

- 最終cropでも識別できる正規OTOMO visualとform metadata
- 公開情報と個人情報の明確な境界
- LIVE、SNAPSHOT、DEMO、PREPARING、UNKNOWNの明示
- 大会または保有情報が無い場合の正直なempty state
- keyboard、focus、contrast、mobile safe area対応

## Must avoid

- generic dashboardの量産
- 未承認creativeの公開
- 未接続値を0として表示すること
- Wallet必須化または署名を送金承認と誤認させること
- 未確定Token、報酬、release日程、保有assetの追加

## Per-output production record

Every output must record:

- `character_family`
- canonical `god_ids` and/or `otomo_ids`
- `character_reference`
- OTOMO `form` when applicable
- source asset ID, source SHA-256, rights record, and rights scope
- final-crop, 32px, 64px, mobile, and major-scene visual checks as applicable
- reviewer, timezone-aware review time, final version, and final SHA-256

The character must remain recognizable in the real display and final crop. A set cannot compensate for a character-free individual output. `PENDING` rights allow planning only, not public derivative generation or approval.
