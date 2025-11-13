import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Search, Trash2, Pencil, X } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import '../styles/Modal.css';
import '../styles/PageHeader.css';

export function ManageAssets() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [formData, setFormData] = useState({
    type: '',
    name: '',
    reference: '',
    category: '',
    subcategory: '',
    default: false
  });

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    try {
      setLoading(true);
      const data = await apiCall('/api/assets/');
      setAssets((data as any).assets || []);
    } catch (error) {
      console.error('Error loading assets:', error);
      toast.error('Erreur lors du chargement des actifs');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenDialog(asset?: any) {
    if (asset) {
      setEditingAsset(asset);
      setFormData({
        type: asset.type || '',
        name: asset.name || '',
        reference: asset.reference || '',
        category: asset.category || '',
        subcategory: asset.subcategory || '',
        default: asset.default || false
      });
    } else {
      setEditingAsset(null);
      setFormData({
        type: '',
        name: '',
        reference: '',
        category: '',
        subcategory: '',
        default: false
      });
    }
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setEditingAsset(null);
    setFormData({
      type: '',
      name: '',
      reference: '',
      category: '',
      subcategory: '',
      default: false
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingAsset) {
        await apiCall(`/api/assets/${editingAsset.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
          headers: { 'Content-Type': 'application/json' }
        });
        toast.success('Actif modifié avec succès');
      } else {
        await apiCall('/api/assets/create/', {
          method: 'POST',
          body: JSON.stringify(formData),
          headers: { 'Content-Type': 'application/json' }
        });
        toast.success('Actif créé avec succès');
      }
      handleCloseDialog();
      loadAssets();
    } catch (error: any) {
      console.error('Error saving asset:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    }
  }

  async function handleDelete(assetId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet actif ?')) return;
    
    try {
      await apiCall(`/api/assets/${assetId}/delete/`, { method: 'DELETE' });
      toast.success('Actif supprimé avec succès');
      loadAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Erreur lors de la suppression');
    }
  }

  const filteredAssets = assets.filter(asset => {
    const searchLower = searchTerm.toLowerCase();
    return (
      asset.name?.toLowerCase().includes(searchLower) ||
      asset.type?.toLowerCase().includes(searchLower) ||
      asset.reference?.toLowerCase().includes(searchLower) ||
      asset.category?.toLowerCase().includes(searchLower) ||
      asset.subcategory?.toLowerCase().includes(searchLower)
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
          <h1 className="page-title">Actifs</h1>
          <p className="page-subtitle">Gérer les actifs disponibles pour les clients</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un actif
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              className="pl-10"
              placeholder="Rechercher par nom, type, référence, catégorie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Actifs ({filteredAssets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAssets.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Aucun actif trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-slate-700">Type</th>
                    <th className="text-left p-2 font-medium text-slate-700">Nom</th>
                    <th className="text-left p-2 font-medium text-slate-700">Référence</th>
                    <th className="text-left p-2 font-medium text-slate-700">Catégorie</th>
                    <th className="text-left p-2 font-medium text-slate-700">Sous-catégorie</th>
                    <th className="text-left p-2 font-medium text-slate-700">Par défaut</th>
                    <th className="text-right p-2 font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">{asset.type}</td>
                      <td className="p-2 font-medium">{asset.name}</td>
                      <td className="p-2 font-mono text-sm">{asset.reference}</td>
                      <td className="p-2">{asset.category}</td>
                      <td className="p-2">{asset.subcategory}</td>
                      <td className="p-2">
                        {asset.default ? (
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
                            onClick={() => handleOpenDialog(asset)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(asset.id)}
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
                {editingAsset ? 'Modifier l\'actif' : 'Créer un nouvel actif'}
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
                <Label htmlFor="type">Type *</Label>
                <Input
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="Ex: Bourse, Crypto, ETF..."
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="reference">Référence</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="Ex: ISIN, ticker..."
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="category">Catégorie</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="subcategory">Sous-catégorie</Label>
                <Input
                  id="subcategory"
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
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
                  {editingAsset ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

