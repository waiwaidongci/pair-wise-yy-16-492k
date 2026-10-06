import type { Photo } from '../data/photos'
import { getCategory } from '../data/photos'
import PhotoImage from './PhotoImage'
import { openLightbox } from './openLightbox'

interface Props {
  photo: Photo
  scope: Photo[]
}

/** /work 网格卡片：button.photo-button，内部含真实比例占位与标题元信息 */
export default function PhotoCard({ photo, scope }: Props) {
  const category = getCategory(photo.category)
  return (
    <button
      type="button"
      className="photo-button"
      aria-label={`打开灯箱查看：${photo.title}`}
      onClick={() => openLightbox(scope, photo.id)}
    >
      <PhotoImage photo={photo} />
      <span className="photo-meta">
        <strong>{photo.title}</strong>
        <span>{category?.label}</span>
      </span>
    </button>
  )
}
