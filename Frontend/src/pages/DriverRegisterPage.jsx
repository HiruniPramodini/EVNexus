import React from 'react';
import DriverRegisterForm from '../components/DriverRegisterForm';

export default function DriverRegisterPage({ onSwitchToLogin, onSwitchToCompany }) {
  return (
    <main className="main-content">
      <DriverRegisterForm
        onSwitchToLogin={onSwitchToLogin}
        onSwitchToCompany={onSwitchToCompany}
      />
    </main>
  );
}
