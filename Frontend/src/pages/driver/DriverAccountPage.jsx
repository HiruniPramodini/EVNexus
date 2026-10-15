import React, { useState, useEffect } from 'react';
import { 
  User, Car, Shield, Mail, Phone, Calendar, Edit3, Trash2, Plus, 
  CheckCircle2, AlertTriangle, Save, X, RefreshCw, Star, Lock
} from 'lucide-react';
import { 
  getDriverProfile, updateDriverProfile, updateStoredUser, 
  getDriverVehicles, addDriverVehicle, updateDriverVehicle, 
  deleteDriverVehicle, setDefaultDriverVehicle, changeDriverPassword
} from '../../services/api';

export default function DriverAccountPage({ authUser, onUpdateProfile, initialTab = 'profile' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Profile State
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: ''
  });

  // Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  // Vehicles State
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicleError, setVehicleError] = useState(null);
  const [vehicleSuccess, setVehicleSuccess] = useState(null);

  // Add / Edit Vehicle Modal State
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
  const [vehicleFormError, setVehicleFormError] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({
    make: '',
    model: '',
    plateNumber: '',
    connectorType: 'CCS2',
    isDefault: false
  });

  // Delete Vehicle Confirmation Modal
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);

  useEffect(() => {
    loadProfileData();
    loadVehiclesData();
  }, []);

  const loadProfileData = async () => {
    setLoadingProfile(true);
    try {
      const res = await getDriverProfile(authUser?.accessToken);
      const data = res?.data || res || {};
      setProfile(data);
      setProfileForm({
        name: data.name || authUser?.name || '',
        phone: data.phone || authUser?.phone || ''
      });
    } catch (err) {
      console.warn('Failed to fetch full driver profile, falling back to authUser', err);
      const fallback = {
        name: authUser?.name || 'EV Driver',
        email: authUser?.email || '',
        phone: authUser?.phone || '',
        driverId: authUser?.driverId || 'DRV-PRIMARY',
        createdAt: authUser?.createdAt || new Date().toISOString()
      };
      setProfile(fallback);
      setProfileForm({
        name: fallback.name,
        phone: fallback.phone
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadVehiclesData = async () => {
    setLoadingVehicles(true);
    setVehicleError(null);
    try {
      const res = await getDriverVehicles(authUser?.accessToken);
      const list = res?.data || (Array.isArray(res) ? res : []);
      setVehicles(list);
    } catch (err) {
      console.warn('Could not load vehicles from API', err);
      setVehicleError(err.message || 'Failed to load registered vehicles.');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      setProfileError('Driver name is required.');
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const payload = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim()
      };
      const res = await updateDriverProfile(payload, authUser?.accessToken);
      const updated = res?.data || payload;

      setProfile((prev) => ({ ...prev, ...updated }));
      setIsEditingProfile(false);
      setProfileSuccess('Profile details saved successfully.');

      if (onUpdateProfile) {
        onUpdateProfile(updated);
      } else {
        updateStoredUser({ ...authUser, ...updated });
      }

      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile changes.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      await changeDriverPassword(passwordForm.currentPassword, passwordForm.newPassword, authUser?.accessToken);
      setPasswordSuccess('Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(null);
      }, 2000);
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Vehicle Handlers
  const handleOpenAddVehicle = () => {
    setIsEditingVehicle(false);
    setEditingVehicleId(null);
    setVehicleForm({
      make: '',
      model: '',
      plateNumber: '',
      connectorType: 'CCS2',
      isDefault: vehicles.length === 0
    });
    setVehicleFormError(null);
    setShowVehicleModal(true);
  };

  const handleOpenEditVehicle = (veh) => {
    setIsEditingVehicle(true);
    setEditingVehicleId(veh.vehicleId || veh.id);
    setVehicleForm({
      make: veh.make || '',
      model: veh.model || '',
      plateNumber: veh.plateNumber || '',
      connectorType: veh.connectorType || 'CCS2',
      isDefault: Boolean(veh.isDefault)
    });
    setVehicleFormError(null);
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (!vehicleForm.make.trim() || !vehicleForm.model.trim() || !vehicleForm.plateNumber.trim()) {
      setVehicleFormError('Please fill in vehicle make, model, and registration plate number.');
      return;
    }

    setIsSubmittingVehicle(true);
    setVehicleFormError(null);

    try {
      const payload = {
        make: vehicleForm.make.trim(),
        model: vehicleForm.model.trim(),
        plateNumber: vehicleForm.plateNumber.trim().toUpperCase(),
        connectorType: vehicleForm.connectorType,
        isDefault: vehicleForm.isDefault
      };

      if (isEditingVehicle) {
        await updateDriverVehicle(editingVehicleId, payload, authUser?.accessToken);
        setVehicleSuccess('Vehicle updated successfully.');
      } else {
        await addDriverVehicle(payload, authUser?.accessToken);
        setVehicleSuccess('Vehicle registered successfully.');
      }

      setShowVehicleModal(false);
      await loadVehiclesData();
      setTimeout(() => setVehicleSuccess(null), 4000);
    } catch (err) {
      setVehicleFormError(err.message || 'Failed to save vehicle.');
    } finally {
      setIsSubmittingVehicle(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    setIsDeletingVehicle(true);
    try {
      await deleteDriverVehicle(vehicleId, authUser?.accessToken);
      setVehicleSuccess('Vehicle removed successfully.');
      setDeleteConfirmId(null);
      await loadVehiclesData();
      setTimeout(() => setVehicleSuccess(null), 4000);
    } catch (err) {
      setVehicleError(err.message || 'Failed to delete vehicle.');
    } finally {
      setIsDeletingVehicle(false);
    }
  };

  const handleSetDefaultVehicle = async (vehicleId) => {
    try {
      await setDefaultDriverVehicle(vehicleId, authUser?.accessToken);
      setVehicleSuccess('Default charging vehicle updated.');
      await loadVehiclesData();
      setTimeout(() => setVehicleSuccess(null), 3000);
    } catch (err) {
      setVehicleError(err.message || 'Failed to set default vehicle.');
    }
  };

  return (
    <div className="dash-container animate-fade-in" style={{ maxWidth: '1080px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <User size={26} color="var(--primary-600)" />
          Driver Account & Vehicles
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
          Manage your personal driver profile, credentials, and registered electric vehicles for seamless charging.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '0.75rem 1.4rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeTab === 'profile' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <User size={18} />
          Personal Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vehicles')}
          style={{
            padding: '0.75rem 1.4rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vehicles' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeTab === 'vehicles' ? 'var(--primary-600)' : 'var(--text-muted)',
            fontWeight: activeTab === 'vehicles' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Car size={18} />
          My Vehicles ({vehicles.length})
        </button>
      </div>

      {/* Global Alerts */}
      {profileSuccess && (
        <div className="alert alert-success animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{profileSuccess}</span>
        </div>
      )}
      {profileError && (
        <div className="alert alert-danger animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} />
          <span>{profileError}</span>
        </div>
      )}
      {vehicleSuccess && (
        <div className="alert alert-success animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} />
          <span>{vehicleSuccess}</span>
        </div>
      )}
      {vehicleError && (
        <div className="alert alert-danger animate-fade-in" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} />
          <span>{vehicleError}</span>
        </div>
      )}

      {/* TAB 1: PERSONAL PROFILE */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="dash-card">
            <div className="dash-card-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.2rem', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="dash-avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                    {(profile?.name || authUser?.name || 'D').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                      {profile?.name || authUser?.name || 'EV Driver'}
                    </h2>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                      Driver Identifier: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{profile?.driverId || authUser?.driverId || 'DRV-PRIMARY'}</span>
                    </div>
                  </div>
                </div>

                {!isEditingProfile && (
                  <button
                    type="button"
                    className="submit-btn"
                    style={{ width: 'auto', margin: 0, padding: '0.55rem 1.2rem', fontSize: '0.85rem' }}
                    onClick={() => setIsEditingProfile(true)}
                  >
                    <Edit3 size={15} style={{ display: 'inline', marginRight: '0.3rem' }} />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {!isEditingProfile ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    <Mail size={15} color="var(--primary-600)" />
                    Account Email Address
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.3rem' }}>
                    {profile?.email || authUser?.email || 'N/A'}
                  </div>
                  <span className="badge badge-success" style={{ marginTop: '0.4rem', display: 'inline-flex', fontSize: '0.75rem' }}>
                    <Shield size={11} /> Verified Account
                  </span>
                </div>

                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    <Phone size={15} color="var(--primary-600)" />
                    Mobile Phone Number
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.3rem' }}>
                    {profile?.phone || authUser?.phone || 'Not provided'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Used for SMS session receipts and wallet alerts
                  </div>
                </div>

                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    <Calendar size={15} color="var(--primary-600)" />
                    Member Since
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.3rem' }}>
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Active Member'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Standard Sri Lanka Network Access
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      className="form-input"
                      placeholder="e.g. Kasun Perera"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Mobile Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="form-input"
                      placeholder="e.g. 0771234567"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileForm({
                        name: profile?.name || '',
                        phone: profile?.phone || ''
                      });
                    }}
                    disabled={isSavingProfile}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={isSavingProfile}
                    style={{ width: 'auto', margin: 0, padding: '0.55rem 1.4rem' }}
                  >
                    {isSavingProfile ? (
                      <>
                        <RefreshCw size={14} className="spinner" style={{ display: 'inline', marginRight: '0.3rem' }} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Security & Password Card */}
          <div className="dash-card">
            <div className="dash-card-header" style={{ marginBottom: 0 }}>
              <div>
                <h3 className="dash-card-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock size={18} color="var(--primary-600)" />
                  Account Security & Password
                </h3>
                <p className="dash-card-subtitle" style={{ margin: 0 }}>
                  Manage your secure login password and account credentials.
                </p>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowPasswordModal(true)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY VEHICLES */}
      {activeTab === 'vehicles' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Registered Electric Vehicles
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                Vehicles configured with your account for plug compatibility checks and session telemetry.
              </p>
            </div>

            <button
              type="button"
              className="submit-btn"
              onClick={handleOpenAddVehicle}
              style={{ width: 'auto', margin: 0, padding: '0.55rem 1.25rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} />
              Add Vehicle
            </button>
          </div>

          {loadingVehicles ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spinner" style={{ marginBottom: '0.6rem' }} />
              <div>Loading your vehicles...</div>
            </div>
          ) : vehicles.length === 0 ? (
            /* Sensible Empty State */
            <div className="dash-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', border: '2px dashed var(--border-subtle)', background: '#f8fafc' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                <Car size={32} color="var(--primary-600)" />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: 'var(--text-main)' }}>
                No vehicles registered yet
              </h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.88rem', lineHeight: 1.5 }}>
                Add your electric vehicle to receive tailored charging station recommendations and verify plug connector compatibility before you arrive.
              </p>
              <button
                type="button"
                className="submit-btn"
                onClick={handleOpenAddVehicle}
                style={{ width: 'auto', margin: '0 auto', padding: '0.6rem 1.4rem' }}
              >
                <Plus size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
                Add Your First Vehicle
              </button>
            </div>
          ) : (
            /* Vehicles Grid */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {vehicles.map((veh) => {
                const vehId = veh.vehicleId || veh.id;
                const isDefault = Boolean(veh.isDefault);

                return (
                  <div key={vehId} className="dash-card" style={{ position: 'relative', border: isDefault ? '2px solid var(--primary-600)' : '1px solid var(--border-subtle)' }}>
                    {isDefault && (
                      <span className="badge badge-success" style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Star size={11} fill="currentColor" /> Default Vehicle
                      </span>
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', marginBottom: '1rem' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Car size={24} color="var(--primary-600)" />
                      </div>
                      <div style={{ paddingRight: isDefault ? '80px' : 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                          {veh.make} {veh.model}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: '#0369a1', marginTop: '0.2rem' }}>
                          {veh.plateNumber}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '1rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Connector</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{veh.connectorType || 'CCS2'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Registered</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {veh.createdAt ? new Date(veh.createdAt).toLocaleDateString() : 'Active'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                      {!isDefault ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleSetDefaultVehicle(vehId)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                        >
                          Set as Default
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Primary for charging</span>
                      )}

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleOpenEditVehicle(veh)}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                          title="Edit vehicle"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setDeleteConfirmId(vehId)}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: '#dc2626' }}
                          title="Delete vehicle"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT VEHICLE MODAL */}
      {showVehicleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', maxWidth: '480px', width: '90%', padding: '1.75rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.8rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Car size={20} color="var(--primary-600)" />
                {isEditingVehicle ? 'Edit Vehicle Details' : 'Register New Vehicle'}
              </h3>
              <button
                type="button"
                onClick={() => setShowVehicleModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {vehicleFormError && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <AlertTriangle size={15} />
                <span>{vehicleFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Vehicle Make *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nissan, Tesla, Hyundai, BYD, MG"
                  value={vehicleForm.make}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Vehicle Model *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Leaf, Model 3, Kona Electric, Atto 3"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>License Plate Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WP CA-1234 or CBF-5678"
                  value={vehicleForm.plateNumber}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value.toUpperCase() })}
                  className="form-input"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Connector Port Compatibility *</label>
                <select
                  value={vehicleForm.connectorType}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, connectorType: e.target.value })}
                  className="form-input"
                >
                  <option value="CCS2">CCS2 (DC Fast & AC Type 2)</option>
                  <option value="CHAdeMO">CHAdeMO (DC Fast)</option>
                  <option value="Type 2">Type 2 (Mennekes AC)</option>
                  <option value="GB/T">GB/T (China Standard)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.3rem' }}>
                <input
                  type="checkbox"
                  id="vehIsDefault"
                  checked={vehicleForm.isDefault}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, isDefault: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="vehIsDefault" style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer' }}>
                  Set as my default vehicle for charging sessions
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSubmittingVehicle}
                  onClick={() => setShowVehicleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isSubmittingVehicle}
                  style={{ width: 'auto', margin: 0, padding: '0.55rem 1.3rem' }}
                >
                  {isSubmittingVehicle ? 'Saving...' : (isEditingVehicle ? 'Update Vehicle' : 'Register Vehicle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE VEHICLE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', maxWidth: '400px', width: '90%', padding: '1.75rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#dc2626', marginBottom: '0.8rem' }}>
              <AlertTriangle size={22} />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Remove Vehicle?</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.3rem' }}>
              Are you sure you want to remove this vehicle from your account? This will not affect historical charging records.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isDeletingVehicle}
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="submit-btn"
                disabled={isDeletingVehicle}
                style={{ background: '#dc2626', borderColor: '#dc2626', width: 'auto', margin: 0 }}
                onClick={() => handleDeleteVehicle(deleteConfirmId)}
              >
                {isDeletingVehicle ? 'Deleting...' : 'Yes, Remove Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', maxWidth: '440px', width: '90%', padding: '1.75rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.8rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={18} color="var(--primary-600)" />
                Change Password
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {passwordSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <CheckCircle2 size={15} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <AlertTriangle size={15} />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="form-input"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.8rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={passwordLoading}
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={passwordLoading}
                  style={{ width: 'auto', margin: 0, padding: '0.55rem 1.3rem' }}
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
