const assert = require('node:assert/strict')
const { setTimeout: wait } = require('node:timers/promises')

const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const url = new URL(process.env.PAGES_URL.replace(/\/?$/, '/'))
assert.equal(url.pathname, '/SAR/')

async function verify() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }),
  })
  try {
    const page = await browser.newPage()
    const deadline = Date.now() + 180_000
    while (true) {
      try {
        const response = await page.request.get(new URL('build-sha.txt', url).href, { timeout: 10_000 })
        assert.ok(response.ok(), 'Waiting for the deployed build marker')
        assert.equal((await response.text()).trim(), process.env.GITHUB_SHA)
        break
      } catch (error) {
        if (Date.now() >= deadline) throw error
        await wait(5_000)
      }
    }

    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('requestfailed', request => errors.push(request.url() + ' ' + request.failure().errorText))
    page.on('response', response => {
      if (response.status() >= 400) errors.push(response.url() + ' HTTP ' + response.status())
    })
    const workerReady = page.waitForEvent('worker')
    const [response, worker] = await Promise.all([page.goto(url.href), workerReady])
    assert.ok(response.ok())
    await page.waitForFunction(() => document.querySelector('#engine-status')?.textContent === 'ENGINE READY')
    const acquired = Number(await page.locator('#monitors').getAttribute('data-acquired'))
    assert.ok(acquired > 0)
    await page.getByRole('button', { name: 'Step one pulse' }).click()
    await page.waitForFunction(expected => Number(document.querySelector('#monitors')?.dataset.acquired) === expected, acquired + 1)

    const entries = await page.locator('script[type=module][src], link[rel=stylesheet]').evaluateAll(elements =>
      elements.map(element => element.src || element.href))
    assert.equal(entries.length, 2)
    for (const asset of [...entries, worker.url()]) {
      assert.equal(new URL(asset).origin, url.origin)
      assert.ok(new URL(asset).pathname.startsWith('/SAR/assets/'), asset)
      assert.ok((await page.request.get(asset)).ok(), asset)
    }
    assert.deepEqual(errors, [])
    console.log('Verified public Pages HTML, JavaScript, CSS, and pulse processing in the Web Worker for ' + process.env.GITHUB_SHA)
  } finally {
    await browser.close()
  }
}

verify().catch(error => {
  console.error(error)
  process.exitCode = 1
})
