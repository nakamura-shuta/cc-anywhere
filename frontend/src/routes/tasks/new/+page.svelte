<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { taskStore } from '$lib/stores/api.svelte';
	import { taskService } from '$lib/services/task.service';
	import { ArrowLeft, Send, MessageSquare } from 'lucide-svelte';
	import type { TaskRequest } from '$lib/types/api';
	import DirectorySelector from '$lib/components/directory-selector.svelte';
	import { onMount } from 'svelte';
	import * as Alert from '$lib/components/ui/alert';
	
	// フォームの状態
	let instruction = $state('');
	let selectedDirectories = $state<string[]>([]);
	let maxTurns = $state(30);
	let timeout = $state(300000);
	let useAsync = $state(true);
	let permissionMode = $state<string>('allow');
	
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
			} catch (error) {
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
					...(isSdkContinueMode && continueFromTaskId ? { continueFromTaskId } : {})
				}
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
</script>

<div class="container mx-auto p-6 max-w-2xl">
	<div class="mb-6">
		<Button variant="ghost" onclick={() => goto('/tasks')} class="gap-2 mb-4">
			<ArrowLeft class="h-4 w-4" />
			タスク一覧に戻る
		</Button>
		<h1 class="text-3xl font-bold">
			{isSdkContinueMode ? 'SDK Continue - 会話を継続' : '新規タスク作成'}
		</h1>
	</div>

	{#if isSdkContinueMode && previousTask}
		<Alert.Root class="mb-6">
			<MessageSquare class="h-4 w-4" />
			<Alert.Title>SDK Continueモード</Alert.Title>
			<Alert.Description>
				<p class="mb-2">前回の会話の文脈を保持して継続します。</p>
				<div class="mt-2 p-2 bg-muted rounded text-sm">
					<p class="font-medium mb-1">前回のタスク:</p>
					<p class="text-muted-foreground">{previousTask.instruction}</p>
				</div>
			</Alert.Description>
		</Alert.Root>
	{/if}
	
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
						selectedDirectories = selected;
					}}
					readonly={isSdkContinueMode}
				/>

				<div class="grid grid-cols-2 gap-4">
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


				<div class="flex gap-2 pt-4">
					<Button type="submit" disabled={submitting} class="gap-2">
						<Send class="h-4 w-4" />
						{submitting ? '作成中...' : 'タスクを作成'}
					</Button>
					<Button type="button" variant="outline" onclick={() => goto('/tasks')}>
						キャンセル
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>

<style>
	:global(.required::after) {
		content: ' *';
		color: rgb(239 68 68);
	}
</style>