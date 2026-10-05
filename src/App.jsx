import { useEffect, useState } from 'react'
import './agency.css'
import { supabase } from './lib/supabase'

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
      <a className="agency-logo auth-logo" href="#top"><span className="agency-logo-mark">V</span><span>VIXORA AI</span></a>
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
  const [commandStatus, setCommandStatus] = useState('idle')
  const [commandResult, setCommandResult] = useState('')

  const sendCommand = async () => {
    const value = command.trim()
    if (!value || commandStatus === 'working') return
    setCommandStatus('working')
    setCommandResult('Mengirim instruksi ke VIXORA Core…')
    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: value, source: 'vixora-workspace' }),
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

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.hash = 'login'
  }

  const email = session?.user?.email || 'VIXORA user'
  const name = session?.user?.user_metadata?.full_name || email.split('@')[0]

  return <div className="workspace-shell">
    <header className="workspace-nav">
      <a className="agency-logo" href="#workspace"><span className="agency-logo-mark">V</span><span>VIXORA AI</span></a>
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
        <div className="command-head"><div><b>VIXORA COMMAND CENTER</b><span>CORE ONLINE · EXECUTION READY</span></div><span className="online"><i /> READY</span></div>
        <div className="workspace-command-body">
          <textarea value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendCommand() }} placeholder="Contoh: Siapkan 3 Shorts untuk YouTube besok…" rows="5" />
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

  if (sessionLoading) return <div className="auth-shell"><div className="auth-card"><div className="agency-logo auth-logo"><span className="agency-logo-mark">V</span><span>VIXORA AI</span></div><div className="auth-message">Connecting to VIXORA Core…</div></div></div>
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
