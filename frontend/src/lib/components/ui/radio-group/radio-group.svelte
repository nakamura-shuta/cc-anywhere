<script lang="ts">
	import { RadioGroup as RadioGroupPrimitive } from "bits-ui";
	import type { RadioGroupRootProps } from "bits-ui";
	import { cn } from "$lib/utils";

	type $$Props = RadioGroupRootProps;
	
	let { 
		class: className = "",
		value = $bindable(),
		children,
		...restProps 
	}: $$Props = $props();
</script>

<RadioGroupPrimitive.Root
	bind:value
	class={cn("grid gap-2", className)}
	{...restProps}
>
	{@render children?.()}
</RadioGroupPrimitive.Root>