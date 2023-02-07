import { defineConfig } from 'vite'

const writerServerProxyTarget = {
  target: "http://localhost:5001",
  changeOrigin: true
}

export default defineConfig({
  define: {
    'process.env.DEBUG': '""',
    'process.env.NODE_ENV': '"production"',
    'process.env.TERM': '""',
    'process.platform': '""'
  },
  server: {
    proxy: {
      "/rpc": writerServerProxyTarget
    },
  },
});
