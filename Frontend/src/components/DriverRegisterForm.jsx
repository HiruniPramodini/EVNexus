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
  Wallet,
  Sparkles,
  Clock,
  ShieldCheck,
  Building2
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time password requirement checks (min 8 chars, 1 number)
  const hasMinLength = formData.password.length >= 8;
  const hasNumber = /[0-9]/.test(formData.password);
  const hasLetter = /[a-zA-Z]/.test(formData.password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(formData.password);

  const getPasswordStrength = () => {
    if (!formData.password) return { label: 'Empty', score: 0, color: 'var(--color-text-muted)' };
    let score = 0;
    if (hasMinLength) score += 1;
    if (hasNumber) score += 1;
    if (hasLetter) score += 1;
    if (hasSpecial) score += 1;

    if (score <= 2) return { label: 'Weak', score: 1, color: 'var(--color-danger)' };
    if (score === 3) return { label: 'Medium', score: 2, color: 'var(--color-warning)' };
    return { label: 'Strong & Secure', score: 3, color: 'var(--color-success)' };
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
      <div style={{ width: '100%', maxWidth: '540px', margin: '0 auto', padding: 'var(--space-6) 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-success-light)', color: 'var(--color-success-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4) auto' }}>
            <Mail size={32} />
          </div>
          <h2 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>Verification Email Sent!</h2>
          <p className="text-body" style={{ color: 'var(--color-text-secondary)' }}>
            An automated verification email has been dispatched to <strong>{successData.email}</strong>. Please check your inbox (or spam folder) to verify your account.
          </p>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <User size={18} className="text-secondary" />
              <span className="text-secondary" style={{ fontWeight: 'var(--weight-semibold)' }}>Assigned Driver ID</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-bold)', fontSize: '1.1rem' }}>{successData.driverId}</span>
              <button onClick={() => copyToClipboard(successData.driverId, 'driver')} className="btn btn-ghost" style={{ padding: '4px', height: 'auto' }}>
                {copiedDriverId ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Wallet size={18} className="text-secondary" />
              <span className="text-secondary" style={{ fontWeight: 'var(--weight-semibold)' }}>Wallet Setup</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-bold)' }}>{successData.walletId}</div>
                <div className="text-caption" style={{ color: 'var(--color-success)' }}>Balance: $0.00</div>
              </div>
              <button onClick={() => copyToClipboard(successData.walletId, 'wallet')} className="btn btn-ghost" style={{ padding: '4px', height: 'auto' }}>
                {copiedWalletId ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
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
                  className="btn btn-primary"
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
              <span>Email verified successfully! Full charging access unlocked.</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {onSwitchToLogin && (
            <button type="button" className="btn btn-primary" onClick={onSwitchToLogin} style={{ flex: 1 }}>
              Sign In to Dashboard <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '440px', margin: '0 auto', padding: 'var(--space-6) 0' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div className="badge badge-info" style={{ marginBottom: 'var(--space-4)' }}>
          <Sparkles size={14} /> EV Driver Onboarding
        </div>
        <h1 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>Create your account</h1>
        <p className="text-secondary">
          Join EVNexus to get access to thousands of fast-charging stations globally.
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
        {/* Driver Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="driverName">
            Full Name <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <User size={18} />
            </div>
            <input
              id="driverName"
              name="name"
              type="text"
              className={`form-input ${touched.name && errors.name ? 'form-error' : ''}`}
              placeholder="e.g. Alex Morgan"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="name"
              style={{ paddingLeft: 'var(--space-10)' }}
            />
          </div>
          {touched.name && errors.name && (
            <div className="form-error-msg">{errors.name}</div>
          )}
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="driverEmail">
            Email Address <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Mail size={18} />
            </div>
            <input
              id="driverEmail"
              name="email"
              type="email"
              className={`form-input ${touched.email && errors.email ? 'form-error' : ''}`}
              placeholder="alex.driver@example.com"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="email"
              style={{ paddingLeft: 'var(--space-10)' }}
            />
          </div>
          {touched.email && errors.email && (
            <div className="form-error-msg">{errors.email}</div>
          )}
        </div>

        {/* Phone */}
        <div className="form-group">
          <label className="form-label" htmlFor="driverPhone">
            Phone Number <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Phone size={18} />
            </div>
            <input
              id="driverPhone"
              name="phone"
              type="tel"
              className={`form-input ${touched.phone && errors.phone ? 'form-error' : ''}`}
              placeholder="+1 (555) 345-6789"
              value={formData.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="tel"
              style={{ paddingLeft: 'var(--space-10)' }}
            />
          </div>
          {touched.phone && errors.phone && (
            <div className="form-error-msg">{errors.phone}</div>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="driverPassword">
            Password <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Lock size={18} />
            </div>
            <input
              id="driverPassword"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${touched.password && errors.password ? 'form-error' : ''}`}
              placeholder="Min 8 chars, 1 number"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="new-password"
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

          {/* Password Strength Indicator */}
          {formData.password && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <div style={{ height: 4, background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ height: '100%', width: `${(strength.score / 3) * 100}%`, backgroundColor: strength.color, transition: 'all 0.3s ease' }}></div>
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
          <label className="form-label" htmlFor="driverConfirmPassword">
            Confirm Password <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Lock size={18} />
            </div>
            <input
              id="driverConfirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              className={`form-input ${touched.confirmPassword && errors.confirmPassword ? 'form-error' : ''}`}
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="new-password"
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
          className="btn btn-primary"
          disabled={isSubmitting}
          style={{ width: '100%', marginTop: 'var(--space-4)' }}
        >
          {isSubmitting ? (
            <div className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
          ) : (
            <>
              Sign Up <ArrowRight size={18} />
            </>
          )}
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {onSwitchToLogin && (
            <div className="text-secondary">
              Already have an EV driver account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontWeight: 'var(--weight-semibold)',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Sign In
              </button>
            </div>
          )}

          {onSwitchToCompany && (
            <div className="text-secondary">
              Are you an EV Enterprise or Station Operator?{' '}
              <button
                type="button"
                onClick={onSwitchToCompany}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text)',
                  fontWeight: 'var(--weight-semibold)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)'
                }}
              >
                <Building2 size={16} />
                Switch to Company Portal
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
