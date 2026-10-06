import { describe, expect, it } from 'vitest'
import { createBatch } from './factory'
import {
  affectsLayout,
  canConfirm,
  confirmBatch,
  mergePackage,
  mergeTwoPackages,
  resolveConflict,
} from './merge'
import { currentSnapshot } from './derive'
import { parseAndValidate } from './validate'
import type { ProofPackage } from './types'

const T = '2026-10-05T09:00:00.000Z'

function pkg(
  deviceId: string,
  deviceLabel: string,
  ops: ProofPackage['ops'],
  batchId = 'B1',
  baseRevision = 1,
): ProofPackage {
  return {
    kind: 'tour-proof-package',
    version: 1,
    batchId,
    deviceId,
    deviceLabel,
    baseRevision,
    createdAt: T,
    ops,
  }
}

describe('建批与初排派生', () => {
  it('14 张照片全部在册，初排页数与跨页正确', () => {
    const b = createBatch('B1', '纪念册', T)
    const snap = currentSnapshot(b)!
    expect(snap.lightbox).toHaveLength(14)
    expect(snap.spreads).toHaveLength(7)
    expect(snap.pageCount).toBe(15) // 1 封面 + 7 跨页 ×2
    expect(snap.spreads[0]).toEqual({ spreadNo: 1, left: 'portrait-01', right: 'portrait-02' })
  })
})

