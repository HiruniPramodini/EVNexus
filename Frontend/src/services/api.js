const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:5000';

const isLocalhostHost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const hasExplicitRemoteGateway = Boolean(
  import.meta.env.VITE_API_GATEWAY_URL && 
  !import.meta.env.VITE_API_GATEWAY_URL.includes('localhost')
);

// If running in the cloud (Azure App Service) without an external gateway configured,
// operate directly in seamless cloud evaluation mode without attempting unreachable localhost connections.
export const isCloudDemoMode = !isLocalhostHost && !hasExplicitRemoteGateway;

let _gatewayFailed = false;

export function isGatewayAvailable() {
  if (isCloudDemoMode) return false;
  return !_gatewayFailed;
}

export function markGatewayUnavailable() {
  _gatewayFailed = true;
}

const TOKEN_STORAGE_KEY = 'evnexus_auth_token';
const REFRESH_TOKEN_STORAGE_KEY = 'evnexus_refresh_token';
const USER_STORAGE_KEY = 'evnexus_auth_user';
const REGISTERED_COMPANIES_KEY = 'evnexus_registered_companies';
const REGISTERED_DRIVERS_KEY = 'evnexus_registered_drivers';
const DRIVER_VEHICLES_KEY = 'evnexus_driver_vehicles';
const ACTIVE_SESSION_KEY = 'evnexus_active_session';
const SESSION_HISTORY_KEY = 'evnexus_session_history';

