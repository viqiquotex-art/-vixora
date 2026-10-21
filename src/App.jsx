import { useEffect, useRef, useState } from 'react'
import './agency.css'
import { supabase } from './lib/supabase'

async function getCommandHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const agents = [
  { icon: '✦', code: 'AGENT 01', title: 'Content Agent', text: 'Menyusun ide, script, caption, Shorts, dan paket konten siap dieksekusi.' },
  { icon: '◈', code: 'AGENT 02', title: 'YouTube Agent', text: 'Menyiapkan workflow YouTube dari ide sampai proses publish melalui executor.' },
  { icon: '⌘', code: 'AGENT 03', title: 'Research Agent', text: 'Mencari, merangkum, membandingkan, dan mengubah informasi menjadi bahan kerja.' },
  { icon: '◇', code: 'AGENT 04', title: 'Creative Agent', text: 'Membantu konsep visual, prompt, branding, desain, dan creative direction.' },
  { icon: '⚙', code: 'AGENT 05', title: 'Automation Agent', text: 'Menghubungkan tugas dan layanan menjadi alur kerja otomatis yang bisa dieksekusi.' },
  { icon: 'V', code: 'CORE', title: 'VIXORA Orchestrator', text: 'Otak utama yang menerima instruksi dan meneruskannya ke agent yang paling tepat.' },
]

function VixoraSplashMark({ small = false }) {
  return <svg className={small ? 'vixora-splash-mark small' : 'vixora-splash-mark'} viewBox="0 0 64 64" role="img" aria-label="VIXORA paint splash logo">
    <path d="M9 8 C4 3 0 8 4 14 L22 48 Q26 55 31 48 L39 33 L29 14 Q26 8 21 13 L18 17 Z" fill="#ed1c24"/>
    <path d="M27 5 C24 -1 18 4 22 10 L37 42 Q41 51 46 43 L57 22 Q61 15 55 13 Q51 12 48 19 L42 29 L33 9 Q31 4 27 5Z" fill="#ffcc00"/>
    <path d="M40 11 C39 5 46 2 49 8 L60 25 Q63 30 58 34 L47 49 Q43 55 39 49 L34 40 L41 27 L47 20Z" fill="#111111"/>
    <circle cx="7" cy="27" r="3" fill="#ed1c24"/><circle cx="16" cy="5" r="2.5" fill="#ed1c24"/><circle cx="57" cy="6" r="2.5" fill="#111"/><circle cx="59" cy="43" r="3" fill="#ffcc00"/><circle cx="25" cy="59" r="2.5" fill="#ffcc00"/>
  </svg>
}

