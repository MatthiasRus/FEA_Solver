#include "STRMaterial.hpp"
#include <iostream>

STRMaterial::STRMaterial(int id, const std::string& name, double e, double g)
    : Id(id), Name(name), E(e), G(g) {
}

void STRMaterial::ToString() const {
    std::cout << "Material (" << Name << ") #" << Id << "\n";
}
