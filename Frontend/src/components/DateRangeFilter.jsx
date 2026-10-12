import React from 'react';
import { defaultRange, isInvalidRange } from '../utils/dateRange';

export default function DateRangeFilter({ from, to, onChange }) {
  const invalid = isInvalidRange({ from, to });
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <div>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>From</label>
          <input type="date" className="form-input" value={from}
            onChange={e => onChange({ from: e.target.value, to })} />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>To</label>
          <input type="date" className="form-input" value={to}
            onChange={e => onChange({ from, to: e.target.value })} />
        </div>
        <button type="button" className="btn-secondary" onClick={() => onChange(defaultRange())}>
          Reset to last 7 days
        </button>
      </div>
      {invalid && (
        <div className="alert alert-danger" style={{ marginTop: '0.75rem' }}>
          End date cannot be earlier than start date.
        </div>
      )}
    </div>
  );
}