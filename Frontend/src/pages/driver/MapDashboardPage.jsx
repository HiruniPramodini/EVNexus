import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Search, MapPin, Zap, Navigation, Navigation2, X, RefreshCw, BatteryCharging, CheckCircle2, AlertTriangle, Play, UploadCloud } from 'lucide-react';
import { getNearbyStations, getActiveSession, startChargingSession, stopChargingSession, validateQrCode } from '../../services/api';
import { searchNominatimLocations } from '../../services/nominatim';
import { createStationIcon, createSearchIcon, createUserLocationIcon } from '../../utils/leafletIcons';
import jsQR from 'jsqr';

// Default map center fallback (Colombo area)
const defaultCenter = {
  lat: 6.9271,
  lng: 79.8612
};

// Helper component to center map when center state updates
function MapFlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && typeof center.lat === 'number' && typeof center.lng === 'number' && !isNaN(center.lat) && !isNaN(center.lng)) {
      map.flyTo([center.lat, center.lng], map.getZoom() || 13, { duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

// Helper component to trigger invalidateSize after mount / render
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

export default function MapDashboardPage({ authUser, onViewChange }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [radius, setRadius] = useState(50);
  const [center, setCenter] = useState(defaultCenter);
  const [userLocation, setUserLocation] = useState(defaultCenter);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState(null);

  // OpenStreetMap / Nominatim Location Search State
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [nominatimResults, setNominatimResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState(null);
  const [noLocationResult, setNoLocationResult] = useState(false);
  const [searchMarker, setSearchMarker] = useState(null);

  // Session tracking
  const [activeSession, setActiveSession] = useState(null);
  const [activeStationInfo, setActiveStationInfo] = useState(null);
  const [activeChargerInfo, setActiveChargerInfo] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  const [showStartModal, setShowStartModal] = useState(false);
  const [qrPayload, setQrPayload] = useState('');
  const [validatedData, setValidatedData] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);



  // Real-time counter
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const timerRef = useRef(null);

  // Debounced Nominatim Location Search (450ms)
  useEffect(() => {
    if (!locationSearchQuery || locationSearchQuery.trim().length < 2) {
      setNominatimResults([]);
      setShowSuggestions(false);
      setNoLocationResult(false);
      setLocationSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLocation(true);
      setLocationSearchError(null);
      setNoLocationResult(false);
      try {
        const results = await searchNominatimLocations(locationSearchQuery);
        setNominatimResults(results);
        if (results.length === 0) {
          setNoLocationResult(true);
        }
        setShowSuggestions(true);
      } catch (err) {
        console.error('Nominatim search error:', err);
        setLocationSearchError('Location search is temporarily unavailable.');
        setNominatimResults([]);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [locationSearchQuery]);

  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (!isNaN(lat) && !isNaN(lng)) {
      const newPos = { lat, lng };
      setCenter(newPos);
      setSearchMarker({
        lat,
        lng,
        displayName: result.display_name
      });
    }
    setShowSuggestions(false);
  };

  useEffect(() => {
    // Attempt to get user's browser location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCenter(loc);
          setUserLocation(loc);
        },
        (err) => {
          console.warn("Driver geolocation unavailable, using default center fallback.", err);
        }
      );
    }
  }, []);

  // Fetch active session on mount
  useEffect(() => {
    fetchActiveSession();
  }, []);

  const fetchActiveSession = async () => {
    setSessionLoading(true);
    try {
      const res = await getActiveSession(authUser?.accessToken);
      if (res?.data) {
        setActiveSession(res.data);
        setActiveStationInfo(res.station);
        setActiveChargerInfo(res.charger);
      } else {
        setActiveSession(null);
        setActiveStationInfo(null);
        setActiveChargerInfo(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (activeSession && (activeSession.status === 'CHARGING' || activeSession.status === 'Active' || activeSession.status === 'PENDING')) {
      const pollMeter = async () => {
        try {
          const res = await getActiveSession(authUser?.accessToken);
          if (res?.data) {
            setActiveSession(res.data);
            if (res.station) setActiveStationInfo(res.station);
            if (res.charger) setActiveChargerInfo(res.charger);
          }
        } catch (err) {
          console.error("Meter polling error:", err);
        }
      };

      timerRef.current = setInterval(pollMeter, 2000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [activeSession?.id, activeSession?.status]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          setQrPayload(code.data);
          handleValidateQR(code.data);
        } else {
          setSessionError("No QR code found in the image. Please try a clearer image. (Hint: Upload the original downloaded QR image without screenshots or compression.)");
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleValidateQR = async (payloadToValidate = qrPayload) => {
    setSessionError(null);
    setValidatedData(null);
    try {
      const res = await validateQrCode(payloadToValidate, authUser?.accessToken);
      if (res.success && res.data) {
        setValidatedData(res.data);
      }
    } catch (err) {
      setSessionError(err.message || "Incorrect QR Code — this QR code does not belong to a valid EVNexus charging port.");
    }
  };

  const handleGoBack = () => {
    setValidatedData(null);
    setShowStartModal(false);
    setQrPayload('');
    setSessionError(null);
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!validatedData) return;

    setIsStarting(true);
    setSessionError(null);
    try {
      const pricePerKwh = parseFloat(validatedData.pricePerKwh) || 0;
      const powerKw = parseFloat(validatedData.powerKw) || 22;
      const estimatedKwh = Math.min(powerKw * 1.0, 50);
      const estimatedAmount = Math.round(pricePerKwh * estimatedKwh * 100) / 100;

      // 1. Start Session
      const sessionPayload = {
        chargingCode: validatedData.chargingCode,
        companyId: validatedData.companyId,
        stationId: validatedData.stationId,
        chargerId: validatedData.chargerId,
        estimatedCost: estimatedAmount
      };
      const res = await startChargingSession(sessionPayload, authUser?.accessToken);

      setActiveSession(res.data);
      setActiveStationInfo(res.station);
      setActiveChargerInfo(res.charger);
      setShowStartModal(false);
      setQrPayload('');
      setValidatedData(null);
    } catch (err) {
      setSessionError(err.message || 'Failed to start session. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  // Ref to prevent state updates on unmounted component
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [stopSuccessMsg, setStopSuccessMsg] = useState(null);

  const handleStopSession = async () => {
    setIsStopping(true);
    const stoppedSessionId = activeSession.id || activeSession.sessionId;
    try {
      const stopRes = await stopChargingSession(stoppedSessionId, authUser?.accessToken);
      const sessionData = stopRes?.data;

      if (isMountedRef.current) {
        setActiveSession(null);
        setActiveStationInfo(null);
        setActiveChargerInfo(null);
        setShowStopConfirm(false);
      }

      if (isMountedRef.current) {
        setStopSuccessMsg("Session stopped successfully.");
        setTimeout(() => {
          if (isMountedRef.current) setStopSuccessMsg(null);
        }, 5000);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setSessionError(err.message || 'Failed to stop session.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStopping(false);
      }
    }
  };

  const fetchNearbyStations = useCallback(async () => {
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') return;
    setLoading(true);
    setError(null);
    try {
      const res = await getNearbyStations(center.lat, center.lng, radius);
      setStations(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load nearby stations');
    } finally {
      setLoading(false);
    }
  }, [center, radius]);

  useEffect(() => {
    fetchNearbyStations();
  }, [fetchNearbyStations]);

  const filteredStations = stations.filter(item => {
    const query = searchQuery.toLowerCase();
    const stn = item.station;
    const matchesName = stn.name.toLowerCase().includes(query);
    const matchesAddress = stn.address.toLowerCase().includes(query);
    const matchesConnector = stn.connectorType?.toLowerCase().includes(query);
    return matchesName || matchesAddress || matchesConnector;
  });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 70px)', width: '100%', overflow: 'hidden' }}>
      {/* Left Sidebar: Controls & Station List */}
      <div style={{
        width: '380px',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2,
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-h3" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap color="var(--color-primary)" size={24} /> Charging Stations
          </h2>

          <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search station, city, connector..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Radius: <strong>{radius} km</strong></span>
            <input
              type="range"
              min="5"
              max="200"
              step="5"
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              style={{ width: '120px', accentColor: 'var(--color-primary)' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={fetchNearbyStations}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            Refresh Stations
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', position: 'relative' }}>
          {/* ACTIVE SESSION OVERLAY */}
          {activeSession ? (
            <div className="animate-fade-in card" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 10, border: 'none', borderRadius: 0,
              display: 'flex', flexDirection: 'column', height: '100%',
              margin: 0
            }}>
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'inline-flex', padding: 'var(--space-4)', background: 'var(--color-success-light)', borderRadius: '50%', marginBottom: 'var(--space-3)' }}>
                  <BatteryCharging size={40} color="var(--color-success-dark)" className="spinner" />
                </div>
                <h3 className="text-h3" style={{ color: 'var(--color-success-dark)', marginBottom: 'var(--space-1)' }}>Charging in Progress</h3>
                <p className="text-secondary" style={{ margin: 0, fontWeight: 'var(--weight-bold)' }}>
                  {activeStationInfo?.name || 'Public Charging Station'}
                </p>
                <div className="text-caption" style={{ marginTop: 'var(--space-1)' }}>
                  {activeChargerInfo?.type || 'CCS2'} • {activeSession.powerKw || activeChargerInfo?.powerKw || 60} kW
                </div>
              </div>

              <div style={{ background: 'var(--color-background)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Initial Meter</span>
                  <span style={{ fontWeight: 'var(--weight-bold)', fontFamily: 'monospace' }}>
                    {parseFloat(activeSession.meterStartKwh || 100.0).toFixed(4)} kWh
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Current Meter</span>
                  <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-success-dark)', fontFamily: 'monospace' }}>
                    {parseFloat(activeSession.meterCurrentKwh || activeSession.meterStartKwh || 100.0).toFixed(4)} kWh
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Energy Used</span>
                  <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-primary-dark)' }}>
                    {parseFloat(activeSession.energyConsumedKwh || 0).toFixed(4)} kWh
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Rate</span>
                  <span style={{ fontWeight: 'var(--weight-semibold)' }}>
                    ${parseFloat(activeSession.pricePerKwh || 0).toFixed(2)} / kWh
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--color-border)', paddingTop: 'var(--space-3)' }}>
                  <span className="text-secondary" style={{ fontSize: '0.9rem', fontWeight: 'var(--weight-semibold)' }}>Estimated Cost</span>
                  <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-info-dark)', fontSize: '1.1rem' }}>
                    ${parseFloat(activeSession.estimatedCost || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowStopConfirm(true)}
                disabled={isStopping}
                style={{ width: '100%', marginTop: 'auto', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', padding: 'var(--space-3)' }}
              >
                {isStopping ? <RefreshCw size={18} className="spinner" /> : <X size={18} />}
                {isStopping ? 'Stopping charging...' : 'Stop Charging'}
              </button>
            </div>
          ) : (
            <>
              {loading && <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw className="spinner" size={24} color="var(--color-primary)" /></div>}
              {!loading && error && <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}>{error}</div>}
              {!loading && !error && filteredStations.length === 0 && (
                <div className="empty-state" style={{ marginTop: '2rem' }}>
                  <MapPin size={32} className="empty-state-icon" />
                  <h4 className="empty-state-title" style={{ fontSize: '1rem' }}>No stations found.</h4>
                  <p className="empty-state-description">Expand your search radius, try a different location, or adjust your search term.</p>
                </div>
              )}

              {!loading && filteredStations.map(item => {
                const lat = Number(item.station.latitude);
                const lng = Number(item.station.longitude);
                return (
                  <div
                    key={item.station.id}
                    onClick={() => {
                      setSelectedStation(item.station);
                      if (!isNaN(lat) && !isNaN(lng)) {
                        setCenter({ lat, lng });
                      }
                    }}
                    className={`card card-interactive ${selectedStation?.id === item.station.id ? 'selected' : ''}`}
                    style={{
                      padding: 'var(--space-4)',
                      marginBottom: 'var(--space-3)',
                      borderColor: selectedStation?.id === item.station.id ? 'var(--color-primary)' : 'var(--color-border)',
                    }}
                  >
                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>{item.station.name}</h4>
                    <p className="text-caption" style={{ margin: 0, marginBottom: '0.75rem' }}>{item.station.address}</p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-info">
                        {item.station.connectorType} • {item.station.capacityKw}kW
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'var(--weight-semibold)', color: 'var(--color-success-dark)' }}>
                        {item.distanceKm.toFixed(1)} km away
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar: Leaflet OpenStreetMap */}
      <div style={{ flex: 1, position: 'relative', height: '100%', minHeight: '500px' }}>
        {/* OPENSTREETMAP / NOMINATIM LOCATION SEARCH BAR OVERLAY */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            maxWidth: '440px',
            zIndex: 1000
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              padding: '4px 8px',
              border: '1px solid var(--color-border)'
            }}
          >
            <Search size={18} color="var(--color-text-muted)" style={{ marginLeft: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search map location (e.g. Colombo, Kaduwela, Kandy)..."
              value={locationSearchQuery}
              onChange={(e) => setLocationSearchQuery(e.target.value)}
              onFocus={() => {
                if (nominatimResults.length > 0) setShowSuggestions(true);
              }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                padding: '8px 12px',
                fontSize: '0.9rem',
                color: 'var(--color-text)',
                background: 'transparent'
              }}
            />

            {isSearchingLocation && (
              <RefreshCw size={16} className="spinner" color="var(--color-primary)" style={{ marginRight: '8px' }} />
            )}

            {locationSearchQuery && !isSearchingLocation && (
              <button
                type="button"
                onClick={() => {
                  setLocationSearchQuery('');
                  setNominatimResults([]);
                  setShowSuggestions(false);
                  setSearchMarker(null);
                  setNoLocationResult(false);
                  setLocationSearchError(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--color-text-muted)'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && nominatimResults.length > 0 && (
            <div
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                marginTop: '6px',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
                maxHeight: '240px',
                overflowY: 'auto'
              }}
            >
              {nominatimResults.map((result) => (
                <div
                  key={result.place_id}
                  onClick={() => handleSelectSearchResult(result)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.88rem',
                    color: 'var(--color-text)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-background)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  <MapPin size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {result.display_name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Empty Results State */}
          {noLocationResult && !isSearchingLocation && (
            <div
              style={{
                background: '#fff3cd',
                color: '#856404',
                border: '1px solid #ffeeba',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                marginTop: '6px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}
            >
              <AlertTriangle size={15} />
              <span>No locations found. Try a different search.</span>
            </div>
          )}

          {/* Failure State */}
          {locationSearchError && !isSearchingLocation && (
            <div
              style={{
                background: '#f8d7da',
                color: '#721c24',
                border: '1px solid #f5c6cb',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                marginTop: '6px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}
            >
              <AlertTriangle size={15} />
              <span>{locationSearchError}</span>
            </div>
          )}
        </div>

        <MapContainer
          center={[center.lat, center.lng]}
          zoom={12}
          style={{ width: '100%', height: '100%', borderRadius: '0 8px 8px 0', zIndex: 1 }}
          zoomControl={true}
        >
          <MapFlyTo center={center} />
          <MapResizeInvalidator />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Live Driver Location Marker */}
          {userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number' && (
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={createUserLocationIcon('#0284c7', 20)}
            >
              <Popup>
                <div style={{ padding: '4px', fontSize: '0.85rem' }}>
                  <strong>Your Location</strong>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Searched Location Pin */}
          {searchMarker && (
            <Marker
              position={[searchMarker.lat, searchMarker.lng]}
              icon={createSearchIcon('#e11d48', 38)}
            >
              <Popup>
                <div style={{ padding: '4px', maxWidth: '200px' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>Searched Location</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                    {searchMarker.displayName}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Charging Station Markers */}
          {filteredStations.map(item => {
            const lat = Number(item.station.latitude);
            const lng = Number(item.station.longitude);
            if (isNaN(lat) || isNaN(lng)) return null;

            const isSelected = selectedStation?.id === item.station.id;

            return (
              <Marker
                key={item.station.id}
                position={[lat, lng]}
                icon={createStationIcon(isSelected ? '#0284c7' : '#0369a1', isSelected ? 40 : 36)}
                eventHandlers={{
                  click: () => {
                    setSelectedStation(item.station);
                    setCenter({ lat, lng });
                  }
                }}
              >
                <Popup>
                  <div style={{ padding: 'var(--space-2)', minWidth: '200px' }}>
                    <h4 style={{ margin: '0 0 var(--space-1) 0', fontSize: '1rem', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)' }}>
                      {item.station.name}
                    </h4>
                    <p className="text-caption" style={{ margin: '0 0 var(--space-3) 0' }}>
                      {item.station.address}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'var(--weight-medium)' }}>
                        💵 ${item.station.pricePerKwh} / kWh
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'var(--weight-medium)' }}>
                        ⚡ {item.station.capacityKw} kW ({item.station.connectorType})
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!!activeSession}
                      onClick={() => {
                        setQrPayload('');
                        setValidatedData(null);
                        setSessionError(null);
                        setShowStartModal(true);
                      }}
                      style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem' }}
                    >
                      <Play size={14} /> Scan Charger QR
                    </button>

                    {!!activeSession && (
                      <div className="text-caption" style={{ textAlign: 'center', marginTop: 'var(--space-2)', color: 'var(--color-danger)' }}>
                        You already have an active session.
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* START CHARGE MODAL */}
      {showStartModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog animate-fade-in" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                <Zap color="var(--color-warning-dark)" size={24} /> Scan to Charge
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowStartModal(false)}>
                <X size={20} />
              </button>
            </div>

            <p className="text-secondary" style={{ marginBottom: 'var(--space-5)' }}>
              Upload a QR code image from the physical charger to authorize and begin charging.
            </p>

            {sessionError && (
              <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>
                <AlertTriangle size={18} /> <span>{sessionError}</span>
              </div>
            )}

            {!validatedData ? (
              <div>
                <div className="card" style={{ borderStyle: 'dashed', textAlign: 'center', padding: 'var(--space-6)', marginBottom: 'var(--space-4)', background: 'var(--color-background)' }}>
                  <UploadCloud size={32} color="var(--color-primary)" style={{ margin: '0 auto var(--space-3) auto' }} />
                  <label className="btn btn-outline" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                    Upload QR Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <div className="text-caption" style={{ marginTop: 'var(--space-3)' }}>Supports JPG, PNG, WEBP</div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowStartModal(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="card" style={{ marginBottom: 'var(--space-5)', border: '1px solid var(--color-success)', background: 'var(--color-success-light)', padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-success-dark)', marginBottom: 'var(--space-3)' }}>
                    <CheckCircle2 size={20} />
                    <h4 style={{ margin: 0, fontWeight: 'var(--weight-bold)', fontSize: '1.1rem' }}>Charger Verified</h4>
                  </div>

                  {/* Company Name */}
                  <div style={{ fontSize: '0.85rem', fontWeight: 'var(--weight-semibold)', color: 'var(--color-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>
                    Company: {validatedData.companyName || validatedData.companyId || 'EVNexus Charging Network'}
                  </div>

                  {/* Charging Station & Location */}
                  <div style={{ fontSize: '1.2rem', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)', marginBottom: '0.25rem' }}>
                    {validatedData.stationName || 'EV Charging Station'}
                  </div>
                  <div className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} color="var(--color-text-muted)" />
                    {validatedData.address || 'Station Location'}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <div style={{ background: '#ffffff', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)' }}>
                      <div className="text-caption">Connector / Port</div>
                      <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', fontSize: '0.95rem' }}>
                        {validatedData.chargerType || 'Type 2 / CCS2'}
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)' }}>
                      <div className="text-caption">Power (kW)</div>
                      <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', fontSize: '0.95rem' }}>
                        {validatedData.powerKw || 22} kW
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)' }}>
                      <div className="text-caption">Price per kWh</div>
                      <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', fontSize: '0.95rem' }}>
                        ${validatedData.pricePerKwh || '0.00'} / kWh
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)' }}>
                      <div className="text-caption">Availability</div>
                      <span className="badge badge-success" style={{ marginTop: '0.2rem', display: 'inline-block' }}>
                        {validatedData.status || 'Available'}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-3)', background: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={15} color="var(--color-warning-dark)" />
                      Estimated session cost: <strong>${(Math.round((parseFloat(validatedData.pricePerKwh) || 0) * Math.min((parseFloat(validatedData.powerKw) || 22) * 1.0, 50) * 100) / 100).toFixed(2)}</strong>
                    </p>
                  </div>
                </div>

                <form onSubmit={handleStartSession}>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button type="button" className="btn btn-secondary" onClick={handleGoBack} style={{ flex: 1 }}>
                      Go Back
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isStarting} style={{ flex: 1.2 }}>
                      {isStarting ? <><RefreshCw size={18} className="spinner" /> Authorizing...</> : 'Start Charging'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STOP CHARGE MODAL */}
      {showStopConfirm && (
        <div className="modal-backdrop">
          <div className="modal-dialog animate-fade-in" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-danger)' }}>
                <AlertTriangle size={20} /> Stop Charging?
              </h3>
            </div>
            <p className="text-secondary" style={{ marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
              Are you sure you want to stop this charging session? You will be billed for the energy delivered so far, and the connector will unlock.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowStopConfirm(false)} style={{ flex: 1 }}>
                Continue Charging
              </button>
              <button type="button" className="btn" onClick={handleStopSession} disabled={isStopping} style={{ flex: 1, background: 'var(--color-danger)', color: 'white', border: 'none' }}>
                {isStopping ? <><RefreshCw size={18} className="spinner" /> Stopping...</> : 'Stop Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {stopSuccessMsg && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-success-dark)', color: 'white', padding: '1rem 2rem', borderRadius: '30px',
          boxShadow: 'var(--shadow-md)', zIndex: 1000, fontWeight: 'var(--weight-semibold)'
        }}>
          {stopSuccessMsg}
        </div>
      )}


    </div>
  );
}
