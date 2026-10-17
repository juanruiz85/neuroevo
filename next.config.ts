import type { NextConfig } from "next";

// ── Modos de build ────────────────────────────────────────────────────────
// 1. Desarrollo / standalone (por defecto): API REST + Prisma/SQLite.
// 2. Export estático (GitHub Pages): `bun run build:static`
//    - NEXT_OUTPUT=export        → activa `output: "export"`.
//    - NEXT_PUBLIC_BASE_PATH     → p. ej. "/neuroevo" para un sitio de
//      proyecto en https://usuario.github.io/neuroevo/ (vacío para un
//      repositorio usuario.github.io).
//    - NEXT_PUBLIC_STATIC_MODE=1 → el Museo de la Evolución guarda los
//      linajes en localStorage (no hay backend en un sitio estático).
//    - NEXT_DIST_DIR             → dir de build alternativo (aisla el
//      cache del dev server al probar el export localmente).

const isStaticExport = process.env.NEXT_OUTPUT === "export";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  ...(basePath && { basePath }),
  ...(isStaticExport && { images: { unoptimized: true } }),
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
