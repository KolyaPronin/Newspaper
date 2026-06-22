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
}

const isMongoObjectIdString = (value: string): boolean => /^[a-f\d]{24}$/i.test(value);

export function useTemplatesAndLayouts({
  buildEmptyColumns,
  setPagesData,
  setAutoSaveMessage,
  setSaveError,
}: UseTemplatesAndLayoutsArgs) {
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [layoutsLoading, setLayoutsLoading] = useState(false);

  const loadLayoutsForAllPages = useCallback(async (template: PageTemplate) => {
    setLayoutsLoading(true);
    setSaveError(null);
    try {
      const templateIdFilter = isMongoObjectIdString(template.id)
        ? { templateId: template.id }
        : {};

      const [coverLayouts, regularLayouts] = await Promise.all([
        layoutAPI.getLayouts({ pageNumber: 1 }),
        // Local fallback templates use non-ObjectId ids like "default_3col".
        // Passing those to Mongo-backed Layout.templateId triggers Cast errors server-side.
        layoutAPI.getLayouts({ ...templateIdFilter }),
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

      for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
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
      for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
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
  }, [buildEmptyColumns, setAutoSaveMessage, setPagesData, setSaveError]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const fetchedTemplates = await templateAPI.getTemplates();
      if (fetchedTemplates.length === 0) {
        setTemplates([defaultPageTemplate]);
        setSelectedTemplate(defaultPageTemplate);
        await loadLayoutsForAllPages(defaultPageTemplate);
      } else {
        setTemplates(fetchedTemplates);
        const template = fetchedTemplates[0];
        setSelectedTemplate(template);
        await loadLayoutsForAllPages(template);
      }
    } catch (error) {
      const fallbackTemplate = defaultPageTemplate;
      setTemplates([fallbackTemplate]);
      setSelectedTemplate(fallbackTemplate);
      await loadLayoutsForAllPages(fallbackTemplate);
      setTemplatesError(error instanceof Error ? error.message : 'Не удалось загрузить шаблоны');
    } finally {
      setTemplatesLoading(false);
    }
  }, [loadLayoutsForAllPages]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleTemplateChange = useCallback((templateId: string) => {
    const next = templates.find(t => t.id === templateId);
    if (next) {
      setSelectedTemplate(next);
      loadLayoutsForAllPages(next);
    }
  }, [templates, loadLayoutsForAllPages]);

  const handleReloadTemplate = useCallback(() => {
    if (selectedTemplate) {
      loadLayoutsForAllPages(selectedTemplate);
    }
  }, [selectedTemplate, loadLayoutsForAllPages]);

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
