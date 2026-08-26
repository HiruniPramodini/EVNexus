import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Zap, Building2 } from 'lucide-react';
import { loginDriver, setAuthSession } from '../services/api';

export default function DriverLoginForm({ onLoginSuccess, onSwitchToRegister, onSwitchToCompany }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
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
      const response = await loginDriver(formData);
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
          <span className="badge" style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary-600)', borderColor: 'var(--primary-200)' }}>
            <Zap size={14} className="badge-icon" />
            EV Driver Network
          </span>
        </div>
        <h1 className="card-title">Driver Sign In</h1>
        <p className="card-subtitle">
          Access your digital charging wallet, locate stations, and track fast charging sessions.
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
        {/* Driver Email */}
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address <span className="required">*</span>
          </label>
          <div className={`input-wrapper ${errors.email ? 'has-error' : ''}`}>
            <Mail size={18} className="input-icon" />
            <input
              id="email"
              type="email"
              name="email"
              placeholder="e.g. alex.driver@example.com"
              value={formData.email}
              onChange={handleChange}
              className="form-input"
              autoComplete="username"
            />
          </div>
          {errors.email && (
            <span className="field-error">{errors.email}</span>
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
              placeholder="Enter your driver account password"
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
              <span>Sign In to Driver Portal</span>
              <LogIn size={18} />
            </>
          )}
        </button>

        {/* Switch to Register or Company Portal */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
            Don't have a driver account yet?{' '}
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
              Sign Up as Driver
            </button>
          </p>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Fleet or Station Operator?{' '}
            <button
              type="button"
              onClick={onSwitchToCompany}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-700)',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Building2 size={13} />
              <span>Company Portal</span>
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}
