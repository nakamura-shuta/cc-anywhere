<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { apiClient } from '$lib/api/client';
	import { ArrowLeft, Play, Info } from 'lucide-svelte';
	import type { TaskResponse } from '$lib/types/api';
	import { formatDate } from '$lib/utils/date';
	import { getStatusVariant } from '$lib/utils/task';
	
	// load関数から受け取るデータ
	let { data }: { data: PageData } = $props();
	
	// フォームの状態
	let instruction = $state('');
	let isSubmitting = $state(false);
	
	// 継続タスクを作成
	async function createContinueTask() {
		if (!instruction.trim()) {
			alert('指示内容を入力してください');
			return;
		}
		
		isSubmitting = true;
		
		const requestData = {
			instruction: instruction,
			context: {
				// 親タスクのコンテキストを引き継ぐ
				workingDirectory: data.parentTask.context?.workingDirectory || data.parentTask.workingDirectory,
				repositories: data.parentTask.context?.repositories
			},
			options: {
				timeout: 600000, // 10分
				async: true, // 非同期実行
				sdk: {
					permissionMode: data.parentTask.options?.permissionMode || 'allow',
					maxTurns: 30
				}
			}
		};
		
		const parentTaskId = data.parentTask.id || data.parentTask.taskId;
		if (!parentTaskId) {
			throw new Error('親タスクのIDが取得できません');
		}
		
		try {
			const response = await apiClient.post<TaskResponse>(`/api/tasks/${parentTaskId}/continue`, requestData);
			
			// タスク詳細画面へ遷移
			window.location.href = `/tasks/${response.taskId}`;
		} catch (error) {
			let errorMessage = '不明なエラー';
			
			// ApiErrorの場合
			if (error && typeof error === 'object' && 'data' in error) {
				const apiError = error as any;
				
				if (apiError.data?.error) {
					errorMessage = apiError.data.error;
				} else if (apiError.data?.message) {
					errorMessage = apiError.data.message;
				} else if (typeof apiError.data === 'string') {
					errorMessage = apiError.data;
				} else {
					errorMessage = `${apiError.status} ${apiError.statusText}`;
				}
			} else if (error instanceof Error) {
				errorMessage = error.message;
			}
			
			// エラーメッセージが文字列でない場合は文字列化
			if (typeof errorMessage !== 'string') {
				errorMessage = JSON.stringify(errorMessage);
			}
			
			alert('継続タスクの作成に失敗しました: ' + errorMessage);
			isSubmitting = false;
		}
	}
</script>

<div class="container mx-auto p-4 md:p-6 max-w-4xl">
	<div class="mb-6">
		<Button variant="ghost" onclick={() => window.location.href = `/tasks/${data.parentTask.id || data.parentTask.taskId}`} class="gap-2 mb-4">
			<ArrowLeft class="h-4 w-4" />
			親タスクに戻る
		</Button>
		<h1 class="text-3xl font-bold">継続タスクを作成</h1>
		<p class="text-muted-foreground mt-2">前回のタスクの結果を踏まえて、新しい指示を入力してください</p>
	</div>
	
	<div class="grid gap-6">
		<!-- 親タスク情報 -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<Card.Title>親タスク情報</Card.Title>
					<Badge variant={getStatusVariant(data.parentTask.status)}>
						{data.parentTask.status}
					</Badge>
				</div>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div>
					<p class="text-sm text-muted-foreground">前回の指示内容</p>
					<p class="whitespace-pre-wrap break-words">{data.parentTask.instruction}</p>
				</div>
				{#if data.parentTask.context?.workingDirectory}
					<div>
						<p class="text-sm text-muted-foreground">作業ディレクトリ</p>
						<p class="font-mono text-sm">{data.parentTask.context.workingDirectory}</p>
					</div>
				{/if}
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-sm text-muted-foreground">完了日時</p>
						<p>{formatDate(data.parentTask.completedAt || data.parentTask.updatedAt, 'full')}</p>
					</div>
					<div>
						<p class="text-sm text-muted-foreground">実行時間</p>
						<p>{data.parentTask.duration ? `${Math.round(data.parentTask.duration / 1000)}秒` : '-'}</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
		
		<!-- 継続タスクフォーム -->
		<Card.Root>
			<Card.Header>
				<Card.Title>新しい指示</Card.Title>
				<Card.Description>
					前回のタスクの文脈を引き継いで実行されます
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
					<div class="flex gap-2">
						<Info class="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
						<div class="text-sm text-blue-800 dark:text-blue-200">
							<p class="font-semibold mb-1">継続タスクについて</p>
							<ul class="list-disc list-inside space-y-1">
								<li>前回の会話履歴が引き継がれます</li>
								<li>同じ作業ディレクトリで実行されます</li>
								<li>前回の変更内容を前提として実行できます</li>
							</ul>
						</div>
					</div>
				</div>
				
				<div class="space-y-2">
					<Label for="instruction">指示内容 <span class="text-destructive">*</span></Label>
					<Textarea
						id="instruction"
						bind:value={instruction}
						placeholder="前回の結果を踏まえて、次に実行したい内容を入力してください"
						rows={6}
						disabled={isSubmitting}
					/>
				</div>
			</Card.Content>
			<Card.Footer>
				<Button 
					onclick={createContinueTask} 
					disabled={isSubmitting || !instruction.trim()}
					class="gap-2"
				>
					<Play class="h-4 w-4" />
					{isSubmitting ? '作成中...' : '継続タスクを作成'}
				</Button>
			</Card.Footer>
		</Card.Root>
	</div>
</div>