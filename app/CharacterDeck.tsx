"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useRef, useState } from "react";
import styles from "./CharacterDeck.module.css";

type CharacterPair = {
  id: string;
  god: string;
  otomo: string;
  image: string;
  accent: string;
  status: string;
  forms: number;
};

const pairs: CharacterPair[] = [
  { id: "taimaru", god: "EBISU", otomo: "TAIMARU", image: "/sgg-art/pair-taimaru.webp", accent: "#ff7467", status: "EQUIPPED", forms: 3 },
  { id: "kozuchi", god: "DAIKOKU", otomo: "KOZUCHI", image: "/sgg-art/pair-kozuchi.webp", accent: "#ffad52", status: "OWNED", forms: 2 },
  { id: "momokatsu", god: "BISHAMON", otomo: "MOMOKATSU", image: "/sgg-art/pair-momokatsu.webp", accent: "#62ddff", status: "OWNED", forms: 1 },
  { id: "kotone", god: "BENZAI", otomo: "KOTONE", image: "/sgg-art/pair-kotone.webp", accent: "#db74ff", status: "OWNED", forms: 2 },
  { id: "juka", god: "JURO", otomo: "JUKA", image: "/sgg-art/pair-juka.webp", accent: "#7be5a7", status: "OWNED", forms: 1 },
  { id: "haku", god: "FUKU", otomo: "HAKU", image: "/sgg-art/pair-haku.webp", accent: "#bceeff", status: "OWNED", forms: 1 },
  { id: "shofuku", god: "HOTEI", otomo: "SHOFUKU", image: "/sgg-art/pair-shofuku.webp", accent: "#f4cc73", status: "OWNED", forms: 2 },
];

const relativeSlot = (index: number, selected: number) => {
  let delta = index - selected;
  if (delta > 3) delta -= pairs.length;
  if (delta < -3) delta += pairs.length;
  return delta;
};

export function CharacterDeck({ onOpenAssets }: { onOpenAssets: () => void }) {
  const [selected, setSelected] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const pointerDragged = useRef(false);
  const selectedPair = pairs[selected];

  const rotate = (direction: -1 | 1) => {
    setSelected((current) => (current + direction + pairs.length) % pairs.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      rotate(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      rotate(1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setSelected(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setSelected(pairs.length - 1);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStart.current = event.clientX;
    pointerDragged.current = false;
    if (!(event.target as HTMLElement).closest("button")) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current === null) return;
    const distance = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(distance) < 42) return;
    pointerDragged.current = true;
    rotate(distance > 0 ? -1 : 1);
  };

  return (
    <section
      className={styles.sanctum}
      style={{ "--active-accent": selectedPair.accent } as CSSProperties}
      aria-labelledby="character-sanctum-title"
    >
      <div className={styles.heading}>
        <div>
          <p>THE SEVEN / PERSONAL COLLECTION</p>
          <h2 id="character-sanctum-title">七柱のキャラクター神殿</h2>
        </div>
        <span>100 SHOTS → 7 SELECTED PAIRS</span>
      </div>

      <div className={styles.content}>
        <div
          className={styles.stage}
          role="region"
          aria-roledescription="3D character carousel"
          aria-label="SGGキャラクターペアを選択。左右矢印キーまたはドラッグで切り替え"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            pointerStart.current = null;
            pointerDragged.current = false;
          }}
        >
          <div className={styles.portal} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.cards}>
            {pairs.map((pair, index) => {
              const slot = relativeSlot(index, selected);
              return (
                <button
                  className={`${styles.card}${slot === 0 ? ` ${styles.activeCard}` : ""}`}
                  data-slot={slot}
                  type="button"
                  key={pair.id}
                  onClick={() => {
                    if (pointerDragged.current) {
                      pointerDragged.current = false;
                      return;
                    }
                    setSelected(index);
                  }}
                  aria-current={slot === 0 ? "true" : undefined}
                  aria-label={`${pair.god}と${pair.otomo}を選択`}
                  style={{ "--pair-accent": pair.accent } as CSSProperties}
                >
                  <img
                    src={pair.image}
                    alt={`${pair.god}と${pair.otomo}のSGGキャラクターペア`}
                    width="560"
                    height="700"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  <span className={styles.cardSheen} aria-hidden="true" />
                  <span className={styles.cardMeta}>
                    <small>0{index + 1} / SEVEN PAIR</small>
                    <strong>{pair.otomo}</strong>
                  </span>
                </button>
              );
            })}
          </div>
          <p className={styles.dragHint}>DRAG / ← →</p>
        </div>

        <aside className={styles.detail} aria-live="polite">
          <p className={styles.detailIndex}>0{selected + 1} <span>/ 07</span></p>
          <p className={styles.detailKicker}>SELECTED SGG PAIR</p>
          <h3>{selectedPair.otomo}</h3>
          <span className={styles.godLink}>{selectedPair.god} LINK</span>
          <dl>
            <div><dt>STATUS</dt><dd>{selectedPair.status}</dd></div>
            <div><dt>OWNED FORMS</dt><dd>{selectedPair.forms} / 3</dd></div>
            <div><dt>WALLET</dt><dd>VERIFIED</dd></div>
          </dl>
          <p className={styles.detailCopy}>
            あなたのウォレットと大会記録に結びついた、SGGキャラクターコレクションです。
          </p>
          <button type="button" onClick={onOpenAssets}>保有アセットを見る <span aria-hidden="true">→</span></button>
        </aside>
      </div>

      <div className={styles.selector} aria-label="キャラクター一覧">
        {pairs.map((pair, index) => (
          <button
            type="button"
            key={pair.id}
            className={index === selected ? styles.selectedSelector : ""}
            onClick={() => setSelected(index)}
            aria-label={`${pair.otomo}を表示`}
            aria-pressed={index === selected}
          >
            <i style={{ background: pair.accent }} aria-hidden="true" />
            <span>{pair.otomo}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
