<!-- SGG_DURABLE_STATE_REQUIRED -->
> **MIGRATION_REQUIRED — filesystem state gate:** チャット、context window、会話要約、モデルmemoryは正本ではない。現在このfolderには司令塔管理の `PROJECT_STATE.json`、不変checkpoint、鮮度確認済み `VALIDATION_REPORT.json` がないため、履歴を上書きせずにdurable-state移行を先に完了する。移行前は引き継ぎ可能・完了・公開可能と報告しない。

# SGGビジュアルクリエイティブ指示

`{SGG_COMMAND_CENTER}` は固定絶対pathやshell変数ではない。現在地から親folderを辿り、`.sgg-command-center.json` を持つ最寄りのfolderを司令塔rootとして読み替える。見つからなければ制作・承認・公開を止める。

この指示は、このフォルダと配下のすべてに適用します。

作業前に、正本 `{SGG_COMMAND_CENTER}/standards/SGG_CREATIVE_CHARACTER_INCLUSION_V1.md` を必ず読み、従ってください。正本が見つからない、または適用判断ができない場合は、制作・承認・公開を止めて不足を報告します。

- 新規作成または改訂するSGGの各ビジュアルcreative出力には、次のいずれかを最終cropでも識別できる大きさで含めます: 正規かつ用途承認済みのGODSを1柱以上、OTOMOを1体以上、またはその両方。
- 文字、ロゴ、キャラクター名、metadataだけの記載、極小表示、背景への隠蔽では要件を満たしません。
- private原画を公開物へ直貼りしません。canon、出典、権利範囲、用途別の公開承認を確認した素材または承認済み派生表現だけを使います。
- OTOMOを使う場合は `SPIRIT / INCARNATE / DOJI` のformを明記し、`OTOMO_FORM_BALANCE_V1.md` の配分・監査規則に従います。
- promptとbriefにも本要件を明記し、成果物metadataへキャラクターID、種別、OTOMO form（該当時）、参照元、権利・承認状態を記録します。
- 未達の出力は承認、公開、完成扱いにしません。既存の非準拠出力は、再利用・改訂・再公開するときに本指示へ適合させ、必要な再承認を行います。
