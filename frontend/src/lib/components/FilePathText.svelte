<script lang="ts">
	import { convertFilePathsToLinks } from '$lib/utils/file-path-linker';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	interface Props {
		text: string;
		taskId: string;
		projectRoot?: string;
		class?: string;
	}

	let { text, taskId, projectRoot, class: className = '' }: Props = $props();

	// テキストをHTMLに変換（ファイルパスをリンク化）
	const html = $derived(convertFilePathsToLinks(text, taskId, projectRoot));

	let containerElement: HTMLSpanElement;

	// クリックイベントのハンドラー
	function handleClick(event: MouseEvent) {
		const target = event.target as HTMLElement;

		// クリックされた要素が.file-path-linkクラスを持つ<a>タグか確認
		if (target.tagName === 'A' && target.classList.contains('file-path-link')) {
			event.preventDefault(); // デフォルトのページ遷移を防ぐ

			const href = target.getAttribute('href');
			if (href) {
				// SvelteKitのgoto()でクライアントサイドナビゲーション
				goto(href, { keepFocus: false, replaceState: false });
			}
		}
	}

	// マウント時にイベントリスナーを設定
	onMount(() => {
		if (containerElement) {
			containerElement.addEventListener('click', handleClick);
		}

		// クリーンアップ
		return () => {
			if (containerElement) {
				containerElement.removeEventListener('click', handleClick);
			}
		};
	});
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<span class="file-path-text {className}" data-testid="file-path-text" bind:this={containerElement}>
	{@html html}
</span>

<style>
	:global(.file-path-text .file-path-link) {
		color: hsl(var(--primary));
		text-decoration: underline;
		cursor: pointer;
		transition: color 0.2s;
	}

	:global(.file-path-text .file-path-link:hover) {
		color: hsl(var(--primary) / 0.8);
		text-decoration: underline;
	}

	:global(.file-path-text .file-path-link:visited) {
		color: hsl(var(--primary) / 0.7);
	}
</style>
