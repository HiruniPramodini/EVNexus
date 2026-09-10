import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Search, MapPin, Zap, Navigation, Navigation2, X, RefreshCw, BatteryCharging, CheckCircle2, AlertTriangle, Play } from 'lucide-react';
import { getNearbyStations, getActiveSession, startChargingSession, stopChargingSession } from '../../services/api';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0 8px 8px 0'
};

const defaultCenter = {
  lat: 40.7128, // Default to NY
  lng: -74.0060
};

// Replace with a real key or mock key if not provided
const GOOGLE_MAPS_API_KEY = "AIzaSyB_O1v5DjPx3HeTaQGuM6o6CdRd5VgCxIk";

export default function MapDashboardPage() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  const [map, setMap] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [radius, setRadius] = useState(50);
  const [center, setCenter] = useState(defaultCenter);
  const [userLocation, setUserLocation] = useState(defaultCenter);
  
  const [selectedStation, setSelectedStation] = useState(null);

  // Charging Session State
  const [activeSession, setActiveSession] = useState(null);
  const [activeStationInfo, setActiveStationInfo] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  
  const [showStartModal, setShowStartModal] = useState(false);
  const [chargingCode, setChargingCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  
  // Real-time counter
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    // Attempt to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCenter(loc);
          setUserLocation(loc);
        },
        () => {
          // Fallback to default
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
      const res = await getActiveSession();
      if (res?.data) {
        setActiveSession(res.data);
        setActiveStationInfo(res.station);
      } else {
        setActiveSession(null);
        setActiveStationInfo(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (activeSession && activeSession.status === 'Active') {
      const updateTimer = () => {
        const start = new Date(activeSession.startTime + 'Z'); // ensure UTC
        const now = new Date();
        const diffMs = now - start;
        setElapsedMinutes(Math.floor(diffMs / 60000));
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 60000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [activeSession]);

  const handleStartSession = async (e) => {
    e.preventDefault();
    setIsStarting(true);
    setSessionError(null);
    try {
      const res = await startChargingSession(chargingCode);
      setActiveSession(res.data);
      setActiveStationInfo(res.station);
      setShowStartModal(false);
      setChargingCode('');
    } catch (err) {
      setSessionError(err.message || 'Failed to start session.');
    } finally {
      setIsStarting(false);
    }
  };

  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [stopSuccessMsg, setStopSuccessMsg] = useState(null);

  const handleStopSession = async () => {
    setIsStopping(true);
    try {
      await stopChargingSession(activeSession.id);
      setActiveSession(null);
      setActiveStationInfo(null);
      setShowStopConfirm(false);
      setStopSuccessMsg('Charging session completed successfully. View receipt in History.');
      setTimeout(() => setStopSuccessMsg(null), 5000);
    } catch (err) {
      alert(err.message || 'Failed to stop session.');
    } finally {
      setIsStopping(false);
    }
  };

  // Fetch stations when user location or radius changes
  useEffect(() => {
    fetchNearbyStations();
  }, [userLocation.lat, userLocation.lng, radius]);

  const fetchNearbyStations = async () => {
    setLoading(true);
    try {
      const res = await getNearbyStations(userLocation.lat, userLocation.lng, radius);
      setStations(res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch nearby stations');
    } finally {
      setLoading(false);
    }
  };

  const onLoad = useCallback(function callback(mapInstance) {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback(mapInstance) {
    setMap(null);
  }, []);

  return (
    <div style={{ display: 'flex', height: '600px', background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      
      {/* Left Sidebar: List & Filters */}
      <div style={{ width: '350px', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', background: '#f8fafc', borderRadius: '8px 0 0 0' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-800)' }}>
            <MapPin size={18} />
            Find Charging Stations
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Discover stations near you (Drag the blue dot to adjust your location)</p>
        </div>

        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Search Radius (km)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="range" 
                min="5" 
                max="200" 
                value={radius} 
                onChange={(e) => setRadius(e.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '40px' }}>{radius}km</span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={fetchNearbyStations}
            style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem', display: 'flex', justifyContent: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            Refresh Stations
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f8fafc', position: 'relative' }}>
          {/* ACTIVE SESSION OVERLAY */}
          {activeSession ? (
            <div className="animate-fade-in" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: '#fff', zIndex: 10, padding: '1.5rem',
              display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'inline-flex', padding: '1rem', background: '#ecfdf5', borderRadius: '50%', marginBottom: '1rem' }}>
                  <BatteryCharging size={40} color="#10b981" className="spinner" />
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#10b981' }}>Charging in Progress</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  {activeStationInfo?.name || 'Public Station'}
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Duration</span>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {Math.floor(elapsedMinutes / 60)}h {elapsedMinutes % 60}m
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Energy Delivered</span>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {((elapsedMinutes * 0.5) || 0.5).toFixed(2)} kWh
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Current Cost</span>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', color: '#0369a1' }}>
                    ${(((elapsedMinutes * 0.5) || 0.5) * (activeStationInfo?.pricePerKwh || 0.5)).toFixed(2)}
                  </span>
                </div>
              </div>

              <button 
                type="button" 
                className="btn-danger" 
                onClick={() => setShowStopConfirm(true)}
                disabled={isStopping}
                style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', marginTop: 'auto', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isStopping ? <RefreshCw size={18} className="spinner" /> : <X size={18} />}
                Stop Charging
              </button>
            </div>
          ) : (
            <>
              {loading && <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw className="spinner" size={24} color="var(--primary-600)" /></div>}
              {!loading && error && <div className="alert alert-danger" style={{ fontSize: '0.8rem' }}>{error}</div>}
              {!loading && !error && stations.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2rem' }}>
                  No stations found within {radius}km.
                </div>
              )}
              
              {!loading && stations.map(item => (
                <div 
                  key={item.station.id} 
                  onClick={() => {
                    setSelectedStation(item.station);
                    setCenter({ lat: parseFloat(item.station.latitude), lng: parseFloat(item.station.longitude) });
                    map?.panTo({ lat: parseFloat(item.station.latitude), lng: parseFloat(item.station.longitude) });
                  }}
                  style={{
                    background: '#fff',
                    border: selectedStation?.id === item.station.id ? '2px solid var(--primary-500)' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                  }}
                >
                  <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.95rem', fontWeight: 700 }}>{item.station.name}</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.station.address}</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem' }}>
                    <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem' }}>
                      {item.station.connectorType} • {item.station.capacityKw}kW
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#15803d' }}>
                      {item.distanceKm.toFixed(1)} km away
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar: Google Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={12}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false
            }}
          >
            {/* User Location Marker */}
            <Marker 
              position={userLocation} 
              draggable={true}
              onDragEnd={(e) => {
                const newLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                setUserLocation(newLoc);
              }}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE,
                scale: 7,
                fillColor: "#3b82f6",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#ffffff"
              }} 
            />

            {/* Station Markers */}
            {stations.map(item => (
              <Marker
                key={item.station.id}
                position={{ lat: parseFloat(item.station.latitude), lng: parseFloat(item.station.longitude) }}
                onClick={() => setSelectedStation(item.station)}
                icon={{
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#0ea5e9" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'),
                  scaledSize: window.google ? new window.google.maps.Size(32, 32) : null,
                  origin: window.google ? new window.google.maps.Point(0, 0) : null,
                  anchor: window.google ? new window.google.maps.Point(16, 32) : null
                }}
              />
            ))}

            {selectedStation && (
              <InfoWindow
                position={{ lat: parseFloat(selectedStation.latitude), lng: parseFloat(selectedStation.longitude) }}
                onCloseClick={() => setSelectedStation(null)}
                options={{ pixelOffset: window.google ? new window.google.maps.Size(0, -32) : null }}
              >
                <div style={{ padding: '0.2rem', maxWidth: '200px' }}>
                  <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedStation.name}</h4>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedStation.address}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>💵 ${selectedStation.pricePerKwh}/kWh</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>⚡ {selectedStation.capacityKw}kW ({selectedStation.connectorType})</div>
                  </div>
                  <button 
                    type="button" 
                    className="submit-btn" 
                    onClick={() => {
                      setChargingCode(selectedStation.chargingCode);
                      setShowStartModal(true);
                    }}
                    style={{ margin: 0, padding: '0.35rem', fontSize: '0.75rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <Play size={14} /> Start Charge
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
            <RefreshCw size={32} className="spinner" color="var(--primary-400)" />
          </div>
        )}
      </div>

      {/* START CHARGE MODAL */}
      {showStartModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="animate-fade-in" style={{
            background: '#fff', borderRadius: '12px', padding: '2rem',
            width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap color="#eab308" /> Start Charging
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Enter the 6-character Station Code found on the physical charger to authenticate and unlock it.
            </p>

            {sessionError && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <AlertTriangle size={14} /> {sessionError}
              </div>
            )}

            <form onSubmit={handleStartSession}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <input 
                  type="text" 
                  required 
                  className="form-input" 
                  placeholder="e.g. 8F3A21" 
                  value={chargingCode}
                  onChange={(e) => setChargingCode(e.target.value.toUpperCase())}
                  style={{ fontSize: '1.5rem', letterSpacing: '0.2em', textAlign: 'center', textTransform: 'uppercase' }}
                  maxLength={6}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowStartModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={isStarting || chargingCode.length < 3} style={{ flex: 1, margin: 0 }}>
                  {isStarting ? <RefreshCw size={16} className="spinner" /> : 'Unlock & Charge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOP CHARGE MODAL */}
      {showStopConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="animate-fade-in" style={{
            background: '#fff', borderRadius: '12px', padding: '2rem',
            width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
              <AlertTriangle size={20} /> Stop Charging?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you sure you want to stop the charging session? You will be billed for the energy delivered so far, and the connector will unlock.
            </p>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowStopConfirm(false)} style={{ flex: 1 }}>
                Continue Charging
              </button>
              <button type="button" className="btn-danger" onClick={handleStopSession} disabled={isStopping} style={{ flex: 1, margin: 0, background: '#dc2626', borderColor: '#dc2626' }}>
                {isStopping ? <RefreshCw size={16} className="spinner" /> : 'Stop Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {stopSuccessMsg && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: '#10b981', color: 'white', padding: '1rem 2rem', borderRadius: '30px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 1000, fontWeight: 600
        }}>
          {stopSuccessMsg}
        </div>
      )}
    </div>
  );
}