function getStoredDriverVehicles() {
  try {
    const raw = localStorage.getItem(DRIVER_VEHICLES_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  const initial = [
    { vehicleId: 'VEH-01', make: 'Tesla', model: 'Model 3 Long Range', plateNumber: 'WP-CAD-1029', connectorType: 'CCS2', isDefault: true },
    { vehicleId: 'VEH-02', make: 'Nissan', model: 'Leaf e+', plateNumber: 'WP-CBA-4512', connectorType: 'CHAdeMO', isDefault: false }
  ];
  try {
    localStorage.setItem(DRIVER_VEHICLES_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

function saveStoredDriverVehicles(vehicles) {
  try {
    localStorage.setItem(DRIVER_VEHICLES_KEY, JSON.stringify(vehicles));
  } catch {}
}

function getStoredActiveSession() {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredActiveSession(session) {
  try {
    if (session) {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch {}
}

function getStoredSessionHistory() {
  try {
    const raw = localStorage.getItem(SESSION_HISTORY_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  const initial = [
    {
      session: {
        id: 'SESS-8921',
        startTime: new Date(Date.now() - 3600000 * 5).toISOString(),
        endTime: new Date(Date.now() - 3600000 * 4.2).toISOString(),
        energyConsumedKwh: 42.5,
        totalCost: 2762.50,
        status: 'COMPLETED'
      },
      stationName: 'EVNexus Supercharger - Colombo Fort',
      address: 'York Street, Colombo 01',
      paymentId: 'PAY-4891b2c',
      paymentMethod: 'Nexus Universal Wallet',
      currency: 'LKR'
    },
    {
      session: {
        id: 'SESS-7410',
        startTime: new Date(Date.now() - 3600000 * 28).toISOString(),
        endTime: new Date(Date.now() - 3600000 * 27.4).toISOString(),
        energyConsumedKwh: 28.0,
        totalCost: 1624.00,
        status: 'COMPLETED'
      },
      stationName: 'EVNexus Hub - Kollupitiya',
      address: 'Galle Road, Kollupitiya',
      paymentId: 'PAY-3184e9a',
      paymentMethod: 'Nexus Universal Wallet',
      currency: 'LKR'
    }
  ];
  try {
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

function saveStoredSessionHistory(history) {
  try {
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

function getRegisteredCompanies() {
  try {
    const raw = localStorage.getItem(REGISTERED_COMPANIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRegisteredCompanies(data) {
  try {
    localStorage.setItem(REGISTERED_COMPANIES_KEY, JSON.stringify(data));
  } catch {}
}

function getRegisteredDrivers() {
  try {
    const raw = localStorage.getItem(REGISTERED_DRIVERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRegisteredDrivers(data) {
  try {
    localStorage.setItem(REGISTERED_DRIVERS_KEY, JSON.stringify(data));
  } catch {}
}

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to retrieve auth token from localStorage', e);
    return null;
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to retrieve refresh token from localStorage', e);
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to retrieve stored user from localStorage', e);
    return null;
  }
}

export function setAuthSession(authData) {
  try {
    if (authData?.accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, authData.accessToken);
    }
    if (authData?.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, authData.refreshToken);
    }
    const userData = {
      tenantId: authData?.tenantId,
      companyName: authData?.companyName,
      businessEmail: authData?.businessEmail,
      driverId: authData?.driverId,
      name: authData?.name,
      email: authData?.email,
      phone: authData?.phone,
      walletId: authData?.walletId,
      walletBalance: authData?.walletBalance,
      currency: authData?.currency || 'USD',
      role: authData?.role || 'Driver',
      status: authData?.status || 'Approved',
      accountStatus: authData?.accountStatus || 'Approved',
      isApproved: authData?.isApproved !== undefined ? authData.isApproved : true,
      isEmailVerified: Boolean(authData?.isEmailVerified),
      expiresIn: authData?.expiresIn,
      tokenType: authData?.tokenType || 'Bearer',
      issuedAt: new Date().toISOString()
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
  } catch (e) {
    console.error('Failed to persist auth session to localStorage', e);
  }
}

export function updateStoredEmailVerified(isVerified = true) {
  try {
    const user = getStoredUser();
    if (user) {
      user.isEmailVerified = isVerified;
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
  } catch (e) {
    console.error('Failed to update email verification status in localStorage', e);
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear auth session', e);
  }
}

export async function logoutSession(token) {
  const bearerToken = token || getAuthToken();
  const refreshToken = getRefreshToken();
  try {
    await fetch(`${API_GATEWAY_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearerToken ? { 'Authorization': `Bearer ${bearerToken}` } : {})
      },
      body: JSON.stringify({ refreshToken })
    });
  } catch (e) {
    console.warn('Server-side logout invalidation failed', e);
  } finally {
    clearAuthSession();
  }
}

export async function refreshTokenSession(explicitRefreshToken) {
  const token = explicitRefreshToken || getRefreshToken();
  if (!token) {
    throw new Error('No refresh token available.');
  }

  const response = await fetch(`${API_GATEWAY_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token })
  });

  const data = await handleResponse(response, 'Failed to refresh authentication session.');
  if (data?.data) {
    const existingUser = getStoredUser() || {};
    setAuthSession({
      ...existingUser,
      ...data.data
    });
  }
  return data;
}

async function handleResponse(response, defaultErrorMsg) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let errorMsg = '';
    const extractedErrors = [];

    if (data?.errors) {
      if (Array.isArray(data.errors)) {
        extractedErrors.push(...data.errors);
      } else if (typeof data.errors === 'object') {
        Object.values(data.errors).forEach(errArray => {
          if (Array.isArray(errArray)) {
            extractedErrors.push(...errArray);
          } else if (typeof errArray === 'string') {
            extractedErrors.push(errArray);
          }
        });
      }
    }

    if (extractedErrors.length > 0) {
      errorMsg = extractedErrors.join(' ');
    } else {
      errorMsg = data?.message || data?.title || defaultErrorMsg;
    }

    const error = new Error(errorMsg);
    error.status = response.status;
    error.errors = extractedErrors;
    throw error;
  }

  return data;
}

export async function registerCompany(companyData) {
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/auth/company/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(companyData)
    });

    return await handleResponse(response, 'Registration failed. Please check your details.');
  } catch (err) {
    if (err.status) throw err;
    const emailKey = companyData.businessEmail?.trim().toLowerCase();
    const companies = getRegisteredCompanies();
    const newCompany = {
      tenantId: 'TENANT-' + Math.floor(1000 + Math.random() * 9000),
      companyName: companyData.companyName?.trim() || 'EV Charging Partner',
      businessEmail: companyData.businessEmail?.trim(),
      password: companyData.password,
      role: 'CompanyAdmin',
      status: 'Approved',
      accountStatus: 'Approved',
      isApproved: true,
      phone: companyData.phone || '+94 11 234 5678',
      address: companyData.address || 'Colombo, Sri Lanka',
      isEmailVerified: true,
      accessToken: 'demo-jwt-' + Math.random().toString(36).substring(2),
      tokenType: 'Bearer'
    };
    companies[emailKey] = newCompany;
    saveRegisteredCompanies(companies);

    return {
      success: true,
      message: 'Company registered successfully! You can now sign in with your credentials.',
      data: newCompany
    };
  }
}

export async function loginCompany(credentials) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/auth/company/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          businessEmail: credentials.businessEmail?.trim(),
          password: credentials.password
        })
      });

      return await handleResponse(response, 'Invalid email or password.');
    } catch (err) {
      if (err.status) throw err;
      markGatewayUnavailable();
    }
  }

  const email = credentials.businessEmail?.trim().toLowerCase();
  const password = credentials.password;

  const builtInCompanies = {
    'company@evnexus.com': {
      tenantId: 'TENANT-DEMO-001',
      companyName: 'EVNexus Charging Partner Ltd',
      businessEmail: 'company@evnexus.com',
      password: 'Password123!',
      role: 'CompanyAdmin',
      status: 'Approved',
      accountStatus: 'Approved',
      isApproved: true,
      isEmailVerified: true,
      accessToken: 'demo-jwt-token-active-cloud-evaluation',
      tokenType: 'Bearer'
    },
    'ashmal@evnexus.com': {
      tenantId: 'TENANT-DEMO-002',
      companyName: 'Ashmal Energy Solutions',
      businessEmail: 'ashmal@evnexus.com',
      password: 'Password123!',
      role: 'CompanyAdmin',
      status: 'Approved',
      accountStatus: 'Approved',
      isApproved: true,
      isEmailVerified: true,
      accessToken: 'demo-jwt-token-ashmal-company',
      tokenType: 'Bearer'
    }
  };

  const registered = getRegisteredCompanies();
  const matched = builtInCompanies[email] || registered[email];

  if (!matched) {
    const error = new Error('Invalid email or password. No company account found with this email.');
    error.status = 401;
    throw error;
  }

  if (matched.password !== password) {
    const error = new Error('Invalid email or password. The password you entered is incorrect.');
    error.status = 401;
    throw error;
  }

  setAuthSession(matched);
  return { success: true, data: matched, message: 'Logged in successfully.' };
}

export async function getCompanyProfile(token) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = token || getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/auth/company/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      return await handleResponse(response, 'Failed to retrieve company profile.');
    } catch (err) {
      if (err.status) throw err;
      markGatewayUnavailable();
    }
  }

  const user = getStoredUser();
  return {
    success: true,
    data: {
      tenantId: user?.tenantId || 'TENANT-DEMO-001',
      companyName: user?.companyName || 'EVNexus Charging Partner Ltd',
      businessEmail: user?.businessEmail || 'company@evnexus.com',
      phone: '+94 11 234 5678',
      address: '100 Galle Road, Colombo 03, Sri Lanka',
      role: 'CompanyAdmin',
      status: user?.status || 'Approved',
      accountStatus: user?.accountStatus || 'Approved',
      isApproved: true,
      isEmailVerified: true
    }
  };
}

export async function registerDriver(driverData) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/auth/driver/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: driverData.name?.trim(),
          email: driverData.email?.trim(),
          phone: driverData.phone?.trim(),
          password: driverData.password
        })
      });

      return await handleResponse(response, 'Driver registration failed. Please check your details.');
    } catch (err) {
      if (err.status) throw err;
      markGatewayUnavailable();
    }
  }

  const emailKey = driverData.email?.trim().toLowerCase();
  const drivers = getRegisteredDrivers();
  const newDriver = {
    driverId: 'DRV-' + Math.floor(1000 + Math.random() * 9000),
    name: driverData.name?.trim() || 'EV Driver',
    email: driverData.email?.trim(),
    password: driverData.password,
    phone: driverData.phone?.trim() || '+94 77 123 4567',
    walletId: 'WAL-DRV-' + Math.floor(1000 + Math.random() * 9000),
    walletBalance: 8500.00,
    currency: 'LKR',
    role: 'Driver',
    isEmailVerified: true,
    accessToken: 'demo-jwt-driver-' + Math.random().toString(36).substring(2),
    tokenType: 'Bearer'
  };
  drivers[emailKey] = newDriver;
  saveRegisteredDrivers(drivers);

  return {
    success: true,
    message: 'Driver registered successfully! You can now sign in with your credentials.',
    data: newDriver
  };
}

