import React from 'react';
import { LayoutDashboard, Zap, CreditCard, Settings, LogOut, FileText, Activity, X, MapPin, Building2, User } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function Sidebar({ userRole, currentView, onViewChange, onLogout, isOpen = false, onClose }) {
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
