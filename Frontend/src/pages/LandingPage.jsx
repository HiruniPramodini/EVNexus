import React from 'react';
import { ArrowRight, Zap, Shield, Globe, MapPin, QrCode, CreditCard, BarChart3, Settings2, Smartphone, Monitor } from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  return (
    <div className="app-container" style={{ backgroundColor: 'var(--color-surface)', overflowX: 'hidden' }}>
      
      {/* Navigation */}
      <nav style={{ 
        padding: 'var(--space-4) var(--space-6)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ 
            width: 36, height: 36, borderRadius: 'var(--radius-md)', 
            background: 'var(--color-primary)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}>
            <Zap size={20} color="white" />
          </div>
          <span style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>EVNexus</span>
        </div>
        
        {/* Desktop Nav Links */}
        <div style={{ display: 'none' }} className="nav-links">
          {/* We'll use a media query in style tag or just hide on mobile via inline flex block later, but for React inline styles we need to do basic responsive or just keep it simple */}
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <button 
            onClick={() => onNavigate('driver-login')}
            className="btn btn-ghost"
          >
            Driver Login
          </button>
          <button 
            onClick={() => onNavigate('login')}
            className="btn btn-outline"
          >
            Company Portal
          </button>
          <button 
            onClick={() => onNavigate('driver-register')}
            className="btn btn-primary"
          >
            Get Started
          </button>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section style={{ 
          padding: 'var(--space-16) var(--space-6)', 
          textAlign: 'center',
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <span className="badge badge-info" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-2) var(--space-4)' }}>
            Smart EV Charging Platform
          </span>
          <h1 className="text-h1" style={{ fontSize: '3.5rem', lineHeight: 1.2, marginBottom: 'var(--space-6)', letterSpacing: '-0.02em' }}>
            Charge smarter. <br/>
            <span style={{ color: 'var(--color-primary)' }}>Manage charging better.</span>
          </h1>
          <p className="text-body" style={{ color: 'var(--color-text-secondary)', fontSize: '1.25rem', maxWidth: '700px', margin: '0 auto var(--space-8) auto' }}>
            The unified platform connecting EV drivers with charging network operators. Discover stations, manage payments, and scale your charging business seamlessly.
          </p>
          
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={() => onNavigate('driver-register')}
              className="btn btn-primary"
              style={{ padding: 'var(--space-3) var(--space-6)', height: 'auto', fontSize: '1.125rem' }}
            >
              Find a Charging Station <ArrowRight size={20} />
            </button>
            <button 
              onClick={() => onNavigate('register')}
              className="btn btn-outline"
              style={{ padding: 'var(--space-3) var(--space-6)', height: 'auto', fontSize: '1.125rem' }}
            >
              For Charging Companies
            </button>
          </div>
        </section>

        {/* Hero Visual (Product Preview) */}
        <section style={{ padding: '0 var(--space-6) var(--space-16) var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ 
            background: 'var(--color-background)', 
            borderRadius: 'var(--radius-lg)', 
            padding: 'var(--space-2)',
            boxShadow: 'var(--shadow-modal)',
            border: '1px solid var(--color-border)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Mock Dashboard UI */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', display: 'flex', height: '400px', border: '1px solid var(--color-border)' }}>
              <div style={{ width: '200px', borderRight: '1px solid var(--color-border)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', background: 'var(--bg-sidebar)' }}>
                <div className="skeleton-title" style={{ background: 'rgba(255,255,255,0.1)' }}></div>
                <div className="skeleton-text" style={{ background: 'rgba(255,255,255,0.1)' }}></div>
                <div className="skeleton-text" style={{ background: 'rgba(255,255,255,0.1)' }}></div>
              </div>
              <div style={{ flex: 1, padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', background: 'var(--color-background)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                  <div className="card" style={{ flex: 1, height: '100px' }}>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>Active Sessions (Demo)</div>
                    <div style={{ fontSize: 'var(--text-h2)', fontWeight: 'var(--weight-bold)' }}>24</div>
                  </div>
                  <div className="card" style={{ flex: 1, height: '100px' }}>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>Energy Delivered (Demo)</div>
                    <div style={{ fontSize: 'var(--text-h2)', fontWeight: 'var(--weight-bold)' }}>1,430 kWh</div>
                  </div>
                  <div className="card" style={{ flex: 1, height: '100px' }}>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>Network Status</div>
                    <div className="badge badge-success" style={{ marginTop: 'var(--space-2)' }}>99.9% Uptime</div>
                  </div>
                </div>
                <div className="card" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)', marginBottom: 'var(--space-4)' }}>Activity Trend (Illustrative)</div>
                  <div style={{ width: '100%', height: '100px', background: 'linear-gradient(to top, var(--color-primary-light), transparent)', borderBottom: '2px solid var(--color-primary)', borderRadius: 'var(--radius-sm)' }}></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Value Proposition */}
        <section style={{ padding: 'var(--space-16) var(--space-6)', backgroundColor: 'var(--color-background)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
              <h2 className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>The complete EV charging ecosystem</h2>
              <p className="text-body" style={{ color: 'var(--color-text-secondary)', maxWidth: '600px', margin: '0 auto' }}>Everything you need to charge your vehicle or manage your charging infrastructure.</p>
            </div>
            
            <div className="grid grid-cols-4" style={{ gap: 'var(--space-6)' }}>
              {[
                { icon: MapPin, title: 'Smart Discovery', desc: 'Discover and navigate to charging stations easily with real-time availability.' },
                { icon: Monitor, title: 'Unified Platform', desc: 'Drivers and charging companies operate through one seamless platform.' },
                { icon: Shield, title: 'Secure Payments', desc: 'Manage your wallet and process charging payments securely and instantly.' },
                { icon: BarChart3, title: 'Data & Analytics', desc: 'Gain visibility into revenue, energy usage, and charging activity trends.' }
              ].map((feature, i) => (
                <div key={i} className="card card-elevated" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
                    <feature.icon size={24} />
                  </div>
                  <h3 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>{feature.title}</h3>
                  <p className="text-secondary">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For Drivers Section */}
        <section style={{ padding: 'var(--space-16) var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 'var(--space-12)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 400px' }}>
              <span className="badge badge-info" style={{ marginBottom: 'var(--space-4)' }}>For Drivers</span>
              <h2 className="text-h2" style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>Find and charge with a single tap.</h2>
              <p className="text-body" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                Stop downloading a different app for every charging station. EVNexus gives you access to a massive unified network.
              </p>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-8) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[
                  'Real-time station discovery and status',
                  'Frictionless QR-code charging',
                  'Integrated digital wallet for seamless payments',
                  'Detailed charging history and receipts'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ color: 'var(--color-success)' }}><CheckIcon /></div>
                    <span className="text-secondary" style={{ fontWeight: 'var(--weight-medium)' }}>{item}</span>
                  </li>
                ))}
              </ul>
              
              <button onClick={() => onNavigate('driver-register')} className="btn btn-primary" style={{ padding: 'var(--space-3) var(--space-6)', height: 'auto' }}>
                Start Charging <ArrowRight size={18} />
              </button>
            </div>
            
            {/* Visual */}
            <div style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: '320px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--space-6)', border: '8px solid var(--color-border)', height: '600px', padding: 'var(--space-4)', position: 'relative', boxShadow: 'var(--shadow-modal)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
                  <div className="skeleton-avatar" style={{ width: 32, height: 32 }}></div>
                  <div className="skeleton-title" style={{ width: 80, margin: 0, height: 32, borderRadius: 'var(--radius-pill)' }}></div>
                </div>
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <div style={{ fontWeight: 'var(--weight-bold)' }}>Station A-12</div>
                    <div className="badge badge-success">Available</div>
                  </div>
                  <div style={{ height: 120, background: 'var(--color-background)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <QrCode size={48} color="var(--color-text-muted)" />
                  </div>
                </div>
                <div className="card">
                  <div style={{ fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)' }}>Wallet Balance</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary)' }}>$45.00</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* For Companies Section */}
        <section style={{ padding: 'var(--space-16) var(--space-6)', backgroundColor: 'var(--color-background)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: 'var(--space-12)', alignItems: 'center', flexWrap: 'wrap-reverse' }}>
            
            {/* Visual */}
            <div style={{ flex: '1 1 400px' }}>
              <div style={{ width: '100%', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                  <div className="card" style={{ flex: 1, padding: 'var(--space-4)' }}>
                     <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Revenue (Mock)</div>
                     <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>$1,240</div>
                  </div>
                  <div className="card" style={{ flex: 1, padding: 'var(--space-4)' }}>
                     <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Sessions</div>
                     <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>142</div>
                  </div>
                </div>
                <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
                  <table className="table" style={{ fontSize: '0.75rem' }}>
                    <thead>
                      <tr><th>Station</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>Downtown Plaza #1</td><td><span className="badge badge-charging">Charging</span></td></tr>
                      <tr><td>Downtown Plaza #2</td><td><span className="badge badge-available">Available</span></td></tr>
                      <tr><td>Westside Mall #1</td><td><span className="badge badge-offline">Offline</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 400px' }}>
              <span className="badge badge-primary" style={{ marginBottom: 'var(--space-4)', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}>For Companies</span>
              <h2 className="text-h2" style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>Manage your network from one platform.</h2>
              <p className="text-body" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
                Scale your EV charging infrastructure with enterprise-grade management tools. Control pricing, monitor health, and analyze revenue.
              </p>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-8) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[
                  'Comprehensive station and charger management',
                  'Real-time monitoring and activity logs',
                  'Automated payment processing and settlement',
                  'Revenue forecasting and energy analytics'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ color: 'var(--color-primary)' }}><CheckIcon /></div>
                    <span className="text-secondary" style={{ fontWeight: 'var(--weight-medium)' }}>{item}</span>
                  </li>
                ))}
              </ul>
              
              <button onClick={() => onNavigate('register')} className="btn btn-outline" style={{ padding: 'var(--space-3) var(--space-6)', height: 'auto' }}>
                Register Your Company
              </button>
            </div>

          </div>
        </section>

        {/* Trust / Security */}
        <section style={{ padding: 'var(--space-16) var(--space-6)', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <Shield size={48} color="var(--color-primary)" style={{ margin: '0 auto var(--space-4) auto' }} />
          <h2 className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>Enterprise-Grade Reliability</h2>
          <p className="text-body" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-10)', maxWidth: '600px', margin: '0 auto var(--space-10) auto' }}>
            Built on a robust architecture ensuring strict tenant isolation, role-based access control, and secure payment processing.
          </p>
          <div className="grid grid-cols-3" style={{ gap: 'var(--space-6)', textAlign: 'left' }}>
            <div className="card">
              <h4 style={{ fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)' }}>Tenant Isolation</h4>
              <p className="text-caption">Strict data boundaries ensure your company data and customer information remain completely isolated.</p>
            </div>
            <div className="card">
              <h4 style={{ fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)' }}>Secure Payments</h4>
              <p className="text-caption">End-to-end encrypted wallet transactions and charging settlements.</p>
            </div>
            <div className="card">
              <h4 style={{ fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-2)' }}>Role-Based Access</h4>
              <p className="text-caption">Granular permissions ensuring the right users have the right level of control.</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ padding: 'var(--space-16) var(--space-6)', backgroundColor: 'var(--color-primary)', color: 'white', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-6)' }}>Ready to make EV charging simpler?</h2>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={() => onNavigate('driver-register')}
              className="btn"
              style={{ backgroundColor: 'white', color: 'var(--color-primary)', padding: 'var(--space-3) var(--space-6)', height: 'auto', fontSize: '1.125rem' }}
            >
              Start as a Driver
            </button>
            <button 
              onClick={() => onNavigate('register')}
              className="btn"
              style={{ backgroundColor: 'transparent', border: '1px solid white', color: 'white', padding: 'var(--space-3) var(--space-6)', height: 'auto', fontSize: '1.125rem' }}
            >
              Start as a Company
            </button>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: 'var(--bg-sidebar)', color: 'var(--color-text-muted)', padding: 'var(--space-12) var(--space-6) var(--space-6) var(--space-6)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-8)', marginBottom: 'var(--space-12)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <Zap size={24} color="var(--color-primary-light)" />
                <span style={{ fontSize: '1.25rem', fontWeight: 'var(--weight-bold)', color: 'white' }}>EVNexus</span>
              </div>
              <p className="text-caption" style={{ lineHeight: 1.6 }}>
                The intelligent platform connecting EV drivers with charging network operators seamlessly and securely.
              </p>
            </div>
            <div>
              <h4 style={{ color: 'white', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)' }}>For Drivers</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('driver-login'); }} style={{ color: 'inherit', textDecoration: 'none' }}>Login</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('driver-register'); }} style={{ color: 'inherit', textDecoration: 'none' }}>Sign Up</a></li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: 'white', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)' }}>For Companies</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }} style={{ color: 'inherit', textDecoration: 'none' }}>Portal Login</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('register'); }} style={{ color: 'inherit', textDecoration: 'none' }}>Register Company</a></li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: 'white', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)' }}>Legal</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li><span style={{ cursor: 'not-allowed' }}>Privacy Policy</span></li>
                <li><span style={{ cursor: 'not-allowed' }}>Terms of Service</span></li>
              </ul>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: 'var(--text-caption)' }}>
            <span>© {new Date().getFullYear()} EVNexus. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}
