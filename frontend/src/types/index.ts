// User types
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone?: string;
  role: string; // Role ID
  roleName?: string; // Role name for display
  teamId: string | null;
  active: boolean;
  hrex?: string; // Hex color code for user (e.g., #FF5733)
  requireOtp?: boolean; // Force OTP login for this user
  isTeleoperateur?: boolean;
  isConfirmateur?: boolean;
  dataAccess?: 'all' | 'team_only' | 'own_only'; // Data access level from role
  createdAt?: string; // Creation date
  dateCreated?: string; // Alternative creation date field
}

// Team types
export interface Team {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

// Team member types
export interface TeamMemberUserData {
  firstName: string;
  lastName: string;
  role: string;
}

export interface TeamMember {
  userId: string;
  userData: TeamMemberUserData;
  isLeader?: boolean;
  createdAt?: string;
}

export interface TeamDetail {
  team: Team;
  members: TeamMember[];
}

// Form payload types
export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  first_name: string;
  last_name: string;
  role: string;
  teamId: string | null;
}

