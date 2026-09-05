import { useState } from 'react'

const services = [
  ['✦', 'Desain Visual', 'Promosi, sosial media, banner, flyer, dan materi visual digital.'],
  ['▦', 'Presentasi & Dokumen', 'Presentasi dan dokumen visual yang rapi, modern, dan mudah dipahami.'],
  ['⌘', 'Web & Digital', 'Website, aplikasi, dan eksperimen digital untuk kebutuhan project.'],
]

const projects = [
  ['NEXA Kasir', 'Point of Sale', 'Kasir digital untuk penjualan, produk, stok, keranjang, dan pembayaran.'],
  ['NEXA Pembukuan', 'Business Finance', 'Pembukuan pemasukan, pengeluaran, transaksi, dan rekap keuangan.'],
  ['Creative Work', 'Design & Content', 'Kumpulan desain, presentasi, konten, dan pekerjaan kreatif.'],
]

function TechOrbit() {
  return (
    <div className="tech-orbit" aria-hidden="true">
      <div className="orbit-glow" />
      <div className="orbit-ring ring-one"><i /><i /><i /><i /></div>
      <div className="orbit-ring ring-two"><i /><i /><i /></div>
      <div className="orbit-ring ring-three"><i /><i /></div>
      <div className="core"><span>V</span><small>VIXORA</small></div>
      <div className="tech-chip chip-react">REACT</div>
      <div className="tech-chip chip-ai">AI</div>
      <div className="tech-chip chip-web">WEB</div>
      <div className="tech-chip chip-code">&lt;/&gt;</div>
      <div className="scan-line" />
      <div className="particle p1" /><div className="particle p2" /><div className="particle p3" />
    </div>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const go = (id) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <button className="brand" onClick={() => go('home')}><span className="brand-mark">V</span><span>VIXORA</span></button>
          <div className={`top-links ${menuOpen ? 'open' : ''}`}>
            <button onClick={() => go('products')}>Products</button><button onClick={() => go('services')}>Services</button><button onClick={() => go('works')}>Projects</button><button onClick={() => go('about')}>About</button>
          </div>
          <div className="top-actions"><button className="github-pill" onClick={() => window.open('https://github.com/viqiquotex-art/-vixora', '_blank', 'noopener,noreferrer')}>GitHub ↗</button><button className="menu-btn" onClick={() => setMenuOpen(v => !v)} aria-expanded={menuOpen}>☰</button></div>
        </div>
      </header>

      <main id="home">
        <section className="repo-hero container">
          <div className="hero-copy">
            <div className="repo-badge">VIXORA / DIGITAL ECOSYSTEM</div>
            <h1>Build. Create.<br /><span>Make it useful.</span></h1>
            <p className="lead">VIXORA is a digital space by <b>Viqi Septiawantoro</b> — a home for products, creative work, experiments, and tools built from real ideas.</p>
            <div className="hero-actions"><button className="primary-btn" onClick={() => go('products')}>Explore VIXORA <span>→</span></button><button className="outline-btn" onClick={() => go('about')}>About the creator</button></div>
            <div className="quick-stats"><div><b>02</b><span>Products</span></div><div><b>03</b><span>Services</span></div><div><b>∞</b><span>Ideas</span></div><div><b>2026</b><span>Active</span></div></div>
          </div>
          <TechOrbit />
        </section>

        <section className="repo-tabs"><div className="container tabs-inner"><button className="active" onClick={() => go('products')}>Overview</button><button onClick={() => go('services')}>Services</button><button onClick={() => go('works')}>Projects</button><button onClick={() => go('about')}>About</button></div></section>

        <section className="section" id="products"><div className="container"><div className="section-title"><div><span>FEATURED</span><h2>Products</h2></div><p>Digital tools being built inside the VIXORA ecosystem.</p></div><div className="project-grid">{projects.map(([title, meta, text], i) => <article className={`project-card ${i === 0 ? 'featured' : ''}`} key={title}><div className="project-cover"><span>{i === 0 ? 'N' : i === 1 ? '₿' : '✦'}</span><small>VIXORA PROJECT</small></div><div className="project-body"><span className="meta">{meta}</span><h3>{title}</h3><p>{text}</p><a href="https://viqiquotex-art.github.io/pembukuan-app/" target="_blank" rel="noopener noreferrer">Open project ↗</a></div></article>)}</div></div></section>

        <section className="section muted" id="services"><div className="container"><div className="section-title"><div><span>WHAT I DO</span><h2>Services</h2></div><p>Simple digital solutions for personal and business needs.</p></div><div className="service-grid">{services.map(([icon, title, text]) => <article className="service-card" key={title}><div className="service-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

        <section className="section" id="works"><div className="container"><div className="section-title"><div><span>SELECTED WORK</span><h2>Projects & experiments</h2></div><p>A growing collection of things designed, built, and tested.</p></div><div className="repo-list">{['NEXA — Business App', 'VIXORA Website', 'Creative Design Collection'].map((name, i) => <div className="repo-row" key={name}><div className="repo-icon">{i === 0 ? 'N' : i === 1 ? 'V' : '✦'}</div><div className="repo-info"><button onClick={() => go('products')}>{name}</button><p>{i === 0 ? 'Digital business tools for everyday operations.' : i === 1 ? 'Personal digital ecosystem and portfolio.' : 'Visual design, presentation, and content work.'}</p><small>Public · Updated 2026</small></div><span className="repo-arrow">↗</span></div>)}</div></div></section>

        <section className="about-section" id="about"><div className="container about-grid"><div><span>ABOUT VIXORA</span><h2>Made by<br />Mas Viqi.</h2></div><div><p>VIXORA started as a place to collect ideas and became an ecosystem for digital products, design, websites, and experiments.</p><p>The principle is simple: <b>build something useful, keep improving it, and make it accessible.</b></p><a className="contact-link" href="mailto:hello@vixora.my.id">Get in touch →</a></div></div></section>
      </main>

      <footer><div className="container footer-inner"><span>© 2026 VIXORA · Viqi Septiawantoro</span><span>Built with curiosity & code.</span></div></footer>
      <button className="ai-fab" onClick={() => setChatOpen(v => !v)} aria-label="VIXORA AI">✦</button>
      {chatOpen && <div className="ai-pop"><b>VIXORA AI</b><p>Halo 👋 Fitur AI VIXORA sedang disiapkan.</p><button onClick={() => setChatOpen(false)}>Close</button></div>}
    </div>
  )
}

export default App
