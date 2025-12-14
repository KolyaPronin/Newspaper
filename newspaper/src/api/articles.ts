import { fetchAPI } from './client';
import { Article } from '../types/Article';

export interface ArticleFromAPI {
  _id: string;
  title: string;
  content: string;
  status: 'draft' | 'under_review' | 'needs_revision' | 'approved' | 'published';
  authorId: string | { _id: string; username?: string; email?: string };
  issueId?: string | { _id: string; number?: number; publicationDate?: Date } | null;
  createdAt: string;
  updatedAt: string;
}

export const transformArticle = (apiArticle: ArticleFromAPI): Article => {
  return {
    id: apiArticle._id,
    title: apiArticle.title,
    content: apiArticle.content,
    status: apiArticle.status,
    authorId: typeof apiArticle.authorId === 'string'
      ? apiArticle.authorId
      : apiArticle.authorId._id,
    issueId: apiArticle.issueId
      ? (typeof apiArticle.issueId === 'string' ? apiArticle.issueId : apiArticle.issueId._id)
      : undefined,
    createdAt: new Date(apiArticle.createdAt),
    updatedAt: new Date(apiArticle.updatedAt),
  };
};

export const articleAPI = {
  getArticles: async (params?: { authorId?: string; status?: string }): Promise<ArticleFromAPI[]> => {
    const queryParams = new URLSearchParams();
    if (params?.authorId) queryParams.append('authorId', params.authorId);
    if (params?.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    const endpoint = `/articles${queryString ? `?${queryString}` : ''}`;

    const response = await fetchAPI<ArticleFromAPI[]>(endpoint);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.error || 'Failed to fetch articles');
  },

  getArticleById: async (id: string): Promise<ArticleFromAPI> => {
    const response = await fetchAPI<ArticleFromAPI>(`/articles/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to fetch article');
  },

  createArticle: async (article: {
    title: string;
    content: string;
    authorId: string;
    issueId?: string;
  }): Promise<ArticleFromAPI> => {
    const response = await fetchAPI<ArticleFromAPI>('/articles', {
      method: 'POST',
      body: JSON.stringify(article),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to create article');
  },

  updateArticle: async (id: string, updates: {
    title?: string;
    content?: string;
  }): Promise<ArticleFromAPI> => {
    const response = await fetchAPI<ArticleFromAPI>(`/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to update article');
  },

  deleteArticle: async (id: string): Promise<void> => {
    const response = await fetchAPI<void>(`/articles/${id}`, {
      method: 'DELETE',
    });
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete article');
    }
  },

  submitForReview: async (id: string): Promise<ArticleFromAPI> => {
    const response = await fetchAPI<ArticleFromAPI>(`/articles/${id}/submit`, {
      method: 'POST',
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to submit article for review');
  },

  approveArticle: async (id: string): Promise<ArticleFromAPI> => {
    const response = await fetchAPI<ArticleFromAPI>(`/articles/${id}/approve`, {
      method: 'POST',
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to approve article');
  },

  requestRevision: async (id: string): Promise<ArticleFromAPI> => {
    const response = await fetchAPI<ArticleFromAPI>(`/articles/${id}/request-revision`, {
      method: 'POST',
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to request revision');
  },
};


