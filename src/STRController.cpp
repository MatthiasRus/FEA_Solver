#include "FEAModel.hpp"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <set>
#include <stdexcept>

void STRLine::Refresh() {
    CG = { 0.5 * Node1->X + 0.5 * Node2->X,
        0.5 * Node1->Y + 0.5 * Node2->Y,
        0.5 * Node1->Z + 0.5 * Node2->Z };

    std::array<double, 3> dx{ Node2->X - Node1->X, Node2->Y - Node1->Y, Node2->Z - Node1->Z };
    const double norm = std::sqrt(dx[0] * dx[0] + dx[1] * dx[1] + dx[2] * dx[2]);
    if (norm < Epsilon) {
        throw std::runtime_error("Line length is too small.");
    }

    Length = norm;
    Vx = { dx[0] / norm, dx[1] / norm, dx[2] / norm };

    if (std::fabs(Vx[0]) < Epsilon && std::fabs(Vx[1]) < Epsilon && std::fabs(Vx[2]) > Epsilon) {
        Vy = { 0.0, 1.0, 0.0 };
        Vz = { Vx[1] * Vy[2] - Vx[2] * Vy[1],
            Vx[2] * Vy[0] - Vx[0] * Vy[2],
            Vx[0] * Vy[1] - Vx[1] * Vy[0] };
        const double vzNorm = std::sqrt(Vz[0] * Vz[0] + Vz[1] * Vz[1] + Vz[2] * Vz[2]);
        Vz = { Vz[0] / vzNorm, Vz[1] / vzNorm, Vz[2] / vzNorm };
    } else {
        std::array<double, 3> zAxis{ 0.0, 0.0, 1.0 };
        Vy = { zAxis[1] * Vx[2] - zAxis[2] * Vx[1],
            zAxis[2] * Vx[0] - zAxis[0] * Vx[2],
            zAxis[0] * Vx[1] - zAxis[1] * Vx[0] };
        const double vyNorm = std::sqrt(Vy[0] * Vy[0] + Vy[1] * Vy[1] + Vy[2] * Vy[2]);
        Vy = { Vy[0] / vyNorm, Vy[1] / vyNorm, Vy[2] / vyNorm };

        Vz = { Vx[1] * Vy[2] - Vx[2] * Vy[1],
            Vx[2] * Vy[0] - Vx[0] * Vy[2],
            Vx[0] * Vy[1] - Vx[1] * Vy[0] };
        const double vzNorm = std::sqrt(Vz[0] * Vz[0] + Vz[1] * Vz[1] + Vz[2] * Vz[2]);
        Vz = { Vz[0] / vzNorm, Vz[1] / vzNorm, Vz[2] / vzNorm };
    }
}

double STRLine::GetTValue(double x, double y, double z) const {
    const double a = Vx[0], b = Vx[1], c = Vx[2];
    const double x0 = Node1->X, y0 = Node1->Y, z0 = Node1->Z;

    if (std::fabs(a) > Epsilon) {
        return (x - x0) / a;
    }
    if (std::fabs(b) > Epsilon) {
        return (y - y0) / b;
    }
    return (z - z0) / c;
}

bool STRLine::IsOnLine(double x, double y, double z) const {
    const double a = Vx[0], b = Vx[1], c = Vx[2];
    const double x0 = Node1->X, y0 = Node1->Y, z0 = Node1->Z;

    double t = 0.0;
    if (std::fabs(a) > Epsilon) {
        t = (x - x0) / a;
    } else if (std::fabs(b) > Epsilon) {
        t = (y - y0) / b;
    } else {
        t = (z - z0) / c;
    }

    const double xCalc = x0 + a * t;
    const double yCalc = y0 + b * t;
    const double zCalc = z0 + c * t;

    if (std::fabs(xCalc - x) > Epsilon || std::fabs(yCalc - y) > Epsilon || std::fabs(zCalc - z) > Epsilon) {
        return false;
    }

    const double xmin = std::min(Node1->X, Node2->X);
    const double xmax = std::max(Node1->X, Node2->X);
    const double ymin = std::min(Node1->Y, Node2->Y);
    const double ymax = std::max(Node1->Y, Node2->Y);
    const double zmin = std::min(Node1->Z, Node2->Z);
    const double zmax = std::max(Node1->Z, Node2->Z);

    return x + Epsilon > xmin && x - Epsilon < xmax && y + Epsilon > ymin && y - Epsilon < ymax && z + Epsilon > zmin && z - Epsilon < zmax;
}

std::vector<std::shared_ptr<STRNode>> STRLine::GetSortedSTRNodes(const std::vector<std::shared_ptr<STRNode>>& nodes) const {
    std::vector<std::shared_ptr<STRNode>> onSegment;
    std::vector<double> tValues;

    for (const auto& node : nodes) {
        if (IsOnLine(node->X, node->Y, node->Z)) {
            onSegment.push_back(node);
            tValues.push_back(GetTValue(node->X, node->Y, node->Z));
        }
    }

    std::vector<std::size_t> idx(onSegment.size());
    std::iota(idx.begin(), idx.end(), 0);
    std::sort(idx.begin(), idx.end(), [&](std::size_t i, std::size_t j) { return tValues[i] < tValues[j]; });

    std::vector<std::shared_ptr<STRNode>> sorted;
    sorted.reserve(onSegment.size());
    for (const auto i : idx) {
        sorted.push_back(onSegment[i]);
    }
    return sorted;
}

