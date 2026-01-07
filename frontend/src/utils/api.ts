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
  // If refresh is already in progress, return the existing promise
  if (refreshPromise) {
    return refreshPromise;
  }
  
  // Create the refresh promise
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN);
    if (!refreshToken) {
      refreshPromise = null;
      return null;
    }

    try {
      const response = await fetch(`${apiUrl}/api/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
        mode: 'cors', // Explicitly enable CORS
        credentials: 'include', // Include credentials if needed
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access) {
          localStorage.setItem(ACCESS_TOKEN, data.access);
          refreshPromise = null;
          return data.access;
        }
      } else {
        const errorText = await response.text().catch(()=>'');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    }

    // If refresh fails, clear tokens
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
    // Maximum timeout is 10 seconds as requested - file size should be validated before upload
    // Use longer timeout only for CSV import (10 minutes), email sending (60 seconds), contacts list (dynamic based on page_size), events (5 minutes) vs regular requests (10 seconds)
    const isImportRequest = endpoint.includes('/csv-import/');
    const isEmailSendRequest = endpoint.includes('/emails/send/') || endpoint.includes('/emails/fetch/');
    // Match events endpoints: /api/events/ with optional query params
    const isEventsRequest = (
      endpoint === '/api/events/' || 
      endpoint.startsWith('/api/events/?')
    );
    // Only match the actual list endpoints: /api/contacts/ and /api/contacts/fosse/ (with optional query params)
    // Exclude endpoints like /api/contacts/create/, /api/contacts/assigned-today-count/, etc.
    // Match pattern: /api/contacts/ or /api/contacts/fosse/ followed by optional query params
    const isContactsListRequest = (
      endpoint === '/api/contacts/' || 
      endpoint.startsWith('/api/contacts/?') ||
      endpoint === '/api/contacts/fosse/' ||
      endpoint.startsWith('/api/contacts/fosse/?')
    ) && !endpoint.includes('/csv-import');
    
    // For contacts list requests, dynamically adjust timeout based on page_size
    let timeoutDuration = 10000; // Default 10 seconds
    if (isImportRequest) {
      timeoutDuration = 600000; // 10 min for imports
    } else if (isEmailSendRequest) {
      timeoutDuration = 60000; // 60 sec for email operations
    } else if (isEventsRequest) {
      timeoutDuration = 300000; // 5 minutes for events (PlanningAdministrateur loads many pages)
    } else if (isContactsListRequest) {
      // Extract page_size from endpoint URL
      const pageSizeMatch = endpoint.match(/[?&]page_size=(\d+)/);
      const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : null;
      
      // Dynamic timeout based on page_size:
      // - 10-100 items: 2 minutes (120000ms)
      // - 200-500 items: 3 minutes (180000ms)
      // - 1000+ items: 5 minutes (300000ms)
      if (pageSize && pageSize >= 1000) {
        timeoutDuration = 300000; // 5 minutes for 1000+ items
      } else if (pageSize && pageSize >= 200) {
        timeoutDuration = 180000; // 3 minutes for 200-999 items
      } else {
        timeoutDuration = 120000; // 2 minutes for smaller page sizes (default)
      }
    }
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
        // Timeout error - file size should have been validated before upload
        const timeoutMessage = isFormData 
          ? 'Délai d\'attente dépassé. Le fichier est peut-être trop volumineux. Veuillez vérifier la taille du fichier et réessayer avec un fichier plus petit.'
          : 'Délai d\'attente dépassé - veuillez vérifier votre connexion';
        const timeoutError = new Error(timeoutMessage);
        (timeoutError as any).status = 408;
        throw timeoutError;
      }
      // Handle network errors (connection refused, etc.)
      // Be more careful - "Failed to fetch" can happen for many reasons
      // Only treat as network error if we're certain it's a connection issue
      if (error.message) {
        const isConnectionRefused = error.message.includes('ERR_CONNECTION_REFUSED') || 
                                    error.message.includes('ERR_NETWORK') ||
                                    error.message.includes('ERR_CONNECTION_RESET');
        
        const isFailedToFetch = error.message.includes('Failed to fetch');
        
        // Only show network error for clear connection issues
        // For "Failed to fetch", it could be CORS, timeout, or server error, so preserve original error
        if (isConnectionRefused) {
          const networkError = new Error('Impossible de se connecter au serveur. Veuillez vous assurer que le backend est en cours d\'exécution.');
          (networkError as any).status = 0;
          (networkError as any).isNetworkError = true;
          throw networkError;
        }
        
        // For "Failed to fetch", provide a more helpful error message that includes the original error
        if (isFailedToFetch) {
          // Check if it's a timeout (AbortError is handled above, but check anyway)
          if (error.name === 'AbortError' || error.message.includes('timeout')) {
            const timeoutError = new Error('Délai d\'attente dépassé. Le serveur met trop de temps à répondre.');
            (timeoutError as any).status = 408;
            throw timeoutError;
          }
          
          // For other "Failed to fetch" errors, preserve the original error but add context
          const enhancedError = new Error(`Erreur de connexion: ${error.message}. Vérifiez que le backend est accessible et que CORS est configuré correctement.`);
          (enhancedError as any).originalError = error;
          (enhancedError as any).status = 0;
          throw enhancedError;
        }
      }
      // Re-throw the original error to preserve more details
      throw error;
    }
    
    // Check for network-level failures (status 0 usually means connection failed)
    // But be more careful - status 0 can also occur with CORS errors or other issues
    if (response.status === 0) {
      // Status 0 typically means the request was blocked (CORS, network error, etc.)
      // For FormData uploads, this might indicate a CORS preflight failure or network issue
      const errorMessage = isFormData 
        ? 'Erreur lors de l\'upload du fichier. Vérifiez que le backend est accessible et que CORS est configuré correctement pour les requêtes multipart/form-data.'
        : 'Impossible de se connecter au serveur. Veuillez vous assurer que le backend est en cours d\'exécution et que CORS est configuré correctement.';
      const networkError = new Error(errorMessage);
      (networkError as any).status = 0;
      (networkError as any).isNetworkError = true;
      throw networkError;
    }
    
    // Check for opaque responses (CORS errors) - these have type 'opaque' and status 0
    // Note: Modern browsers don't use 'opaque' type for CORS errors anymore, but check anyway
    if (response.type === 'opaque') {
      const corsError = new Error('Erreur CORS détectée. Veuillez vérifier la configuration CORS du backend.');
      (corsError as any).status = 0;
      (corsError as any).isNetworkError = true;
      throw corsError;
    }

    // If 401, try to refresh token and retry once
    // BUT: Don't retry if this IS the refresh endpoint (prevents infinite loop)
    if (response.status === 401) {
      // If this is the refresh endpoint itself returning 401, don't try to refresh again
      if (endpoint.includes('/token/refresh/')) {
        localStorage.removeItem(ACCESS_TOKEN);
        localStorage.removeItem(REFRESH_TOKEN);
        const error = await response.json().catch(() => ({ detail: 'Token de rafraîchissement expiré. Veuillez vous reconnecter.' }));
        const errorMessage = error.detail || error.error || error.message || 'Token de rafraîchissement expiré. Veuillez vous reconnecter.';
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
        const error = await response.json().catch(() => ({ detail: 'Authentification requise. Veuillez vous connecter.' }));
        const errorMessage = error.detail || error.error || error.message || 'Authentification requise. Veuillez vous connecter.';
        const errorObj = new Error(errorMessage);
        (errorObj as any).response = error;
        (errorObj as any).status = 401;
        (errorObj as any).isRedirecting = isRedirecting; // Mark that we're redirecting
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
        
        // Add timeout for retry as well - use same logic as initial request
        const retryController = new AbortController();
        // Recalculate timeout duration for retry (same logic as initial request)
        let retryTimeoutDuration = 10000; // Default 10 seconds
        if (isImportRequest) {
          retryTimeoutDuration = 600000; // 10 min for imports
        } else if (isEmailSendRequest) {
          retryTimeoutDuration = 60000; // 60 sec for email operations
        } else if (isContactsListRequest) {
          // Extract page_size from endpoint URL
          const pageSizeMatch = endpoint.match(/[?&]page_size=(\d+)/);
          const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : null;
          
          // Dynamic timeout based on page_size:
          // - 10-100 items: 2 minutes (120000ms)
          // - 200-500 items: 3 minutes (180000ms)
          // - 1000+ items: 5 minutes (300000ms)
          if (pageSize && pageSize >= 1000) {
            retryTimeoutDuration = 300000; // 5 minutes for 1000+ items
          } else if (pageSize && pageSize >= 200) {
            retryTimeoutDuration = 180000; // 3 minutes for 200-999 items
          } else {
            retryTimeoutDuration = 120000; // 2 minutes for smaller page sizes (default)
          }
        }
        const retryTimeoutId = setTimeout(() => retryController.abort(), retryTimeoutDuration);
        
        try {
          response = await fetch(`${apiUrl}${endpoint}`, {
            ...options,
            headers: retryHeaders,
            body: options.body, // Ensure body is preserved
            signal: retryController.signal,
            mode: 'cors', // Explicitly enable CORS
            credentials: 'include', // Include credentials (cookies) if needed
          });
          clearTimeout(retryTimeoutId);
        } catch (retryError: any) {
          clearTimeout(retryTimeoutId);
          if (retryError.name === 'AbortError') {
            const timeoutMessage = isFormData 
              ? 'Délai d\'attente dépassé. Le fichier est peut-être trop volumineux. Veuillez vérifier la taille du fichier et réessayer avec un fichier plus petit.'
              : 'Délai d\'attente dépassé - veuillez vérifier votre connexion';
            const timeoutError = new Error(timeoutMessage);
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
          const error = await response.json().catch(() => ({ detail: 'Authentification échouée. Veuillez vous reconnecter.' }));
          const errorMessage = error.detail || error.error || error.message || 'Authentification échouée. Veuillez vous reconnecter.';
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
      const error = await response.json().catch(() => ({ detail: 'Échec de la requête API' }));
      
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
      
      errorMessage = errorMessage || 'Échec de la requête API';
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
