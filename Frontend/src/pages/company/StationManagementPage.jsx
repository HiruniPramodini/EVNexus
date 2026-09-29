import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { RefreshCw, Plus, Zap, Edit3, Trash2, AlertTriangle, BatteryCharging, QrCode, Copy, Download, X, Search, MapPin } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { getCompanyStations, createStation, updateStation, deactivateStation, getStationQr } from '../../services/api';
import { createStationIcon } from '../../utils/leafletIcons';
import { searchNominatimLocations, reverseGeocodeNominatim } from '../../services/nominatim';

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

// Leaflet Map FlyTo Helper Component
function MapFlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && typeof center.lat === 'number' && typeof center.lng === 'number' && !isNaN(center.lat) && !isNaN(center.lng)) {
      map.flyTo([center.lat, center.lng], map.getZoom() || 14, { duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

// Leaflet Map Resize Invalidator Helper Component
function MapResizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Leaflet Map Click Event Listener Component
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Interactive Location Picker Map for Station Form
function LocationPickerMap({ formData, setFormData }) {
  const lat = parseFloat(formData.latitude);
  const lng = parseFloat(formData.longitude);
  const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  const mapCenter = hasValidCoords ? { lat, lng } : { lat: 6.9271, lng: 79.8612 };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState(null);

  // Debounced Nominatim location search effect (450ms)
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await searchNominatimLocations(searchQuery);
        setSearchResults(results);
        setShowDropdown(true);
      } catch (err) {
        console.error('Location search error:', err);
        setSearchError('Location search is temporarily unavailable.');
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLocationSelect = async (targetLat, targetLng, suggestedAddress) => {
    const latStr = targetLat.toFixed(6);
    const lngStr = targetLng.toFixed(6);

    setFormData(prev => ({
      ...prev,
      latitude: latStr,
      longitude: lngStr,
      address: suggestedAddress || prev.address
    }));

    // Reverse geocode coordinates if address was not provided directly from search
    if (!suggestedAddress) {
      setIsReverseGeocoding(true);
      setGeocodeMsg('Finding address...');
      try {
        const result = await reverseGeocodeNominatim(targetLat, targetLng);
        if (result && result.display_name) {
          setFormData(prev => ({
            ...prev,
            latitude: latStr,
            longitude: lngStr,
            address: result.display_name
          }));
          setGeocodeMsg(null);
        } else {
          setGeocodeMsg('Address lookup unavailable. You can enter the address manually.');
        }
      } catch (err) {
        console.warn('Reverse geocoding error:', err);
        setGeocodeMsg('Address lookup unavailable. You can enter the address manually.');
      } finally {
        setIsReverseGeocoding(false);
        setTimeout(() => setGeocodeMsg(null), 4000);
      }
    }
  };

  return (
    <div style={{ width: '100%', marginBottom: '1.2rem', gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
          Station Map Location Picker <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.82rem' }}>(Click map or drag marker to set location)</span>
        </label>
      </div>

      {/* Map Container Container */}
      <div style={{ width: '100%', height: '520px', position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>

        {/* Search Overlay */}
        <div style={{ position: 'absolute', top: '14px', left: '14px', right: '14px', maxWidth: '420px', zIndex: 1000 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '4px 8px', border: '1px solid #cbd5e1' }}>
            <Search size={16} color="#64748b" style={{ marginLeft: '6px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search location (e.g. Colombo, Malabe, Kandy)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 10px', fontSize: '0.88rem', color: '#1e293b', background: 'transparent' }}
            />
            {isSearching && <RefreshCw size={15} className="spinner" color="#0284c7" style={{ marginRight: '6px' }} />}
            {searchQuery && !isSearching && (
              <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b', display: 'flex' }}>
                <X size={15} />
              </button>
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div style={{ background: '#ffffff', borderRadius: '6px', boxShadow: '0 6px 16px rgba(0,0,0,0.15)', marginTop: '4px', overflow: 'hidden', border: '1px solid #cbd5e1', maxHeight: '220px', overflowY: 'auto' }}>
              {searchResults.map((res) => (
                <div
                  key={res.place_id}
                  onClick={() => {
                    const rLat = parseFloat(res.lat);
                    const rLng = parseFloat(res.lon);
                    handleLocationSelect(rLat, rLng, res.display_name);
                    setShowDropdown(false);
                    setSearchQuery('');
                  }}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#334155' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  <MapPin size={14} color="#0284c7" style={{ display: 'inline', marginRight: '6px' }} />
                  {res.display_name}
                </div>
              ))}
            </div>
          )}

          {searchError && (
            <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '6px 10px', borderRadius: '6px', marginTop: '4px', fontSize: '0.82rem' }}>
              {searchError}
            </div>
          )}
        </div>

        {/* Reverse Geocode / Status Message */}
        {geocodeMsg && (
          <div style={{ position: 'absolute', bottom: '14px', left: '14px', zIndex: 1000, background: 'rgba(15, 23, 42, 0.85)', color: '#ffffff', padding: '6px 12px', borderRadius: '20px', fontSize: '0.82rem', backdropFilter: 'blur(4px)' }}>
            {isReverseGeocoding && <RefreshCw size={13} className="spinner" style={{ display: 'inline', marginRight: '6px' }} />}
            {geocodeMsg}
          </div>
        )}

        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={hasValidCoords ? 15 : 11}
          style={{ width: '100%', height: '100%', zIndex: 1 }}
          zoomControl={true}
        >
          <MapFlyTo center={mapCenter} />
          <MapResizeInvalidator />
          <MapClickHandler onMapClick={handleLocationSelect} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {hasValidCoords && (
            <Marker
              position={[lat, lng]}
              draggable={true}
              icon={createStationIcon('#0284c7', 36)}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  handleLocationSelect(position.lat, position.lng);
                }
              }}
            >
              <Popup>
                <div style={{ padding: '4px', fontSize: '0.85rem' }}>
                  <strong>{formData.name || 'Station Location'}</strong>
                  <br />
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {lat.toFixed(6)}, {lng.toFixed(6)}
                  </span>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default function StationManagementPage() {
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

  // Charger Management State
  const [managingChargersFor, setManagingChargersFor] = useState(null);
  const [chargers, setChargers] = useState([]);
  const [chargersLoading, setChargersLoading] = useState(false);
  const [chargerForm, setChargerForm] = useState({
    type: 'CCS2',
    capacityKw: 50,
    pricePerKwh: 0.50
  });
  const [chargerError, setChargerError] = useState(null);
  const [editingChargerId, setEditingChargerId] = useState(null);
  const [deleteChargerConfirmId, setDeleteChargerConfirmId] = useState(null);

  // QR Modal State
  const [qrModalData, setQrModalData] = useState(null);

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
        setFormData(prev => ({ ...prev, latitude: parsed.lat.toFixed(6), longitude: parsed.lng.toFixed(6) }));
      } else if (parsed.latOnly !== undefined) {
        setFormData(prev => ({ ...prev, latitude: parsed.latOnly }));
      } else if (parsed.lngOnly !== undefined) {
        setFormData(prev => ({ ...prev, longitude: parsed.lngOnly }));
      }
    } else {
      setFormData(prev => ({ ...prev, latitude: val }));
    }
  };

  const handleLngChange = (e) => {
    const val = e.target.value;
    const parsed = parseCoordinates(val);
    if (parsed) {
      if (parsed.lat !== undefined && parsed.lng !== undefined) {
        setFormData(prev => ({ ...prev, latitude: parsed.lat.toFixed(6), longitude: parsed.lng.toFixed(6) }));
      } else if (parsed.latOnly !== undefined) {
        setFormData(prev => ({ ...prev, latitude: parsed.latOnly }));
      } else if (parsed.lngOnly !== undefined) {
        setFormData(prev => ({ ...prev, longitude: parsed.lngOnly }));
      }
    } else {
      setFormData(prev => ({ ...prev, longitude: val }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError("Please select a valid map location or enter valid latitude (-90 to 90) and longitude (-180 to 180).");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      ...formData,
      latitude: lat,
      longitude: lng,
      capacityKw: parseFloat(formData.capacityKw),
      pricePerKwh: parseFloat(formData.pricePerKwh)
    };

    try {
      if (isEditing) {
        await updateStation(editingId, payload);
        setSuccessMsg('Station updated successfully!');
        setShowForm(false);
        loadStations();
      } else {
        const createRes = await createStation(payload);
        setShowForm(false);
        loadStations();

        // Auto-create initial charger is NO LONGER NEEDED, Station IS the charger
        if (createRes?.id) {
          setSuccessMsg('Station created successfully!');
          const stationObj = {
            id: createRes.id,
            name: payload.name,
            address: payload.address,
            capacityKw: payload.capacityKw,
            pricePerKwh: payload.pricePerKwh,
            connectorType: payload.connectorType
          };
          handleStationViewQr(stationObj);
        } else {
          setSuccessMsg('Station created successfully!');
        }
      }
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
      latitude: station.latitude.toString(),
      longitude: station.longitude.toString(),
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

  const openChargerManager = async (station) => {
    setManagingChargersFor(station);
    setChargers([]);
    setChargerError(null);
    setChargersLoading(true);
    try {
      const res = await getStationChargers(station.id);
      setChargers(res.data || []);
    } catch (err) {
      setChargerError(err.message || 'Failed to load chargers.');
    } finally {
      setChargersLoading(false);
    }
  };

  const handleAddCharger = async (e) => {
    e.preventDefault();
    setChargerError(null);
    try {
      const payload = {
        type: chargerForm.type,
        powerKw: parseFloat(chargerForm.capacityKw),
        pricePerKwh: parseFloat(chargerForm.pricePerKwh)
      };
      const createdRes = await addChargerToStation(managingChargersFor.id, payload);
      setChargerForm({
        type: 'CCS2',
        capacityKw: 50,
        pricePerKwh: 0.50
      });
      await openChargerManager(managingChargersFor);
      if (createdRes?.id) {
        handleViewQr({ id: createdRes.id, type: payload.type, powerKw: payload.capacityKw, pricePerKwh: payload.pricePerKwh });
      }
    } catch (err) {
      setChargerError(err.message || 'Failed to add charger.');
    }
  };

  const handleEditChargerClick = (charger) => {
    setEditingChargerId(charger.id);
    setChargerForm({
      type: charger.type,
      capacityKw: charger.powerKw,
      pricePerKwh: charger.pricePerKwh,
      status: charger.status
    });
  };

  const handleCancelEditCharger = () => {
    setEditingChargerId(null);
    setChargerForm({
      type: 'CCS2',
      capacityKw: 50,
      pricePerKwh: 0.50
    });
  };

  const handleUpdateCharger = async (e) => {
    e.preventDefault();
    setChargerError(null);
    try {
      const payload = {
        type: chargerForm.type,
        powerKw: parseFloat(chargerForm.capacityKw),
        pricePerKwh: parseFloat(chargerForm.pricePerKwh),
        status: chargerForm.status || 'Available'
      };
      await updateCharger(managingChargersFor.id, editingChargerId, payload);
      setEditingChargerId(null);
      setChargerForm({
        type: 'CCS2',
        capacityKw: 50,
        pricePerKwh: 0.50
      });
      openChargerManager(managingChargersFor);
    } catch (err) {
      setChargerError(err.message || 'Failed to update charger.');
    }
  };

  const confirmDeleteCharger = async () => {
    if (!deleteChargerConfirmId) return;
    setChargerError(null);
    try {
      await deleteCharger(managingChargersFor.id, deleteChargerConfirmId);
      openChargerManager(managingChargersFor);
    } catch (err) {
      setChargerError(err.message || 'Failed to delete charger.');
    }
    setDeleteChargerConfirmId(null);
  };

  const handleStationViewQr = async (station) => {
    try {
      const res = await getStationQr(station.id);
      const payloadObj = res.data;
      setQrModalData({
        chargerId: station.id, // Station IS the charger
        chargerType: station.connectorType || 'CCS2',
        powerKw: station.capacityKw || 50,
        pricePerKwh: station.pricePerKwh || 0.50,
        stationName: station.name,
        stationAddress: station.address,
        companyName: station.tenantId || 'EVNexus Operator',
        payloadObj,
        payloadStr: JSON.stringify(payloadObj)
      });
    } catch (err) {
      alert(err.message || 'Failed to retrieve QR.');
    }
  };

  const handleDownloadQr = useCallback(() => {
    if (!qrModalData) return;
    const canvas = document.getElementById('evnexus-qr-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    const stationClean = (qrModalData.stationName || 'station').replace(/[^a-zA-Z0-9]/g, '');
    const chargerClean = (qrModalData.chargerId || 'charger').slice(0, 8);
    link.href = canvas.toDataURL('image/png');
    link.download = `EVNexus-${stationClean}-${chargerClean}.png`;
    link.click();
  }, [qrModalData]);

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <h3 className="dash-card-title">Charging Station Management</h3>
          <p className="dash-card-subtitle">Manage company stations, locations, chargers, and QR access codes.</p>
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
                    async (position) => {
                      const latVal = position.coords.latitude.toFixed(6);
                      const lngVal = position.coords.longitude.toFixed(6);
                      setFormData(prev => ({
                        ...prev,
                        latitude: latVal,
                        longitude: lngVal
                      }));
                      try {
                        const res = await reverseGeocodeNominatim(position.coords.latitude, position.coords.longitude);
                        if (res && res.display_name) {
                          setFormData(prev => ({ ...prev, address: res.display_name }));
                        }
                      } catch (e) {
                        // ignore reverse geocoding failure fallback
                      }
                    },
                    (error) => {
                      setFormData(prev => ({
                        ...prev,
                        latitude: '6.927100',
                        longitude: '79.861200'
                      }));
                      alert("Could not get location. Defaulted to Colombo.");
                    }
                  );
                } else {
                  setFormData(prev => ({
                    ...prev,
                    latitude: '6.927100',
                    longitude: '79.861200'
                  }));
                }
              }}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '0.5rem', gridColumn: '1 / -1', justifySelf: 'start' }}
            >
              <Zap size={14} style={{ display: 'inline', marginRight: '0.3rem' }}/> Auto-Fill current Location
            </button>

            {/* LEAFLET LOCATION PICKER MAP */}
            <LocationPickerMap formData={formData} setFormData={setFormData} />

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
              <input type="number" required className="form-input" value={formData.capacityKw} onChange={e => setFormData({...formData, capacityKw: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Price per kWh ($)</label>
              <input type="number" step="0.01" required className="form-input" value={formData.pricePerKwh} onChange={e => setFormData({...formData, pricePerKwh: e.target.value})} />
            </div>
          </div>

          {!isEditing && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" className="btn-secondary" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                <QrCode size={14} style={{ display: 'inline', marginRight: '0.4rem' }} /> Generate QR Code
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '1rem' }}>
                Save the station first to generate its QR code. (A default charger will be created automatically.)
              </span>
            </div>
          )}

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
                      <button className="btn-icon" title="View QR" onClick={() => handleStationViewQr(stn)}>
                        <QrCode size={15} />
                      </button>
                      <button className="btn-icon" title="Edit Station" onClick={() => handleEdit(stn)}>
                        <Edit3 size={15} />
                      </button>
                      <button className="btn-icon" title="Manage Chargers" onClick={() => openChargerManager(stn)}>
                        <BatteryCharging size={15} />
                      </button>
                      <button className="btn-icon danger" title="Deactivate Station" onClick={() => setDeleteConfirmId(stn.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CHARGER MANAGEMENT MODAL */}
      {managingChargersFor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '12px', maxWidth: '700px', width: '95%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Manage Chargers</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Station: <strong>{managingChargersFor.name}</strong> ({managingChargersFor.chargingCode})</p>
              </div>
              <button className="btn-icon" onClick={() => setManagingChargersFor(null)}><X size={18} /></button>
            </div>

            {chargerError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{chargerError}</div>}

            {/* ADD / EDIT CHARGER FORM */}
            <form onSubmit={editingChargerId ? handleUpdateCharger : handleAddCharger} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
              <h5 style={{ margin: '0 0 0.8rem 0', fontSize: '0.95rem' }}>{editingChargerId ? 'Edit Charger' : 'Add New Charger'}</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Type</label>
                  <select className="form-input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} value={chargerForm.type} onChange={e => setChargerForm({...chargerForm, type: e.target.value})}>
                    <option value="CCS2">CCS2</option>
                    <option value="CHAdeMO">CHAdeMO</option>
                    <option value="Type 2">Type 2</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Power (kW)</label>
                  <input type="number" required className="form-input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} value={chargerForm.capacityKw} onChange={e => setChargerForm({...chargerForm, capacityKw: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Price ($/kWh)</label>
                  <input type="number" step="0.01" required className="form-input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} value={chargerForm.pricePerKwh} onChange={e => setChargerForm({...chargerForm, pricePerKwh: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.8rem' }}>
                {editingChargerId && <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleCancelEditCharger}>Cancel</button>}
                <button type="submit" className="submit-btn" style={{ width: 'auto', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                  {editingChargerId ? 'Update Charger' : 'Add Charger'}
                </button>
              </div>
            </form>

            {/* CHARGERS LIST TABLE */}
            {chargersLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw className="spinner" size={20} /></div>
            ) : chargers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No chargers configured for this station. Add one above.</div>
            ) : (
              <table className="dash-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Charger ID</th>
                    <th>Type & Power</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {chargers.map(chg => (
                    <tr key={chg.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{chg.id.slice(0, 8)}...</td>
                      <td>{chg.type} ({chg.powerKw} kW)</td>
                      <td>${chg.pricePerKwh} / kWh</td>
                      <td>
                        <span className="badge" style={{ background: chg.status === 'Available' ? '#dcfce7' : '#fee2e2', color: chg.status === 'Available' ? '#166534' : '#991b1b' }}>
                          {chg.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn-icon" title="View QR" onClick={() => handleViewQr(chg)}><QrCode size={14} /></button>
                          <button className="btn-icon" title="Edit Charger" onClick={() => handleEditChargerClick(chg)}><Edit3 size={14} /></button>
                          <button className="btn-icon danger" title="Delete Charger" onClick={() => setDeleteChargerConfirmId(chg.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CHARGER MODAL */}
      {deleteChargerConfirmId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '10px', maxWidth: '380px', width: '90%' }}>
            <h4 style={{ margin: '0 0 0.8rem 0', color: '#dc2626' }}>Delete Charger?</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>Are you sure you want to delete this charger? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setDeleteChargerConfirmId(null)}>Cancel</button>
              <button className="submit-btn" style={{ background: '#dc2626', borderColor: '#dc2626', width: 'auto', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={confirmDeleteCharger}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {qrModalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#fff', padding: '1.8rem', borderRadius: '12px', maxWidth: '440px', width: '90%', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary-dark)' }}>
                <QrCode size={20} /> EVNexus Charging Point QR
              </h4>
              <button className="btn-icon" onClick={() => setQrModalData(null)}><X size={18} /></button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
              Scan/upload this QR to identify this charging point.
            </p>

            <div style={{ background: '#f8fafc', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '1rem', textAlign: 'left', fontSize: '0.83rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.2rem' }}>
                Station: {qrModalData.stationName}
              </div>
              <div style={{ color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                {qrModalData.stationAddress}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
                <span>Charger: <code style={{ fontSize: '0.8rem' }}>{qrModalData.chargerId.slice(0, 8)}...</code> ({qrModalData.chargerType} • {qrModalData.powerKw} kW)</span>
                <span style={{ fontWeight: 700, color: 'var(--color-success-dark)' }}>${qrModalData.pricePerKwh} / kWh</span>
              </div>
            </div>

            <div style={{ background: '#fff', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', display: 'inline-block', marginBottom: '1rem' }}>
              <QRCodeCanvas
                id="evnexus-qr-canvas"
                value={qrModalData.payloadStr}
                size={300}
                level="H"
                includeMargin={true}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => {
                  navigator.clipboard.writeText(qrModalData.payloadStr);
                  alert('QR payload JSON copied to clipboard!');
                }}
              >
                <Copy size={14} /> Copy JSON
              </button>
              <button
                className="submit-btn"
                style={{ width: 'auto', margin: 0, fontSize: '0.8rem', padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={handleDownloadQr}
              >
                <Download size={14} /> Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
