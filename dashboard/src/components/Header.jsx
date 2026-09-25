import './Header.css';

export default function Header({ onRunPipeline, isRunning }) {
  return (
    <header className="header">
      <div className="header-logo">
        <div className="header-logo-icon">📊</div>
        <div>
          <div className="header-title">Pulse Dashboard</div>
          <div className="header-subtitle">Mobile Store Feedback Intelligence</div>
        </div>
      </div>

      <div className="header-right">
        <div className="live-badge">
          <span className="live-dot" />
          Live
        </div>
        <button
          className="run-btn"
          onClick={onRunPipeline}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <span className="spinner" />
              Running Pipeline…
            </>
          ) : (
            <>
              ⚡ Run Pipeline
            </>
          )}
        </button>
      </div>
    </header>
  );
}
