// Main application logic
let apiClient;
let currentTasks = new Map();
let selectedTaskId = null;
let statusFilter = '';
let detailRefreshInterval = null;

// クエリパラメータからAPIキーを取得
function getApiKeyFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('apiKey') || params.get('key');
}

// 初期化
async function init() {
    const apiKey = getApiKeyFromQuery();
    
    // APIキーが設定されている場合のみ使用
    if (apiKey) {
        apiClient = new APIClient(window.location.origin, apiKey);
    } else {
        apiClient = new APIClient(window.location.origin);
    }

    // WebSocket接続
    const ws = apiClient.connectWebSocket();
    ws.onmessage = handleWebSocketMessage;

    // イベントリスナー設定
    setupEventListeners();

    // リポジトリ一覧を読み込み
    await loadRepositories();

    // タスク一覧を読み込み
    loadTasks();
    
    // 定期的にタスク一覧を更新（5秒ごと）
    setInterval(loadTasks, 5000);
}

// リポジトリ一覧を読み込み
async function loadRepositories() {
    try {
        const data = await apiClient.getRepositories();
        const select = document.getElementById('repositories');
        
        data.repositories.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo.path;
            option.textContent = repo.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load repositories:', error);
    }
}

// イベントリスナー設定
function setupEventListeners() {
    // タスク作成フォーム
    document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);

    // ステータスフィルター
    document.getElementById('status-filter').addEventListener('change', (e) => {
        statusFilter = e.target.value;
        renderTasks();
    });

    // 更新ボタン
    document.getElementById('refresh-tasks').addEventListener('click', loadTasks);

    // モーダル閉じるボタン
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('task-modal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
}

// タスク送信処理
async function handleTaskSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const timeoutSeconds = parseInt(formData.get('timeout'));
    
    // 選択されたツールを収集
    const allowedTools = [];
    const checkboxes = e.target.querySelectorAll('input[name="allowedTools"]:checked');
    checkboxes.forEach(checkbox => {
        allowedTools.push(checkbox.value);
    });
    
    // カスタムツールを追加
    const customTools = formData.get('customAllowedTools');
    if (customTools) {
        const customToolsArray = customTools.split(',').map(tool => tool.trim()).filter(tool => tool);
        allowedTools.push(...customToolsArray);
    }
    
    const taskData = {
        instruction: formData.get('instruction'),
        context: {},
        options: {
            timeout: timeoutSeconds * 1000, // 秒をミリ秒に変換
        }
    };

    // allowedToolsが選択されている場合のみ追加
    if (allowedTools.length > 0) {
        taskData.options.allowedTools = allowedTools;
    }

    // 選択されたリポジトリを取得
    const selectedRepos = Array.from(document.getElementById('repositories').selectedOptions)
        .map(option => option.value);
    
    // 最初に選択されたリポジトリを作業ディレクトリとして使用
    if (selectedRepos.length > 0) {
        taskData.context.workingDirectory = selectedRepos[0];
        
        // 複数選択された場合は、instructionに追記
        if (selectedRepos.length > 1) {
            taskData.instruction += `\n\n対象リポジトリ:\n${selectedRepos.join('\n')}`;
        }
    }

    try {
        const response = await apiClient.createTask(taskData);
        showSuccess('タスクを作成しました');
        e.target.reset();
        
        // タスクリストに追加
        const taskId = response.taskId || response.id;
        currentTasks.set(taskId, response);
        renderTasks();
        
        // WebSocketでサブスクライブ
        apiClient.subscribeToTask(taskId);
    } catch (error) {
        showError(`タスクの作成に失敗しました: ${error.message}`);
    }
}

// タスク一覧読み込み
async function loadTasks() {
    try {
        const response = await apiClient.getTasks();
        const tasks = response.tasks || response; // APIが { tasks: [...] } または [...] のどちらかに対応
        currentTasks.clear();
        
        if (Array.isArray(tasks)) {
            tasks.forEach(task => {
                currentTasks.set(task.taskId || task.id, task);
                // 実行中のタスクにサブスクライブ
                if (task.status === 'running' || task.status === 'pending') {
                    apiClient.subscribeToTask(task.taskId || task.id);
                }
            });
        }
        
        renderTasks();
    } catch (error) {
        showError(`タスクの読み込みに失敗しました: ${error.message}`);
    }
}

// タスク一覧表示
function renderTasks() {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';

    const filteredTasks = Array.from(currentTasks.values())
        .filter(task => !statusFilter || task.status === statusFilter)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filteredTasks.length === 0) {
        taskList.innerHTML = '<div class="task-item">タスクがありません</div>';
        return;
    }

    filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
    });
}

