import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const vendorScripts = (mode: string): Plugin => ({
  name: "wayfare-vendor-scripts",
  transformIndexHtml(html) {
    const env = loadEnv(mode, ".", "VITE_");
    const adsense = env.VITE_ADSENSE_CLIENT?.trim();
    const cloudflare = env.VITE_CLOUDFLARE_ANALYTICS_TOKEN?.trim();
    const scripts = [
      adsense
        ? `<script id="google-adsense" async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsense)}" crossorigin="anonymous"></script>`
        : "",
      cloudflare
        ? `<script id="cf-analytics" type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: cloudflare })}'></script>`
        : "",
    ].join("\n");
    return html.replace("<!-- wayfare-vendor-scripts -->", scripts);
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), vendorScripts(mode)],
  base: "./",
  build: { outDir: "dist", sourcemap: true },
}));
