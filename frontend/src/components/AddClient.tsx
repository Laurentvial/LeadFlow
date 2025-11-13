import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { DateInput } from './ui/date-input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ArrowLeft, Save, Key, Upload, ChevronDown, Plus, Trash2, User } from 'lucide-react';
import { apiCall } from '../utils/api';
import { useUsers } from '../hooks/useUsers';
import { toast } from 'sonner';
import '../styles/Clients.css';
import '../styles/PageHeader.css';

export function AddClient() {
  const navigate = useNavigate();
  const { users, loading: usersLoading } = useUsers();
  const [loading, setLoading] = useState(false);
  const [isPatrimonialOpen, setIsPatrimonialOpen] = useState(false);
  const [newProfession, setNewProfession] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    // Informations personnelles
    civility: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    mobile: '',
    platformAccess: true,
    active: true,
    template: '',
    support: '',
    birthDate: '',
    birthPlace: '',
    address: '',
    postalCode: '',
    city: '',
    nationality: '',
    successor: '',
    managerId: '',
    // Fiche patrimoniale (sera remplie via le modal)
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
    annualHouseholdIncome: 0,
  });

  function generateEasyPassword() {
    // Génère un mot de passe facile basé sur le nom/prénom si disponibles
    // Garantit minimum 6 caractères
    const firstName = formData.firstName.trim().toLowerCase();
    const lastName = formData.lastName.trim().toLowerCase();
    
    let easyPassword = 'Client123!';
    
    if (firstName && lastName) {
      // Utilise les 2 premières lettres du prénom et nom + un nombre + un caractère spécial
      const firstPart = firstName.substring(0, 2).toUpperCase();
      const lastPart = lastName.substring(0, 2).toUpperCase();
      const randomNum = Math.floor(Math.random() * 90) + 10; // 10-99
      easyPassword = `${firstPart}${lastPart}${randomNum}!`;
    } else if (firstName) {
      // Utilise les 2 premières lettres du prénom + un nombre à 3 chiffres + un caractère spécial
      const firstPart = firstName.substring(0, 2).toUpperCase();
      const randomNum = Math.floor(Math.random() * 900) + 100; // 100-999
      easyPassword = `${firstPart}${randomNum}!`;
    }
    
    // Vérification de sécurité : garantit au moins 6 caractères
    if (easyPassword.length < 6) {
      easyPassword = 'Client123!';
    }
    
    setFormData({
      ...formData,
      password: easyPassword
    });
    
    toast.success('Mot de passe généré');
  }

  function addProfession() {
    if (newProfession.trim()) {
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
    const objectives = formData.objectives.includes(objective)
      ? formData.objectives.filter(o => o !== objective)
      : [...formData.objectives, objective];
    setFormData({ ...formData, objectives });
  }

  function toggleExperience(exp: string) {
    const experience = formData.experience.includes(exp)
      ? formData.experience.filter(e => e !== exp)
      : [...formData.experience, exp];
    setFormData({ ...formData, experience });
  }

  function calculateTotalWealth() {
    const total = 
      (parseFloat(formData.currentAccount.toString()) || 0) +
      (parseFloat(formData.livretAB.toString()) || 0) +
      (parseFloat(formData.pea.toString()) || 0) +
      (parseFloat(formData.pel.toString()) || 0) +
      (parseFloat(formData.ldd.toString()) || 0) +
      (parseFloat(formData.cel.toString()) || 0) +
      (parseFloat(formData.csl.toString()) || 0) +
      (parseFloat(formData.securitiesAccount.toString()) || 0) +
      (parseFloat(formData.lifeInsurance.toString()) || 0);
    
    setFormData({ ...formData, totalWealth: total });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner un fichier image');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('L\'image ne doit pas dépasser 5MB');
        return;
      }
      setProfilePhoto(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (formData.password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    try {
      // Use FormData if photo is uploaded, otherwise use JSON
      if (profilePhoto) {
        const formDataToSend = new FormData();
        formDataToSend.append('profilePhoto', profilePhoto);
        formDataToSend.append('civility', formData.civility || '');
        formDataToSend.append('firstName', formData.firstName);
        formDataToSend.append('lastName', formData.lastName);
        formDataToSend.append('email', formData.email);
        formDataToSend.append('password', formData.password);
        formDataToSend.append('phone', formData.phone || '');
        formDataToSend.append('mobile', formData.mobile || '');
        formDataToSend.append('platformAccess', formData.platformAccess.toString());
        formDataToSend.append('active', formData.active.toString());
        formDataToSend.append('template', formData.template || '');
        formDataToSend.append('support', formData.support || '');
        formDataToSend.append('birthDate', formData.birthDate || '');
        formDataToSend.append('birthPlace', formData.birthPlace || '');
        formDataToSend.append('address', formData.address || '');
        formDataToSend.append('postalCode', formData.postalCode || '');
        formDataToSend.append('city', formData.city || '');
        formDataToSend.append('nationality', formData.nationality || '');
        formDataToSend.append('successor', formData.successor || '');
        formDataToSend.append('managerId', formData.managerId || '');
        // Fiche patrimoniale
        formDataToSend.append('professionalActivityStatus', formData.professionalActivityStatus || '');
        formDataToSend.append('professionalActivityComment', formData.professionalActivityComment || '');
        formData.professions.forEach(prof => formDataToSend.append('professions', prof));
        formDataToSend.append('professionsComment', formData.professionsComment || '');
        formDataToSend.append('bankName', formData.bankName || '');
        formDataToSend.append('currentAccount', formData.currentAccount.toString());
        formDataToSend.append('livretAB', formData.livretAB.toString());
        formDataToSend.append('pea', formData.pea.toString());
        formDataToSend.append('pel', formData.pel.toString());
        formDataToSend.append('ldd', formData.ldd.toString());
        formDataToSend.append('cel', formData.cel.toString());
        formDataToSend.append('csl', formData.csl.toString());
        formDataToSend.append('securitiesAccount', formData.securitiesAccount.toString());
        formDataToSend.append('lifeInsurance', formData.lifeInsurance.toString());
        formDataToSend.append('savingsComment', formData.savingsComment || '');
        formDataToSend.append('totalWealth', formData.totalWealth.toString());
        formData.objectives.forEach(obj => formDataToSend.append('objectives', obj));
        formDataToSend.append('objectivesComment', formData.objectivesComment || '');
        formData.experience.forEach(exp => formDataToSend.append('experience', exp));
        formDataToSend.append('experienceComment', formData.experienceComment || '');
        formDataToSend.append('taxOptimization', formData.taxOptimization.toString());
        formDataToSend.append('taxOptimizationComment', formData.taxOptimizationComment || '');
        formDataToSend.append('annualHouseholdIncome', formData.annualHouseholdIncome.toString());

        const response = await apiCall('/api/clients/create/', {
          method: 'POST',
          body: formDataToSend
        });
      } else {
        // Ensure all fields are included in the payload
        const payload = {
          // Informations personnelles
          civility: formData.civility || '',
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone || '',
          mobile: formData.mobile || '',
          platformAccess: formData.platformAccess,
          active: formData.active,
          template: formData.template || '',
          support: formData.support || '',
          birthDate: formData.birthDate || '',
          birthPlace: formData.birthPlace || '',
          address: formData.address || '',
          postalCode: formData.postalCode || '',
          city: formData.city || '',
          nationality: formData.nationality || '',
          successor: formData.successor || '',
          managerId: formData.managerId || '',
          // Fiche patrimoniale
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
          annualHouseholdIncome: formData.annualHouseholdIncome || 0,
        };

        // Utilise apiCall (fetch-based) et non axios
        const response = await apiCall('/api/clients/create/', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      toast.success('Client créé avec succès');
      navigate('/clients');
    } catch (error: any) {
      console.error('Error creating client:', error);
      let errorMessage = 'Erreur lors de la création du client';
      
      // apiCall throws Error with response property attached
      if (error.response) {
        // Backend error response from serializer
        if (error.response.error) {
          errorMessage = error.response.error;
        } else if (error.response.detail) {
          errorMessage = error.response.detail;
        } else if (error.response.message) {
          errorMessage = error.response.message;
        }
        
        // Check for validation errors from serializer
        if (error.response.email) {
          errorMessage = `Email: ${Array.isArray(error.response.email) ? error.response.email[0] : error.response.email}`;
        } else if (error.response.fname) {
          errorMessage = `Prénom: ${Array.isArray(error.response.fname) ? error.response.fname[0] : error.response.fname}`;
        } else if (error.response.lname) {
          errorMessage = `Nom: ${Array.isArray(error.response.lname) ? error.response.lname[0] : error.response.lname}`;
        }
      } else if (error.message) {
        // Error message from apiCall utility
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/clients')}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="page-title-section">
          <h1 className="page-title">Nouveau client</h1>
          <p className="page-subtitle">Remplissez le formulaire pour créer un nouveau client</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations personnelles */}
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Photo de profil */}
            <div className="space-y-2">
              <Label>Photo de profil</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4">
                  {profilePhotoPreview ? (
                    <div className="client-profile-photo-container">
                      <img 
                        src={profilePhotoPreview} 
                        alt="Preview" 
                        className="client-profile-photo-preview"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setProfilePhoto(null);
                          setProfilePhotoPreview(null);
                        }}
                        className="client-profile-photo-remove-btn"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                
                </div>
                
              </div>
              <div>
                    <input
                      type="file"
                      id="profilePhoto"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => document.getElementById('profilePhoto')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {profilePhoto ? 'Changer la photo' : 'Télécharger une photo'}
                    </Button>
                  </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="civility">Civilité</Label>
                <Select
                  value={formData.civility}
                  onValueChange={(value) => setFormData({ ...formData, civility: value })}
                >
                  <SelectTrigger id="civility">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monsieur">Monsieur</SelectItem>
                    <SelectItem value="Madame">Madame</SelectItem>
                    <SelectItem value="Mademoiselle">Mademoiselle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  placeholder="Prénom du client"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  placeholder="Nom du client"
                />
              </div>

            </div>



            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthDate">Date de naissance</Label>
                <DateInput
                  id="birthDate"
                  value={formData.birthDate}
                  onChange={(value) => setFormData({ ...formData, birthDate: value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthPlace">Lieu de naissance</Label>
                <Input
                  id="birthPlace"
                  value={formData.birthPlace}
                  onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                  placeholder="Lieu de naissance"
                />
              </div>
            </div>



            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


              <div className="space-y-2">
                <Label htmlFor="nationality">Nationalité</Label>
                <Input
                  id="nationality"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  placeholder="Française"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="successor">Successeur</Label>
                <Input
                  id="successor"
                  value={formData.successor}
                  onChange={(e) => setFormData({ ...formData, successor: e.target.value })}
                  placeholder="Nom du successeur"
                />
              </div>
            </div>


          </CardContent>
        </Card>

        {/* Informations de contact */}
        <Card>
          <CardHeader>
            <CardTitle>Informations de contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="01 23 45 67 89"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">Portable</Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="06 12 34 56 78"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Adresse complète"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="75001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Paris"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authentification */}
        <Card>
          <CardHeader>
            <CardTitle>Authentification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateEasyPassword}
                  className="h-8 text-xs"
                >
                  <Key className="w-3 h-3 mr-1" />
                  Générer
                </Button>
              </div>
              <Input
                id="password"
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="Entrez le mot de passe"
                minLength={6}
              />
              <p className="text-xs text-slate-500">Minimum 6 caractères</p>
            </div>
          </CardContent>
        </Card>

        {/* Organisation */}
        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="managerId">Gestionnaire</Label>
                <Select
                  value={formData.managerId || 'none'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, managerId: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger id="managerId">
                    <SelectValue placeholder="Sélectionner un gestionnaire" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun gestionnaire</SelectItem>
                    {usersLoading ? (
                      <SelectItem value="loading" disabled>Chargement...</SelectItem>
                    ) : (
                      users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connexion et paramètres */}
        <Card>
          <CardHeader>
            <CardTitle>Connexion et paramètres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="platformAccess"
                checked={formData.platformAccess}
                onChange={(e) => setFormData({ ...formData, platformAccess: e.target.checked })}
                className="client-checkbox"
              />
              <Label htmlFor="platformAccess" className="cursor-pointer">
                Connexion à la plateforme
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="client-checkbox"
              />
              <Label htmlFor="active" className="cursor-pointer">
                Actif
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Input
                  id="template"
                  value={formData.template}
                  onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  placeholder="Template"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="support">Support</Label>
                <Input
                  id="support"
                  value={formData.support}
                  onChange={(e) => setFormData({ ...formData, support: e.target.value })}
                  placeholder="Support"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fiche patrimoniale */}
        <Collapsible open={isPatrimonialOpen} onOpenChange={setIsPatrimonialOpen}>
        <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between pb-6">
            <CardTitle>Fiche patrimoniale</CardTitle>
                    <ChevronDown className={`client-chevron ${isPatrimonialOpen ? 'open' : ''}`} />
                </div>
          </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Activité professionnelle */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Activité professionnelle</h3>
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label>Banque</Label>
                    <Input
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="Nom de la banque"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Compte courant (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.currentAccount}
                        onChange={(e) => setFormData({ ...formData, currentAccount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Livret A/B (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.livretAB}
                        onChange={(e) => setFormData({ ...formData, livretAB: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>PEA (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.pea}
                        onChange={(e) => setFormData({ ...formData, pea: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>PEL (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.pel}
                        onChange={(e) => setFormData({ ...formData, pel: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>CEL (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.cel}
                          onChange={(e) => setFormData({ ...formData, cel: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CSL (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.csl}
                          onChange={(e) => setFormData({ ...formData, csl: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Compte titre (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.securitiesAccount}
                          onChange={(e) => setFormData({ ...formData, securitiesAccount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
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

                  <div className="space-y-2">
                    <Label>Commentaire</Label>
                    <Textarea
                      value={formData.savingsComment}
                      onChange={(e) => setFormData({ ...formData, savingsComment: e.target.value })}
                      placeholder="Commentaire sur l'épargne"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold">Total du patrimoine (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.totalWealth}
                      onChange={(e) => setFormData({ ...formData, totalWealth: parseFloat(e.target.value) || 0 })}
                      readOnly
                      className="bg-slate-50"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={calculateTotalWealth}>
                      Calculer automatiquement
            </Button>
                  </div>
                </div>

                {/* Objectifs et expérience */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Objectifs et expérience</h3>
                  <div className="space-y-2">
                    <Label>Objectifs</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Epargne', 'Fructifier', 'Succession'].map((obj) => (
                        <button
                          key={obj}
                          type="button"
                          onClick={() => toggleObjective(obj)}
                          className={`client-badge ${
                            formData.objectives.includes(obj) ? 'active' : ''
                          }`}
                        >
                          {obj}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Commentaire</Label>
                    <Textarea
                      value={formData.objectivesComment}
                      onChange={(e) => setFormData({ ...formData, objectivesComment: e.target.value })}
                      placeholder="Commentaire sur les objectifs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expérience</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Bourse', 'Livrets', 'Placements', 'Risque'].map((exp) => (
                        <button
                          key={exp}
                          type="button"
                          onClick={() => toggleExperience(exp)}
                          className={`client-badge ${
                            formData.experience.includes(exp) ? 'active' : ''
                          }`}
                        >
                          {exp}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label>Commentaire</Label>
                    <Textarea
                      value={formData.taxOptimizationComment}
                      onChange={(e) => setFormData({ ...formData, taxOptimizationComment: e.target.value })}
                      placeholder="Commentaire sur la défiscalisation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Revenu annuel du foyer (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.annualHouseholdIncome}
                      onChange={(e) => setFormData({ ...formData, annualHouseholdIncome: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
          </CardContent>
            </CollapsibleContent>
        </Card>
        </Collapsible>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/clients')}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              'Création...'
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Créer le client
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default AddClient;

