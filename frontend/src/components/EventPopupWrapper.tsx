import React from 'react';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import { EventPopup } from './EventPopup';

export function EventPopupWrapper() {
  const { eventPopup, closeEventPopup } = useUnreadMessages();

  React.useEffect(() => {
    if (eventPopup) {
      console.log('[EventPopupWrapper] Rendering EventPopup with:', eventPopup);
    }
  }, [eventPopup]);

  if (!eventPopup) {
    return null;
  }

  return <EventPopup notification={eventPopup} onClose={closeEventPopup} />;
}

