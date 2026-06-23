import { useCallback, useState } from 'react';
import { layoutAPI } from '../../../utils/api';
import { TOTAL_PAGES } from '../../../data/templates';
import { PageTemplate } from '../../../types/PageTemplate';
import { PageData } from './types';

interface UseLayoutDesignerBulkActionsArgs {
  currentPage: number;
  pagesData: Record<number, PageData>;
  getTemplateForPage: (pageNumber: number) => PageTemplate;
  initPageData: (pageNum: number, template: PageTemplate) => PageData;
  buildEmptyColumns: (template: PageTemplate) => any[][];
  setPagesData: React.Dispatch<React.SetStateAction<Record<number, PageData>>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  setAutoSaveMessage: React.Dispatch<React.SetStateAction<string | null>>;
  skipAutoSaveRef: React.MutableRefObject<boolean>;
}

export function useLayoutDesignerBulkActions({
  currentPage,
  pagesData,
  getTemplateForPage,
  initPageData,
  buildEmptyColumns,
  setPagesData,
  setSaveError,
  setAutoSaveMessage,
  skipAutoSaveRef,
}: UseLayoutDesignerBulkActionsArgs) {
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const handleClearCurrentPage = useCallback(async () => {
    if (bulkActionLoading) return;
    const ok = window.confirm(`Очистить страницу ${currentPage}? Это удалит сохранённый макет этой страницы.`);
    if (!ok) return;

    setBulkActionLoading(true);
    setSaveError(null);

    const template = getTemplateForPage(currentPage);
    const pageData = pagesData[currentPage];
    const layoutId = pageData?.layoutId;
    let deleteError: string | null = null;

    try {
      if (layoutId) {
        await layoutAPI.deleteLayout(layoutId);
      }
    } catch (e) {
      deleteError = e instanceof Error ? e.message : 'Не удалось удалить макет на сервере';
    }

    skipAutoSaveRef.current = true;
    setPagesData(prev => {
      const base = prev[currentPage] || initPageData(currentPage, template);
      const next: Record<number, PageData> = { ...prev };
      next[currentPage] = {
        ...base,
        columns: buildEmptyColumns(template),
        layoutId: null,
        layoutIllustrations: [],
        layoutAds: [],
      };
      return next;
    });

    if (deleteError) {
      const msg = `Очищено локально. Сервер: ${deleteError}`;
      setSaveError(msg);
      setAutoSaveMessage(msg);
    } else {
      setAutoSaveMessage(`Страница ${currentPage} очищена`);
    }

    setBulkActionLoading(false);
  }, [
    bulkActionLoading,
    buildEmptyColumns,
    currentPage,
    getTemplateForPage,
    initPageData,
    pagesData,
    setAutoSaveMessage,
    setPagesData,
    setSaveError,
    skipAutoSaveRef,
  ]);

  const handleClearAllPages = useCallback(async () => {
    if (bulkActionLoading) return;
    const ok = window.confirm('Очистить весь выпуск? Это удалит все сохранённые макеты всех страниц.');
    if (!ok) return;

    setBulkActionLoading(true);
    setSaveError(null);

    let deleteError: string | null = null;
    try {
      const ids: string[] = [];
      for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
        const id = pagesData[pageNum]?.layoutId;
        if (id) ids.push(id);
      }

      if (ids.length > 0) {
        await Promise.all(ids.map(id => layoutAPI.deleteLayout(id)));
      }
    } catch (e) {
      deleteError = e instanceof Error ? e.message : 'Не удалось удалить макеты на сервере';
    }

    skipAutoSaveRef.current = true;
    setPagesData(prev => {
      const next: Record<number, PageData> = { ...prev };
      for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
        const t = getTemplateForPage(pageNum);
        const base = prev[pageNum] || initPageData(pageNum, t);
        next[pageNum] = {
          ...base,
          columns: buildEmptyColumns(t),
          layoutId: null,
          layoutIllustrations: [],
          layoutAds: [],
        };
      }
      return next;
    });

    if (deleteError) {
      const msg = `Выпуск очищен локально. Сервер: ${deleteError}`;
      setSaveError(msg);
      setAutoSaveMessage(msg);
    } else {
      setAutoSaveMessage('Выпуск очищен');
    }

    setBulkActionLoading(false);
  }, [
    bulkActionLoading,
    buildEmptyColumns,
    getTemplateForPage,
    initPageData,
    pagesData,
    setAutoSaveMessage,
    setPagesData,
    setSaveError,
    skipAutoSaveRef,
  ]);

  return {
    bulkActionLoading,
    handleClearCurrentPage,
    handleClearAllPages,
  };
}
