import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import("@sveltejs/kit").Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// ビルド出力先
			pages: "build",
			assets: "build",
			// SPAモード用の設定
			fallback: "index.html",
			precompress: false,
			strict: true
		})
	}
};

export default config;
