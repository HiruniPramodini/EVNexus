import React from 'react';
import CompanyLoginForm from '../components/CompanyLoginForm';
import AuthLayout from '../components/AuthLayout';
import { Building2, BarChart3, Settings2 } from 'lucide-react';

export default function CompanyLoginPage({ onLoginSuccess, onSwitchToRegister, onSwitchToDriver }) {
  return (
    <AuthLayout
      image="/images/charging-hub.jpg"
      imageAlt="Modern solar-canopy EV charging hub"
      eyebrow={
        <>
          <Building2 size={14} /> EVNexus Enterprise
        </>
      }
      title="Scale and optimize your charging network."
      description="Enterprise-grade management for charging point operators and infrastructure providers. Monitor stations, configure tariffs, and track revenue in real-time."
      highlights={[
        {
          icon: Settings2,
          title: 'Station & Port Control',
          text: 'Provision chargers, generate QR codes, and monitor live port status.'
        },
        {
          icon: BarChart3,
          title: 'Revenue & AI Analytics',
          text: 'Real-time financial tracking, energy delivered, and 7-day demand forecasting.'
        }
      ]}
    >
      <CompanyLoginForm
        onLoginSuccess={onLoginSuccess}
        onSwitchToRegister={onSwitchToRegister}
        onSwitchToDriver={onSwitchToDriver}
      />
    </AuthLayout>
  );
}
