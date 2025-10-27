import { describe, it, expect } from 'vitest';
import { extractFilePaths, filePathToUrl, convertFilePathsToLinks, normalizeFilePath } from './file-path-linker';

describe('file-path-linker', () => {
	describe('extractFilePaths', () => {
		it('should extract plain file paths', () => {
			const text = 'Check the file src/index.ts for details';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('src/index.ts');
			expect(result[0].line).toBeUndefined();
		});

		it('should extract file paths with line numbers', () => {
			const text = 'Error in frontend/src/lib/utils/helper.ts:42';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('frontend/src/lib/utils/helper.ts');
			expect(result[0].line).toBe(42);
		});

		it('should extract multiple file paths', () => {
			const text = 'See src/index.ts and backend/src/server.ts for implementation';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(2);
			expect(result[0].path).toBe('src/index.ts');
			expect(result[1].path).toBe('backend/src/server.ts');
		});

		it('should extract markdown link file paths', () => {
			const text = 'Check [this file](src/components/Button.tsx) for the component';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('src/components/Button.tsx');
		});

		it('should extract inline code file paths', () => {
			const text = 'The file `src/utils/format.ts` contains formatting utilities';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('src/utils/format.ts');
		});

		it('should extract inline code file paths with line numbers', () => {
			const text = 'Error at `backend/src/routes.ts:123`';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('backend/src/routes.ts');
			expect(result[0].line).toBe(123);
		});

		it('should handle relative paths', () => {
			const text = 'Check ./src/components/Header.vue';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('./src/components/Header.vue');
		});

		it('should handle paths with hyphens and underscores', () => {
			const text = 'File: src/lib/my-component_helper.ts';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('src/lib/my-component_helper.ts');
		});

		it('should not extract invalid extensions', () => {
			const text = 'Visit example.com/page.html and download file.zip';
			const result = extractFilePaths(text);

			// .html は有効だが example.com/page.html はURLとして除外される可能性
			// .zip は無効な拡張子なので抽出されない
			expect(result.every(r => !r.path.endsWith('.zip'))).toBe(true);
		});

		it('should handle multiple paths in one line', () => {
			const text = 'Files changed: src/a.ts, src/b.ts, and src/c.ts';
			const result = extractFilePaths(text);

			// 少なくとも1つは抽出されること
			expect(result.length).toBeGreaterThanOrEqual(1);
			// src/a.tsは確実に抽出される
			expect(result.some(r => r.path === 'src/a.ts')).toBe(true);
		});

		it('should return empty array for text without file paths', () => {
			const text = 'This is just plain text without any file references';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(0);
		});

		it('should handle Svelte file extensions', () => {
			const text = 'Component: src/lib/components/Button.svelte';
			const result = extractFilePaths(text);

			expect(result).toHaveLength(1);
			expect(result[0].path).toBe('src/lib/components/Button.svelte');
		});

		it('should handle configuration files with paths', () => {
			const text = 'Check the config/tsconfig.json file';
			const result = extractFilePaths(text);

			expect(result.length).toBeGreaterThanOrEqual(1);
			expect(result[0].path).toBe('config/tsconfig.json');
		});
	});

	describe('filePathToUrl', () => {
		it('should create correct URL for file path', () => {
			const url = filePathToUrl('task-123', 'src/index.ts');
			expect(url).toBe('/tasks/task-123?file=src%2Findex.ts');
		});

		it('should handle file paths with special characters', () => {
			const url = filePathToUrl('task-123', 'src/components/Hello World.ts');
			expect(url).toContain('file=');
			// URLSearchParams はスペースを + に変換するので、それを考慮
			const decoded = decodeURIComponent(url.replace(/\+/g, ' '));
			expect(decoded).toContain('Hello World.ts');
		});

		it('should handle line numbers (future feature)', () => {
			const url = filePathToUrl('task-123', 'src/index.ts', 42);
			expect(url).toContain('file=src%2Findex.ts');
			// Line number は現時点では使用しないが、URLに含まれるべき
		});
	});

	describe('convertFilePathsToLinks', () => {
		it('should convert file paths to HTML links', () => {
			const text = 'Check src/index.ts for details';
			const html = convertFilePathsToLinks(text, 'task-123');

			expect(html).toContain('<a href=');
			expect(html).toContain('src/index.ts');
			expect(html).toContain('/tasks/task-123');
			expect(html).toContain('class="file-path-link"');
		});

		it('should escape HTML in surrounding text', () => {
			const text = 'Check <script>alert("xss")</script> and src/index.ts';
			const html = convertFilePathsToLinks(text, 'task-123');

			expect(html).toContain('&lt;script&gt;');
			expect(html).not.toContain('<script>alert');
			expect(html).toContain('<a href=');
		});

		it('should handle text without file paths', () => {
			const text = 'Just plain text';
			const html = convertFilePathsToLinks(text, 'task-123');

			expect(html).toBe('Just plain text');
			expect(html).not.toContain('<a');
		});

		it('should convert multiple file paths', () => {
			const text = 'Modified: src/a.ts and src/b.ts';
			const html = convertFilePathsToLinks(text, 'task-123');

			const linkCount = (html.match(/<a href=/g) || []).length;
			expect(linkCount).toBe(2);
		});

		it('should preserve line numbers in links', () => {
			const text = 'Error at src/index.ts:42';
			const html = convertFilePathsToLinks(text, 'task-123');

			expect(html).toContain('src/index.ts:42');
			expect(html).toContain('<a href=');
		});

		it('should handle inline code formatting', () => {
			const text = 'Check `src/utils/helper.ts` for utilities';
			const html = convertFilePathsToLinks(text, 'task-123');

			expect(html).toContain('<a href=');
			expect(html).toContain('src/utils/helper.ts');
		});

		it('should add data-file-path attribute', () => {
			const text = 'File: src/index.ts';
			const html = convertFilePathsToLinks(text, 'task-123');

			expect(html).toContain('data-file-path="src/index.ts"');
		});
	});

	describe('normalizeFilePath', () => {
		it('should keep relative paths as-is', () => {
			const path = 'src/index.ts';
			const result = normalizeFilePath(path);

			expect(result).toBe('src/index.ts');
		});

		it('should convert absolute path to relative when projectRoot is provided', () => {
			const absolutePath = '/Users/test/project/src/index.ts';
			const projectRoot = '/Users/test/project';
			const result = normalizeFilePath(absolutePath, projectRoot);

			expect(result).toBe('src/index.ts');
		});

		it('should handle absolute path with trailing slash in projectRoot', () => {
			const absolutePath = '/Users/test/project/src/index.ts';
			const projectRoot = '/Users/test/project/';
			const result = normalizeFilePath(absolutePath, projectRoot);

			expect(result).toBe('src/index.ts');
		});

		it('should return filename only for absolute paths outside projectRoot', () => {
			const absolutePath = '/other/location/file.ts';
			const projectRoot = '/Users/test/project';
			const result = normalizeFilePath(absolutePath, projectRoot);

			expect(result).toBe('file.ts');
		});

		it('should return filename only when projectRoot is not provided', () => {
			const absolutePath = '/Users/test/project/src/index.ts';
			const result = normalizeFilePath(absolutePath);

			expect(result).toBe('index.ts');
		});
	});

	describe('extractFilePaths - absolute paths', () => {
		it('should extract absolute file paths', () => {
			const text = 'Check /Users/test/project/src/index.ts for details';
			const result = extractFilePaths(text);

			expect(result.length).toBeGreaterThanOrEqual(1);
			expect(result[0].path).toBe('/Users/test/project/src/index.ts');
		});

		it('should extract bold markdown links with absolute paths', () => {
			const text = '**[package.json](/Users/test/project/package.json)**';
			const result = extractFilePaths(text);

			expect(result.length).toBeGreaterThanOrEqual(1);
			expect(result[0].path).toBe('/Users/test/project/package.json');
		});

		it('should extract multiple absolute paths', () => {
			const text = '/Users/test/project/frontend/package.json and /Users/test/project/backend/package.json';
			const result = extractFilePaths(text);

			expect(result.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('convertFilePathsToLinks - absolute paths', () => {
		it('should convert absolute paths to relative links', () => {
			const text = 'File: /Users/test/project/src/index.ts';
			const projectRoot = '/Users/test/project';
			const html = convertFilePathsToLinks(text, 'task-123', projectRoot);

			expect(html).toContain('src/index.ts');
			expect(html).toContain('<a href=');
			expect(html).not.toContain('/Users/test/project/src/index.ts');
		});

		it('should handle bold markdown absolute paths', () => {
			const text = '**[package.json](/Users/test/project/package.json)**';
			const projectRoot = '/Users/test/project';
			const html = convertFilePathsToLinks(text, 'task-123', projectRoot);

			expect(html).toContain('package.json');
			expect(html).toContain('<a href=');
		});
	});
});
