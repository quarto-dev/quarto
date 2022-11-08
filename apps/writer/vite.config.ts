import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      "/editor-server": {
        target: "http://localhost:5001",
        changeOrigin: true
      },
    },
  },
});
