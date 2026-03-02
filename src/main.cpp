#include <exception>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

#include "FEAModel.hpp"

namespace {

std::string Trim(const std::string& text) {
	const auto first = text.find_first_not_of(" \t\r\n");
	if (first == std::string::npos) {
		return "";
	}
	const auto last = text.find_last_not_of(" \t\r\n");
	return text.substr(first, last - first + 1);
}

std::vector<std::string> Tokenize(const std::string& line) {
	std::vector<std::string> tokens;
	std::istringstream stream(line);
	std::string token;
	while (stream >> token) {
		tokens.push_back(token);
	}
	return tokens;
}

int ToInt(const std::string& text, const std::string& context) {
	try {
		return std::stoi(text);
	} catch (...) {
		throw std::runtime_error("Invalid integer for " + context + ": " + text);
	}
}

double ToDouble(const std::string& text, const std::string& context) {
	try {
		return std::stod(text);
	} catch (...) {
		throw std::runtime_error("Invalid number for " + context + ": " + text);
	}
}

void BuildSampleFrame(STRController& controller) {
	auto node1 = controller.AddSTRNode(0, 0, 0);
	auto node2 = controller.AddSTRNode(0, 0, 5);
	auto node3 = controller.AddSTRNode(10, 0, 5);
	auto node4 = controller.AddSTRNode(10, 0, 0);

	auto line1 = controller.AddSTRLine(node1, node2);
	auto line2 = controller.AddSTRLine(node2, node3);
	auto line3 = controller.AddSTRLine(node3, node4);

	auto fixed1 = controller.AddSTRSupportFixed("Fixed_1");
	auto fixed2 = controller.AddSTRSupportFixed("Fixed_2");
	controller.ApplySupport(node1, fixed1);
	controller.ApplySupport(node4, fixed2);

	auto sec = controller.AddSTRSectionRectangular("300x500", 0.30, 0.50);
	auto mat = controller.AddSTRMaterial("Concrete", 20e9, 8e9);

	controller.ApplySection(line1, sec);
	controller.ApplySection(line2, sec);
	controller.ApplySection(line3, sec);

	controller.ApplyMaterial(line1, mat);
	controller.ApplyMaterial(line2, mat);
	controller.ApplyMaterial(line3, mat);

	auto lc1 = controller.AddSTRLoadCase("DL");
	auto lc2 = controller.AddSTRLoadCase("LL");

	auto dist1 = controller.AddSTRLineLoadDistributed(
		lc1->Id,
		-1000,
		-2000,
		3000,
		100,
		200,
		300,
		0.25,
		2000,
		-3000,
		-4000,
		200,
		300,
		400,
		0.75);
	controller.ApplyLoad(dist1, line2->Id);

	auto conc1 = controller.AddSTRLineLoadConcentrated(lc1->Id, -500, 1000, 1500, 100, 200, 300, 0.50);
	controller.ApplyLoad(conc1, line2->Id);

	auto nodal1 = controller.AddSTRNodalLoad(lc1->Id, -1000, 2000, -3000, 100, 200, 300);
	controller.ApplyLoad(nodal1, node2->Id);
	controller.ApplyLoad(nodal1, node3->Id);

	auto nodal2 = controller.AddSTRNodalLoad(lc2->Id, 0, -4000, 0, 0, 0, 0);
	controller.ApplyLoad(nodal2, node2->Id);
	controller.ApplyLoad(nodal2, node3->Id);
}

void BuildFromModelFile(STRController& controller, const std::string& modelPath) {
	std::ifstream input(modelPath);
	if (!input.is_open()) {
		throw std::runtime_error("Cannot open model file: " + modelPath);
	}

	std::unordered_map<int, std::shared_ptr<STRNode>> nodeByKey;
	std::unordered_map<int, std::shared_ptr<STRLine>> lineByKey;
	std::unordered_map<std::string, std::shared_ptr<STRSupport>> supportByName;
	std::unordered_map<std::string, std::shared_ptr<STRSection>> sectionByName;
	std::unordered_map<std::string, std::shared_ptr<STRMaterial>> materialByName;
	std::unordered_map<int, std::shared_ptr<STRLoadCase>> loadCaseByKey;

	std::string raw;
	int lineNo = 0;
	while (std::getline(input, raw)) {
		++lineNo;
		auto line = Trim(raw);
		if (line.empty() || line.rfind("#", 0) == 0) {
			continue;
		}

		const auto tokens = Tokenize(line);
		const auto& kind = tokens[0];

		auto fail = [&](const std::string& msg) {
			throw std::runtime_error("Model parse error at line " + std::to_string(lineNo) + ": " + msg);
		};

		if (kind == "NODE") {
			if (tokens.size() != 5) fail("NODE format: NODE key x y z");
			const int key = ToInt(tokens[1], "NODE key");
			auto n = controller.AddSTRNode(ToDouble(tokens[2], "x"), ToDouble(tokens[3], "y"), ToDouble(tokens[4], "z"));
			nodeByKey[key] = n;
		} else if (kind == "LINE") {
			if (tokens.size() != 4) fail("LINE format: LINE key nodeKey1 nodeKey2");
			const int key = ToInt(tokens[1], "LINE key");
			const int n1 = ToInt(tokens[2], "nodeKey1");
			const int n2 = ToInt(tokens[3], "nodeKey2");
			if (!nodeByKey.count(n1) || !nodeByKey.count(n2)) fail("LINE references undefined NODE");
			lineByKey[key] = controller.AddSTRLine(nodeByKey[n1], nodeByKey[n2]);
		} else if (kind == "SUPPORT_DEF") {
			if (tokens.size() < 3) fail("SUPPORT_DEF format: SUPPORT_DEF name FIXED|PINNED|ROLLER");
			const std::string name = tokens[1];
			const std::string type = tokens[2];
			if (type == "FIXED") supportByName[name] = controller.AddSTRSupportFixed(name);
			else if (type == "PINNED") supportByName[name] = controller.AddSTRSupportPinned(name);
			else if (type == "ROLLER") supportByName[name] = controller.AddSTRSupportRoller(name);
			else fail("Unsupported support type: " + type);
		} else if (kind == "SUPPORT") {
			if (tokens.size() != 3) fail("SUPPORT format: SUPPORT nodeKey supportName");
			const int nodeKey = ToInt(tokens[1], "nodeKey");
			const std::string supportName = tokens[2];
			if (!nodeByKey.count(nodeKey) || !supportByName.count(supportName)) fail("SUPPORT references undefined node/support");
			controller.ApplySupport(nodeByKey[nodeKey], supportByName[supportName]);
		} else if (kind == "SECTION_RECT") {
			if (tokens.size() != 4) fail("SECTION_RECT format: SECTION_RECT name width height");
			sectionByName[tokens[1]] = controller.AddSTRSectionRectangular(tokens[1], ToDouble(tokens[2], "width"), ToDouble(tokens[3], "height"));
		} else if (kind == "SECTION_GEN") {
			if (tokens.size() != 6) fail("SECTION_GEN format: SECTION_GEN name Ax Ix Iy Iz");
			sectionByName[tokens[1]] = controller.AddSTRSection(tokens[1], ToDouble(tokens[2], "Ax"), ToDouble(tokens[3], "Ix"), ToDouble(tokens[4], "Iy"), ToDouble(tokens[5], "Iz"));
		} else if (kind == "MATERIAL") {
			if (tokens.size() != 4) fail("MATERIAL format: MATERIAL name E G");
			materialByName[tokens[1]] = controller.AddSTRMaterial(tokens[1], ToDouble(tokens[2], "E"), ToDouble(tokens[3], "G"));
		} else if (kind == "ASSIGN_SECTION") {
			if (tokens.size() != 3) fail("ASSIGN_SECTION format: ASSIGN_SECTION lineKey sectionName");
			const int lineKey = ToInt(tokens[1], "lineKey");
			const std::string sectionName = tokens[2];
			if (!lineByKey.count(lineKey) || !sectionByName.count(sectionName)) fail("ASSIGN_SECTION references undefined line/section");
			controller.ApplySection(lineByKey[lineKey], sectionByName[sectionName]);
		} else if (kind == "ASSIGN_MATERIAL") {
			if (tokens.size() != 3) fail("ASSIGN_MATERIAL format: ASSIGN_MATERIAL lineKey materialName");
			const int lineKey = ToInt(tokens[1], "lineKey");
			const std::string materialName = tokens[2];
			if (!lineByKey.count(lineKey) || !materialByName.count(materialName)) fail("ASSIGN_MATERIAL references undefined line/material");
			controller.ApplyMaterial(lineByKey[lineKey], materialByName[materialName]);
		} else if (kind == "LOAD_CASE") {
			if (tokens.size() < 3) fail("LOAD_CASE format: LOAD_CASE key name");
			const int lcKey = ToInt(tokens[1], "load case key");
			loadCaseByKey[lcKey] = controller.AddSTRLoadCase(tokens[2]);
		} else if (kind == "NODAL_LOAD") {
			if (tokens.size() != 9) fail("NODAL_LOAD format: NODAL_LOAD lcKey nodeKey Fx Fy Fz Mx My Mz");
			const int lcKey = ToInt(tokens[1], "lcKey");
			const int nodeKey = ToInt(tokens[2], "nodeKey");
			if (!loadCaseByKey.count(lcKey) || !nodeByKey.count(nodeKey)) fail("NODAL_LOAD references undefined load case/node");
			auto load = controller.AddSTRNodalLoad(
				loadCaseByKey[lcKey]->Id,
				ToDouble(tokens[3], "Fx"),
				ToDouble(tokens[4], "Fy"),
				ToDouble(tokens[5], "Fz"),
				ToDouble(tokens[6], "Mx"),
				ToDouble(tokens[7], "My"),
				ToDouble(tokens[8], "Mz"));
			controller.ApplyLoad(load, nodeByKey[nodeKey]->Id);
		} else if (kind == "LINE_CONC_LOAD") {
			if (tokens.size() != 10) fail("LINE_CONC_LOAD format: LINE_CONC_LOAD lcKey lineKey rel Fx Fy Fz Mx My Mz");
			const int lcKey = ToInt(tokens[1], "lcKey");
			const int lineKey = ToInt(tokens[2], "lineKey");
			if (!loadCaseByKey.count(lcKey) || !lineByKey.count(lineKey)) fail("LINE_CONC_LOAD references undefined load case/line");
			auto load = controller.AddSTRLineLoadConcentrated(
				loadCaseByKey[lcKey]->Id,
				ToDouble(tokens[4], "Fx"),
				ToDouble(tokens[5], "Fy"),
				ToDouble(tokens[6], "Fz"),
				ToDouble(tokens[7], "Mx"),
				ToDouble(tokens[8], "My"),
				ToDouble(tokens[9], "Mz"),
				ToDouble(tokens[3], "relativeLocation"));
			controller.ApplyLoad(load, lineByKey[lineKey]->Id);
		} else if (kind == "LINE_DIST_LOAD") {
			if (tokens.size() != 17) fail("LINE_DIST_LOAD format: LINE_DIST_LOAD lc line rs re fxs fys fzs mxs mys mzs fxe fye fze mxe mye mze");
			const int lcKey = ToInt(tokens[1], "lcKey");
			const int lineKey = ToInt(tokens[2], "lineKey");
			if (!loadCaseByKey.count(lcKey) || !lineByKey.count(lineKey)) fail("LINE_DIST_LOAD references undefined load case/line");
			auto load = controller.AddSTRLineLoadDistributed(
				loadCaseByKey[lcKey]->Id,
				ToDouble(tokens[5], "FxStart"),
				ToDouble(tokens[6], "FyStart"),
				ToDouble(tokens[7], "FzStart"),
				ToDouble(tokens[8], "MxStart"),
				ToDouble(tokens[9], "MyStart"),
				ToDouble(tokens[10], "MzStart"),
				ToDouble(tokens[3], "relativeStart"),
				ToDouble(tokens[11], "FxEnd"),
				ToDouble(tokens[12], "FyEnd"),
				ToDouble(tokens[13], "FzEnd"),
				ToDouble(tokens[14], "MxEnd"),
				ToDouble(tokens[15], "MyEnd"),
				ToDouble(tokens[16], "MzEnd"),
				ToDouble(tokens[4], "relativeEnd"));
			controller.ApplyLoad(load, lineByKey[lineKey]->Id);
		} else {
			fail("Unknown command: " + kind);
		}
	}
}

struct Options {
	std::string modelPath;
	std::string outputDir = "output";
};

Options ParseArgs(int argc, char** argv) {
	Options opt;
	for (int i = 1; i < argc; ++i) {
		const std::string arg = argv[i];
		if (arg == "--model" && i + 1 < argc) {
			opt.modelPath = argv[++i];
		} else if (arg == "--output" && i + 1 < argc) {
			opt.outputDir = argv[++i];
		} else if (arg == "--help" || arg == "-h") {
			std::cout << "Usage: MyProject [--model <file.fea>] [--output <dir>]\n";
			std::exit(0);
		} else {
			throw std::runtime_error("Unknown argument: " + arg);
		}
	}
	return opt;
}

} // namespace

int main(int argc, char** argv) {
	try {
		const auto options = ParseArgs(argc, argv);

		STRController controller;
		if (!options.modelPath.empty()) {
			BuildFromModelFile(controller, options.modelPath);
		} else {
			const std::filesystem::path defaultModel = std::filesystem::path("models") / "sample_frame.fea";
			if (std::filesystem::exists(defaultModel)) {
				BuildFromModelFile(controller, defaultModel.string());
			} else {
				BuildSampleFrame(controller);
			}
		}

		controller.PerformLinearElasticAnalysis();
		controller.ToString();
		controller.ExportResults(options.outputDir);

		std::cout << "Analysis completed. Results exported to " << options.outputDir << "\n";
		std::cout << "Run: python3 scripts/render_results.py " << options.outputDir << " 1\n";
		return 0;
	} catch (const std::exception& ex) {
		std::cerr << "Error: " << ex.what() << "\n";
		return 1;
	}
}
