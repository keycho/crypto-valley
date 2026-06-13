/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting is handled at the repo root via `pnpm lint` (eslint .),
    // not by `next build`.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
