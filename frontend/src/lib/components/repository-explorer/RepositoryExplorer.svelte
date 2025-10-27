<script lang="ts">
	import type { RepositoryExplorerProps } from './types';
	import FileTree from './FileTree.svelte';
	import FileViewer from './FileViewer.svelte';
	import { X, PanelRightClose, PanelRightOpen } from 'lucide-svelte';

	interface Props extends RepositoryExplorerProps {}

	let {
		repositories = [],
		position = 'bottom',
		layout = 'horizontal',
		showHeader = true,
		collapsible = false,
		onFileSelect,
		initialFile = undefined,
		syncWithUrl = false
	}: Props = $props();

	let selectedFile = $state<{ repository: string; path: string } | undefined>(undefined);
	let collapsed = $state(false);

	// 初期ファイルの自動選択
	$effect(() => {
		if (!initialFile || repositories.length === 0) return;

		// デフォルトで最初のリポジトリを使用
		const repository = repositories[0].path;

		// initialFile が変化したら必ず選択を更新する
		if (!selectedFile || selectedFile.path !== initialFile || selectedFile.repository !== repository) {
			console.log('Auto-selecting initial file:', initialFile);
			handleFileSelect(repository, initialFile);
		}
	});

	// URL同期（オプション）
	$effect(() => {
		if (syncWithUrl && selectedFile && typeof window !== 'undefined') {
			const url = new URL(window.location.href);

			if (selectedFile.path) {
				url.searchParams.set('file', selectedFile.path);
			} else {
				url.searchParams.delete('file');
			}

			// replaceStateを使用して履歴を汚染しない
			window.history.replaceState({}, '', url);
		}
	});

	// ブラウザの戻る/進むボタンへの対応
	$effect(() => {
		if (typeof window === 'undefined' || !syncWithUrl) return;

		const handlePopState = () => {
			const urlParams = new URL(window.location.href).searchParams;
			const fileParam = urlParams.get('file');

			if (fileParam && repositories.length > 0) {
				const repository = repositories[0].path;
				handleFileSelect(repository, fileParam);
			} else {
				selectedFile = undefined;
			}
		};

		window.addEventListener('popstate', handlePopState);

		return () => {
			window.removeEventListener('popstate', handlePopState);
		};
	});

	function handleFileSelect(repository: string, filePath: string) {
		selectedFile = { repository, path: filePath };
		onFileSelect?.(repository, filePath);
	}

	function handleClose() {
		selectedFile = undefined;
	}

	function toggleCollapse() {
		collapsed = !collapsed;
	}
</script>

<div 
	class="flex flex-col h-full bg-background border rounded-lg overflow-hidden transition-all duration-300"
	class:max-h-[50vh]={position === 'bottom'}
	class:w-full={position === 'side'}
	class:fixed={position === 'modal'}
	class:h-auto={collapsed}
>
	{#if showHeader}
		<div class="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
			<h3 class="text-sm font-semibold">Repository Explorer</h3>
			<div class="flex gap-1">
				{#if collapsible}
					<button 
						class="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
						onclick={toggleCollapse}
						title={collapsed ? 'Expand' : 'Collapse'}
						type="button"
					>
						{#if collapsed}
							<PanelRightOpen size={16} />
						{:else}
							<PanelRightClose size={16} />
						{/if}
					</button>
				{/if}
			</div>
		</div>
	{/if}

	{#if !collapsed}
		<div class="flex-1 flex overflow-hidden min-h-0">
			<div class="w-[300px] min-w-[200px] max-w-[50%] border-r overflow-hidden flex flex-col">
				<FileTree
					{repositories}
					onFileSelect={handleFileSelect}
					{selectedFile}
				/>
			</div>

			{#if selectedFile}
				<div class="flex-1 min-w-0 overflow-hidden">
					<FileViewer
						repository={selectedFile.repository}
						filePath={selectedFile.path}
						onClose={handleClose}
					/>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* モバイルレスポンシブ */
	@media (max-width: 768px) {
		.flex-1.flex > div:first-child {
			width: 100%;
			max-width: none;
			height: 200px;
			border-right: none;
			border-bottom: 1px solid hsl(var(--border));
		}

		.flex-1.flex {
			flex-direction: column;
		}
	}
</style>
