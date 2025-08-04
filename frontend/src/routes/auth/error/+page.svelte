<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { AlertCircle, QrCode, Shield } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { authStore } from '$lib/stores/auth.svelte';
	
	let retrying = false;
	
	async function retryAuth() {
		retrying = true;
		const url = new URL(window.location.href);
		const token = url.searchParams.get('api_key');
		
		if (token) {
			const success = await authStore.authenticate(token);
			if (success) {
				// 成功したらトップページへ
				window.location.href = '/';
			} else {
				alert('認証に失敗しました。QRコードを再度スキャンしてください。');
			}
		} else {
			alert('認証トークンがURLに含まれていません。QRコードを再度スキャンしてください。');
		}
		retrying = false;
	}
</script>

<div class="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="text-center">
			<div class="mx-auto mb-4 w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
				<Shield class="w-10 h-10 text-red-600 dark:text-red-400" />
			</div>
			<Card.Title class="text-2xl font-bold text-red-600 dark:text-red-400">
				認証が必要です
			</Card.Title>
			<Card.Description class="mt-2">
				このページにアクセスするには認証が必要です
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
				<div class="flex items-start gap-3">
					<AlertCircle class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
					<div class="text-sm text-amber-800 dark:text-amber-200">
						<p class="font-semibold mb-1">アクセス方法</p>
						<p>管理者から提供されたQRコードをスキャンしてアクセスしてください。</p>
					</div>
				</div>
			</div>
			
			<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
				<div class="flex items-start gap-3">
					<QrCode class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
					<div class="text-sm text-blue-800 dark:text-blue-200">
						<p class="font-semibold mb-1">QRコードについて</p>
						<ul class="list-disc list-inside space-y-1 mt-2">
							<li>QRコードには認証トークンが含まれています</li>
							<li>一度認証すると24時間有効です</li>
							<li>期限が切れた場合は再度QRコードをスキャンしてください</li>
						</ul>
					</div>
				</div>
			</div>
			
			<div class="text-center text-sm text-muted-foreground">
				<p>QRコードをお持ちでない場合は、</p>
				<p>システム管理者にお問い合わせください。</p>
			</div>
			
			<div class="pt-4">
				<Button onclick={retryAuth} disabled={retrying} class="w-full">
					{retrying ? '認証中...' : '再度認証を試みる'}
				</Button>
			</div>
		</Card.Content>
		<Card.Footer class="flex flex-col gap-2 text-xs text-muted-foreground">
			<p>セキュリティのため、認証なしではアクセスできません。</p>
			<p>CC-Anywhere Security</p>
		</Card.Footer>
	</Card.Root>
</div>