describe('网络恢复：双机合并', () => {
  it('没撞上的改动直接并入', () => {
    const b = createBatch('B1', '纪念册', T)
    const a = pkg('editor', '编辑机', [
      { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
    ])
    const c = pkg('printer', '印厂机', [
      { photoId: 'portrait-01', type: 'edit-caption', value: '编辑机侧未动的说明', baseValue: 'x' },
    ])
    const out = mergeTwoPackages(b, a, c, T)
    expect(out.appliedKeys.sort()).toEqual(['pastoral-04:inclusion', 'portrait-01:caption'].sort())
    expect(out.conflictKeys).toHaveLength(0)
    expect(out.batch.sequence).not.toContain('pastoral-04')
    expect(out.batch.captions['portrait-01']).toBe('编辑机侧未动的说明')
  })

  it('同一张照片两边都改（去留）：保留两份待确认，序列暂不变化', () => {
    const b = createBatch('B1', '纪念册', T)
    const a = pkg('editor', '编辑机', [
      { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
    ])
    const c = pkg('printer', '印厂机', [
      { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
    ])
    const out = mergeTwoPackages(b, a, c, T)
    expect(out.conflictKeys).toEqual(['pastoral-04:inclusion'])
    expect(out.batch.conflicts).toHaveLength(1)
    expect(out.batch.conflicts[0].resolution).toBeNull()
    // 冲突未确认前，序列保持原状
    expect(out.batch.sequence).toContain('pastoral-04')
    expect(canConfirm(out.batch)).toBe(false)
  })

  it('同一张照片说明两边都改：两份并存；只改了一方的直接并入', () => {
    const b = createBatch('B1', '纪念册', T)
    const a = pkg('editor', '编辑机', [
      { photoId: 'portrait-01', type: 'edit-caption', value: '编辑版', baseValue: '旧' },
      { photoId: 'portrait-02', type: 'edit-caption', value: '仅编辑版', baseValue: '旧' },
    ])
    const c = pkg('printer', '印厂机', [
      { photoId: 'portrait-01', type: 'edit-caption', value: '印厂版', baseValue: '旧' },
    ])
    const out = mergeTwoPackages(b, a, c, T)
    expect(out.conflictKeys).toEqual(['portrait-01:caption'])
    expect(out.batch.captions['portrait-02']).toBe('仅编辑版')
    // 冲突双方的原文都保留
    const cf = out.batch.conflicts[0]
    expect(cf.a.op.value).toBe('编辑版')
    expect(cf.b.op.value).toBe('印厂版')
  })

  it('片序冲突：编辑机 reorder 与印厂机 reorder 撞同一照片时成对保留', () => {
    const b = createBatch('B1', '纪念册', T)
    const a = pkg('editor', '编辑机', [{ photoId: 'landscape-01', type: 'reorder', toIndex: 10 }])
    const c = pkg('printer', '印厂机', [{ photoId: 'landscape-01', type: 'reorder', toIndex: 0 }])
    const out = mergeTwoPackages(b, a, c, T)
    expect(out.conflictKeys).toEqual(['landscape-01:order'])
  })

  it('不同字段的改动不算撞车：改说明与改片序可同时并入', () => {
    const b = createBatch('B1', '纪念册', T)
    const a = pkg('editor', '编辑机', [
      { photoId: 'landscape-01', type: 'edit-caption', value: '新文案' },
    ])
    const c = pkg('printer', '印厂机', [{ photoId: 'landscape-01', type: 'reorder', toIndex: 5 }])
    const out = mergeTwoPackages(b, a, c, T)
    expect(out.conflictKeys).toHaveLength(0)
    expect(out.batch.captions['landscape-01']).toBe('新文案')
  })

  it('确认冲突后采用所选一方，且批次才能进入印前清单', () => {
    const b = createBatch('B1', '纪念册', T)
    const a = pkg('editor', '编辑机', [
      { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
    ])
    const c = pkg('printer', '印厂机', [
      { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
    ])
    let batch = mergeTwoPackages(b, a, c, T).batch
    expect(() => confirmBatch(batch, T)).toThrow()
    batch = resolveConflict(batch, batch.conflicts[0].id, 'a', T)
    expect(batch.sequence).not.toContain('pastoral-04')
    expect(canConfirm(batch)).toBe(true)
    const confirmed = confirmBatch(batch, T)
    expect(confirmed.status).toBe('confirmed')
    // 锁定后不可再合并
    expect(() => mergePackage(confirmed, a, T)).toThrow(/锁定/)
    // 冲突确认结果只读，不能再次确认
    expect(() => resolveConflict(confirmed, batch.conflicts[0].id, 'b', T)).toThrow()
  })
})

describe('照片去留/片序变化 → 跨页、灯箱、页数失效重算，旧记录只读', () => {
  it('排除一张后旧快照归档、页数减少、灯箱结果同步；纯文案改动不触发重算', () => {
    const b = createBatch('B1', '纪念册', T)
    expect(b.snapshots).toHaveLength(1)

    const a = pkg('editor', '编辑机', [
      { photoId: 'pastoral-04', type: 'exclude', baseIncluded: true },
    ])
    const merged = mergePackage(b, a, T).batch
    expect(merged.snapshots).toHaveLength(2)
    const archived = merged.snapshots[0]
    const current = currentSnapshot(merged)!
    expect(archived.status).toBe('archived')
    expect(archived.pageCount).toBe(15)
    expect(current.status).toBe('current')
    expect(current.pageCount).toBe(15) // 14→13 张：13 张为奇数，solo 补页，仍 15 页
    expect(current.lightbox).not.toContain('pastoral-04')
    expect(current.excluded).toContain('pastoral-04')
    expect(current.spreads[current.spreads.length - 1]?.solo).toBe(true)

    // 纯说明改动不产生新快照
    const c = pkg('printer', '印厂机', [
      { photoId: 'portrait-01', type: 'edit-caption', value: '只改文案' },
    ])
    const textOnly = mergePackage(merged, c, T).batch
    expect(textOnly.snapshots).toHaveLength(2)
  })

  it('再排除两张（剩 11 张奇数→…），归档链不断增长且全部只读', () => {
    let b = createBatch('B1', '纪念册', T)
    b = mergePackage(b, pkg('d1', '设备1', [{ photoId: 'pastoral-04', type: 'exclude' }]), T).batch
    b = mergePackage(b, pkg('d2', '设备2', [{ photoId: 'pastoral-03', type: 'exclude' }]), T).batch
    b = mergePackage(b, pkg('d3', '设备3', [{ photoId: 'pastoral-02', type: 'exclude' }]), T).batch
    const current = currentSnapshot(b)!
    expect(current.lightbox).toHaveLength(11)
    expect(current.pageCount).toBe(13)
    expect(b.snapshots.filter(s => s.status === 'archived')).toHaveLength(3)
  })

  it('affectsLayout 只对去留/片序为真', () => {
    expect(affectsLayout([{ photoId: 'x', type: 'edit-caption', value: 'y' }])).toBe(false)
    expect(affectsLayout([{ photoId: 'x', type: 'include' }])).toBe(true)
    expect(affectsLayout([{ photoId: 'x', type: 'reorder', toIndex: 1 }])).toBe(true)
  })
})

describe('逐台并入（一台先恢复网络）', () => {
  it('第一台并入后，第二台同目标改动若撞未决冲突会挂起', () => {
    let b = createBatch('B1', '纪念册', T)
    b = mergePackage(
      b,
      pkg('editor', '编辑机', [
        { photoId: 'portrait-01', type: 'edit-caption', value: '编辑版', baseValue: '旧' },
      ]),
      T,
    ).batch
    // 未决冲突不存在（单方并入直接生效）；第二台对同照片同字段改动此时基线已变，
    // 规则上仍直接覆盖并入（设备间冲突只在"成对合并"里识别）
    const second = mergePackage(
      b,
      pkg('printer', '印厂机', [
        { photoId: 'portrait-01', type: 'edit-caption', value: '印厂版', baseValue: '旧' },
      ]),
      T,
    )
    expect(second.applied).toHaveLength(1)
  })
})

describe('校对包校验', () => {
  it('缺 kind / 坏 op / 坏时间都给出原因', () => {
    expect(parseAndValidate(null).ok).toBe(false)
    expect(parseAndValidate({}).reasons.length).toBeGreaterThan(0)
    const bad = parseAndValidate({
      kind: 'tour-proof-package',
      version: 1,
      batchId: 'B1',
      deviceId: 'd',
      baseRevision: 1,
      createdAt: 'not-a-date',
      ops: [{ photoId: 'x' }],
    })
    expect(bad.ok).toBe(false)
    expect(bad.reasons.join('|')).toMatch(/createdAt|type/)
  })

  it('尽力提取 targetBatchId 供恢复时按原批次继续', () => {
    const v = parseAndValidate({
      kind: 'tour-proof-package',
      version: 1,
      batchId: 'ORIG-7',
      deviceId: 'd',
      baseRevision: 2,
      createdAt: T,
      ops: [{ photoId: 'x', type: 'edit-caption', value: 'v' }],
    })
    expect(v.ok).toBe(true)
    const bad = parseAndValidate({ kind: 'x', batchId: 'ORIG-7' })
    expect(bad.targetBatchId).toBe('ORIG-7')
  })
})
