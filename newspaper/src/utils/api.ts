import { User, UserRole } from '../types/User';
import { PageTemplate, ColumnContainer, Layout, LayoutIllustration } from '../types/PageTemplate';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

const normalizeHeaders = (input?: HeadersInit): Record<string, string> => {
  if (!input) {
    return {};
  }

  if (input instanceof Headers) {
    const result: Record<string, string> = {};
    input.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(input)) {
    return input.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  return { ...(input as Record<string, string>) };
};

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

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

export const transformArticle = (apiArticle: ArticleFromAPI) => {
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

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers = normalizeHeaders(options.headers);

    if (!isFormData) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (authToken) {
      headers.Authorization = headers.Authorization || `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP error! status: ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export interface AuthSuccessResponse {
  user: User;
  token: string;
}

export interface TemplateFromAPI extends Omit<PageTemplate, 'id'> {
  _id: string;
}

export interface LayoutFromAPI {
  _id: string;
  title: string;
  templateId: string | TemplateFromAPI;
  issueId?: string | null;
  pageNumber?: number | null;
  headerContent?: string;
  footerContent?: string;
  columns: ColumnContainer[][];
  illustrations?: Array<{
    illustrationId: string;
    columnIndex: number;
    positionIndex: number;
  }>;
  status: 'draft' | 'in_review' | 'published';
  createdAt: string;
  updatedAt: string;
}

const transformTemplate = (template: TemplateFromAPI): PageTemplate => ({
  id: template._id,
  name: template.name,
  columns: template.columns,
  adSlots: template.adSlots,
  illustrationPositions: template.illustrationPositions,
  margins: template.margins,
  headers: template.headers,
  footers: template.footers,
  textFlowRules: template.textFlowRules,
});

const transformLayout = (layout: LayoutFromAPI): Layout => ({
  id: layout._id,
  title: layout.title,
  templateId: typeof layout.templateId === 'string' ? layout.templateId : layout.templateId._id,
  issueId: layout.issueId || null,
  pageNumber: layout.pageNumber ?? null,
  headerContent: layout.headerContent,
  footerContent: layout.footerContent,
  columns: layout.columns || [],
  illustrations: layout.illustrations || [],
  status: layout.status,
  createdAt: layout.createdAt,
  updatedAt: layout.updatedAt,
});

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

export const templateAPI = {
  getTemplates: async (): Promise<PageTemplate[]> => {
    const response = await fetchAPI<TemplateFromAPI[]>('/templates');
    if (response.success && response.data) {
      return (response.data as TemplateFromAPI[]).map(transformTemplate);
    }
    throw new Error(response.error || 'Failed to fetch templates');
  },
  getTemplateById: async (id: string): Promise<PageTemplate> => {
    const response = await fetchAPI<TemplateFromAPI>(`/templates/${id}`);
    if (response.success && response.data) {
      return transformTemplate(response.data as TemplateFromAPI);
    }
    throw new Error(response.error || 'Failed to fetch template');
  },
};

export const layoutAPI = {
  getLayouts: async (params?: { templateId?: string; issueId?: string; pageNumber?: number; limit?: number }): Promise<Layout[]> => {
    const query = new URLSearchParams();
    if (params?.templateId) query.append('templateId', params.templateId);
    if (params?.issueId) query.append('issueId', params.issueId);
    if (params?.pageNumber) query.append('pageNumber', params.pageNumber.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    const endpoint = `/layouts${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await fetchAPI<LayoutFromAPI[]>(endpoint);
    if (response.success && response.data) {
      return (response.data as LayoutFromAPI[]).map(transformLayout);
    }
    throw new Error(response.error || 'Failed to fetch layouts');
  },
  getLayoutById: async (id: string): Promise<Layout> => {
    const response = await fetchAPI<LayoutFromAPI>(`/layouts/${id}`);
    if (response.success && response.data) {
      return transformLayout(response.data as LayoutFromAPI);
    }
    throw new Error(response.error || 'Failed to fetch layout');
  },
  createLayout: async (payload: {
    templateId: string;
    title: string;
    columns: ColumnContainer[][];
    headerContent?: string;
    footerContent?: string;
    issueId?: string;
    pageNumber?: number;
    illustrations?: LayoutIllustration[];
    status?: Layout['status'];
  }): Promise<Layout> => {
    const response = await fetchAPI<LayoutFromAPI>('/layouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (response.success && response.data) {
      return transformLayout(response.data as LayoutFromAPI);
    }
    throw new Error(response.error || 'Failed to create layout');
  },
  updateLayout: async (id: string, payload: Partial<{
    templateId: string;
    title: string;
    columns: ColumnContainer[][];
    headerContent?: string;
    footerContent?: string;
    issueId?: string;
    pageNumber?: number;
    illustrations?: LayoutIllustration[];
    status?: Layout['status'];
  }>): Promise<Layout> => {
    const response = await fetchAPI<LayoutFromAPI>(`/layouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (response.success && response.data) {
      return transformLayout(response.data as LayoutFromAPI);
    }
    throw new Error(response.error || 'Failed to update layout');
  },
  deleteLayout: async (id: string): Promise<void> => {
    const response = await fetchAPI<void>(`/layouts/${id}`, {
      method: 'DELETE',
    });
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete layout');
    }
  },
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

    const response = await fetch(`${API_BASE_URL}/illustrations`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    if (data.success && data.data) {
      return transformIllustration(data.data);
    }
    throw new Error(data.error || 'Failed to upload illustration');
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

