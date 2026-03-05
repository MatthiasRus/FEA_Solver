# FEA Solver UI (React)

Dedicated React + TypeScript frontend for the FEA solver project.

Current version: V0.3

## What V0.3 includes

- React UI shell with a dedicated solve panel
- Local bridge API integration for running the C++ solver
- Output file listing and solver log panel
- Results panel with load-case selector
- Summary KPI cards (max displacement/stress/shear/moment)
- Simple chart blocks for stress/shear/moment by line
- Visual model builder (nodes, lines, fixed supports)
- Load editors for nodal, concentrated line, and distributed line loads
- Generated `.fea` preview from builder state (foldable)
- Delete actions for nodes, lines, and all load types
- Builder canvas overlays for nodal, concentrated, and distributed loads
- Results structure visualization (undeformed + deformed with metric coloring)
- Bridge solve from model text (`/api/solve-text`)
- PWA setup for offline-capable static UI assets

## Run locally (recommended)

From this folder:

```bash
npm install
npm run dev
```

Open http://localhost:5173

This starts:
- Vite UI server
- Bridge API at http://127.0.0.1:8787

## Run UI only (no backend bridge)

```bash
npm install
npm run dev:ui
```

Default UI paths are repository-root relative:
- executable: build-linux/MyProject
- model: models/sample_frame.fea
- output: output

## Network access

```bash
npm run dev:host
```

## Build

```bash
npm run build
npm run preview
```

## Vercel deployment notes

- Vercel does not run `bridge/server.js` as a persistent process.
- This UI now includes serverless API handlers under `ui/api/*` for `/api/health`, `/api/solve`, `/api/solve-text`, `/api/results`.
- For solver execution in Vercel, you must provide a Linux executable and paths via environment variables:
	- `FEA_EXECUTABLE_PATH`
	- `FEA_MODEL_PATH` (optional)
	- `FEA_OUTPUT_DIR` (optional; defaults to `/tmp/fea-output` on Vercel)
- If your real backend is hosted elsewhere, set `VITE_API_BASE_URL` so the UI calls that API instead of same-origin `/api`.

## Version roadmap

- V0.1: local bridge + solve from UI
- V0.2: results cards and charts ✅
- V0.3: visual model/load editing ✅
- V0.4: CAD bridge import (JSON pipeline)
