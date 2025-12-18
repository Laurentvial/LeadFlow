import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Trash2, Send, Edit2, Check, X } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useHasNoteCategoryPermission, useAccessibleNoteCategoryIds } from '../hooks/usePermissions';
import { useUser } from '../contexts/UserContext';

interface NoteCategory {
  id: string;
  name: string;
  orderIndex: number;
}

interface ContactNotesTabProps {
  notes: any[];
  contactId: string;
  onRefresh: () => void;
}

interface NoteItemProps {
  note: any;
  onDelete: (noteId: string) => void;
  onEdit: (noteId: string, newText: string) => Promise<void>;
}

const NoteItem: React.FC<NoteItemProps> = ({ note, onDelete, onEdit }) => {
  const noteCategoryId = note.categId || null;
  const canDelete = useHasNoteCategoryPermission(noteCategoryId, 'delete');
  const canEdit = useHasNoteCategoryPermission(noteCategoryId, 'edit');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleStartEdit = () => {
    setEditText(note.text);
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setEditText(note.text);
    setIsEditing(false);
  };
  
  const handleSaveEdit = async () => {
    if (!editText.trim()) {
      toast.error('La note ne peut pas être vide');
      return;
    }
    
    if (editText.trim() === note.text) {
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      await onEdit(note.id, editText.trim());
      setIsEditing(false);
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="p-4 border border-slate-200 rounded">
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {note.categoryName && (
              <>
                <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">
                  {note.categoryName}
                </span>
                <span className="text-xs text-slate-400">•</span>
              </>
            )}
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
              <>
                <span className="text-xs text-slate-500">•</span>
                <p className="text-xs text-slate-600 font-medium">
                  {note.createdBy || note.userId?.username || note.user?.username || 'Utilisateur'}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {canEdit && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartEdit}
              className="text-slate-600"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
          {canDelete && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(note.id)}
              className="text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          {isEditing && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="text-green-600"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="text-slate-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      {isEditing ? (
        <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="resize-none"
          rows={4}
          disabled={isSaving}
          autoFocus
        />
      ) : (
        <p className="whitespace-pre-wrap">{note.text}</p>
      )}
    </div>
  );
};

export function ContactNotesTab({ notes, contactId, onRefresh }: ContactNotesTabProps) {
  const { currentUser } = useUser();
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [localNotes, setLocalNotes] = useState<any[]>(notes);
  
  // Sync local notes with props when they change
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);
  
  // Get accessible category IDs based on view permissions
  const accessibleCategoryIds = useAccessibleNoteCategoryIds();
  
  // Check if user has general view permission (can see all notes regardless of category)
  const hasGeneralViewPermission = React.useMemo(() => {
    return currentUser?.permissions?.some((p: any) => 
      p.component === 'note_categories' && 
      p.action === 'view' && 
      !p.fieldName && 
      !p.statusId
    ) || false;
  }, [currentUser?.permissions]);
  
  // Filter categories to only show those user has view permission for
  const accessibleCategories = useMemo(() => {
    return categories.filter(cat => accessibleCategoryIds.includes(cat.id))
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [categories, accessibleCategoryIds]);
  
  // Check if user has any view permissions
  const hasAnyViewPermission = accessibleCategories.length > 0;
  
  // Check create permission for selected category
  const canCreateInSelectedCategory = useHasNoteCategoryPermission(selectedCategoryId, 'create');

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    // Update selected category if current selection is not accessible
    // Auto-select first category by default when categories are available
    if (selectedCategoryId !== 'all' && !accessibleCategoryIds.includes(selectedCategoryId)) {
      // Current selection is not accessible - switch to first accessible category
      if (accessibleCategories.length > 0) {
        setSelectedCategoryId(accessibleCategories[0].id);
      } else {
        setSelectedCategoryId('all');
      }
    } else if (selectedCategoryId === 'all' && accessibleCategories.length > 0) {
      // Default to first category when categories are available
      setSelectedCategoryId(accessibleCategories[0].id);
    }
  }, [accessibleCategories, accessibleCategoryIds, selectedCategoryId]);

  async function loadCategories() {
    try {
      const data = await apiCall('/api/note-categories/');
      const sortedCategories = (data.categories || []).sort((a: NoteCategory, b: NoteCategory) => 
        a.orderIndex - b.orderIndex
      );
      setCategories(sortedCategories);
    } catch (error: any) {
      console.error('Error loading categories:', error);
    }
  }

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    
    if (!noteText.trim()) {
      toast.error('Veuillez saisir une note');
      return;
    }

    setIsSubmitting(true);
    const noteTextValue = noteText.trim();
    setNoteText(''); // Clear input immediately for better UX
    
    try {
      const payload: any = {
        text: noteTextValue,
        contactId: contactId,
      };
      
      // Add category if selected (not 'all')
      if (selectedCategoryId && selectedCategoryId !== 'all') {
        payload.categId = selectedCategoryId;
      }
      
      const response = await apiCall('/api/notes/create/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      // Get the created note from response
      const createdNote = response.note || response;
      
      // Add category name if we have the category info
      if (createdNote.categId && !createdNote.categoryName) {
        const category = accessibleCategories.find(cat => cat.id === createdNote.categId);
        if (category) {
          createdNote.categoryName = category.name;
        }
      }
      
      // Add current user info if not present
      if (!createdNote.createdBy && !createdNote.userId) {
        // We'll get this from the refresh, but add a placeholder for immediate display
        createdNote.createdBy = 'Vous';
      }
      
      // Add the note immediately to local state
      setLocalNotes(prev => [createdNote, ...prev]);
      
      toast.success('Note créée avec succès');
      
      // Notify parent window (contact list) about the note update
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'CONTACT_UPDATED',
            contactId: contactId
          }, window.location.origin);
        } catch (error) {
          console.warn('Could not send message to parent window:', error);
        }
      }
      
      // Refresh in background to get full data
      onRefresh();
    } catch (error: any) {
      // Restore note text on error
      setNoteText(noteTextValue);
      console.error('Error creating note:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la création de la note';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditNote(noteId: string, newText: string) {
    try {
      const response = await apiCall(`/api/notes/${noteId}/update/`, {
        method: 'PATCH',
        body: JSON.stringify({ text: newText }),
      });
      
      // Update local state immediately
      setLocalNotes(prev => prev.map(note => 
        note.id === noteId ? { ...note, text: newText, ...response } : note
      ));
      
      toast.success('Note modifiée avec succès');
      
      // Notify parent window (contact list) about the note update
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'CONTACT_UPDATED',
            contactId: contactId
          }, window.location.origin);
        } catch (error) {
          console.warn('Could not send message to parent window:', error);
        }
      }
      
      // Refresh in background to sync
      onRefresh();
    } catch (error: any) {
      console.error('Error editing note:', error);
      const errorMessage = error?.response?.detail || error?.message || 'Erreur lors de la modification de la note';
      toast.error(errorMessage);
      throw error;
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Supprimer cette note ?')) return;
    
    // Optimistically remove from local state
    setLocalNotes(prev => prev.filter(note => note.id !== noteId));
    
    try {
      await apiCall(`/api/notes/delete/${noteId}/`, { method: 'DELETE' });
      toast.success('Note supprimée avec succès');
      
      // Notify parent window (contact list) about the note update
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'CONTACT_UPDATED',
            contactId: contactId
          }, window.location.origin);
        } catch (error) {
          console.warn('Could not send message to parent window:', error);
        }
      }
      
      // Refresh in background to sync
      onRefresh();
    } catch (error) {
      // Restore note on error
      onRefresh();
      console.error('Error deleting note:', error);
      toast.error('Erreur lors de la suppression de la note');
    }
  }

  // Filter notes by selected category only
  // Permissions are already applied at the tab level - if a tab is visible, user has permission
  const filteredNotes = useMemo(() => {
    // Normalize category IDs for comparison (handle string/number/whitespace issues)
    const normalizeCategoryId = (id: string | null | undefined): string | null => {
      if (!id) return null;
      return String(id).trim();
    };
    
    const normalizedSelectedCategoryId = selectedCategoryId !== 'all' 
      ? normalizeCategoryId(selectedCategoryId) 
      : 'all';
    const normalizedAccessibleCategoryIds = accessibleCategoryIds.map(id => normalizeCategoryId(id)).filter((id): id is string => id !== null);
    
    return localNotes.filter(note => {
      const noteCategoryId = normalizeCategoryId(note.categId);
      
      // If a specific category is selected, only show notes from that category
      if (normalizedSelectedCategoryId !== 'all') {
        // When a specific category is selected, only show notes from that category
        // Notes with no category are excluded when a specific category is selected
        return noteCategoryId === normalizedSelectedCategoryId;
      }
      
      // If "all" is selected, show notes from all accessible categories
      // If user has general view permission, show all notes
      if (hasGeneralViewPermission) {
        return true;
      }
      
      // Show notes with no category (null category notes are accessible)
      if (!noteCategoryId) {
        return true;
      }
      
      // Show notes from accessible categories only
      return normalizedAccessibleCategoryIds.includes(noteCategoryId);
    });
  }, [localNotes, selectedCategoryId, accessibleCategoryIds, hasGeneralViewPermission]);

  // Don't render if user has no view permissions for any category
  if (!hasAnyViewPermission) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Create Note Form */}
      <Card>
        <CardHeader>
          <CardTitle>Ajouter une note</CardTitle>
        </CardHeader>
        <CardContent>
          {accessibleCategories.length > 0 && (
            <Tabs value={selectedCategoryId} onValueChange={setSelectedCategoryId} className="mb-4">
              <TabsList>
                {accessibleCategories.map((category) => (
                  <TabsTrigger key={category.id} value={category.id}>
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
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
            {canCreateInSelectedCategory && (
              <Button type="submit" disabled={isSubmitting || !noteText.trim()}>
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Envoi...' : 'Enregistrer'}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Notes List */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredNotes.length > 0 ? (
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <NoteItem 
                  key={note.id} 
                  note={note} 
                  onDelete={handleDeleteNote}
                  onEdit={handleEditNote}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Aucune note dans cette catégorie
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