function AuthPage({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const switchMode = (next) => {
    setMode(next)
    setMessage('')
    window.location.hash = next
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin + '#login' },
        })
        if (error) throw error
        setMessage('Akun berhasil dibuat. Cek email untuk verifikasi, lalu login ke VIXORA.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.hash = 'workspace'
      }
    } catch (error) {
      setMessage(error.message || 'Authentication gagal. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  const forgotPassword = async () => {
    if (!email) {
      setMessage('Masukkan email terlebih dahulu untuk reset password.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '#login' })
      if (error) throw error
      setMessage('Link reset password sudah dikirim jika email tersebut terdaftar.')
    } catch (error) {
      setMessage(error.message || 'Gagal mengirim reset password.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-shell">
    <div className="auth-noise" />
    <a className="auth-back" href="#top">← Back to VIXORA</a>
    <div className="auth-card">
      <a className="agency-logo auth-logo" href="#top"><VixoraSplashMark small /><span className="brand-wordmark">VIXORA <small>CREATIVE + AI</small></span></a>
      <div className="agency-kicker auth-kicker">AI AGENCY · ACCESS PORTAL</div>
      <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
      <p className="auth-subtitle">{mode === 'login' ? 'Masuk untuk mengakses VIXORA AI Command Center dan agent kamu.' : 'Buat akun untuk mulai menggunakan ekosistem AI agency VIXORA.'}</p>
      <div className="auth-tabs">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Login</button>
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Register</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' && <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required /></label>}
        <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="6" required /></label>
        {mode === 'login' && <button type="button" className="auth-forgot" onClick={forgotPassword}>Forgot password?</button>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Processing…' : mode === 'login' ? 'Login to VIXORA ↗' : 'Create VIXORA account ↗'}</button>
      </form>
      {message && <div className="auth-message">{message}</div>}
      <div className="auth-divider"><span>VIXORA CORE</span></div>
      <div className="auth-secure"><i /> Secure access portal · Multi-agent workspace</div>
    </div>
  </div>
}

function WorkspacePage({ session }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [voiceState, setVoiceState] = useState('idle')
  const [voiceSupported, setVoiceSupported] = useState(true)
  const [speechSupported, setSpeechSupported] = useState(true)
  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')
  const voiceCommandRef = useRef(false)
  const [commandStatus, setCommandStatus] = useState('idle')
  const [commandResult, setCommandResult] = useState('')

  useEffect(() => {
    setSpeechSupported('speechSynthesis' in window)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceSupported(false)
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'id-ID'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onstart = () => {
      finalTranscriptRef.current = ''
      voiceCommandRef.current = true
      setVoiceState('listening')
    }
    recognition.onresult = (event) => {
      let interim = ''
      let finalText = finalTranscriptRef.current
      let finished = false
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const spoken = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += `${spoken} `
          finished = true
        } else interim += spoken
      }
      finalTranscriptRef.current = finalText
      const nextCommand = `${finalText}${interim}`.trim()
      setCommand(nextCommand)
      if (finished) setTimeout(() => sendCommand(finalText.trim()), 250)
    }
    recognition.onerror = () => {
      voiceCommandRef.current = false
      setVoiceState('error')
    }
    recognition.onend = () => setVoiceState('idle')
    recognitionRef.current = recognition
    return () => recognition.abort()
  }, [])

  const speakResponse = (text) => {
    if (!speechSupported || !text) return false
    const synth = window.speechSynthesis
    synth.cancel()
    const voices = synth.getVoices()
    const preferred = voices.find((voice) => /^id(-|_)/i.test(voice.lang)) || voices.find((voice) => /indonesia|indonesian/i.test(voice.name))
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = preferred?.lang || 'id-ID'
    if (preferred) utterance.voice = preferred
    utterance.rate = 0.96
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onstart = () => setVoiceState('speaking')
    utterance.onend = () => {
      voiceCommandRef.current = false
      setVoiceState('idle')
    }
    utterance.onerror = () => {
      voiceCommandRef.current = false
      setVoiceState('error')
    }
    synth.speak(utterance)
    return true
  }

  const toggleVoice = () => {
    if (!voiceSupported) return
    if (voiceState === 'listening') {
      recognitionRef.current?.stop()
      return
    }
    try {
      recognitionRef.current?.start()
    } catch {
      setVoiceState('error')
    }
  }

  const sendCommand = async (commandOverride = '') => {
    const value = (commandOverride || command).trim()
    if (!value || commandStatus === 'working') return
    setCommandStatus('working')
    setCommandResult('Mengirim instruksi ke VIXORA Core…')
    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: await getCommandHeaders(),
        body: JSON.stringify({ command: value, source: 'vixora-workspace' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Command failed')
      const message = data.message || 'Instruksi diterima VIXORA Core.'
      setCommandStatus('success')
      setCommandResult(message)
      if (voiceCommandRef.current || finalTranscriptRef.current) {
        setVoiceState('thinking')
        window.setTimeout(() => speakResponse(message), 80)
      }
    } catch (error) {
      setCommandStatus('error')
      setCommandResult(error.message || 'VIXORA Core belum dapat dihubungi.')
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.hash = 'login'
  }

  const email = session?.user?.email || 'VIXORA user'
  const name = session?.user?.user_metadata?.full_name || email.split('@')[0]

  return <div className="workspace-shell">
    <header className="workspace-nav">
      <a className="agency-logo" href="#workspace"><VixoraSplashMark small /><span className="brand-wordmark">VIXORA <small>CREATIVE + AI</small></span></a>
      <div className="workspace-user"><span>{name}</span><button onClick={signOut}>Logout ↗</button></div>
    </header>
    <main className="workspace-main">
      <section className="workspace-welcome">
        <div className="agency-kicker">VIXORA CORE · PRIVATE WORKSPACE</div>
        <h1>Welcome, <em>{name}</em>.</h1>
        <p>Satu ruang kerja untuk mengendalikan agent, workflow, dan executor VIXORA.</p>
        <div className="workspace-status"><i /> Core online <span>·</span> {email}</div>
      </section>
      <section className="workspace-grid">
        {agents.map((agent) => <article className="workspace-agent" key={agent.title}>
          <div className="workspace-agent-icon">{agent.icon}</div>
          <div><span>{agent.code}</span><h3>{agent.title}</h3><p>{agent.text}</p></div>
        </article>)}
      </section>
      <section className="workspace-command">
        <div className="command-head"><div><b>VIXORA VOICE COMMAND CENTER</b><span>VOICE + TEXT · CORE ONLINE · EXECUTION READY</span></div><span className="online"><i /> READY</span></div>
        <div className="workspace-command-body">
          <div className="workspace-voice-row">
            <button type="button" className={`voice-orb ${voiceState}`} onClick={toggleVoice} disabled={!voiceSupported} aria-label="Voice command"><span>◉</span></button>
            <div className="voice-copy"><b>{voiceState === 'listening' ? 'Listening…' : voiceState === 'error' ? 'Voice unavailable' : 'Speak to VIXORA'}</b><small>{voiceSupported && speechSupported ? 'Bahasa Indonesia · bicara lalu VIXORA menjawab suara' : 'Voice belum didukung penuh di browser ini'}</small></div>
            <span className="voice-wave" aria-hidden="true"><i/><i/><i/><i/><i/></span>
          </div>
          <textarea value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendCommand() }} placeholder="Atau ketik: Siapkan 3 Shorts untuk YouTube besok…" rows="5" />
          <button className="command-send" onClick={sendCommand} disabled={commandStatus === 'working'}>{commandStatus === 'working' ? 'Processing…' : 'Send command ↗'}</button>
          {commandResult && <div className={`command-result ${commandStatus}`}>{commandResult}</div>}
        </div>
      </section>
    </main>
  </div>
}

function App() {
  const [chatOpen, setChatOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [commandStatus, setCommandStatus] = useState('idle')
  const [commandResult, setCommandResult] = useState('')
  const [authMode, setAuthMode] = useState(null)
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [route, setRoute] = useState('top')

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = window.location.hash.replace('#', '').toLowerCase() || 'top'
      setRoute(nextRoute)
      setAuthMode(nextRoute === 'login' || nextRoute === 'register' ? nextRoute : null)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    syncRoute()
    window.addEventListener('hashchange', syncRoute)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setSessionLoading(false)
    })
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      listener.subscription.unsubscribe()
    }
  }, [])

  if (sessionLoading) return <div className="auth-shell"><div className="auth-card"><div className="agency-logo auth-logo"><VixoraSplashMark small /><span className="brand-wordmark">VIXORA <small>CREATIVE + AI</small></span></div><div className="auth-message">Connecting to VIXORA Core…</div></div></div>
  if (route === 'workspace') {
    if (!session) {
      window.location.hash = 'login'
      return null
    }
    return <WorkspacePage session={session} />
  }


  const sendCommand = async () => {
    const value = command.trim()
    if (!value || commandStatus === 'working') return
    if (!session) {
      setCommandStatus('error')
      setCommandResult('Login dulu untuk menjalankan perintah di VIXORA.')
      window.location.hash = 'login'
      return
    }
    setCommandStatus('working')
    setCommandResult('Mengirim instruksi ke VIXORA Core…')
    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: await getCommandHeaders(),
        body: JSON.stringify({ command: value, source: 'vixora-command-center' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Command failed')
      setCommandStatus('success')
      setCommandResult(data.message || 'Instruksi diterima VIXORA Core.')
    } catch (error) {
      setCommandStatus('error')
      setCommandResult(error.message || 'VIXORA Core belum dapat dihubungi.')
    }
  }

  const openCommand = () => {
    setChatOpen(true)
    setTimeout(() => document.getElementById('agency-command-input')?.focus(), 50)
  }

  if (authMode) return <AuthPage initialMode={authMode} />

  return (
    <div className="vixora-home" id="top">
      <header className="vh-nav">
        <a className="vh-brand" href="#top" aria-label="VIXORA Creative beranda"><VixoraSplashMark /><span>VIXORA<small>CREATIVE</small></span></a>
        <nav className="vh-links"><a href="#top">Beranda</a><a href="#layanan">Layanan</a><a href="#portfolio">Portofolio</a><a href="#harga">Harga</a><a href="#faq">FAQ</a></nav>
        <a className="vh-nav-cta" href="https://wa.me/6285866073007?text=Halo%20VIXORA%20Creative%2C%20saya%20ingin%20konsultasi%20desain." target="_blank" rel="noreferrer">◉ Pesan via WhatsApp</a>
      </header>
      <main>
        <section className="vh-hero">
          <div className="vh-paint vh-paint-red"/><div className="vh-paint vh-paint-yellow"/><div className="vh-paint vh-paint-black"/>
          <div className="vh-hero-copy">
            <span className="vh-kicker">JASA DESAIN GRAFIS</span>
            <h1>IDE KAMU,<br/>KAMI <em>DESAIN.</em></h1>
            <p>Bantu wujudkan visual yang menarik untuk bisnis, acara, dan kebutuhan pribadi kamu.</p>
            <div className="vh-benefits"><span><b className="red">ϟ</b> Proses<br/>Cepat</span><span><b className="yellow">★</b> Hasil<br/>Profesional</span><span><b className="black">♡</b> Revisi<br/>Fleksibel</span></div>
            <div className="vh-actions"><a className="vh-btn primary" href="https://wa.me/6285866073007?text=Halo%20VIXORA%20Creative%2C%20saya%20ingin%20pesan%20desain." target="_blank" rel="noreferrer">◉ Pesan Sekarang <span>→</span></a><a className="vh-btn secondary" href="#portfolio">Lihat Portofolio</a></div>
          </div>
          <div className="vh-hero-art" aria-label="Contoh karya desain VIXORA">
            <div className="vh-poster vh-poster-coffee"><img src="https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=85" alt="Minuman kopi untuk contoh desain"/><small>KOPI NUSANTARA</small><h2>ES KOPI<br/><em>LOKAL</em></h2><p>Temani hari baikmu.</p><b>CUMA 25K</b></div>
            <div className="vh-poster vh-poster-event"><img src="https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=700&q=85" alt="Seminar untuk contoh poster"/><small>VIXORA COMMUNITY</small><h2>SEMINAR<br/><em>PENGEMBANGAN KARIER</em></h2><p>Persiapkan diri untuk peluang lebih besar.</p><b>DAFTAR SEKARANG</b></div>
            <div className="vh-poster vh-poster-beauty"><img src="https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=700&q=85" alt="Produk skincare untuk contoh desain"/><small>LUMIÈRE BEAUTY</small><h2>Rawat Kulit<br/>Lebih Cerah</h2><p>Perawatan harian untuk kulitmu.</p><b>PROMO SPESIAL</b></div>
          </div>
        </section>
        <section className="vh-portfolio vh-section" id="portfolio">
          <div className="vh-section-head"><div><h2>Contoh visual.<br/>Banyak kemungkinan.</h2><i className="vh-underline"/></div><p>Contoh konsep desain untuk menunjukkan arah visual VIXORA Creative. Karya ditampilkan sebagai konsep, bukan proyek klien yang diklaim nyata.</p></div>
          <div className="vh-work-grid">
            <article className="vh-work"><div className="vh-work-art coffee"><div className="vh-work-poster"><small>KOPI NUSANTARA</small><h3>ES KOPI<br/><em>LOKAL</em></h3><p>Temani hari baikmu.</p><b>CUMA 25K</b></div></div><div className="vh-work-info"><span>01 · FOOD & BEVERAGE</span><h3>Promo Kopi Lokal</h3><p>Headline kuat dan harga menonjol untuk menarik perhatian pelanggan.</p></div></article>
            <article className="vh-work"><div className="vh-work-art event"><div className="vh-work-poster"><small>VIXORA COMMUNITY</small><h3>SEMINAR<br/><em>PENGEMBANGAN KARIER</em></h3><p>Persiapkan diri untuk peluang lebih besar.</p><b>DAFTAR SEKARANG</b></div></div><div className="vh-work-info"><span>02 · EVENT</span><h3>Poster Acara</h3><p>Informasi acara disusun jelas agar audiens cepat memahami detailnya.</p></div></article>
            <article className="vh-work"><div className="vh-work-art beauty"><div className="vh-work-poster"><small>LUMIÈRE BEAUTY</small><h3>Rawat Kulit<br/>Lebih Cerah</h3><p>Perawatan harian untuk kulit sehat.</p><b>PROMO SPESIAL</b></div></div><div className="vh-work-info"><span>03 · PRODUCT PROMO</span><h3>Konten Promo Produk</h3><p>Visual bersih untuk menonjolkan produk dan karakter brand.</p></div></article>
          </div>
        </section>
        <section className="vh-section vh-services" id="layanan"><div className="vh-section-head"><div><span className="vh-label">LAYANAN KAMI</span><h2>Desain yang cocok<br/>untuk kebutuhanmu.</h2></div><p>Dari promosi harian sampai identitas brand, diskusikan kebutuhanmu dan kita pilih solusi visual yang sesuai.</p></div><div className="vh-service-grid"><article><b>01</b><h3>Konten Media Sosial</h3><p>Feed, story, promo diskon, dan materi kampanye digital.</p></article><article><b>02</b><h3>Poster, Flyer & Banner</h3><p>Publikasi acara, materi promosi, brosur, dan banner.</p></article><article><b>03</b><h3>Branding & Produk</h3><p>Label, menu, kartu nama, dan kebutuhan visual usaha.</p></article></div></section>
        <section className="vh-section vh-pricing" id="harga"><div className="vh-section-head"><div><span className="vh-label">HARGA TRANSPARAN</span><h2>Mulai dari yang<br/>paling kamu butuhkan.</h2></div><p>Paket perkenalan untuk desain sederhana. Harga akhir dikonfirmasi sebelum pengerjaan dimulai.</p></div><div className="vh-price-grid"><article><span>SMALL</span><h3>Quick Design</h3><p>Untuk satu kebutuhan visual sederhana.</p><strong>Rp25.000</strong><small>/ desain</small><ul><li>1 desain sederhana</li><li>1 ukuran pilihan</li><li>Maksimal 2 revisi minor</li><li>File digital siap unggah</li></ul><a href="https://wa.me/6285866073007?text=Halo%20VIXORA%2C%20saya%20tertarik%20paket%20Small%20Rp25.000." target="_blank" rel="noreferrer">Pilih paket →</a></article><article className="featured"><span>MEDIUM · POPULER</span><h3>Dual Format</h3><p>Satu konsep untuk dua penempatan media sosial.</p><strong>Rp45.000</strong><small>/ paket</small><ul><li>1 konsep desain</li><li>2 ukuran media sosial</li><li>Maksimal 2 revisi minor</li><li>File digital siap unggah</li></ul><a href="https://wa.me/6285866073007?text=Halo%20VIXORA%2C%20saya%20tertarik%20paket%20Medium%20Rp45.000." target="_blank" rel="noreferrer">Pilih paket →</a></article><article><span>LARGE</span><h3>Content Bundle</h3><p>Untuk beberapa konten dalam satu gaya visual.</p><strong>Rp99.000</strong><small>/ 5 desain</small><ul><li>5 desain konten sederhana</li><li>Gaya visual konsisten</li><li>Revisi minor sesuai kesepakatan</li><li>File digital siap unggah</li></ul><a href="https://wa.me/6285866073007?text=Halo%20VIXORA%2C%20saya%20tertarik%20paket%20Large%20Rp99.000." target="_blank" rel="noreferrer">Pilih paket →</a></article></div></section>
        <section className="vh-section vh-faq" id="faq"><div className="vh-section-head"><div><span className="vh-label">FAQ</span><h2>Yang sering<br>ditanyakan.</h2></div><p>Semua dibuat jelas dari awal supaya proses desain nyaman dan ekspektasi tetap sejalan.</p></div><div className="vh-faq-grid"><article><h3>Bagaimana cara order?</h3><p>Hubungi WhatsApp, jelaskan kebutuhan, lalu sepakati harga dan jadwal sebelum pengerjaan.</p></article><article><h3>Apa yang perlu disiapkan?</h3><p>Siapkan teks, foto atau logo bila ada, ukuran, tujuan desain, dan referensi gaya.</p></article><article><h3>Berapa lama prosesnya?</h3><p>Estimasi waktu dikonfirmasi setelah brief dan materi diterima lengkap.</p></article><article><h3>Bisa revisi?</h3><p>Bisa, sesuai batas revisi minor dan ketentuan paket yang disepakati.</p></article></div></section>
        <section className="vh-cta"><div><span className="vh-label">LET'S MAKE IT STAND OUT</span><h2>Idemu layak<br/>tampil lebih baik.</h2><p>Ceritakan kebutuhan desainmu. Kita mulai dari brief sederhana dan harga yang jelas.</p></div><a className="vh-btn primary" href="https://wa.me/6285866073007?text=Halo%20VIXORA%20Creative%2C%20saya%20ingin%20konsultasi%20desain." target="_blank" rel="noreferrer">◉ Konsultasi via WhatsApp →</a></section>
        <section className="vh-ai-section" id="command"><div><span className="vh-label">VIXORA AI COMMAND CENTER</span><h2>Satu instruksi.<br/>Banyak kemungkinan.</h2><p>Butuh bantuan AI dan otomasi? Masuk ke workspace VIXORA untuk mengakses agent, workflow, dan command center.</p><div className="vh-actions"><button className="vh-btn primary" onClick={() => { window.location.hash = 'login' }}>Masuk / Daftar ↗</button><button className="vh-btn secondary" onClick={() => document.getElementById('agents')?.scrollIntoView({behavior:'smooth'})}>Lihat AI Agents</button></div></div><div className="vh-ai-card"><div><span className="vh-live-dot"/> VIXORA CORE</div><h3>AI WORKSPACE</h3><p>Content · Research · Creative · Automation</p><button onClick={() => { window.location.hash = 'login' }}>Buka Command Center ↗</button></div></section>
        <section className="vh-agent-list" id="agents"><div className="vh-section-head"><div><span className="vh-label">AI ECOSYSTEM</span><h2>Lebih dari sekadar desain.</h2></div><p>VIXORA juga mengembangkan workflow AI untuk membantu tugas digital lebih terarah.</p></div><div className="vh-agent-grid">{agents.map(agent => <article key={agent.title}><span>{agent.code}</span><h3>{agent.title}</h3><p>{agent.text}</p></article>)}</div></section>
      </main>
      <footer className="vh-footer"><a className="vh-brand" href="#top"><VixoraSplashMark small/><span>VIXORA<small>CREATIVE + AI</small></span></a><p>Design that makes your brand stand out.</p><span>© 2026 VIXORA</span></footer>
      <a className="vh-wa-float" href="https://wa.me/6285866073007?text=Halo%20VIXORA%20Creative%2C%20saya%20ingin%20konsultasi%20desain." target="_blank" rel="noreferrer">◉ Chat WhatsApp</a>
      <button className="ai-fab vh-ai-fab" onClick={() => setChatOpen((v) => !v)} aria-label="Open VIXORA AI Command Center">✦</button>
      {chatOpen && <div className="ai-pop command-center"><div className="command-head"><div><b>VIXORA AI</b><span>COMMAND CENTER · CORE ONLINE</span></div><button onClick={() => setChatOpen(false)} aria-label="Close">×</button></div><div className="command-body"><p className="command-hint">Berikan satu instruksi. VIXORA Core akan meneruskannya ke executor yang sesuai.</p><textarea value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendCommand() }} placeholder="Contoh: Siapkan 3 Shorts untuk YouTube besok…" rows="4"/><button className="command-send" onClick={sendCommand} disabled={commandStatus === 'working'}>{commandStatus === 'working' ? 'Processing…' : 'Send command ↗'}</button>{commandResult && <div className={`command-result ${commandStatus}`}>{commandResult}</div>}<div className="command-modules"><span>CORE</span><span>CREAO</span><span>YOUTUBE</span><span>MORE SOON</span></div></div></div>}
    </div>
  )

}

export default App
