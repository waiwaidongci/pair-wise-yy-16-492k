import { useState } from 'react'
import type { Photo } from '../data/photos'

interface Props {
  photo: Photo
  className?: string
  imgClassName?: string
  /** 是否在加载完成前保持透明（网格/灯箱都用占位比例撑开，无需切换 src） */
  eager?: boolean
}

/**
 * 防 CLS 图片（task.md 约束 3）：
 * 外层 .ratio-box 用内联 aspect-ratio 按 photos.json 的真实 width/height 预先撑开，
 * <img> 绝对定位填满——图片到达前后容器尺寸不变，不产生布局抖动。
 */
export default function PhotoImage({ photo, className, imgClassName, eager }: Props) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div
      className={`ratio-box${className ? ` ${className}` : ''}`}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      <img
        src={`/${photo.file}`}
        alt={photo.altText}
        width={photo.width}
        height={photo.height}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        className={`${loaded ? 'is-loaded' : 'is-loading'}${imgClassName ? ` ${imgClassName}` : ''}`}
      />
    </div>
  )
}
