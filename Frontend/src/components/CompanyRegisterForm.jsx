import React, { useState } from 'react';
import { 
  Building2, 
  FileText, 
  Mail, 
  Phone, 
  MapPin, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Loader2, 
  ArrowRight
} from 'lucide-react';
import { registerCompany } from '../services/api';

export default function CompanyRegisterForm() {
  const [formData, setFormData] = useState({
    companyName: '',
    registrationNumber: '',
    businessEmail: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: ''
  });

  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [copiedTenantId, setCopiedTenantId] = useState(false);

  // Validate form fields
  const validateField = (name, value, allValues = formData) => {
    let error = '';
    switch (name) {
      case 'companyName':
        if (!value.trim()) error = 'Company name is required.';
        else if (value.trim().length < 2) error = 'Company name must be at least 2 characters.';
        break;
      case 'registrationNumber':
        if (!value.trim()) error = 'Business registration number is required.';
        break;
      case 'businessEmail':
        if (!value.trim()) {
          error = 'Business email is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          error = 'Please enter a valid email address.';
        }
        break;
      case 'phone':
        if (!value.trim()) {
          error = 'Phone number is required.';
        } else if (!/^[+0-9\s-]{7,20}$/.test(value.trim())) {
          error = 'Please enter a valid phone number (at least 7 digits).';
        }
        break;
      case 'address':
        if (!value.trim()) error = 'Business address is required.';
        else if (value.trim().length < 5) error = 'Address must be at least 5 characters.';
        break;
      case 'password':
        if (!value) {
          error = 'Password is required.';
        } else if (value.length < 8) {
          error = 'Password must be at least 8 characters long.';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d\s])/.test(value)) {
          error = 'Requires uppercase, lowercase, number & special character.';
        }
        break;
      case 'confirmPassword':
        if (!value) {
          error = 'Please confirm your password.';
        } else if (value !== allValues.password) {
          error = 'Passwords do not match.';
        }
        break;
      default:
        break;
    }
    return error;
  };

  const calculatePasswordStrength = (pass) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^a-zA-Z\d\s]/.test(pass)) score += 1;
    return score;
  };

  const passwordScore = calculatePasswordStrength(formData.password);

  const getStrengthLabel = (score) => {
    if (score <= 2) return { label: 'Weak', class: 'active-weak' };
    if (score <= 4) return { label: 'Moderate', class: 'active-medium' };
    return { label: 'Strong & Secure', class: 'active-strong' };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...formData, [name]: value };
    setFormData(updatedForm);
    
    if (serverError) setServerError(null);

    if (touched[name]) {
      const error = validateField(name, value, updatedForm);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }

    if (name === 'password' && touched.confirmPassword) {
      const confirmErr = validateField('confirmPassword', formData.confirmPassword, updatedForm);
      setErrors((prev) => ({ ...prev, confirmPassword: confirmErr }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    // Validate all fields
    const newErrors = {};
    const touchedAll = {};
    Object.keys(formData).forEach((key) => {
      touchedAll[key] = true;
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });

    setTouched(touchedAll);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        companyName: formData.companyName.trim(),
        registrationNumber: formData.registrationNumber.trim(),
        businessEmail: formData.businessEmail.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        password: formData.password
      };

      const response = await registerCompany(payload);
      if (response && response.success) {
        setSuccessData(response.data);
      } else {
        setServerError(response?.message || 'Registration failed.');
      }
    } catch (err) {
      if (err.status === 409) {
        setServerError(err.message || 'A company with this business email or registration number already exists.');
      } else if (err.status === 400 && err.errors?.length > 0) {
        setServerError(err.errors.join(' '));
      } else {
        setServerError(err.message || 'Unable to connect to the server. Please ensure the API Gateway is running.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyTenantId = () => {
    if (!successData?.tenantId) return;
    navigator.clipboard.writeText(successData.tenantId);
    setCopiedTenantId(true);
    setTimeout(() => setCopiedTenantId(false), 2500);
  };

  const handleReset = () => {
    setFormData({
      companyName: '',
      registrationNumber: '',
      businessEmail: '',
      phone: '',
      address: '',
      password: '',
      confirmPassword: ''
    });
    setTouched({});
    setErrors({});
    setSuccessData(null);
    setServerError(null);
  };

  if (successData) {
    return (
      <div className="register-card">
        <div className="card-top-glow" />
        <div className="success-card">
          <div className="success-icon-badge">
            <CheckCircle2 size={40} />
          </div>

          <h2 className="card-title">Tenant Profile Created!</h2>
          <p className="card-subtitle">
            {successData.companyName} has been successfully registered on the EVNexus platform.
          </p>

          <div className="tenant-id-box">
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary-700)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.15rem' }}>
                Assigned Tenant ID
              </div>
              <div className="tenant-id-code">{successData.tenantId}</div>
            </div>
            <button type="button" className="copy-btn" onClick={handleCopyTenantId} title="Copy Tenant ID">
              {copiedTenantId ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedTenantId ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="success-details-list">
            <div className="detail-row">
              <span className="detail-label">Business Email:</span>
              <span className="detail-value">{successData.businessEmail}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Registration No:</span>
              <span className="detail-value">{successData.registrationNumber}</span>
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

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="submit-btn" onClick={handleReset} style={{ margin: 0, background: 'var(--primary-600)' }}>
              <span>Register Another Company</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-card">
      <div className="card-top-glow" />
      
      <div className="card-header">
        <h1 className="card-title">Register Your Company</h1>
        <p className="card-subtitle">
          Create an isolated EV enterprise tenant to manage charging stations and fleet analytics.
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
          {/* Company Name */}
          <div className="form-group full-width">
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
                placeholder="e.g. EcoVolt Mobility Ltd."
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

          {/* Business Registration Number */}
          <div className="form-group">
            <label className="form-label" htmlFor="registrationNumber">
              <span>Business Reg. Number</span>
              <span className="required-star">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><FileText size={18} /></span>
              <input
                id="registrationNumber"
                name="registrationNumber"
                type="text"
                className={`form-input ${touched.registrationNumber && errors.registrationNumber ? 'has-error' : ''}`}
                placeholder="e.g. REG-884920"
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

          {/* Phone Number */}
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
          <div className="form-group full-width">
            <label className="form-label" htmlFor="businessEmail">
              <span>Business Email (Tenant Login)</span>
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
      </form>
    </div>
  );
}
