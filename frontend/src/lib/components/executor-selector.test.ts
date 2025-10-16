import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ExecutorSelector from './executor-selector.svelte';

describe('ExecutorSelector', () => {
	beforeEach(() => {
		// Mock fetch for API calls
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						executors: [
							{
								type: 'claude',
								available: true,
								description: 'Claude Agent SDK - Official Anthropic agent framework'
							},
							{
								type: 'codex',
								available: false,
								description: 'OpenAI Codex SDK - AI coding assistant'
							}
						]
					})
			} as Response)
		);
	});

	it('should render with default label', async () => {
		render(ExecutorSelector, {
			props: {
				showLabel: true
			}
		});

		// Label should be visible
		expect(screen.getByText('Executor')).toBeInTheDocument();
	});

	it('should show loading state initially', () => {
		render(ExecutorSelector, {
			props: {
				showLabel: false
			}
		});

		// Should show loading state
		expect(screen.getByText('読み込み中...')).toBeInTheDocument();
	});

	it('should call API to fetch executors', async () => {
		render(ExecutorSelector, {
			props: {}
		});

		// Wait for API call
		await vi.waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/executors',
				expect.objectContaining({
					headers: expect.objectContaining({
						'Content-Type': 'application/json'
					})
				})
			);
		});
	});
});
