/**
 * API Client wrapper over native fetch.
 * Automatically injects the JWT token from localStorage.
 * Handles 401 Unauthorized globally.
 */

export async function apiClient(endpoint, options = {}) {
  const authData = JSON.parse(localStorage.getItem('eron_auth_session') || '{}');
  const token = authData.token;

  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Ensure Content-Type is set for JSON bodies
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    // Clear session and force reload to login
    localStorage.removeItem('eron_auth_session');
    if (token) {
      window.location.reload();
    }
  }

  return response;
}
