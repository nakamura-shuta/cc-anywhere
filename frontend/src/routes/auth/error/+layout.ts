// 認証エラーページは認証チェックをスキップする設定
export const prerender = false;
export const ssr = false;
export const csr = true;

// 親レイアウトの認証チェックをバイパス
export const load = async () => {
	return {};
};