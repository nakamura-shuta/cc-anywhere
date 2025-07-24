<script lang="ts">
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { format } from 'date-fns';
	import { ja } from 'date-fns/locale';
	import { Plus, GitBranch, RefreshCw } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { getWebSocketContext } from '$lib/websocket/websocket.svelte';
	import { TaskStatus, type TaskResponse } from '$lib/types/api';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
	// WebSocket接続
	const ws = getWebSocketContext();
	
	// タスクリストの状態
	let tasks = $state<TaskResponse[]>(data.tasks || []);
	
	// WebSocketメッセージの処理
	$effect(() => {
		// 初期データを設定
		tasks = data.tasks || [];
	});
	
	// WebSocketメッセージのリスナー
	function handleWebSocketMessage(event: Event) {
		const customEvent = event as CustomEvent;
		const message = customEvent.detail;
		
		console.log('[タスク一覧] WebSocketメッセージ受信:', {
			type: message.type,
			taskId: message.taskId,
			data: message.data,
			currentTaskCount: tasks.length
		});
		
		// タスクの状態変更に応じて一覧を更新
		switch (message.type) {
			case 'task:update':
				// タスクの状態更新（新規作成、実行中、完了、失敗など）
				console.log('[タスク一覧] タスク更新:', message);
				handleTaskUpdate(message);
				break;
			case 'task:status':
			case 'task:running':
				// 旧形式のサポート（互換性のため）
				console.log('[タスク一覧] タスク状態を更新（旧形式）:', message);
				handleTaskStatusUpdate(message);
				break;
			case 'task:completed':
			case 'task:failed':
			case 'task:cancelled':
				// 旧形式のサポート（互換性のため）
				console.log('[タスク一覧] タスク完了/失敗/キャンセル（旧形式）:', message);
				handleTaskStatusUpdate(message);
				break;
			default:
				console.log('[タスク一覧] 未処理のメッセージタイプ:', message.type);
		}
	}
	
	// task:updateメッセージの処理
	function handleTaskUpdate(message: any) {
		// WebSocketメッセージの構造: { type, taskId, data: { taskId, status, ... } }
		const taskId = message.taskId || message.data?.taskId || message.payload?.taskId;
		const payload = message.data || message.payload || {};
		const status = payload.status;
		
		console.log('[タスク一覧] handleTaskUpdate:', {
			messageTaskId: message.taskId,
			dataTaskId: message.data?.taskId,
			payloadTaskId: message.payload?.taskId,
			finalTaskId: taskId,
			status: status
		});
		
		if (!taskId) {
			console.warn('[タスク一覧] タスクIDが見つかりません:', message);
			return;
		}
		
		// 既存のタスクを探す
		const existingTaskIndex = tasks.findIndex(t => t.taskId === taskId);
		
		if (existingTaskIndex >= 0) {
			// 既存タスクの更新
			const updatedTask = { ...tasks[existingTaskIndex] };
			
			// ステータスの更新
			if (status) {
				updatedTask.status = status;
			}
			
			// メタデータから他のフィールドを更新
			const metadata = payload.metadata || message.data?.metadata || {};
			if (metadata.completedAt) {
				updatedTask.completedAt = metadata.completedAt;
			}
			if (metadata.duration) {
				updatedTask.duration = metadata.duration;
			}
			if (metadata.error) {
				updatedTask.error = metadata.error;
			}
			if (metadata.workingDirectory) {
				updatedTask.workingDirectory = metadata.workingDirectory;
			}
			
			// 更新日時
			updatedTask.updatedAt = message.timestamp || payload.timestamp || new Date().toISOString();
			
			// 新しい配列を作成して更新
			tasks = [...tasks.slice(0, existingTaskIndex), updatedTask, ...tasks.slice(existingTaskIndex + 1)];
			console.log('[タスク一覧] タスクを更新:', updatedTask);
		} else if (status === 'pending' || status === 'running') {
			// 新しいタスクの場合（pendingまたはrunningステータス）
			// APIから詳細情報を取得
			console.log('[タスク一覧] 新しいタスクを検出、APIから詳細を取得:', taskId);
			fetchTaskDetails(taskId);
		}
	}
	
	// タスクの詳細情報を取得
	async function fetchTaskDetails(taskId: string) {
		try {
			const response = await fetch(`http://localhost:5000/api/tasks/${taskId}`, {
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				const task = await response.json();
				// 既に存在しないか再確認
				const exists = tasks.some(t => t.taskId === taskId);
				if (!exists) {
					// idフィールドを追加
					const newTask: TaskResponse = {
						...task,
						id: task.id || task.taskId
					};
					tasks = [newTask, ...tasks];
					console.log('[タスク一覧] 新しいタスクを追加:', newTask);
				}
			}
		} catch (error) {
			console.error('[タスク一覧] タスク詳細の取得に失敗:', error);
		}
	}
	
	
	// タスクの状態更新
	function handleTaskStatusUpdate(message: any) {
		const taskId = message.taskId || message.data?.taskId || message.payload?.taskId;
		const updateData = message.data || message.payload || message;
		
		if (!taskId) return;
		
		// タスクを見つけて更新
		const index = tasks.findIndex(t => t.taskId === taskId);
		if (index !== -1) {
			const updatedTask = { ...tasks[index] };
			
			// 状態を更新
			if (updateData.status) {
				updatedTask.status = updateData.status;
			}
			
			// その他のフィールドも更新
			if (updateData.updatedAt) {
				updatedTask.updatedAt = updateData.updatedAt;
			}
			if (updateData.completedAt) {
				updatedTask.completedAt = updateData.completedAt;
			}
			if (updateData.duration) {
				updatedTask.duration = updateData.duration;
			}
			if (updateData.error) {
				updatedTask.error = updateData.error;
			}
			
			// 新しい配列を作成して更新
			tasks = [...tasks.slice(0, index), updatedTask, ...tasks.slice(index + 1)];
			console.log('[タスク一覧] タスクを更新:', updatedTask);
		}
	}
	
	// すべてのタスクをサブスクライブ
	function subscribeToAllTasks() {
		console.log('[タスク一覧] すべてのタスクをサブスクライブ');
		ws.subscribe('*');
	}
	
	onMount(() => {
		// WebSocketイベントリスナーの登録
		window.addEventListener('websocket:message', handleWebSocketMessage);
		
		// WebSocketに接続
		if (!ws.connected) {
			ws.connect();
		}
		
		// 接続が確立したら、すべてのタスクをサブスクライブ
		if (ws.connected && ws.authenticated) {
			subscribeToAllTasks();
		} else {
			// 接続が確立するまで待つ
			const checkConnection = setInterval(() => {
				if (ws.connected && ws.authenticated) {
					subscribeToAllTasks();
					clearInterval(checkConnection);
				}
			}, 100);
			
			// タイムアウト設定
			setTimeout(() => clearInterval(checkConnection), 5000);
		}
	});
	
	onDestroy(() => {
		// イベントリスナーの削除
		window.removeEventListener('websocket:message', handleWebSocketMessage);
	});
	
	// タスクのステータスに応じたバッジのバリアント
	function getStatusVariant(status: string) {
		switch (status) {
			case 'completed': return 'default';
			case 'running': return 'secondary';
			case 'failed': return 'destructive';
			case 'cancelled': return 'outline';
			default: return 'secondary';
		}
	}
	
	// 日付フォーマット
	function formatDate(date: string | undefined) {
		if (!date) return '-';
		return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: ja });
	}
	
	// 作業ディレクトリパスからリポジトリ名を取得
	function getRepositoryName(path: string | undefined): string {
		if (!path) return '-';
		// パスの最後の部分を取得（例: /path/to/repo -> repo）
		const parts = path.split('/');
		return parts[parts.length - 1] || '-';
	}
	
	// タスクの詳細表示
	function viewTask(taskId: string) {
		// 一時的な回避策：window.location.hrefを使用
		window.location.href = `/tasks/${taskId}`;
	}
	
	
	// 新しいタスク画面へ
	function goToNewTask() {
		// 一時的な回避策：window.location.hrefを使用
		window.location.href = '/tasks/new';
	}
