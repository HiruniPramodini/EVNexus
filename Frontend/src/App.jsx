import React, { useState } from 'react';
import Navbar from './components/Navbar';
import CompanyLoginPage from './pages/CompanyLoginPage';
import CompanyRegisterPage from './pages/CompanyRegisterPage';
import CompanyDashboard from './components/CompanyDashboard';
import DriverLoginPage from './pages/DriverLoginPage';
import DriverRegisterPage from './pages/DriverRegisterPage';
import DriverDashboard from './components/DriverDashboard';
import { getStoredUser, getAuthToken, clearAuthSession, updateStoredUser } from './services/api';

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
      {renderCurrentView()}
    </div>
  );
}
