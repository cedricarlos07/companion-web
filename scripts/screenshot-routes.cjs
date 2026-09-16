/* Renders every Companion route and saves a full-page screenshot. */
const { chromium } = require('playwright-core')
const path = require('node:path')

const OUT = path.join(__dirname, 'gui-test-screenshots')

const ROUTES = [
  ['login', '/login'],
  ['setup', '/setup'],
  ['home', '/home'],
  ['ask', '/ask'],
  ['brain', '/brain'],
  ['memory-detail', '/brain/mem-orange-01'],
  ['people', '/people'],
  ['employee-detail', '/people/emp-moussa'],
  ['roles', '/roles'],
  ['role-brain', '/roles/role-commercial'],
  ['sources', '/sources'],
  ['source-new', '/sources/new'],
  ['knowledge-risk', '/knowledge-risk'],
  ['handovers', '/handovers'],
  ['handover-new', '/handovers/new/emp-moussa'],
  ['handover-detail', '/handovers/hov-moussa'],
  ['interview', '/handovers/hov-moussa/interview'],
  ['onboarding', '/onboarding'],
  ['onboarding-detail', '/onboarding/onb-yann'],
  ['agents', '/agents'],
  ['agent-new', '/agents/new'],
  ['agent-detail', '/agents/agent-sales'],
  ['automations', '/automations'],
  ['approvals', '/approvals'],
  ['activity', '/activity'],
  ['integrations', '/integrations'],
  ['settings', '/settings'],
]

;(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))

  for (const [name, route] of ROUTES) {
    try {
      await page.goto(`http://localhost:5199${route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1200)
      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
      console.log(`ok  ${route}`)
    } catch (e) {
      console.log(`ERR ${route}: ${e.message}`)
    }
  }

  if (errors.length) {
    console.log('--- CONSOLE ERRORS ---')
    for (const e of [...new Set(errors)]) console.log(e)
  } else {
    console.log('--- no console errors ---')
  }
  await browser.close()
})()
