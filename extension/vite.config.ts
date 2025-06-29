import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-static-files',
      writeBundle() {
        // Copy manifest.json
        copyFileSync('manifest.json', 'dist/manifest.json');
      }
    }
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        'content/inject': resolve(__dirname, 'src/content/inject.ts'),
        sidebar: resolve(__dirname, 'src/sidebar/index.html'),
        popup: resolve(__dirname, 'src/popup/index.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared/dist')
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});