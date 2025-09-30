// vite.config.ts
import { defineConfig } from "file:///C:/Users/ashaj/OneDrive/Desktop/Neftit_Auth_Blockchain_Backend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/ashaj/OneDrive/Desktop/Neftit_Auth_Blockchain_Backend/node_modules/@vitejs/plugin-react-swc/index.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import mdx from "file:///C:/Users/ashaj/OneDrive/Desktop/Neftit_Auth_Blockchain_Backend/node_modules/@mdx-js/rollup/index.js";
import remarkGfm from "file:///C:/Users/ashaj/OneDrive/Desktop/Neftit_Auth_Blockchain_Backend/node_modules/remark-gfm/index.js";
import rehypeSlug from "file:///C:/Users/ashaj/OneDrive/Desktop/Neftit_Auth_Blockchain_Backend/node_modules/rehype-slug/index.js";
import rehypeAutolinkHeadings from "file:///C:/Users/ashaj/OneDrive/Desktop/Neftit_Auth_Blockchain_Backend/node_modules/rehype-autolink-headings/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/ashaj/OneDrive/Desktop/Neftit_Auth_Blockchain_Backend/vite.config.ts";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname = dirname(__filename);
var ignoreModelViewerPlugin = () => {
  return {
    name: "ignore-model-viewer",
    resolveId(id) {
      if (id.includes("@google/model-viewer")) {
        return id;
      }
    },
    load(id) {
      if (id.includes("@google/model-viewer")) {
        return "export default {};";
      }
    }
  };
};
var vite_config_default = defineConfig(({ mode }) => {
  const isProd = mode === "production";
  return {
    plugins: [
      {
        ...mdx({
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings]
        }),
        enforce: "pre"
        // run MDX before React
      },
      react(),
      ignoreModelViewerPlugin()
    ],
    server: {
      host: true,
      port: 3333,
      watch: {
        usePolling: true
        // helps on Windows/WSL to reload .mdx edits
      },
      // Allow external host access (for Codesandbox/Cloud dev)
      allowedHosts: ["y4gfpc-3333.csb.app"]
      // or 'all'
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src")
      },
      extensions: [".js", ".ts", ".jsx", ".tsx", ".mdx"]
      // allow MDX imports
    },
    define: {
      "process.env": process.env,
      global: "globalThis"
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "./src/styles/font-reset.css";`
        }
      }
    },
    build: {
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd
        }
      },
      rollupOptions: {
        external: ["@google/model-viewer"],
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-ui": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-tooltip",
              "class-variance-authority",
              "clsx",
              "tailwind-merge"
            ],
            "vendor-web3": [
              "@thirdweb-dev/react",
              "@thirdweb-dev/sdk",
              "@thirdweb-dev/auth",
              "ethers"
            ],
            "vendor-utils": ["date-fns", "framer-motion", "sonner"]
          }
        }
      },
      sourcemap: !isProd,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1e3
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@thirdweb-dev/react",
        "ethers",
        "framer-motion",
        "buffer"
      ],
      // Exclude problematic packages
      exclude: ["@google/model-viewer"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhc2hhalxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXE5lZnRpdF9BdXRoX0Jsb2NrY2hhaW5fQmFja2VuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYXNoYWpcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxOZWZ0aXRfQXV0aF9CbG9ja2NoYWluX0JhY2tlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2FzaGFqL09uZURyaXZlL0Rlc2t0b3AvTmVmdGl0X0F1dGhfQmxvY2tjaGFpbl9CYWNrZW5kL3ZpdGUuY29uZmlnLnRzXCI7Ly8gdml0ZS5jb25maWcudHNcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJztcclxuaW1wb3J0IHsgZGlybmFtZSwgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCBtZHggZnJvbSBcIkBtZHgtanMvcm9sbHVwXCI7XHJcblxyXG5jb25zdCBfX2ZpbGVuYW1lID0gZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpO1xyXG5jb25zdCBfX2Rpcm5hbWUgPSBkaXJuYW1lKF9fZmlsZW5hbWUpO1xyXG5cclxuLy8gTWFya2Rvd24gcGx1Z2luc1xyXG5pbXBvcnQgcmVtYXJrR2ZtIGZyb20gXCJyZW1hcmstZ2ZtXCI7XHJcbmltcG9ydCByZWh5cGVTbHVnIGZyb20gXCJyZWh5cGUtc2x1Z1wiO1xyXG5pbXBvcnQgcmVoeXBlQXV0b2xpbmtIZWFkaW5ncyBmcm9tIFwicmVoeXBlLWF1dG9saW5rLWhlYWRpbmdzXCI7XHJcblxyXG4vLyBQbHVnaW4gdG8gaGFuZGxlIHByb2JsZW1hdGljIEBnb29nbGUvbW9kZWwtdmlld2VyIGltcG9ydHNcclxuY29uc3QgaWdub3JlTW9kZWxWaWV3ZXJQbHVnaW4gPSAoKSA9PiB7XHJcbiAgcmV0dXJuIHtcclxuICAgIG5hbWU6ICdpZ25vcmUtbW9kZWwtdmlld2VyJyxcclxuICAgIHJlc29sdmVJZChpZDogc3RyaW5nKSB7XHJcbiAgICAgIGlmIChpZC5pbmNsdWRlcygnQGdvb2dsZS9tb2RlbC12aWV3ZXInKSkge1xyXG4gICAgICAgIHJldHVybiBpZDtcclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIGxvYWQoaWQ6IHN0cmluZykge1xyXG4gICAgICBpZiAoaWQuaW5jbHVkZXMoJ0Bnb29nbGUvbW9kZWwtdmlld2VyJykpIHtcclxuICAgICAgICByZXR1cm4gJ2V4cG9ydCBkZWZhdWx0IHt9Oyc7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG59O1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGNvbnN0IGlzUHJvZCA9IG1vZGUgPT09IFwicHJvZHVjdGlvblwiO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgIHtcclxuICAgICAgICAuLi5tZHgoe1xyXG4gICAgICAgICAgcmVtYXJrUGx1Z2luczogW3JlbWFya0dmbV0sXHJcbiAgICAgICAgICByZWh5cGVQbHVnaW5zOiBbcmVoeXBlU2x1ZywgcmVoeXBlQXV0b2xpbmtIZWFkaW5nc10sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgZW5mb3JjZTogXCJwcmVcIiwgLy8gcnVuIE1EWCBiZWZvcmUgUmVhY3RcclxuICAgICAgfSxcclxuICAgICAgcmVhY3QoKSxpZ25vcmVNb2RlbFZpZXdlclBsdWdpbigpXHJcbiAgICBdLFxyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgIGhvc3Q6IHRydWUsXHJcbiAgICAgIHBvcnQ6IDMzMzMsXHJcbiAgICAgIHdhdGNoOiB7XHJcbiAgICAgICAgdXNlUG9sbGluZzogdHJ1ZSwgLy8gaGVscHMgb24gV2luZG93cy9XU0wgdG8gcmVsb2FkIC5tZHggZWRpdHNcclxuICAgICAgfSxcclxuICAgICAgLy8gQWxsb3cgZXh0ZXJuYWwgaG9zdCBhY2Nlc3MgKGZvciBDb2Rlc2FuZGJveC9DbG91ZCBkZXYpXHJcbiAgICAgIGFsbG93ZWRIb3N0czogW1wieTRnZnBjLTMzMzMuY3NiLmFwcFwiXSwgLy8gb3IgJ2FsbCdcclxuICAgIH0sXHJcbiAgICByZXNvbHZlOiB7XHJcbiAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgXCJAXCI6IHJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICB9LFxyXG4gICAgICBleHRlbnNpb25zOiBbXCIuanNcIiwgXCIudHNcIiwgXCIuanN4XCIsIFwiLnRzeFwiLCBcIi5tZHhcIl0sIC8vIGFsbG93IE1EWCBpbXBvcnRzXHJcbiAgICB9LFxyXG4gICAgZGVmaW5lOiB7XHJcbiAgICAgIFwicHJvY2Vzcy5lbnZcIjogcHJvY2Vzcy5lbnYsXHJcbiAgICAgIGdsb2JhbDogXCJnbG9iYWxUaGlzXCIsXHJcbiAgICB9LFxyXG4gICAgY3NzOiB7XHJcbiAgICAgIHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcclxuICAgICAgICBzY3NzOiB7XHJcbiAgICAgICAgICBhZGRpdGlvbmFsRGF0YTogYEBpbXBvcnQgXCIuL3NyYy9zdHlsZXMvZm9udC1yZXNldC5jc3NcIjtgLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgbWluaWZ5OiBcInRlcnNlclwiLFxyXG4gICAgICB0ZXJzZXJPcHRpb25zOiB7XHJcbiAgICAgICAgY29tcHJlc3M6IHtcclxuICAgICAgICAgIGRyb3BfY29uc29sZTogaXNQcm9kLFxyXG4gICAgICAgICAgZHJvcF9kZWJ1Z2dlcjogaXNQcm9kLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICBleHRlcm5hbDogWydAZ29vZ2xlL21vZGVsLXZpZXdlciddLFxyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAgIFwidmVuZG9yLXJlYWN0XCI6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3Qtcm91dGVyLWRvbVwiXSxcclxuICAgICAgICAgICAgXCJ2ZW5kb3ItdWlcIjogW1xyXG4gICAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LWRpYWxvZ1wiLFxyXG4gICAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LWRyb3Bkb3duLW1lbnVcIixcclxuICAgICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC10b29sdGlwXCIsXHJcbiAgICAgICAgICAgICAgXCJjbGFzcy12YXJpYW5jZS1hdXRob3JpdHlcIixcclxuICAgICAgICAgICAgICBcImNsc3hcIixcclxuICAgICAgICAgICAgICBcInRhaWx3aW5kLW1lcmdlXCIsXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIFwidmVuZG9yLXdlYjNcIjogW1xyXG4gICAgICAgICAgICAgIFwiQHRoaXJkd2ViLWRldi9yZWFjdFwiLFxyXG4gICAgICAgICAgICAgIFwiQHRoaXJkd2ViLWRldi9zZGtcIixcclxuICAgICAgICAgICAgICBcIkB0aGlyZHdlYi1kZXYvYXV0aFwiLFxyXG4gICAgICAgICAgICAgIFwiZXRoZXJzXCIsXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIFwidmVuZG9yLXV0aWxzXCI6IFtcImRhdGUtZm5zXCIsIFwiZnJhbWVyLW1vdGlvblwiLCBcInNvbm5lclwiXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgc291cmNlbWFwOiAhaXNQcm9kLFxyXG4gICAgICByZXBvcnRDb21wcmVzc2VkU2l6ZTogdHJ1ZSxcclxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgfSxcclxuICAgIG9wdGltaXplRGVwczoge1xyXG4gICAgICBpbmNsdWRlOiBbXHJcbiAgICAgICAgXCJyZWFjdFwiLFxyXG4gICAgICAgIFwicmVhY3QtZG9tXCIsXHJcbiAgICAgICAgXCJyZWFjdC1yb3V0ZXItZG9tXCIsXHJcbiAgICAgICAgXCJAdGhpcmR3ZWItZGV2L3JlYWN0XCIsXHJcbiAgICAgICAgXCJldGhlcnNcIixcclxuICAgICAgICBcImZyYW1lci1tb3Rpb25cIixcclxuICAgICAgICBcImJ1ZmZlclwiLFxyXG4gICAgICBdLFxyXG4gICAgICAvLyBFeGNsdWRlIHByb2JsZW1hdGljIHBhY2thZ2VzXHJcbiAgICAgIGV4Y2x1ZGU6IFsnQGdvb2dsZS9tb2RlbC12aWV3ZXInXVxyXG4gICAgfSxcclxuICB9O1xyXG59KTsgXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFdBQVc7QUFDbEIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxTQUFTLGVBQWU7QUFDakMsT0FBTyxTQUFTO0FBTWhCLE9BQU8sZUFBZTtBQUN0QixPQUFPLGdCQUFnQjtBQUN2QixPQUFPLDRCQUE0QjtBQWI0TSxJQUFNLDJDQUEyQztBQU9oUyxJQUFNLGFBQWEsY0FBYyx3Q0FBZTtBQUNoRCxJQUFNLFlBQVksUUFBUSxVQUFVO0FBUXBDLElBQU0sMEJBQTBCLE1BQU07QUFDcEMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sVUFBVSxJQUFZO0FBQ3BCLFVBQUksR0FBRyxTQUFTLHNCQUFzQixHQUFHO0FBQ3ZDLGVB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
