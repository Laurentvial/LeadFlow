import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { X, Key } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { User } from '../types';
import '../styles/Modal.css';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onPasswordReset: () => void;
}

export function ResetPasswordModal({
  isOpen,
  onClose,
  user,
  onPasswordReset,
}: ResetPasswordModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('Access@123');
  const [confirmPassword, setConfirmPassword] = useState('Access@123');

  if (!isOpen || !user) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    
    setError('');
    setLoading(true);

    // Validate password match
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    try {
      await apiCall(`/api/users/${user.id}/reset-password/`, {
        method: 'POST',
        body: JSON.stringify({
          password: password,
        }),
      });

      toast.success('Mot de passe réinitialisé avec succès');
      onClose();
      setPassword('Access@123');
      setConfirmPassword('Access@123');
      onPasswordReset();
    } catch (err: any) {
      console.error('Reset password error:', err);
      const data = err?.response?.data || {};
      const message =
        data.error ||
        data.detail ||
        Object.values(data).flat().join(', ') ||
        'Une erreur est survenue lors de la réinitialisation du mot de passe';
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key className="planning-icon-md" />
            <h2 className="modal-title">Réinitialiser le mot de passe</h2>
          </div>
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
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
              Réinitialisation du mot de passe pour{' '}
              <strong>
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.email || user.username || `Utilisateur ${user.id}`}
              </strong>
            </p>
          </div>

          {error && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '0.375rem',
              color: '#dc2626',
              fontSize: '0.875rem'
            }}>
              <p>{error}</p>
            </div>
          )}

          <div className="modal-form-field">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access@123"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="modal-form-field">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Access@123"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="modal-form-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

