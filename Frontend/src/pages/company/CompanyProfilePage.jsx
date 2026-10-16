import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Mail, Phone, MapPin, ShieldCheck, 
  Edit3, CheckCircle2, AlertTriangle, Copy, Check, Save, X, RefreshCw, Calendar,
  Upload, Camera, Image as ImageIcon, Trash2
} from 'lucide-react';
import { 
  getCompanyProfile, 
  updateCompanyProfile, 
  uploadCompanyProfilePicture, 
  updateStoredUser, 
  resolveImageUrl 
} from '../../services/api';

export default function CompanyProfilePage({ authUser, onUpdateProfile }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Picture upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState(null);
  const [pictureSuccess, setPictureSuccess] = useState(null);
  const fileInputRef = useRef(null);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [formData, setFormData] = useState({
    companyName: '',
    phone: '',
    address: ''
  });

  const [copiedTenantId, setCopiedTenantId] = useState(false);

  useEffect(() => {
    loadProfile();
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
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
        address: data.address || authUser?.address || ''
      });
    } catch (err) {
      console.warn('Failed to fetch full company profile from API, using auth state', err);
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
        address: fallback.address
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

  // ==========================================
  // Image Upload & Validation Handlers
  // ==========================================
  const triggerFilePicker = () => {
    setPictureError(null);
    setPictureSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPictureError(null);
    setPictureSuccess(null);

    // 1. Client-side Size Validation (Max 5 MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setPictureError('The selected image exceeds the maximum limit of 5 MB. Please choose a smaller file.');
      return;
    }

    // 2. Client-side File Format Validation (JPG, JPEG, PNG, WEBP)
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '';

    if (!validTypes.includes(file.type?.toLowerCase()) && !validExtensions.includes(ext)) {
      setPictureError('Unsupported image format. Please select a JPG, JPEG, PNG, or WEBP file.');
      return;
    }

    // Clean up previous preview URL if any
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  };

  const handleCancelPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setPictureError(null);
  };

  const handleSavePicture = async () => {
    if (!selectedFile) return;

    setIsUploadingPicture(true);
    setPictureError(null);
    setPictureSuccess(null);

    try {
      const res = await uploadCompanyProfilePicture(selectedFile, authUser?.accessToken);
      const updatedData = res?.data || res || {};

      setProfile((prev) => ({
        ...prev,
        logoUrl: updatedData.logoUrl || prev?.logoUrl
      }));

      // Sync updated user globally across components (Navbar, Topbar chip, localStorage)
      const updatedUserPayload = {
        ...authUser,
        logoUrl: updatedData.logoUrl
      };

      if (onUpdateProfile) {
        onUpdateProfile(updatedUserPayload);
      } else {
        updateStoredUser(updatedUserPayload);
      }

      setPictureSuccess('Profile picture updated successfully!');
      handleCancelPreview();
      setTimeout(() => setPictureSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to upload company picture', err);
      setPictureError(err.message || 'Failed to upload profile picture. Please try again.');
    } finally {
      setIsUploadingPicture(false);
    }
  };

  // ==========================================
  // Form Save Handlers
  // ==========================================
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
      // If a new picture was selected during edit, upload it first
      let latestLogoUrl = profile?.logoUrl || authUser?.logoUrl || null;
      if (selectedFile) {
        try {
          const uploadRes = await uploadCompanyProfilePicture(selectedFile, authUser?.accessToken);
          if (uploadRes?.data?.logoUrl) {
            latestLogoUrl = uploadRes.data.logoUrl;
          }
        } catch (uploadErr) {
          setError(uploadErr.message || 'Failed to upload selected profile picture.');
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        companyName: formData.companyName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        logoUrl: latestLogoUrl
      };

      const res = await updateCompanyProfile(payload, authUser?.accessToken);
      const updated = res?.data || payload;

      setProfile((prev) => ({ ...prev, ...updated }));
      setIsEditing(false);
      handleCancelPreview();
      setSuccessMsg('Company profile updated successfully.');

      // Notify parent to sync header chip and localStorage
      if (onUpdateProfile) {
        onUpdateProfile({ ...authUser, ...updated });
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
    handleCancelPreview();
    if (profile) {
      setFormData({
        companyName: profile.companyName || '',
        phone: profile.phone || '',
        address: profile.address || ''
      });
    }
  };

  const activeName = profile?.companyName || authUser?.companyName || 'Enterprise Operator';
  const activeEmail = profile?.businessEmail || authUser?.businessEmail || authUser?.email || 'N/A';
  const activeTenantId = profile?.tenantId || authUser?.tenantId || 'TNT-PRIMARY';
  const currentLogoUrl = profile?.logoUrl || authUser?.logoUrl;
  const activeDisplayLogo = previewUrl || (currentLogoUrl ? resolveImageUrl(currentLogoUrl) : null);
  const activePhone = profile?.phone || authUser?.phone || 'Not provided';
  const activeAddress = profile?.address || authUser?.address || 'Not provided';

  return (
    <div className="dash-container animate-fade-in" style={{ maxWidth: '1080px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Hidden File Picker Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: 'none' }}
        id="company-profile-file-input"
      />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Building2 size={26} color="var(--primary-600)" />
            Company Profile
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
            Manage your organization's legal identity, branding, avatar, contact details, and tenant workspace credentials.
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

      {/* Global Alerts */}
      {successMsg && (
        <div className="alert alert-success animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {pictureSuccess && (
        <div className="alert alert-success animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{pictureSuccess}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {pictureError && (
        <div className="alert alert-danger animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} />
          <span>{pictureError}</span>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        {/* Header with Avatar & Upload Controls */}
        <div className="dash-card-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.4rem', marginBottom: '1.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
            
            {/* Left: Avatar + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div 
                style={{ 
                  position: 'relative', 
                  width: '84px', 
                  height: '84px', 
                  borderRadius: '16px', 
                  border: previewUrl ? '2px solid var(--primary-600)' : '2px solid var(--border-subtle)', 
                  overflow: 'hidden', 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  cursor: 'pointer'
                }}
                onClick={triggerFilePicker}
                title="Click to select and upload a company profile picture"
              >
                {activeDisplayLogo ? (
                  <img 
                    src={activeDisplayLogo} 
                    alt={activeName} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                  />
                ) : (
                  <Building2 size={40} color="var(--primary-600)" />
                )}

                {/* Camera Overlay Icon */}
                <div 
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                >
                  <Camera size={24} />
                </div>

                {previewUrl && (
                  <div style={{ position: 'absolute', bottom: '2px', left: '2px', right: '2px', background: 'var(--primary-600)', color: '#ffffff', fontSize: '0.65rem', fontWeight: 700, textAlign: 'center', borderRadius: '4px', padding: '1px 0' }}>
                    PREVIEW
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{activeName}</h2>
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

            {/* Right: Direct Picture Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {previewUrl ? (
                <>
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={handleSavePicture}
                    disabled={isUploadingPicture}
                    style={{ width: 'auto', margin: 0, padding: '0.55rem 1rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    {isUploadingPicture ? (
                      <>
                        <RefreshCw size={14} className="spinner" />
                        <span>Saving Picture...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Save Picture</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCancelPreview}
                    disabled={isUploadingPicture}
                    style={{ padding: '0.55rem 0.9rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <X size={14} />
                    <span>Cancel</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  id="btn-upload-profile-picture"
                  className="btn-secondary"
                  onClick={triggerFilePicker}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', borderColor: 'var(--primary-200)', color: 'var(--primary-700)' }}
                >
                  <Upload size={14} />
                  <span>{currentLogoUrl ? 'Replace Profile Picture' : 'Upload Profile Picture'}</span>
                </button>
              )}
            </div>

          </div>

          {/* Picture Specs Hint */}
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.6rem', paddingLeft: '0.2rem' }}>
            Supported formats: <strong>JPG, JPEG, PNG, WEBP</strong> (Max file size: <strong>5 MB</strong>). Uploaded image automatically persists across sessions and updates your navbar & station profiles.
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

              {/* Dedicated Image Upload Section in Edit Form (Replacing manual URL) */}
              <div 
                className="form-group" 
                style={{ 
                  gridColumn: '1 / -1',
                  background: 'var(--bg-page, #f8fafc)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '1.2rem'
                }}
              >
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <ImageIcon size={18} color="var(--primary-600)" />
                  Company Profile Picture / Logo
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
                  <div 
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '12px', 
                      border: '2px solid var(--border-subtle)', 
                      overflow: 'hidden', 
                      background: '#ffffff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                    }}
                  >
                    {activeDisplayLogo ? (
                      <img 
                        src={activeDisplayLogo} 
                        alt="Logo Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <Building2 size={30} color="var(--primary-600)" />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={triggerFilePicker}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Upload size={14} />
                        <span>{activeDisplayLogo ? 'Change Image from Computer' : 'Select Image from Computer'}</span>
                      </button>

                      {previewUrl && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleCancelPreview}
                          style={{ padding: '0.5rem 0.8rem', fontSize: '0.82rem', color: '#dc2626', borderColor: '#fca5a5' }}
                        >
                          <Trash2 size={13} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          Revert
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                      Upload directly from your PC (JPG, PNG, or WEBP, up to 5 MB). The manual URL field has been retired.
                    </div>
                  </div>
                </div>
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
          <strong>Multi-Tenant Isolation Guaranteed:</strong> Your company logo and records are securely stored and isolated by your tenant boundary. No other organization can access or alter your company identity.
        </div>
      </div>
    </div>
  );
}
