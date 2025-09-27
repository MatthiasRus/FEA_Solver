#include "STRLine.hpp"

STRLine::STRLine(int id, std::shared_ptr<STRNode> n1, std::shared_ptr<STRNode> n2)
    : Id(id), Node1(n1), Node2(n2) {
    Refresh();
}

void STRLine::Refresh() {
    CG = {
        0.5 * Node1->X + 0.5 * Node2->X,
        0.5 * Node1->Y + 0.5 * Node2->Y,
        0.5 * Node1->Z + 0.5 * Node2->Z
    };

    Vx = { Node2->X - Node1->X,
           Node2->Y - Node1->Y,
           Node2->Z - Node1->Z };

    Length = std::sqrt(Vx[0] * Vx[0] + Vx[1] * Vx[1] + Vx[2] * Vx[2]);

    for (double& c : Vx) c /= Length; // normalize

    // Handle vertical case
    if (std::fabs(Vx[0]) < Epsilon &&
        std::fabs(Vx[1]) < Epsilon &&
        std::fabs(Vx[2]) > Epsilon) {
        Vy = { 0, 1, 0 };
        Vz = { Vx[1] * Vy[2] - Vx[2] * Vy[1],
               Vx[2] * Vy[0] - Vx[0] * Vy[2],
               Vx[0] * Vy[1] - Vx[1] * Vy[0] };
        double normVz = std::sqrt(Vz[0] * Vz[0] + Vz[1] * Vz[1] + Vz[2] * Vz[2]);
        for (double& c : Vz) c /= normVz;
    }
    else {
        std::vector<double> zAxis = { 0,0,1 };
        Vy = { zAxis[1] * Vx[2] - zAxis[2] * Vx[1],
               zAxis[2] * Vx[0] - zAxis[0] * Vx[2],
               zAxis[0] * Vx[1] - zAxis[1] * Vx[0] };
        double normVy = std::sqrt(Vy[0] * Vy[0] + Vy[1] * Vy[1] + Vy[2] * Vy[2]);
        for (double& c : Vy) c /= normVy;

        Vz = { Vx[1] * Vy[2] - Vx[2] * Vy[1],
               Vx[2] * Vy[0] - Vx[0] * Vy[2],
               Vx[0] * Vy[1] - Vx[1] * Vy[0] };
        double normVz = std::sqrt(Vz[0] * Vz[0] + Vz[1] * Vz[1] + Vz[2] * Vz[2]);
        for (double& c : Vz) c /= normVz;
    }
}

void STRLine::ToString() const {
    std::cout << "Line #" << Id
        << " (N" << Node1->Id << "->N" << Node2->Id << ")\n";
    std::cout << "Material: " << (Material ? "Defined" : "N/A") << "\n";
    std::cout << "Section: " << (Section ? "Defined" : "N/A") << "\n";
    std::cout << "Release: " << (Release ? "Defined" : "N/A") << "\n";
}

double STRLine::GetTValue(double x, double y, double z) const {
    double a = Vx[0], b = Vx[1], c = Vx[2];
    double x0 = Node1->X, y0 = Node1->Y, z0 = Node1->Z;

    if (std::fabs(a) > Epsilon) return (x - x0) / a;
    if (std::fabs(b) > Epsilon) return (y - y0) / b;
    return (z - z0) / c;
}

bool STRLine::IsOnLine(double x, double y, double z) const {
    double a = Vx[0], b = Vx[1], c = Vx[2];
    double x0 = Node1->X, y0 = Node1->Y, z0 = Node1->Z;

    double t = 0;
    if (std::fabs(a) > Epsilon) t = (x - x0) / a;
    else if (std::fabs(b) > Epsilon) t = (y - y0) / b;
    else if (std::fabs(c) > Epsilon) t = (z - z0) / c;

    double xCalc = x0 + a * t;
    double yCalc = y0 + b * t;
    double zCalc = z0 + c * t;

    if (std::fabs(xCalc - x) > Epsilon ||
        std::fabs(yCalc - y) > Epsilon ||
        std::fabs(zCalc - z) > Epsilon) {
        return false;
    }

    double xmin = std::min(Node1->X, Node2->X);
    double xmax = std::max(Node1->X, Node2->X);
    double ymin = std::min(Node1->Y, Node2->Y);
    double ymax = std::max(Node1->Y, Node2->Y);
    double zmin = std::min(Node1->Z, Node2->Z);
    double zmax = std::max(Node1->Z, Node2->Z);

    return (x + Epsilon > xmin && x - Epsilon < xmax &&
        y + Epsilon > ymin && y - Epsilon < ymax &&
        z + Epsilon > zmin && z - Epsilon < zmax);
}

std::vector<std::shared_ptr<STRNode>>
STRLine::GetSortedSTRNodes(const std::vector<std::shared_ptr<STRNode>>& nodes) const {
    std::vector<std::shared_ptr<STRNode>> nodesOnLine;
    std::vector<double> tValues;

    for (auto& node : nodes) {
        if (IsOnLine(node->X, node->Y, node->Z)) {
            nodesOnLine.push_back(node);
            tValues.push_back(GetTValue(node->X, node->Y, node->Z));
        }
    }

    std::vector<size_t> indices(nodesOnLine.size());
    std::iota(indices.begin(), indices.end(), 0);

    std::sort(indices.begin(), indices.end(),
        [&](size_t i1, size_t i2) { return tValues[i1] < tValues[i2]; });

    std::vector<std::shared_ptr<STRNode>> sorted;
    for (size_t idx : indices) sorted.push_back(nodesOnLine[idx]);

    return sorted;
}

std::vector<double> STRLine::GetCoordinatesFromRelative(double relativeLocation) const {
    return {
        Node1->X + relativeLocation * Length * Vx[0],
        Node1->Y + relativeLocation * Length * Vx[1],
        Node1->Z + relativeLocation * Length * Vx[2]
    };
}
