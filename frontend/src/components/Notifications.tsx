import React, { useState, useEffect, useCallback } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');

  // Auto-open modal when there are unread notifications (only if currently closed)
  useEffect(() => {
    if (unreadCount > 0 && !isOpen) {
      console.log('[Notifications] Auto-opening modal - unread count:', unreadCount);
      setIsOpen(true);
      // Switch to unread tab when auto-opening
      setActiveTab('unread');
    }
  }, [unreadCount, isOpen]);

  // Removed auto-close behavior - users can now control when to close the modal
  // The modal will stay open even when all notifications are read

  // Load notifications
  const loadNotifications = useCallback(async (silent: boolean = false) => {
    try {
      const data = await apiCall('/api/notifications/');
      // Filter out message notifications - they are handled separately via chat popup
      const filteredNotifications = (data.notifications || []).filter((n: Notification) => n.type !== 'message');
      setNotifications(filteredNotifications);
      setUnreadCount(filteredNotifications.filter((n: Notification) => !n.is_read).length || 0);
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
      if (newUnreadCount === 0 && activeTab === 'unread') {
        setActiveTab('read');
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
      // Navigate to contact
      window.location.href = `/contacts?contact=${notification.contact_id}`;
    } else if (notification.type === 'event' && notification.event_id) {
      // Navigate to planning calendar
      window.location.href = '/planning';
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
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return '💬';
      case 'email':
        return '📧';
      case 'contact':
        return '👤';
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
        // Use unread_count from backend instead of incrementing manually
        if (message.unread_count !== undefined) {
          setUnreadCount(message.unread_count);
        } else {
          setUnreadCount(prev => prev + 1);
        }
        
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
          console.log('[Notifications] Full notification object:', JSON.stringify(eventNotification, null, 2));
          
          // Event notifications are stored in the database, so reload to get the proper notification
          // This ensures we have the correct ID and all fields from the database
          // The reload will also update the unread count correctly
          loadNotifications(true);
          
          // Skip toast notification for assignment notifications - only show for reminders
          const notificationType = eventNotification.notification_type;
          if (notificationType && notificationType !== 'assigned') {
            console.log('[Notifications] Showing toast for reminder notification:', {
              title: eventNotification.title,
              message: eventNotification.message,
              type: notificationType
            });
            
            // Use setTimeout to ensure toast is called after current execution context
            setTimeout(() => {
              try {
                toast.info(eventNotification.title || 'Notification événement', {
                  description: eventNotification.message || '',
                  duration: 5000, // Show for 5 seconds
                });
                console.log('[Notifications] Toast called successfully');
              } catch (error) {
                console.error('[Notifications] Error calling toast:', error);
              }
            }, 100);
          } else {
            console.log('[Notifications] Skipping toast - notification_type is:', notificationType);
          }
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
            if (message.unread_count === 0 && activeTab === 'unread') {
              setActiveTab('read');
            }
          }
        }
      } else if (message.type === 'unread_count_updated') {
        setUnreadCount(message.unread_count || 0);
        // Switch to read tab if no more unread notifications
        if (message.unread_count === 0 && activeTab === 'unread') {
          setActiveTab('read');
        }
        setUnreadCount(message.unread_count || 0);
      } else if (message.type === 'connection_established') {
        setUnreadCount(message.unread_count || 0);
        // Reload notifications when connection is established
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
  }, [loadNotifications]);

  // Auto-refresh notifications periodically (like WhatsApp)
  useEffect(() => {
    // Don't start auto-refresh until initial load is complete
    if (loading) return;

    const interval = setInterval(() => {
      // Refresh notifications silently (don't show loading state)
      loadNotifications(true);
      // Also refresh unread count separately for accuracy
      loadUnreadCount();
    }, 10000); // Refresh every 10 seconds (less frequent than chat since notifications are less time-sensitive)

    return () => clearInterval(interval);
  }, [loading, loadNotifications, loadUnreadCount]);

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
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          // Always allow toggling - users can open/close whenever they want
          setIsOpen(!isOpen);
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

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Notifications</h3>
            <div className="notifications-header-actions">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
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
                            {getNotificationIcon(notification.type)}
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
                            {getNotificationIcon(notification.type)}
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

