import React, { useEffect } from 'react';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { MessagePopup } from './MessagePopup';

export function MessagePopupWrapper() {
  const { messagePopup, closePopup } = useUnreadMessages();

  useEffect(() => {
    console.log('[MessagePopupWrapper] Component mounted');
    return () => {
      console.log('[MessagePopupWrapper] Component unmounted');
    };
  }, []);

  useEffect(() => {
    console.log('[MessagePopupWrapper] messagePopup changed:', messagePopup);
    if (messagePopup) {
      console.log('[MessagePopupWrapper] Popup should be visible now!');
    }
  }, [messagePopup]);

  if (!messagePopup) {
    console.log('[MessagePopupWrapper] No popup to show');
    return null;
  }

  console.log('[MessagePopupWrapper] Rendering MessagePopup component');
  return <MessagePopup message={messagePopup} onClose={closePopup} />;
}

