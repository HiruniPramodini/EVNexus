const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:5000';

export async function registerCompany(companyData) {
  const response = await fetch(`${API_GATEWAY_URL}/api/auth/company/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(companyData)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let errorMsg = '';
    const extractedErrors = [];

    if (data?.errors) {
      if (Array.isArray(data.errors)) {
        extractedErrors.push(...data.errors);
      } else if (typeof data.errors === 'object') {
        // ASP.NET ValidationProblemDetails format: { FieldName: ["Error 1", "Error 2"] }
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
      errorMsg = data?.message || data?.title || 'Registration failed. Please check your details.';
    }

    const error = new Error(errorMsg);
    error.status = response.status;
    error.errors = extractedErrors;
    throw error;
  }

  return data;
}
