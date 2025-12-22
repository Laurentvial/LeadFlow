/**
 * Mapping of old CRM user IDs to their email addresses and user names
 * Used for facilitating log migration and user mapping
 */
export interface OldCrmUser {
  id_crmuser: number;
  email: string;
  user_name: string;
}

export const OLD_CRM_USER_MAPPING: OldCrmUser[] = [
  { id_crmuser: 1, email: 'admindevlp4@gestioncrm.com', user_name: 'Admin DEV' },
  { id_crmuser: 2, email: 'ksk@ksk.com', user_name: 'ADMIN KSK' },
  { id_crmuser: 6, email: 'blanc@blanc.com', user_name: 'ADMIN BLANC' },
  { id_crmuser: 7, email: 'jade@jade.com', user_name: 'ADMIN JADE' },
  { id_crmuser: 8, email: 'mass@mass.com', user_name: 'ADMIN MASS' },
  { id_crmuser: 4, email: 'menard@crm.com', user_name: 'MENARD' },
  { id_crmuser: 48, email: 'antoine@crm.com', user_name: 'Antoine' },
  { id_crmuser: 5, email: 'bleu@bleu.com', user_name: 'ADMIN BLEU' },
  { id_crmuser: 9, email: 'mikotelepro@ss.com', user_name: 'mikotelepro' },
  { id_crmuser: 28, email: 'pavytelepro@crm.com', user_name: 'PAVY' },
  { id_crmuser: 10, email: 'beaumont@crm.com', user_name: 'BEAUMONT' },
  { id_crmuser: 11, email: 'jacquet@crm.com', user_name: 'JACQUET' },
  { id_crmuser: 12, email: 'moreau@crm.com', user_name: 'MOREAU' },
  { id_crmuser: 13, email: 'legof@crm.com', user_name: 'LEGOF' },
  { id_crmuser: 14, email: 'laurence@crm.com', user_name: 'LAURENCE' },
  { id_crmuser: 40, email: 'anciensclients@crm.com', user_name: 'ANCIENS CLIENTS ' },
  { id_crmuser: 15, email: 'rossi@crm.com', user_name: 'ROSSI' },
  { id_crmuser: 16, email: 'levasseur@crm.com', user_name: 'LEVASSEUR' },
  { id_crmuser: 17, email: 'faure@crm.com', user_name: 'FAURE' },
  { id_crmuser: 56, email: 'lucas@crm.com', user_name: 'LUCAS' },
  { id_crmuser: 18, email: 'deville@crm.com', user_name: 'DEVILLE' },
  { id_crmuser: 19, email: 'barca@crm.com', user_name: 'BARCA' },
  { id_crmuser: 20, email: 'valerie@crm.com', user_name: 'VALERIE' },
  { id_crmuser: 21, email: 'perolie@crm.com', user_name: 'PEROLIE' },
  { id_crmuser: 22, email: 'lepik@crm.com', user_name: 'LEPIK' },
  { id_crmuser: 24, email: 'berry@crm.com', user_name: 'BERRY' },
  { id_crmuser: 32, email: 'lepikconf@crm.com', user_name: 'LEPIK CONF' },
  { id_crmuser: 29, email: 'reatribution@crm.com', user_name: 'REATRIBUTION' },
  { id_crmuser: 34, email: 'berryconf@crm.com', user_name: 'BERRY CONF' },
  { id_crmuser: 35, email: 'santiconf@crm.com', user_name: 'SANTI CONF' },
  { id_crmuser: 36, email: 'pavyconf@crm.com', user_name: 'PAVY CONF' },
  { id_crmuser: 42, email: 'guillemain@crm.com', user_name: 'GUILLEMAIN' },
  { id_crmuser: 39, email: 'didier@crm.com', user_name: 'DIDIER' },
  { id_crmuser: 38, email: 'menardconf@crm.com', user_name: 'MENARD CONF' },
  { id_crmuser: 33, email: 'rebecca@crm.com', user_name: 'REBECCA' },
  { id_crmuser: 30, email: 'mikoconf@ss.com', user_name: 'test miko conf' },
  { id_crmuser: 37, email: 'santi@crm.com', user_name: 'SANTI' },
  { id_crmuser: 50, email: 'didierconf@crm.com', user_name: 'DIDIER CONF' },
  { id_crmuser: 41, email: 'commandeur@crm.com', user_name: 'COMMANDEUR' },
  { id_crmuser: 43, email: 'testctc@crm.com', user_name: 'TESTCTC' },
  { id_crmuser: 49, email: 'philippe@crm.com', user_name: 'Philippe' },
  { id_crmuser: 44, email: 'faureconf@crm.com', user_name: 'FAURE CONF' },
  { id_crmuser: 47, email: 'vini@crm.com', user_name: 'VINI' },
  { id_crmuser: 46, email: 'guillemainconf@crm.com', user_name: 'GUILLEMAIN CONF' },
  { id_crmuser: 54, email: 'delcourt@crm.com', user_name: 'DELCOURT' },
  { id_crmuser: 51, email: 'beguin@crm.com', user_name: 'BEGUIN' },
  { id_crmuser: 55, email: 'audrey@crm.com', user_name: 'AUDREY' },
  { id_crmuser: 52, email: 'lessec@crm.com', user_name: 'LESSEC' },
  { id_crmuser: 53, email: 'test@test.test', user_name: 'test123' },
];

