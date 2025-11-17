import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { X } from 'lucide-react';
import { apiCall } from '../utils/api';
import LoadingIndicator from './LoadingIndicator';
import '../styles/Modal.css';

interface ContactHistoryTabProps {
  contactId: string;
}

interface Log {
  id: string;
  eventType: string;
  creatorName?: string;
  createdAt: string;
  oldValue?: any;
  newValue?: any;
  details?: any;
}

export function ContactHistoryTab({ contactId }: ContactHistoryTabProps) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [contactId]);

  async function loadLogs() {
    try {
      setLoading(true);
      const data = await apiCall(`/api/contacts/${contactId}/logs/`);
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  function getEventTypeLabel(eventType: string): string {
    const labels: { [key: string]: string } = {
      'addContact': 'Création du contact',
      'editContact': 'Modification du contact',
      'deleteContact': 'Suppression du contact',
    };
    return labels[eventType] || eventType;
  }

  function handleLogClick(log: Log) {
    setSelectedLog(log);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setSelectedLog(null);
  }

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-4 border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => handleLogClick(log)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label className="text-sm font-semibold text-slate-900">
                        {getEventTypeLabel(log.eventType)}
                      </Label>
                      {log.creatorName && (
                        <p className="text-xs text-slate-600 mt-1">
                          Par {log.creatorName}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      {new Date(log.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">Aucun historique disponible</p>
          )}
        </CardContent>
      </Card>

      {/* Modal for log details */}
      {isModalOpen && selectedLog && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Détails de l'événement</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={handleCloseModal}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Type d'événement</Label>
                  <p className="mt-1">{getEventTypeLabel(selectedLog.eventType)}</p>
                </div>
                
                {selectedLog.creatorName && (
                  <div>
                    <Label className="text-sm font-semibold">Créateur</Label>
                    <p className="mt-1">{selectedLog.creatorName}</p>
                  </div>
                )}
                
                <div>
                  <Label className="text-sm font-semibold">Date et heure</Label>
                  <p className="mt-1">
                    {new Date(selectedLog.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>

                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">Détails</Label>
                    <pre className="mt-1 p-3 bg-slate-50 text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.oldValue && Object.keys(selectedLog.oldValue).length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">Valeur précédente</Label>
                    <pre className="mt-1 p-3 bg-slate-50 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.oldValue, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.newValue && Object.keys(selectedLog.newValue).length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">Nouvelle valeur</Label>
                    <pre className="mt-1 p-3 bg-slate-50 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.newValue, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="modal-form-actions" style={{ marginTop: '1.5rem' }}>
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

