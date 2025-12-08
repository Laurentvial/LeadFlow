import React, { useEffect } from 'react';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { MessagePopup } from './MessagePopup';

export function MessagePopupWrapper() {
  const { messagePopup, closePopup } = useUnreadMessages();

  if (!messagePopup) {
    return null;
  }

  return <MessagePopup message={messagePopup} onClose={closePopup} />;
}

