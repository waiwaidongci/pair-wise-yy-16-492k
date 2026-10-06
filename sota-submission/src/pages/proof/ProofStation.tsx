import { useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { allPhotos, getPhoto } from '../../data/photos'
import {
  confirm,
  createNewBatch,
  discardFailedImport,
  importPackage,
  importTwoPackages,
  recoverFailedImport,
  resolveConflict,
  useProofState,
} from '../../proof/store'
import { currentSnapshot } from '../../proof/derive'
import { canConfirm } from '../../proof/merge'
import type { Batch } from '../../proof/types'
import {
  DEMO_BATCH_ID,
  sampleBrokenPackageJson,
  sampleEditorPackage,
  samplePrinterPackage,
} from '../../proof/samples'
import {
  describeOp,
  downloadJson,
  fmtTime,
  opValueText,
  photoTitle,
  readFileText,
} from '../../proof/ui-helpers'

export default function ProofStation() {
  const appState = useProofState()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [newId, setNewId] = useState('')

  const batchIds = Object.keys(appState.batches).sort((a, b) =>
    appState.batches[b].createdAt.localeCompare(appState.batches[a].createdAt),
  )
  const selectedBatch = selectedId ? appState.batches[selectedId] : undefined

  function flash(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  function seedDemoBatch() {
    if (!appState.batches[DEMO_BATCH_ID]) {
      createNewBatch(DEMO_BATCH_ID, '巡展纪念册《海拔四千米的留白》')
    }
    setSelectedId(DEMO_BATCH_ID)
  }

  function handleCreate() {
    const id = newId.trim() || `batch-${Date.now().toString(36)}`
    if (appState.batches[id]) {
      flash('该批次编号已存在')
      return
    }
    createNewBatch(id, `巡展纪念册 · 批次 ${id}`)
    setSelectedId(id)
    setNewId('')
  }

  return (
    <div className="container page-pad">
      <div className="section-head">
        <h2>纪念册打样 · 校对台</h2>
        <hr className="gold-rule" />
      </div>

      <div className="proof-layout">
        <aside className="proof-subnav">
          <NavLink to="/proof" end>
            批次与合并
          </NavLink>
          <NavLink to="/prepress">印前清单（{appState.prepressList.length}）</NavLink>
        </aside>

        <div>
          {/* 批次建立 / 演示数据 */}
          <section className="proof-panel">
            <h2>打样批次</h2>
            <p className="sub">
              批次是编辑与印厂共同的交接单位：两台设备的校对包按批次编号合并；照片去留或片序一变，
              跨页、灯箱结果与页数自动失效重算，旧排法归档只读；全部冲突确认后批次才进入印前清单。
            </p>

            {batchIds.length === 0 && (
              <div className="empty-note">还没有批次。可以建立一个，或直接载入巡演示例批次：</div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn primary" onClick={seedDemoBatch}>
                载入巡演示例批次（{DEMO_BATCH_ID}）
              </button>
              <input
                value={newId}
                onChange={e => setNewId(e.target.value)}
                placeholder="批次编号（可留空自动生成）"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(184,173,158,.25)',
                  color: 'var(--text)',
                  padding: '9px 12px',
                  minWidth: 220,
                }}
              />
              <button type="button" className="btn" onClick={handleCreate}>
                新建空批次
              </button>
            </div>

            {batchIds.length > 0 && (
              <table className="change-table" style={{ marginTop: 18 }}>
                <thead>
                  <tr>
                    <th>批次编号</th>
                    <th>名称</th>
                    <th>状态</th>
                    <th>未决冲突</th>
                    <th>页数</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {batchIds.map(id => {
                    const b = appState.batches[id]
                    const snap = currentSnapshot(b)
                    const pending = b.conflicts.filter(c => !c.resolution).length
                    return (
                      <tr key={id}>
                        <td className="device">{id}</td>
                        <td>{b.title}</td>
                        <td>
                          <span className={`badge ${b.status}`}>
                            {b.status === 'confirmed' ? '已确认 · 只读' : `草稿 r${b.revision}`}
                          </span>
                        </td>
                        <td>{pending > 0 ? <span className="badge stale">{pending} 待确认</span> : '—'}</td>
                        <td>{snap?.pageCount ?? '—'}</td>
                        <td>
                          <button type="button" className="btn small" onClick={() => setSelectedId(id)}>
                            打开
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>

          {selectedBatch && (
            <BatchWorkbench
              key={selectedBatch.id}
              batch={selectedBatch}
              flash={flash}
            />
          )}

          <RecoveryPanel flash={flash} />
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

/* ---------------- 批次工作台 ---------------- */

function BatchWorkbench({ batch, flash }: { batch: Batch; flash: (m: string) => void }) {
  const appState = useProofState()
  const live = appState.batches[batch.id] ?? batch
  const pending = live.conflicts.filter(c => !c.resolution)
  const locked = live.status === 'confirmed'

  return (
    <>
      <section className="proof-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2>
            {live.title}{' '}
            <span className={`badge ${live.status}`} style={{ verticalAlign: 'middle' }}>
              {locked ? '已确认 · 只读锁定' : `草稿 · r${live.revision}`}
            </span>
          </h2>
          {!locked && (
            <button
              type="button"
              className="btn primary"
              disabled={!canConfirm(live)}
              onClick={() => {
                if (confirm(live.id)) flash('批次已确认，进入印前清单')
              }}
            >
              确认批次 · 进入印前清单
            </button>
          )}
        </div>
        <div className="batch-meta">
          <span>批次编号：{live.id}</span>
          <span>建立：{fmtTime(live.createdAt)}</span>
          <span>在册照片：{live.sequence.length} / {allPhotos().length}</span>
          <span>未决冲突：{pending.length}</span>
        </div>
        {!canConfirm(live) && !locked && (
          <p className="sub" style={{ color: 'var(--danger)' }}>
            仍有 {pending.length} 处双方改动保留了两份，全部确认后批次才能进入印前清单。
          </p>
        )}
      </section>

      {!locked && <ImportPanel batch={live} flash={flash} />}

      <ConflictsPanel batch={live} flash={flash} />

      <DerivedPanel batch={live} />

      <ChangesPanel batch={live} />
    </>
  )
}

/* ---------------- 导入与双机合并 ---------------- */

function ImportPanel({ batch, flash }: { batch: Batch; flash: (m: string) => void }) {
  const singleRef = useRef<HTMLInputElement>(null)
  const pairRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const [pairFiles, setPairFiles] = useState<(File | null)[]>([null, null])
  const [error, setError] = useState<string | null>(null)

  async function importSingle(file: File) {
    setError(null)
    const text = await readFileText(file)
    const out = importPackage(text)
    if (out.ok) flash(`校对包已按原批次（${out.batchId}）并入`)
    else {
      setError(`导入失败，校对包已保留到恢复区：${out.reasons.join('；')}`)
      flash('导入失败：可在下方恢复区按原批次继续')
    }
  }

  async function mergePair() {
    setError(null)
    if (!pairFiles[0] || !pairFiles[1]) {
      setError('请为两台设备各选择一个校对包文件')
      return
    }
    const [t1, t2] = await Promise.all(pairFiles.map(f => readFileText(f!)))
    const out = importTwoPackages(t1, t2)
    if (out.ok === false && !out.batchId) {
      setError(`两个包都无法合并，已保留到恢复区：${out.reasons.join('；')}`)
      return
    }
    if (out.pendingConflicts && out.pendingConflicts > 0) {
      flash(`合并完成：${out.pendingConflicts} 处双方改动待确认；未撞车内容已直接并入`)
    } else {
      flash('两台设备校对包已合并到同一批次，无冲突')
    }
    if (out.reasons.length) setError(`其中一包存在问题并已进入恢复区：${out.reasons.join('；')}`)
    setPairFiles([null, null])
    if (pairRefs[0].current) pairRefs[0].current.value = ''
    if (pairRefs[1].current) pairRefs[1].current.value = ''
  }

  return (
    <section className="proof-panel">
      <h2>网络恢复 · 合并校对包</h2>
      <p className="sub">
        先在两台设备上用下方按钮各导出一份示例校对包（断网）；联网后在此选择两个文件合并：
        没撞上的改动直接并入，同一张照片的去留、片序或说明两边都改过时保留两份等待确认。
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button type="button" className="btn small" onClick={() => downloadJson('校对包-编辑机.json', sampleEditorPackage)}>
          导出编辑机校对包
        </button>
        <button type="button" className="btn small" onClick={() => downloadJson('校对包-印厂机.json', samplePrinterPackage)}>
          导出印厂机校对包
        </button>
        <button
          type="button"
          className="btn small danger"
          onClick={() => downloadJson('校对包-损坏示例.json', JSON.parse(sampleBrokenPackageJson))}
        >
          导出损坏校对包（演练恢复）
        </button>
      </div>

      <div className="import-drop">
        <strong>双机成对合并（推荐）</strong>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
          <input
            ref={pairRefs[0]}
            type="file"
            accept="application/json,.json"
            onChange={e => setPairFiles(f => [e.target.files?.[0] ?? null, f[1]])}
          />
          <input
            ref={pairRefs[1]}
            type="file"
            accept="application/json,.json"
            onChange={e => setPairFiles(f => [f[0], e.target.files?.[0] ?? null])}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn primary" onClick={mergePair}>
            合并到批次 {batch.id}
          </button>
        </div>
      </div>

      <div className="import-drop" style={{ marginTop: 12 }}>
        <strong>只有一台先恢复？逐台并入（按包内批次编号自动归并）</strong>
        <div style={{ marginTop: 10 }}>
          <input
            ref={singleRef}
            type="file"
            accept="application/json,.json"
            onChange={async e => {
              const f = e.target.files?.[0]
              if (f) await importSingle(f)
              if (singleRef.current) singleRef.current.value = ''
            }}
          />
        </div>
      </div>

      {error && <div className="import-error">{error}</div>}
    </section>
  )
}

/* ---------------- 冲突确认 ---------------- */

function ConflictsPanel({ batch, flash }: { batch: Batch; flash: (m: string) => void }) {
  if (batch.conflicts.length === 0) return null
  return (
    <section className="proof-panel">
      <h2>双方改动 · 保留两份待确认</h2>
      <p className="sub">同一张照片的同一字段两边都改过。旧排法不受影响，直到你选定一方后才重算。</p>
      {batch.conflicts.map(c => {
        const photo = safePhoto(c.photoId)
        const resolved = c.resolution !== null
        return (
          <div className="conflict-card" key={c.id} style={resolved ? { opacity: 0.7 } : undefined}>
            <h3>
              《{photo?.title ?? c.photoId}》的
              {c.field === 'inclusion' ? '去留' : c.field === 'order' ? '片序' : c.field === 'caption' ? '说明' : '标题'}
              {resolved && ' · 已确认（只读）'}
            </h3>
            <div className="conflict-choices">
              {(['a', 'b'] as const).map(side => {
                const s = side === 'a' ? c.a : c.b
                return (
                  <div key={side} className={`conflict-choice${c.resolution === side ? ' picked' : ''}`}>
                    <span className="who">{s.deviceLabel ?? s.deviceId}</span>
                    <div>{describeOp(s.op)}</div>
                    <div className="val-new" style={{ marginTop: 6 }}>
                      {opValueText(s.op)}
                    </div>
                    {!resolved && (
                      <div style={{ marginTop: 10 }}>
                        <ResolveButton batchId={batch.id} conflictId={c.id} pick={side} flash={flash} />
                      </div>
                    )}
                    {c.resolution === side && <div className="badge" style={{ marginTop: 8 }}>已采用</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function ResolveButton({
  batchId,
  conflictId,
  pick,
  flash,
}: {
  batchId: string
  conflictId: string
  pick: 'a' | 'b'
  flash: (m: string) => void
}) {
  return (
    <button
      type="button"
      className="btn small primary"
      onClick={() => {
        resolveConflict(batchId, conflictId, pick)
        flash(pick === 'a' ? '已采用第一份（a）并失效重算' : '已采用第二份（b）并失效重算')
      }}
    >
      采用这份
    </button>
  )
}

/* ---------------- 派生结果（跨页/灯箱/页数，旧记录只读） ---------------- */

function DerivedPanel({ batch }: { batch: Batch }) {
  const snap = currentSnapshot(batch)
  if (!snap) return null
  const archived = batch.snapshots.filter(s => s.status === 'archived')
  return (
    <section className="proof-panel derived-panel">
      <h2>当前排法 · 跨页 / 灯箱 / 页数</h2>
      <p className="sub">
        以下结果全部由"在册照片有序序列"自动派生。照片去留或片序每变一次，它们就整体失效重算一次。
      </p>
      <div className="derived-grid">
        <div className="derived-tile">
          <div className="num">{snap.pageCount}</div>
          <div className="lbl">总页数（含封面，偶数对页）</div>
        </div>
        <div className="derived-tile">
          <div className="num">{snap.spreads.length}</div>
          <div className="lbl">已排跨页</div>
        </div>
        <div className="derived-tile">
          <div className="num">{snap.lightbox.length}</div>
          <div className="lbl">灯箱结果（在册照片数）</div>
        </div>
      </div>

      <div className="eyebrow" style={{ marginBottom: 8 }}>
        跨页排布（版本 r{snap.version}）· {snap.reason}
      </div>
      <ul className="spread-list">
        {snap.spreads.map(sp => (
          <li key={sp.spreadNo}>
            <div className="pages">
              P{2 + (sp.spreadNo - 1) * 2}–P{1 + sp.spreadNo * 2}
              {sp.solo ? '（单张跨页）' : ''}
            </div>
            <div>左：{photoTitle(sp.left!)}</div>
            {sp.right && <div>右：{photoTitle(sp.right)}</div>}
          </li>
        ))}
      </ul>

      {snap.excluded.length > 0 && (
        <p className="sub" style={{ marginTop: 12 }}>
          已撤出：{snap.excluded.map(id => photoTitle(id)).join('、')}
        </p>
      )}

      {archived.length > 0 && (
        <details style={{ marginTop: 18 }}>
          <summary className="eyebrow" style={{ cursor: 'pointer' }}>
            旧排法归档（{archived.length} 份，只读，不参与印前）
          </summary>
          <ul className="snapshot-list readonly" aria-readonly>
            {archived.map(s => (
              <li key={`${s.version}-${s.computedAt}`}>
                <strong>r{s.version}</strong> · {s.pageCount} 页 · {s.spreads.length} 跨页 ·
                灯箱 {s.lightbox.length} 张 · {fmtTime(s.computedAt)}
                <div style={{ marginTop: 4 }}>{s.reason}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

/* ---------------- 批次明细 + 历史 ---------------- */

function ChangesPanel({ batch }: { batch: Batch }) {
  const excludedIds = useMemo(
    () => Object.keys(batch.captions).filter(id => !batch.sequence.includes(id)),
    [batch],
  )
  return (
    <section className="proof-panel changes-panel">
      <h2>批次明细与操作记录</h2>
      <div className="eyebrow" style={{ margin: '12px 0 6px' }}>在册片序（{batch.sequence.length}）</div>
      <ol className="spread-list" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {batch.sequence.map((id, i) => (
          <li key={id}>
            <div className="pages">{i + 1}</div>
            <div>{photoTitle(id)}</div>
          </li>
        ))}
      </ol>
      {excludedIds.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>已撤出（文案保留，可重新纳入）</div>
          <div className="sub">{excludedIds.map(id => photoTitle(id)).join('、')}</div>
        </>
      )}
      <div className="eyebrow" style={{ margin: '18px 0 6px' }}>操作历史（只追加）</div>
      <ul className="history-log">
        {[...batch.history].reverse().map((h, i) => (
          <li key={`${h.at}-${i}`}>
            <time>{fmtTime(h.at)}</time>
            <span>{h.message}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------------- 导入失败恢复区 ---------------- */

function RecoveryPanel({ flash }: { flash: (m: string) => void }) {
  const appState = useProofState()
  const [editing, setEditing] = useState<Record<string, string>>({})
  if (appState.failedImports.length === 0) return null

  return (
    <section className="proof-panel recovery-panel" style={{ borderColor: 'rgba(212,130,111,.5)' }}>
      <h2>导入恢复区（{appState.failedImports.length}）</h2>
      <p className="sub">
        这些校对包导入失败，现场未被改动。可以直接重试（按包内批次编号回到原批次继续），
        或在文本框中修复后重试；放弃则从恢复区移除。
      </p>
      {appState.failedImports.map(f => (
        <div className="conflict-card" key={f.id}>
          <h3>
            {f.pkg ? f.pkg.deviceLabel ?? f.pkg.deviceId : '无法解析的文件'} → 目标批次：
            {f.targetBatchId ?? '未知'}
          </h3>
          <div className="sub" style={{ color: 'var(--danger)' }}>
            失败原因：{f.reasons.join('；')}（已尝试恢复 {f.attempts} 次，接收于 {fmtTime(f.receivedAt)}）
          </div>
          <textarea
            value={editing[f.id] ?? (typeof f.raw === 'string' ? f.raw : JSON.stringify(f.raw, null, 2))}
            onChange={e => setEditing(v => ({ ...v, [f.id]: e.target.value }))}
            rows={8}
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: '1px solid rgba(184,173,158,.25)',
              color: 'var(--text-dim)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.78rem',
              padding: 10,
            }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn primary small"
              onClick={() => {
                const out = recoverFailedImport(f.id, editing[f.id])
                if (out.ok) flash(`已恢复并按原批次 ${out.batchId} 继续合并`)
                else flash(`仍然失败：${out.reasons.join('；')}`)
              }}
            >
              用以上内容按原批次重试
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                recoverFailedImport(f.id)
                flash('已按保留的原始内容重试（若仍失败会继续留在恢复区）')
              }}
            >
              直接重试原始包
            </button>
            <button type="button" className="btn small danger" onClick={() => discardFailedImport(f.id)}>
              放弃并移除
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}

function safePhoto(id: string) {
  try {
    return getPhoto(id)
  } catch {
    return undefined
  }
}
