import { useCallback } from 'react';
import { PageTemplate } from '../../../types/PageTemplate';
import { Illustration } from '../../../utils/api';
import { PageData } from './types';

interface UseLayoutDesignerSlotActionsArgs {
  allIllustrations: Illustration[];
  allAds: Illustration[];
  currentPage: number;
  currentPageData: PageData;
  getTemplateForPage: (pageNumber: number) => PageTemplate;
  updateCurrentPageData: (updates: Partial<PageData>) => void;
}

export function useLayoutDesignerSlotActions({
  allIllustrations,
  allAds,
  currentPage,
  currentPageData,
  getTemplateForPage,
  updateCurrentPageData,
}: UseLayoutDesignerSlotActionsArgs) {
  const handleDropIllustration = useCallback((illustrationId: string, columnIndex: number, positionIndex: number) => {
    const illustration = allIllustrations.find(ill => ill.id === illustrationId);
    if (!illustration) return;

    const pageTemplate = getTemplateForPage(currentPage);
    const positions = pageTemplate.illustrationPositions.filter(pos => pos.allowedColumns.includes(columnIndex));
    if (positionIndex >= positions.length) return;

    updateCurrentPageData({
      layoutIllustrations: [
        ...currentPageData.layoutIllustrations.filter(
          li => !(li.columnIndex === columnIndex && li.positionIndex === positionIndex) && li.illustrationId !== illustrationId
        ),
        {
          illustrationId,
          columnIndex,
          positionIndex,
        },
      ],
    });
  }, [allIllustrations, currentPage, currentPageData.layoutIllustrations, getTemplateForPage, updateCurrentPageData]);

  const handleDeleteIllustration = useCallback((columnIndex: number, positionIndex: number) => {
    updateCurrentPageData({
      layoutIllustrations: currentPageData.layoutIllustrations.filter(
        li => !(li.columnIndex === columnIndex && li.positionIndex === positionIndex)
      ),
    });
  }, [currentPageData.layoutIllustrations, updateCurrentPageData]);

  const handleDropAd = useCallback((illustrationId: string, slotIndex: number) => {
    const ad = allAds.find(a => a.id === illustrationId);
    if (!ad) return;

    updateCurrentPageData({
      layoutAds: [
        ...currentPageData.layoutAds.filter(
          la => la.slotIndex !== slotIndex && la.illustrationId !== illustrationId
        ),
        { illustrationId, slotIndex },
      ],
    });
  }, [allAds, currentPageData.layoutAds, updateCurrentPageData]);

  const handleDeleteAd = useCallback((slotIndex: number) => {
    updateCurrentPageData({
      layoutAds: currentPageData.layoutAds.filter(la => la.slotIndex !== slotIndex),
    });
  }, [currentPageData.layoutAds, updateCurrentPageData]);

  return {
    handleDropIllustration,
    handleDeleteIllustration,
    handleDropAd,
    handleDeleteAd,
  };
}
