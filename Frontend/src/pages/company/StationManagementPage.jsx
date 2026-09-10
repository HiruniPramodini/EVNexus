import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Zap, Edit3, Trash2, AlertTriangle } from 'lucide-react';
import { getCompanyStations, createStation, updateStation, deactivateStation } from '../../services/api';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB_O1v5DjPx3HeTaQGuM6o6CdRd5VgCxIk';

function parseCoordinates(input) {
  if (!input || typeof input !== 'string') return null;

  const decimalMatch = input.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
  if (decimalMatch) {
    return { lat: parseFloat(decimalMatch[1]), lng: parseFloat(decimalMatch[2]) };
  }
  
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+([\d.]+)"?\s*([NSns])\s*[,]?\s*(\d+)[°\s]+(\d+)['\s]+([\d.]+)"?\s*([EWew])/i;
  const dmsMatch = input.match(dmsRegex);
  
  if (dmsMatch) {
    let lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2])/60 + parseFloat(dmsMatch[3])/3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
    
    let lng = parseInt(dmsMatch[5]) + parseInt(dmsMatch[6])/60 + parseFloat(dmsMatch[7])/3600;
    if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;
    
    return { lat: lat, lng: lng };
  }

  const singleDmsRegex = /^\s*(\d+)[°\s]+(\d+)['\s]+([\d.]+)"?\s*([NSnsEWew])\s*$/i;
  const singleMatch = input.match(singleDmsRegex);
  if (singleMatch) {
    let val = parseInt(singleMatch[1]) + parseInt(singleMatch[2])/60 + parseFloat(singleMatch[3])/3600;
    const dir = singleMatch[4].toUpperCase();
    if (dir === 'S' || dir === 'W') val = -val;
    
    if (dir === 'N' || dir === 'S') return { latOnly: val.toFixed(6) };
    if (dir === 'E' || dir === 'W') return { lngOnly: val.toFixed(6) };
  }

  return null;
}

