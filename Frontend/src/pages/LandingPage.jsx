import React, { useState } from 'react';
import {
  ArrowRight,
  Zap,
  Shield,
  MapPin,
  QrCode,
  CreditCard,
  BarChart3,
  Sparkles,
  Smartphone,
  Building2,
  Check,
  Activity,
  Layers,
  ChevronRight,
  Menu,
  X,
  Leaf
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

export default function LandingPage({ onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (target) => {
    setMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(target);
    }
  };

  return (
    <div className="lp">
      {/* =========================================================================
          1. PUBLIC HEADER
          ========================================================================= */}
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <button
            type="button"
            className="brand-logo"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="EVNexus Home"
          >
            <BrandLogo size="md" />
          </button>

          <nav className="lp-nav" aria-label="Main Navigation">
            <a href="#features">Features</a>
            <a href="#drivers">For Drivers</a>
            <a href="#companies">For Companies</a>
            <a href="#analytics">AI &amp; Analytics</a>
            <a href="#mission">Mission</a>
          </nav>

          <div className="lp-header-actions">
            <button
              type="button"
              onClick={() => handleNav('driver-login')}
              className="btn btn-ghost btn-sm btn-hide-xs"
            >
              Driver Login
            </button>
            <button
              type="button"
              onClick={() => handleNav('login')}
              className="btn btn-secondary btn-sm btn-hide-sm"
            >
              Company Portal
            </button>
            <button
              type="button"
              onClick={() => handleNav('driver-register')}
              className="btn btn-primary btn-sm"
            >
              Get Started <ArrowRight size={14} />
            </button>
            <button
              type="button"
              className="icon-btn lp-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <div className={`lp-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#drivers" onClick={() => setMobileMenuOpen(false)}>For Drivers</a>
          <a href="#companies" onClick={() => setMobileMenuOpen(false)}>For Companies</a>
          <a href="#analytics" onClick={() => setMobileMenuOpen(false)}>AI &amp; Analytics</a>
          <a href="#mission" onClick={() => setMobileMenuOpen(false)}>Mission</a>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '8px 0' }} />
          <button type="button" onClick={() => handleNav('driver-login')}>Driver Login</button>
          <button type="button" onClick={() => handleNav('login')}>Company Sign In</button>
          <button type="button" onClick={() => handleNav('driver-register')} style={{ color: 'var(--brand-700)', fontWeight: 700 }}>
            Register as Driver →
          </button>
          <button type="button" onClick={() => handleNav('register')} style={{ color: 'var(--brand-700)', fontWeight: 700 }}>
            Register Your Company →
          </button>
        </div>
      </header>

      <main>
        {/* =========================================================================
            2. HERO SECTION
            ========================================================================= */}
        <section className="lp-hero">
          <div className="lp-container">
            <div className="lp-hero-grid">
              {/* Left Column: Value Proposition & CTAs */}
              <div className="animate-fade-in">
                <div className="lp-eyebrow">
                  <span className="lp-eyebrow-dot">
                    <Zap size={13} />
                  </span>
                  Smart EV Charging &amp; Management Platform
                </div>

                <h1 className="lp-hero-title">
                  Charge smarter. <br />
                  <em>Manage better.</em> <br />
                  Grow sustainably.
                </h1>

                <p className="lp-hero-text">
                  EVNexus is the unified multi-tenant EV charging platform connecting drivers,
                  station operators, digital wallets, and AI-driven analytics — all in one reliable system.
                </p>

                <div className="lp-hero-ctas">
                  <button
                    type="button"
                    onClick={() => handleNav('driver-register')}
                    className="btn btn-primary btn-lg"
                  >
                    Find &amp; Start Charging <ArrowRight size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('register')}
                    className="btn btn-secondary btn-lg"
                  >
                    Register Company
                  </button>
                </div>

                <div className="lp-hero-roles">
                  <span>
                    <Check size={16} /> Instant QR-code charging
                  </span>
                  <span>
                    <Check size={16} /> Integrated driver wallet
                  </span>
                  <span>
                    <Check size={16} /> Real-time tenant isolation
                  </span>
                </div>
              </div>

              {/* Right Column: Hero Visual Photography */}
              <div className="lp-hero-visual animate-fade-in">
                <div className="lp-hero-accent" aria-hidden="true" />
                <div className="lp-hero-img-wrap">
                  <img
                    src="/images/hero-ev-charging.jpg"
                    alt="Modern white electric SUV connected to a clean EVNexus charging station"
                    width="1376"
                    height="768"
                    fetchPriority="high"
                  />
                </div>

                {/* Floating Micro-Cards */}
                <div className="lp-float-card lp-float-card--tl">
                  <div className="kpi-icon kpi-icon--mint">
                    <Activity size={20} />
                  </div>
                  <div>
                    <div className="lp-float-title">Active Station Status</div>
                    <div className="lp-float-text">Live telemetry &amp; meter tracking</div>
                  </div>
                </div>

                <div className="lp-float-card lp-float-card--br">
                  <div className="kpi-icon kpi-icon--forest">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="lp-float-title">AI Demand Forecast</div>
                    <div className="lp-float-text">7-day predicted revenue trends</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. QUICK FEATURE STRIP
            ========================================================================= */}
        <div className="lp-feature-strip">
          <div className="lp-container">
            <div className="lp-feature-strip-inner">
              <div className="lp-strip-item">
                <div className="kpi-icon kpi-icon--teal">
                  <MapPin size={22} />
                </div>
                <div className="lp-strip-title">Station Discovery</div>
                <div className="lp-strip-text">Real-time GPS map &amp; connector status</div>
              </div>

              <div className="lp-strip-item">
                <div className="kpi-icon kpi-icon--forest">
                  <QrCode size={22} />
                </div>
                <div className="lp-strip-title">QR Session Control</div>
                <div className="lp-strip-text">Scan, start, monitor, and stop with one tap</div>
              </div>

              <div className="lp-strip-item">
                <div className="kpi-icon kpi-icon--mint">
                  <CreditCard size={22} />
                </div>
                <div className="lp-strip-title">Digital Wallet</div>
                <div className="lp-strip-text">Prepaid balance, instant top-ups &amp; refunds</div>
              </div>

              <div className="lp-strip-item">
                <div className="kpi-icon kpi-icon--amber">
                  <Building2 size={22} />
                </div>
                <div className="lp-strip-title">Company Portals</div>
                <div className="lp-strip-text">Dedicated multi-tenant station management</div>
              </div>

              <div className="lp-strip-item">
                <div className="kpi-icon kpi-icon--blue">
                  <BarChart3 size={22} />
                </div>
                <div className="lp-strip-title">AI &amp; Analytics</div>
                <div className="lp-strip-text">Revenue metrics, energy kWh &amp; forecasting</div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            4. PLATFORM CAPABILITIES GRID
            ========================================================================= */}
        <section id="features" className="lp-section lp-section--muted">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-kicker">Unified Architecture</span>
              <h2 className="lp-h2">Everything needed to power electric vehicle charging</h2>
              <p className="lp-lead">
                Built specifically for real-world operations — EVNexus provides equal power
                to daily commuters charging on the go and enterprise networks running dozens of locations.
              </p>
            </div>

            <div className="lp-cap-grid">
              <div className="lp-cap-card">
                <div className="lp-cap-icon">
                  <MapPin size={26} />
                </div>
                <h3 className="lp-cap-title">Intelligent Station Discovery</h3>
                <p className="lp-cap-text">
                  Locate nearby charging stations with Leaflet &amp; OpenStreetMap integration. Filter by
                  distance, connector type (CCS2, Type 2, CHAdeMO), and pricing per kWh.
                </p>
                <span className="lp-cap-tag">Driver Portal</span>
              </div>

              <div className="lp-cap-card">
                <div className="lp-cap-icon">
                  <QrCode size={26} />
                </div>
                <h3 className="lp-cap-title">Frictionless QR Sessions</h3>
                <p className="lp-cap-text">
                  Point your camera or upload a QR payload to validate the charger instantly.
                  Stream live charging telemetry, active kWh delivered, and running session costs.
                </p>
                <span className="lp-cap-tag">Live Metering</span>
              </div>

              <div className="lp-cap-card">
                <div className="lp-cap-icon">
                  <CreditCard size={26} />
                </div>
                <h3 className="lp-cap-title">Automated Wallet &amp; Payments</h3>
                <p className="lp-cap-text">
                  Dedicated in-app wallet balances with idempotency protection. Top up securely, track
                  detailed charging receipts, and benefit from automatic payment finalization.
                </p>
                <span className="lp-cap-tag">Secure Transactions</span>
              </div>

              <div className="lp-cap-card">
                <div className="lp-cap-icon">
                  <Building2 size={26} />
                </div>
                <h3 className="lp-cap-title">Multi-Tenant Isolation</h3>
                <p className="lp-cap-text">
                  Complete tenant boundary protection. Charging companies manage their own stations,
                  staff operator accounts, and tariffs with zero cross-tenant leakage.
                </p>
                <span className="lp-cap-tag">Enterprise Security</span>
              </div>

              <div className="lp-cap-card">
                <div className="lp-cap-icon">
                  <BarChart3 size={26} />
                </div>
                <h3 className="lp-cap-title">Financial &amp; Energy Telemetry</h3>
                <p className="lp-cap-text">
                  Track revenue today, month-to-date income, completed sessions, and total kWh delivered.
                  Inspect recent transaction logs with live status badges.
                </p>
                <span className="lp-cap-tag">Revenue Reporting</span>
              </div>

              <div className="lp-cap-card">
                <div className="lp-cap-icon">
                  <Sparkles size={26} />
                </div>
                <h3 className="lp-cap-title">AI Demand &amp; Revenue Forecast</h3>
                <p className="lp-cap-text">
                  Machine-learning assisted 7-day revenue trend forecasting helps charging networks anticipate
                  peak demand hours, optimize electricity usage, and plan station expansions.
                </p>
                <span className="lp-cap-tag">Predictive Analytics</span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. DEEP DIVE: FOR DRIVERS
            ========================================================================= */}
        <section id="drivers" className="lp-section">
          <div className="lp-container">
            <div className="lp-split">
              <div>
                <span className="lp-kicker">For Electric Vehicle Drivers</span>
                <h2 className="lp-h2">Find, charge, and drive away in minutes.</h2>
                <p className="lp-lead">
                  Say goodbye to fragmented charging memberships and multiple cards. EVNexus puts
                  your entire charging journey inside a clean, high-performance web dashboard.
                </p>

                <ul className="lp-checklist">
                  <li>
                    <span className="lp-check"><Check size={14} /></span>
                    <div>
                      <strong>Interactive Station Map:</strong>
                      <span className="lp-muted"> Search stations by address, radius (5–200 km), and see live power ratings.</span>
                    </div>
                  </li>
                  <li>
                    <span className="lp-check"><Check size={14} /></span>
                    <div>
                      <strong>One-Tap QR Charging:</strong>
                      <span className="lp-muted"> Scan any EVNexus-compatible port to verify tariff and initiate current flow safely.</span>
                    </div>
                  </li>
                  <li>
                    <span className="lp-check"><Check size={14} /></span>
                    <div>
                      <strong>Live Session Telemetry:</strong>
                      <span className="lp-muted"> Monitor start meter, current meter, elapsed energy, and estimated charge cost in real-time.</span>
                    </div>
                  </li>
                  <li>
                    <span className="lp-check"><Check size={14} /></span>
                    <div>
                      <strong>In-App Digital Wallet:</strong>
                      <span className="lp-muted"> Top up with preset amounts ($10, $25, $50, $100), view transaction history, and receive digital receipts.</span>
                    </div>
                  </li>
                </ul>

                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleNav('driver-register')}
                    className="btn btn-primary"
                  >
                    Create Driver Account <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('driver-login')}
                    className="btn btn-secondary"
                  >
                    Sign In to Driver Portal
                  </button>
                </div>
              </div>

              <div className="lp-split-media">
                <img
                  src="/images/charging-connector.jpg"
                  alt="Close-up of EV charging connector plugged into electric car port"
                  width="1000"
                  height="747"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            6. DEEP DIVE: FOR CHARGING COMPANIES
            ========================================================================= */}
        <section id="companies" className="lp-section lp-section--cream">
          <div className="lp-container">
            <div className="lp-split lp-split--reverse">
              <div>
                <span className="lp-kicker">For Charging Network Operators</span>
                <h2 className="lp-h2">Complete enterprise control of your charging assets.</h2>
                <p className="lp-lead">
                  Provision new charging locations, manage individual charger ports, inspect live charging
                  traffic, and manage operator staff accounts — all secured under your dedicated tenant ID.
                </p>

                <ul className="lp-checklist">
                  <li>
                    <span className="lp-check"><Check size={14} /></span>
                    <div>
                      <strong>Station &amp; Port Management:</strong>
                      <span className="lp-muted"> Add stations with exact GPS coordinates, configure connector types, and set per-kWh tariffs.</span>
                    </div>
                  </li>
                  <li>
                    <span className="lp-check"><Check size={14} /></span>
                    <div>
                      <strong>Real-Time Session Monitoring:</strong>
                      <span className="lp-muted"> Track active charging sessions across all company stations simultaneously.</span>
                    </div>
                  </li>
                  <li>
                    <span className="lp-check"><Check size={14} /></span>
                    <div>
                      <strong>Role-Based Staff Access:</strong>
                      <span className="lp-muted"> Invite team members as Operators with restricted permissions scoped to your company tenant.</span>
                    </div>
                  </li>
                  <li>
                    <span className="lp-check"><Check size={14} /></span>
                    <div>
                      <strong>Security Isolation Sandbox:</strong>
                      <span className="lp-muted"> Built-in simulators to audit cross-tenant isolation and verify RBAC enforcement on demand.</span>
                    </div>
                  </li>
                </ul>

                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleNav('register')}
                    className="btn btn-primary"
                  >
                    Register Your Company <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('login')}
                    className="btn btn-secondary"
                  >
                    Company Administrator Sign In
                  </button>
                </div>
              </div>

              <div className="lp-split-media">
                <img
                  src="/images/charging-hub.jpg"
                  alt="Modern solar-canopy public EV charging hub with charging pillars"
                  width="1100"
                  height="821"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            7. AI FORECASTING & REVENUE REPORTING
            ========================================================================= */}
        <section id="analytics" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-kicker">Data-Driven Operations</span>
              <h2 className="lp-h2">Forecast demand and optimize revenue</h2>
              <p className="lp-lead">
                EVNexus surfaces live operational telemetry into digestible visual charts.
                Inspect settled revenue trends, analyze peak energy consumption, and anticipate customer volume.
              </p>
            </div>

            <div className="grid grid-cols-3">
              <div className="card card-elevated">
                <div className="kpi-icon kpi-icon--forest" style={{ marginBottom: 'var(--space-4)' }}>
                  <BarChart3 size={24} />
                </div>
                <h3 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>Revenue Trend Visualizer</h3>
                <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
                  Interactive bar charts tracking daily income generated by completed charging sessions.
                  Compare daily earnings and measure network growth week over week.
                </p>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--brand-800)', fontWeight: 600 }}>
                  ● Integrated in Company Analytics
                </div>
              </div>

              <div className="card card-elevated">
                <div className="kpi-icon kpi-icon--teal" style={{ marginBottom: 'var(--space-4)' }}>
                  <Sparkles size={24} />
                </div>
                <h3 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>7-Day Predictive Forecast</h3>
                <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
                  Utilizes historical transaction data to predict future daily revenue. Plan maintenance
                  schedules during forecasted lulls and ensure port readiness during high-traffic windows.
                </p>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--brand-800)', fontWeight: 600 }}>
                  ● ML-Powered Revenue Forecast
                </div>
              </div>

              <div className="card card-elevated">
                <div className="kpi-icon kpi-icon--amber" style={{ marginBottom: 'var(--space-4)' }}>
                  <Activity size={24} />
                </div>
                <h3 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>Session Audit &amp; Settlement</h3>
                <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
                  Transparent logs of every transaction: timestamps, station identifiers, currency,
                  kWh consumed, and transaction status (Completed, Pending, Failed).
                </p>
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--brand-800)', fontWeight: 600 }}>
                  ● Complete Audit Traceability
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            8. HOW IT WORKS: 4 SIMPLE STEPS
            ========================================================================= */}
        <section className="lp-section lp-section--muted">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-kicker">Simple Workflow</span>
              <h2 className="lp-h2">How charging works on EVNexus</h2>
              <p className="lp-lead">
                From finding an open station to hitting the road fully charged in four simple steps.
              </p>
            </div>

            <div className="lp-steps">
              <div className="lp-step">
                <div className="lp-step-num">1</div>
                <h3 className="lp-step-title">Discover Stations</h3>
                <p className="lp-step-text">
                  Open the map dashboard to find available chargers nearby with distance and pricing.
                </p>
              </div>

              <div className="lp-step">
                <div className="lp-step-num">2</div>
                <h3 className="lp-step-title">Scan QR Code</h3>
                <p className="lp-step-text">
                  Plug your vehicle in and scan the charger's QR code to authenticate the port.
                </p>
              </div>

              <div className="lp-step">
                <div className="lp-step-num">3</div>
                <h3 className="lp-step-title">Track Live Charge</h3>
                <p className="lp-step-text">
                  Monitor energy delivered in kWh, charging rate, and running cost from your screen.
                </p>
              </div>

              <div className="lp-step">
                <div className="lp-step-num">4</div>
                <h3 className="lp-step-title">Auto Wallet Pay</h3>
                <p className="lp-step-text">
                  Stop charging at any time. The exact energy cost is automatically settled from your wallet.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            9. SUSTAINABILITY & MISSION
            ========================================================================= */}
        <section id="mission" className="lp-mission">
          <img
            src="/images/ev-road-journey.jpg"
            alt="Scenic road journey"
            className="lp-mission-bg"
            loading="lazy"
            decoding="async"
          />
          <div className="lp-container">
            <span className="lp-kicker">Clean Transportation Mission</span>
            <h2 className="lp-h2">Accelerating the transition to zero-emission mobility</h2>
            <p className="lp-lead">
              Electric vehicles are only as powerful as the charging network behind them.
              EVNexus builds reliable digital infrastructure so every driver can travel with confidence,
              and every network operator can operate efficiently.
            </p>

            <div className="lp-pillars">
              <div className="lp-pillar">
                <div className="lp-pillar-icon">
                  <Leaf size={22} />
                </div>
                <div className="lp-pillar-title">Zero-Emission Future</div>
                <div className="lp-pillar-text">
                  Connecting clean energy grids directly with everyday drivers to reduce transportation emissions.
                </div>
              </div>

              <div className="lp-pillar">
                <div className="lp-pillar-icon">
                  <Shield size={22} />
                </div>
                <div className="lp-pillar-title">Reliable &amp; Accessible</div>
                <div className="lp-pillar-text">
                  High-availability microservice backend ensures charging sessions start and stop without friction.
                </div>
              </div>

              <div className="lp-pillar">
                <div className="lp-pillar-icon">
                  <Layers size={22} />
                </div>
                <div className="lp-pillar-title">Open Ecosystem</div>
                <div className="lp-pillar-text">
                  Multi-tenant design supports charging hardware from multiple operators on a single platform.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            10. FINAL CALL TO ACTION
            ========================================================================= */}
        <section className="lp-cta">
          <div className="lp-container">
            <div className="lp-cta-box">
              <div>
                <h2 className="lp-cta-title">Ready to experience smarter EV charging?</h2>
                <p className="lp-cta-text">
                  Create your driver account or register your charging company workspace today.
                </p>
              </div>
              <div className="lp-cta-actions">
                <button
                  type="button"
                  onClick={() => handleNav('driver-register')}
                  className="btn btn-light btn-lg"
                >
                  Start as a Driver <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('register')}
                  className="btn btn-outline-light btn-lg"
                >
                  Register as a Company
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          11. FOOTER
          ========================================================================= */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div>
              <BrandLogo size="md" />
              <p className="lp-footer-about">
                The smart electric vehicle charging management platform connecting drivers,
                charging network operators, digital payments, and predictive analytics.
              </p>
            </div>

            <div>
              <h4>Driver Portal</h4>
              <ul>
                <li>
                  <button type="button" className="lp-footer-link" onClick={() => handleNav('driver-login')}>
                    Driver Sign In
                  </button>
                </li>
                <li>
                  <button type="button" className="lp-footer-link" onClick={() => handleNav('driver-register')}>
                    Register as Driver
                  </button>
                </li>
                <li>
                  <a href="#features" className="lp-footer-link">Charging Map Discovery</a>
                </li>
                <li>
                  <a href="#features" className="lp-footer-link">Digital Wallet &amp; Receipts</a>
                </li>
              </ul>
            </div>

            <div>
              <h4>Company Portal</h4>
              <ul>
                <li>
                  <button type="button" className="lp-footer-link" onClick={() => handleNav('login')}>
                    Company Sign In
                  </button>
                </li>
                <li>
                  <button type="button" className="lp-footer-link" onClick={() => handleNav('register')}>
                    Register Company
                  </button>
                </li>
                <li>
                  <a href="#companies" className="lp-footer-link">Station Management</a>
                </li>
                <li>
                  <a href="#analytics" className="lp-footer-link">Revenue &amp; AI Analytics</a>
                </li>
              </ul>
            </div>

            <div>
              <h4>Platform</h4>
              <ul>
                <li>
                  <a href="#features" className="lp-footer-link">Platform Capabilities</a>
                </li>
                <li>
                  <a href="#mission" className="lp-footer-link">Sustainability Mission</a>
                </li>
                <li>
                  <a href="#features" className="lp-footer-link">Multi-Tenant Isolation</a>
                </li>
                <li>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                    Enterprise Microservices
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <span>&copy; {new Date().getFullYear()} EVNexus. Charge &bull; Manage &bull; Grow. All rights reserved.</span>
            <span>Production-Quality EV Charging Management System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
