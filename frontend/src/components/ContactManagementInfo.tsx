import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { User, Users, Edit } from 'lucide-react';

interface ContactManagementInfoProps {
  contact: any;
  onEdit: () => void;
}

export function ContactManagementInfo({ contact, onEdit }: ContactManagementInfoProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gestion</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
        >
          <Edit className="w-4 h-4 mr-2" />
          Modifier
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-slate-500" />
              <Label className="text-slate-600 font-semibold">Gestionnaire</Label>
            </div>
            <p className="text-slate-900">
              {contact?.managerName || contact?.manager || '-'}
            </p>
            {contact?.managerEmail && (
              <p className="text-sm text-slate-500">{contact.managerEmail}</p>
            )}
            {contact?.managerTeamName && (
              <p className="text-sm text-slate-500">
                {contact.managerTeamName}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-600 font-semibold">Source</Label>
            <p className="text-slate-900">
              {contact?.source || '-'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


