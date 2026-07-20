# Launch Checklist: MY SGG — Player OS

Project ID: `PRJ-202607-sgg-user-dashboard`

## Kickoff gate

- [ ] `PROJECT_BRIEF.md` の目的、対象、最初の完成形、scope、成功条件に `TBD` がない。
- [ ] OwnerとApproverが別途確認されている。
- [ ] 正本の場所、版、取得日、hashが `references/README.md` にある。
- [ ] 正式名称、数値、URL、CTAが `CANON_AND_COPY.md` と一致する。
- [ ] 外部公開や本番操作をこのフォルダ作成だけで承認済みと扱っていない。

## Asset gate

- [ ] 案件固有の正方形アイコン、横長キービジュアル、1200×630のsocial／OG画像が揃っている。
- [ ] 各SGG visual creativeに、正規かつ用途承認済みのGODSまたはOTOMO、あるいは両方が最低1体、最終cropでも視認できる。ロゴ、名称、metadata、極小・見切れ・隠れた配置だけでは代替していない。
- [ ] 各素材のcharacter family、名称／ID、正規reference、OTOMO形態、`character_presence_confirmed: true`、確認者、確認日時、最終hash／versionが制作記録にある。
- [ ] source、candidates、approvedが分離されている。
- [ ] 各素材にasset ID、version、用途、寸法、status、出典、権利範囲、hash、alt textがある。
- [ ] 円形crop、32px・64px表示、mobile表示で主要要素を確認した。
- [ ] 画像内の名称・文字列を正式表記と照合した。
- [ ] private原画、個人データ、秘密情報が含まれていない。
- [ ] 人間承認前の素材を `approved/` に置いていない。
- [ ] 承認後の変更は上書きせず、新しいversionとhashで登録した。

## Review gate

- [ ] 成功条件とguardrailの計測方法が決まっている。
- [ ] Blockerと未決事項にowner・期限がある。
- [ ] 別の確認者が事実、導線、素材、公開不可事項を確認した。
- [ ] `STATUS.md` と `DECISIONS.md` が最新である。

## Launch／handoff gate

- [ ] 使用する全素材のmanifest statusが `APPROVED` である。
- [ ] `COMMAND_CENTER_LINK.json` で解決した司令塔rootの `standards/SGG_CREATIVE_CHARACTER_INCLUSION_V1.md` のcharacter inclusion gateに全素材が適合している。
- [ ] Approver、approved_at、承認対象hashが記録されている。
- [ ] 公開URL、担当、日時、rollback／停止方法が決まっている。
- [ ] dry-runまたはpreviewを確認した。
- [ ] 外部公開・送信・deployの明示承認を得た。
- [ ] 立ち上げ後の確認日とownerを決めた。
- [ ] `python3 launches/tools/validate_pack.py <案件フォルダ> --release` がPASSする。

## 用途別追加gate

- ゲーム: `standards/COPY_INTO_NEW_GAME.md` のFoundation、mobile、認証、Wallet、point、OTOMO形態、voice、実機gateを追加する。
- SNS: campaign brief、master copy、媒体別原稿、承認hash、計測を追加する。
- Creative: prompt、source/output manifest、QA gate、character lock、公開権利を追加する。
