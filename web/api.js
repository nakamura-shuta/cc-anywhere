// API Client for CC-Anywhere
class APIClient {
    constructor(baseURL = window.location.origin, apiKey = null) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
        this.ws = null;
        this.authenticated = false;
        this.pendingSubscriptions = new Set();
        this.activeSubscriptions = new Set();
        
        // headers プロパティを追加
        this.headers = {
            'Content-Type': 'application/json'
        };
        if (this.apiKey) {
            this.headers['X-API-Key'] = this.apiKey;
        }
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        // ヘッダーも更新
        if (apiKey) {
            this.headers['X-API-Key'] = apiKey;
        } else {
            delete this.headers['X-API-Key'];
        }
    }

    async request(method, path, body = null) {
        const headers = {};

        if (this.apiKey) {
            headers['X-API-Key'] = this.apiKey;
        }

        const options = {
            method,
            headers,
        };

        if (body) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseURL}${path}`, options);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(error.message || `HTTP error! status: ${response.status}`);
        }

        // 204 No Content の場合は null を返す
        if (response.status === 204) {
            return null;
        }

        // Content-Type が application/json の場合のみ JSON をパースする
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }

        return null;
    }

    // タスク関連API
    async createTask(taskData) {
        return this.request('POST', '/api/tasks', taskData);
    }

    // プリセット関連API
    async getPresets() {
        return this.request('GET', '/api/presets');
    }

    async getPreset(id) {
        return this.request('GET', `/api/presets/${id}`);
    }

    async createPreset(presetData) {
        return this.request('POST', '/api/presets', presetData);
    }

    async updatePreset(id, presetData) {
        return this.request('PUT', `/api/presets/${id}`, presetData);
    }

    async deletePreset(id) {
        return this.request('DELETE', `/api/presets/${id}`);
    }

    // バッチタスクAPI
    async createBatchTasks(batchData) {
        return this.request('POST', '/api/batch/tasks', batchData);
    }

    async getTasks(status = null, limit = 20, offset = 0) {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        params.append('limit', String(limit));
        params.append('offset', String(offset));
        
        return this.request('GET', `/api/tasks?${params}`);
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

    // スケジューラー関連のメソッド
    async createSchedule(scheduleData) {
        return this.request('POST', '/api/schedules', scheduleData);
    }

    async getSchedules(filter) {
        const params = filter && filter !== 'all' ? `?status=${filter}` : '';
        return this.request('GET', `/api/schedules${params}`);
    }

    async toggleSchedule(scheduleId, enable) {
        const endpoint = enable ? 'enable' : 'disable';
        return this.request('POST', `/api/schedules/${scheduleId}/${endpoint}`);
    }

    async deleteSchedule(scheduleId) {
        return this.request('DELETE', `/api/schedules/${scheduleId}`);
    }

    async getScheduleHistory(scheduleId) {
        return this.request('GET', `/api/schedules/${scheduleId}/history`);
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

    // プリセット一覧取得
    async getPresets() {
        const response = await fetch(`${this.baseURL}/api/presets`, {
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error('Failed to fetch presets');
        }
        return response.json();
    }

    // 特定のプリセット取得
    async getPreset(presetId) {
        const response = await fetch(`${this.baseURL}/api/presets/${presetId}`, {
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error('Failed to fetch preset');
        }
        return response.json();
    }

    // プリセット作成
    async createPreset(presetData) {
        const response = await fetch(`${this.baseURL}/api/presets`, {
            method: 'POST',
            headers: {
                ...this.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(presetData)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || `Failed to create preset (${response.status})`;
            throw new Error(errorMessage);
        }
        return response.json();
    }

    // プリセット更新
    async updatePreset(presetId, presetData) {
        const response = await fetch(`${this.baseURL}/api/presets/${presetId}`, {
            method: 'PUT',
            headers: {
                ...this.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(presetData)
        });
        if (!response.ok) {
            throw new Error('Failed to update preset');
        }
        return response.json();
    }

    // プリセット削除
    async deletePreset(presetId) {
        const response = await fetch(`${this.baseURL}/api/presets/${presetId}`, {
            method: 'DELETE',
            headers: this.headers
        });
        if (!response.ok) {
            throw new Error('Failed to delete preset');
        }
        return response.json();
    }
}

// Export for use in other scripts
window.APIClient = APIClient;