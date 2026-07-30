"use client";

/**
 * OTOMO群体レイヤー。
 *
 * ダッシュボード全域に小さなOTOMOたちを湧かせる装飾層。ポインタイベントを
 * 一切取らず、情報も主張しない：この層が消えても機能は何も変わらない。
 *
 * 配置は seed から決定論的に導出する。乱数を描画に直接使うと SSR と
 * クライアントの木がずれるため、Math.random はここでは禁止。
 */

import { useSyncExternalStore } from "react";

const SPRITES = ["taimaru", "kozuchi", "momokatsu", "kotone", "juka", "haku", "shofuku"] as const;

type Pose = "walk" | "sit" | "sleep" | "cheer";

// SSRでは群れを描かず、クライアントで一度だけ true になる。
const subscribeNoop = () => () => {};
function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/** mulberry32 — 小さく速い決定論的PRNG。 */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SwarmSpec = {
  /** 一意なseed。ビューごとに変えると群れの顔ぶれが変わる。 */
  seed: number;
  /** 湧く数。 */
  count: number;
  /** 歩く個体の割合 (0-1)。残りは座る/寝る/応援に散る。 */
  walkRatio?: number;
  /** スプライトの基準サイズpx。個体ごとに±40%散る。 */
  size?: number;
  /** 層の高さpx。地面帯として下端に敷かれる。 */
  bandHeight?: number;
};

type Individual = {
  key: number;
  sprite: (typeof SPRITES)[number];
  pose: Pose;
  left: number;      // %
  bottom: number;    // px within band
  size: number;      // px
  flip: boolean;
  duration: number;  // s (walk traversal or bob period)
  delay: number;     // s
  drift: number;     // % horizontal walk span
};

function buildSwarm(spec: SwarmSpec): Individual[] {
  const rand = rng(spec.seed);
  const walkRatio = spec.walkRatio ?? 0.45;
  const base = spec.size ?? 44;
  const out: Individual[] = [];
  for (let i = 0; i < spec.count; i += 1) {
    const r = rand();
    const pose: Pose = r < walkRatio
      ? "walk"
      : r < walkRatio + 0.22 ? "sit" : r < walkRatio + 0.4 ? "sleep" : "cheer";
    out.push({
      key: i,
      sprite: SPRITES[Math.floor(rand() * SPRITES.length)],
      pose,
      left: 2 + rand() * 94,
      bottom: rand() * ((spec.bandHeight ?? 64) - 30),
      size: Math.round(base * (0.6 + rand() * 0.8)),
      flip: rand() < 0.5,
      duration: 14 + rand() * 26,
      delay: -rand() * 30,
      drift: 8 + rand() * 26,
    });
  }
  // 手前（bottomが小さい）ほど大きく見せると群れに奥行きが出る。
  return out.sort((a, b) => b.bottom - a.bottom);
}

/**
 * 地面帯スタイルの群れ。ページ下端やセクションの床に敷く。
 * クライアントマウント後にだけ描画する：装飾層をSSRから外すことで
 * ハイドレーション差分と初回描画コストの両方を避ける。
 */
/**
 * 群体スプライトはオーナー承認の対象外。RIGHTS-AND-IMAGE2-
 * APPROVAL-20260729-001 と今回の本番指示に従い、明示的な再承認まで
 * 描画もproduction配信も行わない。
 */
export const SWARM_ENABLED = false;

export function OtomoSwarm({ spec, className }: { spec: SwarmSpec; className?: string }) {
  const mounted = useIsClient();
  if (!SWARM_ENABLED || !mounted) return null;

  const swarm = buildSwarm(spec);
  return (
    <div className={className} aria-hidden="true" data-otomo-swarm="">
      {swarm.map((o) => (
        <span
          key={o.key}
          data-pose={o.pose}
          style={{
            left: `${o.left}%`,
            bottom: `${o.bottom}px`,
            width: `${o.size}px`,
            height: `${o.size}px`,
            animationDuration: `${o.duration}s`,
            animationDelay: `${o.delay}s`,
            ["--drift" as string]: `${o.drift}%`,
            ["--flip" as string]: o.flip ? "-1" : "1",
            zIndex: Math.round(100 - o.bottom),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/dashboard-art/swarm/${o.sprite}-${o.pose}.png`}
            alt=""
            loading="lazy"
            // 生成が追いつくまでの404や欠品は、群れから静かに欠けるだけにする。
            onError={(event) => { event.currentTarget.parentElement!.style.display = "none"; }}
          />
        </span>
      ))}
    </div>
  );
}

/**
 * ヴィネット: 群れの対極。各ページ2〜3体だけを、演出意図のある定位置に
 * 「暮らしている」ように置く。重なりなし・徘徊なし・寝息だけ。
 * 2026-07-29 オーナー審査「個体は可愛いが群れ方が気持ち悪い」への回答。
 */
export type VignetteItem = {
  sprite: (typeof SPRITES)[number];
  pose: Pose;
  /** CSS length からの相対位置。left か right のどちらかを指定。 */
  left?: string;
  right?: string;
  bottom?: string;
  size?: number;
  flip?: boolean;
};

/** 2026-07-29 オーナー指示「いったんOTOMOたちは撤退」。復帰はこの1行。 */
export const VIGNETTE_ENABLED = false;

export function OtomoVignette({ items, className }: { items: VignetteItem[]; className?: string }) {
  const mounted = useIsClient();
  if (!VIGNETTE_ENABLED || !mounted) return null;
  return (
    <div className={className} aria-hidden="true" data-otomo-vignette="">
      {items.map((item, index) => (
        <span
          key={index}
          data-pose={item.pose}
          style={{
            left: item.left,
            right: item.right,
            bottom: item.bottom ?? "0px",
            width: `${item.size ?? 76}px`,
            height: `${item.size ?? 76}px`,
            ["--flip" as string]: item.flip ? "-1" : "1",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/dashboard-art/swarm/${item.sprite}-${item.pose}.png`}
            alt=""
            loading="lazy"
            onError={(event) => { event.currentTarget.parentElement!.style.display = "none"; }}
          />
        </span>
      ))}
    </div>
  );
}
