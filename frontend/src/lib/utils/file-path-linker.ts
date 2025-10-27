/**
 * ファイルパスリンク変換ユーティリティ
 * テキスト内のファイルパスを検出し、クリック可能なリンクに変換する
 */

export interface FilePathLink {
	original: string;
	path: string;
	line?: number;
	startIndex: number;
	endIndex: number;
}

/**
 * ファイルパスのパターン
 * マッチ例:
 * - src/index.ts
 * - frontend/src/lib/components/Foo.svelte
 * - backend/src/server/routes.ts:42
 * - ./relative/path/file.js
 * - [filename.ts](path/to/file.ts) (Markdown link)
 * - `src/utils/helper.ts` (inline code)
 */
const FILE_PATH_PATTERNS = [
	// Markdown link: [text](path/to/file.ext)
	/\[([^\]]+)\]\(([a-zA-Z0-9_\-./]+\.[a-z]+(?::\d+)?)\)/g,

	// Inline code with file path: `path/to/file.ext` or `path/to/file.ext:123`
	/`([a-zA-Z0-9_\-./]+\/[a-zA-Z0-9_\-./]+\.[a-z]+(?::\d+)?)`/g,

	// Plain file path with optional line number: path/to/file.ext or path/to/file.ext:123
	/(?:^|\s)([a-zA-Z0-9_\-./]+\/[a-zA-Z0-9_\-./]+\.[a-z]+(?::\d+)?)(?:\s|$|[,.](?:\s|$))/g,
];

/**
 * テキストからファイルパスを抽出
 */
export function extractFilePaths(text: string): FilePathLink[] {
	const links: FilePathLink[] = [];
	const seen = new Set<string>(); // 重複を避けるため

	for (const pattern of FILE_PATH_PATTERNS) {
		const regex = new RegExp(pattern.source, pattern.flags);
		let match: RegExpExecArray | null;

		while ((match = regex.exec(text)) !== null) {
			let filePath: string;
			let startIndex: number;
			let endIndex: number;

			// Markdown link の場合
			if (match[0].startsWith('[')) {
				filePath = match[2];
				startIndex = match.index;
				endIndex = match.index + match[0].length;
			}
			// Inline code の場合
			else if (match[0].startsWith('`')) {
				filePath = match[1];
				startIndex = match.index;
				endIndex = match.index + match[0].length;
			}
			// Plain path の場合
			else {
				filePath = match[1];
				startIndex = match.index + (match[0].match(/^\s/) ? 1 : 0);
				endIndex = startIndex + filePath.length;
			}

			// 行番号を分離
			const lineMatch = filePath.match(/^(.+):(\d+)$/);
			const path = lineMatch ? lineMatch[1] : filePath;
			const line = lineMatch ? parseInt(lineMatch[2], 10) : undefined;

			// ファイル拡張子チェック（一般的な拡張子のみ）
			if (!isValidFileExtension(path)) {
				continue;
			}

			// 重複チェック
			const key = `${startIndex}-${endIndex}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);

			links.push({
				original: match[0],
				path,
				line,
				startIndex,
				endIndex
			});
		}
	}

	// startIndexでソート
	return links.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * 有効なファイル拡張子かチェック
 */
function isValidFileExtension(path: string): boolean {
	const validExtensions = [
		'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
		'vue', 'svelte',
		'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp',
		'css', 'scss', 'sass', 'less',
		'html', 'htm', 'xml',
		'json', 'yaml', 'yml', 'toml',
		'md', 'mdx', 'txt',
		'sh', 'bash', 'zsh',
		'sql', 'prisma',
		'graphql', 'gql',
	];

	const ext = path.split('.').pop()?.toLowerCase();
	return ext ? validExtensions.includes(ext) : false;
}

/**
 * ファイルパスをタスクページのURLに変換
 */
export function filePathToUrl(taskId: string, filePath: string, line?: number): string {
	const params = new URLSearchParams();
	params.set('file', filePath);

	// 行番号は現時点では使用しないが、将来的に拡張可能
	// if (line) {
	//   params.set('line', line.toString());
	// }

	return `/tasks/${taskId}?${params.toString()}`;
}

/**
 * テキスト内のファイルパスをHTMLリンクに変換
 * 注意: このHTMLは信頼できる内容に対してのみ使用すること
 */
export function convertFilePathsToLinks(text: string, taskId: string): string {
	const links = extractFilePaths(text);

	if (links.length === 0) {
		return escapeHtml(text);
	}

	let result = '';
	let lastIndex = 0;

	for (const link of links) {
		// リンクの前のテキストを追加
		result += escapeHtml(text.substring(lastIndex, link.startIndex));

		// リンクを作成
		const url = filePathToUrl(taskId, link.path, link.line);
		const displayText = link.line ? `${link.path}:${link.line}` : link.path;
		result += `<a href="${escapeHtml(url)}" class="file-path-link" data-file-path="${escapeHtml(link.path)}">${escapeHtml(displayText)}</a>`;

		lastIndex = link.endIndex;
	}

	// 残りのテキストを追加
	result += escapeHtml(text.substring(lastIndex));

	return result;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}
