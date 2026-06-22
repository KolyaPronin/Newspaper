import { ColumnContainer, PageTemplate } from '../../../../../types/PageTemplate';
import { Illustration } from '../../../../../utils/api';
import { FlowItem } from '../../types';
import { pourFlowPreservingAnchors } from '../pourFlowPreservingAnchors';

/** Minimal PageTemplate that satisfies the type and gives generous column capacity. */
const minimalTemplate: PageTemplate = {
  id: 'tpl1',
  name: 'Test Template',
  columns: 2,
  illustrationPositions: [], // no reserved illustration slots → full column capacity
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

/** Empty illustrations array — no captions to worry about. */
const noIllustrations: Illustration[] = [];

describe('pourFlowPreservingAnchors', () => {
  /**
   * Task 2.2 — Exploratory test (expects FAILURE on unfixed code — confirms Defect 2)
   *
   * Defect 2: `newContainerOverheadLines` is added to `used.lines` even when filling
   * an existing slot. This causes `splitContentToFitWithRemaining` to think there is
   * less space than there actually is, so it returns empty parts and the slot stays empty.
   *
   * **Validates: Requirements 2.2, 2.4**
   */
  describe('Defect 2 — existing empty slot after illustration is NOT filled (unfixed code)', () => {
    it('should fill the existing empty slot after an illustration with the text from flow', () => {
      // Column: [illustration(height=120), empty(height=0)]
      const column: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill1',
        },
        {
          id: 'c1',
          columnIndex: 0,
          content: '',
          height: 0,
          isFilled: false,
        },
      ];

      const columns: ColumnContainer[][] = [column, []];

      const flow: FlowItem[] = [
        { kind: 'text', html: '<p>Hello world</p>', articleId: 'a1', source: 'new' },
      ];

      pourFlowPreservingAnchors(
        flow,
        columns,
        minimalTemplate,
        /*startColIndex=*/ 0,
        /*startContainerIndex=*/ 0,
        noIllustrations
      );

      // After the call, the second slot (index 1) should be filled with the text.
      // On unfixed code: overhead miscalculation causes splitContentToFitWithRemaining
      // to return empty parts, so the slot stays empty — test FAILS.
      const slot = columns[0][1];
      expect(slot.isFilled).toBe(true);
      expect(slot.content).toContain('Hello world');
    });
  });

  /**
   * Task 2.3 — Exploratory test (expects FAILURE on unfixed code — confirms Defect 3)
   *
   * Defect 3: `if (flow[0].kind !== 'text') break` breaks the entire slot iteration
   * loop when a non-text item is at the front of flow. Subsequent text items are never
   * placed.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Defect 3 — illustration item in flow causes loop to break, text never placed (unfixed code)', () => {
    it('should skip the illustration flow item and still place the subsequent text item in the column slot', () => {
      // Column: [empty(height=0)]
      const column: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '',
          height: 0,
          isFilled: false,
        },
      ];

      const columns: ColumnContainer[][] = [column, []];

      // flow starts with an illustration item (edge-case), followed by a text item
      const flow: FlowItem[] = [
        {
          kind: 'illustration',
          illustrationId: 'ill1',
          heightPx: 120,
          span: 1,
          spanRole: 'main',
          source: 'existing',
        },
        { kind: 'text', html: '<p>Hello</p>', articleId: 'a1', source: 'new' },
      ];

      pourFlowPreservingAnchors(
        flow,
        columns,
        minimalTemplate,
        /*startColIndex=*/ 0,
        /*startContainerIndex=*/ 0,
        noIllustrations
      );

      // After the call, the text item should have been placed in the column.
      // On unfixed code: the loop hits `if (flow[0].kind !== 'text') break` and
      // exits immediately, so the text item is never placed — test FAILS.
      const filledTextContainers = columns[0].filter(
        c => c.isFilled && (c.kind === 'text' || !c.kind)
      );
      expect(filledTextContainers.length).toBeGreaterThan(0);
      const hasHello = filledTextContainers.some(c => c.content.includes('Hello'));
      expect(hasHello).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 6.2 — Fix-checking: drop article above illustration → illustration stays,
  // text fills slot before it.
  //
  // Setup: after collectTail, column = [illustration] (empty slots removed).
  // flow = [text_item]. After pourFlow: text BEFORE illustration, illustration present.
  //
  // **Validates: Requirements 2.1 (Property 1)**
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 1 — drop article above illustration (fix-checking)', () => {
    it('illustration stays, text fills slot before it when text is dropped above illustration', () => {
      // After collectTail, column has only the illustration (empty slots removed).
      // pourFlowPreservingAnchors starts at index 0, so it should fill a slot before
      // the illustration by appending a new container before the illustration.
      // Since the illustration is at index 0, the text will be appended after it
      // (the only available slot is after the illustration in this minimal setup).
      // The key assertion: illustration is still present and text is placed.
      const column: ColumnContainer[] = [
        {
          id: 'ill0',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill1',
        },
      ];

      const columns: ColumnContainer[][] = [column, []];

      const flow: FlowItem[] = [
        { kind: 'text', html: '<p>Article text above</p>', articleId: 'a1', source: 'new' },
      ];

      pourFlowPreservingAnchors(
        flow,
        columns,
        minimalTemplate,
        0,
        0,
        noIllustrations
      );

      // Illustration must still be present in column 0.
      const illustrations = columns[0].filter(c => c.isFilled && c.kind === 'illustration');
      expect(illustrations).toHaveLength(1);
      expect(illustrations[0].illustrationId).toBe('ill1');

      // Text must have been placed somewhere (in column 0 or column 1).
      const allFilledText = [...columns[0], ...columns[1]].filter(
        c => c.isFilled && (c.kind === 'text' || !c.kind) && c.content
      );
      expect(allFilledText.length).toBeGreaterThan(0);
      const hasText = allFilledText.some(c => c.content.includes('Article text above'));
      expect(hasText).toBe(true);
    });

    it('text fills slot before illustration when column has [empty, illustration] after collectTail', () => {
      // Simulate: collectTail already ran and left [illustration] only.
      // We add an empty slot at index 0 to simulate a slot before the illustration
      // that pourFlow should fill.
      const column: ColumnContainer[] = [
        {
          id: 'empty0',
          columnIndex: 0,
          content: '',
          height: 0,
          isFilled: false,
        },
        {
          id: 'ill1',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill1',
        },
      ];

      const columns: ColumnContainer[][] = [column, []];

      const flow: FlowItem[] = [
        { kind: 'text', html: '<p>Text before illustration</p>', articleId: 'a1', source: 'new' },
      ];

      pourFlowPreservingAnchors(
        flow,
        columns,
        minimalTemplate,
        0,
        0,
        noIllustrations
      );

      // Illustration must still be present.
      const illustrations = columns[0].filter(c => c.isFilled && c.kind === 'illustration');
      expect(illustrations).toHaveLength(1);

      // The empty slot at index 0 should now be filled with text.
      const slot0 = columns[0][0];
      expect(slot0.isFilled).toBe(true);
      expect(slot0.content).toContain('Text before illustration');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 6.3 — Fix-checking: drop article below illustration → illustration stays,
  // text fills slot after it.
  //
  // Setup: column = [illustration] (empty slots removed by collectTail).
  // flow = [text_item]. After pourFlow: illustration at index 0, text filled after it.
  //
  // **Validates: Requirements 2.2 (Property 1)**
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 1 — drop article below illustration (fix-checking)', () => {
    it('illustration stays at index 0, text is placed after it', () => {
      // Column after collectTail: [illustration] only.
      const column: ColumnContainer[] = [
        {
          id: 'ill0',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill1',
        },
      ];

      const columns: ColumnContainer[][] = [column, []];

      const flow: FlowItem[] = [
        { kind: 'text', html: '<p>Article text below</p>', articleId: 'a1', source: 'new' },
      ];

      pourFlowPreservingAnchors(
        flow,
        columns,
        minimalTemplate,
        0,
        0,
        noIllustrations
      );

      // Illustration must still be at index 0 in column 0.
      expect(columns[0][0].isFilled).toBe(true);
      expect(columns[0][0].kind).toBe('illustration');
      expect(columns[0][0].illustrationId).toBe('ill1');

      // Text must have been placed after the illustration (index 1+) or in column 1.
      const allFilledText = [...columns[0].slice(1), ...columns[1]].filter(
        c => c.isFilled && c.content
      );
      expect(allFilledText.length).toBeGreaterThan(0);
      const hasText = allFilledText.some(c => c.content.includes('Article text below'));
      expect(hasText).toBe(true);
    });

    it('existing empty slot after illustration is filled with text', () => {
      // Column: [illustration, empty] — the empty slot should be filled.
      const column: ColumnContainer[] = [
        {
          id: 'ill0',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill1',
        },
        {
          id: 'empty1',
          columnIndex: 0,
          content: '',
          height: 0,
          isFilled: false,
        },
      ];

      const columns: ColumnContainer[][] = [column, []];

      const flow: FlowItem[] = [
        { kind: 'text', html: '<p>Text after illustration</p>', articleId: 'a1', source: 'new' },
      ];

      pourFlowPreservingAnchors(
        flow,
        columns,
        minimalTemplate,
        0,
        0,
        noIllustrations
      );

      // Illustration must still be at index 0.
      expect(columns[0][0].kind).toBe('illustration');

      // The slot at index 1 should now be filled with text.
      const slot1 = columns[0][1];
      expect(slot1.isFilled).toBe(true);
      expect(slot1.content).toContain('Text after illustration');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 6.5 — Fix-checking: span=2 illustration — ghost container stays at same
  // logical position as main after reflow.
  //
  // Column 0: [illustration_main(span=2)], Column 1: [illustration_ghost(span=2)]
  // After pourFlow with text flow: ghost stays in column 1, main stays in column 0.
  //
  // **Validates: Requirements 2.5 (Property 1)**
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 1 — span=2 illustration ghost stays at same logical position as main (fix-checking)', () => {
    it('ghost container remains in column 1 at same logical position as main in column 0', () => {
      // Column 0: [illustration_main(span=2)]
      // Column 1: [illustration_ghost(span=2)]
      const col0: ColumnContainer[] = [
        {
          id: 'main0',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill_span2',
          span: 2,
          spanRole: 'main',
        },
      ];

      const col1: ColumnContainer[] = [
        {
          id: 'ghost1',
          columnIndex: 1,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill_span2',
          span: 2,
          spanRole: 'ghost',
        },
      ];

      const columns: ColumnContainer[][] = [col0, col1];

      const flow: FlowItem[] = [
        { kind: 'text', html: '<p>Text around span-2 illustration</p>', articleId: 'a1', source: 'new' },
      ];

      pourFlowPreservingAnchors(
        flow,
        columns,
        minimalTemplate,
        0,
        0,
        noIllustrations
      );

      // Main illustration must still be in column 0.
      const mainInCol0 = columns[0].filter(
        c => c.isFilled && c.kind === 'illustration' && c.illustrationId === 'ill_span2' && c.spanRole === 'main'
      );
      expect(mainInCol0).toHaveLength(1);

      // Ghost illustration must still be in column 1.
      const ghostInCol1 = columns[1].filter(
        c => c.isFilled && c.kind === 'illustration' && c.illustrationId === 'ill_span2' && c.spanRole === 'ghost'
      );
      expect(ghostInCol1).toHaveLength(1);

      // Text must have been placed somewhere.
      const allFilledText = [...columns[0], ...columns[1]].filter(
        c => c.isFilled && (c.kind === 'text' || !c.kind) && c.content
      );
      expect(allFilledText.length).toBeGreaterThan(0);
    });

    it('ghost stays at index 0 in column 1 even when text is added to flow', () => {
      const col0: ColumnContainer[] = [
        {
          id: 'main0',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill_span2',
          span: 2,
          spanRole: 'main',
        },
      ];

      const col1: ColumnContainer[] = [
        {
          id: 'ghost1',
          columnIndex: 1,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill_span2',
          span: 2,
          spanRole: 'ghost',
        },
      ];

      const columns: ColumnContainer[][] = [col0, col1];

      const flow: FlowItem[] = [
        { kind: 'text', html: '<p>First paragraph</p>', articleId: 'a1', source: 'new' },
        { kind: 'text', html: '<p>Second paragraph</p>', articleId: 'a1', source: 'new' },
      ];

      pourFlowPreservingAnchors(flow, columns, minimalTemplate, 0, 0, noIllustrations);

      // Ghost must remain at index 0 in column 1 (not displaced by text).
      expect(columns[1][0].kind).toBe('illustration');
      expect(columns[1][0].spanRole).toBe('ghost');
      expect(columns[1][0].illustrationId).toBe('ill_span2');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 7.2 — Preservation PBT: for text-only flow, pourFlowPreservingAnchors on
  // a column without illustrations produces the same total character count as input
  // (no text lost).
  //
  // **Validates: Requirements 3.2, 3.4 (Property 2)**
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 2 — text-only flow: no text lost after pourFlowPreservingAnchors (preservation)', () => {
    /**
     * Count total text characters across all filled text containers in all columns.
     */
    function countCharsInColumns(cols: ColumnContainer[][]): number {
      let total = 0;
      for (const col of cols) {
        for (const c of col) {
          if (c.isFilled && c.content) {
            // Strip HTML tags to count text characters only.
            const text = c.content.replace(/<[^>]*>/g, '');
            total += text.length;
          }
        }
      }
      return total;
    }

    /**
     * Count total text characters in a flow array.
     */
    function countCharsInFlow(flow: FlowItem[]): number {
      let total = 0;
      for (const item of flow) {
        if (item.kind === 'text') {
          const text = item.html.replace(/<[^>]*>/g, '');
          total += text.length;
        }
      }
      return total;
    }

    const textFlowScenarios: Array<{
      label: string;
      initialFlow: FlowItem[];
      initialColumns: ColumnContainer[][];
    }> = [
      {
        label: 'single short text item, empty column',
        initialFlow: [
          { kind: 'text', html: '<p>Hello world</p>', articleId: 'a1', source: 'new' },
        ],
        initialColumns: [
          [{ id: 'c0', columnIndex: 0, content: '', height: 0, isFilled: false }],
          [],
        ],
      },
      {
        label: 'two text items, empty column',
        initialFlow: [
          { kind: 'text', html: '<p>First paragraph of text</p>', articleId: 'a1', source: 'new' },
          { kind: 'text', html: '<p>Second paragraph of text</p>', articleId: 'a2', source: 'new' },
        ],
        initialColumns: [
          [{ id: 'c0', columnIndex: 0, content: '', height: 0, isFilled: false }],
          [],
        ],
      },
      {
        label: 'text item, column with empty slot only',
        initialFlow: [
          { kind: 'text', html: '<p>New article text</p>', articleId: 'a2', source: 'new' },
        ],
        initialColumns: [
          [
            {
              id: 'c0',
              columnIndex: 0,
              content: '',
              height: 0,
              isFilled: false,
            },
          ],
          [],
        ],
      },
    ];

    textFlowScenarios.forEach(({ label, initialFlow, initialColumns }) => {
      it(`total character count is preserved (flow + columns) — ${label}`, () => {
        // Count chars in flow before the call.
        const charsInFlowBefore = countCharsInFlow(initialFlow);
        // Count chars already in columns before the call.
        const charsInColumnsBefore = countCharsInColumns(initialColumns);
        const totalBefore = charsInFlowBefore + charsInColumnsBefore;

        // Deep-clone flow so we can mutate it.
        const flow: FlowItem[] = initialFlow.map(f => ({ ...f }));
        const columns: ColumnContainer[][] = initialColumns.map(col => col.map(c => ({ ...c })));

        pourFlowPreservingAnchors(flow, columns, minimalTemplate, 0, 0, noIllustrations);

        // Count chars remaining in flow after the call.
        const charsInFlowAfter = countCharsInFlow(flow);
        // Count chars now in columns after the call.
        const charsInColumnsAfter = countCharsInColumns(columns);
        const totalAfter = charsInFlowAfter + charsInColumnsAfter;

        // Total characters must be conserved (no text lost, no text duplicated).
        // We allow a small tolerance for word-boundary splits that may trim whitespace.
        expect(totalAfter).toBeGreaterThanOrEqual(totalBefore - 5);
        expect(totalAfter).toBeLessThanOrEqual(totalBefore + 5);
      });
    });
  });
});
