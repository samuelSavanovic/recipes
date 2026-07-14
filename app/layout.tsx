import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RecipesProvider } from '@/lib/store'
import { RegisterSW } from '@/components/RegisterSW'

// Fonts are the prototype's system serif/mono stacks (see globals.css) — no web
// font loading, keeping first paint instant.

export const metadata: Metadata = {
  title: {
    default: 'mise — recipe book',
    template: '%s — mise',
  },
  description:
    'A personal recipe collection: technique-first procedure cards, offline-ready.',
  applicationName: 'mise',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'mise', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#efe9dd',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RecipesProvider>{children}</RecipesProvider>
        <RegisterSW />
      </body>
    </html>
  )
}
