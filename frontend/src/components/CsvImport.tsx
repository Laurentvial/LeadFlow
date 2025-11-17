import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { useStatuses } from '../hooks/useStatuses';
import { useSources } from '../hooks/useSources';
import LoadingIndicator from './LoadingIndicator';
import '../styles/PageHeader.css';

interface ColumnMapping {
  [key: string]: string; // CRM field -> CSV column
}

const CRM_FIELDS = [
  { value: '', label: 'Ignorer cette colonne' },
  { value: 'civility', label: 'Civilité' },
  { value: 'firstName', label: 'Prénom (requis)' },
  { value: 'lastName', label: 'Nom (requis)' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'mobile', label: 'Portable (requis)' },
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
  const { sources, loading: sourcesLoading, error: sourcesError } = useSources();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'results'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [defaultStatusId, setDefaultStatusId] = useState('');
  const [defaultSourceId, setDefaultSourceId] = useState('');
  const [importResults, setImportResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get lead statuses only, with safe fallback
  const leadStatuses = Array.isArray(statuses) ? statuses.filter((s: any) => s?.type === 'lead') : [];

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

      setCsvHeaders(response.headers || []);
      setCsvPreview(response.preview || []);
      setTotalRows(response.totalRows || 0);

      // Initialize column mapping with empty values
      const initialMapping: ColumnMapping = {};
      CRM_FIELDS.forEach(field => {
        if (field.value) {
          initialMapping[field.value] = '';
        }
      });
      setColumnMapping(initialMapping);

      setStep('mapping');
      toast.success(`Fichier chargé: ${response.totalRows} lignes détectées`);
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
    // Validate required mappings
    if (!columnMapping.firstName || !columnMapping.lastName || !columnMapping.mobile) {
      toast.error('Veuillez mapper les champs requis: Prénom, Nom, et Portable');
      return;
    }

    if (!defaultStatusId) {
      toast.error('Veuillez sélectionner un statut par défaut');
      return;
    }

    if (!csvFile) {
      toast.error('Aucun fichier sélectionné');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep('importing');

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('columnMapping', JSON.stringify(columnMapping));
      formData.append('defaultStatusId', defaultStatusId);
      if (defaultSourceId) {
        formData.append('defaultSourceId', defaultSourceId);
      }

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
    setTotalRows(0);
    setColumnMapping({});
    setDefaultStatusId('');
    setDefaultSourceId('');
    setImportResults(null);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Show loading if hooks are still loading
  if (statusesLoading || sourcesLoading) {
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
  if (statusesError || sourcesError) {
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
                {statusesError || sourcesError || 'Impossible de charger les données nécessaires'}
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
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </p>
                  </div>
                )}
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-300 rounded-lg">
                  <FileSpreadsheet className="w-16 h-16 text-slate-400 mb-4" />
                  <Label htmlFor="csv-file" className="text-lg font-medium mb-2">
                    Sélectionner un fichier CSV
                  </Label>
                  <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
                    Importez n'importe quel fichier CSV. Vous pourrez ensuite mapper vos colonnes aux champs du CRM.
                    Les champs requis sont: Prénom, Nom, et Portable. Taille maximale: 10MB
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
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
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
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700"
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
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Aucune colonne détectée dans le fichier CSV. Vérifiez que votre fichier contient bien une ligne d'en-tête.
                    </p>
                  </div>
                )}

                <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4">
                  {CRM_FIELDS.filter(field => field.value !== '').map((field) => (
                    <div key={field.value} className="flex items-center gap-4 py-2">
                      <Label className="w-48 text-sm font-medium">
                        {field.label}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="default-status">Statut par défaut (requis)</Label>
                  <Select
                    value={defaultStatusId}
                    onValueChange={setDefaultStatusId}
                  >
                    <SelectTrigger id="default-status">
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      {leadStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-source">Source par défaut (optionnel)</Label>
                  <Select
                    value={defaultSourceId || '__none__'}
                    onValueChange={(value) => setDefaultSourceId(value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger id="default-source">
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
                </div>
              </div>

              {csvPreview.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Aperçu des données</h4>
                  <div className="border rounded-lg overflow-x-auto">
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
                  disabled={isLoading || !columnMapping.firstName || !columnMapping.lastName || !columnMapping.mobile || !defaultStatusId}
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
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md">
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
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
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
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
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
    </div>
  );
}

