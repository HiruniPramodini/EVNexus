import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  Key,
  Copy,
  Check,
  LogOut,
  Server,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Mail,
  Clock,
  ShieldAlert,
  Zap,
  Plus,
  Layers,
  Lock,
  Edit3,
  Phone,
  MapPin,
  Image as ImageIcon,
  Sparkles,
  X,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  CreditCard,
  Trash2,
  Send,
  BarChart3,
  Settings,
  Shield
} from 'lucide-react';
import {
  getCompanyProfile,
  updateCompanyProfile,
  requestEmailChange,
  clearAuthSession,
  getCompanyStations,
  createCompanyStation,
  testCrossTenantAccess,
  testCompanyAccessToDriverEndpoint,
  verifyEmail,
  resendVerificationCode,
  getCompanyStaff,
  createCompanyStaff,
  deactivateCompanyStaff,
  reactivateCompanyStaff,
  getCompanyBilling,
  deleteCompanyAccount
} from '../services/api';

const PRESET_LOGOS = [
  { label: 'GreenPulse', url: 'https://images.unsplash.com/photo-1558441719-8b489c652756?w=200' },
  { label: 'Voltera EV', url: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=200' },
  { label: 'CleanGrid', url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=200' },
  { label: 'EcoCharge', url: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=200' }
];

export default function CompanyDashboard({ authUser, onLogout, onUpdateProfile }) {
  const [activeTab, setActiveTab] = useState('overview');

  const [copiedTenantId, setCopiedTenantId] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showFullToken, setShowFullToken] = useState(false);

  // Email Verification State for New / Unverified Accounts
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
    companyName: authUser?.companyName || '',
    phone: authUser?.phone || '',
    address: authUser?.address || '',
    logoUrl: authUser?.logoUrl || '',
    businessEmail: authUser?.businessEmail || '',
    emailVerificationCode: ''
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(null);
  const [profileUpdateError, setProfileUpdateError] = useState(null);
  const [profileUpdateValidationErrors, setProfileUpdateValidationErrors] = useState([]);

  // Email re-verification state
  const [showEmailChangeSection, setShowEmailChangeSection] = useState(false);
  const [newEmailToVerify, setNewEmailToVerify] = useState('');
  const [isRequestingEmailCode, setIsRequestingEmailCode] = useState(false);
  const [emailCodeSentInfo, setEmailCodeSentInfo] = useState(null);
  const [emailCodeError, setEmailCodeError] = useState(null);

  // Protected API Test State
  const [isVerifying, setIsVerifying] = useState(false);
  const [profileResult, setProfileResult] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Multi-Tenant Stations State
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [stationError, setStationError] = useState(null);

  // Add Station Form State
  const [showAddStation, setShowAddStation] = useState(false);
  const [stationForm, setStationForm] = useState({ name: '', location: '', totalPorts: 4 });
  const [isSubmittingStation, setIsSubmittingStation] = useState(false);
  const [stationSuccessMsg, setStationSuccessMsg] = useState(null);

  // Cross-Tenant Security Simulator State
  const [unauthorizedTenantId, setUnauthorizedTenantId] = useState('TNT-UNAUTHORIZED-CORP-999');
  const [isTestingCrossTenant, setIsTestingCrossTenant] = useState(false);
  const [crossTenantResult, setCrossTenantResult] = useState(null);

  // RBAC Security Simulator State
  const [isTestingRbac, setIsTestingRbac] = useState(false);
  const [rbacResult, setRbacResult] = useState(null);

  // Role Detection
  const userRole = authUser?.role || 'CompanyAdmin';
  const isOperator = userRole?.toLowerCase() === 'operator';
  const isAdmin = !isOperator;

  // Staff Management State
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState(null);
  const [staffSuccess, setStaffSuccess] = useState(null);
  const [showInviteStaffModal, setShowInviteStaffModal] = useState(false);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [staffModalError, setStaffModalError] = useState(null);
  const [staffFormData, setStaffFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'Operator'
  });

  // Billing State
  const [billingInfo, setBillingInfo] = useState(null);
  const [loadingBilling, setLoadingBilling] = useState(false);

  // Company Deletion State
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);
  const [deleteCompanyMsg, setDeleteCompanyMsg] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    handleVerifyProtectedApi();
    loadStations();
    if (isAdmin) {
      loadStaff();
      loadBilling();
    }
  }, []);

  const loadStaff = async () => {
    setLoadingStaff(true);
    setStaffError(null);
    try {
      const res = await getCompanyStaff(authUser?.accessToken);
      if (res?.data) {
        setStaffList(res.data);
      }
    } catch (err) {
      setStaffError(err.message || 'Failed to load staff accounts.');
    } finally {
      setLoadingStaff(false);
    }
  };

  const loadBilling = async () => {
    setLoadingBilling(true);
    try {
      const res = await getCompanyBilling(authUser?.accessToken);
      if (res?.data) {
        setBillingInfo(res.data);
      }
    } catch (err) {
      console.warn('Billing info not available:', err);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setStaffModalError(null);
    setIsSubmittingStaff(true);
    try {
      const res = await createCompanyStaff(staffFormData, authUser?.accessToken);
      if (res?.data) {
        setStaffList((prev) => [res.data, ...prev]);
        setShowInviteStaffModal(false);
        setStaffSuccess(`Staff member '${res.data.name}' invited with role Operator under Tenant ${authUser?.tenantId}!`);
        setStaffFormData({ name: '', email: '', password: '', phone: '', role: 'Operator' });
      }
    } catch (err) {
      setStaffModalError(err.message || 'Failed to create staff member.');
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  const handleToggleStaffStatus = async (staffMember) => {
    setStaffError(null);
    setStaffSuccess(null);
    try {
      const isDeactivating = staffMember.status === 'Active';
      const res = isDeactivating
        ? await deactivateCompanyStaff(staffMember.userId, authUser?.accessToken)
        : await reactivateCompanyStaff(staffMember.userId, authUser?.accessToken);

      if (res?.data) {
        setStaffList((prev) => prev.map((s) => (s.userId === staffMember.userId ? res.data : s)));
        setStaffSuccess(`Staff member '${staffMember.name}' ${isDeactivating ? 'deactivated' : 'reactivated'} successfully.`);
      }
    } catch (err) {
      setStaffError(err.message || `Failed to update status for ${staffMember.name}.`);
    }
  };

  const handleDeleteCompany = async () => {
    setIsDeletingCompany(true);
    setDeleteCompanyMsg(null);
    try {
      await deleteCompanyAccount(authUser?.accessToken);
      alert('Company account has been deleted successfully. You will now be signed out.');
      onLogout?.();
    } catch (err) {
      setDeleteCompanyMsg(err.message || 'Failed to delete company account.');
      setIsDeletingCompany(false);
    }
  };

  const loadStations = async () => {
    setLoadingStations(true);
    setStationError(null);
    try {
      const res = await getCompanyStations(authUser?.accessToken);
      if (res?.data) {
        setStations(res.data);
      }
    } catch (err) {
      setStationError(err.message || 'Failed to load isolated stations.');
    } finally {
      setLoadingStations(false);
    }
  };

  const handleCreateStation = async (e) => {
    e.preventDefault();
    if (!stationForm.name.trim() || !stationForm.location.trim()) return;

    setIsSubmittingStation(true);
    setStationError(null);
    setStationSuccessMsg(null);

    try {
      const res = await createCompanyStation(
        {
          name: stationForm.name,
          location: stationForm.location,
          totalPorts: Number(stationForm.totalPorts) || 1
        },
        authUser?.accessToken
      );

      setStationSuccessMsg(`Station "${res?.data?.name || stationForm.name}" created and automatically scoped to Tenant ${authUser?.tenantId}!`);
      setStationForm({ name: '', location: '', totalPorts: 4 });
      setShowAddStation(false);
      await loadStations();
      setTimeout(() => setStationSuccessMsg(null), 5000);
    } catch (err) {
      setStationError(err.message || 'Failed to create station.');
    } finally {
      setIsSubmittingStation(false);
    }
  };

  const handleSimulateCrossTenant = async () => {
    setIsTestingCrossTenant(true);
    setCrossTenantResult(null);

    const startTime = performance.now();
    try {
      await testCrossTenantAccess(unauthorizedTenantId, authUser?.accessToken);
      const endTime = performance.now();
      setCrossTenantResult({
        success: false,
        status: 200,
        message: 'Unexpected: Cross-tenant access was allowed! (Isolation failure)',
        latencyMs: Math.round(endTime - startTime)
      });
    } catch (err) {
      const endTime = performance.now();
      setCrossTenantResult({
        success: true, // Expected outcome: 403 Forbidden
        status: err.status || 403,
        message: err.message || 'Cross-tenant access forbidden. You cannot access data belonging to another tenant.',
        latencyMs: Math.round(endTime - startTime)
      });
    } finally {
      setIsTestingCrossTenant(false);
    }
  };

  const handleTestRbacSecurity = async () => {
    setIsTestingRbac(true);
    setRbacResult(null);
    const startTime = performance.now();
    try {
      const res = await testCompanyAccessToDriverEndpoint(authUser?.accessToken);
      const endTime = performance.now();
      setRbacResult({
        status: 200,
        success: true,
        data: res,
        latencyMs: Math.round(endTime - startTime),
        message: 'Unexpected: Cross-role access was granted.'
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

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'tenant') {
      setCopiedTenantId(true);
      setTimeout(() => setCopiedTenantId(false), 2500);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  const handleVerifyProtectedApi = async () => {
    setIsVerifying(true);
    setProfileError(null);
    setProfileResult(null);

    try {
      const startTime = performance.now();
      const response = await getCompanyProfile(authUser?.accessToken);
      const endTime = performance.now();

      setProfileResult({
        data: response.data,
        status: 200,
        latencyMs: Math.round(endTime - startTime),
        timestamp: new Date().toLocaleTimeString()
      });

      if (response.data) {
        setProfileFormData((prev) => ({
          ...prev,
          companyName: response.data.companyName || prev.companyName,
          phone: response.data.phone || prev.phone,
          address: response.data.address || prev.address,
          logoUrl: response.data.logoUrl || prev.logoUrl,
          businessEmail: response.data.businessEmail || prev.businessEmail
        }));

        if (response.data.companyName !== authUser?.companyName || response.data.logoUrl !== authUser?.logoUrl) {
          onUpdateProfile?.(response.data);
        }
      }
    } catch (err) {
      setProfileError({
        message: err.message || 'Failed to authenticate token against protected endpoint.',
        status: err.status || 500
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileUpdateError(null);
    setProfileUpdateSuccess(null);
    setProfileUpdateValidationErrors([]);

    try {
      const payload = {
        companyName: profileFormData.companyName,
        phone: profileFormData.phone,
        address: profileFormData.address,
        logoUrl: profileFormData.logoUrl,
        businessEmail: profileFormData.businessEmail,
        emailVerificationCode: profileFormData.emailVerificationCode
      };

      const res = await updateCompanyProfile(payload, authUser?.accessToken);
      if (res?.data) {
        setProfileUpdateSuccess('Company profile updated successfully! Changes reflected immediately.');
        setProfileResult((prev) => ({
          ...prev,
          data: res.data,
          timestamp: new Date().toLocaleTimeString()
        }));
        onUpdateProfile?.(res.data);
        setShowEmailChangeSection(false);
        setEmailCodeSentInfo(null);
        setProfileFormData((prev) => ({
          ...prev,
          companyName: res.data.companyName,
          phone: res.data.phone,
          address: res.data.address,
          logoUrl: res.data.logoUrl || '',
          businessEmail: res.data.businessEmail,
          emailVerificationCode: ''
        }));
        setTimeout(() => {
          setProfileUpdateSuccess(null);
          setShowEditProfileModal(false);
        }, 1200);
      }
    } catch (err) {
      setProfileUpdateError(err.message || 'Failed to update company profile.');
      if (err.errors && Array.isArray(err.errors)) {
        setProfileUpdateValidationErrors(err.errors);
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleRequestVerificationCode = async () => {
    if (!newEmailToVerify.trim()) {
      setEmailCodeError('Please provide a valid new business email address.');
      return;
    }

    setIsRequestingEmailCode(true);
    setEmailCodeError(null);
    setEmailCodeSentInfo(null);

    try {
      const res = await requestEmailChange(newEmailToVerify.trim(), authUser?.accessToken);
      setEmailCodeSentInfo(res?.data || { verificationCode: '123456', newBusinessEmail: newEmailToVerify });
      setProfileFormData((prev) => ({
        ...prev,
        businessEmail: newEmailToVerify.trim(),
        emailVerificationCode: res?.data?.verificationCode || ''
      }));
    } catch (err) {
      setEmailCodeError(err.message || 'Failed to request email verification code.');
    } finally {
      setIsRequestingEmailCode(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e?.preventDefault();
    if (!verificationCodeInput.trim()) return;

    setIsVerifyingEmail(true);
    setVerifyEmailError(null);
    setVerifyEmailSuccess(null);

    try {
      const emailToVerify = profileResult?.data?.businessEmail || authUser?.businessEmail;
      const res = await verifyEmail(emailToVerify, verificationCodeInput.trim());
      setIsEmailVerified(true);
      setVerifyEmailSuccess(res?.message || 'Email verified successfully! Full platform access is now unlocked.');
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
      const emailToVerify = profileResult?.data?.businessEmail || authUser?.businessEmail;
      const res = await resendVerificationCode(emailToVerify);
      setResendStatusMsg(res?.message || 'A fresh 24-hour verification code has been dispatched to your email.');
    } catch (err) {
      setVerifyEmailError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleLogoutClick = () => {
    clearAuthSession();
    if (onLogout) {
      onLogout();
    }
  };

  const activeLogoUrl = profileResult?.data?.logoUrl || authUser?.logoUrl;
  const activeCompanyName = profileResult?.data?.companyName || authUser?.companyName || 'Enterprise Company';
  const activeBusinessEmail = profileResult?.data?.businessEmail || authUser?.businessEmail;
  const companyStatus = profileResult?.data?.status || authUser?.status || 'Pending';
  const isPendingApproval = companyStatus?.toLowerCase() === 'pending';

  const totalPortsCount = stations.reduce((acc, curr) => acc + (Number(curr.totalPorts) || 0), 0);
  const activeStationsCount = stations.filter((s) => s.status === 'Active').length;

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
                {activeLogoUrl ? (
                  <img
                    src={activeLogoUrl}
                    alt={`${activeCompanyName} Logo`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <Building2 size={34} color="#0284c7" />
                )}
              </div>

              <div className="dash-hero-meta">
                <div className="dash-badge-row">
                  <span className="badge badge-info" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', border: 'none' }}>
                    <ShieldCheck size={13} />
                    Authenticated Session
                  </span>
                  <span className="badge" style={{ background: '#10b981', color: '#ffffff' }}>
                    {isOperator ? 'Role: Operator (Restricted)' : 'Role: Company Admin'}
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
                  <span
                    className="badge"
                    style={{
                      background: isPendingApproval ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.3)',
                      color: '#ffffff',
                      border: isPendingApproval ? '1px solid #93c5fd' : '1px solid #10b981'
                    }}
                  >
                    {isPendingApproval ? <Clock size={13} /> : <CheckCircle2 size={13} />}
                    {isPendingApproval ? 'Pending Approval' : 'Approved'}
                  </span>
                </div>

                <h1 className="dash-title">{activeCompanyName}</h1>
                <p className="dash-subtitle">
                  <Mail size={15} /> {activeBusinessEmail}
                </p>
              </div>
            </div>

            <div className="dash-hero-actions">
              {isAdmin && (
                <button
                  type="button"
                  className="hero-btn"
                  onClick={() => {
                    setProfileUpdateError(null);
                    setProfileUpdateSuccess(null);
                    setProfileUpdateValidationErrors([]);
                    setProfileFormData({
                      companyName: profileResult?.data?.companyName || authUser?.companyName || '',
                      phone: profileResult?.data?.phone || authUser?.phone || '',
                      address: profileResult?.data?.address || authUser?.address || '',
                      logoUrl: profileResult?.data?.logoUrl || authUser?.logoUrl || '',
                      businessEmail: profileResult?.data?.businessEmail || authUser?.businessEmail || '',
                      emailVerificationCode: ''
                    });
                    setShowEditProfileModal(true);
                  }}
                >
                  <Edit3 size={15} />
                  <span>Edit Profile</span>
                </button>
              )}

              <button type="button" className="hero-btn" onClick={handleLogoutClick}>
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Tenant ID & Session Strip */}
          <div className="hero-id-strip">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ opacity: 0.85 }}>Scoped Tenant ID:</span>
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
                {authUser?.tenantId}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(authUser?.tenantId, 'tenant')}
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
                {copiedTenantId ? <Check size={12} color="#86efac" /> : <Copy size={12} />}
                {copiedTenantId ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div style={{ opacity: 0.9, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={14} />
              <span>Token Lifetime: {Math.round((authUser?.expiresIn || 3600) / 60)} mins ({authUser?.tokenType || 'Bearer'})</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Urgent Alerts / Notice Banners */}
        {/* ========================================================================= */}
        {isOperator && (
          <div className="alert alert-warning animate-fade-in" style={{ margin: 0 }}>
            <ShieldAlert size={20} />
            <div>
              <strong>Operator Account (Restricted Role)</strong>
              <p style={{ fontSize: '0.85rem', marginTop: '0.15rem' }}>
                You are logged in with the <strong>Operator</strong> role for Tenant <code>{authUser?.tenantId}</code>. You can monitor and add charging stations. Administrative actions (company deletion and billing management) are restricted to <strong>CompanyAdmin</strong>.
              </p>
            </div>
          </div>
        )}

        {isPendingApproval && (
          <div className="alert alert-info animate-fade-in" style={{ margin: 0 }}>
            <Clock size={20} />
            <div>
              <strong>Account Pending Platform Approval</strong>
              <p style={{ fontSize: '0.85rem', marginTop: '0.15rem' }}>
                Your company registration is under review by a platform administrator. Charging station provisioning will unlock as soon as your account is approved.
              </p>
            </div>
          </div>
        )}

        {!isEmailVerified && (
          <div className="alert alert-warning animate-fade-in" style={{ margin: 0, display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Please verify your business email address</strong>
                <p style={{ fontSize: '0.85rem', marginTop: '0.15rem' }}>
                  Full platform operations (charging station provisioning and tariff settings) are restricted until <strong>{activeBusinessEmail}</strong> is verified. Verification codes are valid for 24 hours.
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
        <nav className="dash-tabs-bar" aria-label="Dashboard navigation">
          <button
            type="button"
            className={`dash-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 size={16} />
            <span>Overview</span>
          </button>
          <button
            type="button"
            className={`dash-tab-btn ${activeTab === 'stations' ? 'active' : ''}`}
            onClick={() => setActiveTab('stations')}
          >
            <Zap size={16} />
            <span>Charging Stations</span>
            <span className="dash-tab-badge">{stations.length}</span>
          </button>
          <button
            type="button"
            className={`dash-tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={16} />
            <span>Team & Operators</span>
            <span className="dash-tab-badge">{staffList.length}</span>
          </button>
          <button
            type="button"
            className={`dash-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <CreditCard size={16} />
            <span>Billing & Plan</span>
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
            <span>Settings & Profile</span>
          </button>
        </nav>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & KPIS */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* KPI Summary Cards */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-blue">
                  <Zap size={26} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Charging Stations</div>
                  <div className="kpi-value">{stations.length}</div>
                  <div className="kpi-subtext">
                    <span style={{ color: '#15803d', fontWeight: 600 }}>{activeStationsCount} Online</span> • {stations.length - activeStationsCount} Inactive
                  </div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-green">
                  <Layers size={26} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Total Ports</div>
                  <div className="kpi-value">{totalPortsCount}</div>
                  <div className="kpi-subtext">Provisioned across network</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-purple">
                  <Users size={26} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Staff & Operators</div>
                  <div className="kpi-value">{staffList.length}</div>
                  <div className="kpi-subtext">Tenant scoped users</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-box kpi-icon-amber">
                  <ShieldCheck size={26} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Account Status</div>
                  <div className="kpi-value" style={{ fontSize: '1.25rem' }}>
                    {isPendingApproval ? 'Pending Review' : 'Active Approved'}
                  </div>
                  <div className="kpi-subtext">
                    {isEmailVerified ? 'Email Confirmed' : 'Verification Required'}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Profile Summary & Stations Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {/* Organization Overview */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">
                      <Building2 size={18} color="var(--primary-600)" />
                      Organization Profile
                    </h3>
                    <p className="dash-card-subtitle">Registered tenant credentials</p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      onClick={() => setShowEditProfileModal(true)}
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Company Name:</span>
                    <strong style={{ color: 'var(--text-main)' }}>{activeCompanyName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Registration Number:</span>
                    <strong>{profileResult?.data?.registrationNumber || 'Pending'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Contact Phone:</span>
                    <span>{profileResult?.data?.phone || authUser?.phone || 'Not provided'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Registered Address:</span>
                    <span>{profileResult?.data?.address || authUser?.address || 'Not provided'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Data Isolation Scope:</span>
                    <span className="badge badge-info">Tenant {authUser?.tenantId}</span>
                  </div>
                </div>
              </div>

              {/* Station Quick View */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">
                      <Zap size={18} color="var(--primary-600)" />
                      Recent Charging Stations
                    </h3>
                    <p className="dash-card-subtitle">{stations.length} total stations registered</p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => setActiveTab('stations')}
                  >
                    View All
                  </button>
                </div>

                {stations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {stations.slice(0, 3).map((stn) => (
                      <div
                        key={stn.stationId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          background: 'var(--bg-page)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{stn.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{stn.location}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="badge badge-success">{stn.totalPorts} Ports</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <Zap size={30} color="var(--text-light)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                    No charging stations created yet.
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="submit-btn"
                        style={{ width: 'auto', margin: '0 auto', padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                        onClick={() => {
                          setActiveTab('stations');
                          setShowAddStation(true);
                        }}
                      >
                        <Plus size={14} />
                        Add First Station
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CHARGING STATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'stations' && (
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h3 className="dash-card-title">
                  <Zap size={18} color="var(--primary-600)" />
                  Tenant-Isolated Charging Stations
                </h3>
                <p className="dash-card-subtitle">
                  Strictly scoped via ADO.NET SQL parameter binding: <code>WHERE tenant_id = @tenant_id</code>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={loadStations}
                  disabled={loadingStations}
                  className="btn-secondary"
                >
                  <RefreshCw size={14} className={loadingStations ? 'spinner' : ''} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isEmailVerified || isPendingApproval) return;
                    setShowAddStation(!showAddStation);
                  }}
                  disabled={!isEmailVerified || isPendingApproval}
                  className="submit-btn"
                  style={{
                    width: 'auto',
                    margin: 0,
                    padding: '0.55rem 1.1rem',
                    fontSize: '0.85rem',
                    opacity: !isEmailVerified || isPendingApproval ? 0.6 : 1,
                    cursor: !isEmailVerified || isPendingApproval ? 'not-allowed' : 'pointer'
                  }}
                >
                  {!isEmailVerified || isPendingApproval ? <Lock size={14} /> : <Plus size={14} />}
                  <span>{showAddStation ? 'Cancel Form' : 'Add Charging Station'}</span>
                </button>
              </div>
            </div>

            {stationSuccessMsg && (
              <div className="alert alert-success">
                <CheckCircle2 size={18} />
                <span>{stationSuccessMsg}</span>
              </div>
            )}

            {stationError && (
              <div className="alert alert-danger">
                <AlertTriangle size={18} />
                <span>{stationError}</span>
              </div>
            )}

            {/* Add Station Inline Form */}
            {showAddStation && (
              <form
                onSubmit={handleCreateStation}
                className="animate-fade-in"
                style={{
                  background: 'var(--primary-50)',
                  border: '1px solid var(--primary-200)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem'
                }}
              >
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-900)', marginBottom: '1rem' }}>
                  Register New Station (Auto-bound to Tenant ID: {authUser?.tenantId})
                </h4>

                <div className="form-grid" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Station Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GreenPulse Downtown Hub"
                      value={stationForm.name}
                      onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Location / Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 500 Market St, Financial District"
                      value={stationForm.location}
                      onChange={(e) => setStationForm({ ...stationForm, location: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Ports *</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={stationForm.totalPorts}
                      onChange={(e) => setStationForm({ ...stationForm, totalPorts: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddStation(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingStation}
                    className="submit-btn"
                    style={{ width: 'auto', margin: 0, padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                  >
                    {isSubmittingStation ? <RefreshCw size={14} className="spinner" /> : <Plus size={14} />}
                    <span>Save Station</span>
                  </button>
                </div>
              </form>
            )}

            {/* Stations Table */}
            {loadingStations ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <RefreshCw size={24} className="spinner" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading stations from database...</p>
              </div>
            ) : stations.length > 0 ? (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Station ID</th>
                      <th>Name</th>
                      <th>Location</th>
                      <th>Ports</th>
                      <th>Status</th>
                      <th>Tenant Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stations.map((stn) => (
                      <tr key={stn.stationId}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-700)' }}>
                          {stn.stationId}
                        </td>
                        <td style={{ fontWeight: 600 }}>{stn.name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{stn.location}</td>
                        <td>{stn.totalPorts} ports</td>
                        <td>
                          <span className="badge badge-success">{stn.status}</span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#0369a1' }}>
                          {stn.tenantId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-page)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
                <Zap size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>No charging stations registered for this tenant yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Click "Add Charging Station" above to create your first tenant-isolated asset.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TEAM & STAFF */}
        {/* ========================================================================= */}
        {activeTab === 'staff' && (
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h3 className="dash-card-title">
                  <Users size={18} color="var(--primary-600)" />
                  Company Staff & Operator Accounts
                </h3>
                <p className="dash-card-subtitle">
                  Manage staff members with the restricted <strong>Operator</strong> role scoped to Tenant <code>{authUser?.tenantId}</code>.
                </p>
              </div>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setStaffModalError(null);
                    setStaffFormData({ name: '', email: '', password: '', phone: '', role: 'Operator' });
                    setShowInviteStaffModal(true);
                  }}
                  className="submit-btn"
                  style={{ width: 'auto', margin: 0, padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
                >
                  <UserPlus size={15} />
                  <span>Invite Staff Member</span>
                </button>
              ) : (
                <span className="badge badge-warning">
                  <Lock size={13} />
                  Staff management restricted to Admin
                </span>
              )}
            </div>

            {staffSuccess && (
              <div className="alert alert-success">
                <CheckCircle2 size={16} />
                <span>{staffSuccess}</span>
              </div>
            )}

            {staffError && (
              <div className="alert alert-danger">
                <AlertTriangle size={16} />
                <span>{staffError}</span>
              </div>
            )}

            {loadingStaff ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <RefreshCw size={24} className="spinner" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading staff accounts...</p>
              </div>
            ) : staffList.length > 0 ? (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Email</th>
                      <th>Role Claim</th>
                      <th>Status</th>
                      <th>Invited / Created</th>
                      {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((member) => (
                      <tr key={member.userId}>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'var(--primary-100)',
                                color: 'var(--primary-700)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                              }}
                            >
                              {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div>{member.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {member.userId}</div>
                            </div>
                          </div>
                        </td>
                        <td>{member.email}</td>
                        <td>
                          <span className="badge badge-warning">{member.role || 'Operator'}</span>
                        </td>
                        <td>
                          <span className={member.status === 'Active' ? 'badge badge-success' : 'badge badge-danger'}>
                            ● {member.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleStaffStatus(member)}
                              className={member.status === 'Active' ? 'btn-danger' : 'btn-secondary'}
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                            >
                              {member.status === 'Active' ? <UserX size={13} /> : <UserCheck size={13} />}
                              <span>{member.status === 'Active' ? 'Deactivate' : 'Reactivate'}</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-page)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
                <Users size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>No staff accounts created yet for this tenant.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {isAdmin ? 'Invite team members to provide restricted operator access to platform management.' : 'Staff members will appear here once invited.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: BILLING & PLAN */}
        {/* ========================================================================= */}
        {activeTab === 'billing' && (
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h3 className="dash-card-title">
                  <CreditCard size={18} color="var(--primary-600)" />
                  Company Billing & Subscription Tier
                </h3>
                <p className="dash-card-subtitle">Organization payment method, invoicing cycle, and enterprise billing plan.</p>
              </div>

              {!isAdmin && (
                <span className="badge badge-danger">
                  <Lock size={13} />
                  Billing restricted to Admin
                </span>
              )}
            </div>

            {isAdmin ? (
              <div
                style={{
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1.5rem'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    CURRENT PLAN
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {billingInfo?.plan || 'Enterprise Scale'}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: '#15803d', fontWeight: 600, marginTop: '0.25rem' }}>
                    ● Active Subscription
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    BILLING EMAIL
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {billingInfo?.billingEmail || activeBusinessEmail}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    PAYMENT METHOD
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {billingInfo?.paymentMethod || 'Corporate Visa **** 4242'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    MONTHLY RATE
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                    $499.00 / mo
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--danger-50)', border: '1px dashed #fca5a5', borderRadius: '8px' }}>
                <Lock size={28} color="#dc2626" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ fontWeight: 700, color: '#991b1b', margin: 0 }}>Restricted Permission</p>
                <p style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: '0.25rem' }}>
                  Staff members with the <strong>Operator</strong> role are restricted from viewing or managing corporate billing and payment methods.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: SECURITY & DEVELOPER SANDBOX */}
        {/* ========================================================================= */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Cross-Tenant Access Simulator */}
            <div className="dash-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title" style={{ color: '#dc2626' }}>
                    <ShieldAlert size={20} color="#dc2626" />
                    Security Audit: Cross-Tenant Isolation Simulator
                  </h3>
                  <p className="dash-card-subtitle">
                    Verify multi-tenant boundary: requesting another tenant's data must trigger an immediate <strong>HTTP 403 Forbidden</strong>.
                  </p>
                </div>
              </div>

              <div style={{ background: 'var(--danger-50)', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.3rem' }}>
                      Foreign Target Tenant ID:
                    </label>
                    <input
                      type="text"
                      value={unauthorizedTenantId}
                      onChange={(e) => setUnauthorizedTenantId(e.target.value)}
                      placeholder="e.g. TNT-UNAUTHORIZED-CORP-999"
                      className="form-input"
                      style={{ paddingLeft: '0.85rem', fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateCrossTenant}
                    disabled={isTestingCrossTenant || !unauthorizedTenantId.trim()}
                    className="submit-btn"
                    style={{ width: 'auto', margin: 0, padding: '0.55rem 1.25rem', background: '#dc2626', fontSize: '0.85rem' }}
                  >
                    {isTestingCrossTenant ? <RefreshCw size={14} className="spinner" /> : <ShieldAlert size={14} />}
                    <span>Simulate Cross-Tenant Call</span>
                  </button>
                </div>
              </div>

              {crossTenantResult && (
                <div
                  className="alert"
                  style={{
                    margin: 0,
                    background: crossTenantResult.status === 403 ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${crossTenantResult.status === 403 ? '#f87171' : '#86efac'}`
                  }}
                >
                  {crossTenantResult.status === 403 ? <CheckCircle2 size={18} color="#dc2626" /> : <AlertTriangle size={18} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong style={{ color: crossTenantResult.status === 403 ? '#b91c1c' : '#15803d' }}>
                        {crossTenantResult.status === 403 ? 'HTTP 403 Forbidden (Isolation Confirmed)' : 'Failed: Allowed'}
                      </strong>
                      <span className="badge" style={{ background: crossTenantResult.status === 403 ? '#fee2e2' : '#dcfce7', color: crossTenantResult.status === 403 ? '#b91c1c' : '#15803d' }}>
                        Status: {crossTenantResult.status} | {crossTenantResult.latencyMs}ms
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: crossTenantResult.status === 403 ? '#991b1b' : '#166534', margin: 0 }}>
                      {crossTenantResult.message}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* RBAC Security Access Simulator */}
            <div className="dash-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">
                    <Lock size={18} color="#d97706" />
                    Role-Based Access Control (RBAC) Cross-Role Simulator
                  </h3>
                  <p className="dash-card-subtitle">
                    Sends this Company token to driver-only endpoint (<code>GET /api/driver/wallet</code>). Backend middleware must reject with <strong>403 Forbidden</strong>.
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
                  <span>Test Cross-Role RBAC</span>
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
                        {rbacResult.status === 403 ? 'HTTP 403 Forbidden (RBAC Enforcement Verified)' : 'Access Granted'}
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

            {/* Protected API Token Validation & JWT Raw String */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {/* Protected API Check */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">
                      <Server size={18} color="var(--primary-600)" />
                      Protected API Validation
                    </h3>
                    <p className="dash-card-subtitle">Tests signed Bearer token against profile endpoint</p>
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
                      <span>HTTP 200 OK — Token Verified</span>
                      <span>{profileResult.latencyMs}ms</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Timestamp: {profileResult.timestamp}
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

              {/* JWT Raw String */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">
                      <Key size={18} color="var(--primary-600)" />
                      Signed JWT Bearer
                    </h3>
                    <p className="dash-card-subtitle">Active cryptographically signed token</p>
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
        {/* TAB 6: SETTINGS & PROFILE */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Organization Settings */}
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">
                    <Building2 size={18} color="var(--primary-600)" />
                    Company Identity & Brand
                  </h3>
                  <p className="dash-card-subtitle">Manage organization name, logo URL, contact numbers and registered address.</p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    className="submit-btn"
                    style={{ width: 'auto', margin: 0, padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}
                    onClick={() => setShowEditProfileModal(true)}
                  >
                    <Edit3 size={14} />
                    <span>Edit Profile Form</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="dash-avatar" style={{ width: '60px', height: '60px' }}>
                    {activeLogoUrl ? (
                      <img src={activeLogoUrl} alt="Logo" />
                    ) : (
                      <Building2 size={28} color="var(--primary-600)" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{activeCompanyName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tenant ID: {authUser?.tenantId}</div>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>BUSINESS EMAIL</span>
                  <span style={{ fontWeight: 600 }}>{activeBusinessEmail}</span>
                  <span className="badge badge-success" style={{ marginTop: '0.25rem', display: 'inline-flex' }}>
                    <Lock size={10} /> Verified
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>PHONE NUMBER</span>
                  <span style={{ fontWeight: 600 }}>{profileResult?.data?.phone || authUser?.phone || 'Not provided'}</span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>ADDRESS</span>
                  <span style={{ fontWeight: 600 }}>{profileResult?.data?.address || authUser?.address || 'Not provided'}</span>
                </div>
              </div>
            </div>

            {/* Danger Zone: Company Account Deletion */}
            <div className="dash-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="dash-card-header" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                <div>
                  <h3 className="dash-card-title" style={{ color: '#dc2626' }}>
                    <Trash2 size={18} color="#dc2626" />
                    Danger Zone: Company Workspace Deletion
                  </h3>
                  <p className="dash-card-subtitle">
                    Permanently delete organization workspace, stations, staff operator records, and tokens.
                  </p>
                </div>

                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-danger"
                  >
                    <Trash2 size={14} />
                    <span>Delete Company</span>
                  </button>
                ) : (
                  <span className="badge badge-danger">
                    <Lock size={12} />
                    Admin Only
                  </span>
                )}
              </div>

              {deleteCompanyMsg && (
                <div className="alert alert-danger" style={{ marginTop: '1rem', margin: 0 }}>
                  {deleteCompanyMsg}
                </div>
              )}
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
                  <Building2 size={20} color="var(--primary-600)" />
                  Edit Company Profile & Brand
                </h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowEditProfileModal(false)}>
                  <X size={20} />
                </button>
              </div>

              {profileUpdateSuccess && (
                <div className="alert alert-success">
                  <CheckCircle2 size={16} />
                  <span>{profileUpdateSuccess}</span>
                </div>
              )}

              {profileUpdateError && (
                <div className="alert alert-danger">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Update Failed:</strong> {profileUpdateError}
                    {profileUpdateValidationErrors?.length > 0 && (
                      <ul style={{ marginTop: '0.25rem', paddingLeft: '1.2rem', fontSize: '0.8rem' }}>
                        {profileUpdateValidationErrors.map((err, idx) => (
                          <li key={`profile-val-err-${idx}`}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Business / Company Name *</label>
                  <input
                    type="text"
                    required
                    value={profileFormData.companyName}
                    onChange={(e) => setProfileFormData({ ...profileFormData, companyName: e.target.value })}
                    className="form-input"
                    style={{ paddingLeft: '0.85rem' }}
                    placeholder="e.g. GreenDrive Energy Inc."
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      value={profileFormData.phone}
                      onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                      placeholder="+1 555 123 4567"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Registered Address *</label>
                    <input
                      type="text"
                      required
                      value={profileFormData.address}
                      onChange={(e) => setProfileFormData({ ...profileFormData, address: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem' }}
                      placeholder="100 Clean Energy Blvd"
                    />
                  </div>
                </div>

                {/* Logo Presets & Custom URL */}
                <div style={{ background: 'var(--bg-page)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                    <ImageIcon size={16} color="var(--primary-600)" />
                    Company Logo URL
                  </label>

                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                    {PRESET_LOGOS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setProfileFormData({ ...profileFormData, logoUrl: preset.url })}
                        style={{
                          background: profileFormData.logoUrl === preset.url ? 'var(--primary-600)' : '#ffffff',
                          color: profileFormData.logoUrl === preset.url ? '#ffffff' : 'var(--text-main)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Sparkles size={11} />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <input
                      type="url"
                      value={profileFormData.logoUrl || ''}
                      onChange={(e) => setProfileFormData({ ...profileFormData, logoUrl: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '0.85rem', flex: 1 }}
                      placeholder="https://example.com/logo.png"
                    />
                    <div className="dash-avatar" style={{ width: '40px', height: '40px' }}>
                      {profileFormData.logoUrl ? (
                        <img src={profileFormData.logoUrl} alt="Preview" />
                      ) : (
                        <Building2 size={18} color="var(--text-muted)" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Email Change Section */}
                <div style={{ background: 'var(--primary-50)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--primary-200)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-900)' }}>
                      Business Email Re-Verification
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEmailChangeSection(!showEmailChangeSection)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-700)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {showEmailChangeSection ? 'Cancel Email Change' : 'Change Email Address'}
                    </button>
                  </div>

                  {showEmailChangeSection ? (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="email"
                          placeholder="New verified email"
                          value={newEmailToVerify}
                          onChange={(e) => setNewEmailToVerify(e.target.value)}
                          className="form-input"
                          style={{ paddingLeft: '0.85rem', flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={handleRequestVerificationCode}
                          disabled={isRequestingEmailCode || !newEmailToVerify.trim()}
                          className="btn-secondary"
                          style={{ fontSize: '0.8rem' }}
                        >
                          <Send size={13} className={isRequestingEmailCode ? 'spinner' : ''} />
                          <span>{isRequestingEmailCode ? 'Sending...' : 'Get Code'}</span>
                        </button>
                      </div>

                      {emailCodeError && (
                        <div style={{ color: '#b91c1c', fontSize: '0.8rem' }}>⚠️ {emailCodeError}</div>
                      )}

                      {emailCodeSentInfo && (
                        <div style={{ background: '#ecfdf5', padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', color: '#065f46' }}>
                          Verification Code: <strong>{emailCodeSentInfo.verificationCode}</strong> (Valid 15m)
                        </div>
                      )}

                      <input
                        type="text"
                        placeholder="Enter 6-digit verification code"
                        maxLength={10}
                        value={profileFormData.emailVerificationCode}
                        onChange={(e) => setProfileFormData({ ...profileFormData, emailVerificationCode: e.target.value })}
                        className="form-input"
                        style={{ paddingLeft: '0.85rem', fontFamily: 'monospace' }}
                      />
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Current: <strong>{profileFormData.businessEmail}</strong>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowEditProfileModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="submit-btn"
                    style={{ width: 'auto', margin: 0, padding: '0.55rem 1.4rem', fontSize: '0.875rem' }}
                  >
                    {isUpdatingProfile ? <RefreshCw size={14} className="spinner" /> : <Check size={14} />}
                    <span>{isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* INVITE STAFF MODAL */}
        {/* ========================================================================= */}
        {showInviteStaffModal && (
          <div className="modal-backdrop">
            <div className="modal-dialog">
              <div className="modal-header">
                <h3 className="modal-title">
                  <UserPlus size={20} color="var(--primary-600)" />
                  Invite Staff Member
                </h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowInviteStaffModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Staff members are scoped strictly to Tenant <strong>{authUser?.tenantId}</strong> and are granted the restricted <strong>Operator</strong> role.
              </p>

              {staffModalError && (
                <div className="alert alert-danger">
                  <AlertTriangle size={16} />
                  <span>{staffModalError}</span>
                </div>
              )}

              <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Rivera"
                    value={staffFormData.name}
                    onChange={(e) => setStaffFormData({ ...staffFormData, name: e.target.value })}
                    className="form-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Business Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="alex.rivera@company.com"
                    value={staffFormData.email}
                    onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                    className="form-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password * (Min 6 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Set initial password"
                    value={staffFormData.password}
                    onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
                    className="form-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="+1-555-0199"
                    value={staffFormData.phone}
                    onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                    className="form-input"
                    style={{ paddingLeft: '0.85rem' }}
                  />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowInviteStaffModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingStaff}
                    className="submit-btn"
                    style={{ width: 'auto', margin: 0, padding: '0.55rem 1.3rem', fontSize: '0.875rem' }}
                  >
                    {isSubmittingStaff ? <RefreshCw size={14} className="spinner" /> : <UserPlus size={14} />}
                    <span>{isSubmittingStaff ? 'Inviting...' : 'Invite Staff'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE CONFIRMATION MODAL */}
        {/* ========================================================================= */}
        {showDeleteConfirm && (
          <div className="modal-backdrop">
            <div className="modal-dialog" style={{ maxWidth: '460px', border: '2px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: '#fee2e2', padding: '0.6rem', borderRadius: '10px', color: '#dc2626' }}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#dc2626' }}>
                    Delete Company Workspace?
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Are you sure you want to delete company <strong>{activeCompanyName}</strong> (Tenant ID: <code>{authUser?.tenantId}</code>)? All charging stations, staff operator accounts, and configurations will be permanently purged.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingCompany}
                  onClick={handleDeleteCompany}
                  className="btn-danger"
                  style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '0.55rem 1.25rem' }}
                >
                  {isDeletingCompany ? <RefreshCw size={14} className="spinner" /> : <Trash2 size={14} />}
                  <span>{isDeletingCompany ? 'Deleting...' : 'Yes, Delete Account'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
