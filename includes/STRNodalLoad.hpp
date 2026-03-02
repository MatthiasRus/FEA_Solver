#pragma once

class STRNodalLoad {
public:
	int Id;
	int LoadCaseId;
	double Fx, Fy, Fz, Mx, My, Mz;
	std::vector<int> AppliedTo;
	// Constructor
	STRNodalLoad(int Id, int LoadCaseId, double Fx, double Fy, double Fz, double Mx, double My, double Mz);

	void ToString() const;
};