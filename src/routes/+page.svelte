<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  type Tab = 'Overview' | 'Task Center' | 'Agent Hub' | 'Automations' | 'Integrations';
  type DraftTask = { id: string; title: string; createdAt: string; status: 'Draft' | 'Saved' };
  type AgentRunView = { id: string; task_id: string | null; title: string; status: string; assigned_agent: string | null; executor: string | null; created_at: string; output?: { message?: string; agent_name?: string } | null };
  type AgentPreview = { mode: string; status: string; externalExecutorCalls: number; executor: string; agentId: string; agentName: string; taskTitle: string; summary: string; steps: string[]; deliverables: string[]; nextAction: string; limitations: string[]; createdAt: string };
  type AgentAIResult = { mode: string; status: string; model: string; agentId: string; agentName: string; taskTitle: string; answer: string; limitations: string[]; usage?: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | null; createdAt: string };

  let activeTab = $state<Tab>('Overview');
  let taskInput = $state('');
  let tasks = $state<DraftTask[]>([]);
  let notice = $state('Workspace baru sedang disiapkan. Task belum dikirim ke executor.');
  let accessToken = $state<string | null>(null);
  let signedInEmail = $state<string | null>(null);
  let taskBusy = $state(false);
  let taskFeedback = $state('');
  let taskFeedbackError = $state(false);
  let agentRuns = $state<AgentRunView[]>([]);
  let runStorageReady = $state<boolean | null>(null);
  let runNotice = $state('');
  let runFeedbackError = $state(false);
  let runBusyTaskId = $state<string | null>(null);
  let previewBusyTaskId = $state<string | null>(null);
  let agentPreview = $state<AgentPreview | null>(null);
  let agentPreviewError = $state('');
  let aiBusyTaskId = $state<string | null>(null);
  let agentAIResult = $state<AgentAIResult | null>(null);
  let agentAIError = $state('');

  async function loadSavedTasks(token: string) {
    try {
      const response = await fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Task history belum dapat dimuat.');
      const rows = await response.json() as Array<{ id: string; title: string; description: string | null; created_at: string }>;
      tasks = rows.map((row) => ({ id: row.id, title: row.title, createdAt: new Date(row.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), status: 'Saved' }));
    } catch {
      notice = 'Koneksi task belum tersedia. Periksa konfigurasi Supabase staging.';
    }
  }

  onMount(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      accessToken = data.session?.access_token ?? null;
      signedInEmail = data.session?.user.email ?? null;
      if (data.session) void loadSavedTasks(data.session.access_token);
      if (data.session) void loadAgentRuns(data.session.access_token);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      accessToken = session?.access_token ?? null;
      signedInEmail = session?.user.email ?? null;
      if (session) {
        void loadSavedTasks(session.access_token);
        void loadAgentRuns(session.access_token);
      } else {
        tasks = [];
        agentRuns = [];
        runStorageReady = null;
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  });

  async function loadAgentRuns(token: string) {
    try {
      let requestToken = token;
      let response = await fetch('/api/agent-runs', { headers: { Authorization: `Bearer ${requestToken}` } });

      // A sleeping tab can resume with an expired access token while Supabase still has a refresh token.
      // Refresh once and retry before showing a misleading signed-out warning.
      if (response.status === 401) {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session?.access_token) {
          requestToken = data.session.access_token;
          accessToken = requestToken;
          signedInEmail = data.session.user.email ?? null;
          response = await fetch('/api/agent-runs', { headers: { Authorization: `Bearer ${requestToken}` } });
        }
      }

      const result = await response.json() as { runs?: AgentRunView[]; storageReady?: boolean; message?: string; error?: string };
      if (!response.ok) throw new Error(result.message || result.error || 'Run history belum dapat dimuat.');
      agentRuns = result.runs ?? [];
      runStorageReady = result.storageReady ?? true;
      if (!runStorageReady) {
        runNotice = 'Penyimpanan agent run belum dipasang pada database staging terpisah. Database produksi tidak diubah.';
        runFeedbackError = true;
      } else {
        runNotice = '';
        runFeedbackError = false;
      }
    } catch (cause) {
      runStorageReady = false;
      runNotice = cause instanceof Error ? cause.message : 'Run history belum dapat dimuat.';
      runFeedbackError = true;
    }
  }

  async function createAgentRun(taskId: string) {
    if (!accessToken) {
      runNotice = 'Sign in dulu untuk menyiapkan agent run.';
      runFeedbackError = true;
      await goto('/login');
      return;
    }
    if (runBusyTaskId) return;
    runBusyTaskId = taskId;
    runNotice = '';
    runFeedbackError = false;
    try {
      const response = await fetch('/api/agent-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ task_id: taskId })
      });
      const result = await response.json() as { run?: AgentRunView; error?: string; message?: string };
      if (!response.ok || !result.run) throw new Error(result.message || result.error || 'Run plan belum berhasil disimpan.');
      agentRuns = [result.run, ...agentRuns.filter((run) => run.id !== result.run?.id)];
      runStorageReady = true;
      runNotice = `Rencana dibuat dan diarahkan ke ${result.run.output?.agent_name ?? result.run.assigned_agent ?? 'agent'}. Belum ada executor yang dijalankan.`;
      runFeedbackError = false;
    } catch (cause) {
      runNotice = cause instanceof Error ? cause.message : 'Run plan belum berhasil disimpan.';
      runFeedbackError = true;
    } finally {
      runBusyTaskId = null;
    }
  }

  async function previewAgent(taskId: string) {
    if (!accessToken) {
      agentPreviewError = 'Sign in dulu untuk menguji agent.';
      await goto('/login');
      return;
    }
    if (previewBusyTaskId) return;
    previewBusyTaskId = taskId;
    agentPreviewError = '';
    agentPreview = null;
    try {
      const response = await fetch('/api/agent-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ task_id: taskId })
      });
      const result = await response.json() as { preview?: AgentPreview; error?: string };
      if (!response.ok || !result.preview) throw new Error(result.error || 'Preview agent belum berhasil dibuat.');
      agentPreview = result.preview;
      activeTab = 'Task Center';
    } catch (cause) {
      agentPreviewError = cause instanceof Error ? cause.message : 'Preview agent belum berhasil dibuat.';
    } finally {
      previewBusyTaskId = null;
    }
  }

  async function runAIAgent(taskId: string) {
    if (!accessToken) {
      agentAIError = 'Sign in dulu untuk menjalankan AI Agent.';
      await goto('/login');
      return;
    }
    if (aiBusyTaskId) return;
    aiBusyTaskId = taskId;
    agentAIError = '';
    agentAIResult = null;
    try {
      const response = await fetch('/api/agent-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ task_id: taskId })
      });
      const result = await response.json() as { result?: AgentAIResult; error?: string; message?: string };
      if (!response.ok || !result.result) throw new Error(result.message || result.error || 'AI Agent belum berhasil dijalankan.');
      agentAIResult = result.result;
      activeTab = 'Task Center';
    } catch (cause) {
      agentAIError = cause instanceof Error ? cause.message : 'AI Agent belum berhasil dijalankan.';
    } finally {
      aiBusyTaskId = null;
    }
  }

  const tabs: Tab[] = ['Overview', 'Task Center', 'Agent Hub', 'Automations', 'Integrations'];

  async function createDraft(event: SubmitEvent) {
    event.preventDefault();
    const prompt = taskInput.trim();
    if (!prompt || taskBusy) return;
    taskFeedback = '';
    taskFeedbackError = false;
    if (!accessToken) {
      taskFeedback = 'Silakan sign in terlebih dahulu untuk menyimpan task.';
      taskFeedbackError = true;
      notice = taskFeedback;
      await goto('/login');
      return;
    }

    taskBusy = true;
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ title: prompt.slice(0, 240), description: prompt, priority: 'medium' })
      });
      const result = await response.json() as Array<{ id: string; title: string; created_at: string }> | { error?: string; detail?: string };
      if (!response.ok || !Array.isArray(result) || !result[0]) {
        const apiError = !Array.isArray(result) ? result.error : undefined;
        const detail = !Array.isArray(result) ? result.detail : undefined;
        throw new Error(apiError ? `${apiError}${detail ? ` — ${detail}` : ''}` : 'Task belum berhasil disimpan.');
      }
      const row = result[0];
      tasks = [{ id: row.id, title: row.title, createdAt: new Date(row.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), status: 'Saved' }, ...tasks.filter((task) => task.id !== row.id)];
      taskInput = '';
      taskFeedback = 'Berhasil! Task tersimpan di Supabase. Task belum menjalankan AI Agent.';
      taskFeedbackError = false;
      activeTab = 'Task Center';
      notice = taskFeedback;
    } catch (cause) {
      taskFeedback = cause instanceof Error ? cause.message : 'Task belum berhasil disimpan.';
      taskFeedbackError = true;
      notice = taskFeedback;
    } finally {
      taskBusy = false;
    }
  }

  const agents = [
    { number: '01', name: 'Strategy & Planner', description: 'Memecah permintaan menjadi rencana kerja', status: 'Local dry-run ready' },
    { number: '02', name: 'Research Agent', description: 'Rencana riset, matriks bukti, dan kriteria sumber', status: 'Local dry-run ready' },
    { number: '03', name: 'Content Studio', description: 'Hook, outline konten, metadata, dan review', status: 'Local dry-run ready' },
    { number: '04', name: 'Workflow Planner', description: 'Blueprint alur n8n/webhook tanpa mengeksekusi workflow', status: 'Local dry-run ready' }
  ];