std::array<double, 3> STRLine::GetCoordinatesFromRelative(double relativeLocation) const {
    return { Node1->X + relativeLocation * Length * Vx[0],
        Node1->Y + relativeLocation * Length * Vx[1],
        Node1->Z + relativeLocation * Length * Vx[2] };
}

void FEMBarBeam::Refresh() {
    std::array<double, 3> dx{ FEMNode2->X - FEMNode1->X, FEMNode2->Y - FEMNode1->Y, FEMNode2->Z - FEMNode1->Z };
    const double norm = std::sqrt(dx[0] * dx[0] + dx[1] * dx[1] + dx[2] * dx[2]);
    if (norm < 1e-12) {
        throw std::runtime_error("FEMBarBeam length is too small.");
    }

    Length = norm;
    Vx = { dx[0] / norm, dx[1] / norm, dx[2] / norm };

    if (std::fabs(Vx[0]) < 1e-9 && std::fabs(Vx[1]) < 1e-9 && std::fabs(Vx[2]) > 1e-9) {
        Vy = { 0.0, 1.0, 0.0 };
        Vz = { Vx[1] * Vy[2] - Vx[2] * Vy[1],
            Vx[2] * Vy[0] - Vx[0] * Vy[2],
            Vx[0] * Vy[1] - Vx[1] * Vy[0] };
        const double vzNorm = std::sqrt(Vz[0] * Vz[0] + Vz[1] * Vz[1] + Vz[2] * Vz[2]);
        Vz = { Vz[0] / vzNorm, Vz[1] / vzNorm, Vz[2] / vzNorm };
    } else {
        std::array<double, 3> zAxis{ 0.0, 0.0, 1.0 };
        Vy = { zAxis[1] * Vx[2] - zAxis[2] * Vx[1],
            zAxis[2] * Vx[0] - zAxis[0] * Vx[2],
            zAxis[0] * Vx[1] - zAxis[1] * Vx[0] };
        const double vyNorm = std::sqrt(Vy[0] * Vy[0] + Vy[1] * Vy[1] + Vy[2] * Vy[2]);
        Vy = { Vy[0] / vyNorm, Vy[1] / vyNorm, Vy[2] / vyNorm };

        Vz = { Vx[1] * Vy[2] - Vx[2] * Vy[1],
            Vx[2] * Vy[0] - Vx[0] * Vy[2],
            Vx[0] * Vy[1] - Vx[1] * Vy[0] };
        const double vzNorm = std::sqrt(Vz[0] * Vz[0] + Vz[1] * Vz[1] + Vz[2] * Vz[2]);
        Vz = { Vz[0] / vzNorm, Vz[1] / vzNorm, Vz[2] / vzNorm };
    }
}

std::shared_ptr<STRNode> STRController::AddSTRNode(double x, double y, double z) {
    for (const auto& existingNode : STRNodes) {
        if (std::fabs(existingNode->X - x) < Epsilon && std::fabs(existingNode->Y - y) < Epsilon && std::fabs(existingNode->Z - z) < Epsilon) {
            return existingNode;
        }
    }
    ++STRNodeId;
    auto node = std::make_shared<STRNode>(STRNodeId, x, y, z);
    STRNodes.push_back(node);
    return node;
}

std::shared_ptr<STRNode> STRController::GetSTRNode(int nodeId) const {
    for (const auto& node : STRNodes) {
        if (node->Id == nodeId) {
            return node;
        }
    }
    return nullptr;
}

std::shared_ptr<STRLine> STRController::AddSTRLine(const std::shared_ptr<STRNode>& node1, const std::shared_ptr<STRNode>& node2) {
    for (const auto& existingLine : STRLines) {
        const bool sameDirection = existingLine->Node1->Id == node1->Id && existingLine->Node2->Id == node2->Id;
        const bool oppositeDirection = existingLine->Node1->Id == node2->Id && existingLine->Node2->Id == node1->Id;
        if (sameDirection || oppositeDirection) {
            return existingLine;
        }
    }

    ++STRLineId;
    auto line = std::make_shared<STRLine>(STRLineId, node1, node2);
    STRLines.push_back(line);
    return line;
}

std::shared_ptr<STRLine> STRController::GetSTRLine(int lineId) const {
    for (const auto& line : STRLines) {
        if (line->Id == lineId) {
            return line;
        }
    }
    return nullptr;
}

