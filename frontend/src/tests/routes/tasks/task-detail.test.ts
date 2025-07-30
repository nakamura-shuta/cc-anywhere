import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import Page from '../../../routes/tasks/[id]/+page.svelte';
import { TaskStatus } from '$lib/types/api';

// PageDataの型定義
interface PageData {
	task: any;
	logs: string[];
	childTasks: any[];
}

// モックストア
vi.mock('$lib/stores/api.svelte', () => ({
	taskStore: {
		fetchTask: vi.fn(),
		cancelTask: vi.fn()
	}
}));

// モックサービス
vi.mock('$lib/services/task.service', () => ({
	taskService: {
		getLogs: vi.fn(() => Promise.resolve({ logs: ['test log'] }))
	}
}));

// モックWebSocket
vi.mock('$lib/hooks/use-task-websocket-enhanced.svelte', () => ({
	useTaskWebSocket: vi.fn(() => ({
		connected: true,
		logs: [],
		statusChange: null,
		progress: null,
		statistics: null,
		toolExecutions: [],
		claudeResponses: [],
		todoUpdates: []
	}))
}));

describe('Task Detail Page - Continue Options', () => {
	const mockTask = {
		taskId: 'task-123',
		status: TaskStatus.COMPLETED,
		instruction: 'Test task',
		createdAt: '2025-01-25T10:00:00Z',
		updatedAt: '2025-01-25T10:30:00Z',
		completedAt: '2025-01-25T10:30:00Z',
		workingDirectory: '/home/user/project'
	};

	const pageData: PageData = {
		task: mockTask,
		logs: [],
		childTasks: []
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should show both continue options when task is completed with SDK session ID', async () => {
		const taskWithSession = {
			...mockTask,
			sdkSessionId: 'session-123'
		};

		const { container } = render(Page, {
			props: {
				data: { ...pageData, task: taskWithSession }
			}
		});

		// 継続オプションセクションが表示されること
		expect(screen.getByText('継続オプション')).toBeInTheDocument();

		// SDK Continueオプションが有効であること
		const sdkContinueSection = container.querySelector('[class*="hover:bg-muted/50"]');
		expect(sdkContinueSection).toBeInTheDocument();
		expect(screen.getByText('会話を継続')).toBeInTheDocument();
		expect(screen.getByText('SDK Continueで続行')).toBeInTheDocument();
		expect(screen.getByText('SDK Continueで続行')).not.toBeDisabled();

		// 継続タスクオプションも表示されること
		expect(screen.getByText('結果を基に新規タスク')).toBeInTheDocument();
		expect(screen.getByText('継続タスクを作成')).toBeInTheDocument();
	});

	it('should disable SDK Continue when no session ID exists', async () => {
		const taskWithoutSession = {
			...mockTask,
			sdkSessionId: undefined
		};

		render(Page, {
			props: {
				data: { ...pageData, task: taskWithoutSession }
			}
		});

		// SDK Continue オプションが無効化されていること
		expect(screen.getByText('セッションIDがないため利用できません')).toBeInTheDocument();
		expect(screen.getByText('SDK Continue利用不可')).toBeDisabled();

		// 継続タスクオプションは有効であること
		expect(screen.getByText('継続タスクを作成')).not.toBeDisabled();
	});

	it('should show recommendation badge based on task age', async () => {
		// 30分以内のタスク（SDK Continue推奨）
		const recentTask = {
			...mockTask,
			sdkSessionId: 'session-123',
			completedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10分前
		};

		const { rerender } = render(Page, {
			props: {
				data: { ...pageData, task: recentTask }
			}
		});

		// SDK Continueに推奨バッジが表示されること
		const badges = screen.getAllByText('推奨');
		expect(badges.length).toBe(1); // SDK Continueのみに推奨バッジ

		// 30分以上経過したタスク（継続タスク推奨）
		const oldTask = {
			...mockTask,
			sdkSessionId: 'session-123',
			completedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1時間前
		};

		rerender({
			data: { ...pageData, task: oldTask }
		});

		// 継続タスクに推奨バッジが表示されること
		const newBadges = screen.getAllByText('推奨');
		expect(newBadges.length).toBe(1); // 継続タスクのみに推奨バッジ
	});

	it('should navigate to new task page with SDK continue params when clicking SDK Continue', async () => {
		const taskWithSession = {
			...mockTask,
			sdkSessionId: 'session-123'
		};

		// window.location.hrefのモック
		const mockHref = vi.fn();
		Object.defineProperty(window, 'location', {
			value: { href: '' },
			writable: true
		});
		Object.defineProperty(window.location, 'href', {
			set: mockHref
		});

		render(Page, {
			props: {
				data: { ...pageData, task: taskWithSession }
			}
		});

		// SDK Continueボタンをクリック
		const sdkContinueButton = screen.getByText('SDK Continueで続行');
		await fireEvent.click(sdkContinueButton);

		// 正しいパラメータで遷移すること
		expect(mockHref).toHaveBeenCalledWith(
			'/tasks/new?continueFromTaskId=task-123&mode=sdk-continue'
		);
	});

	it('should not show continue options when task is not completed', () => {
		const runningTask = {
			...mockTask,
			status: TaskStatus.RUNNING,
			completedAt: undefined
		};

		render(Page, {
			props: {
				data: { ...pageData, task: runningTask }
			}
		});

		// 継続オプションセクションが表示されないこと
		expect(screen.queryByText('継続オプション')).not.toBeInTheDocument();
	});
});