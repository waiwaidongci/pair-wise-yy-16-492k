import { Link, Navigate, useParams } from 'react-router-dom'
import { getCategory, getSeries, photosBySeries } from '../data/photos'
import PhotoImage from '../components/PhotoImage'
import { openLightbox } from '../components/openLightbox'
import { featuredForSeries } from '../data/photos'

export default function SeriesPage() {
  const { seriesId } = useParams<{ seriesId: string }>()
  const series = seriesId ? getSeries(seriesId) : undefined
  if (!seriesId || !series) return <Navigate to="/work" replace />

  // 与 /work 共享同一份数据模型：严格按 seriesId 派生、按 order 排序，不另写列表
  const photos = photosBySeries(series.id)
  const hero = featuredForSeries(series.id)
  const category = getCategory(series.category)

  return (
    <>
      <section className="series-hero">
        <div className="hero-media">
          <img src={`/${hero.file}`} alt="" />
        </div>
        <div className="hero-content">
          <span className="eyebrow">{category?.label} · Series</span>
          <h1>{series.title}</h1>
        </div>
      </section>

      <div className="container">
        <div className="story">
          {/* summary 以斜体 Playfair Display 引言样式呈现 */}
          <p className="lead">{series.summary}</p>

          {photos.map((photo, i) => (
            <div className={`story-row${i % 2 === 1 ? ' flip' : ''}`} key={photo.id}>
              <article>
                <div className="story-media">
                  <button
                    type="button"
                    className="photo-button"
                    aria-label={`打开灯箱查看：${photo.title}`}
                    onClick={() => openLightbox(photos, photo.id)}
                  >
                    <PhotoImage photo={photo} />
                  </button>
                </div>
                <div className="story-text">
                  <div className="order-tag">
                    {series.title} · {String(photo.order).padStart(2, '0')}
                  </div>
                  <h2>{photo.title}</h2>
                  <p>{photo.caption}</p>
                </div>
              </article>
              {/* 叙事节奏：第 1、3 张之后插入点题引文 */}
              {(i === 0 || i === 2) && i < photos.length - 1 && (
                <blockquote>{series.summary}</blockquote>
              )}
            </div>
          ))}

          <p style={{ textAlign: 'center' }}>
            <Link className="btn" to="/work">
              ← 返回作品集
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