// タスク要素作成
function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = 'task-item';
    const taskId = task.taskId || task.id;
    div.onclick = () => showTaskDetail(taskId);

    const statusClass = task.status.toLowerCase();
    const createdAt = new Date(task.createdAt).toLocaleString('ja-JP');

    div.innerHTML = `
        <div class="task-header">
            <span class="task-id">${taskId.substring(0, 8)}</span>
            <span class="task-status ${statusClass}">${getStatusText(task.status)}</span>
        </div>
        <div class="task-instruction">${escapeHtml(task.instruction)}</div>
        <div class="task-meta">作成日時: ${createdAt}</div>
    `;

    return div;
}

// タスク詳細表示
async function showTaskDetail(taskId) {
    selectedTaskId = taskId;
    
    // 既存の定期更新を停止
    if (detailRefreshInterval) {
        clearInterval(detailRefreshInterval);
        detailRefreshInterval = null;
    }
    
    try {
        const task = await apiClient.getTask(taskId);
        
        renderTaskDetail(task);
        
        // タスクに logs プロパティがある場合はそれを使用
        if (task.logs && Array.isArray(task.logs) && task.logs.length > 0) {
            renderTaskLogs(task.logs);
        } else if (task.status === 'running') {
            // 実行中でログがまだない場合は、待機メッセージを表示
            const logContainer = document.getElementById('task-logs');
            logContainer.innerHTML = '<div class="log-entry" style="color: #9ca3af;">実行ログを待機中...</div>';
        } else {
            // それ以外の場合は通常のログ処理
            const logs = task.logs || [];
            const logObjects = Array.isArray(logs) 
                ? logs.map((log, index) => ({
                    message: typeof log === 'string' ? log : log.message || log,
                    timestamp: new Date().toISOString()
                }))
                : [];
            renderTaskLogs(logObjects);
        }
        
        document.getElementById('task-modal').classList.remove('hidden');
        
        // 実行中の場合はサブスクライブと定期更新を開始
        if (task.status === 'running' || task.status === 'pending') {
            apiClient.subscribeToTask(taskId);
            
            // 3秒ごとに詳細を更新（WebSocketが不安定な場合のフォールバック）
            detailRefreshInterval = setInterval(async () => {
                if (selectedTaskId === taskId) {
                    try {
                        const updatedTask = await apiClient.getTask(taskId);
                        currentTasks.set(taskId, updatedTask);
                        renderTaskDetail(updatedTask);
                        
                        // タスクが完了したら定期更新を停止
                        if (updatedTask.status !== 'running' && updatedTask.status !== 'pending') {
                            clearInterval(detailRefreshInterval);
                            detailRefreshInterval = null;
                        }
                    } catch (error) {
                        console.error('Failed to refresh task detail:', error);
                    }
                }
            }, 3000);
        }
    } catch (error) {
        showError(`タスク詳細の取得に失敗しました: ${error.message}`);
    }
}

