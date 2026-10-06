import type { ProofOp, ProofPackage } from './types'

export interface ValidationResult {
  ok: boolean
  pkg?: ProofPackage
  /** 尽力提取的目标批次 id（即使整体校验失败） */
  targetBatchId?: string | null
  reasons: string[]
}

/**
 * 校验断网校对包。任何结构问题都返回原因列表而不是抛异常——
 * 调用方据此把包放进恢复区，等待恢复后按原批次继续。
 */
export function parseAndValidate(raw: unknown): ValidationResult {
  const reasons: string[] = []

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reasons: ['包不是 JSON 对象'], targetBatchId: null }
  }
  const obj = raw as Record<string, unknown>

  const targetBatchId = typeof obj.batchId === 'string' ? obj.batchId : null

  if (obj.kind !== 'tour-proof-package') reasons.push('缺少 kind: "tour-proof-package" 标识')
  if (obj.version !== 1) reasons.push('仅支持 version: 1 的校对包')
  if (typeof obj.batchId !== 'string' || !obj.batchId.trim()) reasons.push('batchId 缺失或不是字符串')
  if (typeof obj.deviceId !== 'string' || !obj.deviceId.trim()) reasons.push('deviceId 缺失或不是字符串')
  if (typeof obj.createdAt !== 'string' || Number.isNaN(Date.parse(obj.createdAt))) {
    reasons.push('createdAt 缺失或不是合法时间')
  }
  if (typeof obj.baseRevision !== 'number') reasons.push('baseRevision 缺失或不是数字')
  if (!Array.isArray(obj.ops)) {
    reasons.push('ops 缺失或不是数组')
    return { ok: false, reasons, targetBatchId }
  }

  const ops: ProofOp[] = []
  obj.ops.forEach((rawOp, i) => {
    const opErrs = validateOp(rawOp, i)
    if (opErrs.length) {
      reasons.push(...opErrs)
    } else {
      ops.push(rawOp as ProofOp)
    }
  })

  if (!reasons.length) {
    return {
      ok: true,
      pkg: {
        kind: 'tour-proof-package',
        version: 1,
        batchId: obj.batchId as string,
        deviceId: obj.deviceId as string,
        deviceLabel: typeof obj.deviceLabel === 'string' ? obj.deviceLabel : undefined,
        baseRevision: obj.baseRevision as number,
        createdAt: obj.createdAt as string,
        ops,
      },
      reasons: [],
    }
  }
  return { ok: false, reasons, targetBatchId }
}

function validateOp(raw: unknown, i: number): string[] {
  const errs: string[] = []
  const where = `第 ${i + 1} 条改动`
  if (typeof raw !== 'object' || raw === null) return [`${where} 不是对象`]
  const op = raw as Record<string, unknown>

  if (typeof op.photoId !== 'string' || !op.photoId) errs.push(`${where} 缺少 photoId`)
  const allowed = ['include', 'exclude', 'reorder', 'edit-caption', 'edit-title']
  if (typeof op.type !== 'string' || !allowed.includes(op.type)) {
    errs.push(`${where} 的 type 不合法`)
  }
  if (op.type === 'reorder' && (typeof op.toIndex !== 'number' || op.toIndex < 0)) {
    errs.push(`${where} reorder 缺少非负 toIndex`)
  }
  if ((op.type === 'edit-caption' || op.type === 'edit-title') && typeof op.value !== 'string') {
    errs.push(`${where} 编辑类改动缺少字符串 value`)
  }
  if ('baseIncluded' in op && typeof op.baseIncluded !== 'boolean') {
    errs.push(`${where} baseIncluded 必须是布尔值`)
  }
  return errs
}
