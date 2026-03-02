#pragma once
#include <string>

class STRSection {
public:
	int Id;
	std::string Name;
	double Ax, Ix, Iy, Iz;

	// Constructor
	STRSection(int Id, std::string& Name, double Ax, double Ix, double Iy, double Iz);


	// Print method
	void ToString() const;
}