// タスク詳細レンダリング
function renderTaskDetail(task) {
    const detailContainer = document.getElementById('task-detail');
    const taskId = task.taskId || task.id;
    const createdAt = new Date(task.createdAt).toLocaleString('ja-JP');
    const completedAt = task.completedAt ? new Date(task.completedAt).toLocaleString('ja-JP') : '-';
    
    detailContainer.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">ID:</span>
            <span class="detail-value">${taskId}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">ステータス:</span>
            <span class="detail-value">
                <span class="task-status ${task.status.toLowerCase()}">${getStatusText(task.status)}</span>
            </span>
        </div>
        <div class="detail-row">
            <span class="detail-label">実行内容:</span>
            <span class="detail-value">${escapeHtml(task.instruction)}</span>
        </div>
        ${task.workingDirectory ? `
        <div class="detail-row">
            <span class="detail-label">作業ディレクトリ:</span>
            <span class="detail-value">${escapeHtml(task.workingDirectory)}</span>
        </div>
        ` : ''}
        <div class="detail-row">
            <span class="detail-label">作成日時:</span>
            <span class="detail-value">${createdAt}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">完了日時:</span>
            <span class="detail-value">${completedAt}</span>
        </div>
        ${task.allowedTools && task.allowedTools.length > 0 ? `
        <div class="detail-row">
            <span class="detail-label">許可ツール:</span>
            <span class="detail-value">
                <div class="allowed-tools-list">
                    ${task.allowedTools.map(tool => `<span class="allowed-tool-item">${escapeHtml(tool)}</span>`).join('')}
                </div>
            </span>
        </div>
        ` : ''}
        ${task.result ? `
        <div class="detail-row">
            <span class="detail-label">実行結果:</span>
            <span class="detail-value" style="white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px; display: block; margin-top: 5px;">
                ${escapeHtml(typeof task.result === 'string' ? task.result : JSON.stringify(task.result, null, 2))}
            </span>
        </div>
        ` : ''}
        ${task.error ? `
        <div class="detail-row">
            <span class="detail-label">エラー:</span>
            <span class="detail-value" style="color: var(--error-color);">${escapeHtml(task.error.message || task.error)}</span>
        </div>
        ${task.error.phase ? `
        <div class="detail-row">
            <span class="detail-label">タイムアウトフェーズ:</span>
            <span class="detail-value">${escapeHtml(task.error.phase)}</span>
        </div>
        ` : ''}
        ${task.error.elapsed ? `
        <div class="detail-row">
            <span class="detail-label">経過時間:</span>
            <span class="detail-value">${Math.round(task.error.elapsed / 1000)}秒</span>
        </div>
        ` : ''}
        ${task.error.limit ? `
        <div class="detail-row">
            <span class="detail-label">制限時間:</span>
            <span class="detail-value">${Math.round(task.error.limit / 1000)}秒</span>
        </div>
        ` : ''}
        ` : ''}
        ${task.status === 'running' ? `
        <div class="detail-row">
            <button class="btn btn-secondary" onclick="cancelTask('${taskId}')">キャンセル</button>
        </div>
        ` : ''}
    `;
}

// タスクログレンダリング
function renderTaskLogs(logs) {
    const logContainer = document.getElementById('task-logs');
    logContainer.innerHTML = '';
    
    if (!logs || (Array.isArray(logs) && logs.length === 0)) {
        logContainer.innerHTML = '<div class="log-entry">ログがありません</div>';
        return;
    }
    
    // ログが配列でない場合は配列に変換
    const logArray = Array.isArray(logs) ? logs : [logs];
    
    logArray.forEach((log, index) => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        // ログメッセージの取得（文字列またはオブジェクト）
        const message = typeof log === 'string' ? log : (log.message || log.log || JSON.stringify(log));
        
        // タイムスタンプの取得（存在する場合）
        const timestamp = log.timestamp 
            ? new Date(log.timestamp).toLocaleTimeString('ja-JP')
            : new Date().toLocaleTimeString('ja-JP');
        
        logEntry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span>${escapeHtml(message)}</span>
        `;
        
        logContainer.appendChild(logEntry);
    });
    
    // 最下部にスクロール
    logContainer.scrollTop = logContainer.scrollHeight;
}

// タスクキャンセル
async function cancelTask(taskId) {
    if (!confirm('タスクをキャンセルしますか？')) {
        return;
    }
    
    try {
        await apiClient.cancelTask(taskId);
        showSuccess('タスクをキャンセルしました');
        loadTasks();
        closeModal();
    } catch (error) {
        showError(`タスクのキャンセルに失敗しました: ${error.message}`);
    }
}

// WebSocketメッセージ処理
function handleWebSocketMessage(event) {
    const message = JSON.parse(event.data);
    
    // デバッグ用ログ（開発時のみ）
    if (message.type === 'task:log') {
        console.log('WebSocket log received:', message.payload);
    }
    
    switch (message.type) {
        case 'auth:success':
            updateConnectionStatus(true);
            // 認証成功時に保留中のサブスクリプションを処理
            apiClient.onAuthenticated();
            break;
            
        case 'auth:error':
            updateConnectionStatus(false);
            showError('WebSocket認証に失敗しました');
            break;
            
        case 'task:update':
            handleTaskUpdate(message.payload);
            break;
            
        case 'task:log':
            handleTaskLog(message.payload);
            break;
            
        case 'heartbeat':
            // ハートビート応答
            if (apiClient.ws && apiClient.ws.readyState === WebSocket.OPEN) {
                apiClient.ws.send(JSON.stringify({ type: 'heartbeat' }));
            }
            break;
    }
}

