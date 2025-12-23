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
  login: (user: User) => void;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
}