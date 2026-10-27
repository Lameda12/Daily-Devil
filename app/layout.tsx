import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Silkscreen } from 'next/font/google'
import './globals.css'

const pixel = Silkscreen({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-silkscreen', display: 'swap' })
const plex = IBM_Plex_Mono({ weight: ['400', '600'], subsets: ['latin'], variable: '--font-plex', display: 'swap' })

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Daily Devil',
  description: 'One troll platformer level a day. Same level for everyone. Everyone else’s deaths are your hints.',
  openGraph: {
    title: 'Daily Devil',
    description: 'One troll platformer level a day. The crowd’s deaths are your hints.',
    images: ['/api/og'],
  },
  twitter: { card: 'summary_large_image', images: ['/api/og'] },
}

export const viewport: Viewport = {
  themeColor: '#0e0909',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${plex.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
