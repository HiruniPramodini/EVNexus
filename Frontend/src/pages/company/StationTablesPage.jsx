import React from 'react';
import { RefreshCw, MapPin, DollarSign } from 'lucide-react';
import { useStations } from '../../hooks/useReport';

const money = (v) => (v === undefined || v === null || v === '' ? '—' : `$${Number(v).toFixed(2)}`);

function Wrap({ title, subtitle, icon, loading, error, onRefresh, children }) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <h3 className="dash-card-title">{icon} {title}</h3>
          <p className="dash-card-subtitle">{subtitle}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onRefresh} title="Refresh">
          <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
        </button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw className="spinner" size={24} /></div>
      ) : children}
    </div>
  );
}

// Task 125: price list
export function PriceListPage() {
  const { stations, loading, error, refetch } = useStations();
  return (
    <Wrap title="Charging Point Price List" subtitle="Current configured price per kWh for each station."
      icon={<DollarSign size={18} color="#d97706" />} loading={loading} error={error} onRefresh={refetch}>
      <div className="dash-table-wrapper">
        <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
          <thead>
            <tr><th>Station</th><th>Connector</th><th>Standard / Peak</th><th>Off-peak</th></tr>
          </thead>
          <tbody>
            {stations.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No stations yet.</td></tr>
            )}
            {stations.map((s) => {
              const hasPeak = s.peakPricePerKwh != null || s.offPeakPricePerKwh != null;
              return (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.connectorType} · {s.capacityKw} kW</td>
                  <td>
                    {money(hasPeak ? s.peakPricePerKwh : s.pricePerKwh)} / kWh{' '}
                    <span className="badge badge-info">{hasPeak ? 'Peak' : 'Flat rate'}</span>
                  </td>
                  <td>
                    {hasPeak
                      ? <>{money(s.offPeakPricePerKwh)} / kWh <span className="badge badge-success">Off-peak</span></>
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Wrap>
  );
}

// Task 126: location table
export function LocationTablePage({ onEditStation }) {
  const { stations, loading, error, refetch } = useStations();
  return (
    <Wrap title="Charging Point Locations" subtitle="Where each of your stations is located."
      icon={<MapPin size={18} color="#0284c7" />} loading={loading} error={error} onRefresh={refetch}>
      <div className="dash-table-wrapper">
        <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
          <thead>
            <tr><th>Station</th><th>Address</th><th>Coordinates</th><th></th></tr>
          </thead>
          <tbody>
            {stations.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You have no stations yet.</td></tr>
            )}
            {stations.map((s) => {
              const ok = s.latitude != null && s.longitude != null;
              return (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.address || 'Address unavailable'}</td>
                  <td style={{ fontFamily: 'monospace' }}>
                    {ok ? `${Number(s.latitude).toFixed(5)}, ${Number(s.longitude).toFixed(5)}` : 'Unavailable'}
                  </td>
                  <td>
                    <button type="button" className="btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => onEditStation && onEditStation(s)}>
                      View / Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Wrap>
  );
}

export default PriceListPage;