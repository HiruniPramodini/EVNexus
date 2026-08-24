import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck } from 'lucide-react';
import { loginCompany, setAuthSession } from '../services/api';

export default function CompanyLoginForm({ onLoginSuccess, onSwitchToRegister }) {
  const [formData, setFormData] = useState({
    businessEmail: '',
    password: ''
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.businessEmail.trim()) {
      newErrors.businessEmail = 'Business email is required.';
    } else if (!emailRegex.test(formData.businessEmail.trim())) {
      newErrors.businessEmail = 'Please enter a valid business email address.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setServerError(null);

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await loginCompany(formData);
      if (response?.success && response?.data) {
        setAuthSession(response.data);
        if (onLoginSuccess) {
          onLoginSuccess(response.data);
        }
      } else {
        setServerError(response?.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      if (err.status === 401) {
        setServerError('Invalid email or password. Please verify your credentials and try again.');
      } else {
        setServerError(err.message || 'An unexpected connection error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-card" style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div className="card-header">
        <div className="badge-wrapper">
          <span className="badge">
            <ShieldCheck size={14} className="badge-icon" />
            EVNexus Enterprise Portal
          </span>
        </div>
        <h1 className="card-title">Company Sign In</h1>
        <p className="card-subtitle">
          Authenticate your organization to access EV station network analytics, fleet management, and billing dashboards.
        </p>
      </div>

      {serverError && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} className="alert-icon" />
          <div className="alert-body">
            <strong>Authentication Failed</strong>
            <p style={{ marginTop: '0.2rem', fontSize: '0.875rem' }}>{serverError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="register-form" noValidate>
        {/* Business Email */}
        <div className="form-group">
          <label htmlFor="businessEmail" className="form-label">
            Business Email <span className="required">*</span>
          </label>
          <div className={`input-wrapper ${errors.businessEmail ? 'has-error' : ''}`}>
            <Mail size={18} className="input-icon" />
            <input
              id="businessEmail"
              type="email"
              name="businessEmail"
              placeholder="e.g. admin@voltstream.com"
              value={formData.businessEmail}
              onChange={handleChange}
              className="form-input"
              autoComplete="username"
            />
          </div>
          {errors.businessEmail && (
            <span className="field-error">{errors.businessEmail}</span>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label htmlFor="password" className="form-label" style={{ marginBottom: 0 }}>
              Password <span className="required">*</span>
            </label>
          </div>
          <div className={`input-wrapper ${errors.password ? 'has-error' : ''}`}>
            <Lock size={18} className="input-icon" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Enter your enterprise password"
              value={formData.password}
              onChange={handleChange}
              className="form-input"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <span className="field-error">{errors.password}</span>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="submit-btn"
          disabled={isLoading}
          style={{ marginTop: '1rem' }}
        >
          {isLoading ? (
            <div className="btn-spinner"></div>
          ) : (
            <>
              <span>Sign In to Company Portal</span>
              <LogIn size={18} />
            </>
          )}
        </button>

        {/* Switch to Register */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Don't have a registered company account yet?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
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
              Register Company
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}
