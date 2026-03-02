#pragma once
#include <string>

const double KURigid = 1e15;
const double KUFree = 1e-4;
const double KRRigid = 1e15;
const double KRFree = 1e-4;

class STRSupport {
public:
	int Id;
	std::string Name;
	double Kux, Kuy, Kuz, Krx, Kry, Krz;

	STRSupport(int id, const std::string& name, double kux,double kuy, double kuz, double krx, double kry, double krz );

	void ToString() const;
}