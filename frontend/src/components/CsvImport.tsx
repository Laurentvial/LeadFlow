import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Plus, X, Loader2 } from 'lucide-react';
import { apiCall } from '../utils/api';
import { handleModalOverlayClick } from '../utils/modal';
import { toast } from 'sonner';
import { useStatuses } from '../hooks/useStatuses';
import { useSources } from '../hooks/useSources';
import { useUsers } from '../hooks/useUsers';
import { useUser } from '../contexts/UserContext';
import LoadingIndicator from './LoadingIndicator';
import { Input } from './ui/input';
import '../styles/PageHeader.css';
import '../styles/Modal.css';

interface ColumnMapping {
  [key: string]: string; // CRM field -> CSV column
}

const CRM_FIELDS = [
  { value: '', label: 'Ignorer cette colonne' },
  { value: 'civility', label: 'Civilité' },
  { value: 'firstName', label: 'Prénom (requis)' },
  { value: 'lastName', label: 'Nom' },
  { value: 'phone', label: 'Téléphone 1' },
  { value: 'mobile', label: 'Telephone 2' },
  { value: 'email', label: 'Email' },
  { value: 'birthDate', label: 'Date de naissance' },
  { value: 'birthPlace', label: 'Lieu de naissance' },
  { value: 'address', label: 'Adresse' },
  { value: 'addressComplement', label: 'Complément d\'adresse' },
  { value: 'postalCode', label: 'Code postal' },
  { value: 'city', label: 'Ville' },
  { value: 'nationality', label: 'Nationalité' },
  { value: 'campaign', label: 'Campagne' },
];

