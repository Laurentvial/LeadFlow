import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { ContactInfoTab } from './ContactInfoTab';
import { ContactHistoryTab } from './ContactHistoryTab';
import { ContactDocumentsTab } from './ContactDocumentsTab';
import { ContactTransactionsTab } from './ContactTransactionsTab';
import { useUser } from '../contexts/UserContext';
import '../styles/Contacts.css';
import '../styles/PlanningCalendar.css';

interface ContactDetailProps {
  contactId: string;
  onBack: () => void;
}

export function ContactDetail({ contactId, onBack }: ContactDetailProps) {
  const { currentUser } = useUser();
  const [contact, setContact] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true); // Start as true to show skeleton initially
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsHasMore, setEventsHasMore] = useState(false);
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false);

  // Check permissions for each tab
  const canViewInformationsTab = useMemo(() => {
    if (!currentUser?.permissions) return true; // Default to visible if no permissions loaded
    // Check if user has permission to view informations tab
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'view' && 
      p.fieldName === 'informations' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to visible
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  const canViewDocumentsTab = useMemo(() => {
    if (!currentUser?.permissions) return true; // Default to visible if no permissions loaded
    // Check if user has permission to view documents tab
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'view' && 
      p.fieldName === 'documents' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to visible
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  const canViewHistoriqueTab = useMemo(() => {
    if (!currentUser?.permissions) return true; // Default to visible if no permissions loaded
    // Check if user has permission to view historique tab
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'view' && 
      p.fieldName === 'historique' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to visible
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  const canViewTransactionsTab = useMemo(() => {
    if (!currentUser?.permissions) return true; // Default to visible if no permissions loaded
    // Check if user has permission to view transactions tab
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'view' && 
      p.fieldName === 'transactions' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to visible
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  // Determine default tab based on available permissions
  const defaultTab = useMemo(() => {
    if (canViewInformationsTab) return 'info';
    if (canViewDocumentsTab) return 'documents';
    if (canViewHistoriqueTab) return 'history';
    if (canViewTransactionsTab) return 'transactions';
    return 'info'; // Fallback
  }, [canViewInformationsTab, canViewDocumentsTab, canViewHistoriqueTab, canViewTransactionsTab]);

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
    } catch (error: any) {
      console.error('Error loading contact data:', error);
      // Don't show error toast for network errors - user likely knows backend isn't running
      if (!error.isNetworkError) {
        // Only show toast for actual API errors, not connection issues
        // toast.error(error.message || 'Erreur lors du chargement du contact');
      }
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
    <div className="contact-detail-container" style={{ padding: '30px', maxWidth: '100%', width: '100%' }}>
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
      {(canViewInformationsTab || canViewDocumentsTab || canViewHistoriqueTab || canViewTransactionsTab) && (
        <Tabs defaultValue={defaultTab} className="space-y-3">
          <TabsList>
            {canViewInformationsTab && (
              <TabsTrigger value="info">Informations</TabsTrigger>
            )}
            {canViewDocumentsTab && (
              <TabsTrigger value="documents">Documents</TabsTrigger>
            )}
            {canViewHistoriqueTab && (
              <TabsTrigger value="history">Historique</TabsTrigger>
            )}
            {canViewTransactionsTab && (
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            )}
          </TabsList>

          {/* Info Tab */}
          {canViewInformationsTab && (
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
          )}

          {/* Documents Tab */}
          {canViewDocumentsTab && (
            <TabsContent value="documents">
              <ContactDocumentsTab contactId={contactId} />
            </TabsContent>
          )}

          {/* History Tab */}
          {canViewHistoriqueTab && (
            <TabsContent value="history">
              <ContactHistoryTab contactId={contactId} />
            </TabsContent>
          )}

          {/* Transactions Tab */}
          {canViewTransactionsTab && (
            <TabsContent value="transactions">
              <ContactTransactionsTab contactId={contactId} />
            </TabsContent>
          )}
        </Tabs>
      )}

    </div>
  );
}

export default ContactDetail;

