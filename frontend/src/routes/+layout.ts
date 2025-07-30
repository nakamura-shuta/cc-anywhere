// SPA（シングルページアプリケーション）として動作させる設定
// これにより、すべてのルーティングがクライアントサイドで処理される

// プリレンダリングを無効化（SPAなので不要）
export const prerender = false;

// サーバーサイドレンダリングを無効化（SPAモード）
export const ssr = false;

// クライアントサイドレンダリングを有効化
export const csr = true;