#pragma once

class STRLineLoadConcentrated{
public:
	int Id;
	int LoadCaseId;
	double Fx, Fy, Fz, Mx, My, Mz;
	std::vector<int> AppliedTo;
	double RelativeLocation;
	// Constructor
	STRLineLoadConcentrated(int Id, int LoadCaseId, double Fx, double Fy, double Fz, double Mx, double My, double Mz, double RelativeLocation);

	void ToString() const;
};