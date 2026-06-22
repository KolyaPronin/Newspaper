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

export interface LoginPayload {
  email?: string;
  username?: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}