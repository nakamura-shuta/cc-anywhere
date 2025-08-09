import { EventEmitter } from 'events';
import * as chokidar from 'chokidar';
import { logger } from '../utils/logger';

export interface FileChangeEvent {
  operation: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  taskId: string;
  timestamp: number;
}

export class FileWatcherService extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  
  async watchDirectory(taskId: string, directory: string): Promise<void> {
    if (this.watchers.has(taskId)) {
      await this.stopWatching(taskId);
    }

    const watcher = chokidar.watch(directory, {
      ignored: /(^|[\/\\])\../, // dotfilesを無視
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('add', path => this.emitChange('add', path, taskId))
      .on('change', path => this.emitChange('change', path, taskId))
      .on('unlink', path => this.emitChange('unlink', path, taskId))
      .on('addDir', path => this.emitChange('addDir', path, taskId))
      .on('unlinkDir', path => this.emitChange('unlinkDir', path, taskId));

    this.watchers.set(taskId, watcher);
    logger.info(`Started watching directory: ${directory} for task: ${taskId}`);
  }
  
  async stopWatching(taskId: string): Promise<void> {
    const watcher = this.watchers.get(taskId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(taskId);
      logger.info(`Stopped watching for task: ${taskId}`);
    }
  }
  
  private emitChange(operation: string, path: string, taskId: string): void {
    const event: FileChangeEvent = {
      operation: operation as any,
      path,
      taskId,
      timestamp: Date.now()
    };
    this.emit('change', event);
  }
}

export const fileWatcherService = new FileWatcherService();