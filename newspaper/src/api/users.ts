import { fetchAPI } from './client';

export const userAPI = {
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


