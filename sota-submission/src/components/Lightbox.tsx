import { useEffect } from 'react'
import { getCategory } from '../data/photos'
import { lightboxStore, useLightbox } from '../state/stores'

/**
 * 全局共享灯箱（task.md 页面结构 + 约束 2）：
 * 整个应用只挂载这一个实例。展示范围由打开时传入的 photos 列表决定，
 * 因此上一张/下一张只在当前上下文（如筛选后的牧野 4 张）内循环。
 */
export default function Lightbox() {
  const state = useLightbox()

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') lightboxStore.close()
      if (e.key === 'ArrowRight') lightboxStore.step(1)
      if (e.key === 'ArrowLeft') lightboxStore.step(-1)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [state])

  if (!state) return null
  const { photos, index } = state
  const photo = photos[index]
  const category = getCategory(photo.category)
  const total = photos.length

  // 点击背板空白处关闭；点击图片/信息区不关闭
  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`照片灯箱：${photo.title}`}
      onMouseDown={e => {
        if (e.target === e.currentTarget) lightboxStore.close()
      }}
    >
      <button
        type="button"
        className="lightbox-close"
        aria-label="关闭"
        onClick={() => lightboxStore.close()}
      >
        ✕
      </button>
      {total > 1 && (
        <button
          type="button"
          className="lightbox-nav prev"
          aria-label="上一张"
          onClick={() => lightboxStore.step(-1)}
        >
          ‹
        </button>
      )}

      <div className="lightbox-stage">
        <div className="lightbox-frame">
          <img
            key={photo.id}
            className="lightbox-image"
            src={`/${photo.file}`}
            alt={photo.altText}
            width={photo.width}
            height={photo.height}
          />
        </div>
        <div className="lightbox-info">
          <span className="eyebrow">
            {category?.label} · {index + 1} / {total}
          </span>
          <div>
            <h2>{photo.title}</h2>
            <p>{photo.caption}</p>
          </div>
        </div>
      </div>

      {total > 1 && (
        <button
          type="button"
          className="lightbox-nav next"
          aria-label="下一张"
          onClick={() => lightboxStore.step(1)}
        >
          ›
        </button>
      )}
    </div>
  )
}
