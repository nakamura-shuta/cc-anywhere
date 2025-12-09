// Svelte 5 Runesを使用したストアのテスト例
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '@testing-library/svelte';
import TestComponent from './test-task-store.svelte';

// テスト用のタスクストアを作成
function createTaskStore() {
	let tasks = $state<any[]>([]);
	let loading = $state(false);
	let error = $state<Error | null>(null);
	
	// 派生状態
	const taskCount = $derived(tasks.length);
	const hasError = $derived(error !== null);
	const activeTasks = $derived(tasks.filter(t => t.status === 'active'));
	
	// アクション
	function addTask(task: any) {
		tasks = [...tasks, task];
	}
	
	function removeTask(id: string) {
		tasks = tasks.filter(t => t.id !== id);
	}
	
	function updateTask(id: string, updates: any) {
		tasks = tasks.map(t => 
			t.id === id ? { ...t, ...updates } : t
		);
	}
	
	async function fetchTasks() {
		loading = true;
		error = null;
		
		try {
			// APIコールのシミュレーション
			const response = await fetch('/api/tasks');
			if (!response.ok) throw new Error('Failed to fetch');
			
			const data = await response.json();
			tasks = data;
		} catch (e) {
			error = e as Error;
		} finally {
			loading = false;
		}
	}
	
	function setError(e: Error | null) {
		error = e;
	}
	
	return {
		// 状態
		get tasks() { return tasks; },
		get loading() { return loading; },
		get error() { return error; },
		get taskCount() { return taskCount; },
		get hasError() { return hasError; },
		get activeTasks() { return activeTasks; },
		
		// アクション
		addTask,
		removeTask,
		updateTask,
		fetchTasks,
		setError
	};
}

describe('Task Store with Svelte 5 Runes', () => {
	let store: ReturnType<typeof createTaskStore>;
	
	beforeEach(() => {
		// 各テストの前に新しいストアを作成
		store = createTaskStore();
		// fetchのモック
		(globalThis as any).fetch = vi.fn();
	});
	
	describe('基本的な状態管理', () => {
		it('初期状態が正しい', () => {
			expect(store.tasks).toEqual([]);
			expect(store.loading).toBe(false);
			expect(store.error).toBe(null);
			expect(store.taskCount).toBe(0);
		});
		
		it('タスクを追加できる', () => {
			const task = { id: '1', title: 'Test Task', status: 'active' };
			
			store.addTask(task);
			flushSync(); // 状態更新を同期的にフラッシュ
			
			expect(store.tasks).toHaveLength(1);
			expect(store.tasks[0]).toEqual(task);
			expect(store.taskCount).toBe(1);
		});
		
		it('タスクを削除できる', () => {
			store.addTask({ id: '1', title: 'Task 1' });
			store.addTask({ id: '2', title: 'Task 2' });
			flushSync();
			
			store.removeTask('1');
			flushSync();
			
			expect(store.tasks).toHaveLength(1);
			expect(store.tasks[0].id).toBe('2');
		});
		
		it('タスクを更新できる', () => {
			store.addTask({ id: '1', title: 'Task 1', status: 'active' });
			flushSync();
			
			store.updateTask('1', { status: 'completed' });
			flushSync();
			
			expect(store.tasks[0].status).toBe('completed');
		});
	});
	
	describe('派生状態（$derived）', () => {
		it('taskCountが自動的に更新される', () => {
			expect(store.taskCount).toBe(0);
			
			store.addTask({ id: '1' });
			flushSync();
			expect(store.taskCount).toBe(1);
			
			store.addTask({ id: '2' });
			flushSync();
			expect(store.taskCount).toBe(2);
			
			store.removeTask('1');
			flushSync();
			expect(store.taskCount).toBe(1);
		});
		
		it('activeTasksが正しくフィルタリングされる', () => {
			store.addTask({ id: '1', status: 'active' });
			store.addTask({ id: '2', status: 'completed' });
			store.addTask({ id: '3', status: 'active' });
			flushSync();
			
			expect(store.activeTasks).toHaveLength(2);
			expect(store.activeTasks.every(t => t.status === 'active')).toBe(true);
		});
		
		it('hasErrorが正しく動作する', () => {
			expect(store.hasError).toBe(false);
			
			store.setError(new Error('Test error'));
			flushSync();
			expect(store.hasError).toBe(true);
			
			store.setError(null);
			flushSync();
			expect(store.hasError).toBe(false);
		});
	});
	
	describe('非同期操作', () => {
		it('タスクの取得が成功する', async () => {
			const mockTasks = [
				{ id: '1', title: 'Task 1' },
				{ id: '2', title: 'Task 2' }
			];
			
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => mockTasks
			} as Response);
			
			expect(store.loading).toBe(false);
			
			const fetchPromise = store.fetchTasks();
			flushSync();
			expect(store.loading).toBe(true);
			
			await fetchPromise;
			flushSync();
			
			expect(store.loading).toBe(false);
			expect(store.tasks).toEqual(mockTasks);
			expect(store.error).toBe(null);
		});
		
		it('タスクの取得が失敗する', async () => {
			vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
			
			await store.fetchTasks();
			flushSync();
			
			expect(store.loading).toBe(false);
			expect(store.tasks).toEqual([]);
			expect(store.error?.message).toBe('Network error');
			expect(store.hasError).toBe(true);
		});
	});
	
	describe('コンポーネントとの統合', () => {
		it('コンポーネント内でストアが正しく動作する', async () => {
			const { getByText, queryByText } = render(TestComponent, {
				props: { store }
			});
			
			// 初期状態
			expect(getByText('Tasks: 0')).toBeInTheDocument();
			expect(queryByText('Loading...')).not.toBeInTheDocument();
			
			// タスクを追加
			store.addTask({ id: '1', title: 'Test Task', status: 'active' });
			flushSync();
			
			expect(getByText('Tasks: 1')).toBeInTheDocument();
			expect(getByText('Active: 1')).toBeInTheDocument();
		});
	});
});