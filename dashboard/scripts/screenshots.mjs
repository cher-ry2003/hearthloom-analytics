// Usage: node scripts/screenshots.mjs [outDir] [width] [height]
// Serves the production build and screenshots every page in light and dark mode.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const out = process.argv[2] ?? '../docs/screenshots'
const width = +(process.argv[3] ?? 1440)
const height = +(process.argv[4] ?? 900)
const tag = process.argv[5] ? `-${process.argv[5]}` : ''
const port = 4173
const base = '/hearthloom-analytics/'
mkdirSync(out, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`http://localhost:${port}${base}`)).ok) break } catch { /* wait */ }
  await sleep(200)
}

const pages = [['overview', ''], ['budget', 'budget'], ['marketing', 'marketing'], ['products', 'products'], ['inventory', 'inventory']]
const browser = await chromium.launch()
const problems = []
try {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme })
    await ctx.addInitScript((t) => { try { localStorage.setItem('hl-theme', t) } catch {} }, theme)
    const page = await ctx.newPage()
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`[${theme}] ${m.type()}: ${m.text()}`) })
    page.on('pageerror', (e) => problems.push(`[${theme}] pageerror: ${e.message}`))
    for (const [name, route] of pages) {
      await page.goto(`http://localhost:${port}${base}#/${route}`, { waitUntil: 'networkidle' })
      await page.waitForSelector('main h1')
      await page.waitForFunction(() => !document.querySelector('[role="status"]'), null, { timeout: 15000 }).catch(() => problems.push(`[${theme}] ${name}: skeleton still visible`))
      await page.evaluate(() => document.fonts.ready)
      await sleep(1400)
      const full = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width, height: Math.max(height, full) })
      await sleep(500)
      await page.screenshot({ path: `${out}/${name}-${theme}${tag}.png`, fullPage: true })
      await page.setViewportSize({ width, height })
      console.log(`captured ${name} (${theme})`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  server.kill()
}
if (problems.length) { console.log('\nConsole problems:\n' + [...new Set(problems)].join('\n')) } else console.log('\nNo console problems.')
