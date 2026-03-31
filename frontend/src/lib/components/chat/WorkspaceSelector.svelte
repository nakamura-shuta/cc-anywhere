<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as workspaceApi from '$lib/api/workspace';
	import type { Workspace } from '$lib/api/workspace';
	import { filesToZip } from '$lib/utils/folder-zip';

	interface Props {
		workspaces: Workspace[];
		selectedWorkspaceId?: string;
		onSelect: (workspaceId: string | undefined) => void;
		onUploadComplete: (workspace: Workspace) => void;
	}

	let { workspaces, selectedWorkspaceId, onSelect, onUploadComplete }: Props = $props();

	let uploading = $state(false);
	let uploadProgress = $state('');
	let error = $state('');

	let folderInput: HTMLInputElement;

	async function handleFolderSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;

		uploading = true;
		error = '';
		uploadProgress = 'Compressing...';

		try {
			const { blob, fileCount, name } = await filesToZip(files, (current, total) => {
				uploadProgress = `Compressing... ${current}/${total}`;
			});

			uploadProgress = `Uploading ${fileCount} files...`;

			const zipFile = new File([blob], `${name}.zip`, { type: 'application/zip' });
			const workspace = await workspaceApi.uploadWorkspace(zipFile, name);

			onUploadComplete(workspace);
			onSelect(workspace.id);
			uploadProgress = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Upload failed';
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	async function handleDelete(id: string, event: Event) {
		event.stopPropagation();
		try {
			await workspaceApi.deleteWorkspace(id);
			if (selectedWorkspaceId === id) onSelect(undefined);
			onUploadComplete({} as any); // trigger refresh
		} catch (err) {
			error = err instanceof Error ? err.message : 'Delete failed';
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes}B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		return `${diffDays}d ago`;
	}
</script>

<div class="space-y-3">
	<div class="text-sm font-medium">Workspace</div>

	<!-- Upload button -->
	<button
		class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
		onclick={() => folderInput?.click()}
		disabled={uploading}
	>
		{#if uploading}
			<span class="animate-pulse">{uploadProgress}</span>
		{:else}
			<span>Select folder to upload</span>
		{/if}
	</button>

	<input
		bind:this={folderInput}
		type="file"
		class="hidden"
		webkitdirectory
		onchange={handleFolderSelect}
	/>

	{#if error}
		<p class="text-xs text-red-500">{error}</p>
	{/if}

	<!-- No workspace option -->
	<button
		class="w-full rounded-lg p-2 text-left text-sm transition-colors
			{!selectedWorkspaceId ? 'bg-primary/10' : 'hover:bg-muted'}"
		onclick={() => onSelect(undefined)}
	>
		<span class="text-muted-foreground">No workspace (server directory)</span>
	</button>

	<!-- Workspace list -->
	{#each workspaces as ws (ws.id)}
		<div
			class="group flex items-center justify-between rounded-lg p-2 transition-colors
				{selectedWorkspaceId === ws.id ? 'bg-primary/10' : 'hover:bg-muted'}"
		>
			<button
				class="flex-1 text-left"
				onclick={() => onSelect(ws.id)}
			>
				<div class="text-sm font-medium">{ws.name}</div>
				<div class="text-xs text-muted-foreground">
					{ws.fileCount} files, {formatSize(ws.totalSize)}, {formatDate(ws.createdAt)}
				</div>
			</button>
			<Button
				variant="ghost"
				size="sm"
				class="opacity-0 group-hover:opacity-100"
				onclick={(e: Event) => handleDelete(ws.id, e)}
			>
				Delete
			</Button>
		</div>
	{/each}
</div>
