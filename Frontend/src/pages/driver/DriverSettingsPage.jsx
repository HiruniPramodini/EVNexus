import React, { useState } from 'react';
import { 
  Settings, Zap, Bell, Sliders, Shield, Lock, Trash2, 
  CheckCircle2, AlertTriangle, Save, RefreshCw, LogOut, 
  MapPin, Eye, EyeOff, BatteryCharging, Radio
} from 'lucide-react';
import { changeDriverPassword } from '../../services/api';

export default function DriverSettingsPage({ authUser, onLogout }) {
  const driverId = authUser?.driverId || authUser?.email || 'default';
  const storageKey = `evnexus_driver_settings_${driverId}`;

  // Charging, Map & Notification Preferences
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      chargeLimitTarget: '80', // 80%, 90%, 100%
      preferredConnector: 'CCS2', // CCS2, CHAdeMO, Type2
      autoStopAtTarget: true,
      lowBalanceThreshold: '500', // LKR
      notifySessionStart: true,
      notifySessionComplete: true,
      notifyLowBalance: true,
      emailReceipts: true,
      filterAvailableOnly: false,
      mapRadiusKm: '25',
      units: 'km'
    };
  });

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefSuccess, setPrefSuccess] = useState(null);
  const [prefError, setPrefError] = useState(null);

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // Cache clear feedback
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleToggle = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectChange = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleSavePreferences = (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setPrefError(null);
    setPrefSuccess(null);

    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
      setPrefSuccess('Charging and application preferences saved successfully.');
      setTimeout(() => setPrefSuccess(null), 4000);
    } catch (err) {
      setPrefError('Failed to save settings to browser storage.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleResetPreferences = () => {
    const defaults = {
      chargeLimitTarget: '80',
      preferredConnector: 'CCS2',
      autoStopAtTarget: true,
      lowBalanceThreshold: '500',
      notifySessionStart: true,
      notifySessionComplete: true,
      notifyLowBalance: true,
      emailReceipts: true,
      filterAvailableOnly: false,
      mapRadiusKm: '25',
      units: 'km'
    };
    setPreferences(defaults);
    localStorage.removeItem(storageKey);
    setPrefSuccess('Settings have been reset to factory defaults.');
    setTimeout(() => setPrefSuccess(null), 3000);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordForm.currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await changeDriverPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmNewPassword: passwordForm.confirmNewPassword
      }, authUser?.accessToken);

      setPasswordSuccess('Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      setTimeout(() => {
        setPasswordSuccess(null);
        setShowPasswordModal(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password. Please verify current password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleClearCache = () => {
    try {
      sessionStorage.clear();
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch (_) {}
  };

  return (
    <div className="dash-container animate-fade-in" style={{ maxWidth: '1080px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Settings size={26} color="var(--primary-600)" />
          Driver Portal Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
          Manage your EV charging behavior, session notifications, map filters, and security credentials.
        </p>
      </div>

      {/* Global Status Alerts */}
      {prefSuccess && (
        <div className="alert alert-success animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{prefSuccess}</span>
        </div>
      )}
      {prefError && (
        <div className="alert alert-danger animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} />
          <span>{prefError}</span>
        </div>
      )}
      {cacheCleared && (
        <div className="alert alert-success animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>Offline map cache and temporary station data cleared successfully.</span>
        </div>
      )}

      <form onSubmit={handleSavePreferences}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          {/* SECTION 1: CHARGING PREFERENCES */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <BatteryCharging size={20} color="var(--primary-600)" />
              Charging & Vehicle Preferences
            </h2>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Default Target Charge Limit
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
                Recommended at 80% to preserve lithium-ion battery longevity.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {['80', '90', '100'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelectChange('chargeLimitTarget', val)}
                    className="btn"
                    style={{
                      padding: '0.55rem',
                      borderRadius: 'var(--radius-md)',
                      border: preferences.chargeLimitTarget === val ? '2px solid var(--primary-600)' : '1px solid var(--border-subtle)',
                      background: preferences.chargeLimitTarget === val ? 'var(--primary-50)' : 'transparent',
                      color: preferences.chargeLimitTarget === val ? 'var(--primary-700)' : 'var(--text-main)',
                      fontWeight: preferences.chargeLimitTarget === val ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {val}% {val === '80' ? '★' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Preferred Connector Standard
              </label>
              <select
                className="form-input"
                value={preferences.preferredConnector}
                onChange={e => handleSelectChange('preferredConnector', e.target.value)}
              >
                <option value="CCS2">CCS2 (Combined Charging System - Europe/Asia)</option>
                <option value="CHAdeMO">CHAdeMO (Fast DC standard)</option>
                <option value="Type2">Type 2 (Mennekes AC)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Auto-stop at Target %</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Automatically finish charging when vehicle hits selected charge %</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.autoStopAtTarget}
                onChange={() => handleToggle('autoStopAtTarget')}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
              />
            </div>

            <div className="form-group" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Low Balance Warning Threshold
              </label>
              <select
                className="form-input"
                value={preferences.lowBalanceThreshold}
                onChange={e => handleSelectChange('lowBalanceThreshold', e.target.value)}
              >
                <option value="250">LKR 250.00</option>
                <option value="500">LKR 500.00 (Recommended)</option>
                <option value="1000">LKR 1,000.00</option>
                <option value="2000">LKR 2,000.00</option>
              </select>
            </div>
          </div>

          {/* SECTION 2: NOTIFICATIONS & ALERTS */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <Bell size={20} color="var(--primary-600)" />
              Notifications & Alerts
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Session Started Alert</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Receive confirmation when power delivery initiates</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifySessionStart}
                  onChange={() => handleToggle('notifySessionStart')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Session Completed Alert</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Get notified the instant charging finishes or is disconnected</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifySessionComplete}
                  onChange={() => handleToggle('notifySessionComplete')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Low Balance Alerts</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Warn when wallet balance drops below threshold</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notifyLowBalance}
                  onChange={() => handleToggle('notifyLowBalance')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Email Payment Invoices</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Send digital PDF receipt to {authUser?.email}</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.emailReceipts}
                  onChange={() => handleToggle('emailReceipts')}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: MAP & NAVIGATION DEFAULTS */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <MapPin size={20} color="var(--primary-600)" />
              Map & Charger Discovery
            </h2>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Default Search Radius
              </label>
              <select
                className="form-input"
                value={preferences.mapRadiusKm}
                onChange={e => handleSelectChange('mapRadiusKm', e.target.value)}
              >
                <option value="10">10 km (Urban / City)</option>
                <option value="25">25 km (Suburban)</option>
                <option value="50">50 km (Regional)</option>
                <option value="100">100 km (Expressway)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Only Show Available Chargers</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Hide busy or offline charging stations on map</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.filterAvailableOnly}
                onChange={() => handleToggle('filterAvailableOnly')}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
              />
            </div>

            <div className="form-group" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Distance & Telemetry Units
              </label>
              <select
                className="form-input"
                value={preferences.units}
                onChange={e => handleSelectChange('units', e.target.value)}
              >
                <option value="km">Kilometers (km, kWh)</option>
                <option value="miles">Miles (mi, kWh)</option>
              </select>
            </div>
          </div>

          {/* SECTION 4: SECURITY & CREDENTIALS */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <Shield size={20} color="var(--primary-600)" />
              Security & Credentials
            </h2>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>Password Management</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.8rem 0' }}>
                Keep your driver account secure by maintaining a strong password.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowPasswordModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1rem' }}
              >
                <Lock size={16} />
                Change Password
              </button>
            </div>

            <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>Station Cache & Storage</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.8rem 0' }}>
                Clear temporarily cached charger data if you encounter map sync discrepancies.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClearCache}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={15} />
                Clear Local Cache
              </button>
            </div>

            <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>Session Management</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.8rem 0' }}>
                Logged in as <strong>{authUser?.email}</strong>
              </p>
              <button
                type="button"
                className="btn"
                onClick={onLogout}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  padding: '0.55rem 1rem', 
                  fontSize: '0.85rem',
                  color: 'var(--color-danger, #ef4444)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.05)'
                }}
              >
                <LogOut size={16} />
                Sign Out of Driver Portal
              </button>
            </div>
          </div>

        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleResetPreferences}
          >
            Reset to Defaults
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingPrefs}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minWidth: '170px', justifyContent: 'center' }}
          >
            {savingPrefs ? <><RefreshCw size={18} className="spinner" /> Saving...</> : <><Save size={18} /> Save Settings</>}
          </button>
        </div>
      </form>

      {/* CHANGE PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-dialog animate-fade-in" style={{ maxWidth: '440px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={18} color="var(--primary-600)" />
                Change Driver Password
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => { setShowPasswordModal(false); setPasswordError(null); setPasswordSuccess(null); }}
              >
                ✕
              </button>
            </div>

            {passwordSuccess && (
              <div className="alert alert-success animate-fade-in" style={{ marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                <CheckCircle2 size={16} />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="alert alert-danger animate-fade-in" style={{ marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                <AlertTriangle size={16} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    className="form-input"
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    className="form-input"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Min 8 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.confirmNewPassword}
                  onChange={e => setPasswordForm(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={savingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingPassword}
                >
                  {savingPassword ? <><RefreshCw size={16} className="spinner" /> Updating...</> : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
