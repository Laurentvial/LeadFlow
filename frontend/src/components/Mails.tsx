import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Mail, Send, Inbox, Archive, Star, Trash2, Settings, Plus, RefreshCw, Search, X, ChevronLeft, ChevronRight, FileSignature, Pencil, Check } from 'lucide-react';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import '../styles/Contacts.css';
import { ACCESS_TOKEN } from '../utils/constants';

// Component to load authenticated images
function AuthenticatedImage({ src, alt, className, onError, onLoad }: { 
  src: string; 
  alt: string; 
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      return;
    }

    // If it's a proxy URL, load with authentication
    if (src.startsWith('/api/')) {
      const loadImage = async () => {
        try {
          const token = localStorage.getItem(ACCESS_TOKEN);
          // Use same API URL logic as api.ts
          const getEnvVar = (key: string): string | undefined => {
            // @ts-ignore - Vite environment variables
            return import.meta.env[key];
          };
          const apiUrl = getEnvVar('VITE_URL') || 'http://127.0.0.1:8000';
          const fullUrl = `${apiUrl}${src}`;
          
          const response = await fetch(fullUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to load image: ${response.status}`);
          }

          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          setImageSrc(blobUrl);
          setLoading(false);
        } catch (err) {
          console.error('Error loading authenticated image:', err);
          setError(true);
          setLoading(false);
          if (onError) {
            onError({} as React.SyntheticEvent<HTMLImageElement>);
          }
        }
      };

      loadImage();

      // Cleanup blob URL on unmount
      return () => {
        if (imageSrc && imageSrc.startsWith('blob:')) {
          URL.revokeObjectURL(imageSrc);
        }
      };
    } else {
      // Direct URL, use as-is
      setImageSrc(src);
      setLoading(false);
    }
  }, [src]);

  if (loading) {
    return <div className={`${className} bg-slate-200 animate-pulse`} />;
  }

  if (error || !imageSrc) {
    return <div className={`${className} bg-red-100 border-2 border-red-300`} title="Failed to load image" />;
  }

  return (
    <img 
      src={imageSrc} 
      alt={alt}
      className={className}
      onError={onError}
      onLoad={onLoad}
    />
  );
}

interface Email {
  id: string;
  emailType: 'sent' | 'received' | 'draft';
  subject: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails?: string[];
  bodyText?: string;
  bodyHtml?: string;
  isRead: boolean;
  isStarred: boolean;
  sentAt: string;
  createdAt: string;
  userName?: string;
}

interface SMTPConfig {
  id: string;
  emailAddress: string;
  smtpServer: string;
  smtpPort: number;
  smtpUseTls: boolean;
  smtpUsername: string;
  imapServer?: string;
  imapPort?: number;
  imapUseSsl?: boolean;
  isActive: boolean;
}

interface EmailSignature {
  id: string;
  name: string;
  contentHtml: string;
  contentText: string;
  logoUrl?: string;  // Direct URL for email sending
  logoProxyUrl?: string;  // Proxy URL for preview (avoids CORS)
  logoPosition?: 'top' | 'bottom' | 'left' | 'right';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function Mails() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [emailType, setEmailType] = useState<'all' | 'sent' | 'received' | 'draft'>('received');
  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<EmailSignature | null>(null);
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [isCreatingSignature, setIsCreatingSignature] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureContent, setSignatureContent] = useState('');
  const [signatureLogoUrl, setSignatureLogoUrl] = useState('');
  const [signatureLogoPosition, setSignatureLogoPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('left');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Compose form state
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeBodyHtml, setComposeBodyHtml] = useState('');
  const [insertedSignatures, setInsertedSignatures] = useState<EmailSignature[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadSMTPConfig();
    loadSignatures();
  }, []);

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when filter changes
  }, [emailType]);

  useEffect(() => {
    loadEmails();
  }, [emailType, currentPage, itemsPerPage]);

  async function loadSMTPConfig() {
    try {
      const data = await apiCall('/api/emails/smtp-config/');
      setSmtpConfig(data.config);
    } catch (error) {
      console.error('Error loading SMTP config:', error);
    }
  }

  async function loadSignatures() {
    try {
      const data = await apiCall('/api/emails/signatures/');
      const loadedSignatures = data.signatures || [];
      setSignatures(loadedSignatures);
      // Debug: log signature data to verify logo URLs are loaded
      console.log('Loaded signatures:', loadedSignatures.map(s => ({ 
        id: s.id, 
        name: s.name, 
        logoUrl: s.logoUrl, 
        logoPosition: s.logoPosition,
        hasLogoUrl: !!s.logoUrl,
        logoUrlType: typeof s.logoUrl,
        logoUrlLength: s.logoUrl?.length || 0,
        logoUrlTruthy: !!s.logoUrl,
        logoUrlNotEmpty: s.logoUrl && s.logoUrl.trim() !== ''
      })));
    } catch (error) {
      console.error('Error loading signatures:', error);
    }
  }

  async function handleSaveSignature() {
    if (!signatureName.trim()) {
      toast.error('Le nom de la signature est requis');
      return;
    }

    try {
      const signatureData: any = {
        name: signatureName,
        contentHtml: signatureContent.replace(/\n/g, '<br>'),
        contentText: signatureContent,
        logoUrl: signatureLogoUrl,
        logoPosition: signatureLogoPosition
      };

      if (isEditingSignature && selectedSignature) {
        // Update existing signature
        await apiCall(`/api/emails/signatures/${selectedSignature.id}/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signatureData)
        });
        toast.success('Signature mise à jour');
      } else {
        // Create new signature
        signatureData.isDefault = signatures.length === 0; // First signature is default
        await apiCall('/api/emails/signatures/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signatureData)
        });
        toast.success('Signature créée');
      }
      
      loadSignatures();
      setIsEditingSignature(false);
      setIsCreatingSignature(false);
      setSelectedSignature(null);
      setSignatureName('');
      setSignatureContent('');
      setSignatureLogoUrl('');
      setSignatureLogoPosition('left');
    } catch (error: any) {
      console.error('Error saving signature:', error);
      toast.error(error?.message || 'Erreur lors de l\'enregistrement');
    }
  }

  async function handleDeleteSignature(signatureId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette signature ?')) return;

    try {
      await apiCall(`/api/emails/signatures/${signatureId}/delete/`, {
        method: 'DELETE'
      });
      toast.success('Signature supprimée');
      loadSignatures();
      if (selectedSignature?.id === signatureId) {
        setSelectedSignature(null);
        setIsEditingSignature(false);
        setIsCreatingSignature(false);
        setSignatureName('');
        setSignatureContent('');
      }
    } catch (error) {
      console.error('Error deleting signature:', error);
      toast.error('Erreur lors de la suppression');
    }
  }

  async function handleSetDefaultSignature(signatureId: string) {
    try {
      await apiCall(`/api/emails/signatures/${signatureId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true })
      });
      toast.success('Signature par défaut mise à jour');
      loadSignatures();
    } catch (error) {
      console.error('Error setting default signature:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  }

  function handleEditSignature(signature: EmailSignature) {
    setSelectedSignature(signature);
    setIsEditingSignature(true);
    setIsCreatingSignature(false);
    setSignatureName(signature.name);
    setSignatureContent(signature.contentText || signature.contentHtml.replace(/<br\s*\/?>/gi, '\n'));
    setSignatureLogoUrl(signature.logoUrl || '');
    setSignatureLogoPosition(signature.logoPosition || 'left');
  }

  async function handleUploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type - check both MIME type and extension
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    const isValidType = validImageTypes.includes(file.type) || validExtensions.includes(fileExtension);
    
    if (!isValidType) {
      toast.error('Format de fichier non supporté. Veuillez sélectionner une image (JPEG, PNG, GIF, WebP)');
      // Reset file input
      if (event.target) {
        (event.target as HTMLInputElement).value = '';
      }
      return;
    }

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      toast.error(`Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} MB). Taille maximale: 5 MB`);
      // Reset file input
      if (event.target) {
        (event.target as HTMLInputElement).value = '';
      }
      return;
    }

    // Check if file is empty
    if (file.size === 0) {
      toast.error('Le fichier est vide');
      // Reset file input
      if (event.target) {
        (event.target as HTMLInputElement).value = '';
      }
      return;
    }

    setUploadingLogo(true);
    let progressToast: string | number | undefined;
    
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      // Show progress toast with file info
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      progressToast = toast.loading(`Téléchargement du logo (${fileSizeMB} MB)...`, {
        description: 'Veuillez patienter...'
      });

      // Upload file with proper error handling
      const data = await apiCall('/api/emails/signatures/upload-logo/', {
        method: 'POST',
        body: formData
      });

      // Dismiss progress toast
      if (progressToast) {
        toast.dismiss(progressToast);
      }

      // Validate response
      if (!data || !data.logoUrl) {
        throw new Error('Réponse invalide du serveur');
      }

      // Use proxy URL if available, otherwise use direct URL
      // Proxy URL avoids CORS issues in preview, but we store the direct URL for email sending
      const logoUrlToUse = data.logoProxyUrl || data.logoUrl;
      setSignatureLogoUrl(data.logoUrl); // Store direct URL for email sending
      
      // Show success message
      toast.success('Logo téléchargé avec succès', {
        description: `Fichier: ${data.fileName || file.name}`
      });
      
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      
      // Dismiss progress toast if still showing
      if (progressToast) {
        toast.dismiss(progressToast);
      }
      
      // Determine error message
      let errorMessage = 'Erreur lors du téléchargement du logo';
      
      if (error?.message) {
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMessage = 'Délai d\'attente dépassé. Le fichier est peut-être trop volumineux ou la connexion est lente. Veuillez réessayer.';
        } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet et réessayez.';
        } else {
          errorMessage = error.message;
        }
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast.error('Échec du téléchargement', {
        description: errorMessage
      });
      
    } finally {
      setUploadingLogo(false);
      // Reset file input to allow selecting the same file again if needed
      if (event.target) {
        (event.target as HTMLInputElement).value = '';
      }
    }
  }

  function handleNewSignature() {
    setSelectedSignature(null);
    setIsEditingSignature(false);
    setIsCreatingSignature(true);
    setSignatureName('');
    setSignatureContent('');
    setSignatureLogoUrl('');
    setSignatureLogoPosition('left');
  }

  // Helper function to build signature HTML with logo
  function buildSignatureHtml(signature: EmailSignature): string {
    let signatureHtml = '';
    
    // Check if signature has a logo - use logoUrl (direct URL) for email sending
    const logoUrlToUse = signature.logoUrl && typeof signature.logoUrl === 'string' && signature.logoUrl.trim() !== '' 
      ? signature.logoUrl.trim() 
      : null;
    
    if (logoUrlToUse) {
      // Use direct URL (not proxy URL) for email sending
      const logoUrl = encodeURI(logoUrlToUse);
      const logoImg = `<img src="${logoUrl}" alt="Logo" style="max-width: 200px; max-height: 100px; vertical-align: middle; display: block;" />`;
      const content = signature.contentHtml || signature.contentText.replace(/\n/g, '<br>');
      
      // Build HTML based on logo position
      switch (signature.logoPosition || 'left') {
        case 'top':
          signatureHtml = `<div style="text-align: center; margin-bottom: 10px;">${logoImg}</div><div>${content}</div>`;
          break;
        case 'bottom':
          signatureHtml = `<div>${content}</div><div style="text-align: center; margin-top: 10px;">${logoImg}</div>`;
          break;
        case 'left':
          signatureHtml = `<table cellpadding="0" cellspacing="0" style="border-collapse: collapse;"><tr><td style="vertical-align: top; padding-right: 10px;">${logoImg}</td><td style="vertical-align: top;">${content}</td></tr></table>`;
          break;
        case 'right':
          signatureHtml = `<table cellpadding="0" cellspacing="0" style="border-collapse: collapse;"><tr><td style="vertical-align: top;">${content}</td><td style="vertical-align: top; padding-left: 10px;">${logoImg}</td></tr></table>`;
          break;
      }
    } else {
      signatureHtml = signature.contentHtml || signature.contentText.replace(/\n/g, '<br>');
    }
    
    return signatureHtml;
  }

  function handleInsertSignature(signature: EmailSignature) {
    const signatureHtml = buildSignatureHtml(signature);
    
    // For plain text email, use text version
    const signatureText = signature.contentText || signature.contentHtml.replace(/<br\s*\/?>/gi, '\n');
    
    // Insert signature - update both text and HTML versions
    const separator = composeBody ? '\n\n--\n' : '--\n';
    const newText = composeBody + separator + signatureText;
    setComposeBody(newText);
    
    // Track inserted signature for HTML rebuilding
    setInsertedSignatures(prev => [...prev, signature]);
    
    // Build full HTML: convert current composeBody to HTML, then append signature HTML
    // This ensures composeBodyHtml contains the complete HTML with logo
    const currentBodyHtml = composeBody ? composeBody.replace(/\n/g, '<br>') : '';
    const htmlSeparator = composeBody ? '<br><br>--<br>' : '--<br>';
    const fullHtml = currentBodyHtml + htmlSeparator + signatureHtml;
    setComposeBodyHtml(fullHtml);
  }

  // Helper function to build email HTML preview (same logic as when sending)
  function buildEmailPreviewHtml(): string {
    // Extract the main body text (before any signatures)
    let mainBodyText = composeBody;
    
    // Remove signature text from mainBodyText if signatures were inserted
    if (insertedSignatures.length > 0) {
      const separatorIndex = mainBodyText.indexOf('--\n');
      if (separatorIndex !== -1) {
        mainBodyText = mainBodyText.substring(0, separatorIndex).trim();
      }
    }
    
    // Convert main body to HTML
    let previewHtml = mainBodyText ? mainBodyText.replace(/\n/g, '<br>') : '';
    
    // If signatures were inserted, append signature HTML with logos
    if (insertedSignatures.length > 0) {
      insertedSignatures.forEach((sig, index) => {
        const sigHtml = buildSignatureHtml(sig);
        
        // Append signature HTML to body with separator
        const separator = previewHtml ? '<br><br>--<br>' : '--<br>';
        previewHtml = previewHtml + separator + sigHtml;
      });
    }
    
    return previewHtml;
  }

  async function loadEmails() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (emailType !== 'all') {
        params.append('type', emailType);
      }
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());
      
      const data = await apiCall(`/api/emails/?${params.toString()}`);
      setEmails(data.emails || []);
      setTotalEmails(data.total || 0);
    } catch (error) {
      console.error('Error loading emails:', error);
      toast.error('Erreur lors du chargement des emails');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail() {
    if (!smtpConfig) {
      toast.error('Veuillez configurer SMTP d\'abord');
      setIsConfigOpen(true);
      return;
    }

    if (!composeTo.trim()) {
      toast.error('Le destinataire est requis');
      return;
    }

    setSending(true);
    try {
      const toEmails = composeTo.split(',').map(e => e.trim()).filter(e => e);
      const ccEmails = composeCc ? composeCc.split(',').map(e => e.trim()).filter(e => e) : [];
      const bccEmails = composeBcc ? composeBcc.split(',').map(e => e.trim()).filter(e => e) : [];

      // Build HTML body using the same helper function as preview (ensures consistency)
      const bodyHtml = buildEmailPreviewHtml();
      
      // Debug: log the HTML being sent and verify logos are included
      console.log('=== Email Send Debug ===');
      console.log('Inserted signatures:', insertedSignatures.map(s => ({ 
        name: s.name, 
        logoUrl: s.logoUrl, 
        hasLogo: !!(s.logoUrl && typeof s.logoUrl === 'string' && s.logoUrl.trim() !== ''),
        logoPosition: s.logoPosition
      })));
      console.log('Body HTML length:', bodyHtml.length);
      console.log('Body HTML contains img tag:', bodyHtml.includes('<img'));
      if (bodyHtml.includes('<img')) {
        const imgMatches = bodyHtml.match(/<img[^>]+src="([^"]+)"/g);
        console.log('Image tags found:', imgMatches);
        // Extract and log the actual URLs
        const urlMatches = bodyHtml.match(/<img[^>]+src="([^"]+)"/);
        if (urlMatches) {
          console.log('Logo URL in HTML:', urlMatches[1]);
        }
      } else {
        console.warn('WARNING: No <img> tag found in body HTML!');
      }
      console.log('=== End Debug ===');
      
      await apiCall('/api/emails/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmails,
          ccEmails,
          bccEmails,
          subject: composeSubject,
          bodyText: composeBody,
          bodyHtml: bodyHtml
        })
      });

      toast.success('Email envoyé avec succès');
      setIsComposeOpen(false);
      setComposeTo('');
      setComposeCc('');
      setComposeBcc('');
      setComposeSubject('');
      setComposeBody('');
      setComposeBodyHtml('');
      setInsertedSignatures([]);
      loadEmails();
    } catch (error: any) {
      console.error('Error sending email:', error);
      let errorMessage = 'Erreur lors de l\'envoi de l\'email';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.toString().includes('timeout') || error?.toString().includes('Timeout')) {
        errorMessage = 'Délai d\'attente dépassé. Vérifiez votre connexion réseau et les paramètres SMTP.';
      }
      
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  }

  async function handleFetchEmails() {
    if (!smtpConfig?.imapServer) {
      toast.error('Configuration IMAP requise pour récupérer les emails');
      return;
    }

    try {
      const data = await apiCall('/api/emails/fetch/', {
        method: 'POST'
      });
      toast.success(data.message || 'Emails récupérés avec succès');
      loadEmails();
    } catch (error: any) {
      console.error('Error fetching emails:', error);
      toast.error(error?.message || 'Erreur lors de la récupération des emails');
    }
  }

  async function handleToggleRead(email: Email) {
    try {
      await apiCall(`/api/emails/${email.id}/update/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: !email.isRead })
      });
      loadEmails();
    } catch (error) {
      console.error('Error updating email:', error);
    }
  }

  async function handleToggleStar(email: Email) {
    try {
      await apiCall(`/api/emails/${email.id}/update/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: !email.isStarred })
      });
      loadEmails();
    } catch (error) {
      console.error('Error updating email:', error);
    }
  }

  async function handleDeleteEmail(emailId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet email ?')) return;

    try {
      await apiCall(`/api/emails/${emailId}/delete/`, {
        method: 'DELETE'
      });
      toast.success('Email supprimé');
      loadEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }
    } catch (error) {
      console.error('Error deleting email:', error);
      toast.error('Erreur lors de la suppression');
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Hier';
    } else if (days < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
  }

  const filteredEmails = emails.filter(email => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      email.subject.toLowerCase().includes(search) ||
      email.fromEmail.toLowerCase().includes(search) ||
      email.toEmails.some(e => e.toLowerCase().includes(search)) ||
      (email.bodyText || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="contacts-container">
      <div className="contacts-header page-header">
        <div className="page-title-section">
          <h1 className="page-title">Mails</h1>
          <p className="page-subtitle">Envoyer et recevoir des emails</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsSignatureModalOpen(true)}>
            <FileSignature className="w-4 h-4 mr-2" />
            Signatures
          </Button>
          <Button variant="outline" onClick={() => setIsConfigOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configuration SMTP
          </Button>
          {smtpConfig?.imapServer && (
            <Button variant="outline" onClick={handleFetchEmails}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Récupérer les emails
            </Button>
          )}
          <Button onClick={() => setIsComposeOpen(true)} disabled={!smtpConfig}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau message
          </Button>
        </div>
      </div>

      {!smtpConfig && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="text-center py-4">
              <Mail className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 mb-4">
                Aucune configuration SMTP trouvée. Veuillez configurer votre serveur SMTP pour commencer.
              </p>
              <Button onClick={() => setIsConfigOpen(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Configurer SMTP
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
        {/* Email List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-lg">Boîte de réception</CardTitle>
              </div>
              
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={emailType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEmailType('all')}
                >
                  Tous
                </Button>
                <Button
                  variant={emailType === 'received' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEmailType('received')}
                >
                  <Inbox className="w-4 h-4 mr-1" />
                  Reçus
                </Button>
                <Button
                  variant={emailType === 'sent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEmailType('sent')}
                >
                  <Send className="w-4 h-4 mr-1" />
                  Envoyés
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <LoadingIndicator />
              ) : filteredEmails.length > 0 ? (
                <div className="space-y-2">
                  {filteredEmails.map((email) => (
                    <div
                      key={email.id}
                      className={`p-3 border rounded cursor-pointer hover:bg-slate-50 transition-colors ${
                        selectedEmail?.id === email.id ? 'bg-blue-50 border-blue-300' : ''
                      } ${!email.isRead ? 'font-semibold' : ''}`}
                      onClick={() => setSelectedEmail(email)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {email.isStarred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                            <p className="text-sm font-medium truncate">
                              {email.emailType === 'received' ? email.fromEmail : email.toEmails[0]}
                            </p>
                          </div>
                          <p className="text-xs text-slate-600 truncate mt-1">{email.subject || '(Sans objet)'}</p>
                          <p className="text-xs text-slate-400 mt-1">{formatDate(email.sentAt || email.createdAt)}</p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStar(email);
                            }}
                          >
                            <Star className={`w-3 h-3 ${email.isStarred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEmail(email.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">Aucun email</p>
              )}
            </CardContent>
            
            {/* Pagination */}
            {totalEmails > itemsPerPage && (
              <div className="border-t p-4 mt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, totalEmails)} sur {totalEmails} email(s)
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue>{itemsPerPage}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      
                      <span className="text-sm px-2">
                        Page {currentPage} sur {Math.ceil(totalEmails / itemsPerPage)}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalEmails / itemsPerPage), prev + 1))}
                        disabled={currentPage >= Math.ceil(totalEmails / itemsPerPage)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Email Detail */}
        <div className="col-span-2 w-full">
          {selectedEmail ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{selectedEmail.subject || '(Sans objet)'}</CardTitle>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      <p><span className="font-medium">De:</span> {selectedEmail.fromEmail}</p>
                      <p><span className="font-medium">À:</span> {selectedEmail.toEmails.join(', ')}</p>
                      {selectedEmail.ccEmails && selectedEmail.ccEmails.length > 0 && (
                        <p><span className="font-medium">Cc:</span> {selectedEmail.ccEmails.join(', ')}</p>
                      )}
                      <p><span className="font-medium">Date:</span> {new Date(selectedEmail.sentAt || selectedEmail.createdAt).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStar(selectedEmail)}
                    >
                      <Star className={`w-4 h-4 mr-2 ${selectedEmail.isStarred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                      {selectedEmail.isStarred ? 'Retirer' : 'Marquer'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteEmail(selectedEmail.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: selectedEmail.bodyHtml || selectedEmail.bodyText?.replace(/\n/g, '<br>') || '' 
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <p className="text-slate-500">Sélectionnez un email pour le lire</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposeOpen && (
        <div className="modal-overlay" onClick={() => setIsComposeOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Nouveau message</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsComposeOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="to">À</Label>
                  <Input
                    id="to"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="cc">Cc</Label>
                  <Input
                    id="cc"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder="email@example.com (optionnel)"
                  />
                </div>
                <div>
                  <Label htmlFor="bcc">Cci</Label>
                  <Input
                    id="bcc"
                    value={composeBcc}
                    onChange={(e) => setComposeBcc(e.target.value)}
                    placeholder="email@example.com (optionnel)"
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Objet</Label>
                  <Input
                    id="subject"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Objet de l'email"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="body">Message</Label>
                    {signatures.length > 0 && (
                      <Select
                        value=""
                        onValueChange={(value) => {
                          const signature = signatures.find(s => s.id === value);
                          if (signature) {
                            handleInsertSignature(signature);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Insérer une signature" />
                        </SelectTrigger>
                        <SelectContent>
                          {signatures.map((sig) => (
                            <SelectItem key={sig.id} value={sig.id}>
                              {sig.name} {sig.isDefault && '(Par défaut)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Textarea
                    id="body"
                    value={composeBody}
                    onChange={(e) => {
                      setComposeBody(e.target.value);
                      // When user types, clear composeBodyHtml so it gets rebuilt on send
                      // This ensures signatures are properly included
                      setComposeBodyHtml('');
                    }}
                    placeholder="Votre message..."
                    rows={10}
                  />
                </div>
                
                {/* Email Preview Section */}
                {(composeBody || insertedSignatures.length > 0) && (
                  <div className="border-t pt-4 mt-4">
                    <Label className="text-sm font-semibold mb-2 block">
                      Aperçu de l'email (avec images)
                      {insertedSignatures.some(s => s.logoUrl) && (
                        <span className="ml-2 text-xs font-normal text-blue-600">
                          (Les images peuvent ne pas s'afficher ici à cause de CORS, mais elles apparaîtront dans l'email envoyé)
                        </span>
                      )}
                    </Label>
                    <div 
                      className="border rounded p-4 bg-white min-h-[200px] max-h-[400px] overflow-y-auto"
                      style={{ 
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.5'
                      }}
                      dangerouslySetInnerHTML={{ 
                        __html: buildEmailPreviewHtml() || '<span style="color: #999;">Aucun contenu</span>'
                      }}
                    />
                    <div className="mt-2 space-y-1">
                      {insertedSignatures.length > 0 && (
                        <p className="text-xs text-slate-500">
                          ✓ {insertedSignatures.length} signature(s) incluse(s)
                          {insertedSignatures.some(s => s.logoUrl) && (
                            <span className="ml-1">
                              ({insertedSignatures.filter(s => s.logoUrl).length} avec logo)
                            </span>
                          )}
                        </p>
                      )}
                      {insertedSignatures.some(s => s.logoUrl) && (
                        <div className="text-xs text-slate-400">
                          URLs des logos dans l'email:
                          <ul className="list-disc list-inside ml-2 mt-1">
                            {insertedSignatures
                              .filter(s => s.logoUrl)
                              .map((sig, idx) => (
                                <li key={idx} className="break-all">
                                  {sig.name}: {sig.logoUrl}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-form-actions">
                <Button type="button" variant="outline" onClick={() => setIsComposeOpen(false)}>
                  Annuler
                </Button>
                <Button type="button" onClick={handleSendEmail} disabled={sending}>
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? 'Envoi...' : 'Envoyer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMTP Config Modal */}
      {isConfigOpen && (
        <SMTPConfigModal
          isOpen={isConfigOpen}
          onClose={() => {
            setIsConfigOpen(false);
            loadSMTPConfig();
          }}
          config={smtpConfig}
        />
      )}

      {/* Signature Management Modal */}
      {isSignatureModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSignatureModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h2 className="modal-title">Gestion des signatures</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => {
                  setIsSignatureModalOpen(false);
                  setIsEditingSignature(false);
                  setIsCreatingSignature(false);
                  setSelectedSignature(null);
                  setSignatureName('');
                  setSignatureContent('');
                  setSignatureLogoUrl('');
                  setSignatureLogoPosition('left');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="space-y-4">
                {/* Signature List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-sm font-semibold">Mes signatures</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNewSignature}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvelle signature
                    </Button>
                  </div>
                  
                  {signatures.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-2">
                      {signatures.map((sig) => (
                        <div
                          key={sig.id}
                          className={`p-3 border rounded ${selectedSignature?.id === sig.id ? 'bg-blue-50 border-blue-300' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{sig.name}</span>
                                {sig.isDefault && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    Par défaut
                                  </span>
                                )}
                              </div>
                              <div className="flex items-start gap-2 mt-1">
                                {(sig.logoProxyUrl || sig.logoUrl) && typeof (sig.logoProxyUrl || sig.logoUrl) === 'string' && (sig.logoProxyUrl || sig.logoUrl)!.trim() !== '' ? (
                                  <div className="flex-shrink-0 flex flex-col items-start">
                                    <div className="relative">
                                      <AuthenticatedImage
                                        src={sig.logoProxyUrl || sig.logoUrl || ''}
                                        alt={`Logo`}
                                        className="w-12 h-12 object-contain border rounded bg-white"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.border = '2px solid red';
                                          target.alt = `Erreur: ${sig.logoProxyUrl || sig.logoUrl}`;
                                          console.error('Failed to load logo image:', sig.logoProxyUrl || sig.logoUrl, 'Signature:', sig.name);
                                        }}
                                        onLoad={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.border = '1px solid green';
                                          console.log('Logo loaded successfully:', sig.logoProxyUrl || sig.logoUrl);
                                        }}
                                      />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 break-all max-w-[120px] truncate" title={sig.logoProxyUrl || sig.logoUrl}>
                                      {(sig.logoProxyUrl || sig.logoUrl)!.length > 30 ? (sig.logoProxyUrl || sig.logoUrl)!.substring(0, 30) + '...' : (sig.logoProxyUrl || sig.logoUrl)}
                                    </p>
                                  </div>
                                ) : null}
                                <p className="text-xs text-slate-500 line-clamp-2 flex-1">
                                  {sig.contentText || sig.contentHtml.replace(/<[^>]*>/g, '')}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSignature(sig)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {!sig.isDefault && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetDefaultSignature(sig.id)}
                                  title="Définir par défaut"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSignature(sig.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-4">Aucune signature</p>
                  )}
                </div>

                {/* Signature Editor */}
                {(isEditingSignature || isCreatingSignature || signatures.length === 0) && (
                  <div className="border-t pt-4">
                    <Label className="text-sm font-semibold">
                      {isEditingSignature ? 'Modifier la signature' : 'Nouvelle signature'}
                    </Label>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="signatureName">Nom de la signature</Label>
                        <Input
                          id="signatureName"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          placeholder="Ex: Signature professionnelle"
                        />
                      </div>
                      <div>
                        <Label htmlFor="signatureContent">Contenu de la signature</Label>
                        <Textarea
                          id="signatureContent"
                          value={signatureContent}
                          onChange={(e) => setSignatureContent(e.target.value)}
                          placeholder="Votre signature..."
                          rows={6}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Vous pouvez utiliser du texte simple. Les sauts de ligne seront conservés.
                        </p>
                      </div>

                      {/* Logo Upload Section */}
                      <div className="border-t pt-4">
                        <Label className="text-sm font-semibold mb-2 block">Logo (optionnel)</Label>
                        <div className="space-y-4">
                          {signatureLogoUrl && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-4 p-3 border rounded bg-slate-50">
                                <AuthenticatedImage
                                  src={signatureLogoUrl}
                                  alt={`Logo`}
                                  className="max-w-[150px] max-h-[80px] object-contain border rounded"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.border = '2px solid red';
                                    console.error('Failed to load logo preview:', signatureLogoUrl);
                                  }}
                                  onLoad={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.border = '1px solid green';
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSignatureLogoUrl('')}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="text-xs text-slate-500 break-all p-2 bg-slate-100 rounded">
                                <strong>URL du logo:</strong> {signatureLogoUrl}
                              </div>
                            </div>
                          )}
                          <div>
                            <input
                              id="logoUpload"
                              type="file"
                              accept="image/*"
                              onChange={handleUploadLogo}
                              className="hidden"
                              disabled={uploadingLogo}
                            />
                            <Label htmlFor="logoUpload" className="cursor-pointer">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={uploadingLogo}
                                onClick={(e) => {
                                  e.preventDefault();
                                  const input = document.getElementById('logoUpload') as HTMLInputElement;
                                  if (input && !uploadingLogo) {
                                    input.click();
                                  }
                                }}
                              >
                                {uploadingLogo ? 'Téléchargement...' : signatureLogoUrl ? 'Remplacer le logo' : 'Télécharger un logo'}
                              </Button>
                            </Label>
                            <p className="text-xs text-slate-500 mt-1">
                              Formats acceptés: JPEG, PNG, GIF, WebP (max 5MB)
                            </p>
                          </div>
                          
                          {signatureLogoUrl && (
                            <div>
                              <Label htmlFor="logoPosition">Position du logo</Label>
                              <Select
                                value={signatureLogoPosition}
                                onValueChange={(value: 'top' | 'bottom' | 'left' | 'right') => setSignatureLogoPosition(value)}
                              >
                                <SelectTrigger id="logoPosition">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="top">En haut</SelectItem>
                                  <SelectItem value="bottom">En bas</SelectItem>
                                  <SelectItem value="left">À gauche</SelectItem>
                                  <SelectItem value="right">À droite</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSaveSignature}
                          disabled={!signatureName.trim()}
                        >
                          {isEditingSignature ? 'Enregistrer' : 'Créer'}
                        </Button>
                        {isEditingSignature && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditingSignature(false);
                              setIsCreatingSignature(false);
                              setSelectedSignature(null);
                              setSignatureName('');
                              setSignatureContent('');
                              setSignatureLogoUrl('');
                              setSignatureLogoPosition('left');
                            }}
                          >
                            Annuler
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsSignatureModalOpen(false);
                    setIsEditingSignature(false);
                    setIsCreatingSignature(false);
                    setSelectedSignature(null);
                    setSignatureName('');
                    setSignatureContent('');
                    setSignatureLogoUrl('');
                    setSignatureLogoPosition('left');
                  }}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SMTP Configuration Component
