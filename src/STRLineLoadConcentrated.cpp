#include "STRLineLoadConcentrated.hpp"
#include <iostream>
#include <vector>

STRLineLoadConcentrated::STRLineLoadConcentrated(int Id, int LoadCaseId, double Fx, double Fy, double Fz,
	double Mx, double My, double Mz, double RL)
	: Id(Id), LoadCaseId(LoadCaseId), Fx(Fx), Fy(Fy), Fz(Fz), Mx(Mx), My(My), Mz(Mz) ,RelativeLoacation(RL){
}


void STRLineLoadConcentrated::ToString() const {
	std::cout << "Line Load Concentrated ID: " << Id << ", Load Case ID: " << LoadCaseId << "@Relative Location: " << RelativeLoacation  << std::endl;
	std::cout << "Forces: Fx=" << Fx << ", Fy=" << Fy << ", Fz=" << Fz << std::endl;
	std::cout << "Moments: Mx=" << Mx << ", My=" << My << ", Mz=" << Mz << std::endl;
	std::cout << "Applied To Elements: ";
	for (size_t i = 0; i < AppliedTo.size(); ++i) {
		std::cout << AppliedTo[i];
		if (i < AppliedTo.size() - 1) {
			std::cout << ", ";
		}
	}
	std::cout << std::endl;
}
