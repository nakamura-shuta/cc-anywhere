// Svelte 5 準拠のButtonコンポーネントテスト
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Button from './button.svelte';
import ButtonTestWrapper from '$lib/test-utils/button-test-wrapper.svelte';

describe('Button - Svelte 5 Testing', () => {
	describe('レンダリング', () => {
		it('デフォルトのボタンをレンダリング', () => {
			const { getByRole } = render(Button);
			
			const button = getByRole('button');
			expect(button).toBeInTheDocument();
			expect(button).toHaveAttribute('type', 'button');
			expect(button).toHaveAttribute('data-slot', 'button');
		});
		
		it('スロットコンテンツを表示', () => {
			const { getByRole } = render(ButtonTestWrapper, {
				props: {
					slotContent: 'Click me'
				}
			});
			
			const button = getByRole('button');
			expect(button).toHaveTextContent('Click me');
		});
		
		it('複雑なスロットコンテンツ', () => {
			const { container } = render(ButtonTestWrapper, {
				props: {
					complexSlot: true
				}
			});
			
			const button = container.querySelector('button');
			expect(button).toBeInTheDocument();
			expect(button?.querySelector('.icon')).toBeInTheDocument();
			expect(button?.textContent).toContain('Icon');
			expect(button?.textContent).toContain('Button Text');
		});
	});
	
	describe('プロパティ', () => {
		it('variantプロパティが適用される', () => {
			const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
			
			variants.forEach(variant => {
				const { container } = render(Button, {
					props: { variant }
				});
				
				const button = container.querySelector('button');
				// variantに応じたクラスが適用されているか確認
				if (variant === 'destructive') {
					expect(button?.className).toContain('destructive');
				} else if (variant === 'outline') {
					expect(button?.className).toContain('border');
				}
			});
		});
		
		it('sizeプロパティが適用される', () => {
			const sizes = [
				{ size: 'default', class: 'h-9' },
				{ size: 'sm', class: 'h-8' },
				{ size: 'lg', class: 'h-10' },
				{ size: 'icon', class: 'size-9' }
			] as const;
			
			sizes.forEach(({ size, class: expectedClass }) => {
				const { container } = render(Button, {
					props: { size }
				});
				
				const button = container.querySelector('button');
				expect(button?.className).toContain(expectedClass);
			});
		});
		
		it('カスタムクラスが追加される', () => {
			const { container } = render(Button, {
				props: { class: 'custom-class' }
			});
			
			const button = container.querySelector('button');
			expect(button?.className).toContain('custom-class');
		});
		
		it('disabled状態が正しく適用される', () => {
			const { getByRole } = render(Button, {
				props: { disabled: true }
			});
			
			const button = getByRole('button');
			expect(button).toBeDisabled();
			expect(button.className).toContain('disabled:pointer-events-none');
			expect(button.className).toContain('disabled:opacity-50');
		});
	});
	
	describe('イベントハンドリング', () => {
		it('クリックイベントが発火する', async () => {
			const handleClick = vi.fn();
			const { getByRole } = render(Button, {
				props: { onclick: handleClick }
			});
			
			const button = getByRole('button');
			await fireEvent.click(button);
			
			expect(handleClick).toHaveBeenCalledTimes(1);
		});
		
		it('disabled時はクリックイベントが発火しない', async () => {
			const handleClick = vi.fn();
			const { getByRole } = render(Button, {
				props: { 
					onclick: handleClick,
					disabled: true
				}
			});
			
			const button = getByRole('button');
			await fireEvent.click(button);
			
			expect(handleClick).not.toHaveBeenCalled();
		});
		
		it('userEventでの複雑なインタラクション', async () => {
			const user = userEvent.setup();
			const handleClick = vi.fn();
			const handleFocus = vi.fn();
			const handleBlur = vi.fn();
			
			render(Button, {
				props: {
					onclick: handleClick,
					onfocus: handleFocus,
					onblur: handleBlur
				}
			});
			
			// タブでフォーカス
			await user.tab();
			expect(handleFocus).toHaveBeenCalled();
			
			// Enterキーでクリック
			await user.keyboard('{Enter}');
			expect(handleClick).toHaveBeenCalled();
			
			// タブでフォーカスを外す
			await user.tab();
			expect(handleBlur).toHaveBeenCalled();
		});
	});
	
	describe('リンクとしての動作', () => {
		it('hrefが指定されるとリンクとしてレンダリング', () => {
			const { getByRole } = render(Button, {
				props: { href: '/test' }
			});
			
			const link = getByRole('link');
			expect(link).toHaveAttribute('href', '/test');
			expect(link).toHaveAttribute('data-slot', 'button');
		});
		
		it('disabled時はhrefが無効になる', () => {
			const { container } = render(Button, {
				props: { 
					href: '/test',
					disabled: true
				}
			});
			
			const link = container.querySelector('a');
			expect(link).not.toHaveAttribute('href');
			expect(link).toHaveAttribute('aria-disabled', 'true');
			expect(link).toHaveAttribute('role', 'link');
			expect(link).toHaveAttribute('tabindex', '-1');
		});
	});
	
	describe('アクセシビリティ', () => {
		it('適切なARIA属性が設定される', () => {
			const { getByRole } = render(Button, {
				props: {
					'aria-label': 'Save document',
					'aria-pressed': true
				}
			});
			
			const button = getByRole('button');
			expect(button).toHaveAttribute('aria-label', 'Save document');
			expect(button).toHaveAttribute('aria-pressed', 'true');
		});
		
		it('フォーカス可能でキーボード操作が可能', async () => {
			const user = userEvent.setup();
			const handleClick = vi.fn();
			
			const { getByRole } = render(Button, {
				props: { onclick: handleClick }
			});
			
			const button = getByRole('button');
			
			// フォーカス可能
			button.focus();
			expect(document.activeElement).toBe(button);
			
			// スペースキーでクリック
			await user.keyboard(' ');
			expect(handleClick).toHaveBeenCalled();
		});
	});
});