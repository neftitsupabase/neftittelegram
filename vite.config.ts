// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import mdx from "@mdx-js/rollup";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Markdown plugins
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

// Plugin to handle problematic @google/model-viewer imports
const ignoreModelViewerPlugin = () => {
  return {
    name: 'ignore-model-viewer',
    resolveId(id: string) {
      if (id.includes('@google/model-viewer')) {
        return id;
      }
    },
    load(id: string) {
      if (id.includes('@google/model-viewer')) {
        return 'export default {};';
      }
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    
    plugins: [
      {
        ...mdx({
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
        }),
        enforce: "pre", // run MDX before React
      },
      react(),ignoreModelViewerPlugin()
    ],
    server: {
      host: true,
      port: 3333,
      watch: {
        usePolling: true, // helps on Windows/WSL to reload .mdx edits
      },
      // Allow external host access (for Codesandbox/Cloud dev)
      allowedHosts: ["y4gfpc-3333.csb.app"], // or 'all'
      proxy: {
        // Proxy IPFS requests to avoid CORS issues in development
        '/api/ipfs': {
          target: 'https://ipfs.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ipfs/, '/ipfs'),
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('IPFS proxy error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('IPFS proxy request:', req.method, req.url);
            });
          },
        },
        '/api/ipfs-pinata': {
          target: 'https://gateway.pinata.cloud',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ipfs-pinata/, '/ipfs'),
        },
        '/api/ipfs-cloudflare': {
          target: 'https://cloudflare-ipfs.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ipfs-cloudflare/, '/ipfs'),
        }
      }
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
      extensions: [".js", ".ts", ".jsx", ".tsx", ".mdx"], // allow MDX imports
    },
    define: {
      "process.env": process.env,
      global: "globalThis",
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "./src/styles/font-reset.css";`,
        },
      },
    },
    build: {
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
        },
      },
      rollupOptions: {
        external: ['@google/model-viewer'],
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-ui": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-tooltip",
              "class-variance-authority",
              "clsx",
              "tailwind-merge",
            ],
            "vendor-web3": [
              "@thirdweb-dev/react",
              "@thirdweb-dev/sdk",
              "@thirdweb-dev/auth",
              "ethers",
            ],
            "vendor-utils": ["date-fns", "framer-motion", "sonner"],
          },
        },
      },
      sourcemap: !isProd,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@thirdweb-dev/react",
        "ethers",
        "framer-motion",
        "buffer",
      ],
      // Exclude problematic packages
      exclude: ['@google/model-viewer']
    },
  };
}); 
