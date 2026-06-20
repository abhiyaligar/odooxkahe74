const BASE_URL = import.meta.env.VITE_URL;

async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Let browser automatically set Content-Type for URLSearchParams or FormData
  if (options.body instanceof URLSearchParams || options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Trigger global logout
    localStorage.removeItem('access_token');
    window.dispatchEvent(new Event('auth-expired'));
  }

  if (!response.ok) {
    let errorMsg = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        if (typeof errorData.detail === 'string') {
          errorMsg = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMsg = errorData.detail.map(e => e.msg).join(', ');
        }
      }
    } catch (e) {
      // Ignore
    }
    throw new Error(errorMsg);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  get: (endpoint) => fetchWithAuth(endpoint, { method: 'GET' }),
  post: (endpoint, body, customHeaders = {}) => fetchWithAuth(endpoint, { 
    method: 'POST', 
    body: body instanceof URLSearchParams ? body : JSON.stringify(body),
    headers: customHeaders 
  }),
  put: (endpoint, body) => fetchWithAuth(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => fetchWithAuth(endpoint, { method: 'DELETE' }),
};
