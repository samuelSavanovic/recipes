// Copies sw/sw.js → public/sw.js, replacing __SW_VERSION__ with a per-build
// version (git short hash + source mtime). Runs in prebuild/predev, so a new
// deploy produces a byte-different SW → reinstall → old caches purged. public/
// sw.js is a build artifact (gitignored).
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'sw/sw.js')
const out = resolve(root, 'public/sw.js')

function gitHash() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'nogit'
  }
}

const mtime = Math.floor(statSync(src).mtimeMs)
const version = `${gitHash()}-${mtime}`

const code = readFileSync(src, 'utf8').replace(/__SW_VERSION__/g, version)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, code)

console.log(`✓ Stamped service worker → public/sw.js (version ${version})`)
