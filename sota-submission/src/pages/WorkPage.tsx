import { Link } from 'react-router-dom'
import { categories, photosByCategory, seriesList } from '../data/photos'
import { filterStore, useWorkFilter, type FilterValue } from '../state/stores'
import PhotoCard from '../components/PhotoCard'

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: '全部' },
  ...categories.map(c => ({ value: c.id, label: c.label })),
]

export default function WorkPage() {
  const [filter] = useWorkFilter()
  // 灯箱范围 = 当前筛选结果（约束 2 的关键：把子集显式传给每张卡片）
  const photos = photosByCategory(filter)

  return (
    <div className="container page-pad">
      <div className="section-head">
        <h2>作品集</h2>
        <hr className="gold-rule" />
      </div>

      {/* 筛选状态存在模块级 filterStore 中（约束 1），进系列页再返回不会重置 */}
      <div className="filters" role="group" aria-label="按分类筛选照片">
        {FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => filterStore.set(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 系列入口：筛选为具体分类时，引导进入该分类的系列叙事页 */}
      {filter !== 'all' && (
        <div className="series-entry" style={{ marginBottom: 24, fontSize: '0.9rem', color: 'var(--text-dim)' }}>
          {seriesList
            .filter(s => s.category === filter)
            .map(s => (
              <Link key={s.id} to={`/work/${s.id}`} style={{ color: 'var(--gold)' }}>
                进入系列《{s.title}》→
              </Link>
            ))}
        </div>
      )}

      <div className="photo-grid" aria-live="polite">
        {photos.map(photo => (
          <PhotoCard key={photo.id} photo={photo} scope={photos} />
        ))}
      </div>
    </div>
  )
}