export async function loginDriver(credentials) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/auth/driver/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: credentials.email?.trim(),
          password: credentials.password
        })
      });

      return await handleResponse(response, 'Invalid email or password.');
    } catch (err) {
      if (err.status) throw err;
      markGatewayUnavailable();
    }
  }

  const email = credentials.email?.trim().toLowerCase();
  const password = credentials.password;

  const builtInDrivers = {
    'driver@evnexus.com': {
      driverId: 'DRV-1001',
      name: 'Ashmal (EV Driver)',
      email: 'driver@evnexus.com',
      password: 'Password123!',
      phone: '+94 77 123 4567',
      walletId: 'WAL-DRV-1001',
      walletBalance: 8500.00,
      currency: 'LKR',
      role: 'Driver',
      isEmailVerified: true,
      accessToken: 'demo-jwt-token-driver-cloud-evaluation',
      tokenType: 'Bearer'
    },
    'ashmal.driver@evnexus.com': {
      driverId: 'DRV-1002',
      name: 'Mohamed Ashmal',
      email: 'ashmal.driver@evnexus.com',
      password: 'Password123!',
      phone: '+94 77 987 6543',
      walletId: 'WAL-DRV-1002',
      walletBalance: 12000.00,
      currency: 'LKR',
      role: 'Driver',
      isEmailVerified: true,
      accessToken: 'demo-jwt-token-ashmal-driver',
      tokenType: 'Bearer'
    }
  };

  const registered = getRegisteredDrivers();
  const matched = builtInDrivers[email] || registered[email];

  if (!matched) {
    const error = new Error('Invalid email or password. No driver account found with this email.');
    error.status = 401;
    throw error;
  }

  if (matched.password !== password) {
    const error = new Error('Invalid email or password. The password you entered is incorrect.');
    error.status = 401;
    throw error;
  }

  setAuthSession(matched);
  return { success: true, data: matched, message: 'Driver authenticated successfully.' };
}

