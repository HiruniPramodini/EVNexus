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
  ExternalLink,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  CreditCard,
  Trash2
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
  const [billingMsg, setBillingMsg] = useState(null);

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
        setStaffList(prev => [res.data, ...prev]);
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
        setStaffList(prev => prev.map(s => s.userId === staffMember.userId ? res.data : s));
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
      const res = await createCompanyStation({
        name: stationForm.name,
        location: stationForm.location,
        totalPorts: Number(stationForm.totalPorts) || 1
      }, authUser?.accessToken);

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
        }, 1500);
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

  const getAddStationButtonText = () => {
    if (showAddStation) return 'Cancel';
    if (isPendingApproval) return 'Locked (Pending Approval)';
    if (!isEmailVerified) return 'Locked (Verify Email)';
    return 'Add Station';
  };

  return (
    <div className="main-content" style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Top Banner */}
      <div
        className="register-card"
        style={{
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #1e40af 100%)',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.3)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Company Logo / Avatar */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '14px',
                background: '#ffffff',
                border: '2px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              {activeLogoUrl ? (
                <img
                  src={activeLogoUrl}
                  alt={`${activeCompanyName} Logo`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <Building2 size={32} color="#0284c7" />
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
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
                    gap: '0.3rem'
                  }}
                >
                  <ShieldCheck size={13} />
                  Authenticated Session
                </span>
                <span
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}
                >
                  {authUser?.role || 'CompanyAdmin'}
                </span>
                <span
                  style={{
                    background: isEmailVerified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                    color: '#ffffff',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    border: isEmailVerified ? '1px solid #10b981' : '1px solid #f59e0b'
                  }}
                >
                  {isEmailVerified ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {isEmailVerified ? 'Email Verified' : 'Unverified Email'}
                </span>
                <span
                  style={{
                    background: isPendingApproval ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.3)',
                    color: '#ffffff',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    border: isPendingApproval ? '1px solid #93c5fd' : '1px solid #10b981'
                  }}
                >
                  {isPendingApproval ? <Clock size={13} /> : <CheckCircle2 size={13} />}
                  {isPendingApproval ? 'Status: Pending Approval' : 'Status: Approved'}
                </span>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <Layers size={13} />
                  Multi-Tenant Scoped
                </span>
                <span
                  style={{
                    background: isOperator ? 'rgba(245, 158, 11, 0.45)' : 'rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    border: isOperator ? '1px solid #fde68a' : '1px solid rgba(255, 255, 255, 0.35)'
                  }}
                >
                  <ShieldCheck size={13} />
                  {isOperator ? 'Role: Operator (Restricted)' : 'Role: Company Admin'}
                </span>
              </div>
              <h1 style={{ color: '#ffffff', fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                {activeCompanyName}
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Mail size={15} /> {activeBusinessEmail}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {isAdmin && (
              <button
                type="button"
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
                style={{
                  background: 'rgba(255, 255, 255, 0.22)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  color: '#ffffff',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <Edit3 size={15} />
                <span>Edit Profile</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogoutClick}
              className="header-logout-btn"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s ease'
              }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Restricted Permissions Banner for Operator Accounts */}
      {isOperator && (
        <div
          className="register-card animate-fade-in"
          style={{
            marginBottom: '1.5rem',
            border: '1px solid #fde68a',
            background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, rgba(253, 230, 138, 0.25) 100%)',
            padding: '1rem 1.25rem',
            boxShadow: '0 4px 12px rgba(217, 119, 6, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ background: '#fef3c7', padding: '0.5rem', borderRadius: '10px', color: '#b45309' }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: '#92400e' }}>
                Operator Account — Restricted Role
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#b45309', marginTop: '0.25rem', lineHeight: 1.4 }}>
                You are logged in with the <strong>Operator</strong> role scoped to Tenant <strong>{authUser?.tenantId}</strong>. You have permissions to monitor and manage charging stations and operations. Administrative actions (company deletion and billing management) are restricted to <strong>CompanyAdmin</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Acceptance Criteria 3: Pending Approval Banner */}
      {isPendingApproval && (
        <div
          className="register-card animate-fade-in"
          style={{
            marginBottom: '1.5rem',
            border: '2px solid #3b82f6',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.04) 100%)',
            boxShadow: '0 8px 24px -4px rgba(59, 130, 246, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Clock size={26} />
            </div>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: '#1e40af' }}>
                  Account Pending Approval
                </h3>
                <span
                  style={{
                    background: '#3b82f6',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  Pending Admin Review
                </span>
              </div>
              <p style={{ margin: '0.4rem 0 0', color: '#1e3a8a', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Your company registration is currently <strong>Pending Approval</strong> by a platform administrator. Charging station creation is restricted until your account has been reviewed and approved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Acceptance Criteria 2: Unverified Account Prompt & Restriction Banner */}
      {!isEmailVerified && (
        <div
          className="register-card animate-fade-in"
          style={{
            marginBottom: '1.5rem',
            border: '2px solid #f59e0b',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%)',
            boxShadow: '0 8px 24px -4px rgba(245, 158, 11, 0.2)'
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
                  Please verify your business email
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
                  Full Platform Access Restricted
                </span>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #4b5563)', marginBottom: '1rem', lineHeight: 1.5 }}>
                Your company workspace is active, but full platform operations (provisioning charging stations, tariff customization, fleet invoicing) are restricted until <strong>{activeBusinessEmail}</strong> is verified. Verification codes are valid for 24 hours.
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

      {/* Grid of Key Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Tenant ID Card */}
        <div className="register-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'var(--primary-100)', color: 'var(--primary-700)', padding: '0.5rem', borderRadius: '8px' }}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Active Tenant ID</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Automatic ADO.NET data scope</p>
            </div>
          </div>

          <div
            style={{
              background: 'var(--primary-50)',
              border: '1px solid var(--primary-200)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}
          >
            <code style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--primary-800)', letterSpacing: '0.04em' }}>
              {authUser?.tenantId}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(authUser?.tenantId, 'tenant')}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--primary-300)',
                color: 'var(--primary-700)',
                padding: '0.35rem 0.6rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}
            >
              {copiedTenantId ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copiedTenantId ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Token Expiry Card */}
        <div className="register-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'var(--primary-100)', color: 'var(--primary-700)', padding: '0.5rem', borderRadius: '8px' }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>JWT Session Expiration</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configurable lifetime</p>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.9rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Lifetime:</span>
              <strong style={{ color: 'var(--text-main)' }}>{Math.round((authUser?.expiresIn || 3600) / 60)} minutes</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Token Type:</span>
              <strong style={{ color: 'var(--primary-700)' }}>{authUser?.tokenType || 'Bearer'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Company Business Profile & Brand Identity Card */}
      <div className="register-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--primary-100)', color: 'var(--primary-700)', padding: '0.6rem', borderRadius: '10px' }}>
              <Building2 size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>
                Company Profile & Business Details
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Manage verified organization identity, contact credentials, and brand logo.
              </p>
            </div>
          </div>

          <button
            type="button"
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
            className="submit-btn"
            style={{ width: 'auto', padding: '0.55rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <Edit3 size={15} />
            <span>Edit Profile Details</span>
          </button>
        </div>

        {/* Profile Content Showcase */}
        <div
          style={{
            background: 'var(--bg-page)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            alignItems: 'center'
          }}
        >
          {/* Brand Logo & Name Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '16px',
                background: '#ffffff',
                border: '2px solid var(--border-subtle)',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              {activeLogoUrl ? (
                <img
                  src={activeLogoUrl}
                  alt={`${activeCompanyName} Brand`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <Building2 size={36} color="var(--primary-600)" />
              )}
            </div>

            <div>
              <span
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  display: 'inline-block',
                  marginBottom: '0.35rem'
                }}
              >
                ● Active Profile
              </span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                {activeCompanyName}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Reg #: <strong style={{ color: 'var(--text-main)' }}>{profileResult?.data?.registrationNumber || 'Pending'}</strong>
              </p>
            </div>
          </div>

          {/* Contact Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.15rem' }}>
                BUSINESS EMAIL
              </span>
              <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} color="var(--primary-600)" />
                {activeBusinessEmail}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.15rem' }}>
                <Lock size={11} /> Verified (Requires re-verification to change)
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.15rem' }}>
                PHONE NUMBER
              </span>
              <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={14} color="var(--primary-600)" />
                {profileResult?.data?.phone || authUser?.phone || 'Not provided'}
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.15rem' }}>
                REGISTERED ADDRESS
              </span>
              <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={14} color="var(--primary-600)" />
                {profileResult?.data?.address || authUser?.address || 'Not provided'}
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.15rem' }}>
                LAST PROFILE UPDATE
              </span>
              <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>
                {profileResult?.data?.updatedAt ? new Date(profileResult.data.updatedAt).toLocaleString() : 'Just now'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal Dialog */}
      {showEditProfileModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="register-card"
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 0,
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Building2 size={20} color="var(--primary-600)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0 }}>
                  Edit Company Profile & Brand
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Success Alert */}
            {profileUpdateSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                <CheckCircle2 size={18} className="alert-icon" />
                <div className="alert-body">
                  <strong>Success</strong>
                  <p style={{ fontSize: '0.85rem' }}>{profileUpdateSuccess}</p>
                </div>
              </div>
            )}

            {/* Error Alert */}
            {profileUpdateError && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                <AlertTriangle size={18} className="alert-icon" />
                <div className="alert-body">
                  <strong>Update Failed</strong>
                  <p style={{ fontSize: '0.85rem' }}>{profileUpdateError}</p>
                  {profileUpdateValidationErrors?.length > 0 && (
                    <ul style={{ marginTop: '0.35rem', paddingLeft: '1.2rem', fontSize: '0.8rem' }}>
                      {profileUpdateValidationErrors.map((err, idx) => (
                        <li key={`profile-val-err-${idx}`}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveProfile}>
              {/* Company Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                  Business / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={profileFormData.companyName}
                  onChange={(e) => setProfileFormData({ ...profileFormData, companyName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
                  placeholder="e.g. GreenDrive Energy Inc."
                />
              </div>

              {/* Phone and Address */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={profileFormData.phone}
                    onChange={(e) => setProfileFormData({ ...profileFormData, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
                    placeholder="+1 555 123 4567"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.35rem' }}>
                    Registered Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileFormData.address}
                    onChange={(e) => setProfileFormData({ ...profileFormData, address: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
                    placeholder="100 Clean Energy Blvd, Austin, TX"
                  />
                </div>
              </div>

              {/* Company Logo and Presets */}
              <div style={{ marginBottom: '1.25rem', background: 'var(--bg-page)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ImageIcon size={16} color="var(--primary-600)" />
                    Company Logo URL
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Paste URL or click preset</span>
                </div>

                {/* Preset Logo Badges */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                  {PRESET_LOGOS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setProfileFormData({ ...profileFormData, logoUrl: preset.url })}
                      style={{
                        background: profileFormData.logoUrl === preset.url ? 'var(--primary-600)' : 'var(--bg-card)',
                        color: profileFormData.logoUrl === preset.url ? '#ffffff' : 'var(--text-main)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Sparkles size={12} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="url"
                    value={profileFormData.logoUrl || ''}
                    onChange={(e) => setProfileFormData({ ...profileFormData, logoUrl: e.target.value })}
                    style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                    placeholder="https://example.com/logo.png"
                  />
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    {profileFormData.logoUrl ? (
                      <img
                        src={profileFormData.logoUrl}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <Building2 size={20} color="var(--text-muted)" />
                    )}
                  </div>
                </div>
              </div>

              {/* Business Email with Re-verification Security Protection */}
              <div
                style={{
                  marginBottom: '1.25rem',
                  background: 'rgba(2, 132, 199, 0.05)',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                  borderRadius: '10px',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Lock size={14} color="#0284c7" />
                    Business Email (Protected)
                  </label>
                  <span
                    style={{
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px'
                    }}
                  >
                    🔒 Re-Verification Enforced
                  </span>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                  Business email cannot be changed without re-verification. An authorization code is required.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="email"
                    readOnly={!showEmailChangeSection}
                    disabled={!showEmailChangeSection}
                    value={profileFormData.businessEmail}
                    onChange={(e) => setProfileFormData({ ...profileFormData, businessEmail: e.target.value })}
                    style={{
                      flex: 1,
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: showEmailChangeSection ? '#ffffff' : 'rgba(0,0,0,0.03)',
                      color: showEmailChangeSection ? 'var(--text-main)' : 'var(--text-muted)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailChangeSection(!showEmailChangeSection);
                      setEmailCodeSentInfo(null);
                      setEmailCodeError(null);
                    }}
                    style={{
                      background: showEmailChangeSection ? 'transparent' : 'var(--primary-50)',
                      border: '1px solid var(--primary-200)',
                      color: 'var(--primary-700)',
                      padding: '0.55rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {showEmailChangeSection ? 'Cancel Email Change' : 'Change Email...'}
                  </button>
                </div>

                {/* Email Re-verification Flow Section */}
                {showEmailChangeSection && (
                  <div
                    style={{
                      marginTop: '0.9rem',
                      padding: '0.9rem',
                      background: '#ffffff',
                      border: '1px dashed #0284c7',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0369a1', marginBottom: '0.5rem' }}>
                      Step 1: Request Verification Code for New Business Email
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
                      <input
                        type="email"
                        placeholder="new.email@company.com"
                        value={newEmailToVerify}
                        onChange={(e) => setNewEmailToVerify(e.target.value)}
                        style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                      />
                      <button
                        type="button"
                        disabled={isRequestingEmailCode}
                        onClick={handleRequestVerificationCode}
                        style={{
                          background: 'var(--primary-600)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Send size={13} className={isRequestingEmailCode ? 'btn-spinner' : ''} />
                        <span>{isRequestingEmailCode ? 'Generating...' : 'Get Code'}</span>
                      </button>
                    </div>

                    {emailCodeError && (
                      <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        ⚠️ {emailCodeError}
                      </div>
                    )}

                    {emailCodeSentInfo && (
                      <div
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          borderRadius: '6px',
                          padding: '0.6rem',
                          fontSize: '0.8rem',
                          color: '#065f46',
                          marginBottom: '0.6rem'
                        }}
                      >
                        <strong>Verification Code Generated:</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <code style={{ fontSize: '1rem', fontWeight: '700', color: '#047857', letterSpacing: '0.1em' }}>
                            {emailCodeSentInfo.verificationCode}
                          </code>
                          <span style={{ fontSize: '0.72rem', color: '#047857' }}>(Valid 15m - auto-filled into form)</span>
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0369a1', marginBottom: '0.35rem' }}>
                      Step 2: Enter 6-Digit Verification Code
                    </div>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="e.g. 123456"
                      value={profileFormData.emailVerificationCode}
                      onChange={(e) => setProfileFormData({ ...profileFormData, emailVerificationCode: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        letterSpacing: '0.08em'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="submit-btn"
                  style={{ width: 'auto', padding: '0.55rem 1.4rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {isUpdatingProfile ? (
                    <>
                      <RefreshCw size={15} className="btn-spinner" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Company Staff & Operator Management Section */}
      <div className="register-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} color="var(--primary-600)" />
              Company Staff & Operator Accounts
              <span
                style={{
                  background: 'var(--primary-100)',
                  color: 'var(--primary-800)',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: '700'
                }}
              >
                {staffList.length} {staffList.length === 1 ? 'Account' : 'Accounts'}
              </span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Invite and manage company staff members with the restricted <strong>Operator</strong> role scoped to Tenant <code style={{ color: 'var(--primary-700)' }}>{authUser?.tenantId}</code>.
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
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <UserPlus size={15} />
              <span>Invite Staff Member</span>
            </button>
          ) : (
            <span
              style={{
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Lock size={13} />
              Staff management restricted to Admin
            </span>
          )}
        </div>

        {staffSuccess && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#dcfce7', color: '#15803d', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} />
            <span>{staffSuccess}</span>
          </div>
        )}

        {staffError && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            <span>{staffError}</span>
          </div>
        )}

        {loadingStaff ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <RefreshCw size={20} className="spinner" style={{ margin: '0 auto' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Loading staff accounts...</p>
          </div>
        ) : staffList.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>STAFF MEMBER</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>EMAIL</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>ROLE CLAIM</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>INVITED / CREATED</th>
                  {isAdmin && <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'right' }}>ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {staffList.map((member) => (
                  <tr key={member.userId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: 'var(--text-main)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem' }}>
                          {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div>{member.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {member.userId}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-main)' }}>
                      {member.email}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: '700'
                        }}
                      >
                        {member.role || 'Operator'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          background: member.status === 'Active' ? '#dcfce7' : '#fee2e2',
                          color: member.status === 'Active' ? '#15803d' : '#b91c1c',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}
                      >
                        ● {member.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>
                      {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStaffStatus(member)}
                          style={{
                            background: member.status === 'Active' ? '#fee2e2' : '#dcfce7',
                            color: member.status === 'Active' ? '#b91c1c' : '#15803d',
                            border: `1px solid ${member.status === 'Active' ? '#fca5a5' : '#86efac'}`,
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          {member.status === 'Active' ? (
                            <>
                              <UserX size={13} />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck size={13} />
                              Reactivate
                            </>
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--bg-page)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
            <Users size={28} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
            <p style={{ fontWeight: '600', color: 'var(--text-main)' }}>No staff accounts created yet for this tenant.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {isAdmin ? 'Invite team members to provide restricted operator access to platform management.' : 'Staff members will appear here once invited by the Company Admin.'}
            </p>
          </div>
        )}
      </div>

      {/* Invite Staff Member Modal */}
      {showInviteStaffModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="register-card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '520px',
              margin: 0,
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={20} color="var(--primary-600)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700' }}>Invite Staff Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteStaffModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Staff members are scoped strictly to Tenant <strong>{authUser?.tenantId}</strong> and are granted the restricted <strong>Operator</strong> role.
            </p>

            {staffModalError && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.85rem' }}>
                {staffModalError}
              </div>
            )}

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={staffFormData.name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                  Business Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="alex.rivera@company.com"
                  value={staffFormData.email}
                  onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                  Password * (Min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Set initial secure password"
                  value={staffFormData.password}
                  onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+1-555-0199"
                  value={staffFormData.phone}
                  onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                  Assigned Role (Restricted)
                </label>
                <input
                  type="text"
                  disabled
                  value="Operator"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.04)', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Operators have restricted platform permissions (cannot delete company or manage billing).
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteStaffModal(false)}
                  style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="submit-btn"
                  style={{ width: 'auto', padding: '0.55rem 1.3rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {isSubmittingStaff ? <RefreshCw size={15} className="spinner" /> : <UserPlus size={15} />}
                  <span>{isSubmittingStaff ? 'Inviting...' : 'Invite Staff Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Company Billing & Subscription Card */}
      <div className="register-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={18} color="var(--primary-600)" />
              Company Billing & Subscription Tier
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Organization payment method, invoicing cycle, and enterprise billing plan.
            </p>
          </div>

          {!isAdmin && (
            <span
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
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
              borderRadius: '10px',
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.25rem'
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                CURRENT PLAN
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>
                {billingInfo?.plan || 'Enterprise Scale'}
              </span>
              <span style={{ display: 'block', fontSize: '0.78rem', color: '#15803d', fontWeight: '600', marginTop: '0.2rem' }}>
                ● Active Subscription
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                BILLING EMAIL
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>
                {billingInfo?.billingEmail || activeBusinessEmail}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                PAYMENT METHOD
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>
                {billingInfo?.paymentMethod || 'Corporate Visa **** 4242'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                MONTHLY RATE
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--primary-700)' }}>
                $499.00 / month
              </span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '1.75rem', background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: '8px' }}>
            <Lock size={26} color="#dc2626" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
            <p style={{ fontWeight: '700', color: '#991b1b', margin: 0 }}>Restricted Permission</p>
            <p style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: '0.25rem' }}>
              Staff members with the <strong>Operator</strong> role are restricted from viewing or managing corporate billing and payment methods.
            </p>
          </div>
        )}
      </div>

      {/* Danger Zone: Company Account Deletion */}
      <div className="register-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
              <Trash2 size={18} color="#dc2626" />
              Company Workspace Deletion
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Permanently terminate company account and cascade delete all isolated stations, staff records, and tokens.
            </p>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Trash2 size={15} />
              <span>Delete Company</span>
            </button>
          ) : (
            <span
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Lock size={13} />
              Deletion restricted to Admin
            </span>
          )}
        </div>

        {deleteCompanyMsg && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.85rem' }}>
            {deleteCompanyMsg}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="register-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              margin: 0,
              padding: '1.75rem',
              border: '2px solid #ef4444',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: '#fee2e2', padding: '0.6rem', borderRadius: '10px', color: '#dc2626' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: '#dc2626' }}>
                  Delete Company Account?
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
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingCompany}
                onClick={handleDeleteCompany}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                {isDeletingCompany ? <RefreshCw size={15} className="spinner" /> : <Trash2 size={15} />}
                <span>{isDeletingCompany ? 'Deleting...' : 'Yes, Delete Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Tenant Data Isolation & Charging Assets Section */}
      <div className="register-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="var(--primary-600)" />
              Company Charging Stations (Tenant-Isolated)
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              All database records are strictly scoped via ADO.NET parameter binding: <code style={{ color: 'var(--primary-700)' }}>WHERE tenant_id = @tenant_id</code>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={loadStations}
              disabled={loadingStations}
              className="submit-btn"
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'var(--primary-50)', color: 'var(--primary-700)', border: '1px solid var(--primary-200)' }}
            >
              <RefreshCw size={14} className={loadingStations ? 'btn-spinner' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isEmailVerified) return;
                setShowAddStation(!showAddStation);
              }}
              disabled={!isEmailVerified}
              title={!isEmailVerified ? 'Email verification required to provision charging stations' : ''}
              className="submit-btn"
              style={{
                width: 'auto',
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                opacity: !isEmailVerified ? 0.6 : 1,
                cursor: !isEmailVerified ? 'not-allowed' : 'pointer'
              }}
            >
              {!isEmailVerified ? <Lock size={14} /> : <Plus size={14} />}
              <span>{getAddStationButtonText()}</span>
            </button>
          </div>
        </div>

        {!isEmailVerified && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#b45309', fontSize: '0.85rem' }}>
            <Lock size={16} />
            <span>Station provisioning and tariff modifications are restricted. Please verify your business email above to unlock full platform access.</span>
          </div>
        )}

        {stationSuccessMsg && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <CheckCircle2 size={18} className="alert-icon" />
            <div className="alert-body">
              <strong>Station Added Successfully</strong>
              <p style={{ fontSize: '0.85rem' }}>{stationSuccessMsg}</p>
            </div>
          </div>
        )}

        {stationError && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={18} className="alert-icon" />
            <div className="alert-body">
              <strong>Error Loading Stations</strong>
              <p style={{ fontSize: '0.85rem' }}>{stationError}</p>
            </div>
          </div>
        )}

        {/* Add Station Inline Form */}
        {showAddStation && (
          <form onSubmit={handleCreateStation} style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--primary-900)' }}>
              Register New Charging Station (Auto-stamped with Tenant ID: {authUser?.tenantId})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Station Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GreenPulse Downtown Hub"
                  value={stationForm.name}
                  onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Location / Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500 Market St, Financial District"
                  value={stationForm.location}
                  onChange={(e) => setStationForm({ ...stationForm, location: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>Total Ports</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={stationForm.totalPorts}
                  onChange={(e) => setStationForm({ ...stationForm, totalPorts: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowAddStation(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingStation}
                className="submit-btn"
                style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                {isSubmittingStation ? 'Creating...' : 'Save Station'}
              </button>
            </div>
          </form>
        )}

        {/* Stations Table */}
        {stations.length > 0 ? (
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Station ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Location</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Ports</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>Tenant Owner</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((stn) => (
                  <tr key={stn.stationId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: '600', color: 'var(--primary-700)' }}>
                      {stn.stationId}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{stn.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{stn.location}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{stn.totalPorts} ports</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600' }}>
                        {stn.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#0369a1' }}>
                      {stn.tenantId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'var(--bg-page)', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
            <Zap size={28} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
            <p style={{ fontWeight: '600', color: 'var(--text-main)' }}>No charging stations registered for this tenant yet.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Click "Add Station" above to create your first tenant-isolated station.
            </p>
          </div>
        )}
      </div>

      {/* Interactive Cross-Tenant Security Access Simulator */}
      <div className="register-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
              <ShieldAlert size={20} color="#dc2626" />
              Security Audit: Cross-Tenant Access Simulator
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Verify Acceptance Criteria: Attempting to query another tenant's data must trigger an immediate <strong>HTTP 403 Forbidden</strong> response.
            </p>
          </div>
        </div>

        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '240px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#991b1b', marginBottom: '0.3rem' }}>
                Foreign / Target Tenant ID to Request:
              </label>
              <input
                type="text"
                value={unauthorizedTenantId}
                onChange={(e) => setUnauthorizedTenantId(e.target.value)}
                placeholder="e.g. TNT-UNAUTHORIZED-CORP-999"
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fca5a5', fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
            <button
              type="button"
              onClick={handleSimulateCrossTenant}
              disabled={isTestingCrossTenant || !unauthorizedTenantId.trim()}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '0.55rem 1.2rem',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'background 0.2s ease'
              }}
            >
              {isTestingCrossTenant ? <RefreshCw size={15} className="btn-spinner" /> : <ShieldAlert size={15} />}
              <span>Simulate Cross-Tenant Call</span>
            </button>
          </div>
        </div>

        {crossTenantResult && (
          <div
            style={{
              background: crossTenantResult.status === 403 ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${crossTenantResult.status === 403 ? '#f87171' : '#86efac'}`,
              borderRadius: '8px',
              padding: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  color: crossTenantResult.status === 403 ? '#b91c1c' : '#15803d'
                }}
              >
                {crossTenantResult.status === 403 ? <CheckCircle2 size={18} color="#dc2626" /> : <AlertTriangle size={18} />}
                {crossTenantResult.status === 403 ? 'HTTP 403 Forbidden (Isolation Boundary Confirmed)' : 'Failed: Allowed'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', background: crossTenantResult.status === 403 ? '#fee2e2' : '#dcfce7', color: crossTenantResult.status === 403 ? '#b91c1c' : '#15803d', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                Status Code: {crossTenantResult.status} | Latency: {crossTenantResult.latencyMs}ms
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: crossTenantResult.status === 403 ? '#991b1b' : '#166534', margin: 0 }}>
              <strong>API Gateway & Service Response:</strong> {crossTenantResult.message}
            </p>
          </div>
        )}
      </div>

      {/* RBAC Security Simulator Card */}
      <div className="register-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #dc2626' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <Lock size={18} color="#dc2626" />
              Role-Based Access Control (RBAC) Simulator
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Simulates an unauthorized cross-role API request: sends this <strong>CompanyAdmin</strong> JWT token to the driver-only endpoint (<code style={{ color: '#dc2626' }}>GET /api/driver/wallet</code>). The backend <code>RoleAuthorizationMiddleware</code> must reject with <strong>403 Forbidden</strong> and log an audit warning.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestRbacSecurity}
            disabled={isTestingRbac}
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '0.55rem 1.2rem',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
              transition: 'background 0.2s ease'
            }}
          >
            {isTestingRbac ? <RefreshCw size={15} className="spinner-icon" /> : <ShieldAlert size={15} />}
            <span>Simulate Company -&gt; Driver Access</span>
          </button>
        </div>

        {rbacResult && (
          <div
            style={{
              background: rbacResult.status === 403 ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${rbacResult.status === 403 ? '#f87171' : '#86efac'}`,
              borderRadius: '8px',
              padding: '1rem',
              marginTop: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  color: rbacResult.status === 403 ? '#b91c1c' : '#15803d'
                }}
              >
                {rbacResult.status === 403 ? <CheckCircle2 size={18} color="#dc2626" /> : <AlertTriangle size={18} />}
                {rbacResult.status === 403 ? 'HTTP 403 Forbidden (RBAC Enforcement Verified)' : 'Failed: Allowed'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', background: rbacResult.status === 403 ? '#fee2e2' : '#dcfce7', color: rbacResult.status === 403 ? '#b91c1c' : '#15803d', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                Status Code: {rbacResult.status} | Latency: {rbacResult.latencyMs}ms
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: rbacResult.status === 403 ? '#991b1b' : '#166534', margin: 0 }}>
              <strong>API Gateway & Service Response:</strong> {rbacResult.errorMsg}
            </p>
            {rbacResult.errors?.length > 0 && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#b91c1c' }}>
                {rbacResult.errors.map((e, idx) => (
                  <div key={`company-rbac-err-${idx}`}>• {e}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Protected Endpoint Verification Section */}
      <div className="register-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={18} color="var(--primary-600)" />
              Protected API Endpoint Validation
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Validates that protected company endpoints require and verify the signed JWT Bearer token (<code style={{ color: 'var(--primary-700)' }}>GET /api/auth/company/profile</code>).
            </p>
          </div>

          <button
            type="button"
            onClick={handleVerifyProtectedApi}
            disabled={isVerifying}
            className="submit-btn"
            style={{ width: 'auto', padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
          >
            {isVerifying ? (
              <RefreshCw size={16} className="btn-spinner" />
            ) : (
              <>
                <RefreshCw size={16} />
                <span>Test Protected API</span>
              </>
            )}
          </button>
        </div>

        {profileResult && (
          <div
            style={{
              background: 'var(--success-50)',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '1rem',
              marginTop: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontWeight: '700', fontSize: '0.9rem' }}>
                <CheckCircle2 size={18} />
                Authorization Successful (HTTP 200 OK)
              </span>
              <span style={{ fontSize: '0.75rem', color: '#15803d', background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                Latency: {profileResult.latencyMs}ms | {profileResult.timestamp}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Company Name:</span>{' '}
                <strong>{profileResult.data?.companyName}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Business Reg #:</span>{' '}
                <strong>{profileResult.data?.registrationNumber}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Email:</span>{' '}
                <strong>{profileResult.data?.businessEmail}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>{' '}
                <strong>{profileResult.data?.phone}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Address:</span>{' '}
                <strong>{profileResult.data?.address}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>{' '}
                <strong style={{ color: '#15803d' }}>{profileResult.data?.status}</strong>
              </div>
            </div>
          </div>
        )}

        {profileError && (
          <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
            <AlertTriangle size={20} className="alert-icon" />
            <div className="alert-body">
              <strong>Protected API Error (HTTP {profileError.status})</strong>
              <p style={{ marginTop: '0.2rem', fontSize: '0.875rem' }}>{profileError.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* JWT Token Raw Payload Viewer */}
      <div className="register-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Key size={16} color="var(--primary-600)" />
            Active Signed JWT Bearer Token
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowFullToken(!showFullToken)}
              style={{
                background: 'none',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              {showFullToken ? 'Truncate' : 'Expand'}
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(authUser?.accessToken, 'token')}
              style={{
                background: 'var(--primary-50)',
                border: '1px solid var(--primary-200)',
                color: 'var(--primary-700)',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              {copiedToken ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              {copiedToken ? 'Copied' : 'Copy JWT'}
            </button>
          </div>
        </div>

        <div
          style={{
            background: '#0f172a',
            color: '#38bdf8',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            padding: '1rem',
            borderRadius: '8px',
            overflowX: 'auto',
            wordBreak: showFullToken ? 'break-all' : 'normal',
            whiteSpace: showFullToken ? 'pre-wrap' : 'nowrap',
            maxHeight: showFullToken ? '200px' : 'none'
          }}
        >
          {authUser?.accessToken}
        </div>
      </div>
    </div>
  );
}
