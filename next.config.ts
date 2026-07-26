import type { NextConfig } from "next";

// FFmpeg loads a native binary relative to its package directory. Keeping these
// packages external prevents Next from relocating their JavaScript into .next.
const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],
};
export default nextConfig;
