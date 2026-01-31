/**
 * Edit Engine
 *
 * Manages cell editing with:
 * - Optimistic UI updates (instant feedback)
 * - Async validation
 * - Rollback on validation failure
 * - Visual state management (pending, success, error)
 *
 * Flow:
 * 1. User enters edit mode (press Enter)
 * 2. User modifies value
 * 3. User commits (press Enter)
 * 4. UI updates optimistically (instant)
 * 5. Validation runs asynchronously
 * 6. On success: Keep new value
 * 7. On failure: Rollback to original value
 */

import type { CellPosition, ValidationResult } from "./types";

/**
 * State of a cell edit operation.
 */
export type EditStatus = "idle" | "editing" | "pending" | "success" | "error";

/**
 * Complete state for an active edit.
 */
export interface EditState {
  /** Cell being edited */
  readonly position: CellPosition;

  /** Original value (for rollback) */
  readonly originalValue: unknown;

  /** Current value in the input */
  readonly currentValue: unknown;

  /** Edit status */
  readonly status: EditStatus;

  /** Error message if validation failed */
  readonly error: string | null;
}

/**
 * Create initial edit state when entering edit mode.
 *
 * @param position - Cell position
 * @param value - Current cell value
 * @returns New edit state
 */
export function createEditState(
  position: CellPosition,
  value: unknown,
): EditState {
  return {
    position,
    originalValue: value,
    currentValue: value,
    status: "editing",
    error: null,
  };
}

/**
 * Update edit state with new value (user typing).
 *
 * @param state - Current edit state
 * @param newValue - New value from input
 * @returns Updated edit state
 */
export function updateEditValue(
  state: EditState,
  newValue: unknown,
): EditState {
  return {
    ...state,
    currentValue: newValue,
  };
}

/**
 * Mark edit as pending validation.
 *
 * Called when user commits edit (presses Enter).
 * UI shows loading indicator while validation runs.
 *
 * @param state - Current edit state
 * @returns Updated edit state
 */
export function markEditPending(state: EditState): EditState {
  return {
    ...state,
    status: "pending",
    error: null,
  };
}

/**
 * Mark edit as successful.
 *
 * Called when validation passes.
 * UI shows success indicator (green flash).
 *
 * @param state - Current edit state
 * @returns Updated edit state
 */
export function markEditSuccess(state: EditState): EditState {
  return {
    ...state,
    status: "success",
    error: null,
  };
}

/**
 * Mark edit as failed and prepare for rollback.
 *
 * Called when validation fails.
 * UI shows error indicator (red flash) and error message.
 *
 * @param state - Current edit state
 * @param error - Error message from validation
 * @returns Updated edit state
 */
export function markEditError(state: EditState, error: string): EditState {
  return {
    ...state,
    status: "error",
    error,
  };
}

/**
 * Complete the edit operation.
 *
 * Returns the final value to commit to data:
 * - If validation passed: Returns new value
 * - If validation failed: Returns original value (rollback)
 *
 * @param state - Current edit state
 * @returns Value to commit to data
 */
export function completeEdit(state: EditState): unknown {
  if (state.status === "success") {
    return state.currentValue;
  } else {
    // Rollback on error or cancel
    return state.originalValue;
  }
}

/**
 * Check if edit state has changed from original.
 *
 * Used to determine if validation is needed.
 * If value hasn't changed, skip validation.
 *
 * @param state - Current edit state
 * @returns True if value has changed
 */
export function hasEditChanged(state: EditState): boolean {
  return state.currentValue !== state.originalValue;
}

/**
 * Validate an edit operation.
 *
 * This is a simple built-in validator.
 * In production, this would call a user-provided validation function.
 *
 * Current rules:
 * - Empty strings are invalid
 * - Null/undefined are invalid
 *
 * @param value - Value to validate
 * @returns Validation result
 */
export function validateEdit(value: unknown): ValidationResult {
  // Empty values are invalid
  if (value === null || value === undefined || value === "") {
    return {
      isValid: false,
      error: "Value cannot be empty",
    };
  }

  // All other values are valid (for demo purposes)
  return {
    isValid: true,
  };
}

