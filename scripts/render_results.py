import csv
import pathlib
import sys

import matplotlib.cm as cm
import matplotlib.colors as colors
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/render_results.py <output_dir> [load_case_id] [scale] [mode]")
        print("  mode: deflection (default) | stress")
        sys.exit(1)

    out_dir = pathlib.Path(sys.argv[1])
    load_case_id = int(sys.argv[2]) if len(sys.argv) >= 3 else 1
    scale = float(sys.argv[3]) if len(sys.argv) >= 4 else 1000.0
    mode = sys.argv[4].strip().lower() if len(sys.argv) >= 5 else "deflection"

    nodes = read_csv(out_dir / "nodes.csv")
    lines = read_csv(out_dir / "lines.csv")
    defs = read_csv(out_dir / f"deflections_lc{load_case_id}.csv")
    stress_map = {}
    if mode == "stress":
        stress_rows = read_csv(out_dir / f"line_stress_lc{load_case_id}.csv")
        stress_map = {int(row["line_id"]): float(row["sigma_axial"]) for row in stress_rows}
        if not stress_map:
            print(f"No stress data found in line_stress_lc{load_case_id}.csv")
            sys.exit(1)

    node_map = {int(n["id"]): n for n in nodes}
    def_map = {int(d["id"]): d for d in defs}

    fig = plt.figure(figsize=(12, 6))
    ax1 = fig.add_subplot(121, projection="3d")
    ax2 = fig.add_subplot(122, projection="3d")

    norm = colors.Normalize(vmin=0.0, vmax=1.0)
    cmap = cm.get_cmap("coolwarm")
    if mode == "stress":
        sigmas = list(stress_map.values())
        smin = min(sigmas)
        smax = max(sigmas)
        if abs(smax - smin) < 1e-18:
            smin -= 1.0
            smax += 1.0
        norm = colors.Normalize(vmin=smin, vmax=smax)

    for line in lines:
        n1 = node_map[int(line["node1"])]
        n2 = node_map[int(line["node2"])]
        line_id = int(line["id"])

        x = [float(n1["x"]), float(n2["x"])]
        y = [float(n1["y"]), float(n2["y"])]
        z = [float(n1["z"]), float(n2["z"])]
        ax1.plot(x, y, z, "b-", linewidth=2)

        d1 = def_map[int(line["node1"])]
        d2 = def_map[int(line["node2"])]
        xd = [float(n1["x"]) + scale * float(d1["ux"]), float(n2["x"]) + scale * float(d2["ux"])]
        yd = [float(n1["y"]) + scale * float(d1["uy"]), float(n2["y"]) + scale * float(d2["uy"])]
        zd = [float(n1["z"]) + scale * float(d1["uz"]), float(n2["z"]) + scale * float(d2["uz"])]
        ax2.plot(x, y, z, "b-", linewidth=1, alpha=0.35)

        if mode == "stress":
            sigma = stress_map.get(line_id, 0.0)
            ax2.plot(xd, yd, zd, color=cmap(norm(sigma)), linewidth=3)
        else:
            ax2.plot(xd, yd, zd, "y-", linewidth=2)

    right_title = f"Deflected shape (LC {load_case_id})"
    if mode == "stress":
        right_title = f"Axial stress map (LC {load_case_id})"

    for ax, title in [(ax1, "Structure"), (ax2, right_title)]:
        ax.set_title(title)
        ax.set_xlabel("X")
        ax.set_ylabel("Y")
        ax.set_zlabel("Z")
        ax.set_box_aspect((1, 1, 1))

    if mode == "stress":
        scalar_mappable = cm.ScalarMappable(norm=norm, cmap=cmap)
        scalar_mappable.set_array([])
        cbar = plt.colorbar(scalar_mappable, ax=ax2, fraction=0.046, pad=0.08)
        cbar.set_label("σ axial (Pa)")

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
