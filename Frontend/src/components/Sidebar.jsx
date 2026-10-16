import React from 'react';
import { LayoutDashboard, Zap, CreditCard, Settings, LogOut, FileText, Activity, X, MapPin, Building2, User } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { resolveImageUrl } from '../services/api';

export default function Sidebar({ userRole, currentView, onViewChange, onLogout, isOpen = false, onClose, authUser }) {
  const isCompany = userRole === 'CompanyAdmin' || userRole === 'Company';

  const driverLinks = [
    { id: 'driver-dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'map', label: 'Find Chargers', icon: MapPin },
    { id: 'wallet', label: 'My Wallet', icon: CreditCard },
    { id: 'history', label: 'Session History', icon: FileText },
    { id: 'account', label: 'My Account', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const companyLinks = [
    { id: 'dashboard', label: 'Analytics', icon: LayoutDashboard },
    { id: 'stations', label: 'Station Management', icon: Zap },
    { id: 'live', label: 'Live Sessions', icon: Activity },
    { id: 'finance', label: 'Revenue', icon: CreditCard },
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const links = isCompany ? companyLinks : driverLinks;
  const homeView = isCompany ? 'dashboard' : 'driver-dashboard';

  const handleNavigate = (id) => {
    onViewChange(id);
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <nav className={`sidebar ${isOpen ? 'open' : ''}`} aria-label={isCompany ? 'Company portal navigation' : 'Driver portal navigation'}>
        <div className="sidebar-brand">
          <button type="button" onClick={() => handleNavigate(homeView)} aria-label="Go to overview">
            <BrandLogo size="sm" />
          </button>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close navigation menu">
            <X size={20} />
          </button>
        </div>

        {isCompany && authUser && (
          <div style={{ padding: '0.2rem 1rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border-light, rgba(255,255,255,0.15))', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {authUser.logoUrl ? (
                <img src={resolveImageUrl(authUser.logoUrl)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <Building2 size={16} color="var(--brand-600, #0284c7)" />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {authUser.companyName || 'Enterprise'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {authUser.tenantId || 'Company Admin'}
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-section-label">{isCompany ? 'Company Portal' : 'Driver Portal'}</div>
        <div className="sidebar-nav">
          {links.map((link) => {
            const isActive = currentView === link.id || 
              (link.id === 'finance' && currentView === 'revenue') ||
              (link.id === 'account' && currentView === 'vehicles') ||
              (link.id === 'company' && currentView === 'company-profile');

            return (
              <button
                key={link.id}
                type="button"
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleNavigate(link.id)}
              >
                <link.icon size={19} />
                {link.label}
              </button>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-promo">
            <div className="sidebar-promo-title">{isCompany ? 'Network insights' : 'Ready to charge?'}</div>
            <div className="sidebar-promo-text">
              {isCompany ? 'Revenue, energy, and forecasts live on Analytics.' : 'Find a nearby charger and scan its QR code to start.'}
            </div>
          </div>
          <button type="button" className="sidebar-item sidebar-item--logout" onClick={onLogout}>
            <LogOut size={19} />
            Logout
          </button>
        </div>
      </nav>
    </>
  );
}
