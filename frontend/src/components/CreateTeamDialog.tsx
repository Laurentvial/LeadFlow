import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { X } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { handleModalOverlayClick } from '../utils/modal';
import '../styles/Modal.css';

interface CreateTeamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated: () => void;
}

export function CreateTeamDialog({ isOpen, onClose, onTeamCreated }: CreateTeamDialogProps) {
  const [teamFormData, setTeamFormData] = useState({ name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await apiCall('/api/teams/create/', {
        method: 'POST',
        body: JSON.stringify(teamFormData),
      });
      toast.success('Équipe créée avec succès');
      setTeamFormData({ name: '' });
      onClose();
      onTeamCreated();
    } catch (err: any) {
      console.error('Error creating team:', err);
      const data = err?.response || {};
      const message = data.detail || data.error || err?.message || 'Une erreur est survenue lors de la création';
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
          <h2 className="modal-title">Nouvelle équipe</h2>
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
        <form onSubmit={handleCreateTeam} className="modal-form">
          <div className="modal-form-field">
            <Label htmlFor="team-name">Nom de l'équipe</Label>
            <Input
              id="team-name"
              value={teamFormData.name}
              onChange={(e) => setTeamFormData({ name: e.target.value })}
              placeholder="Ex: Équipe Paris"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          
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
              {loading ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

