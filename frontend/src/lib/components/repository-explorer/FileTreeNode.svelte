<script lang="ts">
	import type { TreeNode } from './types';
	import FileTreeNode from './FileTreeNode.svelte';
	import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-svelte';

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

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
	}
</script>

<div class="tree-node">
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