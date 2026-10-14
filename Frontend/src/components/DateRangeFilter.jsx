import React, { useState } from 'react';

export const toYmd = (d) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6); // default last 7 days
  return { from: toYmd(from), to: toYmd(to) };
};

export default function DateRangeFilter({ value, onApply, children }) {
  const [draft, setDraft] = useState(value);
  const [err, setErr] = useState(null);

  const apply = () => {
    if (!draft.from || !draft.to) return setErr('Please select both dates.');
    if (draft.to < draft.from) return setErr('End date cannot be earlier than start date.');
    setErr(null);
    onApply(draft);
  };
  const reset = () => {
    const r = defaultRange();
    setDraft(r);
    setErr(null);
    onApply(r);
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">From</label>
          <input type="date" className="form-input" value={draft.from} max={draft.to || undefined}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">To</label>
          <input type="date" className="form-input" value={draft.to} min={draft.from || undefined}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <button type="button" className="submit-btn" style={{ width: 'auto', margin: 0 }} onClick={apply}>Apply</button>
        <button type="button" className="btn-secondary" onClick={reset}>Last 7 days</button>
        {children}
      </div>
      {err && <div className="alert alert-danger" style={{ marginTop: '0.8rem' }}>{err}</div>}
    </div>
  );
}