<!--
	ログページ
	タスクの実行ログをリアルタイムで表示
-->
<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { 
		Search, 
		Filter, 
		Download,
		Trash2,
		RefreshCw,
		Info,
		AlertTriangle,
		AlertCircle,
		CheckCircle2,
		Terminal,
		ScrollText
	} from 'lucide-svelte';
	
	// ログエントリの型定義
	interface LogEntry {
		id: string;
		taskId: string;
		timestamp: string;
		level: 'info' | 'warn' | 'error' | 'debug' | 'success';
		message: string;
		details?: Record<string, unknown>;
	}
	
	// サンプルログデータ
	let logs: LogEntry[] = [
		{
			id: 'log-001',
			taskId: 'task-001',
			timestamp: '2024-01-18T10:00:05Z',
			level: 'info',
			message: 'タスクを開始しました: TypeScriptプロジェクトの初期セットアップとESLint設定'
		},
		{
			id: 'log-002',
			taskId: 'task-001',
			timestamp: '2024-01-18T10:00:10Z',
			level: 'info',
			message: 'package.jsonを作成しています...'
		},
		{
			id: 'log-003',
			taskId: 'task-001',
			timestamp: '2024-01-18T10:00:15Z',
			level: 'debug',
			message: 'npm installを実行中...',
			details: { packages: ['typescript', 'eslint', '@types/node'] }
		},
		{
			id: 'log-004',
			taskId: 'task-001',
			timestamp: '2024-01-18T10:01:30Z',
			level: 'warn',
			message: 'パッケージ @eslint/config に脆弱性が見つかりました'
		},
		{
			id: 'log-005',
			taskId: 'task-001',
			timestamp: '2024-01-18T10:02:30Z',
			level: 'success',
			message: 'タスクが正常に完了しました'
		},
		{
			id: 'log-006',
			taskId: 'task-002',
			timestamp: '2024-01-18T10:30:10Z',
			level: 'info',
			message: 'タスクを開始しました: REST APIエンドポイントの実装（CRUD操作）'
		},
		{
			id: 'log-007',
			taskId: 'task-004',
			timestamp: '2024-01-18T09:00:05Z',
			level: 'error',
			message: 'データベース接続エラー: Connection timeout',
			details: { host: 'localhost', port: 5432, database: 'myapp' }
		}
	];
	
	// フィルター状態
	let searchQuery = '';
	let levelFilter = 'all';
	let taskIdFilter = '';
	let autoScroll = true;
	
	// フィルター適用済みのログ
	$: filteredLogs = logs.filter(log => {
		const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
		const matchesTask = !taskIdFilter || log.taskId === taskIdFilter;
		return matchesSearch && matchesLevel && matchesTask;
	});
	
	// レベル別のログ数
	$: levelCounts = {
		all: logs.length,
		info: logs.filter(l => l.level === 'info').length,
		warn: logs.filter(l => l.level === 'warn').length,
		error: logs.filter(l => l.level === 'error').length,
		debug: logs.filter(l => l.level === 'debug').length,
		success: logs.filter(l => l.level === 'success').length
	};
	
	// レベルに応じたアイコン
	function getLevelIcon(level: string) {
		switch(level) {
			case 'info': return Info;
			case 'warn': return AlertTriangle;
			case 'error': return AlertCircle;
			case 'success': return CheckCircle2;
			default: return Terminal;
		}
	}
	
	// レベルに応じた色
	function getLevelColor(level: string) {
		switch(level) {
			case 'info': return 'text-blue-600';
			case 'warn': return 'text-yellow-600';
			case 'error': return 'text-red-600';
			case 'success': return 'text-green-600';
			case 'debug': return 'text-gray-600';
			default: return 'text-gray-600';
		}
	}
	
	// レベルに応じたバッジバリアント
	function getLevelVariant(level: string) {
		switch(level) {
			case 'error': return 'destructive';
			case 'warn': return 'secondary';
			case 'success': return 'default';
			default: return 'outline';
		}
	}
	
	// 日時フォーマット
	function formatTimestamp(timestamp: string) {
		return new Date(timestamp).toLocaleString('ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}
	
	// ログのエクスポート
	function exportLogs() {
		const logText = filteredLogs.map(log => 
			`[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}`
		).join('\n');
		
		const blob = new Blob([logText], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `logs-${new Date().toISOString()}.txt`;
		a.click();
	}
</script>

<!-- ログページのコンテンツ -->
<div class="space-y-6">
	<!-- ページヘッダー -->
	<div class="flex justify-between items-center">
		<div>
			<h2 class="text-3xl font-bold tracking-tight">ログ</h2>
			<p class="text-muted-foreground">タスク実行のログをリアルタイムで確認</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={exportLogs}>
				<Download class="mr-2 h-4 w-4" />
				エクスポート
			</Button>
			<Button>
				<RefreshCw class="mr-2 h-4 w-4" />
				更新
			</Button>
		</div>
	</div>
	
	<!-- レベルタブ -->
	<Tabs bind:value={levelFilter} class="w-full">
		<TabsList class="grid w-full grid-cols-6">
			<TabsTrigger value="all">
				すべて ({levelCounts.all})
			</TabsTrigger>
			<TabsTrigger value="info">
				情報 ({levelCounts.info})
			</TabsTrigger>
			<TabsTrigger value="warn">
				警告 ({levelCounts.warn})
			</TabsTrigger>
			<TabsTrigger value="error">
				エラー ({levelCounts.error})
			</TabsTrigger>
			<TabsTrigger value="debug">
				デバッグ ({levelCounts.debug})
			</TabsTrigger>
			<TabsTrigger value="success">
				成功 ({levelCounts.success})
			</TabsTrigger>
		</TabsList>
		
		<TabsContent value={levelFilter} class="mt-6">
			<Card>
				<CardHeader>
					<div class="flex items-center justify-between">
						<CardTitle>ログエントリ</CardTitle>
						<!-- 検索とフィルター -->
						<div class="flex items-center gap-2">
							<div class="relative">
								<Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="ログを検索..."
									bind:value={searchQuery}
									class="pl-8 w-[300px]"
								/>
							</div>
							<Select type="multiple" value={[taskIdFilter]} onValueChange={(v: string[]) => taskIdFilter = v[0] || ''}>
								<SelectTrigger class="w-[180px]">
									{taskIdFilter || 'タスクでフィルター'}
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="">すべてのタスク</SelectItem>
									<SelectItem value="task-001">task-001</SelectItem>
									<SelectItem value="task-002">task-002</SelectItem>
									<SelectItem value="task-004">task-004</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<!-- ログコンソール風の表示 -->
					<div class="bg-muted/50 rounded-lg p-4 font-mono text-sm max-h-[600px] overflow-y-auto">
						{#each filteredLogs as log}
							<div class="flex items-start gap-2 py-1 hover:bg-muted/80 px-2 -mx-2 rounded">
								<!-- タイムスタンプ -->
								<span class="text-muted-foreground text-xs whitespace-nowrap">
									{formatTimestamp(log.timestamp)}
								</span>
								
								<!-- レベルバッジ -->
								<Badge variant={getLevelVariant(log.level)} class="min-w-[60px] justify-center">
									<svelte:component 
										this={getLevelIcon(log.level)} 
										class="mr-1 h-3 w-3" 
									/>
									{log.level.toUpperCase()}
								</Badge>
								
								<!-- タスクID -->
								<span class="text-muted-foreground text-xs">
									[{log.taskId}]
								</span>
								
								<!-- メッセージ -->
								<span class="flex-1 {getLevelColor(log.level)}">
									{log.message}
								</span>
							</div>
							
							<!-- 詳細情報（あれば） -->
							{#if log.details}
								<div class="ml-[180px] text-xs text-muted-foreground font-mono">
									<pre>{JSON.stringify(log.details, null, 2)}</pre>
								</div>
							{/if}
						{/each}
						
						{#if filteredLogs.length === 0}
							<div class="text-center py-8 text-muted-foreground">
								ログが見つかりませんでした
							</div>
						{/if}
					</div>
					
					<!-- オートスクロールオプション -->
					<div class="mt-4 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<ScrollText class="h-4 w-4 text-muted-foreground" />
							<span class="text-sm text-muted-foreground">
								{filteredLogs.length} 件のログエントリ
							</span>
						</div>
						<label class="flex items-center gap-2 text-sm">
							<input 
								type="checkbox" 
								bind:checked={autoScroll}
								class="rounded"
							/>
							自動スクロール
						</label>
					</div>
				</CardContent>
			</Card>
		</TabsContent>
	</Tabs>
</div>