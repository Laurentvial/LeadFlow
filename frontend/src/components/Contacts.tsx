import React from 'react';
import { ContactList } from './ContactList';
import { useHasPermission } from '../hooks/usePermissions';
import { useUser } from '../contexts/UserContext';

interface ContactsProps {
  onSelectContact: (contactId: string) => void;
}

export function Contacts({ onSelectContact }: ContactsProps) {
  // Permission checks
  const canCreate = useHasPermission('contacts', 'create');
  const canEditGeneral = useHasPermission('contacts', 'edit');
  const canViewGeneral = useHasPermission('contacts', 'view');
  const canDelete = useHasPermission('contacts', 'delete');
  
  // Get all status permissions
  const { currentUser } = useUser();
  
  const statusEditPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const editPerms = currentUser.permissions
      .filter((p: any) => p.component === 'statuses' && p.action === 'edit' && p.statusId)
      .map((p: any) => String(p.statusId).trim());
    return new Set(editPerms);
  }, [currentUser?.permissions]);
  
  const statusViewPermissions = React.useMemo(() => {
    if (!currentUser?.permissions || !Array.isArray(currentUser.permissions)) {
      return new Set<string>();
    }
    const viewPerms = currentUser.permissions
      .filter((p: any) => p.component === 'statuses' && p.action === 'view' && p.statusId)
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
    if (!normalizedStatusId) {
      return canViewGeneral;
    }
    if (!canViewGeneral) {
      return false;
    }
    const canViewStatus = statusViewPermissions.has(normalizedStatusId);
    return canViewStatus;
  }, [canViewGeneral, statusViewPermissions, isTeleoperatorForContact, isConfirmateurForContact]);
  
  const canEditContact = React.useCallback((contact: any, statusIdOverride?: string | null): boolean => {
    const contactStatusId = statusIdOverride !== undefined ? statusIdOverride : contact?.statusId;
    const normalizedStatusId = contactStatusId ? String(contactStatusId).trim() : null;
    if (!normalizedStatusId) {
      return canEditGeneral;
    }
    if (!canEditGeneral) {
      return false;
    }
    const canEditStatus = statusEditPermissions.has(normalizedStatusId);
    return canEditStatus;
  }, [canEditGeneral, statusEditPermissions]);

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
      canEditGeneral={canEditGeneral}
      canViewGeneral={canViewGeneral}
    />
  );
}

export default Contacts;
