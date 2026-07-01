/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // อนุญาตให้ transpile internal workspace packages (TS source ตรง ๆ)
  transpilePackages: ["@life-graph/types"],
};

export default nextConfig;
