/**
 * Dock and navigation iconography.
 *
 * Authored as inline SVG rather than generated raster art: these render at
 * many sizes, must stay crisp on high-density screens, and inherit the tone
 * colour of whatever surface they sit on. Each icon uses `currentColor` so a
 * single CSS variable drives its accent.
 */

type IconProps = { className?: string };

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Crossed blades — the game list. */
export function IconGames({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M4 4h3l10.5 10.5" />
      <path d="M20 4h-3L6.5 14.5" />
      <path d="M15.5 16.5 19 20" />
      <path d="M8.5 16.5 5 20" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Frame>
  );
}

/** Faceted crown gem — the arena. */
export function IconArena({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M4 9.5 12 3l8 6.5-8 11.5z" />
      <path d="M4 9.5h16" />
      <path d="M9.2 9.5 12 21l2.8-11.5" />
      <path d="M12 3 9.2 9.5m2.8-6.5 2.8 6.5" />
    </Frame>
  );
}

/** Treasure chest — the collection vault. */
export function IconVault({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M3 10.5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M3 12.5h18" />
      <path d="M10.4 12.5h3.2v3h-3.2z" />
    </Frame>
  );
}

/** OTOMO spirit — the companion plaza. */
export function IconOtomo({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M12 3.5c3.6 0 6.4 2.7 6.4 6.2 0 4.4-3 7.3-6.4 10.8C8.6 17 5.6 14.1 5.6 9.7 5.6 6.2 8.4 3.5 12 3.5z" />
      <circle cx="9.9" cy="9.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.1" cy="9.4" r="1" fill="currentColor" stroke="none" />
      <path d="M10.5 12.4c.9.7 2.1.7 3 0" />
    </Frame>
  );
}

/** Linked figures — the community feed. */
export function IconCommunity({ className }: IconProps) {
  return (
    <Frame className={className}>
      <circle cx="8.6" cy="8.4" r="2.7" />
      <circle cx="16.4" cy="10.2" r="2.2" />
      <path d="M3.4 19.2c0-2.9 2.3-5 5.2-5s5.2 2.1 5.2 5" />
      <path d="M15.2 14.6c2.7-.4 5.4 1.3 5.4 4.6" />
    </Frame>
  );
}

/** Seven-gate arch — the oracle. */
export function IconOracle({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M12 2.8 20 8v13H4V8z" />
      <path d="M9 21v-6.2a3 3 0 0 1 6 0V21" />
      <path d="M2.6 8h18.8" />
    </Frame>
  );
}

/** Ledger scroll — the SGP record. */
export function IconLedger({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M6 3.5h9.5L19 7v13.5H6z" />
      <path d="M15.2 3.5V7H19" />
      <path d="M9 11.5h7M9 15h7M9 18h4" />
    </Frame>
  );
}

/** Passport seal — the player record. */
export function IconPassport({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M5 4.6h14v14.8H5z" />
      <circle cx="12" cy="10.4" r="2.6" />
      <path d="M8.4 17c.8-1.8 2.1-2.7 3.6-2.7s2.8.9 3.6 2.7" />
    </Frame>
  );
}

/** Seven-point star — the home surface. */
export function IconHome({ className }: IconProps) {
  return (
    <Frame className={className}>
      <path d="M12 2.6 14 8.4l6 .5-4.6 4 1.4 5.9L12 15.7 7.2 18.8l1.4-5.9L4 8.9l6-.5z" />
    </Frame>
  );
}

