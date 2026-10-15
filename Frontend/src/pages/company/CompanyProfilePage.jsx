import React, { useState, useEffect } from 'react';
import { 
  Building2, Mail, Phone, MapPin, Globe, ShieldCheck, 
  Edit3, CheckCircle2, AlertTriangle, Copy, Check, Save, X, RefreshCw, Calendar
} from 'lucide-react';
import { getCompanyProfile, updateCompanyProfile, updateStoredUser } from '../../services/api';

export default function CompanyProfilePage({ authUser, onUpdateProfile }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [formData, setFormData] = useState({
    companyName: '',
    phone: '',
    address: '',
    logoUrl: ''
  });

  const [copiedTenantId, setCopiedTenantId] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyProfile(authUser?.accessToken);
      const data = res?.data || res || {};
      setProfile(data);
      setFormData({
        companyName: data.companyName || authUser?.companyName || '',
        phone: data.phone || authUser?.phone || '',
        address: data.address || authUser?.address || '',
        logoUrl: data.logoUrl || authUser?.logoUrl || ''
      });
    } catch (err) {
      console.warn('Failed to fetch full company profile from API, using auth state', err);
      // Fallback to authUser context
      const fallback = {
        companyName: authUser?.companyName || 'Registered Enterprise',
        businessEmail: authUser?.businessEmail || authUser?.email || '',
        phone: authUser?.phone || '',
        address: authUser?.address || '',
        logoUrl: authUser?.logoUrl || '',
        tenantId: authUser?.tenantId || 'TNT-AUTO',
        createdAt: authUser?.createdAt || new Date().toISOString()
      };
      setProfile(fallback);
      setFormData({
        companyName: fallback.companyName,
        phone: fallback.phone,
        address: fallback.address,
        logoUrl: fallback.logoUrl
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTenantId = (tenantId) => {
    if (!tenantId) return;
    navigator.clipboard.writeText(tenantId);
    setCopiedTenantId(true);
    setTimeout(() => setCopiedTenantId(false), 2000);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const errs = [];
    if (!formData.companyName.trim()) {
      errs.push('Company name is required.');
    } else if (formData.companyName.trim().length < 2) {
      errs.push('Company name must be at least 2 characters.');
    }

    if (!formData.phone.trim()) {
      errs.push('Contact phone number is required.');
    }

    if (!formData.address.trim()) {
      errs.push('Business address is required.');
    }

    setValidationErrors(errs);
    return errs.length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        companyName: formData.companyName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        logoUrl: formData.logoUrl.trim() || null
      };

      const res = await updateCompanyProfile(payload, authUser?.accessToken);
      const updated = res?.data || payload;

      setProfile((prev) => ({ ...prev, ...updated }));
      setIsEditing(false);
      setSuccessMsg('Company profile updated successfully.');

      // Notify parent to sync header chip and localStorage
      if (onUpdateProfile) {
        onUpdateProfile(updated);
      } else {
        updateStoredUser({ ...authUser, ...updated });
      }

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err.message || 'Failed to update company profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setValidationErrors([]);
    setError(null);
    if (profile) {
      setFormData({
        companyName: profile.companyName || '',
        phone: profile.phone || '',
        address: profile.address || '',
        logoUrl: profile.logoUrl || ''
      });
    }
  };

  const activeName = profile?.companyName || authUser?.companyName || 'Enterprise Operator';
  const activeEmail = profile?.businessEmail || authUser?.businessEmail || authUser?.email || 'N/A';
  const activeTenantId = profile?.tenantId || authUser?.tenantId || 'TNT-PRIMARY';
  const activeLogo = profile?.logoUrl || authUser?.logoUrl;
  const activePhone = profile?.phone || authUser?.phone || 'Not provided';
  const activeAddress = profile?.address || authUser?.address || 'Not provided';

  return (
    <div className="dash-container animate-fade-in" style={{ maxWidth: '1080px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Building2 size={26} color="var(--primary-600)" />
            Company Profile
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
            Manage your organization's legal identity, branding, contact details, and tenant workspace credentials.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            className="submit-btn"
            style={{ width: 'auto', margin: 0, padding: '0.6rem 1.25rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => setIsEditing(true)}
          >
            <Edit3 size={16} />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="alert alert-success animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.2rem', marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div className="dash-avatar" style={{ width: '72px', height: '72px', borderRadius: '14px', border: '2px solid var(--border-subtle)', overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeLogo ? (
                <img src={activeLogo} alt={activeName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <Building2 size={36} color="var(--primary-600)" />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{activeName}</h2>
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ShieldCheck size={13} /> Verified Enterprise
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <span>Dedicated Tenant Workspace</span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Calendar size={13} /> Registered: {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Active'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Isolation Key Box */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1rem 1.2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tenant Identifier (Data Isolation Key)
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {activeTenantId}
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleCopyTenantId(activeTenantId)}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {copiedTenantId ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
            <span>{copiedTenantId ? 'Copied' : 'Copy Tenant ID'}</span>
          </button>
        </div>

        {/* View Mode: Info Grid */}
        {!isEditing ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ padding: '1rem', background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-600)', marginBottom: '0.4rem' }}>
                <Mail size={16} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Registered Business Email</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-all' }}>
                {activeEmail}
              </div>
              <span className="badge badge-success" style={{ marginTop: '0.5rem', display: 'inline-flex', fontSize: '0.75rem' }}>
                <Check size={11} /> Primary Communication Channel
              </span>
            </div>

            <div style={{ padding: '1rem', background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-600)', marginBottom: '0.4rem' }}>
                <Phone size={16} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Official Contact Phone</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {activePhone}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                Emergency dispatcher and network support contact
              </div>
            </div>

            <div style={{ padding: '1rem', background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '8px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-600)', marginBottom: '0.4rem' }}>
                <MapPin size={16} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Operating Business Address</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {activeAddress}
              </div>
            </div>

            {profile?.logoUrl && (
              <div style={{ padding: '1rem', background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '8px', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-600)', marginBottom: '0.4rem' }}>
                  <Globe size={16} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Branding Logo Asset URL</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--primary-600)', wordBreak: 'break-all' }}>
                  <a href={profile.logoUrl} target="_blank" rel="noopener noreferrer">{profile.logoUrl}</a>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Edit Mode: Profile Form */
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {validationErrors.length > 0 && (
              <div className="alert alert-danger" style={{ margin: 0 }}>
                <AlertTriangle size={16} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Please correct the following fields:</div>
                  <ul style={{ margin: '0.3rem 0 0 1.2rem', padding: 0, fontSize: '0.82rem' }}>
                    {validationErrors.map((err, idx) => (
                      <li key={`val-err-${idx}`}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.2rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  name="companyName"
                  required
                  value={formData.companyName}
                  onChange={handleFormChange}
                  className="form-input"
                  placeholder="e.g. GreenDrive Energy PLC"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleFormChange}
                  className="form-input"
                  placeholder="e.g. 011-2345678 or 077-1234567"
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Business Operating Address *
                </label>
                <input
                  type="text"
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleFormChange}
                  className="form-input"
                  placeholder="e.g. Level 14, World Trade Center, Echelon Square, Colombo 01"
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Brand Logo URL (HTTPS image link)
                </label>
                <input
                  type="url"
                  name="logoUrl"
                  value={formData.logoUrl}
                  onChange={handleFormChange}
                  className="form-input"
                  placeholder="https://example.com/logo.png"
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Provide an image URL to display in station listings, receipts, and driver navigation.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.8rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.2rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancel}
                disabled={isSubmitting}
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem' }}
              >
                <X size={15} style={{ display: 'inline', marginRight: '0.3rem' }} />
                Cancel
              </button>
              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
                style={{ width: 'auto', margin: 0, padding: '0.6rem 1.4rem', fontSize: '0.88rem' }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={15} className="spinner" style={{ display: 'inline', marginRight: '0.4rem' }} />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save size={15} style={{ display: 'inline', marginRight: '0.4rem' }} />
                    Save Company Profile
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Security & Multi-Tenant Assurance Banner */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ShieldCheck size={20} color="#16a34a" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.85rem', color: '#166534', lineHeight: 1.5 }}>
          <strong>Multi-Tenant Isolation Guaranteed:</strong> Your company data, tariffs, stations, and settled transaction logs are strictly isolated by your tenant boundary. No other company can access or alter your organization's records.
        </div>
      </div>
    </div>
  );
}
