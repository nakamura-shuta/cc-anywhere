import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import DirectorySelector from './directory-selector.svelte';
import { repositoryService } from '$lib/services/repository.service';

// repositoryServiceをモック
vi.mock('$lib/services/repository.service', () => ({
	repositoryService: {
		list: vi.fn()
	}
}));

describe('DirectorySelector', () => {
	const mockRepositories = [
		{
			id: '1',
			name: 'project-a',
			path: '/home/user/project-a',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
		{
			id: '2',
			name: 'project-b',
			path: '/home/user/project-b',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(repositoryService.list).mockResolvedValue(mockRepositories);
	});

	describe('通常モード', () => {
		it('should display all repositories with checkboxes', async () => {
			render(DirectorySelector);

			await waitFor(() => {
				expect(screen.getByText('project-a')).toBeInTheDocument();
				expect(screen.getByText('project-b')).toBeInTheDocument();
			});

			// チェックボックスが有効であることを確認
			const checkboxes = screen.getAllByRole('checkbox');
			expect(checkboxes).toHaveLength(3); // すべて選択 + 2つのプロジェクト
			checkboxes.forEach(checkbox => {
				expect(checkbox).not.toBeDisabled();
			});
		});

		it('should allow selecting and deselecting directories', async () => {
			const onSelectionChange = vi.fn();
			render(DirectorySelector, {
				props: {
					selectedDirectories: [],
					onSelectionChange
				}
			});

			await waitFor(() => {
				expect(screen.getByText('project-a')).toBeInTheDocument();
			});

			// project-aの行を探す
			const projectAElement = screen.getByText('project-a').closest('[class*="rounded-lg border"]');
			const projectACheckbox = projectAElement?.querySelector('input[type="checkbox"], button[role="checkbox"]');
			
			expect(projectACheckbox).toBeTruthy();
			await fireEvent.click(projectACheckbox!);

			expect(onSelectionChange).toHaveBeenCalledWith(['/home/user/project-a']);
		});

		it('should display "すべて選択" option', async () => {
			render(DirectorySelector);

			await waitFor(() => {
				expect(screen.getByText(/すべて選択/)).toBeInTheDocument();
			});
		});
	});

	describe('読み取り専用モード', () => {
		it('should display readonly message in description', async () => {
			render(DirectorySelector, {
				props: {
					readonly: true,
					selectedDirectories: ['/home/user/project-a']
				}
			});

			await waitFor(() => {
				expect(screen.getByText(/SDK Continueモードでは前回のタスクと同じ作業ディレクトリを使用します/)).toBeInTheDocument();
			});
		});

		it('should disable all checkboxes when readonly', async () => {
			const { container } = render(DirectorySelector, {
				props: {
					readonly: true,
					selectedDirectories: ['/home/user/project-a']
				}
			});

			await waitFor(() => {
				expect(screen.getByText('project-a')).toBeInTheDocument();
			});

			// すべてのチェックボックスが無効化されていることを確認
			const checkboxes = container.querySelectorAll('button[role="checkbox"]');
			expect(checkboxes.length).toBeGreaterThan(0);
			checkboxes.forEach(checkbox => {
				expect(checkbox).toBeDisabled();
			});
		});

		it('should not display "すべて選択" option when readonly', async () => {
			render(DirectorySelector, {
				props: {
					readonly: true,
					selectedDirectories: ['/home/user/project-a']
				}
			});

			await waitFor(() => {
				expect(screen.getByText('project-a')).toBeInTheDocument();
			});

			// 「すべて選択」オプションが表示されていないことを確認
			expect(screen.queryByText(/すべて選択/)).not.toBeInTheDocument();
		});

		it('should not call onSelectionChange when clicking in readonly mode', async () => {
			const onSelectionChange = vi.fn();
			render(DirectorySelector, {
				props: {
					readonly: true,
					selectedDirectories: ['/home/user/project-a'],
					onSelectionChange
				}
			});

			await waitFor(() => {
				expect(screen.getByText('project-b')).toBeInTheDocument();
			});

			// project-bのラベルをクリック
			const projectBLabel = screen.getByText('project-b');
			await fireEvent.click(projectBLabel);

			// onSelectionChangeが呼ばれていないことを確認
			expect(onSelectionChange).not.toHaveBeenCalled();
		});

		it('should not show hover effect on items when readonly', async () => {
			const { container } = render(DirectorySelector, {
				props: {
					readonly: true,
					selectedDirectories: ['/home/user/project-a']
				}
			});

			await waitFor(() => {
				expect(screen.getByText('project-a')).toBeInTheDocument();
			});

			// hover効果のクラスが適用されていないことを確認
			const projectItems = container.querySelectorAll('[class*="rounded-lg border"]');
			projectItems.forEach(item => {
				const classes = item.getAttribute('class') || '';
				expect(classes).not.toContain('hover:bg-muted/30');
			});
		});
	});

	describe('エラーハンドリング', () => {
		it('should display error message when repository loading fails', async () => {
			vi.mocked(repositoryService.list).mockRejectedValue(new Error('Failed to load'));

			render(DirectorySelector);

			await waitFor(() => {
				expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
			});
		});

		it('should display message when no repositories are available', async () => {
			vi.mocked(repositoryService.list).mockResolvedValue([]);

			render(DirectorySelector);

			await waitFor(() => {
				expect(screen.getByText(/作業ディレクトリが設定されていません/)).toBeInTheDocument();
			});
		});
	});
});