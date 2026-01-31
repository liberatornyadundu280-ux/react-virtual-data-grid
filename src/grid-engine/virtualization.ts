/**
 * Virtualization Engine
 *
 * Calculates which rows and columns should be rendered based on scroll position.
 * This is the core performance optimization that allows 50,000+ rows.
 *
 * Key Principle: Only render what's visible + small overscan buffer.
 *
 * Performance: O(1) for row calculations, O(log n) for column calculations.
 */

import type { RowRange, ColumnRange, ColumnMetrics, GridColumn } from "./types";

/**
 * Calculate which rows are visible in the current viewport.
 *
 * Algorithm:
 * 1. Divide scrollTop by rowHeight to get first visible row
 * 2. Divide viewport height by rowHeight to get visible row count
 * 3. Add overscan buffer to reduce flashing during scroll
 * 4. Clamp to valid bounds [0, totalRows - 1]
 *
 * Example:
 *   scrollTop = 4000px
 *   rowHeight = 40px
 *   viewportHeight = 600px
 *   overscan = 5
 *
 *   startRow = floor(4000 / 40) - 5 = 100 - 5 = 95
 *   endRow = ceil((4000 + 600) / 40) + 5 = 115 + 5 = 120
 *
 *   Result: Render rows 95-120 (26 rows total)
 *
 * @param scrollTop - Pixels scrolled from top
 * @param rowHeight - Fixed height of each row in pixels
 * @param viewportHeight - Height of visible area in pixels
 * @param totalRows - Total number of rows in dataset
 * @param overscan - Extra rows to render above/below (default: 5)
 * @returns Range of rows to render (inclusive)
 */
export function calculateVisibleRows(
  scrollTop: number,
  rowHeight: number,
  viewportHeight: number,
  totalRows: number,
  overscan: number = 5,
): RowRange {
  // Calculate first visible row (floor division)
  const firstVisibleRow = Math.floor(scrollTop / rowHeight);

  // Calculate last visible row (ceiling division)
  const lastVisibleRow = Math.ceil((scrollTop + viewportHeight) / rowHeight);

  // Add overscan buffer
  const startRow = Math.max(0, firstVisibleRow - overscan);
  const endRow = Math.min(totalRows - 1, lastVisibleRow + overscan);

  return { startRow, endRow };
}

/**
 * Pre-compute cumulative column offsets for fast positioning.
 *
 * Transforms: [150, 200, 100] → [0, 150, 350, 450]
 *
 * Why: Allows O(1) lookup of "what x-coordinate does column N start at?"
 *
 * Example:
 *   Column 0: starts at offset[0] = 0
 *   Column 1: starts at offset[1] = 150
 *   Column 2: starts at offset[2] = 350
 *
 * @param columns - Array of column definitions
 * @returns Cumulative offset array (length = columns.length + 1)
 */
export function computeColumnOffsets(
  columns: readonly GridColumn[],
): readonly number[] {
  const offsets: number[] = [0];

  let cumulative = 0;
  for (const column of columns) {
    cumulative += column.width;
    offsets.push(cumulative);
  }

  return offsets;
}

/**
 * Calculate full column metrics (offsets, widths, pinned info).
 *
 * This is called once when schema changes, then cached.
 *
 * @param columns - Array of column definitions
 * @returns Complete column metrics for layout calculations
 */
export function calculateColumnMetrics(
  columns: readonly GridColumn[],
): ColumnMetrics {
  const offsets = computeColumnOffsets(columns);
  const totalWidth = offsets[offsets.length - 1] ?? 0;

  // Calculate pinned column metrics
  let pinnedCount = 0;
  let pinnedWidth = 0;

  for (const column of columns) {
    if (column.pinned) {
      pinnedCount++;
      pinnedWidth += column.width;
    } else {
      break; // Pinned columns must be contiguous from the left
    }
  }

  return {
    offsets,
    totalWidth,
    pinnedWidth,
    pinnedCount,
  };
}

