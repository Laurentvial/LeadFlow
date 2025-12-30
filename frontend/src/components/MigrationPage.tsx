import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DateInput } from './ui/date-input';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Upload, FileSpreadsheet, Edit2, Save, X, Calendar, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Zap, Download } from 'lucide-react';
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
  isEditing: boolean;
  isSaving: boolean;
  contactId?: string; // If already saved
  errors?: string[];
}

const CRM_FIELDS = [
  { value: '', label: 'Ignorer cette colonne' },
  { value: 'civility', label: 'Civilité' },
  { value: 'firstName', label: 'Prénom' },
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
  { value: 'oldContactId', label: 'Ancien id' },
  { value: 'createdAt', label: 'Date de création' },
  { value: 'updatedAt', label: 'Date de modification' },
  { value: 'assignedAt', label: 'Date d\'attribution' },
];

export function MigrationPage() {
  const navigate = useNavigate();
  const { statuses, loading: statusesLoading } = useStatuses();
  const { sources, loading: sourcesLoading, reload: reloadSources } = useSources();
  const { users, loading: usersLoading } = useUsers();
  const { currentUser } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'processing' | 'results'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [migratedRows, setMigratedRows] = useState<MigratedRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRowData, setEditingRowData] = useState<MigratedRow | null>(null);
  const [contactNotes, setContactNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
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
  const [failedRows, setFailedRows] = useState<MigratedRow[]>([]); // Rows that failed to insert
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 }); // Progress tracking
  const [migrationResults, setMigrationResults] = useState<{ success: number; failed: number; created: number; updated: number; failureReasons: { [reason: string]: number }; updatedContacts?: Array<{ contactId: string; contactName: string; contactEmail: string; updatedFields: string[]; oldContactId?: string }> }>({ success: 0, failed: 0, created: 0, updated: 0, failureReasons: {} }); // Migration results summary

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

  // Helper function to normalize strings for matching
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]/g, '') // Remove special chars and spaces
      .trim();
  };

  // Auto-map all CSV headers to CRM fields based on similarity
  const handleAutoMapAllFields = () => {
    if (csvHeaders.length === 0) {
      toast.error('Aucune colonne CSV disponible');
      return;
    }

    const newMapping: ColumnMapping = { ...columnMapping };
    const usedHeaders = new Set<string>();

    // Common variations and synonyms
    const synonyms: { [key: string]: string[] } = {
      'firstName': ['prenom', 'firstname', 'first_name', 'nom', 'name'],
      'lastName': ['nom', 'lastname', 'last_name', 'name', 'surname'],
      'phone': ['telephone', 'tel', 'phone', 'telephone1', 'tel1', 'mobile'],
      'mobile': ['mobile', 'telephone2', 'tel2', 'cell', 'cellphone'],
      'email': ['email', 'mail', 'e-mail', 'courriel'],
      'birthDate': ['date_naissance', 'birthdate', 'date_naiss', 'naissance'],
      'birthPlace': ['lieu_naissance', 'birthplace', 'lieu_naiss'],
      'address': ['adresse', 'address', 'street', 'rue'],
      'addressComplement': ['complement', 'complement_adresse', 'address_complement'],
      'postalCode': ['code_postal', 'postalcode', 'zip', 'zipcode', 'cp'],
      'city': ['ville', 'city', 'commune'],
      'nationality': ['nationalite', 'nationality', 'pays'],
      'campaign': ['campagne', 'campaign'],
      'statusId': ['statut', 'status', 'etat', 'state'],
      'sourceId': ['source', 'origine', 'origin'],
      'teleoperatorId': ['teleoperateur', 'teleoperator', 'operateur', 'operator'],
      'confirmateurId': ['confirmateur', 'confirmer', 'confirmer_id'],
      'platformId': ['plateforme', 'platform', 'site'],
      'montantEncaisse': ['montant_encaisse', 'montant', 'amount', 'encaissement'],
      'bonus': ['bonus', 'prime'],
      'paiement': ['paiement', 'payment', 'payement'],
      'contrat': ['contrat', 'contract'],
      'nomDeScene': ['nom_scene', 'nom_de_scene', 'scene_name', 'pseudo'],
      'dateProTr': ['date_pro_tr', 'dateprotr', 'pro_tr'],
      'potentiel': ['potentiel', 'potential'],
      'produit': ['produit', 'product'],
      'confirmateurEmail': ['confirmateur_email', 'mail_confirmateur', 'confirmateur_mail'],
      'confirmateurTelephone': ['confirmateur_telephone', 'tel_confirmateur', 'confirmateur_tel'],
      'oldContactId': ['ancien_id', 'old_id', 'id_ancien', 'old_contact_id'],
      'createdAt': ['date_creation', 'created_at', 'date_crea', 'creation'],
      'updatedAt': ['date_modification', 'updated_at', 'date_modif', 'modification'],
      'assignedAt': ['date_attribution', 'assigned_at', 'date_assign', 'attribution'],
    };

    // Generic column names that should only match with very strong evidence
    const genericColumns = ['id', 'code', 'num', 'number', 'ref', 'reference', 'key', 'pk', 'fk'];
    
    // Try to match each CRM field
    CRM_FIELDS.forEach(field => {
      if (!field.value) return; // Skip the empty option

      // Skip if already mapped
      if (newMapping[field.value] && newMapping[field.value] !== '') {
        return;
      }

      const fieldValueNormalized = normalizeString(field.value);
      const fieldLabelNormalized = normalizeString(field.label);

      let bestMatch: string | null = null;
      let bestScore = 0;

      // Check exact matches first
      csvHeaders.forEach(header => {
        if (usedHeaders.has(header)) return;

        const headerNormalized = normalizeString(header);
        const isGenericColumn = genericColumns.includes(headerNormalized);

        // Exact match with field value
        if (headerNormalized === fieldValueNormalized) {
          bestMatch = header;
          bestScore = 100;
          return;
        }

        // Exact match with field label
        if (headerNormalized === fieldLabelNormalized) {
          if (bestScore < 90) {
            bestMatch = header;
            bestScore = 90;
          }
        }

        // Check synonyms - only exact matches
        const fieldSynonyms = synonyms[field.value] || [];
        fieldSynonyms.forEach(synonym => {
          const synonymNormalized = normalizeString(synonym);
          if (headerNormalized === synonymNormalized) {
            if (bestScore < 85) {
              bestMatch = header;
              bestScore = 85;
            }
          }
        });

        // Partial match - only if header contains the field (not the other way around)
        // And require minimum length to avoid false positives
        const minLengthForPartial = 4; // Minimum length for partial matching
        
        if (fieldValueNormalized.length >= minLengthForPartial && 
            headerNormalized.includes(fieldValueNormalized) && 
            !isGenericColumn) {
          // Only match if the header is substantially similar (not just contains a short substring)
          if (headerNormalized.length <= fieldValueNormalized.length * 1.5) {
            if (bestScore < 70) {
              bestMatch = header;
              bestScore = 70;
            }
          }
        }

        if (fieldLabelNormalized.length >= minLengthForPartial && 
            headerNormalized.includes(fieldLabelNormalized) && 
            !isGenericColumn) {
          // Only match if the header is substantially similar
          if (headerNormalized.length <= fieldLabelNormalized.length * 1.5) {
            if (bestScore < 60) {
              bestMatch = header;
              bestScore = 60;
            }
          }
        }
      });

      // Set the best match if found and score is good enough (raised threshold to 70)
      if (bestMatch && bestScore >= 70) {
        newMapping[field.value] = bestMatch;
        usedHeaders.add(bestMatch);
      }
    });

    setColumnMapping(newMapping);
    const matchedCount = Object.values(newMapping).filter(v => v && v !== '').length;
    toast.success(`${matchedCount} champ(s) mappé(s) automatiquement`);
  };

  // Auto-map a single CSV header to a CRM field based on similarity
  const handleAutoMapField = (fieldValue: string, fieldLabel: string) => {
    if (csvHeaders.length === 0) {
      toast.error('Aucune colonne CSV disponible');
      return;
    }

    const fieldValueNormalized = normalizeString(fieldValue);
    const fieldLabelNormalized = normalizeString(fieldLabel);

    // Common variations and synonyms
    const synonyms: { [key: string]: string[] } = {
      'firstName': ['prenom', 'firstname', 'first_name', 'nom', 'name'],
      'lastName': ['nom', 'lastname', 'last_name', 'name', 'surname'],
      'phone': ['telephone', 'tel', 'phone', 'telephone1', 'tel1', 'mobile'],
      'mobile': ['mobile', 'telephone2', 'tel2', 'cell', 'cellphone'],
      'email': ['email', 'mail', 'e-mail', 'courriel'],
      'birthDate': ['date_naissance', 'birthdate', 'date_naiss', 'naissance'],
      'birthPlace': ['lieu_naissance', 'birthplace', 'lieu_naiss'],
      'address': ['adresse', 'address', 'street', 'rue'],
      'addressComplement': ['complement', 'complement_adresse', 'address_complement'],
      'postalCode': ['code_postal', 'postalcode', 'zip', 'zipcode', 'cp'],
      'city': ['ville', 'city', 'commune'],
      'nationality': ['nationalite', 'nationality', 'pays'],
      'campaign': ['campagne', 'campaign'],
      'statusId': ['statut', 'status', 'etat', 'state'],
      'sourceId': ['source', 'origine', 'origin'],
      'teleoperatorId': ['teleoperateur', 'teleoperator', 'operateur', 'operator'],
      'confirmateurId': ['confirmateur', 'confirmer', 'confirmer_id'],
      'platformId': ['plateforme', 'platform', 'site'],
      'montantEncaisse': ['montant_encaisse', 'montant', 'amount', 'encaissement'],
      'bonus': ['bonus', 'prime'],
      'paiement': ['paiement', 'payment', 'payement'],
      'contrat': ['contrat', 'contract'],
      'nomDeScene': ['nom_scene', 'nom_de_scene', 'scene_name', 'pseudo'],
      'dateProTr': ['date_pro_tr', 'dateprotr', 'pro_tr'],
      'potentiel': ['potentiel', 'potential'],
      'produit': ['produit', 'product'],
      'confirmateurEmail': ['confirmateur_email', 'mail_confirmateur', 'confirmateur_mail'],
      'confirmateurTelephone': ['confirmateur_telephone', 'tel_confirmateur', 'confirmateur_tel'],
      'oldContactId': ['ancien_id', 'old_id', 'id_ancien', 'old_contact_id'],
      'createdAt': ['date_creation', 'created_at', 'date_crea', 'creation'],
      'updatedAt': ['date_modification', 'updated_at', 'date_modif', 'modification'],
      'assignedAt': ['date_attribution', 'assigned_at', 'date_assign', 'attribution'],
    };

    // Generic column names that should only match with very strong evidence
    const genericColumns = ['id', 'code', 'num', 'number', 'ref', 'reference', 'key', 'pk', 'fk'];
    
    // Get currently mapped columns to avoid conflicts
    const mappedColumns = Object.values(columnMapping).filter(col => col && col !== '');

    let bestMatch: string | null = null;
    let bestScore = 0;

    // Check exact matches first
    csvHeaders.forEach(header => {
      // Skip if already mapped to another field
      if (mappedColumns.includes(header) && columnMapping[fieldValue] !== header) {
        return;
      }

      const headerNormalized = normalizeString(header);
      const isGenericColumn = genericColumns.includes(headerNormalized);

      // Exact match with field value
      if (headerNormalized === fieldValueNormalized) {
        bestMatch = header;
        bestScore = 100;
        return;
      }

      // Exact match with field label
      if (headerNormalized === fieldLabelNormalized) {
        if (bestScore < 90) {
          bestMatch = header;
          bestScore = 90;
        }
      }

      // Check synonyms - only exact matches
      const fieldSynonyms = synonyms[fieldValue] || [];
      fieldSynonyms.forEach(synonym => {
        const synonymNormalized = normalizeString(synonym);
        if (headerNormalized === synonymNormalized) {
          if (bestScore < 85) {
            bestMatch = header;
            bestScore = 85;
          }
        }
      });

      // Partial match - only if header contains the field (not the other way around)
      // And require minimum length to avoid false positives
      const minLengthForPartial = 4; // Minimum length for partial matching
      
      if (fieldValueNormalized.length >= minLengthForPartial && 
          headerNormalized.includes(fieldValueNormalized) && 
          !isGenericColumn) {
        // Only match if the header is substantially similar (not just contains a short substring)
        if (headerNormalized.length <= fieldValueNormalized.length * 1.5) {
          if (bestScore < 70) {
            bestMatch = header;
            bestScore = 70;
          }
        }
      }

      if (fieldLabelNormalized.length >= minLengthForPartial && 
          headerNormalized.includes(fieldLabelNormalized) && 
          !isGenericColumn) {
        // Only match if the header is substantially similar
        if (headerNormalized.length <= fieldLabelNormalized.length * 1.5) {
          if (bestScore < 60) {
            bestMatch = header;
            bestScore = 60;
          }
        }
      }
    });

    // Set the best match if found and score is good enough (raised threshold to 70)
    if (bestMatch && bestScore >= 70) {
      setColumnMapping({
        ...columnMapping,
        [fieldValue]: bestMatch,
      });
      toast.success(`Champ "${fieldLabel}" mappé à "${bestMatch}"`);
    } else {
      toast.info(`Aucune correspondance trouvée pour "${fieldLabel}"`);
    }
  };

  // Auto-map status values
  const handleAutoMapStatuses = () => {
    if (!columnMapping.statusId || csvData.length === 0) return;

    const statusColumn = columnMapping.statusId;
    const uniqueStatusValues = Array.from(
      new Set(
        csvData
          .map(row => row[statusColumn])
          .filter(val => val && val.toString().trim() !== '')
          .map(val => val.toString().trim())
      )
    );

    const newMapping = { ...statusMapping };
    let matchedCount = 0;

    uniqueStatusValues.forEach(csvValue => {
      if (newMapping[csvValue]) return; // Already mapped

      const csvValueNormalized = normalizeString(csvValue);
      let bestMatch: any = null;
      let bestScore = 0;

      availableStatuses.forEach(status => {
        const statusNameNormalized = normalizeString(status.name);
        const statusIdNormalized = normalizeString(status.id);

        // Exact match
        if (csvValueNormalized === statusNameNormalized || csvValueNormalized === statusIdNormalized) {
          if (bestScore < 100) {
            bestMatch = status;
            bestScore = 100;
          }
        }
        // Contains match
        else if (csvValueNormalized.includes(statusNameNormalized) || statusNameNormalized.includes(csvValueNormalized)) {
          if (bestScore < 70) {
            bestMatch = status;
            bestScore = 70;
          }
        }
      });

      if (bestMatch && bestScore >= 70) {
        newMapping[csvValue] = bestMatch.id;
        matchedCount++;
      }
    });

    setStatusMapping(newMapping);
    toast.success(`${matchedCount} valeur(s) de statut mappée(s) automatiquement`);
  };

  // Auto-map platform values
  const handleAutoMapPlatforms = () => {
    if (!columnMapping.platformId || csvData.length === 0) return;

    const platformColumn = columnMapping.platformId;
    const uniquePlatformValues = Array.from(
      new Set(
        csvData
          .map(row => row[platformColumn])
          .filter(val => val && val.toString().trim() !== '')
          .map(val => val.toString().trim())
      )
    );

    const newMapping = { ...platformMapping };
    let matchedCount = 0;

    uniquePlatformValues.forEach(csvValue => {
      if (newMapping[csvValue]) return; // Already mapped

      const csvValueNormalized = normalizeString(csvValue);
      let bestMatch: any = null;
      let bestScore = 0;

      platforms.forEach(platform => {
        const platformNameNormalized = normalizeString(platform.name);
        const platformIdNormalized = normalizeString(platform.id);

        // Exact match
        if (csvValueNormalized === platformNameNormalized || csvValueNormalized === platformIdNormalized) {
          if (bestScore < 100) {
            bestMatch = platform;
            bestScore = 100;
          }
        }
        // Contains match
        else if (csvValueNormalized.includes(platformNameNormalized) || platformNameNormalized.includes(csvValueNormalized)) {
          if (bestScore < 70) {
            bestMatch = platform;
            bestScore = 70;
          }
        }
      });

      if (bestMatch && bestScore >= 70) {
        newMapping[csvValue] = bestMatch.id;
        matchedCount++;
      }
    });

    setPlatformMapping(newMapping);
    toast.success(`${matchedCount} valeur(s) de plateforme mappée(s) automatiquement`);
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

  // Auto-map contrat values
  const handleAutoMapContrats = () => {
    if (!columnMapping.contrat || csvData.length === 0) return;

    const contratColumn = columnMapping.contrat;
    const uniqueContratValues = Array.from(
      new Set(
        csvData
          .map(row => row[contratColumn])
          .filter(val => val && val.toString().trim() !== '')
          .map(val => val.toString().trim())
      )
    );

    const newMapping = { ...contratMapping };
    let matchedCount = 0;

    uniqueContratValues.forEach(csvValue => {
      if (newMapping[csvValue]) return; // Already mapped

      const csvValueNormalized = normalizeString(csvValue);
      let bestMatch: any = null;
      let bestScore = 0;

      contratOptions.forEach(option => {
        const optionValueNormalized = normalizeString(option.value);
        const optionLabelNormalized = normalizeString(option.label);

        // Exact match
        if (csvValueNormalized === optionValueNormalized || csvValueNormalized === optionLabelNormalized) {
          if (bestScore < 100) {
            bestMatch = option;
            bestScore = 100;
          }
        }
        // Contains match
        else if (csvValueNormalized.includes(optionValueNormalized) || optionValueNormalized.includes(csvValueNormalized) ||
                 csvValueNormalized.includes(optionLabelNormalized) || optionLabelNormalized.includes(csvValueNormalized)) {
          if (bestScore < 70) {
            bestMatch = option;
            bestScore = 70;
          }
        }
      });

      if (bestMatch && bestScore >= 70) {
        newMapping[csvValue] = bestMatch.value;
        matchedCount++;
      }
    });

    setContratMapping(newMapping);
    toast.success(`${matchedCount} valeur(s) de contrat mappée(s) automatiquement`);
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

  // Create a new source from CSV value
  const handleCreateSource = async (csvValue: string) => {
    if (!csvValue || !csvValue.trim()) {
      toast.error('Le nom de la source ne peut pas être vide');
      return;
    }

    const sourceName = csvValue.trim();

    // Check if source already exists (case-insensitive)
    const existingSource = sources.find(s => 
      normalizeString(s.name) === normalizeString(sourceName)
    );

    if (existingSource) {
      // Source exists, just map it
      setSourceMapping({
        ...sourceMapping,
        [csvValue]: existingSource.id,
      });
      toast.success(`Source "${sourceName}" déjà existante, mappée automatiquement`);
      return;
    }

    try {
      setIsLoading(true);
      // Create the source
      const response = await apiCall('/api/sources/create/', {
        method: 'POST',
        body: JSON.stringify({ name: sourceName }),
      });

      // Reload sources to get the updated list
      await reloadSources();

      // Map the CSV value to the newly created source
      setSourceMapping({
        ...sourceMapping,
        [csvValue]: response.id,
      });

      toast.success(`Source "${sourceName}" créée et mappée avec succès`);
    } catch (error: any) {
      console.error('Error creating source:', error);
      const errorMessage = error?.error || error?.message || 'Erreur lors de la création de la source';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMigration = () => {
    // Validate all required fields - only lastName is required
    const requiredFields = [
      { key: 'lastName', label: 'Nom' },
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
              // Only use confirmateur mapping - no fallback to old CRM logic
              if (confirmateurMapping[valueStr]) {
                value = confirmateurMapping[valueStr];
              } else {
                // If not mapped, use value as-is (might be an ID already)
                value = valueStr;
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

      // Apply default statusId if statusId is missing
      // Use defaultStatusId if set, otherwise use first available status
      if (!mappedData.statusId) {
        if (defaultStatusId) {
          mappedData.statusId = defaultStatusId;
        } else if (availableStatuses.length > 0) {
          // Auto-set to first available status if no default is set
          mappedData.statusId = availableStatuses[0].id;
        }
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
    // Automatically start processing instead of showing migration step
    handleBulkSaveFromMapping(rows);
  };

  const handleEditRow = (row: MigratedRow) => {
    setEditingRowData({ ...row });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingRowData(null);
    setContactNotes([]);
  };

  // Load notes when modal opens and contact has been saved
  useEffect(() => {
    const loadNotes = async () => {
      if (!showEditModal || !editingRowData?.contactId) {
        setContactNotes([]);
        return;
      }

      setLoadingNotes(true);
      try {
        const data = await apiCall(`/api/notes/?contactId=${editingRowData.contactId}`);
        // Handle both paginated response (data.results) and direct array response
        const notesArray = Array.isArray(data) ? data : (data.results || data.notes || []);
        // Sort by created_at descending and take last 3
        const sortedNotes = [...notesArray]
          .sort((a, b) => {
            const dateA = new Date(a.createdAt || a.created_at).getTime();
            const dateB = new Date(b.createdAt || b.created_at).getTime();
            return dateB - dateA; // Descending order (most recent first)
          })
          .slice(0, 3);
        setContactNotes(sortedNotes);
      } catch (error) {
        console.error('Error loading notes:', error);
        setContactNotes([]);
      } finally {
        setLoadingNotes(false);
      }
    };

    loadNotes();
  }, [showEditModal, editingRowData?.contactId]);

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
    // Validate required fields - only statusId is required
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
        firstName: row.mappedData.firstName ? row.mappedData.firstName.trim() : '',
        lastName: row.mappedData.lastName.trim(),
        email: row.mappedData.email || '',
        phone: row.mappedData.phone ? removePhoneSpaces(String(row.mappedData.phone)) : '',
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
        oldContactId: row.mappedData.oldContactId && row.mappedData.oldContactId.trim() ? row.mappedData.oldContactId.trim() : null,
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

      // Check if contact with oldContactId exists
      let existingContactId: string | null = null;
      if (contactPayload.oldContactId) {
        try {
          const searchResponse = await apiCall('/api/contacts/', {
            method: 'GET',
            params: new URLSearchParams({
              filter_oldContactId: contactPayload.oldContactId,
              limit: '100'
            })
          });
          
          if (searchResponse.contacts && Array.isArray(searchResponse.contacts)) {
            const existingContact = searchResponse.contacts.find((c: any) => 
              c.oldContactId && c.oldContactId.trim() === contactPayload.oldContactId.trim()
            );
            if (existingContact) {
              existingContactId = existingContact.id;
            }
          }
        } catch (searchError) {
          console.error('Error searching for existing contact:', searchError);
          // Continue with creation if search fails
        }
      }

      let contactId: string;
      let isUpdate = false;

      if (existingContactId) {
        // Update existing contact
        isUpdate = true;
        await apiCall(`/api/contacts/${existingContactId}/`, {
          method: 'PATCH',
          body: JSON.stringify(contactPayload),
        });
        contactId = existingContactId;
      } else {
        // Create new contact
        const contactResponse = await apiCall('/api/contacts/create/', {
          method: 'POST',
          body: JSON.stringify(contactPayload),
        });

        contactId = contactResponse?.contact?.id || contactResponse?.id;
        
        if (!contactId) {
          throw new Error('Erreur lors de la création du contact');
        }
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

      toast.success(isUpdate ? `Contact mis à jour avec succès` : `Contact créé avec succès`);
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

  // Handle bulk save from mapping step (automatic processing)
  const handleBulkSaveFromMapping = async (rows: MigratedRow[]) => {
    setStep('processing');
    setIsLoading(true);
    setFailedRows([]);

    // Apply defaultStatusId to rows that don't have a statusId
    // Use defaultStatusId if set, otherwise use first available status
    const defaultStatusToUse = defaultStatusId || (availableStatuses.length > 0 ? availableStatuses[0].id : '');
    const rowsWithDefaults = rows.map(r => {
      if (!r.mappedData.statusId && defaultStatusToUse) {
        return {
          ...r,
          mappedData: {
            ...r.mappedData,
            statusId: defaultStatusToUse
          }
        };
      }
      return r;
    });

    // Filter rows - only statusId is required (lastName is optional)
    const rowsToSave = rowsWithDefaults.filter(r => {
      // Validate required fields - only statusId is required
      if (!r.mappedData.statusId) {
        return false;
      }
      return true;
    });

    // Set progress with the actual number of rows to process
    setProcessingProgress({ current: 0, total: rowsToSave.length });

    if (rowsToSave.length === 0) {
      toast.error('Aucune ligne valide à migrer');
      setIsLoading(false);
      setStep('mapping');
      return;
    }

    try {
      // Process in batches to avoid timeouts (max 500 contacts per batch)
      const BATCH_SIZE = 500;
      const batches: MigratedRow[][] = [];
      
      for (let i = 0; i < rowsToSave.length; i += BATCH_SIZE) {
        batches.push(rowsToSave.slice(i, i + BATCH_SIZE));
      }

      let totalSuccess = 0;
      let totalFailed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      const contactIdMap = new Map<string, string>();
      const failedRowsList: MigratedRow[] = [];
      const failureReasons: { [reason: string]: number } = {};
      const updatedContactsList: Array<{ contactId: string; contactName: string; contactEmail: string; updatedFields: string[]; oldContactId?: string }> = [];

      const allResults: Array<{ row: MigratedRow; result: any; contactData: any }> = [];

      // Process each batch
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        setProcessingProgress({ 
          current: batchIdx * BATCH_SIZE, 
          total: rowsToSave.length 
        });

        // Prepare contacts for bulk creation
        const contactsPayload = batch.map((row) => {
          const contactPayload: any = {
            firstName: row.mappedData.firstName ? row.mappedData.firstName.trim() : '',
            lastName: row.mappedData.lastName ? row.mappedData.lastName.trim() : '',
            email: row.mappedData.email || '',
            phone: row.mappedData.phone ? removePhoneSpaces(String(row.mappedData.phone)) : '',
            mobile: row.mappedData.mobile && row.mappedData.mobile.trim() ? removePhoneSpaces(String(row.mappedData.mobile)) : removePhoneSpaces(String(row.mappedData.phone || '')),
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
            teleoperatorId: row.mappedData.teleoperatorId && row.mappedData.teleoperatorId.toString().trim() ? String(row.mappedData.teleoperatorId).trim() : null,
            confirmateurId: row.mappedData.confirmateurId && row.mappedData.confirmateurId.toString().trim() ? String(row.mappedData.confirmateurId).trim() : null,
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
            oldContactId: row.mappedData.oldContactId && row.mappedData.oldContactId.trim() ? row.mappedData.oldContactId.trim() : null,
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

          return { payload: contactPayload, row };
        }).filter(item => item !== null) as Array<{ payload: any; row: MigratedRow; eventData?: MigratedRow['eventData'] }>;

        if (contactsPayload.length === 0) continue;

        // Bulk create contacts for this batch
        let bulkResponse;
        try {
          bulkResponse = await apiCall('/api/contacts/bulk-create/', {
            method: 'POST',
            body: JSON.stringify(contactsPayload.map(item => item.payload)),
          });
        } catch (apiError: any) {
          // Handle database connection errors or API errors
          const errorMessage = apiError?.error || apiError?.message || 'Erreur de connexion à la base de données';
          if (errorMessage.includes('timeout') || errorMessage.includes('connection') || apiError?.status === 503) {
            // Database connection error - mark all contacts in this batch as failed
            const reason = 'Erreur de connexion';
            failureReasons[reason] = (failureReasons[reason] || 0) + contactsPayload.length;
            
            for (const contactData of contactsPayload) {
              failedRowsList.push({
                ...contactData.row,
                errors: [`Erreur de connexion: ${errorMessage}`]
              });
            }
            totalFailed += contactsPayload.length;
            toast.error('Erreur de connexion à la base de données. Veuillez réessayer dans quelques instants.');
            continue; // Skip to next batch
          }
          // Re-throw other errors to be caught by outer try-catch
          throw apiError;
        }

        const results = bulkResponse.results || [];
        totalSuccess += bulkResponse.success || 0;
        totalFailed += bulkResponse.failed || 0;
        totalCreated += bulkResponse.created || 0;
        totalUpdated += bulkResponse.updated || 0;
        
        // Update progress
        setProcessingProgress({ 
          current: Math.min((batchIdx + 1) * BATCH_SIZE, rowsToSave.length), 
          total: rowsToSave.length 
        });
        
        // Process results
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const contactData = contactsPayload[i];
          
          allResults.push({ row: contactData.row, result, contactData });
          
          if (result.success && result.contactId) {
            contactIdMap.set(contactData.row.id, result.contactId);
            
            // Track updated contacts with details
            if (result.updated) {
              updatedContactsList.push({
                contactId: result.contactId,
                contactName: result.contactName || `${contactData.row.mappedData.firstName || ''} ${contactData.row.mappedData.lastName || ''}`.trim() || 'N/A',
                contactEmail: result.contactEmail || contactData.row.mappedData.email || 'N/A',
                updatedFields: result.updatedFields || ['Multiple fields'],
                oldContactId: result.oldContactId || contactData.row.mappedData.oldContactId
              });
            }
          } else {
            // Track failed rows and categorize errors
            const errorMessage = result.error || 'Erreur lors de la création';
            let reason = 'Autre';
            
            // Categorize error reasons - check CSV duplicates first, then DB duplicates
            const errorLower = errorMessage.toLowerCase();
            if (errorLower.includes('dupliqué dans le csv') || errorLower.includes('duplicate') && errorLower.includes('csv')) {
              reason = 'Dupliqué dans le CSV';
            } else if (errorLower.includes('existe déjà dans la base de données') || (errorLower.includes('existe déjà') && errorLower.includes('base de données')) || (errorLower.includes('already exists') && errorLower.includes('database'))) {
              reason = 'Déjà dans la base de données';
            } else if (errorLower.includes('existe déjà') || errorLower.includes('déjà') || errorLower.includes('already exists')) {
              // Fallback for older error messages
              reason = 'Déjà dans la base de données';
            } else if (errorLower.includes('dupliqué') || errorLower.includes('doublon')) {
              // Fallback for duplicate messages
              reason = 'Dupliqué dans le CSV';
            } else if (errorLower.includes('connexion') || errorLower.includes('connection') || errorLower.includes('timeout')) {
              reason = 'Erreur de connexion';
            }
            
            failureReasons[reason] = (failureReasons[reason] || 0) + 1;
            
            failedRowsList.push({
              ...contactData.row,
              errors: [errorMessage]
            });
          }
        }
      }

      // Create events asynchronously (don't block UI update)
      const eventPromises = allResults
        .filter(item => item.result.success && item.result.contactId && item.contactData.eventData?.date)
        .map(async (item) => {
          try {
            const eventData = item.contactData.eventData;
            const timeString = `${eventData.hour.padStart(2, '0')}:${eventData.minute.padStart(2, '0')}`;
            await apiCall('/api/events/create/', {
              method: 'POST',
              body: JSON.stringify({
                datetime: `${eventData.date}T${timeString}`,
                contactId: item.result.contactId,
                userId: eventData.teleoperatorId || currentUser?.id || null,
                comment: ''
              }),
            });
          } catch (error) {
            console.error('Error creating event:', error);
          }
        });
      
      // Don't wait for events, update UI immediately
      Promise.all(eventPromises).catch(err => console.error('Error creating events:', err));

      // Set failed rows and migration results
      setFailedRows(failedRowsList);
      setMigrationResults({ 
        success: totalSuccess, 
        failed: totalFailed, 
        created: totalCreated, 
        updated: totalUpdated, 
        failureReasons,
        updatedContacts: updatedContactsList
      });
      setProcessingProgress({ current: rowsToSave.length, total: rowsToSave.length });
      
      // Always show results page after migration
      if (totalFailed === 0) {
        if (totalUpdated > 0 && totalCreated > 0) {
          toast.success(`${totalCreated} contact(s) créé(s), ${totalUpdated} contact(s) mis à jour avec succès`);
        } else if (totalUpdated > 0) {
          toast.success(`${totalUpdated} contact(s) mis à jour avec succès`);
        } else {
          toast.success(`${totalCreated} contact(s) créé(s) avec succès`);
        }
        // Show results page instead of returning to mapping
        setStep('results');
      } else {
        const successMsg = totalUpdated > 0 && totalCreated > 0 
          ? `${totalCreated} créé(s), ${totalUpdated} mis à jour`
          : totalUpdated > 0 
            ? `${totalUpdated} mis à jour`
            : `${totalCreated} créé(s)`;
        toast.warning(`${successMsg}, ${totalFailed} erreur(s)`);
        setStep('results');
      }
    } catch (error: any) {
      console.error('Error bulk saving contacts:', error);
      const errorMessage = error?.error || error?.message || 'Erreur lors de la sauvegarde en masse';
      toast.error(errorMessage);
      setStep('mapping');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSave = async () => {
    const rowsToSave = migratedRows.filter(r => !r.contactId && !r.isSaving);
    
    if (rowsToSave.length === 0) {
      toast.info('Aucune ligne à sauvegarder');
      return;
    }

    setIsLoading(true);
    
    // Mark all rows as saving
    setMigratedRows(prev => prev.map(r => 
      rowsToSave.some(rs => rs.id === r.id) ? { ...r, isSaving: true, errors: [] } : r
    ));

    try {
      // Process in batches to avoid timeouts (max 500 contacts per batch)
      const BATCH_SIZE = 500;
      const batches: MigratedRow[][] = [];
      
      for (let i = 0; i < rowsToSave.length; i += BATCH_SIZE) {
        batches.push(rowsToSave.slice(i, i + BATCH_SIZE));
      }

      let totalSuccess = 0;
      let totalFailed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      const contactIdMap = new Map<string, string>();

      const allResults: Array<{ row: MigratedRow; result: any; contactData: any }> = [];

      // Process each batch
      for (const batch of batches) {
        // Prepare contacts for bulk creation
        const contactsPayload = batch.map((row) => {
          // Validate required fields - only statusId is required
          if (!row.mappedData.statusId) {
            return null;
          }

          const contactPayload: any = {
            firstName: row.mappedData.firstName ? row.mappedData.firstName.trim() : '',
            lastName: row.mappedData.lastName ? row.mappedData.lastName.trim() : '',
            email: row.mappedData.email || '',
            phone: row.mappedData.phone ? removePhoneSpaces(String(row.mappedData.phone)) : '',
            mobile: row.mappedData.mobile && row.mappedData.mobile.trim() ? removePhoneSpaces(String(row.mappedData.mobile)) : removePhoneSpaces(String(row.mappedData.phone || '')),
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
            teleoperatorId: row.mappedData.teleoperatorId && row.mappedData.teleoperatorId.toString().trim() ? String(row.mappedData.teleoperatorId).trim() : null,
            confirmateurId: row.mappedData.confirmateurId && row.mappedData.confirmateurId.toString().trim() ? String(row.mappedData.confirmateurId).trim() : null,
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
            oldContactId: row.mappedData.oldContactId && row.mappedData.oldContactId.trim() ? row.mappedData.oldContactId.trim() : null,
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

          return { payload: contactPayload, row };
        }).filter(item => item !== null) as Array<{ payload: any; row: MigratedRow; eventData?: MigratedRow['eventData'] }>;

        if (contactsPayload.length === 0) continue;

        // Bulk create contacts for this batch
        let bulkResponse;
        try {
          bulkResponse = await apiCall('/api/contacts/bulk-create/', {
            method: 'POST',
            body: JSON.stringify(contactsPayload.map(item => item.payload)),
          });
        } catch (apiError: any) {
          // Handle database connection errors or API errors
          const errorMessage = apiError?.error || apiError?.message || 'Erreur de connexion à la base de données';
          if (errorMessage.includes('timeout') || errorMessage.includes('connection') || apiError?.status === 503) {
            // Database connection error - mark all contacts in this batch as failed
            totalFailed += contactsPayload.length;
            toast.error('Erreur de connexion à la base de données. Veuillez réessayer dans quelques instants.');
            // Update migratedRows to mark these as failed
            setMigratedRows(prev => prev.map(r => {
              const contactData = contactsPayload.find(cp => cp.row.id === r.id);
              if (contactData) {
                return { ...r, isSaving: false, errors: [`Erreur de connexion: ${errorMessage}`] };
              }
              return r;
            }));
            continue; // Skip to next batch
          }
          // Re-throw other errors to be caught by outer try-catch
          throw apiError;
        }

        const results = bulkResponse.results || [];
        totalSuccess += bulkResponse.success || 0;
        totalFailed += bulkResponse.failed || 0;
        totalCreated += bulkResponse.created || 0;
        totalUpdated += bulkResponse.updated || 0;
        
        // Process results
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const contactData = contactsPayload[i];
          
          allResults.push({ row: contactData.row, result, contactData });
          
          if (result.success && result.contactId) {
            contactIdMap.set(contactData.row.id, result.contactId);
          }
        }
      }

      // Create events asynchronously (don't block UI update)
      const eventPromises = allResults
        .filter(item => item.result.success && item.result.contactId && item.contactData.eventData?.date)
        .map(async (item) => {
          try {
            const eventData = item.contactData.eventData;
            const timeString = `${eventData.hour.padStart(2, '0')}:${eventData.minute.padStart(2, '0')}`;
            await apiCall('/api/events/create/', {
              method: 'POST',
              body: JSON.stringify({
                datetime: `${eventData.date}T${timeString}`,
                contactId: item.result.contactId,
                userId: eventData.teleoperatorId || currentUser?.id || null,
                comment: ''
              }),
            });
          } catch (error) {
            console.error('Error creating event:', error);
          }
        });
      
      // Don't wait for events, update UI immediately
      Promise.all(eventPromises).catch(err => console.error('Error creating events:', err));

      // Update migrated rows with results
      setMigratedRows(prev => prev.map(r => {
        const contactId = contactIdMap.get(r.id);
        if (contactId) {
          return {
            ...r,
            isSaving: false,
            isEditing: false,
            contactId,
            errors: []
          };
        }
        
        // Check if this row had an error
        const resultItem = allResults.find(item => item.row.id === r.id);
        if (resultItem && !resultItem.result.success) {
          return {
            ...r,
            isSaving: false,
            errors: [resultItem.result.error || 'Erreur lors de la création']
          };
        }
        
        return r;
      }));

      if (totalFailed === 0) {
        if (totalUpdated > 0 && totalCreated > 0) {
          toast.success(`${totalCreated} contact(s) créé(s), ${totalUpdated} contact(s) mis à jour avec succès`);
        } else if (totalUpdated > 0) {
          toast.success(`${totalUpdated} contact(s) mis à jour avec succès`);
        } else {
          toast.success(`${totalCreated} contact(s) créé(s) avec succès`);
        }
      } else {
        const successMsg = totalUpdated > 0 && totalCreated > 0 
          ? `${totalCreated} créé(s), ${totalUpdated} mis à jour`
          : totalUpdated > 0 
            ? `${totalUpdated} mis à jour`
            : `${totalCreated} créé(s)`;
        toast.warning(`${successMsg}, ${totalFailed} erreur(s)`);
      }
    } catch (error: any) {
      console.error('Error bulk saving contacts:', error);
      const errorMessage = error?.error || error?.message || 'Erreur lors de la sauvegarde en masse';
      
      // Mark all rows as failed
      setMigratedRows(prev => prev.map(r => 
        rowsToSave.some(rs => rs.id === r.id) ? { 
          ...r, 
          isSaving: false,
          errors: [errorMessage]
        } : r
      ));
      
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
    setStatusMapping({});
    setPlatformMapping({});
    setConfirmateurMapping({});
    setTeleoperatorMapping({});
    setContratMapping({});
    setSourceMapping({});
    setMigratedRows([]);
    setFailedRows([]);
    setError(null);
    setIsLoading(false);
    setProcessingProgress({ current: 0, total: 0 });
    setMigrationResults({ success: 0, failed: 0, created: 0, updated: 0, failureReasons: {}, updatedContacts: [] });
    setExcludeFirstRow(true); // Reset to default
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
          <div className="flex-1">
            <h1 className="page-title">Migration CRM</h1>
            <p className="page-subtitle">Migrer les données de l'ancien CRM vers le nouveau système</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/notes/migration')}
            >
              Migrer les Notes
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/logs/migration')}
            >
              Migrer les Logs
            </Button>
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
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">Mapper vos colonnes CSV aux champs CRM</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Les champs marqués d'un <span className="text-red-600 font-semibold">*</span> sont obligatoires
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAutoMapAllFields}
                      className="flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Auto-mapper
                    </Button>
                  </div>
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
                        <div key={field.value} className="flex items-center gap-2">
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">Mapper les valeurs de statut</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoMapStatuses}
                        className="flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Auto-mapper
                      </Button>
                    </div>
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">Mapper les valeurs de plateforme</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoMapPlatforms}
                        className="flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Auto-mapper
                      </Button>
                    </div>
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">Mapper les valeurs de confirmateur</h3>
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">Mapper les valeurs de téléopérateur</h3>
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">Mapper les valeurs de contrat</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoMapContrats}
                        className="flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Auto-mapper
                      </Button>
                    </div>
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">Mapper les valeurs de source</h3>
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
                            {uniqueSourceValues.map((csvValue) => {
                              const isMapped = !!sourceMapping[csvValue];
                              return (
                                <div key={csvValue} className="flex items-center gap-2">
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
                                  {!isMapped && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleCreateSource(csvValue)}
                                      disabled={isLoading}
                                      className="flex-shrink-0 h-8 w-8"
                                      title={`Créer la source "${csvValue}"`}
                                    >
                                      {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Plus className="w-4 h-4" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}


              {/* CSV Preview Table - Show up to 500 contacts */}
              {csvData.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-medium mb-2">Aperçu des données CSV</h4>
                  <p className="text-sm text-slate-600 mb-3">
                    {csvData.length > 500 
                      ? `Affichage des 500 premiers contacts sur ${csvData.length} ligne(s) au total`
                      : `Tous les contacts du fichier CSV (${csvData.length} ligne(s))`
                    }
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
                        {csvData.slice(0, 500).map((row, idx) => (
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
                  disabled={!columnMapping.statusId}
                >
                  Démarrer la migration
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
                  ? `Traitement de ${processingProgress.current} sur ${processingProgress.total} contacts`
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
                {/* Success count with breakdown */}
                {migrationResults.success > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded p-4">
                    <p className="text-sm text-green-800 mb-2">
                      <strong>✓ Contacts traités avec succès:</strong> {migrationResults.success}
                    </p>
                    {(migrationResults.created > 0 || migrationResults.updated > 0) && (
                      <div className="text-sm text-green-700 pl-4 space-y-1 mt-2">
                        {migrationResults.created > 0 && (
                          <div>• Contacts créés: <strong>{migrationResults.created}</strong></div>
                        )}
                        {migrationResults.updated > 0 && (
                          <div>• Contacts mis à jour: <strong>{migrationResults.updated}</strong></div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Detailed list of updated contacts */}
                {migrationResults.updatedContacts && migrationResults.updatedContacts.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Contacts mis à jour ({migrationResults.updatedContacts.length})</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Export updated contacts to CSV
                            const headers = ['Nom', 'Email', 'Ancien ID', 'Contact ID', 'Champs mis à jour'];
                            const csvRows = migrationResults.updatedContacts!.map(contact => {
                              const fields = contact.updatedFields.join('; ');
                              return [
                                contact.contactName,
                                contact.contactEmail,
                                contact.oldContactId || '',
                                contact.contactId,
                                fields
                              ];
                            });
                            
                            const csvContent = [
                              headers.join(','),
                              ...csvRows.map(row => 
                                row.map(cell => {
                                  const cellStr = String(cell || '');
                                  if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                                    return `"${cellStr.replace(/"/g, '""')}"`;
                                  }
                                  return cellStr;
                                }).join(',')
                              )
                            ].join('\n');
                            
                            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            const url = URL.createObjectURL(blob);
                            link.setAttribute('href', url);
                            link.setAttribute('download', `contacts_mis_a_jour_${new Date().toISOString().split('T')[0]}.csv`);
                            link.style.visibility = 'hidden';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            toast.success('Fichier CSV exporté avec succès');
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Exporter en CSV
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[600px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold">Nom</th>
                                <th className="px-4 py-3 text-left font-semibold">Email</th>
                                <th className="px-4 py-3 text-left font-semibold">Ancien ID</th>
                                <th className="px-4 py-3 text-left font-semibold">Contact ID</th>
                                <th className="px-4 py-3 text-left font-semibold">Champs mis à jour</th>
                              </tr>
                            </thead>
                            <tbody>
                              {migrationResults.updatedContacts.map((contact, idx) => (
                                <tr key={idx} className="border-t hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium">{contact.contactName}</td>
                                  <td className="px-4 py-3">{contact.contactEmail}</td>
                                  <td className="px-4 py-3 font-mono text-xs">{contact.oldContactId || '-'}</td>
                                  <td className="px-4 py-3 font-mono text-xs">{contact.contactId}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {contact.updatedFields && contact.updatedFields.length > 0 ? (
                                        contact.updatedFields.map((field, fieldIdx) => (
                                          <span 
                                            key={fieldIdx}
                                            className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                                          >
                                            {field}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                                          Multiple fields
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Failed count and reasons */}
                {migrationResults.failed > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <p className="text-sm text-yellow-800 mb-3">
                      <strong>⚠ Contacts non traités:</strong> {migrationResults.failed}
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

                {/* Detailed table of failed contacts */}
                {failedRows.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-red-800 font-semibold">
                        <strong>📋 Contacts non importés:</strong> {failedRows.length}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Export failed contacts to CSV
                          const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Mobile', 'Ancien ID', 'Erreur'];
                          const csvRows = failedRows.map(row => {
                            const firstName = row.mappedData.firstName || '';
                            const lastName = row.mappedData.lastName || '';
                            const email = row.mappedData.email || '';
                            const phone = row.mappedData.phone || '';
                            const mobile = row.mappedData.mobile || '';
                            const oldContactId = row.mappedData.oldContactId || '';
                            const error = (row.errors || ['Erreur inconnue']).join('; ');
                            
                            return [
                              firstName,
                              lastName,
                              email,
                              phone,
                              mobile,
                              oldContactId,
                              error
                            ];
                          });
                          
                          // Create CSV content
                          const csvContent = [
                            headers.join(','),
                            ...csvRows.map(row => 
                              row.map(cell => {
                                // Escape commas and quotes in CSV
                                const cellStr = String(cell || '');
                                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                                  return `"${cellStr.replace(/"/g, '""')}"`;
                                }
                                return cellStr;
                              }).join(',')
                            )
                          ].join('\n');
                          
                          // Create blob and download
                          const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                          const link = document.createElement('a');
                          const url = URL.createObjectURL(blob);
                          link.setAttribute('href', url);
                          link.setAttribute('download', `contacts_non_importes_${new Date().toISOString().split('T')[0]}.csv`);
                          link.style.visibility = 'hidden';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          toast.success('Fichier CSV exporté avec succès');
                        }}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Exporter en CSV
                      </Button>
                    </div>
                    <div className="border rounded overflow-x-auto max-h-[600px] overflow-y-auto bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left border-b font-semibold bg-red-50 sticky left-0 z-10">#</th>
                            <th className="px-3 py-2 text-left border-b font-semibold bg-red-50">Prénom</th>
                            <th className="px-3 py-2 text-left border-b font-semibold bg-red-50">Nom</th>
                            <th className="px-3 py-2 text-left border-b font-semibold bg-red-50">Email</th>
                            <th className="px-3 py-2 text-left border-b font-semibold bg-red-50">Téléphone</th>
                            <th className="px-3 py-2 text-left border-b font-semibold bg-red-50">Mobile</th>
                            <th className="px-3 py-2 text-left border-b font-semibold bg-red-50">Ancien ID</th>
                            <th className="px-3 py-2 text-left border-b font-semibold bg-red-50">Erreur</th>
                          </tr>
                        </thead>
                        <tbody>
                          {failedRows.map((row, index) => {
                            const firstName = row.mappedData.firstName || '';
                            const lastName = row.mappedData.lastName || '';
                            const email = row.mappedData.email || '';
                            const phone = row.mappedData.phone || '';
                            const mobile = row.mappedData.mobile || '';
                            const oldContactId = row.mappedData.oldContactId || '';
                            const errorMessages = row.errors || ['Erreur inconnue'];
                            const errorText = errorMessages.join('; ');
                            
                            return (
                              <tr key={row.id || index} className="hover:bg-red-50">
                                <td className="px-3 py-2 border-b bg-white sticky left-0 z-10 font-medium">{index + 1}</td>
                                <td className="px-3 py-2 border-b">
                                  <div className="max-w-xs truncate" title={firstName}>
                                    {firstName || '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-2 border-b">
                                  <div className="max-w-xs truncate" title={lastName}>
                                    {lastName || '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-2 border-b">
                                  <div className="max-w-xs truncate" title={email}>
                                    {email || '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-2 border-b">
                                  <div className="max-w-xs truncate" title={phone}>
                                    {phone || '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-2 border-b">
                                  <div className="max-w-xs truncate" title={mobile}>
                                    {mobile || '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-2 border-b">
                                  <div className="max-w-xs truncate" title={oldContactId}>
                                    {oldContactId || '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-2 border-b">
                                  <div className="max-w-md truncate text-red-700 font-medium" title={errorText}>
                                    {errorText}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Row Modal */}
      {showEditModal && editingRowData && typeof document !== 'undefined' && createPortal(
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

              {/* Last 3 Notes Section */}
              {editingRowData.contactId && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <Label className="text-base font-semibold mb-3 block">Dernières notes</Label>
                  {loadingNotes ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span className="text-sm text-slate-500">Chargement des notes...</span>
                    </div>
                  ) : contactNotes.length > 0 ? (
                    <div className="space-y-3">
                      {contactNotes.map((note) => (
                        <div key={note.id} className="p-3 bg-slate-50 rounded border border-slate-200">
                          <div className="mb-2">
                            <span className="text-sm text-slate-800" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', display: 'block' }}>
                              {note.text}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>
                              {new Date(note.createdAt || note.created_at).toLocaleString('fr-FR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric',
                                hour: '2-digit', 
                                minute: '2-digit'
                              })}
                            </span>
                            {(note.createdBy || note.userId?.username || note.user?.username) && (
                              <>
                                <span className="text-slate-400">•</span>
                                <span>
                                  {note.createdBy || note.userId?.username || note.user?.username}
                                </span>
                              </>
                            )}
                            {note.categoryName && (
                              <>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-600 font-medium">{note.categoryName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">Aucune note pour ce contact</p>
                  )}
                </div>
              )}

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
        </div>,
        document.body
      )}
    </div>
  );
}

