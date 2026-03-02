#include "STRSupport.hpp"
#include <iostream>

STRSupport::STRSupport(int id, const std::string& name, double kux, double kuy, double kuz, double krx, double kry, double krz)
    : Id(id), Name(name), Kux(kux), Kuy(kuy), Kuz(kuz), Krx(krx), Kry(kry), Krz(krz) {
}

void STRSupport::ToString() const {
    std::cout << "Support (" << Name << ") #" << Id << "\n";

    if (Kux == KUFree)
        std::cout << 'f';
    else
        std::cout << 'x';

    if (Kuy == KUFree)
        std::cout << 'f';
    else
        std::cout << 'x';

    if (Kuz == KUFree)
        std::cout << 'f';
    else
        std::cout << 'x';

    if (Krx == KRFree)
        std::cout << 'f';
    else
        std::cout << 'x';

    if (Kry == KRFree)
        std::cout << 'f';
    else
        std::cout << 'x';

    if (Krz == KRFree)
        std::cout << 'f';
    else
        std::cout << 'x';

    std::cout << '\n';
}