import { fetchAPI } from './client';

export interface IssueFromAPI {
  _id: string;
  number: number;
  publicationDate: string;
  status: 'draft' | 'in_progress' | 'approved' | 'published';
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StartIssueWorkflowPayload {
  title: string;
  description?: string;
  deadline?: string | null;
  publicationDate?: string | null;
  number?: number;
  issueTitle?: string;
}

export const issueAPI = {
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
};

