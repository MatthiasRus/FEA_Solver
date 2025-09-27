#pragma once
#include <string>

class STRLoadCase {
public:
	int Id;
	std::string Name;
	// Constructor
	STRLoadCase(int Id, const std::string& Name);
	// Print method
	void ToString() const;

};