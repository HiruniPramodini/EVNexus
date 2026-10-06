import React from 'react';
import DriverLoginForm from '../components/DriverLoginForm';
import { MapPin, Zap, Shield } from 'lucide-react';

export default function DriverLoginPage({ onLoginSuccess, onSwitchToRegister, onSwitchToCompany }) {
  return (
    <div className="auth-split-container">
      <div className="auth-visual-side" style={{ background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)' }}>
        <div className="auth-visual-overlay"></div>
        <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', padding: 'var(--space-12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'white', marginBottom: 'auto' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={24} color="white" />
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 'var(--weight-bold)' }}>EVNexus</span>
          </div>
          
          <div style={{ marginBottom: 'auto', marginTop: 'auto', color: 'white', maxWidth: '480px' }}>
            <h2 className="text-h1" style={{ color: 'white', marginBottom: 'var(--space-6)', lineHeight: 1.2 }}>
              Your journey,<br/>powered by EVNexus.
            </h2>
            <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.8)', marginBottom: 'var(--space-10)', lineHeight: 1.6 }}>
              Access the largest unified network of fast-charging stations. One app, thousands of chargers.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: '1.1rem' }}>Smart Discovery</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Find available chargers instantly.</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: '1.1rem' }}>Secure Wallet</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Frictionless payments for every charge.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-form-side">
        <DriverLoginForm
          onLoginSuccess={onLoginSuccess}
          onSwitchToRegister={onSwitchToRegister}
          onSwitchToCompany={onSwitchToCompany}
        />
      </div>
    </div>
  );
}
