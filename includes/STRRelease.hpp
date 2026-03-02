#pragma once
#include <string>

const double KURigid = 1e15;
const double KUFree = 1e-4;
const double KRRigid = 1e15;
const double KRFree = 1e-4;


class STRRelease {
public:
   int Id;
   std::string Name, 
   double KuxStart, KuyStart, KuzStart, KrxStart, KryStart, KrzStart, KuxEnd, KuyEnd, KuzEnd, KrxEnd, KryEnd, KrzEnd;
	

   STRRelease(
	   int Id;
   std::string Name,
	   double KuxStart, KuyStart, KuzStart, KrxStart, KryStart, KrzStart, KuxEnd, KuyEnd, KuzEnd, KrxEnd, KryEnd, KrzEnd;
	   );

   void ToString() const();

};

