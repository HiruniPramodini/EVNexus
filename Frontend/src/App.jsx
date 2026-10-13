import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Bell, User } from 'lucide-react';
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

  const renderCurrentView = () => {
    if (isDashboardView) {
      return (
        <div className="app-layout">
          <Sidebar 
            userRole={authUser.role || (authUser.driverId ? 'Driver' : 'CompanyAdmin')} 
            currentView={activeView} 
            onViewChange={setActiveView} 
            onLogout={handleLogout} 
          />
          <div className="main-area">
            <div className="topbar">
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {activeView === 'driver-dashboard' || activeView === 'dashboard' ? 'Overview' : 
                 activeView === 'map' ? 'Find Chargers' : 
                 activeView === 'stations' ? 'Station Management' : 
                 activeView === 'live' ? 'Live Sessions' :
                 activeView === 'history' ? 'Session History' : 'Dashboard'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <Bell size={20} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-page)', padding: '0.4rem 0.75rem', borderRadius: '99px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{authUser.name || authUser.companyName}</span>
                </div>
              </div>
            </div>
            <div className="content-scrollable">
              {renderDashboardContent()}
            </div>
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
            className="animate-fade-in"
            style={{
              maxWidth: '960px',
              margin: '1rem auto 0 auto',
              padding: '0.85rem 1.25rem',
              borderRadius: '10px',
              background: linkVerificationNotice.success ? '#dcfce7' : '#fee2e2',
              border: `1px solid ${linkVerificationNotice.success ? '#86efac' : '#fca5a5'}`,
              color: linkVerificationNotice.success ? '#166534' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
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
          />
        )}
      </div>
    );
  };

  return renderCurrentView();
}
