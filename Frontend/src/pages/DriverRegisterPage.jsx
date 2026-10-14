import React from 'react';
import DriverRegisterForm from '../components/DriverRegisterForm';
import AuthLayout from '../components/AuthLayout';
import { MapPin, Shield, Zap } from 'lucide-react';

export default function DriverRegisterPage({ onSwitchToLogin, onSwitchToCompany }) {
  return (
    <AuthLayout
      image="/images/charging-connector.jpg"
      imageAlt="Electric vehicle charging connector plugged in"
      eyebrow={
        <>
          <Zap size={14} /> Join the Driver Network
        </>
      }
      title="Join the future of clean EV mobility."
      description="Create your unified driver account today. Zero monthly subscription fees — discover stations, top up your wallet, and pay only for the energy you use."
      highlights={[
        {
          icon: MapPin,
          title: 'Instant Station Access',
          text: 'Locate chargers across multiple networks with one unified login.'
        },
        {
          icon: Shield,
          title: 'Integrated Digital Wallet',
          text: 'Top up and pay seamlessly with instant refunds and receipts.'
        }
      ]}
    >
      <DriverRegisterForm
        onSwitchToLogin={onSwitchToLogin}
        onSwitchToCompany={onSwitchToCompany}
      />
    </AuthLayout>
  );
}