export function CsvImport() {
  const navigate = useNavigate();
  const { statuses, loading: statusesLoading, error: statusesError } = useStatuses();
  const { sources, loading: sourcesLoading, error: sourcesError, reload: reloadSources } = useSources();
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const { currentUser } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'results'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]); // Full CSV data
  const [totalRows, setTotalRows] = useState(0);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [defaultStatusId, setDefaultStatusId] = useState('');
  const [defaultSourceId, setDefaultSourceId] = useState('');
  const [defaultTeleoperatorId, setDefaultTeleoperatorId] = useState('');
  const [importResults, setImportResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');

  // Get status view permissions
  const statusViewPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const viewPerms = currentUser.permissions
      .filter((p: any) => p.component === 'statuses' && p.action === 'view' && p.statusId)
      .map((p: any) => String(p.statusId).trim());
    return new Set(viewPerms);
  }, [currentUser?.permissions]);

  // Get lead statuses only, filtered by view permissions
  const leadStatuses = React.useMemo(() => {
    if (!Array.isArray(statuses)) return [];
    return statuses.filter((s: any) => {
      if (s?.type !== 'lead') return false;
      if (!s.id || s.id.trim() === '') return false;
      // Filter by view permissions
      const normalizedStatusId = String(s.id).trim();
      return statusViewPermissions.has(normalizedStatusId);
    });
  }, [statuses, statusViewPermissions]);
  
  // Get teleoperateurs only
  const teleoperateurs = Array.isArray(users) ? users.filter((u: any) => u?.isTeleoperateur === true) : [];

  // Auto-set teleoperateur to current user if they have the teleoperateur role
  React.useEffect(() => {
    if (currentUser?.isTeleoperateur === true && currentUser?.id) {
      setDefaultTeleoperatorId(currentUser.id);
    }
  }, [currentUser]);


  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Le fichier est trop volumineux. Taille maximale: 10MB');
      return;
    }

    setCsvFile(file);
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiCall('/api/contacts/csv-import-preview/', {
        method: 'POST',
        body: formData,
      });

      // Validate response
      if (!response || !response.headers) {
        throw new Error('Réponse invalide du serveur');
      }

      // Parse CSV file to get all rows
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        throw new Error('Le fichier CSV est vide');
      }
      
      // Simple CSV parser that handles quoted fields
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
              i++; // Skip next quote
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
      
      // Use first row values as column headers for mapping
      const firstRowValues = parseCSVLine(lines[0]);
      const headers = firstRowValues.map((h, idx) => {
        const cleaned = h.replace(/^"|"$/g, '').trim();
        // If header is empty, generate a name
        return cleaned || `Column${idx + 1}`;
      });
      
      setCsvHeaders(headers);
      
      // Process ALL rows including the first one (no header row to skip)
      const allRows: any[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = (values[idx] || '').replace(/^"|"$/g, '');
        });
        allRows.push(row);
      }
      
      // Set total rows based on locally parsed data
      const actualRowCount = allRows.length;
      setTotalRows(actualRowCount);
      
      setCsvData(allRows);
      // Use first 5 rows from locally parsed data for preview
      setCsvPreview(allRows.slice(0, 5));

      // Initialize column mapping with empty values
      const initialMapping: ColumnMapping = {};
      CRM_FIELDS.forEach(field => {
        if (field.value) {
          initialMapping[field.value] = '';
        }
      });
      setColumnMapping(initialMapping);

      setStep('mapping');
      toast.success(`Fichier chargé: ${actualRowCount} lignes détectées`);
    } catch (error: any) {
      console.error('Error previewing CSV:', error);
      const errorMessage = error?.error || error?.message || 'Erreur lors de la lecture du fichier CSV';
      setError(errorMessage);
      toast.error(errorMessage);
      setCsvFile(null);
      setStep('upload');
    } finally {
      setIsLoading(false);
    }
  };


  const handleImport = async () => {
    console.log('[handleImport] Starting import...');
    
    // Set loading state immediately to prevent button spam
    setIsLoading(true);
    
    // Validate required mappings - only firstName is required
    if (!columnMapping.firstName) {
      setIsLoading(false);
      toast.error('Veuillez mapper le champ requis: Prénom');
      return;
    }

    if (!defaultStatusId) {
      setIsLoading(false);
      toast.error('Veuillez sélectionner un statut par défaut');
      return;
    }

    if (!defaultTeleoperatorId) {
      setIsLoading(false);
      toast.error('Veuillez sélectionner un téléopérateur');
      return;
    }

    if (!csvFile) {
      setIsLoading(false);
      toast.error('Aucun fichier sélectionné');
      return;
    }

    setError(null);
    setStep('importing');

    try {
      // Check for duplicates within CSV based on email mapping
      let fileToImport = csvFile;
      let duplicatesRemoved = 0;

      if (columnMapping.email && csvData.length > 0) {
        const emailColumn = columnMapping.email;
        const seenEmails = new Map<string, number>(); // email -> first occurrence index
        const duplicateIndices = new Set<number>();
        
        // Find duplicates
        csvData.forEach((row, index) => {
          const email = (row[emailColumn] || '').trim().toLowerCase();
          if (email) {
            if (seenEmails.has(email)) {
              duplicateIndices.add(index);
              duplicatesRemoved++;
            } else {
              seenEmails.set(email, index);
            }
          }
        });

        // If duplicates found, create a filtered CSV file
        if (duplicatesRemoved > 0) {
          const filteredData = csvData.filter((_, index) => !duplicateIndices.has(index));
          
          // Reconstruct CSV from filtered data
          const csvLines: string[] = [];
          
          // Add header row
          csvLines.push(csvHeaders.map(header => {
            const value = header.includes(',') || header.includes('"') ? `"${header.replace(/"/g, '""')}"` : header;
            return value;
          }).join(','));
          
          // Add filtered data rows
          filteredData.forEach(row => {
            const values = csvHeaders.map(header => {
              const value = (row[header] || '').toString();
              // Escape quotes and wrap in quotes if contains comma, quote, or newline
              if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            });
            csvLines.push(values.join(','));
          });
          
          // Create new Blob with filtered CSV
          const csvContent = csvLines.join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          fileToImport = new File([blob], csvFile.name, { type: 'text/csv' });
          
          toast.info(`${duplicatesRemoved} doublon(s) détecté(s) et supprimé(s) dans le fichier CSV`);
        }
      }

      const formData = new FormData();
      formData.append('file', fileToImport);
      formData.append('columnMapping', JSON.stringify(columnMapping));
      formData.append('defaultStatusId', defaultStatusId);
      if (defaultSourceId) {
        formData.append('defaultSourceId', defaultSourceId);
      }
      if (defaultTeleoperatorId) {
        formData.append('defaultTeleoperatorId', defaultTeleoperatorId);
      }

      console.log('[handleImport] Sending CSV to backend');
      const response = await apiCall('/api/contacts/csv-import/', {
        method: 'POST',
        body: formData,
      });

      // Validate response
      if (!response) {
        throw new Error('Réponse invalide du serveur');
      }

      setImportResults(response);
      setStep('results');
      
      if (response.imported > 0) {
        toast.success(`${response.imported} contact(s) importé(s) avec succès`);
      }
      if (response.failed > 0) {
        toast.error(`${response.failed} contact(s) n'ont pas pu être importé(s)`);
      }
    } catch (error: any) {
      console.error('Error importing CSV:', error);
      const errorMessage = error?.error || error?.message || 'Erreur lors de l\'importation';
      setError(errorMessage);
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
    setCsvPreview([]);
    setCsvData([]);
    setTotalRows(0);
    setColumnMapping({});
    setDefaultStatusId('');
    setDefaultSourceId('');
    setDefaultTeleoperatorId('');
    setImportResults(null);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  async function handleCreateSource() {
    if (!newSourceName.trim()) {
      toast.error('Le nom de la source est requis');
      return;
    }

    try {
      const response = await apiCall('/api/sources/create/', {
        method: 'POST',
        body: JSON.stringify({ name: newSourceName.trim() }),
      });
      
      toast.success('Source créée avec succès');
      setNewSourceName('');
      setIsSourceDialogOpen(false);
      await reloadSources();
      // Set the newly created source as selected
      setDefaultSourceId(response.id);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création de la source');
    }
  }

  // Show loading if hooks are still loading
  if (statusesLoading || sourcesLoading || usersLoading) {
    return (
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <div className="page-header">
          <div className="page-title-section">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/contacts')}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="page-title">Importer des contacts depuis CSV</h1>
              <p className="page-subtitle">Importez plusieurs contacts en une seule fois</p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center">
              <LoadingIndicator />
              <p className="mt-4 text-sm text-slate-600">Chargement des données...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if hooks failed
  if (statusesError || sourcesError || usersError) {
    return (
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <div className="page-header">
          <div className="page-title-section">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/contacts')}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="page-title">Importer des contacts depuis CSV</h1>
              <p className="page-subtitle">Importez plusieurs contacts en une seule fois</p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-lg font-medium text-red-600">Erreur de chargement</p>
              <p className="text-sm text-slate-600 mt-2">
                {statusesError || sourcesError || usersError || 'Impossible de charger les données nécessaires'}
              </p>
              <Button onClick={() => window.location.reload()} className="mt-4">
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/contacts')}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="page-title">Importer des contacts depuis CSV</h1>
            <p className="page-subtitle">Importez plusieurs contacts en une seule fois</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 1 : Sélectionner le fichier CSV</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12">
                <LoadingIndicator />
                <p className="mt-4 text-sm text-slate-600">Analyse du fichier en cours...</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 ">
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </p>
                  </div>
                )}
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-300 ">
                  <FileSpreadsheet className="w-16 h-16 text-slate-400 mb-4" />
                  <Label htmlFor="csv-file" className="text-lg font-medium mb-2">
                    Sélectionner un fichier CSV
                  </Label>
                  <p className="text-sm text-slate-500 pb-6 text-center max-w-md">
                    Importez n'importe quel fichier CSV. Vous pourrez ensuite mapper vos colonnes aux champs du CRM.
                    Les champs requis sont: Prénom. Taille maximale: 10MB
                  </p>
                  <input
                    ref={fileInputRef}
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    size="lg"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choisir un fichier
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Étape 2 : Mapping des colonnes</CardTitle>
                <Button variant="outline" onClick={handleReset}>
                  Nouveau fichier
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-slate-50 p-4 space-y-2">
                <p className="text-sm text-slate-700">
                  <strong>{totalRows}</strong> ligne(s) détectée(s) dans le fichier
                </p>
                {csvHeaders.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Colonnes disponibles dans votre CSV:</p>
                    <div className="flex flex-wrap gap-2">
                      {csvHeaders.map((header) => (
                        <span
                          key={header}
                          className="px-2 py-1 bg-white border border-slate-200  text-xs text-slate-700"
                        >
                          {header}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Mapper vos colonnes CSV aux champs CRM</h3>
                <p className="text-sm text-slate-600">
                  Votre fichier CSV contient <strong>{csvHeaders.length}</strong> colonne(s). 
                  Sélectionnez pour chaque champ du CRM la colonne correspondante dans votre fichier CSV.
                  Les colonnes non mappées seront ignorées.
                </p>
                {csvHeaders.length === 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 ">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Aucune colonne détectée dans le fichier CSV. Vérifiez que votre fichier contient bien une ligne d'en-tête.
                    </p>
                  </div>
                )}

                <div className="max-h-96 overflow-y-auto border  p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CRM_FIELDS.filter(field => field.value !== '').map((field) => (
                      <div key={field.value} className="flex items-center gap-3">
                        <Label className="w-40 text-sm font-medium flex-shrink-0">
                          {field.label}
                        </Label>
                        <Select
                          value={columnMapping[field.value] || '__none__'}
                          onValueChange={(value) => {
                            console.log('[Mapping] Column mapping changed:', {
                              field: field.value,
                              fieldLabel: field.label,
                              selectedValue: value,
                              csvHeaders: csvHeaders,
                              csvHeadersIndex: csvHeaders.indexOf(value),
                            });
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
                            <SelectItem value="__none__">-- Ignorer --</SelectItem>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="default-status">Statut par défaut (requis)</Label>
                  <Select
                    value={defaultStatusId}
                    onValueChange={setDefaultStatusId}
                  >
                    <SelectTrigger id="default-status">
                      {defaultStatusId ? (() => {
                        const selectedStatus = leadStatuses.find((s: any) => s.id === defaultStatusId);
                        return selectedStatus ? (
                          <SelectValue asChild>
                            <span 
                              className="inline-block px-2 py-1 rounded text-sm"
                              style={{
                                backgroundColor: selectedStatus.color || '#e5e7eb',
                                color: selectedStatus.color ? '#000000' : '#374151'
                              }}
                            >
                              {selectedStatus.name}
                            </span>
                          </SelectValue>
                        ) : (
                          <SelectValue placeholder="Sélectionner un statut" />
                        );
                      })() : (
                        <SelectValue placeholder="Sélectionner un statut" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {leadStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          <span 
                            className="inline-block px-2 py-1 rounded text-sm"
                            style={{
                              backgroundColor: status.color || '#e5e7eb',
                              color: status.color ? '#000000' : '#374151'
                            }}
                          >
                            {status.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-teleoperator">Téléopérateur (requis)</Label>
                  <Select
                    value={defaultTeleoperatorId}
                    onValueChange={setDefaultTeleoperatorId}
                  >
                    <SelectTrigger id="default-teleoperator">
                      <SelectValue placeholder="Sélectionner un téléopérateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {teleoperateurs.map((teleoperator) => (
                        <SelectItem key={teleoperator.id} value={teleoperator.id}>
                          {teleoperator.firstName} {teleoperator.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-source">Source par défaut (optionnel)</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={defaultSourceId || '__none__'}
                      onValueChange={(value) => setDefaultSourceId(value === '__none__' ? '' : value)}
                    >
                      <SelectTrigger id="default-source" className="flex-1">
                        <SelectValue placeholder="Sélectionner une source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune source</SelectItem>
                        {sources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsSourceDialogOpen(true)}
                      title="Ajouter une nouvelle source"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {csvPreview.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Aperçu des données</h4>
                  <div className="border  overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {csvHeaders.map((header) => (
                            <th key={header} className="px-3 py-2 text-left border-b">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, idx) => (
                          <tr key={idx}>
                            {csvHeaders.map((header) => (
                              <td key={header} className="px-3 py-2 border-b">
                                {row[header] || ''}
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
                  onClick={handleImport}
                  disabled={isLoading || !columnMapping.firstName || !defaultStatusId || !defaultTeleoperatorId}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importer les contacts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {step === 'importing' && (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center">
              <LoadingIndicator />
              <p className="text-lg font-medium mt-4">Importation en cours...</p>
              <p className="text-sm text-slate-500 mt-2">Veuillez patienter, cela peut prendre quelques instants</p>
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200  max-w-md">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'results' && importResults && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Résultats de l'importation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-slate-700">{importResults.total}</p>
                      <p className="text-sm text-slate-500">Total</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">{importResults.imported}</p>
                      <p className="text-sm text-slate-500">Importés</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-600">{importResults.failed}</p>
                      <p className="text-sm text-slate-500">Échoués</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {importResults.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Erreurs ({importResults.errors.length})
                  </h4>
                  <div className="max-h-64 overflow-y-auto border ">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Ligne</th>
                          <th className="px-3 py-2 text-left">Erreur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.errors.map((error: any, idx: number) => (
                          <tr key={idx} className="border-b">
                            <td className="px-3 py-2">{error.row}</td>
                            <td className="px-3 py-2 text-red-600">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResults.success.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Contacts importés ({importResults.success.length})
                  </h4>
                  <div className="max-h-64 overflow-y-auto border ">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Ligne</th>
                          <th className="px-3 py-2 text-left">Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.success.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b">
                            <td className="px-3 py-2">{item.row}</td>
                            <td className="px-3 py-2">{item.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleReset}>
                  Importer un autre fichier
                </Button>
                <Button onClick={() => navigate('/contacts')}>
                  Retour aux contacts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal for adding new source */}
      {isSourceDialogOpen && (
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setIsSourceDialogOpen(false);
          setNewSourceName('');
        })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Ajouter une nouvelle source</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsSourceDialogOpen(false);
                  setNewSourceName('');
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateSource();
              }}
              className="modal-form"
            >
              <div className="modal-form-field">
                <Label htmlFor="newSourceName">Nom de la source</Label>
                <Input
                  id="newSourceName"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="Ex: Site web, Référencement, etc."
                  required
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateSource();
                    }
                  }}
                />
              </div>
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsSourceDialogOpen(false);
                    setNewSourceName('');
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  <Plus className="planning-icon-md" style={{ marginRight: '4px' }} />
                  Créer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



