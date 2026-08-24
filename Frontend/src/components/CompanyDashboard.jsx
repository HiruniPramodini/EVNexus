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
  Clock
} from 'lucide-react';
import { getCompanyProfile, clearAuthSession } from '../services/api';

export default function CompanyDashboard({ authUser, onLogout }) {
  const [copiedTenantId, setCopiedTenantId] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);

  // Protected API Test State
  const [isVerifying, setIsVerifying] = useState(false);
  const [profileResult, setProfileResult] = useState(null);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    // Auto-fetch profile on dashboard mount to test protected endpoint
    handleVerifyProtectedApi();
  }, []);

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
    <div className="main-content" style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
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
              <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Multi-Tenant ID</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tenant context claim</p>
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
