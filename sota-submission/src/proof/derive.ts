import type { Batch, DerivedSnapshot } from './types'

/**
 * 跨页 / 灯箱 / 页数 —— 全部从"在册照片有序序列"一个源头派生。
 *
 * 排版约定（纪念册打样）：
 *  - 第 1 页为封面（不计照片）；
 *  - 从第 2 页起，每张跨页（spread）摊开两页、放两张照片，左奇右偶；
 *  - 奇数张时最后一张单独成跨页（solo），页数补成偶数。
 * 灯箱结果 = 在册序列本身（灯箱只在在册照片间循环）。
 */
export function computeSnapshot(
  sequence: string[],
  excluded: string[],
  version: number,
  reason: string,
  now: string = new Date(0).toISOString(),
): DerivedSnapshot {
  const spreads: DerivedSnapshot['spreads'] = []
  let spreadNo = 1
  for (let i = 0; i < sequence.length; i += 2) {
    const left = sequence[i]
    const right = sequence[i + 1]
    spreads.push(
      right
        ? { spreadNo, left, right }
        : { spreadNo, left, solo: true },
    )
    spreadNo += 1
  }

  // 封面 1 页 + 每个跨页 2 页（solo 也占 2 页），结果天然为偶数
  const pageCount = 1 + spreads.length * 2

  return {
    version,
    computedAt: now,
    reason,
    lightbox: [...sequence],
    spreads,
    pageCount,
    excluded: [...excluded],
    status: 'current',
  }
}

/** 重算入口：旧快照归档只读，新快照挂到版本链末尾 */
export function recompute(batch: Batch, reason: string, now: string): Batch {
  const included = new Set(batch.sequence)
  const excluded = Object.keys(batch.captions).filter(id => !included.has(id))

  const snapshots = batch.snapshots.map(s =>
    s.status === 'current' ? { ...s, status: 'archived' as const } : s,
  )
  snapshots.push(computeSnapshot(batch.sequence, excluded, batch.revision, reason, now))

  return { ...batch, snapshots }
}

export function currentSnapshot(batch: Batch): DerivedSnapshot | undefined {
  return [...batch.snapshots].reverse().find(s => s.status === 'current')
}
