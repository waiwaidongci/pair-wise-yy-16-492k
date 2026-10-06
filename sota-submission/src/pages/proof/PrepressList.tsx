import { NavLink } from 'react-router-dom'
import { currentSnapshot } from '../../proof/derive'
import { downloadJson, fmtTime, photoTitle } from '../../proof/ui-helpers'
import { useProofState } from '../../proof/store'

/**
 * 印前清单：只有"确认后"的批次会出现。确认即只读锁定，
 * 印厂从这里取走当前跨页/灯箱/页数快照付印。
 */
export default function PrepressList() {
  const appState = useProofState()
  const confirmed = appState.prepressList
    .map(id => appState.batches[id])
    .filter(b => b && b.status === 'confirmed')

  return (
    <div className="container page-pad">
      <div className="section-head">
        <h2>印前清单</h2>
        <hr className="gold-rule" />
      </div>

      <div className="proof-layout">
        <aside className="proof-subnav">
          <NavLink to="/proof" end>
            批次与合并
          </NavLink>
          <NavLink to="/prepress">印前清单（{confirmed.length}）</NavLink>
        </aside>

        <div>
          <section className="proof-panel">
            <h2>已确认批次（只读锁定）</h2>
            <p className="sub">
              这里的每一项都已经过双方校对合并、冲突确认。清单只进不改；如需改版，
              请以该批次为基线新建一批。
            </p>

            {confirmed.length === 0 && (
              <div className="empty-note">
                还没有确认的批次。去
                <NavLink to="/proof" style={{ color: 'var(--gold)' }}>
                  {' '}
                  校对台{' '}
                </NavLink>
                合并校对包并确认全部冲突。
              </div>
            )}

            {confirmed.map(batch => {
              const snap = currentSnapshot(batch)!
              return (
                <div className="prepress-row locked" key={batch.id}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
                      {batch.title}
                    </div>
                    <div className="batch-meta" style={{ margin: '6px 0 0' }}>
                      <span className="device">{batch.id}</span>
                      <span>{snap.pageCount} 页 · {snap.spreads.length} 跨页 · {snap.lightbox.length} 张</span>
                      <span>确认于 {fmtTime(batch.confirmedAt!)}</span>
                    </div>
                    <details style={{ marginTop: 8 }}>
                      <summary className="eyebrow" style={{ cursor: 'pointer' }}>
                        付印照片顺序
                      </summary>
                      <ol style={{ color: 'var(--text-dim)', fontSize: '0.86rem' }}>
                        {snap.lightbox.map((id, i) => (
                          <li key={id}>
                            {i + 1}. {photoTitle(id)}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="badge confirmed">可付印</span>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() =>
                        downloadJson(`印前清单-${batch.id}.json`, {
                          batchId: batch.id,
                          title: batch.title,
                          confirmedAt: batch.confirmedAt,
                          revision: batch.revision,
                          snapshot: snap,
                        })
                      }
                    >
                      导出付印快照
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}
