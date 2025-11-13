import { ACCESS_TOKEN, REFRESH_TOKEN } from "./constants";

// Use environment variable if set, otherwise use Choreo proxy path
// For production on Choreo, this should be the Choreo proxy path
// For direct backend access, use: https://42b73c45-e46a-4ab7-8e13-f21ad7bee0b9-dev.e1-eu-west-cdp.choreoapis.dev/panorama/backend/v1.0
const getEnvVar = (key: string): string | undefined => {
  // @ts-ignore - Vite environment variables
  return import.meta.env[key];
};

const apiUrl = getEnvVar('VITE_URL') || 'http://127.0.0.1:8000';

// Helper function to refresh access token
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN);
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}/api/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.access) {
        localStorage.setItem(ACCESS_TOKEN, data.access);
        return data.access;
      }
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
  }

  // If refresh fails, clear tokens
  localStorage.removeItem(ACCESS_TOKEN);
  localStorage.removeItem(REFRESH_TOKEN);
  return null;
}

// Helper function for API calls that returns data directly
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  let token = localStorage.getItem(ACCESS_TOKEN);
  
  // Don't set Content-Type for FormData, let the browser set it with boundary
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...options.headers,
  };
  
  // Only add Authorization header if we have a token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  let response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
  });

  // If 401, try to refresh token and retry once
  if (response.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry the request with the new token
      const retryHeaders: HeadersInit = {
        'Authorization': `Bearer ${newToken}`,
        ...options.headers,
      };
      if (!isFormData) {
        retryHeaders['Content-Type'] = 'application/json';
      }
      response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'API request failed' }));
    const errorMessage = error.detail || error.error || error.message || 'API request failed';
    const errorObj = new Error(errorMessage);
    (errorObj as any).response = error;
    (errorObj as any).status = response.status;
    throw errorObj;
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return null;
  }

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text);
}
