import type {
  Batch,
  ChangeField,
  ConflictEntry,
  ProofOp,
  ProofPackage,
} from './types'
import { recompute } from './derive'

/** 一条改动影响的字段（冲突判定的"撞上"粒度） */
export function opField(op: ProofOp): ChangeField {
  switch (op.type) {
    case 'include':
    case 'exclude':
      return 'inclusion'
    case 'reorder':
      return 'order'
    case 'edit-caption':
      return 'caption'
    case 'edit-title':
      return 'title'
  }
}

export function opKey(op: ProofOp): string {
  return `${op.photoId}:${opField(op)}`
}

/** 去留或片序类改动会影响跨页 / 灯箱 / 页数，必须失效重算；纯文案改动不会 */
export function affectsLayout(ops: ProofOp[]): boolean {
  return ops.some(o => o.type === 'include' || o.type === 'exclude' || o.type === 'reorder')
}

/** 在当前批次状态上应用一条不冲突的改动，返回新的序列与文案 */
export function applyOp(
  sequence: string[],
  captions: Record<string, string>,
  titles: Record<string, string>,
  op: ProofOp,
): { sequence: string[]; captions: Record<string, string>; titles: Record<string, string> } {
  const nextSeq = [...sequence]
  const nextCaptions = { ...captions }
  const nextTitles = { ...titles }

  switch (op.type) {
    case 'include': {
      if (!nextSeq.includes(op.photoId)) {
        const at = typeof op.toIndex === 'number' ? Math.min(op.toIndex, nextSeq.length) : nextSeq.length
        nextSeq.splice(at, 0, op.photoId)
      }
      break
    }
    case 'exclude': {
      const idx = nextSeq.indexOf(op.photoId)
      if (idx >= 0) nextSeq.splice(idx, 1)
      break
    }
    case 'reorder': {
      const idx = nextSeq.indexOf(op.photoId)
      if (idx >= 0) {
        nextSeq.splice(idx, 1)
        nextSeq.splice(Math.min(op.toIndex ?? nextSeq.length, nextSeq.length), 0, op.photoId)
      }
      break
    }
    case 'edit-caption':
      nextCaptions[op.photoId] = op.value ?? ''
      break
    case 'edit-title':
      nextTitles[op.photoId] = op.value ?? ''
      break
  }

  return { sequence: nextSeq, captions: nextCaptions, titles: nextTitles }
}

let conflictSeq = 0
function newConflict(
  opA: ProofOp,
  sideA: { deviceId: string; deviceLabel?: string },
  opB: ProofOp,
  sideB: { deviceId: string; deviceLabel?: string },
): ConflictEntry {
  conflictSeq += 1
  return {
    id: `conflict-${Date.now().toString(36)}-${conflictSeq}`,
    photoId: opA.photoId,
    field: opField(opA),
    a: { ...sideA, op: opA },
    b: { ...sideB, op: opB },
    resolution: null,
  }
}

/**
 * 把一台设备的校对包并入已有批次（网络恢复时可多次调用，逐台并入）。
 *  - 与批次中未决冲突同目标（同照片同字段）的改动挂起，等冲突确认后再处理；
 *  - 其余改动直接并入；
 *  - 实际并入的去留/片序改动触发派生结果失效重算。
 */
export function mergePackage(
  batch: Batch,
  pkg: ProofPackage,
  now: string,
): { batch: Batch; applied: ProofOp[]; blockedByPending: ProofOp[] } {
  if (batch.status === 'confirmed') throw new Error('批次已确认锁定，不能再并入校对包')
  if (pkg.batchId !== batch.id) throw new Error('校对包与批次 id 不一致')

  let sequence = [...batch.sequence]
  let captions = { ...batch.captions }
  let titles = { ...batch.titles }
  const conflicts = [...batch.conflicts]
  const applied: ProofOp[] = []
  const blockedByPending: ProofOp[] = []

  for (const op of pkg.ops) {
    const pending = conflicts.find(c => !c.resolution && opKey(c.a.op) === opKey(op))
    if (pending) {
      blockedByPending.push(op)
      continue
    }
    const out = applyOp(sequence, captions, titles, op)
    sequence = out.sequence
    captions = out.captions
    titles = out.titles
    applied.push(op)
  }

  let next: Batch = {
    ...batch,
    sequence,
    captions,
    titles,
    conflicts,
    revision: batch.revision + 1,
    history: [
      ...batch.history,
      {
        at: now,
        message: `并入 ${pkg.deviceLabel ?? pkg.deviceId} 的校对包（基线 r${pkg.baseRevision}）：直接并入 ${applied.length} 条`
          + (blockedByPending.length ? `，${blockedByPending.length} 条因存在未决冲突挂起` : ''),
      },
    ],
  }
  if (affectsLayout(applied)) {
    next = recompute(next, `并入 ${pkg.deviceLabel ?? pkg.deviceId} 的去留/片序改动`, now)
  }
  return { batch: next, applied, blockedByPending }
}

/**
 * 网络恢复时的核心动作：把两台设备的校对包一起合并到同一批次。
 * 没撞上的直接并入；同一张照片/说明两边都改过（同 photoId 同字段）→ 保留两份待确认。
 */
