import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // WICHTIG für GitHub Pages: 
  // './' sorgt dafür, dass Assets relativ geladen werden (egal ob Root oder Unterordner/Repo)
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});