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

  const connect = useCallback(() => {
    if (!token || !url) {
      return;
    }

    // Don't connect if already connected or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log('[useWebSocket] Already connected or connecting, skipping');
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

      console.log('[useWebSocket] Connecting to:', fullUrl);
      const ws = new WebSocket(fullUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setReconnectAttempts(0);
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
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        console.log('[useWebSocket] Connection closed. Code:', event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
        onClose?.();

        // Only attempt to reconnect if the connection was not intentionally closed
        // and if we still have token and URL
        if (shouldReconnectRef.current && reconnect && token && url) {
          // Don't reconnect if it was a normal closure (code 1000) or if we're cleaning up
          if (event.code !== 1000) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (shouldReconnectRef.current && token && url) {
                console.log('[useWebSocket] Attempting to reconnect...');
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
    console.log('[useWebSocket] Effect triggered - url:', url, 'hasToken:', !!token, 'isConnected:', wsRef.current?.readyState === WebSocket.OPEN);
    
    // Only connect if we have both token and URL, and we're not already connected
    if (token && url && wsRef.current?.readyState !== WebSocket.OPEN) {
      console.log('[useWebSocket] Conditions met, calling connect()');
      connect();
    } else if (!token || !url) {
      // Disconnect if URL is empty or token is not available
      console.log('[useWebSocket] Conditions not met, disconnecting. Token:', !!token, 'URL:', url);
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
  };
}

