import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import {
  Search,
  MapPin,
  Zap,
  Navigation,
  Navigation2,
  X,
  RefreshCw,
  BatteryCharging,
  CheckCircle2,
  AlertTriangle,
  Play,
  Clock,
  Compass,
  DollarSign,
  ShieldCheck,
  Wifi,
  Coffee,
  Utensils,
  Car,
  Sliders,
  ChevronRight,
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';
import { getNearbyStations, getActiveSession, startChargingSession, stopChargingSession } from '../../services/api';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0 12px 12px 0'
};

const defaultCenter = {
  lat: 40.7128, // Default to NY
  lng: -74.0060
};

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyB_O1v5DjPx3HeTaQGuM6o6CdRd5VgCxIk";

// Built-in amenity icon lookup
function getAmenityIcon(amenity) {
  const name = String(amenity).toLowerCase();
  if (name.includes('wifi') || name.includes('wi-fi')) return <Wifi size={13} />;
  if (name.includes('cafe') || name.includes('coffee')) return <Coffee size={13} />;
  if (name.includes('rest') || name.includes('food') || name.includes('restaurant')) return <Utensils size={13} />;
  return <Car size={13} />;
}

export default function MapDashboardPage() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  const [map, setMap] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(50);
  const [connectorFilter, setConnectorFilter] = useState('ALL');
  const [center, setCenter] = useState(defaultCenter);
  const [userLocation, setUserLocation] = useState(defaultCenter);
  const [isLocating, setIsLocating] = useState(false);

  // Selected Station State
  const [selectedStation, setSelectedStation] = useState(null);
  const [hoveredStationId, setHoveredStationId] = useState(null);

  // Active Charging Session State
  const [activeSession, setActiveSession] = useState(null);
  const [activeStationInfo, setActiveStationInfo] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  // Charge Your EV Modal State
  const [showStartModal, setShowStartModal] = useState(false);
  const [targetStationForCharge, setTargetStationForCharge] = useState(null);
  const [chargingCode, setChargingCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Stop Session Modal State
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [stopSuccessMsg, setStopSuccessMsg] = useState(null);

  // Live Timer & Energy Telemetry State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  // 1. Fetch user GPS location on mount
  useEffect(() => {
    handleLocateMe();
  }, []);

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(loc);
          setUserLocation(loc);
          map?.panTo(loc);
          setIsLocating(false);
        },
        (err) => {
          console.warn('Geolocation failed or denied, using default', err);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  // 2. Fetch active session on mount
  useEffect(() => {
    fetchActiveSession();
  }, []);

  const fetchActiveSession = async () => {
    setSessionLoading(true);
    try {
      const res = await getActiveSession();
      if (res?.data) {
        setActiveSession(res.data);
        setActiveStationInfo(res.station);
      } else {
        setActiveSession(null);
        setActiveStationInfo(null);
      }
    } catch (err) {
      console.warn('Error fetching active session:', err);
    } finally {
      setSessionLoading(false);
    }
  };

  // 3. Real-time seconds counter for active charging
  useEffect(() => {
    if (activeSession && activeSession.status === 'Active') {
      const updateTimer = () => {
        const startTimeStr = activeSession.startTime?.endsWith('Z')
          ? activeSession.startTime
          : activeSession.startTime + 'Z';
        const start = new Date(startTimeStr);
        const now = new Date();
        const diffSecs = Math.max(0, Math.floor((now - start) / 1000));
        setElapsedSeconds(diffSecs);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [activeSession]);

  // 4. Fetch nearby stations when userLocation or radius changes
  useEffect(() => {
    fetchNearbyStations();
  }, [userLocation.lat, userLocation.lng, radius]);

  const fetchNearbyStations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNearbyStations(userLocation.lat, userLocation.lng, radius);
      setStations(res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch nearby stations');
    } finally {
      setLoading(false);
    }
  };

  // 5. Filter stations by text search and connector
  const filteredStations = useMemo(() => {
    return stations.filter((item) => {
      const stn = item.station;
      const matchesSearch =
        !searchQuery.trim() ||
        stn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stn.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stn.chargingCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stn.connectorType?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesConnector =
        connectorFilter === 'ALL' ||
        stn.connectorType?.toUpperCase() === connectorFilter.toUpperCase();

      return matchesSearch && matchesConnector;
    });
  }, [stations, searchQuery, connectorFilter]);

  // 6. Handle Station Card Selection
  const handleSelectStation = (stn) => {
    setSelectedStation(stn);
    const coords = { lat: parseFloat(stn.latitude), lng: parseFloat(stn.longitude) };
    setCenter(coords);
    map?.panTo(coords);
    map?.setZoom(14);
  };

  // 7. Start Session Handler
  const handleOpenStartModal = (station = null) => {
    setTargetStationForCharge(station);
    setChargingCode(station?.chargingCode || '');
    setSessionError(null);
    setShowStartModal(true);
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!chargingCode.trim()) return;

    setIsStarting(true);
    setSessionError(null);
    try {
      const res = await startChargingSession(chargingCode.trim().toUpperCase());
      setActiveSession(res.data);
      setActiveStationInfo(res.station);
      setShowStartModal(false);
      setChargingCode('');
      setTargetStationForCharge(null);
    } catch (err) {
      setSessionError(err.message || 'Failed to start session. Please verify the station code.');
    } finally {
      setIsStarting(false);
    }
  };

  // 8. Stop Session Handler
  const handleStopSession = async () => {
    if (!activeSession) return;
    setIsStopping(true);
    try {
      await stopChargingSession(activeSession.id);
      setActiveSession(null);
      setActiveStationInfo(null);
      setShowStopConfirm(false);
      setStopSuccessMsg('⚡ Charging session completed successfully! Digital receipt saved to Session History.');
      setTimeout(() => setStopSuccessMsg(null), 6000);
      fetchNearbyStations();
    } catch (err) {
      alert(err.message || 'Failed to stop session.');
    } finally {
      setIsStopping(false);
    }
  };

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calculated Live Metrics
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const displaySeconds = elapsedSeconds % 60;
  const displayMinutes = elapsedMinutes % 60;

  const simulatedPowerKw = activeStationInfo?.capacityKw || 50;
  // Energy (kWh) = (Power kW * elapsed hours) with minimum starting buffer
  const liveEnergyKwh = Math.max(0.12, (simulatedPowerKw * (elapsedSeconds / 3600))).toFixed(2);
  const ratePerKwh = activeStationInfo?.pricePerKwh || 0.45;
  const liveAccruedCost = (liveEnergyKwh * ratePerKwh).toFixed(2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Banner & Quick Charge Bar */}
      <div
        className="dash-card"
        style={{
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.75rem' }}>
              <Zap size={13} /> Driver Navigation
            </span>
            <span className="badge" style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem' }}>
              ● Network Live
            </span>
          </div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.4rem', fontWeight: 800 }}>
            EV Charging Station Explorer
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', opacity: 0.9, fontSize: '0.875rem' }}>
            Find available fast chargers, review live rates, and start charging instantly.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => handleOpenStartModal()}
            className="submit-btn"
            style={{
              background: '#ffffff',
              color: '#0369a1',
              fontWeight: 700,
              fontSize: '0.9rem',
              padding: '0.65rem 1.35rem',
              width: 'auto',
              margin: 0,
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
            }}
          >
            <Play size={16} color="#0369a1" />
            <span>Enter Station Code</span>
          </button>
        </div>
      </div>

      {/* ACTIVE CHARGING SESSION HUD OVERLAY / CARD */}
      {activeSession && (
        <div className="charging-hud-card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div className="pulse-ring" style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BatteryCharging size={32} color="#ffffff" className="spinner" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span className="badge" style={{ background: '#10b981', color: '#fff', fontWeight: 700 }}>
                    ⚡ LIVE CHARGING ACTIVE
                  </span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    Code: <strong style={{ color: '#bae6fd' }}>{activeSession.chargingCode || activeStationInfo?.chargingCode || 'STN-EV'}</strong>
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                  {activeStationInfo?.name || 'EVNexus Supercharge Hub'}
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', opacity: 0.85, fontSize: '0.85rem' }}>
                  {activeStationInfo?.address || 'Public Charging Network'} • {activeStationInfo?.connectorType || 'CCS2'} • {activeStationInfo?.capacityKw || 50} kW
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowStopConfirm(true)}
              disabled={isStopping}
              className="btn-danger"
              style={{
                background: '#ef4444',
                borderColor: '#ef4444',
                color: '#ffffff',
                padding: '0.65rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {isStopping ? <RefreshCw size={16} className="spinner" /> : <X size={16} />}
              <span>Stop & Complete Charge</span>
            </button>
          </div>

          {/* Telemetry Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '1.25rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} /> Elapsed Time
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                {elapsedHours > 0 ? `${elapsedHours}h ` : ''}{displayMinutes}m {displaySeconds < 10 ? `0${displaySeconds}` : displaySeconds}s
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Zap size={12} style={{ display: 'inline', marginRight: '4px' }} /> Energy Consumed
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                {liveEnergyKwh} <span style={{ fontSize: '0.85rem' }}>kWh</span>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <DollarSign size={12} style={{ display: 'inline', marginRight: '4px' }} /> Accrued Total
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7dd3fc', marginTop: '0.2rem' }}>
                ${liveAccruedCost}
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ⚡ Charging Rate
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
                ${ratePerKwh.toFixed(2)} <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>/ kWh</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {stopSuccessMsg && (
        <div className="alert alert-success animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle2 size={20} color="#15803d" />
          <span style={{ fontWeight: 600 }}>{stopSuccessMsg}</span>
        </div>
      )}

      {/* Main Map & Sidebar Layout */}
      <div className="driver-map-layout">
        
        {/* Left Sidebar: Search, Radius, & Station Cards */}
        <div className="map-sidebar">
          
          <div className="map-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={18} color="var(--primary-600)" />
                Nearby Stations
              </h3>
              <span className="badge badge-info">
                {filteredStations.length} found
              </span>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search by name, city, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem', fontSize: '0.875rem' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Radius Slider & Connector Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Search Radius</span>
                <strong style={{ color: 'var(--primary-700)' }}>{radius} km</strong>
              </div>
              <input
                type="range"
                min="5"
                max="200"
                step="5"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary-600)' }}
              />

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                {['ALL', 'CCS2', 'Type 2', 'CHAdeMO'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setConnectorFilter(c)}
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.4rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: connectorFilter === c ? '1.5px solid var(--primary-600)' : '1px solid var(--border-subtle)',
                      background: connectorFilter === c ? 'var(--primary-50)' : '#ffffff',
                      color: connectorFilter === c ? 'var(--primary-700)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Actions Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleLocateMe}
                disabled={isLocating}
                style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.78rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem' }}
              >
                <Navigation2 size={13} className={isLocating ? 'spinner' : ''} color="var(--primary-600)" />
                <span>{isLocating ? 'Locating...' : 'Use My GPS'}</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={fetchNearbyStations}
                disabled={loading}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Refresh nearby stations"
              >
                <RefreshCw size={13} className={loading ? 'spinner' : ''} />
              </button>
            </div>
          </div>

          {/* Station Cards List */}
          <div className="station-cards-list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <RefreshCw size={28} className="spinner" color="var(--primary-600)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Scanning charging stations...</p>
              </div>
            ) : error ? (
              <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            ) : filteredStations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <MapPin size={36} color="var(--text-light)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>No stations found in range</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  Try increasing your search radius or clearing search filters.
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setRadius(150); setSearchQuery(''); setConnectorFilter('ALL'); }}
                  style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
                >
                  Expand Radius to 150km
                </button>
              </div>
            ) : (
              filteredStations.map((item) => {
                const stn = item.station;
                const isSelected = selectedStation?.id === stn.id;
                const isHovered = hoveredStationId === stn.id;
                const isStationActive = stn.isActive !== false;

                return (
                  <div
                    key={stn.id}
                    className={`station-card-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectStation(stn)}
                    onMouseEnter={() => setHoveredStationId(stn.id)}
                    onMouseLeave={() => setHoveredStationId(null)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: isSelected ? 'var(--primary-800)' : 'var(--text-main)' }}>
                          {stn.name}
                        </h4>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {stn.address}
                        </p>
                      </div>

                      <span className={`badge ${isStationActive ? 'badge-available' : 'badge-busy'}`} style={{ fontSize: '0.7rem', flexShrink: 0 }}>
                        {isStationActive ? '● Available' : '● Occupied'}
                      </span>
                    </div>

                    {/* Specs & Rates */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.75rem 0', background: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--bg-page)', padding: '0.5rem 0.65rem', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Power</span>
                        <strong style={{ color: 'var(--primary-700)' }}>⚡ {stn.capacityKw} kW</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px' }}>({stn.connectorType})</span>
                      </div>

                      <div style={{ fontSize: '0.75rem', textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Rate</span>
                        <strong style={{ color: '#15803d' }}>${Number(stn.pricePerKwh).toFixed(2)} / kWh</strong>
                      </div>
                    </div>

                    {/* Proximity & Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary-600)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Compass size={13} /> {item.distanceKm ? `${Number(item.distanceKm).toFixed(1)} km away` : 'Nearby'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStartModal(stn);
                        }}
                        className="submit-btn"
                        style={{
                          width: 'auto',
                          margin: 0,
                          padding: '0.35rem 0.8rem',
                          fontSize: '0.75rem',
                          background: '#10b981',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Play size={12} />
                        <span>Charge Here</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Section: Google Map */}
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={12}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true
              }}
            >
              {/* User Location Draggable Pin */}
              <Marker
                position={userLocation}
                draggable={true}
                onDragEnd={(e) => {
                  const newLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                  setUserLocation(newLoc);
                }}
                title="Your Current Location (Drag to change search origin)"
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE,
                  scale: 8,
                  fillColor: "#0284c7",
                  fillOpacity: 1,
                  strokeWeight: 3,
                  strokeColor: "#ffffff"
                }}
              />

              {/* Station Markers */}
              {filteredStations.map((item) => {
                const stn = item.station;
                const isSelected = selectedStation?.id === stn.id;
                const markerColor = isSelected ? '#0284c7' : '#10b981';

                return (
                  <Marker
                    key={stn.id}
                    position={{ lat: parseFloat(stn.latitude), lng: parseFloat(stn.longitude) }}
                    onClick={() => handleSelectStation(stn)}
                    icon={{
                      url:
                        'data:image/svg+xml;charset=UTF-8,' +
                        encodeURIComponent(
                          `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="${markerColor}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#ffffff"></circle></svg>`
                        ),
                      scaledSize: window.google ? new window.google.maps.Size(38, 38) : null,
                      origin: window.google ? new window.google.maps.Point(0, 0) : null,
                      anchor: window.google ? new window.google.maps.Point(19, 38) : null
                    }}
                  />
                );
              })}

              {/* Station InfoWindow on Selection */}
              {selectedStation && (
                <InfoWindow
                  position={{ lat: parseFloat(selectedStation.latitude), lng: parseFloat(selectedStation.longitude) }}
                  onCloseClick={() => setSelectedStation(null)}
                  options={{ pixelOffset: window.google ? new window.google.maps.Size(0, -36) : null }}
                >
                  <div style={{ padding: '0.4rem', maxWidth: '240px', color: 'var(--text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.3rem' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                        ● Available
                      </span>
                      <code style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                        {selectedStation.chargingCode}
                      </code>
                    </div>

                    <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                      {selectedStation.name}
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {selectedStation.address}
                    </p>

                    <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Power:</span>
                        <strong>⚡ {selectedStation.capacityKw} kW ({selectedStation.connectorType})</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Price:</span>
                        <strong style={{ color: '#15803d' }}>${Number(selectedStation.pricePerKwh).toFixed(2)} / kWh</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="submit-btn"
                      onClick={() => handleOpenStartModal(selectedStation)}
                      style={{
                        margin: 0,
                        padding: '0.4rem',
                        fontSize: '0.8rem',
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        background: '#10b981'
                      }}
                    >
                      <Play size={13} /> Unlock & Charge
                    </button>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
              <div style={{ textAlign: 'center' }}>
                <RefreshCw size={32} className="spinner" color="var(--primary-600)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading Google Maps Engine...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CHARGE YOUR EV UI / MODAL                                              */}
      {/* ========================================================================= */}
      {showStartModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="modal-title">Charge Your EV</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Authenticate & unlock EV charging bay
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => { setShowStartModal(false); setTargetStationForCharge(null); }}
              >
                <X size={20} />
              </button>
            </div>

            {targetStationForCharge && (
              <div style={{ background: '#f0f9ff', border: '1px solid var(--primary-200)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-900)' }}>
                  {targetStationForCharge.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary-700)', marginTop: '0.15rem' }}>
                  {targetStationForCharge.address}
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--primary-800)' }}>
                  <span>⚡ <strong>{targetStationForCharge.capacityKw} kW</strong></span>
                  <span>🔌 <strong>{targetStationForCharge.connectorType}</strong></span>
                  <span>💵 <strong>${targetStationForCharge.pricePerKwh}/kWh</strong></span>
                </div>
              </div>
            )}

            {sessionError && (
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} />
                <span>{sessionError}</span>
              </div>
            )}

            <form onSubmit={handleStartSession}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Station Code (6-characters)
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. 8F3A21"
                  value={chargingCode}
                  onChange={(e) => setChargingCode(e.target.value.toUpperCase())}
                  style={{
                    fontSize: '1.5rem',
                    letterSpacing: '0.25em',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    padding: '0.75rem'
                  }}
                  maxLength={6}
                />
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem', textAlign: 'center' }}>
                  Located on the screen or sticker of the charging dispenser.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowStartModal(false); setTargetStationForCharge(null); }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isStarting || chargingCode.length < 3}
                  style={{ flex: 1, margin: 0, background: '#10b981' }}
                >
                  {isStarting ? (
                    <>
                      <RefreshCw size={16} className="spinner" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      <span>Start Charging</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. STOP CHARGE SAFETY CONFIRMATION MODAL                                  */}
      {/* ========================================================================= */}
      {showStopConfirm && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#dc2626' }}>
                <AlertTriangle size={22} />
                <h3 className="modal-title" style={{ color: '#dc2626' }}>
                  Stop Charging Session?
                </h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowStopConfirm(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to stop this charging session?
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', margin: '0.85rem 0', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                  <span>Total Duration:</span>
                  <strong>{elapsedHours > 0 ? `${elapsedHours}h ` : ''}{displayMinutes}m {displaySeconds}s</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                  <span>Energy Delivered:</span>
                  <strong style={{ color: '#10b981' }}>{liveEnergyKwh} kWh</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Estimated Total:</span>
                  <strong style={{ color: '#0369a1' }}>${liveAccruedCost}</strong>
                </div>
              </div>
              Upon stopping, the connector will automatically unlock and a digital receipt will be recorded.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowStopConfirm(false)}
                style={{ flex: 1 }}
              >
                Keep Charging
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleStopSession}
                disabled={isStopping}
                style={{ flex: 1, margin: 0, background: '#dc2626', borderColor: '#dc2626' }}
              >
                {isStopping ? <RefreshCw size={16} className="spinner" /> : 'Confirm & Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
