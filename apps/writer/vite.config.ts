import { defineConfig } from 'vite'

const writerServerProxyTarget = {
  target: "http://localhost:5001",
  changeOrigin: true
}

export default defineConfig({
  server: {
    proxy: {
      "/editor-server": writerServerProxyTarget,
      "/editor-services": writerServerProxyTarget,
      "/writer-server": writerServerProxyTarget
    },
  },
});
