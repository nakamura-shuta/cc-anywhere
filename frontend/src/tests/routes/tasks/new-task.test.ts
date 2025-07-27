import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { TaskStatus } from '$lib/types/api';

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/stores/api.svelte', () => ({
	taskStore: {
		createTask: vi.fn()
	}
}));

vi.mock('$lib/services/task.service', () => ({
	taskService: {
		get: vi.fn()
	}
}));

vi.mock('$lib/services/repository.service', () => ({
	repositoryService: {
		list: vi.fn().mockResolvedValue([
			{
				id: '1',
				name: 'project-a',
				path: '/home/user/project-a',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
		])
	}
}));

vi.mock('$app/stores', () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { writable } = require('svelte/store');
	const pageStore = writable({
		url: {
			searchParams: new URLSearchParams()
		}
	});
	
	return {
		page: {
			subscribe: pageStore.subscribe,
			set: pageStore.set,
			update: pageStore.update
		}
	};
});

// ページのインポート
import Page from '../../../routes/tasks/new/+page.svelte';
import { taskStore } from '$lib/stores/api.svelte';
import { taskService } from '$lib/services/task.service';
import { page } from '$app/stores';
const pageStore = page as any;

describe('New Task Page - SDK Continue Mode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should display SDK Continue mode UI when mode=sdk-continue', async () => {
		// URLパラメータを設定
		pageStore.set({
			url: {
				searchParams: new URLSearchParams({
					continueFromTaskId: 'task-123',
					mode: 'sdk-continue'
				})
			}
		});

		// 前のタスク情報を返すようモック
		vi.mocked(taskService.get).mockResolvedValue({
			id: 'task-123',
			taskId: 'task-123',
			status: TaskStatus.COMPLETED,
			instruction: '前回のタスク指示',
			workingDirectory: '/home/user/project',
			sdkSessionId: 'session-123',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		render(Page);

		// SDK Continueモードの表示を確認
		await waitFor(() => {
			expect(screen.getByText('SDK Continue - 会話を継続')).toBeInTheDocument();
			expect(screen.getByText('SDK Continueモード')).toBeInTheDocument();
			expect(screen.getByText('前回の会話の文脈を保持して継続します。')).toBeInTheDocument();
			expect(screen.getByText('前回のタスク指示')).toBeInTheDocument();
		});
	});

	it('should include continueFromTaskId in request when in SDK Continue mode', async () => {
		// URLパラメータを設定
		pageStore.set({
			url: {
				searchParams: new URLSearchParams({
					continueFromTaskId: 'task-123',
					mode: 'sdk-continue'
				})
			}
		});

		// 前のタスク情報を返すようモック
		vi.mocked(taskService.get).mockResolvedValue({
			id: 'task-123',
			taskId: 'task-123',
			status: TaskStatus.COMPLETED,
			instruction: '前回のタスク',
			workingDirectory: '/home/user/project',
			sdkSessionId: 'session-123',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		// 成功レスポンスをモック
		const mockTaskState = {
			data: {
				id: 'new-task-123',
				taskId: 'new-task-123',
				status: TaskStatus.RUNNING,
				instruction: '続きの作業',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			},
			loading: false,
			error: null,
			isSuccess: true,
			reset: vi.fn(),
			execute: vi.fn()
		};
		vi.mocked(taskStore.createTask).mockResolvedValue(mockTaskState);

		render(Page);

		// フォームに入力
		await waitFor(() => {
			const textarea = screen.getByPlaceholderText('例: README.mdファイルを作成してください');
			expect(textarea).toBeInTheDocument();
		});

		const textarea = screen.getByPlaceholderText('例: README.mdファイルを作成してください');
		await fireEvent.input(textarea, { target: { value: '続きの作業' } });

		// 送信ボタンをクリック
		const submitButton = screen.getByText('タスクを作成');
		await fireEvent.click(submitButton);

		// 正しいパラメータでAPIが呼ばれることを確認
		await waitFor(() => {
			expect(taskStore.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					instruction: '続きの作業',
					options: expect.objectContaining({
						sdk: expect.objectContaining({
							continueFromTaskId: 'task-123'
						})
					})
				})
			);
		});
	});

	it('should display normal mode UI when not in SDK Continue mode', async () => {
		// URLパラメータなし
		pageStore.set({
			url: {
				searchParams: new URLSearchParams()
			}
		});

		render(Page);

		// 通常モードの表示を確認
		expect(screen.getByText('新規タスク作成')).toBeInTheDocument();
		expect(screen.queryByText('SDK Continue - 会話を継続')).not.toBeInTheDocument();
		expect(screen.queryByText('SDK Continueモード')).not.toBeInTheDocument();
	});

	it('should inherit working directory from previous task in SDK Continue mode', async () => {
		// URLパラメータを設定
		pageStore.set({
			url: {
				searchParams: new URLSearchParams({
					continueFromTaskId: 'task-123',
					mode: 'sdk-continue'
				})
			}
		});

		// 前のタスク情報を返すようモック
		const previousWorkingDir = '/home/user/previous-project';
		vi.mocked(taskService.get).mockResolvedValue({
			id: 'task-123',
			taskId: 'task-123',
			status: TaskStatus.COMPLETED,
			instruction: '前回のタスク',
			workingDirectory: previousWorkingDir,
			sdkSessionId: 'session-123',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		const { container } = render(Page);

		await waitFor(() => {
			// DirectorySelectorが前のタスクの作業ディレクトリを表示していることを確認
			expect(taskService.get).toHaveBeenCalledWith('task-123');
		});

		// SDKContinueモードのメッセージが表示されていることを確認
		expect(screen.getByText(/SDK Continueモードでは前回のタスクと同じ作業ディレクトリを使用します/)).toBeInTheDocument();
		
		// チェックボックスが無効化されていることを確認
		const checkboxes = container.querySelectorAll('button[role="checkbox"]');
		expect(checkboxes.length).toBeGreaterThan(0);
		checkboxes.forEach(checkbox => {
			expect(checkbox).toBeDisabled();
		});

		// 「すべて選択」オプションが表示されていないことを確認
		expect(screen.queryByText(/すべて選択/)).not.toBeInTheDocument();
	});

	it('should handle error when loading previous task fails', async () => {
		// URLパラメータを設定
		pageStore.set({
			url: {
				searchParams: new URLSearchParams({
					continueFromTaskId: 'task-123',
					mode: 'sdk-continue'
				})
			}
		});

		// エラーを返すようモック
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(taskService.get).mockRejectedValue(new Error('Task not found'));

		render(Page);

		await waitFor(() => {
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Failed to load previous task:',
				expect.any(Error)
			);
		});

		// エラーが発生してもページは表示される
		expect(screen.getByText('SDK Continue - 会話を継続')).toBeInTheDocument();
		
		consoleErrorSpy.mockRestore();
	});
});