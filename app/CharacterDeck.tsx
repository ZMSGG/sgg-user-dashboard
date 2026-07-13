"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useRef, useState } from "react";
import styles from "./CharacterDeck.module.css";

type Character = {
  id: string;
  god: string;
  otomo: string;
  image: string;
  accent: string;
  status: string;
  forms: number;
};

const characters: Character[] = [
  { id: "taimaru", god: "EBISU", otomo: "TAIMARU", image: "/dashboard-characters/taimaru-3d.webp", accent: "#ff7467", status: "EQUIPPED", forms: 3 },
  { id: "kozuchi", god: "DAIKOKU", otomo: "KOZUCHI", image: "/dashboard-characters/kozuchi-3d.webp", accent: "#ffad52", status: "OWNED", forms: 2 },
  { id: "momokatsu", god: "BISHAMON", otomo: "MOMOKATSU", image: "/dashboard-characters/momokatsu-3d.webp", accent: "#62ddff", status: "OWNED", forms: 1 },
  { id: "kotone", god: "BENZAI", otomo: "KOTONE", image: "/dashboard-characters/kotone-3d.webp", accent: "#db74ff", status: "OWNED", forms: 2 },
  { id: "juka", god: "JURO", otomo: "JUKA", image: "/dashboard-characters/juka-3d.webp", accent: "#7be5a7", status: "OWNED", forms: 1 },
  { id: "haku", god: "FUKU", otomo: "HAKU", image: "/dashboard-characters/haku-3d.webp", accent: "#bceeff", status: "OWNED", forms: 1 },
  { id: "shofuku", god: "HOTEI", otomo: "SHOFUKU", image: "/dashboard-characters/shofuku-3d.webp", accent: "#f4cc73", status: "OWNED", forms: 2 },
];

const relativeSlot = (index: number, selected: number) => {
  let delta = index - selected;
  if (delta > 3) delta -= characters.length;
  if (delta < -3) delta += characters.length;
  return delta;
};

export function CharacterDeck({ onOpenAssets }: { onOpenAssets: () => void }) {
  const [selected, setSelected] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const pointerDragged = useRef(false);
  const selectedCharacter = characters[selected];

  const rotate = (direction: -1 | 1) => {
    setSelected((current) => (current + direction + characters.length) % characters.length);
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
      setSelected(characters.length - 1);
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
      style={{ "--active-accent": selectedCharacter.accent } as CSSProperties}
      aria-labelledby="character-sanctum-title"
    >
      <div className={styles.heading}>
        <div>
          <p>MY OTOMO / PERSONAL COLLECTION</p>
          <h2 id="character-sanctum-title">あなたのOTOMOコレクション</h2>
        </div>
        <span>DASHBOARD EXCLUSIVE / 07 CHARACTERS</span>
      </div>

      <p className="sr-only" aria-live="polite">{selectedCharacter.otomo}を選択中</p>

      <div className={styles.content}>
        <div
          className={styles.stage}
          role="region"
          aria-roledescription="3Dキャラクターカルーセル"
          aria-label="SGGキャラクターを選択。左右矢印キーまたはドラッグで切り替え"
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
            {characters.map((character, index) => {
              const slot = relativeSlot(index, selected);
              return (
                <button
                  className={`${styles.card}${slot === 0 ? ` ${styles.activeCard}` : ""}`}
                  data-slot={slot}
                  type="button"
                  key={character.id}
                  tabIndex={slot === 0 ? 0 : -1}
                  onClick={() => {
                    if (pointerDragged.current) {
                      pointerDragged.current = false;
                      return;
                    }
                    setSelected(index);
                  }}
                  aria-current={slot === 0 ? "true" : undefined}
                  aria-label={`${character.otomo}（${character.god} LINK）を選択`}
                  style={{ "--pair-accent": character.accent } as CSSProperties}
                >
                  <img
                    src={character.image}
                    alt={`${character.otomo}のダッシュボード専用3Dポートレート`}
                    width="768"
                    height="768"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  <span className={styles.cardSheen} aria-hidden="true" />
                  <span className={styles.cardMeta}>
                    <small>0{index + 1} / SEVEN</small>
                    <strong>{character.otomo}</strong>
                  </span>
                </button>
              );
            })}
          </div>
          <p className={styles.dragHint}>DRAG / ← →</p>
        </div>

        <aside className={styles.detail}>
          <p className={styles.detailIndex}>0{selected + 1} <span>/ 07</span></p>
          <p className={styles.detailKicker}>SELECTED SGG CHARACTER</p>
          <h3>{selectedCharacter.otomo}</h3>
          <span className={styles.godLink}>{selectedCharacter.god} LINK</span>
          <dl>
            <div><dt>STATUS</dt><dd>{selectedCharacter.status}</dd></div>
            <div><dt>OWNED FORMS</dt><dd>{selectedCharacter.forms} / 3</dd></div>
            <div><dt>WALLET</dt><dd>VERIFIED</dd></div>
          </dl>
          <p className={styles.detailCopy}>
            あなたのウォレットと大会記録に結びついた、SGGキャラクターコレクションです。
          </p>
          <button type="button" onClick={onOpenAssets}>保有アセットを見る <span aria-hidden="true">→</span></button>
        </aside>
      </div>

      <div className={styles.selector} aria-label="キャラクター一覧">
        {characters.map((character, index) => (
          <button
            type="button"
            key={character.id}
            className={index === selected ? styles.selectedSelector : ""}
            onClick={() => setSelected(index)}
            aria-label={`${character.otomo}を表示`}
            aria-pressed={index === selected}
          >
            <i style={{ background: character.accent }} aria-hidden="true" />
            <span>{character.otomo}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
