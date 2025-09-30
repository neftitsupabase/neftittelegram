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
      allowedHosts: ["y4gfpc-3333.csb.app"],
      // or 'all'
      proxy: {
        // Proxy IPFS requests to avoid CORS issues in development
        "/api/ipfs": {
          target: "https://ipfs.io",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ipfs/, "/ipfs"),
          configure: (proxy, _options) => {
            proxy.on("error", (err, _req, _res) => {
              console.log("IPFS proxy error:", err);
            });
            proxy.on("proxyReq", (proxyReq, req, _res) => {
              console.log("IPFS proxy request:", req.method, req.url);
            });
          }
        },
        "/api/ipfs-pinata": {
          target: "https://gateway.pinata.cloud",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ipfs-pinata/, "/ipfs")
        },
        "/api/ipfs-cloudflare": {
          target: "https://cloudflare-ipfs.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ipfs-cloudflare/, "/ipfs")
        }
      }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhc2hhalxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXE5lZnRpdF9BdXRoX0Jsb2NrY2hhaW5fQmFja2VuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYXNoYWpcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxOZWZ0aXRfQXV0aF9CbG9ja2NoYWluX0JhY2tlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2FzaGFqL09uZURyaXZlL0Rlc2t0b3AvTmVmdGl0X0F1dGhfQmxvY2tjaGFpbl9CYWNrZW5kL3ZpdGUuY29uZmlnLnRzXCI7Ly8gdml0ZS5jb25maWcudHNcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ25vZGU6dXJsJztcclxuaW1wb3J0IHsgZGlybmFtZSwgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCc7XHJcbmltcG9ydCBtZHggZnJvbSBcIkBtZHgtanMvcm9sbHVwXCI7XHJcblxyXG5jb25zdCBfX2ZpbGVuYW1lID0gZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpO1xyXG5jb25zdCBfX2Rpcm5hbWUgPSBkaXJuYW1lKF9fZmlsZW5hbWUpO1xyXG5cclxuLy8gTWFya2Rvd24gcGx1Z2luc1xyXG5pbXBvcnQgcmVtYXJrR2ZtIGZyb20gXCJyZW1hcmstZ2ZtXCI7XHJcbmltcG9ydCByZWh5cGVTbHVnIGZyb20gXCJyZWh5cGUtc2x1Z1wiO1xyXG5pbXBvcnQgcmVoeXBlQXV0b2xpbmtIZWFkaW5ncyBmcm9tIFwicmVoeXBlLWF1dG9saW5rLWhlYWRpbmdzXCI7XHJcblxyXG4vLyBQbHVnaW4gdG8gaGFuZGxlIHByb2JsZW1hdGljIEBnb29nbGUvbW9kZWwtdmlld2VyIGltcG9ydHNcclxuY29uc3QgaWdub3JlTW9kZWxWaWV3ZXJQbHVnaW4gPSAoKSA9PiB7XHJcbiAgcmV0dXJuIHtcclxuICAgIG5hbWU6ICdpZ25vcmUtbW9kZWwtdmlld2VyJyxcclxuICAgIHJlc29sdmVJZChpZDogc3RyaW5nKSB7XHJcbiAgICAgIGlmIChpZC5pbmNsdWRlcygnQGdvb2dsZS9tb2RlbC12aWV3ZXInKSkge1xyXG4gICAgICAgIHJldHVybiBpZDtcclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIGxvYWQoaWQ6IHN0cmluZykge1xyXG4gICAgICBpZiAoaWQuaW5jbHVkZXMoJ0Bnb29nbGUvbW9kZWwtdmlld2VyJykpIHtcclxuICAgICAgICByZXR1cm4gJ2V4cG9ydCBkZWZhdWx0IHt9Oyc7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG59O1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGNvbnN0IGlzUHJvZCA9IG1vZGUgPT09IFwicHJvZHVjdGlvblwiO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgXHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgIHtcclxuICAgICAgICAuLi5tZHgoe1xyXG4gICAgICAgICAgcmVtYXJrUGx1Z2luczogW3JlbWFya0dmbV0sXHJcbiAgICAgICAgICByZWh5cGVQbHVnaW5zOiBbcmVoeXBlU2x1ZywgcmVoeXBlQXV0b2xpbmtIZWFkaW5nc10sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgZW5mb3JjZTogXCJwcmVcIiwgLy8gcnVuIE1EWCBiZWZvcmUgUmVhY3RcclxuICAgICAgfSxcclxuICAgICAgcmVhY3QoKSxpZ25vcmVNb2RlbFZpZXdlclBsdWdpbigpXHJcbiAgICBdLFxyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgIGhvc3Q6IHRydWUsXHJcbiAgICAgIHBvcnQ6IDMzMzMsXHJcbiAgICAgIHdhdGNoOiB7XHJcbiAgICAgICAgdXNlUG9sbGluZzogdHJ1ZSwgLy8gaGVscHMgb24gV2luZG93cy9XU0wgdG8gcmVsb2FkIC5tZHggZWRpdHNcclxuICAgICAgfSxcclxuICAgICAgLy8gQWxsb3cgZXh0ZXJuYWwgaG9zdCBhY2Nlc3MgKGZvciBDb2Rlc2FuZGJveC9DbG91ZCBkZXYpXHJcbiAgICAgIGFsbG93ZWRIb3N0czogW1wieTRnZnBjLTMzMzMuY3NiLmFwcFwiXSwgLy8gb3IgJ2FsbCdcclxuICAgICAgcHJveHk6IHtcclxuICAgICAgICAvLyBQcm94eSBJUEZTIHJlcXVlc3RzIHRvIGF2b2lkIENPUlMgaXNzdWVzIGluIGRldmVsb3BtZW50XHJcbiAgICAgICAgJy9hcGkvaXBmcyc6IHtcclxuICAgICAgICAgIHRhcmdldDogJ2h0dHBzOi8vaXBmcy5pbycsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpXFwvaXBmcy8sICcvaXBmcycpLFxyXG4gICAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XHJcbiAgICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSVBGUyBwcm94eSBlcnJvcjonLCBlcnIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCByZXEsIF9yZXMpID0+IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSVBGUyBwcm94eSByZXF1ZXN0OicsIHJlcS5tZXRob2QsIHJlcS51cmwpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnL2FwaS9pcGZzLXBpbmF0YSc6IHtcclxuICAgICAgICAgIHRhcmdldDogJ2h0dHBzOi8vZ2F0ZXdheS5waW5hdGEuY2xvdWQnLFxyXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaVxcL2lwZnMtcGluYXRhLywgJy9pcGZzJyksXHJcbiAgICAgICAgfSxcclxuICAgICAgICAnL2FwaS9pcGZzLWNsb3VkZmxhcmUnOiB7XHJcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwczovL2Nsb3VkZmxhcmUtaXBmcy5jb20nLFxyXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaVxcL2lwZnMtY2xvdWRmbGFyZS8sICcvaXBmcycpLFxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICBcIkBcIjogcmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICAgIH0sXHJcbiAgICAgIGV4dGVuc2lvbnM6IFtcIi5qc1wiLCBcIi50c1wiLCBcIi5qc3hcIiwgXCIudHN4XCIsIFwiLm1keFwiXSwgLy8gYWxsb3cgTURYIGltcG9ydHNcclxuICAgIH0sXHJcbiAgICBkZWZpbmU6IHtcclxuICAgICAgXCJwcm9jZXNzLmVudlwiOiBwcm9jZXNzLmVudixcclxuICAgICAgZ2xvYmFsOiBcImdsb2JhbFRoaXNcIixcclxuICAgIH0sXHJcbiAgICBjc3M6IHtcclxuICAgICAgcHJlcHJvY2Vzc29yT3B0aW9uczoge1xyXG4gICAgICAgIHNjc3M6IHtcclxuICAgICAgICAgIGFkZGl0aW9uYWxEYXRhOiBgQGltcG9ydCBcIi4vc3JjL3N0eWxlcy9mb250LXJlc2V0LmNzc1wiO2AsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICBtaW5pZnk6IFwidGVyc2VyXCIsXHJcbiAgICAgIHRlcnNlck9wdGlvbnM6IHtcclxuICAgICAgICBjb21wcmVzczoge1xyXG4gICAgICAgICAgZHJvcF9jb25zb2xlOiBpc1Byb2QsXHJcbiAgICAgICAgICBkcm9wX2RlYnVnZ2VyOiBpc1Byb2QsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICAgIGV4dGVybmFsOiBbJ0Bnb29nbGUvbW9kZWwtdmlld2VyJ10sXHJcbiAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgICAgXCJ2ZW5kb3ItcmVhY3RcIjogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIiwgXCJyZWFjdC1yb3V0ZXItZG9tXCJdLFxyXG4gICAgICAgICAgICBcInZlbmRvci11aVwiOiBbXHJcbiAgICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtZGlhbG9nXCIsXHJcbiAgICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudVwiLFxyXG4gICAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXRvb2x0aXBcIixcclxuICAgICAgICAgICAgICBcImNsYXNzLXZhcmlhbmNlLWF1dGhvcml0eVwiLFxyXG4gICAgICAgICAgICAgIFwiY2xzeFwiLFxyXG4gICAgICAgICAgICAgIFwidGFpbHdpbmQtbWVyZ2VcIixcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgXCJ2ZW5kb3Itd2ViM1wiOiBbXHJcbiAgICAgICAgICAgICAgXCJAdGhpcmR3ZWItZGV2L3JlYWN0XCIsXHJcbiAgICAgICAgICAgICAgXCJAdGhpcmR3ZWItZGV2L3Nka1wiLFxyXG4gICAgICAgICAgICAgIFwiQHRoaXJkd2ViLWRldi9hdXRoXCIsXHJcbiAgICAgICAgICAgICAgXCJldGhlcnNcIixcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgXCJ2ZW5kb3ItdXRpbHNcIjogW1wiZGF0ZS1mbnNcIiwgXCJmcmFtZXItbW90aW9uXCIsIFwic29ubmVyXCJdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICBzb3VyY2VtYXA6ICFpc1Byb2QsXHJcbiAgICAgIHJlcG9ydENvbXByZXNzZWRTaXplOiB0cnVlLFxyXG4gICAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXHJcbiAgICB9LFxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIGluY2x1ZGU6IFtcclxuICAgICAgICBcInJlYWN0XCIsXHJcbiAgICAgICAgXCJyZWFjdC1kb21cIixcclxuICAgICAgICBcInJlYWN0LXJvdXRlci1kb21cIixcclxuICAgICAgICBcIkB0aGlyZHdlYi1kZXYvcmVhY3RcIixcclxuICAgICAgICBcImV0aGVyc1wiLFxyXG4gICAgICAgIFwiZnJhbWVyLW1vdGlvblwiLFxyXG4gICAgICAgIFwiYnVmZmVyXCIsXHJcbiAgICAgIF0sXHJcbiAgICAgIC8vIEV4Y2x1ZGUgcHJvYmxlbWF0aWMgcGFja2FnZXNcclxuICAgICAgZXhjbHVkZTogWydAZ29vZ2xlL21vZGVsLXZpZXdlciddXHJcbiAgICB9LFxyXG4gIH07XHJcbn0pOyBcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLFNBQVMsZUFBZTtBQUNqQyxPQUFPLFNBQVM7QUFNaEIsT0FBTyxlQUFlO0FBQ3RCLE9BQU8sZ0JBQWdCO0FBQ3ZCLE9BQU8sNEJBQTRCO0FBYjRNLElBQU0sMkNB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
