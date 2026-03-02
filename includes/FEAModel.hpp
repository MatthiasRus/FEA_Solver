#pragma once

#include <array>
#include <cmath>
#include <memory>
#include <optional>
#include <string>
#include <vector>

class STRSupport {
public:
    static constexpr double KURigid = 1e15;
    static constexpr double KUFree = 1e-4;
    static constexpr double KRRigid = 1e15;
    static constexpr double KRFree = 1e-4;

    int Id{};
    std::string Name;
    double Kux{ KUFree };
    double Kuy{ KUFree };
    double Kuz{ KUFree };
    double Krx{ KRFree };
    double Kry{ KRFree };
    double Krz{ KRFree };

    STRSupport() = default;
    STRSupport(int id, const std::string& name, double kux, double kuy, double kuz, double krx, double kry, double krz)
        : Id(id), Name(name), Kux(kux), Kuy(kuy), Kuz(kuz), Krx(krx), Kry(kry), Krz(krz) {
    }
};

class STRMaterial {
public:
    int Id{};
    std::string Name;
    double E{};
    double G{};

    STRMaterial() = default;
    STRMaterial(int id, const std::string& name, double e, double g)
        : Id(id), Name(name), E(e), G(g) {
    }
};

class STRSection {
public:
    int Id{};
    std::string Name;
    double Ax{};
    double Ix{};
    double Iy{};
    double Iz{};

    STRSection() = default;
    STRSection(int id, const std::string& name, double ax, double ix, double iy, double iz)
        : Id(id), Name(name), Ax(ax), Ix(ix), Iy(iy), Iz(iz) {
    }
};

class STRRelease {
public:
    static constexpr double KURigid = 1e15;
    static constexpr double KUFree = 1e-4;
    static constexpr double KRRigid = 1e15;
    static constexpr double KRFree = 1e-4;

    int Id{};
    std::string Name;
    double KuxStart{ KURigid };
    double KuyStart{ KURigid };
    double KuzStart{ KURigid };
    double KrxStart{ KRRigid };
    double KryStart{ KRRigid };
    double KrzStart{ KRRigid };
    double KuxEnd{ KURigid };
    double KuyEnd{ KURigid };
    double KuzEnd{ KURigid };
    double KrxEnd{ KRRigid };
    double KryEnd{ KRRigid };
    double KrzEnd{ KRRigid };

    STRRelease() = default;
    STRRelease(int id,
        const std::string& name,
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
        double krz2)
        : Id(id),
          Name(name),
          KuxStart(kux1),
          KuyStart(kuy1),
          KuzStart(kuz1),
          KrxStart(krx1),
          KryStart(kry1),
          KrzStart(krz1),
          KuxEnd(kux2),
          KuyEnd(kuy2),
          KuzEnd(kuz2),
          KrxEnd(krx2),
          KryEnd(kry2),
          KrzEnd(krz2) {
    }
};

class STRLoadCase {
public:
    int Id{};
    std::string Name;

    STRLoadCase() = default;
    STRLoadCase(int id, const std::string& name)
        : Id(id), Name(name) {
    }
};

class FEMNode;

class STRNode {
public:
    int Id{};
    double X{};
    double Y{};
    double Z{};

    std::shared_ptr<STRSupport> Support;
    std::shared_ptr<FEMNode> CorrespondingFEMNode;

    std::vector<std::array<double, 6>> DeflectionsByLoadCase;
    std::vector<std::array<double, 6>> ReactionsByLoadCase;

    STRNode() = default;
    STRNode(int id, double x, double y, double z)
        : Id(id), X(x), Y(y), Z(z) {
    }
};

class STRLine {
public:
    static constexpr double Epsilon = 1e-9;

    int Id{};
    std::shared_ptr<STRNode> Node1;
    std::shared_ptr<STRNode> Node2;
    std::shared_ptr<STRSection> Section;
    std::shared_ptr<STRMaterial> Material;
    std::shared_ptr<STRRelease> Release;

