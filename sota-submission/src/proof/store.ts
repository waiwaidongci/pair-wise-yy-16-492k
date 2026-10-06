import { useSyncExternalStore } from 'react'
import type { AppState, FailedImport, ProofPackage } from './types'
import { parseAndValidate } from './validate'
import { mergePackage, mergeTwoPackages, resolveConflict as resolveConflictInBatch } from './merge'
import { confirmBatch } from './merge'
import { createBatch, initialState } from './factory'

const STORAGE_KEY = 'proof-batches-v1'

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.batches || !Array.isArray(parsed.failedImports) || !Array.isArray(parsed.prepressList)) {
      return initialState()
    }
    return parsed
  } catch {
    return initialState()
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 隐私模式 / 配额超限时退化为内存态，工作流仍可继续
  }
}

function emit() {
  listeners.forEach(l => l())
  persist()
}

function nowIso() {
  return new Date().toISOString()
}

function recordFailure(raw: unknown, rawText: string | null, reasons: string[], receivedAt: string): FailedImport {
  let pkg: ProofPackage | null = null
  let targetBatchId: string | null = null
  // 即使整体校验失败，也尽量解析出结构化包与目标批次，供恢复时"按原批次继续"
  if (typeof raw === 'object' && raw !== null) {
    const v = parseAndValidate(raw)
    if (v.pkg) pkg = v.pkg
    targetBatchId = v.targetBatchId ?? null
  } else if (rawText) {
    try {
      const reparsed = JSON.parse(rawText)
      const v = parseAndValidate(reparsed)
      if (v.pkg) pkg = v.pkg
      targetBatchId = v.targetBatchId ?? null
    } catch {
      /* 连 JSON 都不是，恢复区提供手工修复入口 */
    }
  }
  return {
    id: `failed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    receivedAt,
    raw: rawText ?? raw,
    pkg,
    targetBatchId,
    reasons,
    attempts: 0,
  }
}

/** 目标批次不存在时按包内 batchId 建批（恢复导入也沿用同一批次 id） */
function ensureBatch(batchId: string): void {
  if (!state.batches[batchId]) {
    state = {
      ...state,
      batches: { ...state.batches, [batchId]: createBatch(batchId, `巡展纪念册 · 批次 ${batchId}`) },
    }
  }
}

export interface ImportOutcome {
  ok: boolean
  batchId?: string
  failureId?: string
  reasons: string[]
  /** 合并后仍未决的冲突数量（成对合并时） */
  pendingConflicts?: number
}

/**
 * 导入单个校对包并并入其目标批次。
 * 任何失败（JSON/结构/批次锁定）都不改动现场，包进入恢复区，可之后按原批次继续。
 */
export function importPackage(fileText: string): ImportOutcome {
  const receivedAt = nowIso()
  let parsed: unknown
  try {
    parsed = JSON.parse(fileText)
  } catch {
    const failed = recordFailure(null, fileText, ['JSON 解析失败（文件不是合法 JSON）'], receivedAt)
    state = { ...state, failedImports: [...state.failedImports, failed] }
    emit()
    return { ok: false, failureId: failed.id, reasons: failed.reasons }
  }

  const result = parseAndValidate(parsed)
  if (!result.ok || !result.pkg) {
    const failed = recordFailure(parsed, fileText, result.reasons, receivedAt)
    state = { ...state, failedImports: [...state.failedImports, failed] }
    emit()
    return { ok: false, failureId: failed.id, reasons: failed.reasons }
  }

  const pkg = result.pkg
  if (state.batches[pkg.batchId]?.status === 'confirmed') {
    const failed = recordFailure(parsed, fileText, ['目标批次已确认锁定，无法并入'], receivedAt)
    state = { ...state, failedImports: [...state.failedImports, failed] }
    emit()
    return { ok: false, failureId: failed.id, reasons: failed.reasons }
  }

  ensureBatch(pkg.batchId)
  const { batch } = mergePackage(state.batches[pkg.batchId], pkg, receivedAt)
  state = { ...state, batches: { ...state.batches, [pkg.batchId]: batch } }
  emit()
  return { ok: true, batchId: pkg.batchId, reasons: [] }
}

/**
 * 网络恢复：两台设备的校对包合并到同一批次。
 * 任一包不合法 → 该包进恢复区，另一个合法包仍正常并入（互不阻塞）。
 */
export function importTwoPackages(textA: string, textB: string): ImportOutcome {
  let pkgA: ProofPackage | null = null
  let pkgB: ProofPackage | null = null
  const failures: FailedImport[] = []
  const receivedAt = nowIso()

  for (const text of [textA, textB]) {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      failures.push(recordFailure(null, text, ['JSON 解析失败（文件不是合法 JSON）'], receivedAt))
      continue
    }
    const v = parseAndValidate(parsed)
    if (!v.ok || !v.pkg) {
      failures.push(recordFailure(parsed, text, v.reasons, receivedAt))
    } else if (!pkgA) {
      pkgA = v.pkg
    } else {
      pkgB = v.pkg
    }
  }

  let batchId: string | undefined
  let pendingConflicts: number | undefined

  if (pkgA && pkgB) {
    if (pkgA.batchId !== pkgB.batchId) {
      failures.push(
        recordFailure(pkgB, textB, ['两台设备校对包指向不同批次，无法成对合并；已保留待恢复'], receivedAt),
      )
      pkgB = null
    } else {
      batchId = pkgA.batchId
      ensureBatch(batchId)
      const out = mergeTwoPackages(state.batches[batchId], pkgA, pkgB, receivedAt)
      pendingConflicts = out.batch.conflicts.filter(c => !c.resolution).length
      state = { ...state, batches: { ...state.batches, [batchId]: out.batch } }
    }
  }

  // 只有一台的包合法时，按"逐台并入"处理，仍并入其原批次
  if ((!pkgA || !pkgB) && (pkgA || pkgB)) {
    const single = (pkgA ?? pkgB)!
    if (state.batches[single.batchId]?.status !== 'confirmed') {
      batchId = single.batchId
      ensureBatch(batchId)
      const out = mergePackage(state.batches[batchId], single, receivedAt)
      state = { ...state, batches: { ...state.batches, [batchId]: out.batch } }
    } else {
      failures.push(recordFailure(single, JSON.stringify(single), ['目标批次已确认锁定，无法并入'], receivedAt))
    }
  }

  if (failures.length) {
    state = { ...state, failedImports: [...state.failedImports, ...failures] }
  }
  emit()

  if (failures.length && !batchId) {
    return { ok: false, failureId: failures[0].id, reasons: failures.flatMap(f => f.reasons) }
  }
  return {
    ok: failures.length === 0,
    batchId,
    pendingConflicts,
    reasons: failures.flatMap(f => f.reasons),
  }
}

/** 恢复区：用（可能已手工修复的）原始内容重新导入，按原批次继续 */
export function recoverFailedImport(failedId: string, repairedText?: string): ImportOutcome {
  const failed = state.failedImports.find(f => f.id === failedId)
  if (!failed) return { ok: false, reasons: ['恢复区中找不到该记录'] }

  const text = repairedText
    ?? (typeof failed.raw === 'string' ? failed.raw : JSON.stringify(failed.raw, null, 2))
  const outcome = importPackage(text)

  state = {
    ...state,
    failedImports: state.failedImports
      .map(f => (f.id === failedId ? { ...f, attempts: f.attempts + 1 } : f)),
  }

  if (outcome.ok) {
    // 恢复成功：从恢复区移除，批次沿用原 batchId 继续
    state = { ...state, failedImports: state.failedImports.filter(f => f.id !== failedId) }
  }
  emit()
  return outcome
}

export function discardFailedImport(failedId: string) {
  state = { ...state, failedImports: state.failedImports.filter(f => f.id !== failedId) }
  emit()
}

export function resolveConflict(batchId: string, conflictId: string, pick: 'a' | 'b') {
  const batch = state.batches[batchId]
  if (!batch) return
  state = {
    ...state,
    batches: { ...state.batches, [batchId]: resolveConflictInBatch(batch, conflictId, pick, nowIso()) },
  }
  emit()
}

export function confirm(batchId: string): boolean {
  const batch = state.batches[batchId]
  if (!batch) return false
  try {
    const confirmed = confirmBatch(batch, nowIso())
    state = {
      ...state,
      batches: { ...state.batches, [batchId]: confirmed },
      prepressList: state.prepressList.includes(batchId)
        ? state.prepressList
        : [...state.prepressList, batchId],
    }
    emit()
    return true
  } catch {
    return false
  }
}

export function createNewBatch(id: string, title: string) {
  state = { ...state, batches: { ...state.batches, [id]: createBatch(id, title) } }
  emit()
}

export function resetAll() {
  state = initialState()
  emit()
}

export function getState() {
  return state
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useProofState(): AppState {
  return useSyncExternalStore(subscribe, () => state)
}
