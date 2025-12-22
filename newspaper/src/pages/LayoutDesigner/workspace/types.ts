import { ColumnContainer, LayoutAd, LayoutIllustration } from '../../../types/PageTemplate';

export interface PageData {
  columns: ColumnContainer[][];
  headerContent: string;
  layoutTitle: string;
  layoutId: string | null;
  layoutIllustrations: LayoutIllustration[];
  layoutAds: LayoutAd[];
}

export type FlowItem =
  | { kind: 'text'; articleId?: string; html: string; source: 'existing' | 'new' }
  | { kind: 'illustration'; illustrationId: string; span?: 1 | 2; spanRole?: 'main' | 'ghost'; heightPx: number; source: 'existing' | 'new' };
