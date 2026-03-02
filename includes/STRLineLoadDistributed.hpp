#pragma once

class STRLineLoadDistributed{
public:
	int Id;
	int LoadCaseId;
	double Fxs, Fys, Fzs, Mxs, Mys, Mzs,  Fxe, Fye, Fze, Mxe, Mye, Mze;
	std::vector<int> AppliedTo;
	double RelativeLocationStart, RelativeLocationEnd;
	// Constructor
	STRLineLoadDistributed(int Id, int LoadCaseId, double Fxs, double Fys, double Fzs, double Fxe, double Fye, double Fze,
		double Mxs, double Mys, double Mzs,double Mxe, double Mye, double Mze, double RelativeLocationStart, double RelativeLocationEnd);

	void ToString() const;
};