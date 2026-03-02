#include "STRLineLoadDistributed.hpp"
#include <iostream>
#include <vector>

STRLineLoadDistributed::STRLineLoadDistributed(int Id, int LoadCaseId, double Fxs, double Fys, double Fzs,double Fxe, double Fye, double Fze,

	double Mxs, double Mys, double Mzs, double Mxe, double Mye, double Mze, double RLS, double RLE)
	: Id(Id), LoadCaseId(LoadCaseId), Fxs(Fxs), Fys(Fys), Fzs(Fzs), Fxe(Fxe), Fye(Fye), Fze(Fze), Mxs(Mxs), Mys(Mys), Mzs(Mzs), Mxe(Mxe), Mye(Mye), Mze(Mze),RelativeLoacationStart(RLS),RelativeLoacationEnd(RLE){
}

void STRLineLoadDistributed::ToString() const {
	std::cout << "Line Load Distributed ID: " << Id << ", Load Case ID: " << LoadCaseId << "@Relative Location Start: " << RelativeLoacationStart << ", End: " << RelativeLoacationEnd << std::endl;
	std::cout << "Forces at Start: Fxs=" << Fxs << ", Fys=" << Fys << ", Fzs=" << Fzs << std::endl;
	std::cout << "Forces at End: Fxe=" << Fxe << ", Fye=" << Fye << ", Fze=" << Fze << std::endl;
	std::cout << "Moments at Start: Mxs=" << Mxs << ", Mys=" << Mys << ", Mzs=" << Mzs << std::endl;
	std::cout << "Moments at End: Mxe=" << Mxe << ", Mye=" << Mye << ", Mze=" << Mze << std::endl;
	std::cout << "Applied To Elements: ";
	for (size_t i = 0; i < AppliedTo.size(); ++i) {
		std::cout << AppliedTo[i];
		if (i < AppliedTo.size() - 1) {
			std::cout << ", ";
		}
	}
	std::cout << std::endl;
}
