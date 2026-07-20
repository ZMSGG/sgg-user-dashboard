# MY SGG Architecture

Status: `PLAYER OS V1 / OWNER-ONLY PRIVATE DEPLOYMENT`

MY SGGは、公開情報と個人情報を同じ確度で扱わないユーザー向け統合面です。

## 実装済み

- 正本由来のゲームカタログ
- Oracle / Questのpublic rankingを正規化するsame-origin API
- 公開台帳で確認済みの公式フィード
- GODS / OTOMO / formの正規カタログ
- ゲーム、ランキング、ポイント、報酬、Tokenの意味分離
- hash deep link、検索、通知、端末内preferences、mobile navigation
- revocable Discord session、one-time Wallet challenge、append-only SGG point ledger

## 個人データの境界

各ゲームは別のDiscord sessionとDBを持ちます。Dashboard cookieを他ゲームへ転送したり、browserからuser IDを送って本人情報を取得しません。

Player Passportを本番接続する際は、Dashboard serverがDiscord sessionから本人を解決し、各ゲームへ短命・audience-bound・replay-protectedな署名assertionを送ります。ゲーム側は副作用のないplayer snapshotだけを返します。

詳細なcontract、データモデル、release gateは [`PLAYER_OS_ARCHITECTURE.md`](PLAYER_OS_ARCHITECTURE.md) を正本とします。
