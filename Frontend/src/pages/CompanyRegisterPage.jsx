import React from 'react';
import CompanyRegisterForm from '../components/CompanyRegisterForm';
import { Building2, BarChart3, ShieldCheck, Zap } from 'lucide-react';

export default function CompanyRegisterPage({ onSwitchToLogin, onSwitchToDriver }) {
  return (
    <div className="auth-split-container">
      <div className="auth-visual-side" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="auth-visual-overlay" style={{ background: 'rgba(15,23,42,0.4)' }}></div>
        <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', padding: 'var(--space-12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'white', marginBottom: 'auto' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={24} color="white" />
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 'var(--weight-bold)' }}>EVNexus Enterprise</span>
          </div>
          
          <div style={{ marginBottom: 'auto', marginTop: 'auto', color: 'white', maxWidth: '480px' }}>
            <h2 className="text-h1" style={{ color: 'white', marginBottom: 'var(--space-6)', lineHeight: 1.2 }}>
              Partner with the EVNexus network.
            </h2>
            <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.8)', marginBottom: 'var(--space-10)', lineHeight: 1.6 }}>
              Set up your isolated enterprise tenant. Start managing stations, setting tariffs, and processing payments today.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: '1.1rem' }}>Tenant Isolation</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Enterprise-grade security and data privacy.</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: '1.1rem' }}>Automated Settlement</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Receive funds securely directly to your accounts.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-form-side" style={{ overflowY: 'auto' }}>
        <CompanyRegisterForm
          onSwitchToLogin={onSwitchToLogin}
          onSwitchToDriver={onSwitchToDriver}
        />
      </div>
    </div>
  );
}