</script>

<!-- タスク一覧ページ -->
<div class="space-y-6">
	<!-- ページヘッダー -->
	<div class="flex justify-between items-center">
		<div>
			<h2 class="text-3xl font-bold tracking-tight">タスク一覧</h2>
			<p class="text-muted-foreground">実行中のタスクを管理</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => window.location.href = '/tasks/tree'}>
				<GitBranch class="mr-2 h-4 w-4" />
				ツリー表示
			</Button>
			<Button onclick={goToNewTask}>
				<Plus class="mr-2 h-4 w-4" />
				新しいタスク
			</Button>
		</div>
	</div>

	<!-- タスク一覧 -->
	<Card.Root>
		<Card.Header>
			<Card.Title>実行中のタスク</Card.Title>
			<Card.Description>
				{tasks.length} 件のタスク
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>ステータス</Table.Head>
						<Table.Head>リポジトリ</Table.Head>
						<Table.Head>指示内容</Table.Head>
						<Table.Head>作成日時</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if tasks && tasks.length > 0}
						{#each tasks as task (task.taskId)}
							<Table.Row 
								class="cursor-pointer hover:bg-muted/50 transition-colors"
								onclick={() => viewTask(task.taskId)}
							>
								<Table.Cell>
									<Badge variant={getStatusVariant(task.status)}>
										{task.status}
									</Badge>
								</Table.Cell>
								<Table.Cell class="text-sm">
									{getRepositoryName(task.context?.workingDirectory || task.workingDirectory)}
								</Table.Cell>
								<Table.Cell class="max-w-md">
									<div class="space-y-1">
										<p class="truncate">{task.instruction}</p>
										{#if task.continuedFrom || task.parentTaskId}
											<div class="flex items-center gap-1 text-xs text-muted-foreground">
												<RefreshCw class="h-3 w-3" />
												<span>継続タスク</span>
											</div>
										{/if}
									</div>
								</Table.Cell>
								<Table.Cell>
									{formatDate(task.createdAt)}
								</Table.Cell>
							</Table.Row>
						{/each}
					{:else}
						<Table.Row>
							<Table.Cell colspan={4} class="text-center text-muted-foreground">
								タスクがありません
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- ページネーション -->
	{#if data.pagination && data.pagination.totalPages > 1}
		<div class="flex justify-center gap-2">
			<Button 
				variant="outline" 
				disabled={data.pagination.page <= 1}
				onclick={() => window.location.href = `/tasks?page=${data.pagination.page - 1}`}
			>
				前へ
			</Button>
			<div class="flex items-center px-4">
				ページ {data.pagination.page} / {data.pagination.totalPages}
			</div>
			<Button 
				variant="outline" 
				disabled={data.pagination.page >= data.pagination.totalPages}
				onclick={() => window.location.href = `/tasks?page=${data.pagination.page + 1}`}
			>
				次へ
			</Button>
		</div>
	{/if}
</div>