import './TrendChart.css';

const THEME_IDS = ['ads', 'playback', 'discovery', 'ui', 'offline'];
const THEME_META = {
  ads:       { label: 'Ads & Premium',     icon: '📢', color: '#f43f5e' },
  playback:  { label: 'Playback Bugs',     icon: '🔧', color: '#f59e0b' },
  discovery: { label: 'Discovery',         icon: '🎯', color: '#7c5dfa' },
  ui:        { label: 'UI & Navigation',   icon: '🖥️', color: '#3b82f6' },
  offline:   { label: 'Offline / Downloads', icon: '📥', color: '#22d3a0' },
};

export default function TrendChart({ history }) {
  // Build rows: one per theme that appears in at least one week
  const seen = new Set(history.flatMap(h => h.themes.map(t => t.id)));
  const rows = THEME_IDS.filter(id => seen.has(id));

  const maxPct = 60; // normalise bar heights against this

  return (
    <div className="trend-section">
      <div className="section-header">
        <h2 className="section-title">📈 Theme Trends — All Weeks</h2>
        <span className="section-badge">Last {history.length} runs</span>
      </div>

      <div className="trend-chart">
        {rows.map(themeId => {
          const meta = THEME_META[themeId];
          return (
            <div key={themeId} className="trend-rows">
              <div className="trend-row">
                <div className="trend-row-label">
                  {meta.icon} {meta.label}
                </div>
                <div className="trend-row-bars">
                  {[...history].reverse().map((week) => {
                    const theme = week.themes.find(t => t.id === themeId);
                    const pct = theme ? theme.percentage : 0;
                    const h = Math.round((pct / maxPct) * 100);
                    return (
                      <div key={week.id} className="trend-bar-group">
                        <div
                          className="trend-bar"
                          data-tip={`${pct}%`}
                          style={{
                            height: `${h}%`,
                            background: pct > 0
                              ? `linear-gradient(180deg, ${meta.color}, ${meta.color}88)`
                              : 'rgba(255,255,255,0.05)',
                            opacity: pct > 0 ? 1 : 0.3,
                          }}
                        />
                        <div className="trend-bar-label">
                          {week.date.slice(5).replace('-', '/')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        <div className="trend-legend">
          {rows.map(id => (
            <div key={id} className="legend-item">
              <div className="legend-dot" style={{ background: THEME_META[id].color }} />
              {THEME_META[id].label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
