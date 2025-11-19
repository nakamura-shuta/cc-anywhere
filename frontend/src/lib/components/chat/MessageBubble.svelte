<script lang="ts">
	import type { ChatMessage } from '$lib/api/chat';

	interface Props {
		message: ChatMessage;
	}

	let { message }: Props = $props();

	const isUser = $derived(message.role === 'user');

	// Parse content to extract images and text
	interface ContentPart {
		type: 'text' | 'image';
		content: string;
		alt?: string;
	}

	function parseContent(content: string): ContentPart[] {
		const parts: ContentPart[] = [];

		// Regex for markdown images: ![alt](url)
		const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
		// Regex for standalone image URLs (including relative paths starting with /)
		const imageUrlRegex = /((?:https?:\/\/[^\s]+|\/[^\s]+)\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s]*)?)/gi;

		let lastIndex = 0;
		let match;

		// First, handle markdown images
		const processedContent = content.replace(markdownImageRegex, (match, alt, url) => {
			return `__IMAGE__${alt}__${url}__IMAGE__`;
		});

		// Then handle standalone URLs
		const finalContent = processedContent.replace(imageUrlRegex, (url) => {
			if (!url.includes('__IMAGE__')) {
				return `__IMAGE____${url}__IMAGE__`;
			}
			return url;
		});

		// Split by image markers
		const segments = finalContent.split(/__IMAGE__/);

		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			if (!segment) continue;

			// Check if this is an image segment (format: alt__url or __url)
			const imageMatch = segment.match(/^(.*)__(.+)$/);
			if (imageMatch) {
				const [, alt, url] = imageMatch;
				parts.push({ type: 'image', content: url, alt: alt || undefined });
			} else {
				parts.push({ type: 'text', content: segment });
			}
		}

		return parts;
	}

	const contentParts = $derived(parseContent(message.content));
</script>

<div class="flex {isUser ? 'justify-end' : 'justify-start'}">
	<div
		class="max-w-[80%] rounded-lg px-4 py-2 {isUser
			? 'bg-primary text-primary-foreground'
			: 'bg-muted'}"
	>
		<div class="whitespace-pre-wrap break-words text-sm">
			{#each contentParts as part}
				{#if part.type === 'image'}
					<img
						src={part.content}
						alt={part.alt || 'Image'}
						class="my-2 max-w-full rounded-md"
						loading="lazy"
					/>
				{:else}
					{part.content}
				{/if}
			{/each}
		</div>
		<div class="mt-1 text-xs opacity-70">
			{new Date(message.createdAt).toLocaleTimeString()}
		</div>
	</div>
</div>
