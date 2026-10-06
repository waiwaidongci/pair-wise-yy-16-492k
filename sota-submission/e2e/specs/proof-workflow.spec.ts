import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

/**
 * 纪念册打样工作流端到端：
 * 建批 → 双机校对包合并（部分直接并入、部分双方都改保留两份）
 * → 去留/片序变化导致跨页/灯箱/页数失效重算、旧记录归档只读
 * → 冲突确认 → 确认批次进印前清单；导入失败 → 恢复区按原批次继续。
 */

const DEMO_BATCH = 'tour-2026-memorial'

async function gotoFreshProof(page: Page) {
  await page.goto('/proof', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /载入巡演示例批次/ }).click()
  await expect(page.getByText('批次编号：' + DEMO_BATCH)).toBeVisible()
}

test.describe('纪念册打样批次工作流', () => {
  test('建批初排：14 张在册、15 页、7 跨页', async ({ page }) => {
    await gotoFreshProof(page)
    await expect(page.getByText('在册照片：14 / 14')).toBeVisible()
    const tiles = page.locator('.derived-tile .num')
    await expect(tiles.nth(0)).toHaveText('15') // 页数
    await expect(tiles.nth(1)).toHaveText('7') // 跨页
    await expect(tiles.nth(2)).toHaveText('14') // 灯箱
  })

  test('双机合并：不撞车的直接并入；同一照片去留/说明两边都改 → 保留两份待确认', async ({ page }) => {
    await gotoFreshProof(page)
    // 直接调用页面内可下载的两个示例包内容，通过文件选择器成对导入
    await mergeSamplePair(page)

    // 2 条直接并入：landscape-05 说明、landscape-03 片序；2 处冲突待确认
    await expect(page.locator('.batch-meta').getByText('未决冲突：2')).toBeVisible()
    await expect(page.locator('.conflict-card')).toHaveCount(2)

    // 冲突之一：pastoral-04 的去留（双方都撤出），未确认前仍在册，页数尚未因此变化
    await expect(page.getByText(/《新疆牧场》的去留/)).toBeVisible()
    // 冲突之二：portrait-02 的说明，双方两版文案都保留
    await expect(page.getByText(/终校时留下的一道帘幕/)).toBeVisible()
    await expect(page.getByText(/保留这一道帘/)).toBeVisible()

    // 不撞车的片序改动已并入：landscape-03 移到第 2 位
    const orderList = page.locator('.changes-panel ol.spread-list')
    await expect(orderList.first()).toContainText('静丘')

    // 有未决冲突时确认按钮禁用
    await expect(page.getByRole('button', { name: /确认批次 · 进入印前清单/ })).toBeDisabled()
  })

  test('照片去留/片序变化 → 跨页、灯箱、页数失效重算，旧排法归档只读', async ({ page }) => {
    await gotoFreshProof(page)
    await mergeSamplePair(page)

    // 合并时片序改动已触发一次重算：应存在 r1 归档
    const archiveSummary = page.locator('details summary', { hasText: /旧排法归档（/ })
    await expect(archiveSummary).toContainText(/旧排法归档（1 份，只读/)
    await archiveSummary.click()
    const archived = page.locator('.snapshot-list.readonly li')
    await expect(archived.first()).toContainText('r1')
    await expect(archived.first()).toContainText('15 页')

    // 确认 pastoral-04 去留冲突（撤出）→ 再触发一次重算：13 张、奇数张单跨页
    await page.getByRole('button', { name: '采用这份' }).first().click()
    const tiles = page.locator('.derived-tile .num')
    await expect(tiles.nth(2)).toHaveText('13')
    await expect(page.getByText('已撤出：新疆牧场')).toBeVisible()
    await expect(page.locator('.derived-panel .spread-list')).toContainText('单张跨页')

    // 归档数量增加
    await expect(page.locator('details summary', { hasText: /旧排法归档/ })).toContainText('旧排法归档（2 份，只读')
  })

  test('冲突全部确认后批次进入印前清单，且批次只读锁定', async ({ page }) => {
    await gotoFreshProof(page)
    await mergeSamplePair(page)
    // 两处冲突各选第一张卡上的"采用这份"（已确认的卡片按钮消失，始终点现存第一个）
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: '采用这份' }).first().click()
      await page.waitForTimeout(60)
    }
    await expect(page.getByText('未决冲突：0')).toBeVisible()
    await page.getByRole('button', { name: '确认批次 · 进入印前清单' }).click()
    await expect(page.getByText('已确认 · 只读锁定').first()).toBeVisible()
    // 合并面板消失（锁定后不能再导入）
    await expect(page.getByText('网络恢复 · 合并校对包')).toHaveCount(0)

    await page.goto('/prepress', { waitUntil: 'networkidle' })
    await expect(page.getByText('印前清单（1）')).toBeVisible()
    await expect(page.locator('.prepress-row.locked')).toBeVisible()
    await expect(page.getByText('可付印')).toBeVisible()
  })

  test('导入失败不破坏现场：损坏包进入恢复区，修复后按原批次继续', async ({ page }) => {
    await gotoFreshProof(page)
    // 写一个损坏包到临时文件，用单文件输入框导入
    const tmp = path.join(os.tmpdir(), 'broken-package.json')
    const broken = {
      kind: 'tour-proof-package',
      version: 1,
      batchId: DEMO_BATCH,
      deviceId: 'venue-device',
      deviceLabel: '会场备用机',
      baseRevision: 1,
      createdAt: '2026-10-05T18:30:00.000Z',
      ops: [{ photoId: 'pastoral-01' }], // 缺 type
    }
    fs.writeFileSync(tmp, JSON.stringify(broken), 'utf-8')

    await page.locator('input[type="file"]').last().setInputFiles(tmp)
    await expect(page.getByText('导入恢复区（1）')).toBeVisible()
    await expect(page.locator('.recovery-panel')).toContainText('目标批次：' + DEMO_BATCH)
    // 现场未动：仍是 14 张
    await expect(page.getByText('在册照片：14 / 14')).toBeVisible()

    // 在恢复区修复为合法包并按原批次重试
    const fixed = JSON.stringify({ ...broken, ops: [{ photoId: 'pastoral-01', type: 'exclude' }] })
    await page.locator('.recovery-panel textarea').fill(fixed)
    await page.getByRole('button', { name: '用以上内容按原批次重试' }).click()
    await expect(page.getByText('导入恢复区（0）')).toHaveCount(0)
    await expect(page.getByText(/已恢复并按原批次/)).toBeVisible()
    // 撤出生效 → 13 张
    await expect(page.getByText('在册照片：13 / 14')).toBeVisible()
    fs.unlinkSync(tmp)
  })
})

