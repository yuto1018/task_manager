const API_URL = "http://localhost:8080";
let allTasks = []; // すべてのタスクを保持する配列
let currentSortMethod = 'deadline'; // デフォルトの並び替え方法
let todayTasks = []; // 今日のタスクを保持する配列

// ドラッグ中のタスクとその元のリスト
let draggedTask = null;
let sourceListType = null;
let draggedTaskIndex = null;

// タスク一覧を取得
function fetchTasks() {
    fetch(`${API_URL}/tasks`)
        .then(response => response.json())
        .then(data => {
            console.log("Fetched tasks:", data);  // デバッグ用
            allTasks = data.tasks; // すべてのタスクを保存
            
            // ローカルストレージから今日のタスクリストを読み込む
            loadTodayTasks();
            
            displayTasks();
        })
        .catch(error => console.error("タスク取得エラー:", error));
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
    
    const oldTaskName = allTasks[index].name;
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
        // タスク名が変更された場合、今日のタスクリストも更新
        if (oldTaskName !== taskName && todayTasks.includes(oldTaskName)) {
            const idx = todayTasks.indexOf(oldTaskName);
            if (idx !== -1) {
                todayTasks[idx] = taskName;
                saveTodayTasks();
            }
        }
        
        closeEditModal();
        fetchTasks();
    })
    .catch(error => console.error("タスク更新エラー:", error));
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

// 初回ロード時にタスク一覧取得
document.addEventListener("DOMContentLoaded", fetchTasks);
