import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { ArrowLeft, Upload, Loader2, AlertCircle, Download, CheckCircle2, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import '../styles/PageHeader.css';

interface CsvRow {
  [key: string]: string;
}

interface ComparisonResult {
  totalRowsCsv1: number;
  totalRowsCsv2: number;
  matchedRows: number;
  unmatchedInCsv1: number;
  unmatchedInCsv2: number;
  unmatchedInCsv1Data: CsvRow[];
  unmatchedInCsv2Data: CsvRow[];
  csv1Content: string;
  csv2Content: string;
  filename1: string;
  filename2: string;
}

export function CsvComparePage() {
  const navigate = useNavigate();
  const file1InputRef = useRef<HTMLInputElement>(null);
  const file2InputRef = useRef<HTMLInputElement>(null);
  
  const [csvFile1, setCsvFile1] = useState<File | null>(null);
  const [csvFile2, setCsvFile2] = useState<File | null>(null);
  const [csv1Headers, setCsv1Headers] = useState<string[]>([]);
  const [csv2Headers, setCsv2Headers] = useState<string[]>([]);
  const [csv1Preview, setCsv1Preview] = useState<CsvRow[]>([]);
  const [csv2Preview, setCsv2Preview] = useState<CsvRow[]>([]);
  const [csv1Data, setCsv1Data] = useState<CsvRow[]>([]);
  const [csv2Data, setCsv2Data] = useState<CsvRow[]>([]);
  const [csv1Column, setCsv1Column] = useState<string>('');
  const [csv2Column, setCsv2Column] = useState<string>('');
  const [includeFirstRow, setIncludeFirstRow] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ComparisonResult | null>(null);

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

  const parseFile = async (file: File, includeFirstRowAsData: boolean = false): Promise<{ headers: string[]; data: CsvRow[]; preview: CsvRow[] }> => {
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (!isCsv && !isExcel) {
      throw new Error('Veuillez sélectionner un fichier CSV ou Excel (.xlsx, .xls)');
    }

    let headers: string[] = [];
    let allRows: CsvRow[] = [];

    if (isExcel) {
      // Handle Excel file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Use the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
      
      if (jsonData.length === 0) {
        throw new Error('Le fichier Excel est vide');
      }

      if (includeFirstRowAsData) {
        // Use first row as data, generate column names
        headers = jsonData[0].map((_, idx) => `Column${idx + 1}`);
        
        // Process all rows including first
        for (let i = 0; i < jsonData.length; i++) {
          const values = jsonData[i];
          const row: CsvRow = {};
          headers.forEach((header, idx) => {
            const value = values[idx];
            row[header] = value !== undefined && value !== null ? String(value).trim() : '';
          });
          allRows.push(row);
        }
      } else {
        // Extract headers (first row)
        headers = jsonData[0].map((h, idx) => {
          const cleaned = String(h || '').trim();
          return cleaned || `Column${idx + 1}`;
        });

        // Process rows starting from row 1
        for (let i = 1; i < jsonData.length; i++) {
          const values = jsonData[i];
          const row: CsvRow = {};
          headers.forEach((header, idx) => {
            const value = values[idx];
            row[header] = value !== undefined && value !== null ? String(value).trim() : '';
          });
          allRows.push(row);
        }
      }
    } else {
      // Handle CSV file
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('Le fichier CSV est vide');
      }

      if (includeFirstRowAsData) {
        // Use first row as data, generate column names
        headers = parseCSVLine(lines[0]).map((_, idx) => `Column${idx + 1}`);
        
        // Parse all rows including first
        for (let i = 0; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: CsvRow = {};
          headers.forEach((header, idx) => {
            row[header] = (values[idx] || '').replace(/^"|"$/g, '').trim();
          });
          allRows.push(row);
        }
      } else {
        // Parse headers
        const firstRowValues = parseCSVLine(lines[0]);
        headers = firstRowValues.map((h, idx) => {
          const cleaned = h.replace(/^"|"$/g, '').trim();
          return cleaned || `Column${idx + 1}`;
        });

        // Parse all rows
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: CsvRow = {};
          headers.forEach((header, idx) => {
            row[header] = (values[idx] || '').replace(/^"|"$/g, '').trim();
          });
          allRows.push(row);
        }
      }
    }

    // Get preview (first 5 rows)
    const preview = allRows.slice(0, 5);

    return { headers, data: allRows, preview };
  };

  const handleFile1Select = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile1(file);
    setError(null);
    setResults(null);
    setCsv1Column('');
    setIsLoading(true);

    try {
      const parsed = await parseFile(file, includeFirstRow);
      setCsv1Headers(parsed.headers);
      setCsv1Data(parsed.data);
      setCsv1Preview(parsed.preview);
      toast.success(`Fichier 1 chargé: ${parsed.data.length} lignes`);
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la lecture du fichier';
      setError(errorMessage);
      toast.error(errorMessage);
      setCsvFile1(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile2Select = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile2(file);
    setError(null);
    setResults(null);
    setCsv2Column('');
    setIsLoading(true);

    try {
      const parsed = await parseFile(file, includeFirstRow);
      setCsv2Headers(parsed.headers);
      setCsv2Data(parsed.data);
      setCsv2Preview(parsed.preview);
      toast.success(`Fichier 2 chargé: ${parsed.data.length} lignes`);
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la lecture du fichier';
      setError(errorMessage);
      toast.error(errorMessage);
      setCsvFile2(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompare = () => {
    if (!csvFile1 || !csvFile2) {
      toast.error('Veuillez sélectionner les deux fichiers CSV');
      return;
    }

    if (!csv1Column || !csv2Column) {
      toast.error('Veuillez sélectionner une colonne pour chaque fichier');
      return;
    }

    if (csv1Data.length === 0 || csv2Data.length === 0) {
      toast.error('Les fichiers ne contiennent pas de données');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      // Create Sets of values from both CSVs for fast lookup
      const csv1Values = new Set<string>();
      const csv2Values = new Set<string>();
      
      csv1Data.forEach(row => {
        const value = String(row[csv1Column] || '').trim().toLowerCase();
        if (value) {
          csv1Values.add(value);
        }
      });

      csv2Data.forEach(row => {
        const value = String(row[csv2Column] || '').trim().toLowerCase();
        if (value) {
          csv2Values.add(value);
        }
      });

      // Find unmatched rows from CSV1 (not in CSV2)
      const unmatchedInCsv1: CsvRow[] = [];
      csv1Data.forEach(row => {
        const value = String(row[csv1Column] || '').trim().toLowerCase();
        if (!value || !csv2Values.has(value)) {
          unmatchedInCsv1.push(row);
        }
      });

      // Find unmatched rows from CSV2 (not in CSV1)
      const unmatchedInCsv2: CsvRow[] = [];
      csv2Data.forEach(row => {
        const value = String(row[csv2Column] || '').trim().toLowerCase();
        if (!value || !csv1Values.has(value)) {
          unmatchedInCsv2.push(row);
        }
      });

      // Calculate matched rows (rows that exist in both)
      const matchedCount = csv1Data.length - unmatchedInCsv1.length;

      // Generate CSV content for unmatched rows from CSV1
      const csv1Lines: string[] = [];
      csv1Lines.push(csv1Headers.map(h => `"${h}"`).join(','));
      unmatchedInCsv1.forEach(row => {
        const values = csv1Headers.map(header => {
          const value = String(row[header] || '').replace(/"/g, '""');
          return `"${value}"`;
        });
        csv1Lines.push(values.join(','));
      });

      // Generate CSV content for unmatched rows from CSV2
      const csv2Lines: string[] = [];
      csv2Lines.push(csv2Headers.map(h => `"${h}"`).join(','));
      unmatchedInCsv2.forEach(row => {
        const values = csv2Headers.map(header => {
          const value = String(row[header] || '').replace(/"/g, '""');
          return `"${value}"`;
        });
        csv2Lines.push(values.join(','));
      });

      const csv1Content = csv1Lines.join('\n');
      const csv2Content = csv2Lines.join('\n');
      const dateStr = new Date().toISOString().split('T')[0];
      const filename1 = `comparison_unmatched_csv1_${dateStr}.csv`;
      const filename2 = `comparison_unmatched_csv2_${dateStr}.csv`;

      const result: ComparisonResult = {
        totalRowsCsv1: csv1Data.length,
        totalRowsCsv2: csv2Data.length,
        matchedRows: matchedCount,
        unmatchedInCsv1: unmatchedInCsv1.length,
        unmatchedInCsv2: unmatchedInCsv2.length,
        unmatchedInCsv1Data: unmatchedInCsv1.slice(0, 50), // Preview first 50 rows
        unmatchedInCsv2Data: unmatchedInCsv2.slice(0, 50), // Preview first 50 rows
        csv1Content,
        csv2Content,
        filename1,
        filename2,
      };

      setResults(result);

      toast.success(
        `Comparaison terminée: ${unmatchedInCsv1.length} ligne(s) du CSV 1 non trouvée(s), ${unmatchedInCsv2.length} ligne(s) du CSV 2 non trouvée(s)`
      );
    } catch (err: any) {
      const errorMessage = err.message || 'Une erreur est survenue lors de la comparaison';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCsv1 = () => {
    if (!results) return;

    const blob = new Blob([results.csv1Content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = results.filename1;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Fichier CSV 1 téléchargé');
  };

  const handleDownloadCsv2 = () => {
    if (!results) return;

    const blob = new Blob([results.csv2Content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = results.filename2;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Fichier CSV 2 téléchargé');
  };

  const handleClearFile1 = () => {
    setCsvFile1(null);
    setCsv1Headers([]);
    setCsv1Data([]);
    setCsv1Preview([]);
    setCsv1Column('');
    if (file1InputRef.current) {
      file1InputRef.current.value = '';
    }
  };

  const handleClearFile2 = () => {
    setCsvFile2(null);
    setCsv2Headers([]);
    setCsv2Data([]);
    setCsv2Preview([]);
    setCsv2Column('');
    if (file2InputRef.current) {
      file2InputRef.current.value = '';
    }
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
            <h1 className="page-title">Comparaison de fichiers CSV</h1>
            <p className="page-subtitle">
              Comparez deux fichiers CSV et trouvez les lignes de chaque fichier qui ne sont pas présentes dans l'autre
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <Card>
          <CardHeader>
            <CardTitle>Comparaison de fichiers CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {/* File Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CSV File 1 */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file-1">Fichier CSV 1 (Source)</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="csv-file-1"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      ref={file1InputRef}
                      onChange={handleFile1Select}
                      className="flex-1"
                      disabled={isLoading}
                    />
                    {csvFile1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearFile1}
                        className="h-9 w-9"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {csvFile1 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>{csvFile1.name}</span>
                      <span className="text-gray-400">({csv1Data.length} lignes)</span>
                    </div>
                  )}
                </div>

                {/* Column Selection for CSV 1 */}
                {csv1Headers.length > 0 && (
                  <div>
                    <Label htmlFor="csv1-column">
                      Colonne à comparer (CSV 1) <span className="text-red-500">*</span>
                    </Label>
                    <Select value={csv1Column} onValueChange={setCsv1Column}>
                      <SelectTrigger id="csv1-column" className="mt-2">
                        <SelectValue placeholder="Sélectionnez une colonne" />
                      </SelectTrigger>
                      <SelectContent>
                        {csv1Headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Preview CSV 1 */}
                {csv1Preview.length > 0 && csv1Headers.length > 0 && (
                  <div>
                    <Label>Aperçu du fichier 1</Label>
                    <div className="mt-2 border rounded-md overflow-auto max-h-48">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {csv1Headers.map((header) => (
                              <th key={header} className="px-3 py-2 text-left font-semibold border-b">
                                {header}
                                {header === csv1Column && (
                                  <span className="ml-1 text-blue-600">✓</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csv1Preview.map((row, idx) => (
                            <tr key={idx} className="border-b">
                              {csv1Headers.map((header) => (
                                <td
                                  key={header}
                                  className={`px-3 py-2 ${
                                    header === csv1Column ? 'bg-blue-50 font-medium' : ''
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
              </div>

              {/* CSV File 2 */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file-2">Fichier CSV 2 (Référence)</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="csv-file-2"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      ref={file2InputRef}
                      onChange={handleFile2Select}
                      className="flex-1"
                      disabled={isLoading}
                    />
                    {csvFile2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClearFile2}
                        className="h-9 w-9"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {csvFile2 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>{csvFile2.name}</span>
                      <span className="text-gray-400">({csv2Data.length} lignes)</span>
                    </div>
                  )}
                </div>

                {/* Column Selection for CSV 2 */}
                {csv2Headers.length > 0 && (
                  <div>
                    <Label htmlFor="csv2-column">
                      Colonne à comparer (CSV 2) <span className="text-red-500">*</span>
                    </Label>
                    <Select value={csv2Column} onValueChange={setCsv2Column}>
                      <SelectTrigger id="csv2-column" className="mt-2">
                        <SelectValue placeholder="Sélectionnez une colonne" />
                      </SelectTrigger>
                      <SelectContent>
                        {csv2Headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Preview CSV 2 */}
                {csv2Preview.length > 0 && csv2Headers.length > 0 && (
                  <div>
                    <Label>Aperçu du fichier 2</Label>
                    <div className="mt-2 border rounded-md overflow-auto max-h-48">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {csv2Headers.map((header) => (
                              <th key={header} className="px-3 py-2 text-left font-semibold border-b">
                                {header}
                                {header === csv2Column && (
                                  <span className="ml-1 text-blue-600">✓</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csv2Preview.map((row, idx) => (
                            <tr key={idx} className="border-b">
                              {csv2Headers.map((header) => (
                                <td
                                  key={header}
                                  className={`px-3 py-2 ${
                                    header === csv2Column ? 'bg-blue-50 font-medium' : ''
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
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-md">
              <Checkbox
                id="include-first-row"
                checked={includeFirstRow}
                onCheckedChange={async (checked) => {
                  const newValue = checked === true;
                  setIncludeFirstRow(newValue);
                  
                  // Reload files if they're already loaded
                  if (csvFile1) {
                    setError(null);
                    setResults(null);
                    setCsv1Column('');
                    setIsLoading(true);
                    try {
                      const parsed = await parseFile(csvFile1, newValue);
                      setCsv1Headers(parsed.headers);
                      setCsv1Data(parsed.data);
                      setCsv1Preview(parsed.preview);
                    } catch (err: any) {
                      const errorMessage = err.message || 'Erreur lors de la relecture du fichier';
                      setError(errorMessage);
                      toast.error(errorMessage);
                    } finally {
                      setIsLoading(false);
                    }
                  }
                  if (csvFile2) {
                    setError(null);
                    setResults(null);
                    setCsv2Column('');
                    setIsLoading(true);
                    try {
                      const parsed = await parseFile(csvFile2, newValue);
                      setCsv2Headers(parsed.headers);
                      setCsv2Data(parsed.data);
                      setCsv2Preview(parsed.preview);
                    } catch (err: any) {
                      const errorMessage = err.message || 'Erreur lors de la relecture du fichier';
                      setError(errorMessage);
                      toast.error(errorMessage);
                    } finally {
                      setIsLoading(false);
                    }
                  }
                }}
              />
              <Label htmlFor="include-first-row" className="text-sm font-normal cursor-pointer">
                Inclure la première ligne dans la comparaison (traiter comme données au lieu d'en-têtes)
              </Label>
            </div>

            {/* Compare Button */}
            {csvFile1 && csvFile2 && csv1Column && csv2Column && (
              <Button
                onClick={handleCompare}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Comparaison en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Comparer les fichiers
                  </>
                )}
              </Button>
            )}

            {/* Results Section */}
            {results && (
              <div className="space-y-6 border-t pt-6">
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-start gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-800 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-800">Comparaison terminée!</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3 pt-3 border-t border-green-200">
                    <div>
                      <p className="text-xs text-green-600">Lignes CSV 1</p>
                      <p className="text-lg font-semibold text-green-800">{results.totalRowsCsv1}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600">Lignes CSV 2</p>
                      <p className="text-lg font-semibold text-green-800">{results.totalRowsCsv2}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600">Correspondances</p>
                      <p className="text-lg font-semibold text-green-800">{results.matchedRows}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600">Non trouvées CSV 1</p>
                      <p className="text-lg font-semibold text-red-600">{results.unmatchedInCsv1}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600">Non trouvées CSV 2</p>
                      <p className="text-lg font-semibold text-red-600">{results.unmatchedInCsv2}</p>
                    </div>
                  </div>
                </div>

                {/* Preview of Unmatched Rows from CSV 1 */}
                {results.unmatchedInCsv1Data.length > 0 && (
                  <div>
                    <Label className="text-base font-semibold">
                      Lignes du CSV 1 non trouvées dans le CSV 2 ({Math.min(results.unmatchedInCsv1Data.length, results.unmatchedInCsv1)} sur {results.unmatchedInCsv1})
                    </Label>
                    <div className="mt-2 border rounded-md overflow-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {csv1Headers.map((header) => (
                              <th key={header} className="px-3 py-2 text-left font-semibold border-b">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.unmatchedInCsv1Data.map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              {csv1Headers.map((header) => (
                                <td key={header} className="px-3 py-2">
                                  {row[header] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {results.unmatchedInCsv1 > results.unmatchedInCsv1Data.length && (
                      <p className="text-xs text-gray-500 mt-1">
                        ... et {results.unmatchedInCsv1 - results.unmatchedInCsv1Data.length} autres lignes
                      </p>
                    )}
                    {results.unmatchedInCsv1 > 0 && (
                      <Button
                        onClick={handleDownloadCsv1}
                        variant="outline"
                        className="mt-3 w-full"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger CSV 1 non trouvées ({results.unmatchedInCsv1} lignes)
                      </Button>
                    )}
                  </div>
                )}

                {/* Preview of Unmatched Rows from CSV 2 */}
                {results.unmatchedInCsv2Data.length > 0 && (
                  <div>
                    <Label className="text-base font-semibold">
                      Lignes du CSV 2 non trouvées dans le CSV 1 ({Math.min(results.unmatchedInCsv2Data.length, results.unmatchedInCsv2)} sur {results.unmatchedInCsv2})
                    </Label>
                    <div className="mt-2 border rounded-md overflow-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {csv2Headers.map((header) => (
                              <th key={header} className="px-3 py-2 text-left font-semibold border-b">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.unmatchedInCsv2Data.map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              {csv2Headers.map((header) => (
                                <td key={header} className="px-3 py-2">
                                  {row[header] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {results.unmatchedInCsv2 > results.unmatchedInCsv2Data.length && (
                      <p className="text-xs text-gray-500 mt-1">
                        ... et {results.unmatchedInCsv2 - results.unmatchedInCsv2Data.length} autres lignes
                      </p>
                    )}
                    {results.unmatchedInCsv2 > 0 && (
                      <Button
                        onClick={handleDownloadCsv2}
                        variant="outline"
                        className="mt-3 w-full"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger CSV 2 non trouvées ({results.unmatchedInCsv2} lignes)
                      </Button>
                    )}
                  </div>
                )}

                {/* Perfect Match Message */}
                {results.unmatchedInCsv1 === 0 && results.unmatchedInCsv2 === 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                    <p className="font-semibold">Toutes les lignes des deux fichiers correspondent!</p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Comment ça fonctionne :</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Téléchargez deux fichiers CSV ou Excel (.xlsx, .xls)</li>
                <li>Sélectionnez une colonne dans chaque fichier pour la comparaison</li>
                <li>Cochez "Inclure la première ligne" si votre fichier n'a pas d'en-têtes</li>
                <li>Cliquez sur "Comparer" pour trouver les lignes de chaque fichier qui ne sont pas présentes dans l'autre</li>
                <li>Consultez les résultats et téléchargez les CSV des lignes non trouvées pour chaque fichier</li>
                <li>La comparaison est effectuée de manière insensible à la casse et bidirectionnelle</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

