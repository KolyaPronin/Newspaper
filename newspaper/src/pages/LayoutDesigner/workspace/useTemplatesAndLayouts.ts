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
      const [coverLayouts, regularLayouts] = await Promise.all([
        layoutAPI.getLayouts({ pageNumber: 1 }),
        layoutAPI.getLayouts({ templateId: template.id }),
      ]);

      const allLayouts = [...coverLayouts, ...regularLayouts];
      const newPagesData: Record<number, PageData> = {};

      for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
        const pageLayout = allLayouts.find(l => l.pageNumber === pageNum);
        const pageTemplate = pageNum === 1 ? coverPageTemplate : template;

        if (pageLayout) {
          newPagesData[pageNum] = {
            columns: pageLayout.columns || buildEmptyColumns(pageTemplate),
            headerContent: pageLayout.headerContent || (pageNum === 1 ? '' : (pageTemplate.headers?.content || 'Заголовок газеты')),
            layoutTitle: pageLayout.title,
            layoutId: pageLayout.id,
            layoutIllustrations: pageLayout.illustrations || [],
            layoutAds: pageLayout.ads || [],
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
