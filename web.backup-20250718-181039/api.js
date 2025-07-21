// API Client for CC-Anywhere
class APIClient {
    constructor(baseURL = window.location.origin, apiKey = null) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
        this.wsManager = null; // WebSocketManager instance
        
        // headers プロパティを追加
        this.headers = {
            'Content-Type': 'application/json'
        };
        if (this.apiKey) {
            this.headers['X-API-Key'] = this.apiKey;
        }
        
        // Initialize WebSocketManager if available
        if (window.WebSocketManager) {
            this.wsManager = new window.WebSocketManager(this);
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
        if (this.wsManager) {
            return this.wsManager.connect();
        }
        console.warn('WebSocketManager not available');
        return Promise.reject(new Error('WebSocketManager not initialized'));
    }

    disconnectWebSocket() {
        if (this.wsManager) {
            this.wsManager.disconnect();
        }
    }

    subscribeToTask(taskId) {
        if (this.wsManager) {
            this.wsManager.subscribe(taskId);
        } else {
            console.error('WebSocketManager not available');
        }
    }

    unsubscribeFromTask(taskId) {
        if (this.wsManager) {
            this.wsManager.unsubscribe(taskId);
        } else {
            console.error('WebSocketManager not available');
        }
    }
    
    // WebSocket status getters
    get ws() {
        // 互換性のために ws プロパティを提供
        return this.wsManager ? this.wsManager.ws : null;
    }
    
    get authenticated() {
        return this.wsManager ? this.wsManager.isAuthenticated() : false;
    }
    
    isWebSocketConnected() {
        return this.wsManager ? this.wsManager.isConnected() : false;
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