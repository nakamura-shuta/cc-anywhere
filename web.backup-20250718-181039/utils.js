// 共通ユーティリティ関数
// 複数のページで使用される関数を集約

// クエリパラメータからAPIキーを取得
function getApiKeyFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('apiKey') || params.get('key');
}

// HTMLエスケープ
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 日時フォーマット
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 通知を表示
function showNotification(message, type = 'info') {
    // 既存の通知を削除
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // 3秒後に削除
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// エラー表示（showNotificationのエイリアス）
function showError(message) {
    showNotification(message, 'error');
}

// 成功表示（showNotificationのエイリアス）
function showSuccess(message) {
    showNotification(message, 'success');
}

// ナビゲーションリンクを更新する関数
function updateNavigationLinks() {
    const currentParams = new URLSearchParams(window.location.search);
    const navLinks = document.querySelectorAll('.header-nav a');
    
    navLinks.forEach(link => {
        const url = new URL(link.href, window.location.origin);
        // 現在のクエリパラメータをリンクに追加
        currentParams.forEach((value, key) => {
            url.searchParams.set(key, value);
        });
        link.href = url.toString();
    });
}

// ステータステキストの取得
function getStatusText(status) {
    const statusMap = {
        pending: '待機中',
        running: '実行中',
        completed: '完了',
        failed: '失敗',
        cancelled: 'キャンセル'
    };
    return statusMap[status.toLowerCase()] || status;
}

// ステータスクラスの取得
function getStatusClass(status) {
    return status.toLowerCase();
}

// 接続状態の監視を設定
function setupConnectionStatus(apiClient) {
    const checkConnectionStatus = async () => {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;
        
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');
        
        try {
            await apiClient.request('GET', '/health');
            statusElement.classList.remove('disconnected');
            statusElement.classList.add('connected');
            statusText.textContent = '接続中';
        } catch (error) {
            statusElement.classList.remove('connected');
            statusElement.classList.add('disconnected');
            statusText.textContent = '未接続';
        }
    };

    checkConnectionStatus();
    // 5秒ごとに接続状態をチェック
    setInterval(checkConnectionStatus, 5000);
}

// タスク詳細URLを生成（クエリパラメータを引き継ぐ）
function getTaskDetailUrl(taskId) {
    const currentParams = new URLSearchParams(window.location.search);
    const url = new URL('/', window.location.origin);
    
    // 現在のクエリパラメータを引き継ぐ
    currentParams.forEach((value, key) => {
        url.searchParams.set(key, value);
    });
    
    // タスクIDを追加
    url.searchParams.set('taskId', taskId);
    
    return url.toString();
}

// リポジトリ名を抽出
function extractRepoName(workingDirectory) {
    if (!workingDirectory) return 'デフォルト';
    const parts = workingDirectory.split('/');
    return parts[parts.length - 1] || 'デフォルト';
}

// モーダルを閉じる処理を設定
function setupModalClose(modalElement) {
    const closeBtn = modalElement.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modalElement.style.display = 'none';
        });
    }

    // モーダル外クリックで閉じる
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            modalElement.style.display = 'none';
        }
    });
}

// 共通のロード状態表示
function showLoadingState(element, message = '読み込み中...') {
    element.innerHTML = `<div class="loading">${escapeHtml(message)}</div>`;
}

// 共通のエラー状態表示
function showErrorState(element, message = 'エラーが発生しました') {
    element.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}

// 共通の空状態表示
function showEmptyState(element, message = 'データがありません') {
    element.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}