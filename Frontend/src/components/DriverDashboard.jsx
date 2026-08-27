import React, { useState, useEffect } from 'react';
import {
  User,
  Zap,
  Wallet as WalletIcon,
  Copy,
  Check,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  Phone,
  ShieldCheck,
  CreditCard,
  MapPin,
  Clock,
  Key,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { getDriverProfile, clearAuthSession, testDriverAccessToCompanyEndpoint } from '../services/api';

export default function DriverDashboard({ authUser, onLogout }) {
  const [copiedDriverId, setCopiedDriverId] = useState(false);
  const [copiedWalletId, setCopiedWalletId] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);

  // Protected API Test State
  const [isVerifying, setIsVerifying] = useState(false);
  const [profileResult, setProfileResult] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // RBAC Security Simulator State
  const [isTestingRbac, setIsTestingRbac] = useState(false);
  const [rbacResult, setRbacResult] = useState(null);

  useEffect(() => {
    handleVerifyProtectedApi();
  }, []);

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'driver') {
      setCopiedDriverId(true);
      setTimeout(() => setCopiedDriverId(false), 2500);
    } else if (type === 'wallet') {
      setCopiedWalletId(true);
      setTimeout(() => setCopiedWalletId(false), 2500);
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
      const response = await getDriverProfile(authUser?.accessToken);
      const endTime = performance.now();

      setProfileResult({
        data: response.data,
        status: 200,
        latencyMs: Math.round(endTime - startTime),
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (err) {
      setProfileError({
        message: err.message || 'Failed to authenticate token against protected driver endpoint.',
        status: err.status || 500
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTestRbacSecurity = async () => {
    setIsTestingRbac(true);
    setRbacResult(null);
    const startTime = performance.now();
    try {
      const res = await testDriverAccessToCompanyEndpoint(authUser?.accessToken);
      const endTime = performance.now();
      setRbacResult({
        status: 200,
        success: true,
        data: res,
        latencyMs: Math.round(endTime - startTime),
        message: 'Unexpected: Access was granted.'
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

  const handleLogoutClick = () => {
    clearAuthSession();
    if (onLogout) {
      onLogout();
    }
  };

  const effectiveDriverId = profileResult?.data?.driverId || authUser?.driverId || 'DRV-N/A';
  const effectiveWalletId = profileResult?.data?.walletId || authUser?.walletId || 'WLT-N/A';
  const effectiveBalance = profileResult?.data?.walletBalance ?? authUser?.walletBalance ?? 0.0;
  const effectiveCurrency = profileResult?.data?.currency || authUser?.currency || 'USD';

  return (
    <div className="main-content" style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Driver Header Banner */}
      <div
        className="register-card"
        style={{
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #1e40af 100%)',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.35)',
          borderRadius: '16px'
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
                  gap: '0.35rem'
                }}
              >
                <Zap size={12} />
                EV Driver Account
              </span>
              <span
                style={{
                  background: 'rgba(34, 197, 94, 0.3)',
                  color: '#86efac',
                  border: '1px solid rgba(134, 239, 172, 0.4)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}
              >
                ● Active
              </span>
            </div>

            <h1 style={{ fontSize: '1.85rem', fontWeight: '700', margin: '0.25rem 0', color: '#ffffff' }}>
              {authUser?.name || 'EV Driver'}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', opacity: 0.9, fontSize: '0.875rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} />
                {authUser?.email || profileResult?.data?.email}
              </span>
              {profileResult?.data?.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Phone size={14} />
                  {profileResult.data.phone}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleLogoutClick}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s'
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Driver ID Copy Box */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={16} style={{ opacity: 0.8 }} />
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>Driver Identifier:</span>
            <code
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                letterSpacing: '0.5px'
              }}
            >
              {effectiveDriverId}
            </code>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(effectiveDriverId, 'driver')}
            style={{
              background: copiedDriverId ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#ffffff',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'background 0.2s'
            }}
          >
            {copiedDriverId ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedDriverId ? 'Copied' : 'Copy Driver ID'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Charging Wallet & Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Charging Wallet Card */}
        <div
          className="register-card"
          style={{
            margin: 0,
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #0ea5e9, #0284c7)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <WalletIcon size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>Digital Charging Wallet</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-deducted per kWh session</span>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#16a34a', background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
              Ready
            </span>
          </div>

          <div style={{ padding: '1.25rem', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '12px', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Available Balance</span>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary-700)', marginTop: '0.25rem' }}>
              ${Number(effectiveBalance).toFixed(2)}{' '}
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>{effectiveCurrency}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Wallet ID:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <code style={{ fontSize: '0.8rem', color: 'var(--text-main)', background: 'var(--primary-50)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                {effectiveWalletId}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(effectiveWalletId, 'wallet')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-600)', padding: '2px' }}
                title="Copy Wallet ID"
              >
                {copiedWalletId ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="submit-btn"
              style={{ flex: 1, padding: '0.55rem', fontSize: '0.85rem', margin: 0 }}
              onClick={() => alert('Wallet top-up gateway will be connected in the Payment Service story.')}
            >
              <CreditCard size={14} />
              <span>Top Up Wallet</span>
            </button>
          </div>
        </div>

        {/* Quick Driver Features */}
        <div
          className="register-card"
          style={{
            margin: 0,
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px'
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-subtle, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Find Nearby Stations</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Map Service with live availability</div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-subtle, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Link RFID Card</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tap-to-charge station authentication</div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-subtle, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Charging History</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Past session logs & receipts</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Protected JWT Verification Live Test Panel */}
      <div
        className="register-card"
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          margin: 0
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="var(--primary-600)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-main)' }}>
                Protected Driver Endpoint Test
              </h3>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Validates <code>GET /api/auth/driver/profile</code> requiring signed Bearer JWT token with Driver role claim.
            </p>
          </div>

          <button
            type="button"
            onClick={handleVerifyProtectedApi}
            disabled={isVerifying}
            style={{
              background: 'var(--primary-50)',
              border: '1px solid var(--primary-200)',
              color: 'var(--primary-700)',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <RefreshCw size={14} className={isVerifying ? 'spinner-icon' : ''} />
            <span>{isVerifying ? 'Verifying...' : 'Re-test Endpoint'}</span>
          </button>
        </div>

        {profileResult && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <CheckCircle2 size={18} />
              <span>JWT Authentication & Authorization Verified (HTTP {profileResult.status} OK - {profileResult.latencyMs}ms)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div><strong>Driver ID:</strong> {profileResult.data?.driverId}</div>
              <div><strong>Name:</strong> {profileResult.data?.name}</div>
              <div><strong>Email:</strong> {profileResult.data?.email}</div>
              <div><strong>Role Claim:</strong> {profileResult.data?.role}</div>
              <div><strong>Wallet ID:</strong> {profileResult.data?.walletId}</div>
              <div><strong>Wallet Balance:</strong> ${profileResult.data?.walletBalance} {profileResult.data?.currency}</div>
            </div>
          </div>
        )}

        {profileError && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1rem',
              color: '#b91c1c'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
              <AlertTriangle size={18} />
              <span>Protected Endpoint Error ({profileError.status})</span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>{profileError.message}</p>
          </div>
        )}

        {/* JWT Token View */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Active Driver JWT Access Token</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowFullToken(!showFullToken)}
                style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
              >
                {showFullToken ? 'Collapse' : 'Expand Token'}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(authUser?.accessToken, 'token')}
                style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                {copiedToken ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                <span>{copiedToken ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
          <pre
            style={{
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.6rem 0.8rem',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--text-main)',
              overflowX: 'auto',
              whiteSpace: showFullToken ? 'pre-wrap' : 'nowrap',
              wordBreak: showFullToken ? 'break-all' : 'normal',
              margin: 0
            }}
          >
            {authUser?.accessToken || 'No token found in current session'}
          </pre>
        </div>

        {/* RBAC Security Access Simulator Card */}
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            background: 'var(--bg-subtle, #f8fafc)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={18} color="#dc2626" />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' }}>
                RBAC Security Enforcement Simulator
              </h4>
            </div>
            <button
              type="button"
              onClick={handleTestRbacSecurity}
              disabled={isTestingRbac}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
              }}
            >
              {isTestingRbac ? <RefreshCw size={14} className="spinner-icon" /> : <ShieldAlert size={14} />}
              <span>{isTestingRbac ? 'Simulating...' : 'Test Company-Only Access'}</span>
            </button>
          </div>

          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Simulates a cross-role breach attempt: sends this <strong>Driver</strong> JWT token to the company-only endpoint (<code>GET /api/company/stations</code>). The backend <code>RoleAuthorizationMiddleware</code> must reject with <strong>403 Forbidden</strong> and log an audit warning.
          </p>

          {rbacResult && (
            <div
              style={{
                background: rbacResult.status === 403 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                border: `1px solid ${rbacResult.status === 403 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                borderRadius: '10px',
                padding: '0.85rem 1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    color: rbacResult.status === 403 ? '#dc2626' : '#16a34a'
                  }}
                >
                  {rbacResult.status === 403 ? <CheckCircle2 size={16} color="#dc2626" /> : <AlertTriangle size={16} />}
                  {rbacResult.status === 403 ? 'HTTP 403 Forbidden (RBAC Enforcement Verified)' : 'RBAC Failed (Unexpected 200 OK)'}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    background: rbacResult.status === 403 ? '#fee2e2' : '#dcfce7',
                    color: rbacResult.status === 403 ? '#b91c1c' : '#15803d'
                  }}
                >
                  HTTP {rbacResult.status} | {rbacResult.latencyMs}ms
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: rbacResult.status === 403 ? '#991b1b' : '#166534' }}>
                <strong>Server Response:</strong> {rbacResult.errorMsg}
              </p>
              {rbacResult.errors?.length > 0 && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#b91c1c' }}>
                  {rbacResult.errors.map((e, idx) => (
                    <div key={`driver-rbac-err-${idx}`}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
