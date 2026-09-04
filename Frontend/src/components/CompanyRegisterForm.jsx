import React, { useState } from 'react';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Clock,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { registerCompany, verifyEmail, resendVerificationCode } from '../services/api';

export default function CompanyRegisterForm({ onSwitchToLogin, onSwitchToDriver }) {
  const [formData, setFormData] = useState({
    companyName: '',
    registrationNumber: '',
    businessEmail: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  // Verification state in registration success screen
  const [inlineVerifyCode, setInlineVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [verificationError, setVerificationError] = useState(null);

  const [copiedTenantId, setCopiedTenantId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time password requirement checks
  const hasMinLength = formData.password.length >= 8;
  const hasUpper = /[A-Z]/.test(formData.password);
  const hasLower = /[a-z]/.test(formData.password);
  const hasDigit = /[0-9]/.test(formData.password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(formData.password);

  const getPasswordScore = () => {
    let score = 0;
    if (hasMinLength) score++;
    if (hasUpper) score++;
    if (hasLower) score++;
    if (hasDigit) score++;
    if (hasSpecial) score++;
    return score;
  };

  const passwordScore = getPasswordScore();

  const getStrengthLabel = (score) => {
    if (!formData.password) return { label: 'Empty', class: '' };
    if (score <= 2) return { label: 'Weak', class: 'weak' };
    if (score <= 4) return { label: 'Medium', class: 'medium' };
    return { label: 'Strong & Secure', class: 'strong' };
  };

  const validateField = (name, value) => {
    let error = null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    switch (name) {
      case 'companyName':
        if (!value.trim()) error = 'Company name is required.';
        else if (value.trim().length < 2) error = 'Company name must be at least 2 characters.';
        break;
      case 'registrationNumber':
        if (!value.trim()) error = 'Business registration number is required.';
        else if (value.trim().length < 2) error = 'Registration number must be at least 2 characters.';
        break;
      case 'businessEmail':
        if (!value.trim()) error = 'Business email is required.';
        else if (!emailRegex.test(value.trim())) error = 'Please enter a valid business email address.';
        break;
      case 'phone':
        if (!value.trim()) error = 'Phone number is required.';
        break;
      case 'address':
        if (!value.trim()) error = 'Business address is required.';
        break;
      case 'password':
        if (!value) {
          error = 'Password is required.';
        } else if (value.length < 8) {
          error = 'Password must be at least 8 characters long.';
        } else if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
          error = 'Must contain uppercase, lowercase, digit, and special character.';
        }
        break;
      case 'confirmPassword':
        if (!value) error = 'Please confirm your password.';
        else if (value !== formData.password) error = 'Passwords do not match.';
        break;
      default:
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setServerError(null);

    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }

    if (name === 'password' && touched.confirmPassword) {
      const confirmError = formData.confirmPassword !== value ? 'Passwords do not match.' : null;
      setErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateAll = () => {
    const newErrors = {};
    setTouched({
      companyName: true,
      registrationNumber: true,
      businessEmail: true,
      phone: true,
      address: true,
      password: true,
      confirmPassword: true
    });

    Object.keys(formData).forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await registerCompany(formData);
      if (response && response.success && response.data) {
        setSuccessData(response.data);
        setInlineVerifyCode('');
      } else {
        setServerError(response?.message || 'Company registration failed. Please try again.');
      }
    } catch (err) {
      if (err.status === 409) {
        setServerError(err.message || 'A company with this email or registration number is already registered.');
      } else if (err.status === 400 && err.errors && err.errors.length > 0) {
        setServerError(err.errors.join(' '));
      } else {
        setServerError(err.message || 'Unable to connect to registration service. Please verify the backend is running.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isResending, setIsResending] = useState(false);
  const [resendStatusMsg, setResendStatusMsg] = useState(null);

  const handleInlineVerify = async () => {
    if (!inlineVerifyCode.trim()) return;
    setIsVerifying(true);
    setVerificationError(null);
    setResendStatusMsg(null);

    try {
      const res = await verifyEmail(successData.businessEmail, inlineVerifyCode.trim());
      if (res && res.success) {
        setVerificationSuccess(true);
      } else {
        setVerificationError(res?.message || 'Verification failed.');
      }
    } catch (err) {
      setVerificationError(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!successData?.businessEmail) return;
    setIsResending(true);
    setResendStatusMsg(null);
    setVerificationError(null);

    try {
      const res = await resendVerificationCode(successData.businessEmail);
      setResendStatusMsg(res?.message || 'A fresh verification code has been dispatched to your email inbox.');
    } catch (err) {
      setVerificationError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'tenant') {
      setCopiedTenantId(true);
      setTimeout(() => setCopiedTenantId(false), 2500);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  if (successData) {
    return (
      <div className="register-card animate-fade-in" style={{ maxWidth: '640px' }}>
        <div className="card-top-glow" />
        <div className="success-state">
          <div className="success-icon-badge" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <Mail size={38} />
          </div>

          <h2 className="success-title">Verification Email Sent!</h2>
          <p className="success-subtitle">
            An automated verification email has been dispatched to <strong>{successData.businessEmail}</strong>. Please check your inbox (or spam folder) to verify your account.
          </p>

          {/* Assigned Tenant ID Box */}
          <div className="tenant-id-box">
            <div className="tenant-id-label">
              <Building2 size={14} />
              <span>Assigned Enterprise Tenant ID</span>
            </div>
            <div className="tenant-id-value-row">
              <span className="tenant-id-text">{successData.tenantId}</span>
              <button
                type="button"
                className="copy-btn"
                onClick={() => copyToClipboard(successData.tenantId, 'tenant')}
                title="Copy Tenant ID"
              >
                {copiedTenantId ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                <span>{copiedTenantId ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Email Verification Box */}
          <div
            className="tenant-id-box"
            style={{
              marginTop: '1rem',
              borderColor: verificationSuccess ? 'rgba(16, 185, 129, 0.4)' : 'rgba(2, 132, 199, 0.4)',
              background: verificationSuccess ? 'rgba(16, 185, 129, 0.05)' : 'rgba(240, 249, 255, 0.7)'
            }}
          >
            <div className="tenant-id-label" style={{ color: verificationSuccess ? '#059669' : '#0369a1', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={14} />
                <span>Email Verification (Valid for 24 Hours)</span>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'rgba(2, 132, 199, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: '#0369a1' }}>
                Expires in 24h
              </span>
            </div>

            {/* Instant Verification Form */}
            {!verificationSuccess ? (
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                  Enter the <strong>6-digit verification code</strong> from your email inbox below, or click the direct activation link inside the email:
                </p>

                {resendStatusMsg && (
                  <div className="alert alert-info" style={{ margin: '0 0 0.75rem 0', padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>
                    <CheckCircle2 size={15} />
                    <span>{resendStatusMsg}</span>
                  </div>
                )}

                {verificationError && (
                  <div className="alert alert-danger" style={{ margin: '0 0 0.75rem 0', padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>
                    <AlertCircle size={15} />
                    <span>{verificationError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={inlineVerifyCode}
                    onChange={(e) => setInlineVerifyCode(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      background: '#ffffff',
                      fontFamily: 'monospace',
                      fontSize: '1.1rem',
                      letterSpacing: '3px',
                      textAlign: 'center',
                      fontWeight: 700
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleInlineVerify}
                    disabled={isVerifying || !inlineVerifyCode.trim()}
                    className="submit-btn"
                    style={{
                      width: 'auto',
                      margin: 0,
                      padding: '0.55rem 1.2rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    {isVerifying ? <Loader2 size={15} className="spinner" /> : <ShieldCheck size={15} />}
                    <span>Verify Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="btn-secondary"
                    style={{ padding: '0.55rem 0.9rem', fontSize: '0.85rem' }}
                  >
                    {isResending ? <RefreshCw size={14} className="spinner" /> : <Mail size={14} />}
                    <span>Resend Email</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontSize: '0.9rem', fontWeight: 600 }}>
                <CheckCircle2 size={18} />
                <span>Email verified successfully! Your company workspace is fully unlocked.</span>
              </div>
            )}
          </div>

          <div className="registration-details-card" style={{ marginTop: '1rem' }}>
            <div className="detail-row">
              <span className="detail-label">Company:</span>
              <span className="detail-value">{successData.companyName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Registration No:</span>
              <span className="detail-value">{successData.registrationNumber}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Business Email:</span>
              <span className="detail-value">{successData.businessEmail}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className="detail-value" style={{ color: verificationSuccess ? '#059669' : '#d97706', fontWeight: 600 }}>
                {verificationSuccess ? 'Verified (Full Access)' : 'Pending Email Verification'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            {onSwitchToLogin && (
              <button
                type="button"
                className="submit-btn"
                onClick={onSwitchToLogin}
                style={{
                  margin: 0,
                  background: 'var(--primary-600)',
                  flex: 1,
                  minWidth: '200px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                }}
              >
                <span>Proceed to Sign In</span>
                <ArrowRight size={18} />
              </button>
            )}
            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                setSuccessData(null);
                setFormData({
                  companyName: '',
                  registrationNumber: '',
                  businessEmail: '',
                  phone: '',
                  address: '',
                  password: '',
                  confirmPassword: ''
                });
              }}
              style={{ flex: 1, minWidth: '150px' }}
            >
              Register Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-card animate-fade-in">
      <div className="card-top-glow" />

      {/* Header */}
      <div className="register-header">
        <div className="header-badge">
          <Building2 size={14} />
          <span>Enterprise Tenant Registration</span>
        </div>
        <h1 className="register-title">Register Your Company</h1>
        <p className="register-subtitle">
          Provision an enterprise workspace with isolated tenant ID, charging stations, and fleet tariffs.
        </p>
      </div>

      {/* Role Switcher */}
      {onSwitchToDriver && (
        <div className="role-switcher-banner" style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Are you an individual EV driver?</span>
          <button
            type="button"
            onClick={onSwitchToDriver}
            style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Register as Driver &rarr;
          </button>
        </div>
      )}

      {serverError && (
        <div className="server-error-banner animate-shake" role="alert">
          <AlertCircle size={20} className="error-banner-icon" />
          <div className="error-banner-content">
            <span className="error-banner-title">Registration Error</span>
            <span className="error-banner-desc">{serverError}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {/* Company Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="companyName">
              <span>Company Legal Name</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Building2 size={18} /></span>
              <input
                id="companyName"
                name="companyName"
                type="text"
                className={`form-input ${touched.companyName && errors.companyName ? 'has-error' : ''}`}
                placeholder="e.g. Apex Fleet Solutions Ltd."
                value={formData.companyName}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                required
              />
            </div>
            {touched.companyName && errors.companyName && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.companyName}
              </div>
            )}
          </div>

          {/* Registration Number */}
          <div className="form-group">
            <label className="form-label" htmlFor="registrationNumber">
              <span>Business Registration Number</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><FileText size={18} /></span>
              <input
                id="registrationNumber"
                name="registrationNumber"
                type="text"
                className={`form-input ${touched.registrationNumber && errors.registrationNumber ? 'has-error' : ''}`}
                placeholder="e.g. BRN-849204-X"
                value={formData.registrationNumber}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                required
              />
            </div>
            {touched.registrationNumber && errors.registrationNumber && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.registrationNumber}
              </div>
            )}
          </div>

          {/* Business Phone */}
          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              <span>Business Phone</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Phone size={18} /></span>
              <input
                id="phone"
                name="phone"
                type="tel"
                className={`form-input ${touched.phone && errors.phone ? 'has-error' : ''}`}
                placeholder="e.g. +1 555-0199"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                required
              />
            </div>
            {touched.phone && errors.phone && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.phone}
              </div>
            )}
          </div>

          {/* Business Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="businessEmail">
              <span>Business Email (Login)</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Mail size={18} /></span>
              <input
                id="businessEmail"
                name="businessEmail"
                type="email"
                className={`form-input ${touched.businessEmail && errors.businessEmail ? 'has-error' : ''}`}
                placeholder="contact@company.com"
                value={formData.businessEmail}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                required
              />
            </div>
            {touched.businessEmail && errors.businessEmail && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.businessEmail}
              </div>
            )}
          </div>

          {/* Address */}
          <div className="form-group full-width">
            <label className="form-label" htmlFor="address">
              <span>Headquarters Address</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><MapPin size={18} /></span>
              <input
                id="address"
                name="address"
                type="text"
                className={`form-input ${touched.address && errors.address ? 'has-error' : ''}`}
                placeholder="Suite 400, Clean Energy Way, Tech City"
                value={formData.address}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                required
              />
            </div>
            {touched.address && errors.address && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.address}
              </div>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              <span>Master Password</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={18} /></span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${touched.password && errors.password ? 'has-error' : ''}`}
                placeholder="Min 8 chars, Aa1@"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {touched.password && errors.password && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.password}
              </div>
            )}
            {formData.password && (
              <div className="password-strength-container">
                <div className="strength-bar-track">
                  <div className={`strength-bar-segment ${passwordScore >= 1 ? getStrengthLabel(passwordScore).class : ''}`} />
                  <div className={`strength-bar-segment ${passwordScore >= 3 ? getStrengthLabel(passwordScore).class : ''}`} />
                  <div className={`strength-bar-segment ${passwordScore >= 5 ? getStrengthLabel(passwordScore).class : ''}`} />
                </div>
                <div className="strength-label">
                  <span>Strength</span>
                  <span style={{ fontWeight: 600 }}>{getStrengthLabel(passwordScore).label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              <span>Confirm Password</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={18} /></span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className={`form-input ${touched.confirmPassword && errors.confirmPassword ? 'has-error' : ''}`}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {touched.confirmPassword && errors.confirmPassword && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.confirmPassword}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="spinner" />
              <span>Creating Isolated Tenant Record...</span>
            </>
          ) : (
            <>
              <span>Complete Company Registration</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {onSwitchToLogin && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Already registered your company?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-600)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '0 0.2rem'
                }}
              >
                Sign In
              </button>
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
