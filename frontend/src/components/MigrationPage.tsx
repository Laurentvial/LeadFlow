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
import { handleModalOverlayClick } from '../utils/modal';
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
  { value: 'firstName', label: 'Prénom (requis)', required: true },
  { value: 'lastName', label: 'Nom (requis)', required: true },
  { value: 'phone', label: 'Téléphone 1 (requis)', required: true },
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
  { value: 'statusId', label: 'Statut (requis)', required: true },
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
  { value: 'createdAt', label: 'Date de création' },
  { value: 'updatedAt', label: 'Date de modification' },
  { value: 'assignedAt', label: 'Date d\'attribution' },
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
  const [excludeFirstRow, setExcludeFirstRow] = useState(true); // Default to exclude first row (header)
  const [statusMapping, setStatusMapping] = useState<{ [csvValue: string]: string }>({}); // CSV value -> Status ID
  const [platformMapping, setPlatformMapping] = useState<{ [csvValue: string]: string }>({}); // CSV value -> Platform ID
  const [confirmateurMapping, setConfirmateurMapping] = useState<{ [csvValue: string]: string }>({}); // CSV value -> Confirmateur ID
  const [teleoperatorMapping, setTeleoperatorMapping] = useState<{ [csvValue: string]: string }>({}); // CSV value -> Teleoperator ID
  const [contratMapping, setContratMapping] = useState<{ [csvValue: string]: string }>({}); // CSV value -> Contrat value
  const [sourceMapping, setSourceMapping] = useState<{ [csvValue: string]: string }>({}); // CSV value -> Source ID
  const [eventDateColumn, setEventDateColumn] = useState<string>(''); // CSV column for event date
  const [eventHourColumn, setEventHourColumn] = useState<string>(''); // CSV column for event hour (optional)
  const [eventMinuteColumn, setEventMinuteColumn] = useState<string>(''); // CSV column for event minute (optional)
  const [defaultEventHour, setDefaultEventHour] = useState<string>('09'); // Default hour if not in CSV
  const [defaultEventMinute, setDefaultEventMinute] = useState<string>('00'); // Default minute if not in CSV

  // Contrat options from the select
  const contratOptions = [
    { value: 'CONTRAT SIGNÉ', label: 'CONTRAT SIGNÉ' },
    { value: 'CONTRAT ENVOYÉ MAIS PAS SIGNÉ', label: 'CONTRAT ENVOYÉ MAIS PAS SIGNÉ' },
    { value: 'PAS DE CONTRAT ENVOYÉ', label: 'PAS DE CONTRAT ENVOYÉ' },
    { value: 'J\'AI SIGNÉ LE CONTRAT POUR LE CLIENT', label: 'J\'AI SIGNÉ LE CONTRAT POUR LE CLIENT' },
  ];

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
    CRM_FIELDS.forEach(field => {
      if (field.value) {
        initialMapping[field.value] = '';
      }
    });
    setColumnMapping(initialMapping);
    setStatusMapping({}); // Reset status mapping
    setPlatformMapping({}); // Reset platform mapping
    setConfirmateurMapping({}); // Reset confirmateur mapping
    setTeleoperatorMapping({}); // Reset teleoperator mapping
    setContratMapping({}); // Reset contrat mapping
    setSourceMapping({}); // Reset source mapping

    return allRows;
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
      const allRows = await parseCSVFile(file, excludeFirstRow);
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
    // Validate all required fields
    const requiredFields = [
      { key: 'firstName', label: 'Prénom' },
      { key: 'lastName', label: 'Nom' },
      { key: 'phone', label: 'Téléphone 1' },
      { key: 'statusId', label: 'Statut' },
    ];
    
    const missingFields = requiredFields.filter(field => !columnMapping[field.key]);
    
    if (missingFields.length > 0) {
      const fieldsList = missingFields.map(f => f.label).join(', ');
      toast.error(`Veuillez mapper les champs requis: ${fieldsList}`);
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
            const valueStr = value.toString().trim();
            // First check platform mapping
            if (platformMapping[valueStr]) {
              value = platformMapping[valueStr];
            } else {
              // Try to find by name or ID
              const platform = platforms.find(p => 
                p.name?.toLowerCase().trim() === valueStr.toLowerCase().trim() ||
                p.id === valueStr
              );
              if (platform) {
                value = platform.id;
              } else {
                // If not found, keep the value as is (might be an ID already)
                value = value;
              }
            }
          } else if (field === 'statusId' && value) {
            const valueStr = value.toString().trim();
            // First check status mapping
            if (statusMapping[valueStr]) {
              value = statusMapping[valueStr];
            } else {
              // Try to find by name or ID
              const status = availableStatuses.find(s => 
                s.name?.toLowerCase().trim() === valueStr.toLowerCase().trim() ||
                s.id === valueStr
              );
              if (status) {
                value = status.id;
              } else {
                // If not found, keep the value as is (might be an ID already)
                value = value;
              }
            }
          } else if (field === 'sourceId' && value) {
            const valueStr = value.toString().trim();
            // First check source mapping
            if (sourceMapping[valueStr]) {
              value = sourceMapping[valueStr];
            } else {
              // Try to find by name or ID
              const source = sources.find(s => 
                s.name?.toLowerCase().trim() === valueStr.toLowerCase().trim() ||
                s.id === valueStr
              );
              if (source) {
                value = source.id;
              } else {
                // If not found, keep the value as is (might be an ID already)
                value = value;
              }
            }
          } else if (field === 'confirmateurId') {
            if (value && value.toString().trim()) {
              const valueStr = value.toString().trim();
              // First check confirmateur mapping
              if (confirmateurMapping[valueStr]) {
                value = confirmateurMapping[valueStr];
              } else {
                // Try to find by name or ID
                const confirmateur = confirmateurs.find(c => {
                  const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
                  return fullName.toLowerCase() === valueStr.toLowerCase().trim() ||
                         c.username?.toLowerCase().trim() === valueStr.toLowerCase().trim() ||
                         c.email?.toLowerCase().trim() === valueStr.toLowerCase().trim() ||
                         c.id === valueStr;
                });
                if (confirmateur) {
                  value = confirmateur.id;
                } else {
                  // If not found, keep the value as is (might be an ID already)
                  value = valueStr;
                }
              }
            } else {
              // Empty value, set to null
              value = null;
            }
          } else if (field === 'teleoperatorId') {
            if (value && value.toString().trim()) {
              const valueStr = value.toString().trim();
              // First check teleoperator mapping
              if (teleoperatorMapping[valueStr]) {
                value = teleoperatorMapping[valueStr];
              } else {
                // Try to find by name or ID
                const teleoperator = teleoperateurs.find(t => {
                  const fullName = `${t.firstName || ''} ${t.lastName || ''}`.trim();
                  return fullName.toLowerCase() === valueStr.toLowerCase().trim() ||
                         t.username?.toLowerCase().trim() === valueStr.toLowerCase().trim() ||
                         t.email?.toLowerCase().trim() === valueStr.toLowerCase().trim() ||
                         t.id === valueStr;
                });
                if (teleoperator) {
                  value = teleoperator.id;
                } else {
                  // If not found, keep the value as is (might be an ID already)
                  value = valueStr;
                }
              }
            } else {
              // Empty value, set to null
              value = null;
            }
          } else if (field === 'contrat' && value) {
            const valueStr = value.toString().trim();
            // First check contrat mapping
            if (contratMapping[valueStr]) {
              value = contratMapping[valueStr];
            } else {
              // Try to find exact match with contrat options
              const matchedOption = contratOptions.find(opt => 
                opt.value.toLowerCase().trim() === valueStr.toLowerCase().trim() ||
                opt.label.toLowerCase().trim() === valueStr.toLowerCase().trim()
              );
              if (matchedOption) {
                value = matchedOption.value;
              } else {
                // If not found, set to empty
                value = '';
              }
            }
          } else if ((field === 'createdAt' || field === 'updatedAt' || field === 'assignedAt') && value) {
            // Handle date fields - try to parse and format dates
            const dateValue = value.toString().trim();
            if (dateValue) {
              // Try to parse various date formats
              const parsedDate = new Date(dateValue);
              if (!isNaN(parsedDate.getTime())) {
                // Format as ISO string (YYYY-MM-DDTHH:mm:ss)
                value = parsedDate.toISOString();
              } else {
                // If parsing fails, keep original value - backend should handle parsing
                value = dateValue;
              }
            }
          }
          
          mappedData[field] = value;
        }
      });

      // Parse event data from CSV columns if event date column is mapped
      let eventData: MigratedRow['eventData'] | undefined = undefined;
      if (eventDateColumn && row[eventDateColumn]) {
        const dateValue = row[eventDateColumn].toString().trim();
        if (dateValue) {
          try {
            // Parse date in dd/mm/yyyy format
            let parsedDate: Date | null = null;
            
            // Try to parse dd/mm/yyyy format first
            const ddmmyyyyMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (ddmmyyyyMatch) {
              const day = parseInt(ddmmyyyyMatch[1], 10);
              const month = parseInt(ddmmyyyyMatch[2], 10);
              const year = parseInt(ddmmyyyyMatch[3], 10);
              parsedDate = new Date(year, month - 1, day);
            } else {
              // Fallback to standard Date parsing for other formats
              parsedDate = new Date(dateValue);
            }
            
            if (parsedDate && !isNaN(parsedDate.getTime())) {
              // Extract date components
              const year = parsedDate.getFullYear();
              const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
              const day = String(parsedDate.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;
              
              // Get hour and minute from columns or use defaults
              let hour = defaultEventHour;
              let minute = defaultEventMinute;
              
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
              
              // Override with hour column if mapped
              if (eventHourColumn && row[eventHourColumn]) {
                const hourValue = row[eventHourColumn].toString().trim();
                if (hourValue) {
                  const hourMatch = hourValue.match(/\d{1,2}/);
                  if (hourMatch) {
                    const h = parseInt(hourMatch[0]);
                    if (h >= 0 && h <= 23) {
                      hour = String(h).padStart(2, '0');
                    }
                  }
                }
              }
              
              // Override with minute column if mapped
              if (eventMinuteColumn && row[eventMinuteColumn]) {
                const minuteValue = row[eventMinuteColumn].toString().trim();
                if (minuteValue) {
                  const minuteMatch = minuteValue.match(/\d{1,2}/);
                  if (minuteMatch) {
                    const m = parseInt(minuteMatch[0]);
                    if (m >= 0 && m <= 59) {
                      minute = String(m).padStart(2, '0');
                    }
                  }
                }
              }
              
              eventData = {
                date: dateStr,
                hour: hour,
                minute: minute,
                teleoperatorId: defaultTeleoperatorId || ''
              };
            }
          } catch (error) {
            console.error('Error parsing event date:', error);
          }
        }
      }

      return {
        id: `row-${index}`,
        csvData: row,
        mappedData,
        eventData,
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
    // Validate all required fields
    if (!row.mappedData.firstName || !row.mappedData.firstName.trim()) {
      toast.error('Le prénom est requis');
      return;
    }
    if (!row.mappedData.lastName || !row.mappedData.lastName.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    if (!row.mappedData.phone || !row.mappedData.phone.trim()) {
      toast.error('Le téléphone 1 est requis');
      return;
    }
    if (!row.mappedData.statusId) {
      toast.error('Le statut est requis');
      return;
    }

    setMigratedRows(prev => prev.map(r => 
      r.id === row.id ? { ...r, isSaving: true, errors: [] } : r
    ));

    try {
      // Prepare contact data
      const contactPayload: any = {
        firstName: row.mappedData.firstName.trim(),
        lastName: row.mappedData.lastName.trim(),
        email: row.mappedData.email || '',
        phone: removePhoneSpaces(String(row.mappedData.phone)),
        mobile: row.mappedData.mobile && row.mappedData.mobile.trim() ? removePhoneSpaces(String(row.mappedData.mobile)) : removePhoneSpaces(String(row.mappedData.phone || '')), // Use phone as fallback if mobile is empty
        civility: row.mappedData.civility || '',
        birthDate: row.mappedData.birthDate || '',
        birthPlace: row.mappedData.birthPlace || '',
        address: row.mappedData.address || '',
        addressComplement: row.mappedData.addressComplement || '',
        postalCode: row.mappedData.postalCode || '',
        city: row.mappedData.city || '',
        nationality: row.mappedData.nationality || '',
        campaign: row.mappedData.campaign || '',
        statusId: row.mappedData.statusId || null,
        sourceId: row.mappedData.sourceId || null,
        teleoperatorId: row.mappedData.teleoperatorId && row.mappedData.teleoperatorId.toString().trim() ? row.mappedData.teleoperatorId.toString().trim() : null,
        confirmateurId: row.mappedData.confirmateurId && row.mappedData.confirmateurId.toString().trim() ? row.mappedData.confirmateurId.toString().trim() : null,
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

      // Add date fields if provided
      if (row.mappedData.createdAt) {
        contactPayload.createdAt = row.mappedData.createdAt;
      }
      if (row.mappedData.updatedAt) {
        contactPayload.updatedAt = row.mappedData.updatedAt;
      }
      if (row.mappedData.assignedAt) {
        contactPayload.assignedAt = row.mappedData.assignedAt;
      }

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
    setStatusMapping({});
    setPlatformMapping({});
    setConfirmateurMapping({});
    setTeleoperatorMapping({});
    setContratMapping({});
    setSourceMapping({});
    setMigratedRows([]);
    setError(null);
    setIsLoading(false);
    setExcludeFirstRow(true); // Reset to default
    setEventDateColumn('');
    setEventHourColumn('');
    setEventMinuteColumn('');
    setDefaultEventHour('09');
    setDefaultEventMinute('00');
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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-700">
                    <strong>{csvData.length}</strong> ligne(s) détectée(s) dans le fichier
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="exclude-first-row"
                      checked={excludeFirstRow}
                      onChange={async (e) => {
                        const newValue = e.target.checked;
                        setExcludeFirstRow(newValue);
                        // Re-parse CSV with new setting
                        if (csvFile) {
                          setIsLoading(true);
                          try {
                            const allRows = await parseCSVFile(csvFile, newValue);
                            toast.success(`Fichier rechargé: ${allRows.length} lignes détectées`);
                          } catch (error: any) {
                            console.error('Error re-parsing CSV:', error);
                            toast.error('Erreur lors du rechargement du fichier');
                          } finally {
                            setIsLoading(false);
                          }
                        }
                      }}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <Label htmlFor="exclude-first-row" className="text-sm text-slate-700 cursor-pointer">
                      Exclure la première ligne (en-tête)
                    </Label>
                  </div>
                </div>
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
                <div>
                  <h3 className="font-semibold text-lg">Mapper vos colonnes CSV aux champs CRM</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Les champs marqués d'un <span className="text-red-600 font-semibold">*</span> sont obligatoires
                  </p>
                </div>
                <div className="max-h-96 overflow-y-auto border rounded p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CRM_FIELDS.filter(field => field.value !== '').map((field) => {
                      // Get all currently mapped columns (excluding the current field)
                      const mappedColumns = Object.values(columnMapping).filter(
                        (col, idx) => col && col !== '' && Object.keys(columnMapping)[idx] !== field.value
                      );
                      
                      // Filter out already mapped columns from available options
                      const availableHeaders = csvHeaders.filter(header => 
                        !mappedColumns.includes(header) || columnMapping[field.value] === header
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
                              <SelectItem value="__none__">-- Ignorer --</SelectItem>
                              {availableHeaders.map((header) => (
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
              </div>

              {/* Status Mapping Section */}
              {columnMapping.statusId && csvData.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Mapper les valeurs de statut</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Mappez les valeurs de statut de votre CSV aux statuts de la base de données
                    </p>
                    {(() => {
                      // Get unique status values from CSV
                      const statusColumn = columnMapping.statusId;
                      const uniqueStatusValues = Array.from(
                        new Set(
                          csvData
                            .map(row => row[statusColumn])
                            .filter(val => val && val.toString().trim() !== '')
                            .map(val => val.toString().trim())
                        )
                      ).sort();

                      if (uniqueStatusValues.length === 0) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                            <p className="text-sm text-yellow-800">
                              Aucune valeur de statut trouvée dans la colonne "{statusColumn}"
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="border rounded p-4 bg-slate-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {uniqueStatusValues.map((csvValue) => (
                              <div key={csvValue} className="flex items-center gap-3">
                                <Label className="w-32 text-sm font-medium flex-shrink-0 truncate" title={csvValue}>
                                  {csvValue}
                                </Label>
                                <Select
                                  value={statusMapping[csvValue] || '__none__'}
                                  onValueChange={(value) => {
                                    setStatusMapping({
                                      ...statusMapping,
                                      [csvValue]: value === '__none__' ? '' : value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Sélectionner un statut" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- Non mappé --</SelectItem>
                                    {availableStatuses.map((status) => (
                                      <SelectItem key={status.id} value={status.id}>
                                        <div className="flex items-center gap-2">
                                          <span 
                                            className="inline-block px-2 py-1 rounded text-sm"
                                            style={{
                                              backgroundColor: status.color || '#e5e7eb',
                                              color: status.color ? '#000000' : '#374151'
                                            }}
                                          >
                                            {status.name}
                                          </span>
                                          <span className="text-xs text-slate-500">
                                            ({status.type === 'lead' ? 'Lead' : status.type === 'client' ? 'Client' : 'N/A'})
                                          </span>
                                        </div>
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
                  </div>
                </div>
              )}

              {/* Platform Mapping Section */}
              {columnMapping.platformId && csvData.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Mapper les valeurs de plateforme</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Mappez les valeurs de plateforme de votre CSV aux plateformes de la base de données
                    </p>
                    {(() => {
                      // Get unique platform values from CSV
                      const platformColumn = columnMapping.platformId;
                      const uniquePlatformValues = Array.from(
                        new Set(
                          csvData
                            .map(row => row[platformColumn])
                            .filter(val => val && val.toString().trim() !== '')
                            .map(val => val.toString().trim())
                        )
                      ).sort();

                      if (uniquePlatformValues.length === 0) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                            <p className="text-sm text-yellow-800">
                              Aucune valeur de plateforme trouvée dans la colonne "{platformColumn}"
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="border rounded p-4 bg-slate-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {uniquePlatformValues.map((csvValue) => (
                              <div key={csvValue} className="flex items-center gap-3">
                                <Label className="w-32 text-sm font-medium flex-shrink-0 truncate" title={csvValue}>
                                  {csvValue}
                                </Label>
                                <Select
                                  value={platformMapping[csvValue] || '__none__'}
                                  onValueChange={(value) => {
                                    setPlatformMapping({
                                      ...platformMapping,
                                      [csvValue]: value === '__none__' ? '' : value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Sélectionner une plateforme" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- Non mappé --</SelectItem>
                                    {platforms.map((platform) => (
                                      <SelectItem key={platform.id} value={platform.id}>
                                        {platform.name}
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
                  </div>
                </div>
              )}

              {/* Confirmateur Mapping Section */}
              {columnMapping.confirmateurId && csvData.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Mapper les valeurs de confirmateur</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Mappez les valeurs de confirmateur de votre CSV aux confirmateurs de la base de données
                    </p>
                    {(() => {
                      // Get unique confirmateur values from CSV
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
                                  value={confirmateurMapping[csvValue] || '__none__'}
                                  onValueChange={(value) => {
                                    setConfirmateurMapping({
                                      ...confirmateurMapping,
                                      [csvValue]: value === '__none__' ? '' : value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Sélectionner un confirmateur" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- Non mappé --</SelectItem>
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
                  </div>
                </div>
              )}

              {/* Teleoperator Mapping Section */}
              {columnMapping.teleoperatorId && csvData.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Mapper les valeurs de téléopérateur</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Mappez les valeurs de téléopérateur de votre CSV aux téléopérateurs de la base de données
                    </p>
                    {(() => {
                      // Get unique teleoperator values from CSV
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
                                  value={teleoperatorMapping[csvValue] || '__none__'}
                                  onValueChange={(value) => {
                                    setTeleoperatorMapping({
                                      ...teleoperatorMapping,
                                      [csvValue]: value === '__none__' ? '' : value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Sélectionner un téléopérateur" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- Non mappé --</SelectItem>
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
                  </div>
                </div>
              )}


              {/* Contrat Mapping Section */}
              {columnMapping.contrat && csvData.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Mapper les valeurs de contrat</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Mappez les valeurs de contrat de votre CSV aux options de contrat disponibles
                    </p>
                    {(() => {
                      // Get unique contrat values from CSV
                      const contratColumn = columnMapping.contrat;
                      const uniqueContratValues = Array.from(
                        new Set(
                          csvData
                            .map(row => row[contratColumn])
                            .filter(val => val && val.toString().trim() !== '')
                            .map(val => val.toString().trim())
                        )
                      ).sort();

                      if (uniqueContratValues.length === 0) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                            <p className="text-sm text-yellow-800">
                              Aucune valeur de contrat trouvée dans la colonne "{contratColumn}"
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="border rounded p-4 bg-slate-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {uniqueContratValues.map((csvValue) => (
                              <div key={csvValue} className="flex items-center gap-3">
                                <Label className="w-32 text-sm font-medium flex-shrink-0 truncate" title={csvValue}>
                                  {csvValue}
                                </Label>
                                <Select
                                  value={contratMapping[csvValue] || '__none__'}
                                  onValueChange={(value) => {
                                    setContratMapping({
                                      ...contratMapping,
                                      [csvValue]: value === '__none__' ? '' : value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Sélectionner une option de contrat" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- Non mappé (vide) --</SelectItem>
                                    {contratOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
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
                  </div>
                </div>
              )}

              {/* Source Mapping Section */}
              {columnMapping.sourceId && csvData.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Mapper les valeurs de source</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Mappez les valeurs de source de votre CSV aux sources de la base de données
                    </p>
                    {(() => {
                      // Get unique source values from CSV
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
                                  value={sourceMapping[csvValue] || '__none__'}
                                  onValueChange={(value) => {
                                    setSourceMapping({
                                      ...sourceMapping,
                                      [csvValue]: value === '__none__' ? '' : value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Sélectionner une source" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- Non mappé --</SelectItem>
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
                  </div>
                </div>
              )}

              {/* Event Date Mapping Section */}
              <div className="mt-6 pt-4 border-t">
                <h3 className="font-semibold text-lg mb-2">Configuration des événements</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Configurez la création automatique d'événements basée sur une colonne de date du CSV
                  <br />
                  <span className="text-xs text-slate-500">Format de date attendu: dd/mm/yyyy (ex: 25/12/2024)</span>
                </p>
                <div className="space-y-4 bg-slate-50 p-4 rounded">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Colonne de date pour l'événement</Label>
                      <Select
                        value={eventDateColumn || '__none__'}
                        onValueChange={(value) => {
                          setEventDateColumn(value === '__none__' ? '' : value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une colonne" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">-- Aucune --</SelectItem>
                          {csvHeaders
                            .filter(header => 
                              !eventHourColumn || eventHourColumn !== header || eventDateColumn === header
                            )
                            .filter(header => 
                              !eventMinuteColumn || eventMinuteColumn !== header || eventDateColumn === header
                            )
                            .map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Colonne d'heure (optionnel)</Label>
                      <Select
                        value={eventHourColumn || '__none__'}
                        onValueChange={(value) => {
                          setEventHourColumn(value === '__none__' ? '' : value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une colonne" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">-- Aucune --</SelectItem>
                          {csvHeaders
                            .filter(header => 
                              !eventDateColumn || eventDateColumn !== header || eventHourColumn === header
                            )
                            .filter(header => 
                              !eventMinuteColumn || eventMinuteColumn !== header || eventHourColumn === header
                            )
                            .map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Colonne de minutes (optionnel)</Label>
                      <Select
                        value={eventMinuteColumn || '__none__'}
                        onValueChange={(value) => {
                          setEventMinuteColumn(value === '__none__' ? '' : value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une colonne" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">-- Aucune --</SelectItem>
                          {csvHeaders
                            .filter(header => 
                              !eventDateColumn || eventDateColumn !== header || eventMinuteColumn === header
                            )
                            .filter(header => 
                              !eventHourColumn || eventHourColumn !== header || eventMinuteColumn === header
                            )
                            .map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Heure par défaut</Label>
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={defaultEventHour}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 23)) {
                            setDefaultEventHour(val || '00');
                          }
                        }}
                        placeholder="09"
                      />
                      <p className="text-xs text-slate-500 mt-1">Utilisée si aucune colonne d'heure n'est mappée</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Minutes par défaut</Label>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={defaultEventMinute}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                            setDefaultEventMinute(val || '00');
                          }
                        }}
                        placeholder="00"
                      />
                      <p className="text-xs text-slate-500 mt-1">Utilisées si aucune colonne de minutes n'est mappée</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CSV Preview Table - Show all contacts */}
              {csvData.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-medium mb-2">Aperçu de toutes les données CSV</h4>
                  <p className="text-sm text-slate-600 mb-3">
                    Tous les contacts du fichier CSV ({csvData.length} ligne(s))
                  </p>
                  <div className="border rounded overflow-x-auto max-h-[600px] overflow-y-auto">
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
                        {csvData.map((row, idx) => (
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
                  disabled={!columnMapping.firstName || !columnMapping.lastName || !columnMapping.phone || !columnMapping.statusId}
                >
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
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, handleCloseEditModal)}>
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

