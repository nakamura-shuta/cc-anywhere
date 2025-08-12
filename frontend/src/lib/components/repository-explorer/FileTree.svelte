<script lang="ts">
	import type { TreeNode } from './types';
	import FileTreeNode from './FileTreeNode.svelte';
	import { repositoryExplorerService } from '$lib/services/repository-explorer.service';
	import { fileChangeStore } from '$lib/stores/file-changes.svelte';
	import { getRepositoryFileChangesStore } from '$lib/stores/repository-file-changes.svelte';
	import { getDeletedFilesStore } from '$lib/stores/deleted-files.svelte';
	import { Loader2, FolderOpen, AlertCircle, ChevronDown, ChevronRight } from 'lucide-svelte';

	interface Props {
		repositories: Array<{ name: string; path: string }>;
		onFileSelect: (repository: string, filePath: string) => void;
		selectedFile?: { repository: string; path: string };
	}

	let { 
		repositories, 
		onFileSelect,
		selectedFile
	}: Props = $props();

	let trees = $state<Record<string, TreeNode>>({});
	let loading = $state<Record<string, boolean>>({});
	let errors = $state<Record<string, string>>({});
	let expanded = $state<Record<string, boolean>>({});
	let loadedRepositories = new Set<string>();
	
	// リポジトリファイル変更ストアを取得
	const repositoryFileChangesStore = getRepositoryFileChangesStore();

	// パスを短縮表示する関数
	function formatPath(path: string): string {
		// Homeディレクトリのパターンを短縮
		if (path.startsWith('/Users/')) {
			const parts = path.split('/');
			if (parts.length >= 3) {
				path = `~/${parts.slice(3).join('/')}`;
			}
		} else if (path.startsWith('/home/')) {
			const parts = path.split('/');
			if (parts.length >= 3) {
				path = `~/${parts.slice(3).join('/')}`;
			}
		}
		
		// それでも長すぎる場合は中間を省略
		if (path.length > 50) {
			const parts = path.split('/');
			if (parts.length > 4) {
				return `${parts[0]}/${parts[1]}/.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
			}
		}
		return path;
	}

	// リポジトリの展開状態を切り替え
	function toggleRepository(repoName: string) {
		expanded[repoName] = !expanded[repoName];
	}

	// リポジトリの変更を監視して動的にツリーをロード/アンロード
	$effect(() => {
		const currentRepoNames = new Set(repositories.map(r => r.name));
		
		// 新しく追加されたリポジトリのツリーをロード
		repositories.forEach(repo => {
			if (!loadedRepositories.has(repo.name)) {
				expanded[repo.name] = false; // 新しく追加されたリポジトリは閉じた状態で開始
				loadTree(repo.path, repo.name);
				loadedRepositories.add(repo.name);
				// リポジトリパスを登録
				repositoryFileChangesStore.registerRepository(repo.path);
			}
		});
		
		// 削除されたリポジトリのツリーをクリア
		Array.from(loadedRepositories).forEach(repoName => {
			if (!currentRepoNames.has(repoName)) {
				delete trees[repoName];
				delete loading[repoName];
				delete errors[repoName];
				delete expanded[repoName];
				loadedRepositories.delete(repoName);
			}
		});
	});
	
	// リポジトリファイル変更を監視してツリーを自動更新
	$effect(() => {
		const cleanup = repositoryFileChangesStore.onAnyFileChange((event) => {
			console.log('[FileTree] Repository file change detected:', event);
			
			// 変更があったリポジトリのツリーを再読み込み
			const affectedRepo = repositories.find(r => r.path === event.repository);
			if (affectedRepo && expanded[affectedRepo.name]) {
				// 展開されているリポジトリのみ更新
				console.log('[FileTree] Refreshing tree for repository:', affectedRepo.name);
				loadTree(affectedRepo.path, affectedRepo.name);
			}
		});
		
		return cleanup;
	});

	async function loadTree(repositoryPath: string, repositoryName: string) {
		loading[repositoryName] = true;
		errors[repositoryName] = '';
		
		try {
			const tree = await repositoryExplorerService.getTree(repositoryPath);
			
			// 削除されたファイルをツリーにマージ
			const deletedFilesStore = getDeletedFilesStore();
			const deletedFiles = deletedFilesStore.getDeletedFilesForRepository(repositoryPath);
			
			if (deletedFiles.length > 0) {
				const mergedTree = mergeDeletedFilesIntoTree(tree, deletedFiles, repositoryPath);
				trees[repositoryName] = mergedTree;
			} else {
				trees[repositoryName] = tree;
			}
			
			// リポジトリの監視も開始
			try {
				await repositoryExplorerService.startWatching(repositoryPath);
				console.log(`Started watching repository: ${repositoryName} at ${repositoryPath}`);
			} catch (watchError) {
				console.warn(`Failed to start watching repository ${repositoryName}:`, watchError);
				// ツリー読み込みは成功したので、監視の失敗はワーニングに留める
			}
		} catch (error) {
			console.error(`Failed to load tree for ${repositoryName}:`, error);
			errors[repositoryName] = error instanceof Error ? error.message : 'Failed to load repository tree';
		} finally {
			loading[repositoryName] = false;
		}
	}

	/**
	 * 削除されたファイルをツリー構造にマージ
	 */
	function mergeDeletedFilesIntoTree(
		tree: TreeNode, 
		deletedFiles: Array<any>,
		repositoryPath: string
	): TreeNode {
		// ツリーのディープコピーを作成
		const mergedTree = JSON.parse(JSON.stringify(tree));
		
		// 削除されたファイルをツリーに追加
		for (const deletedFile of deletedFiles) {
			const relativePath = deletedFile.path.startsWith(repositoryPath) 
				? deletedFile.path.slice(repositoryPath.length + 1)
				: deletedFile.path;
				
			addDeletedFileToTree(mergedTree, relativePath, deletedFile);
		}
		
		return mergedTree;
	}

	/**
	 * 削除されたファイルをツリーの適切な位置に追加
	 */
	function addDeletedFileToTree(node: TreeNode, path: string, deletedFile: any): void {
		const parts = path.split('/');
		
		if (parts.length === 1) {
			// 現在のディレクトリに削除ファイルを追加
			if (!node.children) {
				node.children = [];
			}
			
			// 既に存在するかチェック
			const existing = node.children.find(child => child.name === parts[0]);
			if (!existing) {
				node.children.push({
					name: parts[0],
					path: deletedFile.path,
					type: deletedFile.type,
					size: deletedFile.size,
					isDeleted: true // 削除フラグを追加
				} as TreeNode & { isDeleted: boolean });
			}
		} else {
			// サブディレクトリを探して再帰的に追加
			const dirName = parts[0];
			const remainingPath = parts.slice(1).join('/');
			
			if (!node.children) {
				node.children = [];
			}
			
			let targetDir = node.children.find(child => 
				child.type === 'directory' && child.name === dirName
			);
			
			if (!targetDir) {
				// ディレクトリが存在しない場合は作成
				targetDir = {
					name: dirName,
					path: node.path + '/' + dirName,
					type: 'directory',
					children: []
				};
				node.children.push(targetDir);
			}
			
			addDeletedFileToTree(targetDir, remainingPath, deletedFile);
		}
	}

	function handleRefresh(repositoryPath: string, repositoryName: string) {
		loadTree(repositoryPath, repositoryName);
	}
</script>

<div class="flex flex-col h-full bg-background overflow-hidden">
	<div class="px-3 py-2 border-b bg-muted/50">
		<h3 class="text-sm font-medium">Files</h3>
	</div>
	
	<div class="flex-1 overflow-y-auto overflow-x-hidden py-1">
		{#if repositories.length === 0}
			<div class="p-4 text-center text-muted-foreground text-sm">
				No repositories configured
			</div>
		{:else}
			{#each repositories as repo}
				<div class="border-b border-border/50 last:border-b-0">
					<!-- リポジトリヘッダー -->
					<button
						class="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-sm font-medium"
						onclick={() => toggleRepository(repo.name)}
						type="button"
					>
						<span class="flex-shrink-0">
							{#if expanded[repo.name]}
								<ChevronDown size={16} />
							{:else}
								<ChevronRight size={16} />
							{/if}
						</span>
						<FolderOpen size={16} class="flex-shrink-0 text-primary/70" />
						<span class="flex-1 text-left">
							<div class="font-semibold">{repo.name}</div>
							<div class="text-xs text-muted-foreground font-normal" title={repo.path}>
								{formatPath(repo.path)}
							</div>
						</span>
					</button>
					
					<!-- ツリーコンテンツ -->
					{#if expanded[repo.name]}
						<div class="border-t border-border/30">
							{#if loading[repo.name]}
								<div class="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
									<Loader2 size={16} class="animate-spin" />
									<span>Loading files...</span>
								</div>
							{:else if errors[repo.name]}
								<div class="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-sm">
									<AlertCircle size={16} />
									<span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{errors[repo.name]}</span>
									<button 
										class="px-2 py-0.5 border border-current bg-transparent text-xs rounded hover:bg-destructive/20 transition-colors"
										onclick={() => handleRefresh(repo.path, repo.name)}
										type="button"
									>
										Retry
									</button>
								</div>
							{:else if trees[repo.name]?.children}
								<!-- ツリーの子ノードだけを表示（ルートディレクトリ名は除外） -->
								{#each trees[repo.name].children || [] as child}
									<FileTreeNode
										node={child}
										repository={repo.path}
										level={1}
										{onFileSelect}
										selectedPath={selectedFile?.repository === repo.path ? selectedFile.path : undefined}
									/>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	/* Tailwind CSSのユーティリティクラスを使用 */
</style>