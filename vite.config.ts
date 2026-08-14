import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5180, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Der Lösbarkeits-Suchlauf im Farbsortierer braucht bei vielen Levelnummern
    // hintereinander mehr als die Standard-5s.
    testTimeout: 15000,
  },
});
