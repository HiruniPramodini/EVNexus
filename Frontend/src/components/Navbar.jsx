import React from 'react';
import { Zap, Building2, User, ShieldCheck } from 'lucide-react';

export default function Navbar({ activePortal = 'company', onPortalChange }) {
  return (
    <header className="navbar">
      <a href="#" className="brand-logo">
        <div className="brand-icon">
          <Zap size={22} strokeWidth={2.5} />
        </div>
        <span>EVNexus</span>
        <span className="brand-badge">Enterprise</span>
      </a>

      <nav className="nav-links">
        <button
          className={`nav-item ${activePortal === 'company' ? 'active' : ''}`}
          onClick={() => onPortalChange?.('company')}
          style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
        >
          <Building2 size={16} />
          <span>Company Portal</span>
        </button>
        <button
          className={`nav-item ${activePortal === 'driver' ? 'active' : ''}`}
          onClick={() => onPortalChange?.('driver')}
          style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
        >
          <User size={16} />
          <span>Driver Portal</span>
        </button>
      </nav>
    </header>
  );
}
