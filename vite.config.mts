import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = process.cwd();

export default defineConfig({
  root: path.resolve(root, 'web'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(root, 'dist/web'),
    emptyOutDir: true,
  },
});
