const API_URL = "http://localhost:8080";
let allTasks = []; // すべてのタスクを保持する配列
let currentSortMethod = 'deadline'; // デフォルトの並び替え方法
let todayTasks = []; // 今日のタスクを保持する配列

// ドラッグ中のタスクとその元のリスト
let draggedTask = null;
let sourceListType = null;
let draggedTaskIndex = null;

// カレンダー関連の変数
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth(); // 0-11

// タスク一覧を取得
function fetchTasks() {
    console.log("Fetching tasks from API...");
    
    fetch(`${API_URL}/tasks`)
        .then(response => {
            console.log("Server response status:", response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Fetched tasks data:", JSON.stringify(data, null, 2));  // データをJSONで表示
            
            if (!data || !Array.isArray(data.tasks)) {
                console.error("Invalid data format received from server:", data);
                throw new Error("Invalid data format received from server");
            }
            
            // タスク数を確認
            console.log(`Received ${data.tasks.length} tasks from server`);
            
            allTasks = data.tasks; // すべてのタスクを保存
            
            // タスクの締め切り日フィールドをデバッグ
            allTasks.forEach((task, index) => {
                // 必須フィールドが存在することを確認
                if (!task.name) task.name = `Task ${index}`;
                if (!task.priority) task.priority = "低";
                if (!task.deadline) task.deadline = "";
                if (!task.details) task.details = "";
                if (task.completed === undefined) task.completed = false;
                
                console.log(`Task ${index}: ${task.name}, Priority: ${task.priority}, Deadline: '${task.deadline || ''}'`);
            });
            
            // ローカルストレージから今日のタスクリストを読み込む
            loadTodayTasks();
            
            // タスク表示を更新
            displayTasks();
            
            // カレンダーを更新
            renderCalendar();
        })
        .catch(error => {
            console.error("タスク取得エラー:", error);
            // UIにエラーメッセージを表示
            const pendingTaskList = document.getElementById("pendingTaskList");
            if (pendingTaskList) {
                pendingTaskList.innerHTML = '<div class="error-message">タスクの読み込みに失敗しました。ページを再読み込みしてください。</div>';
            }
        });
}

// 今日のタスクをローカルストレージから読み込む
function loadTodayTasks() {
    const savedTodayTasks = localStorage.getItem('todayTasks');
    if (savedTodayTasks) {
        try {
            todayTasks = JSON.parse(savedTodayTasks);
            
            // 削除されたタスクを今日のタスクリストから除外
            todayTasks = todayTasks.filter(taskId => {
                return allTasks.some(task => task.name === taskId);
            });
            
            // 今日のタスクリストを保存
            saveTodayTasks();
        } catch (e) {
            console.error("今日のタスクの読み込みエラー:", e);
            todayTasks = [];
        }
    } else {
        todayTasks = [];
    }
}

// 今日のタスクをローカルストレージに保存
function saveTodayTasks() {
    localStorage.setItem('todayTasks', JSON.stringify(todayTasks));
}

// タスクを表示する関数（並び替えと完了・未完了の分離）
function displayTasks() {
    // ソート方法に従ってタスクを並び替え
    sortTasksBy(currentSortMethod);
    
    // 完了・未完了タスクに分ける
    const pendingTaskList = document.getElementById("pendingTaskList");
    const completedTaskList = document.getElementById("completedTaskList");
    const todayTaskList = document.getElementById("todayTaskList");
    
    // リストをクリア
    pendingTaskList.innerHTML = "";
    completedTaskList.innerHTML = "";
    todayTaskList.innerHTML = "";
    
    // 未完了タスク、完了タスク、今日のタスクをカウント
    let pendingCount = 0;
    let completedCount = 0;
    let todayCount = 0;
    
    // 今日のタスク一覧を作成
    const todayTaskItems = allTasks.filter(task => 
        !task.completed && todayTasks.includes(task.name)
    );
    
    todayTaskItems.forEach((task, index) => {
        const taskElement = createTaskElement(task, allTasks.findIndex(t => t.name === task.name));
        taskElement.setAttribute('draggable', true);
        taskElement.addEventListener('dragstart', handleDragStart);
        taskElement.addEventListener('dragend', handleDragEnd);
        todayTaskList.appendChild(taskElement);
        todayCount++;
    });
    
    // 未完了タスクと完了タスクを表示（今日のタスクを除く）
    allTasks.forEach((task, index) => {
        if (task.completed) {
            // 完了タスク
            const taskElement = createTaskElement(task, index);
            completedTaskList.appendChild(taskElement);
            completedCount++;
        } else if (!todayTasks.includes(task.name)) {
            // 今日のタスクではない未完了タスク
            const taskElement = createTaskElement(task, index);
            taskElement.setAttribute('draggable', true);
            taskElement.addEventListener('dragstart', handleDragStart);
            taskElement.addEventListener('dragend', handleDragEnd);
            pendingTaskList.appendChild(taskElement);
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
    
    if (todayCount === 0) {
        todayTaskList.innerHTML = '<div class="empty-list-message">今日のタスクはありません</div>';
    }
    
    // ソートボタンのアクティブ状態を更新
    updateSortButtonsState();
    
    // ドラッグ&ドロップのイベントリスナーを設定
    setupDragAndDrop();
}

// タスク要素を作成する関数
function createTaskElement(task, index) {
    const li = document.createElement("li");
    li.dataset.taskIndex = index;
    li.dataset.taskName = task.name;
    
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
            ${!task.completed ? `<button class="complete" onclick="completeTask(${index}, event)"><i class="fas fa-check"></i> 完了</button>` : ''}
            <button class="delete" onclick="deleteTask(${index})"><i class="fas fa-trash"></i> 削除</button>
        </div>
    `;
    
    return li;
}

// ドラッグ&ドロップイベントリスナーの設定
function setupDragAndDrop() {
    const dropZones = document.querySelectorAll('.droppable');
    
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('dragleave', handleDragLeave);
        zone.addEventListener('drop', handleDrop);
    });
}

// ドラッグ開始時の処理
function handleDragStart(e) {
    draggedTask = e.target;
    draggedTask.classList.add('dragging');
    sourceListType = draggedTask.closest('.droppable').dataset.listType;
    draggedTaskIndex = draggedTask.dataset.taskIndex;
    
    // データ転送オブジェクトを設定
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTask.dataset.taskName);
}

// ドラッグ終了時の処理
function handleDragEnd(e) {
    if (draggedTask) {
        draggedTask.classList.remove('dragging');
        draggedTask = null;
    }
    
    // ドロップ対象のハイライトを全て解除
    document.querySelectorAll('.droppable').forEach(dropZone => {
        dropZone.classList.remove('droppable-hover');
    });
}

// ドラッグオーバー時の処理
function handleDragOver(e) {
    e.preventDefault(); // デフォルトのドラッグオーバー動作を抑制
    e.dataTransfer.dropEffect = 'move';
    
    // ドロップ可能な領域をハイライト
    this.classList.add('droppable-hover');
}

// ドラッグリーブ時の処理
function handleDragLeave(e) {
    this.classList.remove('droppable-hover');
}

// ドロップ時の処理
function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('droppable-hover');
    
    const targetListType = this.dataset.listType;
    const taskName = e.dataTransfer.getData('text/plain');
    
    // 同じリストでのドロップは処理しない
    if (sourceListType === targetListType) {
        return;
    }
    
    // 今日のタスクリストに追加または削除
    if (targetListType === 'today' && !todayTasks.includes(taskName)) {
        // 今日のタスクリストに追加
        todayTasks.push(taskName);
        saveTodayTasks();
    } else if (targetListType === 'pending' && todayTasks.includes(taskName)) {
        // 今日のタスクリストから削除
        const index = todayTasks.indexOf(taskName);
        if (index !== -1) {
            todayTasks.splice(index, 1);
            saveTodayTasks();
        }
    }
    
    // 表示を更新
    displayTasks();
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
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.error(`Invalid date: ${dateString}`);
            return 'Invalid date';
        }
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('ja-JP', options);
    } catch (e) {
        console.error(`Error formatting date: ${dateString}`, e);
        return 'Date error';
    }
}

// タスク追加
function addTask() {
    // フォームの値を取得
    const taskName = document.getElementById("taskName").value;
    if (!taskName.trim()) {
        alert("タスク名を入力してください");
        return;
    }
    
    const taskPriority = document.getElementById("taskPriority").value;
    let taskDeadline = document.getElementById("taskDeadline").value;
    let taskDetails = document.getElementById("taskDetails").value;

    // フォームデータをログに出力
    console.log("Add task form data:");
    console.log("- Name:", taskName);
    console.log("- Priority:", taskPriority);
    console.log("- Deadline:", taskDeadline);
    console.log("- Details:", taskDetails);
    
    // undefined または null の場合は空文字列に変換
    taskDeadline = taskDeadline || "";
    taskDetails = taskDetails || "";

    // 送信データを作成
    const taskData = {
        name: taskName,
        priority: taskPriority,
        deadline: taskDeadline,
        details: taskDetails
    };
    
    console.log("Sending task data to API:", JSON.stringify(taskData, null, 2));

    // タスク追加リクエストを送信
    fetch(`${API_URL}/add_task`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(taskData)
    })
    .then(response => {
        console.log("Response status:", response.status);
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Task added successfully:", JSON.stringify(data, null, 2));
        
        // 受信したタスクデータを確認
        if (data.task) {
            console.log("Added task from server:", JSON.stringify(data.task, null, 2));
            
            // 受信したタスクのdeadlineとdetailsをチェック
            if (data.task.deadline !== taskDeadline) {
                console.warn("Warning: deadline mismatch - client:", taskDeadline, "server:", data.task.deadline);
            }
            if (data.task.details !== taskDetails) {
                console.warn("Warning: details mismatch - client:", taskDetails, "server:", data.task.details);
            }
        }
        
        // フォームをクリア
        document.getElementById("taskName").value = "";
        document.getElementById("taskDeadline").value = "";
        document.getElementById("taskDetails").value = "";
        
        // サーバーから最新データを取得して表示を更新
        fetchTasks();
    })
    .catch(error => {
        console.error("Failed to add task:", error);
        alert("タスクの追加に失敗しました。もう一度お試しください。");
    });
}

// 編集モーダルを開く
function openEditModal(index) {
    const task = allTasks[index];
    
    // デバッグログ - タスクデータの詳細を確認
    console.log("Opening edit modal for task:", JSON.stringify(task, null, 2));
    
    // モーダルに現在のタスク情報を設定
    document.getElementById("editTaskIndex").value = index;
    document.getElementById("editTaskName").value = task.name || "";
    document.getElementById("editTaskPriority").value = task.priority || "低";
    
    // 締め切り日の設定
    const deadlineInput = document.getElementById("editTaskDeadline");
    if (task.deadline && task.deadline.trim() !== "") {
        deadlineInput.value = task.deadline;
        console.log("設定した締め切り日:", task.deadline);
    } else {
        deadlineInput.value = "";
        console.log("締め切り日なし");
    }
    
    // 詳細の設定
    const detailsInput = document.getElementById("editTaskDetails");
    if (task.details && task.details.trim() !== "") {
        detailsInput.value = task.details;
        console.log("設定した詳細:", task.details);
    } else {
        detailsInput.value = "";
        console.log("詳細なし");
    }
    
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
    // 編集モーダルから値を取得
    const index = parseInt(document.getElementById("editTaskIndex").value);
    
    // indexが有効な値かチェック
    if (isNaN(index) || index < 0 || index >= allTasks.length) {
        console.error("Invalid task index:", index);
        alert("タスクの更新に失敗しました：無効なタスクインデックス");
        closeEditModal();
        return;
    }
    
    const taskName = document.getElementById("editTaskName").value;
    
    if (!taskName.trim()) {
        alert("タスク名を入力してください");
        return;
    }
    
    const oldTaskName = allTasks[index].name;
    const taskPriority = document.getElementById("editTaskPriority").value;
    let taskDeadline = document.getElementById("editTaskDeadline").value;
    let taskDetails = document.getElementById("editTaskDetails").value;
    
    // フォームデータをログに出力
    console.log("Form data collected:");
    console.log("- Name:", taskName);
    console.log("- Priority:", taskPriority);
    console.log("- Deadline:", taskDeadline);
    console.log("- Details:", taskDetails);
    console.log("- Index:", index);
    
    // undefined または null の場合は空文字列に変換
    taskDeadline = taskDeadline || "";
    taskDetails = taskDetails || "";
    
    // 送信データを作成
    const taskData = {
        name: taskName,
        priority: taskPriority,
        deadline: taskDeadline,
        details: taskDetails,
        completed: allTasks[index].completed
    };
    
    console.log("Sending update data to API:", JSON.stringify(taskData, null, 2));
    
    // 更新リクエストを送信
    fetch(`${API_URL}/update_task/${index}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(taskData)
    })
    .then(response => {
        console.log("Response status:", response.status);
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Task updated successfully:", JSON.stringify(data, null, 2));
        
        // 受信したタスクデータを確認
        if (data.task) {
            console.log("Updated task from server:", JSON.stringify(data.task, null, 2));
            
            // 受信したタスクのdeadlineとdetailsをチェック
            if (data.task.deadline !== taskDeadline) {
                console.warn("Warning: deadline mismatch - client:", taskDeadline, "server:", data.task.deadline);
            }
            if (data.task.details !== taskDetails) {
                console.warn("Warning: details mismatch - client:", taskDetails, "server:", data.task.details);
            }
        }
        
        // タスク名が変更された場合、今日のタスクリストも更新
        if (oldTaskName !== taskName && todayTasks.includes(oldTaskName)) {
            const idx = todayTasks.indexOf(oldTaskName);
            if (idx !== -1) {
                todayTasks[idx] = taskName;
                saveTodayTasks();
            }
        }
        
        // モーダルを閉じる
        closeEditModal();
        
        // サーバーから最新データを取得して表示を更新
        fetchTasks();
    })
    .catch(error => {
        console.error("Failed to update task:", error);
        alert("タスクの更新に失敗しました。もう一度お試しください。");
        
        // エラー発生時もモーダルを閉じる
        closeEditModal();
    });
}

// タスク完了
function completeTask(index, event) {
    const taskName = allTasks[index].name;
    
    fetch(`${API_URL}/complete_task/${index}`)
        .then(() => {
            // 完了したタスクを今日のタスクリストから削除
            if (todayTasks.includes(taskName)) {
                const idx = todayTasks.indexOf(taskName);
                if (idx !== -1) {
                    todayTasks.splice(idx, 1);
                    saveTodayTasks();
                }
            }
            
            // 対象のタスクを完了済みに更新
            allTasks[index].completed = true;
            
            // 画面更新
            if (event && event.target) {
                // 現在のリストアイテムを取得
                const listItem = event.target.closest('li');
                if (listItem) {
                    // 現在のリストから削除
                    listItem.remove();
                    
                    // 完了リストの空メッセージを削除（存在する場合）
                    const completedTaskList = document.getElementById("completedTaskList");
                    const emptyMessage = completedTaskList.querySelector('.empty-list-message');
                    if (emptyMessage) {
                        emptyMessage.remove();
                    }
                    
                    // 完了リストに追加するために元のタスク要素を作成しなおす
                    const completedTask = createTaskElement(allTasks[index], index);
                    completedTaskList.appendChild(completedTask);
                    
                    // 対象リストが空かどうかチェック
                    checkEmptyLists();
                    return;
                }
            }
            
            // イベントがない場合や要素が見つからない場合は全体を再描画
            fetchTasks();
        })
        .catch(error => console.error("タスク完了エラー:", error));
}

// リストが空かどうかをチェックして、必要に応じてメッセージを表示
function checkEmptyLists() {
    const pendingTaskList = document.getElementById("pendingTaskList");
    const completedTaskList = document.getElementById("completedTaskList");
    const todayTaskList = document.getElementById("todayTaskList");
    
    // 今日のタスクが空かチェック
    if (todayTaskList.children.length === 0) {
        todayTaskList.innerHTML = '<div class="empty-list-message">今日のタスクはありません</div>';
    }
    
    // 未完了タスクが空かチェック
    const pendingItems = Array.from(pendingTaskList.children).filter(item => !item.classList.contains('empty-list-message'));
    if (pendingItems.length === 0) {
        pendingTaskList.innerHTML = '<div class="empty-list-message">未完了のタスクはありません</div>';
    }
    
    // 完了タスクが空かどうかをチェック
    const completedItems = Array.from(completedTaskList.children).filter(item => !item.classList.contains('empty-list-message'));
    if (completedItems.length === 0) {
        // 完了タスクが空の場合のみメッセージを表示
        completedTaskList.innerHTML = '<div class="empty-list-message">完了したタスクはありません</div>';
    } else {
        // 完了タスクがある場合は、メッセージ要素があれば削除
        const emptyMessage = completedTaskList.querySelector('.empty-list-message');
        if (emptyMessage) {
            emptyMessage.remove();
        }
    }
}

// タスク削除
function deleteTask(index) {
    const taskName = allTasks[index].name;
    
    if (confirm("このタスクを削除しますか？")) {
        fetch(`${API_URL}/delete_task/${index}`)
            .then(() => {
                // 削除したタスクを今日のタスクリストから削除
                if (todayTasks.includes(taskName)) {
                    const idx = todayTasks.indexOf(taskName);
                    if (idx !== -1) {
                        todayTasks.splice(idx, 1);
                        saveTodayTasks();
                    }
                }
                
                fetchTasks();
            })
            .catch(error => console.error("タスク削除エラー:", error));
    }
}

// 初回ロード時にタスク一覧取得とイベントリスナー設定
document.addEventListener("DOMContentLoaded", function() {
    fetchTasks();
    
    // Enterキーでのタスク追加機能を設定
    setupEnterKeySubmit();
    
    // カレンダー初期化
    initializeCalendar();
});

// Enterキーでのタスク追加機能を設定
function setupEnterKeySubmit() {
    // タスク入力フォームの要素を取得
    const taskName = document.getElementById("taskName");
    const taskPriority = document.getElementById("taskPriority");
    const taskDeadline = document.getElementById("taskDeadline");
    const taskDetails = document.getElementById("taskDetails");
    
    // 各入力フィールドにキーイベントリスナーを追加
    [taskName, taskPriority, taskDeadline, taskDetails].forEach(element => {
        element.addEventListener("keypress", function(event) {
            // Enterキーが押された場合
            if (event.key === "Enter") {
                // 標準のフォーム送信を防止
                event.preventDefault();
                
                // タスク名が入力されている場合のみ追加処理を実行
                if (taskName.value.trim()) {
                    addTask();
                } else {
                    // タスク名が空の場合はタスク名入力欄にフォーカス
                    taskName.focus();
                    // 視覚的なフィードバックとしてアニメーション付与
                    taskName.classList.add("input-error");
                    setTimeout(() => {
                        taskName.classList.remove("input-error");
                    }, 500);
                }
            }
        });
    });
}

// カレンダーの初期化
function initializeCalendar() {
    // 月の移動ボタンのイベントリスナー
    document.getElementById('prevMonth').addEventListener('click', function() {
        navigateMonth(-1);
    });
    
    document.getElementById('nextMonth').addEventListener('click', function() {
        navigateMonth(1);
    });
    
    // カレンダー描画
    renderCalendar();
}

// 月の移動
function navigateMonth(step) {
    currentMonth += step;
    
    // 年の変更処理
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    
    renderCalendar();
}

// カレンダーをレンダリング
function renderCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    const currentMonthElement = document.getElementById('currentMonth');
    
    // 現在の月を表示
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    currentMonthElement.textContent = `${currentYear}年 ${monthNames[currentMonth]}`;
    
    // カレンダー内容をクリア
    calendarDays.innerHTML = '';
    
    // 現在の月の最初の日と最後の日
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // 先月の日を表示
    const firstDayIndex = (firstDay.getDay() + 6) % 7; // 月曜始まりに調整（0が月曜）
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day', 'other-month');
        dayDiv.innerHTML = `<div class="day-number">${prevMonthLastDay - i}</div>`;
        calendarDays.appendChild(dayDiv);
    }
    
    // 今日の日付
    const today = new Date();
    const todayDate = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    
    // 現在月の日を表示
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');
        
        // 曜日の設定（土日の場合はweekendクラスを追加）
        const dayOfWeek = new Date(currentYear, currentMonth, i).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            dayDiv.classList.add('weekend');
        }
        
        // 今日の日付の場合はtodayクラスを追加
        if (i === todayDate && currentMonth === todayMonth && currentYear === todayYear) {
            dayDiv.classList.add('today');
        }
        
        // この日のタスクを探す
        const dateString = formatDateForComparison(new Date(currentYear, currentMonth, i));
        
        // 締め切り日が一致するタスクをフィルタリング
        const dayTasks = allTasks.filter(task => {
            if (!task.deadline || task.deadline.trim() === "") {
                return false;
            }
            
            // 締め切り日の文字列を比較
            return formatDateForComparison(task.deadline) === dateString;
        });
        
        // タスクが見つかった場合のデバッグログ
        if (dayTasks.length > 0) {
            console.log(`${dateString}に${dayTasks.length}件のタスクがあります:`, dayTasks.map(t => t.name));
            dayDiv.classList.add('has-tasks');
            
            // 優先度の高いタスクを見つける
            const highPriorityTasks = dayTasks.filter(task => task.priority === '高');
            const mediumPriorityTasks = dayTasks.filter(task => task.priority === '中');
            const lowPriorityTasks = dayTasks.filter(task => task.priority === '低');
            
            // タスクドットのHTMLを作成
            let taskDotsHTML = '';
            
            if (highPriorityTasks.length > 0) {
                taskDotsHTML += `<span class="task-dot high-priority"></span>`;
            }
            if (mediumPriorityTasks.length > 0) {
                taskDotsHTML += `<span class="task-dot medium-priority"></span>`;
            }
            if (lowPriorityTasks.length > 0) {
                taskDotsHTML += `<span class="task-dot low-priority"></span>`;
            }
            
            dayDiv.innerHTML = `
                <div class="day-number">${i}</div>
                <div class="day-tasks">${taskDotsHTML}</div>
            `;
            
            // クリックイベントの追加
            dayDiv.addEventListener('click', function() {
                showDayTasks(new Date(currentYear, currentMonth, i), dayTasks);
            });
        } else {
            dayDiv.innerHTML = `<div class="day-number">${i}</div>`;
        }
        
        calendarDays.appendChild(dayDiv);
    }
    
    // 翌月の日を表示
    const daysAfterLastDay = 7 - (firstDayIndex + lastDay.getDate()) % 7;
    if (daysAfterLastDay < 7) {
        for (let i = 1; i <= daysAfterLastDay; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('calendar-day', 'other-month');
            dayDiv.innerHTML = `<div class="day-number">${i}</div>`;
            calendarDays.appendChild(dayDiv);
        }
    }
}

