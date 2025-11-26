import React, { useState, useEffect } from 'react';
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
import { X } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { formatPhoneNumber, formatPhoneNumberAsYouType, removePhoneSpaces } from '../utils/phoneNumber';
import { User } from '../types';
import { useTeams } from '../hooks/useTeams';
import { useRoles } from '../hooks/useRoles';
import LoadingIndicator from './LoadingIndicator';
import { Team } from '../types';
import '../styles/Modal.css';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUserUpdated: () => void;
}

export function EditUserModal({ isOpen, onClose, user, onUserUpdated }: EditUserModalProps) {
  const { teams = [] as Team[], loading: teamsLoading } = useTeams();
  const { roles = [], loading: rolesLoading, refetch: refetchRoles } = useRoles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    teamId: '',
  });

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: formatPhoneNumber(user.phone) || '',
        role: user.role ? String(user.role) : '',
        teamId: user.teamId ? String(user.teamId) : '',
      });
    }
  }, [user, isOpen]);
  
  // Ensure roles are loaded from the roles table when modal opens
  useEffect(() => {
    if (isOpen && refetchRoles) {
      // Force refresh roles when modal opens to ensure we have the latest roles from the table
      refetchRoles();
    }
  }, [isOpen, refetchRoles]);

  if (!isOpen || !user) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    
    setError('');
    setLoading(true);

    try {
      await apiCall(`/api/users/${user.id}/update/`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: removePhoneSpaces(String(formData.phone)),
          roleId: formData.role || null,
          teamId: formData.teamId || null,
        }),
      });

      toast.success('Utilisateur mis à jour avec succès');
      onClose();
      onUserUpdated();
    } catch (err: any) {
      console.error('Edit user error:', err);
      const data = err?.response?.data || {};
      const message =
        data.detail ||
        Object.values(data).flat().join(', ') ||
        'Une erreur est survenue lors de la mise à jour';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Modifier l'utilisateur</h2>
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
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-form-field">
            <Label htmlFor="edit-firstName">Prénom</Label>
            <Input
              id="edit-firstName"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              required
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="edit-lastName">Nom</Label>
            <Input
              id="edit-lastName"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              required
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              placeholder="email@example.com"
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="edit-phone">Téléphone</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: formatPhoneNumberAsYouType(e.target.value) })
              }
              placeholder="+33 6 12 34 56 78"
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="edit-role">Rôle</Label>
            <Select
              value={formData.role ? String(formData.role) : undefined}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value })
              }
              disabled={rolesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={rolesLoading ? "Chargement..." : "Sélectionner un rôle"} />
              </SelectTrigger>
              <SelectContent>
                {rolesLoading ? (
                  <div className="px-2 py-1.5 text-sm text-slate-500">
                    Chargement...
                  </div>
                ) : roles.length > 0 ? (
                  roles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {role.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-slate-500">
                    Aucun rôle disponible
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="modal-form-field">
            <Label htmlFor="edit-teamId">Équipe (optionnel)</Label>
            <Select
              value={formData.teamId ? String(formData.teamId) : "none"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  teamId: value === "none" ? "" : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Aucune équipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune équipe</SelectItem>
                {teams &&
                  teams.length > 0 &&
                  teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading && <LoadingIndicator />}

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
              {loading ? "Mise à jour..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
