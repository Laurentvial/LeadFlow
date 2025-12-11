import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import '../styles/MessagePopup.css';

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
    console.log('[EventPopup] Component mounted with notification:', notification);
    // Auto-close after 8 seconds
    const timer = setTimeout(() => {
      console.log('[EventPopup] Auto-closing popup');
      onClose();
    }, 8000);

    return () => {
      console.log('[EventPopup] Component unmounting');
      clearTimeout(timer);
    };
  }, [onClose, notification]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Stop propagation to prevent interfering with other elements
    e.stopPropagation();
    
    // Check if a modal is currently open - if so, don't handle the click
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
      console.log('[EventPopup] Modal is open, ignoring click');
      return;
    }
    
    // Only handle clicks directly on the popup or its children (but not on the close button)
    const target = e.target as HTMLElement;
    const isCloseButton = target.closest('.message-popup-close') || target.closest('button');
    
    if (!isCloseButton && (e.target === e.currentTarget || e.currentTarget.contains(target))) {
      console.log('[EventPopup] Clicked, navigating...');
      // Navigate to planning calendar or contact detail if contactId exists
      if (notification.event.contactId) {
        navigate(`/contacts/${notification.event.contactId}`);
      } else {
        navigate('/planning');
      }
      onClose();
    }
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
      return '🔴';
    } else if (notification.notification_type === '10min_before') {
      return '🟠';
    } else if (notification.notification_type === '30min_before') {
      return '🟡';
    }
    return '📅';
  };

  const getInitials = () => {
    return 'EV';
  };

  if (!notification) {
    console.error('[EventPopup] No notification provided!');
    return null;
  }

  // Format the display message
  const displayMessage = notification.event.datetime 
    ? `${notification.message}\n${formatDateTime(notification.event.datetime)}`
    : notification.message;

  console.log('[EventPopup] Rendering popup with:', {
    title: notification.title,
    message: displayMessage,
    icon: getNotificationIcon()
  });

  return (
    <div 
      className="message-popup" 
      onClick={handleClick}
      onMouseDown={(e) => {
        // Stop propagation to prevent clicks from reaching elements behind the popup
        e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 10002,
        minWidth: '300px',
        maxWidth: '400px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        pointerEvents: 'auto',
      }}
    >
      <div className="message-popup-content">
        <Avatar className="message-popup-avatar">
          <AvatarFallback>
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        <div className="message-popup-text">
          <div className="message-popup-sender">
            {getNotificationIcon()} {notification.title}
          </div>
          <div className="message-popup-message" style={{ whiteSpace: 'pre-line' }}>
            {displayMessage}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="message-popup-close"
          onClick={(e) => {
            e.stopPropagation();
            console.log('[EventPopup] Close button clicked');
            onClose();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
