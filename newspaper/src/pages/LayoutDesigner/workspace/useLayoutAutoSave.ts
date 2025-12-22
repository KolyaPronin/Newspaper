import { useEffect, useRef } from 'react';
import { layoutAPI } from '../../../utils/api';
import { PageTemplate } from '../../../types/PageTemplate';
import { PageData } from './types';

interface UseLayoutAutoSaveArgs {
  selectedTemplate: PageTemplate | null;
  currentPage: number;
  pagesData: Record<number, PageData>;
  getTemplateForPage: (pageNumber: number) => PageTemplate;
  layoutsLoading: boolean;
  templatesLoading: boolean;
  skipAutoSaveRef: React.MutableRefObject<boolean>;
  setPagesData: React.Dispatch<React.SetStateAction<Record<number, PageData>>>;
  setAutoSaveMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useLayoutAutoSave({
  selectedTemplate,
  currentPage,
  pagesData,
  getTemplateForPage,
  layoutsLoading,
  templatesLoading,
  skipAutoSaveRef,
  setPagesData,
  setAutoSaveMessage,
  setSaveError,
}: UseLayoutAutoSaveArgs) {
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!selectedTemplate) return;
    if (layoutsLoading || templatesLoading) return;
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    const pageData = pagesData[currentPage];
    if (!pageData) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const pageTemplate = getTemplateForPage(currentPage);
        const templateIdForSave = selectedTemplate ? selectedTemplate.id : pageTemplate.id;
        const payload = {
          templateId: templateIdForSave,
          title: 'XPress',
          columns: pageData.columns,
          headerContent: 'XPress',
          illustrations: pageData.layoutIllustrations,
          ads: pageData.layoutAds,
          pageNumber: currentPage,
        };

        const saved = pageData.layoutId
          ? await layoutAPI.updateLayout(pageData.layoutId, payload)
          : await layoutAPI.createLayout(payload);

        const newPagesData = { ...pagesData };
        newPagesData[currentPage] = {
          ...pageData,
          layoutId: saved.id,
          layoutTitle: saved.title,
        };
        setPagesData(newPagesData);
        setAutoSaveMessage(`Страница ${currentPage} сохранена`);
        setSaveError(null);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ошибка сохранения макета';
        setSaveError(errorMessage);
        setAutoSaveMessage(errorMessage);
      }
    }, 1200);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    currentPage,
    getTemplateForPage,
    layoutsLoading,
    pagesData,
    selectedTemplate,
    setAutoSaveMessage,
    setPagesData,
    setSaveError,
    skipAutoSaveRef,
    templatesLoading,
  ]);
}
