<!--
	API Explorerページ
	新しいタスクを作成・実行するためのインターフェース
-->
<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { 
		Play, 
		Send,
		Code2,
		Settings,
		Clock,
		Folder,
		FileJson,
		History,
		Save,
		Copy,
		CheckCircle2,
		AlertCircle,
		RefreshCw,
		GitBranch
	} from 'lucide-svelte';
	import RepositorySelector from '$lib/components/repository-selector.svelte';
	import { taskService } from '$lib/services/task.service';
	import { goto } from '$app/navigation';
	
	// リクエストの型定義
	interface TaskRequest {
		instruction: string;
		options: {
			timeout?: number;
			async?: boolean;
			permissionMode?: 'ask' | 'allow' | 'deny' | 'bypassPermissions' | 'acceptEdits' | 'plan';
			maxTurns?: number;
		};
		context?: {
			workingDirectory?: string;
			files?: string[];
			environment?: Record<string, string>;
			repositories?: string[]; // 複数リポジトリのパス
		};
	}
	
	// レスポンスの型定義
	interface TaskResponse {
		taskId: string;
		status: string;
		createdAt: string;
		message?: string;
		error?: string;
	}
	
	// リクエストの初期値
	let request = $state<TaskRequest>({
		instruction: '',
		options: {
			timeout: 300000,
			async: true,
			permissionMode: 'allow',
			maxTurns: 10
		},
		context: {
			workingDirectory: '',
			repositories: []
		}
	});
	
	// UIの状態
	let isSubmitting = $state(false);
	let response = $state<TaskResponse | null>(null);
	let responseError = $state<string | null>(null);
	let requestHistory = $state<Array<{id: string, request: TaskRequest, timestamp: string}>>([]);
	
	// プリセット
	const presets = [
		{
			name: 'シンプルなタスク',
			request: {
				instruction: 'Hello Worldを出力する関数を作成してください',
				options: { timeout: 60000, async: true, permissionMode: 'allow' as const },
				context: {}
			}
		},
		{
			name: 'プロジェクトセットアップ',
			request: {
				instruction: 'TypeScriptプロジェクトを初期化して、基本的な設定を行ってください',
				options: { timeout: 300000, async: true, permissionMode: 'allow' as const },
				context: { workingDirectory: './new-project' }
			}
		},
		{
			name: 'テスト作成',
			request: {
				instruction: 'utils.tsファイルのユニットテストを作成してください',
				options: { timeout: 180000, async: true, permissionMode: 'allow' as const },
				context: { files: ['./src/utils.ts'] }
			}
		}
	];
	
	// 権限モードのラベル取得
	function getPermissionModeLabel(mode?: string) {
		switch (mode) {
			case 'ask': return '確認する (ask)';
			case 'allow': return 'すべて許可 (allow)';
			case 'deny': return 'すべて拒否 (deny)';
			case 'bypassPermissions': return '権限バイパス (bypassPermissions)';
			case 'acceptEdits': return '編集を受け入れる (acceptEdits)';
			case 'plan': return '計画モード (plan)';
			default: return '権限モードを選択';
		}
	}
	
	// タスクの送信
	async function submitTask() {
		if (!request.instruction.trim()) {
			responseError = 'タスクの説明を入力してください';
			return;
		}
		
		if (request.context?.repositories && request.context.repositories.length === 0) {
			responseError = 'リポジトリを選択してください';
			return;
		}
		
		isSubmitting = true;
		response = null;
		responseError = null;
		
		try {
			// APIリクエスト形式に変換
			const apiRequest = {
				instruction: request.instruction,
				options: {
					timeout: request.options.timeout,
					async: request.options.async,
					sdk: {
						permissionMode: request.options.permissionMode,
						maxTurns: request.options.maxTurns
					}
				},
				context: {
					workingDirectory: request.context?.workingDirectory || undefined,
					repositories: request.context?.repositories || undefined
				}
			};
			
			// タスクを作成
			const createdTask = await taskService.create(apiRequest);
			
			// レスポンスを設定
			response = {
				taskId: createdTask.taskId,
				status: createdTask.status,
				createdAt: createdTask.createdAt,
				message: 'タスクが正常に作成されました'
			};
			
			// 履歴に追加
			requestHistory = [{
				id: response.taskId,
				request: JSON.parse(JSON.stringify(request)),
				timestamp: new Date().toISOString()
			}, ...requestHistory].slice(0, 10);
			
			// タスク一覧ページへ遷移
			setTimeout(() => {
				window.location.href = '/tasks';
			}, 1000);
			
		} catch (error) {
			responseError = error instanceof Error ? error.message : 'エラーが発生しました';
		} finally {
			isSubmitting = false;
		}
	}
	
	// プリセットの適用
	function applyPreset(preset: { name: string; request: any }) {
		request = JSON.parse(JSON.stringify(preset.request));
	}
	
	// リクエストのコピー
	function copyRequest() {
		navigator.clipboard.writeText(JSON.stringify(request, null, 2));
	}
	
	// cURLコマンドの生成
	function generateCurl(): string {
		return `curl -X POST http://localhost:5000/api/tasks \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '${JSON.stringify(request, null, 2)}'`;
	}
	
	// 権限モード変更ハンドラ
	function handlePermissionModeChange(value: string | undefined) {
		if (value) {
			request.options.permissionMode = value as TaskRequest['options']['permissionMode'];
		}
	}
