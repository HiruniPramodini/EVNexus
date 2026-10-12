import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import { defaultRange, isInvalidRange } from '../../utils/dateRange';
import {
  getTrafficTable, getPriceList, getLocationTable, getDailyUsage, downloadCsv
} from '../../services/dashboardApi';

function DataTable({ title, subtitle, columns, rows, onExport, loading }) {
  return (
    <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
      <div className="dash-card-header">
        <div>
          <h3 className="dash-card-title">{title}</h3>
          <p className="dash-card-subtitle">{subtitle}</p>
        </div>
        {onExport && (
          <button type="button" className="btn-secondary" onClick={onExport} disabled={loading || !rows.length}>
            <Download size={14} style={{ display: 'inline', marginRight: '0.3rem' }} /> Export CSV
          </button>
        )}
      </div>
      <div className="dash-table-wrapper">
        <table className="dash-table">
          <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <RefreshCw size={20} className="spinner" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data for this range.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i}>{columns.map(c => <td key={c.key}>{c.render ? c.render(r[c.key], r) : r[c.key]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const money = (v) => `$${Number(v).toFixed(2)}`;

export default function CompanyReportsPage() {
  const [range, setRange] = useState(defaultRange());   // default: last 7 days
  const [traffic, setTraffic] = useState([]);
  const [prices, setPrices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (isInvalidRange(range)) return;   // end < start: don't call the backend
    setLoading(true);
    setError(null);
    try {
      const [t, p, l, d] = await Promise.all([
        getTrafficTable(range.from, range.to),
        getPriceList(),
        getLocationTable(),
        getDailyUsage(range.from, range.to)
      ]);
      setTraffic(t); setPrices(p); setLocations(l); setDaily(d);
    } catch (e) {
      setError(e.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const suffix = `${range.from || 'all'}_${range.to || 'all'}`;

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title"><BarChart3 size={18} /> Company Reports</h3>
            <p className="dash-card-subtitle">Traffic, pricing, locations and daily usage for your charging points.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={load}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
          </button>
        </div>
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      <DataTable
        loading={loading}
        title="Charging Point Traffic" subtitle="Sessions, energy and revenue per charger (SCRUM-124)"
        columns={[
          { key: 'stationName', label: 'Station' },
          { key: 'chargerId', label: 'Charger' },
          { key: 'type', label: 'Type' },
          { key: 'sessions', label: 'Sessions' },
          { key: 'energyKwh', label: 'Energy (kWh)' },
          { key: 'revenue', label: 'Revenue', render: money }
        ]}
        rows={traffic}
        onExport={() => downloadCsv(`traffic_${suffix}.csv`, traffic)}
      />

      <DataTable
        loading={loading}
        title="Charging Point Price List" subtitle="Current price per kWh (SCRUM-125)"
        columns={[
          { key: 'stationName', label: 'Station' },
          { key: 'chargerId', label: 'Charger' },
          { key: 'type', label: 'Type' },
          { key: 'powerKw', label: 'Power (kW)' },
          { key: 'pricePerKwh', label: 'Price / kWh', render: money }
        ]}
        rows={prices}
        onExport={() => downloadCsv('price_list.csv', prices)}
      />

      <DataTable
        loading={loading}
        title="Charging Point Locations" subtitle="Where your stations are (SCRUM-126)"
        columns={[
          { key: 'name', label: 'Station' },
          { key: 'address', label: 'Address' },
          { key: 'latitude', label: 'Latitude' },
          { key: 'longitude', label: 'Longitude' },
          { key: 'status', label: 'Status' }
        ]}
        rows={locations}
        onExport={() => downloadCsv('locations.csv', locations)}
      />

      <DataTable
        loading={loading}
        title="Daily Usage Report" subtitle="Per-day sessions, energy and revenue (SCRUM-128, CSV: SCRUM-131)"
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'sessions', label: 'Sessions' },
          { key: 'energyKwh', label: 'Energy (kWh)' },
          { key: 'revenue', label: 'Revenue', render: money }
        ]}
        rows={daily}
        onExport={() => downloadCsv(`daily_usage_${suffix}.csv`, daily)}
      />
    </div>
  );
}