import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import '../styles/PageHeader.css';

interface ColumnMapping {
  [key: string]: string; // Event field -> CSV column
}

const EVENT_FIELDS = [
  { value: 'oldContactId', label: 'Ancien ID Contact' },
  { value: 'datetime', label: 'Date et heure (format: 2025-04-29 10:30:00) (requis)', required: true },
  { value: 'userId', label: 'Utilisateur assigné (ID, email ou nom d\'utilisateur)' },
  { value: 'comment', label: 'Commentaire' },
];

export function EventsMigrationPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'processing' | 'results'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excludeFirstRow, setExcludeFirstRow] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userIdMapping, setUserIdMapping] = useState<{ [csvValue: string]: string }>({}); // CSV value -> User ID
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [migrationResults, setMigrationResults] = useState<{ success: number; failed: number; failureReasons: { [reason: string]: number }; errorDetails: { [reason: string]: string[] } }>({ success: 0, failed: 0, failureReasons: {}, errorDetails: {} });

  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]/g, '') // Remove special chars and spaces
      .trim();
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
    EVENT_FIELDS.forEach(field => {
      if (field.value) {
        initialMapping[field.value] = '';
      }
    });
    setColumnMapping(initialMapping);
    setUserIdMapping({}); // Reset user mapping
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
      setUsers(validUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    // Load users when entering mapping step
    if (step === 'mapping' && users.length === 0 && !usersLoading) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Auto-map user values
  const handleAutoMapUsers = () => {
    if (!columnMapping.userId || csvData.length === 0) return;

    const userColumn = columnMapping.userId;
    const uniqueUserValues = Array.from(
      new Set(
        csvData
          .map(row => row[userColumn])
          .filter(val => val && val.toString().trim() !== '')
          .map(val => val.toString().trim())
      )
    );

    const newMapping = { ...userIdMapping };
    let matchedCount = 0;

    uniqueUserValues.forEach(csvValue => {
      if (newMapping[csvValue]) return; // Already mapped

      const csvValueNormalized = normalizeString(csvValue);
      let bestMatch: any = null;
      let bestScore = 0;

      users.forEach(user => {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        const displayName = fullName || user.username || user.email || '';
        const displayNameNormalized = normalizeString(displayName);
        const usernameNormalized = normalizeString(user.username || '');
        const emailNormalized = normalizeString(user.email || '');
        const idNormalized = normalizeString(user.id);

        // Exact match
        if (csvValueNormalized === displayNameNormalized || 
            csvValueNormalized === usernameNormalized || 
            csvValueNormalized === emailNormalized ||
            csvValueNormalized === idNormalized) {
          if (bestScore < 100) {
            bestMatch = user;
            bestScore = 100;
          }
        }
        // Contains match
        else if (displayNameNormalized.includes(csvValueNormalized) || csvValueNormalized.includes(displayNameNormalized) ||
                 usernameNormalized.includes(csvValueNormalized) || csvValueNormalized.includes(usernameNormalized)) {
          if (bestScore < 70) {
            bestMatch = user;
            bestScore = 70;
          }
        }
      });

      if (bestMatch && bestScore >= 70) {
        newMapping[csvValue] = bestMatch.id;
        matchedCount++;
      }
    });

    setUserIdMapping(newMapping);
    toast.success(`${matchedCount} valeur(s) d'utilisateur mappée(s) automatiquement`);
  };

  const parseDateTime = (datetimeValue: string): string | null => {
    if (!datetimeValue || !datetimeValue.trim()) return null;

    try {
      const trimmedValue = datetimeValue.trim();
      
      // Try to parse the format: 2025-04-29 10:30:00
      // This format: YYYY-MM-DD HH:MM:SS
      const isoDateTimeMatch = trimmedValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (isoDateTimeMatch) {
        const year = parseInt(isoDateTimeMatch[1], 10);
        const month = parseInt(isoDateTimeMatch[2], 10);
        const day = parseInt(isoDateTimeMatch[3], 10);
        const hour = parseInt(isoDateTimeMatch[4], 10);
        const minute = parseInt(isoDateTimeMatch[5], 10);
        const second = isoDateTimeMatch[6] ? parseInt(isoDateTimeMatch[6], 10) : 0;
        
        // Validate ranges
        if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
          return null;
        }
        
        const formattedMonth = String(month).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        const formattedHour = String(hour).padStart(2, '0');
        const formattedMinute = String(minute).padStart(2, '0');
        const formattedSecond = String(second).padStart(2, '0');
        
        return `${year}-${formattedMonth}-${formattedDay}T${formattedHour}:${formattedMinute}:${formattedSecond}`;
      }
      
      // Try to parse dd/mm/yyyy HH:MM:SS format
      const ddmmyyyyMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10);
        const year = parseInt(ddmmyyyyMatch[3], 10);
        const hour = parseInt(ddmmyyyyMatch[4], 10);
        const minute = parseInt(ddmmyyyyMatch[5], 10);
        const second = ddmmyyyyMatch[6] ? parseInt(ddmmyyyyMatch[6], 10) : 0;
        
        // Validate ranges
        if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
          return null;
        }
        
        const formattedMonth = String(month).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        const formattedHour = String(hour).padStart(2, '0');
        const formattedMinute = String(minute).padStart(2, '0');
        const formattedSecond = String(second).padStart(2, '0');
        
        return `${year}-${formattedMonth}-${formattedDay}T${formattedHour}:${formattedMinute}:${formattedSecond}`;
      }
      
      // Try standard Date parsing as fallback (handles ISO strings and other formats)
      const parsedDate = new Date(trimmedValue);
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        return null;
      }
      
      // Extract components from parsed date
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      const hour = String(parsedDate.getHours()).padStart(2, '0');
      const minute = String(parsedDate.getMinutes()).padStart(2, '0');
      const second = String(parsedDate.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    } catch (error) {
      console.error('Error parsing datetime:', error);
      return null;
    }
  };

  const handleStartMigration = async () => {
    // Validate required fields - oldContactId must be mapped
    if (!columnMapping.oldContactId) {
      toast.error('Veuillez mapper "Ancien ID Contact"');
      return;
    }

    // Check if datetime is mapped (required)
    if (!columnMapping.datetime) {
      toast.error('Veuillez mapper "Date et heure"');
      return;
    }

    // Check if userId column is mapped but no values are mapped
    if (columnMapping.userId) {
      const userColumn = columnMapping.userId;
      const uniqueUserValues = Array.from(
        new Set(
          csvData
            .map(row => row[userColumn])
            .filter(val => val && val.toString().trim() !== '')
            .map(val => val.toString().trim())
        )
      );
      
      const unmappedValues = uniqueUserValues.filter(val => !userIdMapping[val]);
      if (unmappedValues.length > 0) {
        const confirmMessage = `Vous avez ${unmappedValues.length} valeur(s) d'utilisateur non mappée(s). Voulez-vous continuer quand même ? Les événements avec des utilisateurs non mappés échoueront.`;
        if (!window.confirm(confirmMessage)) {
          return;
        }
      }
    }

    setStep('processing');
    setIsLoading(true);
    setProcessingProgress({ current: 0, total: csvData.length });

    try {
      // Load users if not already loaded
      if (users.length === 0) {
        await loadUsers();
      }

      // Pre-fetch contacts by oldContactId if oldContactId is mapped
      // Store both contactId and teleoperatorId for each contact
      const contactsByOldId: { [oldId: string]: { contactId: string; teleoperatorId: string | null } } = {};
      if (columnMapping.oldContactId) {
        try {
          // Get all unique oldContactIds from CSV
          const oldContactIds = Array.from(new Set(
            csvData
              .map(row => row[columnMapping.oldContactId]?.trim())
              .filter(id => id)
          ));

          console.log(`[DEBUG] Looking up ${oldContactIds.length} unique oldContactIds`);

          if (oldContactIds.length > 0) {
            // Try fetching all contacts first (more reliable for migration)
            let allContacts: any[] = [];
            try {
              console.log(`[DEBUG] Attempting to fetch all contacts for migration...`);
              const allContactsResponse = await apiCall('/api/contacts/', {
                method: 'GET',
                params: new URLSearchParams({
                  all_contacts: 'true',
                  limit: '10000' // Fetch a large batch
                })
              });
              
              // Handle different response formats
              if (Array.isArray(allContactsResponse)) {
                allContacts = allContactsResponse;
              } else if (allContactsResponse?.contacts && Array.isArray(allContactsResponse.contacts)) {
                allContacts = allContactsResponse.contacts;
              } else if (allContactsResponse && typeof allContactsResponse === 'object') {
                const possibleArrays = Object.values(allContactsResponse).filter((val: any) => Array.isArray(val));
                if (possibleArrays.length > 0) {
                  allContacts = possibleArrays[0] as any[];
                }
              }
              
              console.log(`[DEBUG] Fetched ${allContacts.length} total contacts`);
              
              // Build lookup map from all contacts
              allContacts.forEach((contact: any) => {
                const oldId = contact.oldContactId || contact.old_contact_id;
                if (oldId !== null && oldId !== undefined && oldId !== '') {
                  const oldIdStr = String(oldId).trim();
                  if (oldIdStr) {
                    const contactInfo = {
                      contactId: contact.id,
                      teleoperatorId: contact.teleoperatorId || contact.teleoperator_id || null
                    };
                    
                    // Store with string key
                    contactsByOldId[oldIdStr] = contactInfo;
                    
                    // Also store numeric version if applicable (for "231111" vs 231111 matching)
                    if (!isNaN(Number(oldIdStr))) {
                      const numericKey = String(Number(oldIdStr));
                      if (numericKey !== oldIdStr) {
                        contactsByOldId[numericKey] = contactInfo;
                      }
                    }
                  }
                }
              });
              
              console.log(`[DEBUG] Built lookup map with ${Object.keys(contactsByOldId).length} contacts`);
              
              // Check which oldContactIds were found (try both string and numeric versions)
              const foundIds = oldContactIds.filter(id => {
                const idTrimmed = id.trim();
                return contactsByOldId[idTrimmed] || 
                       (!isNaN(Number(idTrimmed)) && contactsByOldId[String(Number(idTrimmed))]);
              });
              const missingIds = oldContactIds.filter(id => {
                const idTrimmed = id.trim();
                return !contactsByOldId[idTrimmed] && 
                       (isNaN(Number(idTrimmed)) || !contactsByOldId[String(Number(idTrimmed))]);
              });
              console.log(`[DEBUG] Found ${foundIds.length} contacts, missing ${missingIds.length}`);
              if (missingIds.length > 0) {
                console.log(`[DEBUG] Missing oldContactIds (first 20):`, missingIds.slice(0, 20));
                
                // Show sample contacts with oldContactId to compare formats
                const sampleContacts = allContacts
                  .filter((c: any) => {
                    const oldId = c.oldContactId || c.old_contact_id;
                    return oldId !== null && oldId !== undefined && oldId !== '';
                  })
                  .slice(0, 10)
                  .map((c: any) => {
                    const oldId = c.oldContactId || c.old_contact_id;
                    return {
                      id: c.id,
                      oldContactId: oldId,
                      oldContactIdType: typeof oldId,
                      oldContactIdString: String(oldId),
                      oldContactIdNumeric: !isNaN(Number(oldId)) ? Number(oldId) : null,
                      firstName: c.firstName || c.fname,
                      lastName: c.lastName || c.lname
                    };
                  });
                console.log(`[DEBUG] Sample contacts with oldContactId:`, sampleContacts);
                
                // Show what we're looking for
                console.log(`[DEBUG] Looking for oldContactIds (first 10):`, 
                  oldContactIds.slice(0, 10).map(id => ({
                    original: id,
                    trimmed: id.trim(),
                    numeric: !isNaN(Number(id.trim())) ? Number(id.trim()) : null
                  }))
                );
              }
            } catch (allContactsError: any) {
              console.warn(`[DEBUG] Failed to fetch all contacts, falling back to individual queries:`, allContactsError);
              
              // Fallback: Fetch contacts by oldContactId in parallel batches
              const CONTACT_BATCH_SIZE = 20; // Process in parallel batches
              for (let j = 0; j < oldContactIds.length; j += CONTACT_BATCH_SIZE) {
                const batch = oldContactIds.slice(j, j + CONTACT_BATCH_SIZE);
              
                // Query each oldContactId in parallel for better performance
                const contactPromises = batch.map(async (oldId) => {
                  try {
                    const oldIdTrimmed = oldId.trim();
                  
                    // Try with all_contacts=true to bypass permission filtering (for migration purposes)
                    // This ensures we can find contacts even if user doesn't have direct access
                    let response;
                    try {
                      response = await apiCall('/api/contacts/', {
                        method: 'GET',
                        params: new URLSearchParams({
                          filter_oldContactId: oldIdTrimmed,
                          all_contacts: 'true', // Bypass permission filtering for migration
                          limit: '1000' // Increase limit to get more results
                        })
                      });
                    } catch (apiError: any) {
                      console.error(`API call failed for oldContactId "${oldIdTrimmed}":`, apiError);
                      // Try without all_contacts as fallback
                      try {
                        response = await apiCall('/api/contacts/', {
                          method: 'GET',
                          params: new URLSearchParams({
                            filter_oldContactId: oldIdTrimmed,
                            limit: '1000'
                          })
                        });
                      } catch (fallbackError: any) {
                        console.error(`Fallback API call also failed for oldContactId "${oldIdTrimmed}":`, fallbackError);
                        return null;
                      }
                    }
                    
                    // Handle different response formats
                    let contactsList: any[] = [];
                    if (Array.isArray(response)) {
                      contactsList = response;
                    } else if (response?.contacts && Array.isArray(response.contacts)) {
                      contactsList = response.contacts;
                    } else if (response && typeof response === 'object') {
                      // Try to find contacts array in response
                      const possibleArrays = Object.values(response).filter((val: any) => Array.isArray(val));
                      if (possibleArrays.length > 0) {
                        contactsList = possibleArrays[0] as any[];
                      }
                    }
                    
                    console.log(`[DEBUG] Searching for oldContactId "${oldIdTrimmed}". Found ${contactsList.length} contacts in response.`);
                    
                    if (contactsList.length > 0) {
                      // Find exact match (since filter uses contains, we need to check for exact match)
                      // Try multiple matching strategies:
                      // 1. Exact string match (trimmed)
                      // 2. Numeric match (if both are numeric)
                      // 3. Case-insensitive match
                      const oldIdNumeric = !isNaN(Number(oldIdTrimmed)) ? Number(oldIdTrimmed) : null;
                      
                      const contact = contactsList.find((c: any) => {
                        if (!c.oldContactId && !c.old_contact_id) return false;
                        
                        // Try both camelCase and snake_case field names
                        const contactOldId = String(c.oldContactId || c.old_contact_id || '').trim();
                        
                        if (!contactOldId) return false;
                        
                        // Exact string match
                        if (contactOldId === oldIdTrimmed) {
                          console.log(`[DEBUG] Found exact match for "${oldIdTrimmed}":`, contact);
                          return true;
                        }
                        
                        // Numeric match (if both are numeric)
                        if (oldIdNumeric !== null) {
                          const contactOldIdNumeric = !isNaN(Number(contactOldId)) ? Number(contactOldId) : null;
                          if (contactOldIdNumeric !== null && contactOldIdNumeric === oldIdNumeric) {
                            console.log(`[DEBUG] Found numeric match for "${oldIdTrimmed}":`, contact);
                            return true;
                          }
                        }
                        
                        // Case-insensitive match
                        if (contactOldId.toLowerCase() === oldIdTrimmed.toLowerCase()) {
                          console.log(`[DEBUG] Found case-insensitive match for "${oldIdTrimmed}":`, contact);
                          return true;
                        }
                        
                        return false;
                      });
                      
                      if (contact) {
                        return { 
                          oldId: oldIdTrimmed, 
                          contactId: contact.id,
                          teleoperatorId: contact.teleoperatorId || contact.teleoperator_id || null
                        };
                      }
                      
                      // Log for debugging if contact not found
                      console.warn(`[DEBUG] Contact not found for oldContactId "${oldIdTrimmed}". Found ${contactsList.length} contacts in response.`);
                      console.warn(`[DEBUG] Sample oldContactIds from response:`, 
                        contactsList.slice(0, 10).map((c: any) => ({
                          id: c.id,
                          oldContactId: c.oldContactId || c.old_contact_id,
                          fullName: `${c.fname || ''} ${c.lname || ''}`.trim()
                        })));
                    } else {
                      console.warn(`[DEBUG] No contacts found in response for oldContactId "${oldIdTrimmed}". Response:`, response);
                    }
                    
                    return null;
                  } catch (error: any) {
                    console.error(`[ERROR] Error fetching contact for oldContactId ${oldId}:`, error);
                    // Log more details about the error
                    if (error?.error) {
                      console.error(`[ERROR] Error details:`, error.error);
                    }
                    if (error?.message) {
                      console.error(`[ERROR] Error message:`, error.message);
                    }
                    if (error?.response) {
                      console.error(`[ERROR] Error response:`, error.response);
                    }
                    return null;
                  }
                });
                
                const results = await Promise.all(contactPromises);
                results.forEach(result => {
                  if (result) {
                    contactsByOldId[result.oldId] = {
                      contactId: result.contactId,
                      teleoperatorId: result.teleoperatorId
                    };
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching contacts by oldContactId:', error);
          toast.warning('Erreur lors de la récupération des contacts par ancien ID. Continuons avec les IDs directs.');
        }
      }

      const BATCH_SIZE = 100; // Process events in batches
      let totalSuccess = 0;
      let totalFailed = 0;
      const failureReasons: { [reason: string]: number } = {};
      const errorDetails: { [reason: string]: string[] } = {};

      for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
        const batch = csvData.slice(i, i + BATCH_SIZE);
        
        // Process batch
        const batchPromises = batch.map(async (row) => {
          try {
            // Get contactId and teleoperatorId by resolving oldContactId
            let contactId: string | null = null;
            let teleoperatorId: string | null = null;
            
            if (columnMapping.oldContactId) {
              const oldContactId = row[columnMapping.oldContactId]?.trim() || null;
              if (oldContactId) {
                // Try to find contact by oldContactId (try both string and numeric versions)
                let contactInfo = contactsByOldId[oldContactId];
                if (!contactInfo && !isNaN(Number(oldContactId))) {
                  // Try numeric version
                  contactInfo = contactsByOldId[String(Number(oldContactId))];
                }
                
                if (!contactInfo) {
                  return { success: false, error: `Contact introuvable pour l'ancien ID: ${oldContactId}` };
                }
                contactId = contactInfo.contactId;
                teleoperatorId = contactInfo.teleoperatorId;
                
                // Only require teleoperator if userId column is not mapped
                // If userId is mapped, we'll use the mapped user instead
                if (!columnMapping.userId && !teleoperatorId) {
                  return { success: false, error: `Le contact ${oldContactId} n'a pas de téléopérateur assigné` };
                }
              } else {
                return { success: false, error: 'Ancien ID Contact manquant' };
              }
            } else {
              return { success: false, error: 'Ancien ID Contact manquant' };
            }

            // Parse datetime from datetime field (required)
            let datetime: string | null = null;
            if (columnMapping.datetime) {
              datetime = parseDateTime(row[columnMapping.datetime]?.trim() || '');
            }

            if (!datetime) {
              return { success: false, error: 'Date et heure invalides ou manquantes' };
            }
            
            const comment = columnMapping.comment ? row[columnMapping.comment]?.trim() : '';

            // Determine userId: use mapped userId if provided, otherwise fall back to contact's teleoperatorId
            let eventUserId: string | null = null;
            
            if (columnMapping.userId && row[columnMapping.userId]) {
              const userIdentifier = row[columnMapping.userId]?.trim();
              if (userIdentifier) {
                // Check if there's a mapping for this CSV value
                const mappedUserId = userIdMapping[userIdentifier];
                if (mappedUserId) {
                  eventUserId = mappedUserId;
                } else {
                  return { success: false, error: `Utilisateur non mappé: ${userIdentifier}` };
                }
              }
            }
            
            // Fall back to contact's teleoperatorId if no userId was mapped or found
            if (!eventUserId) {
              if (!teleoperatorId) {
                return { success: false, error: 'Aucun utilisateur assigné (ni dans le CSV ni pour le contact)' };
              }
              eventUserId = teleoperatorId;
            }

            // Create event
            await apiCall('/api/events/create/', {
              method: 'POST',
              body: JSON.stringify({
                datetime,
                contactId,
                userId: eventUserId,
                comment
              }),
            });

            return { success: true };
          } catch (error: any) {
            const errorMessage = error?.error || error?.message || 'Erreur lors de la création';
            return { success: false, error: errorMessage };
          }
        });

        const results = await Promise.all(batchPromises);
        
        // Count successes and failures
        results.forEach(result => {
          if (result.success) {
            totalSuccess++;
          } else {
            totalFailed++;
            const errorMsg = result.error || 'Erreur inconnue';
            let reason = 'Autre';
            
            // Categorize errors
            if (errorMsg.toLowerCase().includes('contact') && (errorMsg.toLowerCase().includes('introuvable') || errorMsg.toLowerCase().includes('not found'))) {
              reason = 'Contact introuvable';
            } else if (errorMsg.toLowerCase().includes('téléopérateur') || errorMsg.toLowerCase().includes('teleoperateur') || errorMsg.toLowerCase().includes('téléopérateur manquant')) {
              reason = 'Téléopérateur manquant';
            } else if (errorMsg.toLowerCase().includes('date') || errorMsg.toLowerCase().includes('datetime') || errorMsg.toLowerCase().includes('heure invalide')) {
              reason = 'Date invalide';
            } else if (errorMsg.toLowerCase().includes('utilisateur') && (errorMsg.toLowerCase().includes('non mappé') || errorMsg.toLowerCase().includes('introuvable') || errorMsg.toLowerCase().includes('not found'))) {
              reason = 'Utilisateur non mappé ou introuvable';
            } else if (errorMsg.toLowerCase().includes('ancien id') || errorMsg.toLowerCase().includes('oldcontactid')) {
              reason = 'Ancien ID Contact manquant';
            } else if (errorMsg.toLowerCase().includes('aucun utilisateur assigné')) {
              reason = 'Aucun utilisateur assigné';
            }
            
            failureReasons[reason] = (failureReasons[reason] || 0) + 1;
            
            // Store error details (keep max 5 examples per category)
            if (!errorDetails[reason]) {
              errorDetails[reason] = [];
            }
            if (errorDetails[reason].length < 5 && !errorDetails[reason].includes(errorMsg)) {
              errorDetails[reason].push(errorMsg);
            }
          }
        });

        setProcessingProgress({ current: Math.min(i + BATCH_SIZE, csvData.length), total: csvData.length });
      }

      setMigrationResults({ success: totalSuccess, failed: totalFailed, failureReasons, errorDetails });
      setStep('results');
      
      if (totalFailed === 0) {
        toast.success(`${totalSuccess} événement(s) créé(s) avec succès`);
      } else {
        toast.warning(`${totalSuccess} événement(s) créé(s), ${totalFailed} erreur(s)`);
      }
    } catch (error: any) {
      console.error('Error importing events:', error);
      const errorMessage = error?.error || error?.message || 'Erreur lors de l\'importation';
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
    setCsvData([]);
    setColumnMapping({});
    setUserIdMapping({});
    setError(null);
    setIsLoading(false);
    setProcessingProgress({ current: 0, total: 0 });
    setMigrationResults({ success: 0, failed: 0, failureReasons: {}, errorDetails: {} });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/contacts')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-3xl font-bold">Migration d'événements</h1>
        <p className="text-slate-600 mt-2">
          Importez des événements depuis un fichier CSV
        </p>
      </div>

      {step === 'upload' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv-file" className="text-lg font-medium mb-2 block">
                  Sélectionner un fichier CSV
                </Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="exclude-first-row"
                  checked={excludeFirstRow}
                  onChange={(e) => setExcludeFirstRow(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="exclude-first-row" className="text-sm">
                  Exclure la première ligne (en-têtes)
                </Label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Mapper les colonnes CSV aux champs d'événement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Info message about user assignment */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Si vous mappez une colonne "Utilisateur assigné", les événements seront assignés à cet utilisateur. 
                  Sinon, ils seront automatiquement assignés au téléopérateur du contact. 
                  Le champ utilisateur accepte l'ID utilisateur, l'email ou le nom d'utilisateur.
                </p>
              </div>

              {EVENT_FIELDS.map((field) => (
                <div key={field.value} className="flex items-center gap-4">
                  <Label className="w-48 text-sm font-medium flex-shrink-0">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
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
                      <SelectValue placeholder="Sélectionner une colonne" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Aucune --</SelectItem>
                      {csvHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {/* Format info */}
              <div className="pt-4 border-t space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Format attendu pour la date et heure:</strong> <code className="bg-blue-100 px-2 py-1 rounded">2025-04-29 10:30:00</code>
                    <br />
                    Format: YYYY-MM-DD HH:MM:SS (année-mois-jour heure:minute:seconde)
                  </p>
                </div>
              </div>

              {/* User Mapping Section */}
              {columnMapping.userId && csvData.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">Mapper les valeurs d'utilisateur</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoMapUsers}
                        className="flex items-center gap-2"
                        disabled={usersLoading || users.length === 0}
                      >
                        <Zap className="w-4 h-4" />
                        Auto-mapper
                      </Button>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      Mappez les valeurs d'utilisateur de votre CSV aux utilisateurs de la base de données
                    </p>
                    {usersLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        <span className="ml-2 text-sm text-slate-600">Chargement des utilisateurs...</span>
                      </div>
                    ) : users.length === 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                        <p className="text-sm text-yellow-800">
                          Aucun utilisateur disponible. Veuillez attendre le chargement des utilisateurs.
                        </p>
                      </div>
                    ) : (() => {
                      // Get unique user values from CSV
                      const userColumn = columnMapping.userId;
                      const uniqueUserValues = Array.from(
                        new Set(
                          csvData
                            .map(row => row[userColumn])
                            .filter(val => val && val.toString().trim() !== '')
                            .map(val => val.toString().trim())
                        )
                      ).sort();

                      if (uniqueUserValues.length === 0) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                            <p className="text-sm text-yellow-800">
                              Aucune valeur d'utilisateur trouvée dans la colonne "{userColumn}"
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="border rounded p-4 bg-slate-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {uniqueUserValues.map((csvValue) => (
                              <div key={csvValue} className="flex items-center gap-3">
                                <Label className="w-32 text-sm font-medium flex-shrink-0 truncate" title={csvValue}>
                                  {csvValue}
                                </Label>
                                <Select
                                  value={userIdMapping[csvValue] || '__none__'}
                                  onValueChange={(value) => {
                                    setUserIdMapping({
                                      ...userIdMapping,
                                      [csvValue]: value === '__none__' ? '' : value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Sélectionner un utilisateur" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">-- Non mappé --</SelectItem>
                                    {users.map((user) => {
                                      const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email || `Utilisateur ${user.id}`;
                                      return (
                                        <SelectItem key={user.id} value={user.id}>
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

              {/* CSV Preview */}
              {csvData.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-medium mb-2">Aperçu des données CSV</h4>
                  <p className="text-sm text-slate-600 mb-3">
                    {csvData.length > 100 
                      ? `Affichage des 100 premières lignes sur ${csvData.length} ligne(s) au total`
                      : `Tous les événements du fichier CSV (${csvData.length} ligne(s))`
                    }
                  </p>
                  <div className="border rounded overflow-x-auto max-h-[400px] overflow-y-auto">
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
                        {csvData.slice(0, 100).map((row, idx) => (
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
                  disabled={!columnMapping.oldContactId || !columnMapping.datetime}
                >
                  Démarrer la migration
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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
                  ? `Traitement de ${processingProgress.current} sur ${processingProgress.total} événements`
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
                {/* Success count */}
                <div className="bg-green-50 border border-green-200 rounded p-4">
                  <p className="text-sm text-green-800">
                    <strong>✓ Événements créés avec succès:</strong> {migrationResults.success}
                  </p>
                </div>

                {/* Failed count and reasons */}
                {migrationResults.failed > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <p className="text-sm text-yellow-800 mb-3">
                      <strong>⚠ Événements non créés:</strong> {migrationResults.failed}
                    </p>
                    <div className="space-y-4">
                      {Object.entries(migrationResults.failureReasons).map(([reason, count]) => (
                        <div key={reason} className="border-l-4 border-yellow-400 pl-4">
                          <div className="text-sm font-medium text-yellow-800 mb-1">
                            • {reason}: {count}
                          </div>
                          {migrationResults.errorDetails[reason] && migrationResults.errorDetails[reason].length > 0 && (
                            <div className="text-xs text-yellow-700 mt-2 space-y-1">
                              <div className="font-medium">Exemples d'erreurs:</div>
                              {migrationResults.errorDetails[reason].map((errorMsg, idx) => (
                                <div key={idx} className="pl-2 italic">
                                  - {errorMsg}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


