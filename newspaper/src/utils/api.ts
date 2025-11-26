import { API_BASE_URL } from '../config';
import { User, LoginPayload } from '../types/User';
import { Article } from '../types/Article';

interface LoginResponse {
  token: string;
  user: User;
}

interface ArticlePayload {
  title: string;
  content: string;
  issueId?: string;
}

const buildHeaders = (token?: string): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.error || response.statusText || 'Request failed';
    throw new Error(message);
  }
  return response.json();
};

const normalizeArticle = (data: any): Article => {
  const authorId =
    typeof data.authorId === 'object' && data.authorId !== null
      ? data.authorId._id || data.authorId.id || data.authorId.toString()
      : data.authorId;

  const issueId =
    typeof data.issueId === 'object' && data.issueId !== null
      ? data.issueId._id || data.issueId.id || undefined
      : data.issueId || undefined;

  return {
    id: data._id || data.id,
    title: data.title,
    content: data.content,
    status: data.status,
    authorId: authorId || '',
    issueId: issueId,
    createdAt: new Date(data.createdAt || Date.now()),
    updatedAt: new Date(data.updatedAt || Date.now()),
  };
};

export const authApi = {
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });

    const result = await handleResponse<{ success: boolean; data: LoginResponse }>(response);
    return result.data;
  },
};

export const articleApi = {
  list: async (token: string): Promise<Article[]> => {
    const response = await fetch(`${API_BASE_URL}/articles`, {
      method: 'GET',
      headers: buildHeaders(token),
    });

    const result = await handleResponse<{ success: boolean; data: any[] }>(response);
    return (result.data || []).map(normalizeArticle);
  },

  create: async (token: string, payload: ArticlePayload): Promise<Article> => {
    const response = await fetch(`${API_BASE_URL}/articles`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload),
    });

    const result = await handleResponse<{ success: boolean; data: any }>(response);
    return normalizeArticle(result.data);
  },

  update: async (token: string, articleId: string, payload: ArticlePayload): Promise<Article> => {
    const response = await fetch(`${API_BASE_URL}/articles/${articleId}`, {
      method: 'PUT',
      headers: buildHeaders(token),
      body: JSON.stringify(payload),
    });

    const result = await handleResponse<{ success: boolean; data: any }>(response);
    return normalizeArticle(result.data);
  },

  submit: async (token: string, articleId: string): Promise<Article> => {
    const response = await fetch(`${API_BASE_URL}/articles/${articleId}/submit`, {
      method: 'POST',
      headers: buildHeaders(token),
    });

    const result = await handleResponse<{ success: boolean; data: any }>(response);
    return normalizeArticle(result.data);
  },

  approve: async (token: string, articleId: string): Promise<Article> => {
    const response = await fetch(`${API_BASE_URL}/articles/${articleId}/approve`, {
      method: 'POST',
      headers: buildHeaders(token),
    });

    const result = await handleResponse<{ success: boolean; data: any }>(response);
    return normalizeArticle(result.data);
  },

  requestRevision: async (token: string, articleId: string): Promise<Article> => {
    const response = await fetch(`${API_BASE_URL}/articles/${articleId}/request-revision`, {
      method: 'POST',
      headers: buildHeaders(token),
    });

    const result = await handleResponse<{ success: boolean; data: any }>(response);
    return normalizeArticle(result.data);
  },
};


