<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '$lib/components/ui/sheet';
	import { page } from '$app/stores';
	
	// Props
	interface Props {
		navItems: Array<{ href: string; label: string }>;
	}
	
	let { navItems }: Props = $props();
	
	// メニューアイコン（ハンバーガー）
	const MenuIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="18" y2="18"/></svg>`;
	
	let open = $state(false);
	
	// ページ遷移時にメニューを閉じる
	$effect(() => {
		$page.url;
		open = false;
	});
</script>

<Sheet bind:open>
	<SheetTrigger>
		<Button 
			variant="ghost" 
			size="icon"
			class="lg:hidden"
			aria-label="メニューを開く"
		>
			{@html MenuIcon}
		</Button>
	</SheetTrigger>
	<SheetContent side="left" class="w-[300px] sm:w-[400px]">
		<SheetHeader>
			<SheetTitle>メニュー</SheetTitle>
		</SheetHeader>
		<nav class="mt-6 flex flex-col gap-2">
			{#each navItems as item}
				<Button 
					href={item.href}
					variant={$page.url.pathname === item.href ? 'secondary' : 'ghost'}
					class="justify-start w-full text-base"
					size="lg"
				>
					{item.label}
				</Button>
			{/each}
		</nav>
	</SheetContent>
</Sheet>