async function mergeSamplePair(page: Page) {
  // 页面按钮导出的是浏览器下载；测试改为从站点获取样例后写入两个临时文件
  const editor = await fetchSample(page, 'editor')
  const printer = await fetchSample(page, 'printer')
  const d = os.tmpdir()
  const fA = path.join(d, 'pkg-editor.json')
  const fB = path.join(d, 'pkg-printer.json')
  fs.writeFileSync(fA, editor)
  fs.writeFileSync(fB, printer)

  const fileInputs = page.locator('.import-drop').first().locator('input[type="file"]')
  await fileInputs.nth(0).setInputFiles(fA)
  await fileInputs.nth(1).setInputFiles(fB)
  await page.getByRole('button', { name: /合并到批次/ }).click()
  await page.waitForTimeout(200)
  fs.unlinkSync(fA)
  fs.unlinkSync(fB)
}

// 示例包定义在前端模块中；通过点击"导出"按钮触发下载并读取下载内容较绕，
// 这里直接按 e2e 期望的结构构造（与 src/proof/samples.ts 保持一致）。
async function fetchSample(_page: Page, device: 'editor' | 'printer'): Promise<string> {
  const base = {
    kind: 'tour-proof-package',
    version: 1,
    batchId: DEMO_BATCH,
    baseRevision: 1,
    createdAt: '2026-10-05T18:30:00.000Z',
  }
  if (device === 'editor') {
    return JSON.stringify({
      ...base,
      deviceId: 'editor-device',
      deviceLabel: '编辑机',
      ops: [
        {
          photoId: 'landscape-05',
          type: 'edit-caption',
          value: '雾把山谷的边界都收走了，只剩一道山脊的轮廓还亮着。',
        },
        { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
        { photoId: 'portrait-02', type: 'edit-caption', value: '头发划过额头，像编辑在终校时留下的一道帘幕。' },
      ],
    })
  }
  return JSON.stringify({
    ...base,
    deviceId: 'printer-device',
    deviceLabel: '印厂机',
    ops: [
      { photoId: 'landscape-03', type: 'reorder', toIndex: 1 },
      { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
      { photoId: 'portrait-02', type: 'edit-caption', value: '发丝垂落遮住额头，印厂在打样上标注：保留这一道帘。' },
    ],
  })
}
