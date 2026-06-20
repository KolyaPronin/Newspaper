import { fetchAPI } from './client';

export const userAPI = {
  getUsers: async (): Promise<Array<{
    id: string;
    username: string;
    email: string;
    role: string;
  }>> => {
    const response = await fetchAPI<Array<{
      id: string;
      username: string;
      email: string;
      role: string;
    }>>('/users');
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.error || 'Failed to get users');
  },

  getUserById: async (id: string) => {
    const response = await fetchAPI<{
      id: string;
      username: string;
      email: string;
      role: string;
    }>(`/users/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to get user');
  },
};


