# Bundle Optimization Guide

## Current Bundle Analysis (December 2024)

### Bundle Sizes (Gzipped)

| Chunk | Size | Gzipped | Notes |
|-------|------|---------|-------|
| `vendor.js` | 5.2MB | 1.45MB | Main dependencies |
| `monaco-editor.js` | 4.2MB | 1.07MB | Code editor |
| `three-vendor.js` | 878KB | 236KB | 3D visualization |
| `admin-dashboard.js` | 972KB | 176KB | Admin panel |
| `App.js` | 625KB | 159KB | Main app |
| `workspace-components.js` | 394KB | 89KB | Workspace UI |
| `react-vendor.js` | 305KB | 96KB | React core |

**Total JS (gzipped): ~3.3MB**

## Current Optimizations ✅

### 1. Code Splitting
- Heavy components lazy-loaded via `React.lazy()`
- Manual chunks for large dependencies
- Route-based splitting for admin/workspace

### 2. Manual Chunks (vite.config.ts)
```javascript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'lucide-react'],
  'monaco-editor': ['monaco-editor'],
  'three-vendor': ['three', '@react-three'],
  'socket-vendor': ['socket.io-client'],
  'admin-dashboard': ['components/AdminDashboard'],
  // ...more
}
```

### 3. Lazy-Loaded Components
```javascript
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const CodeEditor = React.lazy(() => import('./components/CodeEditor'));
// ...21 more components
```

### 4. Tree Shaking
- Terser minification enabled
- Console logs dropped in production

## Potential Future Optimizations

### 1. Monaco Editor (~4.2MB)
The Monaco editor is the largest bundle. Options:
- Load only needed languages (currently loads all)
- Consider lightweight alternatives for simple editing

```javascript
// Reduce Monaco languages
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
// Instead of loading all languages
```

### 2. Three.js (~878KB)
- Import only needed components
- Consider lazy-loading 3D features

```javascript
// Instead of
import * as THREE from 'three';
// Use
import { Scene, Camera, Renderer } from 'three';
```

### 3. Vendor Bundle (~5.2MB)
Large dependencies to consider:
- `recharts` - charting library
- `d3` - visualization
- `grapesjs` - page builder
- `react-quill` - rich text editor

Options:
- Lazy-load these features
- Move to separate routes

### 4. Missing Dynamic Imports
Some files are both statically and dynamically imported:
- `services/adminApi.ts`
- `services/adminRateLimitingApi.ts`

Fix: Use only dynamic imports where possible.

## Analyze Bundle

### Install visualizer (optional)
```bash
npm install -D rollup-plugin-visualizer
```

### Build with stats
```bash
npm run build -- --report
```

### Check bundle contents
```bash
# Show chunk dependencies
npx vite-bundle-visualizer

# Show unused exports
npx depcheck
```

## Quick Wins

1. **Remove unused dependencies** (~10-15% reduction)
2. **Lazy-load GrapesJS** (page builder, rarely used)
3. **Lazy-load D3** (graphs, can defer)
4. **Split vendor chunks** further

## Target Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Total JS (gzipped) | 3.3MB | <2MB |
| Initial load | ~1.5MB | <800KB |
| Monaco | 1.07MB | 500KB (language subset) |
| Time to Interactive | ~4s | <2s |
