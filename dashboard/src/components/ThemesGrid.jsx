import './ThemesGrid.css';

const RANKS = ['#1', '#2', '#3', '#4', '#5'];

export default function ThemesGrid({ themes, week }) {
  return (
    <div className="themes-section">
      <div className="section-header">
        <h2 className="section-title">🧠 Key Themes — <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{week}</span></h2>
        <span className="section-badge">{themes.length} themes detected</span>
      </div>

      <div className="themes-grid">
        {themes.map((theme, i) => {
          const alphaHex = '20';
          return (
            <div
              key={theme.id}
              className="theme-card"
              style={{
                '--theme-color': theme.color,
                '--theme-color-alpha': `${theme.color}${alphaHex}`,
              }}
            >
              <div className="theme-top">
                <div className="theme-emoji">{theme.icon}</div>
                <span className="theme-rank">{RANKS[i]} Theme</span>
              </div>

              <div>
                <div className="theme-title">{theme.title}</div>
                <div className="theme-desc" style={{ marginTop: 6 }}>{theme.description}</div>
              </div>

              <div className="theme-bar-wrap">
                <div className="theme-bar-label">
                  <span>% of negative reviews</span>
                  <strong>{theme.percentage}%</strong>
                </div>
                <div className="theme-bar-bg">
                  <div className="theme-bar-fill" style={{ width: `${theme.percentage}%` }} />
                </div>
              </div>

              <div className="theme-quotes">
                {theme.quotes.slice(0, 2).map((q, qi) => (
                  <div key={qi} className="theme-quote">"{q}"</div>
                ))}
              </div>

              <div className="theme-action">
                <span className="theme-action-icon">💡</span>
                <span className="theme-action-text">{theme.actionItem}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
