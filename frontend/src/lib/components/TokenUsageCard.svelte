<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	interface TokenUsage {
		input: number;
		output: number;
		cached?: number; // Codex executorのみ返す（未定義の場合は0扱い）
	}

	interface Props {
		tokenUsage: TokenUsage;
		executor?: 'claude' | 'codex';
	}

	let { tokenUsage, executor }: Props = $props();

	// ⚠️ Codex executor専用機能 - Claude executorには影響しない
	const isCodex = $derived(executor === 'codex');
	const cachedTokens = $derived(tokenUsage.cached ?? 0);
	const total = $derived(tokenUsage.input + tokenUsage.output);
	const billed = $derived(total - cachedTokens);
	const cachedPercent = $derived(
		tokenUsage.input > 0 ? Math.round((cachedTokens / tokenUsage.input) * 100) : 0
	);
</script>

{#if isCodex && tokenUsage}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-lg font-semibold">📊 Token Usage</Card.Title>
			<Card.Description class="text-sm text-muted-foreground">
				プロンプトキャッシュによるトークン節約状況
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<!-- Input Tokens -->
			<div class="flex justify-between items-center">
				<span class="text-sm text-muted-foreground">Input Tokens:</span>
				<span class="font-mono font-medium">{tokenUsage.input.toLocaleString()}</span>
			</div>

			<!-- Output Tokens -->
			<div class="flex justify-between items-center">
				<span class="text-sm text-muted-foreground">Output Tokens:</span>
				<span class="font-mono font-medium">{tokenUsage.output.toLocaleString()}</span>
			</div>

			<!-- Cached Tokens (highlighted if > 0) -->
			{#if cachedTokens > 0}
				<div
					class="flex justify-between items-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
				>
					<span class="text-sm font-medium text-amber-900 dark:text-amber-100">
						Cached Tokens: ⭐
					</span>
					<div class="text-right">
						<div class="font-mono font-bold text-amber-900 dark:text-amber-100">
							{cachedTokens.toLocaleString()}
						</div>
						<div class="text-xs text-amber-700 dark:text-amber-300">
							({cachedPercent}% saved)
						</div>
					</div>
				</div>
			{:else}
				<div class="flex justify-between items-center">
					<span class="text-sm text-muted-foreground">Cached Tokens:</span>
					<span class="font-mono font-medium">0</span>
				</div>
			{/if}

			<!-- Divider -->
			<div class="border-t"></div>

			<!-- Total Tokens -->
			<div class="flex justify-between items-center">
				<span class="text-sm text-muted-foreground">Total Tokens:</span>
				<span class="font-mono font-medium">{total.toLocaleString()}</span>
			</div>

			<!-- Billed Tokens (Total - Cached) -->
			<div class="flex justify-between items-center pt-2 border-t">
				<span class="text-sm font-semibold">Total (billed):</span>
				<span class="font-mono font-bold text-lg">{billed.toLocaleString()} tokens</span>
			</div>
		</Card.Content>
	</Card.Root>
{/if}
