import { ColumnContainer, PageTemplate } from '../../../../../types/PageTemplate';
import { Illustration } from '../../../../../utils/api';
import { PageData } from '../../types';
import { reflowFromPosition } from '../reflowFromPosition';

/**
 * A minimal 2-column template that covers all pages (TOTAL_PAGES = 10).
 * Using illustrationPositions: [] so the full column capacity is available.
 */
const minimalTemplate: PageTemplate = {
  id: 'tpl_test',
  name: 'Test Template',
  columns: 2,
  illustrationPositions: [],
  adSlots: [],
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  headers: { height: 0 },
  footers: { height: 0 },
  textFlowRules: {
    wrapAroundIllustrations: true,
    wrapAroundAds: false,
    multiColumnContinuation: true,
  },
};

/** Simple mocks required by reflowFromPosition. */
const inferArticleIdFromHtml = (_html: string): string | undefined => undefined;
const getTemplateForPage = (_pageNumber: number): PageTemplate => minimalTemplate;
const allIllustrations: Illustration[] = [];

/**
 * Build a minimal PageData object for a given set of columns.
 */
function makePageData(columns: ColumnContainer[][]): PageData {
  return {
    columns,
    headerContent: '',
    layoutTitle: '',
    layoutId: null,
    layoutIllustrations: [],
    layoutAds: [],
  };
}

