import { apiCall } from './api';
import { ACCESS_TOKEN, REFRESH_TOKEN } from './constants';

// Get API base URL from environment or use default
const getEnvVar = (key: string): string | undefined => {
  // @ts-ignore - Vite environment variables
  return import.meta.env[key];
};

const apiUrl = getEnvVar('VITE_URL') || 'http://127.0.0.1:8000';

export async function signIn(username: string, password: string) {
  try {
    const response = await fetch(`${apiUrl}/api/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username, // Django REST Framework JWT uses 'username' field
        password: password,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Invalid credentials' }));
      throw new Error(error.detail || 'Invalid credentials');
    }

    const data = await response.json();
    
    if (data.access) {
      localStorage.setItem(ACCESS_TOKEN, data.access);
    }
    
    if (data.refresh) {
      localStorage.setItem(REFRESH_TOKEN, data.refresh);
    }
    
    return data;
  } catch (error: any) {
    throw error;
  }
}

export async function signOut() {
  localStorage.removeItem(ACCESS_TOKEN);
  localStorage.removeItem(REFRESH_TOKEN);
}

export async function getSession() {
  const token = localStorage.getItem(ACCESS_TOKEN);
  
  if (!token) {
    return null;
  }

  try {
    // Verify token by getting current user
    const response = await apiCall('/api/user/current/');
    return {
      access_token: token,
      user: response,
    };
  } catch (error) {
    // Token is invalid, try to refresh
    const refreshToken = localStorage.getItem(REFRESH_TOKEN);
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${apiUrl}/api/token/refresh/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh: refreshToken,
          }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.access) {
            localStorage.setItem(ACCESS_TOKEN, refreshData.access);
            return {
              access_token: refreshData.access,
            };
          }
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens
        signOut();
        return null;
      }
    }
    
    signOut();
    return null;
  }
}

export async function sendOTP(email: string, password: string) {
  try {
    const response = await fetch(`${apiUrl}/api/otp/send/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to send OTP' }));
      throw new Error(error.error || error.detail || 'Failed to send OTP');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    throw error;
  }
}

export async function verifyOTP(email: string, otp: string) {
  try {
    const response = await fetch(`${apiUrl}/api/otp/verify/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        otp: otp,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Invalid OTP' }));
      throw new Error(error.error || error.detail || 'Invalid OTP');
    }

    const data = await response.json();
    
    if (data.access) {
      localStorage.setItem(ACCESS_TOKEN, data.access);
    }
    
    if (data.refresh) {
      localStorage.setItem(REFRESH_TOKEN, data.refresh);
    }
    
    return data;
  } catch (error: any) {
    throw error;
  }
}
