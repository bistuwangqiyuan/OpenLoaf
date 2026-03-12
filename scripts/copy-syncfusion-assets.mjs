/**
 * Copy Syncfusion PDF Viewer WASM assets to the web public directory.
 * Run before build: `node scripts/copy-syncfusion-assets.mjs`
 */
import { cpSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const src = resolve(root, 'node_modules/@syncfusion/ej2-pdfviewer/dist/ej2-pdfviewer-lib')
const dst = resolve(root, 'apps/web/public/syncfusion')

mkdirSync(dst, { recursive: true })
cpSync(src, dst, { recursive: true })

console.log('[syncfusion] Copied WASM assets to apps/web/public/syncfusion/')
