// WebSocket Manager - Centralized WebSocket handling
class WebSocketManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.ws = null;
        this.authenticated = false;
        this.connectionStatus = 'disconnected';
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.heartbeatInterval = null;
        this.messageQueue = [];
        this.subscriptions = new Set();
        
        // Logger instance
        this.logger = window.Logger ? new window.Logger('WebSocketManager') : console;
    }

    // Event listener management
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

    // Connection management
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.logger.info('WebSocket already connected');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsURL = `${protocol}//${window.location.host}/ws`;
            
            this.logger.info('Connecting to WebSocket:', wsURL);
            
            try {
                this.ws = new WebSocket(wsURL);
                
                this.ws.onopen = () => {
                    this.logger.info('WebSocket connected');
                    this.connectionStatus = 'connected';
                    this.reconnectAttempts = 0;
                    this.emit('connected');
                    
                    // Authenticate if API key is available
                    if (this.apiClient.apiKey) {
                        this.authenticate();
                    }
                    
                    // Start heartbeat
                    this.startHeartbeat();
                    
                    resolve();
                };

                this.ws.onclose = (event) => {
                    this.logger.info('WebSocket disconnected:', event.code, event.reason);
                    this.connectionStatus = 'disconnected';
                    this.authenticated = false;
                    this.emit('disconnected', { code: event.code, reason: event.reason });
                    
                    // Clear heartbeat
                    this.stopHeartbeat();
                    
                    // Clear subscriptions
                    this.subscriptions.clear();
                    
                    // Attempt reconnection if not manually closed
                    if (event.code !== 1000) {
                        this.reconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    this.logger.error('WebSocket error:', error);
                    this.emit('error', error);
                    reject(error);
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event);
                };

            } catch (error) {
                this.logger.error('Failed to create WebSocket:', error);
                reject(error);
            }
        });
    }

    disconnect() {
        this.logger.info('Disconnecting WebSocket');
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
        
        if (this.ws) {
            this.ws.close(1000, 'User requested disconnect');
            this.ws = null;
        }
        
        this.stopHeartbeat();
        this.subscriptions.clear();
        this.messageQueue = [];
        this.authenticated = false;
        this.connectionStatus = 'disconnected';
    }

    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnection attempts reached');
            this.emit('reconnectFailed');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
        
        this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connectionStatus = 'reconnecting';
        this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

        setTimeout(() => {
            this.connect().catch(error => {
                this.logger.error('Reconnection failed:', error);
            });
        }, delay);
    }

    // Authentication
    authenticate() {
        if (!this.apiClient.apiKey) {
            this.logger.warn('No API key available for authentication');
            return;
        }

        this.send({
            type: 'auth',
            payload: { apiKey: this.apiClient.apiKey }
        });
    }

    // Message handling
    handleMessage(event) {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch (error) {
            this.logger.error('Failed to parse WebSocket message:', error);
            return;
        }

        this.logger.debug('Received message:', message.type);

        switch (message.type) {
            case 'auth:success':
                this.authenticated = true;
                this.emit('authenticated');
                this.processMessageQueue();
                break;

            case 'auth:error':
                this.authenticated = false;
                this.emit('authError', message.payload);
                break;

            case 'task:update':
                this.emit('taskUpdate', message.payload);
                break;

            case 'task:log':
                this.emit('taskLog', message.payload);
                break;

            case 'task:completed':
                this.emit('taskCompleted', message.payload);
                this.unsubscribe(message.payload.taskId);
                break;

            case 'error':
                this.emit('serverError', message.payload);
                break;

            case 'heartbeat':
                this.send({ type: 'heartbeat' });
                break;

            default:
                this.logger.warn('Unknown message type:', message.type);
                this.emit('unknownMessage', message);
        }
    }

    // Message sending
    send(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.logger.warn('WebSocket not connected, queuing message');
            this.messageQueue.push(message);
            return false;
        }

        if (message.type !== 'auth' && message.type !== 'heartbeat' && !this.authenticated) {
            this.logger.warn('Not authenticated, queuing message');
            this.messageQueue.push(message);
            return false;
        }

        try {
            this.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            this.logger.error('Failed to send message:', error);
            return false;
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (!this.send(message)) {
                // Put it back if sending failed
                this.messageQueue.unshift(message);
                break;
            }
        }
    }

    // Subscription management
    subscribe(taskId) {
        if (this.subscriptions.has(taskId)) {
            this.logger.debug('Already subscribed to task:', taskId);
            return;
        }

        this.subscriptions.add(taskId);
        const sent = this.send({
            type: 'subscribe',
            payload: { taskId }
        });

        if (sent) {
            this.logger.info('Subscribed to task:', taskId);
        }
    }

    unsubscribe(taskId) {
        if (!this.subscriptions.has(taskId)) {
            return;
        }

        this.subscriptions.delete(taskId);
        const sent = this.send({
            type: 'unsubscribe',
            payload: { taskId }
        });

        if (sent) {
            this.logger.info('Unsubscribed from task:', taskId);
        }
    }

    unsubscribeAll() {
        this.subscriptions.forEach(taskId => {
            this.send({
                type: 'unsubscribe',
                payload: { taskId }
            });
        });
        this.subscriptions.clear();
    }

    // Heartbeat management
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'heartbeat' });
            }
        }, 30000); // Send heartbeat every 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // Status getters
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    isAuthenticated() {
        return this.authenticated;
    }

    getConnectionStatus() {
        return this.connectionStatus;
    }

    getSubscriptions() {
        return Array.from(this.subscriptions);
    }
}

// Export for use in other scripts
window.WebSocketManager = WebSocketManager;