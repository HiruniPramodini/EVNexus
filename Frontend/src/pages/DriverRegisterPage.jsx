import React from 'react';
import DriverRegisterForm from '../components/DriverRegisterForm';

export default function DriverRegisterPage({ onSwitchToCompany }) {
  return (
    <main className="main-content">
      <DriverRegisterForm onSwitchToCompany={onSwitchToCompany} />
    </main>
  );
}
