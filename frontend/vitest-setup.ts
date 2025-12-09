// Vitestセットアップファイル
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// SvelteKitのモックセットアップ
vi.mock('$app/environment', () => ({
	browser: true,
	dev: true,
	building: false,
	version: 'test'
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	replaceState: vi.fn(),
	pushState: vi.fn(),
	preloadData: vi.fn(),
	preloadCode: vi.fn(),
	beforeNavigate: vi.fn(),
	afterNavigate: vi.fn()
}));

vi.mock('$app/stores', () => {
	const readable = (value: any) => ({
		subscribe: (fn: (value: any) => void) => {
			fn(value);
			return () => {};
		}
	});
	
	return {
		page: readable({
			url: new URL('http://localhost'),
			params: {},
			route: { id: '/' },
			status: 200,
			error: null,
			data: {},
			form: undefined
		}),
		navigating: readable(null),
		updated: readable(false)
	};
});

// グローバルなfetchのモック
(globalThis as any).fetch = vi.fn();

// WebSocketのモック
(globalThis as any).WebSocket = vi.fn(() => ({
	send: vi.fn(),
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
}));

// localStorageのモック
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
};
(globalThis as any).localStorage = localStorageMock;