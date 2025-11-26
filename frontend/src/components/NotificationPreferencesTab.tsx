import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';
import LoadingIndicator from './LoadingIndicator';
import { useRoles } from '../hooks/useRoles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

interface NotificationPreference {
  id: string;
  roleId: string;
  roleName: string;
  notifyMessageReceived: boolean;
  notifySensitiveContactModification: boolean;
  notifyContactEdit: boolean;
  createdAt: string;
  updatedAt: string;
}

export function NotificationPreferencesTab() {
  const { roles, loading: rolesLoading } = useRoles();
  const [preferences, setPreferences] = useState<Map<string, NotificationPreference>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Map<string, boolean>>(new Map());

  // Load notification preferences
  const loadPreferences = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/notification-preferences/');
      const prefsMap = new Map<string, NotificationPreference>();
      
      (data.preferences || []).forEach((pref: NotificationPreference) => {
        prefsMap.set(pref.roleId, pref);
      });
      
      setPreferences(prefsMap);
    } catch (error: any) {
      console.error('Error loading notification preferences:', error);
      toast.error('Erreur lors du chargement des préférences de notification');
    } finally {
      setLoading(false);
    }
  };

  // Load preference for a specific role (create if doesn't exist)
  const loadPreferenceForRole = async (roleId: string) => {
    try {
      const data = await apiCall(`/api/notification-preferences/${roleId}/`);
      const pref: NotificationPreference = data;
      setPreferences(prev => {
        const newMap = new Map(prev);
        newMap.set(roleId, pref);
        return newMap;
      });
      return pref;
    } catch (error: any) {
      console.error('Error loading preference for role:', error);
      // If preference doesn't exist, create default one
      const defaultPref: NotificationPreference = {
        id: '',
        roleId,
        roleName: roles.find(r => r.id === roleId)?.name || '',
        notifyMessageReceived: true,
        notifySensitiveContactModification: true,
        notifyContactEdit: true,
        createdAt: '',
        updatedAt: '',
      };
      setPreferences(prev => {
        const newMap = new Map(prev);
        newMap.set(roleId, defaultPref);
        return newMap;
      });
      return defaultPref;
    }
  };

  // Update preference
  const updatePreference = async (roleId: string, field: 'notifyMessageReceived' | 'notifySensitiveContactModification' | 'notifyContactEdit', value: boolean) => {
    const savingKey = `${roleId}-${field}`;
    try {
      setSaving(prev => {
        const newMap = new Map(prev);
        newMap.set(savingKey, true);
        return newMap;
      });

      // Update local state immediately for better UX
      setPreferences(prev => {
        const newMap = new Map(prev);
        const pref = newMap.get(roleId);
        if (pref) {
          newMap.set(roleId, { ...pref, [field]: value });
        }
        return newMap;
      });

      await apiCall(`/api/notification-preferences/${roleId}/update/`, {
        method: 'PUT',
        body: JSON.stringify({
          [field]: value,
        }),
      });

      toast.success('Préférence mise à jour avec succès');
      
      // Reload to get updated data
      await loadPreferenceForRole(roleId);
    } catch (error: any) {
      console.error('Error updating preference:', error);
      toast.error('Erreur lors de la mise à jour de la préférence');
      
      // Reload to revert changes
      await loadPreferenceForRole(roleId);
    } finally {
      setSaving(prev => {
        const newMap = new Map(prev);
        newMap.set(savingKey, false);
        return newMap;
      });
    }
  };

  useEffect(() => {
    if (!rolesLoading && roles.length > 0) {
      loadPreferences();
    }
  }, [rolesLoading, roles.length]);

  if (loading || rolesLoading) {
    return <LoadingIndicator />;
  }

  // Define notification preference types
  const notificationTypes = [
    {
      id: 'notifyMessageReceived',
      label: 'Notification de message reçu',
      description: 'Les utilisateurs recevront une notification lorsqu\'ils reçoivent un nouveau message.',
      field: 'notifyMessageReceived' as const,
    },
    {
      id: 'notifySensitiveContactModification',
      label: 'Notification de modification sensible d\'un contact',
      description: 'Les utilisateurs recevront une notification lorsqu\'une modification sensible est effectuée sur un contact (ex: changement de statut, modification de coordonnées importantes).',
      field: 'notifySensitiveContactModification' as const,
    },
    {
      id: 'notifyContactEdit',
      label: 'Notification de modification de contact',
      description: 'Les utilisateurs recevront une notification lorsqu\'une modification est effectuée sur un contact concernant le numéro de téléphone, le mobile ou l\'email.',
      field: 'notifyContactEdit' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Préférences de notification par rôle</CardTitle>
          <p className="text-sm text-slate-500 mt-2">
            Configurez les préférences de notification pour chaque rôle. Ces paramètres déterminent quelles notifications seront envoyées aux utilisateurs selon leur rôle.
          </p>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Aucun rôle disponible. Créez d'abord des rôles dans l'onglet Permissions.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Préférence de notification</TableHead>
                    {roles.map((role) => (
                      <TableHead key={role.id} className="text-center min-w-[200px]">
                        {role.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificationTypes.map((notificationType) => (
                    <TableRow key={notificationType.id}>
                      <TableCell className="w-[200px]">
                        <div className="space-y-1">
                          <div className="font-medium">{notificationType.label}</div>
                          <div className="text-sm text-slate-500">{notificationType.description}</div>
                        </div>
                      </TableCell>
                      {roles.map((role) => {
                        const preference = preferences.get(role.id);
                        const savingKey = `${role.id}-${notificationType.field}`;
                        const isSaving = saving.get(savingKey) || false;
                        const isChecked = preference?.[notificationType.field] ?? true;

                        return (
                          <TableCell key={role.id} className="text-center align-middle">
                            <div className="flex justify-center items-center gap-2 min-h-[44px]">
                              <Switch
                                checked={isChecked}
                                disabled={isSaving || !preference}
                                onCheckedChange={(checked) => {
                                  if (preference) {
                                    updatePreference(role.id, notificationType.field, checked);
                                  } else {
                                    // Load preference first if it doesn't exist
                                    loadPreferenceForRole(role.id).then(() => {
                                      updatePreference(role.id, notificationType.field, checked);
                                    });
                                  }
                                }}
                              />
                              {isSaving && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500"></div>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default NotificationPreferencesTab;