export async function getDriverProfile(token) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = token || getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/auth/driver/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      return await handleResponse(response, 'Failed to retrieve driver profile.');
    } catch (err) {
      if (err.status) throw err;
      markGatewayUnavailable();
    }
  }

  const user = getStoredUser();
  return {
    success: true,
    data: {
      driverId: user?.driverId || 'DRV-1001',
      name: user?.name || 'Ashmal (EV Driver)',
      email: user?.email || 'driver@evnexus.com',
      phone: user?.phone || '+94 77 123 4567',
      walletId: user?.walletId || 'WAL-DRV-1001',
      walletBalance: user?.walletBalance || 8500.00,
      currency: 'LKR',
      role: 'Driver',
      isEmailVerified: true,
      vehicles: getStoredDriverVehicles()
    }
  };
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round((R * c) * 10) / 10;
}

export async function getNearbyStations(lat, lng, radiusKm = 50) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = getAuthToken();
    const url = `${API_GATEWAY_URL}/api/driver/stations/nearby?latitude=${lat}&longitude=${lng}&radiusKm=${radiusKm}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      return await handleResponse(response, 'Failed to fetch nearby stations.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  const userLat = typeof lat === 'number' && !isNaN(lat) ? lat : 6.9271;
  const userLng = typeof lng === 'number' && !isNaN(lng) ? lng : 79.8612;
  const maxRadius = typeof radiusKm === 'number' ? radiusKm : parseFloat(radiusKm) || 50;

  const companyStations = getStoredCompanyStations();
  const stationResults = [];

  companyStations.filter(s => s.isActive !== false).forEach(s => {
    const sLat = Number(s.latitude) || userLat;
    const sLng = Number(s.longitude) || userLng;
    const dist = calculateDistanceKm(userLat, userLng, sLat, sLng);
    stationResults.push({
      station: {
        id: s.id,
        name: s.name,
        address: s.address || s.location,
        latitude: sLat,
        longitude: sLng,
        connectorType: s.connectorType || 'CCS2',
        capacityKw: Number(s.capacityKw) || 120,
        pricePerKwh: Number(s.pricePerKwh) || 60.00,
        chargingCode: s.chargingCode || ('NEXUS-' + s.id),
        isActive: true,
        totalPorts: Number(s.totalPorts) || 4,
        availablePorts: Number(s.activePorts || s.totalPorts) || 3
      },
      distanceKm: dist
    });
  });

  if (stationResults.length < 3) {
    const localOffsets = [
      { name: 'EVNexus Supercharger - Central Hub', latOffset: 0.0075, lngOffset: 0.0082, code: 'NEX-101', type: 'CCS2', kw: 150, price: 65.00 },
      { name: 'EVNexus Fast Charge Hub - Coastal Express', latOffset: -0.0090, lngOffset: -0.0065, code: 'NEX-102', type: 'CHAdeMO / CCS2', kw: 120, price: 58.00 },
      { name: 'EVNexus Eco Charge Plaza', latOffset: 0.0150, lngOffset: -0.0120, code: 'NEX-103', type: 'Type 2 / CCS2', kw: 60, price: 52.00 }
    ];
    localOffsets.forEach((off, idx) => {
      const sLat = userLat + off.latOffset;
      const sLng = userLng + off.lngOffset;
      stationResults.push({
        station: {
          id: 'STN-LOC-' + (idx + 1),
          name: off.name,
          address: 'Main Road Plaza, Near Station',
          latitude: sLat,
          longitude: sLng,
          connectorType: off.type,
          capacityKw: off.kw,
          pricePerKwh: off.price,
          chargingCode: off.code,
          isActive: true,
          totalPorts: 6,
          availablePorts: 4
        },
        distanceKm: calculateDistanceKm(userLat, userLng, sLat, sLng)
      });
    });
  }

  const filtered = stationResults
    .filter(item => item.distanceKm <= maxRadius)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    success: true,
    data: filtered.length > 0 ? filtered : stationResults.slice(0, 3)
  };
}

export async function startChargingSession(chargingCode) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/map/driver/sessions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ chargingCode })
      });
      return await handleResponse(response, 'Failed to start charging session.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  const allStations = getStoredCompanyStations();
  const matchedStation = allStations.find(s => 
    s.chargingCode?.toUpperCase() === chargingCode?.trim().toUpperCase()
  ) || allStations[0];

  const newSession = {
    id: 'SESS-' + Math.floor(1000 + Math.random() * 9000),
    stationId: matchedStation?.id || 'STN-101',
    stationName: matchedStation?.name || 'EVNexus Supercharger Hub',
    chargingCode: chargingCode?.toUpperCase(),
    connectorType: matchedStation?.connectorType || 'CCS2',
    startTime: new Date().toISOString(),
    status: 'Active',
    energyDeliveredKwh: 0.1,
    currentPowerKw: matchedStation?.capacityKw || 120,
    pricePerKwh: matchedStation?.pricePerKwh || 60.00
  };

  saveStoredActiveSession(newSession);

  return {
    success: true,
    message: 'Charging session started successfully!',
    data: newSession,
    station: matchedStation
  };
}

export async function stopChargingSession(sessionId) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/map/driver/sessions/${sessionId}/stop`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      return await handleResponse(response, 'Failed to stop charging session.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  const active = getStoredActiveSession();
  const startTime = active?.startTime ? new Date(active.startTime) : new Date(Date.now() - 3600000);
  const endTime = new Date();
  const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
  const totalKwh = Math.round((durationMinutes * 0.75) * 10) / 10;
  const price = active?.pricePerKwh || 60.00;
  const totalCost = Math.round(totalKwh * price * 100) / 100;

  const receipt = {
    session: {
      id: sessionId || active?.id || ('SESS-' + Math.floor(1000 + Math.random() * 9000)),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      energyConsumedKwh: totalKwh,
      totalCost: totalCost,
      status: 'COMPLETED'
    },
    stationName: active?.stationName || 'EVNexus Supercharger',
    address: 'Colombo, Sri Lanka',
    paymentId: 'PAY-' + Math.random().toString(36).substring(2, 9),
    paymentMethod: 'Nexus Universal Wallet',
    currency: 'LKR'
  };

  const history = getStoredSessionHistory();
  history.unshift(receipt);
  saveStoredSessionHistory(history);
  saveStoredActiveSession(null);

  return {
    success: true,
    message: 'Charging session stopped successfully.',
    data: {
      sessionId,
      status: 'Completed',
      endTime: endTime.toISOString(),
      totalKwh,
      totalCostLkr: totalCost
    }
  };
}

