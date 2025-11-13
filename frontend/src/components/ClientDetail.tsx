import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ArrowLeft, User, Power, CheckCircle, XCircle, Calendar, FileText, Mail } from 'lucide-react';
import { apiCall } from '../utils/api';
import LoadingIndicator from './LoadingIndicator';
import { toast } from 'sonner';
import { EditPersonalInfoModal } from './EditPersonalInfoModal';
import { EditPatrimonialInfoModal } from './EditPatrimonialInfoModal';
import { ClientInfoTab } from './ClientInfoTab';
import { ClientAssetsTab } from './ClientAssetsTab';
import { ClientTransactionsTab } from './ClientTransactionsTab';
import { ClientAppointmentsTab } from './ClientAppointmentsTab';
import { ClientNotesTab } from './ClientNotesTab';
import { ClientMiscTab } from './ClientMiscTab';
import '../styles/Clients.css';
import '../styles/PlanningCalendar.css';

interface ClientDetailProps {
  clientId: string;
  onBack: () => void;
}

export function ClientDetail({ clientId, onBack }: ClientDetailProps) {
  const [client, setClient] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [clientAssets, setClientAssets] = useState<any[]>([]);
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [clientRibs, setClientRibs] = useState<any[]>([]);
  const [availableRibs, setAvailableRibs] = useState<any[]>([]);
  const [clientUsefulLinks, setClientUsefulLinks] = useState<any[]>([]);
  const [availableUsefulLinks, setAvailableUsefulLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [isEditPersonalInfoOpen, setIsEditPersonalInfoOpen] = useState(false);
  const [isEditPatrimonialInfoOpen, setIsEditPatrimonialInfoOpen] = useState(false);
  

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  async function loadClientData() {
    try {
      const [
        clientData,
        notesData,
        eventsData,
        assetsData,
        availableAssetsData,
        ribsData,
        availableRibsData,
        usefulLinksData,
        availableUsefulLinksData
      ] = await Promise.all([
        apiCall(`/api/clients/${clientId}/`),
        apiCall(`/api/notes/`),
        apiCall(`/api/events/`),
        apiCall(`/api/clients/${clientId}/assets/`),
        apiCall(`/api/assets/`),
        apiCall(`/api/clients/${clientId}/ribs/`),
        apiCall(`/api/ribs/`),
        apiCall(`/api/clients/${clientId}/useful-links/`),
        apiCall(`/api/useful-links/`)
      ]);
      
      setClient((clientData as any).client);
      // Filter notes for this client - notes API returns array directly
      const notesArray = Array.isArray(notesData) ? notesData : ((notesData as any).notes || notesData || []);
      const clientNotes = notesArray.filter((note: any) => note.clientId === clientId);
      setNotes(clientNotes);
      
      // Filter events (appointments) for this client - events API returns {events: [...]}
      const eventsArray = (eventsData as any).events || [];
      const clientAppointments = eventsArray.filter((event: any) => event.clientId === clientId);
      setAppointments(clientAppointments);
      
      // Set client assets
      const assetsArray = (assetsData as any).assets || [];
      setClientAssets(assetsArray);
      
      // Set available assets
      const availableAssetsArray = (availableAssetsData as any).assets || [];
      setAvailableAssets(availableAssetsArray);
      
      // Set client RIBs
      const ribsArray = (ribsData as any).ribs || [];
      setClientRibs(ribsArray);
      
      // Set available RIBs
      const availableRibsArray = (availableRibsData as any).ribs || [];
      setAvailableRibs(availableRibsArray);
      
      // Set client useful links
      const usefulLinksArray = (usefulLinksData as any).usefulLinks || [];
      setClientUsefulLinks(usefulLinksArray);
      
      // Set available useful links
      const availableUsefulLinksArray = (availableUsefulLinksData as any).usefulLinks || [];
      setAvailableUsefulLinks(availableUsefulLinksArray);
      
      // Load transactions
      try {
        const transactionsData = await apiCall(`/api/clients/${clientId}/transactions/`);
        const transactionsArray = (transactionsData as any).transactions || [];
        setTransactions(transactionsArray);
      } catch (error) {
        console.error('Error loading transactions:', error);
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenEditModal() {
    setIsEditPersonalInfoOpen(true);
  }

  function handlePersonalInfoUpdated(updatedClient: any) {
    setClient(updatedClient);
  }

  function handlePatrimonialInfoUpdated(updatedClient: any) {
    setClient(updatedClient);
  }


  function handlePlatformAccess() {
    // TODO: Redirection vers la plateforme client (à implémenter plus tard)
    toast.info('Redirection vers la plateforme client - Fonctionnalité à venir');
    // window.location.href = `/platform/client/${clientId}`;
  }

  async function handleToggleActive() {
    try {
      await apiCall(`/api/clients/${clientId}/toggle-active/`, { method: 'POST' });
      toast.success(client.active ? 'Client désactivé' : 'Client activé');
      loadClientData();
    } catch (error) {
      console.error('Error toggling active status:', error);
      toast.error('Erreur lors de la modification du statut');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingIndicator />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Client introuvable</p>
        <Button onClick={onBack} className="mt-4">
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2"/>
          Retour
        </Button>
        <div className="mt-2 flex gap-4">
          {client.profilePhoto ? (
            <img 
              src={client.profilePhoto} 
              alt="Photo de profil" 
              className="client-profile-photo-display"
            />
          ) : (
            <div className="client-profile-photo-placeholder-display">
              <User className="w-12 h-12" />
            </div>
          )}
          <div>
            <h1 className="text-slate-900 mb-1">
              {client.firstName} {client.lastName}
            </h1>
            <p className="text-slate-600">{client.email}</p>
          </div>
          </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          size="sm"
          onClick={() => toast.info('Fonctionnalité à venir - Placer RDV')}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Placer RDV
        </Button>

        <Button 
          size="sm" 
          variant="outline"
          onClick={() => toast.info('Fonctionnalité à venir - Ajouter une note')}
        >
          <FileText className="w-4 h-4 mr-2" />
          Ajouter une note
        </Button>

        <Button 
          size="sm" 
          variant="outline"
          onClick={() => toast.info('Fonctionnalité à venir - Envoyer un message')}
        >
          <Mail className="w-4 h-4 mr-2" />
          Envoyer un message
        </Button>

        <Button 
          size="sm" 
          variant="outline"
          onClick={handlePlatformAccess}
        >
          <Power className="w-4 h-4 mr-2" />
          Connexion à la plateforme
        </Button>

        <Button 
          size="sm" 
          variant="outline"
          onClick={handleToggleActive}
          className={client.active ? 'client-action-button-deactivate' : 'client-action-button-activate'}
        >
          {client.active ? (
            <>
              <XCircle className="w-4 h-4 mr-2" />
              Désactiver
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Activer
            </>
          )}
        </Button>
      </div>


      {/* Client Details Tabs */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="assets">Actifs</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="appointments">RDV</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="misc">Fonctionnalités diverses</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <ClientInfoTab 
            client={client}
            onOpenEditPersonalInfo={handleOpenEditModal}
            onOpenEditPatrimonialInfo={() => setIsEditPatrimonialInfoOpen(true)}
            onClientUpdated={loadClientData}
          />
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <ClientTransactionsTab 
            transactions={transactions}
            onRefresh={loadClientData}
            clientId={clientId}
          />
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments">
          <ClientAppointmentsTab appointments={appointments} />
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets">
          <ClientAssetsTab 
            clientId={clientId}
            clientAssets={clientAssets}
            availableAssets={availableAssets}
            onRefresh={loadClientData}
          />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <ClientNotesTab 
            notes={notes}
            clientId={clientId}
            onRefresh={loadClientData}
          />
        </TabsContent>

        {/* Misc Tab */}
        <TabsContent value="misc">
          <ClientMiscTab
            clientId={clientId}
            clientRibs={clientRibs}
            availableRibs={availableRibs}
            clientUsefulLinks={clientUsefulLinks}
            availableUsefulLinks={availableUsefulLinks}
            onRefresh={loadClientData}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Personal Info Modal */}
      <EditPersonalInfoModal
        isOpen={isEditPersonalInfoOpen}
        onClose={() => setIsEditPersonalInfoOpen(false)}
        client={client}
        clientId={clientId}
        onUpdate={handlePersonalInfoUpdated}
      />

      {/* Edit Patrimonial Info Modal */}
      <EditPatrimonialInfoModal
        isOpen={isEditPatrimonialInfoOpen}
        onClose={() => setIsEditPatrimonialInfoOpen(false)}
        client={client}
        clientId={clientId}
        onUpdate={handlePatrimonialInfoUpdated}
      />

    </div>
  );
}

export default ClientDetail;