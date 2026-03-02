#include "STRSection.hpp"
#include <iostream>

STRSection::STRSection(int id, std::string& name, double ax, double ix, double iy, double iz)
	: Id(id), Name(name), Ax(ax), Ix(ix), Iy(iy), Iz(iz) {
};

void STRSection::ToString() const {
	std::cout << "Section (" << Name << ") #" << Id << "\n";
};