std::shared_ptr<STRLineLoadDistributed> STRController::AddSTRLineLoadDistributed(int loadCaseId,
    double fxS,
    double fyS,
    double fzS,
    double mxS,
    double myS,
    double mzS,
    double relativeLocationS,
    double fxE,
    double fyE,
    double fzE,
    double mxE,
    double myE,
    double mzE,
    double relativeLocationE) {
    ++STRLineLoadDistributedId;
    auto load = std::make_shared<STRLineLoadDistributed>(
        STRLineLoadDistributedId,
        loadCaseId,
        fxS,
        fyS,
        fzS,
        mxS,
        myS,
        mzS,
        relativeLocationS,
        fxE,
        fyE,
        fzE,
        mxE,
        myE,
        mzE,
        relativeLocationE);
    STRLineLoadDistributeds.push_back(load);
    return load;
}

std::shared_ptr<STRLineLoadConcentrated> STRController::AddSTRLineLoadConcentrated(
    int loadCaseId,
    double fx,
    double fy,
    double fz,
    double mx,
    double my,
    double mz,
    double relativeLocation) {
    ++STRLineLoadConcentratedId;
    auto load = std::make_shared<STRLineLoadConcentrated>(STRLineLoadConcentratedId, loadCaseId, fx, fy, fz, mx, my, mz, relativeLocation);
    STRLineLoadConcentrateds.push_back(load);
    return load;
}

std::shared_ptr<STRNodalLoad> STRController::AddSTRNodalLoad(int loadCaseId, double fx, double fy, double fz, double mx, double my, double mz) {
    ++STRNodalLoadId;
    auto load = std::make_shared<STRNodalLoad>(STRNodalLoadId, loadCaseId, fx, fy, fz, mx, my, mz);
    STRNodalLoads.push_back(load);
    return load;
}

std::shared_ptr<STRLoadCase> STRController::AddSTRLoadCase(const std::string& name) {
    ++STRLoadCaseId;
    auto loadCase = std::make_shared<STRLoadCase>(STRLoadCaseId, name);
    STRLoadCases.push_back(loadCase);
    return loadCase;
}

std::shared_ptr<STRRelease> STRController::AddSTRRelease(const std::string& name,
    double kux1,
    double kuy1,
    double kuz1,
    double krx1,
    double kry1,
    double krz1,
    double kux2,
    double kuy2,
    double kuz2,
    double krx2,
    double kry2,
    double krz2) {
    ++STRReleaseId;
    auto release = std::make_shared<STRRelease>(STRReleaseId, name, kux1, kuy1, kuz1, krx1, kry1, krz1, kux2, kuy2, kuz2, krx2, kry2, krz2);
    STRReleases.push_back(release);
    return release;
}

std::shared_ptr<STRRelease> STRController::AddSTRReleaseRigidPinned(const std::string& name) {
    return AddSTRRelease(name,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KRRigid,
        STRRelease::KRRigid,
        STRRelease::KRRigid,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KRFree,
        STRRelease::KRFree,
        STRRelease::KRFree);
}

std::shared_ptr<STRRelease> STRController::AddSTRReleasePinnedRigid(const std::string& name) {
    return AddSTRRelease(name,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KRFree,
        STRRelease::KRFree,
        STRRelease::KRFree,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KRRigid,
        STRRelease::KRRigid,
        STRRelease::KRRigid);
}

std::shared_ptr<STRRelease> STRController::AddSTRReleasePinnedPinned(const std::string& name) {
    return AddSTRRelease(name,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KRFree,
        STRRelease::KRFree,
        STRRelease::KRFree,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KURigid,
        STRRelease::KRFree,
        STRRelease::KRFree,
        STRRelease::KRFree);
}

std::shared_ptr<STRMaterial> STRController::AddSTRMaterial(const std::string& name, double e, double g) {
    ++STRMaterialId;
    auto material = std::make_shared<STRMaterial>(STRMaterialId, name, e, g);
    STRMaterials.push_back(material);
    return material;
}

std::shared_ptr<STRSection> STRController::AddSTRSection(const std::string& name, double ax, double ix, double iy, double iz) {
    ++STRSectionId;
    auto section = std::make_shared<STRSection>(STRSectionId, name, ax, ix, iy, iz);
    STRSections.push_back(section);
    return section;
}

std::shared_ptr<STRSection> STRController::AddSTRSectionRectangular(const std::string& name, double width, double height) {
    const double ax = width * height;
    const double iy = width * std::pow(height, 3.0) / 12.0;
    const double iz = height * std::pow(width, 3.0) / 12.0;

    const double a = std::max(width, height);
    const double b = std::min(width, height);
    double sum1 = 0.0;
    for (int i = 0; i <= 9; ++i) {
        sum1 += (1.0 / std::pow(2.0 * i + 1.0, 5.0)) * std::tanh(((2.0 * i + 1.0) * M_PI * b) / (2.0 * a));
    }
    const double ix = std::pow(a, 3.0) * b / 3.0 - 64.0 * std::pow(a, 4.0) / std::pow(M_PI, 5.0) * sum1;

    return AddSTRSection(name, ax, ix, iy, iz);
}

std::shared_ptr<STRSupport> STRController::AddSTRSupport(const std::string& name, double kux, double kuy, double kuz, double krx, double kry, double krz) {
    ++STRSupportId;
    auto support = std::make_shared<STRSupport>(STRSupportId, name, kux, kuy, kuz, krx, kry, krz);
    STRSupports.push_back(support);
    return support;
}

