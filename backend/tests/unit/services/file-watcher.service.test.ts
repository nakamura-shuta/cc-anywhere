import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileWatcherService } from '../../../src/services/file-watcher.service';
import * as chokidar from 'chokidar';

vi.mock('chokidar');
vi.mock('../../../src/utils/logger');

describe('FileWatcherService', () => {
  let service: FileWatcherService;
  let mockWatcher: any;

  beforeEach(() => {
    service = new FileWatcherService();
    
    // Mock chokidar watcher
    mockWatcher = {
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined)
    };
    
    vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('watchDirectory', () => {
    it('should create a watcher for the specified directory', async () => {
      const taskId = 'task-123';
      const directory = '/test/path';

      await service.watchDirectory(taskId, directory);

      expect(chokidar.watch).toHaveBeenCalledWith(directory, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true
      });
    });

    it('should register event handlers for file system events', async () => {
      const taskId = 'task-123';
      const directory = '/test/path';

      await service.watchDirectory(taskId, directory);

      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('addDir', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('unlinkDir', expect.any(Function));
    });

    it('should stop existing watcher before creating new one', async () => {
      const taskId = 'task-123';
      const directory = '/test/path';

      // First watch
      await service.watchDirectory(taskId, directory);
      
      // Second watch
      await service.watchDirectory(taskId, directory);

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(chokidar.watch).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopWatching', () => {
    it('should close the watcher for the specified task', async () => {
      const taskId = 'task-123';
      const directory = '/test/path';

      await service.watchDirectory(taskId, directory);
      await service.stopWatching(taskId);

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should do nothing if no watcher exists for the task', async () => {
      const taskId = 'non-existent';

      await service.stopWatching(taskId);

      expect(mockWatcher.close).not.toHaveBeenCalled();
    });
  });

  describe('event emission', () => {
    it('should emit change event when file is added', async () => {
      const taskId = 'task-123';
      const directory = '/test/path';
      const filePath = '/test/path/file.txt';
      
      const changeListener = vi.fn();
      service.on('change', changeListener);

      await service.watchDirectory(taskId, directory);

      // Get the callback registered for 'add' event
      const addCallback = mockWatcher.on.mock.calls.find(call => call[0] === 'add')[1];
      
      // Simulate file add event
      addCallback(filePath);

      expect(changeListener).toHaveBeenCalledWith({
        operation: 'add',
        path: filePath,
        taskId,
        timestamp: expect.any(Number)
      });
    });

    it('should emit change event when file is modified', async () => {
      const taskId = 'task-123';
      const directory = '/test/path';
      const filePath = '/test/path/file.txt';
      
      const changeListener = vi.fn();
      service.on('change', changeListener);

      await service.watchDirectory(taskId, directory);

      // Get the callback registered for 'change' event
      const changeCallback = mockWatcher.on.mock.calls.find(call => call[0] === 'change')[1];
      
      // Simulate file change event
      changeCallback(filePath);

      expect(changeListener).toHaveBeenCalledWith({
        operation: 'change',
        path: filePath,
        taskId,
        timestamp: expect.any(Number)
      });
    });

    it('should emit change event when file is deleted', async () => {
      const taskId = 'task-123';
      const directory = '/test/path';
      const filePath = '/test/path/file.txt';
      
      const changeListener = vi.fn();
      service.on('change', changeListener);

      await service.watchDirectory(taskId, directory);

      // Get the callback registered for 'unlink' event
      const unlinkCallback = mockWatcher.on.mock.calls.find(call => call[0] === 'unlink')[1];
      
      // Simulate file delete event
      unlinkCallback(filePath);

      expect(changeListener).toHaveBeenCalledWith({
        operation: 'unlink',
        path: filePath,
        taskId,
        timestamp: expect.any(Number)
      });
    });
  });
});