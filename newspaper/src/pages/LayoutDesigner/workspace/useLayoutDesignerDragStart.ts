import { useCallback } from 'react';

export function useLayoutDesignerDragStart() {
  const handleArticleDragStart = useCallback((e: React.DragEvent, articleId: string) => {
    e.dataTransfer.setData('articleId', articleId);
    e.dataTransfer.setData('text/plain', articleId);
    e.dataTransfer.setData('application/x-newspaper-dnd', JSON.stringify({ kind: 'article', articleId }));
  }, []);

  const handleIllustrationDragStart = useCallback((e: React.DragEvent, illustrationId: string) => {
    e.dataTransfer.setData('illustrationId', illustrationId);
    e.dataTransfer.setData('assetKind', 'illustration');
    e.dataTransfer.setData('text/plain', illustrationId);
    e.dataTransfer.setData('application/x-newspaper-dnd', JSON.stringify({ kind: 'illustration', illustrationId }));
  }, []);

  const handleAdDragStart = useCallback((e: React.DragEvent, illustrationId: string) => {
    e.dataTransfer.setData('illustrationId', illustrationId);
    e.dataTransfer.setData('assetKind', 'ad');
    e.dataTransfer.setData('text/plain', illustrationId);
    e.dataTransfer.setData('application/x-newspaper-dnd', JSON.stringify({ kind: 'ad', illustrationId }));
  }, []);

  return {
    handleArticleDragStart,
    handleIllustrationDragStart,
    handleAdDragStart,
  };
}
