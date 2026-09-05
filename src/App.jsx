import { useMemo, useState } from 'react'

const categories = ['All', 'Design', 'Code', 'Music', 'Video', 'AI', 'Experiments']
const projects = [
  { id: 1, title: 'VIXORA', category: 'Code', tools: 'React · CSS · GitHub', description: 'A personal digital universe for ideas, projects, experiments, and creative work.', visual: 'vixora' },
  { id: 2, title: 'Pembukuan App', category: 'Code', tools: 'JavaScript · Web · GitHub', description: 'A focused digital tool for recording and understanding everyday finances.', visual: 'finance' },
  { id: 3, title: 'Personal Website', category: 'Design', tools: 'UI · Typography · CSS', description: 'Explorations in personal identity, interface, layout, and visual direction.', visual: 'grid' },
  { id: 4, title: 'Web Experiments', category: 'Experiments', tools: 'HTML · CSS · JavaScript', description: 'Small experiments built just to see what happens when an idea becomes interactive.', visual: 'code' },
  { id: 5, title: 'AI Experiments', category: 'AI', tools: 'AI · Prompting · Creative Tools', description: 'Creative workflows exploring what happens when imagination meets generative technology.', visual: 'ai' },
  { id: 6, title: 'Visual Studies', category: 'Design', tools: 'Canva · Visual Design', description: 'Posters, compositions, interfaces, and visual experiments made along the way.', visual: 'design' },
  { id: 7, title: 'Video Playground', category: 'Video', tools: 'CapCut · Editing · Motion', description: 'Short-form edits, visual storytelling, transitions, and motion experiments.', visual: 'video' },
  { id: 8, title: 'Sound Sketches', category: 'Music', tools: 'FL Studio · Instruments', description: 'Tracks, loops, textures, and unfinished sounds that may become something later.', visual: 'music' },
]
const toolkit = [
  ['DESIGN', ['Canva', 'Graphic Design', 'Visual Design', 'Branding']],
  ['CODE', ['HTML', 'CSS', 'JavaScript', 'React', 'GitHub']],
  ['MUSIC', ['FL Studio', 'Music Production', 'Sound Design', 'Instruments']],
  ['CREATIVE', ['Video Editing', 'Content Creation', 'AI Tools', 'Prompting']],
]
const garden = [
  ['01', 'The internet is a playground', 'Thoughts on making things for the joy of making them.', 'idea'],
  ['02', 'Learning in public', 'A collection of tiny discoveries, experiments, and unfinished thoughts.', 'learning'],
  ['03', 'Small things matter', 'Sometimes the smallest interface detail is the most interesting part.', 'note'],
  ['04', 'What if?', 'A place for questions before they become projects.', 'question'],
]

