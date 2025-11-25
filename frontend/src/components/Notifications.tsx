import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { apiCall } from '../utils/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
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
      await apiCall(`/api/notifications/${notificationId}/read/`, {
        method: 'POST',
      });
      
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
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
    }
    
    setIsOpen(false);
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
      } else if (message.type === 'unread_count_updated') {
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

  // Mark as read via WebSocket when notification is clicked
  useEffect(() => {
    if (ws.isConnected) {
      // Send mark read via WebSocket when needed
      // This is handled in handleNotificationClick
    }
  }, [ws.isConnected]);

  return (
    <div className="notifications-container">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
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
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="mark-all-read-button"
                >
                  <Check className="h-4 w-4" />
                  Tout marquer comme lu
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="notifications-list">
            {loading ? (
              <div className="notifications-loading">Chargement...</div>
            ) : notifications.length === 0 ? (
              <div className="notifications-empty">Aucune notification</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
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
                    {!notification.is_read && (
                      <div className="notification-unread-indicator" />
                    )}
                  </div>
                  {!notification.is_read && (
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
                  )}
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

