import { fetchAPI } from './client';
import { User, UserRole } from '../types/User';

export interface AuthSuccessResponse {
  user: User;
  token: string;
}

export const authAPI = {
  register: async (payload: { username: string; email: string; password: string; role: UserRole }): Promise<AuthSuccessResponse> => {
    const response = await fetchAPI<AuthSuccessResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to register');
  },
  login: async (payload: { email?: string; username?: string; password: string }): Promise<AuthSuccessResponse> => {
    const response = await fetchAPI<AuthSuccessResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to login');
  },
  me: async (): Promise<User> => {
    const response = await fetchAPI<User>('/auth/me');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to fetch current user');
  },
  logout: async (): Promise<void> => {
    const response = await fetchAPI<void>('/auth/logout', {
      method: 'POST',
    });
    if (!response.success) {
      throw new Error(response.error || 'Failed to logout');
    }
  },
};


