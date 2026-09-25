import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Settings2, Compass, LayoutPanelTop, WifiOff, Activity, FileText, CreditCard, HelpCircle } from 'lucide-react';
import './index.css';
import './App.css';
import { mockHistory } from './data/mockData';

const API = 'http://localhost:3001';

function useApi() {
    const [history, setHistory]   = useState(mockHistory);   // fallback to mock
    const [loading, setLoading]   = useState(true);
    const [apiOnline, setApiOnline] = useState(false);

    const fetchAll = useCallback(async () => {
        try {
            const [hRes, pRes] = await Promise.all([
                fetch(`${API}/api/history`),
                fetch(`${API}/api/pulse`),
            ]);
            if (!hRes.ok || !pRes.ok) throw new Error('API error');

            const historyData = await hRes.json();
            const latestData  = await pRes.json();

            // Merge: latest at top, deduplicate by id
            const merged = [latestData, ...historyData.filter(h => h.id !== latestData.id)];
            setHistory(merged);
            setApiOnline(true);
        } catch {
            // API not running — fall back to mock data silently
            setApiOnline(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    return { history, loading, apiOnline, refetch: fetchAll };
}


/* ─── Helpers ─── */
const THEME_COLORS = {
  ads:       '#e5534b',
  playback:  '#d4880a',
  discovery: '#c9a84c',
  ui:        '#4a90e2',
  offline:   '#1db954',
  performance: '#e5534b',
  content:   '#c9a84c',
  pricing:   '#e5534b',
  support:   '#4a90e2'
};

const THEME_IDS = ['ads','playback','discovery','ui','offline','performance','content','pricing','support'];
const THEME_META = {
  ads:       { label: 'Ads & Premium Pressure', Icon: Megaphone },
  playback:  { label: 'Playback & Reliability', Icon: Settings2 },
  discovery: { label: 'Discovery & Personalisation', Icon: Compass },
  ui:        { label: 'UI & Navigation', Icon: LayoutPanelTop },
  offline:   { label: 'Offline & Downloads', Icon: WifiOff },
  performance: { label: 'App Performance', Icon: Activity },
  content:   { label: 'Content Library', Icon: FileText },
  pricing:   { label: 'Pricing & Subscriptions', Icon: CreditCard },
  support:   { label: 'Customer Support', Icon: HelpCircle }
};

function parseEmail(raw) {
  const lines = raw.split('\n');
  const si = lines.findIndex(l => l.startsWith('Subject:'));
  const subject = si >= 0 ? lines[si].replace('Subject:', '').trim() : '';
  const bodyLines = si >= 0 ? lines.slice(si + 2) : lines;
  // Split signature from body
  const sigIdx = bodyLines.findIndex(l => /^(Best|Thanks|Regards|Warm),?$/i.test(l.trim()));
  const body = sigIdx >= 0 ? bodyLines.slice(0, sigIdx).join('\n').trim() : bodyLines.join('\n').trim();
  const sig  = sigIdx >= 0 ? bodyLines.slice(sigIdx).join('\n').trim() : '';
  return { subject, body, sig };
}

/* ─── Sub-views ─── */
function OverviewTab({ pulse }) {
  const { totalReviews, playStore, appStore, sentiment, themes, week } = pulse;
  return (
    <div>
      <div className="section-head">
        <div className="section-title">Weekly Pulse — <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{week}</span></div>
        <div className="section-sub">{totalReviews} reviews analysed across Google Play and Apple App Store</div>
      </div>

      {/* KPI row */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-label">Total Reviews</div>
          <div className="metric-val" style={{ color: 'var(--gold)' }}>{totalReviews}</div>
          <div className="metric-sub">▴ {playStore} Play &nbsp;·&nbsp; {appStore} App Store</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Positive Sentiment</div>
          <div className="metric-val" style={{ color: 'var(--green)' }}>{sentiment.positive}%</div>
          <div className="sent-bar" style={{ marginTop: 4 }}>
            <div className="sent-seg" style={{ width: `${sentiment.positive}%`, background: 'var(--green)', height: 4 }} />
            <div className="sent-seg" style={{ width: `${sentiment.neutral}%`,  background: '#444', height: 4 }} />
            <div className="sent-seg" style={{ width: `${sentiment.negative}%`, background: 'var(--rose)', height: 4 }} />
          </div>
          <div className="metric-sub">{sentiment.negative}% negative</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Top Issue</div>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{themes[0].title}</div>
          <div className="metric-sub" style={{ color: THEME_COLORS[themes[0].id] }}>{themes[0].percentage}% of negative reviews</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Themes Found</div>
          <div className="metric-val" style={{ color: 'var(--gold)' }}>{themes.length}</div>
          <div className="metric-sub">Groq LLM · LLaMA 3.3 70B</div>
        </div>
      </div>

      {/* Theme bars summary */}
      <div className="run-card">
        <div className="run-card-top">
          <div className="run-card-title">Theme Breakdown</div>
          <div className="run-tag">Latest Run</div>
        </div>
        <div className="run-themes">
          {themes.map(t => (
            <div key={t.id} className="run-theme-row">
              <div className="run-theme-name">{t.title}</div>
              <div className="run-bar-bg">
                <div className="run-bar-fill" style={{ width: `${t.percentage}%`, background: THEME_COLORS[t.id] }} />
              </div>
              <div className="run-bar-pct" style={{ color: THEME_COLORS[t.id] }}>{t.percentage}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemesTab({ themes }) {
  return (
    <div>
      <div className="section-head">
        <div className="section-title">Key Themes</div>
        <div className="section-sub">Recurring patterns extracted from user reviews, ranked by prevalence</div>
      </div>
      <div className="themes-grid">
        {themes.map((t, i) => {
          const color = THEME_COLORS[t.id] || '#c9a84c';
          const Icon = THEME_META[t.id]?.Icon || HelpCircle;
          return (
            <div key={t.id} className="theme-card" style={{ borderTop: `2px solid ${color}` }}>
              <div className="theme-card-top">
                <span className="theme-rank-badge">#{i + 1} Theme</span>
                <span style={{ color: color, display: 'flex' }}><Icon size={22} strokeWidth={1.5} /></span>
              </div>
              <div>
                <div className="theme-name">{t.title}</div>
                <div className="theme-desc" style={{ marginTop: 6 }}>{t.description}</div>
              </div>
              <div className="theme-bar-wrap">
                <div className="theme-bar-meta">
                  <span>% of negative reviews</span>
                  <strong style={{ color }}>{t.percentage}%</strong>
                </div>
                <div className="theme-bg">
                  <div className="theme-fill" style={{ width: `${t.percentage}%`, background: color }} />
                </div>
              </div>
              <div className="theme-quotes">
                {t.quotes.map((q, qi) => (
                  <div key={qi} className="theme-quote" style={{ borderColor: color }}>"{q}"</div>
                ))}
              </div>
              <div className="theme-action">
                <span className="theme-action-label">Action</span>
                <span className="theme-action-text">{t.actionItem}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportTab({ pulse }) {
  const { report, docUrl, themes } = pulse;
  const copy = () => navigator.clipboard.writeText(report).catch(() => {});

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Generated Report</div>
        <div className="section-sub">Structured analysis ready to share with your product team</div>
      </div>
      <div className="report-panel">
        <div className="report-panel-header">
          <span className="report-panel-title">Weekly Mobile-Store Feedback Pulse</span>
          <div className="btn-actions">
            <button className="btn-sm" onClick={copy}>Copy Text</button>
            {docUrl && (
              <a className="btn-sm gold" href={docUrl} target="_blank" rel="noreferrer">Open in Google Docs ↗</a>
            )}
          </div>
        </div>
        <div className="report-body">
          {/* Top Themes */}
          <div className="report-section">
            <div className="report-section-title">Top Themes</div>
            <div className="report-themes-list">
              {themes.map((t, i) => (
                <div key={t.id} className="report-theme-item">
                  <div className="report-theme-title" style={{ color: THEME_COLORS[t.id] }}>
                    {i + 1}. {t.title} <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>— {t.percentage}% of negative reviews</span>
                  </div>
                  <div className="report-theme-desc">{t.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* User Voices */}
          <div className="report-section">
            <div className="report-section-title">User Voices</div>
            <div className="quote-list">
              {themes.flatMap(t => t.quotes.slice(0, 1)).map((q, i) => (
                <div key={i} className="quote-item">"{q}"</div>
              ))}
            </div>
          </div>

          {/* Action Items */}
          <div className="report-section">
            <div className="report-section-title">Action Items</div>
            <div className="actions-list">
              {themes.map((t, i) => (
                <div key={t.id} className="action-item">
                  <span className="action-num">{i + 1}.</span>
                  <span className="action-text"><strong style={{ color: 'var(--text-1)' }}>{t.title}:</strong> {t.actionItem}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailTab({ pulse }) {
  const { emailDraft, docUrl } = pulse;
  const { subject, body, sig } = parseEmail(emailDraft);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(emailDraft).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const [sigName, ...sigRest] = sig.split('\n').filter(Boolean);

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Email Draft</div>
        <div className="section-sub">Ready to review and send from your Gmail drafts</div>
      </div>
      <div className="email-panel">
        {/* Meta */}
        <div className="email-meta">
          <div className="email-meta-row">
            <span className="email-meta-label">To</span>
            <span className="email-meta-val">shiwanithakur5498@gmail.com</span>
          </div>
          <div className="email-meta-row">
            <span className="email-meta-label">Subject</span>
            <span className="email-subject-val">{subject}</span>
          </div>
        </div>
        {/* Actions bar */}
        <div className="email-actions">
          <span className="email-actions-label">Saved to Gmail Drafts automatically</span>
          <div className="btn-actions">
            <button className="btn-sm" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
            <button className="btn-sm gold">Open Gmail ↗</button>
          </div>
        </div>
        {/* Body */}
        <div className="email-body-wrap">
          <div className="email-body-text">{body}</div>
          {docUrl && (
            <a className="email-doc-link" href={docUrl} target="_blank" rel="noreferrer">
              View Full Report in Google Docs →
            </a>
          )}
          {sig && (
            <div className="email-sig">
              <div className="email-sig-name">{sigName}</div>
              {sigRest.map((l, i) => (
                <div key={i} className="email-sig-title">{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ history, activeId, onSelect }) {
  return (
    <div>
      <div className="section-head">
        <div className="section-title">Pulse History</div>
        <div className="section-sub">Click any week to view its full report on the other tabs</div>
      </div>
      <div className="history-list">
        {history.map((h, i) => (
          <div key={h.id} className={`history-item${h.id === activeId ? ' active' : ''}`} onClick={() => onSelect(h)}>
            <div className="history-num">W{history.length - i}</div>
            <div className="history-info">
              <div className="history-week">{h.week}</div>
              <div className="history-meta">{h.totalReviews} reviews · {h.themes.length} themes · {h.sentiment.positive}% positive · {h.sentiment.negative}% negative</div>
            </div>
            <div className="history-right">
              {h.docUrl && <span className="history-chip">Doc ✓</span>}
              <span className="history-arrow">›</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendsTab({ history }) {
  const seen = new Set(history.flatMap(h => h.themes.map(t => t.id)));
  const rows = THEME_IDS.filter(id => seen.has(id));
  const weeks = [...history].reverse(); // oldest → newest
  const MAX_BAR = 50; // px max bar height

  // Compute max pct across all data for normalisation
  const allPcts = rows.flatMap(id => weeks.map(w => w.themes.find(t => t.id === id)?.percentage || 0));
  const maxPct  = Math.max(...allPcts, 10);

  // Delta: latest vs previous week
  const delta = (id) => {
    if (weeks.length < 2) return null;
    const latest = weeks[weeks.length - 1].themes.find(t => t.id === id)?.percentage || 0;
    const prev   = weeks[weeks.length - 2].themes.find(t => t.id === id)?.percentage || 0;
    return latest - prev;
  };

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Theme Trends</div>
        <div className="section-sub">Week-over-week prevalence of each theme across all pipeline runs</div>
      </div>

      {/* ── Grouped Bar Chart ── */}
      <div className="tc-wrap">
        {/* Y-axis labels */}
        <div className="tc-yaxis">
          {[50, 40, 30, 20, 10, 0].map(v => (
            <div key={v} className="tc-ylabel">{v}%</div>
          ))}
        </div>

        {/* Chart area */}
        <div className="tc-chart">
          {/* Grid lines */}
          <div className="tc-grid">
            {[0,1,2,3,4,5].map(i => <div key={i} className="tc-gridline" />)}
          </div>

          {/* Grouped bars — one group per week */}
          <div className="tc-groups">
            {weeks.map((w) => (
              <div key={w.id} className="tc-group">
                <div className="tc-group-bars">
                  {rows.map(id => {
                    const t   = w.themes.find(x => x.id === id);
                    const pct = t ? t.percentage : 0;
                    const hPx = Math.round((pct / maxPct) * 120); // 120px max
                    return (
                      <div key={id} className="tc-bar-slot" title={`${THEME_META[id].label}: ${pct}%`}>
                        <div className="tc-bar-value" style={{ opacity: pct > 0 ? 1 : 0 }}>
                          {pct > 0 ? `${pct}%` : ''}
                        </div>
                        <div
                          className="tc-bar"
                          style={{
                            height: hPx || 2,
                            background: pct > 0 ? THEME_COLORS[id] : 'rgba(255,255,255,0.06)',
                            opacity: pct > 0 ? 1 : 0.4,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="tc-week-label">
                  {w.date ? w.date.slice(5).replace('-', '/') : w.week.slice(-5)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="tc-legend">
        {rows.map(id => (
          <div key={id} className="tc-legend-item">
            <div className="tc-legend-dot" style={{ background: THEME_COLORS[id] }} />
            <span>{THEME_META[id].label}</span>
          </div>
        ))}
      </div>

      {/* ── Comparison Table ── */}
      <div className="tc-table-wrap">
        <div className="tc-table-header">
          <div className="section-title" style={{ fontSize: 14 }}>Comparison Table</div>
        </div>
        <table className="tc-table">
          <thead>
            <tr>
              <th className="tc-th tc-th-label">Theme</th>
              {weeks.map(w => (
                <th key={w.id} className="tc-th">{w.date ? w.date.slice(5).replace('-', '/') : '—'}</th>
              ))}
              <th className="tc-th">vs prev</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(id => {
              const color = THEME_COLORS[id];
              const d = delta(id);
              return (
                <tr key={id} className="tc-tr">
                  <td className="tc-td tc-td-label">
                    <span className="tc-dot" style={{ background: color }} />
                    {THEME_META[id].label}
                  </td>
                  {weeks.map(w => {
                    const t   = w.themes.find(x => x.id === id);
                    const pct = t ? t.percentage : null;
                    return (
                      <td key={w.id} className="tc-td">
                        {pct != null
                          ? <span className="tc-cell" style={{ background: `${color}20`, color }}>{pct}%</span>
                          : <span className="tc-cell-empty">—</span>
                        }
                      </td>
                    );
                  })}
                  <td className="tc-td">
                    {d != null && (
                      <span className={`tc-delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}`}>
                        {d > 0 ? '↑' : d < 0 ? '↓' : '→'} {Math.abs(d)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Root ─── */
const TABS = [
  { id: 'overview', label: 'Overview',  icon: '◈' },
  { id: 'themes',   label: 'Themes',    icon: '◉' },
  { id: 'report',   label: 'Report',    icon: '◧' },
  { id: 'email',    label: 'Email',     icon: '◫' },
  { id: 'trends',   label: 'Trends',    icon: '◬' },
  { id: 'history',  label: 'History',   icon: '◷' },
];

export default function App() {
  const { history, loading, apiOnline, refetch } = useApi();
  const [active, setActive] = useState(null);
  const [tab,    setTab]    = useState('overview');
  const [running, setRunning] = useState(false);
  const [toast,   setToast]   = useState(null);

  // Set active to first history item once loaded
  useEffect(() => {
    if (history.length && !active) setActive(history[0]);
  }, [history]);

  const showToast = (type, text, ms = 5000) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), ms);
  };

  const handleRun = async () => {
    if (!apiOnline) {
      showToast('error', '⚠️  API server is offline. Run: node server.js in the project folder.');
      return;
    }
    setRunning(true);
    showToast('info', '⚡ Pipeline started — fetching reviews and analysing with Groq LLM…', 120000);

    try {
      await fetch(`${API}/api/run`, { method: 'POST' });

      // Poll until done
      const poll = setInterval(async () => {
        try {
          const s = await fetch(`${API}/api/status`).then(r => r.json());
          if (!s.running) {
            clearInterval(poll);
            setRunning(false);
            if (s.last?.success) {
              showToast('success', '✅ Pipeline complete! Report written to Google Docs and Gmail draft created.');
              await refetch();
            } else {
              showToast('error', `❌ Pipeline failed: ${s.last?.message || 'Unknown error'}`);
            }
          }
        } catch { clearInterval(poll); setRunning(false); }
      }, 3000);
    } catch {
      setRunning(false);
      showToast('error', '❌ Could not reach API server.');
    }
  };

  if (loading || !active) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, margin: '0 auto 12px', borderColor: 'rgba(201,168,76,0.25)', borderTopColor: 'var(--gold)' }} />
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading pulse data…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="header-brand-mark">♪</div>
          <div>
            <div className="header-brand-name">Pulse</div>
            <div className="header-brand-sub">Spotify Feedback Intelligence</div>
          </div>
        </div>
        <div className="header-right">
          <div className={`badge-live${apiOnline ? '' : ' badge-offline'}`}>
            <span className="badge-live-dot" style={{ background: apiOnline ? 'var(--green)' : '#e5534b' }} />
            {apiOnline ? 'API Live' : 'Mock Data'}
          </div>
          <button className="btn-run" onClick={handleRun} disabled={running}>
            {running ? <><span className="spinner" /> Running…</> : '⚡ Run Pipeline'}
          </button>
        </div>
      </header>

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}

      {/* Tabs */}
      <nav className="tabs-nav">
        {TABS.map(t => (
          <button key={t.id} className={`tab-item${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="main" key={tab + active.id}>
        {tab === 'overview' && <OverviewTab pulse={active} />}
        {tab === 'themes'   && <ThemesTab  themes={active.themes} />}
        {tab === 'report'   && <ReportTab  pulse={active} />}
        {tab === 'email'    && <EmailTab   pulse={active} />}
        {tab === 'trends'   && <TrendsTab  history={history} />}
        {tab === 'history'  && <HistoryTab history={history} activeId={active.id} onSelect={w => { setActive(w); setTab('overview'); }} />}
      </main>

      <footer className="footer">
        Built by Shiwani, Product Manager &nbsp;·&nbsp; Groq LLM + MCP + Google Workspace
        {!apiOnline && <span style={{ color: 'var(--text-3)', marginLeft: 12 }}>· Run <code style={{ background: '#222', padding: '1px 5px', borderRadius: 4 }}>node server.js</code> to enable live data</span>}
      </footer>
    </div>
  );
}
