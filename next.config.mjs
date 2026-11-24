/** @type {import('next').NextConfig} */
const nextConfig = {
  // GitHub Pages serves static files only. Pages sets its own cache headers (about 10 minutes) and
  // ignores custom ones, so the old headers() block is gone.
  output: "export",
  poweredByHeader: false,
}

export default nextConfig
