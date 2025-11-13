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
import '../styles/Clients.css';
import '../styles/PageHeader.css';

interface ClientsProps {
  onSelectClient: (clientId: string) => void;
}

export function Clients({ onSelectClient }: ClientsProps) {
  const navigate = useNavigate();
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const [clients, setClients] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
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
      const [clientsData, teamsData] = await Promise.all([
        apiCall('/api/clients/'),
        apiCall('/api/teams/')
      ]);
      
      setClients(clientsData.clients || []);
      setTeams(teamsData.teams || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }

  async function handleToggleActive(clientId: string) {
    try {
      await apiCall(`/api/clients/${clientId}/toggle-active/`, { method: 'POST' });
      loadData();
    } catch (error) {
      console.error('Error toggling client status:', error);
    }
  }

  const filteredClients = clients.filter(client => {
    const fullName = `${client.firstName || ''} ${client.lastName || ''}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeam = selectedTeam === 'all' || client.teamId === selectedTeam;
    
    return matchesSearch && matchesTeam;
  });

  const displayedClients = filteredClients.slice(0, itemsPerPage);

  // Gestion de la sélection
  function handleSelectClient(clientId: string) {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
    setShowBulkActions(newSelected.size > 0);
  }

  function handleSelectAll() {
    if (selectedClients.size === displayedClients.length) {
      setSelectedClients(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedClients(new Set(displayedClients.map(c => c.id)));
      setShowBulkActions(true);
    }
  }

  function handleClearSelection() {
    setSelectedClients(new Set());
    setShowBulkActions(false);
  }

  const allSelected = displayedClients.length > 0 && selectedClients.size === displayedClients.length;
  const someSelected = selectedClients.size > 0 && selectedClients.size < displayedClients.length;

  // Actions multiples
  async function handleBulkChangeTeam(teamId: string) {
    if (!teamId) return;
    
    try {
      const promises = Array.from(selectedClients).map(clientId =>
        apiCall(`/api/clients/${clientId}/`, {
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
      
      const promises = Array.from(selectedClients).map(clientId =>
        apiCall(`/api/clients/${clientId}/`, {
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
    if (!confirm(`Êtes-vous sûr de vouloir ${displayedClients.filter(c => selectedClients.has(c.id)).some(c => c.active) ? 'désactiver' : 'activer'} ${selectedClients.size} client(s) ?`)) return;
    
    try {
      const promises = Array.from(selectedClients).map(clientId =>
        apiCall(`/api/clients/${clientId}/toggle-active/`, { method: 'POST' })
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
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedClients.size} client(s) ? Cette action est irréversible.`)) return;
    
    try {
      const promises = Array.from(selectedClients).map(clientId =>
        apiCall(`/api/clients/${clientId}/delete/`, { method: 'DELETE' })
      );
      await Promise.all(promises);
      loadData();
      handleClearSelection();
    } catch (error) {
      console.error('Error deleting clients:', error);
      alert('Erreur lors de la suppression des clients');
    }
  }

  function handlePlaceAppointment(clientId: string) {
    // TODO: Implémenter la fonctionnalité de placement de RDV
    console.log('Placer RDV pour client:', clientId);
  }

  function handleAddNote(clientId: string) {
    // TODO: Implémenter la fonctionnalité d'ajout de note
    console.log('Ajouter note pour client:', clientId);
  }

  function handlePlatformAccess(clientId: string) {
    // TODO: Implémenter la fonctionnalité de connexion à la plateforme
    console.log('Connexion plateforme pour client:', clientId);
  }

  async function handleDeleteClient(clientId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;
    
    try {
      // TODO: Implémenter l'endpoint de suppression
      // await apiCall(`/api/clients/${clientId}/`, { method: 'DELETE' });
      console.log('Supprimer client:', clientId);
      loadData();
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  }

  return (
    <div className="clients-container">
      <div className="clients-header page-header">
        <div className="page-title-section">
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Gestion de vos clients</p>
        </div>
        
        <Button onClick={() => navigate('/clients/add')}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un client
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="clients-filters">
            <div className="clients-filter-section">
              <Label>Recherche</Label>
              <div className="clients-search-wrapper">
                <Search className="clients-search-icon" />
                <Input
                  className="clients-search-input"
                  placeholder="Nom, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="clients-filter-section">
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

            <div className="clients-filter-section">
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
        <Card className="clients-bulk-actions">
          <CardContent className="pt-4">
            <div className="clients-bulk-actions-content">
              <div className="clients-bulk-actions-info">
                <span>{selectedClients.size} client(s) sélectionné(s)</span>
                <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
              <div className="clients-bulk-actions-buttons">
                <div className="clients-bulk-action-select">
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

                <div className="clients-bulk-action-select">
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

      {/* Clients List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des clients ({filteredClients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClients.length > 0 ? (
            <div className="clients-table-wrapper">
              <table className="clients-table">
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
                        className="clients-checkbox"
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
                  {displayedClients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedClients.has(client.id)}
                          onChange={() => handleSelectClient(client.id)}
                          className="clients-checkbox"
                        />
                      </td>
                      <td className="clients-table-id">
                        {client.id.substring(0, 8)}
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/clients/${client.id}`)}
                          className="clients-name-link"
                        >
                          {client.fullName || `${client.firstName || ''} ${client.lastName || ''}`.trim() || '-'}
                        </button>
                      </td>
                      <td>{client.phone || client.mobile || '-'}</td>
                      <td className="clients-table-email">{client.email || '-'}</td>
                      <td>
                        {client.createdAt 
                          ? new Date(client.createdAt).toLocaleString('fr-FR', {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })
                          : '-'
                        }
                      </td>
                      <td>{client.support || '-'}</td>
                      <td>{client.managerName || client.manager || '-'}</td>
                      <td>{client.source || '-'}</td>
                      <td>
                        {client.capital 
                          ? new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(client.capital)
                          : '0,00 €'
                        }
                      </td>
                      <td>
                        <span className={client.active ? 'clients-status-active' : 'clients-status-inactive'}>
                          {client.active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const team = teams.find(t => t.id === client.teamId);
                          return team ? team.name : '-';
                        })()}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(client.id)}
                          className={client.active ? 'clients-status-active' : 'clients-status-inactive'}
                        >
                          {client.active ? 'Désactiver' : 'Activer'}
                        </Button>
                      </td>
                      <td>
                        <div className="clients-actions">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePlaceAppointment(client.id)}>
                                <Calendar className="w-4 h-4 mr-2" />
                                Placer RDV
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddNote(client.id)}>
                                <FileText className="w-4 h-4 mr-2" />
                                Ajouter une note
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePlatformAccess(client.id)}>
                                <LogIn className="w-4 h-4 mr-2" />
                                Connexion à la plateforme client
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClient(client.id)}
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
            <p className="clients-empty">Aucun client trouvé</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Clients;