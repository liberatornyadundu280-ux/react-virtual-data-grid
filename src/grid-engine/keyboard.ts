/**
 * Keyboard Navigation Engine
 *
 * Handles all keyboard interactions:
 * - Arrow key navigation
 * - Enter to edit
 * - Escape to cancel
 * - Tab navigation
 * - Focus restoration after virtualization
 *
 * Key challenge: DOM nodes recycle during scroll, but logical focus must persist.
 * Solution: Track focus by logical coordinates, not DOM references.
 */

import type { CellPosition, GridSchema } from "./types";

/**
 * Direction of arrow key press.
 */
export type ArrowDirection =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight";

/**
 * Result of keyboard navigation action.
 */
export interface NavigationResult {
  /** New focus position after navigation */
  readonly newPosition: CellPosition;

  /** Whether scroll adjustment is needed */
  readonly needsScroll: boolean;
}

/**
 * Handle arrow key navigation from current position.
 *
 * Algorithm:
 * 1. Calculate new position based on direction
 * 2. Clamp to valid grid bounds
 * 3. Return new position
 *
 * Boundary behavior:
 * - At top edge, ArrowUp does nothing
 * - At bottom edge, ArrowDown does nothing
 * - At left edge, ArrowLeft does nothing
 * - At right edge, ArrowRight does nothing
 *
 * Example:
 *   Current: (5, 3)
 *   Key: ArrowRight
 *   Result: (5, 4)
 *
 * @param currentPosition - Current focused cell
 * @param direction - Arrow key direction
 * @param schema - Grid schema (for bounds checking)
 * @param totalRows - Total number of rows
 * @returns New focus position after navigation
 */
export function handleArrowKey(
  currentPosition: CellPosition,
  direction: ArrowDirection,
  schema: GridSchema,
  totalRows: number,
): CellPosition {
  const { rowIndex, colIndex } = currentPosition;
  const totalCols = schema.columns.length;

  let newRowIndex = rowIndex;
  let newColIndex = colIndex;

  switch (direction) {
    case "ArrowUp":
      newRowIndex = Math.max(0, rowIndex - 1);
      break;

    case "ArrowDown":
      newRowIndex = Math.min(totalRows - 1, rowIndex + 1);
      break;

    case "ArrowLeft":
      newColIndex = Math.max(0, colIndex - 1);
      break;

    case "ArrowRight":
      newColIndex = Math.min(totalCols - 1, colIndex + 1);
      break;
  }

  return { rowIndex: newRowIndex, colIndex: newColIndex };
}

/**
 * Handle Tab key navigation (move to next cell, wrap at row end).
 *
 * Behavior:
 * - Tab: Move right, wrap to next row at end
 * - Shift+Tab: Move left, wrap to previous row at start
 *
 * Example:
 *   Current: (5, 9) - last column
 *   Tab: (6, 0) - first column of next row
 *
 * @param currentPosition - Current focused cell
 * @param isShift - Whether Shift key is held
 * @param schema - Grid schema
 * @param totalRows - Total number of rows
 * @returns New focus position after tab
 */
export function handleTabKey(
  currentPosition: CellPosition,
  isShift: boolean,
  schema: GridSchema,
  totalRows: number,
): CellPosition {
  const { rowIndex, colIndex } = currentPosition;
  const totalCols = schema.columns.length;

  if (isShift) {
    // Shift+Tab: Move left, wrap to previous row
    if (colIndex > 0) {
      return { rowIndex, colIndex: colIndex - 1 };
    } else if (rowIndex > 0) {
      return { rowIndex: rowIndex - 1, colIndex: totalCols - 1 };
    }
    // At first cell, stay there
    return currentPosition;
  } else {
    // Tab: Move right, wrap to next row
    if (colIndex < totalCols - 1) {
      return { rowIndex, colIndex: colIndex + 1 };
    } else if (rowIndex < totalRows - 1) {
      return { rowIndex: rowIndex + 1, colIndex: 0 };
    }
    // At last cell, stay there
    return currentPosition;
  }
}

/**
 * Handle Home/End keys for navigation.
 *
 * Behavior:
 * - Home: Jump to first column of current row
 * - End: Jump to last column of current row
 * - Ctrl+Home: Jump to first cell (0, 0)
 * - Ctrl+End: Jump to last cell
 *
 * @param currentPosition - Current focused cell
 * @param key - 'Home' or 'End'
 * @param isCtrl - Whether Ctrl/Cmd key is held
 * @param schema - Grid schema
 * @param totalRows - Total number of rows
 * @returns New focus position
 */
