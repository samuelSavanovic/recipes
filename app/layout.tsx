import type { Metadata, Viewport } from 'next'
import { Source_Serif_4 } from 'next/font/google'
import './globals.css'
import { RecipesProvider } from '@/lib/store'
import { RegisterSW } from '@/components/RegisterSW'
import { ScrollTopButton } from '@/components/ScrollTopButton'
import { THEME_BOOTSTRAP_SCRIPT, THEME_COLOR } from '@/lib/theme'

// The mono stack stays a system stack (see globals.css). The serif is
// Source Serif 4, self-hosted by next/font/google: downloaded at build time and
// served from our own /_next/static/media/ origin — no runtime request to
// Google. The service worker caches the woff2 at runtime for offline use.
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-serif',
})

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

// Browser-chrome tint. These MUST track --paper in each globals.css branch;
// lib/theme.test.ts asserts it. The media-query form is deliberate: Next keys
// its <Viewport> element by request id, so it destroys and recreates these
// <meta> tags on every client navigation — a JS-mutated tag would be silently
// clobbered by the first AppLink click. Static content survives that, since
// React just recreates it identically.
//
// Accepted limitation: the tint follows the OS, so forcing a theme against the
// OS (dark app on a light phone) leaves the chrome on the OS's colour. Cosmetic
// and narrow. Fixing it means dropping themeColor here and having JS own the
// tag outright — not worth the machinery.
//
// No `colorScheme` key: it would emit a competing <meta name="color-scheme">.
// globals.css owns that.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.dark },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the bootstrap script below sets data-theme on
    // <html> before React hydrates, which React would otherwise report as a
    // server/client mismatch. It's element-local, so it does not mask anything
    // in the tree underneath.
    <html lang="en" className={sourceSerif.variable} suppressHydrationWarning>
      {/* This <head> must stay explicit. React does not hoist inline scripts
          (only <script src async>), and with no <head> of our own it synthesises
          an empty one and emits this script into <body> — where paint can begin
          before it runs, i.e. the light flash it exists to prevent. Here it
          lands last in <head>, after the render-blocking stylesheet: parsed and
          executed pre-paint.

          dangerouslySetInnerHTML is CLAUDE.md-banned for *markdown rendering*,
          where escaping is the security boundary. This is a static build-time
          constant with no interpolation and no user input — the standard way to
          do a pre-paint theme stamp. It would need a nonce if a CSP is ever
          added to next.config.ts. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <RecipesProvider>{children}</RecipesProvider>
        <RegisterSW />
        <ScrollTopButton />
      </body>
    </html>
  )
}
