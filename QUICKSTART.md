# Quick Start Guide

Get the data grid running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- npm or yarn installed
- Modern browser (Chrome, Firefox, Safari, Edge)

## Installation

```bash
# Navigate to project directory
cd data-grid-engine

# Install dependencies
npm install
```

This will install:

- React 18.3
- TypeScript 5.7
- Vite 6
- Tailwind CSS 3.4
- Storybook 8.4
- Testing libraries

## Running the Demo

### Option 1: Development Server (Recommended)

```bash
npm run dev
```

Then open http://localhost:3000

You'll see:

- Live grid with 50,000 rows
- Performance metrics
- Feature demonstrations
- Real-time console logging

### Option 2: Storybook (Best for Exploration)

```bash
npm run storybook
```

Then open http://localhost:6006

Explore:

- **Basic Grid**: Small dataset (100 rows)
- **Large Dataset**: 50,000 rows stress test
- **Pinned Columns**: Frozen columns demo
- **Keyboard Navigation**: Full keyboard support
- **Cell Editing**: Inline editing with validation
- **Wide Grid**: Horizontal virtualization
- **Accessibility Test**: ARIA compliance check

## Testing

### Run Unit Tests

```bash
npm test
```

Runs Vitest test suite covering:

- Rendering and virtualization
- Keyboard navigation
- Cell editing
- Focus management
- Accessibility

### Run Tests in UI Mode

```bash
npm run test:ui
```

Opens interactive test UI in browser.

### Check TypeScript

```bash
npm run lint
```

Verifies zero TypeScript errors (strict mode).

## Building for Production

```bash
npm run build
```

Creates optimized bundle in `dist/` directory.

Preview production build:

```bash
npm run preview
```

## Project Structure

```
data-grid-engine/
├── src/
│   ├── grid-engine/          # Core engines (pure TypeScript)
│   │   ├── types.ts           # Type definitions
│   │   ├── virtualization.ts  # Row/column windowing
│   │   ├── layout.ts          # Cell positioning
│   │   ├── keyboard.ts        # Navigation logic
│   │   ├── accessibility.ts   # ARIA attributes
│   │   └── edit-engine.ts     # Edit state management
│   ├── components/            # React components
│   │   ├── DataGrid.tsx       # Main grid component
│   │   └── GridCell.tsx       # Cell component
│   ├── storybook/             # Storybook stories
│   │   └── DataGrid.stories.tsx
│   ├── tests/                 # Test suites
│   │   ├── setup.ts
│   │   └── DataGrid.test.tsx
│   ├── main.tsx               # App entry point
│   └── index.css              # Styles
├── README.md                  # Full documentation
├── PERFORMANCE.md             # Performance analysis
├── ARCHITECTURE.md            # Architecture decisions
└── package.json
```

## Key Features to Try

### 1. Scroll Performance

1. Open the demo (npm run dev)
2. Press F12 → Performance tab
3. Click Record
4. Scroll rapidly from top to bottom
5. Stop recording
6. Verify: Green FPS graph (60 FPS), no red bars

### 2. Virtualization

1. Open Console (F12)
2. Run: `document.querySelectorAll('[role="gridcell"]').length`
3. Expected: ~270 cells (not 450,000)

### 3. Keyboard Navigation

1. Click any cell in the grid
2. Use these keys:
   - **Arrow keys**: Navigate cells
   - **Tab**: Next cell
   - **Enter**: Edit cell (on Name/Email columns)
   - **Escape**: Cancel edit
   - **Home**: First column
   - **End**: Last column
   - **Ctrl+Home**: First cell in grid
   - **PageDown**: Jump down

### 4. Cell Editing

1. Click a Name or Email cell
2. Press Enter to edit
3. Type new value
4. Press Enter to save
   - Watch for yellow "pending" state
   - Then green "success" flash
5. Try leaving it empty
   - Watch for red "error" state
   - Value rolls back automatically

### 5. Pinned Columns

1. Notice ID and Name columns on the left
2. Scroll horizontally to the right
3. ID and Name stay fixed
4. Other columns scroll normally

## Troubleshooting

### Port Already in Use

If port 3000 is busy:

```bash
# Edit vite.config.ts, change:
server: {
  port: 3001  // or any free port
}
```

### TypeScript Errors

Ensure strict mode is working:

```bash
npm run lint
```

Should show zero errors. If you see errors, check your TypeScript version:

```bash
npx tsc --version
```

Should be 5.7 or higher.

### Performance Issues

If grid feels slow:

1. Check browser: Use Chrome/Edge for best performance
2. Check data size: Verify it's actually 50,000 rows
3. Check FPS: Use Performance panel to verify 60 FPS
4. Disable browser extensions: Some extensions slow down pages

### Tests Failing

If tests fail:

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm test
```

## Next Steps

### Customize the Grid

Edit `src/main.tsx` to change:

```typescript
// Change dataset size
data={generateDemoData(10000)}  // 10k rows instead of 50k

// Change row height
config={{
  rowHeight: 50,  // Taller rows
  overscanRows: 3,
  overscanColumns: 1,
}}

// Change dimensions
height={800}
width={1600}
```

### Add Your Own Columns

Edit the schema:

```typescript
const mySchema: GridSchema = {
  columns: [
    { id: "id", label: "ID", width: 80, pinned: true },
    { id: "name", label: "Name", width: 200, editable: true },
    // Add more columns...
  ],
};
```

### Connect to Real Data

Replace mock data with your API:

```typescript
// Fetch data from API
const [data, setData] = useState<GridData>([]);

useEffect(() => {
  fetch('/api/data')
    .then(res => res.json())
    .then(setData);
}, []);

<DataGrid data={data} ... />
```

### Add Custom Validation

```typescript
<DataGrid
  onCellEdit={async (row, col, oldVal, newVal) => {
    // Call your API
    const response = await fetch('/api/validate', {
      method: 'POST',
      body: JSON.stringify({ row, col, value: newVal }),
    });

    const result = await response.json();
    return {
      isValid: result.valid,
      error: result.error,
    };
  }}
/>
```

## Learning Resources

- **README.md**: Full feature documentation
- **PERFORMANCE.md**: Deep dive into performance
- **ARCHITECTURE.md**: Architecture decisions
- **Storybook**: Interactive examples
- **Tests**: Usage examples

## Getting Help

If stuck:

1. Check console for errors (F12 → Console)
2. Review Storybook examples
3. Read inline code comments (very detailed)
4. Check ARCHITECTURE.md for design rationale

## Common Use Cases

### Read-Only Grid

```typescript
const schema: GridSchema = {
  columns: [
    { id: "name", label: "Name", width: 200 }, // No editable: true
  ],
};
```

### All Columns Editable

```typescript
columns.map((col) => ({ ...col, editable: true }));
```

### Custom Row Height

```typescript
config={{
  rowHeight: 60,  // Taller rows for more content
}}
```

### More Overscan (Smoother Scroll)

```typescript
config={{
  overscanRows: 10,  // Render more off-screen rows
  overscanColumns: 3,
}}
```

Trade-off: More DOM nodes, but less flashing during fast scroll.

---

**Ready to start!** Run `npm run dev` and explore the grid. 🚀
