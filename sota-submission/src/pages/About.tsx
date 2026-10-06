const timeline = [
  { year: '2014', text: '开始系统拍摄黑白肖像，在狭小的出租屋里用一扇北窗的光完成最初的《低垂》。' },
  { year: '2017', text: '第一次进入高原牧区，停留四十天；快门慢下来，开始理解"等待"也是一种构图。' },
  { year: '2020', text: '系列《凝视》在三个城市的小型画廊巡展，全部使用银盐手工放印。' },
  { year: '2023', text: '完成《无人之境》与《高原牧歌》，开始筹备同名巡展纪念册。' },
  { year: '2026', text: '巡展启动。纪念册在断网会场中由编辑与印厂并肩校对——就是本站记录的这件事。' },
]

export default function About() {
  return (
    <div className="container page-pad">
      <div className="section-head">
        <h2>关于</h2>
        <hr className="gold-rule" />
      </div>
      <div className="prose">
        <p>
          林晚，独立摄影师。她相信一张照片的重量来自它没有说出口的部分——
          眼睑上的一线光、雾收走的山谷边界、牛群趴下时毫不在意的雪山。
          她的作品只使用自然光，拒绝在后期里添上原本不存在的情绪。
        </p>
        <p>
          过去十二年，她在人像与高原两个题材之间往返：
          一面是镜头前坦露与防备的瞬间，一面是地貌与人缓慢共生的日常。
          三个系列——《凝视》《无人之境》《高原牧歌》——构成了这段往返的全部注脚。
        </p>
        <ul className="timeline">
          {timeline.map(t => (
            <li key={t.year}>
              <span className="year">{t.year}</span>
              <p>{t.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