/**
 * Binary search to find first column visible at given scroll position.
 *
 * Why binary search: With 100+ columns, linear search is too slow.
 * Binary search is O(log n) vs O(n).
 *
 * Algorithm: Find largest index where offsets[i] <= scrollLeft
 *
 * Example:
 *   offsets = [0, 150, 300, 450, 600]
 *   scrollLeft = 320
 *
 *   Search: offsets[2] = 300 <= 320 < offsets[3] = 450
 *   Result: Column 2 is first visible
 *
 * @param scrollLeft - Horizontal scroll position
 * @param offsets - Pre-computed column offsets
 * @returns Index of first visible column
 */
function findFirstVisibleColumn(
  scrollLeft: number,
  offsets: readonly number[],
): number {
  let left = 0;
  let right = offsets.length - 1;
  let result = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const offset = offsets[mid];

    if (offset === undefined) break;

    if (offset <= scrollLeft) {
      result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

/**
 * Find last column visible at given scroll position + viewport width.
 *
 * Algorithm: Find smallest index where offsets[i] >= scrollLeft + viewportWidth
 *
 * @param scrollRight - Right edge of viewport (scrollLeft + viewportWidth)
 * @param offsets - Pre-computed column offsets
 * @returns Index of last visible column
 */
function findLastVisibleColumn(
  scrollRight: number,
  offsets: readonly number[],
): number {
  let left = 0;
  let right = offsets.length - 1;
  let result = offsets.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const offset = offsets[mid];

    if (offset === undefined) break;

    if (offset < scrollRight) {
      left = mid + 1;
    } else {
      result = mid;
      right = mid - 1;
    }
  }

  // Adjust for column width (we need the column that contains scrollRight)
  return Math.max(0, result - 1);
}

/**
 * Calculate which columns are visible in the current viewport.
 *
 * Supports two modes:
 * 1. Schema mode (default): Searches within defined schema columns
 * 2. Infinite mode: Calculates columns mathematically (Excel-like)
 *
 * Handles both pinned and scrollable columns:
 * - Pinned columns are ALWAYS visible (indices 0 to pinnedCount - 1)
 * - Scrollable columns are calculated based on scroll position
 *
 * Note: This function returns the scrollable column range only.
 * Pinned columns are handled separately in the layout engine.
 *
 * @param scrollLeft - Horizontal scroll position
 * @param viewportWidth - Width of visible area
 * @param columnMetrics - Pre-computed column metrics
 * @param overscan - Extra columns to render (default: 2)
 * @param mode - 'schema' for bounded columns, 'infinite' for unbounded
 * @param defaultColumnWidth - Width for infinite columns (default: 150)
 * @returns Range of scrollable columns to render
 */
export function calculateVisibleColumns(
  scrollLeft: number,
  viewportWidth: number,
  columnMetrics: ColumnMetrics,
  overscan: number = 2,
  mode: "schema" | "infinite" = "schema",
  defaultColumnWidth: number = 150,
): ColumnRange {
  const { offsets, pinnedCount, pinnedWidth } = columnMetrics;

  // Adjust scroll position to account for pinned columns
  const scrollableScrollLeft = scrollLeft;
  const scrollableViewportWidth = viewportWidth - pinnedWidth;

  if (mode === "infinite") {
    // Infinite mode: Calculate columns mathematically (like rows)
    // This allows unbounded horizontal scrolling
    const firstVisibleCol = Math.floor(
      scrollableScrollLeft / defaultColumnWidth,
    );
    const lastVisibleCol = Math.ceil(
      (scrollableScrollLeft + scrollableViewportWidth) / defaultColumnWidth,
    );

    // Add overscan buffer
    let startCol = Math.max(pinnedCount, firstVisibleCol - overscan);
    let endCol = lastVisibleCol + overscan;

    return { startCol, endCol };
  }

  // Schema mode: Search within defined columns (existing behavior)
  const scrollRight = scrollableScrollLeft + scrollableViewportWidth;

  let startCol = findFirstVisibleColumn(scrollableScrollLeft, offsets);
  let endCol = findLastVisibleColumn(scrollRight, offsets);

  // Ensure we don't include pinned columns in scrollable range
  startCol = Math.max(pinnedCount, startCol);
  endCol = Math.max(pinnedCount, endCol);

  // Add overscan buffer
  startCol = Math.max(pinnedCount, startCol - overscan);
  endCol = Math.min(offsets.length - 2, endCol + overscan);

  return { startCol, endCol };
}

/**
 * Calculate the Y-coordinate for a row at given index.
 *
 * Simple formula: rowIndex * rowHeight
 *
 * Used with CSS transform: translateY(offset)
 *
 * @param rowIndex - Zero-based row index
 * @param rowHeight - Fixed row height in pixels
 * @returns Y-coordinate in pixels
 */
export function getRowOffset(rowIndex: number, rowHeight: number): number {
  return rowIndex * rowHeight;
}

/**
 * Calculate the X-coordinate for a column at given index.
 *
 * Looks up pre-computed offset in constant time.
 *
 * Used with CSS transform: translateX(offset - scrollLeft)
 *
 * @param colIndex - Zero-based column index
 * @param offsets - Pre-computed column offsets
 * @returns X-coordinate in pixels
 */
export function getColumnOffset(
  colIndex: number,
  offsets: readonly number[],
): number {
  return offsets[colIndex] ?? 0;
}

/**
 * Calculate column offset for infinite column mode.
 *
 * When columns extend beyond schema, calculate position mathematically.
 *
 * @param colIndex - Zero-based column index
 * @param defaultColumnWidth - Width for undefined columns
 * @returns X-coordinate in pixels
 */
export function getColumnOffsetInfinite(
  colIndex: number,
  defaultColumnWidth: number = 150,
): number {
  return colIndex * defaultColumnWidth;
}

/**
 * Calculate total height of virtual scroll container.
 *
 * This creates the scrollable area. Browser's scrollbar appears based on this.
 *
 * Example: 50,000 rows * 40px = 2,000,000px tall container
 *
 * @param totalRows - Number of rows in dataset
 * @param rowHeight - Fixed row height
 * @returns Total container height in pixels
 */
export function getTotalHeight(totalRows: number, rowHeight: number): number {
  return totalRows * rowHeight;
}

/**
 * Generate a default column definition for columns beyond schema.
 *
 * Used in infinite column mode when column index exceeds schema.columns.length.
 * Creates Excel-like column labels: A, B, C, ... Z, AA, AB, ...
 *
 * @param colIndex - Zero-based column index
 * @param defaultWidth - Width for generated column (default: 150)
 * @returns Column definition
 */
export function generateDefaultColumn(
  colIndex: number,
  defaultWidth: number = 150,
): GridColumn {
  // Convert column index to Excel-style label (A, B, C, ... Z, AA, AB, ...)
  let label = "";
  let num = colIndex;

  while (num >= 0) {
    label = String.fromCharCode(65 + (num % 26)) + label;
    num = Math.floor(num / 26) - 1;
  }

  return {
    id: `col_${colIndex}`,
    label: label,
    width: defaultWidth,
    pinned: false,
    editable: true, // Make infinite columns editable
    type: "text",
  };
}

/**
 * Calculate total width for infinite column mode.
 *
 * For infinite columns, we need a very large (but not infinite) scroll width.
 * Use a practical limit that simulates infinity.
 *
 * @param visibleColumns - Maximum visible column index
 * @param defaultColumnWidth - Width per column
 * @param bufferMultiplier - How many viewports ahead to allocate (default: 10)
 * @returns Total container width in pixels
 */
export function getTotalWidthInfinite(
  visibleColumns: number,
  defaultColumnWidth: number = 150,
  bufferMultiplier: number = 10,
): number {
  // Allocate width for visible columns + buffer
  // This creates scroll space ahead of current position
  return (visibleColumns + bufferMultiplier) * defaultColumnWidth;
}
