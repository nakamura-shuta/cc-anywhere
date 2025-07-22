<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { taskStore } from '$lib/stores/api.svelte';
	import { ArrowLeft, Send } from 'lucide-svelte';
	import type { TaskRequest } from '$lib/types/api';
	
	// フォームの状態
	let instruction = $state('');
	let workingDirectory = $state('');
	let maxTurns = $state(30);
	let timeout = $state(300000);
	let useAsync = $state(false);
	let permissionMode = $state<string>('ask');
	
	// 送信中フラグ
	let submitting = $state(false);
	
	// フォームの送信
	async function handleSubmit(event: Event) {
		event.preventDefault();
		
		if (!instruction.trim()) {
			alert('指示内容を入力してください');
			return;
		}
		
		submitting = true;
		
		const request: TaskRequest = {
			instruction: instruction.trim(),
			context: workingDirectory ? { workingDirectory } : undefined,
			options: {
				timeout,
				async: useAsync,
				sdk: {
					maxTurns,
					permissionMode: permissionMode as 'ask' | 'allow' | 'deny' | 'acceptEdits' | 'bypassPermissions' | 'plan'
				}
			}
		};
		
		try {
			const result = await taskStore.createTask(request);
			if (result.data) {
				// 作成成功したらタスク詳細ページへ
				goto(`/tasks/${result.data.id}`);
			}
		} catch (error) {
			console.error('Failed to create task:', error);
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
		<h1 class="text-3xl font-bold">新規タスク作成</h1>
	</div>

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

				<div class="space-y-2">
					<Label for="workingDirectory">作業ディレクトリ</Label>
					<Input
						id="workingDirectory"
						bind:value={workingDirectory}
						placeholder="例: /path/to/project"
					/>
					<p class="text-sm text-muted-foreground">
						指定しない場合はデフォルトのディレクトリが使用されます
					</p>
				</div>

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
					<Select.Root type="multiple" value={[permissionMode]} onValueChange={(v: string[]) => permissionMode = v[0] || 'ask'}>
						<Select.Trigger id="permissionMode">
							<span>{permissionMode === 'ask' ? '確認する (ask)' : permissionMode === 'allow' ? 'すべて許可 (allow)' : permissionMode === 'deny' ? 'すべて拒否 (deny)' : '権限モードを選択'}</span>
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="ask">確認する (ask)</Select.Item>
							<Select.Item value="allow">すべて許可 (allow)</Select.Item>
							<Select.Item value="deny">すべて拒否 (deny)</Select.Item>
							<Select.Item value="acceptEdits">編集を受け入れる</Select.Item>
							<Select.Item value="plan">計画モード</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="flex items-center space-x-2">
					<Switch id="async" bind:checked={useAsync} />
					<Label for="async">非同期実行</Label>
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