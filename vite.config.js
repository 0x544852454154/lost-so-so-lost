import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import protect from './scripts/protect.js';

export default defineConfig({
  plugins: [react(), protect()],
});
