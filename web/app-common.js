// 共通ユーティリティ関数と基本的なタスク管理機能
// app.js と app-simple.js で共有される関数

// HTMLエスケープ関数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ページネーション状態管理
const pagination = {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
    totalPages: 0
};

// ストリーミング表示用の状態管理
let toolTimings = new Map(); // ツール実行時間の追跡
let taskStatistics = new Map(); // タスクの統計情報
let taskStreamingLogs = new Map(); // タスクごとのストリーミングログを保存

// ツールアイコンマッピング
const toolIcons = {
    'Read': '📖',
    'Write': '✏️',
    'Edit': '📝',
    'Bash': '💻',
    'Search': '🔍',
    'List': '📁',
    'TodoWrite': '✅',
    'WebSearch': '🌐',
    'WebFetch': '🌐',
    'NotebookRead': '📓',
    'NotebookEdit': '📓',
    'Grep': '🔎',
    'Glob': '🔎',
    'LS': '📁',
    'MultiEdit': '📝',
    'Task': '🎯'
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

// 作業ディレクトリからリポジトリ名を抽出はutils.jsから使用

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

    // 継続タスクの場合のバッジ
    const continuationBadge = task.continuedFrom ? 
        `<span class="continuation-badge" title="親タスク: ${task.continuedFrom}">🔗 継続</span>` : '';

    div.innerHTML = `
        <div class="task-header">
            <div class="task-id-section">
                <span class="task-id" title="${taskId}">ID: ${taskId.substring(0, 8)}</span>
                ${continuationBadge}
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
    
    // 前のタスクの情報をクリア
    // 統計情報をクリア・非表示
    const statsContainer = document.getElementById('task-statistics');
    if (statsContainer) {
        statsContainer.innerHTML = '';
        statsContainer.classList.add('hidden');
    }
    
    // TODOリストコンテナをクリア
    const todosContainer = document.getElementById('task-todos');
    if (todosContainer) {
        todosContainer.innerHTML = '';
        todosContainer.classList.add('hidden');
    }
    
    // ログコンテナをクリア（新しいタスクのログを表示するため）
    const logContainer = document.getElementById('task-logs');
    if (logContainer) {
        logContainer.innerHTML = '';
    }
    
    // WebSocketサブスクリプションのみで更新（ポーリングは不要）
    
    try {
        // 現在のTODOデータを保存
        const currentTask = currentTasks.get(taskId);
        const currentTodos = currentTask?.todos;
        
        const task = await apiClient.getTask(taskId);
        
        // APIから取得したデータにTODOが含まれていない場合、現在のTODOを保持
        if (!task.todos && currentTodos) {
            task.todos = currentTodos;
        }
        
        // 最新データでcurrentTasksを更新
        currentTasks.set(taskId, task);
        
        renderTaskDetail(task);
        displayTaskLogs(task);
        
        document.getElementById('task-modal').classList.remove('hidden');
        
        // 実行中の場合はサブスクライブのみ（WebSocketで更新を受信）
        if (task.status === 'running' || task.status === 'pending') {
            apiClient.subscribeToTask(taskId);
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
    
    // 継続タスク情報の表示を追加
    let continuationHtml = '';
    if (task.continuedFrom) {
        continuationHtml = `
        <div class="detail-row">
            <span class="detail-label">親タスク:</span>
            <span class="detail-value">
                <a href="#" onclick="showTaskDetail('${task.continuedFrom}'); return false;" class="text-blue-600 hover:underline">
                    ${task.continuedFrom}
                </a>
            </span>
        </div>
        `;
    }
    
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
    
    // TODOリストのHTMLを生成（タスク詳細の最上部に表示）
    let todosHtml = '';
    if (task.todos && task.todos.length > 0) {
        todosHtml = `
            <div class="todo-section" style="background: #f0f9ff; border: 1px solid #0284c7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; color: #0369a1;">📋 実行計画 (${task.todos.length}件)</h3>
                <div class="todo-list">
                    ${task.todos.map(todo => `
                        <div class="todo-item ${todo.status}" style="display: flex; align-items: center; padding: 8px; margin: 4px 0; background: white; border-radius: 4px; gap: 8px;">
                            <span class="todo-status-icon" style="font-size: 18px;">
                                ${todo.status === 'completed' ? '✅' : 
                                  todo.status === 'in_progress' ? '⏳' : '⭕'}
                            </span>
                            <span class="todo-content" style="flex: 1; ${todo.status === 'completed' ? 'text-decoration: line-through; color: #888;' : ''}">${escapeHtml(todo.content)}</span>
                            <span class="todo-priority priority-${todo.priority}" style="padding: 2px 8px; border-radius: 12px; font-size: 12px; background: ${todo.priority === 'high' ? '#fee2e2' : todo.priority === 'medium' ? '#fef3c7' : '#e5e7eb'}; color: ${todo.priority === 'high' ? '#dc2626' : todo.priority === 'medium' ? '#d97706' : '#6b7280'};">${todo.priority}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // task-todosコンテナは使用しない（TODOは上部に統合表示）
    const todosContainer = document.getElementById('task-todos');
    if (todosContainer) {
        todosContainer.style.display = 'none';
    }
    
    detailContainer.innerHTML = `
        ${todosHtml}
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
        ${continuationHtml}
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
            <div class="detail-value result-container">
                ${(() => {
                    // task.resultがオブジェクトで、resultフィールドを持つ場合
                    if (typeof task.result === 'object' && task.result.result) {
                        const resultData = task.result;
                        // 結果の内容を表示
                        return formatResult(resultData.result);
                    } else {
                        // 通常の結果
                        return formatResult(task.result);
                    }
                })()}
            </div>
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

// TODO更新処理
function handleTodoUpdate(payload) {
    const taskId = payload.taskId;
    const todos = payload.todos;
    
    
    // タスクデータを更新
    const task = currentTasks.get(taskId);
    if (task) {
        task.todos = todos;
        currentTasks.set(taskId, task);
        
        // 選択中のタスクの詳細を更新
        if (selectedTaskId === taskId) {
            renderTaskDetail(task);
        }
    } else {
    }
}

// タスクのログを表示
function displayTaskLogs(task) {
    const taskId = task.taskId || task.id;
    
    // 実行中のタスクの場合、進捗インジケーターを開始
    if (task.status === 'running') {
        lastLogUpdateTime = Date.now();
        updateProgressIndicator();
    } else {
        // 完了済みのタスクの場合は進捗インジケーターを停止
        stopProgressIndicator();
    }
    
    // ストリーミングログコンテナを取得
    const logContainer = document.getElementById('task-logs');
    
    // 実行中のタスクで既にログが表示されている場合はクリアしない
    if (task.status === 'running' && logContainer.children.length > 0) {
        return; // 既存のストリーミングログを保持
    }
    
    // 保存されているストリーミングログがある場合は復元
    if (taskStreamingLogs.has(taskId) && taskStreamingLogs.get(taskId).length > 0) {
        logContainer.innerHTML = '';
        const savedLogs = taskStreamingLogs.get(taskId);
        
        // 保存されたログを再表示（保存を避けるため一時的にselectedTaskIdをクリア）
        const tempSelectedTaskId = selectedTaskId;
        selectedTaskId = null;
        
        savedLogs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            
            // 保存されたクラス名を適用
            if (log.className) {
                entry.className += ' ' + log.className;
            }
            
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'log-timestamp';
            timestampSpan.textContent = log.timestamp;
            
            const contentSpan = document.createElement('span');
            contentSpan.className = 'log-content';
            
            // アイコンの追加
            if (log.icon) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'message-icon';
                iconSpan.textContent = log.icon;
                contentSpan.appendChild(iconSpan);
            }
            
            // 新しい形式のログ
            if (log.className || log.isHtml || log.icon) {
                if (log.isHtml && log.content) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = log.content;
                    while (tempDiv.firstChild) {
                        contentSpan.appendChild(tempDiv.firstChild);
                    }
                } else if (log.content) {
                    if (log.content.includes('\n')) {
                        contentSpan.innerHTML = escapeHtml(log.content).replace(/\n/g, '<br>');
                    } else {
                        contentSpan.textContent = log.content;
                    }
                }
            } else {
                // 旧形式のログ（後方互換性）
                switch (log.type) {
                    case 'system':
                        contentSpan.style.color = '#9ca3af';
                        contentSpan.textContent = log.content;
                        break;
                    case 'claude':
                        contentSpan.className = 'claude-response';
                        contentSpan.innerHTML = `💬 Claude: ${escapeHtml(log.content)}`;
                        break;
                    case 'claude-raw':
                        contentSpan.className = 'claude-response';
                        if (log.htmlContent) {
                            contentSpan.innerHTML = log.htmlContent;
                        } else if (log.data && typeof log.data === 'object') {
                            contentSpan.innerHTML = log.data.innerHTML || log.content;
                        }
                        break;
                    case 'tool-start':
                    case 'tool-end':
                        contentSpan.className = log.type === 'tool-start' ? 'tool-start' : 
                                              (log.data && log.data.success ? 'tool-end' : 'tool-error');
                        if (log.htmlContent) {
                            contentSpan.innerHTML = log.htmlContent;
                        } else if (log.data && log.data.element) {
                            contentSpan.innerHTML = log.data.element.innerHTML || log.content;
                        } else if (log.data && typeof log.data === 'object') {
                            contentSpan.innerHTML = log.data.innerHTML || log.content;
                        }
                        break;
                    default:
                        contentSpan.textContent = log.content;
                }
            }
            
            entry.appendChild(timestampSpan);
            entry.appendChild(contentSpan);
            logContainer.appendChild(entry);
        });
        
        selectedTaskId = tempSelectedTaskId;
        logContainer.scrollTop = logContainer.scrollHeight;
        return;
    }
    
    // それ以外の場合はクリア
    logContainer.innerHTML = '';
    
    // タスクIDの統計情報をリセット
    taskStatistics.delete(taskId);
    toolTimings.clear();
    
    let logsToRender = [];
    
    // まずresult内のlogsを確認
    if (task.result && task.result.logs && Array.isArray(task.result.logs)) {
        logsToRender = task.result.logs;
    } 
    // 次にtask.logsを確認
    else if (task.logs && Array.isArray(task.logs)) {
        logsToRender = task.logs;
    }
    
    // ストリーミングログが保存されていない完了済みタスクの場合、最終ログを表示
    if (logsToRender.length > 0 && !taskStreamingLogs.has(taskId)) {
        renderStreamingLogs(logsToRender);
    } 
    // 実行中でログがまだない場合
    else if (task.status === 'running') {
        appendStreamingLog('実行ログを待機中...', 'system');
    } 
    // それ以外
    else if (!taskStreamingLogs.has(taskId)) {
        appendStreamingLog('ログがありません', 'system');
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

// ストリーミングログレンダリング
function renderStreamingLogs(logs) {
    if (!logs || logs.length === 0) return;
    
    logs.forEach((log) => {
        const message = typeof log === 'string' ? log : (log.message || log.log || JSON.stringify(log));
        appendStreamingLog(message, 'log');
    });
}

// スタイル付きでログを追加
function appendStreamingLogWithStyle(payload) {
    const logContainer = document.getElementById('task-logs');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    // クラス名を追加
    if (payload.className) {
        entry.className += ' ' + payload.className;
    }
    
    const timestamp = new Date(payload.timestamp || Date.now()).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'log-timestamp';
    timestampSpan.textContent = timestamp;
    
    const contentSpan = document.createElement('span');
    contentSpan.className = 'log-content';
    
    // アイコンの追加
    if (payload.icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'message-icon';
        iconSpan.textContent = payload.icon;
        contentSpan.appendChild(iconSpan);
    }
    
    // コンテンツの追加
    if (payload.isHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = payload.log || '';
        while (tempDiv.firstChild) {
            contentSpan.appendChild(tempDiv.firstChild);
        }
    } else {
        const textSpan = document.createElement('span');
        if (payload.log && payload.log.includes('\n')) {
            textSpan.innerHTML = escapeHtml(payload.log).replace(/\n/g, '<br>');
        } else {
            textSpan.textContent = payload.log || '';
        }
        contentSpan.appendChild(textSpan);
    }
    
    // ログを保存
    if (selectedTaskId) {
        if (!taskStreamingLogs.has(selectedTaskId)) {
            taskStreamingLogs.set(selectedTaskId, []);
        }
        
        const logData = {
            timestamp,
            content: payload.log,
            type: 'log',
            data: payload,
            className: payload.className,
            icon: payload.icon,
            isHtml: payload.isHtml
        };
        
        taskStreamingLogs.get(selectedTaskId).push(logData);
    }
    
    entry.appendChild(timestampSpan);
    entry.appendChild(contentSpan);
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// ストリーミングログエントリを追加
function appendStreamingLog(content, type = 'log', data = null) {
    const logContainer = document.getElementById('task-logs');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const timestamp = new Date().toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'log-timestamp';
    timestampSpan.textContent = timestamp;
    
    const contentSpan = document.createElement('span');
    contentSpan.className = 'log-content';
    
    // 現在選択中のタスクIDのログを保存
    if (selectedTaskId) {
        if (!taskStreamingLogs.has(selectedTaskId)) {
            taskStreamingLogs.set(selectedTaskId, []);
        }
        
        // データに要素が含まれる場合はHTMLを文字列として保存
        const logData = {
            timestamp,
            content,
            type,
            data: data
        };
        
        // data が DOM要素の場合、outerHTML を保存
        if (data && data instanceof HTMLElement) {
            logData.htmlContent = data.outerHTML;
            logData.data = null; // DOM要素は保存しない
        } else if (data && data.element && data.element instanceof HTMLElement) {
            logData.htmlContent = data.element.outerHTML;
            logData.data = { ...data, element: null }; // DOM要素以外は保持
        } else if (data && typeof data === 'object' && data.innerHTML) {
            logData.htmlContent = data.innerHTML;
        }
        
        taskStreamingLogs.get(selectedTaskId).push(logData);
    }
    
    switch (type) {
        case 'system':
            contentSpan.style.color = '#9ca3af';
            contentSpan.textContent = content;
            break;
        case 'claude':
            contentSpan.className = 'claude-response';
            contentSpan.innerHTML = `💬 Claude: ${escapeHtml(content).replace(/\n/g, '<br>')}`;
            break;
        case 'claude-raw':
            contentSpan.className = 'claude-response';
            contentSpan.appendChild(data);
            break;
        case 'tool-start':
            contentSpan.className = 'tool-start';
            contentSpan.appendChild(data);
            break;
        case 'tool-end':
            contentSpan.className = data.success ? 'tool-end' : 'tool-error';
            contentSpan.appendChild(data.element);
            break;
        default:
            // 改行を<br>に変換してHTMLとして設定
            if (content.includes('\n')) {
                contentSpan.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
            } else {
                contentSpan.textContent = content;
            }
    }
    
    entry.appendChild(timestampSpan);
    entry.appendChild(contentSpan);
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// ツール実行開始ハンドラー
function handleToolStart(payload) {
    if (selectedTaskId !== payload.taskId) return;
    
    const icon = toolIcons[payload.tool] || '🔧';
    const content = document.createElement('div');
    
    content.innerHTML = `
        <span class="tool-icon">${icon}</span>
        <span class="tool-name">${payload.tool}</span>
        ${payload.input ? formatToolInput(payload.tool, payload.input) : ''}
    `;
    
    appendStreamingLog('', 'tool-start', content);
    toolTimings.set(payload.toolId, Date.now());
}

// ツール実行終了ハンドラー
function handleToolEnd(payload) {
    if (selectedTaskId !== payload.taskId) return;
    
    const icon = toolIcons[payload.tool] || '🔧';
    const duration = payload.duration || 0;
    const durationStr = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
    
    const content = document.createElement('div');
    content.innerHTML = `
        <span class="tool-icon">${icon}</span>
        <span class="tool-name">${payload.tool}</span>
        ${payload.success ? '✅' : '❌'}
        <span class="tool-duration">⏱️ ${durationStr}</span>
        ${payload.error ? `<div style="color: #e57373; margin-left: 32px;">Error: ${escapeHtml(payload.error)}</div>` : ''}
    `;
    
    appendStreamingLog('', 'tool-end', { element: content, success: payload.success });
}

// Claude応答ハンドラー
function handleClaudeResponse(payload) {
    if (selectedTaskId !== payload.taskId) return;
    
    const content = document.createElement('div');
    content.innerHTML = `💬 Claude: ${escapeHtml(payload.text)} <span class="turn-number">(ターン ${payload.turnNumber})</span>`;
    appendStreamingLog('', 'claude-raw', content);
}

// 統計情報ハンドラー
function handleTaskStatistics(payload) {
    if (selectedTaskId !== payload.taskId) return;
    
    const statsContainer = document.getElementById('task-statistics');
    const stats = payload.statistics;
    
    // 統計情報を表示
    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-value">${stats.totalTurns}</span>
            <span class="stat-label">ターン数</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${stats.totalToolCalls}</span>
            <span class="stat-label">ツール呼び出し</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${(stats.elapsedTime / 1000).toFixed(1)}s</span>
            <span class="stat-label">実行時間</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${calculateSuccessRate(stats.toolStats)}</span>
            <span class="stat-label">成功率</span>
        </div>
    `;
    
    statsContainer.classList.remove('hidden');
    
    // 統計情報をログにも追加
    appendStreamingLog('─────────────────────────────────────────', 'separator');
    appendStreamingLog(`📊 タスク完了統計`, 'system');
    appendStreamingLog(`  • ターン数: ${stats.totalTurns}`, 'system');
    appendStreamingLog(`  • ツール呼び出し: ${stats.totalToolCalls}`, 'system');
    appendStreamingLog(`  • 実行時間: ${(stats.elapsedTime / 1000).toFixed(1)}秒`, 'system');
    appendStreamingLog(`  • 成功率: ${calculateSuccessRate(stats.toolStats)}`, 'system');
    
    // ツールごとの統計
    if (stats.toolStats && Object.keys(stats.toolStats).length > 0) {
        appendStreamingLog(`  • ツール別統計:`, 'system');
        for (const [tool, toolStat] of Object.entries(stats.toolStats)) {
            const successRate = toolStat.count > 0 ? Math.round((toolStat.success / toolStat.count) * 100) : 0;
            appendStreamingLog(`    - ${tool}: ${toolStat.count}回 (成功: ${toolStat.success}, 失敗: ${toolStat.failed})`, 'system');
        }
    }
    appendStreamingLog('─────────────────────────────────────────', 'separator');
}

// ツール入力フォーマット
function formatToolInput(tool, input) {
    const params = document.createElement('div');
    params.className = 'tool-params';
    
    switch (tool) {
        case 'Read':
        case 'Write':
        case 'Edit':
        case 'MultiEdit':
            params.textContent = `📄 ${input.file_path || input.path || ''}`;
            break;
        case 'Bash':
            params.textContent = `$ ${input.command || ''}`;
            break;
        case 'Search':
        case 'Grep':
            params.textContent = `🔍 "${input.query || input.pattern || ''}"`;
            break;
        case 'List':
        case 'LS':
        case 'Glob':
            params.textContent = `📁 ${input.path || input.pattern || ''}`;
            break;
        default:
            return '';
    }
    
    return params.outerHTML;
}

// 成功率計算
function calculateSuccessRate(toolStats) {
    if (!toolStats) return 'N/A';
    
    let totalSuccess = 0;
    let totalCalls = 0;
    
    Object.values(toolStats).forEach(stat => {
        totalSuccess += stat.successes || 0;
        totalCalls += stat.count || 0;
    });
    
    // ツール呼び出しがない場合はN/Aを返す
    if (totalCalls === 0) {
        return 'N/A';
    }
    
    return Math.round((totalSuccess / totalCalls) * 100) + '%';
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
    let message;
    try {
        message = JSON.parse(event.data);
    } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        console.error('Message length:', event.data.length);
        console.error('Error position:', error.message);
        // エラー位置周辺のデータを表示
        if (event.data.length > 8000) {
            console.error('Data around position 8000:', event.data.substring(7990, 8010));
        }
        // メッセージの最初の部分を表示してタイプを特定
        console.error('Message start:', event.data.substring(0, 100));
        return;
    }
    
    
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
            
        case 'task:tool_usage':
            handleToolUsage(message.payload);
            break;
            
        case 'task:progress':
            handleTaskProgress(message.payload);
            break;
            
        case 'task:summary':
            handleTaskSummary(message.payload);
            break;
            
        case 'task:todo_update':
            handleTodoUpdate(message.payload);
            break;
            
        case 'task:tool:start':
            handleToolStart(message.payload);
            break;
            
        case 'task:tool:end':
            handleToolEnd(message.payload);
            break;
            
        case 'task:claude:response':
            handleClaudeResponse(message.payload);
            break;
            
        case 'task:statistics':
            handleTaskStatistics(message.payload);
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
    const task = currentTasks.get(taskId);
    
    if (task) {
        // ローカルデータを更新
        updateLocalTaskData(taskId, payload);
        
        // 選択中のタスクの場合は画面を更新
        if (selectedTaskId === taskId) {
            const updatedTask = currentTasks.get(taskId);
            if (updatedTask) {
                renderTaskDetail(updatedTask);
            }
        }
        
        // 完了/失敗時の通知
        if (payload.status === 'completed' || payload.status === 'failed') {
            showSuccess(`タスクが${payload.status === 'completed' ? '完了' : '失敗'}しました`);
            
            // 完了時のみ最新データを取得（結果やログを含む完全なデータ）
            try {
                const currentTask = currentTasks.get(taskId);
                const currentTodos = currentTask?.todos; // 現在のTODOデータを保存
                
                const finalTask = await apiClient.getTask(taskId);
                
                // APIから取得したデータにTODOが含まれていない場合、現在のTODOを保持
                if (!finalTask.todos && currentTodos) {
                    finalTask.todos = currentTodos;
                }
                
                currentTasks.set(taskId, finalTask);
                
                if (selectedTaskId === taskId) {
                    renderTaskDetail(finalTask);
                    // ストリーミングログは保持し、最終ログのみ追加
                    if (finalTask.result && finalTask.result.logs && Array.isArray(finalTask.result.logs)) {
                        // 最終的な実行時間とタスク完了メッセージのみ追加
                        finalTask.result.logs.forEach(log => {
                            if (log.includes('実行時間:') || log.includes('Task completed')) {
                                appendStreamingLog(log, 'system');
                            }
                        });
                    }
                    
                    // タスク完了メッセージを追加
                    if (payload.status === 'completed') {
                        appendStreamingLog('─────────────────────────────────────────', 'separator');
                        appendStreamingLog('✅ タスクが正常に完了しました', 'system');
                        if (finalTask.result && finalTask.result.duration) {
                            appendStreamingLog(`⏱️ 総実行時間: ${(finalTask.result.duration / 1000).toFixed(1)}秒`, 'system');
                        }
                        appendStreamingLog('─────────────────────────────────────────', 'separator');
                    } else if (payload.status === 'failed') {
                        appendStreamingLog('─────────────────────────────────────────', 'separator');
                        appendStreamingLog('❌ タスクが失敗しました', 'error');
                        if (finalTask.error) {
                            appendStreamingLog(`エラー: ${finalTask.error}`, 'error');
                        }
                        appendStreamingLog('─────────────────────────────────────────', 'separator');
                    }
                }
            } catch (error) {
                console.error('Failed to fetch final task data:', error);
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

// ログパターンマッチング
const LOG_PATTERNS = {
    start: /タスク.*開始|Task started/,
    setup: /作業ディレクトリ|Working directory/,
    executing: /Claude Code.*実行中/,
    messageCount: /Received (\d+) messages from Claude Code/,
    complete: /Task completed|完了/,
    error: /Error|エラー|失敗/
};

// ログタイプとアイコンのマッピング
const LOG_ICONS = {
    start: '🚀',
    setup: '📁',
    executing: '⚡',
    messageCount: '💬',
    complete: '✅',
    error: '❌',
    default: '📝'
};

// 進捗インジケーター管理
let lastLogUpdateTime = Date.now();
let stillProcessingInterval = null;

// タスクログ処理
function handleTaskLog(payload) {
    if (selectedTaskId === payload.taskId) {
        const logContainer = document.getElementById('task-logs');
        
        const noLogMessage = logContainer.querySelector('.log-entry');
        if (noLogMessage && (noLogMessage.textContent === 'ログがありません' || noLogMessage.textContent === '実行ログを待機中...')) {
            logContainer.innerHTML = '';
        }
        
        // 最終更新時刻を更新
        lastLogUpdateTime = Date.now();
        updateProgressIndicator();
        
        // ストリーミング形式でログを追加
        appendStreamingLogWithStyle(payload);
    }
}

// 進捗インジケーターの更新
function updateProgressIndicator() {
    // 30秒以上更新がない場合の処理のみ
    if (!stillProcessingInterval) {
        stillProcessingInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - lastLogUpdateTime) / 1000);
            if (elapsed >= 30) {
                showStillProcessingMessage();
                // 一度表示したら停止
                clearInterval(stillProcessingInterval);
                stillProcessingInterval = null;
            }
        }, 1000);
    }
}

// 進捗インジケーターの停止
function stopProgressIndicator() {
    if (stillProcessingInterval) {
        clearInterval(stillProcessingInterval);
        stillProcessingInterval = null;
    }
}

// 「まだ処理中」メッセージの表示
function showStillProcessingMessage() {
    const logContainer = document.getElementById('task-logs');
    if (!logContainer) return;
    
    const stillProcessingEntry = document.createElement('div');
    stillProcessingEntry.className = 'log-entry log-type-processing';
    stillProcessingEntry.innerHTML = `
        <span class="log-timestamp">${new Date().toLocaleTimeString('ja-JP')}</span>
        <span class="log-icon animated-pulse">⏳</span>
        <span class="log-message">まだ処理中です...</span>
    `;
    
    logContainer.appendChild(stillProcessingEntry);
    
    requestAnimationFrame(() => {
        logContainer.scrollTop = logContainer.scrollHeight;
    });
}

// ツール使用情報の処理
function handleToolUsage(payload) {
    if (selectedTaskId === payload.taskId) {
        const logContainer = document.getElementById('task-logs');
        if (!logContainer) return;
        
        const tool = payload.tool;
        const timestamp = new Date(tool.timestamp).toLocaleTimeString('ja-JP');
        
        // ツールに応じたアイコンを設定
        const toolIcons = {
            'Read': '📖',
            'Write': '✏️',
            'Edit': '📝',
            'MultiEdit': '📝',
            'Bash': '💻',
            'LS': '📁',
            'Glob': '🔍',
            'Grep': '🔎',
            'WebFetch': '🌐',
            'WebSearch': '🔍',
            'TodoWrite': '📋',
        };
        
        const icon = toolIcons[tool.tool] || '🔧';
        const statusClass = tool.status === 'success' ? 'tool-success' : 
                          tool.status === 'failure' ? 'tool-failure' : 'tool-start';
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-type-tool ${statusClass}`;
        
        let details = '';
        if (tool.filePath) details = `: <code>${escapeHtml(tool.filePath)}</code>`;
        else if (tool.command) details = `: <code>${escapeHtml(tool.command)}</code>`;
        else if (tool.pattern) details = `: <code>${escapeHtml(tool.pattern)}</code>`;
        else if (tool.url) details = `: <code>${escapeHtml(tool.url)}</code>`;
        
        const statusText = tool.status === 'start' ? '開始' : 
                          tool.status === 'success' ? '成功' : '失敗';
        
        logEntry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-icon">${icon}</span>
            <span class="log-message">
                <strong>${tool.tool}</strong> ${statusText}${details}
                ${tool.error ? `<span class="error-detail">${escapeHtml(tool.error)}</span>` : ''}
            </span>
        `;
        
        logContainer.appendChild(logEntry);
        requestAnimationFrame(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
        });
    }
}

// タスク進捗情報の処理
function handleTaskProgress(payload) {
    if (selectedTaskId === payload.taskId) {
        const progress = payload.progress;
        const timestamp = new Date(progress.timestamp).toLocaleTimeString('ja-JP');
        
        // フェーズに応じたアイコン
        const phaseIcons = {
            'setup': '🔧',
            'planning': '📋',
            'execution': '⚡',
            'cleanup': '🧹',
            'complete': '✅'
        };
        
        const icon = phaseIcons[progress.phase] || '📊';
        const levelClass = `log-level-${progress.level}`;
        
        const logContainer = document.getElementById('task-logs');
        if (!logContainer) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-type-progress ${levelClass}`;
        
        logEntry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-icon">${icon}</span>
            <span class="log-message">${escapeHtml(progress.message)}</span>
        `;
        
        logContainer.appendChild(logEntry);
        requestAnimationFrame(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
        });
    }
}

// タスクサマリーの処理
function handleTaskSummary(payload) {
    if (selectedTaskId === payload.taskId) {
        const summary = payload.summary;
        
        // サマリーをタスク詳細に追加
        const detailContainer = document.getElementById('task-detail');
        if (detailContainer) {
            const summaryHtml = `
                <div class="task-summary">
                    <h3>実行サマリー</h3>
                    <div class="summary-highlights">
                        ${summary.highlights.map(h => `<div class="highlight-item">• ${escapeHtml(h)}</div>`).join('')}
                    </div>
                    
                    ${summary.toolsUsed.length > 0 ? `
                    <div class="summary-section">
                        <h4>使用ツール</h4>
                        <div class="tools-stats">
                            ${summary.toolsUsed.map(tool => `
                                <div class="tool-stat">
                                    <span class="tool-name">${escapeHtml(tool.tool)}</span>
                                    <span class="tool-count">${tool.successCount}/${tool.count} 成功</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${summary.filesCreated.length > 0 ? `
                    <div class="summary-section">
                        <h4>作成されたファイル</h4>
                        <ul class="file-list">
                            ${summary.filesCreated.map(f => `<li><code>${escapeHtml(f)}</code></li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    ${summary.filesModified.length > 0 ? `
                    <div class="summary-section">
                        <h4>編集されたファイル</h4>
                        <ul class="file-list">
                            ${summary.filesModified.map(f => `<li><code>${escapeHtml(f)}</code></li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    ${summary.commandsExecuted.length > 0 ? `
                    <div class="summary-section">
                        <h4>実行されたコマンド</h4>
                        <ul class="command-list">
                            ${summary.commandsExecuted.map(cmd => `
                                <li>
                                    <code>${escapeHtml(cmd.command)}</code>
                                    ${cmd.success ? '<span class="success-mark">✓</span>' : '<span class="failure-mark">✗</span>'}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    ${summary.errors.length > 0 ? `
                    <div class="summary-section error-section">
                        <h4>エラー</h4>
                        <ul class="error-list">
                            ${summary.errors.map(err => `
                                <li>
                                    ${err.tool ? `<strong>${escapeHtml(err.tool)}:</strong> ` : ''}
                                    ${escapeHtml(err.message)}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
            `;
            
            // 既存のサマリーを削除して新しいものを追加
            const existingSummary = detailContainer.querySelector('.task-summary');
            if (existingSummary) {
                existingSummary.remove();
            }
            
            detailContainer.insertAdjacentHTML('beforeend', summaryHtml);
        }
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
    
    // TODOリストコンテナをクリア
    const todosContainer = document.getElementById('task-todos');
    if (todosContainer) {
        todosContainer.innerHTML = '';
        todosContainer.classList.add('hidden');
    }
    
    // 統計情報をクリア・非表示
    const statsContainer = document.getElementById('task-statistics');
    if (statsContainer) {
        statsContainer.innerHTML = '';
        statsContainer.classList.add('hidden');
    }
    
    // 古いログを削除（メモリ管理のため、完了したタスクのログのみ保持）
    if (selectedTaskId && taskStreamingLogs.has(selectedTaskId)) {
        const task = currentTasks.get(selectedTaskId);
        if (task && (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')) {
            // 完了したタスクは最大50件まで保持
            if (taskStreamingLogs.size > 50) {
                const oldestTaskId = taskStreamingLogs.keys().next().value;
                taskStreamingLogs.delete(oldestTaskId);
            }
        }
    }
    
    if (selectedTaskId) {
        apiClient.unsubscribeFromTask(selectedTaskId);
        selectedTaskId = null;
    }
    
    stopProgressIndicator();
}

// ステータステキスト取得はutils.jsから使用

// HTMLエスケープはutils.jsから使用

// コンテンツタイプの判定
function detectContentType(content) {
    if (typeof content === 'object') return 'json';
    
    const str = String(content);
    
    // Markdown判定（見出し、リスト、コードブロックなど）
    if (/^#{1,6}\s+.+/m.test(str) || /^\s*[-*+]\s+.+/m.test(str) || /^```/m.test(str)) {
        return 'markdown';
    }
    
    // JSON判定
    try {
        JSON.parse(str);
        return 'json';
    } catch {}
    
    return 'text';
}

// Markdownの簡易レンダリング
function renderMarkdown(text) {
    let html = escapeHtml(text);
    
    // コードブロック
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
        return `<pre class="code-block"><code>${code}</code></pre>`;
    });
    
    // インラインコード
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // 見出し
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    
    // 太字
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // リスト
    html = html.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // 改行を<br>に
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

// 結果の表示フォーマット
function formatResult(result) {
    const contentType = detectContentType(result);
    
    switch (contentType) {
        case 'markdown':
            return `
                <div class="result-formatted">
                    <div class="result-toolbar">
                        <span class="result-type">Markdown</span>
                        <button class="btn-small" onclick="toggleRawResult(this)">生データを表示</button>
                        <button class="btn-small" onclick="copyResult(this)">コピー</button>
                    </div>
                    <div class="result-content markdown-content">
                        ${renderMarkdown(result)}
                    </div>
                    <div class="result-raw" style="display: none;">
                        <pre>${escapeHtml(result)}</pre>
                    </div>
                </div>
            `;
        
        case 'json':
            const jsonStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            return `
                <div class="result-formatted">
                    <div class="result-toolbar">
                        <span class="result-type">JSON</span>
                        <button class="btn-small" onclick="copyResult(this)">コピー</button>
                    </div>
                    <div class="result-content">
                        <pre class="json-content">${escapeHtml(jsonStr)}</pre>
                    </div>
                </div>
            `;
        
        default:
            return `
                <div class="result-formatted">
                    <div class="result-toolbar">
                        <span class="result-type">Text</span>
                        <button class="btn-small" onclick="copyResult(this)">コピー</button>
                    </div>
                    <div class="result-content">
                        <pre>${escapeHtml(result)}</pre>
                    </div>
                </div>
            `;
    }
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

// 生データ表示の切り替え
function toggleRawResult(button) {
    const container = button.closest('.result-formatted');
    const content = container.querySelector('.result-content');
    const raw = container.querySelector('.result-raw');
    
    if (raw.style.display === 'none') {
        content.style.display = 'none';
        raw.style.display = 'block';
        button.textContent = 'フォーマット表示';
    } else {
        content.style.display = 'block';
        raw.style.display = 'none';
        button.textContent = '生データを表示';
    }
}

// 結果のコピー
function copyResult(button) {
    const container = button.closest('.result-formatted');
    const raw = container.querySelector('.result-raw pre');
    const content = raw ? raw.textContent : container.querySelector('pre').textContent;
    
    navigator.clipboard.writeText(content).then(() => {
        showNotification('コピーしました', 'success');
    }).catch(() => {
        showError('コピーに失敗しました');
    });
}

// グローバル関数として公開
window.toggleRawResult = toggleRawResult;
window.copyResult = copyResult;