import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Trash2, Send } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';

interface ContactNotesTabProps {
  notes: any[];
  contactId: string;
  onRefresh: () => void;
}

export function ContactNotesTab({ notes, contactId, onRefresh }: ContactNotesTabProps) {
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    
    if (!noteText.trim()) {
      toast.error('Veuillez saisir une note');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiCall('/api/notes/create/', {
        method: 'POST',
        body: JSON.stringify({
          text: noteText.trim(),
          contactId: contactId,
        }),
      });
      toast.success('Note créée avec succès');
      setNoteText('');
      onRefresh();
    } catch (error: any) {
      console.error('Error creating note:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la création de la note';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Supprimer cette note ?')) return;
    
    try {
      await apiCall(`/api/notes/delete/${noteId}/`, { method: 'DELETE' });
      toast.success('Note supprimée avec succès');
      onRefresh();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Erreur lors de la suppression de la note');
    }
  }

  return (
    <div className="space-y-6">
      {/* Create Note Form */}
      <Card>
        <CardHeader>
          <CardTitle>Ajouter une note</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateNote} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-text">Note</Label>
              <Textarea
                id="note-text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Saisissez votre note..."
                rows={4}
                className="resize-none"
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" disabled={isSubmitting || !noteText.trim()}>
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Envoi...' : 'Enregistrer'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notes List */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="p-4 border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700">
                          {new Date(note.createdAt || note.created_at).toLocaleString('fr-FR', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {(note.createdBy || note.userId?.username || note.user?.username) && (
                          <span className="text-xs text-slate-500">•</span>
                        )}
                        {(note.createdBy || note.userId?.username || note.user?.username) && (
                          <p className="text-xs text-slate-600 font-medium">
                            {note.createdBy || note.userId?.username || note.user?.username || 'Utilisateur'}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap">{note.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucune note</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


