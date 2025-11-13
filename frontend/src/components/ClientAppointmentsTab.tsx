import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ClientAppointmentsTabProps {
  appointments: any[];
}

export function ClientAppointmentsTab({ appointments }: ClientAppointmentsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rendez-vous</CardTitle>
      </CardHeader>
      <CardContent>
        {appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((apt) => {
              const datetime = new Date(apt.datetime);
              return (
                <div key={apt.id} className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p>{datetime.toLocaleDateString('fr-FR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric'
                      })}</p>
                      <p className="text-sm text-slate-600">
                        {datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </p>
                    </div>
                  </div>
                  {apt.comment && (
                    <p className="text-sm text-slate-600">{apt.comment}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucun rendez-vous</p>
        )}
      </CardContent>
    </Card>
  );
}

