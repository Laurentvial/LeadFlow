import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DateInput } from './ui/date-input';
import { X, Plus } from 'lucide-react';
import { apiCall } from '../utils/api';
import { useUsers } from '../hooks/useUsers';
import { useUser } from '../contexts/UserContext';
import { toast } from 'sonner';
import { formatPhoneNumber, formatPhoneNumberAsYouType, removePhoneSpaces } from '../utils/phoneNumber';
import '../styles/Modal.css';
import '../styles/Contacts.css';

interface Source {
  id: string;
  name: string;
}

interface EditPersonalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: any;
  contactId: string;
  onUpdate: (updatedContact: any) => void;
}

export function EditPersonalInfoModal({
  isOpen,
  onClose,
  contact,
  contactId,
  onUpdate
}: EditPersonalInfoModalProps) {
  const { users, loading: usersLoading } = useUsers();
  const { currentUser } = useUser();
  const [statuses, setStatuses] = useState<any[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  
  // Get status view permissions
  const statusViewPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const viewPerms = currentUser.permissions
      .filter((p: any) => p.component === 'statuses' && p.action === 'view' && p.statusId)
      .map((p: any) => String(p.statusId).trim());
    return new Set(viewPerms);
  }, [currentUser?.permissions]);
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  
  const [editPersonalInfoForm, setEditPersonalInfoForm] = useState({
    statusId: '',
    civility: '',
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    phone: '',
    birthDate: '',
    nationality: '',
    address: '',
    addressComplement: '',
    postalCode: '',
    city: '',
    sourceId: '',
    campaign: '',
    teleoperatorId: '',
    confirmateurId: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadStatuses();
      loadSources();
    }
  }, [isOpen]);

  async function loadStatuses() {
    try {
      const data = await apiCall('/api/statuses/');
      const loadedStatuses = data.statuses || [];
      setStatuses(loadedStatuses);
    } catch (error) {
      console.error('Error loading statuses:', error);
    }
  }

  async function loadSources() {
    try {
      const data = await apiCall('/api/sources/');
      setSources(data.sources || []);
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  }

  async function handleCreateSource() {
    if (!newSourceName.trim()) {
      toast.error('Le nom de la source est requis');
      return;
    }

    try {
      const response = await apiCall('/api/sources/create/', {
        method: 'POST',
        body: JSON.stringify({ name: newSourceName.trim() }),
      });
      
      toast.success('Source créée avec succès');
      setNewSourceName('');
      setIsSourceDialogOpen(false);
      await loadSources();
      setEditPersonalInfoForm({ ...editPersonalInfoForm, sourceId: response.id });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création de la source');
    }
  }

  // Initialize form when modal opens or contact changes
  React.useEffect(() => {
    if (isOpen && contact) {
      setEditPersonalInfoForm({
        statusId: contact.statusId || '',
        civility: contact.civility || '',
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        mobile: removePhoneSpaces(contact.mobile) || '',
        phone: removePhoneSpaces(contact.phone) || '',
        birthDate: contact.birthDate || '',
        nationality: contact.nationality || '',
        address: contact.address || '',
        addressComplement: contact.addressComplement || '',
        postalCode: contact.postalCode || '',
        city: contact.city || '',
        sourceId: contact.sourceId || '',
        campaign: contact.campaign || '',
        teleoperatorId: contact.teleoperatorId || '',
        confirmateurId: contact.confirmateurId || ''
      });
    }
  }, [isOpen, contact]);

  async function handleUpdatePersonalInfo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    try {
      const payload: any = {
        statusId: editPersonalInfoForm.statusId || '',
        civility: editPersonalInfoForm.civility || '',
        firstName: editPersonalInfoForm.firstName || '',
        lastName: editPersonalInfoForm.lastName || '',
        email: editPersonalInfoForm.email || '',
        mobile: removePhoneSpaces(String(editPersonalInfoForm.mobile)),
        phone: removePhoneSpaces(String(editPersonalInfoForm.phone)),
        birthDate: editPersonalInfoForm.birthDate || '',
        nationality: editPersonalInfoForm.nationality || '',
        address: editPersonalInfoForm.address || '',
        addressComplement: editPersonalInfoForm.addressComplement || '',
        postalCode: editPersonalInfoForm.postalCode || '',
        city: editPersonalInfoForm.city || '',
        sourceId: editPersonalInfoForm.sourceId || '',
        campaign: editPersonalInfoForm.campaign || '',
        teleoperatorId: editPersonalInfoForm.teleoperatorId || '',
        confirmateurId: editPersonalInfoForm.confirmateurId || ''
      };

      // Use JSON for update
      const response = await apiCall(`/api/contacts/${contactId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response?.contact) {
        onUpdate(response.contact);
        
        // Notify parent window (contact list) about the update
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({
              type: 'CONTACT_UPDATED',
              contactId: contactId,
              contact: response.contact
            }, window.location.origin);
          } catch (error) {
            console.warn('Could not send message to parent window:', error);
          }
        }
        
        onClose();
        toast.success('Informations personnelles mises à jour avec succès');
      }
    } catch (error: any) {
      console.error('Error updating personal info:', error);
      toast.error(error?.message || 'Erreur lors de la mise à jour des informations');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '42rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Modifier les informations personnelles</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="modal-close"
            onClick={onClose}
          >
            <X className="planning-icon-md" />
          </Button>
        </div>
        <form onSubmit={handleUpdatePersonalInfo} className="modal-form">
          {/* 1. Informations générales */}
          <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>1. Informations générales</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="modal-form-field">
                <Label htmlFor="editStatusId">Statut *</Label>
                <Select
                  value={editPersonalInfoForm.statusId}
                  onValueChange={(value) => {
                    if (value !== 'no-status-disabled') {
                      setEditPersonalInfoForm({ ...editPersonalInfoForm, statusId: value });
                    }
                  }}
                  required
                >
                  <SelectTrigger id="editStatusId">
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.length === 0 ? (
                      <SelectItem value="no-status-disabled" disabled>
                        Aucun statut disponible
                      </SelectItem>
                      ) : (
                        statuses
                          .filter((status) => {
                            if (!status.id || status.id.trim() === '') return false;
                            // Filter by view permissions
                            const normalizedStatusId = String(status.id).trim();
                            return statusViewPermissions.has(normalizedStatusId);
                          })
                          .map((status) => (
                            <SelectItem key={status.id} value={status.id}>
                              <span 
                                className="inline-block px-2 py-1 rounded text-sm"
                                style={{
                                  backgroundColor: status.color || '#e5e7eb',
                                  color: status.color ? '#000000' : '#374151'
                                }}
                              >
                                {status.name}
                              </span>
                            </SelectItem>
                          ))
                      )}
                  </SelectContent>
                </Select>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editCivility">Civilité</Label>
                <Select
                  value={editPersonalInfoForm.civility || 'none'}
                  onValueChange={(value) => setEditPersonalInfoForm({ ...editPersonalInfoForm, civility: value === 'none' ? '' : value })}
                >
                  <SelectTrigger id="editCivility">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    <SelectItem value="Monsieur">Monsieur</SelectItem>
                    <SelectItem value="Madame">Madame</SelectItem>
                    <SelectItem value="Mademoiselle">Mademoiselle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editFirstName">Prénom *</Label>
                <Input
                  id="editFirstName"
                  value={editPersonalInfoForm.firstName}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, firstName: e.target.value })}
                  placeholder="Prénom"
                  required
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editLastName">Nom *</Label>
                <Input
                  id="editLastName"
                  value={editPersonalInfoForm.lastName}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, lastName: e.target.value })}
                  placeholder="Nom"
                  required
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editPersonalInfoForm.email}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, email: e.target.value })}
                  placeholder="Email"
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editMobile">Portable *</Label>
                <Input
                  id="editMobile"
                  type="number"
                  value={editPersonalInfoForm.mobile}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, mobile: removePhoneSpaces(e.target.value) })}
                  placeholder="0612345678"
                  required
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editPhone">Téléphone</Label>
                <Input
                  id="editPhone"
                  type="number"
                  value={editPersonalInfoForm.phone}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, phone: removePhoneSpaces(e.target.value) })}
                  placeholder="0123456789"
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editBirthDate">Date de naissance</Label>
                <DateInput
                  id="editBirthDate"
                  value={editPersonalInfoForm.birthDate}
                  onChange={(value) => setEditPersonalInfoForm({ ...editPersonalInfoForm, birthDate: value })}
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editNationality">Nationalité</Label>
                <Input
                  id="editNationality"
                  value={editPersonalInfoForm.nationality}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, nationality: e.target.value })}
                  placeholder="Nationalité"
                />
              </div>
            </div>
          </div>

          {/* 2. Adresse */}
          <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>2. Adresse</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="modal-form-field">
                <Label htmlFor="editAddress">Adresse</Label>
                <Input
                  id="editAddress"
                  value={editPersonalInfoForm.address}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, address: e.target.value })}
                  placeholder="Adresse"
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editAddressComplement">Complément d'adresse</Label>
                <Input
                  id="editAddressComplement"
                  value={editPersonalInfoForm.addressComplement}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, addressComplement: e.target.value })}
                  placeholder="Complément d'adresse"
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editPostalCode">Code postal</Label>
                <Input
                  id="editPostalCode"
                  value={editPersonalInfoForm.postalCode}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, postalCode: e.target.value })}
                  placeholder="Code postal"
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editCity">Ville</Label>
                <Input
                  id="editCity"
                  value={editPersonalInfoForm.city}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, city: e.target.value })}
                  placeholder="Ville"
                />
              </div>
            </div>
          </div>

          {/* 3. Gestion */}
          <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>3. Gestion</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="modal-form-field">
                <Label htmlFor="editSourceId">Source</Label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Select
                    value={editPersonalInfoForm.sourceId || 'none'}
                    onValueChange={(value) => setEditPersonalInfoForm({ ...editPersonalInfoForm, sourceId: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger id="editSourceId" style={{ flex: 1 }}>
                      <SelectValue placeholder="Sélectionner une source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {sources
                        .filter((source) => source.id && source.id.trim() !== '')
                        .map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSourceDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editCampaign">Campagne</Label>
                <Input
                  id="editCampaign"
                  value={editPersonalInfoForm.campaign}
                  onChange={(e) => setEditPersonalInfoForm({ ...editPersonalInfoForm, campaign: e.target.value })}
                  placeholder="Nom de la campagne"
                />
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editTeleoperatorId">Téléopérateur</Label>
                <Select
                  value={editPersonalInfoForm.teleoperatorId || 'none'}
                  onValueChange={(value) => setEditPersonalInfoForm({ ...editPersonalInfoForm, teleoperatorId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger id="editTeleoperatorId">
                    <SelectValue placeholder="Sélectionner un téléopérateur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {usersLoading ? (
                      <SelectItem value="loading" disabled>Chargement...</SelectItem>
                    ) : (
                      users
                        ?.filter((user) => user.id && user.id.trim() !== '' && user.isTeleoperateur === true)
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="editConfirmateurId">Confirmateur</Label>
                <Select
                  value={editPersonalInfoForm.confirmateurId || 'none'}
                  onValueChange={(value) => setEditPersonalInfoForm({ ...editPersonalInfoForm, confirmateurId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger id="editConfirmateurId">
                    <SelectValue placeholder="Sélectionner un confirmateur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {usersLoading ? (
                      <SelectItem value="loading" disabled>Chargement...</SelectItem>
                    ) : (
                      users
                        ?.filter((user) => user.id && user.id.trim() !== '' && user.isConfirmateur === true)
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="modal-form-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              Enregistrer
            </Button>
          </div>
        </form>

        {/* Source Add Dialog */}
        {isSourceDialogOpen && (
          <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setIsSourceDialogOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h2 className="modal-title">Ajouter une source</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="modal-close"
                  onClick={() => setIsSourceDialogOpen(false)}
                >
                  <X className="planning-icon-md" />
                </Button>
              </div>
              <div className="modal-form">
                <div className="modal-form-field">
                  <Label htmlFor="newSourceName">Nom de la source</Label>
                  <Input
                    id="newSourceName"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="Nom de la source"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateSource();
                      }
                    }}
                  />
                </div>
                <div className="modal-form-actions">
                  <Button type="button" variant="outline" onClick={() => setIsSourceDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="button" onClick={handleCreateSource}>
                    Créer
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditPersonalInfoModal;

