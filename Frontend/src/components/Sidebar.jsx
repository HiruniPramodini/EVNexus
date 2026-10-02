import React from 'react';
import { LayoutDashboard, Zap, CreditCard, Settings, LogOut, FileText, Activity } from 'lucide-react';

export default function Sidebar({ userRole, currentView, onViewChange, onLogout }) {
  const isCompany = userRole === 'CompanyAdmin' || userRole === 'Company';

  const driverLinks = [
    { id: 'driver-dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'map', label: 'Find Chargers', icon: Zap },
    { id: 'wallet', label: 'My Wallet', icon: CreditCard },
    { id: 'history', label: 'Session History', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const companyLinks = [
    { id: 'dashboard', label: 'Analytics', icon: LayoutDashboard },
    { id: 'stations', label: 'Station Management', icon: Zap },
    { id: 'live', label: 'Live Sessions', icon: Activity },
    { id: 'finance', label: 'Revenue', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const links = isCompany ? companyLinks : driverLinks;

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon-dark">
          <Zap size={20} strokeWidth={2.5} />
        </div>
        EVNexus
      </div>

      <div className="sidebar-nav">
        {links.map((link) => (
          <button
            key={link.id}
            className={`sidebar-item ${currentView === link.id ? 'active' : ''}`}
            onClick={() => onViewChange(link.id)}
            style={{ border: 'none', background: currentView === link.id ? 'rgba(0, 212, 255, 0.1)' : 'transparent', width: '100%', textAlign: 'left', fontFamily: 'inherit', fontSize: '0.95rem' }}
          >
            <link.icon size={18} />
            {link.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 'auto', padding: '1.5rem 1rem' }}>
        <button
          className="sidebar-item"
          onClick={onLogout}
          style={{ border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontFamily: 'inherit', fontSize: '0.95rem', color: '#fca5a5' }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}
