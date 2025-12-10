import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { ContactInfoTab } from './ContactInfoTab';
import { ContactHistoryTab } from './ContactHistoryTab';
import { ContactDocumentsTab } from './ContactDocumentsTab';
import '../styles/Contacts.css';
import '../styles/PlanningCalendar.css';

interface ContactDetailProps {
  contactId: string;
  onBack: () => void;
}

export function ContactDetail({ contactId, onBack }: ContactDetailProps) {
  const [contact, setContact] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true); // Start as true to show skeleton initially
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsHasMore, setEventsHasMore] = useState(false);
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false);

  useEffect(() => {
    loadContactData();
  }, [contactId]);

  // Load contact first (critical path)
  async function loadContactData() {
    try {
      const contactData = await apiCall(`/api/contacts/${contactId}/`);
      
      // Check if contactData has an error or if contact is missing
      if (!contactData || (contactData as any).error) {
        console.error('Error loading contact:', (contactData as any).error);
        setContact(null);
        return;
      }
      
      setContact((contactData as any).contact);
      
      // Reset events pagination when contact changes
      setAppointments([]);
      setEventsPage(1);
      setEventsHasMore(false);
      
      // Load notes and events in parallel after contact is loaded (non-blocking)
      loadNotesAndEvents(1);
    } catch (error) {
      console.error('Error loading contact data:', error);
      setContact(null);
    }
  }

  // Load notes and events in parallel (non-blocking)
  async function loadNotesAndEvents(page: number = 1, append: boolean = false) {
    if (page === 1) {
      setLoadingNotes(true);
      setLoadingEvents(true);
    } else {
      setLoadingMoreEvents(true);
    }
    
    // Load notes and events in parallel for better performance
    try {
      const [notesResult, eventsResult] = await Promise.allSettled([
        page === 1 ? apiCall(`/api/notes/?contactId=${contactId}`) : Promise.resolve(null), // Only load notes on first page
        apiCall(`/api/events/?contactId=${contactId}&page=${page}&page_size=20`)
      ]);

      // Handle notes result (only on first page)
      if (page === 1 && notesResult.status === 'fulfilled') {
        const notesData = notesResult.value;
        // Handle both paginated response (data.results) and direct array response
        const notesArray = Array.isArray(notesData) ? notesData : ((notesData as any).results || (notesData as any).notes || notesData || []);
        setNotes(notesArray);
      } else if (page === 1 && notesResult.status === 'rejected') {
        console.error('Error loading notes:', notesResult.reason);
        setNotes([]);
      }

      // Handle events result
      if (eventsResult.status === 'fulfilled') {
        const eventsData = eventsResult.value;
        const eventsArray = (eventsData as any).events || [];
        
        if (append) {
          setAppointments(prev => [...prev, ...eventsArray]);
        } else {
          setAppointments(eventsArray);
        }
        
        // Update pagination state
        setEventsHasMore((eventsData as any).has_next || false);
        setEventsPage(page);
      } else {
        console.error('Error loading events:', eventsResult.reason);
        if (!append) {
          setAppointments([]);
        }
      }
    } catch (err) {
      console.error('Error loading notes and events:', err);
      if (!append) {
        setNotes([]);
        setAppointments([]);
      }
    } finally {
      if (page === 1) {
        setLoadingNotes(false);
        setLoadingEvents(false);
      } else {
        setLoadingMoreEvents(false);
      }
    }
  }

  // Load more events
  async function loadMoreEvents() {
    if (!eventsHasMore || loadingMoreEvents) return;
    await loadNotesAndEvents(eventsPage + 1, true);
  }

  async function handleContactUpdated() {
    await loadContactData();
  }

  return (
    <div className="contact-detail-container" style={{ padding: '30px' }}>
      {/* Header */}
      {contact && (
        <div className="contact-detail-header">
          <div className="contact-detail-title-section">
            <div>
              <h1 className="contact-detail-name page-title ">
                {contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact sans nom'}
              </h1>
            </div>
          </div>
        </div>
      )}

      {/* Contact Details Tabs */}
      <Tabs defaultValue="info" className="space-y-3">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          {contact && (
            <ContactInfoTab 
              contact={contact}
              onContactUpdated={handleContactUpdated}
              appointments={appointments}
              notes={notes}
              contactId={contactId}
              onRefresh={loadContactData}
              loadingEvents={loadingEvents}
              loadingMoreEvents={loadingMoreEvents}
              hasMoreEvents={eventsHasMore}
              onLoadMoreEvents={loadMoreEvents}
            />
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <ContactDocumentsTab contactId={contactId} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <ContactHistoryTab contactId={contactId} />
        </TabsContent>
      </Tabs>

    </div>
  );
}

export default ContactDetail;

