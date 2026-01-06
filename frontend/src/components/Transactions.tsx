import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';
import { DateInput } from './ui/date-input';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { Search, Plus, Edit, Trash2, ArrowUpDown, X, CreditCard } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useHasPermission } from '../hooks/usePermissions';
import { handleModalOverlayClick } from '../utils/modal';
import '../styles/Modal.css';

interface Transaction {
  id: string;
  contactId: string | null;
  contactName: string | null;
  type: 'Retrait' | 'Depot' | 'Ouverture';
  status: 'pending' | 'completed' | 'cancelled' | 'failed' | 'to_verify';
  payment_type: 'carte' | 'virement' | '';
  ribId: string | null;
  ribText: string | null;
  amount: number;
  date: string;
  comment: string;
  createdBy: string;
  created_at: string;
  updated_at: string;
}

export function Transactions() {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const canCreate = useHasPermission('transactions', 'create');
  const canEdit = useHasPermission('transactions', 'edit');
  const canDelete = useHasPermission('transactions', 'delete');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isRibModalOpen, setIsRibModalOpen] = useState(false);
  const [ribs, setRibs] = useState<any[]>([]);
  const [newRibText, setNewRibText] = useState('');
  
  const [formData, setFormData] = useState({
    contactId: '',
    type: 'Depot' as 'Retrait' | 'Depot' | 'Ouverture',
    status: 'pending' as 'pending' | 'completed' | 'cancelled' | 'failed' | 'to_verify',
    payment_type: '' as 'carte' | 'virement' | '',
    ribId: '' as string,
    amount: '',
    date: '',
    hour: new Date().getHours().toString().padStart(2, '0'),
    minute: new Date().getMinutes().toString().padStart(2, '0'),
    comment: '',
  });

  const [contacts, setContacts] = useState<any[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchFocused, setContactSearchFocused] = useState(false);
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const [contactSearchResults, setContactSearchResults] = useState<any[]>([]);
  const [editContactSearchQuery, setEditContactSearchQuery] = useState('');
  const [editContactSearchFocused, setEditContactSearchFocused] = useState(false);
  const [editContactSearchLoading, setEditContactSearchLoading] = useState(false);
  const [editContactSearchResults, setEditContactSearchResults] = useState<any[]>([]);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/transactions/');
      const transactionsList = data.transactions || data || [];
      setTransactions(transactionsList);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      toast.error('Erreur lors du chargement des transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  // Search contacts on-demand when user types
  const searchContacts = useCallback(async (query: string, isEdit: boolean = false) => {
    if (!query || query.trim().length < 2) {
      if (isEdit) {
        setEditContactSearchResults([]);
      } else {
        setContactSearchResults([]);
      }
      return;
    }

    if (isEdit) {
      setEditContactSearchLoading(true);
    } else {
      setContactSearchLoading(true);
    }

    try {
      const response = await apiCall(`/api/contacts/?search=${encodeURIComponent(query.trim())}&page_size=50`);
      const searchResults = response?.contacts || response || [];
      
      if (isEdit) {
        setEditContactSearchResults(searchResults);
        // Add to contacts cache
        setContacts(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newContacts = searchResults.filter((c: any) => !existingIds.has(c.id));
          return [...prev, ...newContacts];
        });
      } else {
        setContactSearchResults(searchResults);
        // Add to contacts cache
        setContacts(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newContacts = searchResults.filter((c: any) => !existingIds.has(c.id));
          return [...prev, ...newContacts];
        });
      }
    } catch (error: any) {
      console.error('Error searching contacts:', error);
      if (isEdit) {
        setEditContactSearchResults([]);
      } else {
        setContactSearchResults([]);
      }
    } finally {
      if (isEdit) {
        setEditContactSearchLoading(false);
      } else {
        setContactSearchLoading(false);
      }
    }
  }, []);

  // Debounced search function
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchContacts(contactSearchQuery, false);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [contactSearchQuery, searchContacts]);

  useEffect(() => {
    if (editSearchTimeoutRef.current) {
      clearTimeout(editSearchTimeoutRef.current);
    }
    editSearchTimeoutRef.current = setTimeout(() => {
      searchContacts(editContactSearchQuery, true);
    }, 300);
    return () => {
      if (editSearchTimeoutRef.current) {
        clearTimeout(editSearchTimeoutRef.current);
      }
    };
  }, [editContactSearchQuery, searchContacts]);

  // Get selected contact name
  const getSelectedContactName = useCallback((contactId: string | null): string => {
    if (!contactId) return '';
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      const name = `${contact.fname || ''} ${contact.lname || ''}`.trim();
      return name || contact.email || contactId;
    }
    return contactId;
  }, [contacts]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Load RIBs
  const loadRibs = useCallback(async () => {
    try {
      const data = await apiCall('/api/ribs/');
      const ribsList = data.ribs || data || [];
      setRibs(ribsList);
    } catch (error: any) {
      console.error('Error loading RIBs:', error);
      toast.error('Erreur lors du chargement des RIBs');
    }
  }, []);

  // Load RIBs when modal opens
  useEffect(() => {
    if (isRibModalOpen) {
      loadRibs();
    }
  }, [isRibModalOpen, loadRibs]);

  // Load RIBs when create modal opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      loadRibs();
    }
  }, [isCreateDialogOpen, loadRibs]);

  // Handle RIB creation
  const handleCreateRib = async () => {
    if (!newRibText.trim()) {
      toast.error('Veuillez saisir un RIB');
      return;
    }

    try {
      await apiCall('/api/ribs/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rib_text: newRibText.trim(),
        }),
      });
      
      toast.success('RIB ajouté avec succès');
      setNewRibText('');
      loadRibs();
    } catch (error: any) {
      console.error('Error creating RIB:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout du RIB');
    }
  };

  // Handle RIB deletion
  const handleDeleteRib = async (ribId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce RIB ?')) {
      return;
    }

    try {
      await apiCall(`/api/ribs/${ribId}/`, {
        method: 'DELETE',
      });
      
      toast.success('RIB supprimé avec succès');
      loadRibs();
    } catch (error: any) {
      console.error('Error deleting RIB:', error);
      toast.error(error.message || 'Erreur lors de la suppression du RIB');
    }
  };

  // Filter and sort transactions
  const filteredAndSortedTransactions = React.useMemo(() => {
    let filtered = transactions.filter((transaction) => {
      // Search filter
      const matchesSearch = 
        !searchTerm ||
        transaction.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.comment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Type filter
      const matchesType = filterType === 'all' || transaction.type === filterType;
      
      // Status filter
      const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
      
      return matchesSearch && matchesType && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortBy === 'type') {
        comparison = a.type.localeCompare(b.type);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, searchTerm, filterType, filterStatus, sortBy, sortOrder]);

  const handleCreate = async () => {
    if (!formData.contactId || !formData.amount || !formData.date) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Combine date (YYYY-MM-DD) with hour and minute to create ISO datetime string
    const dateTime = `${formData.date}T${formData.hour}:${formData.minute}:00`;

    try {
      await apiCall('/api/transactions/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: formData.contactId,
          type: formData.type,
          status: formData.status,
          payment_type: formData.payment_type,
          ribId: formData.ribId || null,
          amount: parseFloat(formData.amount),
          date: dateTime,
          comment: formData.comment,
        }),
      });
      
      toast.success('Transaction créée avec succès');
      setIsCreateDialogOpen(false);
      const now = new Date();
      setFormData({
        contactId: '',
        type: 'Depot',
        status: 'pending',
        payment_type: '',
        ribId: '',
        amount: '',
        date: '',
        hour: now.getHours().toString().padStart(2, '0'),
        minute: now.getMinutes().toString().padStart(2, '0'),
        comment: '',
      });
      setContactSearchQuery('');
      setContactSearchFocused(false);
      loadTransactions();
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      toast.error(error.message || 'Erreur lors de la création de la transaction');
    }
  };

  const handleEdit = async (transaction: Transaction) => {
    setEditingTransaction(transaction);
    // Parse the datetime string to extract date, hour, and minute
    const dateObj = new Date(transaction.date);
    const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
    const hour = dateObj.getHours().toString().padStart(2, '0');
    const minute = dateObj.getMinutes().toString().padStart(2, '0');
    
    setFormData({
      contactId: transaction.contactId || '',
      type: transaction.type,
      status: transaction.status,
      payment_type: transaction.payment_type || '',
      ribId: transaction.ribId || '',
      amount: transaction.amount.toString(),
      date: dateStr,
      hour: hour,
      minute: minute,
      comment: transaction.comment || '',
    });
    
    // Set the contact search query to show the current contact name
    if (transaction.contactId) {
      // Try to get from cache first
      const cachedContact = contacts.find(c => c.id === transaction.contactId);
      if (cachedContact) {
        setEditContactSearchQuery(`${cachedContact.fname} ${cachedContact.lname}`);
      } else if (transaction.contactName) {
        setEditContactSearchQuery(transaction.contactName);
      } else {
        // Load the contact if not in cache
        try {
          const contactData = await apiCall(`/api/contacts/${transaction.contactId}/`);
          const contact = contactData?.contact || contactData;
          if (contact) {
            setEditContactSearchQuery(`${contact.fname} ${contact.lname}`);
            setContacts(prev => {
              const exists = prev.find(c => c.id === contact.id);
              if (!exists) {
                return [...prev, contact];
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('Error loading contact:', error);
          setEditContactSearchQuery(transaction.contactId);
        }
      }
    } else {
      setEditContactSearchQuery('');
    }
    
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTransaction || !formData.contactId || !formData.amount || !formData.date) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Combine date (YYYY-MM-DD) with hour and minute to create ISO datetime string
    const dateTime = `${formData.date}T${formData.hour}:${formData.minute}:00`;

    try {
      await apiCall(`/api/transactions/${editingTransaction.id}/update/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: formData.contactId,
          type: formData.type,
          status: formData.status,
          payment_type: formData.payment_type,
          ribId: formData.ribId || null,
          amount: parseFloat(formData.amount),
          date: dateTime,
          comment: formData.comment,
        }),
      });
      
      toast.success('Transaction mise à jour avec succès');
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      setEditContactSearchQuery('');
      setEditContactSearchFocused(false);
      loadTransactions();
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour de la transaction');
    }
  };

  const handleDelete = async (transactionId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
      return;
    }

    try {
      await apiCall(`/api/transactions/${transactionId}/`, {
        method: 'DELETE',
      });
      
      toast.success('Transaction supprimée avec succès');
      loadTransactions();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error(error.message || 'Erreur lors de la suppression de la transaction');
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'En attente',
      completed: 'Terminé',
      cancelled: 'Annulé',
      failed: 'Échoué',
      to_verify: 'A vérifier',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
      to_verify: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">Historique de toutes les transactions</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsRibModalOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Gérer les RIBs
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle transaction
            </Button>
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par contact, commentaire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="Depot">Dépôt</SelectItem>
            <SelectItem value="Retrait">Retrait</SelectItem>
            <SelectItem value="Ouverture">Ouverture</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="completed">Terminé</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
            <SelectItem value="failed">Échoué</SelectItem>
            <SelectItem value="to_verify">A vérifier</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="amount">Montant</SelectItem>
            <SelectItem value="type">Type</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : filteredAndSortedTransactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucune transaction trouvée
        </div>
      ) : (
        <div className="border rounded-none overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Contact</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Mode de paiement</th>
                <th className="px-4 py-3 text-left text-sm font-medium">RIB</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Montant</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Statut</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Commentaire</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Créé par</th>
                {(canEdit || canDelete) && (
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">{formatDate(transaction.date)}</td>
                  <td className="px-4 py-3 text-sm">
                    {transaction.contactName || (
                      <span className="text-muted-foreground cursor-pointer hover:underline" onClick={() => transaction.contactId && navigate(`/contacts/${transaction.contactId}`)}>
                        {transaction.contactId || 'N/A'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      transaction.type === 'Depot' 
                        ? 'bg-blue-100 text-blue-800' 
                        : transaction.type === 'Ouverture'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {transaction.payment_type === 'carte' ? 'Carte' : transaction.payment_type === 'virement' ? 'Virement' : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {transaction.ribText || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{formatAmount(transaction.amount)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(transaction.status)}`}>
                      {getStatusLabel(transaction.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                    {transaction.comment || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{transaction.createdBy || '-'}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(transaction)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(transaction.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {isCreateDialogOpen && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsCreateDialogOpen(false);
          const now = new Date();
          setFormData({
            contactId: '',
            type: 'Depot',
            status: 'pending',
            payment_type: '',
            ribId: '',
            amount: '',
            date: '',
            hour: now.getHours().toString().padStart(2, '0'),
            minute: now.getMinutes().toString().padStart(2, '0'),
            comment: '',
          });
          setContactSearchQuery('');
          setContactSearchFocused(false);
        })}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nouvelle transaction</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  const now = new Date();
                  setFormData({
                    contactId: '',
                    type: 'Depot',
                    status: 'pending',
                    payment_type: '',
                    ribId: '',
                    amount: '',
                    date: '',
                    hour: now.getHours().toString().padStart(2, '0'),
                    minute: now.getMinutes().toString().padStart(2, '0'),
                    comment: '',
                  });
                  setContactSearchQuery('');
                  setContactSearchFocused(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="modal-form">
              <div className="modal-form-field">
                <Label>Contact <span style={{ color: 'red' }}>*</span></Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      value={contactSearchQuery}
                      onChange={(e) => {
                        setContactSearchQuery(e.target.value);
                        setContactSearchFocused(true);
                      }}
                      onFocus={() => setContactSearchFocused(true)}
                      onBlur={() => setTimeout(() => setContactSearchFocused(false), 200)}
                      className="pl-10"
                      autoComplete="off"
                      required
                    />
                  </div>
                  {contactSearchFocused && contactSearchQuery && (
                    <div className="absolute z-[99999] w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {contactSearchLoading ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Recherche...
                        </div>
                      ) : contactSearchResults.length > 0 ? (
                        <div className="p-1">
                          {contactSearchResults.map((contact) => (
                            <div
                              key={contact.id}
                              className="px-3 py-2 cursor-pointer hover:bg-accent rounded-sm text-sm"
                              onClick={() => {
                                setFormData({ ...formData, contactId: contact.id });
                                setContactSearchQuery(`${contact.fname} ${contact.lname}`);
                                setContactSearchFocused(false);
                                // Ensure contact is in cache
                                setContacts(prev => {
                                  const exists = prev.find(c => c.id === contact.id);
                                  if (!exists) {
                                    return [...prev, contact];
                                  }
                                  return prev;
                                });
                              }}
                            >
                              {contact.fname} {contact.lname}
                              {contact.email && <span className="text-muted-foreground ml-2">({contact.email})</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Aucun contact trouvé
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {formData.contactId && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Contact sélectionné : {getSelectedContactName(formData.contactId)}
                  </div>
                )}
                {!formData.contactId && (
                  <div className="mt-1 text-sm text-red-500">
                    Veuillez sélectionner un contact
                  </div>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="modal-form-field">
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as 'Retrait' | 'Depot' | 'Ouverture' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Depot">Dépôt</SelectItem>
                      <SelectItem value="Retrait">Retrait</SelectItem>
                      <SelectItem value="Ouverture">Ouverture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="modal-form-field">
                  <Label htmlFor="status">Statut *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                      <SelectItem value="failed">Échoué</SelectItem>
                      <SelectItem value="to_verify">A vérifier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="payment_type">Mode de paiement</Label>
                <Select
                  value={formData.payment_type || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, payment_type: value === 'none' ? '' : value as 'carte' | 'virement' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un mode de paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="carte">Carte</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="rib">RIB</Label>
                <Select
                  value={formData.ribId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, ribId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un RIB" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {ribs.map((rib) => (
                      <SelectItem key={rib.id} value={rib.id}>
                        {rib.rib_text || `RIB ${rib.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="amount">Montant *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="modal-form-field">
                <Label>Date *</Label>
                <DateInput
                  value={formData.date}
                  onChange={(value) => setFormData({ ...formData, date: value })}
                  required
                />
              </div>
              
              <div className="modal-form-field">
                <Label>Heure</Label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Select
                    value={formData.hour}
                    onValueChange={(value) => setFormData({ ...formData, hour: value })}
                  >
                    <SelectTrigger style={{ flex: 1 }}>
                      <SelectValue placeholder="Heure" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={hour} value={hour}>
                            {hour}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>:</span>
                  <Select
                    value={formData.minute}
                    onValueChange={(value) => setFormData({ ...formData, minute: value })}
                  >
                    <SelectTrigger style={{ flex: 1 }}>
                      <SelectValue placeholder="Minute" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 60 }, (_, i) => {
                        const minute = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={minute} value={minute}>
                            {minute}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="comment">Commentaire</Label>
                <Textarea
                  id="comment"
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  placeholder="Commentaire optionnel..."
                  rows={3}
                />
              </div>

              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    const now = new Date();
                    setFormData({
                      contactId: '',
                      type: 'Depot',
                      status: 'pending',
                      payment_type: '',
                      ribId: '',
                      amount: '',
                      date: '',
                      hour: now.getHours().toString().padStart(2, '0'),
                      minute: now.getMinutes().toString().padStart(2, '0'),
                      comment: '',
                    });
                    setContactSearchQuery('');
                    setContactSearchFocused(false);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  Créer
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {isEditDialogOpen && editingTransaction && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsEditDialogOpen(false);
          setEditingTransaction(null);
          setEditContactSearchQuery('');
          setEditContactSearchFocused(false);
        })}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier la transaction</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingTransaction(null);
                  setEditContactSearchQuery('');
                  setEditContactSearchFocused(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }} className="modal-form">
              <div className="modal-form-field">
                <Label>Contact <span style={{ color: 'red' }}>*</span></Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      value={editContactSearchQuery}
                      onChange={(e) => {
                        setEditContactSearchQuery(e.target.value);
                        setEditContactSearchFocused(true);
                      }}
                      onFocus={() => setEditContactSearchFocused(true)}
                      onBlur={() => setTimeout(() => setEditContactSearchFocused(false), 200)}
                      className="pl-10"
                      autoComplete="off"
                      required
                    />
                  </div>
                  {editContactSearchFocused && editContactSearchQuery && (
                    <div className="absolute z-[99999] w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {editContactSearchLoading ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Recherche...
                        </div>
                      ) : editContactSearchResults.length > 0 ? (
                        <div className="p-1">
                          {editContactSearchResults.map((contact) => (
                            <div
                              key={contact.id}
                              className="px-3 py-2 cursor-pointer hover:bg-accent rounded-sm text-sm"
                              onClick={() => {
                                setFormData({ ...formData, contactId: contact.id });
                                setEditContactSearchQuery(`${contact.fname} ${contact.lname}`);
                                setEditContactSearchFocused(false);
                                // Ensure contact is in cache
                                setContacts(prev => {
                                  const exists = prev.find(c => c.id === contact.id);
                                  if (!exists) {
                                    return [...prev, contact];
                                  }
                                  return prev;
                                });
                              }}
                            >
                              {contact.fname} {contact.lname}
                              {contact.email && <span className="text-muted-foreground ml-2">({contact.email})</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Aucun contact trouvé
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {formData.contactId && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Contact sélectionné : {getSelectedContactName(formData.contactId)}
                  </div>
                )}
                {!formData.contactId && (
                  <div className="mt-1 text-sm text-red-500">
                    Veuillez sélectionner un contact
                  </div>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="modal-form-field">
                  <Label htmlFor="edit-type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as 'Retrait' | 'Depot' | 'Ouverture' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Depot">Dépôt</SelectItem>
                      <SelectItem value="Retrait">Retrait</SelectItem>
                      <SelectItem value="Ouverture">Ouverture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="modal-form-field">
                  <Label htmlFor="edit-status">Statut *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                      <SelectItem value="failed">Échoué</SelectItem>
                      <SelectItem value="to_verify">A vérifier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="edit-payment_type">Mode de paiement</Label>
                <Select
                  value={formData.payment_type || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, payment_type: value === 'none' ? '' : value as 'carte' | 'virement' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un mode de paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="carte">Carte</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="edit-rib">RIB</Label>
                <Select
                  value={formData.ribId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, ribId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un RIB" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {ribs.map((rib) => (
                      <SelectItem key={rib.id} value={rib.id}>
                        {rib.rib_text || `RIB ${rib.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="edit-amount">Montant *</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="modal-form-field">
                <Label>Date *</Label>
                <DateInput
                  value={formData.date}
                  onChange={(value) => setFormData({ ...formData, date: value })}
                  required
                />
              </div>
              
              <div className="modal-form-field">
                <Label>Heure</Label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Select
                    value={formData.hour}
                    onValueChange={(value) => setFormData({ ...formData, hour: value })}
                  >
                    <SelectTrigger style={{ flex: 1 }}>
                      <SelectValue placeholder="Heure" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={hour} value={hour}>
                            {hour}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>:</span>
                  <Select
                    value={formData.minute}
                    onValueChange={(value) => setFormData({ ...formData, minute: value })}
                  >
                    <SelectTrigger style={{ flex: 1 }}>
                      <SelectValue placeholder="Minute" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 60 }, (_, i) => {
                        const minute = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={minute} value={minute}>
                            {minute}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="modal-form-field">
                <Label htmlFor="edit-comment">Commentaire</Label>
                <Textarea
                  id="edit-comment"
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  placeholder="Commentaire optionnel..."
                  rows={3}
                />
              </div>

              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingTransaction(null);
                    setEditContactSearchQuery('');
                    setEditContactSearchFocused(false);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* RIB Management Modal */}
      {isRibModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsRibModalOpen(false);
          setNewRibText('');
        })}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Gérer les RIBs</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsRibModalOpen(false);
                  setNewRibText('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="new-rib">Ajouter un RIB</Label>
                <Input
                  id="new-rib"
                  type="text"
                  value={newRibText}
                  onChange={(e) => setNewRibText(e.target.value)}
                  placeholder="Saisissez les informations du RIB..."
                  maxLength={50}
                />
              </div>
              <div className="modal-form-actions" style={{ justifyContent: 'flex-start', marginBottom: '1.5rem' }}>
                <Button type="button" onClick={handleCreateRib}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>

              <div className="modal-form-field">
                <Label>RIBs existants</Label>
                {ribs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun RIB enregistré
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {ribs.map((rib) => (
                      <div
                        key={rib.id}
                        className="flex items-start justify-between gap-4 hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="text-sm whitespace-pre-wrap break-words">{rib.rib_text || '-'}</div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Créé le {new Date(rib.created_at).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })} par {rib.createdBy || '-'}
                          </div>
                        </div>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRib(rib.id)}
                            className="flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsRibModalOpen(false);
                    setNewRibText('');
                  }}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