/**
 * Find a new database user by matching old CRM user ID
 * First tries to match by email (case-insensitive), then by username
 * @param oldCrmUserId - The old CRM user ID (number or string)
 * @param newUsers - Array of new database users
 * @returns The matched user ID from new database, or null if not found
 */
export function findNewUserByOldCrmId(
  oldCrmUserId: number | string,
  newUsers: Array<{ id: string | number; email?: string; username?: string; firstName?: string; lastName?: string }>
): string | null {
  // Find the old CRM user mapping
  const oldCrmUser = OLD_CRM_USER_MAPPING.find(
    u => u.id_crmuser === Number(oldCrmUserId)
  );

  if (!oldCrmUser) {
    return null;
  }

  // Try to match by email first (case-insensitive)
  const emailMatch = newUsers.find(user => {
    if (!user.email) return false;
    return user.email.toLowerCase().trim() === oldCrmUser.email.toLowerCase().trim();
  });

  if (emailMatch) {
    return String(emailMatch.id);
  }

  // Try to match by username (case-insensitive)
  const usernameMatch = newUsers.find(user => {
    if (!user.username) return false;
    return user.username.toLowerCase().trim() === oldCrmUser.user_name.toLowerCase().trim();
  });

  if (usernameMatch) {
    return String(usernameMatch.id);
  }

  // Try to match by first name + last name combination
  const nameMatch = newUsers.find(user => {
    if (!user.firstName || !user.lastName) return false;
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase().trim();
    return fullName === oldCrmUser.user_name.toLowerCase().trim();
  });

  if (nameMatch) {
    return String(nameMatch.id);
  }

  return null;
}

/**
 * Auto-populate user ID mapping based on old CRM user IDs found in CSV
 * @param csvData - Array of CSV row objects
 * @param userIdColumn - The CSV column name containing user IDs
 * @param newUsers - Array of new database users
 * @returns Object mapping old CRM user IDs (as strings) to new user IDs
 */
export function autoPopulateUserMapping(
  csvData: any[],
  userIdColumn: string,
  newUsers: Array<{ id: string | number; email?: string; username?: string; firstName?: string; lastName?: string }>
): { [oldUserId: string]: string } {
  const mapping: { [oldUserId: string]: string } = {};

  if (!userIdColumn || !csvData || csvData.length === 0) {
    return mapping;
  }

  // Get unique user IDs from CSV
  const uniqueOldUserIds = Array.from(
    new Set(
      csvData
        .map(row => {
          const value = row[userIdColumn];
          if (value === null || value === undefined || value === '') {
            return null;
          }
          // Try to extract numeric ID
          const numValue = Number(value);
          return isNaN(numValue) ? null : numValue;
        })
        .filter((id): id is number => id !== null)
    )
  );

  // For each unique old user ID, try to find a match
  uniqueOldUserIds.forEach(oldUserId => {
    const newUserId = findNewUserByOldCrmId(oldUserId, newUsers);
    if (newUserId) {
      mapping[String(oldUserId)] = newUserId;
    }
  });

  return mapping;
}


