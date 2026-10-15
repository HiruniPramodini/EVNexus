import React, { useState } from 'react';
import { 
  Settings, Sliders, Bell, Globe, Shield, Trash2, CheckCircle2, 
  AlertTriangle, Save, RefreshCw, Lock, Radio
} from 'lucide-react';
import { deleteCompanyAccount } from '../../services/api';

export default function CompanySettingsPage({ authUser, onLogout }) {
  // Load preferences from localStorage or fall back to defaults
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem(`evnexus_settings_${authUser?.tenantId || 'default'}`);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      autoApproveSessions: true,
      telemetryPollingInterval: '30',
      stationMaintenanceMode: false,
      faultAlertsEmail: true,
      sessionCompletionAlerts: true,
      dailyFinancialDigest: false,
      currency: 'LKR',
      dateFormat: 'DD/MM/YYYY',
      timeZone: 'Asia/Colombo (UTC +05:30)'
    };
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Danger Zone: Delete workspace modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const userRole = authUser?.role || 'CompanyAdmin';
  const isAdmin = userRole === 'CompanyAdmin' || userRole === 'Company';

  const handleToggle = (key) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectChange = (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const handleSavePreferences = (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      localStorage.setItem(
        `evnexus_settings_${authUser?.tenantId || 'default'}`,
        JSON.stringify(preferences)
      );
      setSuccessMsg('Operational preferences updated and saved successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg('Failed to save preferences to local storage.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteCompanyAccount(authUser?.accessToken);
      alert('Company workspace has been deleted successfully. You will now be signed out.');
      if (onLogout) onLogout();
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete company workspace.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="dash-container animate-fade-in" style={{ maxWidth: '1080px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Settings size={26} color="var(--primary-600)" />
          Application & Operational Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
          Configure station operational policies, alert notifications, Sri Lankan regional standards, and workspace controls.
        </p>
      </div>

      {successMsg && (
        <div className="alert alert-success animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Section 1: General Operational Preferences */}
        <div className="dash-card">
          <div className="dash-card-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.8rem' }}>
            <div>
              <h2 className="dash-card-title" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={20} color="var(--primary-600)" />
                General Operational Preferences
              </h2>
              <p className="dash-card-subtitle" style={{ margin: 0 }}>
                Control charging authorization policies and station telemetry behavior.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>Automatic Session Authorization</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Automatically authorize charging sessions when a driver with a sufficient LKR wallet balance scans a station QR code.
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={preferences.autoApproveSessions}
                  onChange={() => handleToggle('autoApproveSessions')}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: preferences.autoApproveSessions ? 'var(--primary-600)' : '#cbd5e1',
                    borderRadius: '34px', transition: '0.2s'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', height: '20px', width: '20px', left: preferences.autoApproveSessions ? '24px' : '4px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                </span>
              </label>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>Network Maintenance Mode</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Temporarily mark all stations as in-service maintenance on the public driver map without deleting chargers.
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={preferences.stationMaintenanceMode}
                  onChange={() => handleToggle('stationMaintenanceMode')}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: preferences.stationMaintenanceMode ? '#eab308' : '#cbd5e1',
                    borderRadius: '34px', transition: '0.2s'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', height: '20px', width: '20px', left: preferences.stationMaintenanceMode ? '24px' : '4px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                </span>
              </label>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>Live Telemetry Polling Rate</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Frequency for querying charger connector voltage, wattage, and active session meter telemetry.
                </div>
              </div>
              <select
                className="form-input"
                style={{ width: 'auto', minWidth: '160px', padding: '0.45rem 0.8rem', fontSize: '0.88rem' }}
                value={preferences.telemetryPollingInterval}
                onChange={(e) => handleSelectChange('telemetryPollingInterval', e.target.value)}
              >
                <option value="15">Every 15 seconds</option>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 60 seconds</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Notifications */}
        <div className="dash-card">
          <div className="dash-card-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.8rem' }}>
            <div>
              <h2 className="dash-card-title" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={20} color="var(--primary-600)" />
                Notification Preferences
              </h2>
              <p className="dash-card-subtitle" style={{ margin: 0 }}>
                Manage dispatch emails and alerts for operational events.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>Station Hardware Fault & Offline Alerts</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Send immediate priority email alerts when a charger goes offline or experiences an emergency stop.
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={preferences.faultAlertsEmail}
                  onChange={() => handleToggle('faultAlertsEmail')}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: preferences.faultAlertsEmail ? 'var(--primary-600)' : '#cbd5e1',
                    borderRadius: '34px', transition: '0.2s'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', height: '20px', width: '20px', left: preferences.faultAlertsEmail ? '24px' : '4px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                </span>
              </label>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>Charging Session Completion Notices</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Notify operators whenever a vehicle stops charging and final payment is settled.
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={preferences.sessionCompletionAlerts}
                  onChange={() => handleToggle('sessionCompletionAlerts')}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: preferences.sessionCompletionAlerts ? 'var(--primary-600)' : '#cbd5e1',
                    borderRadius: '34px', transition: '0.2s'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', height: '20px', width: '20px', left: preferences.sessionCompletionAlerts ? '24px' : '4px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                </span>
              </label>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>Daily Financial Revenue Summary</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Receive an automated nightly email digest of total revenue and energy delivered in LKR.
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={preferences.dailyFinancialDigest}
                  onChange={() => handleToggle('dailyFinancialDigest')}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: preferences.dailyFinancialDigest ? 'var(--primary-600)' : '#cbd5e1',
                    borderRadius: '34px', transition: '0.2s'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', height: '20px', width: '20px', left: preferences.dailyFinancialDigest ? '24px' : '4px', bottom: '3px',
                      backgroundColor: 'white', borderRadius: '50%', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Regional & Localization Preferences */}
        <div className="dash-card">
          <div className="dash-card-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.8rem' }}>
            <div>
              <h2 className="dash-card-title" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={20} color="var(--primary-600)" />
                Regional & Currency Localization
              </h2>
              <p className="dash-card-subtitle" style={{ margin: 0 }}>
                Standardized platform locale configuration for Sri Lanka.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Standard Currency Policy
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.3rem' }}>
                Sri Lankan Rupee (LKR)
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Active standard across all wallet top-ups, station tariffs, and settled revenue.
              </div>
            </div>

            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Date Formatting
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.3rem' }}>
                DD/MM/YYYY
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Sri Lankan standard date display.
              </div>
            </div>

            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Operating Time Zone
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.3rem' }}>
                Asia/Colombo (UTC +05:30)
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Sri Lanka Standard Time (SLST).
              </div>
            </div>
          </div>
        </div>

        {/* Save Button for Operational Preferences */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="submit-btn"
            disabled={saving}
            style={{ width: 'auto', margin: 0, padding: '0.65rem 1.6rem', fontSize: '0.9rem' }}
          >
            {saving ? (
              <>
                <RefreshCw size={15} className="spinner" style={{ display: 'inline', marginRight: '0.4rem' }} />
                Saving Preferences...
              </>
            ) : (
              <>
                <Save size={15} style={{ display: 'inline', marginRight: '0.4rem' }} />
                Save Operational Preferences
              </>
            )}
          </button>
        </div>
      </form>

      {/* Section 4: Danger Zone */}
      <div className="dash-card" style={{ marginTop: '2rem', borderLeft: '4px solid #ef4444' }}>
        <div className="dash-card-header" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
          <div>
            <h2 className="dash-card-title" style={{ color: '#dc2626', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trash2 size={20} color="#dc2626" />
              Danger Zone: Workspace Deletion
            </h2>
            <p className="dash-card-subtitle" style={{ margin: 0 }}>
              Permanently delete this organization workspace, stations, chargers, staff accounts, and tokens.
            </p>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="btn-danger"
              style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}
            >
              <Trash2 size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
              Delete Workspace
            </button>
          ) : (
            <span className="badge badge-danger">
              <Lock size={12} />
              Admin Only
            </span>
          )}
        </div>

        {deleteError && (
          <div className="alert alert-danger" style={{ marginTop: '1rem', margin: 0 }}>
            {deleteError}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '12px', maxWidth: '440px', width: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', color: '#dc2626' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Delete Company Workspace?</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5, fontSize: '0.9rem' }}>
              This action is irreversible. All charging stations, revenue history, and staff accounts associated with <strong>Tenant {authUser?.tenantId}</strong> will be permanently deleted.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="submit-btn"
                disabled={isDeleting}
                style={{ background: '#dc2626', borderColor: '#dc2626', width: 'auto', margin: 0 }}
                onClick={handleDeleteCompany}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
