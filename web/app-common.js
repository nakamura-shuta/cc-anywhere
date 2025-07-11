// 共通ユーティリティ関数と基本的なタスク管理機能
// app.js と app-simple.js で共有される関数

// ページネーション状態管理
const pagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
    totalPages: 0
};

// タスク一覧読み込み（ページネーション対応）
async function loadTasks(page = null) {
    try {
        // ページ指定がある場合は更新
        if (page !== null) {
            pagination.currentPage = page;
        }
        
        const offset = (pagination.currentPage - 1) * pagination.itemsPerPage;
        const response = await apiClient.getTasks(statusFilter, pagination.itemsPerPage, offset);
        
        // ページネーション情報を更新
        pagination.totalItems = response.total || 0;
        pagination.totalPages = Math.ceil(pagination.totalItems / pagination.itemsPerPage);
        
        const tasks = response.tasks || response;
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
        renderPagination();
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
        const emptyMessage = statusFilter 
            ? `「${getStatusText(statusFilter)}」のタスクはありません` 
            : 'タスクがありません';
        taskList.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
        return;
    }

    filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
    });
}

// ページネーションUIをレンダリング
function renderPagination() {
    const paginationTop = document.getElementById('pagination-top');
    const paginationBottom = document.getElementById('pagination-bottom');
    
    if (!paginationTop && !paginationBottom) return;
    
    // ページネーションが不要な場合（1ページ以下）
    if (pagination.totalPages <= 1) {
        if (paginationTop) paginationTop.innerHTML = '';
        if (paginationBottom) paginationBottom.innerHTML = '';
        return;
    }
    
    const startItem = (pagination.currentPage - 1) * pagination.itemsPerPage + 1;
    const endItem = Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems);
    
    // 上部のページネーション（表示件数情報と選択ボックス付き）
    const paginationTopHTML = `
        <div class="pagination-container">
            <div class="pagination-info">
                <span class="item-count">${startItem}-${endItem} / 全${pagination.totalItems}件</span>
                <select class="items-per-page" id="items-per-page">
                    <option value="10" ${pagination.itemsPerPage === 10 ? 'selected' : ''}>10件</option>
                    <option value="20" ${pagination.itemsPerPage === 20 ? 'selected' : ''}>20件</option>
                    <option value="50" ${pagination.itemsPerPage === 50 ? 'selected' : ''}>50件</option>
                    <option value="100" ${pagination.itemsPerPage === 100 ? 'selected' : ''}>100件</option>
                </select>
            </div>
            
            <nav class="pagination-controls" aria-label="ページネーション">
                <button 
                    class="pagination-btn prev-page" 
                    ${pagination.currentPage === 1 ? 'disabled' : ''}
                    onclick="changePage(${pagination.currentPage - 1})"
                    aria-label="前のページ"
                >
                    前へ
                </button>
                
                <div class="page-numbers">
                    ${generatePageNumbers()}
                </div>
                
                <button 
                    class="pagination-btn next-page" 
                    ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}
                    onclick="changePage(${pagination.currentPage + 1})"
                    aria-label="次のページ"
                >
                    次へ
                </button>
            </nav>
        </div>
    `;
    
    // 下部のページネーション（ナビゲーションのみ）
    const paginationBottomHTML = `
        <div class="pagination-container pagination-bottom">
            <nav class="pagination-controls" aria-label="ページネーション">
                <button 
                    class="pagination-btn prev-page" 
                    ${pagination.currentPage === 1 ? 'disabled' : ''}
                    onclick="changePage(${pagination.currentPage - 1})"
                    aria-label="前のページ"
                >
                    前へ
                </button>
                
                <div class="page-numbers">
                    ${generatePageNumbers()}
                </div>
                
                <button 
                    class="pagination-btn next-page" 
                    ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}
                    onclick="changePage(${pagination.currentPage + 1})"
                    aria-label="次のページ"
                >
                    次へ
                </button>
            </nav>
        </div>
    `;
    
    if (paginationTop) paginationTop.innerHTML = paginationTopHTML;
    if (paginationBottom) paginationBottom.innerHTML = paginationBottomHTML;
    
    // 表示件数変更イベントを設定（上部のみ）
    const itemsPerPageSelect = document.getElementById('items-per-page');
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            pagination.itemsPerPage = parseInt(e.target.value);
            pagination.currentPage = 1; // 1ページ目にリセット
            loadTasks(1);
        });
    }
}

