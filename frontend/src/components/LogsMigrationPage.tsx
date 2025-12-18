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
  [key: string]: string; // Log field -> CSV column
}

const LOG_FIELDS = [
  { value: '', label: 'Ignorer cette colonne' },
  { value: 'id', label: 'ID Log' },
  { value: 'eventType', label: 'Type d\'événement (requis)', required: true },
  { value: 'oldContactId', label: 'Ancien ID Contact' },
  { value: 'userId', label: 'ID Utilisateur' },
  { value: 'creatorId', label: 'ID Créateur' },
  { value: 'createdAt', label: 'Date de création' },
  { value: 'details', label: 'Détails (JSON)' },
  { value: 'oldValue', label: 'Ancienne valeur (JSON)' },
  { value: 'newValue', label: 'Nouvelle valeur (JSON)' },
  { value: 'oldLogs', label: 'Anciens logs (texte)' },
];


export function LogsMigrationPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'migration'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excludeFirstRow, setExcludeFirstRow] = useState(true);
  const [importResults, setImportResults] = useState<any>(null);
  const [eventTypeMapping, setEventTypeMapping] = useState<{ [csvValue: string]: string }>({}); // CSV value -> Event Type
  const [existingEventTypes, setExistingEventTypes] = useState<string[]>([]);
  const [eventTypesLoading, setEventTypesLoading] = useState(false);
  const [userIdMapping, setUserIdMapping] = useState<{ [csvValue: string]: string }>({}); // CSV value -> User ID
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [defaultUserId, setDefaultUserId] = useState<string>(''); // Default user ID if no mapping

  // Load existing event types
  React.useEffect(() => {
    loadEventTypes();
    loadUsers();
  }, []);

  async function loadEventTypes() {
    setEventTypesLoading(true);
    try {
      const data = await apiCall('/api/logs/event-types/', {
        method: 'GET',
      });
      setExistingEventTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading event types:', error);
      // If endpoint doesn't exist yet, continue without existing types
      setExistingEventTypes([]);
    } finally {
      setEventTypesLoading(false);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const response = await apiCall('/api/users/', {
        method: 'GET',
      });
      // Handle different response formats
      let usersList = [];
      if (Array.isArray(response)) {
        usersList = response;
      } else if (response?.users && Array.isArray(response.users)) {
        usersList = response.users;
      } else if (response && typeof response === 'object') {
        // Try to find users array in response
        usersList = Object.values(response).find((val: any) => Array.isArray(val)) || [];
      }
      
      // Filter out any invalid users and ensure they have an id
      const validUsers = usersList.filter((user: any) => user && user.id);
      console.log('Loaded users:', validUsers.length);
      setUsers(validUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

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
    LOG_FIELDS.forEach(field => {
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

  const handleStartMigration = () => {
    // Validate required fields
    const requiredFields = [
      { key: 'eventType', label: 'Type d\'événement' },
    ];
    
    const missingFields = requiredFields.filter(field => !columnMapping[field.key]);
    
    if (missingFields.length > 0) {
      const fieldsList = missingFields.map(f => f.label).join(', ');
      toast.error(`Veuillez mapper les champs requis: ${fieldsList}`);
      return;
    }

    setStep('migration');
    handleImport();
  };

  const handleImport = async () => {
    if (!csvFile) {
      toast.error('Aucun fichier sélectionné');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('columnMapping', JSON.stringify(columnMapping));
      if (Object.keys(eventTypeMapping).length > 0) {
        formData.append('eventTypeMapping', JSON.stringify(eventTypeMapping));
      }
      if (Object.keys(userIdMapping).length > 0) {
        formData.append('userIdMapping', JSON.stringify(userIdMapping));
      }
      if (defaultUserId) {
        formData.append('defaultUserId', defaultUserId);
      }

      const results = await apiCall('/api/logs/csv-import/', {
        method: 'POST',
        body: formData,
      });

      setImportResults(results);
      
      if (results.imported > 0) {
        toast.success(`Migration réussie: ${results.imported} log(s) importé(s)`);
      }
      if (results.failed > 0) {
        toast.warning(`${results.failed} log(s) n'ont pas pu être importé(s)`);
      }
    } catch (err: any) {
      const errorMessage = err.message || err.response?.error || 'Erreur lors de l\'importation';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping({});
    setEventTypeMapping({});
    setUserIdMapping({});
    setStep('upload');
    setError(null);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/contacts/migration')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la migration des contacts
        </Button>
        <h1 className="text-3xl font-bold">Migration des Logs</h1>
        <p className="text-slate-600 mt-2">
          Importez des logs depuis un fichier CSV en mappant les colonnes aux champs du système
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 1: Télécharger le fichier CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="csv-file">Sélectionner un fichier CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="mt-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="exclude-first-row"
                checked={excludeFirstRow}
                onChange={(e) => setExcludeFirstRow(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="exclude-first-row" className="cursor-pointer">
                Exclure la première ligne (en-têtes)
              </Label>
            </div>
            {csvHeaders.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Colonnes détectées:</p>
                <div className="flex flex-wrap gap-2">
                  {csvHeaders.map((header) => (
                    <span key={header} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                      {header}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Étape 2: Mapper les colonnes CSV aux champs Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Mapper vos colonnes CSV aux champs Logs</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Les champs marqués d'un <span className="text-red-600 font-semibold">*</span> sont obligatoires
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto border rounded p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {LOG_FIELDS.filter(field => field.value !== '').map((field) => {
                    const mappedColumns = Object.values(columnMapping).filter(
                      (col, idx) => col && col !== '' && Object.keys(columnMapping)[idx] !== field.value
                    );
                    
                    const availableHeaders = csvHeaders.filter(header => 
                      header && header.trim() !== '' && 
                      (!mappedColumns.includes(header) || columnMapping[field.value] === header)
                    );

                    const isRequired = field.required || false;
                    const isMapped = !!columnMapping[field.value];
                    
                    return (
                      <div key={field.value} className="flex items-center gap-3">
                        <Label className={`w-40 text-sm font-medium flex-shrink-0 ${isRequired && !isMapped ? 'text-red-600' : ''}`}>
                          {field.label}
                          {isRequired && <span className="text-red-600 ml-1">*</span>}
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
                            <SelectValue placeholder="Sélectionner une colonne CSV" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Aucune colonne</SelectItem>
                            {availableHeaders.filter(header => header && header.trim() !== '').map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Event Type Mapping Section */}
              {columnMapping.eventType && csvData.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Mapper les types d'événements</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Mappez les valeurs de type d'événement de votre CSV aux types d'événements du système
                    </p>
                    {(() => {
                      // Get unique event type values from CSV
                      const eventTypeColumn = columnMapping.eventType;
                      const uniqueEventTypeValues = Array.from(
                        new Set(
                          csvData
                            .map(row => row[eventTypeColumn])
                            .filter(val => val && val.toString().trim() !== '')
                            .map(val => val.toString().trim())
                        )
                      ).sort();

                      if (uniqueEventTypeValues.length === 0) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                            <p className="text-sm text-yellow-800">
                              Aucune valeur de type d'événement trouvée dans la colonne "{eventTypeColumn}"
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="border rounded p-4 bg-slate-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {uniqueEventTypeValues.map((csvValue) => {
                              const mappedValue = eventTypeMapping[csvValue];
                              // Determine current value: mapped value if exists, otherwise CSV value
                              const currentValue = mappedValue !== undefined ? mappedValue : csvValue;
                              // Check if current value is in existing types
                              const isInExistingTypes = existingEventTypes.includes(currentValue);
                              // Determine select value: if mapped to CSV value or not in existing types, use custom marker
                              const selectValue = (mappedValue === csvValue || !isInExistingTypes) 
                                ? `__custom_${csvValue}__` 
                                : currentValue;
                              
                              return (
                                <div key={csvValue} className="flex items-center gap-3">
                                  <Label className="w-40 text-sm font-medium flex-shrink-0 truncate" title={csvValue}>
                                    {csvValue}
                                  </Label>
                                  <Select
                                    value={selectValue}
                                    onValueChange={(value) => {
                                      if (value.startsWith('__custom_')) {
                                        // Use CSV value as-is
                                        setEventTypeMapping({
                                          ...eventTypeMapping,
                                          [csvValue]: csvValue,
                                        });
                                      } else {
                                        // Map to selected event type
                                        setEventTypeMapping({
                                          ...eventTypeMapping,
                                          [csvValue]: value,
                                        });
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Sélectionner un type d'événement" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {eventTypesLoading ? (
                                        <SelectItem value="loading" disabled>Chargement...</SelectItem>
                                      ) : (
                                        <>
                                          {/* Always show CSV value option */}
                                          <SelectItem value={`__custom_${csvValue}__`}>
                                            {csvValue} {!existingEventTypes.includes(csvValue) && '(valeur CSV)'}
                                          </SelectItem>
                                          {existingEventTypes.map((eventType) => (
                                            <SelectItem key={eventType} value={eventType}>
                                              {eventType}
                                            </SelectItem>
                                          ))}
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            Sélectionnez un type d'événement existant ou utilisez la valeur CSV telle quelle
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* User ID Mapping Section */}
              {columnMapping.userId && csvData.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Mapper les IDs utilisateur</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Mappez les valeurs d'ID utilisateur de votre CSV aux IDs utilisateur du système. Si aucune valeur n'est sélectionnée, l'utilisateur par défaut sera utilisé.
                    </p>
                    
                    {/* Default User Selection */}
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
                      <Label className="text-sm font-medium mb-2 block">Utilisateur par défaut</Label>
                      <Select
                        value={defaultUserId || '__none__'}
                        onValueChange={(value) => {
                          setDefaultUserId(value === '__none__' ? '' : value);
                        }}
                      >
                        <SelectTrigger className="w-full max-w-md">
                          <SelectValue placeholder="Sélectionner un utilisateur par défaut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Aucun utilisateur par défaut</SelectItem>
                          {usersLoading ? (
                            <SelectItem value="loading" disabled>Chargement...</SelectItem>
                          ) : (
                            users.filter(user => user && user.id).map((user) => (
                              <SelectItem key={user.id} value={String(user.id)}>
                                {user.firstName && user.lastName 
                                  ? `${user.firstName} ${user.lastName} (${user.id})`
                                  : user.username 
                                  ? `${user.username} (${user.id})`
                                  : String(user.id)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-2">
                        Cet utilisateur sera utilisé pour les valeurs CSV qui ne sont pas mappées
                      </p>
                    </div>
                    {(() => {
                      // Get unique user ID values from CSV
                      const userIdColumn = columnMapping.userId;
                      const uniqueUserIdValues = Array.from(
                        new Set(
                          csvData
                            .map(row => row[userIdColumn])
                            .filter(val => val && val.toString().trim() !== '')
                            .map(val => val.toString().trim())
                        )
                      ).sort();

                      if (uniqueUserIdValues.length === 0) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                            <p className="text-sm text-yellow-800">
                              Aucune valeur d'ID utilisateur trouvée dans la colonne "{userIdColumn}"
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="border rounded p-4 bg-slate-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {uniqueUserIdValues.map((csvValue) => {
                              const mappedValue = userIdMapping[csvValue];
                              // Determine select value: use mapped value if exists, otherwise show default or none
                              const selectValue = mappedValue !== undefined ? mappedValue : (defaultUserId || '__none__');
                              
                              return (
                                <div key={csvValue} className="flex items-center gap-3">
                                  <Label className="w-40 text-sm font-medium flex-shrink-0 truncate" title={csvValue}>
                                    {csvValue}
                                  </Label>
                                  <Select
                                    value={selectValue}
                                    onValueChange={(value) => {
                                      if (value === '__none__') {
                                        // Remove mapping, will use default
                                        const newMapping = { ...userIdMapping };
                                        delete newMapping[csvValue];
                                        setUserIdMapping(newMapping);
                                      } else {
                                        // Map to selected user ID
                                        setUserIdMapping({
                                          ...userIdMapping,
                                          [csvValue]: value,
                                        });
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Sélectionner un utilisateur" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {usersLoading ? (
                                        <SelectItem value="loading" disabled>Chargement...</SelectItem>
                                      ) : (
                                        <>
                                          <SelectItem value="__none__">
                                            {defaultUserId ? `Utiliser par défaut (${users.find(u => u.id === defaultUserId)?.firstName || defaultUserId})` : 'Aucun'}
                                          </SelectItem>
                                          {users.length === 0 ? (
                                            <SelectItem value="no-users" disabled>Aucun utilisateur disponible</SelectItem>
                                          ) : (
                                            users.filter(user => user && user.id).map((user) => (
                                              <SelectItem key={user.id} value={String(user.id)}>
                                                {user.firstName && user.lastName 
                                                  ? `${user.firstName} ${user.lastName} (${user.id})`
                                                  : user.username 
                                                  ? `${user.username} (${user.id})`
                                                  : String(user.id)}
                                              </SelectItem>
                                            ))
                                          )}
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            Sélectionnez un utilisateur pour chaque valeur CSV, ou laissez vide pour utiliser l'utilisateur par défaut
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <Button onClick={() => setStep('upload')} variant="outline">
                  Retour
                </Button>
                <Button onClick={handleStartMigration} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Import en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Démarrer l'import
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'migration' && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 3: Résultats de l'importation</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3">Importation en cours...</span>
              </div>
            ) : importResults ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{importResults.total}</div>
                    <div className="text-sm text-slate-600">Total</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{importResults.imported}</div>
                    <div className="text-sm text-slate-600">Importés</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{importResults.failed}</div>
                    <div className="text-sm text-slate-600">Échecs</div>
                  </div>
                </div>

                {importResults.errors && importResults.errors.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Erreurs:</h3>
                    <div className="max-h-64 overflow-y-auto border rounded p-4">
                      {importResults.errors.map((error: any, index: number) => (
                        <div key={index} className="mb-2 text-sm text-red-600">
                          <strong>Ligne {error.row}:</strong> {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 mt-6">
                  <Button onClick={handleReset} variant="outline">
                    Nouvel import
                  </Button>
                  <Button onClick={() => navigate('/contacts/migration')}>
                    Retour à la migration des contacts
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Aucun résultat disponible
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
