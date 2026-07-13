"use client";

import { useEffect, useState } from "react";
import {
  otomoForms,
  pointLedger,
  tournamentRecords,
} from "./dashboard-data";

type View = "overview" | "tournaments" | "assets" | "points";
type Dialog = "account" | "recovery" | null;

const navItems: Array<{
  id: View;
  label: string;
  eyebrow: string;
  glyph: string;
}> = [
  { id: "overview", label: "概要", eyebrow: "OVERVIEW", glyph: "七" },
  { id: "tournaments", label: "大会", eyebrow: "ARENA", glyph: "杯" },
  { id: "assets", label: "資産", eyebrow: "ASSETS", glyph: "宝" },
  { id: "points", label: "ポイント", eyebrow: "LEDGER", glyph: "点" },
];

const formatPoints = (value: number) => new Intl.NumberFormat("ja-JP").format(value);

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup${compact ? " is-compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <span>七</span>
      </span>
      {!compact && (
        <span className="brand-type">
          <strong>SGG</strong>
          <small>PLAYER ARCHIVE</small>
        </span>
      )}
    </div>
  );
}

function SectionHeading({
  kicker,
  title,
  description,
  demo = false,
}: {
  kicker: string;
  title: string;
  description: string;
  demo?: boolean;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <p className="section-description">{description}</p>
      </div>
      {demo && <span className="demo-stamp">DEMO DATA</span>}
    </div>
  );
}

function ConnectionDot({ active }: { active: boolean }) {
  return <span className={`connection-dot${active ? " is-active" : ""}`} aria-hidden="true" />;
}

