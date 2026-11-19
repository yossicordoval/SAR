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
    assert.match(await page.title(), /^SARcade/)
    await page.getByRole('heading', { name:'SARcade', exact:true }).waitFor()
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
    await page.getByRole('button', { name: 'Study Mode' }).click()
    await page.getByRole('heading', { name: 'Geometry, range & delay' }).waitFor()
    await page.waitForFunction(() => document.querySelector('#optical-object')?.textContent === 'Reflector A')
    await page.getByText('It arrives later and moves right.', { exact: true }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    const altitude = page.getByRole('slider', { name: /Platform altitude/ })
    await altitude.press('End')
    await page.getByText('Change observed. Compare again or continue.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByText('Bottom line', { exact: true }).waitFor()
    const card = page.locator('#study-card')
    await card.getByRole('button', { name: 'Choose Lesson' }).click()
    const picker = card.getByRole('dialog', { name: 'Choose Lesson' })
    await picker.locator('[data-lesson-id="0A-3"]').click()
    await card.getByRole('heading', { name: 'Bandwidth & range resolution' }).waitFor()
    await card.getByRole('button', { name: 'Next stage' }).click()
    assert.match(await card.locator('[data-visual-caption]').textContent(), /^2 \/ 10/)
    await card.getByRole('button', { name: 'Replay concept' }).click()
    assert.match(await card.locator('[data-visual-caption]').textContent(), /^1 \/ 10/)

    await page.getByRole('button', { name: 'Image Analysis' }).click()
    await card.getByRole('heading', { name: 'Count distinguishable reflectors' }).waitFor()
    assert.ok(await page.locator('#app').evaluate(root => root.classList.contains('evidence')))
    await page.getByRole('button', { name: 'Space Mode' }).click()
    await page.getByRole('button', { name: 'Skip intro' }).click()
    const space = page.locator('#space-card')
    await space.getByRole('heading', { name: 'From airborne SAR to spaceborne SAR' }).waitFor()
    await space.getByRole('table', { name: 'Airborne and orbital scale comparison' }).waitFor()
    await space.locator('[data-space-lesson]').selectOption('S10')
    await page.getByText(/^0 \/ \d+ pulses$/).waitFor()
    await page.getByRole('button', { name: 'Step pulse' }).click()
    await page.getByText(/^1 \/ \d+ pulses$/).waitFor()
    await page.reload()
    await page.getByRole('button', { name: 'Resume learning' }).click()
    assert.equal(await space.locator('[data-space-lesson]').inputValue(), 'S10')
    assert.ok(!await page.locator('#space-intro').evaluate(dialog => dialog.open))
    await page.getByRole('button', { name: 'Space Sandbox' }).click()
    await page.locator('[data-space-control="look"]').press('End')
    await page.getByText(/The beam center misses Earth/).waitFor()
    await page.getByRole('button', { name: 'Replay launch' }).click()
    await page.getByRole('button', { name: 'Skip intro' }).click()

    await page.getByRole('button', { name: 'Sandbox', exact: true }).click()
    await page.getByRole('button', { name: /Urban blocks/ }).click()
    await page.locator('#urban-density').selectOption('dense')
    await page.waitForFunction(() => document.querySelector('#scenario-tag')?.textContent === 'Urban blocks')
    await page.getByRole('button', { name: /Terrain Analysis/ }).click()
    await page.waitForFunction(() => document.querySelector('#scenario-tag')?.textContent === 'Terrain Analysis')
    const revision = await page.locator('#monitors').getAttribute('data-revision')
    await page.locator('#ground-focus').selectOption('elevation')
    await page.getByText('Elevation-aware backprojection', { exact: true }).waitFor()
    assert.equal(await page.locator('#monitors').getAttribute('data-revision'), revision)
    await page.locator('#ground-focus').selectOption('geocoded')
    await page.getByText('Flat image geocoded at mid-pass', { exact: true }).waitFor()
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
