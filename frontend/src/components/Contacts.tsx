import React from 'react';
import ContactList from './ContactList';
import { useHasPermission } from '../hooks/usePermissions';
import { useUser } from '../contexts/UserContext';

interface ContactsProps {
  onSelectContact: (contactId: string) => void;
}

export function Contacts({ onSelectContact }: ContactsProps) {
  // Get all status permissions
  const { currentUser } = useUser();
  
  // Check if user has permission to edit informations tab (replaces old contacts edit permission)
  const canEditInformationsTab = React.useMemo(() => {
    if (!currentUser?.permissions) return false;
    const hasTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'edit' && 
      p.fieldName === 'informations' &&
      !p.statusId
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasTabPermission;
  }, [currentUser?.permissions]);

  // Check if user has permission to view any contact tab (replaces old contacts view permission)
  const canViewAnyContactTab = React.useMemo(() => {
    if (!currentUser?.permissions) return true; // Default to true if no permissions loaded
    const hasAnyTabPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs' && 
      p.action === 'view'
    );
    // If no contact_tabs permissions exist at all, default to true (backward compatibility)
    const hasAnyContactTabsPermission = currentUser.permissions.some((p: any) => 
      p.component === 'contact_tabs'
    );
    if (!hasAnyContactTabsPermission) return true;
    return hasAnyTabPermission;
  }, [currentUser?.permissions]);
  
  // Check if user has permission to create contacts (for checkbox column visibility)
  const canCreate = useHasPermission('contacts', 'create');
  const canDelete = false;
  
  const statusEditPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const editPerms = currentUser.permissions
      .filter((p: any) => {
        // Check for status-specific edit permissions
        // These have component='statuses', action='edit', and a statusId
        return p.component === 'statuses' && 
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
        // Check for status-specific view permissions
        // These have component='statuses', action='view', and a statusId
        return p.component === 'statuses' && 
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
  
  const isTeleoperatorForContact = React.useCallback((contact: any): boolean => {
    if (!currentUser?.id || !contact?.teleoperatorId) {
      return false;
    }
    const userId = String(currentUser.id).trim();
    const teleoperatorId = String(contact.teleoperatorId).trim();
    return userId === teleoperatorId;
  }, [currentUser?.id]);
  
  const isConfirmateurForContact = React.useCallback((contact: any): boolean => {
    if (!currentUser?.id || !contact?.confirmateurId) {
      return false;
    }
    const userId = String(currentUser.id).trim();
    const confirmateurId = String(contact.confirmateurId).trim();
    return userId === confirmateurId;
  }, [currentUser?.id]);
  
  const canViewContact = React.useCallback((contact: any): boolean => {
    if (isTeleoperatorForContact(contact)) {
      return true;
    }
    if (isConfirmateurForContact(contact)) {
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
    // Check if user has view permission on the contact's status
    if (normalizedStatusId) {
      const canViewStatus = statusViewPermissions.has(normalizedStatusId);
      return canViewStatus;
    }
    // If contact has no status, check if user can view any contact tab
    return canViewAnyContactTab;
  }, [canViewAnyContactTab, statusViewPermissions, isTeleoperatorForContact, isConfirmateurForContact]);
  
  const canEditContact = React.useCallback((contact: any, statusIdOverride?: string | null): boolean => {
    // First check: user must have permission to edit informations tab
    if (!canEditInformationsTab) {
      return false;
    }
    
    const contactStatusId = statusIdOverride !== undefined ? statusIdOverride : contact?.statusId;
    const normalizedStatusId = contactStatusId ? String(contactStatusId).trim() : null;
    
    // If contact has no status, only need tab permission (already checked above)
    if (!normalizedStatusId) {
      return true;
    }
    
    // If contact has a status, user MUST have status-specific edit permission
    const canEditStatus = statusEditPermissions.has(normalizedStatusId);
    return canEditStatus;
  }, [canEditInformationsTab, statusEditPermissions]);

  return (
    <ContactList
      onSelectContact={onSelectContact}
      apiEndpoint="/api/contacts/"
      pageTitle="Contacts"
      pageSubtitle="Gestion de vos contacts"
      showCreateButton={true}
      showImportButton={true}
      createButtonPath="/contacts/add"
      importButtonPath="/contacts/import"
      canViewContact={canViewContact}
      canEditContact={canEditContact}
      isTeleoperatorForContact={isTeleoperatorForContact}
      statusViewPermissions={statusViewPermissions}
      statusEditPermissions={statusEditPermissions}
      canCreate={canCreate}
      canDelete={canDelete}
      canEditGeneral={canEditInformationsTab}
      canViewGeneral={canViewAnyContactTab}
    />
  );
}

export default Contacts;
