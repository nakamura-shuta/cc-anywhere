<script lang="ts">
	import type { FileContent } from './types';
	import { repositoryExplorerService } from '$lib/services/repository-explorer.service';
	import { getRepositoryFileChangesStore } from '$lib/stores/repository-file-changes.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { Loader2, X, Download, Copy, Check, RefreshCw } from 'lucide-svelte';
	import '$lib/types/prism.d.ts';
	
	interface Props {
		repository: string;
		filePath: string;
		onClose?: () => void;
	}

	let { repository, filePath, onClose }: Props = $props();
	
	// ファイル変更通知ストア
	const fileChangesStore = getRepositoryFileChangesStore();
	let fileChangeCleanup: (() => void) | null = null;
	
	let content = $state<FileContent | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let copied = $state(false);
	let codeElement = $state<HTMLElement>();
	let hasFileChanged = $state(false);

	// ファイル内容の取得
	$effect(() => {
		if (repository && filePath) {
			loadFileContent();
		}
	});

	// ファイル変更通知の監視
	$effect(() => {
		if (repository && filePath) {
			// 既存のリスナーをクリーンアップ
			if (fileChangeCleanup) {
				fileChangeCleanup();
			}

			// 新しいリスナーを設定
			fileChangeCleanup = fileChangesStore.onRepositoryChange(repository, (event) => {
				// 現在表示中のファイルが変更された場合
				if (event.path === filePath && (event.type === 'changed' || event.type === 'removed')) {
					console.log('Current file changed:', event);
					hasFileChanged = true;
					
					if (event.type === 'removed') {
						error = 'File has been removed';
						content = null;
					}
				}
			});
		}
		
		// リポジトリの監視を開始
		startWatchingRepository();
	});

	onDestroy(() => {
		if (fileChangeCleanup) {
			fileChangeCleanup();
		}
	});

	async function loadFileContent() {
		loading = true;
		error = null;
		hasFileChanged = false;
		
		try {
			content = await repositoryExplorerService.getFileContent(repository, filePath);
		} catch (err) {
			console.error('Failed to load file content:', err);
			error = err instanceof Error ? err.message : 'Failed to load file content';
		} finally {
			loading = false;
		}
	}

	async function startWatchingRepository() {
		try {
			await repositoryExplorerService.startWatching(repository);
			console.log('Started watching repository:', repository);
		} catch (err) {
			console.warn('Failed to start watching repository:', err);
		}
	}

	function reloadFile() {
		loadFileContent();
	}

	async function copyToClipboard() {
		if (!content) return;
		
		try {
			await navigator.clipboard.writeText(
				content.encoding === 'base64' 
					? `[Base64 encoded file: ${content.size} bytes]`
					: content.content
			);
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch (err) {
			console.error('Failed to copy to clipboard:', err);
		}
	}

	function downloadFile() {
		if (!content) return;
		
		const blob = content.encoding === 'base64'
			? new Blob([Uint8Array.from(atob(content.content), c => c.charCodeAt(0))], { type: content.mimeType })
			: new Blob([content.content], { type: 'text/plain' });
		
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filePath.split('/').pop() || 'download';
		a.click();
		URL.revokeObjectURL(url);
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	// Prism.jsを動的にロード（シンタックスハイライト用）
	onMount(async () => {
		if (typeof window !== 'undefined' && !window.Prism) {
			const script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js';
			script.onload = () => {
				// 言語サポートを追加
				const langs = ['javascript', 'typescript', 'python', 'java', 'css', 'json', 'bash', 'yaml', 'markdown'];
				langs.forEach(lang => {
					const langScript = document.createElement('script');
					langScript.src = `https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-${lang}.min.js`;
					document.head.appendChild(langScript);
				});
			};
			document.head.appendChild(script);
			
			const style = document.createElement('link');
			style.rel = 'stylesheet';
			style.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css';
			document.head.appendChild(style);
		}
	});

	// シンタックスハイライトを適用
	$effect(() => {
		if (content && codeElement && window.Prism && content.encoding === 'utf8') {
			window.Prism.highlightElement(codeElement);
		}
	});
</script>

<svelte:window />

<div class="file-viewer">
	<div class="viewer-header">
		<div class="file-info">
			<span class="file-path" title={filePath}>{filePath}</span>
			{#if content}
				<span class="file-meta">
					{formatFileSize(content.size)} • {content.language || content.mimeType} • {formatDate(content.modifiedAt)}
				</span>
			{/if}
		</div>
		<div class="viewer-actions">
			{#if hasFileChanged}
				<button 
					class="action-button file-changed" 
					onclick={reloadFile}
					title="File has been changed. Click to reload"
					type="button"
				>
					<RefreshCw size={16} />
				</button>
			{/if}
			<button 
				class="action-button" 
				onclick={copyToClipboard}
				title="Copy to clipboard"
				disabled={!content || content.encoding !== 'utf8'}
				type="button"
			>
				{#if copied}
					<Check size={16} />
				{:else}
					<Copy size={16} />
				{/if}
			</button>
			<button 
				class="action-button" 
				onclick={downloadFile}
				title="Download file"
				disabled={!content}
				type="button"
			>
				<Download size={16} />
			</button>
			{#if onClose}
				<button 
					class="action-button" 
					onclick={onClose}
					title="Close"
					type="button"
				>
					<X size={16} />
				</button>
			{/if}
		</div>
	</div>
	
	<div class="viewer-content">
		{#if loading}
			<div class="loading-state">
				<Loader2 size={24} class="spinner" />
				<span>Loading file content...</span>
			</div>
		{:else if error}
			<div class="error-state">
				<span>Error: {error}</span>
				<button 
					class="retry-button" 
					onclick={loadFileContent}
					type="button"
				>
					Retry
				</button>
			</div>
		{:else if content}
			{#if content.encoding === 'base64'}
				{#if content.mimeType.startsWith('image/')}
					<div class="image-preview">
						<img 
							src="data:{content.mimeType};base64,{content.content}" 
							alt={filePath}
						/>
					</div>
				{:else}
					<div class="binary-preview">
						<p>Binary file ({content.mimeType})</p>
						<p>Size: {formatFileSize(content.size)}</p>
						<button 
							class="download-button" 
							onclick={downloadFile}
							type="button"
						>
							Download File
						</button>
					</div>
				{/if}
			{:else}
				<div class="code-container">
					<pre><code 
						bind:this={codeElement}
						class="language-{content.language || 'text'}"
					>{content.content}</code></pre>
				</div>
			{/if}
		{:else}
			<div class="empty-state">
				Select a file to view its contents
			</div>
		{/if}
	</div>
</div>

<style>
	.file-viewer {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		overflow: hidden;
	}
	
	.viewer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-bg-secondary);
		min-height: 40px;
	}
	
	.file-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow: hidden;
	}
	
	.file-path {
		font-size: 14px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.file-meta {
		font-size: 12px;
		color: var(--color-text-secondary);
	}
	
	.viewer-actions {
		display: flex;
		gap: 4px;
	}
	
	.action-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--color-text-primary);
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.1s;
	}
	
	.action-button:hover:not(:disabled) {
		background: var(--color-bg-hover);
	}
	
	.action-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.action-button.file-changed {
		background: #fbbf24;
		color: #92400e;
		animation: pulse 2s infinite;
	}
	
	.action-button.file-changed:hover {
		background: #f59e0b;
	}
	
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}
	
	.viewer-content {
		flex: 1;
		overflow: auto;
	}
	
	.loading-state,
	.error-state,
	.empty-state,
	.binary-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 16px;
		padding: 32px;
		text-align: center;
		color: var(--color-text-secondary);
	}
	
	.error-state {
		color: var(--color-text-error);
	}
	
	.retry-button,
	.download-button {
		padding: 6px 12px;
		border: 1px solid currentColor;
		background: transparent;
		color: inherit;
		font-size: 13px;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.1s;
	}
	
	.retry-button:hover,
	.download-button:hover {
		background: rgba(0, 0, 0, 0.05);
	}
	
	.image-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		height: 100%;
		background: repeating-conic-gradient(#f0f0f0 0% 25%, transparent 0% 50%) 50% / 20px 20px;
	}
	
	.image-preview img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
	
	.code-container {
		padding: 16px;
		background: var(--color-bg-code);
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}
	
	.code-container pre {
		margin: 0;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 13px;
		line-height: 1.5;
		white-space: pre;
		overflow-x: auto;
	}
	
	.code-container code {
		color: var(--color-text-primary);
	}
	
	/* Prismテーマのオーバーライド */
	.code-container :global(.token.comment),
	.code-container :global(.token.prolog),
	.code-container :global(.token.doctype),
	.code-container :global(.token.cdata) {
		color: #6b7280 !important;
	}
	
	.code-container :global(.token.string),
	.code-container :global(.token.attr-value) {
		color: #059669 !important;
	}
	
	.code-container :global(.token.keyword),
	.code-container :global(.token.control),
	.code-container :global(.token.directive),
	.code-container :global(.token.unit) {
		color: #7c3aed !important;
	}
	
	.code-container :global(.token.function),
	.code-container :global(.token.class-name) {
		color: #2563eb !important;
	}
	
	.code-container :global(.token.operator),
	.code-container :global(.token.punctuation) {
		color: #374151 !important;
	}
	
	:global(.spinner) {
		animation: spin 1s linear infinite;
	}
	
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	
	:global(:root) {
		--color-bg-secondary: #f9fafb;
		--color-bg-code: #fcfcfc;
		--color-bg-hover: rgba(0, 0, 0, 0.03);
		--color-border: #d1d5db;
		--color-text-primary: #111827;
		--color-text-secondary: #4b5563;
		--color-text-error: #dc2626;
	}
	
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--color-bg-secondary: #111827;
			--color-bg-code: #1f2937;
			--color-bg-hover: rgba(255, 255, 255, 0.05);
			--color-border: #374151;
			--color-text-primary: #f3f4f6;
			--color-text-secondary: #9ca3af;
			--color-text-error: #ef4444;
		}
	}
</style>