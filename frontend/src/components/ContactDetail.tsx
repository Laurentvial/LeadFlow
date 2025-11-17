import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { apiCall } from '../utils/api';
import LoadingIndicator from './LoadingIndicator';
import { toast } from 'sonner';
import { EditPersonalInfoModal } from './EditPersonalInfoModal';
import { ContactInfoTab } from './ContactInfoTab';
import { ContactAppointmentsTab } from './ContactAppointmentsTab';
import { ContactNotesTab } from './ContactNotesTab';
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
  
  // Dialogs
  const [isEditPersonalInfoOpen, setIsEditPersonalInfoOpen] = useState(false);
  

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
        apiCall(`/api/notes/`),
        apiCall(`/api/events/`)
      ]);
      
      setContact((contactData as any).contact);
      // Filter notes for this contact - notes API returns array directly
      const notesArray = Array.isArray(notesData) ? notesData : ((notesData as any).notes || notesData || []);
      const contactNotes = notesArray.filter((note: any) => note.contactId === contactId);
      setNotes(contactNotes);
      
      // Filter events (appointments) for this contact - events API returns {events: [...]}
      const eventsArray = (eventsData as any).events || [];
      const contactAppointments = eventsArray.filter((event: any) => event.contactId === contactId);
      setAppointments(contactAppointments);
    } catch (error) {
      console.error('Error loading contact data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenEditModal() {
    setIsEditPersonalInfoOpen(true);
  }

  function handlePersonalInfoUpdated(updatedContact: any) {
    setContact(updatedContact);
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
          <TabsTrigger value="appointments">RDV</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="documents">Documents & conformité</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <ContactInfoTab 
            contact={contact}
            onOpenEditPersonalInfo={handleOpenEditModal}
            onContactUpdated={loadContactData}
          />
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments">
          <ContactAppointmentsTab appointments={appointments} />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <ContactNotesTab 
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

      {/* Edit Personal Info Modal */}
      <EditPersonalInfoModal
        isOpen={isEditPersonalInfoOpen}
        onClose={() => setIsEditPersonalInfoOpen(false)}
        contact={contact}
        contactId={contactId}
        onUpdate={handlePersonalInfoUpdated}
      />

    </div>
  );
}

export default ContactDetail;

