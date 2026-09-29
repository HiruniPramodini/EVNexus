import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Plus,
  Zap,
  Edit3,
  Trash2,
  AlertTriangle,
  MapPin,
  Search,
  Eye,
  Check,
  X,
  Compass,
  DollarSign,
  Clock,
  Wifi,
  Coffee,
  Utensils,
  Car,
  Layers,
  ArrowRight,
  ArrowLeft,
  Info,
  CheckCircle2,
  Copy
} from 'lucide-react';
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
    let lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;

    let lng = parseInt(dmsMatch[5]) + parseInt(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;

    return { lat, lng };
  }

  const singleDmsRegex = /^\s*(\d+)[°\s]+(\d+)['\s]+([\d.]+)"?\s*([NSnsEWew])\s*$/i;
  const singleMatch = input.match(singleDmsRegex);
  if (singleMatch) {
    let val = parseInt(singleMatch[1]) + parseInt(singleMatch[2]) / 60 + parseFloat(singleMatch[3]) / 3600;
    const dir = singleMatch[4].toUpperCase();
    if (dir === 'S' || dir === 'W') val = -val;

    if (dir === 'N' || dir === 'S') return { latOnly: val.toFixed(6) };
    if (dir === 'E' || dir === 'W') return { lngOnly: val.toFixed(6) };
  }

  return null;
}

const AVAILABLE_AMENITIES = [
  { id: 'parking', label: 'Parking', icon: <Car size={16} /> },
  { id: 'wifi', label: 'Wi-Fi', icon: <Wifi size={16} /> },
  { id: 'restroom', label: 'Restroom', icon: <Info size={16} /> },
  { id: 'cafe', label: 'Cafe', icon: <Coffee size={16} /> },
  { id: 'restaurant', label: 'Restaurant', icon: <Utensils size={16} /> }
];

