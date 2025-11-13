import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiCall } from '../utils/api';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../utils/constants';

interface UserContextType {
  currentUser: any;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

// Provide a default value to avoid undefined context
const defaultContextValue: UserContextType = {
  currentUser: null,
  loading: true,
  refreshUser: async () => {},
};

const UserContext = createContext<UserContextType>(defaultContextValue);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const getCurrentUser = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    
    // Only make API call if we have a token
    if (!token) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await apiCall("/api/user/current/");
      setCurrentUser(response);
    } catch (error: any) {
      console.error("Erreur lors de la récupération de l'utilisateur", error);
      
      // If token is invalid (401), try to refresh it
      if (error?.status === 401 || error?.message?.includes('token')) {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN);
        if (refreshToken) {
          try {
            // @ts-ignore - Vite environment variables
            const apiUrl = import.meta.env.VITE_URL || 'http://127.0.0.1:8000';
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
                // Retry the request with new token
                try {
                  const response = await apiCall("/api/user/current/");
                  setCurrentUser(response);
                  setLoading(false);
                  return;
                } catch (retryError) {
                  console.error("Erreur après refresh du token", retryError);
                }
              }
            }
          } catch (refreshError) {
            console.error("Erreur lors du refresh du token", refreshError);
          }
        }
        
        // If refresh failed or no refresh token, clear tokens
        localStorage.removeItem(ACCESS_TOKEN);
        localStorage.removeItem(REFRESH_TOKEN);
      }
      
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCurrentUser();
  }, []);

  const refreshUser = async () => {
    await getCurrentUser();
  };

  return (
    <UserContext.Provider value={{ currentUser, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};

export function useUser() {
  const context = useContext(UserContext);
  // Context now always has a value, no need to check for undefined
  return context;
}

