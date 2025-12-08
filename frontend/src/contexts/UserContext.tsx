import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiCall } from '../utils/api';
import { ACCESS_TOKEN, REFRESH_TOKEN } from '../utils/constants';

interface UserContextType {
  currentUser: any;
  loading: boolean;
  refreshUser: () => Promise<void>;
  token?: string;
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
      // apiCall already handles token refresh automatically on 401 errors
      const response = await apiCall("/api/user/current/");
      setCurrentUser(response);
    } catch (error: any) {
      // If it's a 401, apiCall already tried to refresh the token
      // If refresh failed, apiCall already redirected to login and cleared tokens
      // Just set user to null here - don't try to refresh again (apiCall already did that)
      if (error?.status === 401) {
        // Token is invalid and refresh failed (or no refresh token)
        // apiCall already handled redirect to login, just clear local state
        // Don't log error if we're redirecting to login (to avoid console noise)
        if (!error?.isRedirecting) {
          console.error("Erreur lors de la récupération de l'utilisateur", error);
        }
        setCurrentUser(null);
      } else {
        // For other errors, log them but still set user to null
        console.error("Erreur lors de la récupération de l'utilisateur", error);
        setCurrentUser(null);
      }
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

  // Get token from localStorage
  const token = localStorage.getItem(ACCESS_TOKEN) || undefined;

  return (
    <UserContext.Provider value={{ currentUser, loading, refreshUser, token }}>
      {children}
    </UserContext.Provider>
  );
};

export function useUser() {
  const context = useContext(UserContext);
  // Context now always has a value, no need to check for undefined
  return context;
}

