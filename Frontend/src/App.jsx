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
import CompanyRevenuePage from './pages/company/CompanyRevenuePage';
import CompanyProfilePage from './pages/company/CompanyProfilePage';
import CompanySettingsPage from './pages/company/CompanySettingsPage';
import DriverAccountPage from './pages/driver/DriverAccountPage';
import DriverSettingsPage from './pages/driver/DriverSettingsPage';
import { getStoredUser, getAuthToken, clearAuthSession, updateStoredUser, verifyEmailFromLink, resolveImageUrl } from './services/api';

function getInitialActiveView() {
  const user = getStoredUser();
  const token = getAuthToken();
  const isAuthenticated = Boolean(user && token);
  const isDriver = isAuthenticated && (user.role === 'Driver' || Boolean(user.driverId));

  try {
    const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const queryView = (params.get('view') || '').toLowerCase();

    const candidate = queryView || rawHash || rawPath;
    const normalized = (candidate === 'revenue' || candidate === 'finance') ? 'finance' : candidate;

    const validDashboardViews = [
      'dashboard', 'driver-dashboard', 'finance', 'revenue', 'map', 'history',
      'stations', 'wallet', 'live', 'settings', 'staff', 'billing', 'security', 
      'vehicles', 'company', 'company-profile', 'account'
    ];

    if (isAuthenticated) {
      if (normalized && validDashboardViews.includes(normalized)) {
        return normalized;
      }
      return isDriver ? 'driver-dashboard' : 'dashboard';
    }

    if (normalized && ['login', 'register', 'driver-login', 'driver-register'].includes(normalized)) {
      return normalized;
    }
  } catch (e) {
    console.warn('Failed to parse URL for initial view', e);
  }

  return isAuthenticated ? (isDriver ? 'driver-dashboard' : 'dashboard') : 'landing';
}


export default function App() {
  const [authUser, setAuthUser] = useState(() => {
    const user = getStoredUser();
    const token = getAuthToken();
    if (user && token) {
      return { ...user, accessToken: token };
    }
    return null;
  });

  const [activeView, setActiveView] = useState(getInitialActiveView);

  const [linkVerificationNotice, setLinkVerificationNotice] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync activeView with browser history and URL for direct navigation and refresh
  useEffect(() => {
    try {
      const currentPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      const targetPath = activeView === 'landing' ? '/' : `/${activeView}`;
      if (currentPath !== activeView && !(currentPath === '' && activeView === 'landing')) {
        window.history.pushState({ view: activeView }, '', targetPath);
      }
    } catch (_) {}
  }, [activeView]);

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state?.view) {
        setActiveView(event.state.view);
      } else {
        const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
        const norm = (path === 'revenue' || path === 'finance') ? 'finance' : path;
        if (norm) {
          setActiveView(norm);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    activeView === 'revenue' ||
    activeView === 'company' ||
    activeView === 'company-profile' ||
    activeView === 'settings' ||
    activeView === 'analytics' ||
    activeView === 'live' ||
    activeView === 'staff' ||
    activeView === 'billing' ||
    activeView === 'security' ||
    activeView === 'vehicles' ||
    activeView === 'account'
  );

  const renderDashboardContent = () => {
    if (authUser.role === 'CompanyAdmin' || authUser.role === 'Company') {
      switch (activeView) {
        case 'dashboard':
          return <CompanyDashboard authUser={authUser} activeView={activeView} onUpdateProfile={handleProfileUpdated} />;
        case 'finance':
        case 'revenue':
          return <CompanyRevenuePage authUser={authUser} />;
        case 'stations':
          return <StationManagementPage authUser={authUser} />;
        case 'live':
          return <CompanySessionsPage />;
        case 'company':
        case 'company-profile':
          return <CompanyProfilePage authUser={authUser} onUpdateProfile={handleProfileUpdated} />;
        case 'settings':
          return <CompanySettingsPage authUser={authUser} onLogout={handleLogout} />;
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
        case 'account':
          return <DriverAccountPage authUser={authUser} onUpdateProfile={handleDriverProfileUpdated} initialTab="profile" />;
        case 'vehicles':
          return <DriverAccountPage authUser={authUser} onUpdateProfile={handleDriverProfileUpdated} initialTab="vehicles" />;
        case 'settings':
          return <DriverSettingsPage authUser={authUser} onLogout={handleLogout} />;
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
    revenue: 'Revenue',
    company: 'Company Profile',
    'company-profile': 'Company Profile',
    map: 'Find Chargers',
    stations: 'Station Management',
    live: 'Live Sessions',
    history: 'Session History',
    wallet: 'My Wallet',
    account: 'My Account',
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
            authUser={authUser}
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
                <button
                  type="button"
                  className="user-chip user-chip--clickable"
                  onClick={() => setActiveView(isCompanyUser ? 'company-profile' : 'account')}
                  title={isCompanyUser ? 'Go to Company Profile' : 'Go to My Account'}
                  aria-label={isCompanyUser ? 'Go to Company Profile' : 'Go to My Account'}
                >
                  <div className="user-chip-avatar" aria-hidden="true">
                    {isCompanyUser && authUser.logoUrl ? (
                      <img src={resolveImageUrl(authUser.logoUrl)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="user-chip-text">
                    <div className="user-chip-name">{displayName}</div>
                    <div className="user-chip-role">{isCompanyUser ? (resolvedRole === 'Company' ? 'Company' : 'Company Admin') : 'EV Driver'}</div>
                  </div>
                </button>
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
