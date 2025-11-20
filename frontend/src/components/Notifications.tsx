import React, { useState, useEffect } from 'react';
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
  const loadNotifications = async () => {
    try {
      const data = await apiCall('/api/notifications/');
      setNotifications(data.notifications || []);
      setUnreadCount(data.notifications?.filter((n: Notification) => !n.is_read).length || 0);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load unread count
  const loadUnreadCount = async () => {
    try {
      const data = await apiCall('/api/notifications/unread-count/');
      setUnreadCount(data.unread_count || 0);
    } catch (error: any) {
      console.error('Error loading unread count:', error);
    }
  };

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
        // Add new notification
        setNotifications(prev => [message.notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Show toast notification
        toast.info(message.notification.title, {
          description: message.notification.message,
        });
      } else if (message.type === 'unread_count_updated') {
        setUnreadCount(message.unread_count || 0);
      } else if (message.type === 'connection_established') {
        setUnreadCount(message.unread_count || 0);
      }
    },
    onError: (error) => {
      console.error('Notifications WebSocket error:', error);
    },
    reconnect: true,
  });

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, []);

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
                  onClick={() => handleNotificationClick(notification)}
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
              ))
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

