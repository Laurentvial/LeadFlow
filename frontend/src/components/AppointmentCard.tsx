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
    contactId?: string;
    clientId_read?: string;
  };
  showActions?: boolean;
  onEdit?: (appointment: any) => void;
  onDelete?: (appointmentId: string) => void;
  variant?: 'default' | 'planning';
  notes?: Array<{
    id: string;
    text: string;
    createdAt?: string;
    created_at?: string;
    createdBy?: string;
    categoryName?: string;
  }>;
  contactStatus?: {
    id: string | null;
    name: string | null;
    color: string | null;
  };
}

export function AppointmentCard({ 
  appointment, 
  showActions = false, 
  onEdit, 
  onDelete,
  variant = 'default',
  notes = [],
  contactStatus
}: AppointmentCardProps) {
  // Debug logging
  if (contactStatus) {
    console.log('[AppointmentCard] Rendering with contactStatus:', contactStatus);
  }
  const datetime = new Date(appointment.datetime);
  const isPast = datetime < new Date();
  const contactName = appointment.clientName || appointment.contactName;
  const contactId = appointment.contactId || appointment.clientId_read;

  const handleContactClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contactId) {
      window.open(`/contacts/${contactId}`, '_blank', 'width=1200,height=900,resizable=yes,scrollbars=yes');
    }
  };

  // Use consistent styling regardless of variant
  const cardClasses = `p-4 border ${
    isPast 
      ? 'border-slate-300 bg-slate-100 opacity-50' 
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
            <span className={`text-slate-400 ${isPast ? 'opacity-40' : ''}`}>•</span>
            <div className="flex items-center gap-1">
              <Clock className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-600'}`} />
              <p className={`text-sm ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                {datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </p>
            </div>
            {contactName && (
              <>
                <span className={`text-slate-400 ${isPast ? 'opacity-40' : ''}`}>•</span>
                <div className="flex items-center gap-1">
                  <User className={`w-4 h-4 ${isPast ? 'text-slate-400' : 'text-slate-600'}`} />
                  <p 
                    className={`text-sm ${isPast ? 'text-slate-400' : 'text-slate-600'} ${contactId ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={contactId ? handleContactClick : undefined}
                    title={contactId ? 'Cliquer pour ouvrir les détails du contact' : undefined}
                  >
                    {contactName}
                  </p>
                </div>
              </>
            )}
            {appointment.assignedTo && (
              <>
                <span className={`text-slate-400 ${isPast ? 'opacity-40' : ''}`}>•</span>
                <p className={`text-sm ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                  Assigné à: <span className="font-medium">{appointment.assignedTo}</span>
                </p>
              </>
            )}
            {contactStatus?.name && (
              <>
                <span className={`text-slate-400 ${isPast ? 'opacity-40' : ''}`}>•</span>
                <span 
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${isPast ? 'opacity-60' : ''}`}
                  style={{
                    backgroundColor: contactStatus.color || '#e5e7eb',
                    color: contactStatus.color ? '#000000' : '#374151'
                  }}
                  title={contactStatus.name.length > 15 ? contactStatus.name : undefined}
                >
                  {contactStatus.name.length > 15 ? `${contactStatus.name.substring(0, 15)}...` : contactStatus.name}
                </span>
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
                    className={`h-auto p-0 hover:text-black hover:bg-transparent cursor-pointer text-slate-600 ${isPast ? 'opacity-40' : ''}`}
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
                    className={`h-auto p-0 text-red-600 hover:opacity-70 hover:bg-transparent cursor-pointer ${isPast ? 'opacity-40' : ''}`}
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
      
      {notes && notes.length > 0 && (
        <div className={`mt-4 pt-4 border-t border-slate-200 ${appointment.comment ? '' : 'mt-3'}`}>
          <p className={`text-xs font-semibold mb-2 ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
            Dernières notes ({notes.length})
          </p>
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className={`text-xs ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                {/* Metadata (category, createdBy, createdAt) */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {note.categoryName && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isPast ? 'bg-slate-200 text-slate-500 opacity-60' : 'bg-blue-100 text-blue-700'}`}>
                      {note.categoryName}
                    </span>
                  )}
                  {(note.createdBy || note.created_at || note.createdAt) && (
                    <span className={`text-xs whitespace-nowrap ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
                      {note.createdBy && `${note.createdBy} • `}
                      {new Date(note.createdAt || note.created_at || '').toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </span>
                  )}
                </div>
                {/* Note content */}
                <div className="mt-1">
                  <p className={`text-xs ${isPast ? 'text-slate-400' : 'text-slate-600'}`} style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {note.text && note.text.length > 100 ? `${note.text.substring(0, 100)}...` : note.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

