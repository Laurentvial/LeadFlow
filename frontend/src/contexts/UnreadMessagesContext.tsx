import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { apiCall } from '../utils/api';
import { useUser } from './UserContext';

interface MessageNotification {
  id: string;
  chatRoomId: string;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string;
}

interface UnreadMessagesContextType {
  totalUnreadCount: number;
  messagePopup: MessageNotification | null;
  closePopup: () => void;
  refreshUnreadCount: () => Promise<void>;
}

export const UnreadMessagesContext = createContext<UnreadMessagesContextType | undefined>(undefined);

// Context to track active chat room
const ActiveChatRoomContext = createContext<{ roomId: string | null; setRoomId: (id: string | null) => void } | null>(null);

export function ActiveChatRoomProvider({ children }: { children: React.ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  
  return (
    <ActiveChatRoomContext.Provider value={{ roomId, setRoomId }}>
      {children}
    </ActiveChatRoomContext.Provider>
  );
}

export function useActiveChatRoom() {
  const context = useContext(ActiveChatRoomContext);
  return context?.roomId || null;
}

export function useSetActiveChatRoom() {
  const context = useContext(ActiveChatRoomContext);
  if (!context) {
    throw new Error('useSetActiveChatRoom must be used within ActiveChatRoomProvider');
  }
  return context.setRoomId;
}

export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useUser();
  const location = useLocation();
  const activeChatRoomId = useActiveChatRoom();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [messagePopup, setMessagePopup] = useState<MessageNotification | null>(null);
  
  // Use refs to track current values for use in setTimeout callbacks
  const activeChatRoomIdRef = React.useRef(activeChatRoomId);
  const locationRef = React.useRef(location);

  console.log('[UnreadMessagesProvider] Initialized, currentUser:', currentUser?.id);
  
  // Update refs when values change
  React.useEffect(() => {
    activeChatRoomIdRef.current = activeChatRoomId;
  }, [activeChatRoomId]);
  
  React.useEffect(() => {
    locationRef.current = location;
  }, [location]);
  
  // Check if user is on chat page
  const isOnChatPage = location.pathname === '/chat';
  
  // Don't initialize WebSocket if user is not loaded yet
  const shouldInitialize = !!currentUser;

  // Load total unread messages count
  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await apiCall('/api/chat/rooms/');
      const rooms = data || [];
      const total = rooms.reduce((sum: number, room: any) => sum + (room.unreadCount || 0), 0);
      setTotalUnreadCount(total);
    } catch (error: any) {
      console.error('Error loading unread messages count:', error);
    }
  }, []);

  // WebSocket connection for new messages (only if user is loaded)
  const ws = useWebSocket({
    url: shouldInitialize ? '/ws/notifications/' : '',
    onMessage: (message) => {
      console.log('[UnreadMessagesContext] Received WebSocket message:', JSON.stringify(message, null, 2));
      // Listen for new message notifications (sent via chat_message group)
      if (message.type === 'new_message') {
        console.log('[UnreadMessagesContext] New message detected');
        const msg = message.message;
        console.log('[UnreadMessagesContext] Message data:', msg);
        
        if (!msg || !msg.id || !msg.chatRoomId) {
          console.error('[UnreadMessagesContext] Invalid message format:', msg);
          return;
        }
        
        // Check if user is currently viewing this chat room
        const isViewingThisChat = isOnChatPage && activeChatRoomId === msg.chatRoomId;
        
        if (isViewingThisChat) {
          console.log('[UnreadMessagesContext] User is viewing this chat room, not showing popup');
          // User is viewing the chat, mark as read and don't show popup
          // The message will appear in the chat automatically via chat WebSocket
          loadUnreadCount();
          return;
        }
        
        // User is not viewing the chat, but add a small delay to ensure
        // the message doesn't appear in chat first (in case user switches rooms quickly)
        // This prevents popup from showing before message appears in chat
        setTimeout(() => {
          // Double-check that user is still not viewing this chat room
          // (user might have switched to this room in the meantime)
          // Use refs to get current values
          const currentIsOnChatPage = locationRef.current.pathname === '/chat';
          const currentActiveChatRoomId = activeChatRoomIdRef.current;
          const stillNotViewing = !currentIsOnChatPage || currentActiveChatRoomId !== msg.chatRoomId;
          
          if (stillNotViewing) {
            console.log('[UnreadMessagesContext] User is not viewing this chat, showing popup');
            setMessagePopup({
              id: msg.id,
              chatRoomId: msg.chatRoomId,
              senderId: msg.senderId,
              senderName: msg.senderName || 'Utilisateur',
              content: msg.content || '',
              createdAt: msg.createdAt || new Date().toISOString(),
            });
            console.log('[UnreadMessagesContext] Popup state set, messagePopup should be visible now');
            
            // Reload unread count
            loadUnreadCount();
            
            // Auto-hide popup after 5 seconds
            setTimeout(() => {
              console.log('[UnreadMessagesContext] Auto-hiding popup');
              setMessagePopup(null);
            }, 5000);
          } else {
            console.log('[UnreadMessagesContext] User switched to this chat room, not showing popup');
          }
        }, 500); // 500ms delay to let message appear in chat first if user is switching rooms
      } else if (message.type === 'notification' && message.notification?.type === 'message') {
        // Also reload when message notifications are received (for compatibility)
        loadUnreadCount();
      }
    },
    onOpen: () => {
      console.log('[UnreadMessagesContext] WebSocket connected successfully');
    },
    onError: (error) => {
      console.error('[UnreadMessagesContext] WebSocket error:', error);
    },
    reconnect: true,
  });
  
  // Log when messagePopup changes
  useEffect(() => {
    console.log('[UnreadMessagesContext] messagePopup state changed:', messagePopup);
  }, [messagePopup]);

  // Also listen to chat rooms updates via notifications WebSocket
  useEffect(() => {
    console.log('[UnreadMessagesContext] WebSocket connection status:', ws.isConnected, 'shouldInitialize:', shouldInitialize);
    if (ws.isConnected && shouldInitialize) {
      loadUnreadCount();
    }
  }, [ws.isConnected, shouldInitialize, loadUnreadCount]);
  
  // Update when active chat room changes
  useEffect(() => {
    console.log('[UnreadMessagesContext] Active chat room changed:', activeChatRoomId, 'isOnChatPage:', isOnChatPage);
  }, [activeChatRoomId, isOnChatPage]);
  
  // Force reconnection when shouldInitialize changes from false to true
  useEffect(() => {
    if (shouldInitialize && !ws.isConnected) {
      console.log('[UnreadMessagesContext] User loaded, WebSocket should connect now');
    }
  }, [shouldInitialize, ws.isConnected]);

  // Initial load
  useEffect(() => {
    if (shouldInitialize) {
      loadUnreadCount();
      
      // Auto-refresh unread count periodically
      const interval = setInterval(() => {
        loadUnreadCount();
      }, 5000); // Every 5 seconds

      return () => clearInterval(interval);
    }
  }, [shouldInitialize, loadUnreadCount]);

  const closePopup = useCallback(() => {
    setMessagePopup(null);
  }, []);

  return (
    <UnreadMessagesContext.Provider
      value={{
        totalUnreadCount,
        messagePopup,
        closePopup,
        refreshUnreadCount: loadUnreadCount,
      }}
    >
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext);
  if (context === undefined) {
    throw new Error('useUnreadMessages must be used within UnreadMessagesProvider');
  }
  return context;
}

