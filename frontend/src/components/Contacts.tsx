import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Search, Eye, Calendar, FileText, Trash2, MoreVertical, Users, UserCheck, X, Upload, Settings2, GripVertical, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import LoadingIndicator from './LoadingIndicator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { apiCall } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { useSources } from '../hooks/useSources';
import { useHasPermission } from '../hooks/usePermissions';
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
  const { sources, loading: sourcesLoading } = useSources();
  
  // Permission checks
  const canCreate = useHasPermission('contacts', 'create');
  const canEdit = useHasPermission('contacts', 'edit');
  const canDelete = useHasPermission('contacts', 'delete');
  const [contacts, setContacts] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [statusTypeFilter, setStatusTypeFilter] = useState<'all' | 'lead' | 'client'>('all');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
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
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  
  // Define all available columns
  const allColumns = [
    { id: 'id', label: 'Id', defaultVisible: true },
    { id: 'fullName', label: 'Nom entier', defaultVisible: true },
    { id: 'firstName', label: 'Prénom', defaultVisible: false },
    { id: 'lastName', label: 'Nom', defaultVisible: false },
    { id: 'civility', label: 'Civilité', defaultVisible: false },
    { id: 'phone', label: 'Téléphone', defaultVisible: true },
    { id: 'mobile', label: 'Portable', defaultVisible: false },
    { id: 'email', label: 'E-Mail', defaultVisible: true },
    { id: 'birthDate', label: 'Date de naissance', defaultVisible: false },
    { id: 'birthPlace', label: 'Lieu de naissance', defaultVisible: false },
    { id: 'address', label: 'Adresse', defaultVisible: false },
    { id: 'addressComplement', label: 'Complément d\'adresse', defaultVisible: false },
    { id: 'postalCode', label: 'Code postal', defaultVisible: false },
    { id: 'city', label: 'Ville', defaultVisible: false },
    { id: 'nationality', label: 'Nationalité', defaultVisible: false },
    { id: 'campaign', label: 'Campagne', defaultVisible: false },
    { id: 'createdAt', label: 'Créé le', defaultVisible: true },
    { id: 'updatedAt', label: 'Modifié le', defaultVisible: false },
    { id: 'teleoperator', label: 'Téléopérateur', defaultVisible: true },
    { id: 'source', label: 'Source', defaultVisible: true },
    { id: 'status', label: 'Statut', defaultVisible: true },
    { id: 'confirmateur', label: 'Confirmateur', defaultVisible: true },
    { id: 'creator', label: 'Créateur', defaultVisible: false },
    { id: 'managerTeam', label: 'Équipe du manager', defaultVisible: false },
  ];
  
  // Load column visibility and order from localStorage or use defaults
  const getInitialColumnOrder = () => {
    const saved = localStorage.getItem('contacts-table-column-order');
    if (saved) {
      try {
        const savedOrder = JSON.parse(saved);
        // Ensure all columns are present (in case new columns were added)
        const allColumnIds = allColumns.map(col => col.id);
        const missingColumns = allColumnIds.filter(id => !savedOrder.includes(id));
        return [...savedOrder, ...missingColumns];
      } catch {
        return allColumns.map(col => col.id);
      }
    }
    return allColumns.map(col => col.id);
  };
  
  const getInitialVisibleColumns = () => {
    const saved = localStorage.getItem('contacts-table-columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return allColumns.filter(col => col.defaultVisible).map(col => col.id);
      }
    }
    return allColumns.filter(col => col.defaultVisible).map(col => col.id);
  };
  
  const [columnOrder, setColumnOrder] = useState<string[]>(getInitialColumnOrder());
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getInitialVisibleColumns());
  
  // Save column order to localStorage
  const saveColumnOrder = (order: string[]) => {
    localStorage.setItem('contacts-table-column-order', JSON.stringify(order));
    setColumnOrder(order);
  };
  
  // Save column visibility to localStorage
  const saveVisibleColumns = (columns: string[]) => {
    localStorage.setItem('contacts-table-columns', JSON.stringify(columns));
    setVisibleColumns(columns);
  };
  
  const handleToggleColumn = (columnId: string) => {
    const newVisible = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    saveVisibleColumns(newVisible);
  };
  
  const handleResetColumns = () => {
    const defaultColumns = allColumns.filter(col => col.defaultVisible).map(col => col.id);
    saveVisibleColumns(defaultColumns);
    // Reset order to default
    const defaultOrder = allColumns.map(col => col.id);
    saveColumnOrder(defaultOrder);
  };

  // Drag and drop handlers for column reordering
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

  const handleDragStart = (columnId: string) => {
    setDraggedColumnId(columnId);
  };

  const handleDragOver = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedColumnId && draggedColumnId !== targetColumnId) {
      e.currentTarget.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    if (!draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null);
      return;
    }

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColumnId);
    const targetIndex = newOrder.indexOf(targetColumnId);

    // Remove dragged item from its current position
    newOrder.splice(draggedIndex, 1);
    // Insert at target position
    newOrder.splice(targetIndex, 0, draggedColumnId);

    saveColumnOrder(newOrder);
    setDraggedColumnId(null);
  };

  const handleDragEnd = () => {
    // Remove drag-over class from all items
    document.querySelectorAll('.column-drag-item').forEach(item => {
      item.classList.remove('drag-over');
    });
    setDraggedColumnId(null);
  };

  // Get ordered visible columns
  const getOrderedVisibleColumns = () => {
    return columnOrder.filter(id => visibleColumns.includes(id));
  };

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
    setIsLoading(true);
    try {
      // Load all data in parallel for better performance
      const [contactsData, teamsData, statusesData] = await Promise.all([
        apiCall('/api/contacts/'),
        apiCall('/api/teams/'),
        apiCall('/api/statuses/')
      ]);
      
      // Sort contacts by creation date (most recent first)
      const contactsList = contactsData.contacts || [];
      const sortedContacts = contactsList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Most recent first
      });
      setContacts(sortedContacts);
      setTeams(teamsData.teams || []);
      setStatuses(statusesData.statuses || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }


  // Helper function to determine if a column should use Select filter
  const shouldUseSelectFilter = (columnId: string): boolean => {
    return ['status', 'creator', 'teleoperator', 'confirmateur', 'source'].includes(columnId);
  };
  
  // Helper function to get filter options for Select columns
  const getFilterOptions = (columnId: string) => {
    switch (columnId) {
      case 'status':
        return statuses.map(status => ({
          id: status.id,
          label: status.name
        }));
      case 'creator':
        return users.map(user => ({
          id: user.id,
          label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`
        }));
      case 'teleoperator':
        return teleoperateurs.map(user => ({
          id: user.id,
          label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`
        }));
      case 'confirmateur':
        return confirmateurs.map(user => ({
          id: user.id,
          label: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`
        }));
      case 'source':
        return sources.map(source => ({
          id: source.id,
          label: source.name
        }));
      default:
        return [];
    }
  };
  
  // Helper function to get contact value for Select filter matching
  const getContactValueForSelectFilter = (contact: any, columnId: string): string => {
    switch (columnId) {
      case 'status':
        return contact.statusId || '';
      case 'creator':
        return contact.creatorId || '';
      case 'teleoperator':
        return contact.teleoperatorId || '';
      case 'confirmateur':
        return contact.confirmateurId || '';
      case 'source':
        return contact.sourceId || '';
      default:
        return '';
    }
  };

  // Helper function to get cell value for filtering
  const getCellValue = (contact: any, columnId: string): string => {
    switch (columnId) {
      case 'id':
        return contact.id?.substring(0, 8) || '';
      case 'fullName':
        return (contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '').toLowerCase();
      case 'firstName':
        return (contact.firstName || '').toLowerCase();
      case 'lastName':
        return (contact.lastName || '').toLowerCase();
      case 'civility':
        return (contact.civility || '').toLowerCase();
      case 'phone':
        return (contact.phone || '').toLowerCase();
      case 'mobile':
        return (contact.mobile || '').toLowerCase();
      case 'email':
        return (contact.email || '').toLowerCase();
      case 'birthDate':
        return contact.birthDate ? new Date(contact.birthDate).toLocaleDateString('fr-FR') : '';
      case 'birthPlace':
        return (contact.birthPlace || '').toLowerCase();
      case 'address':
        return (contact.address || '').toLowerCase();
      case 'addressComplement':
        return (contact.addressComplement || '').toLowerCase();
      case 'postalCode':
        return (contact.postalCode || '').toLowerCase();
      case 'city':
        return (contact.city || '').toLowerCase();
      case 'nationality':
        return (contact.nationality || '').toLowerCase();
      case 'campaign':
        return (contact.campaign || '').toLowerCase();
      case 'createdAt':
        return contact.createdAt ? new Date(contact.createdAt).toLocaleString('fr-FR') : '';
      case 'updatedAt':
        return contact.updatedAt ? new Date(contact.updatedAt).toLocaleString('fr-FR') : '';
      case 'teleoperator':
        return (contact.managerName || contact.teleoperatorName || '').toLowerCase();
      case 'source':
        return (contact.source || contact.source?.name || '').toLowerCase();
      case 'status':
        return (contact.statusName || contact.status?.name || '').toLowerCase();
      case 'confirmateur':
        return (contact.confirmateurName || '').toLowerCase();
      case 'creator':
        return (contact.creatorName || '').toLowerCase();
      case 'managerTeam':
        return (contact.managerTeamName || contact.managerTeam?.name || '').toLowerCase();
      default:
        return '';
    }
  };

  // Helper function to get status type for a contact
  const getContactStatusType = (contact: any): string | null => {
    if (!contact.statusId) return null;
    const status = statuses.find(s => s.id === contact.statusId);
    return status?.type || null;
  };

  const filteredContacts = contacts.filter(contact => {
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeam = selectedTeam === 'all'; // Team field removed from Contact model
    
    // Apply status type filter
    const matchesStatusType = statusTypeFilter === 'all' 
      ? true 
      : (() => {
          const statusType = getContactStatusType(contact);
          return statusType === statusTypeFilter;
        })();
    
    // Apply column filters
    const matchesColumnFilters = getOrderedVisibleColumns().every(columnId => {
      const filterValue = columnFilters[columnId];
      if (!filterValue) return true; // No filter for this column
      
      // For Select filters (status, creator, teleoperator, confirmateur, source), match by ID
      if (shouldUseSelectFilter(columnId)) {
        const contactValue = getContactValueForSelectFilter(contact, columnId);
        return contactValue === filterValue;
      }
      
      // For text filters, match by text content
      const cellValue = getCellValue(contact, columnId);
      return cellValue.includes(filterValue.toLowerCase());
    });
    
    return matchesSearch && matchesTeam && matchesStatusType && matchesColumnFilters;
  });

  // Calculate pagination
  const totalPages = itemsPerPage === -1 
    ? 1 
    : Math.ceil(filteredContacts.length / itemsPerPage);
  
  // Reset to page 1 if current page is out of bounds or when filters change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);
  
  // Reset to page 1 when search term, team filter, status type filter, or column filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTeam, statusTypeFilter, columnFilters]);
  
  // Calculate displayed contacts based on pagination
  const displayedContacts = itemsPerPage === -1 
    ? filteredContacts 
    : filteredContacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
  
  // Get column label by id
  const getColumnLabel = (columnId: string) => {
    const column = allColumns.find(col => col.id === columnId);
    return column?.label || columnId;
  };
  
  // Helper function to render cell content based on column id
  const renderCell = (contact: any, columnId: string) => {
    switch (columnId) {
      case 'id':
        return <td key={columnId} className="contacts-table-id">{contact.id.substring(0, 8)}</td>;
      case 'fullName':
        return (
          <td key={columnId}>
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
        );
      case 'firstName':
        return <td key={columnId}>{contact.firstName || '-'}</td>;
      case 'lastName':
        return <td key={columnId}>{contact.lastName || '-'}</td>;
      case 'civility':
        return <td key={columnId}>{contact.civility || '-'}</td>;
      case 'phone':
        return <td key={columnId}>{contact.phone || '-'}</td>;
      case 'mobile':
        return <td key={columnId}>{contact.mobile || '-'}</td>;
      case 'email':
        return <td key={columnId} className="contacts-table-email">{contact.email || '-'}</td>;
      case 'birthDate':
        return (
          <td key={columnId}>
            {contact.birthDate 
              ? new Date(contact.birthDate).toLocaleDateString('fr-FR')
              : '-'
            }
          </td>
        );
      case 'birthPlace':
        return <td key={columnId}>{contact.birthPlace || '-'}</td>;
      case 'address':
        return <td key={columnId}>{contact.address || '-'}</td>;
      case 'addressComplement':
        return <td key={columnId}>{contact.addressComplement || '-'}</td>;
      case 'postalCode':
        return <td key={columnId}>{contact.postalCode || '-'}</td>;
      case 'city':
        return <td key={columnId}>{contact.city || '-'}</td>;
      case 'nationality':
        return <td key={columnId}>{contact.nationality || '-'}</td>;
      case 'campaign':
        return <td key={columnId}>{contact.campaign || '-'}</td>;
      case 'createdAt':
        return (
          <td key={columnId}>
            {contact.createdAt 
              ? new Date(contact.createdAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })
              : '-'
            }
          </td>
        );
      case 'updatedAt':
        return (
          <td key={columnId}>
            {contact.updatedAt 
              ? new Date(contact.updatedAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })
              : '-'
            }
          </td>
        );
      case 'teleoperator':
        return (
          <td key={columnId}>
            {canEdit ? (
              <button
                onClick={() => handleOpenTeleoperatorModal(contact)}
                className="contacts-clickable-cell"
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                {contact.managerName || contact.teleoperatorName || '-'}
              </button>
            ) : (
              <span>{contact.managerName || contact.teleoperatorName || '-'}</span>
            )}
          </td>
        );
      case 'source':
        return <td key={columnId}>{contact.source || '-'}</td>;
      case 'status':
        return (
          <td key={columnId}>
            {canEdit ? (
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
            ) : (
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
            )}
          </td>
        );
      case 'confirmateur':
        return (
          <td key={columnId}>
            {canEdit ? (
              <button
                onClick={() => handleOpenConfirmateurModal(contact)}
                className="contacts-clickable-cell"
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                {contact.confirmateurName || '-'}
              </button>
            ) : (
              <span>{contact.confirmateurName || '-'}</span>
            )}
          </td>
        );
      case 'creator':
        return <td key={columnId}>{contact.creatorName || '-'}</td>;
      case 'managerTeam':
        return <td key={columnId}>{contact.managerTeamName || '-'}</td>;
      default:
        return <td key={columnId}>-</td>;
    }
  };

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
    if (!canEdit) return;
    setSelectedContact(contact);
    setSelectedStatusId(contact.statusId || '');
    setIsStatusModalOpen(true);
  }

  function handleOpenTeleoperatorModal(contact: any) {
    if (!canEdit) return;
    setSelectedContact(contact);
    // Prefill with current teleoperator ID if exists
    const teleoperatorId = contact.teleoperatorId || contact.managerId || '';
    setSelectedTeleoperatorId(teleoperatorId);
    setIsTeleoperatorModalOpen(true);
  }

  function handleOpenConfirmateurModal(contact: any) {
    if (!canEdit) return;
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
          {canCreate && (
            <>
              <Button variant="outline" onClick={() => navigate('/contacts/import')}>
                <Upload className="w-4 h-4 mr-2" />
                Importer CSV
              </Button>
              <Button onClick={() => navigate('/contacts/add')}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un contact
              </Button>
            </>
          )}
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
              <Label>Type de statut</Label>
              <Select value={statusTypeFilter} onValueChange={(value) => setStatusTypeFilter(value as 'all' | 'lead' | 'client')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="contacts-filter-section">
              <Label>Affichage par</Label>
              <Select 
                value={itemsPerPage === -1 ? "all" : itemsPerPage.toString()} 
                onValueChange={(value) => {
                  if (value === "all") {
                    setItemsPerPage(-1);
                  } else {
                    const numValue = Number(value);
                    setItemsPerPage(numValue);
                    setCurrentPage(1); // Reset to first page when changing items per page
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {itemsPerPage === -1 ? "Tous" : `${itemsPerPage}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="all">Tous</SelectItem>
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
                {canEdit && (
                  <>
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
                  </>
                )}

                {canDelete && (
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <CardTitle>
              Liste des contacts ({filteredContacts.length})
              {itemsPerPage !== -1 && totalPages > 1 && ` - Page ${currentPage} sur ${totalPages}`}
            </CardTitle>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.keys(columnFilters).length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setColumnFilters({})}
                  title="Réinitialiser les filtres"
                >
                  <X className="w-4 h-4 mr-2" />
                  Réinitialiser filtres ({Object.keys(columnFilters).length})
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsColumnSettingsOpen(true)}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Colonnes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="contacts-loading">
              <LoadingIndicator />
              <p className="contacts-loading-text">Chargement des contacts...</p>
            </div>
          ) : filteredContacts.length > 0 ? (
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
                    {getOrderedVisibleColumns().map((columnId) => (
                      <th key={columnId} style={{ position: 'relative' }}>
                        <Popover 
                          open={openFilterColumn === columnId}
                          onOpenChange={(open) => setOpenFilterColumn(open ? columnId : null)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                width: '100%',
                                textAlign: 'left',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                color: '#64748b'
                              }}
                              className="contacts-column-header-button"
                            >
                              <span>{getColumnLabel(columnId)}</span>
                              {columnFilters[columnId] && (
                                <Filter className="w-3 h-3" style={{ color: '#3b82f6' }} />
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-80 p-4" 
                            align="start"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Label className="text-sm font-semibold">
                                  Filtrer par {getColumnLabel(columnId)}
                                </Label>
                                {columnFilters[columnId] && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setColumnFilters(prev => {
                                        const newFilters = { ...prev };
                                        delete newFilters[columnId];
                                        return newFilters;
                                      });
                                    }}
                                    className="h-6 px-2"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                              {shouldUseSelectFilter(columnId) ? (
                                <>
                                  <Select
                                    value={columnFilters[columnId] || ''}
                                    onValueChange={(value) => {
                                      setColumnFilters(prev => ({
                                        ...prev,
                                        [columnId]: value === 'all' ? '' : value
                                      }));
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={`Sélectionner ${getColumnLabel(columnId).toLowerCase()}...`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">Tous</SelectItem>
                                      {getFilterOptions(columnId).map(option => (
                                        <SelectItem key={option.id} value={option.id}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {columnFilters[columnId] && (
                                    <p className="text-xs text-slate-500">
                                      {filteredContacts.length} contact(s) correspondant
                                    </p>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Input
                                    type="text"
                                    placeholder={`Rechercher dans ${getColumnLabel(columnId).toLowerCase()}...`}
                                    value={columnFilters[columnId] || ''}
                                    onChange={(e) => {
                                      setColumnFilters(prev => ({
                                        ...prev,
                                        [columnId]: e.target.value
                                      }));
                                    }}
                                    autoFocus
                                  />
                                  {columnFilters[columnId] && (
                                    <p className="text-xs text-slate-500">
                                      {filteredContacts.length} contact(s) correspondant
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </th>
                    ))}
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
                      {getOrderedVisibleColumns().map((columnId) => renderCell(contact, columnId))}
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
                              {canDelete && (
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteContact(contact.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              )}
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
          
          {/* Pagination Controls */}
          {itemsPerPage !== -1 && totalPages > 1 && filteredContacts.length > 0 && (
            <div className="contacts-pagination">
              <div className="contacts-pagination-info">
                <span>
                  Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, filteredContacts.length)} sur {filteredContacts.length} contact(s)
                </span>
              </div>
              <div className="contacts-pagination-controls">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Précédent
                </Button>
                
                <div className="contacts-pagination-pages">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="contacts-pagination-page-btn"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Suivant
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
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
                {canEdit && (
                  <Button type="button" onClick={handleUpdateStatus}>
                    Enregistrer
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Column Settings Modal */}
      {isColumnSettingsOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsColumnSettingsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'stretch'
          }}
        >
          <div 
            className="column-settings-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '400px',
              maxWidth: '90vw',
              height: '100vh',
              backgroundColor: 'white',
              boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideInFromRight 0.3s ease-out',
              zIndex: 60
            }}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, marginBottom: '4px' }}>
                  Configurer les colonnes
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                  Sélectionnez les colonnes à afficher dans le tableau des contacts
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsColumnSettingsOpen(false)}
                style={{ flexShrink: 0 }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px'
            }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Label className="text-sm font-medium">Colonnes disponibles</Label>
                <Button variant="outline" size="sm" onClick={handleResetColumns}>
                  Réinitialiser
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {columnOrder.map((columnId) => {
                  const column = allColumns.find(col => col.id === columnId);
                  if (!column) return null;
                  
                  return (
                    <div
                      key={column.id}
                      draggable
                      onDragStart={() => handleDragStart(column.id)}
                      onDragOver={(e) => handleDragOver(e, column.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, column.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        borderRadius: '4px',
                        cursor: 'move',
                        backgroundColor: draggedColumnId === column.id ? '#f3f4f6' : 'transparent',
                        transition: 'background-color 0.2s',
                        border: draggedColumnId === column.id ? '1px dashed #3b82f6' : '1px solid transparent'
                      }}
                      className="column-drag-item"
                    >
                      <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <Checkbox
                        id={column.id}
                        checked={visibleColumns.includes(column.id)}
                        onCheckedChange={() => handleToggleColumn(column.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Label
                        htmlFor={column.id}
                        className="text-sm font-normal cursor-pointer flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {column.label}
                      </Label>
                    </div>
                  );
                })}
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
                {canEdit && (
                  <Button type="button" onClick={handleUpdateTeleoperator}>
                    Enregistrer
                  </Button>
                )}
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
                {canEdit && (
                  <Button type="button" onClick={handleUpdateConfirmateur}>
                    Enregistrer
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contacts;
