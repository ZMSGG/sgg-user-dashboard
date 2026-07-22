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
const UNKNOWN_MEMBER_ERROR_CODE = 10_007;
const UNKNOWN_MEMBER_ERROR_MESSAGE = "Unknown Member";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidConfig(config: GuildSyncConfig): boolean {
  return (
    typeof config?.botToken === "string" &&
    config.botToken === config.botToken.trim() &&
    config.botToken.length >= 32 &&
    typeof config.guildId === "string" &&
    DISCORD_ID_PATTERN.test(config.guildId)
  );
}

function isConfirmedUnknownMember(payload: unknown): boolean {
  return (
    isObject(payload) &&
    payload.code === UNKNOWN_MEMBER_ERROR_CODE &&
    payload.message === UNKNOWN_MEMBER_ERROR_MESSAGE
  );
}

function parseMemberSnapshot(
  payload: unknown,
  expectedDiscordId: string,
): GuildMemberSnapshot | null {
  if (!isObject(payload) || !isObject(payload.user)) return null;
  if (payload.user.id !== expectedDiscordId || !Array.isArray(payload.roles)) return null;
  if (!payload.roles.every((role) =>
    typeof role === "string" && DISCORD_ID_PATTERN.test(role)
  )) {
    return null;
  }
  if (
    payload.joined_at !== null &&
    (typeof payload.joined_at !== "string" || Number.isNaN(Date.parse(payload.joined_at)))
  ) {
    return null;
  }
  return {
    member: true,
    joinedAt: payload.joined_at,
    roles: payload.roles,
  };
}

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
 * Fetches one member from the configured guild. Returns a snapshot only for a
 * well-formed member response or Discord's confirmed Unknown Member error;
 * every ambiguous failure returns null so callers preserve durable state.
 */
export async function fetchGuildMember(
  config: GuildSyncConfig,
  discordId: string,
  timeoutMs = 8_000,
): Promise<GuildMemberSnapshot | null> {
  if (!isValidConfig(config) || !DISCORD_ID_PATTERN.test(discordId)) return null;
  let response: Response;
  try {
    response = await fetch(
      `https://discord.com/api/v10/guilds/${config.guildId}/members/${discordId}`,
      {
        headers: { authorization: `Bot ${config.botToken}` },
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch {
    return null;
  }

  if (response.status === 404) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return null;
    }
    // Only Discord's specific Unknown Member error is definitive. Other 404s
    // can mean an invalid guild, missing access, or an intermediary failure.
    return isConfirmedUnknownMember(payload)
      ? { member: false, joinedAt: null, roles: [] }
      : null;
  }
  if (response.status !== 200) return null;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }
  return parseMemberSnapshot(payload, discordId);
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
