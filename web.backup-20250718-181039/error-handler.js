// Error Handler - 統一されたエラーハンドリング
class ErrorHandler {
    constructor() {
        this.errorQueue = [];
        this.maxErrors = 10;
        this.logger = window.Logger ? new window.Logger('ErrorHandler') : console;
        this.listeners = new Set();
        
        // グローバルエラーハンドラー設定
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // 通常のエラー
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'javascript',
                message: event.message,
                source: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });

        // Promiseのエラー
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || String(event.reason),
                error: event.reason
            });
            
            // デフォルトの動作を防ぐ
            event.preventDefault();
        });
    }

    // エラーハンドリング
    handleError(errorInfo) {
        // エラーをログに記録
        this.logger.error('Error caught:', errorInfo);
        
        // エラーをキューに追加
        this.errorQueue.push({
            ...errorInfo,
            timestamp: new Date().toISOString()
        });
        
        // キューサイズ制限
        if (this.errorQueue.length > this.maxErrors) {
            this.errorQueue.shift();
        }
        
        // リスナーに通知
        this.notifyListeners(errorInfo);
        
        // UIに表示
        this.showErrorNotification(errorInfo);
    }

    // APIエラーハンドリング
    handleApiError(error, context = {}) {
        const errorInfo = {
            type: 'api',
            message: error.message || 'APIエラーが発生しました',
            status: error.status,
            endpoint: context.endpoint,
            method: context.method,
            error: error
        };
        
        this.handleError(errorInfo);
        
        // 特定のステータスコードに対する処理
        if (error.status === 401) {
            this.handleAuthError();
        } else if (error.status === 429) {
            this.handleRateLimitError();
        }
    }

    // WebSocketエラーハンドリング
    handleWebSocketError(error, context = {}) {
        const errorInfo = {
            type: 'websocket',
            message: error.message || 'WebSocket通信エラー',
            code: error.code,
            reason: error.reason,
            error: error
        };
        
        this.handleError(errorInfo);
    }

    // 認証エラー処理
    handleAuthError() {
        this.showErrorNotification({
            message: '認証エラー: APIキーを確認してください',
            level: 'error',
            duration: 5000
        });
        
        // 必要に応じて認証画面へリダイレクトなど
    }

    // レート制限エラー処理
    handleRateLimitError() {
        this.showErrorNotification({
            message: 'レート制限に達しました。しばらくお待ちください',
            level: 'warning',
            duration: 5000
        });
    }

    // エラー通知表示
    showErrorNotification(errorInfo) {
        const level = errorInfo.level || 'error';
        const message = this.formatErrorMessage(errorInfo);
        
        // showError関数が利用可能な場合は使用
        if (typeof window.showError === 'function' && level === 'error') {
            window.showError(message);
        } else if (typeof window.showWarning === 'function' && level === 'warning') {
            window.showWarning(message);
        } else if (typeof window.showInfo === 'function' && level === 'info') {
            window.showInfo(message);
        } else {
            // フォールバック: コンソールに出力
            console[level](message);
            
            // 簡易的な通知を表示
            this.showSimpleNotification(message, level);
        }
    }

    // エラーメッセージのフォーマット
    formatErrorMessage(errorInfo) {
        if (typeof errorInfo === 'string') {
            return errorInfo;
        }
        
        let message = errorInfo.message || 'エラーが発生しました';
        
        // エラータイプに応じて詳細を追加
        switch (errorInfo.type) {
            case 'api':
                if (errorInfo.endpoint) {
                    message += ` (${errorInfo.method || 'GET'} ${errorInfo.endpoint})`;
                }
                break;
            case 'websocket':
                if (errorInfo.code) {
                    message += ` (Code: ${errorInfo.code})`;
                }
                break;
            case 'javascript':
                if (errorInfo.source && errorInfo.lineno) {
                    message += ` (${errorInfo.source}:${errorInfo.lineno})`;
                }
                break;
        }
        
        return message;
    }

    // 簡易通知表示
    showSimpleNotification(message, level = 'error') {
        // 既存の通知を削除
        const existingNotification = document.querySelector('.error-handler-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 新しい通知を作成
        const notification = document.createElement('div');
        notification.className = `error-handler-notification notification-${level}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${level === 'error' ? '#fee' : level === 'warning' ? '#ffa' : '#eef'};
            color: ${level === 'error' ? '#c00' : level === 'warning' ? '#880' : '#008'};
            border: 1px solid ${level === 'error' ? '#fcc' : level === 'warning' ? '#ff8' : '#ccf'};
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 自動的に削除
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // エラーリスナー登録
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // リスナーへの通知
    notifyListeners(errorInfo) {
        this.listeners.forEach(callback => {
            try {
                callback(errorInfo);
            } catch (error) {
                this.logger.error('Error in error listener:', error);
            }
        });
    }

    // エラー履歴取得
    getErrorHistory() {
        return [...this.errorQueue];
    }

    // エラー履歴クリア
    clearErrorHistory() {
        this.errorQueue = [];
    }

    // エラーをサーバーに報告（オプション）
    async reportError(errorInfo) {
        try {
            // エラー報告エンドポイントが設定されている場合
            if (window.ERROR_REPORT_ENDPOINT) {
                await fetch(window.ERROR_REPORT_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...errorInfo,
                        userAgent: navigator.userAgent,
                        url: window.location.href,
                        timestamp: new Date().toISOString()
                    })
                });
            }
        } catch (error) {
            // エラー報告自体が失敗した場合は無視
            this.logger.error('Failed to report error:', error);
        }
    }
}

// グローバルエラーハンドラーインスタンス
window.errorHandler = new ErrorHandler();

// 便利なヘルパー関数
window.handleError = (error, context) => window.errorHandler.handleError(error, context);
window.handleApiError = (error, context) => window.errorHandler.handleApiError(error, context);
window.handleWebSocketError = (error, context) => window.errorHandler.handleWebSocketError(error, context);