<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { taskStore } from '$lib/stores/api.svelte';
	import { taskService } from '$lib/services/task.service';
	import { ArrowLeft, Send, MessageSquare, ChevronDown, ChevronUp } from 'lucide-svelte';
	import type { TaskRequest } from '$lib/types/api';
	import DirectorySelector from '$lib/components/directory-selector.svelte';
	import { onMount } from 'svelte';
	import * as Alert from '$lib/components/ui/alert';
	import * as Tabs from '$lib/components/ui/tabs';
	import GroupTaskForm from '$lib/components/task-group/GroupTaskForm.svelte';
	
	// Task mode
	let taskMode = $state<'single' | 'group'>('single');
	
	// フォームの状態
	let instruction = $state('');
	let selectedDirectories = $state<string[]>([]);
	let maxTurns = $state(30);
	let timeout = $state(300000);
	let useAsync = $state(true);
	let permissionMode = $state<string>('allow');
	
	// Worktree設定
	let useWorktree = $state(false);
	let keepWorktreeAfterCompletion = $state(false);
	
	// 権限モードの選択肢
	const permissionModes = [
		{ value: 'ask', label: '確認する (ask)' },
		{ value: 'allow', label: 'すべて許可 (allow)' },
		{ value: 'deny', label: 'すべて拒否 (deny)' },
		{ value: 'bypassPermissions', label: '権限バイパス (bypassPermissions)' },
		{ value: 'acceptEdits', label: '編集を受け入れる (acceptEdits)' },
		{ value: 'plan', label: '計画モード (plan)' }
	];
	
	// 選択された権限モードのラベル
	const selectedPermissionLabel = $derived(
		permissionModes.find(m => m.value === permissionMode)?.label ?? '権限モードを選択'
	);
	
	// 送信中フラグ
	let submitting = $state(false);
	
	// SDK Continueモード
	let continueFromTaskId = $state<string>('');
	let isSdkContinueMode = $state(false);
	let previousTask = $state<any>(null);
	
	// CLIセッション継続モード
	let resumeSessionId = $state<string>('');
	
	
	// 詳細設定の表示/非表示（SDK Continueモードではデフォルトで非表示）
	let showAdvancedSettings = $state(false);
	
	// URLパラメータを取得
	onMount(async () => {
		const searchParams = new URLSearchParams($page.url.searchParams);
		continueFromTaskId = searchParams.get('continueFromTaskId') || '';
		isSdkContinueMode = searchParams.get('mode') === 'sdk-continue';
		
		// SDK Continueモードの場合、前のタスク情報を取得
		if (continueFromTaskId && isSdkContinueMode) {
			try {
				previousTask = await taskService.get(continueFromTaskId);
				// 前のタスクの作業ディレクトリを引き継ぐ
				if (previousTask.workingDirectory) {
					selectedDirectories = [previousTask.workingDirectory];
				} else if (previousTask.context?.workingDirectory) {
					selectedDirectories = [previousTask.context.workingDirectory];
				}
				
				// 前のタスクの設定を引き継ぐ
				if (previousTask.options) {
					maxTurns = previousTask.options.sdk?.maxTurns || maxTurns;
					timeout = previousTask.options.timeout || timeout;
					permissionMode = previousTask.options.sdk?.permissionMode || permissionMode;
					useWorktree = previousTask.options.useWorktree || false;
				}
				
				// SDK Continueモードでは詳細設定をデフォルトで非表示
				showAdvancedSettings = false;
			} catch (error) {
				console.error('Failed to load previous task:', error);
				// 前のタスクが取得できなくても続行
			}
		}
	});
	
	// フォームの送信
	async function handleSubmit(event: Event) {
		event.preventDefault();
		
		if (!instruction.trim()) {
			alert('指示内容を入力してください');
			return;
		}
		
		if (selectedDirectories.length === 0) {
			alert('作業ディレクトリを選択してください');
			return;
		}
		
		// CLIセッションID使用時は単一リポジトリのみ許可
		if (resumeSessionId && selectedDirectories.length > 1) {
			alert('CLIセッションIDを指定する場合は、単一のリポジトリのみ選択可能です');
			return;
		}
		
		submitting = true;
		
		const request: TaskRequest = {
			instruction: instruction.trim(),
			context: {
				workingDirectory: selectedDirectories[0], // 最初に選択されたディレクトリを使用
				files: [] // 必要に応じてファイルを指定
			},
			options: {
				timeout,
				async: useAsync,
				sdk: {
					maxTurns,
					permissionMode: Array.isArray(permissionMode) ? permissionMode[0] : permissionMode as 'ask' | 'allow' | 'deny' | 'acceptEdits' | 'bypassPermissions' | 'plan',
					// SDK Continueモードの場合、continueFromTaskIdを設定
					...(isSdkContinueMode && continueFromTaskId ? { continueFromTaskId } : {}),
					// CLIセッション継続モードの場合、resumeSessionを設定
					...(resumeSessionId ? { resumeSession: resumeSessionId } : {})
				},
				// Worktree設定
				useWorktree,
				...(useWorktree ? {
					worktree: {
						enabled: true,
						keepAfterCompletion: keepWorktreeAfterCompletion
					}
				} : {})
			}
		};
		
		try {
			const result = await taskStore.createTask(request);
			if (result.data) {
				// 作成成功したらタスク一覧ページへ
				goto('/tasks');
			}
		} catch (error) {
			alert('タスクの作成に失敗しました');
		} finally {
			submitting = false;
		}
	}
	
	// Handle group task submission
	async function handleGroupTaskSubmit(groupData: any) {
		submitting = true;
		
		try {
			// Add working directory if selected
			if (selectedDirectories.length > 0) {
				groupData.context = {
					workingDirectory: selectedDirectories[0]
				};
			}
			
			const response = await fetch('/api/task-groups/execute', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': localStorage.getItem('apiKey') || ''
				},
				body: JSON.stringify(groupData)
			});
			
			const result = await response.json();
			
			if (response.ok && result.success) {
				// Navigate to task group status page
				// For now, navigate to regular tasks page
				goto('/tasks');
			} else {
				alert(`タスクグループの作成に失敗しました: ${result.message || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Failed to create task group:', error);
			alert('タスクグループの作成に失敗しました');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="max-w-2xl mx-auto">
	<div class="mb-4 lg:mb-6">
		<Button variant="ghost" onclick={() => goto('/tasks')} class="gap-2 mb-4">
			<ArrowLeft class="h-4 w-4" />
			<span class="hidden sm:inline">タスク一覧に戻る</span>
			<span class="sm:hidden">戻る</span>
		</Button>
		<h1 class="text-2xl lg:text-3xl font-bold">
			{isSdkContinueMode ? '会話を継続' : '新規タスク作成'}
		</h1>
	</div>

	{#if isSdkContinueMode && previousTask}
		<Alert.Root class="mb-6">
			<MessageSquare class="h-4 w-4" />
			<Alert.Title>継続セッション</Alert.Title>
			<Alert.Description>
				<p class="mb-2">前回の会話セッションを継続します。文脈と設定が保持されます。</p>
				<div class="mt-2 p-2 bg-muted rounded text-sm">
					<p class="font-medium mb-1">前回の指示:</p>
					<p class="text-muted-foreground">{previousTask.instruction}</p>
				</div>
			</Alert.Description>
		</Alert.Root>
	{/if}
	
	{#if !isSdkContinueMode}
		<Tabs.Root bind:value={taskMode} class="mb-6">
			<Tabs.List class="grid w-full grid-cols-2">
				<Tabs.Trigger value="single">単一タスク</Tabs.Trigger>
				<Tabs.Trigger value="group">グループタスク</Tabs.Trigger>
			</Tabs.List>
		</Tabs.Root>
		
		<!-- 共通の作業ディレクトリセレクター（グループタスクモード用） -->
		{#if taskMode === 'group'}
			<Card.Root class="mb-6">
				<Card.Header>
					<Card.Title>作業ディレクトリ</Card.Title>
				</Card.Header>
				<Card.Content>
					<DirectorySelector 
						bind:selectedDirectories={selectedDirectories}
						singleSelect={true}
						onSelectionChange={(selected) => {
							selectedDirectories = selected;
						}}
					/>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}
	
	{#if taskMode === 'single'}
		<Card.Root>
		<Card.Header>
			<Card.Title>タスク設定</Card.Title>
			<Card.Description>
				実行したいタスクの内容を入力してください
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit} class="space-y-6">
				<div class="space-y-2">
					<Label for="instruction" class="required">指示内容</Label>
					<Textarea
						id="instruction"
						bind:value={instruction}
						placeholder="例: README.mdファイルを作成してください"
						rows={4}
						required
						class="resize-none"
					/>
				</div>

				<!-- 作業ディレクトリセレクター -->
				<DirectorySelector 
					bind:selectedDirectories={selectedDirectories}
					onSelectionChange={(selected) => {
						// CLIセッションID使用時は最初の1つのみ選択
						if (resumeSessionId && selected.length > 1) {
							selectedDirectories = [selected[0]];
							alert('CLIセッションIDを使用する場合は、単一のリポジトリのみ選択可能です');
						} else {
							selectedDirectories = selected;
						}
					}}
					readonly={isSdkContinueMode}
				/>
				
				<!-- CLIセッションID入力 -->
				<div class="space-y-2">
					<Label for="resumeSessionId">CLIセッションID (オプション)</Label>
					<Input
						id="resumeSessionId"
						type="text"
						bind:value={resumeSessionId}
						placeholder="例: 69647d9d-d1a3-4924-8dc2-e9c558007a4b"
						class="font-mono text-sm"
					/>
					<p class="text-xs text-muted-foreground">
						Claude Code CLIで開始したセッションを継続する場合に入力してください。
						セッションIDを指定する場合は、単一のリポジトリのみ選択可能です。
					</p>
				</div>

				{#if isSdkContinueMode}
					<div class="border-t pt-4">
						<Button
							type="button"
							variant="ghost"
							class="w-full justify-between p-2 hover:bg-muted/50"
							onclick={() => showAdvancedSettings = !showAdvancedSettings}
						>
							<span class="font-medium">詳細設定</span>
							{#if showAdvancedSettings}
								<ChevronUp class="h-4 w-4" />
							{:else}
								<ChevronDown class="h-4 w-4" />
							{/if}
						</Button>
					</div>
				{/if}

				<div class="{isSdkContinueMode && !showAdvancedSettings ? 'hidden' : ''} space-y-6">
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="maxTurns">最大ターン数</Label>
							<Input
								id="maxTurns"
								type="number"
								bind:value={maxTurns}
								min={1}
								max={100}
							/>
						</div>

						<div class="space-y-2">
							<Label for="timeout">タイムアウト (ms)</Label>
							<Input
								id="timeout"
								type="number"
								bind:value={timeout}
								min={1000}
								step={1000}
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="permissionMode">権限モード</Label>
					<Select.Root type="single" bind:value={permissionMode}>
						<Select.Trigger id="permissionMode">
							{selectedPermissionLabel}
						</Select.Trigger>
						<Select.Content>
							{#each permissionModes as mode}
								<Select.Item value={mode.value} label={mode.label}>
									{mode.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

					<!-- Worktree設定 -->
					<div class="space-y-4 border-t pt-4">
						<div class="flex items-center justify-between">
							<div class="space-y-0.5">
								<Label for="useWorktree" class="text-base">Git Worktree機能を使用</Label>
								<p class="text-sm text-muted-foreground">
									独立したWorktreeで作業を実行します
								</p>
							</div>
							<Switch
								id="useWorktree"
								bind:checked={useWorktree}
							/>
						</div>
						
						{#if useWorktree}
							<div class="ml-4 space-y-4">
								<div class="flex items-start space-x-3">
									<Checkbox
										id="keepWorktree"
										bind:checked={keepWorktreeAfterCompletion}
									/>
									<div class="space-y-0.5">
										<Label for="keepWorktree" class="text-sm font-normal cursor-pointer">
											タスク完了後もWorktreeを保持
										</Label>
										<p class="text-xs text-muted-foreground">
											Worktreeを自動削除せずに残します
										</p>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<div class="flex flex-col sm:flex-row gap-2 pt-4">
					<Button type="submit" disabled={submitting} class="gap-2 flex-1 sm:flex-initial">
						<Send class="h-4 w-4" />
						{submitting ? '作成中...' : 'タスクを作成'}
					</Button>
					<Button type="button" variant="outline" onclick={() => goto('/tasks')} class="flex-1 sm:flex-initial">
						キャンセル
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
	{:else}
		<!-- Group Task Form -->
		<GroupTaskForm
			onSubmit={handleGroupTaskSubmit}
			workingDirectory={selectedDirectories[0]}
			{submitting}
		/>
	{/if}
</div>

<style>
	:global(.required::after) {
		content: ' *';
		color: rgb(239 68 68);
	}
</style>