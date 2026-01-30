#!/bin/bash

# Fix DataGrid.stories.tsx
sed -i 's/onCellFocus: (row, col)/onCellFocus: (row: number, col: number)/g' src/components/DataGrid.stories.tsx
sed -i 's/onCellEdit: async (row, col, oldValue, newValue)/onCellEdit: async (row: number, col: number, oldValue: unknown, newValue: unknown)/g' src/components/DataGrid.stories.tsx
sed -i 's/\.map((row) =>/\.map((row: GridRow) =>/g' src/components/DataGrid.stories.tsx

# Fix main.tsx
sed -i 's/onCellEdit={async (row, col, oldValue, newValue)/onCellEdit={async (row: number, col: number, oldValue: unknown, newValue: unknown)/g' src/main.tsx
sed -i 's/onCellFocus={(row, col)/onCellFocus={(row: number, col: number)/g' src/main.tsx

# Fix layout.ts - remove unused variable
sed -i '/const colWidth = colRight - colLeft;/d' src/grid-engine/layout.ts

echo "✅ Type annotations fixed!"
