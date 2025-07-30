/**
 * 長いパスを省略形式で表示する
 * @param path - フルパス
 * @param maxLength - 最大文字数（デフォルト: 50）
 * @returns 省略されたパス
 */
export function truncatePath(path: string, maxLength: number = 50): string {
	if (!path || path.length <= maxLength) {
		return path;
	}
	
	// パスをセパレーターで分割
	const separator = path.includes('\\') ? '\\' : '/';
	const parts = path.split(separator);
	
	// 最初と最後の部分を保持
	if (parts.length <= 2) {
		// パーツが2つ以下の場合は、単純に切り詰める
		return path.substring(0, maxLength - 3) + '...';
	}
	
	// 最初の部分（ルートまたは最初のディレクトリ）
	const first = parts[0] || separator;
	// 最後の部分（ファイル名または最後のディレクトリ）
	const last = parts[parts.length - 1];
	
	// 最初と最後だけで既に長すぎる場合
	const minLength = first.length + last.length + 5; // 5 = "/.../".length
	if (minLength > maxLength) {
		// 最後の部分を優先して表示
		const availableForLast = maxLength - 5; // ".../"の分
		return '.../' + last.substring(last.length - availableForLast);
	}
	
	// 中間部分を計算
	let middle = parts.slice(1, -1);
	let result = first + separator + middle.join(separator) + separator + last;
	
	// 長さを調整
	while (result.length > maxLength && middle.length > 0) {
		// 中間から要素を削除
		if (middle.length <= 2) {
			// 残りが少ない場合は省略記号だけにする
			result = first + separator + '...' + separator + last;
			break;
		} else {
			// 最初と最後から均等に削除
			if (middle.length % 2 === 0) {
				middle = middle.slice(1);
			} else {
				middle = middle.slice(0, -1);
			}
			result = first + separator + '...' + separator + middle.join(separator) + separator + last;
		}
	}
	
	// それでも長すぎる場合は、最初の部分も含めて省略
	if (result.length > maxLength) {
		const available = maxLength - 6 - last.length; // "/...//" + last
		if (available > 0) {
			result = first.substring(0, available) + '.../' + last;
		} else {
			result = '.../' + last;
		}
	}
	
	return result;
}

/**
 * リポジトリ名とパスを組み合わせて表示用の文字列を作成
 * @param name - リポジトリ名
 * @param path - リポジトリパス
 * @param maxLength - 最大文字数
 * @returns 表示用の文字列
 */
export function formatRepositoryLabel(name: string, path: string, maxLength: number = 60): string {
	// 名前が長い場合は名前も省略
	const truncatedName = name.length > 20 ? name.substring(0, 17) + '...' : name;
	
	// パスを省略
	const remainingLength = maxLength - truncatedName.length - 3; // 3 = " ()".length
	const truncatedPath = truncatePath(path, Math.max(remainingLength, 20));
	
	return `${truncatedName} (${truncatedPath})`;
}