// Svelte 5 テストユーティリティ
import { flushSync } from 'svelte';
import type { Component } from 'svelte';

/**
 * Svelte 5のコンポーネントテスト用ユーティリティ
 */

// スロット付きコンポーネントのテスト用ヘルパー
export function createSlotProps(content: string | Component) {
	if (typeof content === 'string') {
		return {
			children: () => content
		};
	}
	return {
		children: content
	};
}

// 状態の更新を同期的にフラッシュ
export function flushUpdates() {
	flushSync();
}

// $effect のテスト用ルート作成
export function createEffectRoot(fn: () => void | (() => void)) {
	// Svelte 5では $effect.root() を使用
	// @ts-ignore - $effectはコンパイル時の構文
	return $effect.root(fn);
}

// コンポーネントのマウント/アンマウントヘルパー
export function mountComponent<T extends Record<string, any>>(
	Component: Component<T>,
	props: T,
	target: HTMLElement
) {
	// Svelte 5のmount APIを使用
	// @ts-ignore - mountはsvelte/internalからインポートされる
	return mount(Component, {
		target,
		props
	});
}

// テスト用のリアクティブな値の作成
export function createTestState<T>(initialValue: T) {
	// @ts-ignore - $stateはコンパイル時の構文
	let value = $state(initialValue);
	
	return {
		get current() { return value; },
		set current(newValue: T) { value = newValue; }
	};
}

// イベントハンドラのモック作成
export function createEventHandlerMock() {
	const calls: any[] = [];
	const handler = (event: any) => {
		calls.push(event);
	};
	
	handler.calls = calls;
	handler.wasCalled = () => calls.length > 0;
	handler.wasCalledWith = (matcher: (event: any) => boolean) => 
		calls.some(matcher);
	handler.reset = () => calls.length = 0;
	
	return handler;
}

// 非同期状態更新を待つヘルパー
export async function waitForUpdates() {
	// Svelte 5では、tick()を使用
	const { tick } = await import('svelte');
	await tick();
}

// コンポーネントのプロップス更新ヘルパー
export function updateProps<T extends Record<string, any>>(
	component: any,
	newProps: Partial<T>
) {
	// Svelte 5ではプロップスは直接更新可能
	Object.assign(component, newProps);
	flushSync();
}