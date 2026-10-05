import { useEffect, useState } from 'react'
import './agency.css'

const agents = [
  { icon: '✦', code: 'AGENT 01', title: 'Content Agent', text: 'Menyusun ide, script, caption, Shorts, dan paket konten siap dieksekusi.' },
  { icon: '◈', code: 'AGENT 02', title: 'YouTube Agent', text: 'Menyiapkan workflow YouTube dari ide sampai proses publish melalui executor.' },
  { icon: '⌘', code: 'AGENT 03', title: 'Research Agent', text: 'Mencari, merangkum, membandingkan, dan mengubah informasi menjadi bahan kerja.' },
  { icon: '◇', code: 'AGENT 04', title: 'Creative Agent', text: 'Membantu konsep visual, prompt, branding, desain, dan creative direction.' },
  { icon: '⚙', code: 'AGENT 05', title: 'Automation Agent', text: 'Menghubungkan tugas dan layanan menjadi alur kerja otomatis yang bisa dieksekusi.' },
  { icon: 'V', code: 'CORE', title: 'VIXORA Orchestrator', text: 'Otak utama yang menerima instruksi dan meneruskannya ke agent yang paling tepat.' },
]

function AuthPage({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const switchMode = (next) => {
    setMode(next)
    setMessage('')
    window.location.hash = next
  }

  const submit = (event) => {
    event.preventDefault()
    setMessage(mode === 'login'
      ? 'Login interface siap. Authentication backend akan dihubungkan ke VIXORA Core.'
      : 'Registration interface siap. Authentication backend akan dihubungkan ke VIXORA Core.')
  }

  return <div className="auth-shell">
    <div className="auth-noise" />
    <a className="auth-back" href="#top">← Back to VIXORA</a>
    <div className="auth-card">
      <a className="agency-logo auth-logo" href="#top"><span className="agency-logo-mark">V</span><span>VIXORA AI</span></a>
      <div className="agency-kicker auth-kicker">AI AGENCY · ACCESS PORTAL</div>
      <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
      <p className="auth-subtitle">{mode === 'login' ? 'Masuk untuk mengakses VIXORA AI Command Center dan agent kamu.' : 'Buat akun untuk mulai menggunakan ekosistem AI agency VIXORA.'}</p>
      <div className="auth-tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Login</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Register</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' && <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required /></label>}
        <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="6" required /></label>
        {mode === 'login' && <button type="button" className="auth-forgot">Forgot password?</button>}
        <button className="auth-submit" type="submit">{mode === 'login' ? 'Login to VIXORA ↗' : 'Create VIXORA account ↗'}</button>
      </form>
      {message && <div className="auth-message">{message}</div>}
      <div className="auth-divider"><span>VIXORA CORE</span></div>
      <div className="auth-secure"><i /> Secure access portal · Multi-agent workspace</div>
    </div>
  </div>
}

function App() {
  const [chatOpen, setChatOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [commandStatus, setCommandStatus] = useState('idle')
  const [commandResult, setCommandResult] = useState('')
  const [authMode, setAuthMode] = useState(null)

  useEffect(() => {
    const syncRoute = () => {
      const route = window.location.hash.replace('#', '').toLowerCase()
      setAuthMode(route === 'login' || route === 'register' ? route : null)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    syncRoute()
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])


  const sendCommand = async () => {
    const value = command.trim()
    if (!value || commandStatus === 'working') return
    setCommandStatus('working')
    setCommandResult('Mengirim instruksi ke VIXORA Core…')
    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="agency-shell">
      <header className="agency-nav">
        <div className="agency-nav-inner">
          <a className="agency-logo" href="#top"><span className="agency-logo-mark">V</span><span>VIXORA AI</span></a>
          <nav className="agency-nav-links">
            <a href="#agents">Agents</a>
            <a href="#workflow">Workflow</a>
            <a href="#command">Command Center</a>
          </nav>
          <button className="agency-nav-cta" onClick={() => { window.location.hash = 'login' }}>Try Now ↗</button>
        </div>
      </header>

      <main id="top">
        <section className="agency-hero agency-container">
          <div>
            <div className="agency-kicker">AI AGENCY · MULTI-AGENT SYSTEM</div>
            <h1>One command.<br /><em>Many agents.</em></h1>
            <p>VIXORA adalah AI agency yang mengubah instruksi menjadi pekerjaan nyata. Satu Core mengatur agent, workflow, dan executor untuk menjalankan tugas digital dari satu tempat.</p>
            <div className="agency-actions">
              <button className="agency-primary" onClick={() => { window.location.hash = 'login' }}>Try Now ↗</button>
              <button className="agency-secondary" onClick={() => document.getElementById('agents')?.scrollIntoView({ behavior: 'smooth' })}>Explore Agents</button>
            </div>
          </div>
          <div className="agency-status">
            <div className="agency-status-top"><strong>VIXORA CORE</strong><span className="online"><i /> ONLINE</span></div>
            <div className="agency-orb"><div className="agency-orb-core">V</div></div>
          </div>
        </section>

        <section className="agency-section" id="agents">
          <div className="agency-container">
            <div className="agency-section-head"><div><div className="agency-kicker">THE AGENCY</div><h2>Agents that do the work.</h2></div><p>Setiap agent punya peran khusus. VIXORA Core memilih dan mengarahkan agent berdasarkan instruksi yang diberikan.</p></div>
            <div className="agent-grid">{agents.map((agent) => <article className="agent-card" key={agent.title}><div className="agent-icon">{agent.icon}</div><small>{agent.code}</small><h3>{agent.title}</h3><p>{agent.text}</p></article>)}</div>
          </div>
        </section>

        <section className="agency-section" id="workflow">
          <div className="agency-container">
            <div className="agency-section-head"><div><div className="agency-kicker">HOW IT WORKS</div><h2>From command to execution.</h2></div><p>Arsitektur VIXORA dibuat untuk memisahkan reasoning, planning, execution, dan verification.</p></div>
            <div className="workflow">{[
              ['01', 'INTAKE', 'Core memahami instruksi dan menentukan agent yang tepat.'],
              ['02', 'RECON', 'Agent mengumpulkan konteks dan data yang diperlukan.'],
              ['03', 'EXECUTE', 'Executor menjalankan aksi yang sudah direncanakan.'],
              ['04', 'VERIFY', 'Hasil diperiksa dan dikembalikan ke command center.'],
            ].map(([n, t, d]) => <div className="workflow-step" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}</div>
          </div>
        </section>

        <section className="agency-section" id="command">
          <div className="agency-container agency-command">
            <div className="agency-command-copy">
              <div className="agency-kicker">COMMAND CENTER</div>
              <h2>Tell VIXORA what needs to happen.</h2>
              <p>Tulis tujuanmu dalam bahasa biasa. VIXORA Core akan meneruskan instruksi ke agent dan executor yang tersedia.</p>
              <button className="agency-primary" onClick={openCommand}>Open Command Center ↗</button>
            </div>
            <div className="agency-command-box">
              <div className="online"><i /> CORE ONLINE</div>
              <textarea id="agency-command-input" value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendCommand() }} placeholder="Contoh: Siapkan 3 Shorts untuk YouTube besok…" rows="6" />
              <button className="agency-send" onClick={sendCommand} disabled={commandStatus === 'working'}>{commandStatus === 'working' ? 'Processing…' : 'Send command ↗'}</button>
              {commandResult && <div className={`agency-result ${commandStatus}`}>{commandResult}</div>}
            </div>
          </div>
        </section>
      </main>

      <footer className="agency-container agency-footer"><span>VIXORA AI AGENCY</span><span>Orchestrate. Execute. Verify.</span><span>© 2026</span></footer>
      <button className="ai-fab" onClick={() => setChatOpen((v) => !v)} aria-label="Open VIXORA AI Command Center">✦</button>
      {chatOpen && <div className="ai-pop command-center"><div className="command-head"><div><b>VIXORA AI</b><span>COMMAND CENTER · CORE ONLINE</span></div><button onClick={() => setChatOpen(false)} aria-label="Close">×</button></div><div className="command-body"><p className="command-hint">Berikan satu instruksi. VIXORA Core akan meneruskannya ke executor yang sesuai.</p><textarea value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendCommand() }} placeholder="Contoh: Siapkan 3 Shorts untuk YouTube besok…" rows="4"/><button className="command-send" onClick={sendCommand} disabled={commandStatus === 'working'}>{commandStatus === 'working' ? 'Processing…' : 'Send command ↗'}</button>{commandResult && <div className={`command-result ${commandStatus}`}>{commandResult}</div>}<div className="command-modules"><span>CORE</span><span>CREAO</span><span>YOUTUBE</span><span>MORE SOON</span></div></div></div>}
    </div>
  )
}

export default App
