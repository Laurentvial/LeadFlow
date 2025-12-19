import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import '../styles/PageHeader.css';

interface ColumnMapping {
  [key: string]: string; // Event field -> CSV column
}

const EVENT_FIELDS = [
  { value: 'oldContactId', label: 'Ancien ID Contact' },
  { value: 'date', label: 'Date seulement (requis)', required: true },
  { value: 'hour', label: 'Heure' },
  { value: 'minute', label: 'Minutes' },
  { value: 'comment', label: 'Commentaire' },
];

export function EventsMigrationPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'processing' | 'results'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excludeFirstRow, setExcludeFirstRow] = useState(true);
  const [defaultHour, setDefaultHour] = useState<string>('09');
  const [defaultMinute, setDefaultMinute] = useState<string>('00');
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [migrationResults, setMigrationResults] = useState<{ success: number; failed: number; failureReasons: { [reason: string]: number } }>({ success: 0, failed: 0, failureReasons: {} });

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSVFile = async (file: File, excludeHeader: boolean) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('Le fichier CSV est vide');
    }
    
    const firstRowValues = parseCSVLine(lines[0]);
    const headers = firstRowValues.map((h, idx) => {
      const cleaned = h.replace(/^"|"$/g, '').trim();
      return cleaned || `Column${idx + 1}`;
    });
    
    setCsvHeaders(headers);
    
    // Determine start index: skip first row if excludeHeader is true
    const startIndex = excludeHeader ? 1 : 0;
    
    const allRows: any[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = (values[idx] || '').replace(/^"|"$/g, '');
      });
      allRows.push(row);
    }
    
    setCsvData(allRows);
    
    // Initialize column mapping
    const initialMapping: ColumnMapping = {};
    EVENT_FIELDS.forEach(field => {
      if (field.value) {
        initialMapping[field.value] = '';
      }
    });
    setColumnMapping(initialMapping);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    setCsvFile(file);
    setError(null);

    try {
      await parseCSVFile(file, excludeFirstRow);
      setStep('mapping');
      toast.success('Fichier CSV chargé avec succès');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du fichier CSV');
      toast.error(err.message || 'Erreur lors du chargement du fichier CSV');
    }
  };

  const parseDateTime = (dateValue: string, hourValue?: string, minuteValue?: string): string | null => {
    if (!dateValue) return null;

    try {
      let parsedDate: Date | null = null;
      
      // Try to parse dd/mm/yyyy format first
      const ddmmyyyyMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10);
        const year = parseInt(ddmmyyyyMatch[3], 10);
        parsedDate = new Date(year, month - 1, day);
      } else {
        // Try ISO format or standard Date parsing
        parsedDate = new Date(dateValue);
      }
      
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        return null;
      }

      // Extract date components
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      
      // Get hour and minute
      let hour = defaultHour;
      let minute = defaultMinute;
      
      // Try to extract hour from the date value if it contains time
      const timeMatch = dateValue.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        hour = timeMatch[1].padStart(2, '0');
        minute = timeMatch[2].padStart(2, '0');
      } else {
        // Check if parsed date has time component
        const hourFromDate = parsedDate.getHours();
        const minuteFromDate = parsedDate.getMinutes();
        if (hourFromDate !== 0 || minuteFromDate !== 0) {
          hour = String(hourFromDate).padStart(2, '0');
          minute = String(minuteFromDate).padStart(2, '0');
        }
      }
      
      // Override with hour column if provided
      if (hourValue) {
        const hourMatch = hourValue.match(/\d{1,2}/);
        if (hourMatch) {
          const h = parseInt(hourMatch[0]);
          if (h >= 0 && h <= 23) {
            hour = String(h).padStart(2, '0');
          }
        }
      }
      
      // Override with minute column if provided
      if (minuteValue) {
        const minuteMatch = minuteValue.match(/\d{1,2}/);
        if (minuteMatch) {
          const m = parseInt(minuteMatch[0]);
          if (m >= 0 && m <= 59) {
            minute = String(m).padStart(2, '0');
          }
        }
      }
      
      return `${year}-${month}-${day}T${hour}:${minute}:00`;
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };

  const handleStartMigration = async () => {
    // Validate required fields - oldContactId must be mapped
    if (!columnMapping.oldContactId) {
      toast.error('Veuillez mapper "Ancien ID Contact"');
      return;
    }

    // Check if date is mapped (required)
    if (!columnMapping.date) {
      toast.error('Veuillez mapper "Date seulement"');
      return;
    }

    setStep('processing');
    setIsLoading(true);
    setProcessingProgress({ current: 0, total: csvData.length });

    try {
      // Pre-fetch contacts by oldContactId if oldContactId is mapped
      // Store both contactId and teleoperatorId for each contact
      const contactsByOldId: { [oldId: string]: { contactId: string; teleoperatorId: string | null } } = {};
      if (columnMapping.oldContactId) {
        try {
          // Get all unique oldContactIds from CSV
          const oldContactIds = Array.from(new Set(
            csvData
              .map(row => row[columnMapping.oldContactId]?.trim())
              .filter(id => id)
          ));

          if (oldContactIds.length > 0) {
            // Fetch contacts by oldContactId in parallel batches
            const CONTACT_BATCH_SIZE = 20; // Process in parallel batches
            for (let j = 0; j < oldContactIds.length; j += CONTACT_BATCH_SIZE) {
              const batch = oldContactIds.slice(j, j + CONTACT_BATCH_SIZE);
              
              // Query each oldContactId in parallel for better performance
              const contactPromises = batch.map(async (oldId) => {
                try {
                  const response = await apiCall('/api/contacts/', {
                    method: 'GET',
                    params: new URLSearchParams({
                      filter_oldContactId: oldId.trim(),
                      limit: '100'
                    })
                  });
                  
                  if (response.contacts && Array.isArray(response.contacts)) {
                    // Find exact match (since filter uses contains, we need to check for exact match)
                    const contact = response.contacts.find((c: any) => 
                      c.oldContactId && c.oldContactId.trim() === oldId.trim()
                    );
                    if (contact) {
                      return { 
                        oldId: oldId.trim(), 
                        contactId: contact.id,
                        teleoperatorId: contact.teleoperatorId || null
                      };
                    }
                  }
                  return null;
                } catch (error) {
                  console.error(`Error fetching contact for oldContactId ${oldId}:`, error);
                  return null;
                }
              });
              
              const results = await Promise.all(contactPromises);
              results.forEach(result => {
                if (result) {
                  contactsByOldId[result.oldId] = {
                    contactId: result.contactId,
                    teleoperatorId: result.teleoperatorId
                  };
                }
              });
            }
          }
        } catch (error) {
          console.error('Error fetching contacts by oldContactId:', error);
          toast.warning('Erreur lors de la récupération des contacts par ancien ID. Continuons avec les IDs directs.');
        }
      }

      const BATCH_SIZE = 100; // Process events in batches
      let totalSuccess = 0;
      let totalFailed = 0;
      const failureReasons: { [reason: string]: number } = {};

      for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
        const batch = csvData.slice(i, i + BATCH_SIZE);
        
        // Process batch
        const batchPromises = batch.map(async (row) => {
          try {
            // Get contactId and teleoperatorId by resolving oldContactId
            let contactId: string | null = null;
            let teleoperatorId: string | null = null;
            
            if (columnMapping.oldContactId) {
              const oldContactId = row[columnMapping.oldContactId]?.trim() || null;
              if (oldContactId) {
                const contactInfo = contactsByOldId[oldContactId];
                if (!contactInfo) {
                  return { success: false, error: `Contact introuvable pour l'ancien ID: ${oldContactId}` };
                }
                contactId = contactInfo.contactId;
                teleoperatorId = contactInfo.teleoperatorId;
                
                // Check if contact has a teleoperator assigned
                if (!teleoperatorId) {
                  return { success: false, error: `Le contact ${oldContactId} n'a pas de téléopérateur assigné` };
                }
              } else {
                return { success: false, error: 'Ancien ID Contact manquant' };
              }
            } else {
              return { success: false, error: 'Ancien ID Contact manquant' };
            }

            // Parse datetime from date field (required)
            let datetime: string | null = null;
            if (columnMapping.date) {
              datetime = parseDateTime(
                row[columnMapping.date]?.trim() || '',
                columnMapping.hour ? row[columnMapping.hour]?.trim() : undefined,
                columnMapping.minute ? row[columnMapping.minute]?.trim() : undefined
              );
            }

            if (!datetime) {
              return { success: false, error: 'Date invalide ou manquante' };
            }
            
            const comment = columnMapping.comment ? row[columnMapping.comment]?.trim() : '';

            // Create event - use contact's teleoperatorId as userId
            await apiCall('/api/events/create/', {
              method: 'POST',
              body: JSON.stringify({
                datetime,
                contactId,
                userId: teleoperatorId,
                comment
              }),
            });

            return { success: true };
          } catch (error: any) {
            const errorMessage = error?.error || error?.message || 'Erreur lors de la création';
            return { success: false, error: errorMessage };
          }
        });

        const results = await Promise.all(batchPromises);
        
        // Count successes and failures
        results.forEach(result => {
          if (result.success) {
            totalSuccess++;
          } else {
            totalFailed++;
            const errorMsg = result.error || 'Erreur inconnue';
            let reason = 'Autre';
            
            if (errorMsg.toLowerCase().includes('contact') && errorMsg.toLowerCase().includes('not found')) {
              reason = 'Contact introuvable';
            } else if (errorMsg.toLowerCase().includes('téléopérateur') || errorMsg.toLowerCase().includes('teleoperateur')) {
              reason = 'Téléopérateur manquant';
            } else if (errorMsg.toLowerCase().includes('date') || errorMsg.toLowerCase().includes('datetime')) {
              reason = 'Date invalide';
            } else if (errorMsg.toLowerCase().includes('user') && errorMsg.toLowerCase().includes('not found')) {
              reason = 'Utilisateur introuvable';
            }
            
            failureReasons[reason] = (failureReasons[reason] || 0) + 1;
          }
        });

        setProcessingProgress({ current: Math.min(i + BATCH_SIZE, csvData.length), total: csvData.length });
      }

      setMigrationResults({ success: totalSuccess, failed: totalFailed, failureReasons });
      setStep('results');
      
      if (totalFailed === 0) {
        toast.success(`${totalSuccess} événement(s) créé(s) avec succès`);
      } else {
        toast.warning(`${totalSuccess} événement(s) créé(s), ${totalFailed} erreur(s)`);
      }
    } catch (error: any) {
      console.error('Error importing events:', error);
      const errorMessage = error?.error || error?.message || 'Erreur lors de l\'importation';
      toast.error(errorMessage);
      setStep('mapping');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping({});
    setError(null);
    setIsLoading(false);
    setProcessingProgress({ current: 0, total: 0 });
    setMigrationResults({ success: 0, failed: 0, failureReasons: {} });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/contacts')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-3xl font-bold">Migration d'événements</h1>
        <p className="text-slate-600 mt-2">
          Importez des événements depuis un fichier CSV
        </p>
      </div>

      {step === 'upload' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv-file" className="text-lg font-medium mb-2 block">
                  Sélectionner un fichier CSV
                </Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="exclude-first-row"
                  checked={excludeFirstRow}
                  onChange={(e) => setExcludeFirstRow(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="exclude-first-row" className="text-sm">
                  Exclure la première ligne (en-têtes)
                </Label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Mapper les colonnes CSV aux champs d'événement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Info message about teleoperator assignment */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Les événements seront automatiquement assignés au téléopérateur du contact. 
                  Assurez-vous que chaque contact a un téléopérateur assigné avant de démarrer la migration.
                </p>
              </div>

              {EVENT_FIELDS.map((field) => (
                <div key={field.value} className="flex items-center gap-4">
                  <Label className="w-48 text-sm font-medium flex-shrink-0">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Select
                    value={columnMapping[field.value] || '__none__'}
                    onValueChange={(value) => {
                      setColumnMapping({
                        ...columnMapping,
                        [field.value]: value === '__none__' ? '' : value,
                      });
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Sélectionner une colonne" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Aucune --</SelectItem>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {/* Default values */}
              <div className="pt-4 border-t space-y-4">
                <h3 className="font-semibold text-lg">Valeurs par défaut</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Heure par défaut</Label>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={defaultHour}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 23)) {
                          setDefaultHour(val || '00');
                        }
                      }}
                      placeholder="09"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Minutes par défaut</Label>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={defaultMinute}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setDefaultMinute(val || '00');
                        }
                      }}
                      placeholder="00"
                    />
                  </div>
                </div>
              </div>

              {/* CSV Preview */}
              {csvData.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-medium mb-2">Aperçu des données CSV</h4>
                  <p className="text-sm text-slate-600 mb-3">
                    {csvData.length > 100 
                      ? `Affichage des 100 premières lignes sur ${csvData.length} ligne(s) au total`
                      : `Tous les événements du fichier CSV (${csvData.length} ligne(s))`
                    }
                  </p>
                  <div className="border rounded overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left border-b font-semibold bg-slate-50 sticky left-0 z-10">#</th>
                          {csvHeaders.map((header) => (
                            <th key={header} className="px-3 py-2 text-left border-b font-semibold bg-slate-50">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 border-b bg-white sticky left-0 z-10 font-medium">{idx + 1}</td>
                            {csvHeaders.map((header) => (
                              <td key={header} className="px-3 py-2 border-b">
                                <div className="max-w-xs truncate" title={row[header] || ''}>
                                  {row[header] || ''}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => navigate('/contacts')}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleStartMigration} 
                  disabled={!columnMapping.oldContactId || !columnMapping.date}
                >
                  Démarrer la migration
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'processing' && (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center">
              <LoadingIndicator />
              <p className="mt-4 text-lg font-medium text-slate-700">
                Migration en cours...
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {processingProgress.total > 0 
                  ? `Traitement de ${processingProgress.current} sur ${processingProgress.total} événements`
                  : 'Préparation des données...'
                }
              </p>
              {processingProgress.total > 0 && (
                <div className="mt-4 w-full max-w-md">
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, (processingProgress.current / processingProgress.total) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'results' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Résultats de la migration</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    Nouveau fichier
                  </Button>
                  <Button variant="outline" onClick={() => setStep('mapping')}>
                    Retour au mapping
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Success count */}
                <div className="bg-green-50 border border-green-200 rounded p-4">
                  <p className="text-sm text-green-800">
                    <strong>✓ Événements créés avec succès:</strong> {migrationResults.success}
                  </p>
                </div>

                {/* Failed count and reasons */}
                {migrationResults.failed > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <p className="text-sm text-yellow-800 mb-3">
                      <strong>⚠ Événements non créés:</strong> {migrationResults.failed}
                    </p>
                    <div className="space-y-2">
                      {Object.entries(migrationResults.failureReasons).map(([reason, count]) => (
                        <div key={reason} className="text-sm text-yellow-700 pl-4">
                          • {reason}: {count}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


