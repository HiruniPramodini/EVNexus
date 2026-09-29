import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Zap,
  Clock,
  CreditCard,
  RefreshCw,
  FileText,
  X,
  Printer,
  CheckCircle2,
  Calendar,
  Search,
  MapPin,
  TrendingUp,
  Download,
  ShieldCheck
} from 'lucide-react';
import { getSessionHistory } from '../../services/api';

export default function SessionHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSessionHistory();
      setHistory(res?.data || []);
    } catch (err) {
      setError(err.message || 'Error loading charging history');
    } finally {
      setLoading(false);
    }
  };

  // KPI Computations
  const totalEnergyDelivered = useMemo(() => {
    return history.reduce((sum, item) => sum + (parseFloat(item.session?.energyConsumedKwh) || 0), 0).toFixed(2);
  }, [history]);

  const totalSpend = useMemo(() => {
    return history.reduce((sum, item) => sum + (parseFloat(item.session?.totalCost) || 0), 0).toFixed(2);
  }, [history]);

  const totalSessionsCount = history.length;

  // Filtered session records
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.stationName?.toLowerCase().includes(q) ||
        item.address?.toLowerCase().includes(q) ||
        item.session?.id?.toLowerCase().includes(q)
      );
    });
  }, [history, searchQuery]);

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* KPI Overview Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <History size={24} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Completed Sessions</div>
            <div className="kpi-value">{totalSessionsCount}</div>
            <div className="kpi-subtext">Across EVNexus network</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-green">
            <Zap size={24} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Total Energy Charged</div>
            <div className="kpi-value">{totalEnergyDelivered} <span style={{ fontSize: '0.9rem' }}>kWh</span></div>
            <div className="kpi-subtext">Zero-emission power</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-purple">
            <CreditCard size={24} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Lifetime Charging Spend</div>
            <div className="kpi-value">${totalSpend}</div>
            <div className="kpi-subtext">Auto-billed from EV Wallet</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="dash-card">
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title">
              <History size={18} color="var(--primary-600)" />
              Charging Session History & Receipts
            </h3>
            <p className="dash-card-subtitle">
              Review your historical charging sessions, energy delivered, and digital invoices.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              className="submit-btn"
              onClick={fetchHistory}
              style={{ width: 'auto', margin: 0, padding: '0.45rem 1rem', fontSize: '0.8rem' }}
            >
              <RefreshCw size={14} className={loading ? 'spinner' : ''} />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search sessions by station name, location, or session ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
              <RefreshCw size={32} className="spinner" color="var(--primary-400)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading session history...</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger" style={{ margin: '1rem' }}>{error}</div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <FileText size={48} style={{ opacity: 0.2, margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>No charging sessions recorded yet</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Start your first charging session from the Driver Map to view live receipts.
              </p>
            </div>
          ) : (
            <div className="dash-table-wrapper">
              <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Station & Location</th>
                    <th>Duration</th>
                    <th>Energy Consumed</th>
                    <th>Total Amount</th>
                    <th style={{ textAlign: 'right' }}>Digital Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => {
                    const s = item.session;
                    const startTimeStr = s.startTime?.endsWith('Z') ? s.startTime : s.startTime + 'Z';
                    const endTimeStr = s.endTime?.endsWith('Z') ? s.endTime : s.endTime + 'Z';
                    const start = new Date(startTimeStr);
                    const end = new Date(endTimeStr);
                    const durationMs = Math.max(0, end - start);
                    const mins = Math.floor(durationMs / 60000);
                    const hrs = Math.floor(mins / 60);
                    const remMins = mins % 60;

                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                            <Calendar size={14} color="var(--text-muted)" />
                            {start.toLocaleDateString()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1.4rem' }}>
                            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--text-main)' }}>{item.stationName}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}>
                            <MapPin size={12} /> {item.address}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                            <Clock size={13} color="var(--primary-600)" />
                            <span>{hrs > 0 ? `${hrs}h ` : ''}{remMins}m</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#15803d', fontWeight: 700 }}>
                            <Zap size={14} /> {Number(s.energyConsumedKwh).toFixed(2)} kWh
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#0369a1', fontWeight: 800, fontSize: '0.95rem' }}>
                            <CreditCard size={14} /> ${Number(s.totalCost).toFixed(2)}
                          </div>
                          <span className="badge badge-success" style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                            Paid
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            onClick={() => setSelectedReceipt(item)}
                          >
                            <FileText size={13} />
                            <span>View Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DIGITAL RECEIPT MODAL                                                     */}
      {/* ========================================================================= */}
      {selectedReceipt && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '440px', padding: '1.5rem' }}>
            <div className="modal-header" style={{ marginBottom: '1rem', borderBottom: 'none', paddingBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={20} color="var(--primary-600)" />
                <h3 className="modal-title" style={{ fontSize: '1.15rem' }}>EVNexus Charging Receipt</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedReceipt(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="receipt-paper" style={{ padding: '1.5rem', margin: '0.5rem 0' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>
                  Total Amount Paid
                </span>
                <h2 style={{ margin: '0.2rem 0', color: '#0369a1', fontSize: '2.2rem', fontWeight: 800 }}>
                  ${Number(selectedReceipt.session?.totalCost).toFixed(2)}
                </h2>
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem' }}>
                  <CheckCircle2 size={12} /> Payment Completed
                </span>
              </div>

              <hr className="receipt-divider" />

              <div className="receipt-line-item">
                <span>Charging Station</span>
                <strong>{selectedReceipt.stationName}</strong>
              </div>

              <div className="receipt-line-item">
                <span>Location</span>
                <span style={{ textAlign: 'right', maxWidth: '60%', color: 'var(--text-main)', fontSize: '0.82rem' }}>
                  {selectedReceipt.address}
                </span>
              </div>

              <div className="receipt-line-item">
                <span>Start Time</span>
                <span>{new Date(selectedReceipt.session.startTime?.endsWith('Z') ? selectedReceipt.session.startTime : selectedReceipt.session.startTime + 'Z').toLocaleString()}</span>
              </div>

              <div className="receipt-line-item">
                <span>End Time</span>
                <span>{new Date(selectedReceipt.session.endTime?.endsWith('Z') ? selectedReceipt.session.endTime : selectedReceipt.session.endTime + 'Z').toLocaleString()}</span>
              </div>

              <div className="receipt-line-item">
                <span>Energy Delivered</span>
                <strong style={{ color: '#15803d' }}>{Number(selectedReceipt.session.energyConsumedKwh).toFixed(2)} kWh</strong>
              </div>

              <hr className="receipt-divider" />

              <div className="receipt-line-item">
                <span>Payment Method</span>
                <span>EVNexus Digital Wallet</span>
              </div>

              <div className="receipt-line-item">
                <span>Session ID</span>
                <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                  {selectedReceipt.session.id}
                </code>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePrintReceipt}
                style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={15} />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                className="submit-btn"
                onClick={() => setSelectedReceipt(null)}
                style={{ flex: 1, margin: 0 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
