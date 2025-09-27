#pragma once
#include <iostream>
#include <memory>
#include <string>
#include <vector>

// Forward declarations to avoid circular includes
class STRSupport;
class FEMNode;

class STRNode {
public:
    // --- Data members ---
    int Id;        // Identifier of the node
    double X, Y, Z; // Coordinates

    // For simplicity, using smart pointers (optional)
    std::shared_ptr<STRSupport> Support;
    std::shared_ptr<FEMNode> CorrespondingFEMNode;

    std::vector<double> Deflections; // Can grow with DOFs
    std::vector<double> Reactions;   // rows=LC, cols=DOFs (flattened)

    // --- Constructors ---
    STRNode(int id, double x, double y, double z);

    // --- Methods ---
    void ToString() const;
};
