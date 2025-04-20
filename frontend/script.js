const API_URL = "http://localhost:8080";

// タスク一覧を取得
function fetchTasks() {
    fetch(`${API_URL}/tasks`)
        .then(response => response.json())
        .then(data => {
            console.log("Fetched tasks:", data);  // デバッグ用
            const taskList = document.getElementById("taskList");
            taskList.innerHTML = "";

            data.tasks.forEach((task, index) => {
                const li = document.createElement("li");
                li.innerHTML = `
                    ${task.name} - 優先度: ${task.priority} - ${task.completed ? "✅完了" : "⏳未完了"}
                    <button class="complete" onclick="completeTask(${index})">完了</button>
                    <button class="delete" onclick="deleteTask(${index})">削除</button>
                `;
                taskList.appendChild(li);
            });
        })
        .catch(error => console.error("タスク取得エラー:", error));
}

// タスク追加
function addTask() {
    const taskName = document.getElementById("taskName").value;
    const taskPriority = document.getElementById("taskPriority").value;

    fetch(`${API_URL}/add_task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: taskName, priority: taskPriority })
    })
    .then(() => {
        fetchTasks();
        document.getElementById("taskName").value = "";
    })
    .catch(error => console.error("タスク追加エラー:", error));
}

// タスク完了
function completeTask(index) {
    fetch(`${API_URL}/complete_task/${index}`)
        .then(() => fetchTasks())
        .catch(error => console.error("タスク完了エラー:", error));
}

// タスク削除
function deleteTask(index) {
    fetch(`${API_URL}/delete_task/${index}`)
        .then(() => fetchTasks())
        .catch(error => console.error("タスク削除エラー:", error));
}

// 初回ロード時にタスク一覧取得
document.addEventListener("DOMContentLoaded", fetchTasks);