/**
 * Simulate async validation (for demonstration).
 *
 * In production, this would be replaced by:
 * - API call to backend
 * - Complex business logic
 * - Database constraint checks
 *
 * This simulation randomly succeeds/fails to demonstrate UI behavior.
 *
 * @param value - Value to validate
 * @param delayMs - Artificial delay in milliseconds
 * @returns Promise resolving to validation result
 */
export async function validateEditAsync(
  value: unknown,
  delayMs: number = 500,
): Promise<ValidationResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  // Run validation
  const result = validateEdit(value);

  // Simulate occasional failures (20% chance)
  // This helps demonstrate rollback behavior
  if (result.isValid && Math.random() < 0.2) {
    return {
      isValid: false,
      error: "Validation failed on server",
    };
  }

  return result;
}

/**
 * Process edit commit and handle validation.
 *
 * This is the main orchestrator for the edit flow:
 * 1. Mark as pending
 * 2. Run validation (async)
 * 3. Update state based on result
 * 4. Return final value
 *
 * @param state - Current edit state
 * @param validator - Async validation function
 * @returns Promise resolving to final edit state and value
 */
export async function processEditCommit(
  state: EditState,
  validator: (value: unknown) => Promise<ValidationResult> = validateEditAsync,
): Promise<{ state: EditState; value: unknown }> {
  // If value hasn't changed, return immediately
  if (!hasEditChanged(state)) {
    return {
      state: markEditSuccess(state),
      value: state.originalValue,
    };
  }

  // Mark as pending
  let currentState = markEditPending(state);

  // Run validation
  const result = await validator(state.currentValue);

  if (result.isValid) {
    // Success: Keep new value
    currentState = markEditSuccess(currentState);
    return {
      state: currentState,
      value: state.currentValue,
    };
  } else {
    // Failure: Rollback to original value
    const error = result.error ?? "Validation failed";
    currentState = markEditError(currentState, error);
    return {
      state: currentState,
      value: state.originalValue,
    };
  }
}

/**
 * Cancel edit and rollback.
 *
 * Called when user presses Escape.
 * Returns original value without validation.
 *
 * @param state - Current edit state
 * @returns Original value
 */
export function cancelEdit(state: EditState): unknown {
  return state.originalValue;
}

/**
 * Get CSS class for cell based on edit status.
 *
 * Visual indicators:
 * - editing: Blue border, focus ring
 * - pending: Yellow background, spinner
 * - success: Green flash (via animation)
 * - error: Red border, error icon
 *
 * @param status - Current edit status
 * @returns CSS class name
 */
// grid-engine/edit-engine.ts
export function getEditStatusClass(status: EditStatus): string {
  switch (status) {
    case "error":
      // We use !important (via Tailwind's '!' prefix) or ensure bg-white is gone
      return "bg-red-50 ring-2 ring-red-600 ring-inset";
    case "success":
      return "bg-green-50 ring-2 ring-green-600 ring-inset";
    default:
      return "";
  }
}

/**
 * Check if a position matches the active edit.
 *
 * Used to determine which cell should render an input.
 *
 * @param position - Cell position to check
 * @param editState - Active edit state (or null)
 * @returns True if this cell is being edited
 */
export function isPositionBeingEdited(
  position: CellPosition,
  editState: EditState | null,
): boolean {
  if (!editState) return false;

  return (
    editState.position.rowIndex === position.rowIndex &&
    editState.position.colIndex === position.colIndex
  );
}

/**
 * Create debounced validation function.
 *
 * Useful for real-time validation as user types.
 * Waits for user to stop typing before validating.
 *
 * @param validator - Validation function
 * @param delayMs - Debounce delay
 * @returns Debounced validator
 */
export function createDebouncedValidator(
  validator: (value: unknown) => Promise<ValidationResult>,
  delayMs: number = 300,
): (value: unknown) => Promise<ValidationResult> {
  let timeoutId: NodeJS.Timeout | null = null;

  return (value: unknown) => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        const result = await validator(value);
        resolve(result);
      }, delayMs);
    });
  };
}
