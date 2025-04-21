const API_URL = "http://localhost:8080";
let allTasks = []; // すべてのタスクを保持する配列
let currentSortMethod = 'deadline'; // デフォルトの並び替え方法

// タスク一覧を取得
function fetchTasks() {
    fetch(`${API_URL}/tasks`)
        .then(response => response.json())
        .then(data => {
            console.log("Fetched tasks:", data);  // デバッグ用
            allTasks = data.tasks; // すべてのタスクを保存
            displayTasks();
        })
        .catch(error => console.error("タスク取得エラー:", error));
}

// タスクを表示する関数（並び替えと完了・未完了の分離）
function displayTasks() {
    // ソート方法に従ってタスクを並び替え
    sortTasksBy(currentSortMethod);
    
    // 完了・未完了タスクに分ける
    const pendingTaskList = document.getElementById("pendingTaskList");
    const completedTaskList = document.getElementById("completedTaskList");
    
    // リストをクリア
    pendingTaskList.innerHTML = "";
    completedTaskList.innerHTML = "";
    
    // 未完了タスクと完了タスクをカウント
    let pendingCount = 0;
    let completedCount = 0;
    
    allTasks.forEach((task, index) => {
        const li = document.createElement("li");
        
        // 締切日の表示部分を準備
        let deadlineDisplay = '';
        if (task.deadline) {
            const deadlineDate = new Date(task.deadline);
            const today = new Date();
            const diffTime = deadlineDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // 締切が近い場合のクラス
            const deadlineClass = diffDays <= 2 ? 'deadline-approaching' : '';
            deadlineDisplay = `<div class="deadline ${deadlineClass}">
                <i class="far fa-calendar-alt"></i> ${formatDate(task.deadline)}
                ${diffDays <= 2 ? `(あと${diffDays}日)` : ''}
            </div>`;
        }

        // 優先度に応じたクラスを設定
        const priorityClass = getPriorityClass(task.priority);
        const completedClass = task.completed ? 'completed-task' : '';

        // 詳細表示の準備
        let detailsSection = '';
        if (task.details && task.details.trim()) {
            detailsSection = `
                <div class="details-toggle" onclick="toggleDetails(this, ${index})">
                    <i class="fas fa-chevron-down"></i> 詳細を表示
                </div>
                <div class="task-description" style="display: none;">
                    ${task.details.replace(/\n/g, '<br>')}
                </div>
            `;
        }
        
        li.innerHTML = `
            <div class="task-info">
                <div class="task-title ${completedClass}">${task.name}</div>
                <div class="task-details">
                    <span class="tag ${priorityClass}">
                        ${getPriorityIcon(task.priority)} ${task.priority}
                    </span>
                    ${deadlineDisplay}
                    <span>${task.completed ? '<i class="fas fa-check-circle"></i> 完了' : '<i class="far fa-clock"></i> 未完了'}</span>
                </div>
                ${detailsSection}
            </div>
            <div class="task-actions">
                ${!task.completed ? `<button class="edit" onclick="openEditModal(${index})"><i class="fas fa-edit"></i> 編集</button>` : ''}
                ${!task.completed ? `<button class="complete" onclick="completeTask(${index})"><i class="fas fa-check"></i> 完了</button>` : ''}
                <button class="delete" onclick="deleteTask(${index})"><i class="fas fa-trash"></i> 削除</button>
            </div>
        `;
        
        // 完了状態に応じて適切なリストに追加
        if (task.completed) {
            completedTaskList.appendChild(li);
            completedCount++;
        } else {
            pendingTaskList.appendChild(li);
            pendingCount++;
        }
    });
    
    // タスクがない場合のメッセージを表示
    if (pendingCount === 0) {
        pendingTaskList.innerHTML = '<div class="empty-list-message">未完了のタスクはありません</div>';
    }
    
    if (completedCount === 0) {
        completedTaskList.innerHTML = '<div class="empty-list-message">完了したタスクはありません</div>';
    }
    
    // ソートボタンのアクティブ状態を更新
    updateSortButtonsState();
}

// 詳細表示の切り替え
function toggleDetails(button, index) {
    const descriptionElement = button.nextElementSibling;
    const isHidden = descriptionElement.style.display === 'none';
    
    descriptionElement.style.display = isHidden ? 'block' : 'none';
    button.innerHTML = isHidden 
        ? '<i class="fas fa-chevron-up"></i> 詳細を隠す'
        : '<i class="fas fa-chevron-down"></i> 詳細を表示';
}

// ソートボタンの状態を更新
function updateSortButtonsState() {
    const sortButtons = document.querySelectorAll('.btn-sort');
    sortButtons.forEach(button => {
        button.classList.remove('active');
        const sortMethod = button.getAttribute('onclick').match(/'([^']+)'/)[1];
        if (sortMethod === currentSortMethod) {
            button.classList.add('active');
        }
    });
}

