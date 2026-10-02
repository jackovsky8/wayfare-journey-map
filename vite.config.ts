import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const escapeHtmlAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const vendorScripts = (mode: string): Plugin => ({
  name: "wayfare-vendor-scripts",
  transformIndexHtml(html) {
    const env = loadEnv(mode, ".", "");
    const adsense = (
      env.VITE_ADSENSE_CLIENT ||
      env.ADSENSE_CLIENT ||
      env.ADSENSE_ID ||
      ""
    ).trim();
    const cloudflare = (
      env.VITE_CLOUDFLARE_ANALYTICS_TOKEN ||
      env.CLOUDFLARE_ANALYTICS_TOKEN ||
      env.CLOUDFLARE_WEB_ANALYTICS_TOKEN ||
      ""
    ).trim();
    const googleSiteVerification = (
      env.VITE_GOOGLE_SITE_VERIFICATION ||
      env.GOOGLE_SITE_VERIFICATION ||
      ""
    ).trim();
    const scripts = [
      googleSiteVerification
        ? `<meta name="google-site-verification" content="${escapeHtmlAttribute(googleSiteVerification)}" />`
        : "",
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
