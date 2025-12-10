import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { X, Calendar } from 'lucide-react';
import '../styles/EventPopup.css';

interface EventPopupProps {
  notification: {
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
  };
  onClose: () => void;
}

export function EventPopup({ notification, onClose }: EventPopupProps) {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-close after 8 seconds (longer than message popup for event notifications)
    const timer = setTimeout(() => {
      onClose();
    }, 8000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClick = () => {
    // Navigate to planning calendar or contact detail if contactId exists
    if (notification.event.contactId) {
      navigate(`/contacts/${notification.event.contactId}`);
    } else {
      navigate('/planning');
    }
    onClose();
  };

  const formatDateTime = (datetimeStr: string) => {
    try {
      const date = new Date(datetimeStr);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return datetimeStr;
    }
  };

  const getNotificationIcon = () => {
    if (notification.notification_type === '5min_before') {
      return '🔴'; // Red circle for urgent
    } else if (notification.notification_type === '10min_before') {
      return '🟠'; // Orange circle for soon
    } else if (notification.notification_type === '30min_before') {
      return '🟡'; // Yellow circle for warning
    }
    return '📅'; // Calendar for assignment
  };

  // Debug logging
  React.useEffect(() => {
    console.log('[EventPopup] Component rendered with notification:', notification);
    console.log('[EventPopup] Notification type:', notification?.notification_type);
    console.log('[EventPopup] Title:', notification?.title);
    console.log('[EventPopup] Message:', notification?.message);
  }, [notification]);

  if (!notification) {
    console.error('[EventPopup] No notification provided!');
    return null;
  }

  return (
    <div 
      className="event-popup" 
      onClick={handleClick}
    >
      <div className="event-popup-content">
        <div className="event-popup-icon">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="event-popup-text">
          <div className="event-popup-title">
            <span className="event-popup-emoji">{getNotificationIcon()}</span>
            {notification.title}
          </div>
          <div className="event-popup-message">{notification.message}</div>
          {notification.event.datetime && (
            <div className="event-popup-datetime">
              {formatDateTime(notification.event.datetime)}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="event-popup-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

