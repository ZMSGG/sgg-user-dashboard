# Assets: MY SGG — Player OS

Project ID: `PRJ-202607-sgg-user-dashboard`

## 最低セット

| Role | Starting size | 主な用途 |
|---|---:|---|
| Square icon／avatar | 512×512以上 | profile、一覧、favicon元画像 |
| Key visual | 16:9前後 | 表紙、説明、presentation |
| Social／OG card | 1200×630 | OGP、X、共有カード |

初期状態では、SGG公式サイト由来の3素材を `source/` に入れています。これらは参照用であり、この案件の公開承認済み素材ではありません。

公開gateで必要なのは、案件固有に確認された同じ3 roleです。要件は `ASSET_REQUIREMENTS.csv`、実ファイルと承認状態は `ASSET_MANIFEST.csv` を正本とします。

## GODS／OTOMOの必須挿入

各SGG visual creativeは、正規かつ当該用途で使用可能なGODSを1柱以上、OTOMOを1体以上、または両方を、最終cropと実表示で視認できる形で含めます。ロゴ、名称、metadata、極小・見切れ・隠れた配置だけでは条件を満たしません。

各assetの制作記録へ `character_family`、`god_ids`、`otomo_ids`、`otomo_forms`、`character_reference`、`character_presence_confirmed: true`、`character_checked_by`、timezone付き `character_checked_at`、最終hash／versionを残します。private原画の直貼りをせず、未達素材を `approved/` へ置きません。正本は `COMMAND_CENTER_LINK.json` で解決した司令塔rootの `standards/SGG_CREATIVE_CHARACTER_INCLUSION_V1.md` です。

## Folder policy

- `source/`: 正式な参照素材。原本を編集・上書きしない。
- `candidates/`: 制作中の候補。外部公開しない。
- `approved/`: 人間が用途とhashを確認した書き出しだけを置く。

## 承認手順

1. `MEDIA-<slug>-<role>-v001` のasset IDを付ける。
2. `ASSET_MANIFEST.csv` に用途、寸法、版、出典、権利範囲、alt text、SHA-256を記録する。
3. 円形crop、32px・64px、mobile、文字の正確性を確認する。
4. GODS／OTOMOの視認性、canon、権利、reference、OTOMO形態を確認する。
5. Approverが用途と対象hashを確認する。
6. status、approver、approved_atを更新し、`approved/` へ置く。

承認済み素材を変更するときは上書きせず `v002` を作ります。ファイル名の `final` や口頭確認は承認の代わりにしません。

作業中の検証:

```bash
python3 launches/tools/validate_pack.py /path/to/PRJ-YYYYMM-slug
```

公開前の検証:

```bash
python3 launches/tools/validate_pack.py /path/to/PRJ-YYYYMM-slug --release
```
