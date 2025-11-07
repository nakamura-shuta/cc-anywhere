/**
 * 日付をフォーマットする
 * @param date - Date オブジェクト、日付文字列、またはUnixタイムスタンプ（ミリ秒）
 * @param format - フォーマット形式 ('full' | 'date' | 'time' | 'relative')
 * @returns フォーマットされた日付文字列
 */
export function formatDate(
	date: Date | string | number | undefined,
	format: 'full' | 'date' | 'time' | 'relative' = 'full'
): string {
	if (!date) return '-';

	const d = typeof date === 'string' ? new Date(date)
	        : typeof date === 'number' ? new Date(date)
	        : date;

	// 無効な日付の場合
	if (isNaN(d.getTime())) return '-';
	
	const now = new Date();
	const diff = now.getTime() - d.getTime();
	
	switch (format) {
		case 'relative': {
			// 相対時間表示
			const seconds = Math.floor(diff / 1000);
			const minutes = Math.floor(seconds / 60);
			const hours = Math.floor(minutes / 60);
			const days = Math.floor(hours / 24);
			
			if (seconds < 60) return 'たった今';
			if (minutes < 60) return `${minutes}分前`;
			if (hours < 24) return `${hours}時間前`;
			if (days < 7) return `${days}日前`;
			// 1週間以上前は日付表示にフォールバック
			break;
		}
		
		case 'date':
			// 日付のみ
			return d.toLocaleDateString('ja-JP', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit'
			});
			
		case 'time':
			// 時刻のみ
			return d.toLocaleTimeString('ja-JP', {
				hour: '2-digit',
				minute: '2-digit'
			});
			
		case 'full':
		default:
			// 日付と時刻
			return d.toLocaleString('ja-JP', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
	}
	
	// デフォルト（1週間以上前の相対時間）
	return d.toLocaleDateString('ja-JP', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
}

/**
 * ISO文字列を現地時間の日時入力フォーマットに変換
 * @param isoString - ISO形式の日時文字列
 * @returns YYYY-MM-DDTHH:mm 形式の文字列
 */
export function toDateTimeLocal(isoString: string | Date | undefined): string {
	if (!isoString) return '';
	
	const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
	
	if (isNaN(date.getTime())) return '';
	
	// YYYY-MM-DDTHH:mm 形式に変換
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * 日時入力フォーマットをISO文字列に変換
 * @param dateTimeLocal - YYYY-MM-DDTHH:mm 形式の文字列
 * @returns ISO形式の日時文字列
 */
export function fromDateTimeLocal(dateTimeLocal: string): string {
	if (!dateTimeLocal) return '';
	
	const date = new Date(dateTimeLocal);
	
	if (isNaN(date.getTime())) return '';
	
	return date.toISOString();
}