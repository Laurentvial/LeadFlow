import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { handleModalOverlayClick } from '../utils/modal';
import { useUsers } from '../hooks/useUsers';
import '../styles/Modal.css';

interface EditContactManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: any;
  onContactUpdated: () => void;
}

export function EditContactManagementModal({ 
  isOpen, 
  onClose, 
  contact, 
  onContactUpdated 
}: EditContactManagementModalProps) {
  const { users, loading: usersLoading } = useUsers();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    managerId: '',
    source: '',
  });

  useEffect(() => {
    if (isOpen && contact) {
      setFormData({
        managerId: contact.managerUserDetailsId || contact.managerId || 'none',  // Use UserDetails.id for Select component, 'none' if empty
        source: contact.source || '',
      });
      setError('');
    } else if (isOpen && !contact) {
      // Reset form if contact is not available
      setFormData({
        managerId: 'none',
        source: '',
      });
    }
  }, [contact, isOpen]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!contact || !contact.id) {
      setError('Contact non disponible');
      toast.error('Contact non disponible');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      await apiCall(`/api/contacts/${contact.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          managed_by: formData.managerId || null,
          source: formData.source || '',
        }),
      });

      toast.success('Informations de gestion mises à jour avec succès');
      onClose();
      onContactUpdated();
    } catch (err: any) {
      console.error('Edit contact management error:', err);
      const message = err?.message || 'Une erreur est survenue lors de la mise à jour';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, onClose)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Modifier la gestion</h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
          >
            <X className="planning-icon-md" />
          </button>
        </div>

        {!contact ? (
          <div className="p-4 text-center">
            <p>Chargement des données du contact...</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="modal-form">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="modal-form-field">
            <Label htmlFor="managerId">Gestionnaire</Label>
            <Select
              value={formData.managerId || 'none'}
              onValueChange={(value) => setFormData({ ...formData, managerId: value === 'none' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un gestionnaire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun gestionnaire</SelectItem>
                {usersLoading ? (
                  <SelectItem value="loading" disabled>Chargement...</SelectItem>
                ) : users.length === 0 ? (
                  <SelectItem value="empty" disabled>Aucun utilisateur disponible</SelectItem>
                ) : (
                  users.map((user) => {
                    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                    return (
                      <SelectItem key={user.id} value={user.id}>
                        {displayName} {user.email ? `(${user.email})` : ''}
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="modal-form-field">
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              placeholder="Source du contact"
            />
          </div>

          <div className="modal-form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}


