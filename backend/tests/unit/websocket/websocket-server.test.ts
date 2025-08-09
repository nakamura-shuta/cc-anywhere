import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from '../../../src/websocket/websocket-server';
import { fileWatcherService } from '../../../src/services/file-watcher.service';
import type { AuthenticatedWebSocket } from '../../../src/websocket/types';

vi.mock('../../../src/services/file-watcher.service');
vi.mock('../../../src/utils/logger');

describe('WebSocketServer', () => {
  let server: WebSocketServer;
  let mockClient: AuthenticatedWebSocket;

  beforeEach(() => {
    server = new WebSocketServer();
    
    mockClient = {
      id: 'test-client-1',
      authenticated: true,
      subscriptions: new Set(['task-123']),
      readyState: 1, // WebSocket.OPEN
      OPEN: 1,
      send: vi.fn(),
    } as any;

    // Add client to server's clients map (need to use reflection since it's private)
    (server as any).clients.set(mockClient.id, mockClient);
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('file change events', () => {
    it('should broadcast file change events to task subscribers', () => {
      const fileChangeEvent = {
        taskId: 'task-123',
        operation: 'add',
        path: '/test/file.txt',
        timestamp: Date.now()
      };

      // Call the broadcast method
      server.broadcastFileChange(fileChangeEvent);

      // Verify the message was sent
      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      
      expect(sentMessage).toEqual({
        type: 'file-change',
        payload: {
          taskId: 'task-123',
          operation: 'add',
          path: '/test/file.txt',
          timestamp: fileChangeEvent.timestamp
        }
      });
    });

    it('should not broadcast to clients not subscribed to the task', () => {
      const nonSubscribedClient = {
        id: 'test-client-2',
        authenticated: true,
        subscriptions: new Set(['task-456']), // Different task
        readyState: 1,
        OPEN: 1,
        send: vi.fn(),
      } as any;

      (server as any).clients.set(nonSubscribedClient.id, nonSubscribedClient);

      const fileChangeEvent = {
        taskId: 'task-123',
        operation: 'change',
        path: '/test/file.txt',
        timestamp: Date.now()
      };

      server.broadcastFileChange(fileChangeEvent);

      // Subscribed client should receive the message
      expect(mockClient.send).toHaveBeenCalledTimes(1);
      // Non-subscribed client should not receive the message
      expect(nonSubscribedClient.send).not.toHaveBeenCalled();
    });

    it('should broadcast to clients subscribed to all tasks (*)', () => {
      const allTasksClient = {
        id: 'test-client-3',
        authenticated: true,
        subscriptions: new Set(['*']), // All tasks
        readyState: 1,
        OPEN: 1,
        send: vi.fn(),
      } as any;

      (server as any).clients.set(allTasksClient.id, allTasksClient);

      const fileChangeEvent = {
        taskId: 'task-789',
        operation: 'unlink',
        path: '/test/deleted.txt',
        timestamp: Date.now()
      };

      server.broadcastFileChange(fileChangeEvent);

      // Client subscribed to all tasks should receive the message
      expect(allTasksClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle different file operations correctly', () => {
      const operations = ['add', 'change', 'unlink', 'addDir', 'unlinkDir'];
      
      operations.forEach(operation => {
        vi.clearAllMocks();
        
        const fileChangeEvent = {
          taskId: 'task-123',
          operation,
          path: `/test/${operation}.txt`,
          timestamp: Date.now()
        };

        server.broadcastFileChange(fileChangeEvent);

        expect(mockClient.send).toHaveBeenCalledTimes(1);
        const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
        expect(sentMessage.payload.operation).toBe(operation);
      });
    });

    it('should not send to unauthenticated clients', () => {
      const unauthenticatedClient = {
        id: 'test-client-4',
        authenticated: false,
        subscriptions: new Set(['task-123']),
        readyState: 1,
        OPEN: 1,
        send: vi.fn(),
      } as any;

      (server as any).clients.set(unauthenticatedClient.id, unauthenticatedClient);

      const fileChangeEvent = {
        taskId: 'task-123',
        operation: 'add',
        path: '/test/file.txt',
        timestamp: Date.now()
      };

      server.broadcastFileChange(fileChangeEvent);

      // Authenticated client should receive
      expect(mockClient.send).toHaveBeenCalledTimes(1);
      // Unauthenticated client should not receive
      expect(unauthenticatedClient.send).not.toHaveBeenCalled();
    });

    it('should not send to clients with closed connections', () => {
      mockClient.readyState = 3; // WebSocket.CLOSED

      const fileChangeEvent = {
        taskId: 'task-123',
        operation: 'add',
        path: '/test/file.txt',
        timestamp: Date.now()
      };

      server.broadcastFileChange(fileChangeEvent);

      // Should not send to closed connection
      expect(mockClient.send).not.toHaveBeenCalled();
    });
  });
});