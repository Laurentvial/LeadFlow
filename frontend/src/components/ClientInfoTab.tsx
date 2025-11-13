import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Pencil, ChevronDown } from 'lucide-react';
import { ClientWallet } from './ClientWallet';
import { ClientManagementInfo } from './ClientManagementInfo';
import { EditClientManagementModal } from './EditClientManagementModal';

import '../styles/Clients.css';

interface ClientInfoTabProps {
  client: any;
  onOpenEditPersonalInfo: () => void;
  onOpenEditPatrimonialInfo: () => void;
  onClientUpdated?: () => void;
}

export function ClientInfoTab({ client, onOpenEditPersonalInfo, onOpenEditPatrimonialInfo, onClientUpdated }: ClientInfoTabProps) {
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
              <p>{client.civility || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Prénom / Nom</Label>
              <p>{client.firstName} {client.lastName}</p>
            </div>
            <div>
              <Label className="text-slate-600">Template</Label>
              <p>{client.template || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Support</Label>
              <p>{client.support || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Mot de passe</Label>
              <p className="font-mono text-sm">{client.password || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Téléphone</Label>
              <p>{client.phone || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Portable</Label>
              <p>{client.mobile || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">E-mail</Label>
              <p>{client.email || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Date de naissance</Label>
              <p>{(() => {
                if (!client.birthDate) return '-';
                const date = new Date(client.birthDate);
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
              <p>{client.birthPlace || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Adresse</Label>
              <p>{client.address || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Code postal</Label>
              <p>{client.postalCode || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Ville</Label>
              <p>{client.city || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Nationalité</Label>
              <p>{client.nationality || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Successeur</Label>
              <p>{client.successor || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Date d'inscription</Label>
              <p>{new Date(client.createdAt).toLocaleDateString('fr-FR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric'
              })}</p>
            </div>
          </div>
        </CardContent>
      </Card>

        {/* Wallet Container */}
        <ClientWallet client={client} />
      </div>

      
      {/* Client Management Info */}
      {client && (
        <ClientManagementInfo 
          client={client}
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
                  <ChevronDown className={`client-chevron ${isPatrimonialOpen ? 'open' : ''}`} />
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
                  <p>{client.professionalActivityStatus || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Commentaire</Label>
                  <p>{client.professionalActivityComment || '-'}</p>
                </div>
              </div>

              {/* Métiers */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Métiers</h3>
                <div>
                  <Label className="text-slate-600">Métier(s)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {client.professions && client.professions.length > 0 ? (
                      client.professions.map((profession: string, index: number) => (
                        <div key={index} className="client-profession-badge">
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
                  <p>{client.professionsComment || '-'}</p>
                </div>
              </div>

              {/* Patrimoine */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Patrimoine</h3>
                <div>
                  <Label className="text-slate-600">Banque</Label>
                  <p>{client.bankName || '-'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-600">Compte courant (€)</Label>
                    <p>{(client.currentAccount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">Livret A/B (€)</Label>
                    <p>{(client.livretAB || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">PEA (€)</Label>
                    <p>{(client.pea || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">PEL (€)</Label>
                    <p>{(client.pel || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">LDD (€)</Label>
                    <p>{(client.ldd || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Épargne</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-600">CEL (€)</Label>
                      <p>{(client.cel || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">CSL (€)</Label>
                      <p>{(client.csl || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Compte titre (€)</Label>
                      <p>{(client.securitiesAccount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600">Assurance-vie (€)</Label>
                      <p>{(client.lifeInsurance || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-600">Commentaire</Label>
                  <p>{client.savingsComment || '-'}</p>
                </div>

                <div>
                  <Label className="font-semibold">Total du patrimoine (€)</Label>
                  <p className="text-lg font-bold">{(client.totalWealth || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Objectifs et expérience */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Objectifs et expérience</h3>
                <div>
                  <Label className="text-slate-600">Objectifs</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {client.objectives && client.objectives.length > 0 ? (
                      client.objectives.map((obj: string, index: number) => (
                        <div key={index} className="client-badge">
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
                  <p>{client.objectivesComment || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Expérience</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {client.experience && client.experience.length > 0 ? (
                      client.experience.map((exp: string, index: number) => (
                        <div key={index} className="client-badge">
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
                  <p>{client.experienceComment || '-'}</p>
                </div>
              </div>

              {/* Informations financières */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informations financières</h3>
                <div>
                  <Label className="text-slate-600">Défiscalisation</Label>
                  <p>{client.taxOptimization !== undefined ? (client.taxOptimization ? 'Oui' : 'Non') : '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Commentaire</Label>
                  <p>{client.taxOptimizationComment || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Revenu annuel du foyer (€)</Label>
                  <p>{(client.annualHouseholdIncome || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      
      {/* Edit Management Modal */}
      <EditClientManagementModal
        isOpen={isEditManagementOpen}
        onClose={() => setIsEditManagementOpen(false)}
        client={client}
        onClientUpdated={() => {
          setIsEditManagementOpen(false);
          if (onClientUpdated) {
            onClientUpdated();
          }
        }}
      />
    </div>
    
  );
}

