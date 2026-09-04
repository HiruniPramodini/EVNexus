import React, { useState, useEffect } from 'react';
import {
  User,
  Zap,
  Wallet as WalletIcon,
  Copy,
  Check,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Mail,
  Phone,
  ShieldCheck,
  CreditCard,
  Clock,
  Key,
  ShieldAlert,
  Lock,
  Edit3,
  X,
  Eye,
  EyeOff,
  Car,
  Plus,
  Trash2,
  Star,
  BarChart3,
  Settings,
  Shield,
  Activity,
  Server
} from 'lucide-react';
import {
  getDriverProfile,
  updateDriverProfile,
  changeDriverPassword,
  clearAuthSession,
  testDriverAccessToCompanyEndpoint,
  verifyEmail,
  resendVerificationCode,
  getDriverVehicles,
  addDriverVehicle,
  updateDriverVehicle,
  deleteDriverVehicle,
  setDefaultDriverVehicle
} from '../services/api';

export default function DriverDashboard({ authUser, onLogout, onUpdateProfile }) {
  const [activeTab, setActiveTab] = useState('overview');

  const [copiedDriverId, setCopiedDriverId] = useState(false);
  const [copiedWalletId, setCopiedWalletId] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);

  // Email Verification State
  const [isEmailVerified, setIsEmailVerified] = useState(Boolean(authUser?.isEmailVerified));
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verifyEmailSuccess, setVerifyEmailSuccess] = useState(null);
  const [verifyEmailError, setVerifyEmailError] = useState(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendStatusMsg, setResendStatusMsg] = useState(null);

  // Profile Management State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: authUser?.name || '',
    phone: authUser?.phone || ''
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState(null);
  const [profileValidationErrors, setProfileValidationErrors] = useState([]);

  // Change Password State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState(null);
  const [passwordValidationErrors, setPasswordValidationErrors] = useState([]);

  // Protected API Test State
  const [isVerifying, setIsVerifying] = useState(false);
  const [profileResult, setProfileResult] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // RBAC Security Simulator State
  const [isTestingRbac, setIsTestingRbac] = useState(false);
  const [rbacResult, setRbacResult] = useState(null);

  // Vehicle Sub-Resource State
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleError, setVehicleError] = useState(null);
  const [vehicleSuccess, setVehicleSuccess] = useState(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    make: '',
    model: '',
    plateNumber: '',
    connectorType: 'CCS2',
    isDefault: false
  });
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState(null);

  useEffect(() => {
    handleVerifyProtectedApi();
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    setLoadingVehicles(true);
    setVehicleError(null);
    try {
      const res = await getDriverVehicles(authUser?.accessToken);
      if (res?.data) {
        setVehicles(res.data);
      }
    } catch (err) {
      setVehicleError(err.message || 'Failed to load vehicles.');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleOpenAddVehicle = () => {
    setEditingVehicleId(null);
    setVehicleFormData({
      make: '',
      model: '',
      plateNumber: '',
      connectorType: 'CCS2',
      isDefault: vehicles.length === 0
    });
    setVehicleError(null);
    setVehicleSuccess(null);
    setShowVehicleModal(true);
  };

  const handleOpenEditVehicle = (v) => {
    setEditingVehicleId(v.vehicleId);
    setVehicleFormData({
      make: v.make,
      model: v.model,
      plateNumber: v.plateNumber,
      connectorType: v.connectorType,
      isDefault: v.isDefault
    });
    setVehicleError(null);
    setVehicleSuccess(null);
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    setIsSubmittingVehicle(true);
    setVehicleError(null);
    setVehicleSuccess(null);

    try {
      if (editingVehicleId) {
        await updateDriverVehicle(editingVehicleId, vehicleFormData, authUser?.accessToken);
        setVehicleSuccess('Vehicle updated successfully!');
      } else {
        await addDriverVehicle(vehicleFormData, authUser?.accessToken);
        setVehicleSuccess('Vehicle registered successfully!');
      }
      setShowVehicleModal(false);
      await loadVehicles();
    } catch (err) {
      setVehicleError(err.message || 'Failed to save vehicle.');
    } finally {
      setIsSubmittingVehicle(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (!window.confirm('Are you sure you want to remove this vehicle from your profile?')) {
      return;
    }
    setDeletingVehicleId(vehicleId);
    setVehicleError(null);
    try {
      await deleteDriverVehicle(vehicleId, authUser?.accessToken);
      setVehicleSuccess('Vehicle removed successfully.');
      await loadVehicles();
    } catch (err) {
      setVehicleError(err.message || 'Failed to delete vehicle.');
    } finally {
      setDeletingVehicleId(null);
    }
  };

  const handleSetDefaultVehicle = async (vehicleId) => {
    setVehicleError(null);
    try {
      await setDefaultDriverVehicle(vehicleId, authUser?.accessToken);
      setVehicleSuccess('Default vehicle updated.');
      await loadVehicles();
    } catch (err) {
      setVehicleError(err.message || 'Failed to update default vehicle.');
    }
  };

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'driver') {
      setCopiedDriverId(true);
      setTimeout(() => setCopiedDriverId(false), 2500);
    } else if (type === 'wallet') {
      setCopiedWalletId(true);
      setTimeout(() => setCopiedWalletId(false), 2500);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  const handleVerifyProtectedApi = async () => {
    setIsVerifying(true);
    setProfileError(null);

    try {
      const startTime = performance.now();
      const response = await getDriverProfile(authUser?.accessToken);
      const endTime = performance.now();

      setProfileResult({
        data: response.data,
        status: 200,
        latencyMs: Math.round(endTime - startTime),
        timestamp: new Date().toLocaleTimeString()
      });

      if (Array.isArray(response.data?.vehicles)) {
        setVehicles(response.data.vehicles);
      }

      setProfileFormData({
        name: response.data?.name || authUser?.name || '',
        phone: response.data?.phone || authUser?.phone || ''
      });
    } catch (err) {
      setProfileError({
        message: err.message || 'Failed to authenticate token against protected driver endpoint.',
        status: err.status || 500
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTestRbacSecurity = async () => {
    setIsTestingRbac(true);
    setRbacResult(null);
    const startTime = performance.now();
    try {
      const res = await testDriverAccessToCompanyEndpoint(authUser?.accessToken);
      const endTime = performance.now();
      setRbacResult({
        status: 200,
        success: true,
        data: res,
        latencyMs: Math.round(endTime - startTime),
        message: 'Unexpected: Access was granted.'
      });
    } catch (err) {
      const endTime = performance.now();
      setRbacResult({
        status: err.status || 403,
        success: false,
        errorMsg: err.message || 'Cross-role access forbidden. Role check enforced.',
        errors: err.errors || [],
        latencyMs: Math.round(endTime - startTime)
      });
    } finally {
      setIsTestingRbac(false);
    }
  };

  const handleLogoutClick = () => {
    clearAuthSession();
    if (onLogout) {
      onLogout();
    }
  };

  const handleOpenEditProfile = () => {
    setProfileFormData({
      name: profileResult?.data?.name || authUser?.name || '',
      phone: profileResult?.data?.phone || authUser?.phone || ''
    });
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    setProfileValidationErrors([]);
    setShowEditProfileModal(true);
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    setProfileValidationErrors([]);

    const clientErrors = [];
    if (!profileFormData.name || profileFormData.name.trim().length < 2) {
      clientErrors.push('Full name must be at least 2 characters.');
    }
    if (!profileFormData.phone || profileFormData.phone.trim().length < 5) {
      clientErrors.push('Please enter a valid phone number.');
    }

    if (clientErrors.length > 0) {
      setProfileValidationErrors(clientErrors);
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const res = await updateDriverProfile(profileFormData, authUser?.accessToken);
      const updatedData = res.data;

      setProfileSuccessMsg('Driver profile updated successfully!');
      if (profileResult?.data) {
        setProfileResult((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            name: updatedData.name,
            phone: updatedData.phone,
            updatedAt: updatedData.updatedAt
          }
        }));
      }

      if (onUpdateProfile) {
        onUpdateProfile({
          name: updatedData.name,
          phone: updatedData.phone
        });
      }

      setTimeout(() => {
        setShowEditProfileModal(false);
        setProfileSuccessMsg(null);
      }, 1200);
    } catch (err) {
      setProfileErrorMsg(err.message || 'Failed to update profile.');
      if (err.errors && Array.isArray(err.errors)) {
        setProfileValidationErrors(err.errors);
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleOpenChangePassword = () => {
    setPasswordFormData({
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: ''
    });
    setShowPasswords({ current: false, next: false, confirm: false });
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);
    setPasswordValidationErrors([]);
    setShowChangePasswordModal(true);
  };

  const handleSubmitPasswordChange = async (e) => {
    e.preventDefault();
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);
    setPasswordValidationErrors([]);

    const clientErrors = [];
    if (!passwordFormData.currentPassword) {
      clientErrors.push('Current password is required.');
    }
    if (!passwordFormData.newPassword || passwordFormData.newPassword.length < 8) {
      clientErrors.push('New password must be at least 8 characters long.');
    } else if (!/(?=.*[0-9])/.test(passwordFormData.newPassword)) {
      clientErrors.push('New password must contain at least one numeric digit.');
    }
    if (passwordFormData.newPassword !== passwordFormData.confirmNewPassword) {
      clientErrors.push('New password and confirmation do not match.');
    }
    if (passwordFormData.currentPassword && passwordFormData.newPassword && passwordFormData.currentPassword === passwordFormData.newPassword) {
      clientErrors.push('New password cannot be the same as your current password.');
    }

    if (clientErrors.length > 0) {
      setPasswordValidationErrors(clientErrors);
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeDriverPassword(passwordFormData, authUser?.accessToken);
      setPasswordSuccessMsg('Your password has been changed successfully!');
      setPasswordFormData({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      });

      setTimeout(() => {
        setShowChangePasswordModal(false);
        setPasswordSuccessMsg(null);
      }, 1500);
    } catch (err) {
      setPasswordErrorMsg(err.message || 'Failed to change password.');
      if (err.errors && Array.isArray(err.errors)) {
        setPasswordValidationErrors(err.errors);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e?.preventDefault();
    if (!verificationCodeInput.trim()) return;

    setIsVerifyingEmail(true);
    setVerifyEmailError(null);
    setVerifyEmailSuccess(null);

    try {
      const emailToVerify = profileResult?.data?.email || authUser?.email;
      const res = await verifyEmail(emailToVerify, verificationCodeInput.trim());
      setIsEmailVerified(true);
      setVerifyEmailSuccess(res?.message || 'Email verified successfully! Full charging access is now unlocked.');
      if (authUser) {
        authUser.isEmailVerified = true;
      }
    } catch (err) {
      setVerifyEmailError(err.message || 'Invalid or expired verification code. Codes expire after 24 hours.');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const handleResendCode = async () => {
    setIsResendingVerification(true);
    setVerifyEmailError(null);
    setResendStatusMsg(null);

    try {
      const emailToVerify = profileResult?.data?.email || authUser?.email;
      const res = await resendVerificationCode(emailToVerify);
      setResendStatusMsg(res?.message || 'A fresh 24-hour verification code has been dispatched to your email.');
    } catch (err) {
      setVerifyEmailError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const effectiveDriverId = profileResult?.data?.driverId || authUser?.driverId || 'DRV-N/A';
  const effectiveName = profileResult?.data?.name || authUser?.name || 'EV Driver';
  const effectiveEmail = profileResult?.data?.email || authUser?.email || '';
  const effectivePhone = profileResult?.data?.phone || authUser?.phone || '';
  const effectiveWalletId = profileResult?.data?.walletId || authUser?.walletId || 'WLT-N/A';
  const effectiveBalance = profileResult?.data?.walletBalance ?? authUser?.walletBalance ?? 0.0;
  const effectiveCurrency = profileResult?.data?.currency || authUser?.currency || 'USD';

  // Live password validation checks
  const isLengthValid = passwordFormData.newPassword.length >= 8;
  const hasDigit = /(?=.*[0-9])/.test(passwordFormData.newPassword);
  const passwordsMatch = Boolean(passwordFormData.newPassword && passwordFormData.newPassword === passwordFormData.confirmNewPassword);

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* ========================================================================= */}
        {/* Hero Header Banner */}
        {/* ========================================================================= */}
        <div className="dash-hero-banner">
          <div className="dash-hero-content">
            <div className="dash-hero-profile">
              <div className="dash-avatar">
                <User size={34} color="#0284c7" />
              </div>

              <div className="dash-hero-meta">
                <div className="dash-badge-row">
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}>
                    <Zap size={13} />
                    EV Driver Account
                  </span>
                  <span className="badge" style={{ background: '#10b981', color: '#ffffff' }}>
                    ● Active
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: isEmailVerified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                      color: '#ffffff',
                      border: isEmailVerified ? '1px solid #10b981' : '1px solid #f59e0b'
                    }}
                  >
                    {isEmailVerified ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {isEmailVerified ? 'Email Verified' : 'Unverified Email'}
                  </span>
                </div>

                <h1 className="dash-title">{effectiveName}</h1>
                <p className="dash-subtitle">
                  <Mail size={15} /> {effectiveEmail}
                  {effectivePhone && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.75rem' }}>
                      <Phone size={14} /> {effectivePhone}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="dash-hero-actions">
              <button type="button" className="hero-btn" onClick={handleOpenEditProfile}>
                <Edit3 size={15} />
                <span>Edit Profile</span>
              </button>
              <button type="button" className="hero-btn" onClick={handleOpenChangePassword}>
                <Key size={15} />
                <span>Security</span>
              </button>
              <button type="button" className="hero-btn" onClick={handleLogoutClick}>
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Driver ID & Wallet Strip */}
          <div className="hero-id-strip">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ opacity: 0.85 }}>Driver ID:</span>
              <code
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: '#e0f2fe'
                }}
              >
                {effectiveDriverId}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(effectiveDriverId, 'driver')}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                {copiedDriverId ? <Check size={12} color="#86efac" /> : <Copy size={12} />}
                {copiedDriverId ? 'Copied' : 'Copy ID'}
              </button>
            </div>

            <div style={{ opacity: 0.9, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <WalletIcon size={14} />
              <span>Wallet: {effectiveCurrency} ${Number(effectiveBalance).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Email Verification Alert Banner */}
        {/* ========================================================================= */}
        {!isEmailVerified && (
          <div className="alert alert-warning animate-fade-in" style={{ margin: 0, display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Please verify your driver email address</strong>
                <p style={{ fontSize: '0.85rem', marginTop: '0.15rem' }}>
                  Full network charging sessions and automated billing require email confirmation for <strong>{effectiveEmail}</strong>. Codes expire after 24 hours.
                </p>
              </div>
            </div>

            {verifyEmailSuccess && (
              <div className="alert alert-success" style={{ margin: '0.5rem 0' }}>
                <CheckCircle2 size={16} />
                <span>{verifyEmailSuccess}</span>
              </div>
            )}

            {verifyEmailError && (
              <div className="alert alert-danger" style={{ margin: '0.5rem 0' }}>
                <AlertCircle size={16} />
                <span>{verifyEmailError}</span>
              </div>
            )}

            {resendStatusMsg && (
              <div className="alert alert-info" style={{ margin: '0.5rem 0' }}>
                <Clock size={16} />
                <span>{resendStatusMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifyEmail} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                maxLength={6}
                value={verificationCodeInput}
                onChange={(e) => setVerificationCodeInput(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  letterSpacing: '2px',
                  width: '180px',
                  textAlign: 'center',
                  background: '#ffffff'
                }}
              />
              <button
                type="submit"
                disabled={isVerifyingEmail || !verificationCodeInput.trim()}
                className="submit-btn"
                style={{ width: 'auto', margin: 0, padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
              >
                {isVerifyingEmail ? <RefreshCw size={14} className="spinner" /> : <ShieldCheck size={14} />}
                <span>Verify Email</span>
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResendingVerification}
                className="btn-secondary"
                style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
              >
                {isResendingVerification ? <RefreshCw size={14} className="spinner" /> : <Clock size={14} />}
                <span>Resend Code</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Navigation Tabs Bar */}
        {/* ========================================================================= */}
        <nav className="dash-tabs-bar" aria-label="Driver navigation">
          <button
            type="button"
            className={`dash-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 size={16} />
            <span>Overview & Wallet</span>
          </button>
          <button
            type="button"
            className={`dash-tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`}
            onClick={() => setActiveTab('vehicles')}
          >
            <Car size={16} />
            <span>My EV Vehicles</span>
            <span className="dash-tab-badge">{vehicles.length}</span>
          </button>
          <button
            type="button"
            className={`dash-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <Activity size={16} />
            <span>Charging & Stations</span>
          </button>
          <button
            type="button"
            className={`dash-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={16} />
            <span>Security Sandbox</span>
          </button>
          <button
            type="button"
            className={`dash-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
            <span>Account Settings</span>
          </button>
        </nav>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & WALLET */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-green">
                  <WalletIcon size={26} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">EV Wallet Balance</div>
                  <div className="kpi-value">${Number(effectiveBalance).toFixed(2)}</div>
                  <div className="kpi-subtext">Currency: {effectiveCurrency} • Ready for charging</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-blue">
                  <Car size={26} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Registered EVs</div>
                  <div className="kpi-value">{vehicles.length}</div>
                  <div className="kpi-subtext">
                    {vehicles.find((v) => v.isDefault)?.make || 'No default EV set'}
                  </div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-purple">
                  <Zap size={26} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Charging Pass</div>
                  <div className="kpi-value" style={{ fontSize: '1.3rem' }}>Nexus Pass</div>
                  <div className="kpi-subtext">All universal connector protocols</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-amber">
                  <ShieldCheck size={26} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Account Health</div>
                  <div className="kpi-value" style={{ fontSize: '1.3rem' }}>
                    {isEmailVerified ? '100% Verified' : 'Action Required'}
                  </div>
                  <div className="kpi-subtext">
                    {isEmailVerified ? 'Full Access Unlocked' : 'Verify Email Address'}
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Showcase & Driver Profile Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {/* Wallet Card */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">
                      <CreditCard size={18} color="var(--primary-600)" />
                      Driver Digital Wallet
                    </h3>
                    <p className="dash-card-subtitle">Automated station payment ledger</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(effectiveWalletId, 'wallet')}
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                  >
                    {copiedWalletId ? <Check size={12} color="#15803d" /> : <Copy size={12} />}
                    <span>{copiedWalletId ? 'Copied' : 'Copy Wallet ID'}</span>
                  </button>
                </div>

                <div
                  style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    color: '#ffffff',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
                    marginBottom: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8, fontSize: '0.8rem', marginBottom: '1rem' }}>
                    <span>EVNEXUS UNIVERSAL CHARGING WALLET</span>
                    <Zap size={18} color="#38bdf8" />
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#38bdf8' }}>
                    ${Number(effectiveBalance).toFixed(2)} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>{effectiveCurrency}</span>
                  </div>
                  <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.8rem', opacity: 0.85 }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>WALLET IDENTIFIER</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{effectiveWalletId}</div>
                    </div>
                    <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#86efac' }}>
                      ● Active Balance
                    </span>
                  </div>
                </div>
              </div>

              {/* Driver Details Card */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">
                      <User size={18} color="var(--primary-600)" />
                      Driver Profile Snapshot
                    </h3>
                    <p className="dash-card-subtitle">Personal account credentials</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenEditProfile}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Full Name:</span>
                    <strong style={{ color: 'var(--text-main)' }}>{effectiveName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                    <span>{effectiveEmail}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                    <span>{effectivePhone || 'Not provided'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Default Vehicle:</span>
                    <span style={{ fontWeight: 600, color: 'var(--primary-700)' }}>
                      {vehicles.find((v) => v.isDefault)?.make
                        ? `${vehicles.find((v) => v.isDefault).make} ${vehicles.find((v) => v.isDefault).model}`
                        : `${vehicles.length} EVs connected`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY EV VEHICLES */}
        {/* ========================================================================= */}
        {activeTab === 'vehicles' && (
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h3 className="dash-card-title">
                  <Car size={18} color="var(--primary-600)" />
                  My Registered Electric Vehicles
                </h3>
                <p className="dash-card-subtitle">
                  Configure your EV models, connector types (CCS2, Type 2, CHAdeMO, NACS), and default charging car.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddVehicle}
                className="submit-btn"
                style={{ width: 'auto', margin: 0, padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
              >
                <Plus size={15} />
                <span>Add Electric Vehicle</span>
              </button>
            </div>

            {vehicleSuccess && (
              <div className="alert alert-success">
                <CheckCircle2 size={16} />
                <span>{vehicleSuccess}</span>
              </div>
            )}

            {vehicleError && (
              <div className="alert alert-danger">
                <AlertTriangle size={16} />
                <span>{vehicleError}</span>
              </div>
            )}

            {loadingVehicles ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <RefreshCw size={24} className="spinner" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading registered vehicles...</p>
              </div>
            ) : vehicles.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {vehicles.map((v) => (
                  <div
                    key={v.vehicleId}
                    style={{
                      background: 'var(--bg-page)',
                      border: v.isDefault ? '2px solid var(--primary-500)' : '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      boxShadow: 'var(--shadow-sm)',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Car size={20} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                              {v.make} {v.model}
                            </h4>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Plate: <strong>{v.plateNumber}</strong></div>
                          </div>
                        </div>

                        {v.isDefault && (
                          <span className="badge badge-success">
                            <Star size={11} fill="#15803d" /> Default EV
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                        <span className="badge badge-info">
                          <Zap size={11} /> {v.connectorType || 'CCS2'}
                        </span>
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          ID: {v.vehicleId}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                      {!v.isDefault ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultVehicle(v.vehicleId)}
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        >
                          <Star size={12} />
                          <span>Set Default</span>
                        </button>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>● Primary Vehicle</div>
                      )}

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditVehicle(v)}
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVehicle(v.vehicleId)}
                          disabled={deletingVehicleId === v.vehicleId}
                          className="btn-danger"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-page)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
                <Car size={34} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>No electric vehicles registered in your garage yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Add your EV model and connector type to unlock automated smart charging sessions.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CHARGING & ACTIVITY */}
        {/* ========================================================================= */}
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">
                    <Zap size={18} color="var(--primary-600)" />
                    Charging Network Explorer
                  </h3>
                  <p className="dash-card-subtitle">Locate public charging stations and initiate plug & charge sessions.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>GreenPulse Hub Downtown</h4>
                    <span className="badge badge-success">Available</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>500 Market St • 4x 150kW CCS2</p>
                  <button type="button" className="submit-btn" style={{ margin: 0, padding: '0.45rem', fontSize: '0.8rem' }}>
                    <Zap size={14} /> Start Charging Session
                  </button>
                </div>

                <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Voltera Supercharge Airport</h4>
                    <span className="badge badge-success">Available</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Terminal 2 Plaza • 8x 250kW CCS2</p>
                  <button type="button" className="submit-btn" style={{ margin: 0, padding: '0.45rem', fontSize: '0.8rem' }}>
                    <Zap size={14} /> Start Charging Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SECURITY & DEVELOPER SANDBOX */}
        {/* ========================================================================= */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* RBAC Simulator */}
            <div className="dash-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">
                    <Lock size={18} color="#d97706" />
                    Role-Based Access Control (RBAC) Cross-Role Simulator
                  </h3>
                  <p className="dash-card-subtitle">
                    Sends this Driver token to company-only endpoint (<code>GET /api/company/stations</code>). Backend must reject with <strong>403 Forbidden</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestRbacSecurity}
                  disabled={isTestingRbac}
                  className="submit-btn"
                  style={{ width: 'auto', margin: 0, padding: '0.55rem 1.25rem', background: '#d97706', fontSize: '0.85rem' }}
                >
                  {isTestingRbac ? <RefreshCw size={14} className="spinner" /> : <ShieldAlert size={14} />}
                  <span>Test Driver -&gt; Company Access</span>
                </button>
              </div>

              {rbacResult && (
                <div
                  className="alert"
                  style={{
                    margin: 0,
                    background: rbacResult.status === 403 ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${rbacResult.status === 403 ? '#f87171' : '#86efac'}`
                  }}
                >
                  {rbacResult.status === 403 ? <CheckCircle2 size={18} color="#dc2626" /> : <AlertTriangle size={18} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong style={{ color: rbacResult.status === 403 ? '#b91c1c' : '#15803d' }}>
                        {rbacResult.status === 403 ? 'HTTP 403 Forbidden (RBAC Enforcement Verified)' : 'Access Allowed'}
                      </strong>
                      <span className="badge" style={{ background: rbacResult.status === 403 ? '#fee2e2' : '#dcfce7', color: rbacResult.status === 403 ? '#b91c1c' : '#15803d' }}>
                        Status: {rbacResult.status} | {rbacResult.latencyMs}ms
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: rbacResult.status === 403 ? '#991b1b' : '#166534', margin: 0 }}>
                      {rbacResult.errorMsg}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Protected API Check & Raw Token */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">
                      <Server size={18} color="var(--primary-600)" />
                      Protected Driver API
                    </h3>
                    <p className="dash-card-subtitle">Validates Bearer token on profile endpoint</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyProtectedApi}
                    disabled={isVerifying}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                  >
                    <RefreshCw size={13} className={isVerifying ? 'spinner' : ''} />
                    <span>Ping Endpoint</span>
                  </button>
                </div>

                {profileResult && (
                  <div style={{ background: 'var(--success-50)', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.85rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700, marginBottom: '0.5rem' }}>
                      <span>HTTP 200 OK — Authorized</span>
                      <span>{profileResult.latencyMs}ms</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Verified: {profileResult.timestamp}
                    </div>
                  </div>
                )}

                {profileError && (
                  <div className="alert alert-danger" style={{ margin: 0 }}>
                    <AlertTriangle size={16} />
                    <span>Error ({profileError.status}): {profileError.message}</span>
                  </div>
                )}
              </div>

              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">
                      <Key size={18} color="var(--primary-600)" />
                      Driver JWT Token
                    </h3>
                    <p className="dash-card-subtitle">Active signed token payload</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowFullToken(!showFullToken)}
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                    >
                      {showFullToken ? 'Truncate' : 'Expand'}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(authUser?.accessToken, 'token')}
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                    >
                      {copiedToken ? <Check size={12} color="#15803d" /> : <Copy size={12} />}
                      {copiedToken ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    background: '#0f172a',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    overflowX: 'auto',
                    wordBreak: showFullToken ? 'break-all' : 'normal',
                    whiteSpace: showFullToken ? 'pre-wrap' : 'nowrap',
                    maxHeight: showFullToken ? '150px' : 'none'
                  }}
                >
                  {authUser?.accessToken}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ACCOUNT SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">
                    <User size={18} color="var(--primary-600)" />
                    Personal Driver Details
                  </h3>
                  <p className="dash-card-subtitle">Manage name, contact numbers, and security credentials.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="submit-btn" style={{ width: 'auto', margin: 0, padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={handleOpenEditProfile}>
                    <Edit3 size={14} />
                    <span>Edit Profile</span>
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleOpenChangePassword}>
                    <Key size={14} />
                    <span>Change Password</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>FULL NAME</span>
                  <span style={{ fontWeight: 600 }}>{effectiveName}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>EMAIL ADDRESS</span>
                  <span style={{ fontWeight: 600 }}>{effectiveEmail}</span>
                  <span className="badge badge-success" style={{ marginTop: '0.25rem', display: 'inline-flex' }}>
                    <Lock size={10} /> Verified
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>PHONE NUMBER</span>
                  <span style={{ fontWeight: 600 }}>{effectivePhone || 'Not provided'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADD / EDIT VEHICLE MODAL */}
        {/* ========================================================================= */}
        {showVehicleModal && (
          <div className="modal-backdrop">
            <div className="modal-dialog">
              <div className="modal-header">
                <h3 className="modal-title">
                  <Car size={20} color="var(--primary-600)" />
                  {editingVehicleId ? 'Edit Electric Vehicle' : 'Register New Electric Vehicle'}
                </h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowVehicleModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Make / Manufacturer *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tesla, Hyundai, Nissan"
                      value={vehicleFormData.make}
                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, make: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Model *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Model Y, Ioniq 5, Leaf"
                      value={vehicleFormData.model}
                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, model: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">License Plate Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EV-9402"
                      value={vehicleFormData.plateNumber}
                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, plateNumber: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Charging Connector Type *</label>
                    <select
                      value={vehicleFormData.connectorType}
                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, connectorType: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    >
                      <option value="CCS2">CCS2 (European Standard)</option>
                      <option value="CCS1">CCS1 (North American Standard)</option>
                      <option value="Type 2">Type 2 (Mennekes AC)</option>
                      <option value="NACS">NACS (Tesla Universal)</option>
                      <option value="CHAdeMO">CHAdeMO (DC Fast)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id="isDefaultVehicle"
                    checked={vehicleFormData.isDefault}
                    onChange={(e) => setVehicleFormData({ ...vehicleFormData, isDefault: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="isDefaultVehicle" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    Set as default vehicle for charging sessions
                  </label>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowVehicleModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingVehicle}
                    className="submit-btn"
                    style={{ width: 'auto', margin: 0, padding: '0.55rem 1.3rem', fontSize: '0.875rem' }}
                  >
                    {isSubmittingVehicle ? <RefreshCw size={14} className="spinner" /> : <Check size={14} />}
                    <span>{isSubmittingVehicle ? 'Saving...' : 'Save Vehicle'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* EDIT PROFILE MODAL */}
        {/* ========================================================================= */}
        {showEditProfileModal && (
          <div className="modal-backdrop">
            <div className="modal-dialog">
              <div className="modal-header">
                <h3 className="modal-title">
                  <User size={20} color="var(--primary-600)" />
                  Edit Driver Profile
                </h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowEditProfileModal(false)}>
                  <X size={20} />
                </button>
              </div>

              {profileSuccessMsg && (
                <div className="alert alert-success">
                  <CheckCircle2 size={16} />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
                <div className="alert alert-danger">
                  <AlertTriangle size={16} />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmitProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    name="name"
                    value={profileFormData.name}
                    onChange={handleProfileFormChange}
                    className="form-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    name="phone"
                    value={profileFormData.phone}
                    onChange={handleProfileFormChange}
                    className="form-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowEditProfileModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="submit-btn"
                    style={{ width: 'auto', margin: 0, padding: '0.55rem 1.3rem', fontSize: '0.875rem' }}
                  >
                    {isUpdatingProfile ? <RefreshCw size={14} className="spinner" /> : <Check size={14} />}
                    <span>{isUpdatingProfile ? 'Saving...' : 'Save Profile'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CHANGE PASSWORD MODAL */}
        {/* ========================================================================= */}
        {showChangePasswordModal && (
          <div className="modal-backdrop">
            <div className="modal-dialog">
              <div className="modal-header">
                <h3 className="modal-title">
                  <Lock size={20} color="var(--primary-600)" />
                  Change Password
                </h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowChangePasswordModal(false)}>
                  <X size={20} />
                </button>
              </div>

              {passwordSuccessMsg && (
                <div className="alert alert-success">
                  <CheckCircle2 size={16} />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}

              {passwordErrorMsg && (
                <div className="alert alert-danger">
                  <AlertTriangle size={16} />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmitPasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Current Password *</label>
                  <div className="input-wrapper">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      required
                      name="currentPassword"
                      value={passwordFormData.currentPassword}
                      onChange={handlePasswordFormChange}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    />
                    <button
                      type="button"
                      className="toggle-password-btn"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    >
                      {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <div className="input-wrapper">
                    <input
                      type={showPasswords.next ? 'text' : 'password'}
                      required
                      name="newPassword"
                      value={passwordFormData.newPassword}
                      onChange={handlePasswordFormChange}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    />
                    <button
                      type="button"
                      className="toggle-password-btn"
                      onClick={() => setShowPasswords({ ...showPasswords, next: !showPasswords.next })}
                    >
                      {showPasswords.next ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    <span className={isLengthValid ? 'badge badge-success' : 'badge badge-neutral'} style={{ fontSize: '0.72rem' }}>
                      {isLengthValid ? <Check size={11} /> : null} 8+ Characters
                    </span>
                    <span className={hasDigit ? 'badge badge-success' : 'badge badge-neutral'} style={{ fontSize: '0.72rem' }}>
                      {hasDigit ? <Check size={11} /> : null} Number (0-9)
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password *</label>
                  <div className="input-wrapper">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      required
                      name="confirmNewPassword"
                      value={passwordFormData.confirmNewPassword}
                      onChange={handlePasswordFormChange}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    />
                    <button
                      type="button"
                      className="toggle-password-btn"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    >
                      {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {passwordFormData.confirmNewPassword && (
                    <span className={passwordsMatch ? 'badge badge-success' : 'badge badge-danger'} style={{ fontSize: '0.72rem', marginTop: '0.25rem' }}>
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </span>
                  )}
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowChangePasswordModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="submit-btn"
                    style={{ width: 'auto', margin: 0, padding: '0.55rem 1.3rem', fontSize: '0.875rem' }}
                  >
                    {isChangingPassword ? <RefreshCw size={14} className="spinner" /> : <Lock size={14} />}
                    <span>{isChangingPassword ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
