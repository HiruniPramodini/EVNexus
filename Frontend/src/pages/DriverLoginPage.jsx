import React from 'react';
import DriverLoginForm from '../components/DriverLoginForm';

export default function DriverLoginPage({ onLoginSuccess, onSwitchToRegister, onSwitchToCompany }) {
  return (
    <main className="main-content">
      <DriverLoginForm
        onLoginSuccess={onLoginSuccess}
        onSwitchToRegister={onSwitchToRegister}
        onSwitchToCompany={onSwitchToCompany}
      />
    </main>
  );
}
