import React from 'react';
import { ContactList } from './ContactList';
import { useHasPermission } from '../hooks/usePermissions';
import { useUser } from '../contexts/UserContext';

interface FosseProps {
  onSelectContact: (contactId: string) => void;
}

export function Fosse({ onSelectContact }: FosseProps) {
  // Permission checks
  const canCreate = useHasPermission('fosse', 'create');
  const canEditGeneral = useHasPermission('fosse', 'edit');
  const canViewGeneral = useHasPermission('fosse', 'view');
  const canDelete = useHasPermission('fosse', 'delete');
  
  // Get all status permissions
  const { currentUser } = useUser();
  
  // Fosse-specific status permissions - use fosse_statuses component (separate from regular statuses)
  const statusEditPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const editPerms = currentUser.permissions
      .filter((p: any) => {
        // Check for fosse-specific status edit permissions
        // These have component='fosse_statuses', action='edit', and a statusId
        return p.component === 'fosse_statuses' && 
               p.action === 'edit' && 
               p.statusId !== null && 
               p.statusId !== undefined && 
               p.statusId !== '';
      })
      .map((p: any) => {
        const statusId = p.statusId;
        if (!statusId) return null;
        // Normalize statusId to string and trim whitespace
        const normalizedId = String(statusId).trim();
        return normalizedId !== '' ? normalizedId : null;
      })
      .filter((id): id is string => id !== null && id !== '');
    return new Set(editPerms);
  }, [currentUser?.permissions]);
  
  const statusViewPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const viewPerms = currentUser.permissions
      .filter((p: any) => {
        // Check for fosse-specific status view permissions
        // These have component='fosse_statuses', action='view', and a statusId
        return p.component === 'fosse_statuses' && 
               p.action === 'view' && 
               p.statusId !== null && 
               p.statusId !== undefined && 
               p.statusId !== '';
      })
      .map((p: any) => {
        const statusId = p.statusId;
        if (!statusId) return null;
        // Normalize statusId to string and trim whitespace
        const normalizedId = String(statusId).trim();
        return normalizedId !== '' ? normalizedId : null;
      })
      .filter((id): id is string => id !== null && id !== '');
    return new Set(viewPerms);
  }, [currentUser?.permissions]);

  const statusCreatePermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const createPerms = currentUser.permissions
      .filter((p: any) => {
        return p.component === 'fosse_statuses' && 
               p.action === 'create' && 
               p.statusId !== null && 
               p.statusId !== undefined && 
               p.statusId !== '';
      })
      .map((p: any) => {
        const statusId = p.statusId;
        if (!statusId) return null;
        const normalizedId = String(statusId).trim();
        return normalizedId !== '' ? normalizedId : null;
      })
      .filter((id): id is string => id !== null && id !== '');
    return new Set(createPerms);
  }, [currentUser?.permissions]);

  const statusDeletePermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const deletePerms = currentUser.permissions
      .filter((p: any) => {
        return p.component === 'fosse_statuses' && 
               p.action === 'delete' && 
               p.statusId !== null && 
               p.statusId !== undefined && 
               p.statusId !== '';
      })
      .map((p: any) => {
        const statusId = p.statusId;
        if (!statusId) return null;
        const normalizedId = String(statusId).trim();
        return normalizedId !== '' ? normalizedId : null;
      })
      .filter((id): id is string => id !== null && id !== '');
    return new Set(deletePerms);
  }, [currentUser?.permissions]);
  
  const isTeleoperatorForContact = React.useCallback((contact: any): boolean => {
    if (!currentUser?.id || !contact?.teleoperatorId) {
      return false;
    }
    const userId = String(currentUser.id).trim();
    const teleoperatorId = String(contact.teleoperatorId).trim();
    return userId === teleoperatorId;
  }, [currentUser?.id]);
  
  const canViewContact = React.useCallback((contact: any): boolean => {
    // If user has general fosse view permission, allow viewing all contacts
    // This matches backend behavior: "No permission filtering - shows all unassigned contacts to authenticated users"
    if (canViewGeneral) {
      return true;
    }
    
    if (isTeleoperatorForContact(contact)) {
      return true;
    }
    const contactStatusId = contact?.statusId;
    let normalizedStatusId: string | null = null;
    if (contactStatusId !== null && contactStatusId !== undefined && contactStatusId !== '') {
      const str = String(contactStatusId).trim();
      if (str !== '') {
        normalizedStatusId = str;
      }
    }
    // Check if user has view permission on the contact's status (fosse-specific)
    // This is a fallback if general fosse view permission is not granted
    if (normalizedStatusId) {
      const canViewStatus = statusViewPermissions.has(normalizedStatusId);
      return canViewStatus;
    }
    // If contact has no status, allow viewing (backward compatibility)
    return true;
  }, [canViewGeneral, statusViewPermissions, isTeleoperatorForContact]);
  
  const canEditContact = React.useCallback((contact: any, statusIdOverride?: string | null): boolean => {
    if (!canEditGeneral) {
      return false;
    }
    
    const contactStatusId = statusIdOverride !== undefined ? statusIdOverride : contact?.statusId;
    const normalizedStatusId = contactStatusId ? String(contactStatusId).trim() : null;
    
    // If contact has no status, only need general fosse edit permission
    if (!normalizedStatusId) {
      return true;
    }
    
    // If contact has a status, user MUST have fosse-specific status edit permission
    const canEditStatus = statusEditPermissions.has(normalizedStatusId);
    return canEditStatus;
  }, [canEditGeneral, statusEditPermissions]);
  
  const getStatusDisplayText = React.useCallback((contact: any): string => {
    return contact.statusName || '-'; // Show actual status name
  }, []);

  return (
    <ContactList
      onSelectContact={onSelectContact}
      apiEndpoint="/api/contacts/fosse/"
      pageTitle="Fosse"
      pageSubtitle="Contacts non assignés"
      showCreateButton={false}
      showImportButton={false}
      canViewContact={canViewContact}
      canEditContact={canEditContact}
      getStatusDisplayText={getStatusDisplayText}
      isTeleoperatorForContact={isTeleoperatorForContact}
      statusViewPermissions={statusViewPermissions}
      statusEditPermissions={statusEditPermissions}
      canCreate={canCreate}
      canDelete={canDelete}
      canEditGeneral={canEditGeneral}
      canViewGeneral={canViewGeneral}
    />
  );
}

export default Fosse;
