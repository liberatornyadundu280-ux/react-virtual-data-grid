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
  generateDefaultColumn,
} from "../grid-engine/virtualization";

import {
  calculateCellPosition,
  calculateScrollToRow,
  calculateScrollToColumn,
  getStickyHeaderContainerStyle,
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
        config.infiniteColumns ? "infinite" : "schema",
        config.defaultColumnWidth,
      ),
    [
      scrollLeft,
      width,
      columnMetrics,
      config.overscanColumns,
      config.infiniteColumns,
      config.defaultColumnWidth,
    ],
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
            config.infiniteColumns,
          );
          break;

        case "tab":
          newPosition = handleTabKey(
            position,
            action.isShift,
            schema,
            dataState.length,
            config.infiniteColumns,
          );
          break;

        case "home-end":
          newPosition = handleHomeEndKey(
            position,
            action.key,
            action.isCtrl,
            schema,
            dataState.length,
            config.infiniteColumns,
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
    false,
    config.infiniteColumns,
  );
  const gridAriaLabel = getGridAriaLabel(
    "Data Grid",
    dataState.length,
    schema.columns.length,
  );
  const liveRegionProps = getLiveRegionProps();

  // Render header row (always visible, sticky)
  const renderHeader = () => {
    const headerCells: React.ReactElement[] = [];

    // In infinite mode: render pinned columns + visible scrollable columns
    // In schema mode: render all schema columns (will be filtered by visibility)
    const columnsToRender: number[] = [];

    if (config.infiniteColumns) {
      // Add pinned columns (always visible)
      for (let i = 0; i < columnMetrics.pinnedCount; i++) {
        columnsToRender.push(i);
      }
      // Add visible scrollable columns
      for (
        let i = Math.max(columnMetrics.pinnedCount, visibleColumns.startCol);
        i <= visibleColumns.endCol;
        i++
      ) {
        columnsToRender.push(i);
      }
    } else {
      // Schema mode: render based on schema and visibility
      for (let i = 0; i < schema.columns.length; i++) {
        const isPinned = i < columnMetrics.pinnedCount;
        const isVisible =
          i >= visibleColumns.startCol && i <= visibleColumns.endCol;
        if (isPinned || isVisible) {
          columnsToRender.push(i);
        }
      }
    }

    for (const colIndex of columnsToRender) {
      // Get column from schema or generate default
      const column =
        schema.columns[colIndex] ??
        (config.infiniteColumns
          ? generateDefaultColumn(colIndex, config.defaultColumnWidth)
          : null);

      if (!column) continue;

      // Calculate position
      const position = calculateCellPosition(
        { rowIndex: -1, colIndex }, // -1 indicates header
        config.rowHeight,
        columnMetrics,
        scrollLeft,
        config.infiniteColumns,
        config.defaultColumnWidth,
      );

      headerCells.push(
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

    return headerCells;
  };

  // Render visible data rows (virtualized)
  const renderDataRows = () => {
    const cells: React.ReactElement[] = [];

    // Render visible data rows
    for (
      let rowIndex = visibleRows.startRow;
      rowIndex <= visibleRows.endRow;
      rowIndex++
    ) {
      const row = dataState[rowIndex];
      if (!row) continue;

      // Determine which columns to render
      const columnsToRender: number[] = [];

      if (config.infiniteColumns) {
        // Add pinned columns (always visible)
        for (let i = 0; i < columnMetrics.pinnedCount; i++) {
          columnsToRender.push(i);
        }
        // Add visible scrollable columns
        for (
          let i = Math.max(columnMetrics.pinnedCount, visibleColumns.startCol);
          i <= visibleColumns.endCol;
          i++
        ) {
          columnsToRender.push(i);
        }
      } else {
        // Schema mode: render based on schema and visibility
        for (let i = 0; i < schema.columns.length; i++) {
          const isPinned = i < columnMetrics.pinnedCount;
          const isVisible =
            i >= visibleColumns.startCol && i <= visibleColumns.endCol;
          if (isPinned || isVisible) {
            columnsToRender.push(i);
          }
        }
      }

      // Render each column for this row
      for (const colIndex of columnsToRender) {
        // Get column from schema or generate default
        const column =
          schema.columns[colIndex] ??
          (config.infiniteColumns
            ? generateDefaultColumn(colIndex, config.defaultColumnWidth)
            : null);

        if (!column) continue;

        const position = { rowIndex, colIndex };
        const cellPosition = calculateCellPosition(
          position,
          config.rowHeight,
          columnMetrics,
          scrollLeft,
          config.infiniteColumns,
          config.defaultColumnWidth,
        );

        // Y position starts after header
        const adjustedY = cellPosition.y;

        const isFocused =
          focusedCell.rowIndex === rowIndex &&
          focusedCell.colIndex === colIndex;

        // Get cell value - may be undefined for generated columns
        const cellValue = row[column.id];

        cells.push(
          <GridCell
            key={`${rowIndex}-${colIndex}`}
            position={position}
            column={column}
            value={cellValue}
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

  // Calculate scroll container width based on mode
  const getScrollContainerWidth = () => {
    if (config.infiniteColumns) {
      // Infinite mode: Create illusion of infinite scroll space
      // Width = current rightmost visible column + buffer ahead
      const defaultWidth = config.defaultColumnWidth ?? 150;
      const rightmostColumn = visibleColumns.endCol;
      const viewportsAhead = 20; // Scroll space buffer (adjustable)
      const viewportColumns = Math.ceil(width / defaultWidth);

      // Calculate total width: reached columns + buffer
      return (
        (rightmostColumn + viewportsAhead * viewportColumns) * defaultWidth
      );
    }

    // Schema mode: Use pre-computed total width from schema
    return columnMetrics.totalWidth;
  };

  return (
    <div
      ref={containerRef}
      {...gridAriaProps}
      aria-label={gridAriaLabel}
      className="relative border border-gray-300 bg-gray-100 overflow-hidden"
      style={{ width, height }}
    >
      {/* Sticky Header Container */}
      <div
        style={{
          ...getStickyHeaderContainerStyle(),
          width: getScrollContainerWidth(),
          height: config.rowHeight,
        }}
        className="relative"
      >
        {renderHeader()}
      </div>

      {/* Scrollable Body Container */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-auto"
        style={{ height: height - config.rowHeight }}
        onScroll={handleScroll}
      >
        {/* Virtual scroll spacer */}
        <div
          className="relative"
          style={{
            height: totalHeight,
            width: getScrollContainerWidth(),
          }}
        >
          {renderDataRows()}
        </div>
      </div>

      {/* ARIA live region for announcements */}
      <div {...liveRegionProps} className="sr-only" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
};