function TechUniverse() {
  return <div className="universe" aria-hidden="true">
    <div className="universe-noise" /><div className="universe-grid" /><div className="universe-glow" />
    <div className="universe-ring ring-a"><i /><i /><i /></div><div className="universe-ring ring-b"><i /><i /></div><div className="universe-ring ring-c"><i /><i /><i /><i /></div>
    <div className="universe-core"><span>V</span><small>VIXORA</small></div>
    <span className="universe-tag tag-a">CREATE</span><span className="universe-tag tag-b">EXPLORE</span><span className="universe-tag tag-c">BUILD</span><span className="universe-tag tag-d">REPEAT</span>
    <span className="universe-dot dot-a" /><span className="universe-dot dot-b" /><span className="universe-dot dot-c" />
  </div>
}
function ProjectVisual({ type }) {
  const mark = type === 'vixora' ? 'V' : type === 'ai' ? '✦' : type === 'music' ? '♫' : type === 'code' ? '</>' : type === 'video' ? '▶' : '◈'
  return <div className={`project-visual visual-${type}`}><span className="visual-orb" /><span className="visual-label">{type}</span><span className="visual-mark">{mark}</span></div>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false), [theme, setTheme] = useState('dark'), [filter, setFilter] = useState('All'), [selected, setSelected] = useState(null), [playing, setPlaying] = useState(false), [chatOpen, setChatOpen] = useState(false)
  const visibleProjects = useMemo(() => filter === 'All' ? projects : projects.filter((project) => project.category === filter), [filter])
  const go = (id) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }

  return <div className={`app-shell theme-${theme}`}>
    <header className="topbar"><div className="container nav-inner">
      <button className="brand" onClick={() => go('home')}><span className="brand-mark">V</span><span>VIXORA</span></button>
      <nav className={`nav-links ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
        <button onClick={() => go('about')}>About</button><button onClick={() => go('projects')}>Projects</button><button onClick={() => go('lab')}>Lab</button><button onClick={() => go('gallery')}>Gallery</button><button onClick={() => go('music')}>Music</button><button onClick={() => go('contact')}>Contact</button>
      </nav>
      <div className="nav-actions"><button className="theme-toggle" onClick={() => setTheme((v) => v === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? '☼' : '◐'}</button><button className="menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Open menu">☰</button></div>
    </div></header>

    <main id="home">
      <section className="hero container"><div className="hero-copy">
        <div className="eyebrow"><span /> PERSONAL DIGITAL UNIVERSE</div><h1>I Create Things<br /><em>That Should Exist.</em></h1><p className="hero-lead">Design, code, music, experiments, and random ideas — all in one place.</p>
        <div className="hero-actions"><button className="primary-btn" onClick={() => go('projects')}>Explore Vixora <b>↗</b></button><button className="ghost-btn" onClick={() => go('projects')}>See my projects</button></div>
        <div className="scroll-note"><span className="scroll-line" /> Scroll to explore</div>
      </div><TechUniverse /></section>

      <section className="ticker"><div className="ticker-track">CREATE <span>✦</span> EXPERIMENT <span>✦</span> DESIGN <span>✦</span> CODE <span>✦</span> MUSIC <span>✦</span> AI <span>✦</span> EXPLORE <span>✦</span> CREATE <span>✦</span> EXPERIMENT <span>✦</span></div></section>

      <section className="section about" id="about"><div className="container about-grid"><div className="section-kicker">01 / ABOUT</div><div className="about-copy"><h2>Hi, I'm <em>Viqi.</em></h2><p className="big-copy">I like turning random ideas into something real.</p><p>Sometimes it's a website. Sometimes it's a design. Sometimes it's music. Sometimes it's an experiment that probably didn't need to exist.</p><p>Vixora is where I collect the things I create, learn, explore, and experiment with.</p></div></div></section>

      <section className="section creative-space" id="projects"><div className="container"><div className="section-head"><div><div className="section-kicker">02 / MY CREATIVE SPACE</div><h2>Things I like to <em>make.</em></h2></div><p>A few corners of the VIXORA universe. No strict rules. Just curiosity.</p></div><div className="space-grid">
        {categories.slice(1).map((category, index) => <button className="space-card" key={category} onClick={() => { setFilter(category); go('project-gallery') }}><span className="space-number">0{index + 1}</span><span className="space-icon">{['◈', '</>', '♫', '▶', '✦', '∞'][index]}</span><h3>{category}</h3><span>Explore →</span></button>)}
      </div></div></section>

      <section className="section project-section" id="project-gallery"><div className="container"><div className="section-head" id="gallery"><div><div className="section-kicker">03 / THINGS I'VE MADE</div><h2>A digital <em>gallery.</em></h2></div><p>Projects are snapshots of what I'm building, learning, or simply enjoying.</p></div>
        <div className="filter-row" role="tablist">{categories.map((category) => <button className={filter === category ? 'active' : ''} key={category} onClick={() => setFilter(category)}>{category}</button>)}</div>
        <div className="projects-grid">{visibleProjects.map((project) => <article className="project-card" key={project.id} onClick={() => setSelected(project)}><ProjectVisual type={project.visual} /><div className="project-info"><div><span>{project.category}</span><h3>{project.title}</h3></div><b>↗</b><p>{project.description}</p><small>{project.tools}</small></div></article>)}</div>
      </div></section>

      <section className="section lab-section" id="lab"><div className="container"><div className="lab-banner"><div className="lab-copy"><div className="section-kicker">04 / VIXORA LAB</div><h2>Not everything<br />needs to become<br /><em>a product.</em></h2><p>Mini websites, UI experiments, JavaScript experiments, AI experiments, design experiments, and random ideas.</p></div><div className="lab-machine"><div className="machine-core">VIXORA<br /><small>LAB_01</small></div><i /><i /><i /><i /><span>01</span><span>02</span><span>03</span></div></div>
        <div className="lab-list">{['Interface Playground', 'Tiny JavaScript Things', 'AI Visual Studies', 'Ideas That Went Weird'].map((item, index) => <button key={item} onClick={() => setSelected({ title: item, category: 'Experiments', tools: 'VIXORA LAB', description: 'Experimental work in progress. This space is intentionally unfinished.', visual: ['grid', 'code', 'ai', 'design'][index] })}><span>LAB / 0{index + 1}</span><b>{item}</b><i>↗</i></button>)}</div>
      </div></section>

      <section className="section toolkit-section"><div className="container"><div className="section-head"><div><div className="section-kicker">05 / CREATIVE TOOLKIT</div><h2>Things I use to <em>build.</em></h2></div><p>Tools are just instruments. The fun part is what happens when you combine them.</p></div><div className="toolkit-grid">{toolkit.map(([title, items]) => <article className="toolbox" key={title}><span>{title}</span><div>{items.map((item) => <b key={item}>{item}</b>)}</div></article>)}</div></div></section>

      <section className="section explore-section"><div className="container explore-grid"><div><div className="section-kicker">06 / CURRENTLY EXPLORING</div><h2>Still curious<br />about <em>everything.</em></h2></div><div className="explore-orbit">{['Web Development', 'AI', 'Creative Coding', 'UI Design', 'Video', 'Music', 'Digital Products'].map((item, index) => <span className={`explore-pill p-${index}`} key={item}>{item}</span>)}<div>∞</div></div></div></section>

      <section className="section music-section" id="music"><div className="container sound-card"><div><div className="section-kicker">07 / SOUND OF VIXORA</div><h2>Sometimes ideas<br />sound <em>better.</em></h2><p>Tracks, loops, instrument projects, and unfinished sounds made in FL Studio and beyond.</p></div><div className={`player ${playing ? 'playing' : ''}`}><div className="player-art"><span>♫</span></div><div className="player-info"><small>VIXORA / SOUND SKETCH</small><b>Untitled 01</b><span>Experiment · 03:42</span><div className="progress"><i /></div></div><button onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Ⅱ' : '▶'}</button></div><div className="sound-tags"><span>FL Studio</span><span>Music Production</span><span>Sound Experiments</span><span>Instruments</span></div></div></section>

      <section className="section garden-section"><div className="container"><div className="section-head"><div><div className="section-kicker">08 / DIGITAL GARDEN</div><h2>Things I'm <em>thinking about.</em></h2></div><p>Not finished. Not polished. A living collection of notes, discoveries, and ideas.</p></div><div className="garden-grid">{garden.map(([number, title, text, type]) => <article className={`garden-card garden-${type}`} key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p><b>Read the thought ↗</b></article>)}</div></div></section>

      <section className="contact-section" id="contact"><div className="container contact-inner"><div className="section-kicker">09 / CONTACT</div><h2>Got an <em>idea?</em></h2><p>Maybe we can turn it into something.</p><a href="mailto:hello@vixora.my.id">Start a conversation ↗</a></div></section>
    </main>

    <footer><div className="container footer-inner"><div><strong>VIXORA</strong><span>Made by Viqi.</span></div><p>Create. Experiment. Repeat.</p><small>© 2026 Vixora</small></div></footer>
    <button className="ai-fab" onClick={() => setChatOpen((v) => !v)} aria-label="VIXORA AI">✦</button>{chatOpen && <div className="ai-pop"><b>VIXORA AI</b><p>Creative mode: on. AI playground coming soon.</p><button onClick={() => setChatOpen(false)}>Close</button></div>}
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="project-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}>×</button><ProjectVisual type={selected.visual || 'grid'} /><div className="modal-body"><span>{selected.category}</span><h2>{selected.title}</h2><p>{selected.description}</p><small>{selected.tools}</small><button onClick={() => setSelected(null)}>Back to gallery ↗</button></div></div></div>}
  </div>
}
export default App