export function Dashboard() {
  const [activeView, setActiveView] = useState<View>("overview");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [discordConnected, setDiscordConnected] = useState(true);
  const [walletConnected, setWalletConnected] = useState(true);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const activeItem = navItems.find((item) => item.id === activeView) ?? navItems[0];
  const protectionCount = Number(discordConnected) + Number(walletConnected) + Number(passkeyEnabled);

  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [dialog]);

  const changeView = (view: View) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const notify = (message: string) => {
    setToast(message);
    setDialog(null);
  };

  const toggleWallet = () => {
    const next = !walletConnected;
    setWalletConnected(next);
    notify(next ? "デモウォレットを接続しました" : "デモウォレットを切断しました");
  };

  const toggleDiscord = () => {
    const next = !discordConnected;
    setDiscordConnected(next);
    notify(next ? "Discordを再接続しました" : "Discordを切断しました（デモ）");
  };

  const enablePasskey = () => {
    setPasskeyEnabled(true);
    notify("この端末にパスキーを登録しました（デモ）");
  };

  return (
    <div className="dashboard-shell">
      <aside className="sidebar" aria-label="メインナビゲーション">
        <BrandMark />
        <div className="sidebar-rule" />
        <nav className="side-nav">
          {navItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`nav-button${activeView === item.id ? " is-active" : ""}`}
              onClick={() => changeView(item.id)}
              aria-current={activeView === item.id ? "page" : undefined}
            >
              <span className="nav-glyph" aria-hidden="true"><i>{item.glyph}</i></span>
              <span>
                <small>0{index + 1} / {item.eyebrow}</small>
                <strong>{item.label}</strong>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-account">
          <p className="kicker">ACCOUNT SHIELD</p>
          <strong>{protectionCount} / 3 保護済み</strong>
          <div className="protection-track" aria-label={`アカウント保護 ${protectionCount}/3`}>
            <span style={{ width: `${(protectionCount / 3) * 100}%` }} />
          </div>
          <button type="button" onClick={() => setDialog("recovery")}>
            保護設定を確認
          </button>
        </div>
        <p className="sidebar-foot">STARTER / V0.1</p>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand"><BrandMark compact /></div>
          <div className="breadcrumb">
            <span>MY SGG</span>
            <i aria-hidden="true">/</i>
            <strong>{activeItem.label}</strong>
          </div>
          <div className="topbar-actions">
            <div className="sync-status" aria-label="最終同期 2026年7月13日 9時42分">
              <ConnectionDot active />
              <span><small>LAST SYNC</small>09:42</span>
            </div>
            <button className="profile-button" type="button" onClick={() => setDialog("account")}>
              <span className="avatar" aria-hidden="true">ZT</span>
              <span className="profile-copy">
                <strong>{discordConnected ? "ZEN_TARO" : "未接続"}</strong>
                <small>{discordConnected ? "Discord linked" : "Sign in required"}</small>
              </span>
              <span className="chevron" aria-hidden="true">⌄</span>
            </button>
          </div>
        </header>

        <main className="page-content">
          <div className="demo-notice" role="note">
            <span>STARTER KIT / DEMO DATA</span>
            画面内の戦績・残高・ポイントは、連携前のデモデータです。
          </div>

          {activeView === "overview" && (
            <div className="view-stack overview-view">
              <section className="hero-card" aria-labelledby="hero-title">
                <div className="hero-orbit orbit-one" aria-hidden="true" />
                <div className="hero-orbit orbit-two" aria-hidden="true" />
                <div className="hero-copy">
                  <p className="hero-label">PLAYER RECORD / 0007-7F3A91</p>
                  <h1 id="hero-title">挑戦のすべてを、<br />ひとつの記録へ。</h1>
                  <p>
                    おかえりなさい、ZEN_TARO。大会、アセット、ポイントの現在地をまとめました。
                  </p>
                  <div className="identity-row">
                    <span><ConnectionDot active={discordConnected} /> Discord</span>
                    <span><ConnectionDot active={walletConnected} /> Wallet</span>
                    <span className={!passkeyEnabled ? "is-muted" : ""}>
                      <ConnectionDot active={passkeyEnabled} /> Passkey
                    </span>
                  </div>
                </div>
                <div className="hero-points">
                  <p>SGG POINTS <span>DEMO</span></p>
                  <strong>12,840</strong>
                  <small>今シーズン <b>+3,420</b></small>
                  <button type="button" onClick={() => changeView("points")}>明細を見る <span aria-hidden="true">→</span></button>
                </div>
              </section>

              <section className="stats-grid" aria-label="プレイヤー概要">
                <article className="stat-card">
                  <p>TOURNAMENTS</p><strong>14</strong><span>大会出場</span>
                </article>
                <article className="stat-card">
                  <p>CHAMPIONS</p><strong>05</strong><span>優勝回数</span>
                </article>
                <article className="stat-card">
                  <p>WIN RATE</p><strong>35.7<small>%</small></strong><span>通算優勝率</span>
                </article>
                <article className="stat-card is-featured">
                  <p>BEST RANK</p><strong>#01</strong><span>シーズン最高順位</span>
                </article>
              </section>

              <div className="overview-grid">
                <section className="panel recent-panel" aria-labelledby="recent-title">
                  <div className="panel-head">
                    <div><p className="kicker">RECENT ARENA</p><h2 id="recent-title">最近の大会記録</h2></div>
                    <button type="button" className="text-button" onClick={() => changeView("tournaments")}>すべて見る <span aria-hidden="true">→</span></button>
                  </div>
                  <div className="compact-results">
                    {tournamentRecords.slice(0, 3).map((record) => (
                      <article className="compact-result" key={record.id}>
                        <span className={`game-sigil tone-${record.accent}`} aria-hidden="true"><i>7</i></span>
                        <div className="result-main">
                          <strong>{record.game}</strong>
                          <span>{record.tournament} · {record.date}</span>
                        </div>
                        <div className="result-rank"><strong>{record.result}</strong><span>{record.rank}</span></div>
                        <div className="result-points"><strong>+{formatPoints(record.points)}</strong><span>PTS</span></div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="panel security-panel" aria-labelledby="security-title">
                  <div className="panel-head">
                    <div><p className="kicker">ACCOUNT SHIELD</p><h2 id="security-title">アカウントを守る</h2></div>
                    <span className="shield-score"><i>{protectionCount}/3</i></span>
                  </div>
                  <p className="security-copy">
                    Discordを失った場合に備えて、独立した復旧手段を追加しておくのがおすすめです。
                  </p>
                  <ul className="security-list">
                    <li className={discordConnected ? "is-complete" : ""}><span>{discordConnected ? "✓" : "!"}</span><div><strong>Discord</strong><small>{discordConnected ? "接続済み" : "未接続"}</small></div></li>
                    <li className={walletConnected ? "is-complete" : ""}><span>{walletConnected ? "✓" : "!"}</span><div><strong>ウォレット署名</strong><small>{walletConnected ? "所有確認済み" : "未設定"}</small></div></li>
                    <li className={passkeyEnabled ? "is-complete" : ""}><span>{passkeyEnabled ? "✓" : "+"}</span><div><strong>パスキー</strong><small>{passkeyEnabled ? "この端末に登録済み" : "未設定・推奨"}</small></div></li>
                  </ul>
                  <button className="primary-button full-width" type="button" onClick={() => setDialog("recovery")}>復旧手段を設定</button>
                </section>
              </div>

              <section className="next-card" aria-labelledby="next-title">
                <div className="next-number" aria-hidden="true">07</div>
                <div>
                  <p className="kicker">NEXT CHALLENGE</p>
                  <h2 id="next-title">次の大会へ</h2>
                  <p>OTOMO ORACLE 7 — ORACLE OPEN #08</p>
                </div>
                <div className="next-date"><small>ENTRY CLOSES</small><strong>07.18</strong><span>あと5日</span></div>
                <button type="button" onClick={() => changeView("tournaments")}>大会情報を見る <span aria-hidden="true">→</span></button>
              </section>
            </div>
          )}

          {activeView === "tournaments" && (
            <div className="view-stack">
              <SectionHeading
                kicker="ARENA ARCHIVE"
                title="大会の記録"
                description="出場した大会と、サーバーで確定した生結果・順位の履歴です。"
                demo
              />
              <section className="season-strip" aria-label="シーズンサマリー">
                <div><small>SEASON</small><strong>2026 / SUMMER</strong></div>
                <div><small>ENTRIES</small><strong>14</strong></div>
                <div><small>CHAMPIONS</small><strong>05</strong></div>
                <div><small>BEST RANK</small><strong>#01</strong></div>
                <button type="button">全期間 <span aria-hidden="true">⌄</span></button>
              </section>
              <section className="records-panel" aria-label="大会履歴一覧">
                <div className="record-labels" aria-hidden="true">
                  <span>GAME / TOURNAMENT</span><span>RESULT</span><span>RAW RESULT</span><span>SGG POINTS</span>
                </div>
                {tournamentRecords.map((record) => (
                  <article className="record-row" key={record.id}>
                    <div className="record-game">
                      <span className={`game-sigil tone-${record.accent}`} aria-hidden="true"><i>7</i></span>
                      <div><strong>{record.game}</strong><span>{record.tournament} · {record.date}</span></div>
                    </div>
                    <div className="record-cell"><small>RESULT</small><strong>{record.result}</strong><span>{record.rank}</span></div>
                    <div className="record-cell"><small>{record.rawLabel}</small><strong>{record.rawValue}</strong><span>FINALIZED</span></div>
                    <div className="record-cell record-point"><small>SGG POINTS</small><strong>+{formatPoints(record.points)}</strong><span>確定</span></div>
                  </article>
                ))}
              </section>
              <p className="data-footnote">順位はウォレット保有やSGGポイントの影響を受けず、各ゲームの生結果だけで確定する設計です。</p>
            </div>
          )}

          {activeView === "assets" && (
            <div className="view-stack">
              <SectionHeading
                kicker="ASSET VAULT"
                title="保有アセット"
                description="ウォレット上の保有物と、ゲーム内で獲得したものを分けて表示します。"
                demo
              />
              <section className="wallet-banner" aria-labelledby="wallet-title">
                <div className="wallet-glyph" aria-hidden="true"><span>◇</span></div>
                <div>
                  <p className="kicker">CONNECTED WALLET</p>
                  <h2 id="wallet-title">{walletConnected ? "0x7E7A ··· A3D9" : "ウォレット未接続"}</h2>
                  <p>{walletConnected ? "所有権確認済み · 最終同期 2026.07.13 09:42" : "接続しなくても大会履歴とランキングは利用できます。"}</p>
                </div>
                <span className={`status-badge${walletConnected ? " is-online" : ""}`}><ConnectionDot active={walletConnected} />{walletConnected ? "CONNECTED" : "OPTIONAL"}</span>
                <button type="button" onClick={toggleWallet}>{walletConnected ? "接続を管理" : "ウォレットを接続"}</button>
              </section>

              {walletConnected ? (
                <>
                  <section className="asset-grid" aria-label="ウォレット保有アセット">
                    <article className="asset-card token-card">
                      <div className="asset-card-top"><span className="asset-glyph"><i>S</i></span><span className="demo-stamp">DEMO</span></div>
                      <p>SGG TOKEN</p>
                      <strong>4,277<small>.00</small></strong>
                      <span>公開前の表示サンプル</span>
                    </article>
                    <article className="asset-card gods-card">
                      <div className="asset-card-top"><span className="asset-glyph"><i>七</i></span><span>WALLET</span></div>
                      <p>SEVENGODS</p>
                      <strong>02<small> ASSETS</small></strong>
                      <span>所有コレクション</span>
                    </article>
                    <article className="asset-card otomo-total-card">
                      <div className="asset-card-top"><span className="asset-glyph"><i>O</i></span><span>WALLET</span></div>
                      <p>OTOMO TOTAL</p>
                      <strong>12<small> ASSETS</small></strong>
                      <span>3形態の合計</span>
                    </article>
                  </section>

                  <section className="panel forms-panel" aria-labelledby="forms-title">
                    <div className="panel-head">
                      <div><p className="kicker">OTOMO FORMS</p><h2 id="forms-title">OTOMO・形態別</h2></div>
                      <span className="snapshot-label">LIVE BALANCE · DEMO</span>
                    </div>
                    <div className="form-grid">
                      {otomoForms.map((form) => (
                        <article className={`form-card tone-${form.tone}`} key={form.code}>
                          <div className="form-symbol" aria-hidden="true">{form.code.slice(0, 1)}</div>
                          <div><small>{form.code}</small><strong>{form.label}</strong></div>
                          <b>{form.count}<small>体</small></b>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <section className="empty-state">
                  <span className="empty-glyph" aria-hidden="true"><i>◇</i></span>
                  <h2>アセットはまだ読み込まれていません</h2>
                  <p>ウォレットを接続すると、SGG Token・OTOMO・SEVENGODSの保有数を確認できます。</p>
                  <button className="primary-button" type="button" onClick={toggleWallet}>デモウォレットを接続</button>
                </section>
              )}

              <section className="panel game-assets-panel" aria-labelledby="game-assets-title">
                <div className="panel-head"><div><p className="kicker">IN-GAME ITEMS</p><h2 id="game-assets-title">ゲーム内獲得アセット</h2></div><span className="snapshot-label">WALLETとは別管理</span></div>
                <div className="empty-inline"><span aria-hidden="true">＋</span><div><strong>獲得アセットはまだありません</strong><p>称号やゲーム内アイテムは、ここにウォレット資産と分けて表示します。</p></div></div>
              </section>
              <p className="data-footnote">ライブ残高と、大会結果確定時の保有スナップショットは別データとして扱います。</p>
            </div>
          )}

          {activeView === "points" && (
            <div className="view-stack">
              <SectionHeading
                kicker="POINT LEDGER"
                title="SGGポイント"
                description="ゲーム結果とコミュニティ活動から付与されたポイントの記録です。"
                demo
              />
              <section className="points-hero" aria-labelledby="points-balance-title">
                <div className="points-balance">
                  <p id="points-balance-title">AVAILABLE SGG POINTS</p>
                  <strong>12,840</strong>
                  <span>確定残高 · DEMO</span>
                </div>
                <div className="points-season">
                  <div><small>2026 SUMMER</small><strong>+3,420</strong><span>今シーズン獲得</span></div>
                  <div><small>NEXT ARCHIVE TIER</small><strong>1,160</strong><span>次の区切りまで</span></div>
                </div>
                <div className="tier-arc" aria-label="次の区切りまで92パーセント">
                  <span>92%</span><small>ARCHIVE<br />PROGRESS</small>
                </div>
              </section>

              <div className="points-layout">
                <section className="panel ledger-panel" aria-labelledby="ledger-title">
                  <div className="panel-head"><div><p className="kicker">TRANSACTIONS</p><h2 id="ledger-title">ポイント明細</h2></div><button className="filter-button" type="button">すべて <span aria-hidden="true">⌄</span></button></div>
                  <div className="ledger-list">
                    {pointLedger.map((item) => (
                      <article className="ledger-row" key={item.id}>
                        <span className={`source-icon is-${item.source.toLowerCase()}`} aria-hidden="true">{item.source === "GAME" ? "G" : "C"}</span>
                        <div className="ledger-main"><strong>{item.title}</strong><span>{item.detail} · {item.date}</span></div>
                        <span className={`source-tag is-${item.source.toLowerCase()}`}>{item.source}</span>
                        <div className="ledger-amount"><strong>+{formatPoints(item.amount)}</strong><span className={item.status === "確定" ? "is-confirmed" : ""}>{item.status}</span></div>
                      </article>
                    ))}
                  </div>
                </section>

                <aside className="points-aside">
                  <section className="panel breakdown-panel">
                    <p className="kicker">SOURCE BREAKDOWN</p><h2>獲得元</h2>
                    <div className="donut" aria-label="ゲーム78%、コミュニティ22%"><span><strong>78%</strong><small>GAME</small></span></div>
                    <div className="legend"><span><i className="game" />ゲーム結果 <b>2,880</b></span><span><i className="community" />コミュニティ <b>820</b></span></div>
                  </section>
                  <section className="points-note">
                    <span aria-hidden="true">i</span>
                    <div><strong>SGG Tokenとは別です</strong><p>SGGポイントは活動記録です。トークン残高、順位、報酬資格を意味しません。</p></div>
                  </section>
                </aside>
              </div>
            </div>
          )}
        </main>

        <footer className="site-footer">
          <span>SGG PLAYER ARCHIVE / STARTER V0.1</span>
          <span>デモデータ · 本番連携前</span>
        </footer>
      </div>

      <nav className="mobile-nav" aria-label="モバイルナビゲーション">
        {navItems.map((item) => (
          <button key={item.id} type="button" className={activeView === item.id ? "is-active" : ""} onClick={() => changeView(item.id)} aria-current={activeView === item.id ? "page" : undefined}>
            <span aria-hidden="true">{item.glyph}</span><strong>{item.label}</strong>
          </button>
        ))}
      </nav>

      {dialog && (
        <div className="modal-backdrop" onMouseDown={() => setDialog(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setDialog(null)} aria-label="閉じる">×</button>
            {dialog === "account" ? (
              <>
                <p className="kicker">IDENTITY LINKS</p><h2 id="modal-title">アカウント連携</h2>
                <p className="modal-intro">表示名ではなく、確認済みの連携情報をプレイヤー記録に結びつけます。</p>
                <div className="modal-identities">
                  <div><span className="identity-icon discord">D</span><div><strong>Discord</strong><small>{discordConnected ? "ZEN_TARO · 接続済み" : "未接続"}</small></div><button type="button" onClick={toggleDiscord}>{discordConnected ? "切断" : "接続"}</button></div>
                  <div><span className="identity-icon wallet">W</span><div><strong>Wallet</strong><small>{walletConnected ? "0x7E7A ··· A3D9 · 確認済み" : "未接続・任意"}</small></div><button type="button" onClick={toggleWallet}>{walletConnected ? "管理" : "接続"}</button></div>
                  <div><span className="identity-icon passkey">P</span><div><strong>Passkey</strong><small>{passkeyEnabled ? "この端末に登録済み" : "未設定・復旧用"}</small></div><button type="button" onClick={() => setDialog("recovery")}>{passkeyEnabled ? "確認" : "追加"}</button></div>
                </div>
                <p className="modal-warning">本番ではDiscordの差し替え・紛失復旧に、再認証、待機期間、監査ログを必須にします。</p>
              </>
            ) : (
              <>
                <p className="kicker">ACCOUNT RECOVERY</p><h2 id="modal-title">復旧手段を設定</h2>
                <p className="modal-intro">Discordに入れなくなった場合に備え、別の端末認証を追加します。</p>
                <div className="recovery-score">
                  <span className="shield-score"><i>{protectionCount}/3</i></span>
                  <div><strong>{protectionCount === 3 ? "保護設定は完了です" : "あと1つ追加をおすすめします"}</strong><p>Discord・ウォレット所有確認・パスキー</p></div>
                </div>
                <ul className="recovery-rules">
                  <li>秘密鍵やシードフレーズは預かりません</li>
                  <li>ウォレット署名だけで自動的にアカウントを移行しません</li>
                  <li>重要な変更は再認証・待機期間・通知の対象です</li>
                </ul>
                {passkeyEnabled ? (
                  <button className="primary-button full-width" type="button" onClick={() => notify("パスキー設定を確認しました")}>登録済みパスキーを確認</button>
                ) : (
                  <button className="primary-button full-width" type="button" onClick={enablePasskey}>この端末にパスキーを追加</button>
                )}
                <p className="demo-action-note">この操作は画面確認用のデモです。</p>
              </>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>{toast}<button type="button" onClick={() => setToast(null)} aria-label="通知を閉じる">×</button>
        </div>
      )}
    </div>
  );
}
