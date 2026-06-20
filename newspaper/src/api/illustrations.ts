import { fetchAPI, API_BASE_URL } from './client';

export type IllustrationKind = 'illustration' | 'ad';

export interface Illustration {
  id: string;
  articleId: string | null;
  kind: IllustrationKind;
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
  articleId: string | { _id: string; title?: string } | null;
  kind?: IllustrationKind;
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
  const articleId = apiIllustration.articleId
    ? (typeof apiIllustration.articleId === 'string'
        ? apiIllustration.articleId
        : apiIllustration.articleId._id)
    : null;

  const kind: IllustrationKind = apiIllustration.kind === 'ad' ? 'ad' : 'illustration';

  return {
    id: apiIllustration._id,
    articleId,
    kind,
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
  getAll: async (params?: { kind?: IllustrationKind; global?: boolean; articleId?: string }): Promise<Illustration[]> => {
    const query = new URLSearchParams();
    if (params?.kind) query.append('kind', params.kind);
    if (params?.global) query.append('global', 'true');
    if (params?.articleId) query.append('articleId', params.articleId);
    const endpoint = `/illustrations${query.toString() ? `?${query.toString()}` : ''}`;

    const response = await fetchAPI<IllustrationFromAPI[]>(endpoint);
    if (response.success && response.data) {
      return Array.isArray(response.data)
        ? response.data.map(transformIllustration)
        : [];
    }
    throw new Error(response.error || 'Failed to fetch illustrations');
  },

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
    payload: {
      file: File | Blob;
      articleId?: string | null;
      kind?: IllustrationKind;
      caption?: string;
      position?: 'inline' | 'fixed';
      columnIndex?: number;
    }
  ): Promise<Illustration> => {
    const formData = new FormData();
    formData.append('image', payload.file);
    if (payload.articleId) formData.append('articleId', payload.articleId);
    if (payload.kind) formData.append('kind', payload.kind);
    if (payload.caption) formData.append('caption', payload.caption);
    if (payload.position) formData.append('position', payload.position);
    if (payload.columnIndex !== undefined) formData.append('columnIndex', payload.columnIndex.toString());

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


