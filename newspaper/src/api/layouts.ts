import { fetchAPI } from './client';
import { PageTemplate, ColumnContainer, Layout, LayoutIllustration, LayoutAd } from '../types/PageTemplate';

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
  ads?: Array<{
    illustrationId: string;
    slotIndex: number;
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
  ads: layout.ads || [],
  status: layout.status,
  createdAt: layout.createdAt,
  updatedAt: layout.updatedAt,
});

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
    ads?: LayoutAd[];
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
    ads?: LayoutAd[];
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


