import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	return {
		title: 'Repository Explorer'
	};
};

export const ssr = false;