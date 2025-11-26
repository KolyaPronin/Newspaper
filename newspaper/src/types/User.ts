export enum UserRole {
  AUTHOR = 'author',
  PROOFREADER = 'proofreader', 
  ILLUSTRATOR = 'illustrator',
  LAYOUT_DESIGNER = 'layout_designer',
  CHIEF_EDITOR = 'chief_editor'
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
}

export interface LoginPayload {
  email?: string;
  username?: string;
  password: string;
}