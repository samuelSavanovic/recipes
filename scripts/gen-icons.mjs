// One-off dev script: rasterize the ◍ brand mark (paper ground, herb-green mark)
// into the PWA icon set. Run `npm run gen:icons`; the PNGs are committed.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')
mkdirSync(outDir, { recursive: true })

const PAPER = '#efe9dd'
const ACCENT = '#3a5a45'

// A ring + center dot on a paper ground — the ◍ mark. `pad` shrinks the mark
// for maskable icons so it stays inside the platform safe zone.
function svg(size, { pad = 0.4 } = {}) {
  const c = size / 2
  const r = size * pad
  const stroke = size * 0.06
  const dot = r * 0.42
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${PAPER}"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${ACCENT}" stroke-width="${stroke}"/>
      <circle cx="${c}" cy="${c}" r="${dot}" fill="${ACCENT}"/>
    </svg>`,
  )
}

async function render(size, name, opts) {
  const file = resolve(outDir, name)
  await sharp(svg(size, opts)).png().toFile(file)
  console.log(`  ✓ ${name}`)
}

console.log('Generating PWA icons →', outDir)
await render(192, 'icon-192.png')
await render(512, 'icon-512.png')
await render(512, 'icon-maskable-512.png', { pad: 0.3 }) // extra safe-zone padding
await render(180, 'apple-touch-icon.png')
console.log('Done.')
