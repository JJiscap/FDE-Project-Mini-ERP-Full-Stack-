// Run after `npm run build`: fails if any server-side secret VALUE from the root .env
// (or the environment) appears in dist/. Prints names and verdicts only, never values.
//
// Note: a plain `grep sb_secret dist` still matches once, because supabase-js itself
// contains the literal prefix "sb_secret_" in a key-type check. That is library code,
// not a key. This script compares the real secret values instead.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(here, '..', 'dist')
const envFile = path.resolve(here, '..', '..', '.env')

const env = { ...process.env }
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
  }
}

if (!fs.existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.')
  process.exit(2)
}

const files = []
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (/\.(js|css|html|map|json)$/.test(name)) files.push(p)
  }
}
walk(dist)
const bundle = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')

const SERVER_ONLY = ['SUPABASE_SECRET_KEY', 'DATABASE_URL', 'POSTGRES_PASSWORD', 'SUPABASE_ACCESS_TOKEN']
let leaked = false
for (const name of SERVER_ONLY) {
  const value = env[name]
  if (!value) {
    console.log(`${name}: not set here, skipped`)
  } else if (bundle.includes(value)) {
    console.log(`${name}: LEAKED into dist/`)
    leaked = true
  } else {
    console.log(`${name}: not in dist/`)
  }
}
process.exit(leaked ? 1 : 0)
