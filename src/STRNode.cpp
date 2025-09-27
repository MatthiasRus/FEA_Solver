include "STRNode.hpp"

// Constructor
STRNode::STRNode(int id, double x, double y, double z)
    : Id(id), X(x), Y(y), Z(z) {}

// Print info
void STRNode::ToString() const {
    std::cout << "Node (";
    if (!Support) {
        std::cout << "Free";
    } else {
        // For now, just placeholder (need STRSupport::Name later)
        std::cout << "Support";
    }
    std::cout << ") #" << Id
              << " at [" << X << ", " << Y << ", " << Z << "]\n";
}
