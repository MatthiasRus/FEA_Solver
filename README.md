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

In the dashboard:
1. Set/select executable, model file, and output directory.
2. Click **Run solver**.
3. Click **Refresh load cases**.
4. Pick a load case and deflection scale.
5. Click **Render**.
