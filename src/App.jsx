import { useState } from 'react'
import './agency.css'

const agents = [
  { icon: '✦', code: 'AGENT 01', title: 'Content Agent', text: 'Menyusun ide, script, caption, Shorts, dan paket konten siap dieksekusi.' },
  { icon: '◈', code: 'AGENT 02', title: 'YouTube Agent', text: 'Menyiapkan workflow YouTube dari ide sampai proses publish melalui executor.' },
  { icon: '⌘', code: 'AGENT 03', title: 'Research Agent', text: 'Mencari, merangkum, membandingkan, dan mengubah informasi menjadi bahan kerja.' },
  { icon: '◇', code: 'AGENT 04', title: 'Creative Agent', text: 'Membantu konsep visual, prompt, branding, desain, dan creative direction.' },
  { icon: '⚙', code: 'AGENT 05', title: 'Automation Agent', text: 'Menghubungkan tugas dan layanan menjadi alur kerja otomatis yang bisa dieksekusi.' },
  { icon: 'V', code: 'CORE', title: 'VIXORA Orchestrator', text: 'Otak utama yang menerima instruksi dan meneruskannya ke agent yang paling tepat.' },
]

function App() {
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
          <button className="agency-nav-cta" onClick={openCommand}>Deploy an Agent ↗</button>
        </div>
      </header>

      <main id="top">
        <section className="agency-hero agency-container">
          <div>
            <div className="agency-kicker">AI AGENCY · MULTI-AGENT SYSTEM</div>
            <h1>One command.<br /><em>Many agents.</em></h1>
            <p>VIXORA adalah AI agency yang mengubah instruksi menjadi pekerjaan nyata. Satu Core mengatur agent, workflow, dan executor untuk menjalankan tugas digital dari satu tempat.</p>
            <div className="agency-actions">
              <button className="agency-primary" onClick={openCommand}>Start with VIXORA AI ↗</button>
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
            <div className="agent-grid">
              {agents.map((agent) => <article className="agent-card" key={agent.title}><div className="agent-icon">{agent.icon}</div><small>{agent.code}</small><h3>{agent.title}</h3><p>{agent.text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="agency-section" id="workflow">
          <div className="agency-container">
            <div className="agency-section-head"><div><div className="agency-kicker">HOW IT WORKS</div><h2>From command to execution.</h2></div><p>Arsitektur VIXORA dibuat untuk memisahkan reasoning, planning, execution, dan verification.</p></div>
            <div className="workflow">
              {[
                ['01', 'INTAKE', 'Core memahami instruksi dan menentukan agent yang tepat.'],
                ['02', 'RECON', 'Agent mengumpulkan konteks dan data yang diperlukan.'],
                ['03', 'EXECUTE', 'Executor menjalankan aksi yang sudah direncanakan.'],
                ['04', 'VERIFY', 'Hasil diperiksa dan dikembalikan ke command center.'],
              ].map(([n, t, d]) => <div className="workflow-step" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}
            </div>
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
