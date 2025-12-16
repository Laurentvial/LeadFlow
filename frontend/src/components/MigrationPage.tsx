import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DateInput } from './ui/date-input';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Upload, FileSpreadsheet, Edit2, Save, X, Calendar, Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import { useStatuses } from '../hooks/useStatuses';
import { useSources } from '../hooks/useSources';
import { useUsers } from '../hooks/useUsers';
import { usePlatforms } from '../hooks/usePlatforms';
import { useUser } from '../contexts/UserContext';
import LoadingIndicator from './LoadingIndicator';
import { formatPhoneNumber, removePhoneSpaces } from '../utils/phoneNumber';
import '../styles/PageHeader.css';
import '../styles/Modal.css';

interface ColumnMapping {
  [key: string]: string; // CRM field -> CSV column
}

interface MigratedRow {
  id: string; // Unique ID for this row
  csvData: { [key: string]: string }; // Original CSV data
  mappedData: { [key: string]: any }; // Mapped contact data
  eventData?: {
    date: string;
    hour: string;
    minute: string;
    teleoperatorId: string;
  };
  isEditing: boolean;
  isSaving: boolean;
  contactId?: string; // If already saved
  errors?: string[];
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
  { value: 'statusId', label: 'Statut' },
  { value: 'sourceId', label: 'Source' },
  { value: 'teleoperatorId', label: 'Téléopérateur' },
  { value: 'confirmateurId', label: 'Confirmateur' },
  { value: 'platformId', label: 'Plateforme' },
  { value: 'montantEncaisse', label: 'Montant encaissé' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'paiement', label: 'Paiement' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'nomDeScene', label: 'Nom de scène' },
  { value: 'dateProTr', label: 'Date Pro TR' },
  { value: 'potentiel', label: 'Potentiel' },
  { value: 'produit', label: 'Produit' },
  { value: 'confirmateurEmail', label: 'Mail Confirmateur' },
  { value: 'confirmateurTelephone', label: 'Téléphone Confirmateur' },
];

