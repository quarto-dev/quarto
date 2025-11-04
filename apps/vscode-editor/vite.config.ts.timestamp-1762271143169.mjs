// vite.config.ts
import path from "path";
import { defineConfig, normalizePath } from "file:///home/runner/work/quarto/quarto/node_modules/vite/dist/node/index.js";
import { viteStaticCopy } from "file:///home/runner/work/quarto/quarto/node_modules/vite-plugin-static-copy/dist/index.js";
var __vite_injected_original_dirname = "/home/runner/work/quarto/quarto/apps/vscode-editor";
var vite_config_default = defineConfig((env) => {
  const dev = env.mode === "development";
  return {
    define: {
      "process.env.DEBUG": '""',
      "process.env.NODE_ENV": '"production"',
      "process.env.TERM": '""',
      "process.platform": '""'
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: normalizePath(path.resolve(__vite_injected_original_dirname, "./dist/*")),
            dest: normalizePath(path.resolve(__vite_injected_original_dirname, "../vscode/assets/www/editor"))
          }
        ]
      })
    ],
    build: {
      watch: dev ? {} : null,
      lib: {
        entry: "src/index.tsx",
        formats: ["umd"],
        name: "QuartoVisualEditor",
        fileName: () => "index.js"
      },
      rollupOptions: {
        external: ["vscode-webview"]
      },
      sourcemap: dev ? "inline" : false
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29yay9xdWFydG8vcXVhcnRvL2FwcHMvdnNjb2RlLWVkaXRvclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvcnVubmVyL3dvcmsvcXVhcnRvL3F1YXJ0by9hcHBzL3ZzY29kZS1lZGl0b3Ivdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvcnVubmVyL3dvcmsvcXVhcnRvL3F1YXJ0by9hcHBzL3ZzY29kZS1lZGl0b3Ivdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBub3JtYWxpemVQYXRoIH0gZnJvbSAndml0ZSdcbmltcG9ydCB7IHZpdGVTdGF0aWNDb3B5IH0gZnJvbSAndml0ZS1wbHVnaW4tc3RhdGljLWNvcHknXG5cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKGVudiA9PiB7XG4gIFxuICBjb25zdCBkZXYgPSBlbnYubW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiO1xuXG4gIHJldHVybiB7XG4gICAgZGVmaW5lOiB7XG4gICAgICAncHJvY2Vzcy5lbnYuREVCVUcnOiAnXCJcIicsXG4gICAgICAncHJvY2Vzcy5lbnYuTk9ERV9FTlYnOiAnXCJwcm9kdWN0aW9uXCInLFxuICAgICAgJ3Byb2Nlc3MuZW52LlRFUk0nOiAnXCJcIicsXG4gICAgICAncHJvY2Vzcy5wbGF0Zm9ybSc6ICdcIlwiJ1xuICAgIH0sXG4gICAgcGx1Z2luczogW1xuICAgICAgdml0ZVN0YXRpY0NvcHkoe1xuICAgICAgICB0YXJnZXRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiBub3JtYWxpemVQYXRoKHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL2Rpc3QvKicpKSxcbiAgICAgICAgICAgIGRlc3Q6IG5vcm1hbGl6ZVBhdGgocGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uL3ZzY29kZS9hc3NldHMvd3d3L2VkaXRvcicpKVxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSlcbiAgICBdLFxuICAgIGJ1aWxkOiB7XG4gICAgICB3YXRjaDogZGV2ID8ge30gOiBudWxsLFxuICAgICAgbGliOiB7XG4gICAgICAgIGVudHJ5OiAnc3JjL2luZGV4LnRzeCcsXG4gICAgICAgIGZvcm1hdHM6IFsndW1kJ10sXG4gICAgICAgIG5hbWU6IFwiUXVhcnRvVmlzdWFsRWRpdG9yXCIsXG4gICAgICAgIGZpbGVOYW1lOiAoKSA9PiAnaW5kZXguanMnIFxuICAgICAgfSxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgZXh0ZXJuYWw6IFsndnNjb2RlLXdlYnZpZXcnXSxcbiAgICAgIH0sXG4gICAgICBzb3VyY2VtYXA6IGRldiA/ICdpbmxpbmUnIDogZmFsc2VcbiAgICB9XG4gIH07XG4gXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBd1UsT0FBTyxVQUFVO0FBQ3pWLFNBQVMsY0FBYyxxQkFBcUI7QUFDNUMsU0FBUyxzQkFBc0I7QUFGL0IsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhLFNBQU87QUFFakMsUUFBTSxNQUFNLElBQUksU0FBUztBQUV6QixTQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixxQkFBcUI7QUFBQSxNQUNyQix3QkFBd0I7QUFBQSxNQUN4QixvQkFBb0I7QUFBQSxNQUNwQixvQkFBb0I7QUFBQSxJQUN0QjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsZUFBZTtBQUFBLFFBQ2IsU0FBUztBQUFBLFVBQ1A7QUFBQSxZQUNFLEtBQUssY0FBYyxLQUFLLFFBQVEsa0NBQVcsVUFBVSxDQUFDO0FBQUEsWUFDdEQsTUFBTSxjQUFjLEtBQUssUUFBUSxrQ0FBVyw2QkFBNkIsQ0FBQztBQUFBLFVBQzVFO0FBQUEsUUFDRjtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLE9BQU8sTUFBTSxDQUFDLElBQUk7QUFBQSxNQUNsQixLQUFLO0FBQUEsUUFDSCxPQUFPO0FBQUEsUUFDUCxTQUFTLENBQUMsS0FBSztBQUFBLFFBQ2YsTUFBTTtBQUFBLFFBQ04sVUFBVSxNQUFNO0FBQUEsTUFDbEI7QUFBQSxNQUNBLGVBQWU7QUFBQSxRQUNiLFVBQVUsQ0FBQyxnQkFBZ0I7QUFBQSxNQUM3QjtBQUFBLE1BQ0EsV0FBVyxNQUFNLFdBQVc7QUFBQSxJQUM5QjtBQUFBLEVBQ0Y7QUFFRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
