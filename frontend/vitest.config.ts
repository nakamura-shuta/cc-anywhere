import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss(), svelteTesting()] as any,
	test: {
		// テスト環境
		environment: 'jsdom',
		
		// グローバル設定
		globals: true,
		
		// セットアップファイル
		setupFiles: ['./vitest-setup.ts'],
		
		// インクルードパターン
		include: ['src/**/*.{test,spec}.{js,ts}', 'src/**/*.svelte.test.{js,ts}'],
		
		// カバレッジ設定
		coverage: {
			reporter: ['text', 'html'],
			exclude: [
				'node_modules/',
				'src/app.d.ts',
			]
		}
	},
	resolve: {
		conditions: ['browser']
	}
});