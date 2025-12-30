import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Upload, Loader2, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { useUsers } from '../hooks/useUsers';
import { useSources } from '../hooks/useSources';
import '../styles/PageHeader.css';

interface ColumnMapping {
  [key: string]: string; // Contact field -> CSV column
}

const INTEGRATION_FIELDS = [
  { value: '', label: 'Ignorer cette colonne' },
  { value: 'oldContactId', label: 'Ancien ID Contact (requis)', required: true },
  { value: 'createdAt', label: 'Date de création' },
  { value: 'updatedAt', label: 'Date de modification' },
  { value: 'assignedAt', label: 'Date d\'attribution' },
  { value: 'teleoperatorId', label: 'Téléopérateur' },
  { value: 'confirmateurId', label: 'Confirmateur' },
  { value: 'sourceId', label: 'Source' },
];

export function ContactIntegrationPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { users, loading: usersLoading } = useUsers();
  const { sources, loading: sourcesLoading } = useSources();
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'integration'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [teleoperatorMapping, setTeleoperatorMapping] = useState<{ [csvValue: string]: string }>({});
  const [confirmateurMapping, setConfirmateurMapping] = useState<{ [csvValue: string]: string }>({});
  const [sourceMapping, setSourceMapping] = useState<{ [csvValue: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excludeFirstRow, setExcludeFirstRow] = useState(true);
  const [importResults, setImportResults] = useState<any>(null);

  // Get teleoperateurs and confirmateurs
  const teleoperateurs = Array.isArray(users) ? users.filter((u: any) => u?.isTeleoperateur === true) : [];
  const confirmateurs = Array.isArray(users) ? users.filter((u: any) => u?.isConfirmateur === true || u?.isConfirmateur === 'true') : [];

  // Helper function to normalize strings for matching
  const normalizeString = (str: string): string => {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  };

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
    INTEGRATION_FIELDS.forEach(field => {
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
      const errorMessage = err.message || 'Erreur lors du chargement du fichier CSV';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleStartIntegration = () => {
    // Validate required fields
    const requiredFields = [
      { key: 'oldContactId', label: 'Ancien ID Contact' },
    ];
    
    const missingFields = requiredFields.filter(field => !columnMapping[field.key]);
    
    if (missingFields.length > 0) {
      const fieldsList = missingFields.map(f => f.label).join(', ');
      toast.error(`Veuillez mapper les champs requis: ${fieldsList}`);
      return;
    }

    // Check if at least one field is mapped (timestamp or other fields)
    const timestampFields = ['createdAt', 'updatedAt', 'assignedAt'];
    const otherFields = ['teleoperatorId', 'confirmateurId', 'sourceId'];
    const hasTimestampField = timestampFields.some(field => columnMapping[field]);
    const hasOtherField = otherFields.some(field => columnMapping[field]);
    
    if (!hasTimestampField && !hasOtherField) {
      toast.error('Veuillez mapper au moins un champ à mettre à jour (dates, téléopérateur, confirmateur ou source)');
      return;
    }

    setStep('integration');
    handleIntegration();
  };

  // Auto-map teleoperator values
  const handleAutoMapTeleoperateurs = () => {
    if (!columnMapping.teleoperatorId || csvData.length === 0) return;

    const teleoperatorColumn = columnMapping.teleoperatorId;
    const uniqueTeleoperatorValues = Array.from(
      new Set(
        csvData
          .map(row => row[teleoperatorColumn])
          .filter(val => val && val.toString().trim() !== '')
          .map(val => val.toString().trim())
      )
    );

    const newMapping = { ...teleoperatorMapping };
    let matchedCount = 0;

    uniqueTeleoperatorValues.forEach(csvValue => {
      if (newMapping[csvValue]) return; // Already mapped

      const csvValueNormalized = normalizeString(csvValue);
      let bestMatch: any = null;
      let bestScore = 0;

      teleoperateurs.forEach(teleoperator => {
        const fullName = `${teleoperator.firstName || ''} ${teleoperator.lastName || ''}`.trim();
        const displayName = fullName || teleoperator.username || teleoperator.email || '';
        const displayNameNormalized = normalizeString(displayName);
        const usernameNormalized = normalizeString(teleoperator.username || '');
        const emailNormalized = normalizeString(teleoperator.email || '');
        const idNormalized = normalizeString(teleoperator.id);

        // Exact match
        if (csvValueNormalized === displayNameNormalized || 
            csvValueNormalized === usernameNormalized || 
            csvValueNormalized === emailNormalized ||
            csvValueNormalized === idNormalized) {
          if (bestScore < 100) {
            bestMatch = teleoperator;
            bestScore = 100;
          }
        }
        // Contains match
        else if (displayNameNormalized.includes(csvValueNormalized) || csvValueNormalized.includes(displayNameNormalized) ||
                 usernameNormalized.includes(csvValueNormalized) || csvValueNormalized.includes(usernameNormalized)) {
          if (bestScore < 70) {
            bestMatch = teleoperator;
            bestScore = 70;
          }
        }
      });

      if (bestMatch && bestScore >= 70) {
        newMapping[csvValue] = bestMatch.id;
        matchedCount++;
      }
    });

    setTeleoperatorMapping(newMapping);
    toast.success(`${matchedCount} valeur(s) de téléopérateur mappée(s) automatiquement`);
  };

  // Auto-map confirmateur values
  const handleAutoMapConfirmateurs = () => {
    if (!columnMapping.confirmateurId || csvData.length === 0) return;

    const confirmateurColumn = columnMapping.confirmateurId;
    const uniqueConfirmateurValues = Array.from(
      new Set(
        csvData
          .map(row => row[confirmateurColumn])
          .filter(val => val && val.toString().trim() !== '')
          .map(val => val.toString().trim())
      )
    );

    const newMapping = { ...confirmateurMapping };
    let matchedCount = 0;

    uniqueConfirmateurValues.forEach(csvValue => {
      if (newMapping[csvValue]) return; // Already mapped

      const csvValueNormalized = normalizeString(csvValue);
      let bestMatch: any = null;
      let bestScore = 0;

      confirmateurs.forEach(confirmateur => {
        const fullName = `${confirmateur.firstName || ''} ${confirmateur.lastName || ''}`.trim();
        const displayName = fullName || confirmateur.username || confirmateur.email || '';
        const displayNameNormalized = normalizeString(displayName);
        const usernameNormalized = normalizeString(confirmateur.username || '');
        const emailNormalized = normalizeString(confirmateur.email || '');
        const idNormalized = normalizeString(confirmateur.id);

        // Exact match
        if (csvValueNormalized === displayNameNormalized || 
            csvValueNormalized === usernameNormalized || 
            csvValueNormalized === emailNormalized ||
            csvValueNormalized === idNormalized) {
          if (bestScore < 100) {
            bestMatch = confirmateur;
            bestScore = 100;
          }
        }
        // Contains match
        else if (displayNameNormalized.includes(csvValueNormalized) || csvValueNormalized.includes(displayNameNormalized) ||
                 usernameNormalized.includes(csvValueNormalized) || csvValueNormalized.includes(usernameNormalized)) {
          if (bestScore < 70) {
            bestMatch = confirmateur;
            bestScore = 70;
          }
        }
      });

      if (bestMatch && bestScore >= 70) {
        newMapping[csvValue] = bestMatch.id;
        matchedCount++;
      }
    });

    setConfirmateurMapping(newMapping);
    toast.success(`${matchedCount} valeur(s) de confirmateur mappée(s) automatiquement`);
  };

  // Auto-map source values
  const handleAutoMapSources = () => {
    if (!columnMapping.sourceId || csvData.length === 0) return;

    const sourceColumn = columnMapping.sourceId;
    const uniqueSourceValues = Array.from(
      new Set(
        csvData
          .map(row => row[sourceColumn])
          .filter(val => val && val.toString().trim() !== '')
          .map(val => val.toString().trim())
      )
    );

    const newMapping = { ...sourceMapping };
    let matchedCount = 0;

    uniqueSourceValues.forEach(csvValue => {
      if (newMapping[csvValue]) return; // Already mapped

      const csvValueNormalized = normalizeString(csvValue);
      let bestMatch: any = null;
      let bestScore = 0;

      sources.forEach(source => {
        const sourceNameNormalized = normalizeString(source.name);
        const sourceIdNormalized = normalizeString(source.id);

        // Exact match
        if (csvValueNormalized === sourceNameNormalized || csvValueNormalized === sourceIdNormalized) {
          if (bestScore < 100) {
            bestMatch = source;
            bestScore = 100;
          }
        }
        // Contains match
        else if (csvValueNormalized.includes(sourceNameNormalized) || sourceNameNormalized.includes(csvValueNormalized)) {
          if (bestScore < 70) {
            bestMatch = source;
            bestScore = 70;
          }
        }
      });

      if (bestMatch && bestScore >= 70) {
        newMapping[csvValue] = bestMatch.id;
        matchedCount++;
      }
    });

    setSourceMapping(newMapping);
    toast.success(`${matchedCount} valeur(s) de source mappée(s) automatiquement`);
  };

  const handleIntegration = async () => {
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
      if (Object.keys(teleoperatorMapping).length > 0) {
        formData.append('teleoperatorMapping', JSON.stringify(teleoperatorMapping));
      }
      if (Object.keys(confirmateurMapping).length > 0) {
        formData.append('confirmateurMapping', JSON.stringify(confirmateurMapping));
      }
      if (Object.keys(sourceMapping).length > 0) {
        formData.append('sourceMapping', JSON.stringify(sourceMapping));
      }

      const results = await apiCall('/api/contacts/integration-update/', {
        method: 'POST',
        body: formData,
      });

      setImportResults(results);
      
      if (results.updated > 0) {
        const updatedContacts = results.success?.filter((s: any) => s.updatedFields) || [];
        if (updatedContacts.length > 0) {
          // Show detailed message with first few contacts
          const previewCount = Math.min(3, updatedContacts.length);
          const preview = updatedContacts.slice(0, previewCount).map((c: any) => {
            const name = c.contactName || c.contactId || 'Contact';
            const fields = c.updatedFields?.join(', ') || 'champs';
            return `${name} (${fields})`;
          }).join('; ');
          const moreText = updatedContacts.length > previewCount 
            ? ` et ${updatedContacts.length - previewCount} autre(s)` 
            : '';
          toast.success(`Intégration réussie: ${results.updated} contact(s) mis à jour${moreText}. ${preview}`);
        } else {
          toast.success(`Intégration réussie: ${results.updated} contact(s) mis à jour`);
        }
      }
      if (results.failed > 0) {
        toast.warning(`${results.failed} contact(s) n'ont pas pu être mis à jour`);
      }
    } catch (err: any) {
      const errorMessage = err.message || err.response?.error || 'Erreur lors de l\'intégration';
      setError(errorMessage);
      toast.error(errorMessage);
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
    setTeleoperatorMapping({});
    setConfirmateurMapping({});
    setSourceMapping({});
    setError(null);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (step === 'integration' && isLoading) {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="page-header">
          <div className="page-title-section">
            <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')} className="mr-4">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="page-title">Intégration des Contacts</h1>
              <p className="page-subtitle">Mise à jour des dates des contacts existants</p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-lg text-gray-600">Intégration en cours...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'integration' && importResults) {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="page-header">
          <div className="page-title-section">
            <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')} className="mr-4">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="page-title">Intégration des Contacts</h1>
              <p className="page-subtitle">Résultats de l'intégration</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Résultats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{importResults.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResults.updated}</div>
                <div className="text-sm text-gray-600">Mis à jour</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importResults.failed}</div>
                <div className="text-sm text-gray-600">Échecs</div>
              </div>
            </div>

            {importResults.errors && importResults.errors.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Erreurs</h3>
                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Ligne</th>
                        <th className="px-4 py-2 text-left">Erreur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResults.errors.map((error: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">{error.row}</td>
                          <td className="px-4 py-2 text-red-600">{error.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importResults.success && importResults.success.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">
                  Contacts mis à jour ({importResults.success.filter((s: any) => s.updatedFields).length})
                </h3>
                <div className="max-h-96 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Ligne</th>
                        <th className="px-4 py-2 text-left">Nom</th>
                        <th className="px-4 py-2 text-left">Email</th>
                        <th className="px-4 py-2 text-left">Ancien ID</th>
                        <th className="px-4 py-2 text-left">Contact ID</th>
                        <th className="px-4 py-2 text-left">Champs mis à jour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResults.success
                        .filter((s: any) => s.updatedFields && s.updatedFields.length > 0)
                        .map((success: any, idx: number) => (
                        <tr key={idx} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">{success.row}</td>
                          <td className="px-4 py-2 font-medium">{success.contactName || '-'}</td>
                          <td className="px-4 py-2">{success.contactEmail || '-'}</td>
                          <td className="px-4 py-2">{success.oldContactId || '-'}</td>
                          <td className="px-4 py-2 font-mono text-xs">{success.contactId}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {success.updatedFields?.map((field: string, fieldIdx: number) => (
                                <span 
                                  key={fieldIdx}
                                  className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                                >
                                  {field}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <Button onClick={handleReset} variant="outline">
                Nouvelle intégration
              </Button>
              <Button onClick={() => navigate('/contacts')}>
                Retour aux contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="page-header">
        <div className="page-title-section">
          <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')} className="mr-4">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="page-title">Intégration des Contacts</h1>
            <p className="page-subtitle">Mettre à jour les dates (création, modification, attribution) des contacts existants</p>
          </div>
        </div>
      </div>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 1: Télécharger le fichier CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Fichier CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <p className="text-sm text-gray-500">
                Le fichier CSV doit contenir les colonnes: old_contact_id, created_at, updated_at, assigned_at
              </p>
            </div>

            <div className="flex items-center space-x-2">
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

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 font-semibold">Erreur</p>
                  <p className="text-red-600">{error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Étape 2: Mapper les colonnes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Mappez les colonnes de votre fichier CSV aux champs du système.
              </p>

              <div className="space-y-4">
                {INTEGRATION_FIELDS.map((field) => (
                  <div key={field.value} className="flex items-center gap-4">
                    <div className="w-48 flex-shrink-0">
                      <Label>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                    </div>
                    <Select
                      value={columnMapping[field.value] || '__ignore__'}
                      onValueChange={(value) => {
                        setColumnMapping({
                          ...columnMapping,
                          [field.value]: value === '__ignore__' ? '' : value,
                        });
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner une colonne" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ignore__">Ignorer</SelectItem>
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

              <div className="flex gap-2 mt-6">
                <Button onClick={() => setStep('upload')} variant="outline">
                  Retour
                </Button>
                <Button onClick={handleStartIntegration}>
                  Démarrer l'intégration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Teleoperator Mapping Section */}
          {columnMapping.teleoperatorId && csvData.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Mapper les valeurs de téléopérateur</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoMapTeleoperateurs}
                    className="flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Auto-mapper
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Mappez les valeurs de téléopérateur de votre CSV aux téléopérateurs de la base de données
                </p>
                {(() => {
                  const teleoperatorColumn = columnMapping.teleoperatorId;
                  const uniqueTeleoperatorValues = Array.from(
                    new Set(
                      csvData
                        .map(row => row[teleoperatorColumn])
                        .filter(val => val && val.toString().trim() !== '')
                        .map(val => val.toString().trim())
                    )
                  ).sort();

                  if (uniqueTeleoperatorValues.length === 0) {
                    return (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                        <p className="text-sm text-yellow-800">
                          Aucune valeur de téléopérateur trouvée dans la colonne "{teleoperatorColumn}"
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="border rounded p-4 bg-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {uniqueTeleoperatorValues.map((csvValue) => (
                          <div key={csvValue} className="flex items-center gap-3">
                            <Label className="w-32 text-sm font-medium flex-shrink-0 truncate" title={csvValue}>
                              {csvValue}
                            </Label>
                            <Select
                              value={teleoperatorMapping[csvValue] || '__ignore__'}
                              onValueChange={(value) => {
                                setTeleoperatorMapping({
                                  ...teleoperatorMapping,
                                  [csvValue]: value === '__ignore__' ? '' : value,
                                });
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Sélectionner un téléopérateur" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ignore__">-- Non mappé --</SelectItem>
                                {teleoperateurs.map((teleoperator) => {
                                  const displayName = `${teleoperator.firstName || ''} ${teleoperator.lastName || ''}`.trim() || teleoperator.username || teleoperator.email || `Utilisateur ${teleoperator.id}`;
                                  return (
                                    <SelectItem key={teleoperator.id} value={teleoperator.id}>
                                      {displayName}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Confirmateur Mapping Section */}
          {columnMapping.confirmateurId && csvData.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Mapper les valeurs de confirmateur</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoMapConfirmateurs}
                    className="flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Auto-mapper
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Mappez les valeurs de confirmateur de votre CSV aux confirmateurs de la base de données
                </p>
                {(() => {
                  const confirmateurColumn = columnMapping.confirmateurId;
                  const uniqueConfirmateurValues = Array.from(
                    new Set(
                      csvData
                        .map(row => row[confirmateurColumn])
                        .filter(val => val && val.toString().trim() !== '')
                        .map(val => val.toString().trim())
                    )
                  ).sort();

                  if (uniqueConfirmateurValues.length === 0) {
                    return (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                        <p className="text-sm text-yellow-800">
                          Aucune valeur de confirmateur trouvée dans la colonne "{confirmateurColumn}"
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="border rounded p-4 bg-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {uniqueConfirmateurValues.map((csvValue) => (
                          <div key={csvValue} className="flex items-center gap-3">
                            <Label className="w-32 text-sm font-medium flex-shrink-0 truncate" title={csvValue}>
                              {csvValue}
                            </Label>
                            <Select
                              value={confirmateurMapping[csvValue] || '__ignore__'}
                              onValueChange={(value) => {
                                setConfirmateurMapping({
                                  ...confirmateurMapping,
                                  [csvValue]: value === '__ignore__' ? '' : value,
                                });
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Sélectionner un confirmateur" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ignore__">-- Non mappé --</SelectItem>
                                {confirmateurs.map((confirmateur) => {
                                  const displayName = `${confirmateur.firstName || ''} ${confirmateur.lastName || ''}`.trim() || confirmateur.username || confirmateur.email || `Utilisateur ${confirmateur.id}`;
                                  return (
                                    <SelectItem key={confirmateur.id} value={confirmateur.id}>
                                      {displayName}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Source Mapping Section */}
          {columnMapping.sourceId && csvData.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Mapper les valeurs de source</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoMapSources}
                    className="flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Auto-mapper
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Mappez les valeurs de source de votre CSV aux sources de la base de données
                </p>
                {(() => {
                  const sourceColumn = columnMapping.sourceId;
                  const uniqueSourceValues = Array.from(
                    new Set(
                      csvData
                        .map(row => row[sourceColumn])
                        .filter(val => val && val.toString().trim() !== '')
                        .map(val => val.toString().trim())
                    )
                  ).sort();

                  if (uniqueSourceValues.length === 0) {
                    return (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                        <p className="text-sm text-yellow-800">
                          Aucune valeur de source trouvée dans la colonne "{sourceColumn}"
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="border rounded p-4 bg-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {uniqueSourceValues.map((csvValue) => (
                          <div key={csvValue} className="flex items-center gap-3">
                            <Label className="w-32 text-sm font-medium flex-shrink-0 truncate" title={csvValue}>
                              {csvValue}
                            </Label>
                            <Select
                              value={sourceMapping[csvValue] || '__ignore__'}
                              onValueChange={(value) => {
                                setSourceMapping({
                                  ...sourceMapping,
                                  [csvValue]: value === '__ignore__' ? '' : value,
                                });
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Sélectionner une source" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__ignore__">-- Non mappé --</SelectItem>
                                {sources.map((source) => (
                                  <SelectItem key={source.id} value={source.id}>
                                    {source.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Aperçu des données</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {csvHeaders.map((header) => (
                        <th key={header} className="px-4 py-2 text-left border">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        {csvHeaders.map((header) => (
                          <td key={header} className="px-4 py-2 border">
                            {row[header] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 5 && (
                  <p className="text-sm text-gray-500 mt-2">
                    ... et {csvData.length - 5} autres lignes
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

