import React from 'react';
import { Calendar as CalendarIcon, Clock, User, Pencil } from 'lucide-react';
import { Button } from './ui/button';

interface AppointmentCardProps {
  appointment: {
    id: string;
    datetime: string;
    comment?: string;
    created_at?: string;
    createdBy?: string;
    assignedTo?: string;
    clientName?: string;
    contactName?: string;
  };
  showActions?: boolean;
  onEdit?: (appointment: any) => void;
  onDelete?: (appointmentId: string) => void;
  variant?: 'default' | 'planning';
}

export function AppointmentCard({ 
  appointment, 
  showActions = false, 
  onEdit, 
  onDelete,
  variant = 'default'
}: AppointmentCardProps) {
  const datetime = new Date(appointment.datetime);
  const isPast = datetime < new Date();
  const contactName = appointment.clientName || appointment.contactName;

  // Use consistent styling regardless of variant
  const cardClasses = `p-4 border ${
    isPast 
      ? 'border-slate-300 bg-slate-50 opacity-60' 
      : 'border-slate-200'
  }`;

  return (
    <div className={cardClasses}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CalendarIcon className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-600'}`} />
            <p className={`font-medium ${isPast ? 'text-slate-500' : ''}`}>
              {datetime.toLocaleDateString('fr-FR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric'
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-600'}`} />
            <p className={`text-sm ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
              {datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
          </div>
          {contactName && (
            <div className="flex items-center gap-2 mt-1">
              <User className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-600'}`} />
              <p className={`text-sm ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                {contactName}
              </p>
            </div>
          )}
        </div>
        {showActions && (onEdit || onDelete) && (
          <div className="flex gap-2 ml-4">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(appointment)}
                className={isPast ? 'opacity-50' : ''}
                title="Modifier"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(appointment.id)}
                className={`h-auto p-0 text-red-600 hover:text-red-700 ${isPast ? 'opacity-50' : ''}`}
                title="Supprimer"
                style={{ fontSize: '7px' }}
              >
                Supprimer
              </Button>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-2 space-y-1">
        {appointment.assignedTo && (
          <p className={`text-xs ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
            Assigné à: <span className="font-medium">{appointment.assignedTo}</span>
          </p>
        )}
        {appointment.created_at && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
              {new Date(appointment.created_at).toLocaleString('fr-FR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            {appointment.createdBy && (
              <span className={`text-xs ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                • {appointment.createdBy}
              </span>
            )}
          </div>
        )}
      </div>
      
      {appointment.comment && (
        <p className={`text-sm mt-2 whitespace-pre-wrap ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
          {appointment.comment}
        </p>
      )}
    </div>
  );
}

