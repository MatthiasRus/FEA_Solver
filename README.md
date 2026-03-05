# FEA Solver (C++ Port)

## 1) Build and run solver

From project root:

```bash
cmake -S . -B build-linux
cmake --build build-linux -j
./build-linux/MyProject
```

Run with explicit model and output:

```bash
./build-linux/MyProject --model models/sample_frame.fea --output output
```

This writes CSV results to `output/`:
- `output/nodes.csv`
- `output/lines.csv`
- `output/deflections_lc*.csv`
- `output/line_stress_lc*.csv` (axial strain/stress/force per line)
- `output/line_response_lc*.csv` (member end axial/shear/torsion/bending response)
- `output/results_lc*.json` (structured per-load-case results)

## 1.1) Change shape and load cases

The solver now reads model files from `models/*.fea`.

Use:
- `models/sample_frame.fea` (2 load cases)
- `models/two_story_frame.fea` (3 load cases)

To modify geometry or load cases, edit these commands in the `.fea` file:
- `NODE`, `LINE` for shape/topology
- `LOAD_CASE` for case definitions
- `NODAL_LOAD`, `LINE_CONC_LOAD`, `LINE_DIST_LOAD` for loads

Example:

```text
LOAD_CASE 1 DEAD
LOAD_CASE 2 LIVE
NODAL_LOAD 2 3 0 -4000 0 0 0 0
```

## 2) Quick plot (matplotlib)

```bash
python3 -m pip install matplotlib
python3 scripts/render_results.py output 1
```

Arguments:
- `output`: output folder
- `1`: load case id
- optional scale: `python3 scripts/render_results.py output 1 1500`
- optional mode: `python3 scripts/render_results.py output 1 1500 stress`

## 3) Interactive dashboard (Gradio)

Create and use a virtual environment (recommended):

```bash
python3 -m venv ../.venv
source ../.venv/bin/activate
```

Install dependencies:

```bash
python3 -m pip install gradio plotly matplotlib
```

Run dashboard:

```bash
python3 scripts/dashboard_gradio.py
```

Then open the URL shown by Gradio (default `http://127.0.0.1:7860`).

In the dashboard you now have 2 tabs:

### Model Builder
1. Pick a template and click **Apply template** (Sample Portal, Two Story, Cantilever, Triangular Truss), or fill tables manually.
2. Click **Validate**.
3. Click **Build model text** (optional preview).
4. Click **Save model** to write `.fea`.
5. Click **Save + Solve** to run immediately.

### Solve & Visualize
1. Set/select executable, model file, and output directory.
2. Click **Run solver**.
3. Click **Refresh load cases**.
4. Pick a load case, deflection scale, and view mode.
5. Click **Render**.

View modes:
- **Deflected Shape**: original + deformed geometry.
- **Axial Stress**: deformed geometry color-mapped by member axial stress ($\sigma = E\epsilon$).
- **Shear Force**: deformed geometry color-mapped by max member shear magnitude.
- **Bending Moment**: deformed geometry color-mapped by max member bending moment magnitude.

Phase-2 panel (**Critical Members**):
- Choose metric: **Axial Stress**, **Axial Force**, **Axial Strain**, **Shear Force**, or **Bending Moment**.
- Choose Top N members and click **Analyze**.
- Dashboard lists the most critical members by absolute metric value and shows min/max/mean summary.