// ページ番号ボタンを生成
function generatePageNumbers() {
    const pages = [];
    const maxVisible = 7;
    
    if (pagination.totalPages <= maxVisible) {
        // 全ページを表示
        for (let i = 1; i <= pagination.totalPages; i++) {
            pages.push(createPageButton(i));
        }
    } else {
        // 省略記号を使用
        if (pagination.currentPage <= 3) {
            // 先頭付近
            for (let i = 1; i <= 5; i++) pages.push(createPageButton(i));
            pages.push('<span class="page-ellipsis">...</span>');
            pages.push(createPageButton(pagination.totalPages));
        } else if (pagination.currentPage >= pagination.totalPages - 2) {
            // 末尾付近
            pages.push(createPageButton(1));
            pages.push('<span class="page-ellipsis">...</span>');
            for (let i = pagination.totalPages - 4; i <= pagination.totalPages; i++) {
                pages.push(createPageButton(i));
            }
        } else {
            // 中間
            pages.push(createPageButton(1));
            pages.push('<span class="page-ellipsis">...</span>');
            for (let i = pagination.currentPage - 1; i <= pagination.currentPage + 1; i++) {
                pages.push(createPageButton(i));
            }
            pages.push('<span class="page-ellipsis">...</span>');
            pages.push(createPageButton(pagination.totalPages));
        }
    }
    
    return pages.join('');
}

// ページ番号ボタンを作成
function createPageButton(page) {
    const isActive = page === pagination.currentPage;
    return `
        <button 
            class="pagination-btn page-number ${isActive ? 'active' : ''}"
            onclick="changePage(${page})"
            ${isActive ? 'aria-current="page"' : ''}
            aria-label="ページ ${page}"
        >
            ${page}
        </button>
    `;
}

// ページ変更処理
function changePage(page) {
    if (page < 1 || page > pagination.totalPages) return;
    loadTasks(page);
}

// 作業ディレクトリからリポジトリ名を抽出
function extractRepoName(workingDirectory) {
    if (!workingDirectory) return 'デフォルト';
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
    
    // instructionを40文字で省略
    const truncatedInstruction = task.instruction.length > 40 
        ? task.instruction.substring(0, 40) + '...' 
        : task.instruction;

    div.innerHTML = `
        <div class="task-header">
            <div class="task-id-section">
                <span class="task-id" title="${taskId}">ID: ${taskId.substring(0, 8)}</span>
                <span class="task-repository">📁 ${escapeHtml(repoName)}</span>
            </div>
            <span class="task-status ${statusClass}">${getStatusText(task.status)}</span>
        </div>
        <div class="task-instruction" title="${escapeHtml(task.instruction)}">${escapeHtml(truncatedInstruction)}</div>
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
            
            // 3秒ごとに詳細を更新
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
    
    // SDKオプションの表示を追加
    let sdkOptionsHtml = '';
    if (task.options && task.options.sdk) {
        const sdk = task.options.sdk;
        sdkOptionsHtml = `
        <div class="detail-row">
            <span class="detail-label">SDKオプション:</span>
            <span class="detail-value">
                ${sdk.maxTurns ? `<br>最大ターン数: ${sdk.maxTurns}` : ''}
                ${sdk.permissionMode ? `<br>権限モード: ${sdk.permissionMode}` : ''}
                ${sdk.outputFormat ? `<br>出力形式: ${sdk.outputFormat}` : ''}
                ${sdk.systemPrompt ? `<br>システムプロンプト: ${escapeHtml(sdk.systemPrompt.substring(0, 50))}...` : ''}
            </span>
        </div>
        `;
    }
    
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
        ${sdkOptionsHtml}
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
        ` : ''}
        ${task.status === 'running' ? `
        <div class="detail-row">
            <button class="btn btn-secondary" onclick="cancelTask('${taskId}')">キャンセル</button>
        </div>
        ` : ''}
    `;
}

// タスクのログを表示
function displayTaskLogs(task) {
    let logsToRender = [];
    
    // まずresult内のlogsを確認
    if (task.result && task.result.logs && Array.isArray(task.result.logs)) {
        logsToRender = task.result.logs;
    } 
    // 次にtask.logsを確認
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
    // それ以外
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
    
    const logArray = Array.isArray(logs) ? logs : [logs];
    
    logArray.forEach((log) => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const message = typeof log === 'string' ? log : (log.message || log.log || JSON.stringify(log));
        const timestamp = log.timestamp 
            ? new Date(log.timestamp).toLocaleTimeString('ja-JP')
            : new Date().toLocaleTimeString('ja-JP');
        
        logEntry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span>${escapeHtml(message)}</span>
        `;
        
        logContainer.appendChild(logEntry);
    });
    
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
    
    switch (message.type) {
        case 'auth:success':
            updateConnectionStatus(true);
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
            if (apiClient.ws && apiClient.ws.readyState === WebSocket.OPEN) {
                apiClient.ws.send(JSON.stringify({ type: 'heartbeat' }));
            }
            break;
    }
}

