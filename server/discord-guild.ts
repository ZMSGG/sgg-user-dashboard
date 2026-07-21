/**
 * Discord guild membership sync.
 *
 * The bot token reads a single guild member snapshot server-side; the browser
 * never asserts membership. NULL columns mean "not determined yet" — a failed
 * sync must never overwrite a previously verified state with a guess.
 */

import type { PlayerOsEnv } from "./auth";

export type GuildSyncConfig = {
  botToken: string;
  guildId: string;
};

const DISCORD_ID_PATTERN = /^\d{5,25}$/;

export function guildSyncConfigFromEnv(env: PlayerOsEnv): GuildSyncConfig | null {
  if (
    typeof env.DISCORD_BOT_TOKEN !== "string" ||
    env.DISCORD_BOT_TOKEN !== env.DISCORD_BOT_TOKEN.trim() ||
    env.DISCORD_BOT_TOKEN.length < 32 ||
    typeof env.DISCORD_GUILD_ID !== "string" ||
    !DISCORD_ID_PATTERN.test(env.DISCORD_GUILD_ID)
  ) {
    return null;
  }
  return { botToken: env.DISCORD_BOT_TOKEN, guildId: env.DISCORD_GUILD_ID };
}

export type GuildMemberSnapshot = {
  member: boolean;
  joinedAt: string | null;
  roles: string[];
};

/**
 * Fetches one member from the configured guild. Returns null on transport or
 * authorization failures so callers keep the previous durable state instead
 * of recording a fabricated "not a member".
 */
export async function fetchGuildMember(
  config: GuildSyncConfig,
  discordId: string,
  timeoutMs = 8_000,
): Promise<GuildMemberSnapshot | null> {
  if (!DISCORD_ID_PATTERN.test(discordId)) return null;
  let response: Response;
  try {
    response = await fetch(
      `https://discord.com/api/v10/guilds/${config.guildId}/members/${discordId}`,
      {
        headers: { authorization: `Bot ${config.botToken}` },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch {
    return null;
  }

  if (response.status === 404) {
    // Unknown Member: a definitive, truthful "not in the guild".
    return { member: false, joinedAt: null, roles: [] };
  }
  if (!response.ok) return null;

  let payload: { joined_at?: unknown; roles?: unknown };
  try {
    payload = await response.json() as typeof payload;
  } catch {
    return null;
  }
  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((role): role is string =>
      typeof role === "string" && DISCORD_ID_PATTERN.test(role))
    : [];
  return {
    member: true,
    joinedAt: typeof payload.joined_at === "string" ? payload.joined_at : null,
    roles,
  };
}

export const GUILD_SYNC_COOLDOWN_SECONDS = 60;

/** Manual re-sync throttle so the endpoint cannot be used to hammer Discord. */
export function isGuildSyncCooldownActive(
  lastSyncedAt: string | null,
  nowMs = Date.now(),
  cooldownSeconds = GUILD_SYNC_COOLDOWN_SECONDS,
): boolean {
  if (!lastSyncedAt) return false;
  const last = Date.parse(lastSyncedAt);
  if (Number.isNaN(last)) return false;
  return nowMs - last < cooldownSeconds * 1000;
}

export function parseGuildRoles(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((role): role is string => typeof role === "string")
      : [];
  } catch {
    return [];
  }
}
