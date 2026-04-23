import type { NextConfig } from "next";

const devApiProxyTarget = process.env.NEXT_DEV_API_PROXY_TARGET?.trim() || "http://127.0.0.1:80";
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Allow HMR websocket when opening local dev server
  // via external tunnel/host (e.g. cloudpub/ngrok).
  allowedDevOrigins: [
    "sincerely-masculine-albatross.cloudpub.ru",
    "*.cloudpub.ru",
  ],
  async rewrites() {
    if (!isDev) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${devApiProxyTarget}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
