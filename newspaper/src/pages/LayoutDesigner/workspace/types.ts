import { ColumnContainer, LayoutAd, LayoutIllustration } from '../../../types/PageTemplate';

export interface PageData {
  columns: ColumnContainer[][];
  headerContent: string;
  layoutTitle: string;
  layoutId: string | null;
  layoutIllustrations: LayoutIllustration[];
  layoutAds: LayoutAd[];
  layoutStatus?: 'draft' | 'in_review' | 'published';
  reviewComment?: string | null;
}

export type FlowItem =
  | { kind: 'text'; articleId?: string; html: string; source: 'existing' | 'new' }
  | { kind: 'illustration'; illustrationId: string; span?: 1 | 2; spanRole?: 'main' | 'ghost'; heightPx: number; source: 'existing' | 'new'; float?: 'left' | 'right'; anchorParagraphIndex?: number | null; articleId?: string; pinnedColumnIndex?: number };
