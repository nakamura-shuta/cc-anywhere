<script lang="ts">
	import { onMount } from 'svelte';
	import { repositoryService, type Repository } from '$lib/services/repository.service';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Folder, AlertCircle, CheckCircle2, XCircle } from 'lucide-svelte';

	// Props
	let { 
		selectedDirectories = $bindable([]), 
		onSelectionChange = () => {} 
	}: {
		selectedDirectories?: string[];
		onSelectionChange?: (selected: string[]) => void;
	} = $props();

	// State
	let repositories = $state<Repository[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// すべて選択/解除の状態を計算
	let isAllSelected = $derived(
		repositories.length > 0 && 
		repositories.every(repo => selectedDirectories.includes(repo.path))
	);

	let isIndeterminate = $derived(
		selectedDirectories.length > 0 && 
		selectedDirectories.length < repositories.length
	);

	// リポジトリ一覧を取得（作業ディレクトリとして使用）
	onMount(async () => {
		try {
			repositories = await repositoryService.list();
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : '作業ディレクトリの取得に失敗しました';
			loading = false;
		}
	});

	// ディレクトリの選択/解除
	function toggleDirectory(path: string) {
		if (selectedDirectories.includes(path)) {
			selectedDirectories = selectedDirectories.filter(p => p !== path);
		} else {
			selectedDirectories = [...selectedDirectories, path];
		}
		onSelectionChange(selectedDirectories);
	}

	// すべて選択/解除
	function toggleAll() {
		if (isAllSelected) {
			selectedDirectories = [];
		} else {
			selectedDirectories = repositories.map(repo => repo.path);
		}
		onSelectionChange(selectedDirectories);
	}

	// ディレクトリが存在するかチェック
	function isDirectoryAvailable(repo: Repository): boolean {
		return true;
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>作業ディレクトリ選択</CardTitle>
		<CardDescription>
			タスクを実行する作業ディレクトリを選択してください
		</CardDescription>
	</CardHeader>
	<CardContent>
		{#if loading}
			<!-- ローディング表示 -->
			<div class="space-y-2">
				{#each Array(3) as _}
					<div class="flex items-center space-x-2">
						<Skeleton class="h-4 w-4" />
						<Skeleton class="h-4 flex-1" />
					</div>
				{/each}
			</div>
		{:else if error}
			<!-- エラー表示 -->
			<Alert variant="destructive">
				<AlertCircle class="h-4 w-4" />
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		{:else if repositories.length === 0}
			<!-- ディレクトリがない場合 -->
			<Alert>
				<AlertCircle class="h-4 w-4" />
				<AlertDescription>
					作業ディレクトリが設定されていません。backend/config/repositories.jsonを確認してください。
				</AlertDescription>
			</Alert>
		{:else}
			<!-- ディレクトリ一覧 -->
			<div class="space-y-4">
				<!-- すべて選択 -->
				<div class="flex items-center space-x-2 pb-2 border-b">
					<Checkbox
						checked={isAllSelected}
						indeterminate={isIndeterminate}
						onCheckedChange={toggleAll}
					/>
					<Label class="text-sm font-medium cursor-pointer" onclick={toggleAll}>
						すべて選択 ({selectedDirectories.length}/{repositories.length})
					</Label>
				</div>

				<!-- ディレクトリリスト -->
				<div class="space-y-2">
					{#each repositories as repo}
						{@const isSelected = selectedDirectories.includes(repo.path)}
						{@const isAvailable = isDirectoryAvailable(repo)}
						
						<div 
							class="flex items-center space-x-3 p-3 rounded-lg border transition-colors {isSelected ? 'bg-muted/50 border-primary/20' : 'hover:bg-muted/30'}"
						>
							<Checkbox
								checked={isSelected}
								disabled={!isAvailable}
								onCheckedChange={() => toggleDirectory(repo.path)}
							/>
							
							<div class="flex-1 min-w-0">
								<Label 
									class="flex items-center gap-2 cursor-pointer"
									onclick={() => isAvailable && toggleDirectory(repo.path)}
								>
									<Folder class="h-4 w-4 text-muted-foreground flex-shrink-0" />
									<span class="font-medium">{repo.name}</span>
								</Label>
								<p class="text-xs text-muted-foreground truncate mt-1">
									{repo.path}
								</p>
							</div>

							<div class="flex items-center gap-2">
								{#if isSelected}
									<Badge variant="secondary" class="text-xs">
										<CheckCircle2 class="h-3 w-3 mr-1" />
										選択中
									</Badge>
								{/if}
								
								{#if !isAvailable}
									<Badge variant="destructive" class="text-xs">
										<XCircle class="h-3 w-3 mr-1" />
										利用不可
									</Badge>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- 選択状況のサマリー -->
				{#if selectedDirectories.length > 0}
					<div class="pt-4 border-t">
						<p class="text-sm text-muted-foreground">
							選択された作業ディレクトリ: <span class="font-medium text-foreground">{selectedDirectories.length}個</span>
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>