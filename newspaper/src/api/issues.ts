import { fetchAPI } from './client';

export interface IssueFromAPI {
  _id: string;
  number: number;
  publicationDate: string;
  status: 'draft' | 'in_progress' | 'approved' | 'published';
  title?: string;
  templateId?: string | { _id: string; name?: string; columns?: number } | null;
  pageCount?: number | null;
  layoutNotes?: string;
  assignedLayoutDesignerId?: string | { _id: string; username?: string; role?: string } | null;
  pdfPath?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueArticlePlan {
  title: string;
  authorId: string;
  proofreaderId: string;
  illustratorId: string;
  description?: string;
  deadline?: string | null;
}

export interface StartIssueWorkflowPayload {
  title: string;
  description?: string;
  deadline?: string | null;
  publicationDate?: string | null;
  number?: number;
  templateId?: string | null;
  pageCount?: number | null;
  layoutNotes?: string;
  layoutDesignerId?: string | null;
  articles: IssueArticlePlan[];
}

export interface CreateIssueArticlePayload {
  title: string;
  authorId: string;
  proofreaderId: string;
  illustratorId: string;
  description?: string;
  deadline?: string | null;
}

export const issueAPI = {
  getIssueById: async (id: string): Promise<IssueFromAPI> => {
    const response = await fetchAPI<IssueFromAPI>(`/issues/${id}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to fetch issue');
  },

  getIssues: async (params?: { status?: string; limit?: number }): Promise<IssueFromAPI[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString();
    const response = await fetchAPI<IssueFromAPI[]>(`/issues${qs ? `?${qs}` : ''}`);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.error || 'Failed to fetch issues');
  },

  startIssueWorkflow: async (payload: StartIssueWorkflowPayload) => {
    const response = await fetchAPI<{
      issue: IssueFromAPI;
      issueTask: unknown;
      subtasks: unknown[];
    }>('/issues/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to start issue workflow');
  },

  createIssueArticle: async (issueId: string, payload: CreateIssueArticlePayload) => {
    const response = await fetchAPI<{
      article: unknown;
      task: unknown;
    }>(`/issues/${issueId}/articles`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to create issue article');
  },

  uploadPdf: async (issueId: string, pdfBlob: Blob, filename: string): Promise<{ pdfUrl: string; pdfPath: string }> => {
    const formData = new FormData();
    formData.append('pdf', pdfBlob, filename);
    const response = await fetchAPI<{ pdfUrl: string; pdfPath: string }>(`/issues/${issueId}/pdf`, {
      method: 'POST',
      body: formData,
    });
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to upload PDF');
  },
};