std::shared_ptr<STRSupport> STRController::AddSTRSupportFixed(const std::string& name) {
    return AddSTRSupport(
        name,
        STRSupport::KURigid,
        STRSupport::KURigid,
        STRSupport::KURigid,
        STRSupport::KRRigid,
        STRSupport::KRRigid,
        STRSupport::KRRigid);
}

std::shared_ptr<STRSupport> STRController::AddSTRSupportPinned(const std::string& name) {
    return AddSTRSupport(
        name,
        STRSupport::KURigid,
        STRSupport::KURigid,
        STRSupport::KURigid,
        STRSupport::KRFree,
        STRSupport::KRFree,
        STRSupport::KRFree);
}

std::shared_ptr<STRSupport> STRController::AddSTRSupportRoller(const std::string& name) {
    return AddSTRSupport(
        name,
        STRSupport::KUFree,
        STRSupport::KURigid,
        STRSupport::KURigid,
        STRSupport::KRFree,
        STRSupport::KRFree,
        STRSupport::KRFree);
}

void STRController::ApplySupport(const std::shared_ptr<STRNode>& node, const std::shared_ptr<STRSupport>& support) {
    node->Support = support;
}

void STRController::DeleteSupport(const std::shared_ptr<STRNode>& node) {
    node->Support.reset();
}

void STRController::ApplySection(const std::shared_ptr<STRLine>& line, const std::shared_ptr<STRSection>& section) {
    line->Section = section;
}

void STRController::DeleteSection(const std::shared_ptr<STRLine>& line) {
    line->Section.reset();
}

void STRController::ApplyMaterial(const std::shared_ptr<STRLine>& line, const std::shared_ptr<STRMaterial>& material) {
    line->Material = material;
}

void STRController::DeleteMaterial(const std::shared_ptr<STRLine>& line) {
    line->Material.reset();
}

void STRController::ApplyRelease(const std::shared_ptr<STRLine>& line, const std::shared_ptr<STRRelease>& release) {
    line->Release = release;
}

void STRController::DeleteRelease(const std::shared_ptr<STRLine>& line) {
    line->Release.reset();
}

void STRController::ApplyLoad(const std::shared_ptr<STRNodalLoad>& load, int appliedToNodeId) {
    if (std::find(load->AppliedTo.begin(), load->AppliedTo.end(), appliedToNodeId) == load->AppliedTo.end()) {
        load->AppliedTo.push_back(appliedToNodeId);
    }
    std::sort(load->AppliedTo.begin(), load->AppliedTo.end());
}

void STRController::ApplyLoad(const std::shared_ptr<STRLineLoadConcentrated>& load, int appliedToLineId) {
    if (std::find(load->AppliedTo.begin(), load->AppliedTo.end(), appliedToLineId) == load->AppliedTo.end()) {
        load->AppliedTo.push_back(appliedToLineId);
    }
    std::sort(load->AppliedTo.begin(), load->AppliedTo.end());
}

void STRController::ApplyLoad(const std::shared_ptr<STRLineLoadDistributed>& load, int appliedToLineId) {
    if (std::find(load->AppliedTo.begin(), load->AppliedTo.end(), appliedToLineId) == load->AppliedTo.end()) {
        load->AppliedTo.push_back(appliedToLineId);
    }
    std::sort(load->AppliedTo.begin(), load->AppliedTo.end());
}

void STRController::DeleteLoad(const std::shared_ptr<STRNodalLoad>& load) {
    load->AppliedTo.clear();
}

void STRController::DeleteLoad(const std::shared_ptr<STRLineLoadConcentrated>& load) {
    load->AppliedTo.clear();
}

void STRController::DeleteLoad(const std::shared_ptr<STRLineLoadDistributed>& load) {
    load->AppliedTo.clear();
}

void STRController::ToString() const {
    std::cout << "===========================================\n";
    std::cout << "Structural Model Summary\n";
    std::cout << "Nodes: " << STRNodes.size() << "\n";
    std::cout << "Lines: " << STRLines.size() << "\n";
    std::cout << "Load Cases: " << STRLoadCases.size() << "\n";
    std::cout << "Nodal Loads: " << STRNodalLoads.size() << "\n";
    std::cout << "Line Concentrated Loads: " << STRLineLoadConcentrateds.size() << "\n";
    std::cout << "Line Distributed Loads: " << STRLineLoadDistributeds.size() << "\n";
    std::cout << "===========================================\n";
}

std::shared_ptr<FEMNode> STRController::AddFEMNode(double x, double y, double z) {
    for (const auto& existingNode : FEMNodes) {
        if (std::fabs(existingNode->X - x) < FEMEpsilon && std::fabs(existingNode->Y - y) < FEMEpsilon && std::fabs(existingNode->Z - z) < FEMEpsilon) {
            return existingNode;
        }
    }
    ++FEMNodeId;
    auto node = std::make_shared<FEMNode>(FEMNodeId, x, y, z);
    FEMNodes.push_back(node);
    return node;
}

