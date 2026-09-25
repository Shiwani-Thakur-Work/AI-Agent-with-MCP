import './ReportPanel.css';

function parseEmailDraft(raw) {
  const lines = raw.split('\n');
  const subjectLine = lines.find(l => l.startsWith('Subject:'));
  const subject = subjectLine ? subjectLine.replace('Subject:', '').trim() : '';
  const body = lines.slice(lines.indexOf(subjectLine) + 2).join('\n');
  return { subject, body };
}

export function ReportAndEmailPanel({ pulse }) {
  const { report, emailDraft, docUrl } = pulse;
  const { subject, body } = parseEmailDraft(emailDraft);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="bottom-grid">
      {/* Report */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">📄 Generated Report</span>
          <div className="panel-actions">
            <button className="panel-btn" onClick={() => handleCopy(report)}>Copy</button>
            {docUrl && (
              <a className="panel-btn primary" href={docUrl} target="_blank" rel="noreferrer">
                Open in Docs ↗
              </a>
            )}
          </div>
        </div>
        <div className="panel-body">
          <pre className="report-text">{report}</pre>
        </div>
      </div>

      {/* Email */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">✉️ Email Draft</span>
          <div className="panel-actions">
            <button className="panel-btn" onClick={() => handleCopy(emailDraft)}>Copy</button>
            <button className="panel-btn primary">Open in Gmail ↗</button>
          </div>
        </div>
        <div className="panel-body">
          <div className="email-to-row">
            <span className="email-label">To</span>
            <span className="email-val">shiwanithakur5498@gmail.com</span>
          </div>
          <div className="email-subject">{subject}</div>
          <div className="email-body">{body}</div>
          {docUrl && (
            <a className="email-doc-link" href={docUrl} target="_blank" rel="noreferrer">
              🔗 View Full Report in Google Docs
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function HistoryPanel({ history, activeId, onSelect }) {
  return (
    <div className="history-section">
      <div className="section-header">
        <h2 className="section-title">🕐 Pulse History</h2>
        <span className="section-badge">{history.length} runs</span>
      </div>
      <div className="history-list">
        {history.map((h) => (
          <div
            key={h.id}
            className={`history-item ${h.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(h)}
          >
            <div className="history-dot" />
            <div className="history-info">
              <div className="history-week">{h.week}</div>
              <div className="history-meta">
                {h.totalReviews} reviews · {h.themes.length} themes · {h.sentiment.positive}% positive
              </div>
            </div>
            {h.docUrl && <span className="history-badge">📄 Doc</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
