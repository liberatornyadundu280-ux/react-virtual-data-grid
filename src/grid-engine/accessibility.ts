/**
 * Accessibility Engine
 *
 * Implements WAI-ARIA Grid Pattern for screen reader support.
 *
 * Key requirements:
 * - role="grid" on container
 * - role="row" on each row
 * - role="columnheader" on header cells
 * - role="gridcell" on data cells
 * - aria-rowindex, aria-colindex for logical positions
 * - aria-rowcount, aria-colcount for total size
 * - Proper tabindex management
 *
 * Reference: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
 */

import type { CellPosition } from "./types";

/**
 * ARIA properties for the grid container.
 *
 * These tell screen readers:
 * - This is a grid structure
 * - The total dimensions (rows × columns)
 * - Whether it's read-only or editable
 *
 * @param totalRows - Total number of rows (including header)
 * @param totalColumns - Total number of columns
 * @param isReadOnly - Whether grid is read-only (default: false)
 * @returns ARIA props for grid container
 */
export interface GridAriaProps {
  readonly role: "grid";
  readonly "aria-rowcount": number;
  readonly "aria-colcount": number;
  readonly "aria-readonly"?: boolean;
}

export function getGridAriaProps(
  totalRows: number,
  totalColumns: number,
  isReadOnly: boolean = false,
): GridAriaProps {
  return {
    role: "grid",
    "aria-rowcount": totalRows + 1, // +1 for header row
    "aria-colcount": totalColumns,
    "aria-readonly": isReadOnly || undefined,
  };
}

/**
 * ARIA properties for a row element.
 *
 * aria-rowindex is 1-based and accounts for:
 * - Header row = 1
 * - First data row = 2
 * - Row at index N = N + 2
 *
 * This allows screen readers to announce:
 * "Row 5 of 50,000"
 *
 * Even though we're only rendering rows 100-120 in the DOM,
 * we tell screen readers the logical row numbers.
 *
 * @param rowIndex - Zero-based row index in data
 * @param isHeader - Whether this is the header row
 * @returns ARIA props for row element
 */
export interface RowAriaProps {
  readonly role: "row";
  readonly "aria-rowindex": number;
}

export function getRowAriaProps(
  rowIndex: number,
  isHeader: boolean = false,
): RowAriaProps {
  return {
    role: "row",
    "aria-rowindex": isHeader ? 1 : rowIndex + 2, // +2 accounts for header and 1-based indexing
  };
}

/**
 * ARIA properties for a cell element.
 *
 * Includes:
 * - Correct role (columnheader vs gridcell)
 * - Logical column index (1-based)
 * - Tabindex for keyboard focus management
 * - aria-selected for visual focus indicator
 *
 * Tabindex strategy:
 * - Focused cell: tabIndex = 0 (can receive focus)
 * - Other cells: tabIndex = -1 (can be programmatically focused)
 *
 * This implements "roving tabindex" pattern:
 * Only one cell in the grid is in the tab order at a time.
 *
 * @param colIndex - Zero-based column index
 * @param isHeader - Whether this is a header cell
 * @param isFocused - Whether this cell currently has focus
 * @param isSelected - Whether this cell is selected (optional)
 * @returns ARIA props for cell element
 */
export interface CellAriaProps {
  readonly role: "columnheader" | "gridcell";
  readonly "aria-colindex": number;
  readonly tabIndex: number;
  readonly "aria-selected"?: boolean;
}

export function getCellAriaProps(
  colIndex: number,
  isHeader: boolean = false,
  isFocused: boolean = false,
  isSelected: boolean = false,
): CellAriaProps {
  return {
    role: isHeader ? "columnheader" : "gridcell",
    "aria-colindex": colIndex + 1, // 1-based indexing
    tabIndex: isFocused ? 0 : -1, // Roving tabindex pattern
    "aria-selected": isSelected || undefined,
  };
}

/**
 * Get aria-label for a cell, used for screen reader announcements.
 *
 * Format: "Column Name, Row N of Total"
 * Example: "Name, Row 5 of 50,000"
 *
 * This helps screen reader users understand their position in the grid.
 *
 * @param columnLabel - Display name of the column
 * @param rowIndex - Zero-based row index
 * @param totalRows - Total number of rows
 * @returns Descriptive label for screen readers
 */
