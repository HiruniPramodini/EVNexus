import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Bell, Menu } from 'lucide-react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import CompanyLoginPage from './pages/CompanyLoginPage';
import CompanyRegisterPage from './pages/CompanyRegisterPage';
import CompanyDashboard from './components/CompanyDashboard';
import DriverLoginPage from './pages/DriverLoginPage';
import DriverRegisterPage from './pages/DriverRegisterPage';
import DriverDashboard from './components/DriverDashboard';
import MapDashboardPage from './pages/driver/MapDashboardPage';
import SessionHistoryPage from './pages/driver/SessionHistoryPage';
import WalletPage from './pages/driver/WalletPage';
import StationManagementPage from './pages/company/StationManagementPage';
import CompanySessionsPage from './pages/company/CompanySessionsPage';
import { getStoredUser, getAuthToken, clearAuthSession, updateStoredUser, verifyEmailFromLink } from './services/api';

export default function App() {
  const [authUser, setAuthUser] = useState(() => {
    const user = getStoredUser();
    const token = getAuthToken();
    if (user && token) {
      return { ...user, accessToken: token };
    }
    return null;
  });

  const [activeView, setActiveView] = useState(() => {
    const user = getStoredUser();
    const token = getAuthToken();
    if (user && token) {
      return user.role === 'Driver' || user.driverId ? 'driver-dashboard' : 'dashboard';
    }
    return 'landing'; // Default to new landing page
  });

  const [linkVerificationNotice, setLinkVerificationNotice] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const email = params.get('email');
      const code = params.get('code');
      if (email && code) {
        verifyEmailFromLink(email, code)
          .then((res) => {
            setLinkVerificationNotice({
              success: true,
              message: res?.message || 'Email successfully verified! Full platform access is unlocked.'
            });
            setAuthUser((prev) => (prev ? { ...prev, isEmailVerified: true } : null));
            window.history.replaceState({}, document.title, window.location.pathname);
          })
          .catch((err) => {
            setLinkVerificationNotice({
              success: false,
              message: err.message || 'Verification link is invalid or expired. Codes expire after 24 hours.'
            });
          });
      }
    } catch (e) {
      console.error('Error checking verification URL params', e);
    }
  }, []);

  const handleCompanyLoginSuccess = (loginData) => {
    setAuthUser(loginData);
    setActiveView('dashboard');
  };

  const handleDriverLoginSuccess = (loginData) => {
    setAuthUser(loginData);
    setActiveView('driver-dashboard');
  };

  const handleProfileUpdated = (updatedProfile) => {
    setAuthUser((prev) => {
      const merged = {
        ...prev,
        companyName: updatedProfile.companyName || prev?.companyName,
        phone: updatedProfile.phone || prev?.phone,
        address: updatedProfile.address || prev?.address,
        logoUrl: updatedProfile.logoUrl !== undefined ? updatedProfile.logoUrl : prev?.logoUrl,
        businessEmail: updatedProfile.businessEmail || prev?.businessEmail
      };
      updateStoredUser(merged);
      return merged;
    });
  };

  const handleDriverProfileUpdated = (updatedProfile) => {
    setAuthUser((prev) => {
      const merged = {
        ...prev,
        name: updatedProfile.name || prev?.name,
        phone: updatedProfile.phone || prev?.phone
      };
      updateStoredUser(merged);
      return merged;
    });
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthUser(null);
    setActiveView('landing');
  };

  // Determine layout type based on active view
  const isDashboardView = authUser && !!(
    activeView === 'dashboard' || 
    activeView === 'driver-dashboard' || 
    activeView === 'map' || 
    activeView === 'history' || 
    activeView === 'stations' || 
    activeView === 'wallet' || 
    activeView === 'finance' ||
    activeView === 'settings' ||
    activeView === 'analytics' ||
    activeView === 'live' ||
    activeView === 'staff' ||
    activeView === 'billing' ||
    activeView === 'security' ||
    activeView === 'vehicles'
  );

  const renderDashboardContent = () => {
    if (authUser.role === 'CompanyAdmin' || authUser.role === 'Company') {
      switch (activeView) {
        case 'dashboard':
          return <CompanyDashboard authUser={authUser} activeView={activeView} onUpdateProfile={handleProfileUpdated} />;
        case 'stations':
          return <StationManagementPage authUser={authUser} />;
        case 'live':
          return <CompanySessionsPage />;
        // Add more company views here
        default:
          return <CompanyDashboard authUser={authUser} activeView={activeView} onUpdateProfile={handleProfileUpdated} />;
      }
    } else {
      switch (activeView) {
        case 'driver-dashboard':
          return <DriverDashboard authUser={authUser} activeView={activeView} onUpdateProfile={handleDriverProfileUpdated} onViewChange={setActiveView} />;
        case 'map':
          return <MapDashboardPage authUser={authUser} onViewChange={setActiveView} />;
        case 'history':
          return <SessionHistoryPage authUser={authUser} />;
        case 'wallet':
          return <WalletPage authUser={authUser} />;
        // Add more driver views here
        default:
          return <DriverDashboard authUser={authUser} activeView={activeView} onUpdateProfile={handleDriverProfileUpdated} onViewChange={setActiveView} />;
      }
    }
  };

  const VIEW_TITLES = {
    'driver-dashboard': 'Overview',
    dashboard: 'Overview',
    analytics: 'Analytics',
    finance: 'Revenue',
    map: 'Find Chargers',
    stations: 'Station Management',
    live: 'Live Sessions',
    history: 'Session History',
    wallet: 'My Wallet',
    settings: 'Settings',
    staff: 'Staff',
    billing: 'Billing',
    security: 'Security',
    vehicles: 'My Vehicles'
  };

  const renderCurrentView = () => {
    if (isDashboardView) {
      const resolvedRole = authUser.role || (authUser.driverId ? 'Driver' : 'CompanyAdmin');
      const isCompanyUser = resolvedRole === 'CompanyAdmin' || resolvedRole === 'Company';
      const displayName = authUser.name || authUser.companyName || 'Account';
      return (
        <div className="app-layout">
          <Sidebar 
            userRole={resolvedRole} 
            currentView={activeView} 
            onViewChange={setActiveView} 
            onLogout={handleLogout} 
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <div className="main-area">
            <header className="topbar">
              <div className="topbar-left">
                <button
                  type="button"
                  className="topbar-menu-btn"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <Menu size={20} />
                </button>
                <div style={{ minWidth: 0 }}>
                  <div className="topbar-crumb">{isCompanyUser ? 'Company Portal' : 'Driver Portal'}</div>
                  <div className="topbar-title">{VIEW_TITLES[activeView] || 'Dashboard'}</div>
                </div>
              </div>
              <div className="topbar-right">
                <button type="button" className="icon-btn" aria-label="Notifications">
                  <Bell size={18} />
                </button>
                <div className="user-chip">
                  <div className="user-chip-avatar" aria-hidden="true">
                    {isCompanyUser && authUser.logoUrl ? (
                      <img src={authUser.logoUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="user-chip-text">
                    <div className="user-chip-name">{displayName}</div>
                    <div className="user-chip-role">{isCompanyUser ? (resolvedRole === 'Company' ? 'Company' : 'Company Admin') : 'EV Driver'}</div>
                  </div>
                </div>
              </div>
            </header>
            <main className={`content-scrollable ${activeView === 'map' ? 'content-scrollable--flush' : ''}`}>
              {renderDashboardContent()}
            </main>
          </div>
        </div>
      );
    }

    // Public / Auth Views
    return (
      <div className="app-container">
        {activeView !== 'landing' && (
          <Navbar
            activeView={activeView}
            onViewChange={setActiveView}
            authUser={null}
          />
        )}

        {linkVerificationNotice && (
          <div
            role="status"
            className={`alert ${linkVerificationNotice.success ? 'alert-success' : 'alert-danger'} animate-fade-in`}
            style={{
              maxWidth: '960px',
              width: 'calc(100% - 2rem)',
              margin: '1rem auto 0 auto',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {linkVerificationNotice.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{linkVerificationNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setLinkVerificationNotice(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'currentColor',
                opacity: 0.7,
                padding: '0.2rem'
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {activeView === 'landing' && <LandingPage onNavigate={setActiveView} />}
        {activeView === 'register' && <CompanyRegisterPage onSwitchToLogin={() => setActiveView('login')} onSwitchToDriver={() => setActiveView('driver-register')} />}
        {activeView === 'driver-login' && (
          <DriverLoginPage
            onLoginSuccess={handleDriverLoginSuccess}
            onSwitchToRegister={() => setActiveView('driver-register')}
            onSwitchToCompany={() => setActiveView('login')}
          />
        )}
        {(activeView === 'driver-register' || activeView === 'driver') && (
          <DriverRegisterPage
            onSwitchToLogin={() => setActiveView('driver-login')}
            onSwitchToCompany={() => setActiveView('login')}
          />
        )}
        {activeView === 'login' && (
          <CompanyLoginPage
            onLoginSuccess={handleCompanyLoginSuccess}
            onSwitchToRegister={() => setActiveView('register')}
            onSwitchToDriver={() => setActiveView('driver-login')}
          />
        )}
      </div>
    );
  };

  return renderCurrentView();
}