std::shared_ptr<FEMBarBeam> STRController::AddFEMBarBeam(const std::shared_ptr<FEMNode>& femNode1, const std::shared_ptr<FEMNode>& femNode2) {
    ++FEMBarId;
    auto beam = std::make_shared<FEMBarBeam>(FEMBarId, femNode1, femNode2);
    beam->Refresh();
    FEMBarBeams.push_back(beam);
    return beam;
}

void STRController::ClearFEMModel() {
    FEMNodeId = 0;
    FEMBarId = 0;
    FEMNodes.clear();
    FEMBarBeams.clear();

    for (auto& node : STRNodes) {
        node->CorrespondingFEMNode.reset();
    }
}

void STRController::GenerateFiniteElements() {
    for (const auto& strNode : STRNodes) {
        auto femNode = AddFEMNode(strNode->X, strNode->Y, strNode->Z);
        strNode->CorrespondingFEMNode = femNode;
        femNode->CorrespondingSTRNode = strNode;
        femNode->IsSupportNode = (strNode->Support != nullptr);
    }

    for (const auto& strLine : STRLines) {
        auto beam = AddFEMBarBeam(strLine->Node1->CorrespondingFEMNode, strLine->Node2->CorrespondingFEMNode);
        beam->CorrespondingSTRLine = strLine;
    }
}

std::array<double, 3> STRController::Cross(const std::array<double, 3>& a, const std::array<double, 3>& b) {
    return {
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    };
}

