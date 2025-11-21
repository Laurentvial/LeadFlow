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
  
  const statusEditPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const editPerms = currentUser.permissions
      .filter((p: any) => p.component === 'fosse' && p.action === 'edit' && p.statusId)
      .map((p: any) => String(p.statusId).trim());
    return new Set(editPerms);
  }, [currentUser?.permissions]);
  
  const statusViewPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const viewPerms = currentUser.permissions
      .filter((p: any) => p.component === 'fosse' && p.action === 'view' && p.statusId)
      .map((p: any) => {
        const statusId = p.statusId;
        if (!statusId) return null;
        return String(statusId).trim();
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
  
  const canViewContact = React.useCallback((contact: any): boolean => {
    // Fosse page: No permission filtering - show all unassigned contacts
    return true;
  }, []);
  
  const canEditContact = React.useCallback((contact: any, statusIdOverride?: string | null): boolean => {
    // Fosse page: No permission filtering - allow editing all unassigned contacts
    return true;
  }, []);
  
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
