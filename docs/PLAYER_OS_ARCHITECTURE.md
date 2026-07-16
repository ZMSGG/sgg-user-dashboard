# MY SGG Player OS Architecture

Status: `PUBLIC READ MODEL IMPLEMENTED / PLAYER BRIDGE PENDING`

## 1. Product boundary

MY SGG is a player-facing aggregation surface. It does not become the source of truth for game results, rankings, holdings, points, or rewards. Each game remains authoritative for its own state.

```text
public game registry ─┐
public ranking APIs ──┼─> MY SGG public read model ─> PLAY / ARENA / FEED
publish ledger ───────┘

Discord identity assertion ─> signed per-game snapshot endpoints ─> Player Passport
optional Wallet snapshot ──────────────────────────────────────────> Collection
```

## 2. Implemented public integration

`GET /api/live` performs server-side, read-only fetches from public endpoints and returns only the fields required by the dashboard.

- Oracle current daily ranking: source day, rank, pseudonymous display name, raw score, outcome
- Quest season ranking: rank, public username, progress metric, favourite OTOMO
- Oracle / Quest / Farm / TAIYO runtime health: current HTTP availability
- Quest internal user IDs are removed
- HTTP success and payload schema must both validate before a ranking source becomes online
- Failures return an unavailable source state; mock values are never substituted
- Responses are `no-store` for the browser; the server keeps a 45-second shared snapshot with single-flight deduplication so concurrent visitors do not multiply upstream reads
- `?refresh` (the manual sync button) bypasses the snapshot and always reads upstream again; every payload reports `servedFrom` (`origin` / `cache`) and `cacheAgeSeconds`
- The client auto re-syncs visible tabs every 90 seconds, stays quiet while hidden, and keeps the last verified snapshot when a re-sync fails

Farm remains a public page link because there is no side-effect-free JSON player read model. TAIYO remains a public game link; its ranking contract can be added to the same adapter after a stable public query is fixed.

## 3. Required player snapshot contract

Each game should add a side-effect-free endpoint:

```http
GET /api/integration/v1/player-snapshot
Authorization: SGG-Assertion <signed short-lived assertion>
```

The dashboard server creates the assertion from its authenticated Discord session. The browser never submits a game user ID as proof of ownership.

```ts
type EvidenceMode = "PRODUCTION" | "SHADOW" | "MOCK" | "SPEC";

type PlayerSnapshot = {
  schemaVersion: 1;
  gameId: string;
  discordSubject: string;
  observedAt: string;
  sourceMode: EvidenceMode;
  pendingActions: Array<{
    id: string;
    label: string;
    availableAt: string | null;
    href: string;
  }>;
  assets: Array<{
    id: string;
    sourceKind: "ONCHAIN" | "GAME";
    family: "GODS" | "OTOMO" | "ITEM" | "TITLE";
    characterId: string | null;
    form: "SPIRIT" | "INCARNATE" | "DOJI" | null;
    quantity: string;
    snapshotAt: string;
  }>;
  ledgerAccounts: Array<{
    system: "RAW_SCORE" | "RANKING" | "SGG_GAME_POINTS" | "GAME_RESOURCE" | "REWARD";
    status: "FINALIZED" | "PENDING" | "SHADOW";
    value: string | null;
    policyVersion: string | null;
  }>;
};
```

Assertions must be audience-bound to one game, expire within 60 seconds, include a nonce, and be replay-protected. Game responses must be read-only and must not trigger login bonuses, stamina recovery writes, holding refreshes, or daily check-ins.

## 4. Trust boundaries

- Discord user ID is the official identity. Display names are not identity keys.
- Wallet connection is optional and cannot gate gameplay or raw ranking.
- Live wallet holdings and finalized season snapshots are different datasets.
- Raw score, ranking, `SGG_GAME_POINTS`, external reward, SDT, and `SGG Token` remain separate.
- Missing data renders as `未接続 / 未確認 / 公開情報なし`, never numeric zero.
- Published content requires a public URL and delivery ledger. Editorial approval alone is not publication.

## 5. Persistence

Device-local preferences currently use localStorage for watched development titles, read notifications, and followed channels. Financial, identity, ranking, asset, and reward records are never stored there.

Cross-device preferences can move to D1 only after a server-authenticated PlayerAccount exists. All writes must use the server session, idempotency keys, and append-only audit events.

## 6. Release gate

- TypeScript, lint, production build, and SSR/API tests pass.
- No mock user, wallet fragment, balance, tournament, participant count, or event appears as live data.
- Public game URLs and ranking adapters fail closed.
- Search metadata is `noindex, nofollow` while the site remains a private preview.
- Mobile navigation, keyboard search, skip link, focus movement, reduced motion, and 320px reflow remain available.
