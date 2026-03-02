#include "STRNodalLoad.h"
#include <iostream>
#include <vector>

STRNodalLoad::STRNodalLoad(int Id, int LoadCaseId, double Fx, double Fy, double Fz, double Mx, double My, double Mz)
	: Id(Id), LoadCaseId(LoadCaseId), Fx(Fx), Fy(Fy), Fz(Fz), Mx(Mx), My(My), Mz(Mz) {
}

void STRNodalLoad::ToString() const {
	std::cout << "Nodal Load ID: " << Id << ", Load Case ID: " << LoadCaseId << std::endl;
	std::cout << "Forces: Fx=" << Fx << ", Fy=" << Fy << ", Fz=" << Fz << std::endl;
	std::cout << "Moments: Mx=" << Mx << ", My=" << My << ", Mz=" << Mz << std::endl;
	std::cout << "Applied To Nodes: ";
	for (size_t i = 0; i < AppliedTo.size(); ++i) {
		std::cout << AppliedTo[i];
		if (i < AppliedTo.size() - 1) {
			std::cout << ", ";
		}
	}
	std::cout << std::endl;
}