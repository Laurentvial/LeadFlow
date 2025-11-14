import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Pencil, ChevronDown } from 'lucide-react';
import { ContactWallet } from './ContactWallet';
import { ContactManagementInfo } from './ContactManagementInfo';
import { EditContactManagementModal } from './EditContactManagementModal';

import '../styles/Contacts.css';

interface ContactInfoTabProps {
  contact: any;
  onOpenEditPersonalInfo: () => void;
  onOpenEditPatrimonialInfo: () => void;
  onContactUpdated?: () => void;
}

export function ContactInfoTab({ contact, onOpenEditPersonalInfo, onOpenEditPatrimonialInfo, onContactUpdated }: ContactInfoTabProps) {
  const [isPatrimonialOpen, setIsPatrimonialOpen] = useState(false);
  const [isEditManagementOpen, setIsEditManagementOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Two column layout: Personal Info on left, Wallet on right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Informations personnelles</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenEditPersonalInfo}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Éditer
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Civilité</Label>
              <p>{contact.civility || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Prénom / Nom</Label>
              <p>{contact.firstName} {contact.lastName}</p>
            </div>
            <div>
              <Label className="text-slate-600">Template</Label>
              <p>{contact.template || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Support</Label>
              <p>{contact.support || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Mot de passe</Label>
              <p className="font-mono text-sm">{contact.password || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Téléphone</Label>
              <p>{contact.phone || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Portable</Label>
              <p>{contact.mobile || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">E-mail</Label>
              <p>{contact.email || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Date de naissance</Label>
              <p>{(() => {
                if (!contact.birthDate) return '-';
                const date = new Date(contact.birthDate);
                if (isNaN(date.getTime())) return '-';
                return date.toLocaleDateString('fr-FR', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric'
                });
              })()}</p>
            </div>
            <div>
              <Label className="text-slate-600">Lieu de naissance</Label>
              <p>{contact.birthPlace || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Adresse</Label>
              <p>{contact.address || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Code postal</Label>
              <p>{contact.postalCode || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Ville</Label>
              <p>{contact.city || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Nationalité</Label>
              <p>{contact.nationality || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Successeur</Label>
              <p>{contact.successor || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Date d'inscription</Label>
              <p>{new Date(contact.createdAt).toLocaleDateString('fr-FR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric'
              })}</p>
            </div>
          </div>
        </CardContent>
      </Card>

        {/* Wallet Container */}
        <ContactWallet contact={contact} />
      </div>

      
      {/* Contact Management Info */}
      {contact && (
        <ContactManagementInfo 
          contact={contact}
          onEdit={() => setIsEditManagementOpen(true)}
        />
      )}

      {/* Fiche patrimoniale */}
      <Collapsible open={isPatrimonialOpen} onOpenChange={setIsPatrimonialOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between pb-6">
                <CardTitle>Fiche patrimoniale</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEditPatrimonialInfo();
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Éditer
                  </Button>
                  <ChevronDown className={`contact-chevron ${isPatrimonialOpen ? 'open' : ''}`} />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Activité professionnelle */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Activité professionnelle</h3>
                <div>
                  <Label className="text-slate-600">Statut</Label>
                  <p>{contact.professionalActivityStatus || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Commentaire</Label>
                  <p>{contact.professionalActivityComment || '-'}</p>
                </div>
              </div>

              {/* Métiers */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Métiers</h3>
                <div>
                  <Label className="text-slate-600">Métier(s)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {contact.professions && contact.professions.length > 0 ? (
                      contact.professions.map((profession: string, index: number) => (
                        <div key={index} className="contact-profession-badge">
                          <span>{profession}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-600">Commentaire</Label>
                  <p>{contact.professionsComment || '-'}</p>
                </div>
              </div>

              {/* Patrimoine */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Patrimoine</h3>
                <div>
                  <Label className="text-slate-600">Banque</Label>
                  <p>{contact.bankName || '-'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-600">Compte courant (€)</Label>
                    <p>{(contact.currentAccount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">Livret A/B (€)</Label>
                    <p>{(contact.livretAB || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">PEA (€)</Label>
                    <p>{(contact.pea || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">PEL (€)</Label>
                    <p>{(contact.pel || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">LDD (€)</Label>
                    <p>{(contact.ldd || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Épargne</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-600">CEL (€)</Label>
                      <p>{(contact.cel || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">CSL (€)</Label>
                      <p>{(contact.csl || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Compte titre (€)</Label>
                      <p>{(contact.securitiesAccount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Assurance-vie (€)</Label>
                      <p>{(contact.lifeInsurance || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-600">Commentaire</Label>
                  <p>{contact.savingsComment || '-'}</p>
                </div>

                <div>
                  <Label className="font-semibold">Total du patrimoine (€)</Label>
                  <p className="text-lg font-bold">{(contact.totalWealth || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Objectifs et expérience */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Objectifs et expérience</h3>
                <div>
                  <Label className="text-slate-600">Objectifs</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {contact.objectives && contact.objectives.length > 0 ? (
                      contact.objectives.map((obj: string, index: number) => (
                        <div key={index} className="contact-badge">
                          {obj}
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-600">Commentaire</Label>
                  <p>{contact.objectivesComment || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Expérience</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {contact.experience && contact.experience.length > 0 ? (
                      contact.experience.map((exp: string, index: number) => (
                        <div key={index} className="contact-badge">
                          {exp}
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-600">Commentaire</Label>
                  <p>{contact.experienceComment || '-'}</p>
                </div>
              </div>

              {/* Informations financières */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informations financières</h3>
                <div>
                  <Label className="text-slate-600">Défiscalisation</Label>
                  <p>{contact.taxOptimization !== undefined ? (contact.taxOptimization ? 'Oui' : 'Non') : '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Commentaire</Label>
                  <p>{contact.taxOptimizationComment || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Revenu annuel du foyer (€)</Label>
                  <p>{(contact.annualHouseholdIncome || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      
      {/* Edit Management Modal */}
      <EditContactManagementModal
        isOpen={isEditManagementOpen}
        onClose={() => setIsEditManagementOpen(false)}
        contact={contact}
        onContactUpdated={() => {
          setIsEditManagementOpen(false);
          if (onContactUpdated) {
            onContactUpdated();
          }
        }}
      />
    </div>
    
  );
}


