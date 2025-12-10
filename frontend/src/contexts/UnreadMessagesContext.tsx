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

interface EventNotification {
  type: string;
  event: {
    id: string;
    datetime: string;
    contactId?: string | null;
    contactName?: string | null;
    comment?: string;
  };
  notification_type: 'assigned' | '30min_before' | '10min_before' | '5min_before';
  title: string;
  message: string;
  minutes_before?: number;
}

interface UnreadMessagesContextType {
  totalUnreadCount: number;
  messagePopup: MessageNotification | null;
  eventPopup: EventNotification | null;
  closePopup: () => void;
  closeEventPopup: () => void;
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
  const [eventPopup, setEventPopup] = useState<EventNotification | null>(null);
  
  // Use refs to track current values for use in setTimeout callbacks
  const activeChatRoomIdRef = React.useRef(activeChatRoomId);
  const locationRef = React.useRef(location);
  
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
      // Handle both old format (array) and new format (object with chatRooms array)
      const responseData = Array.isArray(data) ? { chatRooms: data } : data;
      const rooms = responseData?.chatRooms || [];
      const total = Array.isArray(rooms) ? rooms.reduce((sum: number, room: any) => sum + (room.unreadCount || 0), 0) : 0;
      setTotalUnreadCount(total);
    } catch (error: any) {
      console.error('Error loading unread messages count:', error);
    }
  }, []);

  // WebSocket connection for new messages (only if user is loaded)
  const ws = useWebSocket({
    url: shouldInitialize ? '/ws/notifications/' : '',
    onMessage: (message) => {
      console.log('[UnreadMessagesContext] WebSocket message received:', message.type, message);
      // Listen for new message notifications (sent via chat_message group)
      if (message.type === 'new_message') {
        const msg = message.message;
        
        if (!msg || !msg.id || !msg.chatRoomId) {
          console.error('[UnreadMessagesContext] Invalid message format:', msg);
          return;
        }
        
        // Reload unread count to update chat room list
        // This ensures new chat rooms appear for the recipient
        loadUnreadCount();
        
        // Check if user is currently viewing this chat room
        const isViewingThisChat = isOnChatPage && activeChatRoomId === msg.chatRoomId;
        
        if (isViewingThisChat) {
          // User is viewing the chat, mark as read and don't show popup
          // The message will appear in the chat automatically via chat WebSocket
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
            setMessagePopup({
              id: msg.id,
              chatRoomId: msg.chatRoomId,
              senderId: msg.senderId,
              senderName: msg.senderName || 'Utilisateur',
              content: msg.content || '',
              createdAt: msg.createdAt || new Date().toISOString(),
            });
            
            // Auto-hide popup after 5 seconds
            setTimeout(() => {
              setMessagePopup(null);
            }, 5000);
          }
        }, 500); // 500ms delay to let message appear in chat first if user is switching rooms
      } else if (message.type === 'notification' && message.notification?.type === 'message') {
        // Also reload when message notifications are received (for compatibility)
        loadUnreadCount();
      } else if (message.type === 'event_notification') {
        // Handle event notifications
        console.log('[UnreadMessagesContext] Received event_notification:', message);
        console.log('[UnreadMessagesContext] Full message structure:', JSON.stringify(message, null, 2));
        const eventNotification = message.notification;
        if (eventNotification) {
          console.log('[UnreadMessagesContext] Event notification data:', eventNotification);
          console.log('[UnreadMessagesContext] Notification type:', eventNotification.notification_type);
          
          // Skip popup for assignment notifications - only show reminders (30min_before, 10min_before, 5min_before)
          if (eventNotification.notification_type === 'assigned') {
            console.log('[UnreadMessagesContext] Skipping popup for assignment notification (only showing reminders)');
            return;
          }
          
          // Check if it's a reminder notification
          if (eventNotification.notification_type === '30min_before' || 
              eventNotification.notification_type === '10min_before' || 
              eventNotification.notification_type === '5min_before') {
            console.log('[UnreadMessagesContext] Setting event popup for reminder:', eventNotification);
            setEventPopup(eventNotification);
            
            // Auto-hide popup after 8 seconds
            setTimeout(() => {
              setEventPopup(null);
            }, 8000);
          } else {
            console.warn('[UnreadMessagesContext] Unknown notification type:', eventNotification.notification_type);
          }
        } else {
          console.error('[UnreadMessagesContext] Event notification received but notification data is missing:', message);
        }
      }
    },
    onOpen: () => {
      // WebSocket connected successfully
      console.log('[UnreadMessagesContext] WebSocket connected successfully');
    },
    onError: (error) => {
      console.error('[UnreadMessagesContext] WebSocket error:', error);
    },
    reconnect: true,
  });
  
  // Log WebSocket connection status
  React.useEffect(() => {
    console.log('[UnreadMessagesContext] WebSocket status - Connected:', ws.isConnected, 'Disabled:', ws.isDisabled);
  }, [ws.isConnected, ws.isDisabled]);

  // Also listen to chat rooms updates via notifications WebSocket
  // Only use WebSocket if it's connected and not disabled
  useEffect(() => {
    if (ws.isConnected && !ws.isDisabled && shouldInitialize) {
      loadUnreadCount();
    }
  }, [ws.isConnected, ws.isDisabled, shouldInitialize, loadUnreadCount]);

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

  const closeEventPopup = useCallback(() => {
    setEventPopup(null);
  }, []);

  return (
    <UnreadMessagesContext.Provider
      value={{
        totalUnreadCount,
        messagePopup,
        eventPopup,
        closePopup,
        closeEventPopup,
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

