const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:5000';

const TOKEN_STORAGE_KEY = 'evnexus_auth_token';
const USER_STORAGE_KEY = 'evnexus_auth_user';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setAuthSession(authData) {
  try {
    if (authData?.accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, authData.accessToken);
    }
    const userData = {
      tenantId: authData?.tenantId,
      companyName: authData?.companyName,
      businessEmail: authData?.businessEmail,
      role: authData?.role,
      expiresIn: authData?.expiresIn,
      tokenType: authData?.tokenType || 'Bearer',
      issuedAt: new Date().toISOString()
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
  } catch (e) {
    console.error('Failed to persist auth session to localStorage', e);
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear auth session', e);
  }
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

