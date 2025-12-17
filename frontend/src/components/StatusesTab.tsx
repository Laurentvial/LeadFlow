import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Pencil, Trash2, Tag, X, GripVertical, Star } from 'lucide-react';
import { apiCall } from '../utils/api';
import { handleModalOverlayClick } from '../utils/modal';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import '../styles/Modal.css';

interface Status {
  id: string;
  name: string;
  type: 'lead' | 'client';
  color: string;
  orderIndex: number;
  isFosseDefault?: boolean;
  isEvent?: boolean;
  clientDefault?: boolean;
  createdAt: string;
}

function SortableStatusItem({ 
  status, 
  onEdit, 
  onDelete,
  onSetClientDefault
}: { 
  status: Status; 
  onEdit: (status: Status) => void;
  onDelete: (statusId: string) => void;
  onSetClientDefault?: (statusId: string) => void | Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 border hover:bg-slate-50 bg-white  ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div 
        className="flex-1 flex items-center gap-3 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
      >
        <div className="text-slate-400 hover:text-slate-600">
          <GripVertical className="w-5 h-5" />
        </div>
        {status.color && (
          <div
            className="w-4 h-4 "
            style={{ backgroundColor: status.color }}
          />
        )}
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">{status.name}</h3>
            <Badge variant="outline">
              {status.type === 'lead' ? 'Lead' : 'Client'}
            </Badge>
          </div>
        </div>
      </div>
      <div 
        className="flex items-center gap-2" 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {status.type === 'client' && onSetClientDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSetClientDefault(status.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title={status.clientDefault ? 'Retirer le statut par défaut' : 'Définir comme statut par défaut'}
          >
            <Star 
              className={`w-4 h-4 ${status.clientDefault ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400 hover:text-yellow-400'}`}
              style={status.clientDefault ? { fill: '#facc15', color: '#facc15' } : undefined}
            />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(status);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(status.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

export function StatusesTab() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditStatusModalOpen, setIsEditStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const [statusForm, setStatusForm] = useState({
    name: '',
    type: 'lead' as 'lead' | 'client',
    color: '',
    isEvent: false,
  });
  const [filterType, setFilterType] = useState<'lead' | 'client'>('lead');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadStatuses();
  }, [filterType]);

  async function loadStatuses() {
    setLoading(true);
    try {
      const data = await apiCall(`/api/statuses/?type=${filterType}`);
      setStatuses(data.statuses || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des statuts');
      console.error('Error loading statuses:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStatus() {
    setStatusError('');
    setStatusLoading(true);
    try {
      await apiCall('/api/statuses/create/', {
        method: 'POST',
        body: JSON.stringify({
          name: statusForm.name,
          type: statusForm.type,
          color: statusForm.color || '',
          isEvent: statusForm.isEvent || false,
        }),
      });
      toast.success('Statut créé avec succès');
      setIsStatusModalOpen(false);
      setStatusForm({ name: '', type: 'lead', color: '', isEvent: false });
      loadStatuses();
    } catch (error: any) {
      const message = error.message || 'Erreur lors de la création du statut';
      setStatusError(message);
      toast.error(message);
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleUpdateStatus() {
    if (!selectedStatus) return;
    setStatusError('');
    setStatusLoading(true);
    try {
      await apiCall(`/api/statuses/${selectedStatus.id}/`, {
        method: 'PUT',
        body: JSON.stringify({
          name: statusForm.name,
          type: statusForm.type,
          color: statusForm.color || '',
          isEvent: statusForm.isEvent || false,
        }),
      });
      toast.success('Statut mis à jour avec succès');
      setIsEditStatusModalOpen(false);
      setSelectedStatus(null);
      setStatusForm({ name: '', type: 'lead', color: '', isEvent: false });
      loadStatuses();
    } catch (error: any) {
      const message = error.message || 'Erreur lors de la mise à jour du statut';
      setStatusError(message);
      toast.error(message);
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleDeleteStatus(statusId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce statut ?')) return;
    try {
      await apiCall(`/api/statuses/${statusId}/delete/`, {
        method: 'DELETE',
      });
      toast.success('Statut supprimé avec succès');
      loadStatuses();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression du statut');
    }
  }

  async function handleSetClientDefault(statusId: string) {
    try {
      const selectedStatus = statuses.find(s => s.id === statusId);
      if (!selectedStatus || selectedStatus.type !== 'client') return;
      
      // Toggle: if already default, set to false; otherwise set to true
      // The backend will automatically unset all other client statuses when setting one to true
      const newValue = !selectedStatus.clientDefault;
      
      await apiCall(`/api/statuses/${statusId}/`, {
        method: 'PUT',
        body: JSON.stringify({
          name: selectedStatus.name,
          type: selectedStatus.type,
          color: selectedStatus.color || '',
          isEvent: selectedStatus.isEvent || false,
          clientDefault: newValue,
        }),
      });
      
      toast.success(newValue ? 'Statut par défaut client défini' : 'Statut par défaut client retiré');
      loadStatuses();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du statut par défaut');
    }
  }

  function handleEditStatus(status: Status) {
    setSelectedStatus(status);
    setStatusForm({
      name: status.name,
      type: status.type,
      color: status.color || '',
      isEvent: status.isEvent || false,
    });
    setIsEditStatusModalOpen(true);
  }

  const filteredStatuses = statuses
    .filter(s => s.type === filterType)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = filteredStatuses.findIndex((s) => s.id === active.id);
    const newIndex = filteredStatuses.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newStatuses: Status[] = arrayMove(filteredStatuses, oldIndex, newIndex);
    
    // Update local state optimistically
    const updatedStatuses = [...statuses];
    newStatuses.forEach((status: Status, index: number) => {
      const statusIndex = updatedStatuses.findIndex((s) => s.id === status.id);
      if (statusIndex !== -1) {
        updatedStatuses[statusIndex] = { ...updatedStatuses[statusIndex], orderIndex: index };
      }
    });
    setStatuses(updatedStatuses);

    // Update orderIndex on backend
    setIsReordering(true);
    try {
      const updates = newStatuses.map((status: Status, index: number) => ({
        id: status.id,
        orderIndex: index,
      }));

      await apiCall('/api/statuses/reorder/', {
        method: 'POST',
        body: JSON.stringify({ statuses: updates }),
      });
      
      // Reload to ensure consistency
      await loadStatuses();
      toast.success('Ordre des statuts mis à jour');
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour de l\'ordre');
      // Reload on error to revert
      await loadStatuses();
    } finally {
      setIsReordering(false);
    }
  }

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <>
      <div className="users-teams-action-bar">
        <div className="flex items-center gap-4">
          <Select value={filterType} onValueChange={(value: 'lead' | 'client') => setFilterType(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Statuts Lead</SelectItem>
              <SelectItem value="client">Statuts Client</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setIsStatusModalOpen(true)}>
            <Plus className="users-teams-icon users-teams-icon-with-margin" />
            Créer un statut
          </Button>
        </div>
      </div>

      {/* Create Status Modal */}
      {isStatusModalOpen && (
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsStatusModalOpen(false);
          setStatusError('');
        })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Créer un nouveau statut</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setStatusError('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateStatus();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="status-name">Nom du statut</Label>
                <Input
                  id="status-name"
                  value={statusForm.name}
                  onChange={(e) => setStatusForm({ ...statusForm, name: e.target.value })}
                  placeholder="Ex: En attente"
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="status-type">Type</Label>
                <Select
                  value={statusForm.type}
                  onValueChange={(value: 'lead' | 'client') =>
                    setStatusForm({ ...statusForm, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-field">
                <Label htmlFor="status-color">Couleur (optionnel)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="status-color"
                    type="color"
                    value={statusForm.color || '#3B82F6'}
                    onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <Input
                    value={statusForm.color}
                    onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })}
                    placeholder="Ex: #3B82F6 ou blue"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="modal-form-field">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="status-event"
                    checked={statusForm.isEvent}
                    onCheckedChange={(checked) => setStatusForm({ ...statusForm, isEvent: checked === true })}
                  />
                  <Label htmlFor="status-event" className="text-sm font-normal cursor-pointer">
                    Statut événement
                  </Label>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Ce statut est utilisé pour créer des événements.
                </p>
              </div>
              {statusError && (
                <div className="bg-red-50 text-red-600 px-4 py-2  text-sm">
                  {statusError}
                </div>
              )}
              {statusLoading && <LoadingIndicator />}
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsStatusModalOpen(false);
                    setStatusError('');
                  }}
                  disabled={statusLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={statusLoading}>
                  {statusLoading ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {isEditStatusModalOpen && selectedStatus && (
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsEditStatusModalOpen(false);
          setStatusError('');
        })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier le statut</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsEditStatusModalOpen(false);
                  setStatusError('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateStatus();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="edit-status-name">Nom du statut</Label>
                <Input
                  id="edit-status-name"
                  value={statusForm.name}
                  onChange={(e) => setStatusForm({ ...statusForm, name: e.target.value })}
                  placeholder="Ex: En attente"
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="edit-status-type">Type</Label>
                <Select
                  value={statusForm.type}
                  onValueChange={(value: 'lead' | 'client') =>
                    setStatusForm({ ...statusForm, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-field">
                <Label htmlFor="edit-status-color">Couleur (optionnel)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-status-color"
                    type="color"
                    value={statusForm.color || '#3B82F6'}
                    onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <Input
                    value={statusForm.color}
                    onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })}
                    placeholder="Ex: #3B82F6 ou blue"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="modal-form-field">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-status-event"
                    checked={statusForm.isEvent}
                    onCheckedChange={(checked) => setStatusForm({ ...statusForm, isEvent: checked === true })}
                  />
                  <Label htmlFor="edit-status-event" className="text-sm font-normal cursor-pointer">
                    Statut événement
                  </Label>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Ce statut est utilisé pour créer des événements.
                </p>
              </div>
              {statusError && (
                <div className="bg-red-50 text-red-600 px-4 py-2  text-sm">
                  {statusError}
                </div>
              )}
              {statusLoading && <LoadingIndicator />}
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditStatusModalOpen(false);
                    setStatusError('');
                  }}
                  disabled={statusLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={statusLoading}>
                  {statusLoading ? 'Mise à jour...' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statuses List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Statuts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStatuses.length === 0 ? (
            <p className="text-slate-500">Aucun statut créé</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredStatuses.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {filteredStatuses.map((status) => (
                    <SortableStatusItem
                      key={status.id}
                      status={status}
                      onEdit={handleEditStatus}
                      onDelete={handleDeleteStatus}
                      onSetClientDefault={filterType === 'client' ? handleSetClientDefault : undefined}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default StatusesTab;

