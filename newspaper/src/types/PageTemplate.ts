export interface AdSlot {
  id: string;
  x: number; // координата X в процентах или пикселях
  y: number; // координата Y
  width: number;
  height: number;
  allowedContentTypes: string[];
}

export interface IllustrationPosition {
  id: string;
  allowedColumns: number[]; // в каких колонках может быть
  maxWidth: number;
  maxHeight: number;
  textWrapping: 'none' | 'around' | 'below';
}

export interface Margins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface HeaderFooter {
  content?: string;
  height: number;
}

export interface TextFlowRule {
  wrapAroundIllustrations: boolean;
  wrapAroundAds: boolean;
  multiColumnContinuation: boolean;
}

export interface PageTemplate {
  id: string;
  name: string;
  columns: number;
  adSlots: AdSlot[];
  illustrationPositions: IllustrationPosition[];
  margins: Margins;
  headers: HeaderFooter;
  footers: HeaderFooter;
  textFlowRules: TextFlowRule;
}

export interface ColumnContainer {
  id: string;
  columnIndex: number;
  content: string; // HTML контент статьи
  articleId?: string;
  height: number; // высота в пикселях
  isFilled: boolean;
}

