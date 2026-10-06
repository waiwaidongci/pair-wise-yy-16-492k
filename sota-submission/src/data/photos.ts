import rawData from './photos.json'

// 权威内容数据：唯一来源是 mock-data/photos.json（构建时拷贝到 src/data 下，
// 不做任何改写）。所有页面、灯箱、系列页都从这里派生，禁止在组件里另写一份。
export type PhotoCategory = 'portrait' | 'landscape' | 'pastoral'

export interface Photo {
  id: string
  category: PhotoCategory
  seriesId: string
  /** 相对站点根目录的图片路径（public/ 下） */
  file: string
  title: string
  altText: string
  caption: string
  width: number
  height: number
  order: number
}

export interface Series {
  id: string
  title: string
  category: PhotoCategory
  summary: string
  photoIds: string[]
}

export interface Category {
  id: PhotoCategory
  label: string
}

interface PhotoData {
  categories: Category[]
  series: Series[]
  photos: Photo[]
}

const data = rawData as PhotoData

export const categories = data.categories
export const seriesList = data.series

const photoById = new Map<string, Photo>(data.photos.map(p => [p.id, p]))

export function allPhotos(): Photo[] {
  return data.photos
}

export function getPhoto(id: string): Photo {
  const photo = photoById.get(id)
  if (!photo) throw new Error(`未知的照片 id：${id}`)
  return photo
}

export function getCategory(id: string): Category | undefined {
  return data.categories.find(c => c.id === id)
}

export function getSeries(id: string): Series | undefined {
  return data.series.find(s => s.id === id)
}

/** /work 网格顺序：按分类原始顺序，分类内按 order 升序（即 photos.json 的列出顺序） */
export function photosByCategory(category: PhotoCategory | 'all'): Photo[] {
  const list = category === 'all' ? data.photos : data.photos.filter(p => p.category === category)
  return [...list].sort((a, b) => {
    if (a.category !== b.category) {
      return data.categories.findIndex(c => c.id === a.category) - data.categories.findIndex(c => c.id === b.category)
    }
    return a.order - b.order
  })
}

/** 系列详情页顺序：严格按 order 升序，从同一份数据模型派生 */
export function photosBySeries(seriesId: string): Photo[] {
  return data.photos
    .filter(p => p.seriesId === seriesId)
    .sort((a, b) => a.order - b.order)
}

/** 首页精选：每个系列取 order 最小的一张 */
export function featuredForSeries(seriesId: string): Photo {
  return photosBySeries(seriesId)[0]
}
