import React, { useState } from 'react';
import { Zap, User, LogIn, UserPlus, ShieldCheck, LogOut, Home, Menu, X } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function Navbar({
  activeView = 'login',
  onViewChange,
  authUser,
  onLogout
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDriver = authUser?.role === 'Driver' || Boolean(authUser?.driverId);

  const getHomeView = () => {
    if (!authUser) return 'landing';
    return isDriver ? 'driver-dashboard' : 'dashboard';
  };

  const go = (view) => {
    setMenuOpen(false);
    onViewChange?.(view);
  };

  const NavButton = ({ view, icon: Icon, label }) => (
    <button
      type="button"
      className={`nav-item ${activeView === view ? 'active' : ''}`}
      aria-current={activeView === view ? 'page' : undefined}
      onClick={() => go(view)}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );

  return (
    <header className="navbar">
      <button
        type="button"
        className="brand-logo"
        onClick={() => go(getHomeView())}
        aria-label="EVNexus home"
      >
        <BrandLogo size="sm" />
        {authUser && <span className="brand-badge">{isDriver ? 'Driver Portal' : 'Enterprise'}</span>}
      </button>

      <nav className={`nav-links ${menuOpen ? 'open' : ''}`} aria-label="Account navigation">
        {authUser ? (
          isDriver ? (
            <NavButton view="driver-dashboard" icon={Zap} label="Driver Dashboard" />
          ) : (
            <NavButton view="dashboard" icon={ShieldCheck} label="Company Dashboard" />
          )
        ) : (
          <>
            <button type="button" className="nav-item" onClick={() => go('landing')}>
              <Home size={16} />
              <span>Home</span>
            </button>
            <div className="nav-divider" />
            <NavButton view="driver-login" icon={User} label="Driver Sign In" />
            <NavButton view="driver-register" icon={Zap} label="Register Driver" />
            <div className="nav-divider" />
            <NavButton view="login" icon={LogIn} label="Company Sign In" />
            <NavButton view="register" icon={UserPlus} label="Register Company" />
          </>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {authUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {authUser.logoUrl && !isDriver ? (
              <img
                src={authUser.logoUrl}
                alt={`${authUser.companyName || 'Company'} Logo`}
                style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-subtle)', background: '#ffffff' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : null}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {isDriver ? authUser.name : authUser.companyName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isDriver ? authUser.driverId : authUser.tenantId}
              </div>
            </div>
            <button type="button" onClick={onLogout} className="btn-secondary">
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="nav-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}
