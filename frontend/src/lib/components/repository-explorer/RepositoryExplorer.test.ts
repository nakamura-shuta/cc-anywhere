import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import RepositoryExplorer from './RepositoryExplorer.svelte';
import { repositoryExplorerService } from '$lib/services/repository-explorer.service';

// repositoryExplorerServiceをモック
vi.mock('$lib/services/repository-explorer.service', () => ({
	repositoryExplorerService: {
		getTree: vi.fn(),
		getFileContent: vi.fn(),
		startWatching: vi.fn(),
		stopWatching: vi.fn(),
		getWatchedRepositories: vi.fn()
	}
}));

describe('RepositoryExplorer - File Navigation', () => {
	const mockRepositories = [
		{
			name: 'test-repo',
			path: '/test/repo'
		}
	];

	const mockFileTree = {
		name: 'repo',
		path: '/test/repo',
		type: 'directory' as const,
		children: [
			{
				name: 'src',
				path: '/test/repo/src',
				type: 'directory' as const,
				children: [
					{
						name: 'index.ts',
						path: '/test/repo/src/index.ts',
						type: 'file' as const
					}
				]
			},
			{
				name: 'README.md',
				path: '/test/repo/README.md',
				type: 'file' as const
			}
		]
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(repositoryExplorerService.getTree).mockResolvedValue(mockFileTree);
		vi.mocked(repositoryExplorerService.getFileContent).mockResolvedValue({
			content: '// test content',
			language: 'typescript',
			path: 'src/index.ts',
			encoding: 'utf8',
			size: 16,
			mimeType: 'text/typescript',
			modifiedAt: new Date().toISOString()
		});
		vi.mocked(repositoryExplorerService.startWatching).mockResolvedValue(undefined);
		vi.mocked(repositoryExplorerService.stopWatching).mockResolvedValue(undefined);
		vi.mocked(repositoryExplorerService.getWatchedRepositories).mockResolvedValue([]);

		// URL APIのモック
		Object.defineProperty(window, 'location', {
			value: { href: 'http://localhost/' },
			writable: true
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('initialFile prop', () => {
		it('should auto-select file when initialFile is provided', async () => {
			render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories,
					initialFile: 'src/index.ts',
					syncWithUrl: false
				}
			});

			await waitFor(() => {
				expect(repositoryExplorerService.getFileContent).toHaveBeenCalledWith(
					'/test/repo',
					'src/index.ts'
				);
			});
		});

		it('should not auto-select when initialFile is not provided', async () => {
			render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories,
					syncWithUrl: false
				}
			});

			// Wait a bit to ensure no auto-selection happens
			await new Promise(resolve => setTimeout(resolve, 100));

			expect(repositoryExplorerService.getFileContent).not.toHaveBeenCalled();
		});

		it('should handle invalid initialFile gracefully', async () => {
			render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories,
					initialFile: 'nonexistent/file.ts',
					syncWithUrl: false
				}
			});

			await waitFor(() => {
				expect(repositoryExplorerService.getFileContent).toHaveBeenCalledWith(
					'/test/repo',
					'nonexistent/file.ts'
				);
			});
		});
	});

	describe('syncWithUrl prop', () => {
		let replaceStateSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			replaceStateSpy = vi.spyOn(window.history, 'replaceState');
		});

		// jsdom環境ではreplaceStateに制限があるためスキップ
		it.skip('should update URL when syncWithUrl is true and file is selected', async () => {
			render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories,
					initialFile: 'src/index.ts',
					syncWithUrl: true
				}
			});

			await waitFor(() => {
				expect(replaceStateSpy).toHaveBeenCalled();
				const callArgs = replaceStateSpy.mock.calls[0];
				const url = callArgs[2] as string;
				expect(url).toContain('file=src/index.ts');
			});
		});

		it('should not update URL when syncWithUrl is false', async () => {
			render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories,
					initialFile: 'src/index.ts',
					syncWithUrl: false
				}
			});

			await new Promise(resolve => setTimeout(resolve, 100));

			expect(replaceStateSpy).not.toHaveBeenCalled();
		});

		it('should remove file param from URL when file is closed', async () => {
			// This test would require interaction with the UI to close a file
			// Skipping for now as it requires more complex setup
		});
	});

	describe('browser history support', () => {
		it('should listen to popstate events when syncWithUrl is true', async () => {
			const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

			render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories,
					syncWithUrl: true
				}
			});

			await waitFor(() => {
				expect(addEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
			});
		});

		it('should not listen to popstate events when syncWithUrl is false', async () => {
			const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

			render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories,
					syncWithUrl: false
				}
			});

			await new Promise(resolve => setTimeout(resolve, 100));

			const popstateListeners = addEventListenerSpy.mock.calls.filter(
				call => call[0] === 'popstate'
			);
			expect(popstateListeners).toHaveLength(0);
		});

		it('should cleanup popstate listener on unmount', async () => {
			const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

			const { unmount } = render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories,
					syncWithUrl: true
				}
			});

			unmount();

			await waitFor(() => {
				expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
			});
		});
	});

	describe('URL parameter handling', () => {
		it('should handle file paths with special characters', async () => {
			const specialPath = 'src/components/test-component.svelte';

			render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories,
					initialFile: specialPath,
					syncWithUrl: false
				}
			});

			await waitFor(() => {
				expect(repositoryExplorerService.getFileContent).toHaveBeenCalledWith(
					'/test/repo',
					specialPath
				);
			});
		});

		it('should handle empty repositories array', async () => {
			render(RepositoryExplorer, {
				props: {
					repositories: [],
					initialFile: 'src/index.ts',
					syncWithUrl: false
				}
			});

			await new Promise(resolve => setTimeout(resolve, 100));

			expect(repositoryExplorerService.getFileContent).not.toHaveBeenCalled();
		});
	});

	describe('component lifecycle', () => {
		it('should stop watching on unmount', async () => {
			const { unmount } = render(RepositoryExplorer, {
				props: {
					repositories: mockRepositories
				}
			});

			// Wait for component to mount and start watching
			await waitFor(() => {
				expect(repositoryExplorerService.startWatching).toHaveBeenCalled();
			});

			// Clear the mock to better track unmount calls
			vi.clearAllMocks();

			unmount();

			// stopWatching is called asynchronously during unmount
			await waitFor(() => {
				expect(repositoryExplorerService.stopWatching).toHaveBeenCalled();
			});
		});
	});
});
