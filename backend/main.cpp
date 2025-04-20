#include "crow.h"
#include <vector>
#include <string>
#include <fstream>
#include <sstream>
#include <nlohmann/json.hpp>  // JSONライブラリ
#include <filesystem>

struct Task {
    std::string name;
    bool completed;
    std::string priority;
};

std::vector<Task> tasks;

// JSONデータを保存するファイルパス（絶対パスで統一）
std::string tasks_file = "/mnt/c/Users/Furihata Yuto/projects/crow_example/backend/tasks.json";

// tasks.json が存在しない場合に作成
void ensure_tasks_file_exists(const std::string& filename) {
    if (!std::filesystem::exists(filename)) {
        std::ofstream file(filename);
        file << "[]"; // 空のJSON配列を作成
        file.close();
    }
}

// タスクを JSON ファイルに保存
void save_tasks_to_file() {
    nlohmann::json j;
    for (const auto& task : tasks) {
        j.push_back({{"name", task.name}, {"completed", task.completed}, {"priority", task.priority}});
    }
    std::ofstream file(tasks_file, std::ios::trunc); // 上書き保存
    if (!file.is_open()) {
        std::cerr << "Error: Unable to open file for writing: " << tasks_file << std::endl;
        return;
    }
    file << j.dump(4);
    file.close();
    std::cout << "Tasks saved to " << tasks_file << std::endl;
}

// タスクを JSON ファイルから読み込む
void load_tasks_from_file() {
    std::ifstream file(tasks_file);
    if (!file.is_open()) {
        std::cerr << "Error: Unable to open file for reading: " << tasks_file << std::endl;
        return;
    }
    nlohmann::json json_tasks;
    file >> json_tasks;
    file.close();

    tasks.clear();
    for (const auto& json_task : json_tasks) {
        tasks.push_back({json_task["name"], json_task["completed"], json_task["priority"]});
    }
    std::cout << "Tasks loaded from " << tasks_file << std::endl;
}

int main() {
    crow::SimpleApp app;

    // tasks.json をチェック・作成
    ensure_tasks_file_exists(tasks_file);
    load_tasks_from_file();

    // ✅ `/` で `index.html` を提供
    CROW_ROUTE(app, "/")([]() {
        std::string index_path = "/mnt/c/Users/Furihata Yuto/projects/crow_example/frontend/index.html";
        std::ifstream file(index_path);

        if (!file.is_open()) {
            std::cerr << "File not found: " << index_path << std::endl;
            return crow::response(404, "Not Found");
        }

        std::stringstream buffer;
        buffer << file.rdbuf();
        return crow::response{buffer.str()};
    });

    // ✅ `/tasks` API（タスク一覧）
    CROW_ROUTE(app, "/tasks")([]() {
        crow::json::wvalue response;
        crow::json::wvalue::list tasks_list;

        for (const auto& task : tasks) {
            crow::json::wvalue task_object;
            task_object["name"] = task.name;
            task_object["completed"] = task.completed;
            task_object["priority"] = task.priority;
            tasks_list.emplace_back(std::move(task_object));
        }

        response["tasks"] = std::move(tasks_list);
        return response;
    });

    // ✅ `/add_task` API（タスク追加）
    CROW_ROUTE(app, "/add_task").methods("POST"_method)
    ([](const crow::request& req) {
        auto body = crow::json::load(req.body);
        if (!body)
            return crow::response(400, "Invalid JSON");

        std::string name = body["name"].s();
        std::string priority = body["priority"].s();

        tasks.emplace_back(Task{name, false, priority});
        save_tasks_to_file();

        crow::json::wvalue response;
        response["message"] = "Task added.";
        return crow::response{response};
    });

    // ✅ `/complete_task` API（タスク完了）
    CROW_ROUTE(app, "/complete_task/<int>")([](int index) {
        if (index >= 0 && index < tasks.size()) {
            tasks[index].completed = true;
            save_tasks_to_file();
            return crow::response(200, "Task completed.");
        }
        return crow::response(400, "Invalid task index.");
    });

    // ✅ `/delete_task` API（タスク削除）
    CROW_ROUTE(app, "/delete_task/<int>")([](int index) {
        if (index >= 0 && index < tasks.size()) {
            tasks.erase(tasks.begin() + index);
            save_tasks_to_file();
            return crow::response(200, "Task deleted.");
        }
        return crow::response(400, "Invalid task index.");
    });

    // ✅ `/<path>` で `script.js` や `style.css` などの静的ファイルを配信
    CROW_ROUTE(app, "/<path>")([](const std::string& path) {
        std::string full_path = "/mnt/c/Users/Furihata Yuto/projects/crow_example/frontend/" + path;
        std::ifstream file(full_path);

        if (!file.is_open()) {
            std::cerr << "File not found: " << full_path << std::endl;
            return crow::response(404, "Not Found");
        }

        std::stringstream buffer;
        buffer << file.rdbuf();
        return crow::response{buffer.str()};
    });

    // ✅ デバッグ用のログレベルを設定
    app.loglevel(crow::LogLevel::Debug);
    app.port(8080).multithreaded().run();
}
