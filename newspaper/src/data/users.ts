import { User, UserRole } from '../types/User';

export const mockUsers: User[] = [
  {
    id: '1',
    username: 'author_ivan',
    email: 'ivan@newspapaer.zeta',
    role: UserRole.AUTHOR
  },
  {
    id: '2', 
    username: 'proofreader_maria',
    email: 'maria@newspapaer.zeta',
    role: UserRole.PROOFREADER
  },
  {
    id: '3',
    username: 'chief_alpha',
    email: 'alpha@newspapaer.zeta', 
    role: UserRole.CHIEF_EDITOR
  }
];