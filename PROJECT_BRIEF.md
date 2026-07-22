# Project Brief: MY SGG — Player OS

Status: `REVIEW`
Project ID: `PRJ-202607-sgg-user-dashboard`
Type: `ui`
Owner: `SGG product owner`
Approver: `SGG creative and release approver`
Created: `2026-07-20T22:35:18+08:00`

## One sentence

新作ゲーム、開催中の大会、自分のアセット、ランキング、コミュニティ、本人確認とSGGポイントを一つに統合し、プレイヤーがSGGを楽しむための行動をここだけで完結させるユーザー向けPlayer OS。

## Audience and problem

- Audience / use context: SEVENGODS Gamesを遊び、競い、集め、コミュニティへ参加する既存および新規プレイヤー。
- Problem / opportunity: ゲーム、稼働状態、大会、ランキング、保有情報、本人確認、ポイント、公式情報が別々の場所に分散し、プレイヤーが次に何を楽しめるか判断しづらい。
- Value proposition: 公開確認済み情報と本人だけのPlayer Passportを安全に分離しながら、SGGで遊ぶための発見、参加、確認、管理を一つのresponsive dashboardへ統合する。

## First release

- Deliverable / experience: 公開ゲームハブ、稼働状態、ランキング、大会の空状態、コレクションの接続状態、コミュニティ、Discord Player Passport、任意Wallet連携、append-only SGGポイント台帳を一つのresponsive Web UIで安全に利用できるvertical slice。
- Primary action / CTA: 現在利用可能なゲームまたは大会を確認して参加し、必要な場合だけDiscord Player Passportへ接続する。
- Time horizon: `77`

## Scope in

- 公開確認済みゲーム、稼働状態、ランキング、公式情報を一画面へ集約する
- Discord user IDを正式identityとするPlayer Passportを実装する
- 任意Walletの署名連携と1 Discord対1 Walletを実装する
- 管理者だけが操作できるappend-onlyかつ冪等なSGGポイント台帳を実装する
- loading、empty、error、success、未接続、準備中を区別する
- mobile、keyboard、focus、contrast、safe areaへ対応する

## Scope out

- 明示承認のない公開、deploy、production DB変更、外部送信
- 各ゲームの未実装player bridgeを接続済みと表現すること
- 存在しない大会、保有asset、reward、ranking、ユーザー数を捏造すること
- raw gameplay score、ranking、SGG_GAME_POINTS、外部reward、SGG Tokenを混同すること
- 未承認creative、private原画、secret、個人データをpublic bundleへ含めること

## Success decision

- Metric: 主要Player OS導線の完了率とtruthful-state coverage
- Target: 6つの主要viewとPassport認証・Wallet・ポイント導線でloading、empty、error、successを100%区別し、公開情報に出典状態を表示する
- Guardrail: 架空LIVE値0件、identity越境0件、重複ポイント付与0件、secret漏えい0件、character非準拠visual 0件
- Decision date: `2026-07-27`

## Character plan

- Family: `OTOMO`
- OTOMO: `taimaru` (`DOJI`)
- Canon reference: `SGG createve/canon/characters.json`
- Creative rights: `APPROVED` with evidence in `rights/RIGHTS-AND-IMAGE2-APPROVAL-20260722-001.json`

## Type contract

- Lock the primary user and job-to-be-done.
- Cover happy, loading, empty, error, and success states.
- Confirm mobile, keyboard, focus, contrast, and measurement before visual polish.
