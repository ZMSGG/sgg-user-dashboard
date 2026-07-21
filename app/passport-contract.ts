/**
 * Shared contract for `/api/passport`. Identity comes from the server
 * session only; the browser never asserts who the player is.
 */

export type PassportGrant = {
  amount: number;
  reasonCode: string;
  note: string | null;
  createdAt: string;
};

export type PassportPlayer = {
  discordId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;
  walletLinkedAt: string | null;
};

/**
 * Guild membership snapshot. `member: null` means "not determined yet" —
 * the UI must show it as unverified, never as "not a member".
 */
export type PassportGuild = {
  configured: boolean;
  member: boolean | null;
  joinedAt: string | null;
  roleCount: number;
  syncedAt: string | null;
};

export type PassportData =
  | { connected: false; authConfigured: boolean }
  | {
    connected: true;
    authConfigured: boolean;
    player: PassportPlayer;
    guild: PassportGuild;
    points: { balance: number; grants: PassportGrant[] };
    isAdmin: boolean;
  };

export type AdminPlayerRow = {
  discordId: string;
  username: string;
  globalName: string | null;
  walletLabel: string | null;
  createdAt: string;
  lastLoginAt: string;
  balance: number;
};