export function getCellAriaLabel(
  columnLabel: string,
  rowIndex: number,
  totalRows: number,
): string {
  return `${columnLabel}, Row ${rowIndex + 1} of ${totalRows}`;
}

/**
 * Get aria-label for the grid container.
 *
 * Provides context about the grid to screen reader users.
 *
 * @param gridName - Descriptive name for the grid
 * @param totalRows - Total number of rows
 * @param totalColumns - Total number of columns
 * @returns Descriptive label for the grid
 */
export function getGridAriaLabel(
  gridName: string,
  totalRows: number,
  totalColumns: number,
): string {
  return `${gridName}, ${totalRows} rows, ${totalColumns} columns`;
}

/**
 * ARIA live region announcement for screen readers.
 *
 * Used to announce dynamic changes:
 * - Cell edits
 * - Validation errors
 * - Loading states
 *
 * aria-live="polite" means:
 * - Announce when user is idle
 * - Don't interrupt current announcement
 *
 * @param message - Message to announce
 * @returns ARIA props for live region
 */
export interface LiveRegionProps {
  readonly role: "status";
  readonly "aria-live": "polite" | "assertive";
  readonly "aria-atomic": boolean;
}

export function getLiveRegionProps(
  isAssertive: boolean = false,
): LiveRegionProps {
  return {
    role: "status",
    "aria-live": isAssertive ? "assertive" : "polite",
    "aria-atomic": true, // Read entire region, not just changes
  };
}

/**
 * Create announcement message for cell edit.
 *
 * Screen reader will announce:
 * "Cell updated: Name changed to Bob"
 *
 * @param columnLabel - Column name
 * @param oldValue - Previous value
 * @param newValue - New value
 * @returns Announcement message
 */
export function createEditAnnouncement(
  columnLabel: string,
  oldValue: unknown,
  newValue: unknown,
): string {
  return `Cell updated: ${columnLabel} changed from ${String(oldValue)} to ${String(newValue)}`;
}

/**
 * Create announcement message for validation error.
 *
 * Screen reader will announce:
 * "Error: Invalid email address"
 *
 * @param error - Error message
 * @returns Announcement message
 */
export function createErrorAnnouncement(error: string): string {
  return `Error: ${error}`;
}

/**
 * Create announcement message for navigation.
 *
 * Screen reader will announce:
 * "Navigated to Name, Row 5 of 50,000"
 *
 * @param position - Cell position
 * @param columnLabel - Column name
 * @param totalRows - Total number of rows
 * @returns Announcement message
 */
export function createNavigationAnnouncement(
  position: CellPosition,
  columnLabel: string,
  totalRows: number,
): string {
  const { rowIndex } = position;
  return `Navigated to ${columnLabel}, Row ${rowIndex + 1} of ${totalRows}`;
}

/**
 * Check if element is keyboard-accessible.
 *
 * An element is keyboard-accessible if it:
 * - Has tabIndex >= 0, OR
 * - Is a natively focusable element (button, input, etc.)
 *
 * @param element - DOM element to check
 * @returns True if element can receive keyboard focus
 */
export function isKeyboardAccessible(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute("tabindex");

  if (tabIndex !== null) {
    return parseInt(tabIndex, 10) >= 0;
  }

  // Check if natively focusable
  const focusableElements = ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"];
  return focusableElements.includes(element.tagName);
}

/**
 * Get keyboard shortcut description for accessibility documentation.
 *
 * Returns a map of keys to their actions.
 * This can be used to generate a keyboard shortcuts help dialog.
 *
 * @returns Map of keyboard shortcuts
 */
export function getKeyboardShortcuts(): Record<string, string> {
  return {
    "Arrow Keys": "Navigate between cells",
    Enter: "Edit focused cell",
    Escape: "Cancel edit and return to navigation",
    Tab: "Move to next cell",
    "Shift + Tab": "Move to previous cell",
    Home: "Move to first column of current row",
    End: "Move to last column of current row",
    "Ctrl + Home": "Move to first cell in grid",
    "Ctrl + End": "Move to last cell in grid",
    "Page Down": "Move down one page",
    "Page Up": "Move up one page",
  };
}
