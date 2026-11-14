import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { preload } from 'react-dom'
import './globals.css'

export const metadata: Metadata = {
  title: 'Z2R Restream Overlay',
  description: 'Zelda II Randomizer Restream Overlay',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Every overlay page uses this font; fetch it with the HTML instead of after the CSS
  preload('/fonts/ZELDA-II-THE-ADVENTURE-OF-LINK.TTF', { as: 'font', type: 'font/ttf', crossOrigin: 'anonymous' })
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
