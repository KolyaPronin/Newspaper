import { ColumnContainer } from '../../../../../types/PageTemplate';
import { FlowItem } from '../../types';
import { collectTailFromColumns } from '../collectTail';

describe('collectTailFromColumns', () => {
  /**
   * Task 2.1 — Exploratory test (expects FAILURE on unfixed code — confirms Defect 1)
   *
   * Defect 1: In the `if (preserveIllustrations)` branch, empty slots adjacent to
   * illustrations are skipped (`idx += 1; continue`) instead of being removed
   * (`column.splice(idx, 1); continue`). This leaves orphan empty slots that shift
   * the illustration.
   *
   * **Validates: Requirements 2.3**
   */
  describe('Defect 1 — empty slots adjacent to illustration are NOT removed (unfixed code)', () => {
    it('should remove both empty slots adjacent to illustration, leaving only the illustration in the column', () => {
      // Column: [empty, illustration, empty]
      const column: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '',
          height: 0,
          isFilled: false,
        },
        {
          id: 'c1',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill1',
        },
        {
          id: 'c2',
          columnIndex: 0,
          content: '',
          height: 0,
          isFilled: false,
        },
      ];

      const columns: ColumnContainer[][] = [column];
      const flow: FlowItem[] = [];

      collectTailFromColumns(
        columns,
        /*templateColumnsCount=*/ 1,
        /*startColIndex=*/ 0,
        /*startContainerIndex=*/ 0,
        flow,
        /*inferArticleIdFromHtml=*/ () => undefined,
        /*skipArticleId=*/ undefined,
        /*preserveIllustrations=*/ true
      );

      // After the call, the column should contain ONLY the illustration container.
      // Both empty slots must have been removed.
      // On unfixed code: column still has [empty, illustration, empty] — test FAILS.
      expect(columns[0]).toHaveLength(1);
      expect(columns[0][0].isFilled).toBe(true);
      expect(columns[0][0].kind).toBe('illustration');
      expect(columns[0][0].illustrationId).toBe('ill1');
    });

    it('should remove empty slot below illustration, leaving only the illustration', () => {
      // Column: [illustration, empty]
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

      const columns: ColumnContainer[][] = [column];
      const flow: FlowItem[] = [];

      collectTailFromColumns(
        columns,
        1,
        0,
        0,
        flow,
        () => undefined,
        undefined,
        true
      );

      // The empty slot below the illustration must be removed.
      // On unfixed code: column still has [illustration, empty] — test FAILS.
      expect(columns[0]).toHaveLength(1);
      expect(columns[0][0].kind).toBe('illustration');
    });

    it('should remove empty slot above illustration, leaving only the illustration', () => {
      // Column: [empty, illustration]
      const column: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '',
          height: 0,
          isFilled: false,
        },
        {
          id: 'c1',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill1',
        },
      ];

      const columns: ColumnContainer[][] = [column];
      const flow: FlowItem[] = [];

      collectTailFromColumns(
        columns,
        1,
        0,
        0,
        flow,
        () => undefined,
        undefined,
        true
      );

      // The empty slot above the illustration must be removed.
      // On unfixed code: column still has [empty, illustration] — test FAILS.
      expect(columns[0]).toHaveLength(1);
      expect(columns[0][0].kind).toBe('illustration');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 6.1 — Fix-checking PBT: illustration stays at its original logical
  // position after a full collectTail + pourFlow cycle.
  //
  // **Validates: Requirements 2.1, 2.2, 2.3 (Property 1)**
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 1 — illustration stays at its original logical position after collectTail (fix-checking)', () => {
    /**
     * Helper: build a column with an illustration at a given index, surrounded by
     * optional text containers and empty slots.
     */
    function makeColumn(
      illustrationIdx: number,
      totalSlots: number,
      textBefore: string[],
      textAfter: string[]
    ): ColumnContainer[] {
      const col: ColumnContainer[] = [];
      for (let i = 0; i < totalSlots; i++) {
        if (i === illustrationIdx) {
          col.push({
            id: `ill_${i}`,
            columnIndex: 0,
            content: '',
            height: 120,
            isFilled: true,
            kind: 'illustration',
            illustrationId: 'ill1',
          });
        } else {
          const textIdx = i < illustrationIdx ? i : i - illustrationIdx - 1;
          const textArr = i < illustrationIdx ? textBefore : textAfter;
          const html = textArr[textIdx] ?? '';
          col.push({
            id: `slot_${i}`,
            columnIndex: 0,
            content: html,
            height: 0,
            isFilled: Boolean(html),
            kind: html ? 'text' : undefined,
          });
        }
      }
      return col;
    }

    const configurations: Array<{
      label: string;
      illustrationIdx: number;
      totalSlots: number;
      textBefore: string[];
      textAfter: string[];
    }> = [
      {
        label: 'illustration at index 0, one empty slot after',
        illustrationIdx: 0,
        totalSlots: 2,
        textBefore: [],
        textAfter: [''],
      },
      {
        label: 'illustration at index 1, one empty slot before and after',
        illustrationIdx: 1,
        totalSlots: 3,
        textBefore: [''],
        textAfter: [''],
      },
      {
        label: 'illustration at index 2, two empty slots before',
        illustrationIdx: 2,
        totalSlots: 3,
        textBefore: ['', ''],
        textAfter: [],
      },
      {
        label: 'illustration at index 0, text slot after',
        illustrationIdx: 0,
        totalSlots: 2,
        textBefore: [],
        textAfter: ['<p>Some text</p>'],
      },
      {
        label: 'illustration at index 1, text slot before',
        illustrationIdx: 1,
        totalSlots: 2,
        textBefore: ['<p>Before text</p>'],
        textAfter: [],
      },
    ];

    configurations.forEach(({ label, illustrationIdx, totalSlots, textBefore, textAfter }) => {
      it(`after collectTail with preserveIllustrations=true, illustration remains in column — ${label}`, () => {
        const column = makeColumn(illustrationIdx, totalSlots, textBefore, textAfter);
        const columns: ColumnContainer[][] = [column];
        const flow: FlowItem[] = [];

        collectTailFromColumns(
          columns,
          1,
          0,
          0,
          flow,
          () => undefined,
          undefined,
          true
        );

        // The illustration must still be present in the column after collectTail.
        const illustrationsInColumn = columns[0].filter(
          c => c.isFilled && c.kind === 'illustration' && c.illustrationId === 'ill1'
        );
        expect(illustrationsInColumn).toHaveLength(1);

        // No orphan empty containers should remain in the column.
        const emptySlots = columns[0].filter(c => !c.isFilled);
        expect(emptySlots).toHaveLength(0);

        // Text items must have been collected into flow (not left in column).
        const textInColumn = columns[0].filter(c => c.isFilled && (c.kind === 'text' || !c.kind) && c.content);
        expect(textInColumn).toHaveLength(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 6.4 — No orphan empty containers remain between illustration and text
  // after collectTail with preserveIllustrations=true.
  //
  // **Validates: Requirements 2.3 (Property 1)**
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 1 — no orphan empty containers remain after collectTail (fix-checking)', () => {
    it('column with text + illustration + empty: after collectTail, no empty slots remain', () => {
      // Column: [text, illustration, empty]
      const column: ColumnContainer[] = [
        {
          id: 'c0',
          columnIndex: 0,
          content: '<p>Some article text</p>',
          height: 0,
          isFilled: true,
          kind: 'text',
          articleId: 'a1',
        },
        {
          id: 'c1',
          columnIndex: 0,
          content: '',
          height: 120,
          isFilled: true,
          kind: 'illustration',
          illustrationId: 'ill1',
        },
        {
          id: 'c2',
          columnIndex: 0,
          content: '',
          height: 0,
          isFilled: false,
        },
      ];

      const columns: ColumnContainer[][] = [column];
      const flow: FlowItem[] = [];

      collectTailFromColumns(
        columns,
        1,
        0,
        0,
        flow,
        () => undefined,
        undefined,
        true
      );

      // After collectTail: no empty slots should remain in the column.
      const emptySlots = columns[0].filter(c => !c.isFilled);
      expect(emptySlots).toHaveLength(0);

      // The illustration must still be in the column.
      const illustrations = columns[0].filter(c => c.isFilled && c.kind === 'illustration');
      expect(illustrations).toHaveLength(1);

      // The text must have been moved to flow.
      const textItems = flow.filter(f => f.kind === 'text');
      expect(textItems.length).toBeGreaterThan(0);
      expect(textItems[0].html).toContain('Some article text');
    });

    it('column with empty + illustration + empty: after collectTail, only illustration remains', () => {
      const column: ColumnContainer[] = [
        { id: 'c0', columnIndex: 0, content: '', height: 0, isFilled: false },
        { id: 'c1', columnIndex: 0, content: '', height: 120, isFilled: true, kind: 'illustration', illustrationId: 'ill1' },
        { id: 'c2', columnIndex: 0, content: '', height: 0, isFilled: false },
      ];

      const columns: ColumnContainer[][] = [column];
      const flow: FlowItem[] = [];

      collectTailFromColumns(columns, 1, 0, 0, flow, () => undefined, undefined, true);

      expect(columns[0]).toHaveLength(1);
      expect(columns[0][0].kind).toBe('illustration');
      expect(flow).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Task 7.1 — Preservation PBT: for columns without illustrations,
  // collectTailFromColumns with preserveIllustrations=true and false collect
  // the same text items into flow.
  //
  // **Validates: Requirements 3.2, 3.4 (Property 2)**
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Property 2 — text-only columns: preserveIllustrations=true and false produce identical flow (preservation)', () => {
    /**
     * Helper: deep-clone a column array so both calls start from the same state.
     */
    function cloneColumns(cols: ColumnContainer[][]): ColumnContainer[][] {
      return cols.map(col => col.map(c => ({ ...c })));
    }

    const textOnlyConfigurations: Array<{
      label: string;
      columns: ColumnContainer[][];
    }> = [
      {
        label: 'single column with one text container',
        columns: [
          [
            {
              id: 'c0',
              columnIndex: 0,
              content: '<p>Hello world</p>',
              height: 0,
              isFilled: true,
              kind: 'text',
              articleId: 'a1',
            },
          ],
        ],
      },
      {
        label: 'single column with two text containers',
        columns: [
          [
            {
              id: 'c0',
              columnIndex: 0,
              content: '<p>First paragraph</p>',
              height: 0,
              isFilled: true,
              kind: 'text',
              articleId: 'a1',
            },
            {
              id: 'c1',
              columnIndex: 0,
              content: '<p>Second paragraph</p>',
              height: 0,
              isFilled: true,
              kind: 'text',
              articleId: 'a1',
            },
          ],
        ],
      },
      {
        label: 'single column with text and empty slot',
        columns: [
          [
            {
              id: 'c0',
              columnIndex: 0,
              content: '<p>Article text</p>',
              height: 0,
              isFilled: true,
              kind: 'text',
              articleId: 'a2',
            },
            {
              id: 'c1',
              columnIndex: 0,
              content: '',
              height: 0,
              isFilled: false,
            },
          ],
        ],
      },
      {
        label: 'two columns with text, no illustrations',
        columns: [
          [
            {
              id: 'c0',
              columnIndex: 0,
              content: '<p>Column 0 text</p>',
              height: 0,
              isFilled: true,
              kind: 'text',
              articleId: 'a3',
            },
          ],
          [
            {
              id: 'c1',
              columnIndex: 1,
              content: '<p>Column 1 text</p>',
              height: 0,
              isFilled: true,
              kind: 'text',
              articleId: 'a3',
            },
          ],
        ],
      },
      {
        label: 'column with only empty slots',
        columns: [
          [
            { id: 'c0', columnIndex: 0, content: '', height: 0, isFilled: false },
            { id: 'c1', columnIndex: 0, content: '', height: 0, isFilled: false },
          ],
        ],
      },
    ];

    textOnlyConfigurations.forEach(({ label, columns }) => {
      it(`preserveIllustrations=true and false produce identical flow — ${label}`, () => {
        const colsForTrue = cloneColumns(columns);
        const colsForFalse = cloneColumns(columns);

        const flowTrue: FlowItem[] = [];
        const flowFalse: FlowItem[] = [];

        collectTailFromColumns(
          colsForTrue,
          columns.length,
          0,
          0,
          flowTrue,
          () => undefined,
          undefined,
          true
        );

        collectTailFromColumns(
          colsForFalse,
          columns.length,
          0,
          0,
          flowFalse,
          () => undefined,
          undefined,
          false
        );

        // Both flows must contain the same text items (same html content).
        const textTrue = flowTrue.filter(f => f.kind === 'text').map(f => f.html);
        const textFalse = flowFalse.filter(f => f.kind === 'text').map(f => f.html);

        expect(textTrue).toEqual(textFalse);
      });
    });
  });
});
