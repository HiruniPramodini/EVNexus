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
  ShieldCheck,
  Clock,
  Zap
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
    if (!formData.password) return { label: 'Empty', color: 'var(--color-text-muted)' };
    if (score <= 2) return { label: 'Weak', color: 'var(--color-danger)' };
    if (score <= 4) return { label: 'Medium', color: 'var(--color-warning)' };
    return { label: 'Strong & Secure', color: 'var(--color-success)' };
  };

  const strength = getStrengthLabel(passwordScore);

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
    }
  };

  if (successData) {
    return (
      <div style={{ width: '100%', maxWidth: '540px', margin: '0 auto', padding: 'var(--space-6) 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-success-light)', color: 'var(--color-success-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
            <Mail size={32} />
          </div>
          <h2 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>Verification Email Sent!</h2>
          <p className="text-body" style={{ color: 'var(--color-text-secondary)' }}>
            An automated verification email has been dispatched to <strong>{successData.businessEmail}</strong>. Please check your inbox (or spam folder) to verify your account.
          </p>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Building2 size={18} className="text-secondary" />
              <span className="text-secondary" style={{ fontWeight: 'var(--weight-semibold)' }}>Assigned Tenant ID</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-bold)', fontSize: '1.1rem' }}>{successData.tenantId}</span>
              <button onClick={() => copyToClipboard(successData.tenantId, 'tenant')} className="btn btn-ghost" style={{ padding: '4px', height: 'auto' }}>
                {copiedTenantId ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Email Verification Box */}
        <div className="card" style={{ marginBottom: 'var(--space-6)', borderColor: verificationSuccess ? 'var(--color-success)' : 'var(--color-info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: verificationSuccess ? 'var(--color-success)' : 'var(--color-info-dark)', fontWeight: 'var(--weight-semibold)' }}>
              <Clock size={16} />
              <span>Email Verification</span>
            </div>
            {!verificationSuccess && (
              <span className="badge badge-info">Expires in 24h</span>
            )}
          </div>

          {!verificationSuccess ? (
            <div>
              <p className="text-caption" style={{ marginBottom: 'var(--space-4)' }}>
                Enter the <strong>6-digit verification code</strong> from your email inbox below, or click the direct activation link inside the email.
              </p>

              {resendStatusMsg && (
                <div className="alert alert-info" style={{ padding: 'var(--space-2) var(--space-3)' }}>
                  <CheckCircle2 size={16} />
                  <span>{resendStatusMsg}</span>
                </div>
              )}

              {verificationError && (
                <div className="alert alert-danger" style={{ padding: 'var(--space-2) var(--space-3)' }}>
                  <AlertCircle size={16} />
                  <span>{verificationError}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={inlineVerifyCode}
                  onChange={(e) => setInlineVerifyCode(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '1.25rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 'var(--weight-bold)' }}
                />
                <button
                  type="button"
                  onClick={handleInlineVerify}
                  disabled={isVerifying || !inlineVerifyCode.trim()}
                  className="btn"
                  style={{ backgroundColor: 'var(--color-text)', color: 'white' }}
                >
                  {isVerifying ? <div className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div> : <ShieldCheck size={16} />}
                  Verify
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                <button type="button" onClick={handleResend} disabled={isResending} className="btn btn-ghost" style={{ fontSize: 'var(--text-caption)' }}>
                  Didn't receive it? Resend Email
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-success)', fontWeight: 'var(--weight-semibold)' }}>
              <CheckCircle2 size={20} />
              <span>Email verified successfully! Enterprise access unlocked.</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {onSwitchToLogin && (
            <button type="button" className="btn" onClick={onSwitchToLogin} style={{ flex: 1, backgroundColor: 'var(--color-text)', color: 'white' }}>
              Sign In to Enterprise Portal <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '440px', margin: '0 auto', padding: 'var(--space-6) 0' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div className="badge" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
          <Building2 size={14} className="text-secondary" /> Enterprise Tenant Registration
        </div>
        <h1 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>Register Your Company</h1>
        <p className="text-secondary">
          Provision an enterprise workspace with isolated tenant ID, charging stations, and fleet tariffs.
        </p>
      </div>

      {serverError && (
        <div className="alert alert-danger">
          <AlertCircle size={20} />
          <div>
            <strong>Registration Error</strong>
            <p style={{ marginTop: 'var(--space-1)' }}>{serverError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Company Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="companyName">
            Company Legal Name <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Building2 size={18} />
            </div>
            <input
              id="companyName"
              name="companyName"
              type="text"
              className={`form-input ${touched.companyName && errors.companyName ? 'form-error' : ''}`}
              placeholder="e.g. Apex Fleet Solutions Ltd."
              value={formData.companyName}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              style={{ paddingLeft: 'var(--space-10)' }}
            />
          </div>
          {touched.companyName && errors.companyName && (
            <div className="form-error-msg">{errors.companyName}</div>
          )}
        </div>

        {/* Registration Number */}
        <div className="form-group">
          <label className="form-label" htmlFor="registrationNumber">
            Business Registration Number <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <FileText size={18} />
            </div>
            <input
              id="registrationNumber"
              name="registrationNumber"
              type="text"
              className={`form-input ${touched.registrationNumber && errors.registrationNumber ? 'form-error' : ''}`}
              placeholder="e.g. BRN-849204-X"
              value={formData.registrationNumber}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              style={{ paddingLeft: 'var(--space-10)' }}
            />
          </div>
          {touched.registrationNumber && errors.registrationNumber && (
            <div className="form-error-msg">{errors.registrationNumber}</div>
          )}
        </div>
        
        {/* Contact info grid */}
        <div className="grid grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          {/* Business Phone */}
          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              Business Phone <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
                <Phone size={18} />
              </div>
              <input
                id="phone"
                name="phone"
                type="tel"
                className={`form-input ${touched.phone && errors.phone ? 'form-error' : ''}`}
                placeholder="+1 555-0199"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                style={{ paddingLeft: 'var(--space-10)' }}
              />
            </div>
            {touched.phone && errors.phone && (
              <div className="form-error-msg">{errors.phone}</div>
            )}
          </div>

          {/* Business Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="businessEmail">
              Login Email <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
                <Mail size={18} />
              </div>
              <input
                id="businessEmail"
                name="businessEmail"
                type="email"
                className={`form-input ${touched.businessEmail && errors.businessEmail ? 'form-error' : ''}`}
                placeholder="admin@company.com"
                value={formData.businessEmail}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isSubmitting}
                style={{ paddingLeft: 'var(--space-10)' }}
              />
            </div>
            {touched.businessEmail && errors.businessEmail && (
              <div className="form-error-msg">{errors.businessEmail}</div>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="form-group">
          <label className="form-label" htmlFor="address">
            Headquarters Address <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <MapPin size={18} />
            </div>
            <input
              id="address"
              name="address"
              type="text"
              className={`form-input ${touched.address && errors.address ? 'form-error' : ''}`}
              placeholder="Suite 400, Clean Energy Way, Tech City"
              value={formData.address}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              style={{ paddingLeft: 'var(--space-10)' }}
            />
          </div>
          {touched.address && errors.address && (
            <div className="form-error-msg">{errors.address}</div>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Master Password <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Lock size={18} />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${touched.password && errors.password ? 'form-error' : ''}`}
              placeholder="Min 8 chars, Aa1@"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              style={{ paddingLeft: 'var(--space-10)', paddingRight: 'var(--space-10)' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label="Toggle password visibility"
              style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          
          {formData.password && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <div style={{ height: 4, background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ height: '100%', width: `${(passwordScore / 5) * 100}%`, backgroundColor: strength.color, transition: 'all 0.3s ease' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-caption)', marginTop: 'var(--space-1)', color: strength.color }}>
                <span>Strength: {strength.label}</span>
              </div>
            </div>
          )}

          {touched.password && errors.password && (
            <div className="form-error-msg">{errors.password}</div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">
            Confirm Password <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Lock size={18} />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              className={`form-input ${touched.confirmPassword && errors.confirmPassword ? 'form-error' : ''}`}
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              style={{ paddingLeft: 'var(--space-10)', paddingRight: 'var(--space-10)' }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex={-1}
              aria-label="Toggle confirm password visibility"
              style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {touched.confirmPassword && errors.confirmPassword && (
            <div className="form-error-msg">{errors.confirmPassword}</div>
          )}
        </div>

        <button
          type="submit"
          className="btn"
          disabled={isSubmitting}
          style={{ width: '100%', marginTop: 'var(--space-4)', backgroundColor: 'var(--color-text)', color: 'white' }}
        >
          {isSubmitting ? (
            <div className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
          ) : (
            <>
              Register Company <ArrowRight size={18} />
            </>
          )}
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {onSwitchToLogin && (
            <div className="text-secondary">
              Already registered your company?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text)',
                  fontWeight: 'var(--weight-semibold)',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Sign In
              </button>
            </div>
          )}

          {onSwitchToDriver && (
            <div className="text-secondary">
              Are you an individual EV driver?{' '}
              <button
                type="button"
                onClick={onSwitchToDriver}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontWeight: 'var(--weight-semibold)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)'
                }}
              >
                <Zap size={16} />
                Register as Driver
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
