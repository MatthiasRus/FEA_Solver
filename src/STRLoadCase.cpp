#include "STRLoadCase.hpp"
#include <iostream>

STRLoadCase::STRLoadCase(int id, const std::string& name)
	: Id(id), Name(name) {
};

void STRLoadCase::ToString() const {
	std::cout << "Load Case (" << Name << ") #" << Id << "\n";
};