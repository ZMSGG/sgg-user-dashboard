# Approved assets

人間が用途、権利、表示、対象hashを確認した素材だけを置きます。

承認前は空のままが正常です。承認後は `ASSET_MANIFEST.csv` のstatus、approver、approved_at、SHA-256を更新してください。

`production/` は、2026-08-19の公開指示で承認された現行runtime画像のexact binary mirrorです。公開treeとの対応は `../PRODUCTION_IMAGE_INDEX.csv` を正本とし、差分が出た場合は承認を引き継がず新versionとして再記録します。
