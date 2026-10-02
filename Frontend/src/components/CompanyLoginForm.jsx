import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck, Zap } from 'lucide-react';
import { loginCompany, setAuthSession } from '../services/api';

export default function CompanyLoginForm({ onLoginSuccess, onSwitchToRegister, onSwitchToDriver }) {
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
        setServerError(err.message || 'Invalid email or password. Please verify your credentials and try again.');
      } else {
        setServerError(err.message || 'An unexpected connection error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '440px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div className="badge" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
          <ShieldCheck size={14} className="text-secondary" />
          EVNexus Enterprise
        </div>
        <h1 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>Company Administrator</h1>
        <p className="text-secondary">
          Sign in to access your charging network analytics, fleet management, and billing dashboards.
        </p>
      </div>

      {serverError && (
        <div className="alert alert-danger">
          <AlertCircle size={20} />
          <div>
            <strong>Authentication Failed</strong>
            <p style={{ marginTop: 'var(--space-1)' }}>{serverError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Business Email */}
        <div className="form-group">
          <label htmlFor="businessEmail" className="form-label">
            Business Email
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Mail size={18} />
            </div>
            <input
              id="businessEmail"
              type="email"
              name="businessEmail"
              placeholder="e.g. admin@voltstream.com"
              value={formData.businessEmail}
              onChange={handleChange}
              className={`form-input ${errors.businessEmail ? 'form-error' : ''}`}
              autoComplete="username"
              style={{ paddingLeft: 'var(--space-10)' }}
            />
          </div>
          {errors.businessEmail && (
            <div className="form-error-msg">{errors.businessEmail}</div>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Lock size={18} />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Enter your enterprise password"
              value={formData.password}
              onChange={handleChange}
              className={`form-input ${errors.password ? 'form-error' : ''}`}
              autoComplete="current-password"
              style={{ paddingLeft: 'var(--space-10)', paddingRight: 'var(--space-10)' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <div className="form-error-msg">{errors.password}</div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn"
          disabled={isLoading}
          style={{ width: '100%', marginTop: 'var(--space-4)', backgroundColor: 'var(--color-text)', color: 'white' }}
        >
          {isLoading ? (
            <div className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
          ) : (
            <>
              Sign In as Administrator <LogIn size={18} />
            </>
          )}
        </button>

        {/* Switch to Register */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="text-secondary">
            Don't have a registered company account yet?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Register Company
            </button>
          </div>
          
          {onSwitchToDriver && (
            <div className="text-secondary">
              Are you an EV driver?{' '}
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
                Sign in as Driver
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
