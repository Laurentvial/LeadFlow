import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { apiCall } from '../utils/api';
import LoadingIndicator from './LoadingIndicator';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContactData();
  }, [contactId]);

  async function loadContactData() {
    try {
      const [
        contactData,
        notesData,
        eventsData
      ] = await Promise.all([
        apiCall(`/api/contacts/${contactId}/`),
        apiCall(`/api/notes/?contactId=${contactId}`),
        apiCall(`/api/events/?contactId=${contactId}`)
      ]);
      
      setContact((contactData as any).contact);
      // Notes API now returns array filtered by contactId
      const notesArray = Array.isArray(notesData) ? notesData : ((notesData as any).notes || notesData || []);
      setNotes(notesArray);
      
      // Events API now returns array filtered by contactId
      const eventsArray = (eventsData as any).events || [];
      setAppointments(eventsArray);
    } catch (error) {
      console.error('Error loading contact data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleContactUpdated() {
    await loadContactData();
  }

  if (loading) {
    return <LoadingIndicator />;
  }

  if (!contact) {
    return (
      <div className="contact-detail-container">
        <p>Contact non trouvé</p>
      </div>
    );
  }

  return (
    <div className="contact-detail-container" style={{ padding: '30px' }}>
      {/* Header */}
      <div className="contact-detail-header">
        <div className="contact-detail-title-section">
          <div>
            <h1 className="contact-detail-name page-title ">
              {contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact sans nom'}
            </h1>
          </div>
        </div>
      </div>

      {/* Contact Details Tabs */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <ContactInfoTab 
            contact={contact}
            onContactUpdated={handleContactUpdated}
            appointments={appointments}
            notes={notes}
            contactId={contactId}
            onRefresh={loadContactData}
          />
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

