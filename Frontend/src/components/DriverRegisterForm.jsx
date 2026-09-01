import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  Loader2,
  Wallet,
  Sparkles,
  Clock,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { registerDriver, verifyEmail, resendVerificationCode } from '../services/api';

export default function DriverRegisterForm({ onSwitchToLogin, onSwitchToCompany }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
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

  const [copiedDriverId, setCopiedDriverId] = useState(false);
  const [copiedWalletId, setCopiedWalletId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time password requirement checks (min 8 chars, 1 number)
  const hasMinLength = formData.password.length >= 8;
  const hasNumber = /[0-9]/.test(formData.password);
  const hasLetter = /[a-zA-Z]/.test(formData.password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(formData.password);

  const getPasswordStrength = () => {
    if (!formData.password) return { label: 'Empty', score: 0, color: '#94a3b8' };
    let score = 0;
    if (hasMinLength) score += 1;
    if (hasNumber) score += 1;
    if (hasLetter) score += 1;
    if (hasSpecial) score += 1;

    if (score <= 2) return { label: 'Weak', score: 1, color: '#ef4444' };
    if (score === 3) return { label: 'Medium', score: 2, color: '#f59e0b' };
    return { label: 'Strong & Secure', score: 3, color: '#10b981' };
  };

  const strength = getPasswordStrength();

  const validateField = (name, value) => {
    let error = null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    switch (name) {
      case 'name':
        if (!value.trim()) error = 'Driver full name is required.';
        else if (value.trim().length < 2) error = 'Full name must be at least 2 characters.';
        break;
      case 'email':
        if (!value.trim()) error = 'Email address is required.';
        else if (!emailRegex.test(value.trim())) error = 'Please enter a valid email address.';
        break;
      case 'phone':
        if (!value.trim()) error = 'Phone number is required.';
        break;
      case 'password':
        if (!value) {
          error = 'Password is required.';
        } else if (value.length < 8) {
          error = 'Password must be at least 8 characters long.';
        } else if (!/[0-9]/.test(value)) {
          error = 'Password must contain at least one numeric digit.';
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
      const confirmError = value !== formData.confirmPassword ? 'Passwords do not match.' : null;
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
    const allTouched = {
      name: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true
    };
    setTouched(allTouched);

    const newErrors = {};
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
      const response = await registerDriver(formData);
      if (response && response.success && response.data) {
        setSuccessData(response.data);
        setInlineVerifyCode('');
      } else {
        setServerError(response?.message || 'Driver registration failed. Please try again.');
      }
    } catch (err) {
      if (err.status === 409) {
        setServerError(err.message || 'A driver with this email address is already registered.');
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
      const res = await verifyEmail(successData.email, inlineVerifyCode.trim());
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
    if (!successData?.email) return;
    setIsResending(true);
    setResendStatusMsg(null);
    setVerificationError(null);

    try {
      const res = await resendVerificationCode(successData.email);
      setResendStatusMsg(res?.message || 'A fresh verification code has been dispatched to your email inbox.');
    } catch (err) {
      setVerificationError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'driver') {
      setCopiedDriverId(true);
      setTimeout(() => setCopiedDriverId(false), 2500);
    } else if (type === 'wallet') {
      setCopiedWalletId(true);
      setTimeout(() => setCopiedWalletId(false), 2500);
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: ''
    });
    setErrors({});
    setTouched({});
    setSuccessData(null);
    setServerError(null);
    setInlineVerifyCode('');
    setVerificationSuccess(false);
    setVerificationError(null);
    setResendStatusMsg(null);
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
            An automated verification email has been dispatched to <strong>{successData.email}</strong>. Please check your inbox (or spam folder) to verify your account.
          </p>

          <div className="tenant-id-box" style={{ borderColor: 'rgba(14, 165, 233, 0.4)' }}>
            <div className="tenant-id-label">
              <User size={14} />
              <span>Assigned Driver ID</span>
            </div>
            <div className="tenant-id-value-row">
              <span className="tenant-id-text">{successData.driverId}</span>
              <button
                type="button"
                className="copy-btn"
                onClick={() => copyToClipboard(successData.driverId, 'driver')}
                title="Copy Driver ID"
              >
                {copiedDriverId ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                <span>{copiedDriverId ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="tenant-id-box" style={{ marginTop: '1rem', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.05)' }}>
            <div className="tenant-id-label" style={{ color: '#059669' }}>
              <Wallet size={14} />
              <span>Auto-Created Charging Wallet</span>
            </div>
            <div className="tenant-id-value-row">
              <div>
                <span className="tenant-id-text" style={{ fontSize: '1.05rem', color: '#047857' }}>
                  {successData.walletId}
                </span>
                <div style={{ fontSize: '0.85rem', color: '#059669', marginTop: '0.25rem', fontWeight: '600' }}>
                  Initial Balance: ${Number(successData.walletBalance).toFixed(2)} {successData.currency || 'USD'}
                </div>
              </div>
              <button
                type="button"
                className="copy-btn"
                onClick={() => copyToClipboard(successData.walletId, 'wallet')}
                title="Copy Wallet ID"
              >
                {copiedWalletId ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                <span>{copiedWalletId ? 'Copied!' : 'Copy'}</span>
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
                <span>Email verified successfully! Full charging access is unlocked.</span>
              </div>
            )}
          </div>

          <div className="registration-details-card" style={{ marginTop: '1.25rem' }}>
            <div className="detail-row">
              <span className="detail-label">Driver Name:</span>
              <span className="detail-value">{successData.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Email:</span>
              <span className="detail-value">{successData.email}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Phone:</span>
              <span className="detail-value">{successData.phone}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className="detail-value" style={{ color: verificationSuccess ? '#059669' : '#d97706', fontWeight: 600 }}>
                {verificationSuccess ? 'Verified (Full Access)' : 'Pending Email Verification'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Created At:</span>
              <span className="detail-value">{new Date(successData.createdAt).toLocaleString()}</span>
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
                  flex: '1 1 200px'
                }}
              >
                <span>Sign In to Driver Account</span>
                <ArrowRight size={18} />
              </button>
            )}
            <button
              type="button"
              className="submit-btn"
              onClick={handleReset}
              style={{
                margin: 0,
                background: onSwitchToLogin ? 'var(--bg-page)' : 'var(--primary-600)',
                color: onSwitchToLogin ? 'var(--text-main)' : '#fff',
                border: '1px solid var(--border-subtle)',
                flex: '1 1 200px'
              }}
            >
              <span>Register Another Driver</span>
            </button>
            {onSwitchToCompany && (
              <button
                type="button"
                className="submit-btn"
                onClick={onSwitchToCompany}
                style={{
                  margin: 0,
                  background: 'var(--bg-page)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-subtle)',
                  flex: '1 1 200px'
                }}
              >
                <span>Go to Company Portal</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-card">
      <div className="card-top-glow" />

      <div className="card-header">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--primary-50)', color: 'var(--primary-700)', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.75rem' }}>
          <Sparkles size={14} /> EV Driver Onboarding
        </div>
        <h1 className="card-title">Driver Sign Up</h1>
        <p className="card-subtitle">
          Create your EV driver account. A digital charging wallet with $0.00 initial balance will be automatically set up for you.
        </p>
      </div>

      {serverError && (
        <div className="alert alert-danger" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>Registration Error:</strong> {serverError}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          {/* Driver Name */}
          <div className="form-group full-width">
            <label className="form-label" htmlFor="driverName">
              <span>Driver Full Name</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><User size={18} /></span>
              <input
                id="driverName"
                name="name"
                type="text"
                className={`form-input ${touched.name && errors.name ? 'has-error' : ''}`}
                placeholder="e.g. Alex Morgan"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="name"
              />
            </div>
            {touched.name && errors.name && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.name}
              </div>
            )}
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="driverEmail">
              <span>Email Address</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Mail size={18} /></span>
              <input
                id="driverEmail"
                name="email"
                type="email"
                className={`form-input ${touched.email && errors.email ? 'has-error' : ''}`}
                placeholder="alex.driver@example.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="email"
              />
            </div>
            {touched.email && errors.email && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.email}
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="form-group">
            <label className="form-label" htmlFor="driverPhone">
              <span>Phone Number</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Phone size={18} /></span>
              <input
                id="driverPhone"
                name="phone"
                type="tel"
                className={`form-input ${touched.phone && errors.phone ? 'has-error' : ''}`}
                placeholder="+1 (555) 345-6789"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="tel"
              />
            </div>
            {touched.phone && errors.phone && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.phone}
              </div>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="driverPassword">
              <span>Password</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={18} /></span>
              <input
                id="driverPassword"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${touched.password && errors.password ? 'has-error' : ''}`}
                placeholder="Min 8 chars, 1 number"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="new-password"
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

            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="password-strength-container">
                <div className="strength-bar-track">
                  <div
                    className="strength-bar-fill"
                    style={{
                      width: `${(strength.score / 3) * 100}%`,
                      backgroundColor: strength.color
                    }}
                  />
                </div>
                <div className="strength-text" style={{ color: strength.color }}>
                  <span>Strength</span>
                  <span>{strength.label}</span>
                </div>
              </div>
            )}

            {/* Live Password Requirements Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: hasMinLength ? '#10b981' : '#64748b' }}>
                <CheckCircle2 size={13} color={hasMinLength ? '#10b981' : '#cbd5e1'} />
                <span>At least 8 characters long</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: hasNumber ? '#10b981' : '#64748b' }}>
                <CheckCircle2 size={13} color={hasNumber ? '#10b981' : '#cbd5e1'} />
                <span>Contains at least 1 number (0-9)</span>
              </div>
            </div>

            {touched.password && errors.password && (
              <div className="field-error-message">
                <AlertCircle size={14} /> {errors.password}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="driverConfirmPassword">
              <span>Confirm Password</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={18} /></span>
              <input
                id="driverConfirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className={`form-input ${touched.confirmPassword && errors.confirmPassword ? 'has-error' : ''}`}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="new-password"
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
              <span>Creating Driver Account & Wallet...</span>
            </>
          ) : (
            <>
              <span>Complete Driver Sign Up</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {onSwitchToLogin && (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
              Already have an EV driver account?{' '}
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
          )}

          {onSwitchToCompany && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Are you an EV Enterprise or Station Operator?{' '}
              <button
                type="button"
                onClick={onSwitchToCompany}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-700)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '0 0.2rem'
                }}
              >
                Switch to Company Portal
              </button>
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
