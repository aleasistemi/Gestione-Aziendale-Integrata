import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: base deve essere './' per funzionare su Android
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});