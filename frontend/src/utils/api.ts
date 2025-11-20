import { ACCESS_TOKEN, REFRESH_TOKEN } from "./constants";

// Use environment variable if set, otherwise use Choreo proxy path
// For production on Choreo, this should be the Choreo proxy path
// For direct backend access, use: https://42b73c45-e46a-4ab7-8e13-f21ad7bee0b9-dev.e1-eu-west-cdp.choreoapis.dev/panorama/backend/v1.0
const getEnvVar = (key: string): string | undefined => {
  // @ts-ignore - Vite environment variables
  return import.meta.env[key];
};

const apiUrl = getEnvVar('VITE_URL') || 'http://127.0.0.1:8000';

// Request deduplication: Track ongoing requests to prevent duplicate calls
const pendingRequests = new Map<string, Promise<any>>();

// Response cache: Cache GET requests for a short period
interface CacheEntry {
  data: any;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();
// Increase cache TTL for production to reduce API calls
const CACHE_TTL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
  ? 30000 // 30 seconds for production
  : 5000; // 5 seconds for development

// Generate a cache key from endpoint and options
function getCacheKey(endpoint: string, options: RequestInit): string {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : '';
  return `${method}:${endpoint}:${body}`;
}

// Check if a request should be cached (only GET requests)
function shouldCache(method: string): boolean {
  return !method || method === 'GET';
}

// Check if cached data is still valid
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

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
  const method = options.method || 'GET';
  const cacheKey = getCacheKey(endpoint, options);
  
  // Check cache first for GET requests
  if (shouldCache(method)) {
    const cached = responseCache.get(cacheKey);
    if (cached && isCacheValid(cached)) {
      return cached.data;
    }
  }
  
  // Check if there's already a pending request for this endpoint
  const pendingRequest = pendingRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }
  
  // Create the actual request function
  const makeRequest = async () => {
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
    
    // Add keep-alive header for better connection reuse
    headers['Connection'] = 'keep-alive';
    
    // Add timeout for production to prevent hanging requests
    // Use longer timeout for CSV import (10 minutes), email sending (60 seconds), contacts list (2 minutes), file uploads (120 seconds) vs regular requests (30 seconds)
    const isImportRequest = endpoint.includes('/csv-import/');
    const isEmailSendRequest = endpoint.includes('/emails/send/') || endpoint.includes('/emails/fetch/');
    const isContactsListRequest = endpoint.includes('/api/contacts/') && !endpoint.includes('/csv-import');
    const isFileUploadRequest = endpoint.includes('/upload') || endpoint.includes('/upload-logo/') || endpoint.includes('/document-upload/');
    const timeoutDuration = isImportRequest ? 600000 : (isFileUploadRequest ? 120000 : (isEmailSendRequest ? 60000 : (isContactsListRequest ? 120000 : 30000))); // 10 min for imports, 2 min for file uploads, 60 sec for email operations, 2 min for contacts list, 30 sec otherwise
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    
    let response;
    try {
      response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout - please check your connection');
        (timeoutError as any).status = 408;
        throw timeoutError;
      }
      throw error;
    }

    // If 401, try to refresh token and retry once
    if (response.status === 401) {
      if (!token) {
        // No token available, redirect to login
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        const error = await response.json().catch(() => ({ detail: 'Authentication required. Please log in.' }));
        const errorMessage = error.detail || error.error || error.message || 'Authentication required. Please log in.';
        const errorObj = new Error(errorMessage);
        (errorObj as any).response = error;
        (errorObj as any).status = 401;
        throw errorObj;
      }
      
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry the request with the new token
        const retryHeaders: HeadersInit = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
          'Connection': 'keep-alive',
        };
        if (!isFormData) {
          retryHeaders['Content-Type'] = 'application/json';
        }
        
        // Add timeout for retry as well
        const retryController = new AbortController();
        const retryTimeoutDuration = isImportRequest ? 600000 : (isEmailSendRequest ? 60000 : (isContactsListRequest ? 120000 : 30000));
        const retryTimeoutId = setTimeout(() => retryController.abort(), retryTimeoutDuration);
        
        try {
          response = await fetch(`${apiUrl}${endpoint}`, {
            ...options,
            headers: retryHeaders,
            body: options.body, // Ensure body is preserved
            signal: retryController.signal,
          });
          clearTimeout(retryTimeoutId);
        } catch (retryError: any) {
          clearTimeout(retryTimeoutId);
          if (retryError.name === 'AbortError') {
            const timeoutError = new Error('Request timeout - please check your connection');
            (timeoutError as any).status = 408;
            throw timeoutError;
          }
          throw retryError;
        }
        
        // If retry still fails with 401, redirect to login
        if (response.status === 401) {
          localStorage.removeItem(ACCESS_TOKEN);
          localStorage.removeItem(REFRESH_TOKEN);
          // Redirect to login page
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          const error = await response.json().catch(() => ({ detail: 'Authentication failed. Please log in again.' }));
          const errorMessage = error.detail || error.error || error.message || 'Authentication failed. Please log in again.';
          const errorObj = new Error(errorMessage);
          (errorObj as any).response = error;
          (errorObj as any).status = 401;
          throw errorObj;
        }
      } else {
        // Token refresh failed, clear tokens and redirect to login
        localStorage.removeItem(ACCESS_TOKEN);
        localStorage.removeItem(REFRESH_TOKEN);
        // Redirect to login page
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        const error = await response.json().catch(() => ({ detail: 'Authentication failed. Please log in again.' }));
        const errorMessage = error.detail || error.error || error.message || 'Authentication failed. Please log in again.';
        const errorObj = new Error(errorMessage);
        (errorObj as any).response = error;
        (errorObj as any).status = 401;
        throw errorObj;
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

    const data = JSON.parse(text);
    
    // Cache GET responses
    if (shouldCache(method)) {
      responseCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
    }
    
    return data;
  };
  
  // Store the promise to prevent duplicate requests
  const requestPromise = makeRequest().finally(() => {
    // Remove from pending requests when done
    pendingRequests.delete(cacheKey);
  });
  
  pendingRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
}

// Clear cache for a specific endpoint (useful after mutations)
export function clearApiCache(endpoint?: string) {
  if (endpoint) {
    // Clear all cache entries matching this endpoint
    for (const [key] of responseCache) {
      if (key.includes(endpoint)) {
        responseCache.delete(key);
      }
    }
  } else {
    // Clear all cache
    responseCache.clear();
  }
}
