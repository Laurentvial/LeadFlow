import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import { apiCall } from '../utils/api';
import { useUsers } from '../hooks/useUsers';
import { useUser } from '../contexts/UserContext';
import { toast } from 'sonner';
import { formatPhoneNumberAsYouType, removePhoneSpaces } from '../utils/phoneNumber';
import '../styles/PageHeader.css';
import '../styles/Modal.css';

interface Source {
  id: string;
  name: string;
}

export function AddContact() {
  const navigate = useNavigate();
  const { users, loading: usersLoading } = useUsers();
  const { currentUser } = useUser();
  const [loading, setLoading] = useState(false);
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
  const [formData, setFormData] = useState({
    // Informations générales
    statusId: '',
    civility: '',
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    phone: '',
    // Adresse
    address: '',
    addressComplement: '',
    postalCode: '',
    city: '',
    // Gestion
    sourceId: '',
    campaign: '',
    teleoperatorId: '',
    confirmateurId: '',
  });

  useEffect(() => {
    loadStatuses();
    loadSources();
  }, []);

  async function loadStatuses() {
    try {
      // Load all statuses (both lead and contact types)
      const data = await apiCall('/api/statuses/');
      const loadedStatuses = data.statuses || [];
      setStatuses(loadedStatuses);
      if (loadedStatuses.length === 0) {
        console.warn('No statuses found in database');
      }
    } catch (error) {
      console.error('Error loading statuses:', error);
      toast.error('Erreur lors du chargement des statuts');
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
      // Set the newly created source as selected
      setFormData({ ...formData, sourceId: response.id });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création de la source');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Validation
    if (!formData.statusId) {
      toast.error('Le statut est requis');
      setLoading(false);
      return;
    }
    if (!formData.firstName.trim()) {
      toast.error('Le prénom est requis');
      setLoading(false);
      return;
    }
    if (!formData.lastName.trim()) {
      toast.error('Le nom est requis');
      setLoading(false);
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Le téléphone 1 est requis');
      setLoading(false);
      return;
    }

    try {
        const payload = {
        statusId: formData.statusId,
          civility: formData.civility || '',
          firstName: formData.firstName,
          lastName: formData.lastName,
        email: formData.email || '',
        mobile: removePhoneSpaces(String(formData.mobile)),
          phone: removePhoneSpaces(String(formData.phone)),
          address: formData.address || '',
        addressComplement: formData.addressComplement || '',
          postalCode: formData.postalCode || '',
          city: formData.city || '',
        sourceId: formData.sourceId || '',
        campaign: formData.campaign || '',
        teleoperatorId: formData.teleoperatorId || '',
        confirmateurId: formData.confirmateurId || '',
      };

      await apiCall('/api/contacts/create/', {
          method: 'POST',
        body: JSON.stringify(payload),
        });

      toast.success('Contact créé avec succès');
      navigate('/contacts');
    } catch (error: any) {
      console.error('Error creating contact:', error);
      let errorMessage = 'Erreur lors de la création du contact';
      
      if (error.response) {
        if (error.response.error) {
          errorMessage = error.response.error;
        } else if (error.response.detail) {
          errorMessage = error.response.detail;
        } else if (error.response.message) {
          errorMessage = error.response.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/contacts')}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="page-title-section">
          <h1 className="page-title">Nouveau contact</h1>
          <p className="page-subtitle">Remplissez le formulaire pour créer un nouveau contact</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle>1. Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="statusId">Statut *</Label>
                <Select
                  value={formData.statusId}
                  onValueChange={(value) => {
                    if (value !== 'no-status-disabled') {
                      setFormData({ ...formData, statusId: value });
                    }
                  }}
                  required
                >
                  <SelectTrigger id="statusId">
                    {formData.statusId ? (() => {
                      const filteredStatuses = statuses.filter((status) => {
                        if (!status.id || status.id.trim() === '') return false;
                        const normalizedStatusId = String(status.id).trim();
                        return statusViewPermissions.has(normalizedStatusId);
                      });
                      const selectedStatus = filteredStatuses.find((s: any) => s.id === formData.statusId);
                      return selectedStatus ? (
                        <SelectValue asChild>
                          <span 
                            className="inline-block px-2 py-1 rounded text-sm"
                            style={{
                              backgroundColor: selectedStatus.color || '#e5e7eb',
                              color: selectedStatus.color ? '#000000' : '#374151'
                            }}
                          >
                            {selectedStatus.name}
                          </span>
                        </SelectValue>
                      ) : (
                        <SelectValue placeholder="Sélectionner un statut" />
                      );
                    })() : (
                      <SelectValue placeholder="Sélectionner un statut" />
                    )}
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
                {statuses.length === 0 && (
                  <p className="text-xs text-amber-600">
                    Aucun statut trouvé. Veuillez en créer un dans les paramètres.
                  </p>
                )}
            </div>

              <div className="space-y-2">
                <Label htmlFor="civility">Civilité</Label>
                <Select
                  value={formData.civility || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, civility: value === 'none' ? '' : value })}
                >
                  <SelectTrigger id="civility">
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
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  placeholder="Prénom du contact"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  placeholder="Nom du contact"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone 1 *</Label>
                <Input
                  id="phone"
                  type="number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: removePhoneSpaces(e.target.value) })}
                  required
                  placeholder="0123456789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">Telephone 2</Label>
                <Input
                  id="mobile"
                  type="number"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: removePhoneSpaces(e.target.value) })}
                  placeholder="0612345678"
                />
              </div>
              </div>
          </CardContent>
        </Card>

        {/* 2. Adresse */}
        <Card>
          <CardHeader>
            <CardTitle>2. Adresse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Adresse complète"
                />
              </div>

            <div className="space-y-2">
              <Label htmlFor="addressComplement">Complément d'adresse</Label>
              <Input
                id="addressComplement"
                value={formData.addressComplement}
                onChange={(e) => setFormData({ ...formData, addressComplement: e.target.value })}
                placeholder="Appartement, étage, etc."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="75001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Paris"
                />
              </div>

              <div className="space-y-2">
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Gestion */}
        <Card>
          <CardHeader>
            <CardTitle>3. Gestion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sourceId">Source</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={formData.sourceId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, sourceId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger id="sourceId" className="flex-1">
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
                  size="icon"
                  onClick={() => setIsSourceDialogOpen(true)}
                  title="Ajouter une nouvelle source"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign">Campagne</Label>
              <Input
                id="campaign"
                value={formData.campaign}
                onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                placeholder="Nom de la campagne"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teleoperatorId">Téléopérateur</Label>
                <Select
                  value={formData.teleoperatorId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, teleoperatorId: value === 'none' ? '' : value })}
                  onOpenChange={(open) => {
                    // Auto-fill with current user if they are a teleoperateur and field is empty
                    if (open && !formData.teleoperatorId && currentUser?.isTeleoperateur && currentUser?.id) {
                      setFormData({ ...formData, teleoperatorId: currentUser.id });
                    }
                  }}
                >
                  <SelectTrigger 
                    id="teleoperatorId"
                    onClick={() => {
                      // Auto-fill with current user if they are a teleoperateur and field is empty
                      if (!formData.teleoperatorId && currentUser?.isTeleoperateur && currentUser?.id) {
                        setFormData({ ...formData, teleoperatorId: currentUser.id });
                      }
                    }}
                  >
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

              <div className="space-y-2">
                <Label htmlFor="confirmateurId">Confirmateur</Label>
                <Select
                  value={formData.confirmateurId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, confirmateurId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger id="confirmateurId">
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
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/contacts')}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              'Création...'
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Créer le contact
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Modal for adding new source */}
      {isSourceDialogOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsSourceDialogOpen(false);
          setNewSourceName('');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Ajouter une nouvelle source</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsSourceDialogOpen(false);
                  setNewSourceName('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateSource();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="newSourceName">Nom de la source</Label>
                <Input
                  id="newSourceName"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="Ex: Site web, Référencement, etc."
                  required
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateSource();
                    }
                  }}
                />
              </div>
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsSourceDialogOpen(false);
                    setNewSourceName('');
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  <Plus className="planning-icon-md" style={{ marginRight: '4px' }} />
                  Créer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddContact;

