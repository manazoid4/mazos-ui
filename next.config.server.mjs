/** @type {import('next').NextConfig} */
const serverConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  // Never trace generated desktop artifacts into the standalone server. The
  // server is copied into src-tauri/resources/server during packaging; tracing
  // that directory would recursively package prior target/output trees.
  outputFileTracingExcludes: {
    '*': [
      'src-tauri/**',
      'out/**',
    ],
  },
};

export default serverConfig;
