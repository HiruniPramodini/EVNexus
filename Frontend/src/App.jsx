import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CompanyLoginPage from './pages/CompanyLoginPage';
import CompanyRegisterPage from './pages/CompanyRegisterPage';
import CompanyDashboard from './components/CompanyDashboard';
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

  return (
    <div className="app-container">
      <Navbar
        activeView={activeView}
        onViewChange={setActiveView}
        authUser={authUser}
        onLogout={handleLogout}
      />

      {activeView === 'dashboard' && authUser ? (
        <CompanyDashboard authUser={authUser} onLogout={handleLogout} />
      ) : activeView === 'register' ? (
        <CompanyRegisterPage onSwitchToLogin={() => setActiveView('login')} />
      ) : activeView === 'driver' ? (
        <main className="main-content">
          <div className="register-card" style={{ textAlign: 'center', padding: '3rem 2rem', maxWidth: '540px', margin: '2rem auto' }}>
            <h2 className="card-title">Driver Portal</h2>
            <p className="card-subtitle" style={{ marginTop: '0.5rem' }}>
              Driver authentication, RFID card linking, and charging sessions will be available in the upcoming stories.
            </p>
            <button
              type="button"
              className="submit-btn"
              style={{ maxWidth: '240px', margin: '1.5rem auto 0' }}
              onClick={() => setActiveView(authUser ? 'dashboard' : 'login')}
            >
              {authUser ? 'Back to Dashboard' : 'Back to Company Portal'}
            </button>
          </div>
        </main>
      ) : (
        <CompanyLoginPage
          onLoginSuccess={handleLoginSuccess}
          onSwitchToRegister={() => setActiveView('register')}
        />
      )}
    </div>
  );
}
