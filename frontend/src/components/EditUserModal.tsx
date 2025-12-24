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
import { X, Plus, Trash2 } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { formatPhoneNumber, formatPhoneNumberAsYouType, removePhoneSpaces } from '../utils/phoneNumber';
import { handleModalOverlayClick } from '../utils/modal';
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
    hrex: '',
    requireOtp: false,
    ipWhitelistEnabled: false,
    ipWhitelist: [] as string[],
  });
  const [newIp, setNewIp] = useState('');

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: formatPhoneNumber(user.phone) || '',
        role: user.role ? String(user.role) : '',
        teamId: user.teamId ? String(user.teamId) : '',
        hrex: user.hrex || '',
        requireOtp: user.requireOtp || false,
        ipWhitelistEnabled: user.ipWhitelistEnabled || false,
        ipWhitelist: user.ipWhitelist || [],
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
          phone: formData.phone ? removePhoneSpaces(String(formData.phone)) : null,
          roleId: formData.role,
          teamId: formData.teamId || null,
          hrex: formData.hrex || '',
          requireOtp: formData.requireOtp,
          ipWhitelistEnabled: formData.ipWhitelistEnabled,
          ipWhitelist: formData.ipWhitelist,
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
    <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, onClose)}>
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
            <Label htmlFor="edit-lastName">Nom <span className="text-red-500">*</span></Label>
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
            <Label htmlFor="edit-firstName">Prénom</Label>
            <Input
              id="edit-firstName"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
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
            <Label htmlFor="edit-role">Rôle <span className="text-red-500">*</span></Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={rolesLoading ? "Chargement..." : "Sélectionner un rôle"} />
              </SelectTrigger>
              <SelectContent>
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-slate-500">
                    {rolesLoading ? "Chargement..." : "Aucun rôle disponible"}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="modal-form-field">
            <Label htmlFor="edit-teamId">Équipe (optionnel)</Label>
            <Select
              value={formData.teamId || "none"}
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

          <div className="modal-form-field">
            <Label htmlFor="edit-hrex">Couleur (optionnel)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="edit-hrex"
                type="color"
                value={formData.hrex || '#3B82F6'}
                onChange={(e) => setFormData({ ...formData, hrex: e.target.value })}
                className="w-16 h-10 cursor-pointer"
              />
              <Input
                value={formData.hrex}
                onChange={(e) => setFormData({ ...formData, hrex: e.target.value })}
                placeholder="Ex: #3B82F6 ou blue"
                className="flex-1"
              />
            </div>
          </div>

          <div className="modal-form-field">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-requireOtp"
                checked={formData.requireOtp}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requireOtp: checked === true })
                }
              />
              <Label htmlFor="edit-requireOtp" className="cursor-pointer">
                Forcer l'authentification OTP pour cet utilisateur
              </Label>
            </div>
          </div>

          <div className="modal-form-field">
            <div className="flex items-center space-x-2 mb-3">
              <Checkbox
                id="edit-ipWhitelistEnabled"
                checked={formData.ipWhitelistEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, ipWhitelistEnabled: checked === true })
                }
              />
              <Label htmlFor="edit-ipWhitelistEnabled" className="cursor-pointer">
                Activer la liste blanche d'adresses IP
              </Label>
            </div>
            {formData.ipWhitelistEnabled && (
              <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
                <div className="text-sm text-slate-600 mb-2">
                  Ajoutez les adresses IP autorisées (ex: 192.168.1.1 ou 192.168.1.0/24 pour CIDR)
                  <br />
                  <span className="text-xs text-slate-500">
                    Note: Si vous êtes derrière un proxy ou un load balancer, l'IP détectée peut être différente de votre IP publique.
                    Le message d'erreur vous indiquera l'IP détectée par le serveur.
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="192.168.1.1 ou 192.168.1.0/24"
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newIp.trim() && !formData.ipWhitelist.includes(newIp.trim())) {
                          setFormData({
                            ...formData,
                            ipWhitelist: [...formData.ipWhitelist, newIp.trim()],
                          });
                          setNewIp('');
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newIp.trim() && !formData.ipWhitelist.includes(newIp.trim())) {
                        setFormData({
                          ...formData,
                          ipWhitelist: [...formData.ipWhitelist, newIp.trim()],
                        });
                        setNewIp('');
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.ipWhitelist.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {formData.ipWhitelist.map((ip, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white p-2 rounded border"
                      >
                        <span className="text-sm font-mono">{ip}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              ipWhitelist: formData.ipWhitelist.filter((_, i) => i !== index),
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
