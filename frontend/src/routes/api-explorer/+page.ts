// API Explorerのデータロード

import type { PageLoad } from './$types';

// このページは動的データを扱うため、プリレンダリングを無効化
export const prerender = false;

export const load: PageLoad = async () => {
	// 現時点では特にデータロードは不要
	return {};
};