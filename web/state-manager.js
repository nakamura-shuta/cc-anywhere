// State Manager - グローバル状態管理
class StateManager {
    constructor() {
        this.state = {
            tasks: new Map(),
            selectedTaskId: null,
            statusFilter: '',
            connectionStatus: 'disconnected',
            apiKey: null,
            repositories: [],
            presets: [],
            currentPage: 1,
            totalPages: 1,
            totalTasks: 0,
            streamingLogs: new Map(),
            taskStatistics: new Map(),
            toolTimings: new Map()
        };
        
        this.listeners = new Map();
        this.logger = window.Logger ? new window.Logger('StateManager') : console;
    }

    // 状態の取得
    get(key) {
        return this.state[key];
    }

    // 状態の設定
    set(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        this.emit('stateChange', { key, oldValue, newValue: value });
        this.emit(`change:${key}`, { oldValue, newValue: value });
    }

    // 複数の状態を一度に更新
    update(updates) {
        const changes = {};
        
        Object.entries(updates).forEach(([key, value]) => {
            if (this.state[key] !== value) {
                changes[key] = {
                    oldValue: this.state[key],
                    newValue: value
                };
                this.state[key] = value;
            }
        });

        if (Object.keys(changes).length > 0) {
            this.emit('stateChange', changes);
            Object.entries(changes).forEach(([key, change]) => {
                this.emit(`change:${key}`, change);
            });
        }
    }

    // タスク管理
    addTask(task) {
        const taskId = task.taskId || task.id;
        this.state.tasks.set(taskId, task);
        this.emit('taskAdded', task);
    }

    updateTask(taskId, updates) {
        const task = this.state.tasks.get(taskId);
        if (task) {
            const updatedTask = { ...task, ...updates };
            this.state.tasks.set(taskId, updatedTask);
            this.emit('taskUpdated', { taskId, task: updatedTask, updates });
            
            // 選択中のタスクが更新された場合
            if (this.state.selectedTaskId === taskId) {
                this.emit('selectedTaskUpdated', updatedTask);
            }
        }
    }

    removeTask(taskId) {
        const task = this.state.tasks.get(taskId);
        if (task) {
            this.state.tasks.delete(taskId);
            this.emit('taskRemoved', { taskId, task });
        }
    }

    getTask(taskId) {
        return this.state.tasks.get(taskId);
    }

    getAllTasks() {
        return Array.from(this.state.tasks.values());
    }

    getFilteredTasks() {
        const tasks = this.getAllTasks();
        if (!this.state.statusFilter) {
            return tasks;
        }
        return tasks.filter(task => task.status === this.state.statusFilter);
    }

    // 選択されたタスク
    selectTask(taskId) {
        const oldTaskId = this.state.selectedTaskId;
        this.state.selectedTaskId = taskId;
        this.emit('taskSelected', { oldTaskId, newTaskId: taskId });
    }

    getSelectedTask() {
        return this.state.selectedTaskId ? this.getTask(this.state.selectedTaskId) : null;
    }

    // ストリーミングログ管理
    addStreamingLog(taskId, log) {
        if (!this.state.streamingLogs.has(taskId)) {
            this.state.streamingLogs.set(taskId, []);
        }
        const logs = this.state.streamingLogs.get(taskId);
        logs.push(log);
        this.emit('streamingLogAdded', { taskId, log });
    }

    getStreamingLogs(taskId) {
        return this.state.streamingLogs.get(taskId) || [];
    }

    clearStreamingLogs(taskId) {
        this.state.streamingLogs.delete(taskId);
        this.emit('streamingLogsCleared', { taskId });
    }

    // タスク統計管理
    updateTaskStatistics(taskId, stats) {
        this.state.taskStatistics.set(taskId, stats);
        this.emit('taskStatisticsUpdated', { taskId, stats });
    }

    getTaskStatistics(taskId) {
        return this.state.taskStatistics.get(taskId);
    }

    // ツール実行時間管理
    startToolTiming(taskId, toolId) {
        const key = `${taskId}-${toolId}`;
        this.state.toolTimings.set(key, {
            startTime: Date.now(),
            endTime: null
        });
    }

    endToolTiming(taskId, toolId) {
        const key = `${taskId}-${toolId}`;
        const timing = this.state.toolTimings.get(key);
        if (timing && !timing.endTime) {
            timing.endTime = Date.now();
            timing.duration = timing.endTime - timing.startTime;
        }
    }

    getToolTiming(taskId, toolId) {
        const key = `${taskId}-${toolId}`;
        return this.state.toolTimings.get(key);
    }

    // イベントリスナー管理
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    emit(event, data) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    this.logger.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // 状態のリセット
    reset() {
        this.state = {
            tasks: new Map(),
            selectedTaskId: null,
            statusFilter: '',
            connectionStatus: 'disconnected',
            apiKey: this.state.apiKey, // APIキーは保持
            repositories: [],
            presets: [],
            currentPage: 1,
            totalPages: 1,
            totalTasks: 0,
            streamingLogs: new Map(),
            taskStatistics: new Map(),
            toolTimings: new Map()
        };
        this.emit('stateReset');
    }

    // デバッグ用: 現在の状態を取得
    getState() {
        return {
            ...this.state,
            tasks: Array.from(this.state.tasks.entries()),
            streamingLogs: Array.from(this.state.streamingLogs.entries()),
            taskStatistics: Array.from(this.state.taskStatistics.entries()),
            toolTimings: Array.from(this.state.toolTimings.entries())
        };
    }
}

// シングルトンインスタンスとして提供
window.stateManager = new StateManager();