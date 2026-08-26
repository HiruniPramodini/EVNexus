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
  Sparkles
} from 'lucide-react';
import { registerDriver } from '../services/api';

export default function DriverRegisterForm({ onSwitchToCompany }) {
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

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'driver') {
      setCopiedDriverId(true);
      setTimeout(() => setCopiedDriverId(false), 2500);
    } else {
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
  };

  if (successData) {
    return (
      <div className="register-card animate-fade-in">
        <div className="card-top-glow" />
        <div className="success-state">
          <div className="success-icon-badge">
            <CheckCircle2 size={40} />
          </div>

          <h2 className="success-title">Driver Account Registered!</h2>
          <p className="success-subtitle">
            Your EV driver account and associated charging wallet have been created with initial balance $0.00.
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
              <span className="detail-label">Created At:</span>
              <span className="detail-value">{new Date(successData.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="submit-btn"
              onClick={handleReset}
              style={{
                margin: 0,
                background: 'var(--primary-600)',
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
                <ArrowRight size={18} />
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

        {onSwitchToCompany && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Are you an EV Enterprise or Station Operator?{' '}
              <button
                type="button"
                onClick={onSwitchToCompany}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-600)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Switch to Company Portal
              </button>
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
