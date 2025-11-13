// User types
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
  teamId: string | null;
  active: boolean;
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