// タスク更新処理
async function handleTaskUpdate(payload) {
    const taskId = payload.taskId;
    
    if (selectedTaskId === taskId) {
        try {
            const updatedTask = await apiClient.getTask(taskId);
            currentTasks.set(taskId, updatedTask);
            
            renderTaskDetail(updatedTask);
            displayTaskLogs(updatedTask);
            
            if (payload.status === 'completed' || payload.status === 'failed') {
                showSuccess(`タスクが${payload.status === 'completed' ? '完了' : '失敗'}しました`);
            }
        } catch (error) {
            console.error('Failed to fetch updated task:', error);
            updateLocalTaskData(taskId, payload);
        }
    } else {
        updateLocalTaskData(taskId, payload);
        
        if (payload.status === 'completed' || payload.status === 'failed') {
            try {
                const oldTask = currentTasks.get(taskId);
                const oldWorkingDirectory = oldTask?.workingDirectory;
                const updatedTask = await apiClient.getTask(taskId);
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
    
    renderTasks();
}

// ローカルタスクデータの更新
function updateLocalTaskData(taskId, payload) {
    const task = currentTasks.get(taskId);
    if (task) {
        const oldWorkingDirectory = task.workingDirectory;
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
        if (payload.metadata?.workingDirectory) {
            task.workingDirectory = payload.metadata.workingDirectory;
        } else if (!task.workingDirectory && oldWorkingDirectory) {
            task.workingDirectory = oldWorkingDirectory;
        }
    }
}

// タスクログ処理
function handleTaskLog(payload) {
    if (selectedTaskId === payload.taskId) {
        const logContainer = document.getElementById('task-logs');
        
        const noLogMessage = logContainer.querySelector('.log-entry');
        if (noLogMessage && (noLogMessage.textContent === 'ログがありません' || noLogMessage.textContent === '実行ログを待機中...')) {
            logContainer.innerHTML = '';
        }
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const timestamp = new Date(payload.timestamp).toLocaleTimeString('ja-JP');
        const logMessage = payload.log || '';
        
        let styledMessage = escapeHtml(logMessage);
        if (logMessage.startsWith('[') && logMessage.includes(']')) {
            styledMessage = logMessage.replace(/^\[([^\]]+)\](.*)$/, (_, tag, rest) => {
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

// エラー表示
function showError(message) {
    console.error(message);
    showNotification(message, 'error');
}

// 成功メッセージ表示
function showSuccess(message) {
    showNotification(message, 'success');
}

// 汎用通知表示（既存のshowNotificationと統合）
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}