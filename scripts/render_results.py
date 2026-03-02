import csv
import pathlib
import sys

import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/render_results.py <output_dir> [load_case_id] [scale]")
        sys.exit(1)

    out_dir = pathlib.Path(sys.argv[1])
    load_case_id = int(sys.argv[2]) if len(sys.argv) >= 3 else 1
    scale = float(sys.argv[3]) if len(sys.argv) >= 4 else 1000.0

    nodes = read_csv(out_dir / "nodes.csv")
    lines = read_csv(out_dir / "lines.csv")
    defs = read_csv(out_dir / f"deflections_lc{load_case_id}.csv")

    node_map = {int(n["id"]): n for n in nodes}
    def_map = {int(d["id"]): d for d in defs}

    fig = plt.figure(figsize=(12, 6))
    ax1 = fig.add_subplot(121, projection="3d")
    ax2 = fig.add_subplot(122, projection="3d")

    for line in lines:
        n1 = node_map[int(line["node1"])]
        n2 = node_map[int(line["node2"])]

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
        ax2.plot(xd, yd, zd, "y-", linewidth=2)

    for ax, title in [(ax1, "Structure"), (ax2, f"Deflected shape (LC {load_case_id})")]:
        ax.set_title(title)
        ax.set_xlabel("X")
        ax.set_ylabel("Y")
        ax.set_zlabel("Z")
        ax.set_box_aspect((1, 1, 1))

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