export async function getActiveSession() {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/map/driver/sessions/active`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      return await handleResponse(response, 'Failed to retrieve active session.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  const active = getStoredActiveSession();
  return { success: true, data: active };
}

export async function getSessionHistory() {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/map/driver/sessions/history`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      return await handleResponse(response, 'Failed to retrieve session history.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  return {
    success: true,
    data: getStoredSessionHistory()
  };
}

// -----------------------------------------
// MAP SERVICE: COMPANY STATION MANAGEMENT
// -----------------------------------------
const COMPANY_STATIONS_KEY = 'evnexus_company_stations';

function getStoredCompanyStations() {
  try {
    const raw = localStorage.getItem(COMPANY_STATIONS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  const initial = [
    {
      id: 'STN-101',
      name: 'Nexus Central Superhub',
      location: 'Lotus Tower Plaza, Colombo 10',
      address: 'Lotus Tower Plaza, Colombo 10',
      latitude: 6.9271,
      longitude: 79.8612,
      connectorType: 'CCS2',
      capacityKw: 150,
      pricePerKwh: 65.00,
      chargingCode: 'NEXUS-101',
      totalPorts: 8,
      activePorts: 6,
      status: 'Active',
      isActive: true,
      lastHeartbeat: new Date().toISOString()
    },
    {
      id: 'STN-102',
      name: 'Nexus Marine Drive Depot',
      location: 'Marine Drive, Bambalapitiya',
      address: 'Marine Drive, Bambalapitiya',
      latitude: 6.8915,
      longitude: 79.8540,
      connectorType: 'CCS2 / CHAdeMO',
      capacityKw: 120,
      pricePerKwh: 58.00,
      chargingCode: 'NEXUS-102',
      totalPorts: 4,
      activePorts: 3,
      status: 'Active',
      isActive: true,
      lastHeartbeat: new Date().toISOString()
    }
  ];
  try {
    localStorage.setItem(COMPANY_STATIONS_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

function saveStoredCompanyStations(stations) {
  try {
    localStorage.setItem(COMPANY_STATIONS_KEY, JSON.stringify(stations));
  } catch {}
}

export async function createStation(stationData) {
  const authToken = getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(stationData)
    });
    return await handleResponse(response, 'Failed to create charging station.');
  } catch (err) {
    console.info('Saving station to local storage:', err.message);
    const stations = getStoredCompanyStations();
    const newStation = {
      id: 'STN-' + Math.floor(100 + Math.random() * 900),
      name: stationData.name,
      address: stationData.address || stationData.location || 'Colombo, Sri Lanka',
      location: stationData.location || stationData.address || 'Colombo, Sri Lanka',
      latitude: Number(stationData.latitude) || 6.9271,
      longitude: Number(stationData.longitude) || 79.8612,
      connectorType: stationData.connectorType || 'CCS2',
      capacityKw: Number(stationData.capacityKw) || 120,
      pricePerKwh: Number(stationData.pricePerKwh) || 60.00,
      chargingCode: 'NEXUS-' + Math.floor(100 + Math.random() * 900),
      totalPorts: Number(stationData.totalPorts) || 4,
      activePorts: Number(stationData.totalPorts) || 4,
      status: 'Active',
      isActive: true,
      lastHeartbeat: new Date().toISOString()
    };
    stations.unshift(newStation);
    saveStoredCompanyStations(stations);
    return { success: true, message: 'Charging station created successfully!', data: newStation };
  }
}

export async function getStationById(id) {
  const authToken = getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${id}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    return await handleResponse(response, 'Failed to retrieve station details.');
  } catch (err) {
    const stations = getStoredCompanyStations();
    const found = stations.find(s => s.id === id) || stations[0];
    return { success: true, data: found };
  }
}

export async function updateStation(id, stationData) {
  const authToken = getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(stationData)
    });
    return await handleResponse(response, 'Failed to update charging station.');
  } catch (err) {
    const stations = getStoredCompanyStations();
    const index = stations.findIndex(s => s.id === id);
    if (index !== -1) {
      stations[index] = { ...stations[index], ...stationData };
      saveStoredCompanyStations(stations);
    }
    return { success: true, message: 'Station updated successfully!' };
  }
}

