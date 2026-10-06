import type { ProofPackage } from './types'

/**
 * 两台设备在断网会场产出的示例校对包（可下载到本地后再导入，模拟"断网产出、联网合并"）。
 * 两台设备 baseRevision 相同（=建批后的 r1），各自独立改动：
 *  - 没撞上的：编辑机改一处说明、印厂机调整片序 → 直接并入；
 *  - 撞上的：pastoral-04 两边都做了去留决定、portrait-02 说明两边都改写 → 保留两份待确认。
 */
const BATCH_ID = 'tour-2026-memorial'
const BASE_REVISION = 1
const STAMP = '2026-10-05T18:30:00.000Z'

export const sampleEditorPackage: ProofPackage = {
  kind: 'tour-proof-package',
  version: 1,
  batchId: BATCH_ID,
  deviceId: 'editor-device',
  deviceLabel: '编辑机',
  baseRevision: BASE_REVISION,
  createdAt: STAMP,
  ops: [
    // 与印厂机不撞：印厂改的是片序
    {
      photoId: 'landscape-05',
      type: 'edit-caption',
      value: '雾把山谷的边界都收走了，只剩一道山脊的轮廓还亮着。',
      baseValue: '雾把山谷的边界都收走了，只剩下轮廓。',
    },
    // 与印厂机撞车（同一照片的去留）：双方都决定撤出 pastoral-04
    { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
    // 与印厂机撞车（同一照片的说明）
    {
      photoId: 'portrait-02',
      type: 'edit-caption',
      value: '头发划过额头，像编辑在终校时留下的一道帘幕。',
      baseValue: '头发划过额头，像一道刻意留下的帘幕。',
    },
  ],
}

export const samplePrinterPackage: ProofPackage = {
  kind: 'tour-proof-package',
  version: 1,
  batchId: BATCH_ID,
  deviceId: 'printer-device',
  deviceLabel: '印厂机',
  baseRevision: BASE_REVISION,
  createdAt: STAMP,
  ops: [
    // 与编辑机不撞：把 landscape-03 前移到第 2 位（0 基为 1）
    { photoId: 'landscape-03', type: 'reorder', toIndex: 1 },
    // 撞车：印厂也决定撤出 pastoral-04（理由是跨页留白不足）
    { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
    // 撞车：印厂给了另一版 portrait-02 的说明
    {
      photoId: 'portrait-02',
      type: 'edit-caption',
      value: '发丝垂落遮住额头，印厂在打样上标注：保留这一道帘。',
      baseValue: '头发划过额头，像一道刻意留下的帘幕。',
    },
  ],
}

/** 故意损坏的包：用于演示"导入失败 → 恢复区按原批次继续" */
export const sampleBrokenPackageJson = JSON.stringify(
  {
    kind: 'tour-proof-package',
    version: 1,
    batchId: BATCH_ID,
    deviceId: 'venue-device',
    deviceLabel: '会场备用机',
    baseRevision: 1,
    createdAt: STAMP,
    ops: [
      { photoId: 'pastoral-01', type: 'edit-caption', value: '木屋比牛安静，牛比风安静。（终校定稿）' },
      // ↓ 非法改动：缺少 type
      { photoId: 'landscape-02' },
    ],
  },
  null,
  2,
)

export const DEMO_BATCH_ID = BATCH_ID
