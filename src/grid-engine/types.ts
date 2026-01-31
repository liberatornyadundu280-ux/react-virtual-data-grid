/**
 * Core type definitions for the headless data grid engine.
 *
 * These types form the contract between the grid engine and consumers.
 * All types are designed to be:
 * - Immutable (readonly where appropriate)
 * - Strictly typed (no implicit any)
 * - Self-documenting
 */

/**
 * Column definition in the grid schema.
 * Describes structure, behavior, and metadata for a single column.
 */
export interface GridColumn {
  /** Unique identifier for the column (used as key in row data) */
  readonly id: string;

  /** Display label for the column header */
  readonly label: string;

  /** Column width in pixels */
  readonly width: number;

  /** Whether this column is pinned (frozen) to the left side */
  readonly pinned?: boolean;

  /** Whether cells in this column can be edited */
  readonly editable?: boolean;

  /** Data type hint for rendering and validation */
  readonly type?: "text" | "number" | "date" | "boolean";
}

/**
 * Complete grid schema definition.
 * Defines all columns and their properties.
 */
export interface GridSchema {
  readonly columns: readonly GridColumn[];
}

/**
 * A single row of data in the grid.
 * Keys correspond to column IDs, values are cell data.
 */
export type GridRow = Record<string, unknown>;

/**
 * Complete dataset for the grid.
 * Array of rows, where each row is keyed by column ID.
 */
export type GridData = readonly GridRow[];

/**
 * Logical coordinates of a cell in the grid.
 * Uses zero-based indexing.
 */
export interface CellPosition {
  readonly rowIndex: number;
  readonly colIndex: number;
}

/**
 * Range of visible rows in the viewport.
 * Inclusive on both ends.
 */
export interface RowRange {
  readonly startRow: number;
  readonly endRow: number;
}

/**
 * Range of visible columns in the viewport.
 * Inclusive on both ends.
 */
export interface ColumnRange {
  readonly startCol: number;
  readonly endCol: number;
}

/**
 * Computed metrics for column layout.
 * Pre-calculated to avoid expensive recalculations during scroll.
 */
export interface ColumnMetrics {
  /** Cumulative offsets for each column (used for positioning) */
  readonly offsets: readonly number[];

  /** Total width of all columns combined */
  readonly totalWidth: number;

  /** Total width of pinned columns */
  readonly pinnedWidth: number;

  /** Number of columns that are pinned */
  readonly pinnedCount: number;
}

/**
 * Current scroll position of the grid viewport.
 */
export interface ScrollPosition {
  readonly scrollTop: number;
  readonly scrollLeft: number;
}

/**
 * Dimensions of the grid viewport.
 */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Active edit state for a cell.
 * Includes original value for rollback capability.
 */
export interface EditState {
  readonly position: CellPosition;
  readonly originalValue: unknown;
  readonly currentValue: unknown;
  readonly isPending: boolean;
  readonly error: string | null;
}

/**
 * Complete grid state.
 * Single source of truth for all grid behavior.
 */
export interface GridState {
  /** Current scroll position */
  readonly scroll: ScrollPosition;

  /** Viewport dimensions */
  readonly viewport: ViewportSize;

  /** Currently focused cell (for keyboard navigation) */
  readonly focusedCell: CellPosition | null;

  /** Active edit session (null when not editing) */
  readonly editState: EditState | null;

  /** Pre-computed column metrics */
  readonly columnMetrics: ColumnMetrics;

  /** Visible row range (calculated from scroll position) */
  readonly visibleRows: RowRange;

  /** Visible column range (calculated from scroll position) */
  readonly visibleColumns: ColumnRange;
}

/**
 * Configuration for virtualization behavior.
 */
export interface VirtualizationConfig {
  /** Fixed height of each row in pixels */
  readonly rowHeight: number;

  /** Number of extra rows to render above/below viewport (reduces flashing) */
  readonly overscanRows: number;

  /** Number of extra columns to render left/right of viewport */
  readonly overscanColumns: number;

  /** Enable infinite column mode (Excel-like unbounded columns) */
  readonly infiniteColumns?: boolean;

  /** Default width for generated columns in infinite mode */
  readonly defaultColumnWidth?: number;
}

/**
 * Result of a cell edit validation.
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
}

/**
 * Callback types for grid interactions.
 */
export type OnCellEdit = (
  rowIndex: number,
  colIndex: number,
  oldValue: unknown,
  newValue: unknown,
) => Promise<ValidationResult>;

export type OnCellFocus = (rowIndex: number, colIndex: number) => void;

/**
 * Props for the main DataGrid component.
 */
export interface DataGridProps {
  /** Grid schema defining columns */
  readonly schema: GridSchema;

  /** Data to display */
  readonly data: GridData;

  /** Virtualization configuration */
  readonly config: VirtualizationConfig;

  /** Callback when cell is edited */
  readonly onCellEdit?: OnCellEdit;

  /** Callback when cell receives focus */
  readonly onCellFocus?: OnCellFocus;

  /** Height of the grid container */
  readonly height: number;

  /** Width of the grid container */
  readonly width: number;
}
// grid-engine/types.ts
export type SortDirection = "asc" | "desc" | null;

export interface SortDescriptor {
  readonly columnId: string;
  readonly direction: SortDirection;
}

// Update GridState to track the sort stack
export interface GridState {
  // ... existing state
  readonly sortStack: readonly SortDescriptor[];
}