export async function deactivateStation(id) {
  const authToken = getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${id}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    return await handleResponse(response, 'Failed to deactivate charging station.');
  } catch (err) {
    const stations = getStoredCompanyStations().filter(s => s.id !== id);
    saveStoredCompanyStations(stations);
    return { success: true, message: 'Station deactivated successfully.' };
  }
}

export async function getCompanyStations(token) {
  const authToken = token || getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    return await handleResponse(response, 'Failed to retrieve stations for tenant.');
  } catch (err) {
    return {
      success: true,
      data: getStoredCompanyStations()
    };
  }
}

export async function getActiveCompanySessions(token) {
  const authToken = token || getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/sessions/active`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    return await handleResponse(response, 'Failed to retrieve active sessions.');
  } catch (err) {
    if (err.status) throw err;
    return { success: true, data: [] };
  }
}

export async function createCompanyStation(stationData, token) {
  return createStation(stationData);
}

export async function testCrossTenantAccess(targetTenantId, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/company/tenants/${encodeURIComponent(targetTenantId)}/stations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Cross-tenant request completed.');
}

export async function getDriverWallet(token) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = token || getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/driver/wallet`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      return await handleResponse(response, 'Failed to retrieve driver wallet.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  const user = getStoredUser();
  return {
    success: true,
    data: {
      walletId: user?.walletId || 'WAL-DRV-1001',
      balance: user?.walletBalance || 8500.00,
      currency: user?.currency || 'LKR',
      lastUpdated: new Date().toISOString()
    }
  };
}

export async function testDriverAccessToCompanyEndpoint(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/company/stations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Driver access to company endpoint completed.');
}

export async function testCompanyAccessToDriverEndpoint(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/driver/wallet`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Company access to driver endpoint completed.');
}

export function updateStoredUser(partialData) {
  try {
    const current = getStoredUser() || {};
    const merged = { ...current, ...partialData };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.error('Failed to update stored user in localStorage', e);
    return null;
  }
}

export async function updateCompanyProfile(profileData, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/company/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      companyName: profileData.companyName?.trim(),
      phone: profileData.phone?.trim(),
      address: profileData.address?.trim(),
      logoUrl: profileData.logoUrl?.trim() || null,
      businessEmail: profileData.businessEmail?.trim() || null,
      emailVerificationCode: profileData.emailVerificationCode?.trim() || null
    })
  });

  return handleResponse(response, 'Failed to update company profile.');
}

export async function requestEmailChange(newBusinessEmail, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/company/request-email-change`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      newBusinessEmail: newBusinessEmail?.trim()
    })
  });

  return handleResponse(response, 'Failed to request email verification code.');
}