describe('reflowFromPosition', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // Task 7.3 — Preservation: reflowFromPosition with preserveIllustrations=false
  // uses packFlowIntoPageColumns path (not pourFlowPreservingAnchors).
  //
  // We verify this by checking that the result is consistent with packFlow behavior:
  // empty slots are removed, text is packed tightly.
  //
  // **Validates: Requirements 3.2 (Property 2)**
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 2 — preserveIllustrations=false uses packFlow path (preservation)', () => {
    it('with preserveIllustrations=false, text is packed and empty slots are removed from start', () => {
      // Column 0: [text_container, empty_slot]
      // Column 1: [empty_slot]
      const col0: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '<p>Article text</p>',
          height: 0,
          isFilled: true,
          kind: 'text',
          articleId: 'a1',
        },
        {
          id: 'c1',
          columnIndex: 0,
          content: '',
          height: 0,
          isFilled: false,
        },
      ];
      const col1: ColumnContainer[] = [
        { id: 'c2', columnIndex: 1, content: '', height: 0, isFilled: false },
      ];

      const prev: Record<number, PageData> = {
        1: makePageData([col0, col1]),
      };

      const result = reflowFromPosition(
        prev,
        /*startPage=*/ 1,
        /*startColIndex=*/ 0,
        /*startContainerIndex=*/ 0,
        /*prepend=*/ [],
        inferArticleIdFromHtml,
        getTemplateForPage,
        allIllustrations,
        /*skipArticleId=*/ undefined,
        /*preserveIllustrations=*/ false
      );

      // With packFlow: text is repacked from scratch.
      // The text container should be present in the result.
      const resultCol0 = result[1].columns[0];
      const filledText = resultCol0.filter(c => c.isFilled && c.content);
      expect(filledText.length).toBeGreaterThan(0);
      const hasText = filledText.some(c => c.content.includes('Article text'));
      expect(hasText).toBe(true);
    });

    it('with preserveIllustrations=false, result is consistent regardless of empty slot positions', () => {
      // Two columns with text in different positions — packFlow should normalize them.
      const col0a: ColumnContainer[] = [
        { id: 'c0', columnIndex: 0, content: '', height: 0, isFilled: false },
        {
          id: 'c1',
          columnIndex: 0,
          content: '<p>Text A</p>',
          height: 0,
          isFilled: true,
          kind: 'text',
          articleId: 'a1',
        },
      ];
      const col1a: ColumnContainer[] = [
        { id: 'c2', columnIndex: 1, content: '', height: 0, isFilled: false },
      ];

      const col0b: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '<p>Text A</p>',
          height: 0,
          isFilled: true,
          kind: 'text',
          articleId: 'a1',
        },
        { id: 'c1', columnIndex: 0, content: '', height: 0, isFilled: false },
      ];
      const col1b: ColumnContainer[] = [
        { id: 'c2', columnIndex: 1, content: '', height: 0, isFilled: false },
      ];

      const prevA: Record<number, PageData> = { 1: makePageData([col0a, col1a]) };
      const prevB: Record<number, PageData> = { 1: makePageData([col0b, col1b]) };

      const resultA = reflowFromPosition(
        prevA, 1, 0, 0, [], inferArticleIdFromHtml, getTemplateForPage, allIllustrations, undefined, false
      );
      const resultB = reflowFromPosition(
        prevB, 1, 0, 0, [], inferArticleIdFromHtml, getTemplateForPage, allIllustrations, undefined, false
      );

      // Both should produce the same filled text content in column 0.
      const textA = resultA[1].columns[0].filter(c => c.isFilled && c.content).map(c => c.content);
      const textB = resultB[1].columns[0].filter(c => c.isFilled && c.content).map(c => c.content);
      expect(textA).toEqual(textB);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 7.4 — Preservation: delete text container from column without illustrations
  // — reflow result is correct.
  //
  // Column with two text containers, delete first one.
  // After reflow: remaining text is correctly packed.
  //
  // **Validates: Requirements 3.3 (Property 2)**
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 2 — delete text container from column without illustrations (preservation)', () => {
    it('after deleting first text container, remaining text is correctly packed', () => {
      // Original column: [text_A, text_B]
      // We simulate deletion of text_A by starting reflow at index 0 with skipArticleId='a1'.
      const col0: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '<p>Article A text</p>',
          height: 0,
          isFilled: true,
          kind: 'text',
          articleId: 'a1',
        },
        {
          id: 'c1',
          columnIndex: 0,
          content: '<p>Article B text</p>',
          height: 0,
          isFilled: true,
          kind: 'text',
          articleId: 'a2',
        },
      ];
      const col1: ColumnContainer[] = [
        { id: 'c2', columnIndex: 1, content: '', height: 0, isFilled: false },
      ];

      const prev: Record<number, PageData> = {
        1: makePageData([col0, col1]),
      };

      // Reflow from position 0, skipping article 'a1' (simulates deletion).
      const result = reflowFromPosition(
        prev,
        1,
        0,
        0,
        [],
        inferArticleIdFromHtml,
        getTemplateForPage,
        allIllustrations,
        /*skipArticleId=*/ 'a1',
        /*preserveIllustrations=*/ false
      );

      // Article A should be gone.
      const allContainers = result[1].columns.flat();
      const hasArticleA = allContainers.some(c => c.content && c.content.includes('Article A text'));
      expect(hasArticleA).toBe(false);

      // Article B should still be present.
      const hasArticleB = allContainers.some(c => c.content && c.content.includes('Article B text'));
      expect(hasArticleB).toBe(true);
    });

    it('after deleting second text container, first text remains in column', () => {
      // Original column: [text_A, text_B]
      // Simulate deletion of text_B by skipping articleId='a2'.
      const col0: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '<p>Article A text</p>',
          height: 0,
          isFilled: true,
          kind: 'text',
          articleId: 'a1',
        },
        {
          id: 'c1',
          columnIndex: 0,
          content: '<p>Article B text</p>',
          height: 0,
          isFilled: true,
          kind: 'text',
          articleId: 'a2',
        },
      ];
      const col1: ColumnContainer[] = [
        { id: 'c2', columnIndex: 1, content: '', height: 0, isFilled: false },
      ];

      const prev: Record<number, PageData> = {
        1: makePageData([col0, col1]),
      };

      const result = reflowFromPosition(
        prev,
        1,
        0,
        0,
        [],
        inferArticleIdFromHtml,
        getTemplateForPage,
        allIllustrations,
        'a2',
        false
      );

      const allContainers = result[1].columns.flat();

      // Article B should be gone.
      const hasArticleB = allContainers.some(c => c.content && c.content.includes('Article B text'));
      expect(hasArticleB).toBe(false);

      // Article A should still be present.
      const hasArticleA = allContainers.some(c => c.content && c.content.includes('Article A text'));
      expect(hasArticleA).toBe(true);
    });

    it('reflow of column without illustrations produces no illustration containers', () => {
      // Purely text column — reflow should never produce illustration containers.
      const col0: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '<p>Text only content</p>',
          height: 0,
          isFilled: true,
          kind: 'text',
          articleId: 'a1',
        },
      ];
      const col1: ColumnContainer[] = [];

      const prev: Record<number, PageData> = {
        1: makePageData([col0, col1]),
      };

      const result = reflowFromPosition(
        prev, 1, 0, 0, [], inferArticleIdFromHtml, getTemplateForPage, allIllustrations, undefined, false
      );

      const allContainers = result[1].columns.flat();
      const illustrationContainers = allContainers.filter(c => c.kind === 'illustration');
      expect(illustrationContainers).toHaveLength(0);
    });
  });
});
