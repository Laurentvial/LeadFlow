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
      
      // Load notes and events in parallel after contact is loaded (non-blocking)
      loadNotesAndEvents();
    } catch (error) {
      console.error('Error loading contact data:', error);
      setContact(null);
    }
  }

  // Load notes and events separately (non-blocking)
  async function loadNotesAndEvents() {
    // Load notes
    setLoadingNotes(true);
    try {
      const notesData = await apiCall(`/api/notes/?contactId=${contactId}`);
      const notesArray = Array.isArray(notesData) ? notesData : ((notesData as any).notes || notesData || []);
      setNotes(notesArray);
    } catch (err) {
      console.error('Error loading notes:', err);
      setNotes([]);
    } finally {
      setLoadingNotes(false);
    }

    // Load events
    setLoadingEvents(true);
    try {
      const eventsData = await apiCall(`/api/events/?contactId=${contactId}`);
      const eventsArray = (eventsData as any).events || [];
      setAppointments(eventsArray);
    } catch (err) {
      console.error('Error loading events:', err);
      setAppointments([]);
    } finally {
      setLoadingEvents(false);
    }
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
      <Tabs defaultValue="info" className="space-y-6">
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