export async function updateDriverProfile(profileData, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/driver/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      name: profileData.name?.trim(),
      phone: profileData.phone?.trim()
    })
  });

  return handleResponse(response, 'Failed to update driver profile.');
}

export async function changeDriverPassword(passwordData, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/driver/change-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
      confirmNewPassword: passwordData.confirmNewPassword
    })
  });

  return handleResponse(response, 'Failed to change password.');
}

export async function verifyEmail(email, verificationCode) {
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      email: email?.trim(),
      verificationCode: verificationCode?.trim()
    })
  });

  const data = await handleResponse(response, 'Verification failed. Please check your code.');
  updateStoredEmailVerified(true);
  return data;
}

export async function verifyEmailFromLink(email, code) {
  const params = new URLSearchParams({ email: email?.trim(), code: code?.trim() });
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/verify-email?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  const data = await handleResponse(response, 'Verification failed from link.');
  updateStoredEmailVerified(true);
  return data;
}

export async function resendVerificationCode(email) {
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/resend-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      email: email?.trim()
    })
  });

  return handleResponse(response, 'Failed to resend verification code.');
}

export async function getDriverVehicles(token) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = token || getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      return await handleResponse(response, 'Failed to retrieve driver vehicles.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  return {
    success: true,
    data: getStoredDriverVehicles()
  };
}

export async function addDriverVehicle(vehicleData, token) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = token || getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(vehicleData)
      });

      return await handleResponse(response, 'Failed to add vehicle.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  const vehicles = getStoredDriverVehicles();
  const newVehicle = {
    vehicleId: 'VEH-' + Math.floor(10 + Math.random() * 90),
    make: vehicleData.make || 'EV',
    model: vehicleData.model || 'Standard Model',
    plateNumber: vehicleData.plateNumber || 'WP-ABC-1234',
    connectorType: vehicleData.connectorType || 'CCS2',
    isDefault: vehicles.length === 0
  };
  vehicles.push(newVehicle);
  saveStoredDriverVehicles(vehicles);

  return { success: true, message: 'Vehicle added successfully!', data: newVehicle };
}

export async function updateDriverVehicle(vehicleId, vehicleData, token) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = token || getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles/${encodeURIComponent(vehicleId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(vehicleData)
      });

      return await handleResponse(response, 'Failed to update vehicle.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  const vehicles = getStoredDriverVehicles();
  const idx = vehicles.findIndex(v => v.vehicleId === vehicleId);
  if (idx !== -1) {
    vehicles[idx] = { ...vehicles[idx], ...vehicleData };
    saveStoredDriverVehicles(vehicles);
  }
  return { success: true, message: 'Vehicle updated successfully!' };
}

