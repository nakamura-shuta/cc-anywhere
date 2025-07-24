import type { PageLoad } from './$types';
import { scheduleService } from '$lib/services/schedule.service';
import { error } from '@sveltejs/kit';

// このページは動的データを扱うため、プリレンダリングを無効化
export const prerender = false;

export const load: PageLoad = async ({ url }) => {
	try {
		const page = Number(url.searchParams.get('page')) || 1;
		const limit = Number(url.searchParams.get('limit')) || 10;
		const status = url.searchParams.get('status') || undefined;
		
		const offset = (page - 1) * limit;
		
		const { schedules, total } = await scheduleService.list({
			limit,
			offset,
			status
		});
		
		return {
			schedules,
			total,
			currentPage: page,
			pageSize: limit,
			totalPages: Math.ceil(total / limit),
			status
		};
	} catch (err) {
		console.error('Failed to load schedules:', err);
		throw error(500, 'スケジュールの読み込みに失敗しました');
	}
};