double STRController::Dot(const std::array<double, 3>& a, const std::array<double, 3>& b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

std::array<double, 3> STRController::Normalize(const std::array<double, 3>& v) {
    const double n = std::sqrt(Dot(v, v));
    return { v[0] / n, v[1] / n, v[2] / n };
}

STRController::Matrix STRController::Zeros(int rows, int cols) {
    return Matrix(rows, std::vector<double>(cols, 0.0));
}

STRController::Matrix STRController::Transpose(const Matrix& matrix) {
    if (matrix.empty()) {
        return {};
    }
    Matrix out = Zeros(static_cast<int>(matrix[0].size()), static_cast<int>(matrix.size()));
    for (std::size_t i = 0; i < matrix.size(); ++i) {
        for (std::size_t j = 0; j < matrix[i].size(); ++j) {
            out[j][i] = matrix[i][j];
        }
    }
    return out;
}

STRController::Matrix STRController::Multiply(const Matrix& a, const Matrix& b) {
    Matrix out = Zeros(static_cast<int>(a.size()), static_cast<int>(b[0].size()));
    for (std::size_t i = 0; i < a.size(); ++i) {
        for (std::size_t k = 0; k < b.size(); ++k) {
            const double aik = a[i][k];
            if (std::fabs(aik) < 1e-18) {
                continue;
            }
            for (std::size_t j = 0; j < b[0].size(); ++j) {
                out[i][j] += aik * b[k][j];
            }
        }
    }
    return out;
}

std::vector<double> STRController::Multiply(const Matrix& a, const std::vector<double>& x) {
    std::vector<double> out(a.size(), 0.0);
    for (std::size_t i = 0; i < a.size(); ++i) {
        for (std::size_t j = 0; j < x.size(); ++j) {
            out[i] += a[i][j] * x[j];
        }
    }
    return out;
}

std::vector<double> STRController::SolveLinearSystem(Matrix a, std::vector<double> b) {
    const int n = static_cast<int>(a.size());
    for (int i = 0; i < n; ++i) {
        int pivot = i;
        for (int r = i + 1; r < n; ++r) {
            if (std::fabs(a[r][i]) > std::fabs(a[pivot][i])) {
                pivot = r;
            }
        }
        if (std::fabs(a[pivot][i]) < 1e-18) {
            throw std::runtime_error("Singular matrix during solve.");
        }
        if (pivot != i) {
            std::swap(a[pivot], a[i]);
            std::swap(b[pivot], b[i]);
        }

        const double diag = a[i][i];
        for (int c = i; c < n; ++c) {
            a[i][c] /= diag;
        }
        b[i] /= diag;

        for (int r = 0; r < n; ++r) {
            if (r == i) {
                continue;
            }
            const double factor = a[r][i];
            if (std::fabs(factor) < 1e-18) {
                continue;
            }
            for (int c = i; c < n; ++c) {
                a[r][c] -= factor * a[i][c];
            }
            b[r] -= factor * b[i];
        }
    }
    return b;
}

STRController::Matrix STRController::CalculateBeamLocalStiffness(double A, double J, double Iy, double Iz, double E, double G, double L) {
    Matrix k = Zeros(12, 12);

    k[0][0] = A * E / L;
    k[0][6] = -A * E / L;
    k[1][1] = 12.0 * E * Iz / std::pow(L, 3.0);
    k[1][5] = 6.0 * E * Iz / std::pow(L, 2.0);
    k[1][7] = -12.0 * E * Iz / std::pow(L, 3.0);
    k[1][11] = 6.0 * E * Iz / std::pow(L, 2.0);
    k[2][2] = 12.0 * E * Iy / std::pow(L, 3.0);
    k[2][4] = -6.0 * E * Iy / std::pow(L, 2.0);
    k[2][8] = -12.0 * E * Iy / std::pow(L, 3.0);
    k[2][10] = -6.0 * E * Iy / std::pow(L, 2.0);
    k[3][3] = G * J / L;
    k[3][9] = -G * J / L;
    k[4][2] = -6.0 * E * Iy / std::pow(L, 2.0);
    k[4][4] = 4.0 * E * Iy / L;
    k[4][8] = 6.0 * E * Iy / std::pow(L, 2.0);
    k[4][10] = 2.0 * E * Iy / L;
    k[5][1] = 6.0 * E * Iz / std::pow(L, 2.0);
    k[5][5] = 4.0 * E * Iz / L;
    k[5][7] = -6.0 * E * Iz / std::pow(L, 2.0);
    k[5][11] = 2.0 * E * Iz / L;
    k[6][0] = k[0][6];
    k[6][6] = A * E / L;
    k[7][1] = k[1][7];
    k[7][5] = k[5][7];
    k[7][7] = 12.0 * E * Iz / std::pow(L, 3.0);
    k[7][11] = -6.0 * E * Iz / std::pow(L, 2.0);
    k[8][2] = k[2][8];
    k[8][4] = k[4][8];
    k[8][8] = 12.0 * E * Iy / std::pow(L, 3.0);
    k[8][10] = 6.0 * E * Iy / std::pow(L, 2.0);
    k[9][3] = k[3][9];
    k[9][9] = G * J / L;
    k[10][2] = k[2][10];
    k[10][4] = k[4][10];
    k[10][8] = k[8][10];
    k[10][10] = 4.0 * E * Iy / L;
    k[11][1] = k[1][11];
    k[11][5] = k[5][11];
    k[11][7] = k[7][11];
    k[11][11] = 4.0 * E * Iz / L;

    return k;
}

STRController::Matrix STRController::CalculateTransformation(const std::array<double, 3>& vx, const std::array<double, 3>& vy, const std::array<double, 3>& vz) {
    Matrix t = Zeros(12, 12);
    Matrix lambda = {
        { vx[0], vx[1], vx[2] },
        { vy[0], vy[1], vy[2] },
        { vz[0], vz[1], vz[2] }
    };

    for (int block = 0; block < 4; ++block) {
        for (int i = 0; i < 3; ++i) {
            for (int j = 0; j < 3; ++j) {
                t[block * 3 + i][block * 3 + j] = lambda[i][j];
            }
        }
    }
    return t;
}

void STRController::AssembleElement(Matrix& globalK, const Matrix& ke, int node1Id, int node2Id) {
    const int s1 = (node1Id - 1) * 6;
    const int s2 = (node2Id - 1) * 6;

    for (int i = 0; i < 6; ++i) {
        for (int j = 0; j < 6; ++j) {
            globalK[s1 + i][s1 + j] += ke[i][j];
            globalK[s1 + i][s2 + j] += ke[i][6 + j];
            globalK[s2 + i][s1 + j] += ke[6 + i][j];
            globalK[s2 + i][s2 + j] += ke[6 + i][6 + j];
        }
    }
}

STRController::Matrix STRController::NodeTransform(const std::array<double, 3>& vx, const std::array<double, 3>& vy, const std::array<double, 3>& vz) {
    return {
        { vx[0], vy[0], vz[0] },
        { vx[1], vy[1], vz[1] },
        { vx[2], vy[2], vz[2] }
    };
}

void STRController::AddToGlobalNodeLoad(std::vector<double>& globalF, int nodeId, const std::array<double, 6>& localLoad, const Matrix& tNode) {
    const int s = (nodeId - 1) * 6;
    std::array<double, 3> fLocal{ localLoad[0], localLoad[1], localLoad[2] };
    std::array<double, 3> mLocal{ localLoad[3], localLoad[4], localLoad[5] };

    std::array<double, 3> fGlobal{};
    std::array<double, 3> mGlobal{};
    for (int i = 0; i < 3; ++i) {
        fGlobal[i] = tNode[i][0] * fLocal[0] + tNode[i][1] * fLocal[1] + tNode[i][2] * fLocal[2];
        mGlobal[i] = tNode[i][0] * mLocal[0] + tNode[i][1] * mLocal[1] + tNode[i][2] * mLocal[2];
    }

    for (int i = 0; i < 3; ++i) {
        globalF[s + i] += fGlobal[i];
        globalF[s + 3 + i] += mGlobal[i];
    }
}

void STRController::ApplyNodalLoadsForCase(int loadCaseId, std::vector<double>& globalF) const {
    for (const auto& load : STRNodalLoads) {
        if (load->LoadCaseId != loadCaseId) {
            continue;
        }

        for (const auto nodeId : load->AppliedTo) {
            const int s = (nodeId - 1) * 6;
            globalF[s + 0] += load->Fx;
            globalF[s + 1] += load->Fy;
            globalF[s + 2] += load->Fz;
            globalF[s + 3] += load->Mx;
            globalF[s + 4] += load->My;
            globalF[s + 5] += load->Mz;
        }
    }
}

void STRController::ApplyConcentratedLineLoadToVector(const STRLineLoadConcentrated& load, const STRLine& line, std::vector<double>& globalF) const {
    const double r = std::clamp(load.RelativeLocation, 0.0, 1.0);
    const double n1 = 1.0 - r;
    const double n2 = r;

    Matrix tNode = NodeTransform(line.Vx, line.Vy, line.Vz);

    std::array<double, 6> localAtNode1{ n1 * load.Fx, n1 * load.Fy, n1 * load.Fz, n1 * load.Mx, n1 * load.My, n1 * load.Mz };
    std::array<double, 6> localAtNode2{ n2 * load.Fx, n2 * load.Fy, n2 * load.Fz, n2 * load.Mx, n2 * load.My, n2 * load.Mz };

    AddToGlobalNodeLoad(globalF, line.Node1->Id, localAtNode1, tNode);
    AddToGlobalNodeLoad(globalF, line.Node2->Id, localAtNode2, tNode);
}

void STRController::ApplyDistributedLineLoadToVector(const STRLineLoadDistributed& load, const STRLine& line, std::vector<double>& globalF) const {
    const double r1 = std::clamp(load.RelativeLocationStart, 0.0, 1.0);
    const double r2 = std::clamp(load.RelativeLocationEnd, 0.0, 1.0);
    const double segmentFactor = std::max(0.0, r2 - r1);

    const double fx = 0.5 * (load.FxStart + load.FxEnd) * segmentFactor;
    const double fy = 0.5 * (load.FyStart + load.FyEnd) * segmentFactor;
    const double fz = 0.5 * (load.FzStart + load.FzEnd) * segmentFactor;
    const double mx = 0.5 * (load.MxStart + load.MxEnd) * segmentFactor;
    const double my = 0.5 * (load.MyStart + load.MyEnd) * segmentFactor;
    const double mz = 0.5 * (load.MzStart + load.MzEnd) * segmentFactor;

    Matrix tNode = NodeTransform(line.Vx, line.Vy, line.Vz);

    std::array<double, 6> localAtNode1{ 0.5 * fx, 0.5 * fy, 0.5 * fz, 0.5 * mx, 0.5 * my, 0.5 * mz };
    std::array<double, 6> localAtNode2{ 0.5 * fx, 0.5 * fy, 0.5 * fz, 0.5 * mx, 0.5 * my, 0.5 * mz };

    AddToGlobalNodeLoad(globalF, line.Node1->Id, localAtNode1, tNode);
    AddToGlobalNodeLoad(globalF, line.Node2->Id, localAtNode2, tNode);
}

void STRController::ApplyLineLoadsForCase(int loadCaseId, std::vector<double>& globalF) const {
    for (const auto& load : STRLineLoadConcentrateds) {
        if (load->LoadCaseId != loadCaseId) {
            continue;
        }
        for (const auto lineId : load->AppliedTo) {
            const auto line = GetSTRLine(lineId);
            if (line) {
                ApplyConcentratedLineLoadToVector(*load, *line, globalF);
            }
        }
    }

    for (const auto& load : STRLineLoadDistributeds) {
        if (load->LoadCaseId != loadCaseId) {
            continue;
        }
        for (const auto lineId : load->AppliedTo) {
            const auto line = GetSTRLine(lineId);
            if (line) {
                ApplyDistributedLineLoadToVector(*load, *line, globalF);
            }
        }
    }
}

void STRController::PerformLinearElasticAnalysis() {
    if (STRNodes.empty() || STRLines.empty()) {
        throw std::runtime_error("Model has no nodes or lines.");
    }
    if (STRLoadCases.empty()) {
        throw std::runtime_error("No load case defined.");
    }

    for (const auto& line : STRLines) {
        if (!line->Section || !line->Material) {
            throw std::runtime_error("Every STRLine must have section and material before analysis.");
        }
    }

    ClearFEMModel();
    GenerateFiniteElements();

    const int ndof = static_cast<int>(FEMNodes.size()) * 6;
    for (const auto& node : STRNodes) {
        node->DeflectionsByLoadCase.assign(STRLoadCases.size(), { 0, 0, 0, 0, 0, 0 });
        node->ReactionsByLoadCase.assign(STRLoadCases.size(), { 0, 0, 0, 0, 0, 0 });
    }
    for (const auto& node : FEMNodes) {
        node->DeflectionsByLoadCase.assign(STRLoadCases.size(), { 0, 0, 0, 0, 0, 0 });
    }

    Matrix globalK = Zeros(ndof, ndof);
    for (const auto& beam : FEMBarBeams) {
        beam->Refresh();
        const auto& line = *beam->CorrespondingSTRLine;

        Matrix kLocal = CalculateBeamLocalStiffness(
            line.Section->Ax,
            line.Section->Ix,
            line.Section->Iy,
            line.Section->Iz,
            line.Material->E,
            line.Material->G,
            beam->Length);
        Matrix t = CalculateTransformation(beam->Vx, beam->Vy, beam->Vz);
        Matrix kGlobal = Multiply(Transpose(t), Multiply(kLocal, t));
        AssembleElement(globalK, kGlobal, beam->FEMNode1->Id, beam->FEMNode2->Id);
    }

    std::vector<int> constrained;
    for (const auto& node : STRNodes) {
        if (!node->Support) {
            continue;
        }
        const int s = (node->Id - 1) * 6;
        if (node->Support->Kux > 1e10) constrained.push_back(s + 0);
        if (node->Support->Kuy > 1e10) constrained.push_back(s + 1);
        if (node->Support->Kuz > 1e10) constrained.push_back(s + 2);
        if (node->Support->Krx > 1e10) constrained.push_back(s + 3);
        if (node->Support->Kry > 1e10) constrained.push_back(s + 4);
        if (node->Support->Krz > 1e10) constrained.push_back(s + 5);
    }
    std::sort(constrained.begin(), constrained.end());
    constrained.erase(std::unique(constrained.begin(), constrained.end()), constrained.end());

    std::vector<int> freeDofs;
    freeDofs.reserve(ndof - constrained.size());
    for (int i = 0; i < ndof; ++i) {
        if (!std::binary_search(constrained.begin(), constrained.end(), i)) {
            freeDofs.push_back(i);
        }
    }

    if (freeDofs.empty()) {
        throw std::runtime_error("All DOFs are constrained.");
    }

    for (std::size_t lcIdx = 0; lcIdx < STRLoadCases.size(); ++lcIdx) {
        const int loadCaseId = STRLoadCases[lcIdx]->Id;
        std::vector<double> globalF(ndof, 0.0);
        ApplyNodalLoadsForCase(loadCaseId, globalF);
        ApplyLineLoadsForCase(loadCaseId, globalF);

        Matrix Kff = Zeros(static_cast<int>(freeDofs.size()), static_cast<int>(freeDofs.size()));
        std::vector<double> Ff(freeDofs.size(), 0.0);
        for (std::size_t i = 0; i < freeDofs.size(); ++i) {
            Ff[i] = globalF[freeDofs[i]];
            for (std::size_t j = 0; j < freeDofs.size(); ++j) {
                Kff[i][j] = globalK[freeDofs[i]][freeDofs[j]];
            }
        }

        std::vector<double> df = SolveLinearSystem(Kff, Ff);
        std::vector<double> d(ndof, 0.0);
        for (std::size_t i = 0; i < freeDofs.size(); ++i) {
            d[freeDofs[i]] = df[i];
        }

        std::vector<double> kd = Multiply(globalK, d);
        std::vector<double> reactions(ndof, 0.0);
        for (int i = 0; i < ndof; ++i) {
            reactions[i] = kd[i] - globalF[i];
        }

        for (const auto& node : STRNodes) {
            const int s = (node->Id - 1) * 6;
            node->DeflectionsByLoadCase[lcIdx] = { d[s + 0], d[s + 1], d[s + 2], d[s + 3], d[s + 4], d[s + 5] };
            node->ReactionsByLoadCase[lcIdx] = { reactions[s + 0], reactions[s + 1], reactions[s + 2], reactions[s + 3], reactions[s + 4], reactions[s + 5] };

            auto femNode = node->CorrespondingFEMNode;
            if (femNode) {
                femNode->DeflectionsByLoadCase[lcIdx] = node->DeflectionsByLoadCase[lcIdx];
            }
        }
    }
}

void STRController::ExportResults(const std::string& outputDirectory) const {
    namespace fs = std::filesystem;
    fs::create_directories(outputDirectory);

    {
        std::ofstream out(outputDirectory + "/nodes.csv");
        out << "id,x,y,z\n";
        for (const auto& n : STRNodes) {
            out << n->Id << "," << n->X << "," << n->Y << "," << n->Z << "\n";
        }
    }

    {
        std::ofstream out(outputDirectory + "/lines.csv");
        out << "id,node1,node2\n";
        for (const auto& l : STRLines) {
            out << l->Id << "," << l->Node1->Id << "," << l->Node2->Id << "\n";
        }
    }

    for (std::size_t lcIdx = 0; lcIdx < STRLoadCases.size(); ++lcIdx) {
        std::ofstream out(outputDirectory + "/deflections_lc" + std::to_string(STRLoadCases[lcIdx]->Id) + ".csv");
        out << "id,ux,uy,uz,rx,ry,rz,rfx,rfy,rfz,rmx,rmy,rmz\n";
        for (const auto& n : STRNodes) {
            const auto d = n->DeflectionsByLoadCase[lcIdx];
            const auto r = n->ReactionsByLoadCase[lcIdx];
            out << n->Id << "," << d[0] << "," << d[1] << "," << d[2] << "," << d[3] << "," << d[4] << "," << d[5] << "," << r[0] << "," << r[1] << "," << r[2] << "," << r[3] << "," << r[4] << "," << r[5] << "\n";
        }
    }
}
