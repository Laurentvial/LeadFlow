import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Plus, Pencil, Trash2, FileText, X, GripVertical, Server } from 'lucide-react';
import { apiCall } from '../utils/api';
import { handleModalOverlayClick } from '../utils/modal';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useHasPermission } from '../hooks/usePermissions';
import { usePlatforms } from '../hooks/usePlatforms';
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

interface NoteCategory {
  id: string;
  name: string;
  orderIndex: number;
  createdAt: string;
}

interface Platform {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

function SortableCategoryItem({ 
  category, 
  onEdit, 
  onDelete,
  canEdit,
  canDelete
}: { 
  category: NoteCategory; 
  onEdit: (category: NoteCategory) => void;
  onDelete: (categoryId: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 border hover:bg-slate-50 bg-white ${isDragging ? 'shadow-lg' : ''}`}
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
        <div>
          <h3 className="font-semibold">{category.name}</h3>
        </div>
      </div>
      <div 
        className="flex items-center gap-2" 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(category);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(category.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ContactFormTab() {
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
  });
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  
  // Platform state
  const { platforms, loading: platformsLoading, reload: reloadPlatforms } = usePlatforms();
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [isEditPlatformModalOpen, setIsEditPlatformModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [platformForm, setPlatformForm] = useState({
    name: '',
  });
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformError, setPlatformError] = useState('');
  
  // Permission checks for note categories management (general permissions, not category-specific)
  const canView = useHasPermission('note_categories', 'view', null, null);
  const canCreate = useHasPermission('note_categories', 'create', null, null);
  const canEdit = useHasPermission('note_categories', 'edit', null, null);
  const canDelete = useHasPermission('note_categories', 'delete', null, null);
  
  // Don't render if user doesn't have view permission
  if (!canView) {
    return null;
  }

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
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const data = await apiCall('/api/note-categories/');
      setCategories(data.categories || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des listes de notes');
      console.error('Error loading note categories:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCategory() {
    setCategoryError('');
    setCategoryLoading(true);
    try {
      await apiCall('/api/note-categories/create/', {
        method: 'POST',
        body: JSON.stringify({
          name: categoryForm.name,
        }),
      });
      toast.success('Liste de notes créée avec succès');
      setIsCategoryModalOpen(false);
      setCategoryForm({ name: '' });
      loadCategories();
    } catch (error: any) {
      const message = error.message || 'Erreur lors de la création de la liste de notes';
      setCategoryError(message);
      toast.error(message);
    } finally {
      setCategoryLoading(false);
    }
  }

  async function handleUpdateCategory() {
    if (!selectedCategory) return;
    setCategoryError('');
    setCategoryLoading(true);
    try {
      await apiCall(`/api/note-categories/${selectedCategory.id}/`, {
        method: 'PUT',
        body: JSON.stringify({
          name: categoryForm.name,
        }),
      });
      toast.success('Liste de notes mise à jour avec succès');
      setIsEditCategoryModalOpen(false);
      setSelectedCategory(null);
      setCategoryForm({ name: '' });
      loadCategories();
    } catch (error: any) {
      const message = error.message || 'Erreur lors de la mise à jour de la liste de notes';
      setCategoryError(message);
      toast.error(message);
    } finally {
      setCategoryLoading(false);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette liste de notes ?')) return;
    try {
      await apiCall(`/api/note-categories/${categoryId}/delete/`, {
        method: 'DELETE',
      });
      toast.success('Liste de notes supprimée avec succès');
      loadCategories();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression de la liste de notes');
    }
  }

  function handleEditCategory(category: NoteCategory) {
    setSelectedCategory(category);
    setCategoryForm({
      name: category.name,
    });
    setIsEditCategoryModalOpen(true);
  }

  const sortedCategories = [...categories].sort((a, b) => a.orderIndex - b.orderIndex);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sortedCategories.findIndex((c) => c.id === active.id);
    const newIndex = sortedCategories.findIndex((c) => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newCategories: NoteCategory[] = arrayMove(sortedCategories, oldIndex, newIndex);
    
    // Update local state optimistically
    const updatedCategories = [...categories];
    newCategories.forEach((category: NoteCategory, index: number) => {
      const categoryIndex = updatedCategories.findIndex((c) => c.id === category.id);
      if (categoryIndex !== -1) {
        updatedCategories[categoryIndex] = { ...updatedCategories[categoryIndex], orderIndex: index };
      }
    });
    setCategories(updatedCategories);

    // Update orderIndex on backend
    setIsReordering(true);
    try {
      const updates = newCategories.map((category: NoteCategory, index: number) => ({
        id: category.id,
        orderIndex: index,
      }));

      await apiCall('/api/note-categories/reorder/', {
        method: 'POST',
        body: JSON.stringify({ categories: updates }),
      });
      
      // Reload to ensure consistency
      await loadCategories();
      toast.success('Ordre des listes de notes mis à jour');
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour de l\'ordre');
      // Reload on error to revert
      await loadCategories();
    } finally {
      setIsReordering(false);
    }
  }

  // Platform handlers
  async function handleCreatePlatform() {
    setPlatformError('');
    setPlatformLoading(true);
    try {
      await apiCall('/api/platforms/create/', {
        method: 'POST',
        body: JSON.stringify({
          name: platformForm.name,
        }),
      });
      toast.success('Plateforme créée avec succès');
      setIsPlatformModalOpen(false);
      setPlatformForm({ name: '' });
      reloadPlatforms();
    } catch (error: any) {
      const message = error?.data?.error || error.message || 'Erreur lors de la création de la plateforme';
      setPlatformError(message);
      toast.error(message);
    } finally {
      setPlatformLoading(false);
    }
  }

  async function handleUpdatePlatform() {
    if (!selectedPlatform) return;
    setPlatformError('');
    setPlatformLoading(true);
    try {
      await apiCall(`/api/platforms/${selectedPlatform.id}/`, {
        method: 'PUT',
        body: JSON.stringify({
          name: platformForm.name,
        }),
      });
      toast.success('Plateforme mise à jour avec succès');
      setIsEditPlatformModalOpen(false);
      setSelectedPlatform(null);
      setPlatformForm({ name: '' });
      reloadPlatforms();
    } catch (error: any) {
      const message = error?.data?.error || error.message || 'Erreur lors de la mise à jour de la plateforme';
      setPlatformError(message);
      toast.error(message);
    } finally {
      setPlatformLoading(false);
    }
  }

  async function handleDeletePlatform(platformId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette plateforme ?')) return;
    try {
      await apiCall(`/api/platforms/${platformId}/`, {
        method: 'DELETE',
      });
      toast.success('Plateforme supprimée avec succès');
      reloadPlatforms();
    } catch (error: any) {
      toast.error(error?.data?.error || error.message || 'Erreur lors de la suppression de la plateforme');
    }
  }

  function handleEditPlatform(platform: Platform) {
    setSelectedPlatform(platform);
    setPlatformForm({
      name: platform.name,
    });
    setIsEditPlatformModalOpen(true);
  }

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <>
      {canCreate && (
        <div className="users-teams-action-bar">
          <Button onClick={() => setIsCategoryModalOpen(true)}>
            <Plus className="users-teams-icon users-teams-icon-with-margin" />
            Créer une liste de notes
          </Button>
        </div>
      )}

      {/* Create Category Modal */}
      {isCategoryModalOpen && (
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsCategoryModalOpen(false);
          setCategoryError('');
        })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Créer une nouvelle liste de notes</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setCategoryError('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateCategory();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="category-name">Nom de la liste</Label>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Ex: Notes importantes"
                  required
                />
              </div>
              {categoryError && (
                <div className="bg-red-50 text-red-600 px-4 py-2 text-sm">
                  {categoryError}
                </div>
              )}
              {categoryLoading && <LoadingIndicator />}
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setCategoryError('');
                  }}
                  disabled={categoryLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={categoryLoading}>
                  {categoryLoading ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {isEditCategoryModalOpen && selectedCategory && (
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsEditCategoryModalOpen(false);
          setCategoryError('');
        })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier la liste de notes</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsEditCategoryModalOpen(false);
                  setCategoryError('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateCategory();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="edit-category-name">Nom de la liste</Label>
                <Input
                  id="edit-category-name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Ex: Notes importantes"
                  required
                />
              </div>
              {categoryError && (
                <div className="bg-red-50 text-red-600 px-4 py-2 text-sm">
                  {categoryError}
                </div>
              )}
              {categoryLoading && <LoadingIndicator />}
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditCategoryModalOpen(false);
                    setCategoryError('');
                  }}
                  disabled={categoryLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={categoryLoading}>
                  {categoryLoading ? 'Mise à jour...' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Listes de notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedCategories.length === 0 ? (
            <p className="text-slate-500">Aucune liste de notes créée</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedCategories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {sortedCategories.map((category) => (
                    <SortableCategoryItem
                      key={category.id}
                      category={category}
                      onEdit={handleEditCategory}
                      onDelete={handleDeleteCategory}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Platforms Section */}
      {canCreate && (
        <div className="users-teams-action-bar" style={{ marginTop: '24px' }}>
          <Button onClick={() => setIsPlatformModalOpen(true)}>
            <Plus className="users-teams-icon users-teams-icon-with-margin" />
            Créer une plateforme
          </Button>
        </div>
      )}

      {/* Create Platform Modal */}
      {isPlatformModalOpen && (
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsPlatformModalOpen(false);
          setPlatformError('');
        })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Créer une nouvelle plateforme</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsPlatformModalOpen(false);
                  setPlatformError('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreatePlatform();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="platform-name">Nom de la plateforme</Label>
                <Input
                  id="platform-name"
                  value={platformForm.name}
                  onChange={(e) => setPlatformForm({ ...platformForm, name: e.target.value })}
                  placeholder="Ex: Bnp, Revolut, Paypal..."
                  required
                />
              </div>
              {platformError && (
                <div className="bg-red-50 text-red-600 px-4 py-2 text-sm">
                  {platformError}
                </div>
              )}
              {platformLoading && <LoadingIndicator />}
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsPlatformModalOpen(false);
                    setPlatformError('');
                  }}
                  disabled={platformLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={platformLoading}>
                  {platformLoading ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Platform Modal */}
      {isEditPlatformModalOpen && selectedPlatform && (
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsEditPlatformModalOpen(false);
          setPlatformError('');
        })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier la plateforme</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsEditPlatformModalOpen(false);
                  setPlatformError('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdatePlatform();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="edit-platform-name">Nom de la plateforme</Label>
                <Input
                  id="edit-platform-name"
                  value={platformForm.name}
                  onChange={(e) => setPlatformForm({ ...platformForm, name: e.target.value })}
                  placeholder="Ex: Bnp, Revolut, Paypal..."
                  required
                />
              </div>
              {platformError && (
                <div className="bg-red-50 text-red-600 px-4 py-2 text-sm">
                  {platformError}
                </div>
              )}
              {platformLoading && <LoadingIndicator />}
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditPlatformModalOpen(false);
                    setPlatformError('');
                  }}
                  disabled={platformLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={platformLoading}>
                  {platformLoading ? 'Mise à jour...' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Platforms List */}
      <Card style={{ marginTop: '24px' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Plateformes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {platformsLoading ? (
            <LoadingIndicator />
          ) : platforms.length === 0 ? (
            <p className="text-slate-500">Aucune plateforme créée</p>
          ) : (
            <div className="space-y-2">
              {platforms
                .filter((platform) => platform.id && platform.id.trim() !== '')
                .map((platform) => (
                  <div
                    key={platform.id}
                    className="flex items-center justify-between p-4 border hover:bg-slate-50 bg-white"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">{platform.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPlatform(platform)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePlatform(platform.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default ContactFormTab;

