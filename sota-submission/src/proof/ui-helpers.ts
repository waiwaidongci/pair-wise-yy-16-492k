import type { Batch, ProofOp } from './types'
import { getPhoto } from '../data/photos'
import { fieldLabel } from './merge'

/** 操作的中文摘要（校对台展示用） */
export function describeOp(op: ProofOp): string {
  let title = op.photoId
  try {
    title = getPhoto(op.photoId).title
  } catch {
    /* 未知 id 仍显示原始值 */
  }
  switch (op.type) {
    case 'include':
      return `《${title}》纳入册`
    case 'exclude':
      return `《${title}》撤出册`
    case 'reorder':
      return `《${title}》移到第 ${(op.toIndex ?? 0) + 1} 位`
    case 'edit-caption':
      return `改写《${title}》的说明`
    case 'edit-title':
      return `改写《${title}》的标题`
  }
}

export function fieldChinese(op: ProofOp): string {
  return fieldLabel(
    op.type === 'include' || op.type === 'exclude'
      ? 'inclusion'
      : op.type === 'reorder'
        ? 'order'
        : op.type === 'edit-caption'
          ? 'caption'
          : 'title',
  )
}

/** 冲突中某一方的取值，用于 A/B 卡片展示 */
export function opValueText(op: ProofOp): string {
  switch (op.type) {
    case 'include':
      return '保留在册'
    case 'exclude':
      return '撤出纪念册'
    case 'reorder':
      return `移到第 ${(op.toIndex ?? 0) + 1} 位`
    case 'edit-caption':
    case 'edit-title':
      return op.value ?? ''
  }
}

export function photoTitle(id: string): string {
  try {
    return getPhoto(id).title
  } catch {
    return id
  }
}

export function photoCaption(id: string, batch: Batch): string {
  return batch.captions[id] ?? ''
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/** 触发浏览器下载一个 JSON 校对包（用于"导出设备校对包"） */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
