import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'wheresmyoffer.vercel.app',
          },
        ],
        destination: 'https://www.wheresmyoffer.in/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

