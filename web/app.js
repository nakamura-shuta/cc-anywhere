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
    
    // Worktreeオプションの表示/非表示
    document.getElementById('use-worktree').addEventListener('change', (e) => {
        const worktreeOptions = document.getElementById('worktree-options');
        worktreeOptions.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // モバイルでのタスクIDコピー機能
    if ('ontouchstart' in window) {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('task-id')) {
                // タスクIDをクリップボードにコピー
                const taskId = e.target.textContent;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(taskId).then(() => {
                        // 簡易的なフィードバック
                        const originalText = e.target.textContent;
                        e.target.textContent = 'コピー済み!';
                        setTimeout(() => {
                            e.target.textContent = originalText;
                        }, 1000);
                    });
                }
            }
        });
    }
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

    // Worktreeオプションの追加
    if (formData.get('useWorktree')) {
        taskData.options.useWorktree = true;
        
        const branchName = formData.get('worktreeBranch');
        const keepWorktree = formData.get('keepWorktree');
        
        if (branchName || keepWorktree) {
            taskData.options.worktree = {
                enabled: true,
                branchName: branchName || undefined,
                keepAfterCompletion: !!keepWorktree
            };
        }
    }

    // 選択されたリポジトリを取得
    const selectedRepos = Array.from(document.getElementById('repositories').selectedOptions)
        .map(option => ({ name: option.text, path: option.value }));
    
    try {
        let response;
        
        if (selectedRepos.length > 1) {
            // 複数リポジトリの場合はバッチタスクを作成
            const batchData = {
                instruction: formData.get('instruction'),
                repositories: selectedRepos,
                options: {
                    timeout: timeoutSeconds * 1000,
                    allowedTools: allowedTools.length > 0 ? allowedTools : undefined
                }
            };
            
            // バッチタスクにもWorktreeオプションを追加
            if (formData.get('useWorktree')) {
                batchData.options.useWorktree = true;
                
                const branchName = formData.get('worktreeBranch');
                const keepWorktree = formData.get('keepWorktree');
                
                if (branchName || keepWorktree) {
                    batchData.options.worktree = {
                        enabled: true,
                        branchName: branchName || undefined,
                        keepAfterCompletion: !!keepWorktree
                    };
                }
            }
            
            response = await apiClient.createBatchTasks(batchData);
            showSuccess(`${selectedRepos.length}件のバッチタスクを作成しました`);
            
            // バッチで作成されたタスクをリストに追加
            if (response.tasks) {
                response.tasks.forEach(task => {
                    apiClient.subscribeToTask(task.taskId);
                });
            }
        } else if (selectedRepos.length === 1) {
            // 単一リポジトリの場合は通常のタスクを作成
            taskData.context.workingDirectory = selectedRepos[0].path;
            response = await apiClient.createTask(taskData);
            showSuccess('タスクを作成しました');
            
            const taskId = response.taskId || response.id;
            // workingDirectoryを保持
            if (!response.workingDirectory && taskData.context.workingDirectory) {
                response.workingDirectory = taskData.context.workingDirectory;
            }
            console.log('[DEBUG] Task created - response:', response);
            console.log('[DEBUG] Task workingDirectory:', response.workingDirectory);
            currentTasks.set(taskId, response);
            apiClient.subscribeToTask(taskId);
        } else {
            showError('リポジトリを選択してください');
            return;
        }
        
        e.target.reset();
        renderTasks();
        
        // タスク一覧を再読み込み
        setTimeout(loadTasks, 1000);
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

// 作業ディレクトリからリポジトリ名を抽出
function extractRepoName(workingDirectory) {
    if (!workingDirectory) return 'デフォルト';
    // パスの最後の部分を取得
    const parts = workingDirectory.split('/');
    return parts[parts.length - 1] || 'デフォルト';
}

// タスク要素作成
function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = 'task-item';
    const taskId = task.taskId || task.id;
    div.onclick = () => showTaskDetail(taskId);

    const statusClass = task.status.toLowerCase();
    const createdAt = new Date(task.createdAt).toLocaleString('ja-JP');
    
    // workingDirectoryからリポジトリ名を抽出
    const repoName = extractRepoName(task.workingDirectory);

    div.innerHTML = `
        <div class="task-header">
            <div class="task-id-section">
                <span class="task-id" title="${taskId}">ID: ${taskId.substring(0, 8)}</span>
                <span class="task-repository">📁 ${escapeHtml(repoName)}</span>
            </div>
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
        displayTaskLogs(task);
        
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
                        displayTaskLogs(updatedTask);
                        
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
        ${task.useWorktree || (task.options && task.options.useWorktree) ? `
        <div class="detail-row">
            <span class="detail-label">Git Worktree:</span>
            <span class="detail-value">
                <span style="color: #10b981;">✓ 有効</span>
                ${task.options && task.options.worktree && task.options.worktree.branchName ? 
                    `<br>ブランチ: ${escapeHtml(task.options.worktree.branchName)}` : ''}
                ${task.options && task.options.worktree && task.options.worktree.keepAfterCompletion ? 
                    `<br>タスク完了後も保持` : ''}
            </span>
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

// タスクのログを表示する（タスクオブジェクトから適切なログを取得）
function displayTaskLogs(task) {
    let logsToRender = [];
    
    // まずresult内のlogsを確認（完了したタスクの標準的な場所）
    if (task.result && task.result.logs && Array.isArray(task.result.logs)) {
        logsToRender = task.result.logs;
    } 
    // 次にtask.logsを確認（実行中のタスクやレガシーな場合）
    else if (task.logs && Array.isArray(task.logs)) {
        logsToRender = task.logs;
    }
    
    // ログがある場合は表示
    if (logsToRender.length > 0) {
        renderTaskLogs(logsToRender);
    } 
    // 実行中でログがまだない場合
    else if (task.status === 'running') {
        const logContainer = document.getElementById('task-logs');
        logContainer.innerHTML = '<div class="log-entry" style="color: #9ca3af;">実行ログを待機中...</div>';
    } 
    // それ以外（ログがない場合）
    else {
        const logContainer = document.getElementById('task-logs');
        logContainer.innerHTML = '<div class="log-entry">ログがありません</div>';
    }
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
    
    
    // 詳細モーダルが開いている場合は、常に最新の情報を取得
    if (selectedTaskId === taskId) {
        try {
            const updatedTask = await apiClient.getTask(taskId);
            currentTasks.set(taskId, updatedTask);
            
            // 詳細を再描画
            renderTaskDetail(updatedTask);
            displayTaskLogs(updatedTask);
            
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
                const oldTask = currentTasks.get(taskId);
                const oldWorkingDirectory = oldTask?.workingDirectory;
                const updatedTask = await apiClient.getTask(taskId);
                // workingDirectoryを保持
                if (!updatedTask.workingDirectory && oldWorkingDirectory) {
                    updatedTask.workingDirectory = oldWorkingDirectory;
                }
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
        const oldWorkingDirectory = task.workingDirectory; // workingDirectoryを保持
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
        // WebSocketメッセージからworkingDirectoryを取得、またはoldを保持
        if (payload.metadata?.workingDirectory) {
            task.workingDirectory = payload.metadata.workingDirectory;
        } else if (!task.workingDirectory && oldWorkingDirectory) {
            task.workingDirectory = oldWorkingDirectory;
        } else {
        }
    }
}

// タスクログ処理
function handleTaskLog(payload) {
    if (selectedTaskId === payload.taskId) {
        const logContainer = document.getElementById('task-logs');
        
        // 初回のログ受信時に「ログがありません」または「実行ログを待機中...」を削除
        const noLogMessage = logContainer.querySelector('.log-entry');
        if (noLogMessage && (noLogMessage.textContent === 'ログがありません' || noLogMessage.textContent === '実行ログを待機中...')) {
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