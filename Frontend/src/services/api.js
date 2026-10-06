const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:5000';

const TOKEN_STORAGE_KEY = 'evnexus_auth_token';
const REFRESH_TOKEN_STORAGE_KEY = 'evnexus_refresh_token';
const USER_STORAGE_KEY = 'evnexus_auth_user';

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
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/company/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(companyData)
  });

  return handleResponse(response, 'Registration failed. Please check your details.');
}

export async function loginCompany(credentials) {
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

  return handleResponse(response, 'Invalid email or password.');
}

export async function getCompanyProfile(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/company/profile`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve company profile.');
}

export async function registerDriver(driverData) {
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

  return handleResponse(response, 'Driver registration failed. Please check your details.');
}

export async function loginDriver(credentials) {
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

  return handleResponse(response, 'Invalid email or password.');
}

export async function getDriverProfile(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/driver/profile`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve driver profile.');
}

export async function getNearbyStations(lat, lng, radiusKm = 50) {
  const authToken = getAuthToken();
  const url = `${API_GATEWAY_URL}/api/driver/stations/nearby?latitude=${lat}&longitude=${lng}&radiusKm=${radiusKm}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to fetch nearby stations.');
}

export async function validateQrCode(qrPayloadRaw, token) {
  const authToken = token || getAuthToken();

  // qrPayloadRaw may be a raw JSON string (from jsqr) or an already-parsed object.
  let parsed;
  if (typeof qrPayloadRaw === 'string') {
    try {
      parsed = JSON.parse(qrPayloadRaw);
    } catch {
      throw new Error('Invalid QR code. Could not read the QR data.');
    }
  } else {
    parsed = qrPayloadRaw;
  }

  // Validate system field before sending network request
  if (!parsed || parsed.system !== 'EVNEXUS') {
    throw new Error('This QR code is not an EVNexus charger QR code.');
  }

  const response = await fetch(`${API_GATEWAY_URL}/api/driver/stations/qr/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(parsed)
  });
  return handleResponse(response, 'Failed to validate QR code.');
}

export async function startChargingSession(sessionPayload, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/driver/sessions/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(sessionPayload) // { CompanyId, StationId, ChargerId, EstimatedCost }
  });
  return handleResponse(response, 'Failed to start charging session.');
}

export async function authorizePayment(paymentPayload, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/payment/authorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(paymentPayload)
  });
  return handleResponse(response, 'Failed to authorize payment.');
}

export async function getPaymentStatus(sessionId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/payment/session/${sessionId}/status`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to fetch payment status.');
}

export async function completePaymentBySession(sessionId, finalAmount) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/payment/complete-by-session/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ finalAmount })
  });
  return handleResponse(response, 'Failed to complete payment.');
}

export async function stopChargingSession(sessionId, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/driver/sessions/${sessionId}/stop`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to stop charging session.');
}

export async function getActiveSession(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/driver/sessions/active`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to retrieve active session.');
}

export async function getSessionMeter(sessionId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/driver/sessions/${sessionId}/meter`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to retrieve meter reading.');
}

export async function getSessionHistory(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/driver/sessions/history`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to retrieve session history.');
}

// -----------------------------------------
// MAP SERVICE: COMPANY STATION MANAGEMENT
// -----------------------------------------
export async function createStation(stationData) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(stationData)
  });
  return handleResponse(response, 'Failed to create charging station.');
}

export async function getStationById(id) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${id}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to retrieve station details.');
}

export async function updateStation(id, stationData) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(stationData)
  });
  return handleResponse(response, 'Failed to update charging station.');
}

export async function deactivateStation(id) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${id}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to deactivate charging station.');
}

export async function getCompanyStations(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve stations for tenant.');
}

export async function getActiveCompanySessions(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/company/sessions/active`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to retrieve active sessions.');
}

export async function createCompanyStation(stationData, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(stationData)
  });

  return handleResponse(response, 'Failed to create charging station.');
}

export async function addChargerToStation(stationId, chargerData) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${stationId}/chargers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(chargerData)
  });
  return handleResponse(response, 'Failed to add charger.');
}

