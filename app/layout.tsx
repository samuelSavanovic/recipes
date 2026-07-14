import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RecipesProvider } from '@/lib/store'

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
      </body>
    </html>
  )
}
