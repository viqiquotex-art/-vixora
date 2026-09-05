import { useState } from 'react'

const features = [
  ['⚡', 'Fast to create', 'Ideas move from concept to something usable without unnecessary complexity.'],
  ['✦', 'Creative by default', 'Design, presentation, content, and digital products live in one ecosystem.'],
  ['⌘', 'Built for real use', 'Every project starts from a practical need and keeps improving through use.'],
  ['◈', 'AI ready', 'VIXORA is designed to grow with intelligent tools and automation.'],
]

const products = [
  ['N', 'NEXA Kasir', 'Point of Sale', 'Kasir digital untuk penjualan, produk, stok, keranjang, dan pembayaran.', 'Open product'],
  ['₿', 'NEXA Pembukuan', 'Business Finance', 'Pembukuan pemasukan, pengeluaran, transaksi, dan rekap keuangan.', 'Open product'],
  ['✦', 'Creative Work', 'Design & Content', 'Desain visual, presentasi, konten, dan pekerjaan kreatif untuk kebutuhan nyata.', 'View work'],
]

const services = [
  ['✦', 'Desain Visual', 'Promosi, sosial media, banner, flyer, poster, dan materi visual digital.'],
  ['▦', 'Presentasi & Dokumen', 'Presentasi profesional dan dokumen visual yang rapi, modern, dan mudah dipahami.'],
  ['⌘', 'Web & Digital', 'Website, aplikasi, landing page, dan eksperimen digital untuk personal maupun bisnis.'],
]

function TechVisual() {
  return <div className="tech-visual" aria-hidden="true">
    <div className="tech-grid" />
    <div className="tech-halo" />
    <div className="tech-orbit o1"><i/><i/><i/><i/></div>
    <div className="tech-orbit o2"><i/><i/><i/></div>
    <div className="tech-orbit o3"><i/><i/></div>
    <div className="tech-core"><b>V</b><span>VIXORA</span></div>
    <div className="tech-node n1">AI</div><div className="tech-node n2">WEB</div><div className="tech-node n3">DESIGN</div><div className="tech-node n4">CODE</div>
    <div className="tech-line l1"/><div className="tech-line l2"/><div className="tech-line l3"/>
  </div>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const go = (id) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }

  return <div className="app-shell">
    <header className="topbar"><div className="container topbar-inner">
      <button className="brand" onClick={() => go('home')}><span className="brand-mark">V</span><span>VIXORA</span></button>
      <nav className={`top-links ${menuOpen ? 'open' : ''}`}><button onClick={() => go('products')}>Products</button><button onClick={() => go('services')}>Services</button><button onClick={() => go('works')}>Projects</button><button onClick={() => go('about')}>About</button></nav>
      <div className="top-actions"><button className="github-pill" onClick={() => window.open('https://github.com/viqiquotex-art/-vixora','_blank','noopener,noreferrer')}>GitHub ↗</button><button className="menu-btn" onClick={() => setMenuOpen(v => !v)}>☰</button></div>
    </div></header>

    <main id="home">
      <section className="hero container">
        <div className="hero-copy"><div className="eyebrow">VIXORA · DIGITAL ECOSYSTEM</div><h1>The digital space<br/><span>for useful ideas.</span></h1><p className="lead">Products, creative work, services, and experiments by <b>Viqi Septiawantoro</b>. Built with curiosity. Designed to be useful.</p><div className="hero-actions"><button className="primary-btn" onClick={() => go('products')}>Explore products →</button><button className="outline-btn" onClick={() => go('services')}>See services</button></div><div className="hero-meta"><span><b>02+</b> Products</span><span><b>03</b> Services</span><span><b>∞</b> Ideas</span></div></div>
        <TechVisual />
      </section>

      <section className="feature-strip"><div className="container feature-grid">{features.map(([icon,title,text]) => <article className="feature" key={title}><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section className="section" id="products"><div className="container"><div className="section-heading"><div><span>THE ECOSYSTEM</span><h2>Products built from ideas.</h2></div><p>Digital tools made to solve practical problems and keep getting better.</p></div><div className="product-grid">{products.map(([icon,title,meta,text,cta],i) => <article className={`product-card ${i===0?'featured':''}`} key={title}><div className="product-top"><div className="product-symbol">{icon}</div><span>VIXORA / PRODUCT</span><b>↗</b></div><div className="product-body"><small>{meta}</small><h3>{title}</h3><p>{text}</p><button onClick={() => window.open('https://viqiquotex-art.github.io/pembukuan-app/','_blank','noopener,noreferrer')}>{cta} →</button></div></article>)}</div></div></section>

      <section className="section dark-section" id="services"><div className="container"><div className="section-heading"><div><span>WHAT I DO</span><h2>Services for people<br/>who need things done.</h2></div><p>From visual communication to digital products, the work stays focused on clarity and usefulness.</p></div><div className="service-grid">{services.map(([icon,title,text],i) => <article className="service-card" key={title}><div className="service-number">0{i+1}</div><div className="service-icon">{icon}</div><h3>{title}</h3><p>{text}</p><span className="service-arrow">Explore service ↗</span></article>)}</div></div></section>

      <section className="section" id="works"><div className="container"><div className="section-heading"><div><span>SELECTED WORK</span><h2>One ecosystem.<br/>Many experiments.</h2></div><p>Projects grow from simple ideas into tools, websites, and creative work.</p></div><div className="work-list">{['NEXA — Business App','VIXORA — Digital Ecosystem','Creative Design Collection','AI Experiments'].map((name,i)=><article className="work-row" key={name}><span className="work-index">0{i+1}</span><div><h3>{name}</h3><p>{['Business tools for everyday operations.','Personal digital ecosystem and portfolio.','Visual design, presentation, and content.','Exploring useful AI-powered experiences.'][i]}</p></div><span className="work-arrow">↗</span></article>)}</div></div></section>

      <section className="about-section" id="about"><div className="container about-grid"><div><span>ABOUT VIXORA</span><h2>Build it.<br/><em>Use it.</em><br/>Improve it.</h2></div><div><p>VIXORA is the digital home of <b>Mas Viqi</b> — a place where design, technology, business tools, and new ideas come together.</p><p>Not just a portfolio. Not just a service page. An ecosystem that keeps evolving.</p><button className="about-btn" onClick={() => window.location.href='mailto:hello@vixora.my.id'}>Let's build something →</button></div></div></section>

      <section className="cta-section"><div className="container cta-inner"><span>READY WHEN YOU ARE</span><h2>Have an idea?<br/><b>Let's make it useful.</b></h2><button onClick={() => window.location.href='mailto:hello@vixora.my.id'}>Start a conversation →</button></div></section>
    </main>
    <footer><div className="container footer-inner"><span>© 2026 VIXORA · Viqi Septiawantoro</span><span>Built with curiosity & code.</span></div></footer>
    <button className="ai-fab" onClick={() => setChatOpen(v => !v)} aria-label="VIXORA AI">✦</button>{chatOpen&&<div className="ai-pop"><b>VIXORA AI</b><p>Halo 👋 VIXORA AI sedang disiapkan untuk membantu kamu.</p><button onClick={() => setChatOpen(false)}>Close</button></div>}
  </div>
}
export default App
