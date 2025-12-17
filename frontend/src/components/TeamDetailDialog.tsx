import React, { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { TeamDetail } from '../types';
import { apiCall } from '../utils/api';
import { handleModalOverlayClick } from '../utils/modal';
import { useUsers } from '../hooks/useUsers';
import { Crown, UserMinus, Save, X } from 'lucide-react';
import LoadingIndicator from './LoadingIndicator';
import { toast } from 'sonner';
import '../styles/Modal.css';

interface TeamDetailDialogProps {
  team: TeamDetail | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTeamUpdated?: () => void;
}

export function TeamDetailDialog({ team, isOpen, onOpenChange, onTeamUpdated }: TeamDetailDialogProps) {
  const { users, loading: usersLoading } = useUsers();
  const [teamName, setTeamName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [teamData, setTeamData] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (team) {
      setTeamData(team);
      setTeamName(team.team.name);
    }
  }, [team]);

  const loadTeamDetails = async () => {
    if (!team?.team?.id) return;
    
    setLoading(true);
    try {
      const response = await apiCall(`/api/teams/${team.team.id}/`);
      setTeamData(response);
      setTeamName(response.team.name);
    } catch (error) {
      console.error('Error loading team details:', error);
      setError('Erreur lors du chargement des détails de l\'équipe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && team?.team?.id) {
      loadTeamDetails();
    }
  }, [isOpen, team?.team?.id]);

  const handleUpdateTeamName = async () => {
    if (!team?.team?.id || !teamName.trim()) return;
    
    setSaving(true);
    setError('');
    try {
      await apiCall(`/api/teams/${team.team.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ name: teamName }),
      });
      toast.success('Nom de l\'équipe mis à jour');
      await loadTeamDetails();
      onTeamUpdated?.();
    } catch (error: any) {
      console.error('Error updating team name:', error);
      const message = error?.response?.error || error?.message || 'Erreur lors de la mise à jour du nom de l\'équipe';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!team?.team?.id || !selectedUserId) return;
    
    setSaving(true);
    setError('');
    try {
      await apiCall(`/api/teams/${team.team.id}/add-member/`, {
        method: 'POST',
        body: JSON.stringify({ userId: selectedUserId }),
      });
      toast.success('Membre ajouté à l\'équipe');
      setSelectedUserId('');
      await loadTeamDetails();
      onTeamUpdated?.();
    } catch (error: any) {
      console.error('Error adding member:', error);
      const message = error?.response?.error || error?.message || 'Erreur lors de l\'ajout du membre';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!team?.team?.id) return;
    if (!confirm('Êtes-vous sûr de vouloir retirer ce membre de l\'équipe ?')) return;
    
    setSaving(true);
    setError('');
    try {
      await apiCall(`/api/teams/${team.team.id}/remove-member/`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      toast.success('Membre retiré de l\'équipe');
      await loadTeamDetails();
      onTeamUpdated?.();
    } catch (error: any) {
      console.error('Error removing member:', error);
      const message = error?.response?.error || error?.message || 'Erreur lors du retrait du membre';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetLeader = async (userId: string) => {
    if (!team?.team?.id) return;
    
    setSaving(true);
    setError('');
    try {
      await apiCall(`/api/teams/${team.team.id}/set-leader/`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      toast.success('Chef d\'équipe modifié');
      await loadTeamDetails();
      onTeamUpdated?.();
    } catch (error: any) {
      console.error('Error setting leader:', error);
      const message = error?.response?.error || error?.message || 'Erreur lors de la modification du chef d\'équipe';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Get users not already in the team
  const availableUsers = users.filter(user => {
    if (!teamData) return true;
    return !teamData.members.some(member => member.userId === user.id);
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('fr-FR');
    } catch {
      return '-';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => onOpenChange(false))}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Détails de l'équipe</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="modal-close"
            onClick={() => onOpenChange(false)}
          >
            <X className="planning-icon-md" />
          </Button>
        </div>

        {loading ? (
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
            <LoadingIndicator />
          </div>
        ) : teamData ? (
          <div className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Edit team name section */}
            <div className="modal-form-field">
              <Label htmlFor="team-name">Nom de l'équipe</Label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Nom de l'équipe"
                  style={{ flex: 1 }}
                />
                <Button 
                  onClick={handleUpdateTeamName}
                  disabled={saving || !teamName.trim()}
                  size="sm"
                >
                  <Save className="planning-icon-md" style={{ marginRight: '4px' }} />
                  Enregistrer
                </Button>
              </div>
            </div>

            {/* Add member section */}
            <div className="modal-form-field">
              <Label htmlFor="add-member">Ajouter un utilisateur à l'équipe</Label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="add-member" style={{ flex: 1 }}>
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersLoading ? (
                      <SelectItem value="loading" disabled>Chargement...</SelectItem>
                    ) : availableUsers.length > 0 ? (
                      availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.username})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-users" disabled>Aucun utilisateur disponible</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddMember}
                  disabled={saving || !selectedUserId}
                  size="sm"
                >
                  Ajouter
                </Button>
              </div>
            </div>

            {/* Members list section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontWeight: '600', fontSize: '16px', margin: 0 }}>Membres de l'équipe</h3>
              {teamData.members && teamData.members.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '8px', fontSize: '14px', fontWeight: '500' }}>Nom</th>
                        <th style={{ textAlign: 'left', padding: '8px', fontSize: '14px', fontWeight: '500' }}>Rôle</th>
                        <th style={{ textAlign: 'left', padding: '8px', fontSize: '14px', fontWeight: '500' }}>Date d'insertion</th>
                        <th style={{ textAlign: 'right', padding: '8px', fontSize: '14px', fontWeight: '500' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamData.members.map((member) => (
                        <tr key={member.userId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{member.userData?.firstName} {member.userData?.lastName}</span>
                              {member.isLeader && (
                                <Badge variant="default" style={{ backgroundColor: '#fbbf24', color: '#000', border: 'none' }}>
                                  <Crown className="size-3" style={{ marginRight: '4px' }} />
                                  Chef
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>{member.userData?.role || '-'}</td>
                          <td style={{ padding: '12px 8px' }}>{formatDate(member.createdAt)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              {!member.isLeader && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetLeader(member.userId)}
                                  disabled={saving}
                                  title="Définir comme chef d'équipe"
                                >
                                  <Crown className="size-4" style={{ color: '#fbbf24' }} />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMember(member.userId)}
                                disabled={saving}
                                title="Retirer de l'équipe"
                              >
                                <UserMinus className="size-4" style={{ color: '#ef4444' }} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Aucun membre dans cette équipe</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            {saving && <LoadingIndicator />}

            <div className="modal-form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px' }}>
            <p>Aucune donnée d'équipe disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
