import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Zap,
  RefreshCw,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Filter
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line
} from 'recharts';
import {
  getDashboardAnalytics,
  getCompanyTransactions,
  getCompanyRevenueTrend,
  getCompanyStationAnalytics,
  getCompanyStations,
  getStoredUser,
  getAuthToken
} from '../../services/api';
import { formatLKR } from '../../utils/currency';

export default function CompanyRevenuePage({ authUser }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [analytics, setAnalytics] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [stationAnalytics, setStationAnalytics] = useState([]);
  const [stationsMap, setStationsMap] = useState({});
  const [chartView, setChartView] = useState('revenue'); // 'revenue' | 'both'
  const [trendDays, setTrendDays] = useState(30);

  const getEffectiveTenantId = () => {
    if (authUser?.tenantId) return authUser.tenantId;
    try {
      const token = authUser?.accessToken || getAuthToken();
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          return payload.tenant_id || payload.sub;
        }
      }
    } catch (_) {}
    return null;
  };

  const companyId = getEffectiveTenantId();

  const fetchRevenueData = async () => {
    if (!companyId) {
      setError('Company tenant identifier is missing. Please log in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch stations to map StationId to friendly station names
      const pStations = getCompanyStations()
        .then(res => {
          const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          const map = {};
          list.forEach(st => {
            const id = st.id || st.stationId;
            if (id) {
              map[id] = {
                name: st.name || 'Unnamed Station',
                location: st.location || st.address || 'Standard Location'
              };
            }
          });
          setStationsMap(map);
        })
        .catch(err => {
          console.warn('Stations lookup non-critical failure:', err);
        });

      // 1. KPI Analytics
      const pAnalytics = getDashboardAnalytics(companyId)
        .then(res => {
          const raw = res?.data !== undefined ? res.data : res;
          if (raw) {
            setAnalytics({
              totalRevenue: Number(raw.totalRevenue ?? raw.TotalRevenue ?? 0),
              totalRevenueToday: Number(raw.totalRevenueToday ?? raw.TotalRevenueToday ?? 0),
              totalEnergyKwh: Number(raw.totalEnergyKwh ?? raw.TotalEnergyKwh ?? 0),
              completedTransactions: Number(raw.completedTransactions ?? raw.CompletedTransactions ?? 0)
            });
          }
        });

      // 2. Transactions
      const pTx = getCompanyTransactions(companyId)
        .then(res => {
          const raw = res?.data !== undefined ? res.data : res;
          const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
          setTransactions(list);
        });

      // 3. Revenue Trend
      const pTrend = getCompanyRevenueTrend(companyId)
        .then(res => {
          const raw = res?.data !== undefined ? res.data : res;
          if (Array.isArray(raw)) {
            const normalized = raw.map(item => ({
              date: item.date || item.Date || '',
              revenue: typeof item.revenue === 'number' ? item.revenue : (parseFloat(item.Revenue || item.revenue) || 0),
              energyKwh: typeof item.energyKwh === 'number' ? item.energyKwh : (parseFloat(item.EnergyKwh || item.energyKwh) || 0),
              sessions: item.sessions || item.Sessions || 0
            }));
            setRevenueTrend(normalized);
          } else {
            setRevenueTrend([]);
          }
        });

      // 4. Station Analytics
      const pStationAnalytics = getCompanyStationAnalytics(companyId)
        .then(res => {
          const raw = res?.data !== undefined ? res.data : res;
          const list = Array.isArray(raw) ? raw : [];
          setStationAnalytics(list);
        })
        .catch(err => {
          console.warn('Station analytics not available:', err);
          setStationAnalytics([]);
        });

      await Promise.allSettled([pStations, pAnalytics, pTx, pTrend, pStationAnalytics]);
    } catch (err) {
      setError(err.message || 'Failed to load company revenue details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueData();
  }, [companyId]);

  // Derived financial metrics
  const financialSummary = useMemo(() => {
    let todayRevenue = analytics?.totalRevenueToday || 0;
    let monthRevenue = 0;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thisMonthStr = now.toISOString().slice(0, 7);

    // Sum up directly from transactions for accuracy if present
    if (Array.isArray(transactions) && transactions.length > 0) {
      let computedToday = 0;
      let computedMonth = 0;
      transactions.forEach(tx => {
        const statusUpper = (tx.status || '').toUpperCase();
        if (statusUpper === 'COMPLETED' || statusUpper === 'SUCCESS') {
          const amt = Number(tx.amount) || 0;
          try {
            if (tx.timestamp) {
              const d = new Date(tx.timestamp).toISOString();
              if (d.slice(0, 10) === todayStr) {
                computedToday += amt;
              }
              if (d.slice(0, 7) === thisMonthStr) {
                computedMonth += amt;
              }
            }
          } catch (_) {}
        }
      });
      if (todayRevenue === 0 && computedToday > 0) {
        todayRevenue = computedToday;
      }
      monthRevenue = computedMonth;
    }

    const totalRevenue = analytics?.totalRevenue || 0;
    const totalTransactions = analytics?.completedTransactions || transactions.length || 0;
    const avgRevenuePerSession = totalTransactions > 0 ? (totalRevenue / totalTransactions) : 0;
    const totalEnergy = analytics?.totalEnergyKwh || 0;

    return {
      todayRevenue,
      monthRevenue: monthRevenue > 0 ? monthRevenue : (todayRevenue > 0 ? todayRevenue : totalRevenue),
      totalRevenue,
      totalTransactions,
      avgRevenuePerSession,
      totalEnergy
    };
  }, [analytics, transactions]);

  // Filtered revenue trend based on selected days
  const filteredTrend = useMemo(() => {
    if (!revenueTrend || revenueTrend.length === 0) return [];
    if (trendDays >= 90) return revenueTrend;
    return revenueTrend.slice(-trendDays);
  }, [revenueTrend, trendDays]);

  // Group station revenue breakdown by station ID
  const stationBreakdown = useMemo(() => {
    const map = {};

    // First use stationAnalytics if populated
    if (Array.isArray(stationAnalytics) && stationAnalytics.length > 0) {
      stationAnalytics.forEach(item => {
        const sid = item.stationId || item.StationId || 'unknown';
        if (!map[sid]) {
          map[sid] = {
            stationId: sid,
            revenue: 0,
            energyKwh: 0,
            sessions: 0
          };
        }
        map[sid].revenue += Number(item.revenue || item.Revenue || 0);
        map[sid].energyKwh += Number(item.energyKwh || item.EnergyKwh || 0);
        map[sid].sessions += Number(item.sessions || item.Sessions || 0);
      });
    }

    // Fallback or complement with completed transactions
    if (Object.keys(map).length === 0 && Array.isArray(transactions) && transactions.length > 0) {
      transactions.forEach(tx => {
        const sid = tx.stationId || 'default-station';
        if (!map[sid]) {
          map[sid] = {
            stationId: sid,
            revenue: 0,
            energyKwh: 0,
            sessions: 0
          };
        }
        map[sid].revenue += Number(tx.amount || 0);
        map[sid].energyKwh += Number(tx.energyConsumedKwh || 0);
        map[sid].sessions += 1;
      });
    }

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [stationAnalytics, transactions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Banner / Header */}
      <div className="dash-card" style={{ padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(13, 148, 136, 0.12)', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={20} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Company Revenue & Financials</h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Dedicated financial tracking, transaction logs, and station revenue performance.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchRevenueData}
            disabled={loading}
            className="submit-btn"
            style={{ width: 'auto', margin: 0, padding: '0.5rem 1.2rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={15} className={loading ? 'spinner' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh Revenue'}</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={fetchRevenueData} className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* 4 Financial KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {/* Today's Revenue */}
        <div className="dash-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--brand-500)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Today's Revenue
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(13, 148, 136, 0.1)', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--brand-700)', lineHeight: 1.1 }}>
            {formatLKR(financialSummary.todayRevenue)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Earnings collected on current UTC date
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="dash-card" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              This Month's Revenue
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e40af', lineHeight: 1.1 }}>
            {formatLKR(financialSummary.monthRevenue)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Month-to-date completed settlements
          </div>
        </div>

        {/* Total Lifetime Revenue */}
        <div className="dash-card" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total All-Time Revenue
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#065f46', lineHeight: 1.1 }}>
            {formatLKR(financialSummary.totalRevenue)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Across {financialSummary.totalTransactions} total completed sessions
          </div>
        </div>

        {/* Average Per Session */}
        <div className="dash-card" style={{ padding: '1.5rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Avg. Revenue / Session
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#5b21b6', lineHeight: 1.1 }}>
            {formatLKR(financialSummary.avgRevenuePerSession)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {financialSummary.totalEnergy.toFixed(1)} kWh energy delivered
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart Section */}
      <div className="dash-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={19} color="var(--brand-600)" />
              Daily Revenue Trends
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Historical daily revenue patterns from completed charging sessions.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--bg-page)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setChartView('revenue')}
                style={{
                  background: chartView === 'revenue' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: chartView === 'revenue' ? 600 : 500,
                  color: chartView === 'revenue' ? 'var(--brand-700)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  boxShadow: chartView === 'revenue' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                Revenue Only
              </button>
              <button
                type="button"
                onClick={() => setChartView('both')}
                style={{
                  background: chartView === 'both' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: chartView === 'both' ? 600 : 500,
                  color: chartView === 'both' ? 'var(--brand-700)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  boxShadow: chartView === 'both' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                Revenue & Energy
              </button>
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-page)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTrendDays(days)}
                  style={{
                    background: trendDays === days ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    fontWeight: trendDays === days ? 600 : 500,
                    color: trendDays === days ? 'var(--brand-700)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    boxShadow: trendDays === days ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem' }}>
            <RefreshCw size={28} className="spinner" color="var(--brand-500)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading financial chart...</span>
          </div>
        ) : filteredTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filteredTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(val) => {
                  if (!val) return '';
                  const d = new Date(val);
                  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis 
                yAxisId="left" 
                tick={{ fontSize: 12, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(v) => `${v}`} 
              />
              {chartView === 'both' && (
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(v) => `${v} kWh`} 
                />
              )}
              <RechartsTooltip 
                cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: '#ffffff' }}
                labelFormatter={(val) => {
                  if (!val) return '';
                  const d = new Date(val);
                  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                }}
                formatter={(val, name) => {
                  if (name === 'revenue' || name === 'Revenue' || name === 'Revenue (LKR)') return [formatLKR(val), 'Revenue'];
                  if (name === 'energyKwh' || name === 'Energy (kWh)') return [`${Number(val).toFixed(2)} kWh`, 'Energy Delivered'];
                  return [val, name];
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar 
                yAxisId="left" 
                dataKey="revenue" 
                name="Revenue (LKR)" 
                fill="#0d9488" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={45} 
              />
              {chartView === 'both' && (
                <Bar 
                  yAxisId="right" 
                  dataKey="energyKwh" 
                  name="Energy (kWh)" 
                  fill="#38bdf8" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={45} 
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-page)', borderRadius: '8px', color: 'var(--text-muted)' }}>
            <TrendingUp size={36} style={{ opacity: 0.25 }} />
            <div style={{ fontWeight: 600 }}>No revenue trend entries recorded yet</div>
            <div style={{ fontSize: '0.85rem' }}>Daily financial trend columns will appear as charging sessions complete.</div>
          </div>
        )}
      </div>

      {/* Station Revenue Breakdown Section */}
      <div className="dash-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={19} color="var(--brand-600)" />
              Station Revenue Performance
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Breakdown of total earnings, energy dispensed, and session volume across individual charging hubs.
            </p>
          </div>
        </div>

        {stationBreakdown.length > 0 ? (
          <div className="dash-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Charging Station</th>
                  <th>Station ID</th>
                  <th>Completed Sessions</th>
                  <th>Energy Delivered</th>
                  <th>Avg. Cost / kWh</th>
                  <th style={{ textAlign: 'right' }}>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stationBreakdown.map((item, idx) => {
                  const meta = stationsMap[item.stationId] || {};
                  const displayName = meta.name || `Station (${String(item.stationId).substring(0, 8)})`;
                  const location = meta.location || 'Network Charger Hub';
                  const avgPerKwh = item.energyKwh > 0 ? (item.revenue / item.energyKwh) : 0;

                  return (
                    <tr key={idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-page)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-600)' }}>
                            <Building2 size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{displayName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{location}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                          {String(item.stationId).substring(0, 10)}...
                        </code>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{item.sessions}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>sessions</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0369a1' }}>
                          {Number(item.energyKwh).toFixed(2)} kWh
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {formatLKR(avgPerKwh)}/kWh
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--brand-700)' }}>
                          {formatLKR(item.revenue)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '2.5rem', textAlign: 'center', background: 'var(--bg-page)', borderRadius: '8px', color: 'var(--text-muted)' }}>
            <Building2 size={36} style={{ opacity: 0.25, margin: '0 auto 0.5rem auto' }} />
            <div style={{ fontWeight: 600 }}>No station revenue records available yet</div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Stations will appear here with financial performance as transactions occur.</div>
          </div>
        )}
      </div>

      {/* Recent Settled Transactions Breakdown */}
      <div className="dash-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={19} color="var(--brand-600)" />
              Completed Revenue Transactions
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Detailed audit log of paid charging sessions processed by EVNexus payment microservice.
            </p>
          </div>
        </div>

        {transactions.length > 0 ? (
          <div className="dash-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Station</th>
                  <th>Energy</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => {
                  const txId = tx.id || tx.paymentId || `tx-${idx}`;
                  const amt = Number(tx.amount || 0).toFixed(2);
                  const energy = Number(tx.energyConsumedKwh || 0).toFixed(2);
                  const stMeta = stationsMap[tx.stationId];
                  const stLabel = stMeta?.name || (tx.stationId ? `Station ${String(tx.stationId).substring(0, 8)}` : 'Network Station');

                  let dateStr = 'Recent';
                  try {
                    if (tx.timestamp) {
                      const d = new Date(tx.timestamp.endsWith('Z') ? tx.timestamp : tx.timestamp + 'Z');
                      if (!isNaN(d.getTime())) {
                        dateStr = d.toLocaleString();
                      }
                    }
                  } catch (_) {}

                  return (
                    <tr key={txId}>
                      <td>
                        <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                          {String(txId).substring(0, 8)}...
                        </code>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                          <Clock size={13} color="var(--text-muted)" />
                          <span>{dateStr}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{stLabel}</span>
                      </td>
                      <td>
                        <span style={{ color: '#0369a1', fontWeight: 600 }}>{energy} kWh</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--brand-700)', fontWeight: 700, fontSize: '0.95rem' }}>
                          {formatLKR(tx.amount || 0)}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} />
                          {tx.status || 'COMPLETED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '2.5rem', textAlign: 'center', background: 'var(--bg-page)', borderRadius: '8px', color: 'var(--text-muted)' }}>
            <CreditCard size={36} style={{ opacity: 0.25, margin: '0 auto 0.5rem auto' }} />
            <div style={{ fontWeight: 600 }}>No settled revenue transactions found</div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Completed charging sessions will populate here with full billing details.</div>
          </div>
        )}
      </div>
    </div>
  );
}
