import React from "react";
import ReactDOM from "react-dom/client";
import { DataGrid } from "./components/DataGrid";
import type { GridSchema, GridData } from "./grid-engine/types";
import "./index.css";

// Generate demo data
function generateDemoData(count: number): GridData {
  const data: GridData = [];

  for (let i = 0; i < count; i++) {
    data.push({
      id: i + 1,
      name: `Person ${i + 1}`,
      email: `person${i + 1}@example.com`,
      age: 20 + (i % 50),
      department:
        ["Engineering", "Sales", "Marketing", "HR", "Finance"][i % 5] ??
        "Engineering",
      salary: 50000 + (i % 100) * 1000,
      city:
        ["New York", "San Francisco", "London", "Tokyo", "Berlin"][i % 5] ??
        "New York",
      country: ["USA", "USA", "UK", "Japan", "Germany"][i % 5] ?? "USA",
      status: i % 3 === 0 ? "Active" : "Inactive",
    });
  }

  return data;
}

// Demo schema with pinned columns
const demoSchema: GridSchema = {
  columns: [
    { id: "id", label: "ID", width: 80, pinned: true },
    { id: "name", label: "Name", width: 200, pinned: true, editable: true },
    { id: "email", label: "Email", width: 250, editable: true },
    { id: "age", label: "Age", width: 80, editable: true },
    { id: "department", label: "Department", width: 150, editable: true },
    { id: "salary", label: "Salary", width: 120, editable: true },
    { id: "city", label: "City", width: 150, editable: true },
    { id: "country", label: "Country", width: 120, editable: true },
    { id: "status", label: "Status", width: 100, editable: true },
  ],
};

function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Headless Data Grid Engine
          </h1>
          <p className="text-lg text-gray-600">
            Production-grade virtualized grid with 50,000+ rows, keyboard
            navigation, and inline editing
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Features Demo</h2>
          <ul className="grid grid-cols-2 gap-4 text-sm text-gray-700 mb-6">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>
                <strong>50,000 rows</strong> - Smooth scrolling at 60 FPS
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>
                <strong>Infinite columns</strong> - Scroll right indefinitely
                (A, B... Z, AA...)
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>
                <strong>Virtualization</strong> - Only visible cells rendered
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>
                <strong>Pinned columns</strong> - ID and Name stay fixed
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>
                <strong>Sticky headers</strong> - Headers stay at top
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>
                <strong>Keyboard navigation</strong> - Arrow keys, Tab, etc.
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>
                <strong>Inline editing</strong> - Click or press Enter
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>
                <strong>Accessibility</strong> - Full ARIA support
              </span>
            </li>
          </ul>

          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Try it:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • Scroll rapidly up/down to test virtualization performance
              </li>
              <li>
                • Scroll right to reveal infinite columns (J, K, L... Z, AA,
                AB...)
              </li>
              <li>• Click a Name or Email cell and press Enter to edit</li>
              <li>
                • Use arrow keys, Tab, Home, End, PageUp/Down for navigation
              </li>
              <li>
                • Try editing and leaving value empty (validation will reject)
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Grid: 50,000 Rows × Infinite Columns
              </h2>
              <div className="text-sm text-gray-600">
                <span className="font-mono bg-gray-200 px-2 py-1 rounded">
                  ~30 rows × ~10 columns rendered at any time
                </span>
              </div>
            </div>
          </div>

          <div className="p-4">
            <DataGrid
              schema={demoSchema}
              data={generateDemoData(50000)}
              config={{
                rowHeight: 40,
                overscanRows: 5,
                overscanColumns: 2,
                infiniteColumns: true, // Enable infinite columns
                defaultColumnWidth: 150, // Default width for generated columns
              }}
              height={600}
              width={1400}
              onCellEdit={async (
                row: number,
                col: number,
                oldValue: unknown,
                newValue: unknown,
              ) => {
                console.log("Cell edited:", { row, col, oldValue, newValue });
                return { isValid: true };
              }}
              onCellFocus={(row: number, col: number) => {
                console.log("Cell focused:", { row, col });
              }}
            />
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Open browser DevTools Console to see edit events</p>
          <p className="mt-2">
            Press F12 → Performance tab → Record while scrolling to verify 60
            FPS
          </p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
