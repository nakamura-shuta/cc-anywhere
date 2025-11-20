/**
 * Message content parser utilities
 */

export interface ContentPart {
	type: 'text' | 'image';
	content: string;
	alt?: string;
}

// Image file extensions to detect
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

/**
 * Parse message content to extract text and images
 * Supports:
 * - Markdown images: ![alt](url)
 * - HTTP/HTTPS URLs ending with image extensions
 * - Relative paths starting with / ending with image extensions
 */
export function parseMessageContent(content: string): ContentPart[] {
	const parts: ContentPart[] = [];
	const extensionPattern = IMAGE_EXTENSIONS.join('|');

	// Regex for markdown images: ![alt](url)
	const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	// Regex for standalone image URLs (including relative paths starting with /)
	const imageUrlRegex = new RegExp(
		`((?:https?:\\/\\/[^\\s]+|\\/[^\\s]+)\\.(?:${extensionPattern})(?:\\?[^\\s]*)?)`,
		'gi'
	);

	// First, handle markdown images
	const processedContent = content.replace(markdownImageRegex, (_match, alt, url) => {
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

	for (const segment of segments) {
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

/**
 * Check if content contains any images
 */
export function hasImages(content: string): boolean {
	const extensionPattern = IMAGE_EXTENSIONS.join('|');
	const markdownImageRegex = /!\[[^\]]*\]\([^)]+\)/;
	const imageUrlRegex = new RegExp(
		`(?:https?:\\/\\/[^\\s]+|\\/[^\\s]+)\\.(?:${extensionPattern})`,
		'i'
	);

	return markdownImageRegex.test(content) || imageUrlRegex.test(content);
}