</script>

<svelte:head>
  <title>VIXORA Workspace — AI operations</title>
  <meta name="description" content="VIXORA Workspace — satu tempat untuk merencanakan, menjalankan, dan memeriksa pekerjaan AI." />
</svelte:head>

<div class="shell">
  <aside class="sidebar">
    <a class="brand" href="/" aria-label="VIXORA Workspace home">
      <span class="brand-mark">V</span>
      <span><strong>VIXORA</strong><small>AI WORKSPACE</small></span>
    </a>

    <div class="workspace-label">WORKSPACE</div>
    <nav aria-label="Main navigation">
      {#each tabs as tab}
        <button class:active={activeTab === tab} class="nav-item" onclick={() => activeTab = tab}>
          <span class="nav-icon">{tab === 'Overview' ? '◫' : tab === 'Task Center' ? '⌘' : tab === 'Agent Hub' ? '✳' : tab === 'Automations' ? '↗' : '⌁'}</span>
          <span>{tab}</span>
          {#if tab === 'Task Center' && tasks.length > 0}<span class="nav-count">{tasks.length}</span>{/if}
        </button>
      {/each}
    </nav>

    <div class="sidebar-bottom">
      <div class="environment"><span class="pulse"></span><span><strong>STAGING</strong><small>Isolated environment</small></span></div>
      <div class="user-row"><div class="avatar">VX</div><span><strong>{signedInEmail ?? "Workspace visitor"}</strong><small>{signedInEmail ? "Signed in" : "Sign in to save tasks"}</small></span><span class="dots">•••</span></div>
    </div>
  </aside>

  <main class="main">
    <header class="topbar">
      <div class="breadcrumb">VIXORA <span>/</span> {activeTab}</div>
      <div class="top-actions"><span class="status-chip"><i></i> Build in progress</span><button class="icon-button" aria-label="Notifications">♧</button><a class="avatar small" href="/login" aria-label="Sign in or account settings" title="Sign in / account"><span>VX</span></a></div>
    </header>

    <div class="content">
      {#if activeTab === 'Overview'}
        <section class="welcome">
          <div>
            <div class="eyebrow"><span class="eyebrow-line"></span> AI OPERATIONS, REIMAGINED</div>
            <h1>Good to see you,<br /><span>Builder.</span></h1>
            <p class="intro">Satu workspace untuk mengubah ide menjadi pekerjaan yang terencana, dieksekusi, dan lolos pemeriksaan kualitas.</p>
          </div>
          <div class="orb-wrap" aria-hidden="true"><div class="orb-ring ring-one"></div><div class="orb-ring ring-two"></div><div class="orb-core"><span>V</span></div><div class="orbit-dot dot-one"></div><div class="orbit-dot dot-two"></div><div class="orbit-dot dot-three"></div></div>
        </section>

        <section class="notice"><span class="notice-icon">i</span><div><strong>Mode staging aktif</strong><p>{notice} Integrasi Supabase, CREAO, dan n8n akan disambungkan setelah kontrak API dan autentikasi diverifikasi.</p></div></section>

        <section class="section-heading"><div><span class="eyebrow">YOUR OPERATIONS</span><h2>Workspace overview</h2></div><span class="muted-label">PHASE 01 · FOUNDATION</span></section>
        <div class="metric-grid">
          <article class="metric-card"><div class="metric-top"><span>Saved tasks</span><span class="metric-icon purple">⌘</span></div><div class="metric-value">{tasks.length.toString().padStart(2, '0')}</div><div class="metric-foot"><span class="neutral-dot"></span> {signedInEmail ? "Synced with Supabase" : "Sign in required"}</div></article>
          <article class="metric-card"><div class="metric-top"><span>Agent blueprints</span><span class="metric-icon cyan">✳</span></div><div class="metric-value">04</div><div class="metric-foot"><span class="neutral-dot"></span> Local dry-run ready · AI runtime not connected</div></article>
          <article class="metric-card"><div class="metric-top"><span>Connected executors</span><span class="metric-icon amber">↗</span></div><div class="metric-value">00</div><div class="metric-foot"><span class="warning-dot"></span> Pending verification</div></article>
          <article class="metric-card"><div class="metric-top"><span>Quality checks</span><span class="metric-icon green">✓</span></div><div class="metric-value">—</div><div class="metric-foot"><span class="neutral-dot"></span> Not run yet</div></article>
        </div>

        <section class="work-grid">
          <article class="panel task-panel">
            <div class="panel-heading"><div><span class="eyebrow">START WITH AN IDEA</span><h2>What should VIXORA work on?</h2></div><span class="sparkle">✦</span></div>
            <p class="panel-copy">Tuliskan tujuanmu dengan bahasa biasa. Untuk tahap ini, permintaan akan disimpan sebagai draft agar alur kerja bisa diuji tanpa memanggil layanan eksternal.</p>
            <form onsubmit={createDraft}>
              <label class="sr-only" for="task-input">Describe a task</label>
              <textarea id="task-input" bind:value={taskInput} placeholder="Contoh: Riset 5 ide YouTube Shorts tentang AI, lalu susun hook dan skrip 30 detik…" rows="3"></textarea>
              <div class="composer-footer"><span><span class="keyboard">↵</span> Simpan sebagai draft</span><button class="primary-button" type="submit" disabled={!taskInput.trim() || taskBusy}>{taskBusy ? 'Saving…' : 'Create task'} <span>↗</span></button></div>
            </form>
            {#if taskFeedback}<p class={taskFeedbackError ? 'task-feedback is-error' : 'task-feedback is-success'} role={taskFeedbackError ? 'alert' : 'status'}>{taskFeedback}</p>{/if}
            <div class="suggestions"><span>TRY:</span><button onclick={() => taskInput = 'Riset 5 ide YouTube Shorts tentang AI'}>Riset ide konten</button><button onclick={() => taskInput = 'Buat rencana otomasi workflow n8n'}>Rencana otomasi</button><button onclick={() => taskInput = 'Buat checklist quality assurance untuk hasil AI'}>Quality checklist</button></div>
          </article>
          <article class="panel pipeline-panel">
            <div class="panel-heading"><div><span class="eyebrow">EXECUTION MODEL</span><h2>From prompt to outcome</h2></div></div>
            <div class="pipeline">
              <div class="pipeline-step"><span class="step-icon">⌘</span><div><strong>Understand</strong><small>Intent & context</small></div><span class="step-state">01</span></div>
              <div class="pipeline-connector"></div>
              <div class="pipeline-step"><span class="step-icon">✳</span><div><strong>Plan & delegate</strong><small>Agent orchestration</small></div><span class="step-state">02</span></div>
              <div class="pipeline-connector"></div>
              <div class="pipeline-step"><span class="step-icon">↗</span><div><strong>Execute</strong><small>CREAO / n8n adapters</small></div><span class="step-state">03</span></div>
              <div class="pipeline-connector"></div>
              <div class="pipeline-step"><span class="step-icon">✓</span><div><strong>Verify & deliver</strong><small>Quality gate</small></div><span class="step-state">04</span></div>
            </div>
            <div class="pipeline-foot"><span class="neutral-dot"></span> Architecture preview — not live execution</div>
          </article>
        </section>

        <section class="section-heading agent-heading"><div><span class="eyebrow">SPECIALISTS, NOT JUST BUTTONS</span><h2>Agent roster</h2></div><button class="text-button" onclick={() => activeTab = 'Agent Hub'}>Explore agents <span>→</span></button></section>
        <div class="agent-grid">
          {#each agents.slice(0, 4) as agent}
            <article class="agent-card"><div class="agent-card-top"><span class="agent-number">{agent.number}</span><span class="blueprint-pill">LOCAL DRY-RUN</span></div><h3>{agent.name}</h3><p>{agent.description}</p><div class="agent-card-bottom"><span class="agent-status-dot"></span><span>{agent.status}</span></div></article>
          {/each}
        </div>
      {:else if activeTab === 'Task Center'}
        <section class="page-intro"><div class="eyebrow">WORK QUEUE</div><h1>Task <span>Center</span></h1><p>Draft tugas dan riwayat yang akan dikelola oleh orchestrator.</p></section>
        <article class="panel task-panel"><div class="panel-heading"><div><span class="eyebrow">NEW TASK</span><h2>Capture an objective</h2></div></div><form onsubmit={createDraft}><label class="sr-only" for="task-input">Describe a task</label><textarea id="task-input" bind:value={taskInput} placeholder="Jelaskan hasil yang ingin kamu capai…" rows="3"></textarea><div class="composer-footer"><span>Belum menjalankan agent</span><button class="primary-button" type="submit" disabled={!taskInput.trim() || taskBusy}>{taskBusy ? 'Saving…' : 'Save draft'} <span>↗</span></button></div></form>{#if taskFeedback}<p class={taskFeedbackError ? 'task-feedback is-error' : 'task-feedback is-success'} role={taskFeedbackError ? 'alert' : 'status'}>{taskFeedback}</p>{/if}</article>
        <p class="ai-privacy-note">Run AI Agent mengirim isi task ke Gemini API untuk menghasilkan teks/draft. Jangan masukkan kata sandi, API key, atau data sensitif perusahaan/karyawan. Gunakan hanya project API yang sudah kamu pastikan berada pada Free Tier; jika kuota habis, VIXORA tidak beralih ke provider lain.</p>
        <section class="section-heading"><div><span class="eyebrow">TASK HISTORY</span><h2>Recent tasks</h2></div><span class="muted-label">{tasks.length} DRAFT(S)</span></section>
        {#if tasks.length}
          <div class="task-list">{#each tasks as task}<article class="task-row"><span class="task-symbol">⌘</span><div class="task-title"><strong>{task.title}</strong><small>Created at {task.createdAt} · {task.status === "Saved" ? "Supabase" : "Local"}</small></div><div class="task-actions"><span class="draft-pill">{task.status}</span><button class="run-task-button" type="button" onclick={() => void previewAgent(task.id)} disabled={previewBusyTaskId !== null || aiBusyTaskId !== null}>{previewBusyTaskId === task.id ? 'Testing…' : 'Test dry-run'}</button><button class="run-task-button live-ai-button" type="button" onclick={() => void runAIAgent(task.id)} disabled={aiBusyTaskId !== null || previewBusyTaskId !== null}>{aiBusyTaskId === task.id ? 'Running AI…' : 'Run AI Agent'}</button>{#if runStorageReady}<button class="run-task-button secondary-run-button" type="button" onclick={() => void createAgentRun(task.id)} disabled={runBusyTaskId !== null}>{runBusyTaskId === task.id ? 'Preparing…' : 'Prepare run'}</button>{/if}</div></article>{/each}</div>
        {:else}
          <div class="empty-state"><div class="empty-icon">⌘</div><h3>Belum ada task</h3><p>Tambahkan task pertama. Sign in untuk menyimpan task secara permanen.</p></div>
        {/if}
        {#if agentAIError}<p class="task-feedback is-error" role="alert">{agentAIError}</p>{/if}
        {#if agentAIResult}
          <section class="section-heading ai-result-heading"><div><span class="eyebrow">LIVE GEMINI RESPONSE</span><h2>{agentAIResult.agentName}</h2></div><span class="muted-label">{agentAIResult.model}</span></section>
          <article class="preview-card ai-result-card">
            <div class="preview-meta"><span class="preview-pill">GEMINI · FREE-TIER GUARD</span><span>{new Date(agentAIResult.createdAt).toLocaleString('id-ID')}</span>{#if agentAIResult.usage}<span>Tokens: {agentAIResult.usage.totalTokens ?? 'n/a'}</span>{/if}</div>
            <h3>{agentAIResult.taskTitle}</h3>
            <div class="ai-answer">{agentAIResult.answer}</div>
            <details class="preview-limits"><summary>Model & limitations</summary><ul>{#each agentAIResult.limitations as limitation}<li>{limitation}</li>{/each}</ul></details>
          </article>
        {/if}
        {#if agentPreviewError}<p class="task-feedback is-error" role="alert">{agentPreviewError}</p>{/if}
        {#if agentPreview}
          <section class="section-heading preview-heading"><div><span class="eyebrow">LOCAL TEMPLATE · ZERO EXECUTOR CALLS</span><h2>Dry-run result</h2></div><span class="muted-label">{agentPreview.agentName}</span></section>
          <article class="preview-card">
            <div class="preview-meta"><span class="preview-pill">PREVIEW READY</span><span>{new Date(agentPreview.createdAt).toLocaleString('id-ID')}</span><span>External executor calls: {agentPreview.externalExecutorCalls}</span></div>
            <h3>{agentPreview.taskTitle}</h3>
            <p class="preview-summary">{agentPreview.summary}</p>
            <div class="preview-columns">
              <div><h4>Execution plan</h4><ol>{#each agentPreview.steps as step}<li>{step}</li>{/each}</ol></div>
              <div><h4>Draft deliverables</h4><ul>{#each agentPreview.deliverables as deliverable}<li>{deliverable}</li>{/each}</ul></div>
            </div>
            <div class="preview-next"><strong>Next action</strong><p>{agentPreview.nextAction}</p></div>
            <details class="preview-limits"><summary>Mode & limitations</summary><ul>{#each agentPreview.limitations as limitation}<li>{limitation}</li>{/each}</ul></details>
          </article>
        {/if}
        <section class="section-heading run-heading"><div><span class="eyebrow">ORCHESTRATOR</span><h2>Agent run history</h2></div><span class="muted-label">{agentRuns.length} RUN PLAN(S)</span></section>
        {#if runNotice}
          <p class={runFeedbackError ? 'task-feedback is-error' : 'task-feedback is-success'} role={runFeedbackError ? 'alert' : 'status'}>{runNotice}</p>
        {/if}
        {#if agentRuns.length}
          <div class="run-list">
            {#each agentRuns as run}
              <article class="run-row">
                <span class="run-symbol">✳</span>
                <div class="run-title"><strong>{run.title}</strong><small>{run.output?.agent_name ?? run.assigned_agent ?? 'Agent pending'} · {run.executor ?? 'not connected'} · {new Date(run.created_at).toLocaleString('id-ID')}</small>{#if run.output?.message}<p>{run.output.message}</p>{/if}</div>
                <span class="run-state-pill">{run.status.replaceAll('_', ' ')}</span>
              </article>
            {/each}
          </div>
        {:else if runStorageReady === false}
          <div class="empty-state run-empty"><div class="empty-icon">✳</div><h3>Run storage needs isolated staging DB</h3><p>Riwayat run permanen menunggu database staging yang terpisah. Tombol Test dry-run di atas sudah bisa menampilkan preview lokal tanpa memanggil model AI atau executor. Database produksi tidak diubah.</p></div>
        {:else}
          <div class="empty-state run-empty"><div class="empty-icon">✳</div><h3>No agent runs yet</h3><p>Riwayat run belum tersimpan. Gunakan Test dry-run di atas untuk melihat preview lokal; riwayat agent-run belum ditulis ke database.</p></div>
        {/if}
      {:else if activeTab === 'Agent Hub'}
        <section class="page-intro"><div class="eyebrow">SPECIALIST NETWORK</div><h1>Agent <span>Hub</span></h1><p>Empat spesialis dapat diuji dengan dry-run berbasis template lokal. Model AI dan executor eksternal belum tersambung.</p></section>
        <div class="agent-grid expanded">{#each agents as agent}<article class="agent-card"><div class="agent-card-top"><span class="agent-number">{agent.number}</span><span class="blueprint-pill">LOCAL DRY-RUN</span></div><h3>{agent.name}</h3><p>{agent.description}</p><div class="agent-card-bottom"><span class="agent-status-dot"></span><span>{agent.status}</span></div></article>{/each}</div>
        <section class="notice"><span class="notice-icon">i</span><div><strong>Dry-run runtime aktif</strong><p>Routing dan preview lokal sudah tersedia untuk empat spesialis. Ini bukan keluaran model AI: belum ada panggilan CREAO, n8n, riset web, atau aksi eksternal. Integrasi nyata menunggu audit koneksi dan biaya.</p></div></section>
      {:else if activeTab === 'Automations'}
        <section class="page-intro"><div class="eyebrow">REPEATABLE WORKFLOWS</div><h1>Auto<span>mations</span></h1><p>Tempat mengelola workflow berulang setelah koneksi runtime siap.</p></section>
        <div class="empty-state"><div class="empty-icon">↗</div><h3>Workflow runtime belum tersambung</h3><p>n8n direncanakan sebagai workflow runtime eksternal. Konfigurasi dan credential tidak akan ditaruh di browser.</p></div>
      {:else}
        <section class="page-intro"><div class="eyebrow">SECURE CONNECTIONS</div><h1>Integra<span>tions</span></h1><p>Status koneksi yang aman dan dapat diverifikasi sebelum dipakai dalam produksi.</p></section>
        <div class="integration-list"><article class="integration-row"><div class="integration-logo supabase-logo">S</div><div><strong>Supabase</strong><p>Authentication and persistent task storage</p></div><span class="pending-pill">Not configured</span></article><article class="integration-row"><div class="integration-logo creao-logo">C</div><div><strong>CREAO</strong><p>Existing execution adapter — needs end-to-end verification</p></div><span class="pending-pill">Needs audit</span></article><article class="integration-row"><div class="integration-logo n8n-logo">n8n</div><div><strong>n8n</strong><p>Optional workflow engine for repeatable automations</p></div><span class="pending-pill">Planned</span></article></div>
        <section class="notice"><span class="notice-icon">⌁</span><div><strong>Secret handling</strong><p>API keys, service-role credentials, and executor tokens must stay in server-side Worker secrets. This page never displays secret values.</p></div></section>
      {/if}

      <footer class="footer"><span>VIXORA WORKSPACE <span class="footer-dot">•</span> v3.0 staging</span><span>Built for clarity. Designed for control.</span></footer>
    </div>
  </main>
</div>
