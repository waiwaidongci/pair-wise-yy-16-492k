import { allPhotos } from '../data/photos'
import { computeSnapshot } from './derive'
import type { AppState, Batch } from './types'

/** 用现有作品资料初始化一个纪念册打样批次：14 张照片全部在册，片序沿用资料顺序 */
export function createBatch(
  id: string,
  title: string,
  now: string = new Date().toISOString(),
): Batch {
  const photos = allPhotos()
  const sequence = photos.map(p => p.id)
  const captions: Record<string, string> = Object.fromEntries(photos.map(p => [p.id, p.caption]))
  const titles: Record<string, string> = Object.fromEntries(photos.map(p => [p.id, p.title]))
  const batch: Batch = {
    id,
    title,
    createdAt: now,
    revision: 1,
    status: 'draft',
    sequence,
    captions,
    titles,
    conflicts: [],
    snapshots: [computeSnapshot(sequence, [], 1, '建批：按现有作品资料初排', now)],
    history: [{ at: now, message: `建立批次「${title}」，${sequence.length} 张照片全部在册初排` }],
  }
  return batch
}

export function initialState(): AppState {
  return { batches: {}, failedImports: [], prepressList: [] }
}
