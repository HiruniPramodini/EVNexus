import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  Key,
  Copy,
  Check,
  LogOut,
  Server,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  Clock,
  ShieldAlert,
  Zap,
  Plus,
  Layers,
  Lock
} from 'lucide-react';
import {
  getCompanyProfile,
  clearAuthSession,
  getCompanyStations,
  createCompanyStation,
  testCrossTenantAccess,
  testCompanyAccessToDriverEndpoint
} from '../services/api';

export default function CompanyDashboard({ authUser, onLogout }) {
  const [copiedTenantId, setCopiedTenantId] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);

  // Protected API Test State
  const [isVerifying, setIsVerifying] = useState(false);
  const [profileResult, setProfileResult] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Multi-Tenant Stations State
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [stationError, setStationError] = useState(null);

  // Add Station Form State
  const [showAddStation, setShowAddStation] = useState(false);
  const [stationForm, setStationForm] = useState({ name: '', location: '', totalPorts: 4 });
  const [isSubmittingStation, setIsSubmittingStation] = useState(false);
  const [stationSuccessMsg, setStationSuccessMsg] = useState(null);

  // Cross-Tenant Security Simulator State
  const [unauthorizedTenantId, setUnauthorizedTenantId] = useState('TNT-UNAUTHORIZED-CORP-999');
  const [isTestingCrossTenant, setIsTestingCrossTenant] = useState(false);
  const [crossTenantResult, setCrossTenantResult] = useState(null);

  // RBAC Security Simulator State
  const [isTestingRbac, setIsTestingRbac] = useState(false);
  const [rbacResult, setRbacResult] = useState(null);

  useEffect(() => {
    handleVerifyProtectedApi();
    loadStations();
  }, []);

  const loadStations = async () => {
    setLoadingStations(true);
    setStationError(null);
    try {
      const res = await getCompanyStations(authUser?.accessToken);
      if (res?.data) {
        setStations(res.data);
      }
    } catch (err) {
      setStationError(err.message || 'Failed to load isolated stations.');
    } finally {
      setLoadingStations(false);
    }
  };

  const handleCreateStation = async (e) => {
    e.preventDefault();
    if (!stationForm.name.trim() || !stationForm.location.trim()) return;

    setIsSubmittingStation(true);
    setStationError(null);
    setStationSuccessMsg(null);

    try {
      const res = await createCompanyStation({
        name: stationForm.name,
        location: stationForm.location,
        totalPorts: Number(stationForm.totalPorts) || 1
      }, authUser?.accessToken);

      setStationSuccessMsg(`Station "${res?.data?.name || stationForm.name}" created and automatically scoped to Tenant ${authUser?.tenantId}!`);
      setStationForm({ name: '', location: '', totalPorts: 4 });
      setShowAddStation(false);
      await loadStations();
      setTimeout(() => setStationSuccessMsg(null), 5000);
    } catch (err) {
      setStationError(err.message || 'Failed to create station.');
    } finally {
      setIsSubmittingStation(false);
    }
  };

  const handleSimulateCrossTenant = async () => {
    setIsTestingCrossTenant(true);
    setCrossTenantResult(null);

    const startTime = performance.now();
    try {
      await testCrossTenantAccess(unauthorizedTenantId, authUser?.accessToken);
      const endTime = performance.now();
      setCrossTenantResult({
        success: false,
        status: 200,
        message: 'Unexpected: Cross-tenant access was allowed! (Isolation failure)',
        latencyMs: Math.round(endTime - startTime)
      });
    } catch (err) {
      const endTime = performance.now();
      setCrossTenantResult({
        success: true, // Expected outcome: 403 Forbidden
        status: err.status || 403,
        message: err.message || 'Cross-tenant access forbidden. You cannot access data belonging to another tenant.',
        latencyMs: Math.round(endTime - startTime)
      });
    } finally {
      setIsTestingCrossTenant(false);
    }
  };

  const handleTestRbacSecurity = async () => {
    setIsTestingRbac(true);
    setRbacResult(null);
    const startTime = performance.now();
    try {
      const res = await testCompanyAccessToDriverEndpoint(authUser?.accessToken);
      const endTime = performance.now();
      setRbacResult({
        status: 200,
        success: true,
        data: res,
        latencyMs: Math.round(endTime - startTime),
        message: 'Unexpected: Cross-role access was granted.'
      });
    } catch (err) {
      const endTime = performance.now();
      setRbacResult({
        status: err.status || 403,
        success: false,
        errorMsg: err.message || 'Cross-role access forbidden. Role check enforced.',
        errors: err.errors || [],
        latencyMs: Math.round(endTime - startTime)
      });
    } finally {
      setIsTestingRbac(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'tenant') {
      setCopiedTenantId(true);
      setTimeout(() => setCopiedTenantId(false), 2500);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  const handleVerifyProtectedApi = async () => {
    setIsVerifying(true);
    setProfileError(null);
    setProfileResult(null);

    try {
      const startTime = performance.now();
      const response = await getCompanyProfile(authUser?.accessToken);
      const endTime = performance.now();

      setProfileResult({
        data: response.data,
        status: 200,
        latencyMs: Math.round(endTime - startTime),
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (err) {
      setProfileError({
        message: err.message || 'Failed to authenticate token against protected endpoint.',
        status: err.status || 500
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogoutClick = () => {
    clearAuthSession();
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Top Banner */}
      <div
        className="register-card"
        style={{
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #1e40af 100%)',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.3)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <ShieldCheck size={13} />
                Authenticated Session
              </span>
              <span
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}
              >
                {authUser?.role || 'CompanyAdmin'}
              </span>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Layers size={13} />
                Multi-Tenant Scoped
              </span>
            </div>
            <h1 style={{ color: '#ffffff', fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
              {authUser?.companyName || 'Enterprise Company'}
            </h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Mail size={15} /> {authUser?.businessEmail}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogoutClick}
            className="header-logout-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Grid of Key Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Tenant ID Card */}
        <div className="register-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'var(--primary-100)', color: 'var(--primary-700)', padding: '0.5rem', borderRadius: '8px' }}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Active Tenant ID</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Automatic ADO.NET data scope</p>
            </div>
          </div>

          <div
            style={{
              background: 'var(--primary-50)',
              border: '1px solid var(--primary-200)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}
          >
            <code style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--primary-800)', letterSpacing: '0.04em' }}>
              {authUser?.tenantId}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(authUser?.tenantId, 'tenant')}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--primary-300)',
                color: 'var(--primary-700)',
                padding: '0.35rem 0.6rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}
            >
              {copiedTenantId ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copiedTenantId ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Token Expiry Card */}
        <div className="register-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'var(--primary-100)', color: 'var(--primary-700)', padding: '0.5rem', borderRadius: '8px' }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>JWT Session Expiration</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configurable lifetime</p>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.9rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Lifetime:</span>
              <strong style={{ color: 'var(--text-main)' }}>{Math.round((authUser?.expiresIn || 3600) / 60)} minutes</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Token Type:</span>
              <strong style={{ color: 'var(--primary-700)' }}>{authUser?.tokenType || 'Bearer'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Tenant Data Isolation & Charging Assets Section */}
      <div className="register-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="var(--primary-600)" />
              Company Charging Stations (Tenant-Isolated)
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              All database records are strictly scoped via ADO.NET parameter binding: <code style={{ color: 'var(--primary-700)' }}>WHERE tenant_id = @tenant_id</code>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={loadStations}
              disabled={loadingStations}
              className="submit-btn"
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'var(--primary-50)', color: 'var(--primary-700)', border: '1px solid var(--primary-200)' }}
            >
              <RefreshCw size={14} className={loadingStations ? 'btn-spinner' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddStation(!showAddStation)}
              className="submit-btn"
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              <Plus size={14} />
              <span>{showAddStation ? 'Cancel' : 'Add Station'}</span>
            </button>
          </div>
        </div>

        {stationSuccessMsg && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <CheckCircle2 size={18} className="alert-icon" />
            <div className="alert-body">
              <strong>Station Added Successfully</strong>
              <p style={{ fontSize: '0.85rem' }}>{stationSuccessMsg}</p>
            </div>
          </div>
        )}

        {stationError && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={18} className="alert-icon" />
            <div className="alert-body">
              <strong>Error Loading Stations</strong>
              <p style={{ fontSize: '0.85rem' }}>{stationError}</p>
            </div>
          </div>
        )}

        {/* Add Station Inline Form */}
        {showAddStation && (
          <form onSubmit={handleCreateStation} style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--primary-900)' }}>
              Register New Charging Station (Auto-stamped with Tenant ID: {authUser?.tenantId})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Station Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GreenPulse Downtown Hub"
                  value={stationForm.name}
                  onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Location / Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500 Market St, Financial District"
                  value={stationForm.location}
                  onChange={(e) => setStationForm({ ...stationForm, location: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Total Ports</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={stationForm.totalPorts}
                  onChange={(e) => setStationForm({ ...stationForm, totalPorts: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowAddStation(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingStation}
                className="submit-btn"
                style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                {isSubmittingStation ? 'Creating...' : 'Save Station'}
              </button>
            </div>
          </form>
        )}

        {/* Stations Table */}
        {stations.length > 0 ? (
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Station ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Location</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Ports</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Tenant Owner</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((stn) => (
                  <tr key={stn.stationId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: '600', color: 'var(--primary-700)' }}>
                      {stn.stationId}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{stn.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{stn.location}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{stn.totalPorts} ports</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600' }}>
                        {stn.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#0369a1' }}>
                      {stn.tenantId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--bg-page)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
            <Zap size={28} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
            <p style={{ fontWeight: '600', color: 'var(--text-main)' }}>No charging stations registered for this tenant yet.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Click "Add Station" above to create your first tenant-isolated station.
            </p>
          </div>
        )}
      </div>

      {/* Interactive Cross-Tenant Security Access Simulator */}
      <div className="register-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
              <ShieldAlert size={20} color="#dc2626" />
              Security Audit: Cross-Tenant Access Simulator
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Verify Acceptance Criteria: Attempting to query another tenant's data must trigger an immediate <strong>HTTP 403 Forbidden</strong> response.
            </p>
          </div>
        </div>

        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '240px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#991b1b', marginBottom: '0.3rem' }}>
                Foreign / Target Tenant ID to Request:
              </label>
              <input
                type="text"
                value={unauthorizedTenantId}
                onChange={(e) => setUnauthorizedTenantId(e.target.value)}
                placeholder="e.g. TNT-UNAUTHORIZED-CORP-999"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fca5a5', fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
            <button
              type="button"
              onClick={handleSimulateCrossTenant}
              disabled={isTestingCrossTenant || !unauthorizedTenantId.trim()}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '0.55rem 1.2rem',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'background 0.2s ease'
              }}
            >
              {isTestingCrossTenant ? <RefreshCw size={15} className="btn-spinner" /> : <ShieldAlert size={15} />}
              <span>Simulate Cross-Tenant Call</span>
            </button>
          </div>
        </div>

        {crossTenantResult && (
          <div
            style={{
              background: crossTenantResult.status === 403 ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${crossTenantResult.status === 403 ? '#f87171' : '#86efac'}`,
              borderRadius: '8px',
              padding: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  color: crossTenantResult.status === 403 ? '#b91c1c' : '#15803d'
                }}
              >
                {crossTenantResult.status === 403 ? <CheckCircle2 size={18} color="#dc2626" /> : <AlertTriangle size={18} />}
                {crossTenantResult.status === 403 ? 'HTTP 403 Forbidden (Isolation Boundary Confirmed)' : 'Failed: Allowed'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', background: crossTenantResult.status === 403 ? '#fee2e2' : '#dcfce7', color: crossTenantResult.status === 403 ? '#b91c1c' : '#15803d', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                Status Code: {crossTenantResult.status} | Latency: {crossTenantResult.latencyMs}ms
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: crossTenantResult.status === 403 ? '#991b1b' : '#166534', margin: 0 }}>
              <strong>API Gateway & Service Response:</strong> {crossTenantResult.message}
            </p>
          </div>
        )}
      </div>

      {/* RBAC Security Simulator Card */}
      <div className="register-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #dc2626' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <Lock size={18} color="#dc2626" />
              Role-Based Access Control (RBAC) Simulator
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Simulates an unauthorized cross-role API request: sends this <strong>CompanyAdmin</strong> JWT token to the driver-only endpoint (<code style={{ color: '#dc2626' }}>GET /api/driver/wallet</code>). The backend <code>RoleAuthorizationMiddleware</code> must reject with <strong>403 Forbidden</strong> and log an audit warning.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestRbacSecurity}
            disabled={isTestingRbac}
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '0.55rem 1.2rem',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
              transition: 'background 0.2s ease'
            }}
          >
            {isTestingRbac ? <RefreshCw size={15} className="spinner-icon" /> : <ShieldAlert size={15} />}
            <span>Simulate Company -&gt; Driver Access</span>
          </button>
        </div>

        {rbacResult && (
          <div
            style={{
              background: rbacResult.status === 403 ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${rbacResult.status === 403 ? '#f87171' : '#86efac'}`,
              borderRadius: '8px',
              padding: '1rem',
              marginTop: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  color: rbacResult.status === 403 ? '#b91c1c' : '#15803d'
                }}
              >
                {rbacResult.status === 403 ? <CheckCircle2 size={18} color="#dc2626" /> : <AlertTriangle size={18} />}
                {rbacResult.status === 403 ? 'HTTP 403 Forbidden (RBAC Enforcement Verified)' : 'Failed: Allowed'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', background: rbacResult.status === 403 ? '#fee2e2' : '#dcfce7', color: rbacResult.status === 403 ? '#b91c1c' : '#15803d', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                Status Code: {rbacResult.status} | Latency: {rbacResult.latencyMs}ms
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: rbacResult.status === 403 ? '#991b1b' : '#166534', margin: 0 }}>
              <strong>API Gateway & Service Response:</strong> {rbacResult.errorMsg}
            </p>
            {rbacResult.errors?.length > 0 && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#b91c1c' }}>
                {rbacResult.errors.map((e, idx) => (
                  <div key={`company-rbac-err-${idx}`}>• {e}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Protected Endpoint Verification Section */}
      <div className="register-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={18} color="var(--primary-600)" />
              Protected API Endpoint Validation
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Validates that protected company endpoints require and verify the signed JWT Bearer token (<code style={{ color: 'var(--primary-700)' }}>GET /api/auth/company/profile</code>).
            </p>
          </div>

          <button
            type="button"
            onClick={handleVerifyProtectedApi}
            disabled={isVerifying}
            className="submit-btn"
            style={{ width: 'auto', padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
          >
            {isVerifying ? (
              <RefreshCw size={16} className="btn-spinner" />
            ) : (
              <>
                <RefreshCw size={16} />
                <span>Test Protected API</span>
              </>
            )}
          </button>
        </div>

        {profileResult && (
          <div
            style={{
              background: 'var(--success-50)',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '1rem',
              marginTop: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontWeight: '700', fontSize: '0.9rem' }}>
                <CheckCircle2 size={18} />
                Authorization Successful (HTTP 200 OK)
              </span>
              <span style={{ fontSize: '0.75rem', color: '#15803d', background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                Latency: {profileResult.latencyMs}ms | {profileResult.timestamp}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Company Name:</span>{' '}
                <strong>{profileResult.data?.companyName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Business Reg #:</span>{' '}
                <strong>{profileResult.data?.registrationNumber}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Email:</span>{' '}
                <strong>{profileResult.data?.businessEmail}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>{' '}
                <strong>{profileResult.data?.phone}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Address:</span>{' '}
                <strong>{profileResult.data?.address}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>{' '}
                <strong style={{ color: '#15803d' }}>{profileResult.data?.status}</strong>
              </div>
            </div>
          </div>
        )}

        {profileError && (
          <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
            <AlertTriangle size={20} className="alert-icon" />
            <div className="alert-body">
              <strong>Protected API Error (HTTP {profileError.status})</strong>
              <p style={{ marginTop: '0.2rem', fontSize: '0.875rem' }}>{profileError.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* JWT Token Raw Payload Viewer */}
      <div className="register-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Key size={16} color="var(--primary-600)" />
            Active Signed JWT Bearer Token
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowFullToken(!showFullToken)}
              style={{
                background: 'none',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              {showFullToken ? 'Truncate' : 'Expand'}
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(authUser?.accessToken, 'token')}
              style={{
                background: 'var(--primary-50)',
                border: '1px solid var(--primary-200)',
                color: 'var(--primary-700)',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              {copiedToken ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              {copiedToken ? 'Copied' : 'Copy JWT'}
            </button>
          </div>
        </div>

        <div
          style={{
            background: '#0f172a',
            color: '#38bdf8',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            padding: '1rem',
            borderRadius: '8px',
            overflowX: 'auto',
            wordBreak: showFullToken ? 'break-all' : 'normal',
            whiteSpace: showFullToken ? 'pre-wrap' : 'nowrap',
            maxHeight: showFullToken ? '200px' : 'none'
          }}
        >
          {authUser?.accessToken}
        </div>
      </div>
    </div>
  );
}
