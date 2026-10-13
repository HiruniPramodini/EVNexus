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
  History,
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
  Server,
  MapPin,
  Battery
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
  setDefaultDriverVehicle,
  getDriverWallet,
  getActiveSession,
  getSessionHistory,
  getWalletTransactions
} from '../services/api';
import MapDashboardPage from '../pages/driver/MapDashboardPage';
import SessionHistoryPage from '../pages/driver/SessionHistoryPage';

export default function DriverDashboard({ authUser, activeView, onLogout, onUpdateProfile, onViewChange }) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const [walletBalance, setWalletBalance] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [walletError, setWalletError] = useState(null);

  const [activeSession, setActiveSession] = useState(null);
  const [loadingActiveSession, setLoadingActiveSession] = useState(false);
  
  const [recentSessions, setRecentSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [recentWalletTx, setRecentWalletTx] = useState([]);
  const [loadingWalletTx, setLoadingWalletTx] = useState(false);

  useEffect(() => {
    if (activeView === 'driver-dashboard') setActiveTab('overview');
    else if (activeView === 'wallet') setActiveTab('overview');
    else setActiveTab(activeView);
  }, [activeView]);

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

  const loadDashboardData = async () => {
    setLoadingWallet(true);
    try {
      const wRes = await getDriverWallet(authUser?.accessToken);
      if (wRes?.data) setWalletBalance(wRes.data.balance);
    } catch (e) {
      setWalletError('Failed to load wallet balance.');
    } finally {
      setLoadingWallet(false);
    }

    setLoadingActiveSession(true);
    try {
      const sRes = await getActiveSession(authUser?.accessToken);
      if (sRes?.data) setActiveSession(sRes.data);
    } catch (e) { console.warn(e); } finally { setLoadingActiveSession(false); }

    setLoadingHistory(true);
    try {
      const hRes = await getSessionHistory(authUser?.accessToken);
      if (hRes?.data) setRecentSessions(hRes.data.slice(0, 3));
    } catch (e) { console.warn(e); } finally { setLoadingHistory(false); }

    setLoadingWalletTx(true);
    try {
      const tRes = await getWalletTransactions(1, 3, authUser?.accessToken);
      if (tRes?.data?.items) setRecentWalletTx(tRes.data.items);
    } catch (e) { console.warn(e); } finally { setLoadingWalletTx(false); }
  };

  useEffect(() => {
    handleVerifyProtectedApi();
    loadVehicles();
    loadDashboardData();
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
        {/* TAB 1: OVERVIEW & WALLET */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Header / Welcome Area */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h1 className="text-h1">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {effectiveName.split(' ')[0]}</h1>
              <p className="text-secondary" style={{ fontSize: '1.25rem' }}>
                {activeSession ? 'Your vehicle is currently charging.' : 'Ready for your next charge?'}
              </p>
            </div>

            {/* Station Discovery CTA */}
            <div className="card card-elevated" style={{ background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)', color: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div>
                  <h2 className="text-h2" style={{ color: 'white', marginBottom: 'var(--space-2)' }}>Find your next charging station</h2>
                  <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0 }}>Explore available EV charging stations and choose the charger that fits your needs.</p>
                </div>
                <button 
                  className="btn" 
                  style={{ backgroundColor: 'white', color: 'var(--color-primary-dark)', fontWeight: 'var(--weight-bold)' }}
                  onClick={() => onViewChange && onViewChange('map')}
                >
                  Find a Station <Zap size={18} />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4">
              <div className="card card-interactive" style={{ textAlign: 'center', padding: 'var(--space-4)' }} onClick={() => onViewChange && onViewChange('map')}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3) auto' }}>
                  <MapPin size={24} />
                </div>
                <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: '0.9rem' }}>Find Station</div>
              </div>
              <div className="card card-interactive" style={{ textAlign: 'center', padding: 'var(--space-4)' }} onClick={() => onViewChange && onViewChange('map')}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-success-light)', color: 'var(--color-success-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3) auto' }}>
                  <Zap size={24} />
                </div>
                <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: '0.9rem' }}>Start Charging</div>
              </div>
              <div className="card card-interactive" style={{ textAlign: 'center', padding: 'var(--space-4)' }} onClick={() => onViewChange && onViewChange('wallet')}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-info-light)', color: 'var(--color-info-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3) auto' }}>
                  <WalletIcon size={24} />
                </div>
                <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: '0.9rem' }}>My Wallet</div>
              </div>
              <div className="card card-interactive" style={{ textAlign: 'center', padding: 'var(--space-4)' }} onClick={() => onViewChange && onViewChange('history')}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-warning-light)', color: 'var(--color-warning-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3) auto' }}>
                  <History size={24} />
                </div>
                <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: '0.9rem' }}>Charging History</div>
              </div>
            </div>

            <div className="grid grid-cols-2" style={{ alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                {/* Active Charging Session */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Active Session</h3>
                  </div>
                  {loadingActiveSession ? (
                    <div>
                      <div className="skeleton skeleton-title"></div>
                      <div className="skeleton skeleton-text"></div>
                    </div>
                  ) : activeSession ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-info-light)', color: 'var(--color-info-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 'var(--weight-semibold)' }}>{activeSession.stationName || 'Charging Station'}</div>
                            <div className="text-caption">Charger {activeSession.chargerId}</div>
                          </div>
                        </div>
                        <span className="badge badge-info">Charging</span>
                      </div>
                      <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                        <div style={{ background: 'var(--color-background)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                          <div className="text-caption">Energy Delivered</div>
                          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: '1.25rem' }}>{activeSession.kwhTransferred?.toFixed(2) || '0.00'} kWh</div>
                        </div>
                        <div style={{ background: 'var(--color-background)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                          <div className="text-caption">Est. Cost</div>
                          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: '1.25rem' }}>${activeSession.estimatedCost?.toFixed(2) || '0.00'}</div>
                        </div>
                      </div>
                      <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => onViewChange && onViewChange('live')}>
                        View Charging Session
                      </button>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
                      <Battery size={48} className="empty-state-icon" />
                      <h4 className="empty-state-title" style={{ fontSize: '1.1rem' }}>You're not charging right now.</h4>
                      <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => onViewChange && onViewChange('map')}>
                        Find a Charging Station
                      </button>
                    </div>
                  )}
                </div>

                {/* Driver Profile Summary */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Driver Profile</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'var(--weight-bold)' }}>
                      {effectiveName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'var(--weight-bold)', fontSize: '1.1rem' }}>{effectiveName}</div>
                      <div className="text-secondary">{effectiveEmail}</div>
                      <div className="text-caption" style={{ marginTop: 'var(--space-1)' }}>
                        {isEmailVerified ? <span style={{ color: 'var(--color-success-dark)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Verified Driver</span> : <span style={{ color: 'var(--color-warning-dark)' }}>Unverified</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                {/* Wallet Summary */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">My Wallet</h3>
                    <button className="btn btn-ghost" style={{ padding: 'var(--space-1)' }} onClick={() => onViewChange && onViewChange('wallet')}>View</button>
                  </div>
                  {loadingWallet ? (
                    <div>
                      <div className="skeleton skeleton-title"></div>
                      <div className="skeleton skeleton-text"></div>
                    </div>
                  ) : walletError ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                      <p className="text-secondary" style={{ marginBottom: 'var(--space-3)' }}>{walletError}</p>
                      <button className="btn btn-outline" onClick={loadDashboardData}>Retry</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', color: 'white', marginBottom: 'var(--space-4)' }}>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 'var(--space-2)' }}>CURRENT BALANCE</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 'var(--weight-bold)', lineHeight: 1 }}>
                          ${walletBalance !== null ? Number(walletBalance).toFixed(2) : Number(effectiveBalance).toFixed(2)}
                        </div>
                      </div>
                      
                      {/* Recent Wallet Activity */}
                      {loadingWalletTx ? (
                        <div className="skeleton skeleton-text"></div>
                      ) : recentWalletTx.length > 0 ? (
                        <div>
                          <div style={{ fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-3)', fontSize: '0.9rem' }}>Recent Activity</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {recentWalletTx.map(tx => (
                              <div key={tx.id || tx.transactionId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: tx.amount < 0 ? 'var(--color-danger-light)' : 'var(--color-success-light)', color: tx.amount < 0 ? 'var(--color-danger-dark)' : 'var(--color-success-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {tx.amount < 0 ? <Zap size={14} /> : <CreditCard size={14} />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 'var(--weight-medium)' }}>{tx.amount < 0 ? 'Charging Session' : 'Top Up'}</div>
                                    <div className="text-caption">{new Date(tx.date || tx.createdAt).toLocaleDateString()}</div>
                                  </div>
                                </div>
                                <div style={{ fontWeight: 'var(--weight-bold)', color: tx.amount < 0 ? 'var(--color-text)' : 'var(--color-success)' }}>
                                  {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-secondary" style={{ fontSize: '0.9rem', textAlign: 'center', padding: 'var(--space-2)' }}>
                          No wallet transactions yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Recent Charging Activity */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Recent Charging</h3>
                    <button className="btn btn-ghost" style={{ padding: 'var(--space-1)' }} onClick={() => onViewChange && onViewChange('history')}>View All</button>
                  </div>
                  {loadingHistory ? (
                    <div className="skeleton skeleton-text"></div>
                  ) : recentSessions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {recentSessions.map(session => (
                        <div key={session.id || session.sessionId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'var(--weight-medium)' }}>{session.stationName || 'Charging Station'}</div>
                            <div className="text-caption">{new Date(session.startTime || session.createdAt).toLocaleDateString()} • {session.kwhTransferred?.toFixed(2) || '0.00'} kWh</div>
                          </div>
                          <span className={`badge ${session.status === 'Completed' ? 'badge-success' : session.status === 'Charging' ? 'badge-info' : 'badge-neutral'}`}>
                            {session.status || 'Completed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: 'var(--space-4)' }}>
                      <div className="text-secondary" style={{ fontSize: '0.9rem', textAlign: 'center' }}>
                        No recent charging sessions.
                      </div>
                    </div>
                  )}
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
        {activeTab === 'map' && (
          <MapDashboardPage authUser={authUser} onViewChange={setActiveTab} />
        )}

        {/* ========================================================================= */}
        {/* TAB 3.5: HISTORY & RECEIPTS */}
        {/* ========================================================================= */}
        {activeTab === 'history' && (
          <SessionHistoryPage authUser={authUser} />
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
