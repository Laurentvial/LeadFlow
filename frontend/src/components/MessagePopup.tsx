import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import '../styles/MessagePopup.css';

interface MessagePopupProps {
  message: {
    id: string;
    chatRoomId: string;
    senderId: number;
    senderName: string;
    content: string;
    createdAt: string;
  };
  onClose: () => void;
}

export function MessagePopup({ message, onClose }: MessagePopupProps) {
  const navigate = useNavigate();

  console.log('[MessagePopup] Rendering popup with message:', message);

  useEffect(() => {
    console.log('[MessagePopup] Setting up auto-close timer');
    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      console.log('[MessagePopup] Auto-closing popup');
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClick = () => {
    navigate(`/chat?room=${message.chatRoomId}`);
    onClose();
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  console.log('[MessagePopup] Rendering popup with message:', message);

  return (
    <div 
      className="message-popup" 
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        minWidth: '300px',
        maxWidth: '400px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
        display: 'block',
        visibility: 'visible',
        opacity: 1,
      }}
    >
      <div className="message-popup-content">
        <Avatar className="message-popup-avatar">
          <AvatarFallback>
            {getInitials(message.senderName)}
          </AvatarFallback>
        </Avatar>
        <div className="message-popup-text">
          <div className="message-popup-sender">{message.senderName}</div>
          <div className="message-popup-message">{message.content}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="message-popup-close"
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

