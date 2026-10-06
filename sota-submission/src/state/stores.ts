import { useSyncExternalStore } from 'react'
import type { Photo, PhotoCategory } from '../data/photos'

/**
 * 全局灯箱状态（模块级 store，挂在 App根部，任何页面都通过 openLightbox 打开
 * 同一个 <Lightbox/> 组件）。
 *
 * 关键点（task.md 约束 2）：灯箱不持有"全部照片"，每次打开都由调用方显式传入
 * 当前上下文的照片列表——/work 传入筛选后的子集，系列页传入该系列的照片。
 * 因此上一张/下一张天然只在该列表内循环。
 */
export interface LightboxState {
  photos: Photo[]
  index: number
}

let lightboxState: LightboxState | null = null
const lightboxListeners = new Set<() => void>()

function emitLightbox() {
  lightboxListeners.forEach(l => l())
}

export const lightboxStore = {
  getSnapshot: () => lightboxState,
  subscribe(listener: () => void) {
    lightboxListeners.add(listener)
    return () => lightboxListeners.delete(listener)
  },
  /** 在给定照片列表中打开灯箱，startId 为当前点击的照片 */
  open(photos: Photo[], startId: string) {
    const index = Math.max(0, photos.findIndex(p => p.id === startId))
    lightboxState = { photos, index }
    emitLightbox()
  },
  close() {
    lightboxState = null
    emitLightbox()
  },
  step(delta: number) {
    if (!lightboxState) return
    const total = lightboxState.photos.length
    lightboxState = {
      ...lightboxState,
      index: (lightboxState.index + delta + total) % total,
    }
    emitLightbox()
  },
}

export function useLightbox(): LightboxState | null {
  return useSyncExternalStore(lightboxStore.subscribe, lightboxStore.getSnapshot)
}

/**
 * /work 筛选状态（task.md 约束 1）：放在页面组件之外的模块级 store 中，
 * 从 /work 进入系列详情页再返回时组件会卸载重建，但筛选状态不丢。
 */
export type FilterValue = PhotoCategory | 'all'

let filterValue: FilterValue = 'all'
const filterListeners = new Set<() => void>()

export const filterStore = {
  getSnapshot: () => filterValue,
  subscribe(listener: () => void) {
    filterListeners.add(listener)
    return () => filterListeners.delete(listener)
  },
  set(value: FilterValue) {
    filterValue = value
    filterListeners.forEach(l => l())
  },
}

export function useWorkFilter(): [FilterValue, (value: FilterValue) => void] {
  const value = useSyncExternalStore(filterStore.subscribe, filterStore.getSnapshot)
  return [value, filterStore.set]
}