    std::array<double, 3> Vx{ 1.0, 0.0, 0.0 };
    std::array<double, 3> Vy{ 0.0, 1.0, 0.0 };
    std::array<double, 3> Vz{ 0.0, 0.0, 1.0 };
    std::array<double, 3> CG{ 0.0, 0.0, 0.0 };
    double Length{};

    STRLine() = default;
    STRLine(int id, const std::shared_ptr<STRNode>& n1, const std::shared_ptr<STRNode>& n2)
        : Id(id), Node1(n1), Node2(n2) {
        Refresh();
    }

    void Refresh();
    bool IsOnLine(double x, double y, double z) const;
    double GetTValue(double x, double y, double z) const;
    std::vector<std::shared_ptr<STRNode>> GetSortedSTRNodes(const std::vector<std::shared_ptr<STRNode>>& nodes) const;
    std::array<double, 3> GetCoordinatesFromRelative(double relativeLocation) const;
};

class STRNodalLoad {
public:
    int Id{};
    int LoadCaseId{};
    double Fx{};
    double Fy{};
    double Fz{};
    double Mx{};
    double My{};
    double Mz{};
    std::vector<int> AppliedTo;

    STRNodalLoad() = default;
    STRNodalLoad(int id, int loadCaseId, double fx, double fy, double fz, double mx, double my, double mz)
        : Id(id), LoadCaseId(loadCaseId), Fx(fx), Fy(fy), Fz(fz), Mx(mx), My(my), Mz(mz) {
    }
};

class STRLineLoadConcentrated {
public:
    int Id{};
    int LoadCaseId{};
    double Fx{};
    double Fy{};
    double Fz{};
    double Mx{};
    double My{};
    double Mz{};
    double RelativeLocation{};
    std::vector<int> AppliedTo;

    STRLineLoadConcentrated() = default;
    STRLineLoadConcentrated(
        int id,
        int loadCaseId,
        double fx,
        double fy,
        double fz,
        double mx,
        double my,
        double mz,
        double relativeLocation)
        : Id(id),
          LoadCaseId(loadCaseId),
          Fx(fx),
          Fy(fy),
          Fz(fz),
          Mx(mx),
          My(my),
          Mz(mz),
          RelativeLocation(relativeLocation) {
    }
};

class STRLineLoadDistributed {
public:
    int Id{};
    int LoadCaseId{};
    double FxStart{};
    double FyStart{};
    double FzStart{};
    double MxStart{};
    double MyStart{};
    double MzStart{};
    double RelativeLocationStart{};
    double FxEnd{};
    double FyEnd{};
    double FzEnd{};
    double MxEnd{};
    double MyEnd{};
    double MzEnd{};
    double RelativeLocationEnd{};
    std::vector<int> AppliedTo;

    STRLineLoadDistributed() = default;
    STRLineLoadDistributed(int id,
        int loadCaseId,
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
        double relativeLocationE)
        : Id(id),
          LoadCaseId(loadCaseId),
          FxStart(fxS),
          FyStart(fyS),
          FzStart(fzS),
          MxStart(mxS),
          MyStart(myS),
          MzStart(mzS),
          RelativeLocationStart(relativeLocationS),
          FxEnd(fxE),
          FyEnd(fyE),
          FzEnd(fzE),
          MxEnd(mxE),
          MyEnd(myE),
          MzEnd(mzE),
          RelativeLocationEnd(relativeLocationE) {
    }
};

class FEMNode {
public:
    int Id{};
    double X{};
    double Y{};
    double Z{};
    bool IsMasterNode{ false };
    bool IsSlaveNode{ false };
    bool IsSupportNode{ false };

    std::weak_ptr<FEMNode> SlaveFEMNode;
    std::weak_ptr<FEMNode> MasterFEMNode;
    std::weak_ptr<STRNode> CorrespondingSTRNode;

    std::vector<std::array<double, 6>> DeflectionsByLoadCase;

    FEMNode() = default;
    FEMNode(int id, double x, double y, double z)
        : Id(id), X(x), Y(y), Z(z) {
    }
};

class FEMBarBeam {
public:
    static constexpr int DOF = 6;

