cmake_minimum_required(VERSION 3.10)
project(MyProject)
#Specify where headers live
include_directories("./includes")

set(SOURCES
	./src/main.cpp
	./src/STRController.cpp
)

add_executable(MyProject ${SOURCES})
