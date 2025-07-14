// スケジューラー管理画面

// グローバル変数
let schedules = [];
let repositories = [];
let currentFilter = 'all';
let apiClient;

// クエリパラメータからAPIキーを取得はutils.jsから使用

// ナビゲーションリンクを更新する関数はutils.jsから使用

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    // APIクライアントの初期化
    const apiKey = getApiKeyFromQuery() || localStorage.getItem('apiKey') || 'hoge';  // クエリパラメータ優先
    apiClient = new APIClient(window.location.origin, apiKey);
    
    // クエリパラメータがある場合はlocalStorageに保存
    if (getApiKeyFromQuery()) {
        localStorage.setItem('apiKey', apiKey);
    }
    
    // ナビゲーションリンクにクエリパラメータを引き継ぐ
    updateNavigationLinks();
    
    // 接続状態の監視を開始
    setupConnectionStatus(apiClient);
    
    await loadRepositories();
    await loadSchedules();
    setupEventListeners();
    setupFormToggle();
});

// APIリクエストのラッパー関数（後方互換性のため残す）
async function apiRequest(path, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    return await apiClient.request(method, path, body);
}

// リポジトリ情報を読み込む
async function loadRepositories() {
    try {
        const data = await apiClient.getRepositories();
        repositories = data.repositories || [];
        
        const select = document.getElementById('task-repository');
        if (!select) {
            console.error('Repository select element not found');
            return;
        }
        
        select.innerHTML = '<option value="">選択してください</option>' + 
            repositories.map(repo => 
                `<option value="${escapeHtml(repo.path)}">${escapeHtml(repo.name)} (${escapeHtml(repo.path)})</option>`
            ).join('');
    } catch (error) {
        console.error('Failed to load repositories:', error);
    }
}

// スケジュール一覧を読み込む
async function loadSchedules() {
    try {
        const container = document.getElementById('schedules-container');
        container.innerHTML = '<div class="loading">読み込み中...</div>';

        const data = await apiClient.getSchedules(currentFilter);
        schedules = data.schedules || [];

        renderSchedules();
    } catch (error) {
        console.error('Failed to load schedules:', error);
        document.getElementById('schedules-container').innerHTML = 
            '<div class="error">スケジュールの読み込みに失敗しました</div>';
    }
}

