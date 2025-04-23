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
    std::string deadline;  // 締め切り日フィールド
    std::string details;   // 詳細フィールドを追加
};

std::vector<Task> tasks;

// JSONデータを保存するファイルパス（絶対パスで統一）
std::string tasks_file = "/mnt/c/Users/Furihata Yuto/projects/task_manager/backend/tasks.json";

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
    nlohmann::json j = nlohmann::json::array();
    for (const auto& task : tasks) {
        nlohmann::json task_json = {
            {"name", task.name},
            {"completed", task.completed},
            {"priority", task.priority},
            {"deadline", task.deadline},
            {"details", task.details}
        };
        j.push_back(task_json);
    }
    
    // ファイルを上書きモードで開く
    std::ofstream file(tasks_file, std::ios::trunc);
    if (!file.is_open()) {
        std::cerr << "Error: Failed to open file for writing: " << tasks_file << std::endl;
        return;
    }
    
    // 整形したJSONをファイルに書き込む
    file << j.dump(4);
    file.close();
    
    std::cout << "Tasks saved to " << tasks_file << " (" << j.size() << " tasks)" << std::endl;
    
    // 保存したJSONの内容をデバッグ出力
    std::cout << "Saved JSON content: " << j.dump(2) << std::endl;
}

// タスクを JSON ファイルから読み込む
void load_tasks_from_file() {
    std::ifstream file(tasks_file);
    if (!file.is_open()) {
        std::cerr << "Error: Unable to open file for reading: " << tasks_file << std::endl;
        return;
    }
    
    try {
        std::cout << "Loading tasks from file: " << tasks_file << std::endl;
        
        nlohmann::json json_tasks;
        file >> json_tasks;
        file.close();
        
        if (!json_tasks.is_array()) {
            std::cerr << "Error: JSON file does not contain an array" << std::endl;
            return;
        }
        
        tasks.clear();
        std::cout << "Found " << json_tasks.size() << " tasks in file" << std::endl;
        
        for (const auto& json_task : json_tasks) {
            if (!json_task.is_object()) {
                std::cerr << "Error: Task is not a JSON object" << std::endl;
                continue;
            }
            
            // 必須フィールドの存在確認
            if (!json_task.contains("name") || !json_task.contains("priority")) {
                std::cerr << "Error: Required fields missing in task" << std::endl;
                continue;
            }
            
            // タスクデータを取得
            std::string name = json_task["name"].get<std::string>();
            bool completed = json_task.value("completed", false);
            std::string priority = json_task["priority"].get<std::string>();
            
            // 締め切り日を取得 (存在しない場合は空文字列)
            std::string deadline = "";
            if (json_task.contains("deadline")) {
                if (!json_task["deadline"].is_null()) {
                    deadline = json_task["deadline"].get<std::string>();
                }
            }
            
            // 詳細を取得 (存在しない場合は空文字列)
            std::string details = "";
            if (json_task.contains("details")) {
                if (!json_task["details"].is_null()) {
                    details = json_task["details"].get<std::string>();
                }
            }
            
            // タスクをリストに追加
            Task task = {name, completed, priority, deadline, details};
            tasks.push_back(task);
            
            std::cout << "Loaded task: " << name 
                      << ", priority: " << priority
                      << ", deadline: [" << deadline << "]"
                      << ", details: [" << details << "]"
                      << ", completed: " << (completed ? "true" : "false") 
                      << std::endl;
        }
        
        std::cout << "Successfully loaded " << tasks.size() << " tasks" << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "Error parsing JSON file: " << e.what() << std::endl;
    }
}

