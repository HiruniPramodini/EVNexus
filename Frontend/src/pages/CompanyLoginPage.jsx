import React from 'react';
import CompanyLoginForm from '../components/CompanyLoginForm';

export default function CompanyLoginPage({ onLoginSuccess, onSwitchToRegister }) {
  return (
    <main className="main-content">
      <CompanyLoginForm
        onLoginSuccess={onLoginSuccess}
        onSwitchToRegister={onSwitchToRegister}
      />
    </main>
  );
}