    int Id{};
    std::shared_ptr<FEMNode> FEMNode1;
    std::shared_ptr<FEMNode> FEMNode2;
    std::shared_ptr<STRLine> CorrespondingSTRLine;

    double Length{};
    std::array<double, 3> Vx{ 1.0, 0.0, 0.0 };
    std::array<double, 3> Vy{ 0.0, 1.0, 0.0 };
    std::array<double, 3> Vz{ 0.0, 0.0, 1.0 };

    FEMBarBeam() = default;
    FEMBarBeam(int id, const std::shared_ptr<FEMNode>& n1, const std::shared_ptr<FEMNode>& n2)
        : Id(id), FEMNode1(n1), FEMNode2(n2) {
    }

    void Refresh();
};

class STRController {
public:
    static constexpr double Epsilon = 1e-4;
    static constexpr double FEMEpsilon = 1e-6;

    int STRNodeId = 0;
    int STRLineId = 0;
    int STRSupportId = 0;
    int STRSectionId = 0;
    int STRMaterialId = 0;
    int STRReleaseId = 0;
    int STRLoadCaseId = 0;
    int STRNodalLoadId = 0;
    int STRLineLoadConcentratedId = 0;
    int STRLineLoadDistributedId = 0;
    int FEMNodeId = 0;
    int FEMBarId = 0;

    std::vector<std::shared_ptr<STRNode>> STRNodes;
    std::vector<std::shared_ptr<STRLine>> STRLines;
    std::vector<std::shared_ptr<STRSupport>> STRSupports;
    std::vector<std::shared_ptr<STRSection>> STRSections;
    std::vector<std::shared_ptr<STRMaterial>> STRMaterials;
    std::vector<std::shared_ptr<STRRelease>> STRReleases;
    std::vector<std::shared_ptr<STRLoadCase>> STRLoadCases;
    std::vector<std::shared_ptr<STRNodalLoad>> STRNodalLoads;
    std::vector<std::shared_ptr<STRLineLoadConcentrated>> STRLineLoadConcentrateds;
    std::vector<std::shared_ptr<STRLineLoadDistributed>> STRLineLoadDistributeds;

    std::vector<std::shared_ptr<FEMNode>> FEMNodes;
    std::vector<std::shared_ptr<FEMBarBeam>> FEMBarBeams;

    std::shared_ptr<STRNode> AddSTRNode(double x, double y, double z);
    std::shared_ptr<STRNode> GetSTRNode(int nodeId) const;
    std::shared_ptr<STRLine> AddSTRLine(const std::shared_ptr<STRNode>& node1, const std::shared_ptr<STRNode>& node2);
    std::shared_ptr<STRLine> GetSTRLine(int lineId) const;

    std::shared_ptr<STRLineLoadDistributed> AddSTRLineLoadDistributed(int loadCaseId,
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
        double relativeLocationE);
    std::shared_ptr<STRLineLoadConcentrated> AddSTRLineLoadConcentrated(
        int loadCaseId,
        double fx,
        double fy,
        double fz,
        double mx,
        double my,
        double mz,
        double relativeLocation);
    std::shared_ptr<STRNodalLoad> AddSTRNodalLoad(int loadCaseId, double fx, double fy, double fz, double mx, double my, double mz);
    std::shared_ptr<STRLoadCase> AddSTRLoadCase(const std::string& name);

    std::shared_ptr<STRRelease> AddSTRRelease(const std::string& name,
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
        double krz2);
    std::shared_ptr<STRRelease> AddSTRReleaseRigidPinned(const std::string& name);
    std::shared_ptr<STRRelease> AddSTRReleasePinnedRigid(const std::string& name);
    std::shared_ptr<STRRelease> AddSTRReleasePinnedPinned(const std::string& name);

    std::shared_ptr<STRMaterial> AddSTRMaterial(const std::string& name, double e, double g);
    std::shared_ptr<STRSection> AddSTRSection(const std::string& name, double ax, double ix, double iy, double iz);
    std::shared_ptr<STRSection> AddSTRSectionRectangular(const std::string& name, double width, double height);

