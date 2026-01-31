/**
 * GridCell Component
 *
 * Renders a single cell in the grid.
 * Handles both display and edit modes.
 */

import React, { useRef, useEffect } from "react";
import type { CellPosition, GridColumn } from "../grid-engine/types";
import type { EditState } from "../grid-engine/edit-engine";
import {
  getCellAriaProps,
  getCellAriaLabel,
} from "../grid-engine/accessibility";
import { getTransform, getCellZIndex } from "../grid-engine/layout";
import {
  isPositionBeingEdited,
  getEditStatusClass,
} from "../grid-engine/edit-engine";

interface GridCellProps {
  /** Cell position in grid */
  position: CellPosition;

  /** Column definition */
  column: GridColumn;

  /** Cell value to display */
  value: unknown;

  /** Position in pixels */
  x: number;
  y: number;

  /** Whether this cell has focus */
  isFocused: boolean;

  /** Whether this is a header cell */
  isHeader?: boolean;

  /** Total number of rows (for ARIA) */
  totalRows: number;

  /** Number of pinned columns (for z-index) */
  pinnedCount: number;

  /** Active edit state */
  editState: EditState | null;

  /** Callback when cell is clicked */
  onClick: (position: CellPosition) => void;

  /** Callback when cell receives keyboard event */
  onKeyDown: (event: React.KeyboardEvent, position: CellPosition) => void;

  /** Callback when edit value changes */
  onEditChange: (value: string) => void;

  /** Callback when edit is committed */
  onEditCommit: () => void;

  /** Callback when edit is cancelled */
  onEditCancel: () => void;
}

export const GridCell: React.FC<GridCellProps> = ({
  position,
  column,
  value,
  x,
  y,
  isFocused,
  isHeader = false,
  totalRows,
  pinnedCount,
  editState,
  onClick,
  onKeyDown,
  onEditChange,
  onEditCommit,
  onEditCancel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = isPositionBeingEdited(position, editState);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Get ARIA props
  const ariaProps = getCellAriaProps(
    position.colIndex,
    isHeader,
    isFocused,
    false,
  );

  const ariaLabel = !isHeader
    ? getCellAriaLabel(column.label, position.rowIndex, totalRows)
    : undefined;

  /**
   * FIX: Elevation during editing
   * We increase the z-index when editing so the error message (positioned at -bottom-8)
   * appears ABOVE the rows below it.
   */
  const baseZIndex = getCellZIndex(position.colIndex, pinnedCount, isHeader);
  const zIndex = isEditing ? baseZIndex + 100 : baseZIndex;

  // Get edit status class
  const editStatusClass =
    editState && isEditing ? getEditStatusClass(editState.status) : "";

  // Cell styles
  const cellStyles: React.CSSProperties = {
    position: "absolute",
    width: column.width,
    height: isHeader ? 40 : 40, // Fixed row height
    transform: getTransform({ x, y }),
    zIndex,
    willChange: "transform",
  };

  // Handle click
  const handleClick = () => {
    onClick(position);
  };

  // Handle keyboard events
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isEditing) {
      // In edit mode: handle Enter/Escape
      if (event.key === "Enter") {
        event.preventDefault();
        onEditCommit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onEditCancel();
      }
    } else {
      // In navigation mode: pass to parent
      onKeyDown(event, position);
    }
  };

  // Handle input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onEditChange(event.target.value);
  };

  // Format value for display
  const displayValue =
    value === null || value === undefined ? "" : String(value);

  return (
    <div
      {...ariaProps}
      aria-label={ariaLabel}
      data-row-index={position.rowIndex}
      data-col-index={position.colIndex}
      style={cellStyles}
      className={`
    border-b border-r border-gray-200
    ${isHeader ? "bg-gray-50 font-semibold" : ""} 
    /* FIX: Only apply bg-white if NOT editing and NOT a header */
    ${!isHeader && !isEditing ? "bg-white" : ""} 
    ${isFocused && !isEditing ? "ring-2 ring-blue-500 ring-inset" : ""}
    ${editStatusClass} /* This contains bg-red-50 or bg-green-50 */
    px-3 py-2
    ${isEditing ? "overflow-visible" : "overflow-hidden"}
    cursor-pointer
    hover:bg-gray-50
    transition-colors
  `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {isEditing ? (
        // Edit mode: Show input
        <input
          ref={inputRef}
          type="text"
          value={(editState?.currentValue as string) ?? ""}
          onChange={handleInputChange}
          className="w-full h-full bg-transparent outline-none"
          disabled={editState?.status === "pending"}
        />
      ) : (
        // Display mode: Show value
        <div className="truncate text-sm">{displayValue}</div>
      )}

      {/* Show spinner during pending validation */}
      {isEditing && editState?.status === "pending" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Show error message */}
      {isEditing && editState?.error && (
        <div
          role="alert"
          className="absolute left-0 right-0 -bottom-8 px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-800 z-50 shadow-md"
        >
          {editState.error}
        </div>
      )}
    </div>
  );
};