export default function StationManagementPage() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const initialFormState = {
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    connectorType: 'CCS2',
    capacityKw: 50,
    pricePerKwh: 0.50
  };
  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    setLoading(true);
    try {
      const res = await getCompanyStations();
      setStations(res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load stations.');
    } finally {
      setLoading(false);
    }
  };

  const handleLatChange = (e) => {
    const val = e.target.value;
    const parsed = parseCoordinates(val);
    if (parsed) {
      if (parsed.lat !== undefined && parsed.lng !== undefined) {
        setFormData({...formData, latitude: parsed.lat.toFixed(6), longitude: parsed.lng.toFixed(6)});
      } else if (parsed.latOnly !== undefined) {
        setFormData({...formData, latitude: parsed.latOnly});
      } else if (parsed.lngOnly !== undefined) {
        setFormData({...formData, longitude: parsed.lngOnly});
      }
    } else {
      setFormData({...formData, latitude: val});
    }
  };

  const handleLngChange = (e) => {
    const val = e.target.value;
    const parsed = parseCoordinates(val);
    if (parsed) {
      if (parsed.lat !== undefined && parsed.lng !== undefined) {
        setFormData({...formData, latitude: parsed.lat.toFixed(6), longitude: parsed.lng.toFixed(6)});
      } else if (parsed.latOnly !== undefined) {
        setFormData({...formData, latitude: parsed.latOnly});
      } else if (parsed.lngOnly !== undefined) {
        setFormData({...formData, longitude: parsed.lngOnly});
      }
    } else {
      setFormData({...formData, longitude: val});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      ...formData,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      capacityKw: parseFloat(formData.capacityKw),
      pricePerKwh: parseFloat(formData.pricePerKwh)
    };

    if (isNaN(payload.latitude) || isNaN(payload.longitude)) {
      setError("Please ensure latitude and longitude are properly formatted numbers.");
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEditing) {
        await updateStation(editingId, payload);
        setSuccessMsg('Station updated successfully!');
      } else {
        await createStation(payload);
        setSuccessMsg('Station created successfully!');
      }
      setShowForm(false);
      loadStations();
    } catch (err) {
      setError(err.message || 'Failed to save station.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (station) => {
    setIsEditing(true);
    setEditingId(station.id);
    setFormData({
      name: station.name,
      address: station.address,
      latitude: station.latitude,
      longitude: station.longitude,
      connectorType: station.connectorType,
      capacityKw: station.capacityKw,
      pricePerKwh: station.pricePerKwh
    });
    setShowForm(true);
  };

  const confirmDeactivate = async () => {
    if (!deleteConfirmId) return;
    try {
      await deactivateStation(deleteConfirmId);
      setSuccessMsg('Station deactivated successfully!');
      loadStations();
    } catch (err) {
      setError(err.message || 'Failed to deactivate station.');
    }
    setDeleteConfirmId(null);
  };

  const renderMapPreview = () => {
    if (!isLoaded) return null;

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    const hasValidCoords = !isNaN(lat) && !isNaN(lng);

    const center = hasValidCoords ? { lat, lng } : { lat: 6.9271, lng: 79.8612 };

    return (
      <div style={{ width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', marginTop: '1rem', border: '1px solid var(--border-subtle)' }}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={hasValidCoords ? 15 : 10}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
          }}
          onClick={(e) => {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            setFormData({
              ...formData,
              latitude: newLat.toFixed(6),
              longitude: newLng.toFixed(6)
            });
          }}
        >
          {hasValidCoords && (
            <Marker 
              position={center}
              draggable={true}
              onDragEnd={(e) => {
                setFormData({
                  ...formData,
                  latitude: e.latLng.lat().toFixed(6),
                  longitude: e.latLng.lng().toFixed(6)
                });
              }}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'),
                scaledSize: window.google ? new window.google.maps.Size(32, 32) : null,
                origin: window.google ? new window.google.maps.Point(0, 0) : null,
                anchor: window.google ? new window.google.maps.Point(16, 32) : null
              }}
            />
          )}
        </GoogleMap>
      </div>
    );
  };

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <h3 className="dash-card-title">
            <Zap size={18} color="var(--primary-600)" />
            Charging Station Network
          </h3>
          <p className="dash-card-subtitle">Manage your isolated charging infrastructure.</p>
        </div>
        <button
          className="submit-btn"
          style={{ width: 'auto', margin: 0, padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
          onClick={() => {
            setIsEditing(false);
            setFormData(initialFormState);
            setShowForm(true);
          }}
        >
          <Plus size={15} /> Add Station
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
      {successMsg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{successMsg}</div>}

      {deleteConfirmId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '12px', maxWidth: '400px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', color: '#dc2626' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Deactivate Station?</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you sure you want to deactivate this charging station? It will immediately disappear from the driver map and users will not be able to charge here.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
              <button className="btn-secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button className="submit-btn" style={{ background: '#dc2626', borderColor: '#dc2626', width: 'auto', margin: 0 }} onClick={confirmDeactivate}>
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="dash-form" style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: '#f8fafc' }}>
          <h4 style={{ marginBottom: '1rem' }}>{isEditing ? 'Edit Station' : 'Add New Station'}</h4>
          
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Station Name</label>
              <input type="text" required className="form-input" disabled={isEditing} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input type="text" required className="form-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Latitude</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.latitude}
                  onChange={handleLatChange}
                  placeholder="e.g. 6.927100 or 6°54'45.4&quot;N"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Longitude</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.longitude}
                  onChange={handleLngChange}
                  placeholder="e.g. 79.861200"
                  required
                />
              </div>
            </div>
            
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      setFormData({
                        ...formData,
                        latitude: position.coords.latitude.toFixed(6),
                        longitude: position.coords.longitude.toFixed(6)
                      });
                    },
                    (error) => {
                      setFormData({
                        ...formData,
                        latitude: '6.927100',
                        longitude: '79.861200'
                      });
                      alert("Could not get location. Defaulted to Colombo.");
                    }
                  );
                } else {
                  setFormData({
                    ...formData,
                    latitude: '6.927100',
                    longitude: '79.861200'
                  });
                }
              }}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '0.5rem', gridColumn: '1 / -1', justifySelf: 'start' }}
            >
              <Zap size={14} style={{ display: 'inline', marginRight: '0.3rem' }}/> Auto-Fill current Location
            </button>

            <div style={{ gridColumn: '1 / -1' }}>
              {renderMapPreview()}
            </div>

            <div className="form-group">
              <label className="form-label">Connector Type</label>
              <select className="form-input" value={formData.connectorType} onChange={e => setFormData({...formData, connectorType: e.target.value})}>
                <option value="CCS2">CCS2</option>
                <option value="CHAdeMO">CHAdeMO</option>
                <option value="Type 2">Type 2</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Capacity (kW)</label>
              <input type="number" step="0.1" required className="form-input" value={formData.capacityKw} onChange={e => setFormData({...formData, capacityKw: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Price per kWh ($)</label>
              <input type="number" step="0.01" required className="form-input" value={formData.pricePerKwh} onChange={e => setFormData({...formData, pricePerKwh: e.target.value})} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="submit-btn" style={{ width: 'auto', margin: 0 }} disabled={isSubmitting}>
              {isSubmitting ? <RefreshCw className="spinner" size={14} /> : 'Save'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw className="spinner" size={24} /></div>
      ) : (
        <div className="dash-table-wrapper">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Station Code</th>
                <th>Name & Location</th>
                <th>Details</th>
                <th>Pricing</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stations.filter(s => s.isActive).map(stn => (
                <tr key={stn.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-700)' }}>{stn.chargingCode}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{stn.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stn.address}</div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                      {stn.connectorType}
                    </span>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>{stn.capacityKw} kW</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>${stn.pricePerKwh} / kWh</td>
                  <td>
                    <span className="badge" style={{ 
                      background: '#dcfce7',
                      color: '#166534'
                    }}>
                      Active
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-secondary" style={{ padding: '0.3rem', minWidth: 'auto', margin: 0 }} onClick={() => handleEdit(stn)}>
                        <Edit3 size={16} />
                      </button>
                      <button className="btn-secondary" style={{ padding: '0.3rem', minWidth: 'auto', margin: 0, color: '#dc2626' }} onClick={() => setDeleteConfirmId(stn.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {stations.filter(s => s.isActive).length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No stations found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