export function handleHomeEndKey(
  currentPosition: CellPosition,
  key: "Home" | "End",
  isCtrl: boolean,
  schema: GridSchema,
  totalRows: number,
): CellPosition {
  const { rowIndex } = currentPosition;
  const totalCols = schema.columns.length;

  if (key === "Home") {
    if (isCtrl) {
      // Ctrl+Home: First cell
      return { rowIndex: 0, colIndex: 0 };
    } else {
      // Home: First column of current row
      return { rowIndex, colIndex: 0 };
    }
  } else {
    // End key
    if (isCtrl) {
      // Ctrl+End: Last cell
      return { rowIndex: totalRows - 1, colIndex: totalCols - 1 };
    } else {
      // End: Last column of current row
      return { rowIndex, colIndex: totalCols - 1 };
    }
  }
}

/**
 * Handle PageUp/PageDown keys for fast vertical navigation.
 *
 * Behavior:
 * - PageDown: Jump down by viewport height worth of rows
 * - PageUp: Jump up by viewport height worth of rows
 *
 * @param currentPosition - Current focused cell
 * @param key - 'PageUp' or 'PageDown'
 * @param rowHeight - Fixed row height in pixels
 * @param viewportHeight - Viewport height in pixels
 * @param totalRows - Total number of rows
 * @returns New focus position
 */
export function handlePageKey(
  currentPosition: CellPosition,
  key: "PageUp" | "PageDown",
  rowHeight: number,
  viewportHeight: number,
  totalRows: number,
): CellPosition {
  const { rowIndex, colIndex } = currentPosition;
  const rowsPerPage = Math.floor(viewportHeight / rowHeight);

  let newRowIndex = rowIndex;

  if (key === "PageDown") {
    newRowIndex = Math.min(totalRows - 1, rowIndex + rowsPerPage);
  } else {
    newRowIndex = Math.max(0, rowIndex - rowsPerPage);
  }

  return { rowIndex: newRowIndex, colIndex };
}

/**
 * Check if a cell is editable based on schema.
 *
 * A cell is editable if:
 * - The column has editable: true
 * - Not a header row (rowIndex >= 0)
 *
 * @param position - Cell position
 * @param schema - Grid schema
 * @returns True if cell can be edited
 */
export function isCellEditable(
  position: CellPosition,
  schema: GridSchema,
): boolean {
  const { colIndex } = position;
  const column = schema.columns[colIndex];

  return column?.editable === true;
}

/**
 * Get the DOM element for a cell at given position.
 *
 * Uses data attributes for reliable selection:
 * - data-row-index
 * - data-col-index
 *
 * This works even when DOM nodes recycle during virtualization.
 *
 * @param position - Cell coordinates
 * @param containerRef - Reference to grid container
 * @returns Cell element or null if not found
 */
export function getCellElement(
  position: CellPosition,
  containerRef: HTMLElement | null,
): HTMLElement | null {
  if (!containerRef) return null;

  const { rowIndex, colIndex } = position;

  const selector = `[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`;
  return containerRef.querySelector<HTMLElement>(selector);
}

/**
 * Focus a cell element and scroll it into view if needed.
 *
 * This is called after:
 * - Keyboard navigation
 * - Virtualization updates (to restore focus)
 * - Edit mode exit
 *
 * @param position - Cell to focus
 * @param containerRef - Grid container reference
 */
export function focusCell(
  position: CellPosition,
  containerRef: HTMLElement | null,
): void {
  const cellElement = getCellElement(position, containerRef);

  if (cellElement) {
    cellElement.focus();
  }
}

/**
 * Handle keyboard event and determine action.
 *
 * Returns the type of action to take based on key press.
 * This allows the grid component to handle the action appropriately.
 *
 * @param event - Keyboard event
 * @returns Action type or null if no action needed
 */
export type KeyboardAction =
  | { type: "navigate"; direction: ArrowDirection }
  | { type: "tab"; isShift: boolean }
  | { type: "home-end"; key: "Home" | "End"; isCtrl: boolean }
  | { type: "page"; key: "PageUp" | "PageDown" }
  | { type: "enter" }
  | { type: "escape" }
  | null;

export function parseKeyboardEvent(event: React.KeyboardEvent): KeyboardAction {
  const { key, ctrlKey, metaKey, shiftKey } = event;
  const isCtrl = ctrlKey || metaKey;

  // Arrow keys
  if (
    key === "ArrowUp" ||
    key === "ArrowDown" ||
    key === "ArrowLeft" ||
    key === "ArrowRight"
  ) {
    return { type: "navigate", direction: key };
  }

  // Tab
  if (key === "Tab") {
    return { type: "tab", isShift: shiftKey };
  }

  // Home/End
  if (key === "Home" || key === "End") {
    return { type: "home-end", key, isCtrl };
  }

  // Page Up/Down
  if (key === "PageUp" || key === "PageDown") {
    return { type: "page", key };
  }

  // Enter
  if (key === "Enter") {
    return { type: "enter" };
  }

  // Escape
  if (key === "Escape") {
    return { type: "escape" };
  }

  return null;
}
