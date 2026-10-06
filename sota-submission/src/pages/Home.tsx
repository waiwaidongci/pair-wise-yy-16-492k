import { Link } from 'react-router-dom'
import { featuredForSeries, getCategory, photosBySeries, seriesList } from '../data/photos'
import PhotoImage from '../components/PhotoImage'
import { openLightbox } from '../components/openLightbox'

export default function Home() {
  const heroPhoto = featuredForSeries('wilderness')

  return (
    <>
      <section className="hero">
        <div className="hero-media">
          <img src={`/${heroPhoto.file}`} alt="" width={heroPhoto.width} height={heroPhoto.height} />
        </div>
        <div className="hero-content">
          <span className="eyebrow">Photographer · 独立摄影师</span>
          <h1>林晚 · Lin Wan</h1>
          <p>
            她在人的眼神与高原的雾色之间行走。镜头克制，留白充裕——
            一组黑白肖像特写，与海拔四千米之上的山脊、牧场和缓慢的日常。
          </p>
        </div>
      </section>

      <section className="page-pad">
        <div className="container">
          <div className="section-head">
            <h2>精选系列</h2>
            <hr className="gold-rule" />
          </div>

          <div className="series-grid">
            {seriesList.map(series => {
              const featured = featuredForSeries(series.id)
              const category = getCategory(series.category)
              const scope = photosBySeries(series.id)
              return (
                <div className="series-card" key={series.id}>
                  {/* 点击图片：打开全局共享灯箱（范围为该系列照片） */}
                  <button
                    type="button"
                    className="photo-button"
                    style={{ margin: 0, border: 'none' }}
                    aria-label={`打开灯箱查看：${featured.title}`}
                    onClick={() => openLightbox(scope, featured.id)}
                  >
                    <PhotoImage photo={featured} />
                    <span className="open-hint">点击查看</span>
                    <span className="series-card-overlay">
                      <h3>{series.title}</h3>
                      <span className="cat">{category?.label}</span>
                    </span>
                  </button>
                  <Link className="series-card-footer" to={`/work/${series.id}`}>
                    <span>{series.summary.slice(0, 18)}…</span>
                    <span className="enter">进入系列 →</span>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
