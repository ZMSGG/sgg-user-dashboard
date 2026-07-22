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

## 用途別character usageとImage 2.0証跡

各assetは用途に応じて `NONE / GODS / OTOMO / BOTH` を選びます。環境・system visualへ装飾目的のキャラクターを強制しません。production画像はImage 2.0生成元、prompt、権利、承認、最終hashを記録します。

今回のrelease setは `character_family: NONE` です。v002 key visual／social cardとv003 iconの制作・承認記録は `rights/RIGHTS-AND-IMAGE2-APPROVAL-20260722-001.json` および `rights/RIGHTS-AND-IMAGE2-APPROVAL-20260722-002.json`、現行正本は `standards/SGG_CREATIVE_CHARACTER_USAGE_V2.md` です。

## Folder policy

- `source/`: 正式な参照素材。原本を編集・上書きしない。
- `candidates/`: 制作中の候補。外部公開しない。
- `approved/`: 人間が用途とhashを確認した書き出しだけを置く。

## 承認手順

1. `MEDIA-<slug>-<role>-v001` のasset IDを付ける。
2. `ASSET_MANIFEST.csv` に用途、寸法、版、出典、権利範囲、alt text、SHA-256を記録する。
3. 円形crop、32px・64px、mobile、文字の正確性を確認する。
4. character usage、Image 2.0制作証跡、権利、実表示を確認し、character採用時だけcanon、reference、OTOMO形態を追加確認する。
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