    std::shared_ptr<STRSupport> AddSTRSupport(const std::string& name, double kux, double kuy, double kuz, double krx, double kry, double krz);
    std::shared_ptr<STRSupport> AddSTRSupportFixed(const std::string& name);
    std::shared_ptr<STRSupport> AddSTRSupportPinned(const std::string& name);
    std::shared_ptr<STRSupport> AddSTRSupportRoller(const std::string& name);

    void ApplySupport(const std::shared_ptr<STRNode>& node, const std::shared_ptr<STRSupport>& support);
    void DeleteSupport(const std::shared_ptr<STRNode>& node);
    void ApplySection(const std::shared_ptr<STRLine>& line, const std::shared_ptr<STRSection>& section);
    void DeleteSection(const std::shared_ptr<STRLine>& line);
    void ApplyMaterial(const std::shared_ptr<STRLine>& line, const std::shared_ptr<STRMaterial>& material);
    void DeleteMaterial(const std::shared_ptr<STRLine>& line);
    void ApplyRelease(const std::shared_ptr<STRLine>& line, const std::shared_ptr<STRRelease>& release);
    void DeleteRelease(const std::shared_ptr<STRLine>& line);

    void ApplyLoad(const std::shared_ptr<STRNodalLoad>& load, int appliedToNodeId);
    void ApplyLoad(const std::shared_ptr<STRLineLoadConcentrated>& load, int appliedToLineId);
    void ApplyLoad(const std::shared_ptr<STRLineLoadDistributed>& load, int appliedToLineId);
    void DeleteLoad(const std::shared_ptr<STRNodalLoad>& load);
    void DeleteLoad(const std::shared_ptr<STRLineLoadConcentrated>& load);
    void DeleteLoad(const std::shared_ptr<STRLineLoadDistributed>& load);

    void ToString() const;
    void PerformLinearElasticAnalysis();
    void ExportResults(const std::string& outputDirectory) const;

private:
    using Matrix = std::vector<std::vector<double>>;

    std::shared_ptr<FEMNode> AddFEMNode(double x, double y, double z);
    std::shared_ptr<FEMBarBeam> AddFEMBarBeam(const std::shared_ptr<FEMNode>& femNode1, const std::shared_ptr<FEMNode>& femNode2);

    void ClearFEMModel();
    void GenerateFiniteElements();

    static std::array<double, 3> Cross(const std::array<double, 3>& a, const std::array<double, 3>& b);
    static double Dot(const std::array<double, 3>& a, const std::array<double, 3>& b);
    static std::array<double, 3> Normalize(const std::array<double, 3>& v);

    static Matrix Zeros(int rows, int cols);
    static Matrix Transpose(const Matrix& matrix);
    static Matrix Multiply(const Matrix& a, const Matrix& b);
    static std::vector<double> Multiply(const Matrix& a, const std::vector<double>& x);
    static std::vector<double> SolveLinearSystem(Matrix a, std::vector<double> b);

    static Matrix CalculateBeamLocalStiffness(double A, double J, double Iy, double Iz, double E, double G, double L);
    static Matrix CalculateTransformation(const std::array<double, 3>& vx, const std::array<double, 3>& vy, const std::array<double, 3>& vz);

    static void AssembleElement(Matrix& globalK, const Matrix& ke, int node1Id, int node2Id);

    void ApplyNodalLoadsForCase(int loadCaseId, std::vector<double>& globalF) const;
    void ApplyLineLoadsForCase(int loadCaseId, std::vector<double>& globalF) const;
    void ApplyConcentratedLineLoadToVector(const STRLineLoadConcentrated& load, const STRLine& line, std::vector<double>& globalF) const;
    void ApplyDistributedLineLoadToVector(const STRLineLoadDistributed& load, const STRLine& line, std::vector<double>& globalF) const;

    static void AddToGlobalNodeLoad(std::vector<double>& globalF, int nodeId, const std::array<double, 6>& localLoad, const Matrix& tNode);
    static Matrix NodeTransform(const std::array<double, 3>& vx, const std::array<double, 3>& vy, const std::array<double, 3>& vz);
};
