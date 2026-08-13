
const nextConfig = {
  // During development: serves at /admin
  // In production: full domain staff.northbridgemotors.co.nz mapped via Vercel
  // No structural changes needed between environments.
  
  experimental: {
    // Enable server actions (required for Auth.js v5 signIn/signOut)
    serverActions: {
      allowedOrigins: ["localhost:3000", "staff.northbridgemotors.co.nz"],
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'trademe.tmcdn.co.nz',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
