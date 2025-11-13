import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Trash2, X, CreditCard, Link as LinkIcon } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import '../styles/Modal.css';

interface ClientMiscTabProps {
  clientId: string;
  clientRibs: any[];
  availableRibs: any[];
  clientUsefulLinks: any[];
  availableUsefulLinks: any[];
  onRefresh: () => void;
}

export function ClientMiscTab({
  clientId,
  clientRibs,
  availableRibs,
  clientUsefulLinks,
  availableUsefulLinks,
  onRefresh
}: ClientMiscTabProps) {
  const [isAddRibDialogOpen, setIsAddRibDialogOpen] = useState(false);
  const [isAddLinkDialogOpen, setIsAddLinkDialogOpen] = useState(false);

  async function handleAddRib(ribId: string) {
    try {
      await apiCall(`/api/clients/${clientId}/ribs/add/`, {
        method: 'POST',
        body: JSON.stringify({ ribId }),
        headers: { 'Content-Type': 'application/json' }
      });
      toast.success('RIB ajouté avec succès');
      setIsAddRibDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      console.error('Error adding RIB:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout du RIB');
    }
  }

  async function handleRemoveRib(ribId: string) {
    if (!confirm('Retirer ce RIB du client ?')) return;
    
    try {
      await apiCall(`/api/clients/${clientId}/ribs/${ribId}/`, { method: 'DELETE' });
      toast.success('RIB retiré avec succès');
      onRefresh();
    } catch (error) {
      console.error('Error removing RIB:', error);
      toast.error('Erreur lors du retrait du RIB');
    }
  }

  async function handleAddUsefulLink(usefulLinkId: string) {
    try {
      await apiCall(`/api/clients/${clientId}/useful-links/add/`, {
        method: 'POST',
        body: JSON.stringify({ usefulLinkId }),
        headers: { 'Content-Type': 'application/json' }
      });
      toast.success('Lien utile ajouté avec succès');
      setIsAddLinkDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      console.error('Error adding useful link:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout du lien utile');
    }
  }

  async function handleRemoveUsefulLink(usefulLinkId: string) {
    if (!confirm('Retirer ce lien utile du client ?')) return;
    
    try {
      await apiCall(`/api/clients/${clientId}/useful-links/${usefulLinkId}/`, { method: 'DELETE' });
      toast.success('Lien utile retiré avec succès');
      onRefresh();
    } catch (error) {
      console.error('Error removing useful link:', error);
      toast.error('Erreur lors du retrait du lien utile');
    }
  }

  // Filter available RIBs that are not already assigned
  const availableRibsToAdd = availableRibs.filter(
    (rib) => !clientRibs.some((cr) => cr.rib.id === rib.id)
  );

  // Filter available useful links that are not already assigned
  const availableLinksToAdd = availableUsefulLinks.filter(
    (link) => !clientUsefulLinks.some((cul) => cul.usefulLink.id === link.id)
  );

  return (
    <div className="space-y-6">
      {/* RIBs Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              RIBs
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setIsAddRibDialogOpen(true)}
              disabled={availableRibsToAdd.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un RIB
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clientRibs.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Aucun RIB assigné à ce client</p>
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
                    <th className="text-right p-2 font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clientRibs.map((clientRib) => (
                    <tr key={clientRib.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">{clientRib.rib.name}</td>
                      <td className="p-2 font-mono text-sm">{clientRib.rib.bankCode}</td>
                      <td className="p-2 font-mono text-sm">{clientRib.rib.branchCode}</td>
                      <td className="p-2 font-mono text-sm">{clientRib.rib.accountNumber}</td>
                      <td className="p-2 font-mono text-sm">{clientRib.rib.ribKey}</td>
                      <td className="p-2">{clientRib.rib.domiciliation}</td>
                      <td className="p-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRib(clientRib.rib.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Useful Links Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Liens utiles
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setIsAddLinkDialogOpen(true)}
              disabled={availableLinksToAdd.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un lien
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clientUsefulLinks.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Aucun lien utile assigné à ce client</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-slate-700">Image</th>
                    <th className="text-left p-2 font-medium text-slate-700">Titre</th>
                    <th className="text-left p-2 font-medium text-slate-700">URL</th>
                    <th className="text-left p-2 font-medium text-slate-700">Description</th>
                    <th className="text-right p-2 font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clientUsefulLinks.map((clientLink) => (
                    <tr key={clientLink.id} className="border-b hover:bg-slate-50">
                      <td className="p-2">
                        {clientLink.usefulLink.imageUrl ? (
                          <img src={clientLink.usefulLink.imageUrl} alt={clientLink.usefulLink.name} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400 text-xs">
                            Pas d'image
                          </div>
                        )}
                      </td>
                      <td className="p-2 font-medium">{clientLink.usefulLink.name}</td>
                      <td className="p-2">
                        <a
                          href={clientLink.usefulLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {clientLink.usefulLink.url}
                        </a>
                      </td>
                      <td className="p-2 text-slate-600">{clientLink.usefulLink.description}</td>
                      <td className="p-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveUsefulLink(clientLink.usefulLink.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add RIB Dialog */}
      {isAddRibDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsAddRibDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '32rem' }}>
            <div className="modal-header">
              <h2 className="modal-title">Ajouter un RIB</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsAddRibDialogOpen(false)}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label>Sélectionner un RIB</Label>
                <Select onValueChange={handleAddRib}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un RIB" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRibsToAdd.map((rib) => (
                      <SelectItem key={rib.id} value={rib.id}>
                        {rib.name} - {rib.bankCode} {rib.branchCode} {rib.accountNumber} {rib.ribKey}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddRibDialogOpen(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Useful Link Dialog */}
      {isAddLinkDialogOpen && (
        <div className="modal-overlay" onClick={() => setIsAddLinkDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '32rem' }}>
            <div className="modal-header">
              <h2 className="modal-title">Ajouter un lien utile</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsAddLinkDialogOpen(false)}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label>Sélectionner un lien utile</Label>
                <Select onValueChange={handleAddUsefulLink}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un lien utile" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLinksToAdd.map((link) => (
                      <SelectItem key={link.id} value={link.id}>
                        {link.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddLinkDialogOpen(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

