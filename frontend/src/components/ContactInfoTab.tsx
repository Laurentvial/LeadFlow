import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Pencil } from 'lucide-react';

import '../styles/Contacts.css';

interface ContactInfoTabProps {
  contact: any;
  onOpenEditPersonalInfo: () => void;
  onContactUpdated?: () => void;
}

export function ContactInfoTab({ contact, onOpenEditPersonalInfo, onContactUpdated }: ContactInfoTabProps) {

  return (
    <div className="space-y-6">
      {/* 1. Informations générales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>1. Informations générales</CardTitle>
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
              <Label className="text-slate-600">Statut</Label>
              <p>
                <span 
                  style={{
                    backgroundColor: contact.statusColor || '#e5e7eb',
                    color: contact.statusColor ? '#000000' : '#374151',
                    padding: '4px 12px',
                    marginTop: '5px',
                    borderRadius: '5px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'inline-block'
                  }}
                >
                  {contact.statusName || '-'}
                </span>
              </p>
            </div>
            <div>
              <Label className="text-slate-600">Civilité</Label>
              <p>{contact.civility || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Prénom</Label>
              <p>{contact.firstName || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Nom</Label>
              <p>{contact.lastName || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Email</Label>
              <p>{contact.email || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Portable</Label>
              <p>{contact.mobile || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Téléphone</Label>
              <p>{contact.phone || '-'}</p>
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
              <Label className="text-slate-600">Nationalité</Label>
              <p>{contact.nationality || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Adresse */}
      <Card>
        <CardHeader>
          <CardTitle>2. Adresse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Adresse</Label>
              <p>{contact.address || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Complément d'adresse</Label>
              <p>{contact.addressComplement || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Code postal</Label>
              <p>{contact.postalCode || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Ville</Label>
              <p>{contact.city || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Gestion */}
      <Card>
        <CardHeader>
          <CardTitle>3. Gestion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Source</Label>
              <p>{contact.source || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Campagne</Label>
              <p>{contact.campaign || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Téléopérateur</Label>
              <p>{contact.teleoperatorName || contact.managerName || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-600">Confirmateur</Label>
              <p>{contact.confirmateurName || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


