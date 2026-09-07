import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import Navbar from './components/Navbar';
import CompanyLoginPage from './pages/CompanyLoginPage';
import CompanyRegisterPage from './pages/CompanyRegisterPage';
import CompanyDashboard from './components/CompanyDashboard';
import DriverLoginPage from './pages/DriverLoginPage';
import DriverRegisterPage from './pages/DriverRegisterPage';
import DriverDashboard from './components/DriverDashboard';
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
    return 'login';
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
    setActiveView('login');
  };

  const renderCurrentView = () => {
    if (activeView === 'dashboard' && authUser) {
      return (
        <CompanyDashboard
          authUser={authUser}
          onLogout={handleLogout}
          onUpdateProfile={handleProfileUpdated}
        />
      );
    }
    if (activeView === 'driver-dashboard' && authUser) {
      return (
        <DriverDashboard
          authUser={authUser}
          onLogout={handleLogout}
          onUpdateProfile={handleDriverProfileUpdated}
        />
      );
    }
    if (activeView === 'register') {
      return <CompanyRegisterPage onSwitchToLogin={() => setActiveView('login')} />;
    }
    if (activeView === 'driver-login') {
      return (
        <DriverLoginPage
          onLoginSuccess={handleDriverLoginSuccess}
          onSwitchToRegister={() => setActiveView('driver-register')}
          onSwitchToCompany={() => setActiveView('login')}
        />
      );
    }
    if (activeView === 'driver-register' || activeView === 'driver') {
      return (
        <DriverRegisterPage
          onSwitchToLogin={() => setActiveView('driver-login')}
          onSwitchToCompany={() => setActiveView('login')}
        />
      );
    }
    return (
      <CompanyLoginPage
        onLoginSuccess={handleCompanyLoginSuccess}
        onSwitchToRegister={() => setActiveView('register')}
      />
    );
  };

  return (
    <div className="app-container">
      <Navbar
        activeView={activeView}
        onViewChange={setActiveView}
        authUser={authUser}
        onLogout={handleLogout}
      />

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
            title="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {renderCurrentView()}
    </div>
  );
}