</script>

<!-- API Explorerページのコンテンツ -->
<div class="space-y-6">
	<!-- ページヘッダー -->
	<div class="flex justify-between items-center">
		<div>
			<h2 class="text-3xl font-bold tracking-tight">API Explorer</h2>
			<p class="text-muted-foreground">タスクを作成してClaude Code SDKを実行</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={copyRequest}>
				<Copy class="mr-2 h-4 w-4" />
				リクエストをコピー
			</Button>
			<Button 
				onclick={submitTask} 
				disabled={isSubmitting}
			>
				{#if isSubmitting}
					<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
					送信中...
				{:else}
					<Send class="mr-2 h-4 w-4" />
					タスクを実行
				{/if}
			</Button>
		</div>
	</div>
	
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- リクエストビルダー -->
		<div class="space-y-6">
			<!-- タスクの説明 -->
			<Card>
				<CardHeader>
					<CardTitle>タスクの説明</CardTitle>
					<CardDescription>Claude Code SDKに実行させたいタスクを記述</CardDescription>
				</CardHeader>
				<CardContent>
					<Textarea
						bind:value={request.instruction}
						placeholder="例: TypeScriptでRESTful APIサーバーを実装してください..."
						class="min-h-[120px] font-mono"
					/>
				</CardContent>
			</Card>
			
			<!-- オプション設定 -->
			<Card>
				<CardHeader>
					<CardTitle>実行オプション</CardTitle>
					<CardDescription>タスクの実行方法を設定</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					<!-- タイムアウト -->
					<div class="space-y-2">
						<Label>タイムアウト（ミリ秒）</Label>
						<div class="flex items-center gap-2">
							<Clock class="h-4 w-4 text-muted-foreground" />
							<Input
								type="number"
								bind:value={request.options.timeout}
								min="1000"
								max="3600000"
							/>
						</div>
					</div>
					
					<!-- 権限モード -->
					<div class="space-y-2">
						<Label for="permission-mode">権限モード</Label>
						<select
							id="permission-mode"
							value={request.options.permissionMode || 'allow'}
							onchange={(e) => handlePermissionModeChange(e.currentTarget.value)}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						>
							<option value="ask">確認する (ask)</option>
							<option value="allow">すべて許可 (allow)</option>
							<option value="deny">すべて拒否 (deny)</option>
							<option value="bypassPermissions">権限バイパス (bypassPermissions)</option>
							<option value="acceptEdits">編集を受け入れる (acceptEdits)</option>
							<option value="plan">計画モード (plan)</option>
						</select>
					</div>
					
					<!-- 最大ターン数 -->
					<div class="space-y-2">
						<Label>最大ターン数</Label>
						<Input
							type="number"
							bind:value={request.options.maxTurns}
							min="1"
							max="100"
						/>
					</div>
				</CardContent>
			</Card>
			
			<!-- コンテキスト設定 -->
			<Card>
				<CardHeader>
					<CardTitle>コンテキスト</CardTitle>
					<CardDescription>タスク実行時の環境設定</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4">
					<!-- 作業ディレクトリ -->
					<div class="space-y-2">
						<Label>作業ディレクトリ</Label>
						<div class="flex items-center gap-2">
							<Folder class="h-4 w-4 text-muted-foreground" />
							<Input
								bind:value={request.context!.workingDirectory}
								placeholder="/path/to/project"
							/>
						</div>
					</div>
				</CardContent>
			</Card>
			
			<!-- リポジトリ選択 -->
			<RepositorySelector 
				bind:selectedRepositories={request.context!.repositories}
				onSelectionChange={(selected) => {
					request.context!.repositories = selected;
				}}
			/>
		</div>
		
		<!-- レスポンスとツール -->
		<div class="space-y-6">
			<!-- プリセット -->
			<Card>
				<CardHeader>
					<CardTitle>プリセット</CardTitle>
					<CardDescription>よく使用するタスク設定</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="grid gap-2">
						{#each presets as preset}
							<Button
								variant="outline"
								class="justify-start"
								onclick={() => applyPreset(preset)}
							>
								<Save class="mr-2 h-4 w-4" />
								{preset.name}
							</Button>
						{/each}
					</div>
				</CardContent>
			</Card>
			
			<!-- レスポンス表示 -->
			<Tabs value="response" class="w-full">
				<TabsList class="grid w-full grid-cols-3">
					<TabsTrigger value="response">レスポンス</TabsTrigger>
					<TabsTrigger value="request">リクエスト</TabsTrigger>
					<TabsTrigger value="curl">cURL</TabsTrigger>
				</TabsList>
				
				<TabsContent value="response" class="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>実行結果</CardTitle>
						</CardHeader>
						<CardContent>
							{#if response}
								<Alert>
									<CheckCircle2 class="h-4 w-4" />
									<AlertDescription>
										{response.message}
									</AlertDescription>
								</Alert>
								<pre class="mt-4 p-4 bg-muted rounded-lg text-sm overflow-auto">
{JSON.stringify(response, null, 2)}
								</pre>
							{:else if responseError}
								<Alert variant="destructive">
									<AlertCircle class="h-4 w-4" />
									<AlertDescription>
										{responseError}
									</AlertDescription>
								</Alert>
							{:else}
								<p class="text-muted-foreground text-center py-8">
									タスクを実行すると結果がここに表示されます
								</p>
							{/if}
						</CardContent>
					</Card>
				</TabsContent>
				
				<TabsContent value="request" class="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>リクエストJSON</CardTitle>
						</CardHeader>
						<CardContent>
							<pre class="p-4 bg-muted rounded-lg text-sm overflow-auto">
{JSON.stringify(request, null, 2)}
							</pre>
						</CardContent>
					</Card>
				</TabsContent>
				
				<TabsContent value="curl" class="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>cURLコマンド</CardTitle>
						</CardHeader>
						<CardContent>
							<pre class="p-4 bg-muted rounded-lg text-sm overflow-auto">
{generateCurl()}
							</pre>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
			
			<!-- 実行履歴 -->
			{#if requestHistory.length > 0}
				<Card>
					<CardHeader>
						<CardTitle>実行履歴</CardTitle>
						<CardDescription>最近実行したタスク</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-2">
							{#each requestHistory as item}
								<div class="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
									<div class="flex-1 truncate">
										<p class="text-sm font-medium truncate">
											{item.request.instruction}
										</p>
										<p class="text-xs text-muted-foreground">
											{new Date(item.timestamp).toLocaleString('ja-JP')}
										</p>
									</div>
									<Badge variant="outline">{item.id}</Badge>
								</div>
							{/each}
						</div>
					</CardContent>
				</Card>
			{/if}
		</div>
	</div>
</div>