import React from 'react';
import DriverLoginForm from '../components/DriverLoginForm';
import AuthLayout from '../components/AuthLayout';
import { MapPin, Shield, Zap } from 'lucide-react';

export default function DriverLoginPage({ onLoginSuccess, onSwitchToRegister, onSwitchToCompany }) {
  return (
    <AuthLayout
      image="/images/ev-road-journey.jpg"
      imageAlt="Electric vehicle journey on scenic road"
      eyebrow={
        <>
          <Zap size={14} /> EV Driver Portal
        </>
      }
      title="Your seamless journey, powered by EVNexus."
      description="Access our unified network of fast-charging stations. Locate open connectors, scan QR codes to charge, and pay with one digital wallet."
      highlights={[
        {
          icon: MapPin,
          title: 'Smart Discovery',
          text: 'Find live available chargers with real-time station status.'
        },
        {
          icon: Shield,
          title: 'Secure Wallet',
          text: 'Frictionless, transparent payments for every charging session.'
        }
      ]}
    >
      <DriverLoginForm
        onLoginSuccess={onLoginSuccess}
        onSwitchToRegister={onSwitchToRegister}
        onSwitchToCompany={onSwitchToCompany}
      />
    </AuthLayout>
  );
}