// スケジュール一覧を描画
function renderSchedules() {
    const container = document.getElementById('schedules-container');
    
    if (schedules.length === 0) {
        container.innerHTML = '<div class="empty">スケジュールがありません</div>';
        return;
    }

    container.innerHTML = schedules.map(schedule => `
        <div class="schedule-card" data-id="${schedule.id}">
            <div class="schedule-header">
                <h3 class="schedule-name">${escapeHtml(schedule.name)}</h3>
                <span class="schedule-status ${schedule.status}">
                    ${schedule.status === 'active' ? '有効' : 
                      schedule.status === 'inactive' ? '無効' : '完了'}
                </span>
            </div>
            
            ${schedule.description ? `<p class="schedule-description">${escapeHtml(schedule.description)}</p>` : ''}
            
            <div class="schedule-info">
                <div class="info-item">
                    <span class="info-label">タイプ</span>
                    <span class="info-value">
                        ${schedule.schedule.type === 'cron' ? 
                            `定期実行 (${schedule.schedule.expression})` : 
                            `1回実行 (${formatDateTime(schedule.schedule.executeAt)})`}
                    </span>
                </div>
                
                <div class="info-item">
                    <span class="info-label">実行回数</span>
                    <span class="info-value">${schedule.metadata.executionCount || 0}回</span>
                </div>
                
                ${schedule.metadata.lastExecutedAt ? `
                    <div class="info-item">
                        <span class="info-label">最終実行</span>
                        <span class="info-value">${formatDateTime(schedule.metadata.lastExecutedAt)}</span>
                    </div>
                ` : ''}
                
                ${schedule.metadata.nextExecuteTime ? `
                    <div class="info-item">
                        <span class="info-label">次回実行</span>
                        <span class="info-value">${formatDateTime(schedule.metadata.nextExecuteTime)}</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="schedule-actions">
                ${schedule.status === 'active' ? 
                    `<button class="btn btn-secondary btn-sm" onclick="toggleSchedule('${schedule.id}', false)">無効化</button>` :
                    schedule.status === 'inactive' ?
                    `<button class="btn btn-primary btn-sm" onclick="toggleSchedule('${schedule.id}', true)">有効化</button>` : ''
                }
                <button class="btn btn-secondary btn-sm" onclick="showHistory('${schedule.id}')">履歴</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSchedule('${schedule.id}')">削除</button>
            </div>
        </div>
    `).join('');
}

// イベントリスナーの設定
function setupEventListeners() {
    // フォーム送信
    document.getElementById('schedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createSchedule();
    });

    // フィルター
    document.getElementById('status-filter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        loadSchedules();
    });

    // 更新ボタン
    document.getElementById('refresh-schedules').addEventListener('click', loadSchedules);

    // Cron例ボタン
    document.querySelectorAll('.cron-example').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('cron-expression').value = btn.dataset.cron;
        });
    });

    // Cronヘルプ
    document.querySelector('.cron-help').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('cron-help-modal').style.display = 'block';
    });

    // モーダルクローズ
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').style.display = 'none';
        });
    });

    // モーダル外クリック
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// フォームタイプ切り替え
function setupFormToggle() {
    const typeSelect = document.getElementById('schedule-type');
    const cronSettings = document.getElementById('cron-settings');
    const onceSettings = document.getElementById('once-settings');

    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'cron') {
            cronSettings.style.display = 'block';
            onceSettings.style.display = 'none';
            document.getElementById('cron-expression').required = true;
            document.getElementById('once-datetime').required = false;
        } else {
            cronSettings.style.display = 'none';
            onceSettings.style.display = 'block';
            document.getElementById('cron-expression').required = false;
            document.getElementById('once-datetime').required = true;
        }
    });
}

// スケジュール作成
async function createSchedule() {
    const form = document.getElementById('schedule-form');
    const formData = new FormData(form);

    // スケジュールデータの構築
    const scheduleData = {
        name: formData.get('name'),
        description: formData.get('description') || undefined,
        taskRequest: {
            instruction: formData.get('instruction'),
            context: {},
            options: {
                sdk: {}
            }
        },
        schedule: {
            type: formData.get('type')
        }
    };

    // リポジトリ設定
    const repository = formData.get('repository');
    if (repository) {
        scheduleData.taskRequest.context.workingDirectory = repository;
        // repositories配列も追加（タスク実行画面と同様）
        const selectedRepo = repositories.find(r => r.path === repository);
        if (selectedRepo) {
            scheduleData.taskRequest.repositories = [selectedRepo];
        }
    }

    // 権限モード設定
    const permissionMode = formData.get('permissionMode');
    if (permissionMode) {
        scheduleData.taskRequest.options.sdk.permissionMode = permissionMode;
    }

    // スケジュールタイプ別の設定
    if (scheduleData.schedule.type === 'cron') {
        scheduleData.schedule.expression = formData.get('expression');
        const timezone = formData.get('timezone');
        if (timezone) {
            scheduleData.schedule.timezone = timezone;
        }
    } else {
        const executeAt = formData.get('executeAt');
        if (executeAt) {
            scheduleData.schedule.executeAt = new Date(executeAt).toISOString();
        }
    }

    try {
        await apiClient.createSchedule(scheduleData);

        // 成功したらフォームをリセットして一覧を更新
        form.reset();
        await loadSchedules();
        showNotification('スケジュールを作成しました', 'success');
    } catch (error) {
        console.error('Failed to create schedule:', error);
        showNotification('スケジュールの作成に失敗しました: ' + error.message, 'error');
    }
}

// スケジュールの有効/無効切り替え
async function toggleSchedule(scheduleId, enable) {
    try {
        await apiClient.toggleSchedule(scheduleId, enable);
        await loadSchedules();
        showNotification(`スケジュールを${enable ? '有効' : '無効'}化しました`, 'success');
    } catch (error) {
        console.error('Failed to toggle schedule:', error);
        showNotification('操作に失敗しました: ' + error.message, 'error');
    }
}

// スケジュール削除
async function deleteSchedule(scheduleId) {
    if (!confirm('このスケジュールを削除しますか？')) {
        return;
    }

    try {
        await apiClient.deleteSchedule(scheduleId);
        await loadSchedules();
        showNotification('スケジュールを削除しました', 'success');
    } catch (error) {
        console.error('Failed to delete schedule:', error);
        showNotification('削除に失敗しました: ' + error.message, 'error');
    }
}

// 実行履歴を表示
async function showHistory(scheduleId) {
    try {
        const history = await apiClient.getScheduleHistory(scheduleId);
        const schedule = schedules.find(s => s.id === scheduleId);

        // 履歴モーダルを作成
        const modal = createHistoryModal(schedule, history);
        document.body.appendChild(modal);
        modal.style.display = 'block';
    } catch (error) {
        console.error('Failed to load history:', error);
        showNotification('履歴の読み込みに失敗しました', 'error');
    }
}

// 履歴モーダルを作成
function createHistoryModal(schedule, history) {
    const modal = document.createElement('div');
    modal.className = 'modal history-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>${escapeHtml(schedule.name)} - 実行履歴</h3>
            
            <div class="history-list">
                ${history.length === 0 ? 
                    '<p>実行履歴がありません</p>' :
                    history.map(item => `
                        <div class="history-item">
                            <div class="history-time">
                                ${formatDateTime(item.executedAt)}
                                <span class="history-status ${item.status}">
                                    ${item.status === 'success' ? '成功' : '失敗'}
                                </span>
                            </div>
                            ${item.taskId ? `
                                <div class="history-details">
                                    タスクID: <a href="${getTaskDetailUrl(item.taskId)}" target="_blank">${item.taskId}</a>
                                </div>
                            ` : ''}
                            ${item.error ? `
                                <div class="history-details error">
                                    エラー: ${escapeHtml(item.error)}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;

    // クローズイベント
    modal.querySelector('.close').addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    return modal;
}

// 通知を表示はutils.jsから使用

// 日時フォーマットはutils.jsから使用

// HTMLエスケープはutils.jsから使用

// タスク詳細URLを生成はutils.jsから使用

// 接続状態の監視はutils.jsのsetupConnectionStatusを使用