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

export function ManageRibs() {
  const [ribs, setRibs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRib, setEditingRib] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    iban: '',
    bic: '',
    bankName: '',
    accountHolder: '',
    bankCode: '',
    branchCode: '',
    accountNumber: '',
    ribKey: '',
    domiciliation: '',
    default: false
  });

  useEffect(() => {
    loadRibs();
  }, []);

  async function loadRibs() {
    try {
      setLoading(true);
      const data = await apiCall('/api/ribs/');
      setRibs((data as any).ribs || []);
    } catch (error) {
      console.error('Error loading RIBs:', error);
      toast.error('Erreur lors du chargement des RIBs');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenDialog(rib?: any) {
    if (rib) {
      setEditingRib(rib);
      setFormData({
        name: rib.name || '',
        iban: rib.iban || '',
        bic: rib.bic || '',
        bankName: rib.bankName || '',
        accountHolder: rib.accountHolder || '',
        bankCode: rib.bankCode || '',
        branchCode: rib.branchCode || '',
        accountNumber: rib.accountNumber || '',
        ribKey: rib.ribKey || '',
        domiciliation: rib.domiciliation || '',
        default: rib.default || false
      });
    } else {
      setEditingRib(null);
      setFormData({
        name: '',
        iban: '',
        bic: '',
        bankName: '',
        accountHolder: '',
        bankCode: '',
        branchCode: '',
        accountNumber: '',
        ribKey: '',
        domiciliation: '',
        default: false
      });
    }
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setEditingRib(null);
    setFormData({
      name: '',
      iban: '',
      bic: '',
      bankName: '',
      accountHolder: '',
      bankCode: '',
      branchCode: '',
      accountNumber: '',
      ribKey: '',
      domiciliation: '',
      default: false
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingRib) {
        await apiCall(`/api/ribs/${editingRib.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
          headers: { 'Content-Type': 'application/json' }
        });
        toast.success('RIB modifié avec succès');
      } else {
        await apiCall('/api/ribs/create/', {
          method: 'POST',
          body: JSON.stringify(formData),
          headers: { 'Content-Type': 'application/json' }
        });
        toast.success('RIB créé avec succès');
      }
      handleCloseDialog();
      loadRibs();
    } catch (error: any) {
      console.error('Error saving RIB:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    }
  }

  async function handleDelete(ribId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce RIB ?')) return;
    
    try {
      await apiCall(`/api/ribs/${ribId}/delete/`, { method: 'DELETE' });
      toast.success('RIB supprimé avec succès');
      loadRibs();
    } catch (error) {
      console.error('Error deleting RIB:', error);
      toast.error('Erreur lors de la suppression');
    }
  }

  const filteredRibs = ribs.filter(rib => {
    const searchLower = searchTerm.toLowerCase();
    return (
      rib.name?.toLowerCase().includes(searchLower) ||
      rib.bankCode?.toLowerCase().includes(searchLower) ||
      rib.branchCode?.toLowerCase().includes(searchLower) ||
      rib.accountNumber?.toLowerCase().includes(searchLower) ||
      rib.ribKey?.toLowerCase().includes(searchLower) ||
      rib.domiciliation?.toLowerCase().includes(searchLower) ||
      rib.iban?.toLowerCase().includes(searchLower) ||
      rib.bankName?.toLowerCase().includes(searchLower) ||
      rib.accountHolder?.toLowerCase().includes(searchLower)
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
          <h1 className="page-title">Gestion des RIBs</h1>
          <p className="page-subtitle">Gérer les RIBs disponibles pour les clients</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un RIB
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              className="pl-10"
              placeholder="Rechercher par nom, code banque, code guichet, domiciliation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* RIBs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des RIBs ({filteredRibs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRibs.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Aucun RIB trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-slate-700">Nom</th>
                    <th className="text-left p-2 font-medium text-slate-700">Code banque</th>
                    <th className="text-left p-2 font-medium text-slate-700">Code guichet</th>
                    <th className="text-left p-2 font-medium text-slate-700">N° compte</th>
                    <th className="text-left p-2 font-medium text-slate-700">Clé RIB</th>
                    <th className="text-left p-2 font-medium text-slate-700">Domiciliation</th>
                    <th className="text-left p-2 font-medium text-slate-700">Par défaut</th>
                    <th className="text-right p-2 font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRibs.map((rib) => (
                    <tr key={rib.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">{rib.name}</td>
                      <td className="p-2 font-mono text-sm">{rib.bankCode}</td>
                      <td className="p-2 font-mono text-sm">{rib.branchCode}</td>
                      <td className="p-2 font-mono text-sm">{rib.accountNumber}</td>
                      <td className="p-2 font-mono text-sm">{rib.ribKey}</td>
                      <td className="p-2">{rib.domiciliation}</td>
                      <td className="p-2">
                        {rib.default ? (
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
                            onClick={() => handleOpenDialog(rib)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rib.id)}
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
                {editingRib ? 'Modifier le RIB' : 'Créer un nouveau RIB'}
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
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="bankCode">Code banque *</Label>
                <Input
                  id="bankCode"
                  value={formData.bankCode}
                  onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
                  placeholder="5 chiffres"
                  maxLength={5}
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="branchCode">Code guichet *</Label>
                <Input
                  id="branchCode"
                  value={formData.branchCode}
                  onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                  placeholder="5 chiffres"
                  maxLength={5}
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="accountNumber">Numéro de compte *</Label>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  placeholder="11 caractères"
                  maxLength={11}
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="ribKey">Clé RIB *</Label>
                <Input
                  id="ribKey"
                  value={formData.ribKey}
                  onChange={(e) => setFormData({ ...formData, ribKey: e.target.value })}
                  placeholder="2 chiffres"
                  maxLength={2}
                  required
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="domiciliation">Domiciliation</Label>
                <Input
                  id="domiciliation"
                  value={formData.domiciliation}
                  onChange={(e) => setFormData({ ...formData, domiciliation: e.target.value })}
                  placeholder="Adresse de la banque"
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="iban">IBAN (optionnel)</Label>
                <Input
                  id="iban"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  placeholder="FR76..."
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="bic">BIC (optionnel)</Label>
                <Input
                  id="bic"
                  value={formData.bic}
                  onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                  placeholder="Code BIC"
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="bankName">Nom de la banque (optionnel)</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </div>
              <div className="modal-form-field">
                <Label htmlFor="accountHolder">Titulaire du compte (optionnel)</Label>
                <Input
                  id="accountHolder"
                  value={formData.accountHolder}
                  onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
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
                  {editingRib ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

