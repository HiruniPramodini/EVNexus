import React, { useState } from 'react';
import Navbar from './components/Navbar';
import CompanyRegisterPage from './pages/CompanyRegisterPage';

export default function App() {
  const [activePortal, setActivePortal] = useState('company');

  return (
    <div className="app-container">
      <Navbar activePortal={activePortal} onPortalChange={setActivePortal} />
      {activePortal === 'company' ? (
        <CompanyRegisterPage />
      ) : (
        <main className="main-content">
          <div className="register-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <h2 className="card-title">Driver Portal</h2>
            <p className="card-subtitle" style={{ marginTop: '0.5rem' }}>
              Driver authentication and charging sessions will be available in the upcoming stories.
            </p>
            <button
              className="submit-btn"
              style={{ maxWidth: '240px', margin: '1.5rem auto 0' }}
              onClick={() => setActivePortal('company')}
            >
              Back to Company Portal
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
