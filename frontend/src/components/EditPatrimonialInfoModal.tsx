import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Trash2, X } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import '../styles/Modal.css';
import '../styles/Clients.css';

interface EditPatrimonialInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
  clientId: string;
  onUpdate: (updatedClient: any) => void;
}

export function EditPatrimonialInfoModal({
  isOpen,
  onClose,
  client,
  clientId,
  onUpdate
}: EditPatrimonialInfoModalProps) {
  const [newProfession, setNewProfession] = useState('');
  const [formData, setFormData] = useState({
    professionalActivityStatus: '',
    professionalActivityComment: '',
    professions: [] as string[],
    professionsComment: '',
    bankName: '',
    currentAccount: 0,
    livretAB: 0,
    pea: 0,
    pel: 0,
    ldd: 0,
    cel: 0,
    csl: 0,
    securitiesAccount: 0,
    lifeInsurance: 0,
    savingsComment: '',
    totalWealth: 0,
    objectives: [] as string[],
    objectivesComment: '',
    experience: [] as string[],
    experienceComment: '',
    taxOptimization: false,
    taxOptimizationComment: '',
    annualHouseholdIncome: 0
  });

  // Initialize form when modal opens or client changes
  React.useEffect(() => {
    if (isOpen && client) {
      setFormData({
        professionalActivityStatus: client.professionalActivityStatus || '',
        professionalActivityComment: client.professionalActivityComment || '',
        professions: client.professions || [],
        professionsComment: client.professionsComment || '',
        bankName: client.bankName || '',
        currentAccount: client.currentAccount || 0,
        livretAB: client.livretAB || 0,
        pea: client.pea || 0,
        pel: client.pel || 0,
        ldd: client.ldd || 0,
        cel: client.cel || 0,
        csl: client.csl || 0,
        securitiesAccount: client.securitiesAccount || 0,
        lifeInsurance: client.lifeInsurance || 0,
        savingsComment: client.savingsComment || '',
        totalWealth: client.totalWealth || 0,
        objectives: client.objectives || [],
        objectivesComment: client.objectivesComment || '',
        experience: client.experience || [],
        experienceComment: client.experienceComment || '',
        taxOptimization: client.taxOptimization || false,
        taxOptimizationComment: client.taxOptimizationComment || '',
        annualHouseholdIncome: client.annualHouseholdIncome || 0
      });
      setNewProfession('');
    }
  }, [isOpen, client]);

  function addProfession() {
    if (newProfession.trim() && !formData.professions.includes(newProfession.trim())) {
      setFormData({
        ...formData,
        professions: [...formData.professions, newProfession.trim()]
      });
      setNewProfession('');
    }
  }

  function removeProfession(index: number) {
    setFormData({
      ...formData,
      professions: formData.professions.filter((_, i) => i !== index)
    });
  }

  function toggleObjective(objective: string) {
    setFormData({
      ...formData,
      objectives: formData.objectives.includes(objective)
        ? formData.objectives.filter(obj => obj !== objective)
        : [...formData.objectives, objective]
    });
  }

  function toggleExperience(exp: string) {
    setFormData({
      ...formData,
      experience: formData.experience.includes(exp)
        ? formData.experience.filter(e => e !== exp)
        : [...formData.experience, exp]
    });
  }

  function calculateTotalWealth() {
    const total = 
      (formData.currentAccount || 0) +
      (formData.livretAB || 0) +
      (formData.pea || 0) +
      (formData.pel || 0) +
      (formData.ldd || 0) +
      (formData.cel || 0) +
      (formData.csl || 0) +
      (formData.securitiesAccount || 0) +
      (formData.lifeInsurance || 0);
    
    setFormData({ ...formData, totalWealth: total });
  }


  async function handleUpdatePatrimonialInfo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    try {
      const payload: any = {
        professionalActivityStatus: formData.professionalActivityStatus || '',
        professionalActivityComment: formData.professionalActivityComment || '',
        professions: formData.professions || [],
        professionsComment: formData.professionsComment || '',
        bankName: formData.bankName || '',
        currentAccount: formData.currentAccount || 0,
        livretAB: formData.livretAB || 0,
        pea: formData.pea || 0,
        pel: formData.pel || 0,
        ldd: formData.ldd || 0,
        cel: formData.cel || 0,
        csl: formData.csl || 0,
        securitiesAccount: formData.securitiesAccount || 0,
        lifeInsurance: formData.lifeInsurance || 0,
        savingsComment: formData.savingsComment || '',
        totalWealth: formData.totalWealth || 0,
        objectives: formData.objectives || [],
        objectivesComment: formData.objectivesComment || '',
        experience: formData.experience || [],
        experienceComment: formData.experienceComment || '',
        taxOptimization: formData.taxOptimization || false,
        taxOptimizationComment: formData.taxOptimizationComment || '',
        annualHouseholdIncome: formData.annualHouseholdIncome || 0
      };

      const response = await apiCall(`/api/clients/${clientId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response?.client) {
        onUpdate(response.client);
        onClose();
        toast.success('Fiche patrimoniale mise à jour avec succès');
      }
    } catch (error: any) {
      console.error('Error updating patrimonial info:', error);
      toast.error(error?.message || 'Erreur lors de la mise à jour de la fiche patrimoniale');
    }
  }

  if (!isOpen) return null;

  const objectiveOptions = ['Epargne', 'Fructifier', 'Succession'];
  const experienceOptions = ['Bourse', 'Livrets', 'Placements', 'Risque'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '50rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Modifier la fiche patrimoniale</h2>
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
        <form onSubmit={handleUpdatePatrimonialInfo} className="modal-form">
          {/* Activité professionnelle */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Activité professionnelle</h3>
            <div className="modal-form-field">
              <Label>Statut</Label>
              <Select
                value={formData.professionalActivityStatus}
                onValueChange={(value) => setFormData({ ...formData, professionalActivityStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aucune">Aucune</SelectItem>
                  <SelectItem value="En activité">En activité</SelectItem>
                  <SelectItem value="Salarié(e)">Salarié(e)</SelectItem>
                  <SelectItem value="Entrepreneur">Entrepreneur</SelectItem>
                  <SelectItem value="Profession libérale">Profession libérale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="modal-form-field">
              <Label>Commentaire</Label>
              <Textarea
                value={formData.professionalActivityComment}
                onChange={(e) => setFormData({ ...formData, professionalActivityComment: e.target.value })}
                placeholder="Commentaire sur l'activité professionnelle"
              />
            </div>
          </div>

          {/* Métiers */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Métiers</h3>
            <div className="modal-form-field">
              <Label>Métier(s)</Label>
              <div className="flex gap-2">
                <Input
                  value={newProfession}
                  onChange={(e) => setNewProfession(e.target.value)}
                  placeholder="Ajouter un métier"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProfession())}
                />
                <Button type="button" onClick={addProfession} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.professions.map((profession, index) => (
                  <div key={index} className="client-profession-badge">
                    <span>{profession}</span>
                    <button
                      type="button"
                      onClick={() => removeProfession(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-form-field">
              <Label>Commentaire</Label>
              <Textarea
                value={formData.professionsComment}
                onChange={(e) => setFormData({ ...formData, professionsComment: e.target.value })}
                placeholder="Commentaire sur les métiers"
              />
            </div>
          </div>

          {/* Patrimoine */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Patrimoine</h3>
            <div className="modal-form-field">
              <Label>Banque</Label>
              <Input
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                placeholder="Nom de la banque"
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="modal-form-field">
                <Label>Compte courant (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.currentAccount}
                  onChange={(e) => setFormData({ ...formData, currentAccount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="modal-form-field">
                <Label>Livret A/B (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.livretAB}
                  onChange={(e) => setFormData({ ...formData, livretAB: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="modal-form-field">
                <Label>PEA (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.pea}
                  onChange={(e) => setFormData({ ...formData, pea: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="modal-form-field">
                <Label>PEL (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.pel}
                  onChange={(e) => setFormData({ ...formData, pel: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="modal-form-field">
                <Label>LDD (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.ldd}
                  onChange={(e) => setFormData({ ...formData, ldd: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Épargne</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div className="modal-form-field">
                  <Label>CEL (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cel}
                    onChange={(e) => setFormData({ ...formData, cel: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="modal-form-field">
                  <Label>CSL (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.csl}
                    onChange={(e) => setFormData({ ...formData, csl: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="modal-form-field">
                  <Label>Compte titre (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.securitiesAccount}
                    onChange={(e) => setFormData({ ...formData, securitiesAccount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="modal-form-field">
                  <Label>Assurance-vie (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.lifeInsurance}
                    onChange={(e) => setFormData({ ...formData, lifeInsurance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="modal-form-field">
              <Label>Commentaire</Label>
              <Textarea
                value={formData.savingsComment}
                onChange={(e) => setFormData({ ...formData, savingsComment: e.target.value })}
                placeholder="Commentaire sur l'épargne"
              />
            </div>

            <div className="modal-form-field">
              <Label className="font-semibold">Total du patrimoine (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.totalWealth}
                onChange={(e) => setFormData({ ...formData, totalWealth: parseFloat(e.target.value) || 0 })}
              />
              <Button type="button" variant="outline" size="sm" onClick={calculateTotalWealth} className="mt-2">
                Calculer automatiquement
              </Button>
            </div>
          </div>

          {/* Objectifs et expérience */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Objectifs et expérience</h3>
            <div className="modal-form-field">
              <Label>Objectifs</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {objectiveOptions.map((obj) => (
                  <button
                    key={obj}
                    type="button"
                    onClick={() => toggleObjective(obj)}
                    className={`client-badge ${formData.objectives.includes(obj) ? 'active' : ''}`}
                  >
                    {obj}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-form-field">
              <Label>Commentaire</Label>
              <Textarea
                value={formData.objectivesComment}
                onChange={(e) => setFormData({ ...formData, objectivesComment: e.target.value })}
                placeholder="Commentaire sur les objectifs"
              />
            </div>
            <div className="modal-form-field">
              <Label>Expérience</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {experienceOptions.map((exp) => (
                  <button
                    key={exp}
                    type="button"
                    onClick={() => toggleExperience(exp)}
                    className={`client-badge ${formData.experience.includes(exp) ? 'active' : ''}`}
                  >
                    {exp}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-form-field">
              <Label>Commentaire</Label>
              <Textarea
                value={formData.experienceComment}
                onChange={(e) => setFormData({ ...formData, experienceComment: e.target.value })}
                placeholder="Commentaire sur l'expérience"
              />
            </div>
          </div>

          {/* Informations financières */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informations financières</h3>
            <div className="modal-form-field">
              <Label>Défiscalisation</Label>
              <Select
                value={formData.taxOptimization ? 'Oui' : 'Non'}
                onValueChange={(value) => setFormData({ ...formData, taxOptimization: value === 'Oui' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Non">Non</SelectItem>
                  <SelectItem value="Oui">Oui</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="modal-form-field">
              <Label>Commentaire</Label>
              <Textarea
                value={formData.taxOptimizationComment}
                onChange={(e) => setFormData({ ...formData, taxOptimizationComment: e.target.value })}
                placeholder="Commentaire sur la défiscalisation"
              />
            </div>
            <div className="modal-form-field">
              <Label>Revenu annuel du foyer (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.annualHouseholdIncome}
                onChange={(e) => setFormData({ ...formData, annualHouseholdIncome: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="modal-form-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditPatrimonialInfoModal;

