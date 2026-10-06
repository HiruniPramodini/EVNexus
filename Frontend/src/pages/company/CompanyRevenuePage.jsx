import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  CreditCard, 
  Zap, 
  Activity, 
  MapPin, 
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  getDashboardAnalytics, 
  getCompanyTransactions, 
  getCompanyRevenueTrend, 
  getStationAnalytics 
} from '../../services/api';

export default function CompanyRevenuePage({ authUser, stations, onNavigateToOverview }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [dateRange, setDateRange] = useState('30days');
  const [selectedStation, setSelectedStation] = useState('all');
  
  // Data State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [transactionsData, setTransactionsData] = useState([]);
  const [stationAnalyticsData, setStationAnalyticsData] = useState([]);
  
  const [selectedStationDetail, setSelectedStationDetail] = useState(null);

  const loadRevenueData = async () => {
    setLoading(true);
    setError(null);
    try {
      const companyId = authUser?.tenantId;
      
      let startDate = null;
      let endDate = null;
      const today = new Date();
      
      if (dateRange === 'today') {
        startDate = new Date(today.setHours(0,0,0,0)).toISOString();
        endDate = new Date(new Date().setHours(23,59,59,999)).toISOString();
      } else if (dateRange === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString();
      } else if (dateRange === '30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString();
      } else if (dateRange === 'month') {
        const d = new Date();
        d.setDate(1);
        startDate = d.toISOString();
      }
      
      const filterStationId = selectedStation === 'all' ? null : selectedStation;

      const [analyticsRes, txRes, trendRes, stationRes] = await Promise.all([
        getDashboardAnalytics(companyId, startDate, endDate, filterStationId).catch(() => null),
        getCompanyTransactions(companyId, startDate, endDate, filterStationId).catch(() => []),
        getCompanyRevenueTrend(companyId, startDate, endDate, filterStationId).catch(() => []),
        getStationAnalytics(companyId, startDate, endDate, filterStationId).catch(() => [])
      ]);

      const rawAnalytics = analyticsRes?.data ?? (analyticsRes?.totalRevenue !== undefined || analyticsRes?.TotalRevenue !== undefined ? analyticsRes : null);
      if (rawAnalytics) {
        setAnalyticsData({
          totalRevenue: rawAnalytics.totalRevenue ?? rawAnalytics.TotalRevenue ?? 0,
          totalRevenueToday: rawAnalytics.totalRevenueToday ?? rawAnalytics.TotalRevenueToday ?? 0,
          completedTransactions: rawAnalytics.completedTransactions ?? rawAnalytics.CompletedTransactions ?? 0,
          totalEnergyKwh: rawAnalytics.totalEnergyKwh ?? rawAnalytics.TotalEnergyKwh ?? 0
        });
      } else {
        setAnalyticsData({ totalRevenue: 0, totalRevenueToday: 0, completedTransactions: 0, totalEnergyKwh: 0 });
      }
      
      const txData = txRes?.data ?? (Array.isArray(txRes) ? txRes : []);
      setTransactionsData(Array.isArray(txData) ? txData : []);
      
      const trendData = trendRes?.data ?? (Array.isArray(trendRes) ? trendRes : []);
      if (trendData && Array.isArray(trendData)) {
        const normalized = trendData.map(item => ({
          date: item.date || item.Date || '',
          revenue: typeof item.revenue === 'number' ? item.revenue : (parseFloat(item.Revenue || item.revenue) || 0),
          energyKwh: typeof item.energyKwh === 'number' ? item.energyKwh : (parseFloat(item.EnergyKwh || item.energyKwh) || 0),
          sessions: typeof item.sessions === 'number' ? item.sessions : (parseInt(item.Sessions || item.sessions) || 0)
        }));
        setRevenueTrend(normalized);
      } else {
        setRevenueTrend([]);
      }
      
      const stationData = stationRes?.data ?? (Array.isArray(stationRes) ? stationRes : []);
      setStationAnalyticsData(Array.isArray(stationData) ? stationData : []);

    } catch (err) {
      setError(err.message || 'Unable to load revenue analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRevenueData();
    // Reset selected station detail on filter change
    setSelectedStationDetail(null);
  }, [dateRange, selectedStation]);

  const aggregatedStations = useMemo(() => {
    const grouped = stationAnalyticsData.reduce((acc, curr) => {
      const sId = curr.stationId || curr.StationId || 'Unknown';
      if (!acc[sId]) acc[sId] = [];
      acc[sId].push(curr);
      return acc;
    }, {});
    
    return Object.entries(grouped).map(([sId, records]) => {
      const sessions = records.reduce((sum, r) => sum + (r.sessions || r.Sessions || 0), 0);
      const energyKwh = records.reduce((sum, r) => sum + (r.energyKwh || r.EnergyKwh || 0), 0);
      const revenue = records.reduce((sum, r) => sum + (r.revenue || r.Revenue || 0), 0);
      const lastActivity = records.reduce((latest, r) => {
        const d = new Date(r.date || r.Date);
        return d > latest ? d : latest;
      }, new Date(0));

      return {
        id: sId,
        sessions,
        energyKwh,
        revenue,
        avgRevenue: sessions > 0 ? (revenue / sessions) : 0,
        lastActivity: lastActivity.getTime() === 0 ? 'N/A' : lastActivity.toLocaleDateString(),
        records
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [stationAnalyticsData]);

  if (loading && !analyticsData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem' }}>
        <RefreshCw size={36} className="spinner" style={{ color: 'var(--primary-600)', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Loading revenue analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <p style={{ color: '#ef4444', fontSize: '1.1rem', marginBottom: '1rem' }}>{error}</p>
        <button className="btn-secondary" onClick={loadRevenueData}>Try Again</button>
      </div>
    );
  }

  const noData = !analyticsData || analyticsData.completedTransactions === 0;

  if (selectedStationDetail) {
    // Station Detail View
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '-1rem' }}>
          <button 
            className="btn-secondary" 
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
            onClick={() => setSelectedStationDetail(null)}
          >
            ← Back to Revenue
          </button>
        </div>

        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
            Station {selectedStationDetail.id}
          </h2>
          <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
            Performance overview for this specific station.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <div className="dash-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={16} /> Revenue
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem' }}>
              ${selectedStationDetail.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="dash-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={16} /> Energy Delivered
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem' }}>
              {selectedStationDetail.energyKwh.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
            </div>
          </div>
          <div className="dash-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} /> Charging Sessions
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem' }}>
              {selectedStationDetail.sessions.toLocaleString()}
            </div>
          </div>
          <div className="dash-card" style={{ padding: '1.5rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={16} /> Average Session Revenue
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem' }}>
              ${selectedStationDetail.avgRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Detail Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          <div className="dash-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0' }}>Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={selectedStationDetail.records.map(r => ({ date: r.Date || r.date, revenue: r.Revenue || r.revenue })).reverse()}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                <RechartsTooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="revenue" fill="var(--primary-600)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="dash-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0' }}>Energy Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={selectedStationDetail.records.map(r => ({ date: r.Date || r.date, energyKwh: r.EnergyKwh || r.energyKwh })).reverse()}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val} kWh`} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="energyKwh" stroke="#10b981" fill="#d1fae5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0' }}>Recent Sessions at this Station</h3>
          {transactionsData && transactionsData.filter(t => t.stationId === selectedStationDetail.id).length > 0 ? (
            <div className="dash-table-wrapper">
              <table className="dash-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '1rem' }}>Date / Time</th>
                    <th style={{ padding: '1rem' }}>Amount</th>
                    <th style={{ padding: '1rem' }}>Energy</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionsData.filter(t => t.stationId === selectedStationDetail.id).slice(0, 10).map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '1rem' }}>{new Date(tx.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{tx.currency || '$'} {(tx.amount || 0).toFixed(2)}</td>
                      <td style={{ padding: '1rem' }}>{(tx.energyConsumedKwh || 0).toFixed(2)} kWh</td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`badge ${tx.status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recent sessions.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
          Revenue & Charging Analytics
        </h2>
        <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
          Monitor your company's charging revenue and energy usage.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', background: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} color="var(--text-muted)" />
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: '#f8fafc' }}
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={18} color="var(--text-muted)" />
          <select 
            value={selectedStation} 
            onChange={(e) => setSelectedStation(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: '#f8fafc' }}
          >
            <option value="all">All Stations</option>
            {stations?.map(s => (
              <option key={s.id} value={s.id}>{s.name || s.id}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={loadRevenueData} 
          className="btn-secondary" 
          style={{ padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
        </button>
      </div>

      {noData ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Activity size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)' }}>No charging activity yet.</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
            Once drivers complete charging sessions, your station revenue and energy analytics will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div className="dash-card" style={{ padding: '1.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={16} /> Total Revenue
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                ${(analyticsData?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            
            <div className="dash-card" style={{ padding: '1.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={16} /> Revenue Today
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                ${(analyticsData?.totalRevenueToday || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="dash-card" style={{ padding: '1.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={16} /> Energy Delivered
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                {(analyticsData?.totalEnergyKwh || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh
              </div>
            </div>

            <div className="dash-card" style={{ padding: '1.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} /> Charging Sessions
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.5rem' }}>
                {(analyticsData?.completedTransactions || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Charts Area */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            <div className="dash-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={18} /> Revenue Trend
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                  <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="revenue" fill="var(--primary-600)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="dash-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={18} color="#10b981" /> Energy Delivered Trend
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value} kWh`} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="energyKwh" stroke="#10b981" fill="#d1fae5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn-secondary"
              onClick={() => onNavigateToOverview && onNavigateToOverview()}
              style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
            >
              7-Day Revenue Forecast <ArrowRight size={14} />
            </button>
          </div>

          {/* Station Performance Section */}
          <div className="dash-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={18} /> Station Performance
            </h3>
            
            {/* Quick Cards */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
              {aggregatedStations.slice(0, 3).map(station => (
                <div 
                  key={station.id} 
                  onClick={() => setSelectedStationDetail(station)}
                  style={{ 
                    flex: '1 1 250px', 
                    padding: '1.2rem', 
                    border: '1px solid var(--border-subtle)', 
                    borderRadius: '8px', 
                    background: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary-400)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                >
                  <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text-main)' }}>{station.id}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Sessions:</div>
                    <div style={{ fontWeight: 600, textAlign: 'right' }}>{station.sessions}</div>
                    <div style={{ color: 'var(--text-muted)' }}>Revenue:</div>
                    <div style={{ fontWeight: 600, textAlign: 'right' }}>${station.revenue.toFixed(2)}</div>
                    <div style={{ color: 'var(--text-muted)' }}>Energy:</div>
                    <div style={{ fontWeight: 600, textAlign: 'right' }}>{station.energyKwh.toFixed(1)} kWh</div>
                    <div style={{ color: 'var(--text-muted)' }}>Avg / Session:</div>
                    <div style={{ fontWeight: 600, textAlign: 'right' }}>${station.avgRevenue.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Table */}
            <div className="dash-table-wrapper">
              <table className="dash-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Station</th>
                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Charging Sessions</th>
                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Revenue</th>
                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Energy (kWh)</th>
                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Average Revenue</th>
                    <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Last Charging Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedStations.map(station => (
                    <tr 
                      key={station.id} 
                      onClick={() => setSelectedStationDetail(station)}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--primary-600)' }}>{station.id}</td>
                      <td style={{ padding: '1rem' }}>{station.sessions}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>${station.revenue.toFixed(2)}</td>
                      <td style={{ padding: '1rem' }}>{station.energyKwh.toFixed(1)} kWh</td>
                      <td style={{ padding: '1rem' }}>${station.avgRevenue.toFixed(2)}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{station.lastActivity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Charging Transactions */}
          <div className="dash-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} /> Recent Charging Transactions
            </h3>
            {transactionsData && transactionsData.length > 0 ? (
              <div className="dash-table-wrapper">
                <table className="dash-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Station</th>
                      <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Amount</th>
                      <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Energy</th>
                      <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Status</th>
                      <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Date / Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsData.slice(0, 10).map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '1rem', fontWeight: 600 }}>{tx.stationId || 'Unknown'}</td>
                        <td style={{ padding: '1rem', fontWeight: 600 }}>{tx.currency || '$'} {(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: '1rem' }}>{(tx.energyConsumedKwh || 0).toFixed(2)} kWh</td>
                        <td style={{ padding: '1rem' }}>
                          <span className={`badge ${tx.status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{new Date(tx.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '8px' }}>
                No recent charging transactions found.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
