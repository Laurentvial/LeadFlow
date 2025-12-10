import React from 'react';
import { Calendar as CalendarIcon, Clock, User } from 'lucide-react';
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
      <div className="flex items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <CalendarIcon className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-600'}`} />
              <p className={`font-medium text-sm ${isPast ? 'text-slate-500' : 'text-slate-700'}`}>
                {datetime.toLocaleDateString('fr-FR', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric'
                })}
              </p>
            </div>
            <span className={`text-slate-400 ${isPast ? 'opacity-50' : ''}`}>•</span>
            <div className="flex items-center gap-1">
              <Clock className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-600'}`} />
              <p className={`text-sm ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                {datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </p>
            </div>
            {contactName && (
              <>
                <span className={`text-slate-400 ${isPast ? 'opacity-50' : ''}`}>•</span>
                <div className="flex items-center gap-1">
                  <User className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-600'}`} />
                  <p className={`text-sm ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                    {contactName}
                  </p>
                </div>
              </>
            )}
            {appointment.assignedTo && (
              <>
                <span className={`text-slate-400 ${isPast ? 'opacity-50' : ''}`}>•</span>
                <p className={`text-sm ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                  Assigné à: <span className="font-medium">{appointment.assignedTo}</span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-2 space-y-1">
        {appointment.created_at && (
          <div className="flex items-center justify-between gap-2">
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
            {showActions && (onEdit || onDelete) && (
              <div className="flex gap-2">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(appointment)}
                    className={`h-auto p-0 hover:text-black hover:bg-transparent cursor-pointer text-slate-600 ${isPast ? 'opacity-50' : ''}`}
                    title="Modifier"
                    style={{ fontSize: '12px' }}
                  >
                    Modifier
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(appointment.id)}
                    className={`h-auto p-0 text-red-600 hover:opacity-70 hover:bg-transparent cursor-pointer ${isPast ? 'opacity-50' : ''}`}
                    title="Supprimer"
                    style={{ fontSize: '12px' }}
                  >
                    Supprimer
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        {!appointment.created_at && showActions && (onEdit || onDelete) && (
          <div className="flex gap-2 justify-end">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(appointment)}
                className={`h-auto p-0 hover:text-black hover:bg-transparent cursor-pointer text-slate-600 ${isPast ? 'opacity-50' : ''}`}
                title="Modifier"
                style={{ fontSize: '12px' }}
              >
                Modifier
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(appointment.id)}
                className={`h-auto p-0 text-red-600 hover:opacity-70 hover:bg-transparent cursor-pointer ${isPast ? 'opacity-50' : ''}`}
                title="Supprimer"
                style={{ fontSize: '12px' }}
              >
                Supprimer
              </Button>
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

