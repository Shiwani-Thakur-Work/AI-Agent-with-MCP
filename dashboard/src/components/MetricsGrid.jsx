import './MetricsGrid.css';

export default function MetricsGrid({ pulse }) {
  const { totalReviews, playStore, appStore, sentiment } = pulse;
  const topTheme = pulse.themes[0];

  return (
    <div className="metrics-grid">
      {/* Total Reviews */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-label">Total Reviews</span>
          <div className="metric-icon" style={{ background: 'rgba(124,93,250,0.12)', color: 'var(--accent-purple)' }}>
            💬
          </div>
        </div>
        <div className="metric-value" style={{ color: 'var(--accent-purple-light)' }}>
          {totalReviews.toLocaleString()}
        </div>
        <div className="metric-sub">
          <strong style={{ color: 'var(--accent-green)' }}>▲ {playStore}</strong> Play Store &nbsp;·&nbsp;
          <strong style={{ color: 'var(--accent-blue)' }}>{appStore}</strong> App Store
        </div>
      </div>

      {/* Sentiment */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-label">Sentiment Split</span>
          <div className="metric-icon" style={{ background: 'rgba(34,211,160,0.12)', color: 'var(--accent-green)' }}>
            😊
          </div>
        </div>
        <div className="metric-value" style={{ color: 'var(--accent-green)' }}>
          {sentiment.positive}%
        </div>
        <div className="sentiment-bar-row">
          <div className="sentiment-seg" style={{ width: `${sentiment.positive}%`, background: 'var(--accent-green)' }} />
          <div className="sentiment-seg" style={{ width: `${sentiment.neutral}%`, background: 'var(--text-muted)' }} />
          <div className="sentiment-seg" style={{ width: `${sentiment.negative}%`, background: 'var(--accent-rose)' }} />
        </div>
        <div className="metric-sub">
          <span className="trend-up">{sentiment.positive}% positive</span>
          &nbsp;·&nbsp;
          <span className="trend-down">{sentiment.negative}% negative</span>
        </div>
      </div>

      {/* Top Theme */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-label">Top Issue</span>
          <div className="metric-icon" style={{ background: 'rgba(244,63,94,0.12)', color: 'var(--accent-rose)' }}>
            🔥
          </div>
        </div>
        <div className="metric-value" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
          {topTheme.title}
        </div>
        <div className="metric-sub">
          <span style={{ color: topTheme.color, fontWeight: 700 }}>{topTheme.percentage}%</span>
          {' '}of negative reviews
        </div>
      </div>

      {/* Themes Identified */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-label">Themes Found</span>
          <div className="metric-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--accent-amber)' }}>
            🧩
          </div>
        </div>
        <div className="metric-value" style={{ color: 'var(--accent-amber)' }}>
          {pulse.themes.length}
        </div>
        <div className="metric-sub">
          Analysed by Groq LLM &nbsp;·&nbsp; <strong style={{ color: 'var(--accent-green)' }}>✓ Exported</strong>
        </div>
      </div>
    </div>
  );
}
