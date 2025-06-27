// API Client for CC-Anywhere
class APIClient {
    constructor(baseURL = window.location.origin, apiKey = null) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
        this.ws = null;
        this.authenticated = false;
        this.pendingSubscriptions = new Set();
        this.activeSubscriptions = new Set();
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    async request(method, path, body = null) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (this.apiKey) {
            headers['X-API-Key'] = this.apiKey;
        }

        const options = {
            method,
            headers,
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseURL}${path}`, options);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(error.message || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // タスク関連API
    async createTask(taskData) {
        return this.request('POST', '/api/tasks', taskData);
    }

    async getTasks(status = null) {
        const query = status ? `?status=${status}` : '';
        return this.request('GET', `/api/tasks${query}`);
    }

    async getTask(taskId) {
        return this.request('GET', `/api/tasks/${taskId}`);
    }

    async cancelTask(taskId) {
        return this.request('DELETE', `/api/tasks/${taskId}`);
    }

    async getRepositories() {
        return this.request('GET', '/api/repositories');
    }

    async getTaskLogs(taskId) {
        return this.request('GET', `/api/tasks/${taskId}/logs`);
    }

    // WebSocket接続
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsURL = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsURL);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            // 認証
            if (this.apiKey) {
                this.ws.send(JSON.stringify({
                    type: 'auth',
                    payload: { apiKey: this.apiKey }
                }));
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.authenticated = false;
            // アクティブなサブスクリプションをクリア
            this.activeSubscriptions.clear();
            // 再接続を試みる
            setTimeout(() => this.connectWebSocket(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        return this.ws;
    }

    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    subscribeToTask(taskId) {
        // 既にサブスクライブ済みの場合はスキップ
        if (this.activeSubscriptions.has(taskId)) {
            console.log('Already subscribed to task:', taskId);
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected when trying to subscribe to task:', taskId);
            // 接続待ちキューに追加
            this.pendingSubscriptions.add(taskId);
            return;
        }

        if (!this.authenticated) {
            console.log('WebSocket not authenticated yet, queuing subscription for task:', taskId);
            // 認証待ちキューに追加
            this.pendingSubscriptions.add(taskId);
            return;
        }

        console.log('Subscribing to task:', taskId);
        this.ws.send(JSON.stringify({
            type: 'subscribe',
            payload: { taskId }
        }));
        
        // アクティブなサブスクリプションとして記録
        this.activeSubscriptions.add(taskId);
    }

    unsubscribeFromTask(taskId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'unsubscribe',
            payload: { taskId }
        }));
        
        // 保留中とアクティブなサブスクリプションから削除
        this.pendingSubscriptions.delete(taskId);
        this.activeSubscriptions.delete(taskId);
    }
    
    // 認証成功時に呼び出す
    onAuthenticated() {
        this.authenticated = true;
        console.log('WebSocket authenticated, processing pending subscriptions:', this.pendingSubscriptions.size);
        
        // 保留中のサブスクリプションを処理
        for (const taskId of this.pendingSubscriptions) {
            // 既にアクティブな場合はスキップ
            if (this.activeSubscriptions.has(taskId)) {
                continue;
            }
            
            console.log('Processing pending subscription for task:', taskId);
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                payload: { taskId }
            }));
            
            // アクティブなサブスクリプションとして記録
            this.activeSubscriptions.add(taskId);
        }
        
        // キューをクリア
        this.pendingSubscriptions.clear();
    }
}

// Export for use in other scripts
window.APIClient = APIClient;