// 並び替え関数
function sortTasks(method) {
    currentSortMethod = method;
    displayTasks();
}

// 指定した方法でタスクを並び替え
function sortTasksBy(method) {
    switch(method) {
        case 'priority':
            // 優先度で並び替え（高、中、低の順）
            allTasks.sort((a, b) => {
                const priorityOrder = { '高': 0, '中': 1, '低': 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
            break;
            
        case 'deadline':
            // 締切日で並び替え（近い順、締切なしは最後）
            allTasks.sort((a, b) => {
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline) - new Date(b.deadline);
            });
            break;
            
        case 'name':
            // 名前で並び替え
            allTasks.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            break;
    }
}

// 優先度に応じたクラスを返す
function getPriorityClass(priority) {
    switch(priority) {
        case '高': return 'priority-high';
        case '中': return 'priority-medium';
        case '低': return 'priority-low';
        default: return 'priority-low';
    }
}

// 優先度に応じたアイコンを返す
function getPriorityIcon(priority) {
    switch(priority) {
        case '高': return '<i class="fas fa-arrow-up"></i>';
        case '中': return '<i class="fas fa-minus"></i>';
        case '低': return '<i class="fas fa-arrow-down"></i>';
        default: return '<i class="fas fa-arrow-down"></i>';
    }
}

// 日付フォーマット
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ja-JP', options);
}

// タスク追加
function addTask() {
    const taskName = document.getElementById("taskName").value;
    if (!taskName.trim()) {
        alert("タスク名を入力してください");
        return;
    }
    
    const taskPriority = document.getElementById("taskPriority").value;
    const taskDeadline = document.getElementById("taskDeadline").value;
    const taskDetails = document.getElementById("taskDetails").value;

    fetch(`${API_URL}/add_task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            name: taskName, 
            priority: taskPriority,
            deadline: taskDeadline || null,
            details: taskDetails || null
        })
    })
    .then(() => {
        fetchTasks();
        document.getElementById("taskName").value = "";
        document.getElementById("taskDeadline").value = "";
        document.getElementById("taskDetails").value = "";
    })
    .catch(error => console.error("タスク追加エラー:", error));
}

// 編集モーダルを開く
function openEditModal(index) {
    const task = allTasks[index];
    
    // モーダルに現在のタスク情報を設定
    document.getElementById("editTaskIndex").value = index;
    document.getElementById("editTaskName").value = task.name;
    document.getElementById("editTaskPriority").value = task.priority;
    document.getElementById("editTaskDeadline").value = task.deadline || '';
    document.getElementById("editTaskDetails").value = task.details || '';
    
    // モーダルを表示
    const modal = document.getElementById("editTaskModal");
    modal.style.display = "block";
    
    // 閉じるボタンのイベントリスナー
    const closeBtn = document.querySelector(".close");
    closeBtn.onclick = closeEditModal;
    
    // モーダル外クリックで閉じる
    window.onclick = function(event) {
        if (event.target == modal) {
            closeEditModal();
        }
    };
}

// 編集モーダルを閉じる
function closeEditModal() {
    document.getElementById("editTaskModal").style.display = "none";
}

// タスク更新
function updateTask() {
    const index = document.getElementById("editTaskIndex").value;
    const taskName = document.getElementById("editTaskName").value;
    
    if (!taskName.trim()) {
        alert("タスク名を入力してください");
        return;
    }
    
    const taskPriority = document.getElementById("editTaskPriority").value;
    const taskDeadline = document.getElementById("editTaskDeadline").value;
    const taskDetails = document.getElementById("editTaskDetails").value;
    
    fetch(`${API_URL}/update_task/${index}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            name: taskName, 
            priority: taskPriority,
            deadline: taskDeadline || null,
            details: taskDetails || null,
            completed: allTasks[index].completed
        })
    })
    .then(() => {
        closeEditModal();
        fetchTasks();
    })
    .catch(error => console.error("タスク更新エラー:", error));
}

// タスク完了
function completeTask(index) {
    fetch(`${API_URL}/complete_task/${index}`)
        .then(() => fetchTasks())
        .catch(error => console.error("タスク完了エラー:", error));
}

// タスク削除
function deleteTask(index) {
    if (confirm("このタスクを削除しますか？")) {
        fetch(`${API_URL}/delete_task/${index}`)
            .then(() => fetchTasks())
            .catch(error => console.error("タスク削除エラー:", error));
    }
}

// 初回ロード時にタスク一覧取得
document.addEventListener("DOMContentLoaded", fetchTasks);
