import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { apiCall } from '../utils/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Bell, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import '../styles/Notifications.css';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  message_id?: string;
  email_id?: string;
  contact_id?: string;
  event_id?: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

export default function Notifications() {
  const { currentUser } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [todayAssignedCount, setTodayAssignedCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
  const [userManuallyClosed, setUserManuallyClosed] = useState(false);
  const lastUnreadCountRef = useRef(0);

  // Auto-open modal when there are NEW unread notifications (only if currently closed and user hasn't manually closed)
  useEffect(() => {
    // Only auto-open if:
    // 1. There are unread notifications
    // 2. Modal is currently closed
    // 3. User hasn't manually closed it
    // 4. Unread count actually increased (new notification) or it's the first load
    const hasNewUnreadNotifications = unreadCount > 0 && unreadCount > lastUnreadCountRef.current;
    const isFirstLoad = lastUnreadCountRef.current === 0 && unreadCount > 0;
    
    if ((hasNewUnreadNotifications || isFirstLoad) && !isOpen && !userManuallyClosed) {
      console.log('[Notifications] Auto-opening modal - unread count:', unreadCount, 'last count:', lastUnreadCountRef.current);
      setIsOpen(true);
      setUserManuallyClosed(false); // Reset flag when auto-opening
      // Switch to unread tab when auto-opening
      setActiveTab('unread');
    }
    
    // Update last unread count ref
    lastUnreadCountRef.current = unreadCount;
  }, [unreadCount, isOpen, userManuallyClosed]);

  // Removed auto-close behavior - users can now control when to close the modal
  // The modal will stay open even when all notifications are read

  // Load notifications
  const loadNotifications = useCallback(async (silent: boolean = false) => {
    try {
      const data = await apiCall('/api/notifications/');
      // Backend now excludes message notifications, but filter again as safety measure
      const filteredNotifications = (data.notifications || []).filter((n: Notification) => n.type !== 'message');
      
      // Debug logging to help diagnose issues
      const unreadInList = filteredNotifications.filter((n: Notification) => !n.is_read).length;
      console.log('[Notifications] Loaded notifications:', {
        total: filteredNotifications.length,
        unread: unreadInList,
        read: filteredNotifications.filter((n: Notification) => n.is_read).length,
        backend_unread_count: data.unread_count,
        backend_unread_in_response: data.unread_in_response,
        notifications_sample: filteredNotifications.slice(0, 5).map(n => ({ id: n.id, type: n.type, is_read: n.is_read }))
      });
      
      setNotifications(filteredNotifications);
      // Use unread_count from API response to avoid extra API call and race conditions
      if (data.unread_count !== undefined) {
        setUnreadCount(data.unread_count);
      }
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await apiCall('/api/notifications/unread-count/');
      setUnreadCount(data.unread_count || 0);
    } catch (error: any) {
      console.error('Error loading unread count:', error);
    }
  }, []);

  // Load today's assigned contacts count
  const loadTodayAssignedCount = useCallback(async () => {
    try {
      const data = await apiCall('/api/contacts/assigned-today-count/');
      setTodayAssignedCount(data.count || 0);
    } catch (error: any) {
      console.error('Error loading today\'s assigned contacts count:', error);
      setTodayAssignedCount(0);
    }
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      // Optimistic update for immediate UI feedback
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      const newUnreadCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newUnreadCount);
      
      // Call API - backend will send websocket update to confirm
      await apiCall(`/api/notifications/${notificationId}/read/`, {
        method: 'POST',
      });
      
      // Switch to read tab if no more unread notifications
      // Note: websocket update will also handle this, but this provides immediate feedback
      if (newUnreadCount === 0) {
        if (activeTab === 'unread') {
          setActiveTab('read');
        }
        // Close modal when all notifications are read
        setIsOpen(false);
        // Don't set userManuallyClosed here - this is automatic behavior
      }
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      // Revert optimistic update on error
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: false } : n))
      );
      setUnreadCount(prev => prev + 1);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await apiCall('/api/notifications/mark-all-read/', {
        method: 'POST',
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      // Switch to read tab after marking all as read
      setActiveTab('read');
      // Close modal when all notifications are read
      setIsOpen(false);
      // Don't set userManuallyClosed here - this is automatic behavior after user action
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'message' && notification.data?.chat_room_id) {
      // Navigate to chat room
      window.location.href = `/chat?room=${notification.data.chat_room_id}`;
    } else if (notification.type === 'email' && notification.email_id) {
      // Navigate to email
      window.location.href = `/mails?email=${notification.email_id}`;
    } else if (notification.type === 'contact' && notification.contact_id) {
      // Check if this is a transaction update notification
      if (notification.data?.notification_type === 'transaction_updated') {
        // Navigate to transactions page in a new tab
        window.open('/transactions', '_blank');
      } else {
        // Navigate to contact detail page (same format as ContactSearchBar)
        // This handles all contact notifications including "Nouveau client"
        window.open(`/contacts/${notification.contact_id}`, '_blank', 'width=1200,height=900,resizable=yes,scrollbars=yes');
      }
    } else if (notification.type === 'event' && notification.event_id) {
      // Navigate to planning calendar in a new tab
      window.open('/planning', '_blank');
    }
    
    // Don't close modal if there are still unread notifications
    if (unreadCount <= 1) {
      // This was the last unread notification, modal will auto-close
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Get notification icon
  const getNotificationIcon = (type: string, data?: any) => {
    // Check if this is a transaction update notification
    if (type === 'contact' && data?.notification_type === 'transaction_updated') {
      return '⚠️';
    }
    
    switch (type) {
      case 'message':
        return '💬';
      case 'email':
        return '📧';
      case 'contact':
        return '✅';
      case 'event':
        return '📅';
      default:
        return '🔔';
    }
  };

  // WebSocket connection for real-time notifications
  const ws = useWebSocket({
    url: '/ws/notifications/',
    onMessage: (message) => {
      if (message.type === 'notification') {
        // Filter out message notifications - they are handled separately via chat popup
        if (message.notification.type === 'message') {
          return; // Ignore message notifications
        }
        
        // Add new notification to the list
        setNotifications(prev => {
          // Check if notification already exists to avoid duplicates
          const exists = prev.some(n => n.id === message.notification.id);
          if (exists) {
            return prev;
          }
          return [message.notification, ...prev];
        });
        // Use unread_count from backend - always reload from API for accuracy
        if (message.unread_count !== undefined) {
          setUnreadCount(message.unread_count);
        } else {
          // If unread_count not provided, reload from API to ensure accuracy
          loadUnreadCount();
        }
        
        // Reset userManuallyClosed flag when new notification arrives
        // This allows the modal to auto-open for new notifications
        setUserManuallyClosed(false);
        
        // Show toast notification
        toast.info(message.notification.title, {
          description: message.notification.message,
        });
      } else if (message.type === 'event_notification') {
        // Handle event notifications (reminders, assignments)
        const eventNotification = message.notification;
        if (eventNotification) {
          console.log('[Notifications] Received event_notification:', eventNotification);
          console.log('[Notifications] Notification type:', eventNotification.notification_type);
          
          // Event notifications are stored in the database, so reload to get the proper notification
          // This ensures we have the correct ID and all fields from the database
          // unread_count is included in the response, so no separate call needed
          // No toast notification - users will see it in the notification modal
          // Reset userManuallyClosed flag when new event notification arrives
          setUserManuallyClosed(false);
          loadNotifications(true);
        } else {
          console.warn('[Notifications] event_notification received but notification is missing');
        }
      } else if (message.type === 'notification_updated') {
        // Handle notification update (e.g., when marked as read)
        const updatedNotification = message.notification;
        if (updatedNotification) {
          setNotifications(prev =>
            prev.map(n => (n.id === updatedNotification.id ? { ...n, is_read: updatedNotification.is_read } : n))
          );
          // Update unread count if provided
          if (message.unread_count !== undefined) {
            setUnreadCount(message.unread_count);
            // Switch to read tab if no more unread notifications
            if (message.unread_count === 0) {
              if (activeTab === 'unread') {
                setActiveTab('read');
              }
              // Close modal when all notifications are read
              setIsOpen(false);
              // Don't set userManuallyClosed here - this is automatic behavior
            }
          }
        }
      } else if (message.type === 'unread_count_updated') {
        const newUnreadCount = message.unread_count || 0;
        setUnreadCount(newUnreadCount);
        // Switch to read tab if no more unread notifications
        if (newUnreadCount === 0) {
          if (activeTab === 'unread') {
            setActiveTab('read');
          }
          // Close modal when all notifications are read
          setIsOpen(false);
          // Don't set userManuallyClosed here - this is automatic behavior
        }
      } else if (message.type === 'connection_established') {
        // Use unread_count from backend if provided (fastest), otherwise loadNotifications will set it
        if (message.unread_count !== undefined) {
          setUnreadCount(message.unread_count);
        }
        // Reload notifications when connection is established
        // unread_count is included in the response, so no separate call needed if not provided above
        loadNotifications();
      }
    },
    onError: (error) => {
      console.error('Notifications WebSocket error:', error);
    },
    onOpen: () => {
      // Reload notifications when WebSocket connects
      loadNotifications();
    },
    reconnect: true,
  });

  // Initial load
  useEffect(() => {
    loadNotifications();
    loadTodayAssignedCount();
  }, [loadNotifications, loadTodayAssignedCount]);

  // Auto-refresh notifications periodically (like WhatsApp)
  useEffect(() => {
    // Don't start auto-refresh until initial load is complete
    if (loading) return;

    const interval = setInterval(() => {
      // Refresh notifications silently (don't show loading state)
      // unread_count is included in the response, so no separate call needed
      loadNotifications(true);
      // Refresh today's assigned contacts count
      loadTodayAssignedCount();
    }, 10000); // Refresh every 10 seconds (less frequent than chat since notifications are less time-sensitive)

    return () => clearInterval(interval);
  }, [loading, loadNotifications, loadTodayAssignedCount]);

  // Reload notifications and unread count when modal opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
      loadNotifications(true); // Silent load to avoid showing loading state
      // unread_count is included in the response, so no separate call needed
    }
  }, [isOpen, loadNotifications]);

  // Set default tab when modal opens
  useEffect(() => {
    if (isOpen && !loading) {
      // Default to unread tab if there are unread notifications, otherwise read tab
      setActiveTab(unreadCount > 0 ? 'unread' : 'read');
    }
  }, [isOpen, loading, unreadCount]);

  // Mark as read via WebSocket when notification is clicked
  // Only use WebSocket if it's connected and not disabled
  useEffect(() => {
    if (ws.isConnected && !ws.isDisabled) {
      // Send mark read via WebSocket when needed
      // This is handled in handleNotificationClick
    }
  }, [ws.isConnected, ws.isDisabled]);

  return (
    <div className="notifications-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {todayAssignedCount > 0 && (
          <Badge style={{ 
            fontSize: '14px', 
            backgroundColor: '#22c55e',
            color: '#ffffff',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            padding: '4px 12px',
            borderRadius: '12px'
          }}>
            {todayAssignedCount} lead{todayAssignedCount > 1 ? 's' : ''} aujourd'hui
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            // Always allow toggling - users can open/close whenever they want
            const newIsOpen = !isOpen;
            setIsOpen(newIsOpen);
            // Track if user manually closed the modal
            if (!newIsOpen) {
              setUserManuallyClosed(true);
            } else {
              setUserManuallyClosed(false);
            }
          }}
          className="notifications-button"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="notifications-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Notifications</h3>
            <div className="notifications-header-actions">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false);
                  setUserManuallyClosed(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'unread' | 'read')} className="notifications-tabs">
            <TabsList className="notifications-tabs-list">
              <TabsTrigger value="unread">
                Non lu
                {unreadCount > 0 && (
                  <Badge className="notifications-tab-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="read">Lu</TabsTrigger>
            </TabsList>

            <TabsContent value="unread" className="notifications-tab-content">
              <ScrollArea className="notifications-list">
                {loading ? (
                  <div className="notifications-loading">Chargement...</div>
                ) : notifications.filter(n => !n.is_read).length === 0 ? (
                  <div className="notifications-empty">Aucune notification non lue</div>
                ) : (
                  notifications
                    .filter(n => !n.is_read)
                    .map((notification) => (
                      <div
                        key={notification.id}
                        className="notification-item unread"
                      >
                        <div 
                          className="notification-main-content"
                          onClick={() => handleNotificationClick(notification)}
                          style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}
                        >
                          <div className="notification-icon">
                            {getNotificationIcon(notification.type, notification.data)}
                          </div>
                          <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                            <div className="notification-time">
                              {formatTime(notification.created_at)}
                            </div>
                          </div>
                          <div className="notification-unread-indicator" />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="notification-mark-read-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          title="Marquer comme lu"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="read" className="notifications-tab-content">
              <ScrollArea className="notifications-list">
                {loading ? (
                  <div className="notifications-loading">Chargement...</div>
                ) : notifications.filter(n => n.is_read).length === 0 ? (
                  <div className="notifications-empty">Aucune notification lue</div>
                ) : (
                  notifications
                    .filter(n => n.is_read)
                    .map((notification) => (
                      <div
                        key={notification.id}
                        className="notification-item"
                      >
                        <div 
                          className="notification-main-content"
                          onClick={() => handleNotificationClick(notification)}
                          style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}
                        >
                          <div className="notification-icon">
                            {getNotificationIcon(notification.type, notification.data)}
                          </div>
                          <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                            <div className="notification-time">
                              {formatTime(notification.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