// 特定の日付のタスク一覧を表示
function showDayTasks(date, tasks) {
    const modal = document.getElementById('taskDetailsModal');
    const dateTitle = document.getElementById('detailsModalDate');
    const tasksContainer = document.getElementById('detailsModalTasks');
    
    // 日付のフォーマット
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateTitle.textContent = date.toLocaleDateString('ja-JP', options);
    
    // タスク一覧の表示
    tasksContainer.innerHTML = '';
    
    tasks.forEach(task => {
        const priorityClass = getPriorityClass(task.priority);
        const taskElement = document.createElement('div');
        taskElement.classList.add('details-modal-task', priorityClass);
        
        taskElement.innerHTML = `
            <div class="details-modal-task-header">
                <div class="details-modal-task-title">${task.name}</div>
                <div class="details-modal-task-priority tag ${priorityClass}">${task.priority}</div>
            </div>
            <div class="details-modal-task-status">
                ${task.completed ? '<i class="fas fa-check-circle"></i> 完了' : '<i class="far fa-clock"></i> 未完了'}
            </div>
            ${task.details ? `<div class="details-modal-task-details">${task.details}</div>` : ''}
        `;
        
        tasksContainer.appendChild(taskElement);
    });
    
    // モーダルを表示
    modal.style.display = 'block';
    
    // 閉じるボタンのイベントリスナー
    modal.querySelector('.close').onclick = closeTaskDetailsModal;
    
    // モーダル外クリックで閉じる
    window.onclick = function(event) {
        if (event.target == modal) {
            closeTaskDetailsModal();
        }
    };
}

// タスク詳細モーダルを閉じる
function closeTaskDetailsModal() {
    document.getElementById('taskDetailsModal').style.display = 'none';
}

// 日付を比較用にフォーマット（YYYY-MM-DD形式）
function formatDateForComparison(date) {
    if (!date) return null;
    
    // 日付オブジェクトでない場合は変換
    let dateObj;
    if (!(date instanceof Date)) {
        dateObj = new Date(date);
    } else {
        dateObj = date;
    }
    
    if (isNaN(dateObj.getTime())) {
        console.error("Invalid date for comparison:", date);
        return null;
    }
    
    // YYYY-MM-DD形式にフォーマット
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // 月は0始まりなので+1
    const day = String(dateObj.getDate()).padStart(2, '0'); // 日付を2桁に整形
    
    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
}
