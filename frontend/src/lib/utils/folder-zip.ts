/**
 * Folder → zip compression utility (browser-side)
 */

import JSZip from 'jszip';

const EXCLUDE_PATTERNS = [
	'node_modules', '.git', 'dist', 'build', '__pycache__',
	'.next', '.venv', '.DS_Store',
];

function shouldExclude(name: string): boolean {
	return EXCLUDE_PATTERNS.some((p) => name === p || name.startsWith(p + '/'));
}

function shouldExcludePath(relativePath: string): boolean {
	return relativePath.split('/').some((part) => EXCLUDE_PATTERNS.includes(part));
}

/**
 * Convert a list of File objects (from directory picker) to a zip Blob.
 * Filters out node_modules, .git, etc.
 */
export async function filesToZip(
	files: FileList,
	onProgress?: (current: number, total: number) => void,
): Promise<{ blob: Blob; fileCount: number; name: string }> {
	const zip = new JSZip();
	let fileCount = 0;
	let rootName = 'workspace';

	// Detect common root folder
	if (files.length > 0) {
		const firstPath = (files[0] as any).webkitRelativePath || files[0].name;
		const parts = firstPath.split('/');
		if (parts.length > 1) {
			rootName = parts[0];
		}
	}

	const total = files.length;
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const relativePath = (file as any).webkitRelativePath || file.name;

		// Remove root folder prefix
		const pathWithoutRoot = relativePath.includes('/')
			? relativePath.split('/').slice(1).join('/')
			: relativePath;

		if (!pathWithoutRoot) continue;
		if (shouldExcludePath(pathWithoutRoot)) continue;

		const buffer = await file.arrayBuffer();
		zip.file(pathWithoutRoot, buffer);
		fileCount++;

		onProgress?.(i + 1, total);
	}

	const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
	return { blob, fileCount, name: rootName };
}
