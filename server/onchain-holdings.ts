/**
 * Read-only Ethereum mainnet holdings for a player's linked wallet.
 *
 * Every contract below was confirmed on chain by reading name, symbol and
 * total supply rather than trusting a document. Reads are plain `eth_call`
 * against a public RPC: no indexer, no API key, no transaction, no approval.
 *
 * Holdings are display only. They never affect rank, SGP, or eligibility, and
 * no price or monetary value is derived anywhere in this module.
 */

export const MAINNET_CHAIN_ID = 1;
const DEFAULT_RPC_URL = "https://ethereum-rpc.publicnode.com";
const REQUEST_TIMEOUT_MS = 6_000;

const BALANCE_OF_SELECTOR = "0x70a08231";

export type HoldingKind = "NFT" | "TOKEN";

export type HoldingContract = {
  id: string;
  label: string;
  kind: HoldingKind;
  address: string;
  /** ERC-20 only; NFT counts are whole units. */
  decimals: number;
};

/** Verified on Ethereum mainnet 2026-07-26 by reading name/symbol/totalSupply. */
export const SGG_CONTRACTS: readonly HoldingContract[] = [
  {
    id: "gods",
    label: "SEVEN GODS",
    kind: "NFT",
    address: "0x4cc90f512e0006595e9d11c7fe3ed4c92bc86fe1",
    decimals: 0,
  },
  {
    id: "otomo-seireitai",
    label: "OTOMO 精霊体",
    kind: "NFT",
    address: "0x02f5414e2FcAcd45FA6e6f8107c1584d55D95255",
    decimals: 0,
  },
  {
    id: "otomo-junikutai",
    label: "OTOMO 受肉体",
    kind: "NFT",
    address: "0x464321cbA20AD06536998E06b937E7e48A89D58A",
    decimals: 0,
  },
  {
    id: "otomo-douji",
    label: "OTOMO 童子",
    kind: "NFT",
    address: "0x63e5bE98EE03160E471AFb257703B3a1300DCEcA",
    decimals: 0,
  },
  {
    id: "sdt",
    label: "Seven DAO Token",
    kind: "TOKEN",
    address: "0x46031C24f0021efeBaC763A2E342b3ec4Ca3a7F9",
    decimals: 18,
  },
] as const;

export type Holding = {
  id: string;
  label: string;
  kind: HoldingKind;
  /** null means the read failed: shown as unknown, never as zero. */
  balance: string | null;
};

export type HoldingsSnapshot = {
  chainId: number;
  address: string;
  readAt: string;
  holdings: Holding[];
};

