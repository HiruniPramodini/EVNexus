import React from 'react';
import CompanyRegisterForm from '../components/CompanyRegisterForm';
import AuthLayout from '../components/AuthLayout';
import { Building2, ShieldCheck, BarChart3 } from 'lucide-react';

export default function CompanyRegisterPage({ onSwitchToLogin, onSwitchToDriver }) {
  return (
    <AuthLayout
      image="/images/hero-ev-charging.jpg"
      imageAlt="Electric SUV at contemporary charging station"
      eyebrow={
        <>
          <Building2 size={14} /> Operator Onboarding
        </>
      }
      title="Partner with the EVNexus charging ecosystem."
      description="Launch your dedicated enterprise tenant. Deploy charging stations, connect chargers to our open network, and start serving drivers instantly."
      highlights={[
        {
          icon: ShieldCheck,
          title: 'Strict Tenant Isolation',
          text: 'Cryptographically protected multi-tenant boundaries for all your data.'
        },
        {
          icon: BarChart3,
          title: 'Automated Settlement',
          text: 'Integrated payment processing with transparent session accounting.'
        }
      ]}
    >
      <CompanyRegisterForm
        onSwitchToLogin={onSwitchToLogin}
        onSwitchToDriver={onSwitchToDriver}
      />
    </AuthLayout>
  );
}
