import React, { useEffect } from 'react';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { EventPopup } from './EventPopup';

export function EventPopupWrapper() {
  const { eventPopup, closeEventPopup } = useUnreadMessages();

  useEffect(() => {
    console.log('[EventPopupWrapper] 🔄 useEffect triggered, eventPopup:', eventPopup);
    if (eventPopup) {
      console.log('[EventPopupWrapper] ✅✅✅ eventPopup is SET:', eventPopup);
      console.log('[EventPopupWrapper] Notification type:', eventPopup.notification_type);
      console.log('[EventPopupWrapper] Title:', eventPopup.title);
      console.log('[EventPopupWrapper] Will render EventPopup component NOW');
    } else {
      console.log('[EventPopupWrapper] ⚠️ eventPopup is null/undefined');
    }
  }, [eventPopup]);

  if (!eventPopup) {
    console.log('[EventPopupWrapper] ❌ Returning null - no eventPopup');
    return null;
  }

  console.log('[EventPopupWrapper] 🎨🎨🎨 RENDERING EventPopup component NOW!');
  return <EventPopup notification={eventPopup} onClose={closeEventPopup} />;
}

