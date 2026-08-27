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
  RefreshCw,
  Mail,
  Phone,
  ShieldCheck,
  CreditCard,
  MapPin,
  Clock,
  Key,
  ShieldAlert,
  Lock,
  Edit3,
  X,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';
import {
  getDriverProfile,
  updateDriverProfile,
  changeDriverPassword,
  clearAuthSession,
  testDriverAccessToCompanyEndpoint,
  verifyEmail,
  resendVerificationCode
} from '../services/api';

export default function DriverDashboard({ authUser, onLogout, onUpdateProfile }) {
  const [copiedDriverId, setCopiedDriverId] = useState(false);
  const [copiedWalletId, setCopiedWalletId] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);

  // Email Verification State for New / Unverified Driver Accounts
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

  useEffect(() => {
    handleVerifyProtectedApi();
  }, []);

  const copyToClipboard = (text, type) => {
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

      // Synchronize form defaults
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

  // Profile Modal Handlers
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

  const handleProfileFormChange = (e) => {
    const { name, value } = e.target;
    setProfileFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    setProfileValidationErrors([]);

    // Client validation
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
      
      // Update local profile result
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

      // Propagate to parent state & localStorage
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

  // Password Modal Handlers
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

  const handlePasswordFormChange = (e) => {
    const { name, value } = e.target;
    setPasswordFormData((prev) => ({ ...prev, [name]: value }));
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
  const effectiveCreatedAt = profileResult?.data?.createdAt ? new Date(profileResult.data.createdAt).toLocaleDateString() : 'Active Driver';

  // Live password validation checks
  const isLengthValid = passwordFormData.newPassword.length >= 8;
  const hasDigit = /(?=.*[0-9])/.test(passwordFormData.newPassword);
  const passwordsMatch = Boolean(passwordFormData.newPassword && passwordFormData.newPassword === passwordFormData.confirmNewPassword);

  return (
    <div className="main-content" style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Driver Header Banner */}
      <div
        className="register-card"
        style={{
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #1e40af 100%)',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.35)',
          borderRadius: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Zap size={12} />
                EV Driver Account
              </span>
              <span
                style={{
                  background: 'rgba(34, 197, 94, 0.3)',
                  color: '#86efac',
                  border: '1px solid rgba(134, 239, 172, 0.4)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}
              >
                ● Active
              </span>
              <span
                style={{
                  background: isEmailVerified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                  color: '#ffffff',
                  border: isEmailVerified ? '1px solid #10b981' : '1px solid #f59e0b',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                {isEmailVerified ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {isEmailVerified ? 'Email Verified' : 'Unverified Email'}
              </span>
            </div>

            <h1 style={{ fontSize: '1.85rem', fontWeight: '700', margin: '0.25rem 0', color: '#ffffff' }}>
              {effectiveName}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.5rem', opacity: 0.9, fontSize: '0.875rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} />
                {effectiveEmail}
              </span>
              {effectivePhone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Phone size={14} />
                  {effectivePhone}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleOpenEditProfile}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                color: '#ffffff',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s'
              }}
            >
              <Edit3 size={14} />
              <span>Edit Profile</span>
            </button>

            <button
              type="button"
              onClick={handleOpenChangePassword}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                color: '#ffffff',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s'
              }}
            >
              <Key size={14} />
              <span>Change Password</span>
            </button>

            <button
              type="button"
              onClick={handleLogoutClick}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s'
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Driver ID Copy Box */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={16} style={{ opacity: 0.8 }} />
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>Driver Identifier:</span>
            <code
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                letterSpacing: '0.5px'
              }}
            >
              {effectiveDriverId}
            </code>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(effectiveDriverId, 'driver')}
            style={{
              background: copiedDriverId ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#ffffff',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'background 0.2s'
            }}
          >
            {copiedDriverId ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedDriverId ? 'Copied' : 'Copy Driver ID'}</span>
          </button>
        </div>
      </div>

      {/* Acceptance Criteria 2: Unverified Account Prompt & Restriction Banner */}
      {!isEmailVerified && (
        <div
          className="register-card animate-fade-in"
          style={{
            marginBottom: '1.5rem',
            border: '2px solid #f59e0b',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%)',
            boxShadow: '0 8px 24px -4px rgba(245, 158, 11, 0.2)',
            borderRadius: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#b45309', margin: 0 }}>
                  Please verify your email
                </h3>
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}
                >
                  Charging Platform Access Restricted
                </span>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #4b5563)', marginBottom: '1rem', lineHeight: 1.5 }}>
                You are logged in, but charging sessions, wallet top-ups, and plug reservations remain restricted until <strong>{effectiveEmail}</strong> is verified. Verification links and codes expire after 24 hours.
              </p>

              {verifyEmailSuccess && (
                <div style={{ marginBottom: '0.85rem', padding: '0.65rem 0.9rem', background: '#dcfce7', color: '#15803d', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  <span>{verifyEmailSuccess}</span>
                </div>
              )}

              {verifyEmailError && (
                <div style={{ marginBottom: '0.85rem', padding: '0.65rem 0.9rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} />
                  <span>{verifyEmailError}</span>
                </div>
              )}

              {resendStatusMsg && (
                <div style={{ marginBottom: '0.85rem', padding: '0.65rem 0.9rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <Clock size={16} />
                  <span>{resendStatusMsg}</span>
                </div>
              )}

              {/* Inline Verification Input & Actions */}
              <form onSubmit={handleVerifyEmail} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  value={verificationCodeInput}
                  onChange={(e) => setVerificationCodeInput(e.target.value)}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, #d1d5db)',
                    fontFamily: 'monospace',
                    fontSize: '1.05rem',
                    letterSpacing: '2px',
                    width: '180px',
                    textAlign: 'center',
                    background: 'var(--bg-input, #ffffff)'
                  }}
                />

                <button
                  type="submit"
                  disabled={isVerifyingEmail || !verificationCodeInput.trim()}
                  style={{
                    padding: '0.55rem 1.1rem',
                    background: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {isVerifyingEmail ? <RefreshCw size={15} className="spinner" /> : <ShieldCheck size={15} />}
                  <span>Verify Email</span>
                </button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResendingVerification}
                  style={{
                    padding: '0.55rem 1rem',
                    background: 'transparent',
                    color: '#b45309',
                    border: '1px solid rgba(217, 119, 6, 0.4)',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {isResendingVerification ? <RefreshCw size={14} className="spinner" /> : <Clock size={14} />}
                  <span>Resend Code (Valid 24h)</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Driver Profile Showcase Card */}
      <div
        className="register-card"
        style={{
          marginBottom: '1.5rem',
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '1.5rem',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <User size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>
                Driver Profile & Account Information
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Personal contact details & authenticated driver credentials
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleOpenEditProfile}
              style={{
                background: 'var(--primary-50)',
                border: '1px solid var(--primary-200)',
                color: 'var(--primary-700)',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Edit3 size={14} />
              <span>Update Details</span>
            </button>

            <button
              type="button"
              onClick={handleOpenChangePassword}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#334155',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Key size={14} />
              <span>Password</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', fontSize: '0.875rem' }}>
          <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Full Name</div>
            <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
              {effectiveName}
            </div>
          </div>

          <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Phone Number</div>
            <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
              {effectivePhone || <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>Not provided</span>}
            </div>
          </div>

          <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Login Email</span>
              <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <Lock size={10} /> Verified
              </span>
            </div>
            <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
              {effectiveEmail}
            </div>
          </div>

          <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Member Since</div>
            <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
              {effectiveCreatedAt}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Charging Wallet & Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Charging Wallet Card */}
        <div
          className="register-card"
          style={{
            margin: 0,
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #0ea5e9, #0284c7)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <WalletIcon size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>Digital Charging Wallet</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-deducted per kWh session</span>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#16a34a', background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
              Ready
            </span>
          </div>

          <div style={{ padding: '1.25rem', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '12px', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Available Balance</span>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary-700)', marginTop: '0.25rem' }}>
              ${Number(effectiveBalance).toFixed(2)}{' '}
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>{effectiveCurrency}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Wallet ID:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <code style={{ fontSize: '0.8rem', color: 'var(--text-main)', background: 'var(--primary-50)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                {effectiveWalletId}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(effectiveWalletId, 'wallet')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-600)', padding: '2px' }}
                title="Copy Wallet ID"
              >
                {copiedWalletId ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="submit-btn"
              style={{ flex: 1, padding: '0.55rem', fontSize: '0.85rem', margin: 0 }}
              onClick={() => alert('Wallet top-up gateway will be connected in the Payment Service story.')}
            >
              <CreditCard size={14} />
              <span>Top Up Wallet</span>
            </button>
          </div>
        </div>

        {/* Quick Driver Features */}
        <div
          className="register-card"
          style={{
            margin: 0,
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px'
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-subtle, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Find Nearby Stations</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Map Service with live availability</div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-subtle, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Link RFID Card</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tap-to-charge station authentication</div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-subtle, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Charging History</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Past session logs & receipts</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Protected JWT Verification Live Test Panel */}
      <div
        className="register-card"
        style={{
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          margin: '0 0 1.5rem 0'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="var(--primary-600)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-main)' }}>
                Protected Driver Endpoint Test
              </h3>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Validates <code>GET /api/auth/driver/profile</code> requiring signed Bearer JWT token with Driver role claim.
            </p>
          </div>

          <button
            type="button"
            onClick={handleVerifyProtectedApi}
            disabled={isVerifying}
            style={{
              background: 'var(--primary-50)',
              border: '1px solid var(--primary-200)',
              color: 'var(--primary-700)',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <RefreshCw size={14} className={isVerifying ? 'spinner-icon' : ''} />
            <span>{isVerifying ? 'Verifying...' : 'Re-test Endpoint'}</span>
          </button>
        </div>

        {profileResult && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <CheckCircle2 size={18} />
              <span>JWT Authentication & Authorization Verified (HTTP {profileResult.status} OK - {profileResult.latencyMs}ms)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div><strong>Driver ID:</strong> {profileResult.data?.driverId}</div>
              <div><strong>Name:</strong> {profileResult.data?.name}</div>
              <div><strong>Email:</strong> {profileResult.data?.email}</div>
              <div><strong>Phone:</strong> {profileResult.data?.phone || 'N/A'}</div>
              <div><strong>Role Claim:</strong> {profileResult.data?.role}</div>
              <div><strong>Wallet Balance:</strong> ${profileResult.data?.walletBalance} {profileResult.data?.currency}</div>
            </div>
          </div>
        )}

        {profileError && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1rem',
              color: '#b91c1c'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
              <AlertTriangle size={18} />
              <span>Protected Endpoint Error ({profileError.status})</span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>{profileError.message}</p>
          </div>
        )}

        {/* JWT Token View */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Active Driver JWT Access Token</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowFullToken(!showFullToken)}
                style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
              >
                {showFullToken ? 'Collapse' : 'Expand Token'}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(authUser?.accessToken, 'token')}
                style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                {copiedToken ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                <span>{copiedToken ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
          <pre
            style={{
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.6rem 0.8rem',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--text-main)',
              overflowX: 'auto',
              whiteSpace: showFullToken ? 'pre-wrap' : 'nowrap',
              wordBreak: showFullToken ? 'break-all' : 'normal',
              margin: 0
            }}
          >
            {authUser?.accessToken || 'No token found in current session'}
          </pre>
        </div>

        {/* RBAC Security Access Simulator Card */}
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            background: 'var(--bg-subtle, #f8fafc)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={18} color="#dc2626" />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' }}>
                RBAC Security Enforcement Simulator
              </h4>
            </div>
            <button
              type="button"
              onClick={handleTestRbacSecurity}
              disabled={isTestingRbac}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
              }}
            >
              {isTestingRbac ? <RefreshCw size={14} className="spinner-icon" /> : <ShieldAlert size={14} />}
              <span>{isTestingRbac ? 'Simulating...' : 'Test Company-Only Access'}</span>
            </button>
          </div>

          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Simulates a cross-role breach attempt: sends this <strong>Driver</strong> JWT token to the company-only endpoint (<code>GET /api/company/stations</code>). The backend <code>RoleAuthorizationMiddleware</code> must reject with <strong>403 Forbidden</strong> and log an audit warning.
          </p>

          {rbacResult && (
            <div
              style={{
                background: rbacResult.status === 403 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                border: `1px solid ${rbacResult.status === 403 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                borderRadius: '10px',
                padding: '0.85rem 1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    color: rbacResult.status === 403 ? '#dc2626' : '#16a34a'
                  }}
                >
                  {rbacResult.status === 403 ? <CheckCircle2 size={16} color="#dc2626" /> : <AlertTriangle size={16} />}
                  {rbacResult.status === 403 ? 'HTTP 403 Forbidden (RBAC Enforcement Verified)' : 'RBAC Failed (Unexpected 200 OK)'}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    background: rbacResult.status === 403 ? '#fee2e2' : '#dcfce7',
                    color: rbacResult.status === 403 ? '#b91c1c' : '#15803d'
                  }}
                >
                  HTTP {rbacResult.status} | {rbacResult.latencyMs}ms
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: rbacResult.status === 403 ? '#991b1b' : '#166534' }}>
                <strong>Server Response:</strong> {rbacResult.errorMsg}
              </p>
              {rbacResult.errors?.length > 0 && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#b91c1c' }}>
                  {rbacResult.errors.map((e, idx) => (
                    <div key={`driver-rbac-err-${idx}`}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Edit Profile Modal */}
      {/* ========================================================================= */}
      {showEditProfileModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setShowEditProfileModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              animation: 'modalSlideIn 0.25s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={18} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#ffffff' }}>
                  Edit Driver Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitProfile} style={{ padding: '1.5rem' }}>
              {profileSuccessMsg && (
                <div
                  style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#15803d',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#b91c1c',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600' }}>
                    <AlertTriangle size={16} />
                    <span>{profileErrorMsg}</span>
                  </div>
                  {profileValidationErrors.length > 0 && (
                    <ul style={{ margin: '0.4rem 0 0 1.25rem', padding: 0 }}>
                      {profileValidationErrors.map((err, idx) => (
                        <li key={`prof-val-err-${idx}`}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Full Name */}
                <div className="form-group">
                  <label htmlFor="driver-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Driver Full Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    id="driver-name"
                    type="text"
                    name="name"
                    value={profileFormData.name}
                    onChange={handleProfileFormChange}
                    placeholder="Enter your full name"
                    className="form-input"
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.9rem'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                    Between 2 and 100 characters.
                  </span>
                </div>

                {/* Phone Number */}
                <div className="form-group">
                  <label htmlFor="driver-phone" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Contact Phone Number <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    id="driver-phone"
                    type="tel"
                    name="phone"
                    value={profileFormData.phone}
                    onChange={handleProfileFormChange}
                    placeholder="+1-555-123-4567"
                    className="form-input"
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {/* Email (Read-Only) */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label htmlFor="driver-email" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>
                      Account Login Email
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Lock size={11} /> Primary Driver ID
                    </span>
                  </div>
                  <input
                    id="driver-email"
                    type="email"
                    value={effectiveEmail}
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#64748b',
                      fontSize: '0.9rem',
                      cursor: 'not-allowed'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                    Driver email is your secure account identity and cannot be edited.
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: '#ffffff',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="submit-btn"
                  style={{
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.85rem',
                    margin: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {isUpdatingProfile ? <RefreshCw size={14} className="spinner-icon" /> : <Check size={14} />}
                  <span>{isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Change Password Modal */}
      {/* ========================================================================= */}
      {showChangePasswordModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setShowChangePasswordModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              animation: 'modalSlideIn 0.25s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#ffffff' }}>
                  Change Account Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePasswordModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitPasswordChange} style={{ padding: '1.5rem' }}>
              {passwordSuccessMsg && (
                <div
                  style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#15803d',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}

              {passwordErrorMsg && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#b91c1c',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600' }}>
                    <AlertTriangle size={16} />
                    <span>{passwordErrorMsg}</span>
                  </div>
                  {passwordValidationErrors.length > 0 && (
                    <ul style={{ margin: '0.4rem 0 0 1.25rem', padding: 0 }}>
                      {passwordValidationErrors.map((err, idx) => (
                        <li key={`pwd-val-err-${idx}`}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* Current Password */}
                <div className="form-group">
                  <label htmlFor="current-password" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Current Password <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="current-password"
                      type={showPasswords.current ? 'text' : 'password'}
                      name="currentPassword"
                      value={passwordFormData.currentPassword}
                      onChange={handlePasswordFormChange}
                      placeholder="Enter your current password"
                      required
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '0.65rem 2.5rem 0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="form-group">
                  <label htmlFor="new-password" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    New Password <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="new-password"
                      type={showPasswords.next ? 'text' : 'password'}
                      name="newPassword"
                      value={passwordFormData.newPassword}
                      onChange={handlePasswordFormChange}
                      placeholder="Enter new password"
                      required
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '0.65rem 2.5rem 0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords((prev) => ({ ...prev, next: !prev.next }))}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPasswords.next ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password Checklist Pills */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.725rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        fontWeight: '600',
                        background: isLengthValid ? '#dcfce7' : '#f1f5f9',
                        color: isLengthValid ? '#15803d' : '#64748b',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      {isLengthValid ? <Check size={12} /> : '○'} Min 8 characters
                    </span>

                    <span
                      style={{
                        fontSize: '0.725rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        fontWeight: '600',
                        background: hasDigit ? '#dcfce7' : '#f1f5f9',
                        color: hasDigit ? '#15803d' : '#64748b',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      {hasDigit ? <Check size={12} /> : '○'} At least 1 number
                    </span>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="form-group">
                  <label htmlFor="confirm-new-password" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Confirm New Password <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="confirm-new-password"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      name="confirmNewPassword"
                      value={passwordFormData.confirmNewPassword}
                      onChange={handlePasswordFormChange}
                      placeholder="Re-type new password"
                      required
                      className="form-input"
                      style={{
                        width: '100%',
                        padding: '0.65rem 2.5rem 0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {passwordFormData.confirmNewPassword && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', fontWeight: '600', color: passwordsMatch ? '#16a34a' : '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {passwordsMatch ? <Check size={12} /> : <AlertTriangle size={12} />}
                      <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  style={{
                    padding: '0.6rem 1.1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: '#ffffff',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="submit-btn"
                  style={{
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.85rem',
                    margin: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {isChangingPassword ? <RefreshCw size={14} className="spinner-icon" /> : <Key size={14} />}
                  <span>{isChangingPassword ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
