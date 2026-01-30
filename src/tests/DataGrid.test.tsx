/**
 * DataGrid Tests
 *
 * Comprehensive test suite covering:
 * - Rendering and virtualization
 * - Keyboard navigation
 * - Cell editing and validation
 * - Focus management
 * - Accessibility (ARIA attributes)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { DataGrid } from "../components/DataGrid";
import type { GridSchema, GridData } from "../grid-engine/types";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Test data
const testSchema: GridSchema = {
  columns: [
    { id: "id", label: "ID", width: 100 },
    { id: "name", label: "Name", width: 200, editable: true },
    { id: "email", label: "Email", width: 250, editable: true },
  ],
};

const testData: GridData = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
  { id: 3, name: "Charlie", email: "charlie@example.com" },
];

const defaultConfig = {
  rowHeight: 40,
  overscanRows: 5,
  overscanColumns: 2,
};

describe("DataGrid", () => {
  describe("Rendering", () => {
    it("renders the grid container", () => {
      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      const grid = screen.getByRole("grid");
      expect(grid).toBeInTheDocument();
    });

    it("renders header row with column labels", () => {
      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      expect(
        screen.getByRole("columnheader", { name: /ID/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: /Name/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: /Email/i }),
      ).toBeInTheDocument();
    });

    it("renders data rows", () => {
      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    it("only renders visible rows (virtualization)", () => {
      // Create large dataset
      const largeData: GridData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Person ${i + 1}`,
        email: `person${i + 1}@example.com`,
      }));

      const { container } = render(
        <DataGrid
          schema={testSchema}
          data={largeData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      // Count rendered data rows (excluding header)
      const gridcells = container.querySelectorAll('[role="gridcell"]');

      // Should render much fewer than 1000 rows × 3 columns = 3000 cells
      // With height 400 and rowHeight 40: ~10 visible rows + overscan
      // Expected: ~15 rows × 3 columns = ~45 cells
      expect(gridcells.length).toBeLessThan(100);
    });
  });

  describe("Accessibility", () => {
    it("has no accessibility violations", async () => {
      const { container } = render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has correct ARIA attributes on grid", () => {
      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      const grid = screen.getByRole("grid");
      expect(grid).toHaveAttribute("aria-rowcount", "4"); // 3 data + 1 header
      expect(grid).toHaveAttribute("aria-colcount", "3");
    });

    it("has correct ARIA attributes on cells", () => {
      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      const firstCell = screen.getByText("Alice").closest('[role="gridcell"]');
      expect(firstCell).toHaveAttribute("aria-colindex");
      expect(firstCell).toHaveAttribute("tabIndex");
    });

    it("implements roving tabindex pattern", () => {
      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      // Find cells with tabIndex 0 (focusable)
      const focusableCells = screen
        .getAllByRole("gridcell")
        .filter((cell) => cell.getAttribute("tabIndex") === "0");

      // Only one cell should have tabIndex 0
      expect(focusableCells.length).toBeLessThanOrEqual(1);
    });
  });

  describe("Keyboard Navigation", () => {
    it("navigates with arrow keys", async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();

      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
          onCellFocus={handleFocus}
        />,
      );

      // Click first data cell to focus
      const firstCell = screen
        .getByText("1")
        .closest('[role="gridcell"]') as HTMLElement;
      await user.click(firstCell);

      // Press ArrowRight
      await user.keyboard("{ArrowRight}");

      // Should have called focus callback with new position
      await waitFor(() => {
        expect(handleFocus).toHaveBeenCalledWith(0, 1); // Row 0, Col 1
      });
    });

    it("navigates with Tab key", async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();

      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
          onCellFocus={handleFocus}
        />,
      );

      // Focus first cell
      const firstCell = screen
        .getByText("1")
        .closest('[role="gridcell"]') as HTMLElement;
      await user.click(firstCell);

      // Press Tab
      await user.keyboard("{Tab}");

      // Should move to next cell
      await waitFor(() => {
        expect(handleFocus).toHaveBeenCalled();
      });
    });

    it("prevents navigation beyond grid boundaries", async () => {
      const user = userEvent.setup();

      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      // Focus first cell (top-left)
      const firstCell = screen
        .getByText("1")
        .closest('[role="gridcell"]') as HTMLElement;
      await user.click(firstCell);

      // Try to go up (should stay at row 0)
      await user.keyboard("{ArrowUp}");

      // Focus should still be on first row
      expect(document.activeElement).toHaveAttribute("data-row-index", "0");
    });
  });

  describe("Cell Editing", () => {
    it("enters edit mode on Enter key", async () => {
      const user = userEvent.setup();

      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      // Click editable cell (Name column)
      const nameCell = screen
        .getByText("Alice")
        .closest('[role="gridcell"]') as HTMLElement;
      await user.click(nameCell);

      // Press Enter to edit
      await user.keyboard("{Enter}");

      // Should show input
      await waitFor(() => {
        const input = screen.getByDisplayValue("Alice");
        expect(input).toBeInTheDocument();
      });
    });

    it("commits edit on Enter key", async () => {
      const user = userEvent.setup();
      const handleEdit = vi.fn().mockResolvedValue({ isValid: true });

      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
          onCellEdit={handleEdit}
        />,
      );

      // Enter edit mode
      const nameCell = screen
        .getByText("Alice")
        .closest('[role="gridcell"]') as HTMLElement;
      await user.click(nameCell);
      await user.keyboard("{Enter}");

      // Type new value
      const input = await screen.findByDisplayValue("Alice");
      await user.clear(input);
      await user.type(input, "Alicia");

      // Commit with Enter
      await user.keyboard("{Enter}");

      // Should have called edit callback
      await waitFor(() => {
        expect(handleEdit).toHaveBeenCalledWith(
          0, // row index
          1, // col index
          "Alice", // old value
          "Alicia", // new value
        );
      });
    });

    it("cancels edit on Escape key", async () => {
      const user = userEvent.setup();

      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      // Enter edit mode
      const nameCell = screen
        .getByText("Alice")
        .closest('[role="gridcell"]') as HTMLElement;
      await user.click(nameCell);
      await user.keyboard("{Enter}");

      // Type new value
      const input = await screen.findByDisplayValue("Alice");
      await user.clear(input);
      await user.type(input, "Alicia");

      // Cancel with Escape
      await user.keyboard("{Escape}");

      // Should restore original value
      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.queryByText("Alicia")).not.toBeInTheDocument();
      });
    });

    it("shows pending state during validation", async () => {
      const user = userEvent.setup();

      // Mock slow validation
      const handleEdit = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ isValid: true }), 1000);
        });
      });

      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
          onCellEdit={handleEdit}
        />,
      );

      // Edit cell
      const nameCell = screen
        .getByText("Alice")
        .closest('[role="gridcell"]') as HTMLElement;
      await user.click(nameCell);
      await user.keyboard("{Enter}");

      const input = await screen.findByDisplayValue("Alice");
      await user.clear(input);
      await user.type(input, "Alicia");
      await user.keyboard("{Enter}");

      // Should show spinner during validation
      await waitFor(() => {
        const cell = screen.getByText("Alicia").closest('[role="gridcell"]');
        expect(cell).toHaveClass("animate-pulse");
      });
    });

    it("validates and rejects empty values", async () => {
      const user = userEvent.setup();

      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      // Edit cell
      const nameCell = screen
        .getByText("Alice")
        .closest('[role="gridcell"]') as HTMLElement;
      await user.click(nameCell);
      await user.keyboard("{Enter}");

      // Clear value (make it empty)
      const input = await screen.findByDisplayValue("Alice");
      await user.clear(input);
      await user.keyboard("{Enter}");

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument();
      });

      // Should rollback to original value
      await waitFor(
        () => {
          expect(screen.getByText("Alice")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Focus Management", () => {
    it("maintains focus during virtualization", async () => {
      const largeData: GridData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Person ${i + 1}`,
        email: `person${i + 1}@example.com`,
      }));

      const { container } = render(
        <DataGrid
          schema={testSchema}
          data={largeData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      // Focus a cell
      const cell = screen
        .getByText("Person 1")
        .closest('[role="gridcell"]') as HTMLElement;
      cell.focus();

      // Scroll down (triggers re-render with new visible range)
      const scrollContainer = container.querySelector(
        '[class*="overflow"]',
      ) as HTMLElement;
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 500 } });

      // Focus should be restored after scroll
      await waitFor(() => {
        const focusedElement = document.activeElement;
        expect(focusedElement).toHaveAttribute("role", "gridcell");
      });
    });

    it("restores focus after editing", async () => {
      const user = userEvent.setup();

      render(
        <DataGrid
          schema={testSchema}
          data={testData}
          config={defaultConfig}
          height={400}
          width={800}
        />,
      );

      // Edit cell
      const nameCell = screen
        .getByText("Alice")
        .closest('[role="gridcell"]') as HTMLElement;
      await user.click(nameCell);
      await user.keyboard("{Enter}");

      // Make valid change
      const input = await screen.findByDisplayValue("Alice");
      await user.clear(input);
      await user.type(input, "Alicia");
      await user.keyboard("{Enter}");

      // Focus should return to cell after edit completes
      await waitFor(
        () => {
          const focusedElement = document.activeElement;
          expect(focusedElement).toHaveAttribute("role", "gridcell");
          expect(focusedElement).toHaveAttribute("data-row-index", "0");
          expect(focusedElement).toHaveAttribute("data-col-index", "1");
        },
        { timeout: 3000 },
      );
    });
  });
});
