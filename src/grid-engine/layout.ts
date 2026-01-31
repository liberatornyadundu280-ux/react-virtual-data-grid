/**
 * Layout Engine
 *
 * Calculates precise positioning for cells, handling:
 * - Pinned (frozen) columns
 * - Scrollable columns
 * - Row positioning
 * - Transform-based rendering (no layout thrashing)
 *
 * Key principle: Use CSS transform instead of top/left for GPU acceleration.
 */

import type { CellPosition, ColumnMetrics } from "./types";

/**
 * 2D position with x and y coordinates.
 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * Calculate the absolute position of a cell in pixels.
 *
 * This function handles both pinned and scrollable columns:
 * - Pinned columns: Fixed x position, compensate for scroll if in scrolling container
 * - Scrollable columns: x position adjusted by scrollLeft
 *
 * Headers vs Body cells have different scroll behavior:
 * - Headers: In non-scrolling container, use normal formula
 * - Body: In scrolling container, pinned cells need scroll compensation
 *
 * Supports both schema and infinite column modes:
 * - Schema mode: Uses pre-computed offsets array
 * - Infinite mode: Calculates position mathematically
 *
 * Formula:
 *   For headers:
 *     Pinned: x = columnOffset (fixed)
 *     Scrollable: x = columnOffset - scrollLeft (moves)
 *   For body cells:
 *     Pinned: x = columnOffset + scrollLeft (compensate for container scroll)
 *     Scrollable: x = columnOffset - scrollLeft (normal)
 *
 * @param position - Cell coordinates (rowIndex, colIndex)
 * @param rowHeight - Fixed row height in pixels
 * @param columnMetrics - Pre-computed column metrics
 * @param scrollLeft - Horizontal scroll position
 * @param infiniteColumns - If true, calculate position mathematically
 * @param defaultColumnWidth - Width for infinite columns (default: 150)
 * @param isHeader - If true, this is a header cell (different scroll behavior)
 * @returns Absolute position in pixels
 */
export function calculateCellPosition(
  position: CellPosition,
  rowHeight: number,
  columnMetrics: ColumnMetrics,
  scrollLeft: number,
  infiniteColumns: boolean = false,
  defaultColumnWidth: number = 150,
  isHeader: boolean = false,
): Position {
  const { rowIndex, colIndex } = position;
  const { offsets, pinnedCount } = columnMetrics;

  // Calculate Y position (simple multiplication)
  const y = rowIndex * rowHeight;

  // Calculate X position
  let columnOffset: number;

  if (infiniteColumns && colIndex >= offsets.length) {
    // Column beyond schema - calculate mathematically
    columnOffset = colIndex * defaultColumnWidth;
  } else {
    // Column within schema - use pre-computed offset
    columnOffset = offsets[colIndex] ?? 0;
  }

  const isPinned = colIndex < pinnedCount;

  // Different formulas for headers vs body cells
  let x: number;
  if (isHeader) {
    // Headers are in non-scrolling container
    // Pinned: stay fixed, Scrollable: move with scrollLeft
    x = isPinned ? columnOffset : columnOffset - scrollLeft;
  } else {
    // Body cells are in scrolling container
    // Pinned: compensate for container scroll, Scrollable: move normally
    x = isPinned ? columnOffset + scrollLeft : columnOffset - scrollLeft;
  }

  return { x, y };
}

/**
 * Generate CSS transform string for cell positioning.
 *
 * Uses translate3d for GPU acceleration.
 * The '3d' version triggers hardware acceleration even though z = 0.
 *
 * Why transform over top/left:
 * - Doesn't trigger layout recalculation (no reflow)
 * - GPU-accelerated (compositing layer)
 * - 60 FPS scrolling even with many cells
 *
 * @param position - X and Y coordinates in pixels
 * @returns CSS transform value
 */
export function getTransform(position: Position): string {
  return `translate3d(${position.x}px, ${position.y}px, 0)`;
}

/**
 * Calculate the Z-index for a cell based on its column type.
 *
 * Z-index layering:
 * - Pinned column headers: 30 (topmost)
 * - Scrollable column headers: 20
 * - Pinned cells: 10
 * - Scrollable cells: 1
 *
 * This ensures pinned columns always appear above scrollable content.
 *
 * @param colIndex - Column index
 * @param pinnedCount - Number of pinned columns
 * @param isHeader - Whether this is a header cell
 * @returns Z-index value
 */
export function getCellZIndex(
  colIndex: number,
  pinnedCount: number,
  isHeader: boolean,
): number {
  const isPinned = colIndex < pinnedCount;

  if (isHeader) {
    return isPinned ? 30 : 20;
  }

  return isPinned ? 10 : 1;
}

/**
 * Calculate sticky positioning for header row.
 *
 * Header must stay at top during vertical scroll but move during horizontal scroll.
 *
 * Strategy:
 * - Use position: sticky with top: 0
 * - Let browser handle vertical stickiness
 * - Container wraps header cells
 *
 * @returns CSS properties for sticky header container
 */
export function getStickyHeaderContainerStyle(): React.CSSProperties {
  return {
    position: "sticky",
    top: 0,
    zIndex: 30,
    backgroundColor: "#f9fafb", // Ensure header has background
  };
}

