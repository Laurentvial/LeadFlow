import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus, Search, Trash2, Pencil, X, ExternalLink } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import '../styles/Modal.css';
import '../styles/PageHeader.css';

export function ManageUsefulLinks() {
  const [usefulLinks, setUsefulLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    image: null as File | null,
    default: false
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [shouldRemoveImage, setShouldRemoveImage] = useState(false);

  useEffect(() => {
    loadUsefulLinks();
  }, []);

  async function loadUsefulLinks() {
    try {
      setLoading(true);
      const data = await apiCall('/api/useful-links/');
      setUsefulLinks((data as any).usefulLinks || []);
    } catch (error) {
      console.error('Error loading useful links:', error);
      toast.error('Erreur lors du chargement des liens utiles');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenDialog(link?: any) {
    if (link) {
      setEditingLink(link);
      setFormData({
        name: link.name || '',
        url: link.url || '',
        description: link.description || '',
        image: null,
        default: link.default || false
      });
      setImagePreview(link.imageUrl || null);
      setShouldRemoveImage(false);
    } else {
      setEditingLink(null);
      setFormData({
        name: '',
        url: '',
        description: '',
        image: null,
        default: false
      });
      setImagePreview(null);
      setShouldRemoveImage(false);
    }
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setEditingLink(null);
    setFormData({
      name: '',
      url: '',
      description: '',
      image: null,
      default: false
    });
    setImagePreview(null);
    setShouldRemoveImage(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('url', formData.url);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('default', formData.default.toString());
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }
      // If editing and image should be removed, send a flag
      if (editingLink && shouldRemoveImage && !formData.image) {
        formDataToSend.append('removeImage', 'true');
      }

      if (editingLink) {
        await apiCall(`/api/useful-links/${editingLink.id}/`, {
          method: 'PATCH',
          body: formDataToSend
        });
        toast.success('Lien utile modifié avec succès');
      } else {
        await apiCall('/api/useful-links/create/', {
          method: 'POST',
          body: formDataToSend
        });
        toast.success('Lien utile créé avec succès');
      }
      handleCloseDialog();
      loadUsefulLinks();
    } catch (error: any) {
      console.error('Error saving useful link:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, image: file });
      setShouldRemoveImage(false); // If user selects a new image, don't remove
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleRemoveImage() {
    setFormData({ ...formData, image: null });
    setImagePreview(null);
    setShouldRemoveImage(true); // Mark that image should be removed
  }

  async function handleDelete(linkId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce lien utile ?')) return;
    
    try {
      await apiCall(`/api/useful-links/${linkId}/delete/`, { method: 'DELETE' });
      toast.success('Lien utile supprimé avec succès');
      loadUsefulLinks();
    } catch (error) {
      console.error('Error deleting useful link:', error);
      toast.error('Erreur lors de la suppression');
    }
  }

  const filteredLinks = usefulLinks.filter(link => {
    const searchLower = searchTerm.toLowerCase();
    return (
      link.name?.toLowerCase().includes(searchLower) ||
      link.url?.toLowerCase().includes(searchLower) ||
      link.description?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Gestion des Liens Utiles</h1>
          <p className="page-subtitle">Gérer les liens utiles disponibles pour les clients</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un lien utile
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              className="pl-10"
              placeholder="Rechercher par titre, URL, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Useful Links Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Liens Utiles ({filteredLinks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLinks.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Aucun lien utile trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-slate-700">Image</th>
                    <th className="text-left p-2 font-medium text-slate-700">Titre</th>
                    <th className="text-left p-2 font-medium text-slate-700">URL</th>
                    <th className="text-left p-2 font-medium text-slate-700">Description</th>
                    <th className="text-left p-2 font-medium text-slate-700">Par défaut</th>
                    <th className="text-right p-2 font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLinks.map((link) => (
                    <tr key={link.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">
                        {link.imageUrl ? (
                          <img src={link.imageUrl} alt={link.name} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400 text-xs">
                            Pas d'image
                          </div>
                        )}
                      </td>
                      <td className="p-2 font-medium">{link.name}</td>
                      <td className="p-2">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {link.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="p-2 text-slate-600 max-w-md truncate">{link.description}</td>
                      <td className="p-2">
                        {link.default ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Oui</span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-sm">Non</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(link)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(link.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      {isDialogOpen && (
        <div className="modal-overlay" onClick={handleCloseDialog}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '32rem' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingLink ? 'Modifier le lien utile' : 'Créer un nouveau lien utile'}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={handleCloseDialog}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="name">Titre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="url">Lien URL *</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="image">Insérer une image</Label>
                {imagePreview && (
                  <div className="mb-2 relative">
                    <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded border" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="absolute top-0 right-0 bg-red-500 text-white hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
              </div>
              <div className="modal-form-field">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="default"
                    checked={formData.default}
                    onChange={(e) => setFormData({ ...formData, default: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="default">Disponible par défaut pour tous les clients</Label>
                </div>
              </div>
              <div className="modal-form-actions">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Annuler
                </Button>
                <Button type="submit">
                  {editingLink ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

