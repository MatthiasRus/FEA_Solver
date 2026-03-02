import csv
import pathlib
import subprocess
from typing import Dict, List, Tuple

import gradio as gr
import plotly.graph_objects as go


ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "output"
DEFAULT_EXECUTABLE = ROOT / "build-linux" / "MyProject"
DEFAULT_MODEL = ROOT / "models" / "sample_frame.fea"


def read_csv(path: pathlib.Path) -> List[Dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def list_load_cases(output_dir: pathlib.Path) -> List[int]:
    ids = []
    for file in output_dir.glob("deflections_lc*.csv"):
        name = file.stem
        suffix = name.replace("deflections_lc", "")
        if suffix.isdigit():
            ids.append(int(suffix))
    return sorted(ids)


def build_figure(output_dir: pathlib.Path, load_case_id: int, scale: float) -> go.Figure:
    nodes = read_csv(output_dir / "nodes.csv")
    lines = read_csv(output_dir / "lines.csv")
    defs = read_csv(output_dir / f"deflections_lc{load_case_id}.csv")

    node_map = {int(node["id"]): node for node in nodes}
    def_map = {int(row["id"]): row for row in defs}

    fig = go.Figure()

    for line in lines:
        node1 = node_map[int(line["node1"])]
        node2 = node_map[int(line["node2"])]

        x = [float(node1["x"]), float(node2["x"])]
        y = [float(node1["y"]), float(node2["y"])]
        z = [float(node1["z"]), float(node2["z"])]

        fig.add_trace(
            go.Scatter3d(
                x=x,
                y=y,
                z=z,
                mode="lines",
                name="Original",
                line={"color": "#1f77b4", "width": 6},
                showlegend=False,
            )
        )

        def1 = def_map[int(line["node1"])]
        def2 = def_map[int(line["node2"])]

        xd = [
            float(node1["x"]) + scale * float(def1["ux"]),
            float(node2["x"]) + scale * float(def2["ux"]),
        ]
        yd = [
            float(node1["y"]) + scale * float(def1["uy"]),
            float(node2["y"]) + scale * float(def2["uy"]),
        ]
        zd = [
            float(node1["z"]) + scale * float(def1["uz"]),
            float(node2["z"]) + scale * float(def2["uz"]),
        ]

        fig.add_trace(
            go.Scatter3d(
                x=xd,
                y=yd,
                z=zd,
                mode="lines",
                name="Deflected",
                line={"color": "#f2c744", "width": 7},
                showlegend=False,
            )
        )

    fig.update_layout(
        title=f"FEA Result - Load Case {load_case_id}",
        scene={
            "xaxis_title": "X",
            "yaxis_title": "Y",
            "zaxis_title": "Z",
            "aspectmode": "data",
        },
        margin={"l": 0, "r": 0, "t": 40, "b": 0},
    )
    return fig


def solver_status_text(exit_code: int, stdout: str, stderr: str) -> str:
    text = [f"Solver exit code: {exit_code}"]
    if stdout.strip():
        text.append("\nSTDOUT:\n" + stdout.strip())
    if stderr.strip():
        text.append("\nSTDERR:\n" + stderr.strip())
    return "\n".join(text)


def run_solver(executable_path: str, model_path: str, output_dir: str) -> str:
    executable = pathlib.Path(executable_path).expanduser().resolve()
    if not executable.exists():
        return f"Executable not found: {executable}"

    model = pathlib.Path(model_path).expanduser().resolve()
    if not model.exists():
        return f"Model file not found: {model}"

    out = pathlib.Path(output_dir).expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)

    process = subprocess.run(
        [str(executable), "--model", str(model), "--output", str(out)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    return solver_status_text(process.returncode, process.stdout, process.stderr)


def refresh_load_cases(output_dir: str) -> Tuple[gr.Dropdown, str]:
    out = pathlib.Path(output_dir).expanduser().resolve()
    if not out.exists():
        return gr.Dropdown(choices=[], value=None), f"Output directory not found: {out}"

    cases = list_load_cases(out)
    if not cases:
        return gr.Dropdown(choices=[], value=None), "No deflection files found. Run the solver first."

    return gr.Dropdown(choices=cases, value=cases[0]), f"Found load cases: {cases}"


def choose_file(path: str) -> str:
    if not path:
        return ""
    return str(pathlib.Path(path).expanduser().resolve())


def choose_output_from_any(path: str) -> str:
    if not path:
        return str(DEFAULT_OUTPUT)
    candidate = pathlib.Path(path).expanduser().resolve()
    if candidate.is_dir():
        return str(candidate)
    return str(candidate.parent)


def render(output_dir: str, load_case_id: int, scale: float):
    out = pathlib.Path(output_dir).expanduser().resolve()
    if not out.exists():
        raise gr.Error(f"Output directory not found: {out}")
    if load_case_id is None:
        raise gr.Error("Please refresh and select a load case.")

    required = [
        out / "nodes.csv",
        out / "lines.csv",
        out / f"deflections_lc{load_case_id}.csv",
    ]
    for file in required:
        if not file.exists():
            raise gr.Error(f"Missing file: {file}")

    fig = build_figure(out, load_case_id, scale)
    return fig


def build_app() -> gr.Blocks:
    with gr.Blocks(title="FEA Solver Dashboard") as demo:
        gr.Markdown("# FEA Solver Dashboard")
        gr.Markdown("Run the C++ solver, choose a load case, and inspect the 3D deflected shape.")

        with gr.Row():
            executable_path = gr.Textbox(label="Solver executable", value=str(DEFAULT_EXECUTABLE))
            model_path = gr.Textbox(label="Model file (.fea)", value=str(DEFAULT_MODEL))
            output_dir = gr.Textbox(label="Output directory", value=str(DEFAULT_OUTPUT))

        with gr.Accordion("Browse paths", open=False):
            gr.Markdown("Pick files from the workspace and they will populate the text fields above.")
            with gr.Row():
                exec_picker = gr.FileExplorer(label="Pick solver executable", root_dir=str(ROOT), glob="**/*", file_count="single")
                model_picker = gr.FileExplorer(label="Pick model file", root_dir=str(ROOT), glob="**/*.fea", file_count="single")
                output_picker = gr.FileExplorer(label="Pick output folder/file", root_dir=str(ROOT), glob="**/*", file_count="single")

        with gr.Row():
            run_button = gr.Button("Run solver")
            refresh_button = gr.Button("Refresh load cases")

        solver_log = gr.Textbox(label="Solver log", lines=10)

        with gr.Row():
            load_case = gr.Dropdown(label="Load case", choices=[], value=None)
            scale = gr.Slider(label="Deflection scale", minimum=1.0, maximum=10000.0, value=1000.0, step=1.0)

        plot_button = gr.Button("Render")
        plot = gr.Plot(label="3D Structure")

        exec_picker.change(fn=choose_file, inputs=[exec_picker], outputs=[executable_path])
        model_picker.change(fn=choose_file, inputs=[model_picker], outputs=[model_path])
        output_picker.change(fn=choose_output_from_any, inputs=[output_picker], outputs=[output_dir])

        run_button.click(fn=run_solver, inputs=[executable_path, model_path, output_dir], outputs=[solver_log])
        refresh_button.click(fn=refresh_load_cases, inputs=[output_dir], outputs=[load_case, solver_log])
        plot_button.click(fn=render, inputs=[output_dir, load_case, scale], outputs=[plot])

    return demo


if __name__ == "__main__":
    app = build_app()
    app.launch(server_name="127.0.0.1", server_port=7860, inbrowser=True)
