import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ArrowLeft, User, Power, Calendar, FileText, Mail } from 'lucide-react';
import { apiCall } from '../utils/api';
import LoadingIndicator from './LoadingIndicator';
import { toast } from 'sonner';
import { EditPersonalInfoModal } from './EditPersonalInfoModal';
import { EditPatrimonialInfoModal } from './EditPatrimonialInfoModal';
import { ContactInfoTab } from './ContactInfoTab';
import { ContactAppointmentsTab } from './ContactAppointmentsTab';
import { ContactNotesTab } from './ContactNotesTab';
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
  const [isEditPatrimonialInfoOpen, setIsEditPatrimonialInfoOpen] = useState(false);
  

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

  function handlePatrimonialInfoUpdated(updatedContact: any) {
    setContact(updatedContact);
  }


  function handlePlatformAccess() {
    // TODO: Redirection vers la plateforme contact (à implémenter plus tard)
    toast.info('Redirection vers la plateforme contact - Fonctionnalité à venir');
  }

  if (loading) {
    return <LoadingIndicator />;
  }

  if (!contact) {
    return (
      <div className="contact-detail-container">
        <Button onClick={onBack} variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <p>Contact non trouvé</p>
      </div>
    );
  }

  return (
    <div className="contact-detail-container">
      {/* Header */}
      <div className="contact-detail-header">
        <Button onClick={onBack} variant="ghost">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        
        <div className="contact-detail-title-section">
          <div className="contact-detail-avatar">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="contact-detail-name">
              {contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Contact sans nom'}
            </h1>
            <div className="contact-detail-meta">
              {contact.email && (
                <div className="contact-detail-meta-item">
                  <Mail className="w-4 h-4 mr-2" />
                  {contact.email}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="contact-detail-actions">
          <Button onClick={handlePlatformAccess} variant="outline">
            <Power className="w-4 h-4 mr-2" />
            Accès plateforme
          </Button>
        </div>
      </div>

      {/* Contact Details Tabs */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="appointments">RDV</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <ContactInfoTab 
            contact={contact}
            onOpenEditPersonalInfo={handleOpenEditModal}
            onOpenEditPatrimonialInfo={() => setIsEditPatrimonialInfoOpen(true)}
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
      </Tabs>

      {/* Edit Personal Info Modal */}
      <EditPersonalInfoModal
        isOpen={isEditPersonalInfoOpen}
        onClose={() => setIsEditPersonalInfoOpen(false)}
        contact={contact}
        contactId={contactId}
        onUpdate={handlePersonalInfoUpdated}
      />

      {/* Edit Patrimonial Info Modal */}
      <EditPatrimonialInfoModal
        isOpen={isEditPatrimonialInfoOpen}
        onClose={() => setIsEditPatrimonialInfoOpen(false)}
        contact={contact}
        contactId={contactId}
        onUpdate={handlePatrimonialInfoUpdated}
      />

    </div>
  );
}

export default ContactDetail;