/**
 * Calculate styles for header row (deprecated - use getStickyHeaderContainerStyle).
 *
 * @deprecated Use getStickyHeaderContainerStyle instead
 * @returns CSS properties for header
 */
export function getHeaderStyle(): React.CSSProperties {
  return {
    position: "sticky",
    top: 0,
    zIndex: 20,
  };
}

/**
 * Calculate styles for pinned column container.
 *
 * Pinned columns need:
 * - Fixed position on the left
 * - No horizontal scroll
 * - Shadow to indicate separation from scrollable area
 *
 * @param pinnedWidth - Total width of pinned columns
 * @returns CSS properties for pinned container
 */
export function getPinnedColumnStyle(pinnedWidth: number): React.CSSProperties {
  return {
    position: "absolute",
    left: 0,
    width: pinnedWidth,
    zIndex: 10,
    boxShadow: "2px 0 4px rgba(0, 0, 0, 0.1)", // Subtle right shadow
  };
}

/**
 * Calculate styles for scrollable column container.
 *
 * Scrollable area:
 * - Starts after pinned columns
 * - Fills remaining width
 * - Moves with horizontal scroll
 *
 * @param pinnedWidth - Total width of pinned columns
 * @param scrollLeft - Horizontal scroll position
 * @returns CSS properties for scrollable container
 */
export function getScrollableColumnStyle(
  pinnedWidth: number,
  scrollLeft: number,
): React.CSSProperties {
  return {
    position: "absolute",
    left: pinnedWidth,
    transform: `translateX(-${scrollLeft}px)`,
    willChange: "transform", // Hint to browser for optimization
  };
}

/**
 * Check if a cell should be rendered based on visible range.
 *
 * Used to filter cells before rendering:
 * - Reduces React reconciliation overhead
 * - Prevents rendering off-screen cells
 *
 * @param position - Cell coordinates
 * @param visibleStartRow - First visible row index
 * @param visibleEndRow - Last visible row index
 * @param visibleStartCol - First visible column index
 * @param visibleEndCol - Last visible column index
 * @returns True if cell is in visible range
 */
export function isCellVisible(
  position: CellPosition,
  visibleStartRow: number,
  visibleEndRow: number,
  visibleStartCol: number,
  visibleEndCol: number,
): boolean {
  const { rowIndex, colIndex } = position;

  return (
    rowIndex >= visibleStartRow &&
    rowIndex <= visibleEndRow &&
    colIndex >= visibleStartCol &&
    colIndex <= visibleEndCol
  );
}

/**
 * Calculate the viewport offset for a cell to scroll it into view.
 *
 * Used when keyboard navigation moves focus outside visible area.
 * Calculates how much to scroll to make the cell visible.
 *
 * Returns null if cell is already visible.
 *
 * @param position - Cell coordinates
 * @param rowHeight - Fixed row height
 * @param currentScrollTop - Current vertical scroll
 * @param viewportHeight - Height of viewport
 * @returns New scrollTop value, or null if no scroll needed
 */
export function calculateScrollToRow(
  position: CellPosition,
  rowHeight: number,
  currentScrollTop: number,
  viewportHeight: number,
): number | null {
  const { rowIndex } = position;
  const rowTop = rowIndex * rowHeight;
  const rowBottom = rowTop + rowHeight;

  const viewportTop = currentScrollTop;
  const viewportBottom = currentScrollTop + viewportHeight;

  // Cell is above viewport - scroll up
  if (rowTop < viewportTop) {
    return rowTop;
  }

  // Cell is below viewport - scroll down
  if (rowBottom > viewportBottom) {
    return rowBottom - viewportHeight;
  }

  // Cell is already visible
  return null;
}

/**
 * Calculate horizontal scroll position to bring column into view.
 *
 * Similar to calculateScrollToRow but for horizontal scrolling.
 * Accounts for pinned columns.
 *
 * @param position - Cell coordinates
 * @param columnMetrics - Pre-computed column metrics
 * @param currentScrollLeft - Current horizontal scroll
 * @param viewportWidth - Width of viewport
 * @returns New scrollLeft value, or null if no scroll needed
 */
export function calculateScrollToColumn(
  position: CellPosition,
  columnMetrics: ColumnMetrics,
  currentScrollLeft: number,
  viewportWidth: number,
): number | null {
  const { colIndex } = position;
  const { offsets, pinnedWidth, pinnedCount } = columnMetrics;

  // Pinned columns are always visible
  if (colIndex < pinnedCount) {
    return null;
  }

  const colLeft = offsets[colIndex] ?? 0;
  const colRight = offsets[colIndex + 1] ?? colLeft;
  const colWidth = colRight - colLeft;

  const scrollableViewportWidth = viewportWidth - pinnedWidth;
  const viewportLeft = currentScrollLeft;
  const viewportRight = currentScrollLeft + scrollableViewportWidth;

  // Column is left of viewport - scroll left
  if (colLeft < viewportLeft) {
    return colLeft;
  }

  // Column is right of viewport - scroll right
  if (colRight > viewportRight) {
    return colRight - scrollableViewportWidth;
  }

  // Column is already visible
  return null;
}