int main() {
    crow::SimpleApp app;

    // tasks.json をチェック・作成
    ensure_tasks_file_exists(tasks_file);
    load_tasks_from_file();

    // ✅ `/` で `index.html` を提供
    CROW_ROUTE(app, "/")([]() {
        std::string index_path = "/mnt/c/Users/Furihata Yuto/projects/task_manager/frontend/index.html";
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

        std::cout << "API: GET /tasks - Returning " << tasks.size() << " tasks" << std::endl;

        for (const auto& task : tasks) {
            crow::json::wvalue task_object;
            task_object["name"] = task.name;
            task_object["completed"] = task.completed;
            task_object["priority"] = task.priority;
            task_object["deadline"] = task.deadline;
            task_object["details"] = task.details;
            tasks_list.emplace_back(std::move(task_object));
        }

        response["tasks"] = std::move(tasks_list);
        
        // CORS対応ヘッダー
        crow::response resp(response);
        resp.set_header("Access-Control-Allow-Origin", "*");
        resp.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        resp.set_header("Access-Control-Allow-Headers", "Content-Type");
        
        return resp;
    });

    // ✅ `/add_task` API（タスク追加）
    CROW_ROUTE(app, "/add_task").methods("POST"_method)
    ([](const crow::request& req) {
        auto body = crow::json::load(req.body);
        if (!body) {
            std::cerr << "Error: Invalid JSON in add task request" << std::endl;
            return crow::response(400, "Invalid JSON");
        }

        std::cout << "Adding new task - Request body: " << req.body << std::endl;

        // 必須フィールドのチェック
        if (!body.has("name") || !body.has("priority")) {
            std::cerr << "Error: Required fields missing in request" << std::endl;
            return crow::response(400, "Required fields missing");
        }

        std::string name = body["name"].s();
        std::string priority = body["priority"].s();
        
        // 締め切り日の処理
        std::string deadline = "";
        if (body.has("deadline")) {
            deadline = body["deadline"].s();
            std::cout << "Setting deadline: [" << deadline << "]" << std::endl;
        }

        // 詳細の処理
        std::string details = "";
        if (body.has("details")) {
            details = body["details"].s();
            std::cout << "Setting details: [" << details << "]" << std::endl;
        }

        // 新しいタスクを作成
        Task newTask = {name, false, priority, deadline, details};
        tasks.push_back(newTask);
        
        // タスクをJSONファイルに保存
        save_tasks_to_file();

        // 作成したタスクのインデックスを取得（配列の最後）
        size_t newTaskIndex = tasks.size() - 1;

        // レスポンス作成
        crow::json::wvalue response;
        response["message"] = "Task added successfully";
        response["task_index"] = static_cast<int>(newTaskIndex);
        response["task"] = crow::json::wvalue::object({
            {"name", newTask.name},
            {"priority", newTask.priority},
            {"deadline", newTask.deadline},
            {"details", newTask.details},
            {"completed", newTask.completed}
        });
        
        return crow::response{response};
    });

    // ✅ `/update_task` API（タスク更新）
    CROW_ROUTE(app, "/update_task/<int>").methods("POST"_method)
    ([](const crow::request& req, int index) {
        if (index < 0 || static_cast<size_t>(index) >= tasks.size()) {
            std::cerr << "Error: Invalid task index: " << index << std::endl;
            return crow::response(400, "Invalid task index");
        }

        auto body = crow::json::load(req.body);
        if (!body) {
            std::cerr << "Error: Invalid JSON in update request" << std::endl;
            return crow::response(400, "Invalid JSON");
        }

        std::cout << "Updating task at index: " << index << std::endl;
        std::cout << "Request body: " << req.body << std::endl;

        // 更新前の値をログ出力
        std::cout << "Before update - name: " << tasks[index].name 
                  << ", priority: " << tasks[index].priority 
                  << ", deadline: [" << tasks[index].deadline 
                  << "], details: [" << tasks[index].details << "]" << std::endl;

        // 必須フィールドのチェック
        if (!body.has("name") || !body.has("priority")) {
            std::cerr << "Error: Required fields missing in request" << std::endl;
            return crow::response(400, "Required fields missing");
        }

        // 各フィールドを更新
        tasks[index].name = body["name"].s();
        tasks[index].priority = body["priority"].s();
        
        // 締め切り日の処理 - 必ず更新する
        if (body.has("deadline")) {
            tasks[index].deadline = body["deadline"].s();
        } else {
            tasks[index].deadline = ""; // 空の値をセット
        }
        std::cout << "Updated deadline: [" << tasks[index].deadline << "]" << std::endl;

        // 詳細の処理 - 必ず更新する
        if (body.has("details")) {
            tasks[index].details = body["details"].s();
        } else {
            tasks[index].details = ""; // 空の値をセット
        }
        std::cout << "Updated details: [" << tasks[index].details << "]" << std::endl;

        // 完了状態の更新
        if (body.has("completed")) {
            tasks[index].completed = body["completed"].b();
        }

        // 更新後の値をログ出力
        std::cout << "After update - name: " << tasks[index].name 
                  << ", priority: " << tasks[index].priority 
                  << ", deadline: [" << tasks[index].deadline 
                  << "], details: [" << tasks[index].details << "]" << std::endl;

        // ファイルに保存
        save_tasks_to_file();

        // レスポンス作成
        crow::json::wvalue response;
        response["message"] = "Task updated successfully";
        response["task"] = crow::json::wvalue::object({
            {"name", tasks[index].name},
            {"priority", tasks[index].priority},
            {"deadline", tasks[index].deadline},
            {"details", tasks[index].details},
            {"completed", tasks[index].completed}
        });
        
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
        std::string full_path = "/mnt/c/Users/Furihata Yuto/projects/task_manager/frontend/" + path;
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