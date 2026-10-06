import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'

const links = [
  { to: '/', label: '首页', end: true },
  { to: '/work', label: '作品集' },
  { to: '/about', label: '关于' },
  { to: '/contact', label: '联系' },
  { to: '/proof', label: '纪念册打样' },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="logo" to="/" onClick={() => setOpen(false)}>
          林晚<em> · </em>Lin Wan
        </Link>
        <button
          type="button"
          className="menu"
          aria-label="打开导航菜单"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <span />
        </button>
        <nav className={`nav${open ? ' open' : ''}`} aria-label="主导航">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
