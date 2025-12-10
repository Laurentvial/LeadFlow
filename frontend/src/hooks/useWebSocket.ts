import { useEffect, useRef, useState, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { ACCESS_TOKEN } from '../utils/constants';

// Get backend URL (same logic as api.ts)
const getEnvVar = (key: string): string | undefined => {
  // @ts-ignore - Vite environment variables
  return import.meta.env[key];
};

const apiUrl = getEnvVar('VITE_URL') || 'http://127.0.0.1:8000';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onError,
  onOpen,
  onClose,
  reconnect = true,
  reconnectInterval = 3000,
}: UseWebSocketOptions) {
  const { token } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);
  const consecutiveFailuresRef = useRef(0);
  const maxConsecutiveFailures = 3; // Stop trying after 3 consecutive failures

  const connect = useCallback(() => {
    if (!token || !url) {
      return;
    }

    // Don't connect if already connected or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      // Use token from context or localStorage as fallback
      const accessToken = token || localStorage.getItem(ACCESS_TOKEN);
      if (!accessToken) {
        console.warn('[useWebSocket] No token available for WebSocket connection');
        return;
      }

      // Add token to URL
      const wsUrl = `${url}?token=${encodeURIComponent(accessToken)}`;
      
      // Use backend URL instead of current host (for WebSocket, use ws:// or wss://)
      const backendUrl = new URL(apiUrl);
      const protocol = backendUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = backendUrl.host;
      const fullUrl = `${protocol}//${host}${wsUrl}`;

      // Log WebSocket connection details for debugging
      const maskedUrl = fullUrl.replace(/token=[^&]+/, 'token=***');
      console.log('[useWebSocket] Connecting to:', maskedUrl);
      console.log('[useWebSocket] Backend URL from VITE_URL:', apiUrl);
      console.log('[useWebSocket] Protocol:', protocol);
      console.log('[useWebSocket] Host:', host);

      const ws = new WebSocket(fullUrl);

      ws.onopen = () => {
        console.log('[useWebSocket] ✅ WebSocket connected successfully');
        setIsConnected(true);
        setReconnectAttempts(0);
        consecutiveFailuresRef.current = 0; // Reset failure count on successful connection
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[useWebSocket] ❌ WebSocket error:', error);
        console.error('[useWebSocket] Failed URL:', maskedUrl);
        console.error('[useWebSocket] Check:');
        console.error('  1. Is VITE_URL set correctly? Current:', apiUrl);
        console.error('  2. Is the backend running and accessible?');
        console.error('  3. Are WebSocket routes configured correctly?');
        console.error('  4. Check browser console for CORS or network errors');
        // Increment failure count on error
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= maxConsecutiveFailures) {
          console.warn(`[useWebSocket] WebSocket server appears to be unavailable. Stopping reconnection attempts after ${maxConsecutiveFailures} failures.`);
          shouldReconnectRef.current = false;
        }
        onError?.(error);
      };

      ws.onclose = (event) => {
        console.log(`[useWebSocket] 🔌 WebSocket closed: code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}`);
        setIsConnected(false);
        onClose?.();

        // Check if this was a server error (404, 500, etc.) or connection refused
        // WebSocket close codes: 1006 = abnormal closure, 1002 = protocol error, etc.
        const isServerError = event.code === 1006 || event.code === 1002 || 
                             (event.code >= 1002 && event.code <= 1015) ||
                             !event.wasClean;
        
        if (isServerError) {
          console.error('[useWebSocket] Server error detected. Common causes:');
          console.error('  - Backend not running or not accessible');
          console.error('  - WebSocket route not configured (check /ws/notifications/ or /ws/chat/)');
          console.error('  - CORS/origin validation failed');
          console.error('  - SSL certificate issues (for wss://)');
        }
        
        if (isServerError) {
          consecutiveFailuresRef.current += 1;
          
          // Stop trying if we've failed too many times
          if (consecutiveFailuresRef.current >= maxConsecutiveFailures) {
            console.warn(`[useWebSocket] WebSocket server appears to be unavailable. Stopping reconnection attempts after ${maxConsecutiveFailures} failures.`);
            shouldReconnectRef.current = false;
            return;
          }
        } else {
          // Reset failure count for clean closures
          consecutiveFailuresRef.current = 0;
        }

        // Only attempt to reconnect if the connection was not intentionally closed
        // and if we still have token and URL, and we haven't exceeded max failures
        if (shouldReconnectRef.current && reconnect && token && url && 
            consecutiveFailuresRef.current < maxConsecutiveFailures) {
          // Don't reconnect if it was a normal closure (code 1000) or if we're cleaning up
          if (event.code !== 1000) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (shouldReconnectRef.current && token && url && 
                  consecutiveFailuresRef.current < maxConsecutiveFailures) {
                setReconnectAttempts((prev) => prev + 1);
                connect();
              }
            }, reconnectInterval);
          }
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[useWebSocket] Error creating WebSocket:', error);
    }
  }, [url, token, onMessage, onError, onOpen, onClose, reconnect, reconnectInterval]);

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      // Only close if not already closed
      if (wsRef.current.readyState !== WebSocket.CLOSED && wsRef.current.readyState !== WebSocket.CLOSING) {
        wsRef.current.close(1000, 'Intentional disconnect');
      }
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    // Only connect if we have both token and URL, and we're not already connected
    if (token && url && wsRef.current?.readyState !== WebSocket.OPEN) {
      connect();
    } else if (!token || !url) {
      // Disconnect if URL is empty or token is not available
      disconnect();
    }

    return () => {
      // Only disconnect on unmount or when dependencies change significantly
      // Don't disconnect if we're just re-rendering with the same token/url
      if (wsRef.current) {
        shouldReconnectRef.current = false;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [token, url]); // Removed connect and disconnect from dependencies to prevent infinite loop

  return {
    isConnected,
    send,
    disconnect,
    reconnectAttempts,
    isDisabled: consecutiveFailuresRef.current >= maxConsecutiveFailures,
  };
}

