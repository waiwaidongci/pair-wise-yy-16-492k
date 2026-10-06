import { chromium, expect } from '@playwright/test'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:5173'
const OUT = '/workspace/screenshots'

async function main() {
  const browser = await chromium.launch()

  // ---- A / B / C / D / F：桌面 1440x1000 ----
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await desktop.newPage()

  // A：首页冷启动
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${OUT}/sota_state_a.png` })

  // B：/work 牧野筛选
  await page.goto(BASE + '/work', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '牧野' }).click()
  await expect(page.getByRole('button', { name: '牧野' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.photo-button')).toHaveCount(4)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/sota_state_b.png` })

  // C：点第 2 张牧野（pastoral-02）打开灯箱 → c1；点一次下一张（pastoral-03）→ c2
  await page.locator('.photo-button').nth(1).click()
  await page.locator('.lightbox[role="dialog"]').waitFor()
  await page.waitForFunction(
    () => {
      const img = document.querySelector('.lightbox-image') as HTMLImageElement | null
      return img?.complete && (img.naturalWidth || 0) > 0
    },
    null,
    { timeout: 10000 },
  )
  await page.screenshot({ path: `${OUT}/sota_state_c1.png` })
  await page.getByRole('button', { name: '下一张' }).click()
  await page.waitForFunction(
    () => {
      const img = document.querySelector('.lightbox-image') as HTMLImageElement | null
      return img?.complete && (img.naturalWidth || 0) > 0
    },
    null,
    { timeout: 10000 },
  )
  await expect(page.locator('.lightbox-info .eyebrow')).toContainText('3 / 4')
  await page.screenshot({ path: `${OUT}/sota_state_c2.png` })
  await page.getByRole('button', { name: '关闭' }).click()

  // D：系列详情页
  await page.goto(BASE + '/work/highland-pastoral', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/sota_state_d.png`, fullPage: true })

  // F1：联系表单留空校验态（先 blur 再提交；提交按钮本就禁用，点击 body 触发）
  await page.goto(BASE + '/contact', { waitUntil: 'networkidle' })
  await page.getByLabel('邮箱').fill('bad')
  await page.getByLabel('邮箱').blur()
  await page.getByLabel('姓名').click()
  await page.getByLabel('邮箱').click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/sota_state_f1.png` })

  // F2：合法内容提交后的成功态
  await page.getByLabel('姓名').fill('访客')
  await page.getByLabel('邮箱').fill('hello@example.com')
  await page.getByLabel('留言').fill('想了解一项完整的摄影合作计划，谢谢。')
  await page.getByRole('button', { name: '发送消息' }).click()
  await page.getByText('谢谢你的来信').waitFor()
  await page.screenshot({ path: `${OUT}/sota_state_f2.png` })

  await desktop.close()

  // ---- E：移动端 390x844 ----
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  const mp = await mobile.newPage()
  await mp.goto(BASE + '/work', { waitUntil: 'networkidle' })
  await mp.waitForTimeout(400)
  await mp.screenshot({ path: `${OUT}/sota_state_e.png` })

  // 额外：移动端灯箱（说明在底部）
  await mp.locator('.photo-button').first().click()
  await mp.locator('.lightbox[role="dialog"]').waitFor()
  await mp.waitForTimeout(400)
  await mp.screenshot({ path: `${OUT}/sota_state_e_lightbox.png` })
  await mobile.close()

  await browser.close()
  console.log('screenshots done:', fs.readdirSync(OUT).filter(f => f.startsWith('sota_state')).join(', '))
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
