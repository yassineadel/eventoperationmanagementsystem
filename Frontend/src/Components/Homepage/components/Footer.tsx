import type { HomeStrings } from '../strings'
import { Link } from 'react-router-dom'

export default function Footer({ t }: { t: HomeStrings }) {
  return (
    <footer className="home-footer home-container">
      <p><Link to="/">{t.brand}</Link><span> — {t.footerTagline}</span></p>
      <p>© {new Date().getFullYear()} {t.brand}</p>
    </footer>
  )
}