export function balanceOfCallData(address: string): string {
  return `${BALANCE_OF_SELECTOR}${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

/**
 * Formats a raw balance without rounding up. Fractional token amounts are
 * truncated, so a displayed figure never overstates what is held.
 */
export function formatBalance(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();
  // BigInt literals need a higher target than this project compiles to.
  const base = BigInt(10) ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  if (fraction === BigInt(0)) return whole.toString();
  const fractionText = fraction.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return fractionText ? `${whole}.${fractionText}` : whole.toString();
}

/**
 * One JSON-RPC batch for many `eth_call`s.
 *
 * These used to go out as one HTTP request per contract, five in parallel per
 * page view, against a single free public node — which rate-limited under
 * ordinary use and returned nothing for the whole vault (measured 2026-08-26:
 * one full failure in eight loads). Batching makes it one request per view.
 * A failed or malformed entry stays null so the UI keeps saying 未取得 rather
 * than inventing a zero.
 */
async function rpcBatch(
  rpcUrl: string,
  calls: readonly { to: string; data: string }[],
): Promise<(string | null)[]> {
  if (calls.length === 0) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const failed = calls.map(() => null);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(calls.map((call, index) => ({
        jsonrpc: "2.0",
        id: index,
        method: "eth_call",
        params: [call, "latest"],
      }))),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return failed;

    const payload = await response.json() as unknown;
    // A node may answer a batch with a single error object rather than an array.
    if (!Array.isArray(payload)) return failed;

    const byId = new Map<number, unknown>();
    for (const entry of payload) {
      if (entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "number") {
        byId.set((entry as { id: number }).id, (entry as { result?: unknown }).result);
      }
    }
    return calls.map((_, index) => {
      const result = byId.get(index);
      return typeof result === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(result) ? result : null;
    });
  } catch {
    return failed;
  } finally {
    clearTimeout(timeout);
  }
}

/** Public nodes drop calls individually under load; one retry recovers them. */
const RETRY_DELAY_MS = 250;

export async function readHoldings(
  wallet: string,
  rpcUrl = DEFAULT_RPC_URL,
): Promise<HoldingsSnapshot> {
  const calls = SGG_CONTRACTS.map((contract) => ({
    to: contract.address,
    data: balanceOfCallData(wallet),
  }));

  const results = [...await rpcBatch(rpcUrl, calls)];
  const missing = results.flatMap((result, index) => (result === null ? [index] : []));
  if (missing.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    const retried = await rpcBatch(rpcUrl, missing.map((index) => calls[index]));
    missing.forEach((index, slot) => { results[index] = retried[slot]; });
  }

  const holdings = SGG_CONTRACTS.map((contract, index) => {
    const raw = results[index];
    return {
      id: contract.id,
      label: contract.label,
      kind: contract.kind,
      balance: raw === null ? null : formatBalance(BigInt(raw), contract.decimals),
    };
  });

  return {
    chainId: MAINNET_CHAIN_ID,
    address: wallet,
    readAt: new Date().toISOString(),
    holdings,
  };
}

/* ---- NFT token enumeration (tap-to-view gallery) ------------------------ */

const TOKENS_OF_OWNER_SELECTOR = "0x8462151c";
const TOKEN_URI_SELECTOR = "0xc87b56dd";
/** Only this host is CSP-allowlisted for NFT art; anything else is dropped. */
const ALLOWED_IMAGE_HOST = "https://storage.googleapis.com/";

export type OwnedToken = {
  tokenId: number;
  name: string | null;
  /** Full-resolution art (roughly 2MB per piece on this bucket). */
  image: string | null;
  /** 250px variant published alongside the originals; null when underivable. */
  thumb: string | null;
};

export type TokenPage = {
  supported: boolean;
  total: number;
  tokens: OwnedToken[];
  nextOffset: number | null;
};

/**
 * 公式バケットは原寸の隣に250pxの縮小版を置いている（.../images/{id}.png →
 * .../thumbnails/{id}.png）。一覧はこちらを使い、通信量を約15分の1にする。
 * 導出できない形のURLは null（UIが原寸へフォールバック）。
 */
export function deriveThumbUrl(image: string): string | null {
  if (!image.startsWith(ALLOWED_IMAGE_HOST)) return null;
  const marker = image.lastIndexOf("/images/");
  if (marker < 0) return null;
  return `${image.slice(0, marker)}/thumbnails/${image.slice(marker + "/images/".length)}`;
}

/** uint256[] ABI decode; bounded so a hostile response cannot balloon. */
export function decodeTokenIds(result: string, max = 2_000): number[] | null {
  if (!/^0x[0-9a-fA-F]*$/.test(result) || result.length < 130) return null;
  const data = result.slice(2);
  const count = parseInt(data.slice(64, 128), 16);
  if (!Number.isFinite(count) || count < 0 || count > max) return null;
  const ids: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const word = data.slice(128 + i * 64, 192 + i * 64);
    if (word.length < 64) return null;
    ids.push(parseInt(word, 16));
  }
  return ids;
}

/**
 * tokenURI(firstId) からコレクションのメタデータURL雛形を導く。
 * `.../{id}.json` 形のみ受け付け、それ以外は列挙不可として扱う。
 */
export function deriveMetadataTemplate(tokenUri: string, tokenId: number): ((id: number) => string) | null {
  if (!tokenUri.startsWith(ALLOWED_IMAGE_HOST)) return null;
  const suffix = `/${tokenId}.json`;
  if (!tokenUri.endsWith(suffix)) return null;
  const base = tokenUri.slice(0, tokenUri.length - suffix.length);
  return (id: number) => `${base}/${id}.json`;
}

async function rpcCall(rpcUrl: string, to: string, data: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: unknown };
    return typeof payload.result === "string" ? payload.result : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeAbiString(result: string): string | null {
  if (!/^0x[0-9a-fA-F]*$/.test(result) || result.length < 130) return null;
  const data = result.slice(2);
  const length = parseInt(data.slice(64, 128), 16);
  if (!Number.isFinite(length) || length <= 0 || length > 2_048) return null;
  const hex = data.slice(128, 128 + length * 2);
  let out = "";
  for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  try {
    return decodeURIComponent(escape(out));
  } catch {
    return out;
  }
}

/* ---- Multicall3 fallback: ownerOf sweep for non-enumerable contracts ----- */

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const AGGREGATE3_SELECTOR = "0x82ad56cb";
const OWNER_OF_SELECTOR = "6352211e";
const TOTAL_SUPPLY_SELECTOR = "0x18160ddd";
/** ownerOf batch size per Multicall3 call; 400 keeps calldata well under limits. */
const SWEEP_BATCH = 400;
/** Refuse to sweep collections larger than this: subrequest budget, honesty over guessing. */
const SWEEP_MAX_SUPPLY = 10_000;

const word = (n: number) => n.toString(16).padStart(64, "0");

/** Encodes Multicall3.aggregate3 over identical-target calls, allowFailure=true. */
export function encodeAggregate3(target: string, calldatas: string[]): string {
  const addr = target.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const tuples = calldatas.map((cd) => {
    const dataLen = word(cd.length / 2);
    const dataPadded = cd + "0".repeat((64 - (cd.length % 64)) % 64);
    return addr + word(1) + word(96) + dataLen + dataPadded;
  });
  let offsets = "";
  let cursor = calldatas.length * 32;
  for (const tuple of tuples) {
    offsets += word(cursor);
    cursor += tuple.length / 2;
  }
  return `${AGGREGATE3_SELECTOR}${word(32)}${word(calldatas.length)}${offsets}${tuples.join("")}`;
}

/** Decodes aggregate3 results into per-call success flags and raw return bytes. */
export function decodeAggregate3(result: string, count: number): Array<{ success: boolean; bytes: string }> | null {
  if (!/^0x[0-9a-fA-F]*$/.test(result) || result.length < 130) return null;
  const data = result.slice(2);
  const out: Array<{ success: boolean; bytes: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const offset = parseInt(data.slice(128 + i * 64, 192 + i * 64), 16) * 2;
    const tupleStart = 128 + offset;
    if (!Number.isFinite(offset) || data.length < tupleStart + 128) return null;
    const success = parseInt(data.slice(tupleStart, tupleStart + 64), 16) === 1;
    const bytesOffset = parseInt(data.slice(tupleStart + 64, tupleStart + 128), 16) * 2;
    const lenPos = tupleStart + bytesOffset;
    const bytesLen = parseInt(data.slice(lenPos, lenPos + 64), 16) * 2;
    if (!Number.isFinite(bytesLen) || data.length < lenPos + 64 + bytesLen) return null;
    out.push({ success, bytes: data.slice(lenPos + 64, lenPos + 64 + bytesLen) });
  }
  return out;
}

/**
 * tokensOfOwner を持たないコントラクト（SEVEN GODS）向けの代替列挙。
 * totalSupply の範囲を Multicall3 で ownerOf 総当たりし、balanceOf と件数が
 * 一致した時点で確定する。ownerOf の現在値を直接読むため推測が入らない。
 * 全域を掃いても balance に満たなければ（非連番ID等）fail-closed で非対応扱い。
 */
async function sweepOwnedTokenIds(
  wallet: string,
  contractAddress: string,
  rpcUrl: string,
): Promise<number[] | null> {
  const supplyRaw = await rpcCall(rpcUrl, contractAddress, TOTAL_SUPPLY_SELECTOR);
  if (!supplyRaw || !/^0x[0-9a-fA-F]{1,64}$/.test(supplyRaw)) return null;
  const supply = parseInt(supplyRaw, 16);
  if (!Number.isFinite(supply) || supply <= 0 || supply > SWEEP_MAX_SUPPLY) return null;

  const balanceRaw = await rpcCall(rpcUrl, contractAddress, balanceOfCallData(wallet));
  if (!balanceRaw || !/^0x[0-9a-fA-F]{1,64}$/.test(balanceRaw)) return null;
  const balance = parseInt(balanceRaw, 16);
  if (!Number.isFinite(balance) || balance <= 0) return null;

  const target = wallet.toLowerCase().replace(/^0x/, "");
  const found: number[] = [];
  // Sequentially minted collections use ids in [0, supply]; sweep both endpoints.
  for (let start = 0; start <= supply && found.length < balance; start += SWEEP_BATCH) {
    const ids: number[] = [];
    for (let id = start; id < Math.min(start + SWEEP_BATCH, supply + 1); id += 1) ids.push(id);
    const raw = await rpcCall(rpcUrl, MULTICALL3_ADDRESS, encodeAggregate3(contractAddress, ids.map((id) => `${OWNER_OF_SELECTOR}${word(id)}`)));
    if (!raw) return null;
    const decoded = decodeAggregate3(raw, ids.length);
    if (!decoded) return null;
    decoded.forEach((entry, index) => {
      if (entry.success && entry.bytes.length === 64 && entry.bytes.slice(24) === target) {
        found.push(ids[index]);
      }
    });
  }
  // Anything short of the full balance means the id space defeated the sweep:
  // report unsupported rather than show a partial set as if it were complete.
  return found.length === balance ? found : null;
}

/**
 * 保有トークンの1ページ分を列挙し、メタデータから名前と画像を引く。
 * tokensOfOwner 非対応なら Multicall3 の ownerOf 総当たりに切り替え、
 * それでも確定できない場合のみ supported:false を返す（正直表示）。
 */
export async function enumerateOwnedTokens(
  wallet: string,
  collectionId: string,
  offset = 0,
  limit = 12,
  rpcUrl = DEFAULT_RPC_URL,
): Promise<TokenPage | null> {
  const contract = SGG_CONTRACTS.find((c) => c.id === collectionId && c.kind === "NFT");
  if (!contract) return null;

  const padded = wallet.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const raw = await rpcCall(rpcUrl, contract.address, `${TOKENS_OF_OWNER_SELECTOR}${padded}`);
  let ids = raw && raw !== "0x" ? decodeTokenIds(raw) : null;
  if (!ids) {
    // SEVEN GODS lacks tokensOfOwner/Enumerable; fall back to the ownerOf sweep.
    ids = await sweepOwnedTokenIds(wallet, contract.address, rpcUrl);
  }
  if (!ids) return { supported: false, total: 0, tokens: [], nextOffset: null };

  const page = ids.slice(offset, offset + limit);
  if (page.length === 0) {
    return { supported: true, total: ids.length, tokens: [], nextOffset: null };
  }

  const uriRaw = await rpcCall(
    rpcUrl,
    contract.address,
    `${TOKEN_URI_SELECTOR}${page[0].toString(16).padStart(64, "0")}`,
  );
  const uri = uriRaw ? decodeAbiString(uriRaw) : null;
  const template = uri ? deriveMetadataTemplate(uri, page[0]) : null;

  const tokens = await Promise.all(page.map(async (tokenId): Promise<OwnedToken> => {
    if (!template) return { tokenId, name: null, image: null, thumb: null };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(template(tokenId), {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) return { tokenId, name: null, image: null, thumb: null };
      const meta = await response.json() as { name?: unknown; image?: unknown };
      const image = typeof meta.image === "string" && meta.image.startsWith(ALLOWED_IMAGE_HOST)
        ? meta.image
        : null;
      return {
        tokenId,
        name: typeof meta.name === "string" ? meta.name.slice(0, 80) : null,
        image,
        thumb: image ? deriveThumbUrl(image) : null,
      };
    } catch {
      return { tokenId, name: null, image: null, thumb: null };
    } finally {
      clearTimeout(timeout);
    }
  }));

  const nextOffset = offset + page.length < ids.length ? offset + page.length : null;
  return { supported: true, total: ids.length, tokens, nextOffset };
}
