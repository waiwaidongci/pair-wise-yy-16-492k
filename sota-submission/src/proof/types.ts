/**
 * 纪念册打样 · 校对批次领域模型
 *
 * 业务规则（来自任务说明）：
 *  - 两台设备（编辑机 / 印厂机）在断网会场各自产出校对包；网络恢复后合并到同一批次。
 *  - 没撞上的改动直接并入；同一张照片的去留/片序/说明两边都改过 → 保留两份待确认。
 *  - 照片去留（或片序）一变，已排跨页（spreads）、灯箱结果（lightbox）、页数（pageCount）
 *    全部失效重算；旧记录归档只读，不就地覆盖。
 *  - 校对包导入失败不破坏现场，可在恢复区找回并按原批次继续合并。
 *  - 批次只有在所有冲突都确认后才能 confirm，进入印前清单；确认后只读锁定。
 */

export type DeviceId = string

/** 校对动作的操作类型 */
export type ChangeOpType = 'include' | 'exclude' | 'reorder' | 'edit-caption' | 'edit-title'

/**
 * 一条校对改动。
 * base* 字段记录该设备做改动时"看到的原值"，合并时用于判断两边是否真的都改过。
 */
export interface ProofOp {
  /** 作用对象：照片 id；说明/片序/去留都挂在某张照片上 */
  photoId: string
  type: ChangeOpType
  /** reorder 的目标位置（0 基）；include/exclude/编辑类忽略 */
  toIndex?: number
  /** edit-caption / edit-title 的新值 */
  value?: string
  /** 该设备改动前看到的原值（说明文字 / 标题） */
  baseValue?: string
  /** include/exclude 时该设备看到的原在册状态 */
  baseIncluded?: boolean
}

/** 断网设备产出的校对包 */
export interface ProofPackage {
  /** 包格式标识，导入时校验 */
  kind: 'tour-proof-package'
  /** 包结构版本 */
  version: 1
  /** 目标批次：两台设备必须指向同一批次才能合到一起 */
  batchId: string
  /** 产出设备，如 'editor'（编辑机）/ 'printer'（印厂机） */
  deviceId: DeviceId
  deviceLabel?: string
  /** 断网校对开始前设备看到的批次版本（用于审计） */
  baseRevision: number
  createdAt: string
  ops: ProofOp[]
}

export type ChangeField = 'inclusion' | 'order' | 'caption' | 'title'

export interface ConflictEntry {
  id: string
  photoId: string
  field: ChangeField
  /** 两份各执一词的改动 */
  a: { deviceId: DeviceId; deviceLabel?: string; op: ProofOp }
  b: { deviceId: DeviceId; deviceLabel?: string; op: ProofOp }
  /** 确认后选中的一方：'a' | 'b'；未确认前为 null */
  resolution: 'a' | 'b' | null
}

/** 跨页 / 灯箱 / 页数 等从"在册照片序列"派生出的结果，整体一个不可变快照 */
export interface DerivedSnapshot {
  version: number
  computedAt: string
  /** 触发本次重算的原因 */
  reason: string
  /** 在册照片 id（已排序）——灯箱结果 */
  lightbox: string[]
  /** 跨页排布 */
  spreads: { spreadNo: number; left?: string; right?: string; solo?: boolean }[]
  /** 总页数（封面 + 跨页，强制偶数） */
  pageCount: number
  /** 被排除的照片 id */
  excluded: string[]
  status: 'current' | 'archived'
}

export interface HistoryEvent {
  at: string
  message: string
}

export type BatchStatus = 'draft' | 'confirmed'

export interface Batch {
  id: string
  title: string
  createdAt: string
  revision: number
  status: BatchStatus
  confirmedAt?: string
  /** 当前在册照片 id（有序） */
  sequence: string[]
  /** 当前各照片说明（照片 id → 文案），不在 sequence 里的也保留（重新纳入时仍在） */
  captions: Record<string, string>
  /** 当前各照片标题（照片 id → 标题） */
  titles: Record<string, string>
  conflicts: ConflictEntry[]
  /** 派生结果版本链：最后一个是 current，其余 archived 只读 */
  snapshots: DerivedSnapshot[]
  history: HistoryEvent[]
}

/** 导入失败后保留下来的未合并校对包（恢复区） */
export interface FailedImport {
  id: string
  receivedAt: string
  raw: unknown
  /** 解析后的包（若 JSON 与基本结构可读） */
  pkg: ProofPackage | null
  /** 解析出的目标批次 id（尽力提取，供"按原批次继续"） */
  targetBatchId: string | null
  reasons: string[]
  /** 恢复尝试次数 */
  attempts: number
}

export interface AppState {
  batches: Record<string, Batch>
  failedImports: FailedImport[]
  /** 已确认进入印前清单的批次 id（有序） */
  prepressList: string[]
}
