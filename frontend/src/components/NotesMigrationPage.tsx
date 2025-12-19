import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Upload, Loader2, AlertCircle } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import '../styles/PageHeader.css';

interface ColumnMapping {
  [key: string]: string; // Note field -> CSV column
}

interface NoteCategory {
  id: string;
  name: string;
  orderIndex: number;
}

const NOTE_FIELDS = [
  { value: '', label: 'Ignorer cette colonne' },
  { value: 'id', label: 'ID Note' },
  { value: 'text', label: 'Texte (requis)', required: true },
  { value: 'oldContactId', label: 'Ancien ID Contact' },
  { value: 'createdAt', label: 'Date de création' },
];


export function NotesMigrationPage() {
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
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Load note categories
  React.useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setCategoriesLoading(true);
    try {
      const data = await apiCall('/api/note-categories/', {
        method: 'GET',
      });
      setCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setCategoriesLoading(false);
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
    NOTE_FIELDS.forEach(field => {
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
      { key: 'text', label: 'Texte' },
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
      if (defaultCategoryId) {
        formData.append('defaultCategoryId', defaultCategoryId);
      }

      const results = await apiCall('/api/notes/csv-import/', {
        method: 'POST',
        body: formData,
      });

      setImportResults(results);
      
      if (results.imported > 0) {
        toast.success(`Migration réussie: ${results.imported} note(s) importée(s)`);
      }
      if (results.failed > 0) {
        toast.warning(`${results.failed} note(s) n'ont pas pu être importée(s)`);
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
    setDefaultCategoryId('');
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
        <h1 className="text-3xl font-bold">Migration des Notes</h1>
        <p className="text-slate-600 mt-2">
          Importez des notes depuis un fichier CSV en mappant les colonnes aux champs du système
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
              <CardTitle>Étape 2: Mapper les colonnes CSV aux champs Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Mapper vos colonnes CSV aux champs Notes</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Les champs marqués d'un <span className="text-red-600 font-semibold">*</span> sont obligatoires
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto border rounded p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {NOTE_FIELDS.filter(field => field.value !== '').map((field) => {
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

              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="default-category">Catégorie par défaut</Label>
                  <Select 
                    value={defaultCategoryId || '__none__'} 
                    onValueChange={(value) => setDefaultCategoryId(value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger id="default-category">
                      <SelectValue placeholder="Sélectionner une catégorie (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune catégorie</SelectItem>
                      {categoriesLoading ? (
                        <SelectItem value="loading" disabled>Chargement...</SelectItem>
                      ) : (
                        categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    Utilisé si aucune catégorie n'est spécifiée dans le CSV
                  </p>
                </div>
              </div>

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
                    <div className="text-sm text-slate-600">Importées</div>
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
