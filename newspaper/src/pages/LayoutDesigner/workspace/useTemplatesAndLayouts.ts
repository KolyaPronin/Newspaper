import { useCallback, useEffect, useState } from 'react';
import { coverPageTemplate, defaultPageTemplate, TOTAL_PAGES } from '../../../data/templates';
import { layoutAPI, templateAPI } from '../../../utils/api';
import { PageTemplate } from '../../../types/PageTemplate';
import { PageData } from './types';

interface UseTemplatesAndLayoutsArgs {
  buildEmptyColumns: (template: PageTemplate) => any[][];
  setPagesData: React.Dispatch<React.SetStateAction<Record<number, PageData>>>;
  setAutoSaveMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  issueId?: string | null;
  totalPages?: number;
}

const isMongoObjectIdString = (value: string): boolean => /^[a-f\d]{24}$/i.test(value);

export function useTemplatesAndLayouts({
  buildEmptyColumns,
  setPagesData,
  setAutoSaveMessage,
  setSaveError,
  issueId,
  totalPages: totalPagesProp,
}: UseTemplatesAndLayoutsArgs) {
  const totalPages = totalPagesProp ?? TOTAL_PAGES;
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [layoutsLoading, setLayoutsLoading] = useState(false);

  const loadLayoutsForAllPages = useCallback(async (template: PageTemplate, loadIssueId?: string | null) => {
    setLayoutsLoading(true);
    setSaveError(null);
    try {
      const templateIdFilter = isMongoObjectIdString(template.id)
        ? { templateId: template.id }
        : {};

      const issueIdFilter = loadIssueId ? { issueId: loadIssueId } : {};

      const [coverLayouts, regularLayouts] = await Promise.all([
        layoutAPI.getLayouts({ pageNumber: 1, ...issueIdFilter }),
        // Local fallback templates use non-ObjectId ids like "default_3col".
        // Passing those to Mongo-backed Layout.templateId triggers Cast errors server-side.
        layoutAPI.getLayouts({ ...templateIdFilter, ...issueIdFilter }),
      ]);

      const allLayoutsRaw = [...coverLayouts, ...regularLayouts];

      const layoutByPage = new Map<number, typeof coverLayouts[number]>();
      for (const layout of allLayoutsRaw) {
        const pageNum = layout.pageNumber;
        if (pageNum === null || pageNum === undefined) continue;
        const prev = layoutByPage.get(pageNum);
        if (!prev) {
          layoutByPage.set(pageNum, layout);
          continue;
        }
        const prevTime = Date.parse(prev.updatedAt);
        const nextTime = Date.parse(layout.updatedAt);
        if (Number.isFinite(nextTime) && (!Number.isFinite(prevTime) || nextTime >= prevTime)) {
          layoutByPage.set(pageNum, layout);
        }
      }

      const allLayouts = Array.from(layoutByPage.values());
      const newPagesData: Record<number, PageData> = {};

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pageLayout = allLayouts.find(l => l.pageNumber === pageNum);
        const pageTemplate = pageNum === 1 ? coverPageTemplate : template;

        if (pageLayout) {
          const normalizedColumns = (pageLayout.columns || buildEmptyColumns(pageTemplate)).map(
            (col: any[]) => col.map((cont: any) => {
              if (cont && cont.kind === 'illustration') {
                return {
                  ...cont,
                  float: cont.float ?? 'left',
                  anchorParagraphIndex: cont.anchorParagraphIndex !== undefined ? cont.anchorParagraphIndex : null,
                };
              }
              return cont;
            })
          );
          newPagesData[pageNum] = {
            columns: normalizedColumns,
            headerContent: pageLayout.headerContent || (pageNum === 1 ? '' : (pageTemplate.headers?.content || 'Заголовок газеты')),
            layoutTitle: pageLayout.title,
            layoutId: pageLayout.id,
            layoutIllustrations: pageLayout.illustrations || [],
            layoutAds: pageLayout.ads || [],
            layoutStatus: pageLayout.status,
            reviewComment: pageLayout.reviewComment ?? null,
          };
        } else {
          newPagesData[pageNum] = {
            columns: buildEmptyColumns(pageTemplate),
            headerContent: pageNum === 1 ? '' : (pageTemplate.headers?.content || 'Заголовок газеты'),
            layoutTitle: pageNum === 1 ? 'Обложка' : `Страница ${pageNum}`,
            layoutId: null,
            layoutIllustrations: [],
            layoutAds: [],
          };
        }
      }

      setPagesData(newPagesData);
      setAutoSaveMessage('Макеты загружены');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Не удалось загрузить макеты';
      setSaveError(errorMessage);
      setAutoSaveMessage(errorMessage);

      const newPagesData: Record<number, PageData> = {};
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pageTemplate = pageNum === 1 ? coverPageTemplate : template;
        newPagesData[pageNum] = {
          columns: buildEmptyColumns(pageTemplate),
          headerContent: pageNum === 1 ? '' : (pageTemplate.headers?.content || 'Заголовок газеты'),
          layoutTitle: pageNum === 1 ? 'Обложка' : `Страница ${pageNum}`,
          layoutId: null,
          layoutIllustrations: [],
          layoutAds: [],
        };
      }
      setPagesData(newPagesData);
    } finally {
      setLayoutsLoading(false);
    }
  }, [buildEmptyColumns, setAutoSaveMessage, setPagesData, setSaveError, totalPages]);

  const fetchTemplates = useCallback(async (overrideIssueId?: string | null) => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    const effectiveIssueId = overrideIssueId !== undefined ? overrideIssueId : issueId;
    try {
      const fetchedTemplates = await templateAPI.getTemplates();
      if (fetchedTemplates.length === 0) {
        setTemplates([defaultPageTemplate]);
        setSelectedTemplate(defaultPageTemplate);
        await loadLayoutsForAllPages(defaultPageTemplate, effectiveIssueId);
      } else {
        setTemplates(fetchedTemplates);
        const template = fetchedTemplates[0];
        setSelectedTemplate(template);
        await loadLayoutsForAllPages(template, effectiveIssueId);
      }
    } catch (error) {
      const fallbackTemplate = defaultPageTemplate;
      setTemplates([fallbackTemplate]);
      setSelectedTemplate(fallbackTemplate);
      await loadLayoutsForAllPages(fallbackTemplate, effectiveIssueId);
      setTemplatesError(error instanceof Error ? error.message : 'Не удалось загрузить шаблоны');
    } finally {
      setTemplatesLoading(false);
    }
  }, [loadLayoutsForAllPages, issueId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleTemplateChange = useCallback((templateId: string) => {
    const next = templates.find(t => t.id === templateId);
    if (next) {
      setSelectedTemplate(next);
      loadLayoutsForAllPages(next, issueId);
    }
  }, [templates, loadLayoutsForAllPages, issueId]);

  const handleReloadTemplate = useCallback(() => {
    if (selectedTemplate) {
      loadLayoutsForAllPages(selectedTemplate, issueId);
    }
  }, [selectedTemplate, loadLayoutsForAllPages, issueId]);

  return {
    templates,
    selectedTemplate,
    templatesLoading,
    templatesError,
    layoutsLoading,
    fetchTemplates,
    handleTemplateChange,
    handleReloadTemplate,
    loadLayoutsForAllPages,
    setSelectedTemplate,
    setTemplates,
  };
}
