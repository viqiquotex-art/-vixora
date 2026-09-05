import { useState } from 'react'

const services = [
  ['✦', 'Desain Visual', 'Desain promosi, sosial media, banner, flyer, dan materi visual digital.', 'DESIGN'],
  ['▦', 'Presentasi & Dokumen', 'Presentasi dan dokumen visual yang rapi, modern, dan mudah dipahami.', 'PRESENTATION'],
  ['⌘', 'Web & Digital Project', 'Membangun dan mengembangkan website atau produk digital untuk kebutuhan project.', 'DIGITAL'],
]

const works = [
  ['01', 'NEXA', 'Kasir dan pembukuan digital dalam satu aplikasi untuk kebutuhan bisnis.'],
  ['02', 'Creative Work', 'Showcase desain, presentasi, konten, dan pekerjaan kreatif terbaik.'],
  ['03', 'Web & App', 'Portofolio aplikasi dan website yang dibangun atau dikembangkan.'],
  ['04', 'Coming Soon', 'Ruang untuk project baru yang akan ditambahkan berikutnya.'],
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const scrollTo = (id) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="nav-wrap">
        <nav className="nav container">
          <button className="brand" onClick={() => scrollTo('home')} aria-label="Vixora Home">
            <span className="brand-mark">V</span>
            <span>VIXORA</span>
          </button>

          <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
            <button onClick={() => scrollTo('services')}>Jasa</button>
            <button onClick={() => scrollTo('products')}>Produk</button>
            <button onClick={() => scrollTo('works')}>Karya</button>
            <button onClick={() => scrollTo('about')}>Tentang</button>
          </div>

          <button className="nav-cta" onClick={() => scrollTo('contact')}>Hubungi Saya <span>↗</span></button>
          <button className="menu-btn" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">☰</button>
        </nav>
      </header>

      <main id="home">
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow"><i /> DIGITAL CREATOR • BUILDER • DESIGNER</div>
            <h1>Membangun <span>ide</span> menjadi karya digital.</h1>
            <p>VIXORA adalah ruang digital milik Viqi Septiawantoro untuk produk, jasa, eksperimen, dan project yang dibuat dengan satu tujuan: sederhana, berguna, dan bernilai.</p>
            <div className="hero-actions">
              <button className="btn primary" onClick={() => scrollTo('products')}>Jelajahi VIXORA <span>→</span></button>
              <button className="btn ghost" onClick={() => scrollTo('about')}>Tentang saya</button>
            </div>
            <div className="hero-note"><span>●</span> Sedang membangun sesuatu yang baru</div>
          </div>

          <aside className="hero-card">
            <div className="card-glow" />
            <div className="profile-top">
              <div className="avatar">V</div>
              <div><strong>Viqi Septiawantoro</strong><small>Creator • Digital Builder</small></div>
            </div>
            <div className="hero-card-main">
              <span className="label">VIXORA / 2026</span>
              <h2>Ideas become products when you build them.</h2>
              <p>Produk digital, desain, dan project yang terus berkembang.</p>
            </div>
            <div className="mini-stats">
              <div><b>02</b><small>Products</small></div>
              <div><b>∞</b><small>Ideas</small></div>
              <div><b>24/7</b><small>Online</small></div>
            </div>
          </aside>
        </section>

        <section className="section" id="services">
          <div className="container">
            <SectionHead kicker="01 / SERVICES" title="Apa yang saya kerjakan" text="Layanan kreatif dan digital untuk membantu kebutuhan personal maupun bisnis." />
            <div className="grid-3">
              {services.map(([icon, title, text, tag]) => <article className="card" key={title}><div className="icon">{icon}</div><h3>{title}</h3><p>{text}</p><span className="tag">{tag}</span></article>)}
            </div>
          </div>
        </section>

        <section className="section products-section" id="products">
          <div className="container">
            <SectionHead kicker="02 / PRODUCTS" title="Produk yang sedang dibangun" text="Ekosistem produk digital VIXORA untuk membuat aktivitas bisnis lebih sederhana." />
            <div className="products">
              <Product icon="▣" title="NEXA Kasir" meta="POINT OF SALE" text="Solusi kasir digital untuk mencatat penjualan, produk, stok, keranjang, dan pembayaran." />
              <Product icon="▤" title="NEXA Pembukuan" meta="BUSINESS FINANCE" text="Aplikasi pembukuan untuk pemasukan, pengeluaran, riwayat transaksi, dan rekap keuangan." />
            </div>
            <div className="product-foot">NEXA Kasir dan NEXA Pembukuan dikembangkan dalam satu aplikasi: <b>Pembukuan App.</b></div>
          </div>
        </section>

        <section className="section" id="works">
          <div className="container">
            <SectionHead kicker="03 / SELECTED WORKS" title="Karya & project" text="Beberapa project yang menjadi bagian dari perjalanan digital VIXORA." />
            <div className="work-grid">
              {works.map(([no, title, text]) => <article className="card work" key={no}><div className="work-top"><span>PROJECT {no}</span><b>↗</b></div><div><h3>{title}</h3><p>{text}</p></div></article>)}
            </div>
          </div>
        </section>

        <section className="section" id="about">
          <div className="container about-grid">
            <div className="about-panel"><span className="section-kicker light">04 / ABOUT</span><h2>Mas Viqi.</h2><p>Saya membangun VIXORA sebagai rumah untuk ide dan produk digital. Dari desain visual sampai aplikasi, setiap project dimulai dari masalah sederhana lalu dicari cara yang lebih mudah untuk menyelesaikannya.</p><div className="signature">Viqi Septiawantoro</div></div>
            <div className="contact-panel" id="contact"><span className="section-kicker light">LET'S BUILD</span><h2>Punya ide atau project?</h2><p>Mari ngobrol. Bisa tentang desain, website, aplikasi, atau ide digital berikutnya.</p><a className="btn white" href="mailto:hello@vixora.my.id">Mulai ngobrol <span>→</span></a></div>
          </div>
        </section>
      </main>

      <footer><div className="container footer-inner"><span>© 2026 VIXORA — Viqi Septiawantoro</span><span>Built with curiosity & code.</span></div></footer>

      <button className={`ai-fab ${chatOpen ? 'active' : ''}`} onClick={() => setChatOpen(v => !v)} aria-label="Vixora AI">✦</button>
      {chatOpen && <div className="ai-pop"><b>VIXORA AI</b><p>Halo 👋 Saya siap jadi pintu masuk ke ekosistem VIXORA. Fitur AI sedang disiapkan.</p><button onClick={() => setChatOpen(false)}>Tutup</button></div>}
    </div>
  )
}

function SectionHead({ kicker, title, text }) {
  return <div className="section-head"><div><div className="section-kicker">{kicker}</div><h2>{title}</h2></div><p>{text}</p></div>
}

function Product({ icon, title, meta, text }) {
  return <article className="card product"><div className="product-cover"><span>{icon}</span><small>VIXORA</small></div><div className="product-body"><span className="product-meta">{meta}</span><h3>{title}</h3><p>{text}</p><a className="text-link" href="https://viqiquotex-art.github.io/pembukuan-app/">Buka project <span>↗</span></a></div></article>
}

export default App
