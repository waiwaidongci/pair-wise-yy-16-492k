import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Lightbox from './components/Lightbox'
import Home from './pages/Home'
import WorkPage from './pages/WorkPage'
import SeriesPage from './pages/SeriesPage'
import About from './pages/About'
import Contact from './pages/Contact'
import ProofStation from './pages/proof/ProofStation'
import PrepressList from './pages/proof/PrepressList'

export default function App() {
  return (
    <div className="app">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/work" element={<WorkPage />} />
          <Route path="/work/:seriesId" element={<SeriesPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          {/* 纪念册打样：可交接批次工作流（校对台 + 印前清单） */}
          <Route path="/proof" element={<ProofStation />} />
          <Route path="/prepress" element={<PrepressList />} />
        </Routes>
      </main>
      <Footer />
      {/* 全局共享灯箱：任意页面通过 openLightbox() 打开同一个实例 */}
      <Lightbox />
    </div>
  )
}
