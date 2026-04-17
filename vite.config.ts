import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 根据环境变量设置 base 路径
// GitHub Pages: npm run build:gh (base: /spark2-web-vr/)
// Netlify: npm run build (base: /)
const base = process.env.DEPLOY_TARGET === "github" ? "/spark2-web-vr/" : "/";

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  base,
  server: {
    host: "0.0.0.0",
    https: true,
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    https: true,
    port: 4173,
  },
});
