import React from 'react';
import { Zap, User, LogIn, UserPlus, ShieldCheck, LogOut } from 'lucide-react';

export default function Navbar({
  activeView = 'login',
  onViewChange,
  authUser,
  onLogout
}) {
  const isDriver = authUser?.role === 'Driver' || Boolean(authUser?.driverId);

  const getHomeView = () => {
    if (!authUser) return 'login';
    return isDriver ? 'driver-dashboard' : 'dashboard';
  };

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <button
          type="button"
          className="brand-logo"
          onClick={() => onViewChange?.(getHomeView())}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
        >
          <div className="brand-icon">
            <Zap size={22} strokeWidth={2.5} />
          </div>
          <span>EVNexus</span>
          <span className="brand-badge">{isDriver ? 'Driver Portal' : 'Enterprise'}</span>
        </button>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {authUser ? (
            isDriver ? (
              <button
                type="button"
                className={`nav-item ${activeView === 'driver-dashboard' ? 'active' : ''}`}
                onClick={() => onViewChange?.('driver-dashboard')}
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
              >
                <Zap size={16} />
                <span>Driver Dashboard</span>
              </button>
            ) : (
              <button
                type="button"
                className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                onClick={() => onViewChange?.('dashboard')}
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
              >
                <ShieldCheck size={16} />
                <span>Company Dashboard</span>
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                className={`nav-item ${activeView === 'login' ? 'active' : ''}`}
                onClick={() => onViewChange?.('login')}
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
              >
                <LogIn size={16} />
                <span>Company Sign In</span>
              </button>
              <button
                type="button"
                className={`nav-item ${activeView === 'register' ? 'active' : ''}`}
                onClick={() => onViewChange?.('register')}
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
              >
                <UserPlus size={16} />
                <span>Register Company</span>
              </button>

              <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)', margin: '0 0.5rem', alignSelf: 'center' }} />

              <button
                type="button"
                className={`nav-item ${activeView === 'driver-login' ? 'active' : ''}`}
                onClick={() => onViewChange?.('driver-login')}
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
              >
                <User size={16} />
                <span>Driver Sign In</span>
              </button>
              <button
                type="button"
                className={`nav-item ${activeView === 'driver-register' ? 'active' : ''}`}
                onClick={() => onViewChange?.('driver-register')}
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
              >
                <Zap size={16} />
                <span>Register Driver</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right-hand side user status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {authUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>
                {isDriver ? authUser.name : authUser.companyName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isDriver ? authUser.driverId : authUser.tenantId}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              style={{
                background: 'var(--primary-50)',
                border: '1px solid var(--primary-200)',
                color: 'var(--primary-700)',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Microservices Gateway: <code style={{ color: 'var(--primary-700)', fontWeight: '600' }}>:5000</code>
          </div>
        )}
      </div>
    </header>
  );
}
