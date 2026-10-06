import { lightboxStore } from '../state/stores'
import type { Photo } from '../data/photos'

/** 统一入口：任何页面点击照片都调用它，打开的是同一个全局 <Lightbox/> */
export function openLightbox(photos: Photo[], photoId: string) {
  lightboxStore.open(photos, photoId)
}
