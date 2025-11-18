import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Search, Eye, Calendar, FileText, Trash2, MoreVertical, Users, UserCheck, X, Upload } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { apiCall } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { toast } from 'sonner';
import '../styles/Contacts.css';
import '../styles/PageHeader.css';
import '../styles/Modal.css';

interface ContactsProps {
  onSelectContact: (contactId: string) => void;
}

export function Contacts({ onSelectContact }: ContactsProps) {
  const navigate = useNavigate();
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const [contacts, setContacts] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkTeleoperatorId, setBulkTeleoperatorId] = useState('');
  const [bulkConfirmateurId, setBulkConfirmateurId] = useState('');
  const [lastOpenedContactId, setLastOpenedContactId] = useState<string | null>(null);
  
  // Modals state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isTeleoperatorModalOpen, setIsTeleoperatorModalOpen] = useState(false);
  const [isConfirmateurModalOpen, setIsConfirmateurModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [selectedTeleoperatorId, setSelectedTeleoperatorId] = useState('');
  const [selectedConfirmateurId, setSelectedConfirmateurId] = useState('');

  useEffect(() => {
    if (usersError) {
      console.error('Error loading users:', usersError);
    }
    if (users.length > 0) {
      console.log('Users loaded:', users);
    } else if (!usersLoading) {
      console.warn('No users found. Users array is empty.');
    }
  }, [users, usersLoading, usersError]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load all data in parallel for better performance
      const [contactsData, teamsData, statusesData] = await Promise.all([
        apiCall('/api/contacts/'),
        apiCall('/api/teams/'),
        apiCall('/api/statuses/')
      ]);
      
      setContacts(contactsData.contacts || []);
      setTeams(teamsData.teams || []);
      setStatuses(statusesData.statuses || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  }


  const filteredContacts = contacts.filter(contact => {
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeam = selectedTeam === 'all'; // Team field removed from Contact model
    
    return matchesSearch && matchesTeam;
  });

  const displayedContacts = filteredContacts.slice(0, itemsPerPage);

  // Gestion de la sélection
  function handleSelectContact(contactId: string) {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
    setShowBulkActions(newSelected.size > 0);
  }

  function handleSelectAll() {
    if (selectedContacts.size === displayedContacts.length) {
      setSelectedContacts(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedContacts(new Set(displayedContacts.map(c => c.id)));
      setShowBulkActions(true);
    }
  }

  function handleClearSelection() {
    setSelectedContacts(new Set());
    setShowBulkActions(false);
    setBulkTeleoperatorId('');
    setBulkConfirmateurId('');
  }

  const allSelected = displayedContacts.length > 0 && selectedContacts.size === displayedContacts.length;
  const someSelected = selectedContacts.size > 0 && selectedContacts.size < displayedContacts.length;

  // Actions multiples
  async function handleBulkAssignTeleoperator(teleoperatorId: string) {
    if (!teleoperatorId) return;
    
    try {
      const teleoperatorIdValue = teleoperatorId !== 'none' ? teleoperatorId : '';
      
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ teleoperatorId: teleoperatorIdValue })
        })
      );
      await Promise.all(promises);
      toast.success(`${selectedContacts.size} contact(s) mis à jour avec succès`);
      loadData();
      handleClearSelection();
      setBulkTeleoperatorId('');
    } catch (error) {
      console.error('Error assigning teleoperator:', error);
      toast.error('Erreur lors de l\'attribution du téléopérateur');
    }
  }

  async function handleBulkAssignConfirmateur(confirmateurId: string) {
    if (!confirmateurId) return;
    
    try {
      const confirmateurIdValue = confirmateurId !== 'none' ? confirmateurId : '';
      
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ confirmateurId: confirmateurIdValue })
        })
      );
      await Promise.all(promises);
      toast.success(`${selectedContacts.size} contact(s) mis à jour avec succès`);
      loadData();
      handleClearSelection();
      setBulkConfirmateurId('');
    } catch (error) {
      console.error('Error assigning confirmateur:', error);
      toast.error('Erreur lors de l\'attribution du confirmateur');
    }
  }


  async function handleBulkDelete() {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedContacts.size} contact(s) ? Cette action est irréversible.`)) return;
    
    try {
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/delete/`, { method: 'DELETE' })
      );
      await Promise.all(promises);
      loadData();
      handleClearSelection();
    } catch (error) {
      console.error('Error deleting contacts:', error);
      alert('Erreur lors de la suppression des contacts');
    }
  }

  function handlePlaceAppointment(contactId: string) {
    // TODO: Implémenter la fonctionnalité de placement de RDV
    console.log('Placer RDV pour contact:', contactId);
  }

  function handleAddNote(contactId: string) {
    // TODO: Implémenter la fonctionnalité d'ajout de note
    console.log('Ajouter note pour contact:', contactId);
  }


  async function handleDeleteContact(contactId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) return;
    
    try {
      // TODO: Implémenter l'endpoint de suppression
      // await apiCall(`/api/contacts/${contactId}/`, { method: 'DELETE' });
      console.log('Supprimer contact:', contactId);
      loadData();
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  }

  // Modal handlers
  function handleOpenStatusModal(contact: any) {
    setSelectedContact(contact);
    setSelectedStatusId(contact.statusId || '');
    setIsStatusModalOpen(true);
  }

  function handleOpenTeleoperatorModal(contact: any) {
    setSelectedContact(contact);
    // Prefill with current teleoperator ID if exists
    const teleoperatorId = contact.teleoperatorId || contact.managerId || '';
    setSelectedTeleoperatorId(teleoperatorId);
    setIsTeleoperatorModalOpen(true);
  }

  function handleOpenConfirmateurModal(contact: any) {
    setSelectedContact(contact);
    setSelectedConfirmateurId(contact.confirmateurId || '');
    setIsConfirmateurModalOpen(true);
  }

  async function handleUpdateStatus() {
    if (!selectedContact) return;
    
    try {
      await apiCall(`/api/contacts/${selectedContact.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusId: selectedStatusId || '' })
      });
      toast.success('Statut mis à jour avec succès');
      setIsStatusModalOpen(false);
      setSelectedContact(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du statut');
    }
  }

  async function handleUpdateTeleoperator() {
    if (!selectedContact) return;
    
    try {
      await apiCall(`/api/contacts/${selectedContact.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teleoperatorId: selectedTeleoperatorId || '' })
      });
      toast.success('Téléopérateur mis à jour avec succès');
      setIsTeleoperatorModalOpen(false);
      setSelectedContact(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du téléopérateur');
    }
  }

  async function handleUpdateConfirmateur() {
    if (!selectedContact) return;
    
    try {
      await apiCall(`/api/contacts/${selectedContact.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmateurId: selectedConfirmateurId || '' })
      });
      toast.success('Confirmateur mis à jour avec succès');
      setIsConfirmateurModalOpen(false);
      setSelectedContact(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du confirmateur');
    }
  }

  // Filter users for teleoperator and confirmateur
  const teleoperateurs = users.filter(user => user.isTeleoperateur === true);
  const confirmateurs = users.filter(user => user.isConfirmateur === true);

  return (
    <div className="contacts-container">
      <div className="contacts-header page-header">
        <div className="page-title-section">
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Gestion de vos contacts</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/contacts/import')}>
            <Upload className="w-4 h-4 mr-2" />
            Importer CSV
          </Button>
          <Button onClick={() => navigate('/contacts/add')}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="contacts-filters">
            <div className="contacts-filter-section">
              <Label>Recherche</Label>
              <div className="contacts-search-wrapper">
                <Search className="contacts-search-icon" />
                <Input
                  className="contacts-search-input"
                  placeholder="Nom, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="contacts-filter-section">
              <Label>Équipe</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les équipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les équipes</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="contacts-filter-section">
              <Label>Affichage par</Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="25" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barre d'actions multiples */}
      {showBulkActions && (
        <Card className="contacts-bulk-actions">
          <CardContent className="pt-4">
            <div className="contacts-bulk-actions-content">
              <div className="contacts-bulk-actions-info">
                <span>{selectedContacts.size} contact(s) sélectionné(s)</span>
                <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
              <div className="contacts-bulk-actions-buttons">
                <div className="contacts-bulk-action-select">
                  <Label className="sr-only">Attribuer un téléopérateur</Label>
                  <Select value={bulkTeleoperatorId} onValueChange={handleBulkAssignTeleoperator}>
                    <SelectTrigger className="w-[200px]">
                      <UserCheck className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Attribuer un téléopérateur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun téléopérateur</SelectItem>
                      {usersLoading ? (
                        <SelectItem value="loading" disabled>Chargement...</SelectItem>
                      ) : usersError ? (
                        <SelectItem value="error" disabled>Erreur de chargement</SelectItem>
                      ) : teleoperateurs.length === 0 ? (
                        <SelectItem value="empty" disabled>Aucun téléopérateur disponible</SelectItem>
                      ) : (
                        teleoperateurs.map((user) => {
                          const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                          return (
                            <SelectItem key={user.id} value={user.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="contacts-bulk-action-select">
                  <Label className="sr-only">Attribuer un confirmateur</Label>
                  <Select value={bulkConfirmateurId} onValueChange={handleBulkAssignConfirmateur}>
                    <SelectTrigger className="w-[200px]">
                      <UserCheck className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Attribuer un confirmateur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun confirmateur</SelectItem>
                      {usersLoading ? (
                        <SelectItem value="loading" disabled>Chargement...</SelectItem>
                      ) : usersError ? (
                        <SelectItem value="error" disabled>Erreur de chargement</SelectItem>
                      ) : confirmateurs.length === 0 ? (
                        <SelectItem value="empty" disabled>Aucun confirmateur disponible</SelectItem>
                      ) : (
                        confirmateurs.map((user) => {
                          const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                          return (
                            <SelectItem key={user.id} value={user.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des contacts ({filteredContacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContacts.length > 0 ? (
            <div className="contacts-table-wrapper">
              <table className="contacts-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected;
                        }}
                        onChange={handleSelectAll}
                        className="contacts-checkbox"
                      />
                    </th>
                    <th>Id</th>
                    <th>Nom entier</th>
                    <th>Téléphone</th>
                    <th>E-Mail</th>
                    <th>Créé le</th>
                    <th>Téléopérateur</th>
                    <th>Source</th>
                    <th>Statut</th>
                    <th>Confirmateur</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedContacts.map((contact) => (
                    <tr 
                      key={contact.id}
                      style={{
                        backgroundColor: lastOpenedContactId === contact.id ? '#eff6ff' : 'transparent',
                        borderLeft: lastOpenedContactId === contact.id ? '3px solid #3b82f6' : 'none'
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact.id)}
                          onChange={() => handleSelectContact(contact.id)}
                          className="contacts-checkbox"
                        />
                      </td>
                      <td className="contacts-table-id">
                        {contact.id.substring(0, 8)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                              setLastOpenedContactId(contact.id);
                              window.open(`/contacts/${contact.id}`, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
                            }}
                            className="contacts-name-link"
                          >
                            {contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '-'}
                          </button>
                          {lastOpenedContactId === contact.id && (
                            <span 
                              style={{
                                fontSize: '0.75rem',
                                color: '#3b82f6',
                                fontWeight: '600',
                                backgroundColor: '#dbeafe',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Dernier ouvert
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{contact.phone || contact.mobile || '-'}</td>
                      <td className="contacts-table-email">{contact.email || '-'}</td>
                      <td>
                        {contact.createdAt 
                          ? new Date(contact.createdAt).toLocaleString('fr-FR', {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })
                          : '-'
                        }
                      </td>
                      <td>
                        <button
                          onClick={() => handleOpenTeleoperatorModal(contact)}
                          className="contacts-clickable-cell"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                        >
                          {contact.managerName || contact.teleoperatorName || '-'}
                        </button>
                      </td>
                      <td>{contact.source || '-'}</td>
                      <td>
                        <button
                          onClick={() => handleOpenStatusModal(contact)}
                          className="contacts-clickable-cell"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          <span 
                            className="contacts-status-badge"
                            style={{
                              backgroundColor: contact.statusColor || '#e5e7eb',
                              color: contact.statusColor ? '#000000' : '#374151',
                              padding: '4px 12px',
                              borderRadius: '5px',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              display: 'inline-block'
                            }}
                          >
                            {contact.statusName || '-'}
                          </span>
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => handleOpenConfirmateurModal(contact)}
                          className="contacts-clickable-cell"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                        >
                          {contact.confirmateurName || '-'}
                        </button>
                      </td>
                      <td>
                        <div className="contacts-actions">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePlaceAppointment(contact.id)}>
                                <Calendar className="w-4 h-4 mr-2" />
                                Placer RDV
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddNote(contact.id)}>
                                <FileText className="w-4 h-4 mr-2" />
                                Ajouter une note
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteContact(contact.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="contacts-empty">Aucun contact trouvé</p>
          )}
        </CardContent>
      </Card>

      {/* Status Modal */}
      {isStatusModalOpen && selectedContact && (
        <div className="modal-overlay" onClick={() => setIsStatusModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier le statut</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsStatusModalOpen(false)}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="statusSelect">Statut</Label>
                <Select
                  value={selectedStatusId ? selectedStatusId.toString() : undefined}
                  onValueChange={(value) => setSelectedStatusId(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="statusSelect">
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun statut</SelectItem>
                    {statuses
                      .filter((status) => status.id && status.id.trim() !== '')
                      .map((status) => (
                        <SelectItem key={status.id} value={status.id.toString()}>
                          {status.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-actions">
                <Button type="button" variant="outline" onClick={() => setIsStatusModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="button" onClick={handleUpdateStatus}>
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teleoperator Modal */}
      {isTeleoperatorModalOpen && selectedContact && (
        <div className="modal-overlay" onClick={() => setIsTeleoperatorModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier le téléopérateur</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsTeleoperatorModalOpen(false)}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="teleoperatorSelect">Téléopérateur</Label>
                <Select
                  value={selectedTeleoperatorId ? selectedTeleoperatorId.toString() : undefined}
                  onValueChange={(value) => setSelectedTeleoperatorId(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="teleoperatorSelect">
                    <SelectValue placeholder="Sélectionner un téléopérateur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun téléopérateur</SelectItem>
                    {teleoperateurs
                      .filter((user) => user.id && user.id.trim() !== '')
                      .map((user) => {
                        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                        return (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-actions">
                <Button type="button" variant="outline" onClick={() => setIsTeleoperatorModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="button" onClick={handleUpdateTeleoperator}>
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmateur Modal */}
      {isConfirmateurModalOpen && selectedContact && (
        <div className="modal-overlay" onClick={() => setIsConfirmateurModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier le confirmateur</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsConfirmateurModalOpen(false)}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="confirmateurSelect">Confirmateur</Label>
                <Select
                  value={selectedConfirmateurId ? selectedConfirmateurId.toString() : undefined}
                  onValueChange={(value) => setSelectedConfirmateurId(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="confirmateurSelect">
                    <SelectValue placeholder="Sélectionner un confirmateur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun confirmateur</SelectItem>
                    {confirmateurs
                      .filter((user) => user.id && user.id.trim() !== '')
                      .map((user) => {
                        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                        return (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {displayName}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-actions">
                <Button type="button" variant="outline" onClick={() => setIsConfirmateurModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="button" onClick={handleUpdateConfirmateur}>
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contacts;