export async function getStationChargers(stationId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${stationId}/chargers`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to fetch chargers.');
}

export async function getStationQr(stationId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${stationId}/qr`, {
export async function getChargerQr(stationId, chargerId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${stationId}/chargers/${chargerId}/qr`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to get QR for station.');
  return handleResponse(response, 'Failed to get QR for charger.');
}

export async function updateCharger(stationId, chargerId, chargerData) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${stationId}/chargers/${chargerId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(chargerData)
  });
  return handleResponse(response, 'Failed to update charger.');
}

export async function deleteCharger(stationId, chargerId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/map/company/stations/${stationId}/chargers/${chargerId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to delete charger.');
}

function buildUrlWithFilters(baseUrl, startDate, endDate, stationId) {
  const url = new URL(baseUrl);
  if (startDate) url.searchParams.append('startDate', startDate);
  if (endDate) url.searchParams.append('endDate', endDate);
  if (stationId) url.searchParams.append('stationId', stationId);
  return url.toString();
}

export async function getDashboardAnalytics(companyId, startDate = null, endDate = null, stationId = null) {
  const authToken = getAuthToken();
  const url = buildUrlWithFilters(`${API_GATEWAY_URL}/api/payment/analytics/company/${companyId}`, startDate, endDate, stationId);
  const response = await fetch(url, {
export async function getDashboardAnalytics(companyId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/dashboard/company/${companyId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to get dashboard analytics.');
}

export async function getCompanyTransactions(companyId, startDate = null, endDate = null, stationId = null) {
  const authToken = getAuthToken();
  const url = buildUrlWithFilters(`${API_GATEWAY_URL}/api/payment/analytics/company/${companyId}/transactions`, startDate, endDate, stationId);
  const response = await fetch(url, {
export async function getCompanyTransactions(companyId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/dashboard/company/${companyId}/transactions`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to get dashboard transactions.');
}

export async function getCompanyRevenueTrend(companyId, startDate = null, endDate = null, stationId = null) {
  const authToken = getAuthToken();
  const url = buildUrlWithFilters(`${API_GATEWAY_URL}/api/payment/analytics/company/${companyId}/revenue-trend`, startDate, endDate, stationId);
  const response = await fetch(url, {
export async function getCompanyRevenueTrend(companyId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/dashboard/company/${companyId}/revenue-trend`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to get dashboard revenue trend.');
}

export async function getStationAnalytics(companyId, startDate = null, endDate = null, stationId = null) {
  const authToken = getAuthToken();
  const url = buildUrlWithFilters(`${API_GATEWAY_URL}/api/payment/analytics/company/${companyId}/stations`, startDate, endDate, stationId);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to get station analytics.');
}

export async function getCompanyForecast(companyId) {
  const authToken = getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/dashboard/company/${companyId}/forecast`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });
  return handleResponse(response, 'Failed to get forecast data.');
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
  const authToken = token || getAuthToken();
  // Wallet is owned by Payment Service — route via /api/payment/wallet
  const response = await fetch(`${API_GATEWAY_URL}/api/payment/wallet`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve driver wallet.');
}

export async function topUpWallet(amount, idempotencyKey = null, token = null) {
  const authToken = token || getAuthToken();
  const body = { amount };
  if (idempotencyKey) {
    body.idempotencyKey = idempotencyKey;
  }
  const response = await fetch(`${API_GATEWAY_URL}/api/payment/wallet/topup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(body)
  });

  return handleResponse(response, 'Failed to top up wallet.');
}

export async function getWalletTransactions(page = 1, pageSize = 20, token) {
  const authToken = token || getAuthToken();
  const url = new URL(`${API_GATEWAY_URL}/api/payment/wallet/transactions`);
  url.searchParams.append('page', page);
  url.searchParams.append('pageSize', pageSize);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve wallet transactions.');
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
  // This test helper intentionally calls the payment wallet endpoint to verify
  // that a CompanyAdmin JWT is rejected with 403 by the Payment Service.
  const response = await fetch(`${API_GATEWAY_URL}/api/payment/wallet`, {
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
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve driver vehicles.');
}

export async function addDriverVehicle(vehicleData, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(vehicleData)
  });

  return handleResponse(response, 'Failed to add vehicle.');
}

export async function updateDriverVehicle(vehicleId, vehicleData, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(vehicleData)
  });

  return handleResponse(response, 'Failed to update vehicle.');
}

export async function deleteDriverVehicle(vehicleId, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to delete vehicle.');
}

export async function setDefaultDriverVehicle(vehicleId, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/driver/vehicles/${encodeURIComponent(vehicleId)}/default`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to set default vehicle.');
}

export async function getCompanyStaff(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/company/staff`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve company staff members.');
}

export async function createCompanyStaff(staffData, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/company/staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(staffData)
  });

  return handleResponse(response, 'Failed to create staff member.');
}

export async function deactivateCompanyStaff(userId, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/company/staff/${encodeURIComponent(userId)}/deactivate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to deactivate staff member.');
}

export async function reactivateCompanyStaff(userId, token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/company/staff/${encodeURIComponent(userId)}/reactivate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to reactivate staff member.');
}

export async function getCompanyBilling(token) {
  const authToken = token || getAuthToken();
  const response = await fetch(`${API_GATEWAY_URL}/api/company/billing`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  return handleResponse(response, 'Failed to retrieve billing information.');
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