// タスク更新処理
async function handleTaskUpdate(payload) {
    const taskId = payload.taskId;
    
    console.log('Task update received:', payload);
    
    // 詳細モーダルが開いている場合は、常に最新の情報を取得
    if (selectedTaskId === taskId) {
        try {
            const updatedTask = await apiClient.getTask(taskId);
            currentTasks.set(taskId, updatedTask);
            
            // 詳細を再描画
            renderTaskDetail(updatedTask);
            
            // ログも更新
            if (updatedTask.logs && Array.isArray(updatedTask.logs)) {
                renderTaskLogs(updatedTask.logs);
            } else {
                const logs = updatedTask.logs || [];
                const logObjects = Array.isArray(logs) 
                    ? logs.map((log, index) => ({
                        message: typeof log === 'string' ? log : log.message || log,
                        timestamp: new Date().toISOString()
                    }))
                    : [];
                renderTaskLogs(logObjects);
            }
            
            // タスクが完了または失敗した場合は通知
            if (payload.status === 'completed' || payload.status === 'failed') {
                showSuccess(`タスクが${payload.status === 'completed' ? '完了' : '失敗'}しました`);
            }
        } catch (error) {
            console.error('Failed to fetch updated task:', error);
            // エラーが発生してもローカル更新は試みる
            updateLocalTaskData(taskId, payload);
        }
    } else {
        // 詳細モーダルが開いていない場合は、ローカルデータのみ更新
        updateLocalTaskData(taskId, payload);
        
        // タスクが完了または失敗した場合は、詳細を再取得して最新状態を保持
        if (payload.status === 'completed' || payload.status === 'failed') {
            try {
                const updatedTask = await apiClient.getTask(taskId);
                currentTasks.set(taskId, updatedTask);
                showSuccess(`タスクが${payload.status === 'completed' ? '完了' : '失敗'}しました`);
            } catch (error) {
                console.error('Failed to fetch updated task:', error);
            }
        }
    }
    
    // タスク一覧を再描画
    renderTasks();
}

// ローカルタスクデータの更新
function updateLocalTaskData(taskId, payload) {
    const task = currentTasks.get(taskId);
    if (task) {
        task.status = payload.status;
        if (payload.metadata?.error) {
            task.error = payload.metadata.error;
        }
        if (payload.metadata?.completedAt) {
            task.completedAt = payload.metadata.completedAt;
        }
        if (payload.metadata?.result) {
            task.result = payload.metadata.result;
        }
    }
}

// タスクログ処理
function handleTaskLog(payload) {
    if (selectedTaskId === payload.taskId) {
        const logContainer = document.getElementById('task-logs');
        
        // 初回のログ受信時に「ログがありません」を削除
        const noLogMessage = logContainer.querySelector('.log-entry');
        if (noLogMessage && noLogMessage.textContent === 'ログがありません') {
            logContainer.innerHTML = '';
        }
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const timestamp = new Date(payload.timestamp).toLocaleTimeString('ja-JP');
        const logMessage = payload.log || '';
        
        // 進捗メッセージにスタイルを適用
        let styledMessage = escapeHtml(logMessage);
        if (logMessage.startsWith('[') && logMessage.includes(']')) {
            // [Tag] 形式のメッセージを強調表示
            styledMessage = logMessage.replace(/^\[([^\]]+)\](.*)$/, (match, tag, rest) => {
                const tagClass = tag.includes('✓') ? 'log-tag-success' : 
                                tag.includes('✗') ? 'log-tag-error' : 
                                'log-tag';
                return `<span class="${tagClass}">[${escapeHtml(tag)}]</span>${escapeHtml(rest)}`;
            });
        }
        
        logEntry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span>${styledMessage}</span>
        `;
        
        logContainer.appendChild(logEntry);
        
        // スムーズなスクロール
        requestAnimationFrame(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
        });
    }
}

// 接続ステータス更新
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (connected) {
        statusElement.className = 'status connected';
        statusElement.querySelector('.status-text').textContent = '接続中';
    } else {
        statusElement.className = 'status disconnected';
        statusElement.querySelector('.status-text').textContent = '未接続';
    }
}

// モーダルを閉じる
function closeModal() {
    document.getElementById('task-modal').classList.add('hidden');
    
    // 定期更新を停止
    if (detailRefreshInterval) {
        clearInterval(detailRefreshInterval);
        detailRefreshInterval = null;
    }
    
    if (selectedTaskId) {
        apiClient.unsubscribeFromTask(selectedTaskId);
        selectedTaskId = null;
    }
}

// ステータステキスト取得
function getStatusText(status) {
    const statusMap = {
        'pending': '待機中',
        'running': '実行中',
        'completed': '完了',
        'failed': '失敗',
        'cancelled': 'キャンセル'
    };
    return statusMap[status] || status;
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// メッセージ表示
function showMessage(message, type) {
    const existingMessage = document.querySelector(`.${type}-message`);
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `${type}-message`;
    messageElement.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(messageElement, container.firstChild);
    
    setTimeout(() => {
        messageElement.remove();
    }, 5000);
}

function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

// 起動
document.addEventListener('DOMContentLoaded', init);