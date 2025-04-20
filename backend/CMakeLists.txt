cmake_minimum_required(VERSION 3.10)
project(crow_example)

find_package(nlohmann_json 3.2.0 REQUIRED)

add_executable(server main.cpp)

target_link_libraries(server PRIVATE nlohmann_json::nlohmann_json)
