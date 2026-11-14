/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    // A day fresh, then served from cache while it refreshes: OBS reloads skip the download,
    // and a changed icon or font still shows up within a day without renaming the file
    const assetCache = { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }
    return [
      { source: "/fonts/:path*", headers: [assetCache] },
      { source: "/icons/:path*", headers: [assetCache] },
      { source: "/overlays/:path*", headers: [assetCache] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Only this site may frame these pages (stops clickjacking the tracker page); OBS loads them top-level
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
