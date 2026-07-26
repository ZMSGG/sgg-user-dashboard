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

async function readBalance(
  rpcUrl: string,
  contract: HoldingContract,
  wallet: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: contract.address, data: balanceOfCallData(wallet) }, "latest"],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = await response.json() as { result?: unknown };
    if (typeof payload.result !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(payload.result)) {
      return null;
    }
    return formatBalance(BigInt(payload.result), contract.decimals);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function readHoldings(
  wallet: string,
  rpcUrl = DEFAULT_RPC_URL,
): Promise<HoldingsSnapshot> {
  const holdings = await Promise.all(
    SGG_CONTRACTS.map(async (contract) => ({
      id: contract.id,
      label: contract.label,
      kind: contract.kind,
      balance: await readBalance(rpcUrl, contract, wallet),
    })),
  );

  return {
    chainId: MAINNET_CHAIN_ID,
    address: wallet,
    readAt: new Date().toISOString(),
    holdings,
  };
}
