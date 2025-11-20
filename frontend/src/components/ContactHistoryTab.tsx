import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { X } from 'lucide-react';
import { apiCall } from '../utils/api';
import LoadingIndicator from './LoadingIndicator';
import '../styles/Modal.css';
import '../styles/ContactTab.css';

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

  function getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'firstName': 'Prénom',
      'lastName': 'Nom',
      'mobile': 'Portable',
      'source': 'Source',
      'statusName': 'Statut',
      'teleoperatorName': 'Téléopérateur',
      'creatorName': 'Créateur',
      'confirmateurName': 'Confirmateur',
      'civility': 'Civilité',
      'email': 'E-Mail',
      'phone': 'Téléphone',
      'birthDate': 'Date de naissance',
      'birthPlace': 'Lieu de naissance',
      'nationality': 'Nationalité',
      'address': 'Adresse',
      'addressComplement': 'Complément d\'adresse',
      'postalCode': 'Code postal',
      'city': 'Ville',
      'campaign': 'Campagne',
    };
    return labels[fieldName] || fieldName;
  }

  function formatValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '(vide)';
    }
    return String(value);
  }

  function getChangedFields(log: Log): Array<{field: string, old: any, new: any}> {
    const changes: Array<{field: string, old: any, new: any}> = [];
    
    // For creation events, show all new values
    if (log.eventType === 'addContact' && log.newValue) {
      Object.keys(log.newValue).forEach(key => {
        const newVal = log.newValue[key];
        // Only include non-empty fields for creation
        if (newVal !== null && newVal !== undefined && newVal !== '') {
          changes.push({
            field: key,
            old: null,
            new: newVal
          });
        }
      });
      return changes;
    }
    
    // For edit events, show only changed fields
    if (log.oldValue && log.newValue) {
      // Get all keys from both old and new values
      const allKeys = new Set([
        ...Object.keys(log.oldValue),
        ...Object.keys(log.newValue)
      ]);
      
      allKeys.forEach(key => {
        const oldVal = log.oldValue[key];
        const newVal = log.newValue[key];
        
        // Normalize for comparison
        const oldNormalized = oldVal !== null && oldVal !== undefined ? String(oldVal) : '';
        const newNormalized = newVal !== null && newVal !== undefined ? String(newVal) : '';
        
        if (oldNormalized !== newNormalized) {
          changes.push({
            field: key,
            old: oldVal,
            new: newVal
          });
        }
      });
    }
    
    return changes;
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
              {logs.map((log) => {
                const changedFields = getChangedFields(log);
                return (
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
                        {changedFields.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {changedFields.slice(0, 3).map((change, idx) => (
                              <p key={idx} className="text-xs text-slate-500">
                                {log.eventType === 'addContact' ? (
                                  <>{getFieldLabel(change.field)}: {formatValue(change.new)}</>
                                ) : (
                                  <>{getFieldLabel(change.field)}: {formatValue(change.old)} → {formatValue(change.new)}</>
                                )}
                              </p>
                            ))}
                            {changedFields.length > 3 && (
                              <p className="text-xs text-slate-400 italic">
                                +{changedFields.length - 3} autre(s) {log.eventType === 'addContact' ? 'champ(s)' : 'changement(s)'}
                              </p>
                            )}
                          </div>
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
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">Aucun historique disponible</p>
          )}
        </CardContent>
      </Card>

      {/* Modal for log details */}
      {isModalOpen && selectedLog && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content contact-tab-modal-content" onClick={(e) => e.stopPropagation()}>
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

                {(() => {
                  const changedFields = getChangedFields(selectedLog);
                  if (changedFields.length > 0) {
                    return (
                      <div>
                        <Label className="text-sm font-semibold">
                          {selectedLog.eventType === 'addContact' ? 'Informations créées' : 'Modifications'}
                        </Label>
                        <div className="mt-2 space-y-3">
                          {changedFields.map((change, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded border-l-4 border-blue-500">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <Label className="text-xs font-semibold text-slate-700">
                                    {getFieldLabel(change.field)}
                                  </Label>
                                  <div className="mt-1 space-y-1">
                                    {selectedLog.eventType === 'addContact' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-green-600 font-medium">Valeur:</span>
                                        <span className="text-xs text-slate-600">{formatValue(change.new)}</span>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-red-600 font-medium">Avant:</span>
                                          <span className="text-xs text-slate-600">{formatValue(change.old)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-green-600 font-medium">Après:</span>
                                          <span className="text-xs text-slate-600">{formatValue(change.new)}</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="modal-form-actions contact-tab-modal-actions">
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

