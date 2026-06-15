import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: 'popup.html',
        manager: 'manager.html',
        options: 'options.html',
        background: 'src/background/index.ts'
      },
      output: {
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: '[name].js'
      }
    }
  }
});
