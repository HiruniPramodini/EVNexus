import React, { useState } from 'react';
import Navbar from './components/Navbar';
import CompanyLoginPage from './pages/CompanyLoginPage';
import CompanyRegisterPage from './pages/CompanyRegisterPage';
import CompanyDashboard from './components/CompanyDashboard';
import DriverRegisterPage from './pages/DriverRegisterPage';
import { getStoredUser, getAuthToken, clearAuthSession } from './services/api';

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
    return user && token ? 'dashboard' : 'login';
  });

  const handleLoginSuccess = (loginData) => {
    setAuthUser(loginData);
    setActiveView('dashboard');
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthUser(null);
    setActiveView('login');
  };

  const renderCurrentView = () => {
    if (activeView === 'dashboard' && authUser) {
      return <CompanyDashboard authUser={authUser} onLogout={handleLogout} />;
    }
    if (activeView === 'register') {
      return <CompanyRegisterPage onSwitchToLogin={() => setActiveView('login')} />;
    }
    if (activeView === 'driver') {
      return <DriverRegisterPage onSwitchToCompany={() => setActiveView(authUser ? 'dashboard' : 'login')} />;
    }
    return (
      <CompanyLoginPage
        onLoginSuccess={handleLoginSuccess}
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
