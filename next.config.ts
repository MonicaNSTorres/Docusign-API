import type { NextConfig } from 'next';
import type { WebpackConfigContext } from 'next/dist/server/config-shared';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config: any, { isServer }: WebpackConfigContext) => {
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          oracledb: false,
        },
      };
    }

    config.externals = [...(config.externals || []), 'oracledb'];

    return config;
  },
};

export default nextConfig;