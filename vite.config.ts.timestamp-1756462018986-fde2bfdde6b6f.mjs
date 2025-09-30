// vite.config.ts
import { defineConfig } from "file:///C:/Users/manth/Documents/Neftit_Auth_Blockchain_Backend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/manth/Documents/Neftit_Auth_Blockchain_Backend/node_modules/@vitejs/plugin-react-swc/index.js";
import mdx from "file:///C:/Users/manth/Documents/Neftit_Auth_Blockchain_Backend/node_modules/@mdx-js/rollup/index.js";
import * as path from "node:path";
import remarkGfm from "file:///C:/Users/manth/Documents/Neftit_Auth_Blockchain_Backend/node_modules/remark-gfm/index.js";
import rehypeSlug from "file:///C:/Users/manth/Documents/Neftit_Auth_Blockchain_Backend/node_modules/rehype-slug/index.js";
import rehypeAutolinkHeadings from "file:///C:/Users/manth/Documents/Neftit_Auth_Blockchain_Backend/node_modules/rehype-autolink-headings/index.js";
var __vite_injected_original_dirname = "C:\\Users\\manth\\Documents\\Neftit_Auth_Blockchain_Backend";
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
      react()
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
        "@": path.resolve(__vite_injected_original_dirname, "./src"),
        "@docs": path.resolve(__vite_injected_original_dirname, "./neftit_docs-content")
        // <-- Added alias for MDX docs
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
      exclude: []
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtYW50aFxcXFxEb2N1bWVudHNcXFxcTmVmdGl0X0F1dGhfQmxvY2tjaGFpbl9CYWNrZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtYW50aFxcXFxEb2N1bWVudHNcXFxcTmVmdGl0X0F1dGhfQmxvY2tjaGFpbl9CYWNrZW5kXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9tYW50aC9Eb2N1bWVudHMvTmVmdGl0X0F1dGhfQmxvY2tjaGFpbl9CYWNrZW5kL3ZpdGUuY29uZmlnLnRzXCI7Ly8gdml0ZS5jb25maWcudHNcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IG1keCBmcm9tIFwiQG1keC1qcy9yb2xsdXBcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XHJcblxyXG4vLyBNYXJrZG93biBwbHVnaW5zXHJcbmltcG9ydCByZW1hcmtHZm0gZnJvbSBcInJlbWFyay1nZm1cIjtcclxuaW1wb3J0IHJlaHlwZVNsdWcgZnJvbSBcInJlaHlwZS1zbHVnXCI7XHJcbmltcG9ydCByZWh5cGVBdXRvbGlua0hlYWRpbmdzIGZyb20gXCJyZWh5cGUtYXV0b2xpbmstaGVhZGluZ3NcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICBjb25zdCBpc1Byb2QgPSBtb2RlID09PSBcInByb2R1Y3Rpb25cIjtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAge1xyXG4gICAgICAgIC4uLm1keCh7XHJcbiAgICAgICAgICByZW1hcmtQbHVnaW5zOiBbcmVtYXJrR2ZtXSxcclxuICAgICAgICAgIHJlaHlwZVBsdWdpbnM6IFtyZWh5cGVTbHVnLCByZWh5cGVBdXRvbGlua0hlYWRpbmdzXSxcclxuICAgICAgICB9KSxcclxuICAgICAgICBlbmZvcmNlOiBcInByZVwiLCAvLyBydW4gTURYIGJlZm9yZSBSZWFjdFxyXG4gICAgICB9LFxyXG4gICAgICByZWFjdCgpLFxyXG4gICAgXSxcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICBob3N0OiB0cnVlLFxyXG4gICAgICBwb3J0OiAzMzMzLFxyXG4gICAgICB3YXRjaDoge1xyXG4gICAgICAgIHVzZVBvbGxpbmc6IHRydWUsIC8vIGhlbHBzIG9uIFdpbmRvd3MvV1NMIHRvIHJlbG9hZCAubWR4IGVkaXRzXHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIEFsbG93IGV4dGVybmFsIGhvc3QgYWNjZXNzIChmb3IgQ29kZXNhbmRib3gvQ2xvdWQgZGV2KVxyXG4gICAgICBhbGxvd2VkSG9zdHM6IFtcInk0Z2ZwYy0zMzMzLmNzYi5hcHBcIl0sIC8vIG9yICdhbGwnXHJcbiAgICB9LFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICAgIFwiQGRvY3NcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL25lZnRpdF9kb2NzLWNvbnRlbnRcIiksIC8vIDwtLSBBZGRlZCBhbGlhcyBmb3IgTURYIGRvY3NcclxuICAgICAgfSxcclxuICAgICAgZXh0ZW5zaW9uczogW1wiLmpzXCIsIFwiLnRzXCIsIFwiLmpzeFwiLCBcIi50c3hcIiwgXCIubWR4XCJdLCAvLyBhbGxvdyBNRFggaW1wb3J0c1xyXG4gICAgfSxcclxuICAgIGRlZmluZToge1xyXG4gICAgICBcInByb2Nlc3MuZW52XCI6IHByb2Nlc3MuZW52LFxyXG4gICAgICBnbG9iYWw6IFwiZ2xvYmFsVGhpc1wiLFxyXG4gICAgfSxcclxuICAgIGNzczoge1xyXG4gICAgICBwcmVwcm9jZXNzb3JPcHRpb25zOiB7XHJcbiAgICAgICAgc2Nzczoge1xyXG4gICAgICAgICAgYWRkaXRpb25hbERhdGE6IGBAaW1wb3J0IFwiLi9zcmMvc3R5bGVzL2ZvbnQtcmVzZXQuY3NzXCI7YCxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgIG1pbmlmeTogXCJ0ZXJzZXJcIixcclxuICAgICAgdGVyc2VyT3B0aW9uczoge1xyXG4gICAgICAgIGNvbXByZXNzOiB7XHJcbiAgICAgICAgICBkcm9wX2NvbnNvbGU6IGlzUHJvZCxcclxuICAgICAgICAgIGRyb3BfZGVidWdnZXI6IGlzUHJvZCxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgICAgXCJ2ZW5kb3ItcmVhY3RcIjogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIiwgXCJyZWFjdC1yb3V0ZXItZG9tXCJdLFxyXG4gICAgICAgICAgICBcInZlbmRvci11aVwiOiBbXHJcbiAgICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtZGlhbG9nXCIsXHJcbiAgICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudVwiLFxyXG4gICAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXRvb2x0aXBcIixcclxuICAgICAgICAgICAgICBcImNsYXNzLXZhcmlhbmNlLWF1dGhvcml0eVwiLFxyXG4gICAgICAgICAgICAgIFwiY2xzeFwiLFxyXG4gICAgICAgICAgICAgIFwidGFpbHdpbmQtbWVyZ2VcIixcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgXCJ2ZW5kb3Itd2ViM1wiOiBbXHJcbiAgICAgICAgICAgICAgXCJAdGhpcmR3ZWItZGV2L3JlYWN0XCIsXHJcbiAgICAgICAgICAgICAgXCJAdGhpcmR3ZWItZGV2L3Nka1wiLFxyXG4gICAgICAgICAgICAgIFwiQHRoaXJkd2ViLWRldi9hdXRoXCIsXHJcbiAgICAgICAgICAgICAgXCJldGhlcnNcIixcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgXCJ2ZW5kb3ItdXRpbHNcIjogW1wiZGF0ZS1mbnNcIiwgXCJmcmFtZXItbW90aW9uXCIsIFwic29ubmVyXCJdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICBzb3VyY2VtYXA6ICFpc1Byb2QsXHJcbiAgICAgIHJlcG9ydENvbXByZXNzZWRTaXplOiB0cnVlLFxyXG4gICAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXHJcbiAgICB9LFxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIGluY2x1ZGU6IFtcclxuICAgICAgICBcInJlYWN0XCIsXHJcbiAgICAgICAgXCJyZWFjdC1kb21cIixcclxuICAgICAgICBcInJlYWN0LXJvdXRlci1kb21cIixcclxuICAgICAgICBcIkB0aGlyZHdlYi1kZXYvcmVhY3RcIixcclxuICAgICAgICBcImV0aGVyc1wiLFxyXG4gICAgICAgIFwiZnJhbWVyLW1vdGlvblwiLFxyXG4gICAgICAgIFwiYnVmZmVyXCIsXHJcbiAgICAgIF0sXHJcbiAgICAgIGV4Y2x1ZGU6IFtdLFxyXG4gICAgfSxcclxuICB9O1xyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixPQUFPLFNBQVM7QUFDaEIsWUFBWSxVQUFVO0FBR3RCLE9BQU8sZUFBZTtBQUN0QixPQUFPLGdCQUFnQjtBQUN2QixPQUFPLDRCQUE0QjtBQVRuQyxJQUFNLG1DQUFtQztBQVl6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLFNBQVMsU0FBUztBQUV4QixTQUFPO0FBQUEsSUFDTCxTQUFTO0FBQUEsTUFDUDtBQUFBLFFBQ0UsR0FBRyxJQUFJO0FBQUEsVUFDTCxlQUFlLENBQUMsU0FBUztBQUFBLFVBQ3pCLGVBQWUsQ0FBQyxZQUFZLHNCQUFzQjtBQUFBLFFBQ3BELENBQUM7QUFBQSxRQUNELFNBQVM7QUFBQTtBQUFBLE1BQ1g7QUFBQSxNQUNBLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxZQUFZO0FBQUE7QUFBQSxNQUNkO0FBQUE7QUFBQSxNQUVBLGNBQWMsQ0FBQyxxQkFBcUI7QUFBQTtBQUFBLElBQ3RDO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFVLGFBQVEsa0NBQVcsT0FBTztBQUFBLFFBQ3BDLFNBQWMsYUFBUSxrQ0FBVyx1QkFBdUI7QUFBQTtBQUFBLE1BQzFEO0FBQUEsTUFDQSxZQUFZLENBQUMsT0FBTyxPQUFPLFFBQVEsUUFBUSxNQUFNO0FBQUE7QUFBQSxJQUNuRDtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sZUFBZSxRQUFRO0FBQUEsTUFDdkIsUUFBUTtBQUFBLElBQ1Y7QUFBQSxJQUNBLEtBQUs7QUFBQSxNQUNILHFCQUFxQjtBQUFBLFFBQ25CLE1BQU07QUFBQSxVQUNKLGdCQUFnQjtBQUFBLFFBQ2xCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLGVBQWU7QUFBQSxRQUNiLFVBQVU7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLGVBQWU7QUFBQSxRQUNqQjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLGNBQWM7QUFBQSxZQUNaLGdCQUFnQixDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxZQUN6RCxhQUFhO0FBQUEsY0FDWDtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRjtBQUFBLFlBQ0EsZUFBZTtBQUFBLGNBQ2I7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNGO0FBQUEsWUFDQSxnQkFBZ0IsQ0FBQyxZQUFZLGlCQUFpQixRQUFRO0FBQUEsVUFDeEQ7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsV0FBVyxDQUFDO0FBQUEsTUFDWixzQkFBc0I7QUFBQSxNQUN0Qix1QkFBdUI7QUFBQSxJQUN6QjtBQUFBLElBQ0EsY0FBYztBQUFBLE1BQ1osU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxTQUFTLENBQUM7QUFBQSxJQUNaO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
