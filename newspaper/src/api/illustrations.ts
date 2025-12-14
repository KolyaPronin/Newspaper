import { fetchAPI, API_BASE_URL } from './client';

export interface Illustration {
  id: string;
  articleId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  caption: string;
  position: 'inline' | 'fixed';
  columnIndex: number | null;
  createdBy: {
    id: string;
    username: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IllustrationFromAPI {
  _id: string;
  articleId: string | { _id: string; title?: string };
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  caption: string;
  position: 'inline' | 'fixed';
  columnIndex: number | null;
  createdBy: string | { _id: string; username?: string; email?: string };
  createdAt: string;
  updatedAt: string;
}

export const transformIllustration = (apiIllustration: IllustrationFromAPI): Illustration => {
  return {
    id: apiIllustration._id,
    articleId: typeof apiIllustration.articleId === 'string'
      ? apiIllustration.articleId
      : apiIllustration.articleId._id,
    filename: apiIllustration.filename,
    originalName: apiIllustration.originalName,
    mimeType: apiIllustration.mimeType,
    size: apiIllustration.size,
    url: apiIllustration.url.startsWith('http')
      ? apiIllustration.url
      : `${API_BASE_URL.replace('/api', '')}${apiIllustration.url}`,
    caption: apiIllustration.caption,
    position: apiIllustration.position,
    columnIndex: apiIllustration.columnIndex,
    createdBy: typeof apiIllustration.createdBy === 'string'
      ? { id: apiIllustration.createdBy, username: '', email: '' }
      : {
          id: apiIllustration.createdBy._id,
          username: apiIllustration.createdBy.username || '',
          email: apiIllustration.createdBy.email || '',
        },
    createdAt: new Date(apiIllustration.createdAt),
    updatedAt: new Date(apiIllustration.updatedAt),
  };
};

export const illustrationAPI = {
  getByArticle: async (articleId: string): Promise<Illustration[]> => {
    const response = await fetchAPI<IllustrationFromAPI[]>(`/illustrations/article/${articleId}`);
    if (response.success && response.data) {
      return Array.isArray(response.data)
        ? response.data.map(transformIllustration)
        : [];
    }
    throw new Error(response.error || 'Failed to fetch illustrations');
  },

  getById: async (id: string): Promise<Illustration> => {
    const response = await fetchAPI<IllustrationFromAPI>(`/illustrations/${id}`);
    if (response.success && response.data) {
      return transformIllustration(response.data);
    }
    throw new Error(response.error || 'Failed to fetch illustration');
  },

  upload: async (
    articleId: string,
    file: File | Blob,
    options?: { caption?: string; position?: 'inline' | 'fixed'; columnIndex?: number }
  ): Promise<Illustration> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('articleId', articleId);
    if (options?.caption) formData.append('caption', options.caption);
    if (options?.position) formData.append('position', options.position);
    if (options?.columnIndex !== undefined) formData.append('columnIndex', options.columnIndex.toString());

    // Используем общий fetchAPI, чтобы автоматически подставлялся Authorization
    const response = await fetchAPI<IllustrationFromAPI>('/illustrations', {
      method: 'POST',
      body: formData,
    });

    if (response.success && response.data) {
      return transformIllustration(response.data);
    }
    throw new Error(response.error || 'Failed to upload illustration');
  },

  update: async (
    id: string,
    updates: { caption?: string; position?: 'inline' | 'fixed'; columnIndex?: number }
  ): Promise<Illustration> => {
    const response = await fetchAPI<IllustrationFromAPI>(`/illustrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      return transformIllustration(response.data);
    }
    throw new Error(response.error || 'Failed to update illustration');
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetchAPI<void>(`/illustrations/${id}`, {
      method: 'DELETE',
    });
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete illustration');
    }
  },
};