export default function StationManagementPage() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [connectorFilter, setConnectorFilter] = useState('ALL');
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  // Modals & Wizard State
  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Location, 2: Station Information

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsStation, setDetailsStation] = useState(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form State for Multi-Step Wizard
  const initialFormState = {
    name: '',
    address: '',
    description: '',
    operatingHours: '24/7 Open',
    latitude: '6.927100',
    longitude: '79.861200',
    connectorType: 'CCS2',
    capacityKw: 60,
    pricePerKwh: 0.45,
    // Dynamic pricing
    enableDynamicPricing: false,
    peakPricePerKwh: 0.65,
    offPeakPricePerKwh: 0.35,
    peakStartTime: '18:00',
    peakEndTime: '22:00',
    // Amenities
    amenities: ['parking', 'wifi']
  };

  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Address search query helper in wizard
  const [addressSearchInput, setAddressSearchInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyStations();
      setStations(res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load company stations.');
    } finally {
      setLoading(false);
    }
  };

  // KPI Calculations
  const activeStations = useMemo(() => stations.filter((s) => s.isActive !== false), [stations]);
  const totalCapacity = useMemo(() => activeStations.reduce((sum, s) => sum + (parseFloat(s.capacityKw) || 0), 0), [activeStations]);
  const avgPrice = useMemo(() => {
    if (activeStations.length === 0) return 0;
    const sum = activeStations.reduce((acc, s) => acc + (parseFloat(s.pricePerKwh) || 0), 0);
    return (sum / activeStations.length).toFixed(2);
  }, [activeStations]);

  // Filtered stations for table
  const filteredStations = useMemo(() => {
    return stations.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.chargingCode?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesConnector =
        connectorFilter === 'ALL' || s.connectorType?.toUpperCase() === connectorFilter.toUpperCase();

      return matchesSearch && matchesConnector;
    });
  }, [stations, searchQuery, connectorFilter]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // ----------------------------------------------------
  // MULTI-STEP WIZARD LOGIC
  // ----------------------------------------------------
  const handleOpenAddWizard = () => {
    setFormData(initialFormState);
    setCurrentStep(1);
    setError(null);
    setSuccessMsg(null);
    setShowWizard(true);
  };

  const handleLatChange = (e) => {
    const val = e.target.value;
    const parsed = parseCoordinates(val);
    if (parsed) {
      if (parsed.lat !== undefined && parsed.lng !== undefined) {
        setFormData({ ...formData, latitude: parsed.lat.toFixed(6), longitude: parsed.lng.toFixed(6) });
      } else if (parsed.latOnly !== undefined) {
        setFormData({ ...formData, latitude: parsed.latOnly });
      } else if (parsed.lngOnly !== undefined) {
        setFormData({ ...formData, longitude: parsed.lngOnly });
      }
    } else {
      setFormData({ ...formData, latitude: val });
    }
  };

  const handleLngChange = (e) => {
    const val = e.target.value;
    const parsed = parseCoordinates(val);
    if (parsed) {
      if (parsed.lat !== undefined && parsed.lng !== undefined) {
        setFormData({ ...formData, latitude: parsed.lat.toFixed(6), longitude: parsed.lng.toFixed(6) });
      } else if (parsed.latOnly !== undefined) {
        setFormData({ ...formData, latitude: parsed.latOnly });
      } else if (parsed.lngOnly !== undefined) {
        setFormData({ ...formData, longitude: parsed.lngOnly });
      }
    } else {
      setFormData({ ...formData, longitude: val });
    }
  };

  const handleAutoDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData({
            ...formData,
            latitude: pos.coords.latitude.toFixed(6),
            longitude: pos.coords.longitude.toFixed(6)
          });
        },
        (err) => {
          console.warn('Geolocation failed', err);
          alert('Could not retrieve current location.');
        }
      );
    }
  };

  const handleAddressSearch = () => {
    if (!addressSearchInput.trim() || !window.google?.maps?.Geocoder) return;
    setIsGeocoding(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: addressSearchInput }, (results, status) => {
      setIsGeocoding(false);
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        setFormData({
          ...formData,
          address: results[0].formatted_address || addressSearchInput,
          latitude: loc.lat().toFixed(6),
          longitude: loc.lng().toFixed(6)
        });
      } else {
        alert('Could not find location coordinates for that address.');
      }
    });
  };

  const toggleAmenity = (amenityId) => {
    setFormData((prev) => {
      const exists = prev.amenities?.includes(amenityId);
      const updated = exists
        ? prev.amenities.filter((a) => a !== amenityId)
        : [...(prev.amenities || []), amenityId];
      return { ...prev, amenities: updated };
    });
  };

  const handleNextStep = (e) => {
    e?.preventDefault();
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please provide valid decimal or DMS coordinates for Step 1.');
      return;
    }
    setCurrentStep(2);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      name: formData.name.trim(),
      address: formData.address.trim(),
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      connectorType: formData.connectorType,
      capacityKw: parseFloat(formData.capacityKw),
      pricePerKwh: parseFloat(formData.pricePerKwh),
      peakPricePerKwh: formData.enableDynamicPricing ? parseFloat(formData.peakPricePerKwh) : null,
      offPeakPricePerKwh: formData.enableDynamicPricing ? parseFloat(formData.offPeakPricePerKwh) : null,
      peakStartTime: formData.enableDynamicPricing ? formData.peakStartTime : null,
      peakEndTime: formData.enableDynamicPricing ? formData.peakEndTime : null
    };

    if (isNaN(payload.latitude) || isNaN(payload.longitude)) {
      setError('Please ensure latitude and longitude are valid numbers.');
      setIsSubmitting(false);
      return;
    }

    try {
      await createStation(payload);
      setSuccessMsg(`Station "${payload.name}" successfully created!`);
      setShowWizard(false);
      loadStations();
    } catch (err) {
      setError(err.message || 'Failed to create charging station.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // EDIT STATION LOGIC
  // ----------------------------------------------------
  const handleOpenEdit = (station) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      address: station.address,
      latitude: String(station.latitude),
      longitude: String(station.longitude),
      connectorType: station.connectorType || 'CCS2',
      capacityKw: station.capacityKw || 50,
      pricePerKwh: station.pricePerKwh || 0.45,
      enableDynamicPricing: Boolean(station.peakPricePerKwh),
      peakPricePerKwh: station.peakPricePerKwh || 0.65,
      offPeakPricePerKwh: station.offPeakPricePerKwh || 0.35,
      peakStartTime: station.peakStartTime || '18:00',
      peakEndTime: station.peakEndTime || '22:00',
      amenities: ['parking', 'wifi']
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStation) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      address: formData.address.trim(),
      connectorType: formData.connectorType,
      capacityKw: parseFloat(formData.capacityKw),
      pricePerKwh: parseFloat(formData.pricePerKwh),
      peakPricePerKwh: formData.enableDynamicPricing ? parseFloat(formData.peakPricePerKwh) : null,
      offPeakPricePerKwh: formData.enableDynamicPricing ? parseFloat(formData.offPeakPricePerKwh) : null,
      peakStartTime: formData.enableDynamicPricing ? formData.peakStartTime : null,
      peakEndTime: formData.enableDynamicPricing ? formData.peakEndTime : null
    };

    try {
      await updateStation(editingStation.id, payload);
      setSuccessMsg(`Station "${editingStation.name}" updated successfully!`);
      setShowEditModal(false);
      setEditingStation(null);
      loadStations();
    } catch (err) {
      setError(err.message || 'Failed to update station.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // DEACTIVATE STATION LOGIC
  // ----------------------------------------------------
  const confirmDeactivate = async () => {
    if (!deleteConfirmId) return;
    try {
      await deactivateStation(deleteConfirmId);
      setSuccessMsg('Charging station deactivated successfully.');
      loadStations();
    } catch (err) {
      setError(err.message || 'Failed to deactivate station.');
    }
    setDeleteConfirmId(null);
  };

  // ----------------------------------------------------
  // DETAILS MODAL LOGIC
  // ----------------------------------------------------
  const handleOpenDetails = (station) => {
    setDetailsStation(station);
    setShowDetailsModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header & KPI Overview */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <Zap size={24} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Active Stations</div>
            <div className="kpi-value">{activeStations.length}</div>
            <div className="kpi-subtext">Online & discoverable</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-green">
            <Layers size={24} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Combined Capacity</div>
            <div className="kpi-value">{totalCapacity.toFixed(0)} <span style={{ fontSize: '0.9rem' }}>kW</span></div>
            <div className="kpi-subtext">High-speed EV power</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-purple">
            <DollarSign size={24} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Average Rate</div>
            <div className="kpi-value">${avgPrice} <span style={{ fontSize: '0.9rem' }}>/ kWh</span></div>
            <div className="kpi-subtext">Base pricing tariff</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="dash-card">
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title">
              <Zap size={18} color="var(--primary-600)" />
              Company Charging Station Infrastructure
            </h3>
            <p className="dash-card-subtitle">
              Deploy, configure, and monitor your enterprise charging network.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={loadStations}
              className="btn-secondary"
              style={{ padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
              title="Refresh station list"
            >
              <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            </button>

            <button
              type="button"
              className="submit-btn"
              style={{ width: 'auto', margin: 0, padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
              onClick={handleOpenAddWizard}
            >
              <Plus size={16} /> Add Charging Station
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search stations by name, address, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['ALL', 'CCS2', 'Type 2', 'CHAdeMO'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setConnectorFilter(c)}
                className={`btn-secondary ${connectorFilter === c ? 'active' : ''}`}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.45rem 0.85rem',
                  borderColor: connectorFilter === c ? 'var(--primary-600)' : 'var(--border-subtle)',
                  background: connectorFilter === c ? 'var(--primary-50)' : '#ffffff',
                  color: connectorFilter === c ? 'var(--primary-800)' : 'var(--text-muted)'
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>{error}</div>}
        {successMsg && <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>{successMsg}</div>}

        {/* Stations Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <RefreshCw size={28} className="spinner" color="var(--primary-600)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading charging stations...</p>
          </div>
        ) : (
          <div className="dash-table-wrapper">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Station Code</th>
                  <th>Station & Location</th>
                  <th>Connector & Power</th>
                  <th>Tariff / Rate</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStations.filter((s) => s.isActive !== false).map((stn) => (
                  <tr key={stn.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <code
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            background: 'var(--primary-50)',
                            color: 'var(--primary-700)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.85rem'
                          }}
                        >
                          {stn.chargingCode || 'STN-EV'}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(stn.chargingCode, stn.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                          title="Copy charging code"
                        >
                          {copiedCodeId === stn.id ? <Check size={13} color="#15803d" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>{stn.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{stn.address}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '2px' }}>
                        Lat: {parseFloat(stn.latitude).toFixed(4)}, Lng: {parseFloat(stn.longitude).toFixed(4)}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                        {stn.connectorType || 'CCS2'}
                      </span>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: '0.25rem', color: 'var(--text-main)' }}>
                        ⚡ {stn.capacityKw} kW Fast Charge
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#15803d' }}>
                        ${Number(stn.pricePerKwh).toFixed(2)} / kWh
                      </div>
                      {stn.peakPricePerKwh && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--warning-700)', marginTop: '2px' }}>
                          Peak: ${Number(stn.peakPricePerKwh).toFixed(2)} ({stn.peakStartTime}-{stn.peakEndTime})
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-success">
                        ● Online Active
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                          onClick={() => handleOpenDetails(stn)}
                          title="View complete station specs"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                          onClick={() => handleOpenEdit(stn)}
                          title="Edit station parameters"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                          onClick={() => setDeleteConfirmId(stn.id)}
                          title="Deactivate station"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredStations.filter((s) => s.isActive !== false).length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <Zap size={36} color="var(--text-light)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                      No charging stations matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MULTI-STEP ADD CHARGING STATION WIZARD                                  */}
      {/* ========================================================================= */}
      {showWizard && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Add New Charging Station</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Provision charging hardware onto the EVNexus network
                  </p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowWizard(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Wizard Step Progress Bar */}
            <div className="wizard-header">
              <button
                type="button"
                className={`wizard-step ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
                onClick={() => setCurrentStep(1)}
              >
                <div className="wizard-step-badge">
                  {currentStep > 1 ? <Check size={16} /> : '1'}
                </div>
                <div className="wizard-step-info">
                  <div className="wizard-step-label">Step 1</div>
                  <div className="wizard-step-name">Location & Map</div>
                </div>
              </button>

              <div className={`wizard-connector-line ${currentStep > 1 ? 'active' : ''}`} />

              <button
                type="button"
                className={`wizard-step ${currentStep === 2 ? 'active' : ''}`}
                onClick={handleNextStep}
              >
                <div className="wizard-step-badge">2</div>
                <div className="wizard-step-info">
                  <div className="wizard-step-label">Step 2</div>
                  <div className="wizard-step-name">Station Information</div>
                </div>
              </button>
            </div>

            {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

            {/* ---------------------------------------------------- */}
            {/* STEP 1: LOCATION                                     */}
            {/* ---------------------------------------------------- */}
            {currentStep === 1 && (
              <form onSubmit={handleNextStep}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Search Location / Address Bar */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Search Location / Address
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 100 Main St, New York, NY or Colombo 07"
                        value={addressSearchInput}
                        onChange={(e) => setAddressSearchInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleAddressSearch}
                        disabled={isGeocoding || !addressSearchInput.trim()}
                        style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                      >
                        {isGeocoding ? <RefreshCw size={14} className="spinner" /> : <Search size={14} />}
                        <span>Geocode</span>
                      </button>
                    </div>
                  </div>

                  {/* Coordinates Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">
                        Latitude <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. 6.927100 or 6°55'N"
                        value={formData.latitude}
                        onChange={handleLatChange}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        Longitude <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. 79.861200 or 79°51'E"
                        value={formData.longitude}
                        onChange={handleLngChange}
                      />
                    </div>
                  </div>

                  {/* Auto-detect button */}
                  <div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleAutoDetectLocation}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Compass size={14} color="var(--primary-600)" />
                      <span>Use My Current Device Location</span>
                    </button>
                  </div>

                  {/* Interactive Map Location Picker */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Pin Location on Map</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click or drag marker to set precise position</span>
                    </label>

                    <div style={{ height: '240px', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid var(--border-subtle)' }}>
                      {isLoaded ? (
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '100%' }}
                          center={{
                            lat: parseFloat(formData.latitude) || 6.9271,
                            lng: parseFloat(formData.longitude) || 79.8612
                          }}
                          zoom={14}
                          options={{ disableDefaultUI: true, zoomControl: true }}
                          onClick={(e) => {
                            setFormData({
                              ...formData,
                              latitude: e.latLng.lat().toFixed(6),
                              longitude: e.latLng.lng().toFixed(6)
                            });
                          }}
                        >
                          <Marker
                            position={{
                              lat: parseFloat(formData.latitude) || 6.9271,
                              lng: parseFloat(formData.longitude) || 79.8612
                            }}
                            draggable={true}
                            onDragEnd={(e) => {
                              setFormData({
                                ...formData,
                                latitude: e.latLng.lat().toFixed(6),
                                longitude: e.latLng.lng().toFixed(6)
                              });
                            }}
                          />
                        </GoogleMap>
                      ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                          <RefreshCw size={24} className="spinner" color="var(--primary-600)" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    <button type="button" className="btn-secondary" onClick={() => setShowWizard(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="submit-btn" style={{ width: 'auto', margin: 0, padding: '0.55rem 1.5rem' }}>
                      <span>Next: Station Information</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ---------------------------------------------------- */}
            {/* STEP 2: STATION INFORMATION & AMENITIES              */}
            {/* ---------------------------------------------------- */}
            {currentStep === 2 && (
              <form onSubmit={handleCreateSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Basic Metadata */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">
                        Station Name <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Metro Supercharge Hub Alpha"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Operating Hours
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 24/7 Open or 06:00 - 23:00"
                        value={formData.operatingHours}
                        onChange={(e) => setFormData({ ...formData, operatingHours: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Address <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. 450 Lexington Ave, Suite 100, New York, NY"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Station Description & Driver Notes</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      placeholder="e.g. Located on Level 2 parking bay, security guards present 24/7."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  {/* Technical & Rate Specs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Connector Type</label>
                      <select
                        className="form-input"
                        value={formData.connectorType}
                        onChange={(e) => setFormData({ ...formData, connectorType: e.target.value })}
                      >
                        <option value="CCS2">CCS2 (Combo 2)</option>
                        <option value="Type 2">Type 2 (Mennekes)</option>
                        <option value="CHAdeMO">CHAdeMO</option>
                        <option value="GB/T">GB/T</option>
                        <option value="NACS">NACS (Tesla)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Capacity (kW) <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="500"
                        required
                        className="form-input"
                        value={formData.capacityKw}
                        onChange={(e) => setFormData({ ...formData, capacityKw: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Base Price / kWh ($) <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="50"
                        required
                        className="form-input"
                        value={formData.pricePerKwh}
                        onChange={(e) => setFormData({ ...formData, pricePerKwh: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Dynamic Pricing Toggle */}
                  <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Dynamic Peak Pricing</strong>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                          Configure variable rates during high-demand hours
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.enableDynamicPricing}
                        onChange={(e) => setFormData({ ...formData, enableDynamicPricing: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </div>

                    {formData.enableDynamicPricing && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Peak Rate ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={formData.peakPricePerKwh}
                            onChange={(e) => setFormData({ ...formData, peakPricePerKwh: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Off-Peak Rate ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={formData.offPeakPricePerKwh}
                            onChange={(e) => setFormData({ ...formData, offPeakPricePerKwh: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Peak Start</label>
                          <input
                            type="time"
                            className="form-input"
                            value={formData.peakStartTime}
                            onChange={(e) => setFormData({ ...formData, peakStartTime: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Peak End</label>
                          <input
                            type="time"
                            className="form-input"
                            value={formData.peakEndTime}
                            onChange={(e) => setFormData({ ...formData, peakEndTime: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Amenities Checklist */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                      Station Amenities
                    </label>
                    <div className="amenities-grid">
                      {AVAILABLE_AMENITIES.map((amenity) => {
                        const isSelected = formData.amenities?.includes(amenity.id);
                        return (
                          <div
                            key={amenity.id}
                            className={`amenity-chip ${isSelected ? 'active' : ''}`}
                            onClick={() => toggleAmenity(amenity.id)}
                          >
                            {amenity.icon}
                            <span>{amenity.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setCurrentStep(1)}
                    >
                      <ArrowLeft size={16} />
                      <span>Back to Location</span>
                    </button>

                    <button
                      type="submit"
                      className="submit-btn"
                      disabled={isSubmitting || !formData.name.trim() || !formData.address.trim()}
                      style={{ width: 'auto', margin: 0, padding: '0.55rem 1.5rem', background: '#10b981' }}
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={14} className="spinner" />
                          <span>Deploying Station...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          <span>Deploy Station to Network</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. EDIT CHARGING STATION MODAL                                            */}
      {/* ========================================================================= */}
      {showEditModal && editingStation && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Edit3 size={18} color="var(--primary-600)" />
                <h3 className="modal-title">Edit Station: {editingStation.name}</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Station Address</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Connector</label>
                    <select
                      className="form-input"
                      value={formData.connectorType}
                      onChange={(e) => setFormData({ ...formData, connectorType: e.target.value })}
                    >
                      <option value="CCS2">CCS2</option>
                      <option value="Type 2">Type 2</option>
                      <option value="CHAdeMO">CHAdeMO</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Capacity (kW)</label>
                    <input
                      type="number"
                      step="1"
                      required
                      className="form-input"
                      value={formData.capacityKw}
                      onChange={(e) => setFormData({ ...formData, capacityKw: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rate / kWh ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="form-input"
                      value={formData.pricePerKwh}
                      onChange={(e) => setFormData({ ...formData, pricePerKwh: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn" disabled={isSubmitting} style={{ width: 'auto', margin: 0 }}>
                    {isSubmitting ? <RefreshCw size={14} className="spinner" /> : 'Update Station'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VIEW STATION DETAILS MODAL                                             */}
      {/* ========================================================================= */}
      {showDetailsModal && detailsStation && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Zap size={18} color="var(--primary-600)" />
                <h3 className="modal-title">{detailsStation.name}</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowDetailsModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Station ID / Code</span>
                  <code style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{detailsStation.chargingCode || 'STN-EV'}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Physical Address</span>
                  <strong style={{ textAlign: 'right', maxWidth: '60%' }}>{detailsStation.address}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>GPS Coordinates</span>
                  <span>{parseFloat(detailsStation.latitude).toFixed(6)}, {parseFloat(detailsStation.longitude).toFixed(6)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Power & Connector</span>
                  <strong>⚡ {detailsStation.capacityKw} kW ({detailsStation.connectorType})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Standard Rate</span>
                  <strong style={{ color: '#15803d' }}>${Number(detailsStation.pricePerKwh).toFixed(2)} / kWh</strong>
                </div>
              </div>

              {/* Amenities View */}
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                  AVAILABLE SITE AMENITIES
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {AVAILABLE_AMENITIES.map((a) => (
                    <span key={a.id} className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.6rem' }}>
                      {a.icon} {a.label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="hero-btn" onClick={() => setShowDetailsModal(false)} style={{ width: '100%', justifyContent: 'center' }}>
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. DEACTIVATE CONFIRMATION MODAL                                          */}
      {/* ========================================================================= */}
      {deleteConfirmId && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#dc2626' }}>
                <AlertTriangle size={22} />
                <h3 className="modal-title" style={{ color: '#dc2626' }}>
                  Deactivate Station?
                </h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setDeleteConfirmId(null)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Are you sure you want to deactivate this charging station? It will be immediately removed from the driver map and drivers won't be able to start sessions here.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteConfirmId(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDeactivate}
                style={{ flex: 1, margin: 0, background: '#dc2626', borderColor: '#dc2626' }}
              >
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
