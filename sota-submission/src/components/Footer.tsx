import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span>© 2026 林晚 Lin Wan · 光影只在此刻为真</span>
        <span>
          <Link to="/proof">纪念册打样校对台</Link>
          {' · '}
          <Link to="/prepress">印前清单</Link>
        </span>
      </div>
    </footer>
  )
}
