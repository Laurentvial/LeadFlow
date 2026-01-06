import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Upload, FileText, Download, X, Eye } from 'lucide-react';
import { apiCall } from '../utils/api';
import { handleModalOverlayClick } from '../utils/modal';
import { toast } from 'sonner';
import { useUser } from '../contexts/UserContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import '../styles/Modal.css';

interface ContactDocumentsTabProps {
  contactId: string;
}

interface Document {
  id: string;
  contactId: string;
  documentType: string;
  hasDocument: boolean;
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
  updatedAt: string;
  uploadedById?: number;
  uploadedByName?: string;
}

const DOCUMENT_TYPES = [
  { value: 'CNI', label: 'CNI' },
  { value: 'JUSTIFICATIF_DOMICILE', label: 'Justificatif de domicile' },
  { value: 'SELFIE', label: 'Selfie' },
  { value: 'RIB', label: 'RIB' },
  { value: 'CONTRAT', label: 'Contrat' },
];

export function ContactDocumentsTab({ contactId }: ContactDocumentsTabProps) {
  const { currentUser } = useUser();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Permission checks for documents tab - use contact_tabs permissions
  const canCreateDocument = useMemo(() => {
    if (!currentUser?.permissions) return false;
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'create' && 
      p.fieldName === 'documents' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  const canEditDocument = useMemo(() => {
    if (!currentUser?.permissions) return false;
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'edit' && 
      p.fieldName === 'documents' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  const canDeleteDocument = useMemo(() => {
    if (!currentUser?.permissions) return false;
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'delete' && 
      p.fieldName === 'documents' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  useEffect(() => {
    loadDocuments();
  }, [contactId]);

  async function loadDocuments() {
    try {
      const data = await apiCall(`/api/contacts/${contactId}/documents/`);
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Erreur lors du chargement des documents');
    }
  }

  async function handleFileUpload() {
    if (!selectedDocumentType || !selectedFile) {
      toast.error('Veuillez sélectionner un type de document et un fichier');
      return;
    }

    try {
      setUploading(true);
      
      // Upload file to Impossible Cloud via backend
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('contactId', contactId);
      formData.append('documentType', selectedDocumentType);
      
      const uploadResponse = await apiCall('/api/documents/upload/', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, let browser set it with boundary for FormData
      });
      
      const { fileUrl, fileName } = uploadResponse;
      
      // Create or update document with the uploaded file URL
      await apiCall('/api/documents/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          documentType: selectedDocumentType,
          fileUrl,
          fileName: fileName || selectedFile.name,
        }),
      });
      
      toast.success('Document uploadé avec succès');
      await loadDocuments();
      
      // Reset form and close dialog
      setSelectedDocumentType('');
      setSelectedFile(null);
      setUploadDialogOpen(false);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Erreur lors de l\'upload du document');
    } finally {
      setUploading(false);
    }
  }

  function getDocumentTypeLabel(type: string): string {
    return DOCUMENT_TYPES.find(dt => dt.value === type)?.label || type;
  }

  async function handleOpenDocument(documentId: string) {
    try {
      const response = await apiCall(`/api/documents/${documentId}/view-url/`);
      const { viewUrl } = response;
      
      if (viewUrl) {
        // Open the presigned URL in a new tab to view the file
        window.open(viewUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('URL de visualisation non disponible');
      }
    } catch (error: any) {
      console.error('Error opening document:', error);
      toast.error(error.message || 'Erreur lors de l\'ouverture du document');
    }
  }

  async function handleDownloadDocument(documentId: string) {
    try {
      // Get auth token and API URL
      const token = localStorage.getItem('access');
      // @ts-ignore - Vite environment variables
      const apiUrl = import.meta.env.VITE_URL || 'http://127.0.0.1:8000';
      
      // Create a link that points directly to the Django download endpoint
      // The backend already sets Content-Disposition: attachment, so it will download
      const downloadUrl = `${apiUrl}/api/documents/${documentId}/download/`;
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.style.display = 'none';
      
      // Add authorization header by using fetch first, then creating blob URL
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      // Get the blob and create a blob URL for download
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      link.href = blobUrl;
      link.download = ''; // Let the Content-Disposition header set the filename
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast.error(error.message || 'Erreur lors du téléchargement du document');
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    
    try {
      await apiCall(`/api/documents/${documentId}/delete/`, {
        method: 'DELETE',
      });
      toast.success('Document supprimé avec succès');
      await loadDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error(error.message || 'Erreur lors de la suppression du document');
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Documents</CardTitle>
          {canCreateDocument && (
            <Button 
              type="button" 
              className="flex items-center gap-2"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="w-4 h-4" />
              Uploader un document
            </Button>
          )}
        </div>
      </CardHeader>
      {uploadDialogOpen && (
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => {
          setUploadDialogOpen(false);
          setSelectedDocumentType('');
          setSelectedFile(null);
        })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Uploader un document</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setUploadDialogOpen(false);
                  setSelectedDocumentType('');
                  setSelectedFile(null);
                }}
              >
                <X className="planning-icon-md" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Label htmlFor="document-type">Type de document</Label>
                <Select
                  value={selectedDocumentType}
                  onValueChange={setSelectedDocumentType}
                >
                  <SelectTrigger id="document-type">
                    <SelectValue placeholder="Sélectionner un type de document" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((docType) => (
                      <SelectItem key={docType.value} value={docType.value}>
                        {docType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-field">
                <Label htmlFor="file-upload">Fichier</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setSelectedFile(file || null);
                  }}
                  disabled={uploading}
                />
                {selectedFile && (
                  <p className="text-sm text-slate-600 mt-1">
                    {selectedFile.name}
                  </p>
                )}
              </div>
              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setUploadDialogOpen(false);
                    setSelectedDocumentType('');
                    setSelectedFile(null);
                  }}
                  disabled={uploading}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={uploading || !selectedDocumentType || !selectedFile}
                  className="flex items-center gap-2"
                >
                  {uploading ? (
                    <>Upload en cours...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Uploader
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun document uploadé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((document) => (
              <div
                key={document.id}
                className="p-4 border border-slate-200 flex flex-col"
              >
                <div className="flex-1">
                  <div className="mb-2">
                    <Label className="text-base font-semibold text-slate-900">
                      {getDocumentTypeLabel(document.documentType)}
                    </Label>
                    {document.fileName && (
                      <p className="text-sm text-slate-600 mt-1">
                        {document.fileName}
                      </p>
                    )}
                  </div>
                  {document.uploadedByName && (
                    <p className="text-xs text-slate-500 mt-2">
                      Uploadé par {document.uploadedByName} le{' '}
                      {new Date(document.uploadedAt).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-200">
                  {document.fileUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenDocument(document.id)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none p-0"
                      >
                        <Eye className="w-4 h-4" />
                        Ouvrir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(document.id)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none p-0"
                      >
                        <Download className="w-4 h-4" />
                        Télécharger
                      </button>
                    </>
                  )}
                  {canDeleteDocument && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDocument(document.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                    >
                      Supprimer le document
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

