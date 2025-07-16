/**
 * フロントエンド用ログユーティリティ
 * WebSocketやAPI通信のログを管理
 */

const LogLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
};

class Logger {
    constructor(name, options = {}) {
        this.name = name;
        this.enabled = options.enabled !== false;
        this.level = options.level || LogLevel.INFO;
        this.prefix = `[${name}]`;
        
        // ログレベルの優先度
        this.levelPriority = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
    }
    
    shouldLog(level) {
        if (!this.enabled) return false;
        return this.levelPriority[level] >= this.levelPriority[this.level];
    }
    
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const parts = [`${timestamp} ${this.prefix} [${level.toUpperCase()}]`, message];
        
        if (data !== undefined) {
            if (typeof data === 'object') {
                parts.push(JSON.stringify(data, null, 2));
            } else {
                parts.push(data);
            }
        }
        
        return parts.join(' ');
    }
    
    debug(message, data) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage(LogLevel.DEBUG, message, data));
        }
    }
    
    info(message, data) {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage(LogLevel.INFO, message, data));
        }
    }
    
    warn(message, data) {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage(LogLevel.WARN, message, data));
        }
    }
    
    error(message, data) {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(this.formatMessage(LogLevel.ERROR, message, data));
        }
    }
}

// ロガーインスタンスの作成
const createLogger = (name, options) => new Logger(name, options);

// グローバルログ設定
const LogConfig = {
    enabled: true,
    level: LogLevel.INFO
};

// 開発環境ではデバッグログを有効化
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    LogConfig.level = LogLevel.DEBUG;
}

// エクスポート
window.Logger = Logger;
window.createLogger = createLogger;
window.LogLevel = LogLevel;
window.LogConfig = LogConfig;