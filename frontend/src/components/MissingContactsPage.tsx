import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Upload, Loader2, AlertCircle, Download, CheckCircle2, FileSpreadsheet, Check } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { ACCESS_TOKEN } from '../utils/constants';
import '../styles/PageHeader.css';

interface MissingContactRow {
  [key: string]: string;
}

export function MissingContactsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [oldIdColumn, setOldIdColumn] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    totalRows: number;
    rowsWithOldIds: number;
    rowsInDatabase: number;
    rowsMissing: number;
    missingRows: MissingContactRow[];
    csvContent: string;
    filename: string;
  } | null>(null);

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    setCsvFile(file);
    setError(null);
    setResults(null);
    setOldIdColumn('');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('Le fichier CSV est vide');
      }

      // Parse headers
      const firstRowValues = parseCSVLine(lines[0]);
      const headers = firstRowValues.map((h, idx) => {
        const cleaned = h.replace(/^"|"$/g, '').trim();
        return cleaned || `Column${idx + 1}`;
      });

      setCsvHeaders(headers);

      // Parse preview rows (first 5 data rows)
      const previewRows: any[] = [];
      for (let i = 1; i < Math.min(6, lines.length); i++) {
        const values = parseCSVLine(lines[i]);
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = (values[idx] || '').replace(/^"|"$/g, '');
        });
        previewRows.push(row);
      }
      setCsvPreview(previewRows);

      // Try to auto-detect old ID column
      const possibleNames = [
        'old id', 'old_id', 'old_contact_id', 'oldContactId',
        'old contact id', 'old-contact-id', 'oldcontactid',
        'OLD_ID', 'OLD_CONTACT_ID', 'Old ID', 'Old Contact ID'
      ];
      
      let detectedColumn = '';
      for (const name of possibleNames) {
        if (headers.includes(name)) {
          detectedColumn = name;
          break;
        }
      }
      
      if (!detectedColumn) {
        // Try case-insensitive
        const headersLower = headers.map(h => h.toLowerCase().replace(/[_\s-]/g, ''));
        for (const name of possibleNames) {
          const nameLower = name.toLowerCase().replace(/[_\s-]/g, '');
          const idx = headersLower.indexOf(nameLower);
          if (idx !== -1) {
            detectedColumn = headers[idx];
            break;
          }
        }
      }

      if (detectedColumn) {
        setOldIdColumn(detectedColumn);
        toast.success(`Colonne détectée automatiquement: ${detectedColumn}`);
      } else {
        toast.info('Veuillez sélectionner la colonne contenant les anciens IDs');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la lecture du fichier CSV';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleCheckMissing = async () => {
    if (!csvFile) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    if (!oldIdColumn) {
      toast.error('Veuillez sélectionner la colonne contenant les anciens IDs');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('oldIdColumn', oldIdColumn);

      const token = localStorage.getItem(ACCESS_TOKEN);
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/contacts/migration/missing/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Get the JSON response with statistics and CSV content
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      // Parse CSV content to get missing rows for preview
      const csvLines = data.csvContent.split('\n').filter((line: string) => line.trim());
      const missingRows: MissingContactRow[] = [];
      if (csvLines.length > 1) {
        const headers = parseCSVLine(csvLines[0]);
        for (let i = 1; i < csvLines.length; i++) {
          const values = parseCSVLine(csvLines[i]);
          const row: MissingContactRow = {};
          headers.forEach((header, idx) => {
            row[header] = (values[idx] || '').replace(/^"|"$/g, '');
          });
          missingRows.push(row);
        }
      }

      // Set results with statistics from backend
      setResults({
        totalRows: data.statistics.totalRows,
        rowsWithOldIds: data.statistics.rowsWithOldIds,
        rowsInDatabase: data.statistics.rowsInDatabase,
        rowsMissing: data.statistics.rowsMissing,
        missingRows: missingRows.slice(0, 10), // Preview first 10 rows
        csvContent: data.csvContent,
        filename: data.filename,
      });

      toast.success(
        `Vérification terminée: ${data.statistics.rowsMissing} contact(s) manquant(s) sur ${data.statistics.rowsWithOldIds} avec ancien ID`
      );
    } catch (err: any) {
      const errorMessage = err.message || 'Une erreur est survenue lors de la vérification';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!results) return;

    const blob = new Blob([results.csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = results.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Fichier CSV téléchargé');
  };

  const handleImportMissing = () => {
    if (!results) return;

    // Download the CSV first
    handleDownload();

    // Navigate to import page after a short delay
    setTimeout(() => {
      toast.info('Redirection vers la page d\'import...');
      navigate('/contacts/import');
    }, 1000);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/contacts/migration')}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="page-title">Vérifier les contacts manquants</h1>
            <p className="page-subtitle">
              Téléchargez un CSV avec les anciens IDs pour trouver les contacts qui ne sont pas encore dans la base de données
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <Card>
          <CardHeader>
            <CardTitle>Vérification des contacts manquants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: File Upload */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv-file">Fichier CSV</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="flex-1"
                  />
                  {csvFile && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Upload className="h-4 w-4" />
                      <span>{csvFile.name}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Le fichier CSV doit contenir une colonne avec les anciens IDs de contact
                </p>
              </div>

              {/* Column Selection */}
              {csvHeaders.length > 0 && (
                <div>
                  <Label htmlFor="old-id-column">
                    Colonne contenant les anciens IDs <span className="text-red-500">*</span>
                  </Label>
                  <Select value={oldIdColumn} onValueChange={setOldIdColumn}>
                    <SelectTrigger id="old-id-column" className="mt-2">
                      <SelectValue placeholder="Sélectionnez la colonne des anciens IDs" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500 mt-1">
                    Sélectionnez la colonne qui contient les anciens IDs de contact
                  </p>
                </div>
              )}

              {/* Preview */}
              {csvPreview.length > 0 && csvHeaders.length > 0 && (
                <div>
                  <Label>Aperçu du fichier CSV</Label>
                  <div className="mt-2 border rounded-md overflow-auto max-h-48">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {csvHeaders.map((header) => (
                            <th key={header} className="px-3 py-2 text-left font-semibold border-b">
                              {header}
                              {header === oldIdColumn && (
                                <span className="ml-1 text-blue-600">✓</span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, idx) => (
                          <tr key={idx} className="border-b">
                            {csvHeaders.map((header) => (
                              <td
                                key={header}
                                className={`px-3 py-2 ${
                                  header === oldIdColumn ? 'bg-blue-50 font-medium' : ''
                                }`}
                              >
                                {row[header] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Check Button */}
              {csvFile && oldIdColumn && (
                <Button
                  onClick={handleCheckMissing}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vérification en cours...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Vérifier les contacts manquants
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Step 2: Results */}
            {results && (
              <div className="space-y-4 border-t pt-6">
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-start gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-800 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-800">Vérification terminée!</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-green-200">
                    <div>
                      <p className="text-xs text-green-600">Total de lignes</p>
                      <p className="text-lg font-semibold text-green-800">{results.totalRows}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600">Avec ancien ID</p>
                      <p className="text-lg font-semibold text-green-800">{results.rowsWithOldIds}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600">Déjà en base</p>
                      <p className="text-lg font-semibold text-green-800">{results.rowsInDatabase}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600">Manquants</p>
                      <p className="text-lg font-semibold text-green-800">{results.rowsMissing}</p>
                    </div>
                  </div>
                </div>

                {/* Preview of Missing Contacts */}
                {results.missingRows.length > 0 && (
                  <div>
                    <Label>Aperçu des contacts manquants ({results.missingRows.length} premiers)</Label>
                    <div className="mt-2 border rounded-md overflow-auto max-h-64">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {csvHeaders.map((header) => (
                              <th key={header} className="px-3 py-2 text-left font-semibold border-b">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.missingRows.map((row, idx) => (
                            <tr key={idx} className="border-b">
                              {csvHeaders.map((header) => (
                                <td key={header} className="px-3 py-2">
                                  {row[header] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {results.rowsMissing > results.missingRows.length && (
                      <p className="text-xs text-gray-500 mt-1">
                        ... et {results.rowsMissing - results.missingRows.length} autres contacts
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger le CSV
                  </Button>
                  {results.rowsMissing > 0 && (
                    <Button
                      onClick={handleImportMissing}
                      className="flex-1"
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Importer les contacts manquants
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Comment ça fonctionne :</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Téléchargez un fichier CSV contenant une colonne avec les anciens IDs de contact</li>
                <li>Sélectionnez la colonne contenant les anciens IDs</li>
                <li>Cliquez sur "Vérifier" pour voir quels contacts sont manquants</li>
                <li>Consultez les résultats et téléchargez le CSV des contacts manquants</li>
                <li>Importez le fichier CSV pour ajouter les contacts manquants à la base de données</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
