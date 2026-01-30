/**
 * DataGrid Component
 *
 * Main orchestrator component that brings together all engines:
 * - Virtualization (calculate visible cells)
 * - Layout (position cells)
 * - Keyboard (handle navigation)
 * - Accessibility (ARIA attributes)
 * - Edit (handle cell editing)
 *
 * This component maintains the grid state and delegates to specialized engines.
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import type {
  DataGridProps,
  CellPosition,
  GridRow,
} from "../grid-engine/types";
import type { EditState as EditStateType } from "../grid-engine/edit-engine";
import { GridCell } from "./GridCell";

// Import engines
import {
  calculateVisibleRows,
  calculateVisibleColumns,
  calculateColumnMetrics,
  getTotalHeight,
} from "../grid-engine/virtualization";

import {
  calculateCellPosition,
  calculateScrollToRow,
  calculateScrollToColumn,
} from "../grid-engine/layout";

import {
  handleArrowKey,
  handleTabKey,
  handleHomeEndKey,
  handlePageKey,
  isCellEditable,
  parseKeyboardEvent,
  focusCell,
} from "../grid-engine/keyboard";

import {
  getGridAriaProps,
  getGridAriaLabel,
  getLiveRegionProps,
  createEditAnnouncement,
  createErrorAnnouncement,
} from "../grid-engine/accessibility";

import {
  createEditState,
  updateEditValue,
  processEditCommit,
  cancelEdit,
} from "../grid-engine/edit-engine";

export const DataGrid: React.FC<DataGridProps> = ({
  schema,
  data,
  config,
  onCellEdit,
  onCellFocus,
  height,
  width,
}) => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Calculate column metrics (memoized)
  const columnMetrics = useMemo(
    () => calculateColumnMetrics(schema.columns),
    [schema.columns],
  );

  // State
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [focusedCell, setFocusedCell] = useState<CellPosition>({
    rowIndex: 0,
    colIndex: 0,
  });
  const [editState, setEditState] = useState<EditStateType | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");
  const [dataState, setDataState] = useState<readonly GridRow[]>(data);

  // Update data when prop changes
  useEffect(() => {
    setDataState(data);
  }, [data]);

  // Calculate visible ranges
  const visibleRows = useMemo(
    () =>
      calculateVisibleRows(
        scrollTop,
        config.rowHeight,
        height,
        dataState.length,
        config.overscanRows,
      ),
    [
      scrollTop,
      config.rowHeight,
      height,
      dataState.length,
      config.overscanRows,
    ],
  );

  const visibleColumns = useMemo(
    () =>
      calculateVisibleColumns(
        scrollLeft,
        width,
        columnMetrics,
        config.overscanColumns,
      ),
    [scrollLeft, width, columnMetrics, config.overscanColumns],
  );

  // Total height for virtual scroll container
  const totalHeight = getTotalHeight(dataState.length, config.rowHeight);

  // Handle scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
    setScrollLeft(target.scrollLeft);
  }, []);

  // Handle cell click
  const handleCellClick = useCallback(
    (position: CellPosition) => {
      setFocusedCell(position);
      setEditState(null); // Exit edit mode if clicking different cell

      // Focus the cell element
      setTimeout(() => {
        focusCell(position, containerRef.current);
      }, 0);

      // Notify callback
      if (onCellFocus) {
        onCellFocus(position.rowIndex, position.colIndex);
      }
    },
    [onCellFocus],
  );

  // Scroll cell into view
  const scrollCellIntoView = useCallback(
    (position: CellPosition) => {
      if (!scrollContainerRef.current) return;

      // Check vertical scroll
      const newScrollTop = calculateScrollToRow(
        position,
        config.rowHeight,
        scrollTop,
        height,
      );

      if (newScrollTop !== null) {
        scrollContainerRef.current.scrollTop = newScrollTop;
        setScrollTop(newScrollTop);
      }

      // Check horizontal scroll
      const newScrollLeft = calculateScrollToColumn(
        position,
        columnMetrics,
        scrollLeft,
        width,
      );

      if (newScrollLeft !== null) {
        scrollContainerRef.current.scrollLeft = newScrollLeft;
        setScrollLeft(newScrollLeft);
      }
    },
    [config.rowHeight, scrollTop, scrollLeft, height, width, columnMetrics],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, position: CellPosition) => {
      const action = parseKeyboardEvent(event);
      if (!action) return;

      event.preventDefault();

      let newPosition = position;

      switch (action.type) {
        case "navigate":
          newPosition = handleArrowKey(
            position,
            action.direction,
            schema,
            dataState.length,
          );
          break;

        case "tab":
          newPosition = handleTabKey(
            position,
            action.isShift,
            schema,
            dataState.length,
          );
          break;

        case "home-end":
          newPosition = handleHomeEndKey(
            position,
            action.key,
            action.isCtrl,
            schema,
            dataState.length,
          );
          break;

        case "page":
          newPosition = handlePageKey(
            position,
            action.key,
            config.rowHeight,
            height,
            dataState.length,
          );
          break;

        case "enter":
          // Enter: Start editing if cell is editable
          if (isCellEditable(position, schema)) {
            const row = dataState[position.rowIndex];
            const column = schema.columns[position.colIndex];
            if (row && column) {
              const currentValue = row[column.id];
              setEditState(createEditState(position, currentValue));
            }
          }
          return; // Don't change focus

        case "escape":
          // Escape: Cancel edit
          if (editState) {
            setEditState(null);
          }
          return; // Don't change focus
      }

      // Update focus
      setFocusedCell(newPosition);
      scrollCellIntoView(newPosition);

      // Focus the cell element
      setTimeout(() => {
        focusCell(newPosition, containerRef.current);
      }, 0);

      // Notify callback
      if (onCellFocus) {
        onCellFocus(newPosition.rowIndex, newPosition.colIndex);
      }
    },
    [
      schema,
      dataState,
      config.rowHeight,
      height,
      scrollCellIntoView,
      onCellFocus,
      editState,
    ],
  );

  // Handle edit value change
  const handleEditChange = useCallback(
    (value: string) => {
      if (!editState) return;
      setEditState(updateEditValue(editState, value));
    },
    [editState],
  );

  // Handle edit commit
  const handleEditCommit = useCallback(async () => {
    if (!editState) return;

    const { position } = editState;
    const column = schema.columns[position.colIndex];
    if (!column) return;

    // Process the edit with validation
    const result = await processEditCommit(editState);

    // Update data
    const newData = [...dataState];
    const row = newData[position.rowIndex];
    if (row) {
      newData[position.rowIndex] = {
        ...row,
        [column.id]: result.value,
      };
      setDataState(newData);
    }

    // Show result
    if (result.state.status === "success") {
      setAnnouncement(
        createEditAnnouncement(
          column.label,
          editState.originalValue,
          result.value,
        ),
      );

      // Call user callback
      if (onCellEdit) {
        await onCellEdit(
          position.rowIndex,
          position.colIndex,
          editState.originalValue,
          result.value,
        );
      }

      // Exit edit mode after success
      setTimeout(() => {
        setEditState(null);
        focusCell(position, containerRef.current);
      }, 500);
    } else if (result.state.status === "error") {
      // Show error
      setEditState(result.state);
      if (result.state.error) {
        setAnnouncement(createErrorAnnouncement(result.state.error));
      }

      // Auto-exit edit mode after error (rollback complete)
      setTimeout(() => {
        setEditState(null);
        focusCell(position, containerRef.current);
      }, 2000);
    }
  }, [editState, schema, dataState, onCellEdit]);

  // Handle edit cancel
  const handleEditCancel = useCallback(() => {
    if (!editState) return;

    const value = cancelEdit(editState);
    const position = editState.position;
    const column = schema.columns[position.colIndex];

    if (column) {
      // Restore original value
      const newData = [...dataState];
      const row = newData[position.rowIndex];
      if (row) {
        newData[position.rowIndex] = {
          ...row,
          [column.id]: value,
        };
        setDataState(newData);
      }
    }

    setEditState(null);

    // Restore focus
    setTimeout(() => {
      focusCell(position, containerRef.current);
    }, 0);
  }, [editState, schema, dataState]);

  // Get ARIA props
  const gridAriaProps = getGridAriaProps(
    dataState.length,
    schema.columns.length,
  );
  const gridAriaLabel = getGridAriaLabel(
    "Data Grid",
    dataState.length,
    schema.columns.length,
  );
  const liveRegionProps = getLiveRegionProps();

  // Render visible cells
  const renderCells = () => {
    const cells: React.ReactElement[] = [];

    // Render header row
    for (let colIndex = 0; colIndex < schema.columns.length; colIndex++) {
      const column = schema.columns[colIndex];
      if (!column) continue;

      // Calculate position
      const position = calculateCellPosition(
        { rowIndex: -1, colIndex }, // -1 for header
        config.rowHeight,
        columnMetrics,
        scrollLeft,
      );

      cells.push(
        <GridCell
          key={`header-${colIndex}`}
          position={{ rowIndex: -1, colIndex }}
          column={column}
          value={column.label}
          x={position.x}
          y={0}
          isFocused={false}
          isHeader={true}
          totalRows={dataState.length}
          pinnedCount={columnMetrics.pinnedCount}
          editState={null}
          onClick={() => {}}
          onKeyDown={() => {}}
          onEditChange={() => {}}
          onEditCommit={() => {}}
          onEditCancel={() => {}}
        />,
      );
    }

    // Render visible data rows
    for (
      let rowIndex = visibleRows.startRow;
      rowIndex <= visibleRows.endRow;
      rowIndex++
    ) {
      const row = dataState[rowIndex];
      if (!row) continue;

      // Render all columns for this row
      for (let colIndex = 0; colIndex < schema.columns.length; colIndex++) {
        const column = schema.columns[colIndex];
        if (!column) continue;

        // Skip if column is not visible and not pinned
        const isPinned = colIndex < columnMetrics.pinnedCount;
        const isVisible =
          colIndex >= visibleColumns.startCol &&
          colIndex <= visibleColumns.endCol;
        if (!isPinned && !isVisible) continue;

        const position = { rowIndex, colIndex };
        const cellPosition = calculateCellPosition(
          position,
          config.rowHeight,
          columnMetrics,
          scrollLeft,
        );

        // Adjust Y position to account for header
        const adjustedY = cellPosition.y + config.rowHeight;

        const isFocused =
          focusedCell.rowIndex === rowIndex &&
          focusedCell.colIndex === colIndex;

        cells.push(
          <GridCell
            key={`${rowIndex}-${colIndex}`}
            position={position}
            column={column}
            value={row[column.id]}
            x={cellPosition.x}
            y={adjustedY}
            isFocused={isFocused}
            isHeader={false}
            totalRows={dataState.length}
            pinnedCount={columnMetrics.pinnedCount}
            editState={editState}
            onClick={handleCellClick}
            onKeyDown={handleKeyDown}
            onEditChange={handleEditChange}
            onEditCommit={handleEditCommit}
            onEditCancel={handleEditCancel}
          />,
        );
      }
    }

    return cells;
  };

  return (
    <div
      ref={containerRef}
      {...gridAriaProps}
      aria-label={gridAriaLabel}
      className="relative border border-gray-300 bg-gray-100"
      style={{ width, height }}
    >
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-auto"
        onScroll={handleScroll}
      >
        {/* Virtual scroll spacer */}
        <div
          className="relative"
          style={{
            height: totalHeight + config.rowHeight, // +rowHeight for header
            width: columnMetrics.totalWidth,
          }}
        >
          {renderCells()}
        </div>
      </div>

      {/* ARIA live region for announcements */}
      <div {...liveRegionProps} className="sr-only" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
};
