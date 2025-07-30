import { describe, it, expect } from 'vitest';
import { truncatePath, formatRepositoryLabel } from './path';

describe('truncatePath', () => {
	it('短いパスはそのまま返す', () => {
		expect(truncatePath('/home/user/project', 50)).toBe('/home/user/project');
	});
	
	it('長いパスの中間を省略する', () => {
		const longPath = '/home/user/very/long/path/to/project/directory';
		const result = truncatePath(longPath, 30);
		expect(result).toContain('...');
		expect(result.length).toBeLessThanOrEqual(30);
		// 最後の部分は必ず含まれる
		expect(result).toContain('directory');
		// 省略形式になっていることを確認
		expect(result.includes('/home/user/very/long/path/to/project/directory')).toBe(false);
	});
	
	it('Windowsパスも処理できる', () => {
		const windowsPath = 'C:\\Users\\username\\Documents\\Projects\\MyProject';
		const result = truncatePath(windowsPath, 30);
		expect(result).toContain('...');
		expect(result).toContain('C:');
		expect(result).toContain('MyProject');
	});
	
	it('パーツが少ない場合は単純に切り詰める', () => {
		const shortPath = '/verylongdirectoryname';
		const result = truncatePath(shortPath, 15);
		expect(result).toBe('/verylongdir...');
	});
});

describe('formatRepositoryLabel', () => {
	it('短い名前とパスはそのまま表示', () => {
		const result = formatRepositoryLabel('MyProject', '/home/user/project');
		expect(result).toBe('MyProject (/home/user/project)');
	});
	
	it('長い名前は省略される', () => {
		const longName = 'VeryLongProjectNameThatShouldBeTruncated';
		const result = formatRepositoryLabel(longName, '/path');
		expect(result).toContain('...');
		expect(result.startsWith('VeryLongProjectNa')).toBe(true);
	});
	
	it('長いパスは中間が省略される', () => {
		const result = formatRepositoryLabel(
			'Project',
			'/home/user/very/long/path/to/project/directory/with/many/levels',
			60
		);
		expect(result).toContain('...');
		expect(result).toContain('Project');
		expect(result).toContain('levels');
		expect(result.length).toBeLessThanOrEqual(60);
	});
});