export function MigrationPage() {
  const navigate = useNavigate();
  const { statuses, loading: statusesLoading } = useStatuses();
  const { sources, loading: sourcesLoading } = useSources();
  const { users, loading: usersLoading } = useUsers();
  const { currentUser } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'migration'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [migratedRows, setMigratedRows] = useState<MigratedRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRowData, setEditingRowData] = useState<MigratedRow | null>(null);
  const [defaultStatusId, setDefaultStatusId] = useState('');
  const [defaultSourceId, setDefaultSourceId] = useState('');
  const [defaultTeleoperatorId, setDefaultTeleoperatorId] = useState('');

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

  // Get all statuses (lead and client) filtered by view permissions
  const availableStatuses = React.useMemo(() => {
    if (!Array.isArray(statuses)) return [];
    return statuses.filter((s: any) => {
      if (!s.id || s.id.trim() === '') return false;
      const normalizedStatusId = String(s.id).trim();
      return statusViewPermissions.has(normalizedStatusId);
    });
  }, [statuses, statusViewPermissions]);

  // Get teleoperateurs
  const teleoperateurs = Array.isArray(users) ? users.filter((u: any) => u?.isTeleoperateur === true) : [];
  
  // Get confirmateurs
  const confirmateurs = Array.isArray(users) ? users.filter((u: any) => u?.isConfirmateur === true) : [];

  // Get platforms
  const { platforms, loading: platformsLoading } = usePlatforms();

  // Auto-set teleoperateur to current user if they have the teleoperateur role
  React.useEffect(() => {
    if (currentUser?.isTeleoperateur === true && currentUser?.id) {
      setDefaultTeleoperatorId(currentUser.id);
    }
  }, [currentUser]);

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

    if (!file.name.endsWith('.csv')) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Le fichier est trop volumineux. Taille maximale: 10MB');
      return;
    }

    setCsvFile(file);
    setIsLoading(true);
    setError(null);

    try {
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
      
      const allRows: any[] = [];
      for (let i = 0; i < lines.length; i++) {
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
      CRM_FIELDS.forEach(field => {
        if (field.value) {
          initialMapping[field.value] = '';
        }
      });
      setColumnMapping(initialMapping);

      setStep('mapping');
      toast.success(`Fichier chargé: ${allRows.length} lignes détectées`);
    } catch (error: any) {
      console.error('Error reading CSV:', error);
      const errorMessage = error?.error || error?.message || 'Erreur lors de la lecture du fichier CSV';
      setError(errorMessage);
      toast.error(errorMessage);
      setCsvFile(null);
      setStep('upload');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMigration = () => {
    if (!columnMapping.firstName) {
      toast.error('Veuillez mapper le champ requis: Prénom');
      return;
    }

    // Create migrated rows from CSV data
    const rows: MigratedRow[] = csvData.map((row, index) => {
      const mappedData: any = {};
      
      // Map all fields
      Object.keys(columnMapping).forEach(field => {
        const csvColumn = columnMapping[field];
        if (csvColumn && row[csvColumn] !== undefined) {
          let value = row[csvColumn];
          
          // Convert names to IDs for platformId and statusId
          if (field === 'platformId' && value) {
            const platform = platforms.find(p => 
              p.name?.toLowerCase().trim() === value.toString().toLowerCase().trim() ||
              p.id === value
            );
            if (platform) {
              value = platform.id;
            } else {
              // If not found, keep the value as is (might be an ID already)
              value = value;
            }
          } else if (field === 'statusId' && value) {
            const status = availableStatuses.find(s => 
              s.name?.toLowerCase().trim() === value.toString().toLowerCase().trim() ||
              s.id === value
            );
            if (status) {
              value = status.id;
            } else {
              // If not found, keep the value as is (might be an ID already)
              value = value;
            }
          }
          
          mappedData[field] = value;
        }
      });

      // Apply defaults
      if (!mappedData.statusId && defaultStatusId) {
        mappedData.statusId = defaultStatusId;
      }
      if (!mappedData.sourceId && defaultSourceId) {
        mappedData.sourceId = defaultSourceId;
      }
      if (!mappedData.teleoperatorId && defaultTeleoperatorId) {
        mappedData.teleoperatorId = defaultTeleoperatorId;
      }

      return {
        id: `row-${index}`,
        csvData: row,
        mappedData,
        isEditing: false,
        isSaving: false,
      };
    });

    setMigratedRows(rows);
    setStep('migration');
    toast.success(`${rows.length} lignes prêtes pour migration`);
  };

  const handleEditRow = (row: MigratedRow) => {
    setEditingRowData({ ...row });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingRowData(null);
  };

  const handleSaveFromModal = async () => {
    if (!editingRowData) return;
    await handleSaveRow(editingRowData);
    handleCloseEditModal();
  };

  const handleUpdateRowField = (rowId: string, field: string, value: any) => {
    setMigratedRows(prev => prev.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          mappedData: {
            ...row.mappedData,
            [field]: value
          }
        };
      }
      return row;
    }));
  };

  const handleUpdateEventField = (rowId: string, field: string, value: string) => {
    setMigratedRows(prev => prev.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          eventData: {
            ...row.eventData || { date: '', hour: '', minute: '', teleoperatorId: defaultTeleoperatorId || '' },
            [field]: value
          }
        };
      }
      return row;
    }));
  };

  const handleSaveRow = async (row: MigratedRow) => {
    if (!row.mappedData.firstName) {
      toast.error('Le prénom est requis');
      return;
    }

    setMigratedRows(prev => prev.map(r => 
      r.id === row.id ? { ...r, isSaving: true, errors: [] } : r
    ));

    try {
      // Prepare contact data
      const contactPayload: any = {
        firstName: row.mappedData.firstName,
        lastName: row.mappedData.lastName || '',
        email: row.mappedData.email || '',
        phone: row.mappedData.phone || '',
        mobile: row.mappedData.mobile || '',
        civility: row.mappedData.civility || '',
        birthDate: row.mappedData.birthDate || '',
        birthPlace: row.mappedData.birthPlace || '',
        address: row.mappedData.address || '',
        addressComplement: row.mappedData.addressComplement || '',
        postalCode: row.mappedData.postalCode || '',
        city: row.mappedData.city || '',
        nationality: row.mappedData.nationality || '',
        campaign: row.mappedData.campaign || '',
        statusId: row.mappedData.statusId || defaultStatusId,
        sourceId: row.mappedData.sourceId || defaultSourceId || null,
        teleoperatorId: row.mappedData.teleoperatorId || defaultTeleoperatorId || null,
        confirmateurId: row.mappedData.confirmateurId || null,
        platformId: row.mappedData.platformId || null,
        montantEncaisse: row.mappedData.montantEncaisse || '',
        bonus: row.mappedData.bonus || '',
        paiement: row.mappedData.paiement || '',
        contrat: row.mappedData.contrat || '',
        nomDeScene: row.mappedData.nomDeScene || '',
        dateProTr: row.mappedData.dateProTr || '',
        potentiel: row.mappedData.potentiel || '',
        produit: row.mappedData.produit || '',
        confirmateurEmail: row.mappedData.confirmateurEmail || '',
        confirmateurTelephone: row.mappedData.confirmateurTelephone || '',
      };

      // Create contact
      const contactResponse = await apiCall('/api/contacts/create/', {
        method: 'POST',
        body: JSON.stringify(contactPayload),
      });

      const contactId = contactResponse?.contact?.id || contactResponse?.id;
      
      if (!contactId) {
        throw new Error('Erreur lors de la création du contact');
      }

      // Create event if event data exists
      if (row.eventData?.date && row.eventData?.hour && row.eventData?.minute) {
        const timeString = `${row.eventData.hour.padStart(2, '0')}:${row.eventData.minute.padStart(2, '0')}`;
        await apiCall('/api/events/create/', {
          method: 'POST',
          body: JSON.stringify({
            datetime: `${row.eventData.date}T${timeString}`,
            contactId: contactId,
            userId: row.eventData.teleoperatorId || currentUser?.id || null,
            comment: ''
          }),
        });
      }

      setMigratedRows(prev => prev.map(r => 
        r.id === row.id ? { 
          ...r, 
          isSaving: false, 
          isEditing: false,
          contactId,
          errors: []
        } : r
      ));

      setEditingRowId(null);
      toast.success(`Contact créé avec succès`);
    } catch (error: any) {
      console.error('Error saving row:', error);
      const errorMessage = error?.error || error?.message || 'Erreur lors de la sauvegarde';
      setMigratedRows(prev => prev.map(r => 
        r.id === row.id ? { 
          ...r, 
          isSaving: false,
          errors: [errorMessage]
        } : r
      ));
      toast.error(errorMessage);
    }
  };

  const handleBulkSave = async () => {
    const rowsToSave = migratedRows.filter(r => !r.contactId && !r.isSaving);
    
    if (rowsToSave.length === 0) {
      toast.info('Aucune ligne à sauvegarder');
      return;
    }

    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of rowsToSave) {
      try {
        await handleSaveRow(row);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setIsLoading(false);
    toast.success(`${successCount} contact(s) créé(s), ${errorCount} erreur(s)`);
  };

  const handleReset = () => {
    setStep('upload');
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping({});
    setMigratedRows([]);
    setEditingRowId(null);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (statusesLoading || sourcesLoading || usersLoading || platformsLoading) {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="page-header">
          <div className="page-title-section">
            <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')} className="mr-4">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="page-title">Migration CRM</h1>
              <p className="page-subtitle">Migrer les données de l'ancien CRM</p>
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

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="page-header">
        <div className="page-title-section">
          <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')} className="mr-4">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="page-title">Migration CRM</h1>
            <p className="page-subtitle">Migrer les données de l'ancien CRM vers le nouveau système</p>
          </div>
        </div>
      </div>

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
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </p>
                  </div>
                )}
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-300 rounded">
                  <FileSpreadsheet className="w-16 h-16 text-slate-400 mb-4" />
                  <Label htmlFor="csv-file" className="text-lg font-medium mb-2">
                    Sélectionner un fichier CSV
                  </Label>
                  <p className="text-sm text-slate-500 pb-6 text-center max-w-md">
                    Importez un fichier CSV depuis l'ancien CRM. Vous pourrez mapper les colonnes, éditer chaque ligne et créer des événements.
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
                  <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} size="lg">
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
              <div className="bg-slate-50 p-4 rounded space-y-2">
                <p className="text-sm text-slate-700">
                  <strong>{csvData.length}</strong> ligne(s) détectée(s) dans le fichier
                </p>
                {csvHeaders.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Colonnes disponibles dans votre CSV:</p>
                    <div className="flex flex-wrap gap-2">
                      {csvHeaders.map((header) => (
                        <span key={header} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                          {header}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Mapper vos colonnes CSV aux champs CRM</h3>
                <div className="max-h-96 overflow-y-auto border rounded p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CRM_FIELDS.filter(field => field.value !== '').map((field) => (
                      <div key={field.value} className="flex items-center gap-3">
                        <Label className="w-40 text-sm font-medium flex-shrink-0">
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
              </div>

              {csvData.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Aperçu des données CSV</h4>
                  <p className="text-sm text-slate-600 mb-3">
                    Aperçu des premières lignes pour vous aider à mapper les colonnes correctement
                  </p>
                  <div className="border rounded overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {csvHeaders.map((header) => (
                            <th key={header} className="px-3 py-2 text-left border-b font-semibold">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
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
                    {csvData.length > 5 && (
                      <div className="px-3 py-2 bg-slate-50 text-xs text-slate-500 text-center border-t">
                        ... et {csvData.length - 5} autre(s) ligne(s)
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="default-status">Statut par défaut</Label>
                  <Select value={defaultStatusId} onValueChange={setDefaultStatusId}>
                    <SelectTrigger id="default-status">
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStatuses.map((status) => (
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
                  <Label htmlFor="default-teleoperator">Téléopérateur par défaut</Label>
                  <Select value={defaultTeleoperatorId} onValueChange={setDefaultTeleoperatorId}>
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
                  <Label htmlFor="default-source">Source par défaut</Label>
                  <Select value={defaultSourceId || '__none__'} onValueChange={(value) => setDefaultSourceId(value === '__none__' ? '' : value)}>
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

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => navigate('/contacts')}>
                  Annuler
                </Button>
                <Button onClick={handleStartMigration} disabled={!columnMapping.firstName}>
                  Continuer vers la migration
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'migration' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Étape 3 : Migration des données</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    Nouveau fichier
                  </Button>
                  <Button onClick={handleBulkSave} disabled={isLoading || migratedRows.filter(r => !r.contactId).length === 0}>
                    <Save className="w-4 h-4 mr-2" />
                    Sauvegarder tout ({migratedRows.filter(r => !r.contactId).length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Instructions:</strong> Vous pouvez éditer chaque ligne individuellement, ajouter des événements, puis sauvegarder.
                    Les lignes déjà sauvegardées sont marquées en vert.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left border">Ligne</th>
                        <th className="px-3 py-2 text-left border">Prénom</th>
                        <th className="px-3 py-2 text-left border">Nom</th>
                        <th className="px-3 py-2 text-left border">Email</th>
                        <th className="px-3 py-2 text-left border">Téléphone</th>
                        <th className="px-3 py-2 text-left border">Statut</th>
                        <th className="px-3 py-2 text-left border">Événement</th>
                        <th className="px-3 py-2 text-left border">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {migratedRows.map((row, index) => {
                        const isSaved = !!row.contactId;
                        
                        return (
                          <tr key={row.id} className={isSaved ? 'bg-green-50' : ''}>
                            <td className="px-3 py-2 border">{index + 1}</td>
                            <td className="px-3 py-2 border">{row.mappedData.firstName || '-'}</td>
                            <td className="px-3 py-2 border">{row.mappedData.lastName || '-'}</td>
                            <td className="px-3 py-2 border">{row.mappedData.email || '-'}</td>
                            <td className="px-3 py-2 border">{formatPhoneNumber(row.mappedData.phone) || '-'}</td>
                            <td className="px-3 py-2 border">
                              {availableStatuses.find(s => s.id === row.mappedData.statusId)?.name || '-'}
                            </td>
                            <td className="px-3 py-2 border">
                              {row.eventData?.date ? (
                                <span className="text-xs">
                                  {row.eventData.date} {row.eventData.hour}:{row.eventData.minute}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-3 py-2 border">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditRow(row)}
                                disabled={isSaved}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {isSaved && (
                                <CheckCircle2 className="w-4 h-4 text-green-600 ml-2 inline" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {migratedRows.some(r => r.errors && r.errors.length > 0) && (
                  <div className="bg-red-50 border border-red-200 rounded p-4">
                    <h4 className="font-medium text-red-600 mb-2">Erreurs:</h4>
                    {migratedRows.map((row, idx) => 
                      row.errors && row.errors.length > 0 && (
                        <p key={idx} className="text-sm text-red-600">
                          Ligne {idx + 1}: {row.errors.join(', ')}
                        </p>
                      )
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Row Modal */}
      {showEditModal && editingRowData && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Éditer la ligne</h2>
              <Button type="button" variant="ghost" size="icon" className="modal-close" onClick={handleCloseEditModal}>
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="grid grid-cols-2 gap-4">
                {/* Basic Fields */}
                <div className="modal-form-field">
                  <Label>Prénom <span style={{ color: '#ef4444' }}>*</span></Label>
                  <Input
                    value={editingRowData.mappedData.firstName || ''}
                    onChange={(e) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, firstName: e.target.value }
                    })}
                  />
                </div>
                <div className="modal-form-field">
                  <Label>Nom</Label>
                  <Input
                    value={editingRowData.mappedData.lastName || ''}
                    onChange={(e) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, lastName: e.target.value }
                    })}
                  />
                </div>
                <div className="modal-form-field">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingRowData.mappedData.email || ''}
                    onChange={(e) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, email: e.target.value }
                    })}
                  />
                </div>
                <div className="modal-form-field">
                  <Label>Téléphone 1</Label>
                  <Input
                    value={editingRowData.mappedData.phone || ''}
                    onChange={(e) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, phone: removePhoneSpaces(e.target.value) }
                    })}
                  />
                </div>
                <div className="modal-form-field">
                  <Label>Téléphone 2</Label>
                  <Input
                    value={editingRowData.mappedData.mobile || ''}
                    onChange={(e) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, mobile: removePhoneSpaces(e.target.value) }
                    })}
                  />
                </div>
                <div className="modal-form-field">
                  <Label>Statut</Label>
                  <Select
                    value={editingRowData.mappedData.statusId || ''}
                    onValueChange={(value) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, statusId: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-form-field">
                  <Label>Source</Label>
                  <Select
                    value={editingRowData.mappedData.sourceId || '__none__'}
                    onValueChange={(value) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, sourceId: value === '__none__' ? '' : value }
                    })}
                  >
                    <SelectTrigger>
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
                <div className="modal-form-field">
                  <Label>Téléopérateur</Label>
                  <Select
                    value={editingRowData.mappedData.teleoperatorId || ''}
                    onValueChange={(value) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, teleoperatorId: value }
                    })}
                  >
                    <SelectTrigger>
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
                <div className="modal-form-field">
                  <Label>Confirmateur</Label>
                  <Select
                    value={editingRowData.mappedData.confirmateurId || '__none__'}
                    onValueChange={(value) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, confirmateurId: value === '__none__' ? '' : value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un confirmateur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun confirmateur</SelectItem>
                      {confirmateurs.map((confirmateur) => (
                        <SelectItem key={confirmateur.id} value={confirmateur.id}>
                          {confirmateur.firstName} {confirmateur.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-form-field">
                  <Label>Plateforme</Label>
                  <Select
                    value={editingRowData.mappedData.platformId || '__none__'}
                    onValueChange={(value) => setEditingRowData({
                      ...editingRowData,
                      mappedData: { ...editingRowData.mappedData, platformId: value === '__none__' ? '' : value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une plateforme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune plateforme</SelectItem>
                      {platforms.map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          {platform.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Event Section */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4">Événement (optionnel)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="modal-form-field">
                    <Label>Date de l'événement</Label>
                    <DateInput
                      value={editingRowData.eventData?.date || ''}
                      onChange={(value) => setEditingRowData({
                        ...editingRowData,
                        eventData: {
                          ...editingRowData.eventData || { date: '', hour: '', minute: '', teleoperatorId: defaultTeleoperatorId || '' },
                          date: value
                        }
                      })}
                    />
                  </div>
                  <div className="modal-form-field">
                    <Label>Heure</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="HH"
                        value={editingRowData.eventData?.hour || ''}
                        onChange={(e) => setEditingRowData({
                          ...editingRowData,
                          eventData: {
                            ...editingRowData.eventData || { date: '', hour: '', minute: '', teleoperatorId: defaultTeleoperatorId || '' },
                            hour: e.target.value
                          }
                        })}
                        min="0"
                        max="23"
                      />
                      <Input
                        type="number"
                        placeholder="MM"
                        value={editingRowData.eventData?.minute || ''}
                        onChange={(e) => setEditingRowData({
                          ...editingRowData,
                          eventData: {
                            ...editingRowData.eventData || { date: '', hour: '', minute: '', teleoperatorId: defaultTeleoperatorId || '' },
                            minute: e.target.value
                          }
                        })}
                        min="0"
                        max="59"
                      />
                    </div>
                  </div>
                  <div className="modal-form-field">
                    <Label>Téléopérateur pour l'événement</Label>
                    <Select
                      value={editingRowData.eventData?.teleoperatorId || defaultTeleoperatorId || ''}
                      onValueChange={(value) => setEditingRowData({
                        ...editingRowData,
                        eventData: {
                          ...editingRowData.eventData || { date: '', hour: '', minute: '', teleoperatorId: defaultTeleoperatorId || '' },
                          teleoperatorId: value
                        }
                      })}
                    >
                      <SelectTrigger>
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
                </div>
              </div>

              <div className="modal-form-actions">
                <Button type="button" variant="outline" onClick={handleCloseEditModal}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    // Update the row in migratedRows
                    setMigratedRows(prev => prev.map(r => 
                      r.id === editingRowData.id ? editingRowData : r
                    ));
                    await handleSaveFromModal();
                  }}
                  disabled={editingRowData.isSaving || !editingRowData.mappedData.firstName}
                >
                  {editingRowData.isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Sauvegarder
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