export function mergeTwoPackages(
  batch: Batch,
  pkgA: ProofPackage,
  pkgB: ProofPackage,
  now: string,
): { batch: Batch; appliedKeys: string[]; conflictKeys: string[] } {
  if (batch.status === 'confirmed') throw new Error('批次已确认锁定，不能再并入校对包')
  if (pkgA.batchId !== batch.id || pkgB.batchId !== batch.id) throw new Error('校对包与批次 id 不一致')
  if (pkgA.deviceId === pkgB.deviceId) throw new Error('两台设备校对包的 deviceId 不能相同')

  const opsA = pkgA.ops.map(op => ({ key: opKey(op), op }))
  const opsB = pkgB.ops.map(op => ({ key: opKey(op), op }))
  const mapA = new Map(opsA.map(x => [x.key, x.op]))
  const mapB = new Map(opsB.map(x => [x.key, x.op]))

  const conflictEntries: ConflictEntry[] = []
  const conflictKeys: string[] = []
  const appliedKeys: string[] = []

  let sequence = [...batch.sequence]
  let captions = { ...batch.captions }
  let titles = { ...batch.titles }

  for (const { key, op } of opsA) {
    if (mapB.has(key)) {
      conflictKeys.push(key)
      conflictEntries.push(
        newConflict(
          op,
          { deviceId: pkgA.deviceId, deviceLabel: pkgA.deviceLabel },
          mapB.get(key)!,
          { deviceId: pkgB.deviceId, deviceLabel: pkgB.deviceLabel },
        ),
      )
    } else {
      const out = applyOp(sequence, captions, titles, op)
      sequence = out.sequence
      captions = out.captions
      titles = out.titles
      appliedKeys.push(key)
    }
  }
  for (const { key, op } of opsB) {
    if (!mapA.has(key)) {
      const out = applyOp(sequence, captions, titles, op)
      sequence = out.sequence
      captions = out.captions
      titles = out.titles
      appliedKeys.push(key)
    }
  }

  let next: Batch = {
    ...batch,
    sequence,
    captions,
    titles,
    conflicts: [...batch.conflicts, ...conflictEntries],
    revision: batch.revision + 1,
    history: [
      ...batch.history,
      {
        at: now,
        message: `网络恢复合并：${pkgA.deviceLabel ?? pkgA.deviceId} × ${pkgB.deviceLabel ?? pkgB.deviceId}，`
          + `直接并入 ${appliedKeys.length} 条，${conflictEntries.length} 处双方改动保留两份待确认`,
      },
    ],
  }

  // 只有真正被并入的去留/片序改动触发重算；冲突中的两份保持待确认，不改变当前序列
  const appliedOps = [...opsA, ...opsB].filter(x => appliedKeys.includes(x.key)).map(x => x.op)
  if (affectsLayout(appliedOps)) {
    next = recompute(next, '合并并入了去留/片序改动，旧跨页、灯箱与页数失效', now)
  }

  return { batch: next, appliedKeys, conflictKeys }
}

/** 人工确认一处冲突：应用选中一方的改动，另一方仅作为只读记录保留 */
export function resolveConflict(
  batch: Batch,
  conflictId: string,
  pick: 'a' | 'b',
  now: string,
): Batch {
  if (batch.status === 'confirmed') throw new Error('批次已确认锁定')
  const target = batch.conflicts.find(c => c.id === conflictId)
  if (!target) throw new Error('未找到该冲突')
  if (target.resolution) throw new Error('该冲突已确认（只读）')

  const chosenSide = pick === 'a' ? target.a : target.b
  const chosen = chosenSide.op
  const out = applyOp(batch.sequence, batch.captions, batch.titles, chosen)

  let next: Batch = {
    ...batch,
    sequence: out.sequence,
    captions: out.captions,
    titles: out.titles,
    conflicts: batch.conflicts.map(c => (c.id === conflictId ? { ...c, resolution: pick } : c)),
    revision: batch.revision + 1,
    history: [
      ...batch.history,
      {
        at: now,
        message: `冲突确认：${target.photoId} 的${fieldLabel(target.field)}采用${chosenSide.deviceLabel ?? chosenSide.deviceId}版本`,
      },
    ],
  }
  if (affectsLayout([chosen])) {
    next = recompute(next, '冲突确认改变了去留/片序，派生结果重算', now)
  }
  return next
}

export function fieldLabel(f: ChangeField): string {
  return { inclusion: '去留', order: '片序', caption: '说明', title: '标题' }[f]
}

/** 只有不存在未决冲突时批次才可确认 */
export function canConfirm(batch: Batch): boolean {
  return batch.status === 'draft' && batch.conflicts.every(c => c.resolution !== null)
}

export function confirmBatch(batch: Batch, now: string): Batch {
  if (!canConfirm(batch)) throw new Error('仍有双方改动未确认，不能进入印前清单')
  return {
    ...batch,
    status: 'confirmed',
    confirmedAt: now,
    history: [...batch.history, { at: now, message: '批次确认，进入印前清单（此后只读锁定）' }],
  }
}
