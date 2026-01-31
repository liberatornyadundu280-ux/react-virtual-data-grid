// grid-engine/sort-engine.ts
import type { GridRow, SortDescriptor } from "./types";

/**
 * Deterministic multi-column sorter.
 * Cycles through the sort stack until a difference is found.
 */
export function multiSortData(
  data: readonly GridRow[],
  sortStack: readonly SortDescriptor[],
): readonly GridRow[] {
  if (sortStack.length === 0) return data;

  // Create a shallow copy to avoid mutating the original data
  return [...data].sort((rowA, rowB) => {
    for (const sort of sortStack) {
      const { columnId, direction } = sort;
      if (!direction) continue;

      const valueA = rowA[columnId];
      const valueB = rowB[columnId];

      if (valueA === valueB) continue;

      const multiplier = direction === "asc" ? 1 : -1;

      // Handle basic types (Strings, Numbers)
      if (typeof valueA === "number" && typeof valueB === "number") {
        return (valueA - valueB) * multiplier;
      }

      return String(valueA).localeCompare(String(valueB)) * multiplier;
    }

    // Deterministic fallback: Use ID to ensure stable order if values are identical
    return String(rowA.id).localeCompare(String(rowB.id));
  });
}
