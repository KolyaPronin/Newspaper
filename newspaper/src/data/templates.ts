import { PageTemplate } from '../types/PageTemplate';

export const defaultPageTemplate: PageTemplate = {
  id: 'default_3col',
  name: 'Стандартная 3-колоночная страница',
  columns: 3,
  adSlots: [
    {
      id: 'ad_bottom',
      x: 5,
      y: 85,
      width: 90,
      height: 10,
      allowedContentTypes: ['image', 'text'],
    },
  ],
  illustrationPositions: [
    {
      id: 'illus_col0',
      allowedColumns: [0],
      maxWidth: 100,
      maxHeight: 200,
      textWrapping: 'around',
    },
    {
      id: 'illus_col1',
      allowedColumns: [1],
      maxWidth: 100,
      maxHeight: 200,
      textWrapping: 'around',
    },
    {
      id: 'illus_col2',
      allowedColumns: [2],
      maxWidth: 100,
      maxHeight: 200,
      textWrapping: 'around',
    },
  ],
  margins: {
    top: 10,
    bottom: 10,
    left: 5,
    right: 5,
  },
  headers: {
    content: 'Заголовок газеты',
    height: 5,
  },
  footers: {
    content: 'Номер страницы',
    height: 3,
  },
  textFlowRules: {
    wrapAroundIllustrations: true,
    wrapAroundAds: false,
    multiColumnContinuation: true,
  },
};

export const coverPageTemplate: PageTemplate = {
  id: 'cover_page',
  name: 'Обложка (первая страница)',
  columns: 1,
  adSlots: [],
  illustrationPositions: [
    {
      id: 'cover_main',
      allowedColumns: [0],
      maxWidth: 100,
      maxHeight: 400,
      textWrapping: 'below',
    },
  ],
  margins: {
    top: 15,
    bottom: 15,
    left: 10,
    right: 10,
  },
  headers: {
    content: '',
    height: 0,
  },
  footers: {
    content: '',
    height: 0,
  },
  textFlowRules: {
    wrapAroundIllustrations: false,
    wrapAroundAds: false,
    multiColumnContinuation: false,
  },
};

export const TOTAL_PAGES = 10;

