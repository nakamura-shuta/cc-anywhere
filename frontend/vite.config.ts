import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// ViteにSvelteKitとTailwind CSS v4プラグインを設定
export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss()
  ],
})