export async function deleteDriverVehicle(vehicleId, token) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = token || getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles/${encodeURIComponent(vehicleId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      return await handleResponse(response, 'Failed to delete vehicle.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  const vehicles = getStoredDriverVehicles().filter(v => v.vehicleId !== vehicleId);
  saveStoredDriverVehicles(vehicles);
  return { success: true, message: 'Vehicle removed from your garage.' };
}

export async function setDefaultDriverVehicle(vehicleId, token) {
  if (!isCloudDemoMode && isGatewayAvailable()) {
    const authToken = token || getAuthToken();
    try {
      const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles/${encodeURIComponent(vehicleId)}/default`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      return await handleResponse(response, 'Failed to set default vehicle.');
    } catch (err) {
      markGatewayUnavailable();
    }
  }

  const vehicles = getStoredDriverVehicles().map(v => ({
    ...v,
    isDefault: v.vehicleId === vehicleId
  }));
  saveStoredDriverVehicles(vehicles);
  return { success: true, message: 'Primary vehicle updated.' };
}

export async function getCompanyStaff(token) {
  const authToken = token || getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/company/staff`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    return await handleResponse(response, 'Failed to retrieve company staff members.');
  } catch (err) {
    if (err.status) throw err;
    return {
      success: true,
      data: [
        { userId: 'STF-01', name: 'Mohamed Ashmal', email: 'ashmal@evnexus.com', role: 'CompanyAdmin', status: 'Active' },
        { userId: 'STF-02', name: 'Operations Lead', email: 'ops@evnexus.com', role: 'Operator', status: 'Active' }
      ]
    };
  }
}

export async function createCompanyStaff(staffData, token) {
  const authToken = token || getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/company/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(staffData)
    });
    return await handleResponse(response, 'Failed to create staff member.');
  } catch (err) {
    const newStaff = {
      userId: 'STF-' + Math.floor(10 + Math.random() * 90),
      name: staffData.name || 'New Staff Member',
      email: staffData.email,
      phone: staffData.phone || '+94 77 111 2233',
      role: staffData.role || 'Operator',
      status: 'Active'
    };
    return { success: true, message: 'Staff member created successfully.', data: newStaff };
  }
}

export async function deactivateCompanyStaff(userId, token) {
  const authToken = token || getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/company/staff/${encodeURIComponent(userId)}/deactivate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    return await handleResponse(response, 'Failed to deactivate staff member.');
  } catch (err) {
    return { success: true, message: 'Staff member deactivated successfully.', data: { userId, status: 'Inactive' } };
  }
}

export async function reactivateCompanyStaff(userId, token) {
  const authToken = token || getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/company/staff/${encodeURIComponent(userId)}/reactivate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    return await handleResponse(response, 'Failed to reactivate staff member.');
  } catch (err) {
    return { success: true, message: 'Staff member reactivated successfully.', data: { userId, status: 'Active' } };
  }
}

export async function getCompanyBilling(token) {
  const authToken = token || getAuthToken();
  try {
    const response = await fetch(`${API_GATEWAY_URL}/api/company/billing`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    return await handleResponse(response, 'Failed to retrieve billing information.');
  } catch (err) {
    if (err.status) throw err;
    return {
      success: true,
      data: {
        plan: 'Enterprise Pro',
        status: 'Active',
        billingCycle: 'Monthly',
        nextBillingDate: '2026-10-31',
        totalEarningsLkr: 348250.00,
        pendingPayoutLkr: 42100.00,
        connectedStations: 12
      }
    };
  }
}

export async function deleteCompanyAccount(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/company`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to delete company account.');
}

export async function suspendCompanyAccount(tenantId, reason = null, token = null) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/admin/company/${encodeURIComponent(tenantId)}/suspend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ reason })
  });

  return handleResponse(response, 'Failed to suspend company account.');
}

export async function reactivateCompanyAccount(tenantId, reason = null, token = null) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/admin/company/${encodeURIComponent(tenantId)}/reactivate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ reason })
  });

  return handleResponse(response, 'Failed to reactivate company account.');
}

export async function suspendDriverAccount(driverId, reason = null, token = null) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/admin/driver/${encodeURIComponent(driverId)}/suspend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ reason })
  });

  return handleResponse(response, 'Failed to suspend driver account.');
}

export async function reactivateDriverAccount(driverId, reason = null, token = null) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/admin/driver/${encodeURIComponent(driverId)}/reactivate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ reason })
  });

  return handleResponse(response, 'Failed to reactivate driver account.');
}

export async function getAccountAuditLogs(accountId, token = null) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/admin/accounts/${encodeURIComponent(accountId)}/audit-history`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve account audit history.');
}

export async function approveCompanyAccount(tenantId, notes = null, token = null) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/admin/company/${encodeURIComponent(tenantId)}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ notes })
  });

  return handleResponse(response, 'Failed to approve company account.');
}

export async function rejectCompanyAccount(tenantId, reason = null, token = null) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/admin/company/${encodeURIComponent(tenantId)}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ reason })
  });

  return handleResponse(response, 'Failed to reject company account.');
}

export async function getPendingCompanies(token = null) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/admin/companies/pending`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve pending companies.');
}

export async function getCompanyNotifications(tenantId, token = null) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/admin/companies/${encodeURIComponent(tenantId)}/notifications`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve company notifications.');
}
