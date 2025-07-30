// Buttonコンポーネントのテスト（Svelte 5対応）
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Button from './button.svelte';
import TestHelper from '$lib/test-utils/component-test-helper.svelte';

describe('Button', () => {
	it('基本的なレンダリング', () => {
		const { getByRole } = render(Button, {
			props: {}
		});
		
		const button = getByRole('button');
		expect(button).toBeInTheDocument();
	});
	
	it('テキストコンテンツを表示', () => {
		const { getByText } = render(TestHelper, {
			props: {
				component: Button,
				children: 'Click me'
			}
		});
		
		expect(getByText('Click me')).toBeInTheDocument();
	});
	
	it('クリックイベントを発火', async () => {
		let clicked = false;
		const { getByRole } = render(Button, {
			props: {
				onclick: () => { clicked = true; }
			}
		});
		
		const button = getByRole('button');
		await fireEvent.click(button);
		
		expect(clicked).toBe(true);
	});
	
	it('disabledプロパティが機能', () => {
		const { getByRole } = render(Button, {
			props: {
				disabled: true
			}
		});
		
		const button = getByRole('button');
		expect(button).toBeDisabled();
	});
	
	it('variantプロパティでスタイルを変更', () => {
		const { getByRole } = render(Button, {
			props: {
				variant: 'destructive'
			}
		});
		
		const button = getByRole('button');
		expect(button.className).toContain('destructive');
	});
	
	it('sizeプロパティでサイズを変更', () => {
		const { container } = render(Button, {
			props: {
				size: 'sm'
			}
		});
		
		// Buttonコンポーネントの実装を確認して、
		// 実際に適用されるクラスをテスト
		const button = container.querySelector('button');
		expect(button).toBeTruthy();
		// size='sm'の場合のスタイルが適用されているか確認
		expect(button?.className).toMatch(/h-8/);
	});
	
	it('hrefプロパティでリンクとして機能', () => {
		const { getByRole } = render(Button, {
			props: {
				href: '/test'
			}
		});
		
		const link = getByRole('link');
		expect(link).toHaveAttribute('href', '/test');
	});
});