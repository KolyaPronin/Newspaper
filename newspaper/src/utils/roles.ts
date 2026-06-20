import { UserRole } from '../types/User';

export const hasRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return userRole === requiredRole;
};

export const hasAnyRole = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  return requiredRoles.includes(userRole);
};

export const getRoutesForRole = (role: UserRole): string[] => {
  const routes = {
    [UserRole.AUTHOR]: ['/dashboard', '/articles', '/drafts'],
    [UserRole.PROOFREADER]: ['/dashboard', '/review', '/articles'],
    [UserRole.ILLUSTRATOR]: ['/dashboard', '/illustrations'],
    [UserRole.LAYOUT_DESIGNER]: ['/dashboard', '/layout', '/templates'],
    [UserRole.CHIEF_EDITOR]: ['/dashboard', '/review', '/approval', '/users']
  };
  
  return routes[role] || ['/dashboard'];
};

