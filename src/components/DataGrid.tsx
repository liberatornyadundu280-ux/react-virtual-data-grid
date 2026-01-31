/**
 * DataGrid Component
 *
 * Main orchestrator component that brings together all engines:
 * - Virtualization (calculate visible cells)
 * - Layout (position cells)
 * - Keyboard (handle navigation)
 * - Accessibility (ARIA attributes)
 * - Edit (handle cell editing)
 * - Sorting (multi-column deterministic sort)
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
  SortDescriptor,
  SortDirection,
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
} from "../grid-engine/edit-engine";
import { multiSortData } from "../grid-engine/sort-engine";

export const DataGrid: React.FC<DataGridProps> = ({
  schema,
  data,
  config,
  onCellEdit,
  onCellFocus,
  height,
  width,
}) => {
  // --- REFS ---
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- COLUMN METRICS (Memoized) ---
  const columnMetrics = useMemo(
    () => calculateColumnMetrics(schema.columns),
    [schema.columns],
  );

  // --- STATE ---
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [focusedCell, setFocusedCell] = useState<CellPosition>({
    rowIndex: 0,
    colIndex: 0,
  });
  const [editState, setEditState] = useState<EditStateType | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");
  const [dataState, setDataState] = useState<readonly GridRow[]>(data);
  const [sortStack, setSortStack] = useState<SortDescriptor[]>([]);

  // Update data when prop changes
  useEffect(() => {
    setDataState(data);
  }, [data]);

  // --- SORTING ENGINE ---
  // Memoize sorted data to maintain 60 FPS performance [cite: 140]
  const sortedData = useMemo(() => {
    return multiSortData(dataState, sortStack);
  }, [dataState, sortStack]);

  // --- VIRTUALIZATION RANGES ---
  const visibleRows = useMemo(
    () =>
      calculateVisibleRows(
        scrollTop,
        config.rowHeight,
        height,
        sortedData.length, // Uses sorted data count [cite: 29]
        config.overscanRows,
      ),
    [
      scrollTop,
      config.rowHeight,
      height,
      sortedData.length,
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

  // --- EVENT HANDLERS ---

  // Multi-column sorting logic
  const handleHeaderClick = (columnId: string, isMulti: boolean) => {
    setSortStack((prev) => {
      const existing = prev.find((s) => s.columnId === columnId);
      let nextDirection: SortDirection = "asc";

      if (existing?.direction === "asc") nextDirection = "desc";
      else if (existing?.direction === "desc") nextDirection = null;

      if (!isMulti) {
        return nextDirection ? [{ columnId, direction: nextDirection }] : [];
      }

      const filtered = prev.filter((s) => s.columnId !== columnId);
      return nextDirection
        ? [...filtered, { columnId, direction: nextDirection }]
        : filtered;
    });
  };

  const totalHeight = getTotalHeight(sortedData.length, config.rowHeight);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
    setScrollLeft(target.scrollLeft);
  }, []);

  const handleCellClick = useCallback(
    (position: CellPosition) => {
      setFocusedCell(position);
      setEditState(null);

      setTimeout(() => {
        focusCell(position, containerRef.current);
      }, 0);

      if (onCellFocus) {
        onCellFocus(position.rowIndex, position.colIndex);
      }
    },
    [onCellFocus],
  );

  const scrollCellIntoView = useCallback(
    (position: CellPosition) => {
      if (!scrollContainerRef.current) return;

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
            sortedData.length,
            config.infiniteColumns,
          );
          break;

        case "tab":
          newPosition = handleTabKey(
            position,
            action.isShift,
            schema,
            sortedData.length,
            config.infiniteColumns,
          );
          break;

        case "home-end":
          newPosition = handleHomeEndKey(
            position,
            action.key,
            action.isCtrl,
            schema,
            sortedData.length,
            config.infiniteColumns,
          );
          break;

        case "page":
          newPosition = handlePageKey(
            position,
            action.key,
            config.rowHeight,
            height,
            sortedData.length,
          );
          break;

        case "enter":
          if (isCellEditable(position, schema)) {
            const row = sortedData[position.rowIndex];
            const column = schema.columns[position.colIndex];
            if (row && column) {
              const currentValue = row[column.id];
              setEditState(createEditState(position, currentValue));
            }
          }
          return;

        case "escape":
          if (editState) setEditState(null);
          return;
      }

      setFocusedCell(newPosition);
      scrollCellIntoView(newPosition);

      setTimeout(() => {
        focusCell(newPosition, containerRef.current);
      }, 0);

      if (onCellFocus) {
        onCellFocus(newPosition.rowIndex, newPosition.colIndex);
      }
    },
    [
      schema,
      sortedData,
      config.rowHeight,
      height,
      scrollCellIntoView,
      onCellFocus,
      editState,
    ],
  );

  const handleEditChange = useCallback(
    (value: string) => {
      if (!editState) return;
      setEditState(updateEditValue(editState, value));
    },
    [editState],
  );

  const handleEditCommit = useCallback(async () => {
    if (!editState) return;

    const { position } = editState;
    const column =
      schema.columns[position.colIndex] ??
      (config.infiniteColumns
        ? generateDefaultColumn(position.colIndex, config.defaultColumnWidth)
        : null);
    if (!column) return;

    const result = await processEditCommit(editState);

    // Optimistic UI Update [cite: 32]
    const newData = [...dataState];
    const row = newData[position.rowIndex];
    if (row) {
      newData[position.rowIndex] = {
        ...row,
        [column.id]: result.value,
      };
      setDataState(newData);
    }

    if (result.state.status === "success") {
      setAnnouncement(
        createEditAnnouncement(
          column.label,
          editState.originalValue,
          result.value,
        ),
      );
      setEditState(null);

      if (onCellEdit) {
        await onCellEdit(
          position.rowIndex,
          position.colIndex,
          editState.originalValue,
          result.value,
        );
      }

      setTimeout(() => {
        focusCell(position, containerRef.current);
      }, 0);
    } else if (result.state.status === "error") {
      setEditState(result.state);
      if (result.state.error) {
        setAnnouncement(createErrorAnnouncement(result.state.error));
      }

      // Rollback logic after simulated delay [cite: 32]
      setTimeout(() => {
        setEditState(null);
        focusCell(position, containerRef.current);
      }, 2000);
    }
  }, [
    editState,
    schema,
    dataState,
    onCellEdit,
    config.infiniteColumns,
    config.defaultColumnWidth,
  ]);

  const handleEditCancel = useCallback(() => {
    if (!editState) return;
    setEditState(null);
    setTimeout(() => {
      focusCell(editState.position, containerRef.current);
    }, 0);
  }, [editState]);

  // --- ARIA AND ACCESSIBILITY ---
  const gridAriaProps = getGridAriaProps(
    sortedData.length,
    schema.columns.length,
    false,
    config.infiniteColumns,
  );
  const gridAriaLabel = getGridAriaLabel(
    "Data Grid",
    sortedData.length,
    schema.columns.length,
  );
  const liveRegionProps = getLiveRegionProps();

  // --- RENDERING ---

  const renderHeader = () => {
    const headerCells: React.ReactElement[] = [];
    const columnsToRender: number[] = [];

    if (config.infiniteColumns) {
      for (let i = 0; i < columnMetrics.pinnedCount; i++)
        columnsToRender.push(i);
      for (
        let i = Math.max(columnMetrics.pinnedCount, visibleColumns.startCol);
        i <= visibleColumns.endCol;
        i++
      ) {
        columnsToRender.push(i);
      }
    } else {
      for (let i = 0; i < schema.columns.length; i++) {
        const isPinned = i < columnMetrics.pinnedCount;
        const isVisible =
          i >= visibleColumns.startCol && i <= visibleColumns.endCol;
        if (isPinned || isVisible) columnsToRender.push(i);
      }
    }

    for (const colIndex of columnsToRender) {
      const column =
        schema.columns[colIndex] ??
        (config.infiniteColumns
          ? generateDefaultColumn(colIndex, config.defaultColumnWidth)
          : null);

      if (!column) continue;

      const pos = calculateCellPosition(
        { rowIndex: -1, colIndex },
        config.rowHeight,
        columnMetrics,
        scrollLeft,
        config.infiniteColumns,
        config.defaultColumnWidth,
        true,
      );

      headerCells.push(
        <GridCell
          key={`header-${colIndex}`}
          position={{ rowIndex: -1, colIndex }}
          column={column}
          value={column.label}
          x={pos.x}
          y={0}
          isFocused={false}
          isHeader={true}
          totalRows={sortedData.length}
          pinnedCount={columnMetrics.pinnedCount}
          editState={null}
          onClick={(event) =>
            handleHeaderClick(column.id, (event as any).shiftKey)
          }
          onKeyDown={() => {}}
          onEditChange={() => {}}
          onEditCommit={() => {}}
          onEditCancel={() => {}}
        />,
      );
    }
    return headerCells;
  };

  const renderDataRows = () => {
    const cells: React.ReactElement[] = [];

    for (
      let rowIndex = visibleRows.startRow;
      rowIndex <= visibleRows.endRow;
      rowIndex++
    ) {
      const row = sortedData[rowIndex]; // Accessing sorted data source [cite: 29]
      if (!row) continue;

      const columnsToRender: number[] = [];

      if (config.infiniteColumns) {
        for (let i = 0; i < columnMetrics.pinnedCount; i++)
          columnsToRender.push(i);
        for (
          let i = Math.max(columnMetrics.pinnedCount, visibleColumns.startCol);
          i <= visibleColumns.endCol;
          i++
        ) {
          columnsToRender.push(i);
        }
      } else {
        for (let i = 0; i < schema.columns.length; i++) {
          const isPinned = i < columnMetrics.pinnedCount;
          const isVisible =
            i >= visibleColumns.startCol && i <= visibleColumns.endCol;
          if (isPinned || isVisible) columnsToRender.push(i);
        }
      }

      for (const colIndex of columnsToRender) {
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
          false,
        );

        const isFocused =
          focusedCell.rowIndex === rowIndex &&
          focusedCell.colIndex === colIndex;

        const cellValue = row?.[column.id];

        cells.push(
          <GridCell
            key={`${rowIndex}-${colIndex}`}
            position={position}
            column={column}
            value={cellValue}
            x={cellPosition.x}
            y={cellPosition.y}
            isFocused={isFocused}
            isHeader={false}
            totalRows={sortedData.length}
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

  const getScrollContainerWidth = () => {
    if (config.infiniteColumns) {
      const defaultWidth = config.defaultColumnWidth ?? 150;
      const rightmostColumn = visibleColumns.endCol;
      const viewportsAhead = 20;
      const viewportColumns = Math.ceil(width / defaultWidth);
      return (
        (rightmostColumn + viewportsAhead * viewportColumns) * defaultWidth
      );
    }
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

      <div
        ref={scrollContainerRef}
        className="w-full overflow-auto"
        style={{ height: height - config.rowHeight }}
        onScroll={handleScroll}
      >
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

      <div {...liveRegionProps} className="sr-only" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
};
