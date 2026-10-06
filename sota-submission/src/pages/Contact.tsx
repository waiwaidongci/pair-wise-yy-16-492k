import { useMemo, useState } from 'react'

interface Values {
  name: string
  email: string
  message: string
}

type Errors = Partial<Record<keyof Values, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Contact() {
  const [values, setValues] = useState<Values>({ name: '', email: '', message: '' })
  // touchedFields：进入过（blur 过或尝试提交）的字段才显示行内错误
  const [touched, setTouched] = useState<Record<keyof Values, boolean>>({
    name: false,
    email: false,
    message: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const errors: Errors = useMemo(() => {
    const e: Errors = {}
    if (!values.name.trim()) e.name = '请填写你的姓名'
    if (!values.email.trim()) e.email = '请填写邮箱'
    else if (!EMAIL_RE.test(values.email.trim())) e.email = '请输入有效的邮箱地址'
    if (!values.message.trim()) e.message = '请留下你的留言内容'
    return e
  }, [values])

  const isValid = Object.keys(errors).length === 0

  const show = (field: keyof Values) => touched[field] || submitting

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setTouched({ name: true, email: true, message: true })
    if (!isValid || submitting) return
    setSubmitting(true)
    // 无后端：前端模拟提交
    await new Promise(r => setTimeout(r, 700))
    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="container page-pad">
        <div className="form-success" role="status">
          <span className="eyebrow">Message Sent</span>
          <h2 style={{ marginTop: 12 }}>谢谢你的来信</h2>
          <p>
            你的消息已经送达。林晚会在巡展转场的间隙里逐一回复——
            高原上的信号时有时无，但每一封信都会被认真读完。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container page-pad">
      <div className="section-head">
        <h2>联系</h2>
        <hr className="gold-rule" />
      </div>
      <p className="prose" style={{ marginBottom: 32 }}>
        展览合作、画册订购或一次安静的拍摄邀约，都可以从这里开始。
      </p>

      <form className="contact-form" noValidate onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">姓名</label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            value={values.name}
            aria-invalid={show('name') && !!errors.name}
            onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
            onBlur={() => setTouched(t => ({ ...t, name: true }))}
          />
          {show('name') && errors.name && <span className="error">{errors.name}</span>}
        </div>

        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            aria-invalid={show('email') && !!errors.email}
            onChange={e => setValues(v => ({ ...v, email: e.target.value }))}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
          />
          {show('email') && errors.email && <span className="error">{errors.email}</span>}
        </div>

        <div className="field">
          <label htmlFor="message">留言</label>
          <textarea
            id="message"
            name="message"
            value={values.message}
            aria-invalid={show('message') && !!errors.message}
            onChange={e => setValues(v => ({ ...v, message: e.target.value }))}
            onBlur={() => setTouched(t => ({ ...t, message: true }))}
          />
          {show('message') && errors.message && <span className="error">{errors.message}</span>}
        </div>

        <button type="submit" className="submit-btn" disabled={!isValid || submitting}>
          {submitting ? '发送中…' : '发送消息'}
        </button>
      </form>
    </div>
  )
}
