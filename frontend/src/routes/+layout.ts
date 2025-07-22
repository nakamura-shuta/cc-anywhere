// SPA（シングルページアプリケーション）として動作させる設定
// これにより、すべてのルーティングがクライアントサイドで処理される

// プリレンダリングを有効化（静的サイト生成）
export const prerender = true;

// サーバーサイドレンダリングを無効化（SPAモード）
export const ssr = false;

// クライアントサイドレンダリングを有効化
export const csr = true;