import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Search, Eye, Calendar, FileText, LogIn, Trash2, MoreVertical, Users, UserCheck, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { apiCall } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import '../styles/Contacts.css';
import '../styles/PageHeader.css';

interface ContactsProps {
  onSelectContact: (contactId: string) => void;
}

export function Contacts({ onSelectContact }: ContactsProps) {
  const navigate = useNavigate();
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const [contacts, setContacts] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkTeamId, setBulkTeamId] = useState('');
  const [bulkManagerId, setBulkManagerId] = useState('');

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
      const [contactsData, teamsData] = await Promise.all([
        apiCall('/api/contacts/'),
        apiCall('/api/teams/')
      ]);
      
      setContacts(contactsData.contacts || []);
      setTeams(teamsData.teams || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  }

  async function handleToggleActive(contactId: string) {
    try {
      await apiCall(`/api/contacts/${contactId}/toggle-active/`, { method: 'POST' });
      loadData();
    } catch (error) {
      console.error('Error toggling contact status:', error);
    }
  }

  const filteredContacts = contacts.filter(contact => {
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeam = selectedTeam === 'all' || contact.teamId === selectedTeam;
    
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
  }

  const allSelected = displayedContacts.length > 0 && selectedContacts.size === displayedContacts.length;
  const someSelected = selectedContacts.size > 0 && selectedContacts.size < displayedContacts.length;

  // Actions multiples
  async function handleBulkChangeTeam(teamId: string) {
    if (!teamId) return;
    
    try {
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ teamId: teamId === 'none' ? null : teamId })
        })
      );
      await Promise.all(promises);
      loadData();
      handleClearSelection();
      setBulkTeamId('');
    } catch (error) {
      alert('Erreur lors du changement d\'équipe');
    }
  }

  async function handleBulkAssignManager(managerId: string) {
    if (!managerId) return;
    
    try {
      const managerIdValue = managerId !== 'none' ? managerId : '';
      
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ managed_by: managerIdValue })
        })
      );
      await Promise.all(promises);
      loadData();
      handleClearSelection();
      setBulkManagerId('');
    } catch (error) {
      console.error('Error assigning manager:', error);
      alert('Erreur lors de l\'attribution du gestionnaire');
    }
  }

  async function handleBulkToggleActive() {
    if (!confirm(`Êtes-vous sûr de vouloir ${displayedContacts.filter(c => selectedContacts.has(c.id)).some(c => c.active) ? 'désactiver' : 'activer'} ${selectedContacts.size} contact(s) ?`)) return;
    
    try {
      const promises = Array.from(selectedContacts).map(contactId =>
        apiCall(`/api/contacts/${contactId}/toggle-active/`, { method: 'POST' })
      );
      await Promise.all(promises);
      loadData();
      handleClearSelection();
    } catch (error) {
      console.error('Error toggling active status:', error);
      alert('Erreur lors de la modification du statut');
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

  function handlePlatformAccess(contactId: string) {
    // TODO: Implémenter la fonctionnalité de connexion à la plateforme
    console.log('Connexion plateforme pour contact:', contactId);
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

  return (
    <div className="contacts-container">
      <div className="contacts-header page-header">
        <div className="page-title-section">
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Gestion de vos contacts</p>
        </div>
        
        <Button onClick={() => navigate('/contacts/add')}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un contact
        </Button>
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
                  <Label className="sr-only">Changer d'équipe</Label>
                  <Select value={bulkTeamId} onValueChange={handleBulkChangeTeam}>
                    <SelectTrigger className="w-[180px]">
                      <Users className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Changer d'équipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune équipe</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="contacts-bulk-action-select">
                  <Label className="sr-only">Attribuer un gestionnaire</Label>
                  <Select value={bulkManagerId} onValueChange={handleBulkAssignManager}>
                    <SelectTrigger className="w-[200px]">
                      <UserCheck className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Attribuer un gestionnaire" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun gestionnaire</SelectItem>
                      {usersLoading ? (
                        <SelectItem value="loading" disabled>Chargement...</SelectItem>
                      ) : usersError ? (
                        <SelectItem value="error" disabled>Erreur de chargement</SelectItem>
                      ) : users.length === 0 ? (
                        <SelectItem value="empty" disabled>Aucun utilisateur disponible</SelectItem>
                      ) : (
                        users.map((user) => {
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

                <Button variant="outline" size="sm" onClick={handleBulkToggleActive}>
                  Activer/Désactiver
                </Button>

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
                    <th>Support</th>
                    <th>Gestionnaire</th>
                    <th>Source</th>
                    <th>Capital</th>
                    <th>Statut</th>
                    <th>Équipe</th>
                    <th>Actif</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedContacts.map((contact) => (
                    <tr key={contact.id}>
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
                        <button
                          onClick={() => navigate(`/contacts/${contact.id}`)}
                          className="contacts-name-link"
                        >
                          {contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '-'}
                        </button>
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
                      <td>{contact.support || '-'}</td>
                      <td>{contact.managerName || contact.manager || '-'}</td>
                      <td>{contact.source || '-'}</td>
                      <td>
                        {contact.capital 
                          ? new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(contact.capital)
                          : '0,00 €'
                        }
                      </td>
                      <td>
                        <span className={contact.active ? 'contacts-status-active' : 'contacts-status-inactive'}>
                          {contact.active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const team = teams.find(t => t.id === contact.teamId);
                          return team ? team.name : '-';
                        })()}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(contact.id)}
                          className={contact.active ? 'contacts-status-active' : 'contacts-status-inactive'}
                        >
                          {contact.active ? 'Désactiver' : 'Activer'}
                        </Button>
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
                              <DropdownMenuItem onClick={() => handlePlatformAccess(contact.id)}>
                                <LogIn className="w-4 h-4 mr-2" />
                                Connexion à la plateforme contact
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
    </div>
  );
}

export default Contacts;
