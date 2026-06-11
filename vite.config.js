import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: {
    include: ['@xterm/xterm', '@xterm/addon-fit'],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-monaco': ['@monaco-editor/react'],
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit'],
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
})
