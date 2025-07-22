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
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
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
		RefreshCw
	} from 'lucide-svelte';
	
	// リクエストの型定義
	interface TaskRequest {
		instruction: string;
		options: {
			timeout?: number;
			async?: boolean;
			permissionMode?: 'default' | 'bypassPermissions' | 'plan' | 'acceptEdits';
			maxTurns?: number;
		};
		context?: {
			workingDirectory?: string;
			files?: string[];
			environment?: Record<string, string>;
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
	let request: TaskRequest = {
		instruction: '',
		options: {
			timeout: 300000,
			async: true,
			permissionMode: 'default',
			maxTurns: 10
		},
		context: {
			workingDirectory: ''
		}
	};
	
	// UIの状態
	let isSubmitting = false;
	let response: TaskResponse | null = null;
	let responseError: string | null = null;
	let requestHistory: Array<{id: string, request: TaskRequest, timestamp: string}> = [];
	
	// プリセット
	const presets = [
		{
			name: 'シンプルなタスク',
			request: {
				instruction: 'Hello Worldを出力する関数を作成してください',
				options: { timeout: 60000, async: false },
				context: {}
			}
		},
		{
			name: 'プロジェクトセットアップ',
			request: {
				instruction: 'TypeScriptプロジェクトを初期化して、基本的な設定を行ってください',
				options: { timeout: 300000, async: true },
				context: { workingDirectory: './new-project' }
			}
		},
		{
			name: 'テスト作成',
			request: {
				instruction: 'utils.tsファイルのユニットテストを作成してください',
				options: { timeout: 180000, async: true },
				context: { files: ['./src/utils.ts'] }
			}
		}
	];
	
	// タスクの送信
	async function submitTask() {
		if (!request.instruction.trim()) {
			responseError = 'タスクの説明を入力してください';
			return;
		}
		
		isSubmitting = true;
		response = null;
		responseError = null;
		
		try {
			// 実際のAPI呼び出し（仮実装）
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			// 仮のレスポンス
			response = {
				taskId: `task-${Date.now()}`,
				status: 'created',
				createdAt: new Date().toISOString(),
				message: 'タスクが正常に作成されました'
			};
			
			// 履歴に追加
			requestHistory = [{
				id: response.taskId,
				request: JSON.parse(JSON.stringify(request)),
				timestamp: new Date().toISOString()
			}, ...requestHistory].slice(0, 10);
			
		} catch (error) {
			responseError = error instanceof Error ? error.message : 'エラーが発生しました';
		} finally {
			isSubmitting = false;
		}
	}
	
	// プリセットの適用
	function applyPreset(preset: { name: string; request: TaskRequest }) {
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
					
					<!-- 非同期実行 -->
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<Label>非同期実行</Label>
							<p class="text-sm text-muted-foreground">
								バックグラウンドでタスクを実行
							</p>
						</div>
						<Switch bind:checked={request.options.async} />
					</div>
					
					<!-- 権限モード -->
					<div class="space-y-2">
						<Label>権限モード</Label>
						<Select type="multiple" value={[request.options.permissionMode || 'default']} onValueChange={(v: string[]) => request.options.permissionMode = v[0] as 'default' | 'bypassPermissions' | 'plan' | 'acceptEdits'}>
							<SelectTrigger>
								{request.options.permissionMode || 'デフォルト'}
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">デフォルト</SelectItem>
								<SelectItem value="bypassPermissions">権限バイパス</SelectItem>
								<SelectItem value="plan">計画モード</SelectItem>
								<SelectItem value="acceptEdits">編集受け入れ</SelectItem>
							</SelectContent>
						</Select>
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