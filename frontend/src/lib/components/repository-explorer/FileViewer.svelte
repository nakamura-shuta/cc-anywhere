<script lang="ts">
	import type { FileContent } from './types';
	import { repositoryExplorerService } from '$lib/services/repository-explorer.service';
	import { onMount } from 'svelte';
	import { Loader2, X, Download, Copy, Check } from 'lucide-svelte';
	import '$lib/types/prism.d.ts';
	
	interface Props {
		repository: string;
		filePath: string;
		onClose?: () => void;
	}

	let { repository, filePath, onClose }: Props = $props();
	
	let content = $state<FileContent | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let copied = $state(false);
	let codeElement = $state<HTMLElement>();

	// ファイル内容の取得
	$effect(() => {
		if (repository && filePath) {
			loadFileContent();
		}
	});

	async function loadFileContent() {
		loading = true;
		error = null;
		
		try {
			content = await repositoryExplorerService.getFileContent(repository, filePath);
		} catch (err) {
			console.error('Failed to load file content:', err);
			error = err instanceof Error ? err.message : 'Failed to load file content';
		} finally {
			loading = false;
		}
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
			style.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
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
				<div class="code-wrapper">
					<pre class="line-numbers"><code 
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
		background: var(--color-bg-primary);
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
	
	.viewer-content {
		flex: 1;
		overflow: auto;
		position: relative;
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
		background: var(--color-bg-pattern);
	}
	
	.image-preview img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
	
	.code-wrapper {
		position: relative;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 13px;
		line-height: 1.5;
	}
	
	.code-wrapper pre {
		margin: 0;
		padding: 16px;
		overflow: auto;
		background: var(--color-bg-code);
	}
	
	.code-wrapper code {
		display: block;
		background: none;
		font-family: inherit;
	}
	
	/* Line numbers styling */
	.line-numbers {
		counter-reset: line;
	}
	
	.line-numbers code {
		counter-increment: line;
		position: relative;
		padding-left: 3.5em;
	}
	
	.line-numbers code::before {
		content: counter(line);
		position: absolute;
		left: 0;
		width: 2.5em;
		padding-right: 0.5em;
		text-align: right;
		color: var(--color-text-muted);
		border-right: 1px solid var(--color-border);
		user-select: none;
	}
	
	:global(.spinner) {
		animation: spin 1s linear infinite;
	}
	
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	
	:global(:root) {
		--color-bg-primary: #fff;
		--color-bg-secondary: #f5f5f5;
		--color-bg-code: #f8f8f8;
		--color-bg-pattern: repeating-conic-gradient(#f0f0f0 0% 25%, transparent 0% 50%) 50% / 20px 20px;
		--color-bg-hover: rgba(0, 0, 0, 0.05);
		--color-border: #e0e0e0;
		--color-text-primary: #333;
		--color-text-secondary: #666;
		--color-text-muted: #999;
		--color-text-error: #d00;
	}
	
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--color-bg-primary: #1e1e1e;
			--color-bg-secondary: #252525;
			--color-bg-code: #1a1a1a;
			--color-bg-pattern: repeating-conic-gradient(#2a2a2a 0% 25%, transparent 0% 50%) 50% / 20px 20px;
			--color-bg-hover: rgba(255, 255, 255, 0.05);
			--color-border: #3a3a3a;
			--color-text-primary: #ccc;
			--color-text-secondary: #999;
			--color-text-muted: #666;
			--color-text-error: #f44;
		}
	}
</style>