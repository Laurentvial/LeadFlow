import { ACCESS_TOKEN, REFRESH_TOKEN } from "./constants";

// Use environment variable if set, otherwise use Choreo proxy path
// For production on Choreo, this should be the Choreo proxy path
// For direct backend access, use: https://42b73c45-e46a-4ab7-8e13-f21ad7bee0b9-dev.e1-eu-west-cdp.choreoapis.dev/panorama/backend/v1.0
const getEnvVar = (key: string): string | undefined => {
  // @ts-ignore - Vite environment variables
  return import.meta.env[key];
};

// Direct API URL - always use direct backend URL (no proxy)
// Set VITE_URL environment variable in Vercel to your Heroku backend URL
// For production: VITE_URL=https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com
// For local development: VITE_URL=http://127.0.0.1:8000 or leave unset for default
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

// Track ongoing refresh to prevent concurrent attempts
let refreshPromise: Promise<string | null> | null = null;

// Helper function to refresh access token
export async function refreshAccessToken(): Promise<string | null> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:50',message:'refreshAccessToken called',data:{hasRefreshToken:!!localStorage.getItem(REFRESH_TOKEN),hasOngoingRefresh:!!refreshPromise},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // If refresh is already in progress, return the existing promise
  if (refreshPromise) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:55',message:'Reusing ongoing refresh promise',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return refreshPromise;
  }
  
  // Create the refresh promise
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN);
    if (!refreshToken) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:68',message:'No refresh token available',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      refreshPromise = null;
      return null;
    }

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:74',message:'Sending refresh token request',data:{refreshTokenLength:refreshToken.length},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const response = await fetch(`${apiUrl}/api/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
        mode: 'cors', // Explicitly enable CORS
        credentials: 'include', // Include credentials if needed
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:84',message:'Refresh token response received',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (response.ok) {
        const data = await response.json();
        if (data.access) {
          localStorage.setItem(ACCESS_TOKEN, data.access);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:90',message:'Token refresh successful',data:{newTokenLength:data.access.length},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          refreshPromise = null;
          return data.access;
        }
      } else {
        // #region agent log
        const errorText = await response.text().catch(()=>'');
        fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:95',message:'Token refresh failed',data:{status:response.status,statusText:response.statusText,errorText:errorText.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:99',message:'Token refresh exception',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('Error refreshing token:', error);
    }

    // If refresh fails, clear tokens
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:105',message:'Clearing tokens after refresh failure',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    localStorage.removeItem(ACCESS_TOKEN);
    localStorage.removeItem(REFRESH_TOKEN);
    refreshPromise = null; // Clear the promise so we can retry later
    return null;
  })();
  
  return refreshPromise;
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
        mode: 'cors', // Explicitly enable CORS
        credentials: 'include', // Include credentials (cookies) if needed
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
    // BUT: Don't retry if this IS the refresh endpoint (prevents infinite loop)
    if (response.status === 401) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:202',message:'401 Unauthorized received',data:{endpoint,hasToken:!!token,isRefreshEndpoint:endpoint.includes('/token/refresh/')},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // If this is the refresh endpoint itself returning 401, don't try to refresh again
      if (endpoint.includes('/token/refresh/')) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:208',message:'Refresh endpoint returned 401, clearing tokens',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        localStorage.removeItem(ACCESS_TOKEN);
        localStorage.removeItem(REFRESH_TOKEN);
        const error = await response.json().catch(() => ({ detail: 'Refresh token expired. Please log in again.' }));
        const errorMessage = error.detail || error.error || error.message || 'Refresh token expired. Please log in again.';
        const errorObj = new Error(errorMessage);
        (errorObj as any).response = error;
        (errorObj as any).status = 401;
        throw errorObj;
      }
      
      if (!token) {
        // No token available, redirect to login
        const isRedirecting = typeof window !== 'undefined' && window.location.pathname !== '/login';
        if (isRedirecting) {
          window.location.href = '/login';
        }
        const error = await response.json().catch(() => ({ detail: 'Authentication required. Please log in.' }));
        const errorMessage = error.detail || error.error || error.message || 'Authentication required. Please log in.';
        const errorObj = new Error(errorMessage);
        (errorObj as any).response = error;
        (errorObj as any).status = 401;
        (errorObj as any).isRedirecting = isRedirecting; // Mark that we're redirecting
        throw errorObj;
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:230',message:'Attempting token refresh after 401',data:{endpoint},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const newToken = await refreshAccessToken();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:241',message:'refreshAccessToken returned',data:{endpoint,newToken:newToken?`${newToken.substring(0,20)}...`:null,newTokenLength:newToken?.length||0,isTruthy:!!newToken},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (newToken) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:242',message:'Retrying request with new token',data:{endpoint,newTokenLength:newToken.length},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:258',message:'Sending retry request',data:{endpoint,hasAuthHeader:!!retryHeaders['Authorization']},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          response = await fetch(`${apiUrl}${endpoint}`, {
            ...options,
            headers: retryHeaders,
            body: options.body, // Ensure body is preserved
            signal: retryController.signal,
            mode: 'cors', // Explicitly enable CORS
            credentials: 'include', // Include credentials (cookies) if needed
          });
          clearTimeout(retryTimeoutId);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/df404acc-d7d5-498c-9a75-ba374a3d17bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:273',message:'Retry response received',data:{endpoint,status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
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
          const isRedirecting = typeof window !== 'undefined' && window.location.pathname !== '/login';
          if (isRedirecting) {
            window.location.href = '/login';
          }
          const error = await response.json().catch(() => ({ detail: 'Authentication failed. Please log in again.' }));
          const errorMessage = error.detail || error.error || error.message || 'Authentication failed. Please log in again.';
          const errorObj = new Error(errorMessage);
          (errorObj as any).response = error;
          (errorObj as any).status = 401;
          (errorObj as any).isRedirecting = isRedirecting; // Mark that we're redirecting
          throw errorObj;
        }
      } else {
        // Token refresh failed, clear tokens and redirect to login
        localStorage.removeItem(ACCESS_TOKEN);
        localStorage.removeItem(REFRESH_TOKEN);
        // Redirect to login page
        const isRedirecting = typeof window !== 'undefined' && window.location.pathname !== '/login';
        if (isRedirecting) {
          window.location.href = '/login';
        }
        const error = await response.json().catch(() => ({ detail: 'Authentication failed. Please log in again.' }));
        const errorMessage = error.detail || error.error || error.message || 'Authentication failed. Please log in again.';
        const errorObj = new Error(errorMessage);
        (errorObj as any).response = error;
        (errorObj as any).status = 401;
        (errorObj as any).isRedirecting = isRedirecting; // Mark that we're redirecting
        throw errorObj;
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'API request failed' }));
      
      // Extract error message from various Django REST Framework error formats
      let errorMessage = error.detail || error.error || error.message;
      
      // Handle non_field_errors format: {"non_field_errors": ["message"]}
      if (!errorMessage && error.non_field_errors && Array.isArray(error.non_field_errors) && error.non_field_errors.length > 0) {
        errorMessage = error.non_field_errors[0];
      }
      
      // Handle field-specific errors: {"name": ["message"]} or {"name": "message"}
      if (!errorMessage) {
        const fieldErrors = Object.keys(error).filter(key => key !== 'detail' && key !== 'error' && key !== 'message' && key !== 'non_field_errors');
        if (fieldErrors.length > 0) {
          const firstFieldError = error[fieldErrors[0]];
          if (Array.isArray(firstFieldError) && firstFieldError.length > 0) {
            errorMessage = firstFieldError[0];
          } else if (typeof firstFieldError === 'string') {
            errorMessage = firstFieldError;
          }
        }
      }
      
      errorMessage = errorMessage || 'API request failed';
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
