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
	import { ArrowLeft, Send, MessageSquare, ChevronDown, ChevronUp, AlertCircle } from 'lucide-svelte';
	import type { TaskRequest, ExecutorType, ExecutorInfo, ExecutorCapabilities } from '$lib/types/api';
	import * as Badge from '$lib/components/ui/badge';
	import DirectorySelector from '$lib/components/directory-selector.svelte';
	import ExecutorSelector from '$lib/components/executor-selector.svelte';
	import { onMount } from 'svelte';
	import * as Alert from '$lib/components/ui/alert';
	import * as Tabs from '$lib/components/ui/tabs';
	import GroupTaskForm from '$lib/components/task-group/GroupTaskForm.svelte';

	// Task mode
	let taskMode = $state<'single' | 'group'>('single');

	// Executor情報
	let executors = $state<ExecutorInfo[]>([]);
	let selectedExecutorCapabilities = $derived.by(() => {
		if (!selectedExecutor) return undefined;
		return executors.find(e => e.type === selectedExecutor)?.capabilities;
	});

	// パラメータサポートチェック
	let isMaxTurnsSupported = $derived(selectedExecutorCapabilities?.maxTurnsLimit ?? true);
	let isPermissionModeSupported = $derived(selectedExecutorCapabilities?.permissionModes ?? true);

	// フォームの状態
	let instruction = $state('');
	let selectedDirectories = $state<string[]>([]);
	let maxTurns = $state(30);
	let timeout = $state(300000);
	let useAsync = $state(true);
	let permissionMode = $state<string>('allow');
	let selectedExecutor = $state<ExecutorType | undefined>(undefined);

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

	// Codexオプション
	let codexSandboxMode = $state<'read-only' | 'workspace-write' | 'danger-full-access'>('workspace-write');
	let codexResumeSession = $state<string>('');
	let codexModel = $state<string>('');
	let codexNetworkAccess = $state(true); // デフォルトtrue
	let codexWebSearch = $state(true); // デフォルトtrue

	// Geminiオプション
	let geminiModel = $state<string>(''); // default: gemini-3-pro-preview
	let geminiThinkingBudget = $state<number | undefined>(undefined);
	let geminiEnableGoogleSearch = $state(false);
	let geminiEnableCodeExecution = $state(false);
	let geminiSystemPrompt = $state<string>('');

	// 詳細設定の表示/非表示（SDK Continueモードではデフォルトで非表示）
	let showAdvancedSettings = $state(false);
	
	// URLパラメータを取得
	onMount(async () => {
		// Executors情報を取得
		try {
			const apiKey = localStorage.getItem('cc-anywhere-api-key');
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (apiKey) {
				headers['X-API-Key'] = apiKey;
			}

			const response = await fetch('/api/executors', { headers });
			if (response.ok) {
				const data = await response.json();
				executors = data.executors || [];
			}
		} catch (error) {
			console.error('Failed to load executors:', error);
		}

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

				// 前のタスクのExecutorを引き継ぐ（継続時はExecutor変更不可）
				const inheritedExecutor = previousTask.executor || previousTask.options?.executor;
				if (inheritedExecutor) {
					selectedExecutor = inheritedExecutor;
				}

				// 前のタスクの設定を引き継ぐ
				if (previousTask.options) {
					maxTurns = previousTask.options.sdk?.maxTurns || maxTurns;
					timeout = previousTask.options.timeout || timeout;
					permissionMode = previousTask.options.sdk?.permissionMode || permissionMode;
					useWorktree = previousTask.options.useWorktree || false;

					// Codexオプションを引き継ぐ
					if (previousTask.options.codex) {
						codexSandboxMode = previousTask.options.codex.sandboxMode || codexSandboxMode;
						codexModel = previousTask.options.codex.model || codexModel;
						codexNetworkAccess = previousTask.options.codex.networkAccess ?? true;
						codexWebSearch = previousTask.options.codex.webSearch ?? true;
					}
				}

				// セッションID/Thread IDを設定
				if (previousTask.sdkSessionId) {
					const executor = previousTask.executor || previousTask.options?.executor;
					console.log('[DEBUG] Session continuation setup:', {
						sdkSessionId: previousTask.sdkSessionId,
						executor,
						previousTaskExecutor: previousTask.executor,
						previousTaskOptionsExecutor: previousTask.options?.executor
					});
					if (executor === 'codex') {
						// Codex: Thread IDを設定
						codexResumeSession = previousTask.sdkSessionId;
						console.log('[DEBUG] Set codexResumeSession:', codexResumeSession);
					}
					// Claude: SDK Continueモードでは resumeSessionId を設定しない
					// SDK Continue は continueFromTaskId を使用し、内部的にSession IDを解決する
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

		console.log('[DEBUG] Submit - Session continuation values:', {
			selectedExecutor,
			codexResumeSession,
			resumeSessionId,
			continueFromTaskId,
			isSdkContinueMode
		});

		const request: TaskRequest = {
			instruction: instruction.trim(),
			context: {
				workingDirectory: selectedDirectories[0], // 最初に選択されたディレクトリを使用
				files: [] // 必要に応じてファイルを指定
			},
			options: {
				timeout,
				async: useAsync,
				executor: selectedExecutor,
				// Claude SDK オプション
				sdk: {
					maxTurns,
					permissionMode: Array.isArray(permissionMode) ? permissionMode[0] : permissionMode as 'ask' | 'allow' | 'deny' | 'acceptEdits' | 'bypassPermissions' | 'plan',
					// SDK Continueモードの場合、continueFromTaskIdを設定（Codex継続時は除外）
					// selectedExecutorが未定義の場合はclaudeとして扱う（デフォルト executor）
					...(isSdkContinueMode && continueFromTaskId && (!selectedExecutor || selectedExecutor !== 'codex') ? { continueFromTaskId } : {}),
					// CLIセッション継続モードの場合、resumeSessionを設定（Codex継続時は除外）
					// Reference: https://docs.claude.com/en/api/agent-sdk/sessions
					// Only 'resume' parameter is needed for session continuation
					...(resumeSessionId && (!selectedExecutor || selectedExecutor !== 'codex') ? {
						resumeSession: resumeSessionId
					} : {})
				},
				// Codex SDK オプション
				...(selectedExecutor === 'codex' ? {
					codex: {
						sandboxMode: codexSandboxMode,
						networkAccess: codexNetworkAccess,
						webSearch: codexWebSearch,
						...(codexModel ? { model: codexModel } : {}),
						...(codexResumeSession ? {
							continueSession: true,
							resumeSession: codexResumeSession
						} : {})
					}
				} : {}),
				// Gemini SDK オプション
				...(selectedExecutor === 'gemini' ? {
					gemini: {
						...(geminiModel ? { model: geminiModel } : {}),
						...(geminiThinkingBudget !== undefined ? { thinkingBudget: geminiThinkingBudget } : {}),
						enableGoogleSearch: geminiEnableGoogleSearch,
						enableCodeExecution: geminiEnableCodeExecution,
						...(geminiSystemPrompt ? { systemPrompt: geminiSystemPrompt } : {})
					}
				} : {}),
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
		
		console.log('[DEBUG] Sending request:', JSON.stringify(request, null, 2));

		try {
			const result = await taskStore.createTask(request);
			console.log('[DEBUG] Task created:', result.data);
			if (result.data) {
				// 作成成功したらタスク一覧ページへ
				goto('/tasks');
			}
		} catch (error) {
			console.error('[DEBUG] Task creation failed:', error);
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
				<!-- Executor選択 -->
				<div class="space-y-2">
					<ExecutorSelector
						bind:value={selectedExecutor}
						showLabel={true}
						disabled={isSdkContinueMode || !!resumeSessionId || !!codexResumeSession}
					/>
					{#if (isSdkContinueMode || !!resumeSessionId || !!codexResumeSession) && selectedExecutor}
						<p class="text-xs text-muted-foreground">
							セッション継続時はExecutorを変更できません（現在: {selectedExecutor}）
						</p>
					{/if}
				</div>

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
				
				<!-- CLIセッションID入力（Claude用） -->
				{#if selectedExecutor === 'claude' || !selectedExecutor}
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
				{/if}

				<!-- Codex専用オプション -->
				{#if selectedExecutor === 'codex'}
					<div class="space-y-4 border rounded-lg p-4 bg-muted/30">
						<h3 class="text-sm font-semibold">Codex Executor オプション</h3>

						<!-- Sandbox Mode -->
						<div class="space-y-2">
							<Label for="codexSandboxMode">Sandbox Mode</Label>
							<Select.Root type="single" bind:value={codexSandboxMode}>
								<Select.Trigger id="codexSandboxMode">
									{codexSandboxMode}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="workspace-write">workspace-write (推奨)</Select.Item>
									<Select.Item value="read-only">read-only</Select.Item>
									<Select.Item value="danger-full-access">danger-full-access</Select.Item>
								</Select.Content>
							</Select.Root>
							<p class="text-xs text-muted-foreground">
								ファイル操作の権限を設定します。workspace-writeが推奨です。
							</p>
						</div>

						<!-- Codex Thread ID -->
						<div class="space-y-2">
							<Label for="codexResumeSession">Codex Thread ID (継続用・オプション)</Label>
							<Input
								id="codexResumeSession"
								type="text"
								bind:value={codexResumeSession}
								placeholder="例: thread-789abc"
								class="font-mono text-sm"
							/>
							<p class="text-xs text-muted-foreground">
								Codex SDKで開始したスレッドを継続する場合にThread IDを入力してください。
							</p>
						</div>

						<!-- Model -->
						<div class="space-y-2">
							<Label for="codexModel">Model (オプション)</Label>
							<Input
								id="codexModel"
								type="text"
								bind:value={codexModel}
								placeholder="例: gpt-5.1-codex"
								class="font-mono text-sm"
							/>
							<p class="text-xs text-muted-foreground">
								使用するモデルを指定します。空欄の場合はデフォルトモデル（gpt-5.1-codex）が使用されます。
							</p>
						</div>

						<!-- Network Access -->
						<div class="flex items-center justify-between">
							<div class="space-y-0.5">
								<Label for="codexNetworkAccess" class="text-sm font-medium">Network Access</Label>
								<p class="text-xs text-muted-foreground">
									外部ネットワークへのアクセスを許可します
								</p>
							</div>
							<Switch
								id="codexNetworkAccess"
								bind:checked={codexNetworkAccess}
							/>
						</div>

						<!-- Web Search -->
						<div class="flex items-center justify-between">
							<div class="space-y-0.5">
								<Label for="codexWebSearch" class="text-sm font-medium">Web Search</Label>
								<p class="text-xs text-muted-foreground">
									Web検索機能を有効化します
								</p>
							</div>
							<Switch
								id="codexWebSearch"
								bind:checked={codexWebSearch}
							/>
						</div>
					</div>
				{/if}

				<!-- Gemini専用オプション -->
				{#if selectedExecutor === 'gemini'}
					<div class="space-y-4 border rounded-lg p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
						<h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Gemini Executor オプション</h3>

						<!-- Model -->
						<div class="space-y-2">
							<Label for="geminiModel">Model (オプション)</Label>
							<Input
								id="geminiModel"
								type="text"
								bind:value={geminiModel}
								placeholder="例: gemini-2.5-pro"
								class="font-mono text-sm"
							/>
							<p class="text-xs text-muted-foreground">
								使用するモデルを指定します。空欄の場合はデフォルトモデル（gemini-3-pro-preview）が使用されます。
							</p>
						</div>

						<!-- Thinking Budget -->
						<div class="space-y-2">
							<Label for="geminiThinkingBudget">Thinking Budget (オプション)</Label>
							<Input
								id="geminiThinkingBudget"
								type="number"
								value={geminiThinkingBudget ?? ''}
								oninput={(e) => {
									const val = e.currentTarget.valueAsNumber;
									geminiThinkingBudget = Number.isNaN(val) ? undefined : val;
								}}
								placeholder="例: 1024"
								min={0}
								class="font-mono text-sm"
							/>
							<p class="text-xs text-muted-foreground">
								思考トークンの予算を設定します。大きい値ほど深い思考が可能です。
							</p>
						</div>

						<!-- System Prompt -->
						<div class="space-y-2">
							<Label for="geminiSystemPrompt">System Prompt (オプション)</Label>
							<Textarea
								id="geminiSystemPrompt"
								bind:value={geminiSystemPrompt}
								placeholder="例: You are a helpful coding assistant..."
								rows={3}
								class="resize-none text-sm"
							/>
							<p class="text-xs text-muted-foreground">
								カスタムシステムプロンプトを設定します。
							</p>
						</div>

						<!-- Google Search -->
						<div class="flex items-center justify-between">
							<div class="space-y-0.5">
								<Label for="geminiEnableGoogleSearch" class="text-sm font-medium">Google Search</Label>
								<p class="text-xs text-muted-foreground">
									Google検索機能を有効化します
								</p>
							</div>
							<Switch
								id="geminiEnableGoogleSearch"
								bind:checked={geminiEnableGoogleSearch}
							/>
						</div>

						<!-- Code Execution -->
						<div class="flex items-center justify-between">
							<div class="space-y-0.5">
								<Label for="geminiEnableCodeExecution" class="text-sm font-medium">Code Execution</Label>
								<p class="text-xs text-muted-foreground">
									コード実行機能を有効化します
								</p>
							</div>
							<Switch
								id="geminiEnableCodeExecution"
								bind:checked={geminiEnableCodeExecution}
							/>
						</div>
					</div>
				{/if}

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
							<div class="flex items-center gap-2">
								<Label for="maxTurns">最大ターン数</Label>
								{#if !isMaxTurnsSupported}
									<Badge.Badge variant="outline" class="text-xs">未サポート</Badge.Badge>
								{/if}
							</div>
							<Input
								id="maxTurns"
								type="number"
								bind:value={maxTurns}
								min={1}
								max={100}
								disabled={!isMaxTurnsSupported}
								class={!isMaxTurnsSupported ? 'opacity-50 cursor-not-allowed' : ''}
							/>
							{#if !isMaxTurnsSupported && selectedExecutor}
								<p class="text-xs text-muted-foreground">
									{selectedExecutor} では最大ターン数制限はサポートされていません
								</p>
							{/if}
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
						<div class="flex items-center gap-2">
							<Label for="permissionMode">権限モード</Label>
							{#if !isPermissionModeSupported}
								<Badge.Badge variant="outline" class="text-xs">未サポート</Badge.Badge>
							{/if}
						</div>
						<Select.Root type="single" bind:value={permissionMode} disabled={!isPermissionModeSupported}>
							<Select.Trigger id="permissionMode" class={!isPermissionModeSupported ? 'opacity-50 cursor-not-allowed' : ''}>
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
						{#if !isPermissionModeSupported && selectedExecutor}
							<p class="text-xs text-muted-foreground">
								{selectedExecutor} では権限モード設定はサポートされていません
							</p>
						{/if}
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