interface SMTPConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SMTPConfig | null;
}

function SMTPConfigModal({ isOpen, onClose, config }: SMTPConfigModalProps) {
  const [smtpServer, setSmtpServer] = useState(config?.smtpServer || '');
  const [smtpPort, setSmtpPort] = useState(config?.smtpPort?.toString() || '587');
  const [smtpUseTls, setSmtpUseTls] = useState(config?.smtpUseTls ?? true);
  const [smtpUsername, setSmtpUsername] = useState(config?.smtpUsername || '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [emailAddress, setEmailAddress] = useState(config?.emailAddress || '');
  const [imapServer, setImapServer] = useState(config?.imapServer || '');
  const [imapPort, setImapPort] = useState(config?.imapPort?.toString() || '993');
  const [imapUseSsl, setImapUseSsl] = useState(config?.imapUseSsl ?? true);
  const [isActive, setIsActive] = useState(config?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (config) {
      setSmtpServer(config.smtpServer);
      setSmtpPort(config.smtpPort.toString());
      setSmtpUseTls(config.smtpUseTls);
      setSmtpUsername(config.smtpUsername);
      setEmailAddress(config.emailAddress);
      setImapServer(config.imapServer || '');
      setImapPort((config.imapPort || 993).toString());
      setImapUseSsl(config.imapUseSsl ?? true);
      setIsActive(config.isActive);
    }
  }, [config]);

  async function handleSave() {
    if (!smtpServer || !smtpUsername || !emailAddress) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setSaving(true);
    try {
      const method = config ? 'PUT' : 'POST';
      const body: any = {
        emailAddress,
        smtpServer,
        smtpPort: parseInt(smtpPort),
        smtpUseTls,
        smtpUsername,
        imapServer,
        imapPort: imapPort ? parseInt(imapPort) : 993,
        imapUseSsl,
        isActive
      };

      if (smtpPassword) {
        body.smtpPassword = smtpPassword;
      }

      await apiCall('/api/emails/smtp-config/', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      toast.success('Configuration SMTP enregistrée');
      onClose();
    } catch (error: any) {
      console.error('Error saving SMTP config:', error);
      toast.error(error?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      // First save the config
      await handleSave();
      
      // Then test
      const data = await apiCall('/api/emails/test-connection/', {
        method: 'POST'
      });
      
      if (data.success) {
        toast.success('Connexion SMTP réussie');
      } else {
        toast.error(data.error || 'Échec de la connexion');
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      toast.error(error?.message || 'Erreur lors du test de connexion');
    } finally {
      setTesting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <h2 className="modal-title">Configuration SMTP</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="modal-close"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="modal-form">
          <div className="space-y-4">
            <div>
              <Label htmlFor="emailAddress">Adresse email</Label>
              <Input
                id="emailAddress"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="votre@email.com"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtpServer">Serveur SMTP</Label>
                <Input
                  id="smtpServer"
                  value={smtpServer}
                  onChange={(e) => setSmtpServer(e.target.value)}
                  placeholder="smtp.example.com"
                />
              </div>
              <div>
                <Label htmlFor="smtpPort">Port SMTP</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => {
                    const port = e.target.value;
                    setSmtpPort(port);
                    // Port 465 uses SSL from start, so disable TLS checkbox
                    if (port === '465') {
                      setSmtpUseTls(false);
                    }
                  }}
                  placeholder="587"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Port 465 = SSL/TLS direct | Port 587 = STARTTLS
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="smtpUsername">Nom d'utilisateur SMTP</Label>
              <Input
                id="smtpUsername"
                value={smtpUsername}
                onChange={(e) => setSmtpUsername(e.target.value)}
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <Label htmlFor="smtpPassword">Mot de passe SMTP</Label>
              <Input
                id="smtpPassword"
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={config ? 'Laisser vide pour ne pas modifier' : 'Votre mot de passe'}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="smtpUseTls"
                checked={smtpUseTls}
                onChange={(e) => setSmtpUseTls(e.target.checked)}
                disabled={smtpPort === '465'}
                className="w-4 h-4"
              />
              <Label htmlFor="smtpUseTls" className={`cursor-pointer ${smtpPort === '465' ? 'text-slate-400' : ''}`}>
                Utiliser STARTTLS {smtpPort === '465' && '(désactivé pour le port 465)'}
              </Label>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Configuration IMAP (optionnel - pour recevoir les emails)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="imapServer">Serveur IMAP</Label>
                  <Input
                    id="imapServer"
                    value={imapServer}
                    onChange={(e) => setImapServer(e.target.value)}
                    placeholder="imap.example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="imapPort">Port IMAP</Label>
                  <Input
                    id="imapPort"
                    type="number"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    placeholder="993"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="imapUseSsl"
                  checked={imapUseSsl}
                  onChange={(e) => setImapUseSsl(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="imapUseSsl" className="cursor-pointer">Utiliser SSL</Label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="isActive" className="cursor-pointer">Configuration active</Label>
            </div>
          </div>

          <div className="modal-form-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="button" variant="outline" onClick={handleTestConnection} disabled={testing || saving}>
              {testing ? 'Test...' : 'Tester la connexion'}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || testing}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Mails;

