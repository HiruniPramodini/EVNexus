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
        <div className="badge badge-info" style={{ marginBottom: 'var(--space-4)' }}>
          <Zap size={14} />
          EV Driver Network
        </div>
        <h1 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>Welcome Back</h1>
        <p className="text-secondary">
          Sign in to access your digital charging wallet, locate stations, and track fast charging sessions.
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
        {/* Driver Email */}
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
              <Mail size={18} />
            </div>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="e.g. alex.driver@example.com"
              value={formData.email}
              onChange={handleChange}
              className={`form-input ${errors.email ? 'form-error' : ''}`}
              autoComplete="username"
              style={{ paddingLeft: 'var(--space-10)' }}
            />
          </div>
          {errors.email && (
            <div className="form-error-msg">{errors.email}</div>
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
              placeholder="Enter your driver account password"
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
          className="btn btn-primary"
          disabled={isLoading}
          style={{ width: '100%', marginTop: 'var(--space-4)' }}
        >
          {isLoading ? (
            <div className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
          ) : (
            <>
              Sign In <LogIn size={18} />
            </>
          )}
        </button>

        {/* Switch to Register or Company Portal */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="text-secondary">
            Don't have a driver account yet?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Sign Up as Driver
            </button>
          </div>

          <div className="text-secondary">
            Are you a charging company?{' '}
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
              Sign in as Company
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
