<script lang="ts">
	import type { TreeNode } from './types';
	import FileTreeNode from './FileTreeNode.svelte';
	import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-svelte';
	import { fileChangeStore } from '$lib/stores/file-changes.svelte';

	interface Props {
		node: TreeNode;
		repository: string;
		level?: number;
		onFileSelect: (repository: string, filePath: string) => void;
		selectedPath?: string;
	}

	let {
		node,
		repository,
		level = 0,
		onFileSelect,
		selectedPath
	}: Props = $props();

	let expanded = $state(false);

	// リポジトリが変更されたらfileChangeStoreに通知
	$effect(() => {
		if (repository) {
			fileChangeStore.setRepository(repository);
		}
	});

	function toggleExpanded() {
		if (node.type === 'directory') {
			expanded = !expanded;
		}
	}

	function handleClick() {
		if (node.type === 'file') {
			onFileSelect(repository, node.path);
		} else {
			toggleExpanded();
		}
	}

	function getFileIcon(fileName: string) {
		const ext = fileName.split('.').pop()?.toLowerCase();
		// 将来的にファイルタイプ別のアイコンを実装可能
		return File;
	}

	// Svelte 5では$derivedを使用
	let isSelected = $derived(node.type === 'file' && selectedPath === node.path);
	
	// ファイル変更インジケーター（リアクティブ）
	let changeIndicator = $derived((() => {
		const change = fileChangeStore.getChange(node.path);
		if (!change) return null;
		
		switch (change.operation) {
			case 'add': return '+';
			case 'change': return 'M';
			case 'delete': return 'D';
			case 'rename': return 'R';
			default: return null;
		}
	})());
	
	let changeClass = $derived((() => {
		const change = fileChangeStore.getChange(node.path);
		if (!change) return '';
		
		switch (change.operation) {
			case 'add': return 'file-added';
			case 'change': return 'file-modified';
			case 'delete': return 'file-deleted';
			case 'rename': return 'file-renamed';
			default: return '';
		}
	})());

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
	}
</script>

<div class="tree-node {changeClass}">
	<button
		class="node-content"
		class:selected={isSelected}
		onclick={handleClick}
		style="padding-left: {level * 16}px"
		type="button"
	>
		<span class="icon">
			{#if node.type === 'directory'}
				{#if expanded}
					<ChevronDown size={16} />
				{:else}
					<ChevronRight size={16} />
				{/if}
			{:else}
				<span style="width: 16px; display: inline-block;"></span>
			{/if}
		</span>
		
		<span class="icon">
			{#if node.type === 'directory'}
				{#if expanded}
					<FolderOpen size={16} />
				{:else}
					<Folder size={16} />
				{/if}
			{:else}
				{@const IconComponent = getFileIcon(node.name)}
				<IconComponent size={16} />
			{/if}
		</span>
		
		{#if changeIndicator}
			<span class="change-indicator change-type-{changeIndicator === '+' ? 'add' : changeIndicator?.toLowerCase()}">
				[{changeIndicator}]
			</span>
		{/if}
		
		<span class="name" title={node.path}>
			{node.name}
		</span>
		
		{#if node.type === 'file' && node.size !== undefined}
			<span class="size">
				{formatFileSize(node.size)}
			</span>
		{/if}
	</button>
	
	{#if node.type === 'directory' && expanded && node.children}
		<div class="children">
			{#each node.children as child}
				<FileTreeNode 
					node={child}
					{repository}
					level={level + 1}
					{onFileSelect}
					{selectedPath}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.tree-node {
		user-select: none;
	}
	
	.node-content {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 2px 8px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		font-size: 13px;
		line-height: 22px;
		color: var(--color-text-primary);
		transition: background-color 0.1s;
	}
	
	.node-content:hover {
		background-color: var(--color-bg-hover);
	}
	
	.node-content.selected {
		background-color: var(--color-bg-selected);
		color: var(--color-text-selected);
	}
	
	.icon {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}
	
	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.size {
		margin-left: auto;
		padding-left: 8px;
		font-size: 11px;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}
	
	.children {
		position: relative;
	}
	
	/* 変更インジケーター */
	.change-indicator {
		display: inline-block;
		margin-right: 6px;
		font-weight: bold;
		font-family: monospace;
		font-size: 12px;
	}
	
	/* 変更インジケーターの基本スタイル */
	.change-indicator {
		font-weight: bold;
		font-size: 12px;
		margin-right: 4px;
	}
	
	/* 追加されたファイル */
	.change-indicator.change-type-add { 
		color: #22c55e;
	}
	
	/* 変更されたファイル */
	.change-indicator.change-type-m { 
		color: #eab308;
	}
	
	/* 削除されたファイル */
	.change-indicator.change-type-d { 
		color: #ef4444;
	}
	
	/* リネームされたファイル */
	.change-indicator.change-type-r { 
		color: #3b82f6;
	}
	
	/* 変更されたファイル/ディレクトリの背景色 */
	.tree-node.file-added {
		animation: fadeIn 0.3s ease-in;
		background-color: rgba(34, 197, 94, 0.05);
	}
	
	.tree-node.file-modified {
		background-color: rgba(234, 179, 8, 0.05);
	}
	
	.tree-node.file-deleted {
		opacity: 0.6;
		text-decoration: line-through;
		background-color: rgba(239, 68, 68, 0.05);
	}
	
	.tree-node.file-renamed {
		background-color: rgba(59, 130, 246, 0.05);
	}
	
	@keyframes fadeIn {
		from { opacity: 0; transform: translateX(-10px); }
		to { opacity: 1; transform: translateX(0); }
	}
	
	:global(:root) {
		--color-text-primary: #333;
		--color-text-secondary: #666;
		--color-text-selected: #fff;
		--color-bg-hover: rgba(0, 0, 0, 0.05);
		--color-bg-selected: #007acc;
	}
	
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--color-text-primary: #ccc;
			--color-text-secondary: #999;
			--color-text-selected: #fff;
			--color-bg-hover: rgba(255, 255, 255, 0.05);
			--color-bg-selected: #007acc;
		}
	}
</style>