#pragma once
#include <iostream>
#include <vector>
#include <memory>
#include <cmath>
#include <algorithm>
#include "STRNode.hpp" // to use STRNode

class STRMaterial;
class STRSection;
class STRRelease;

class STRLine {
public:
    static constexpr double Epsilon = 1e-4;

    int Id;
    std::shared_ptr<STRNode> Node1;
    std::shared_ptr<STRNode> Node2;

    std::shared_ptr<STRSection> Section;
    std::shared_ptr<STRMaterial> Material;
    std::shared_ptr<STRRelease> Release;

    std::vector<double> Vx; // direction vector (unit)
    std::vector<double> Vy;
    std::vector<double> Vz;
    std::vector<double> CG; // centroid
    double Length = 0.0;

    // Placeholder: other FEM/diagram data
    // e.g. std::vector<double> FxDiagram;

    // Constructor
    STRLine(int id, std::shared_ptr<STRNode> n1, std::shared_ptr<STRNode> n2);

    // Methods
    void Refresh();
    void ToString() const;

    std::vector<std::shared_ptr<STRNode>> GetSortedSTRNodes(const std::vector<std::shared_ptr<STRNode>>& nodes) const;
    double GetTValue(double x, double y, double z) const;
    bool IsOnLine(double x, double y, double z) const;
    std::vector<double> GetCoordinatesFromRelative(double relativeLocation) const;
};
