#pragma once
#include <string>

class STRMaterial {
public:
    int Id;
    std::string Name;
    double E; // Young's modulus
    double G; // Shear modulus

    // Constructor
    STRMaterial(int Id, const std::string& Name, double E, double G);

    // Print method
    void ToString() const;
};
