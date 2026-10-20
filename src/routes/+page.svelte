<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  type Tab = 'Overview' | 'AI Workspace' | 'Task Center' | 'Agent Hub' | 'Automations' | 'Integrations';
  type DraftTask = { id: string; title: string; createdAt: string; status: 'Draft' | 'Saved' };
  type AgentRunView = {
    id: string;
    task_id: string | null;
    title: string;
    prompt?: string;
    status: string;
    assigned_agent: string | null;
    executor: string | null;
    created_at: string;
    updated_at?: string;
    started_at?: string | null;
    finished_at?: string | null;
    error_message?: string | null;
    output?: {
      message?: string;
      agent_name?: string;
      model?: string;
      answer?: string;
      mode?: string;
      usage?: { totalTokens?: number | null } | null;
      limitations?: string[];
    } | null;
  };
  type AgentPreview = { mode: string; status: string; externalExecutorCalls: number; executor: string; agentId: string; agentName: string; taskTitle: string; summary: string; steps: string[]; deliverables: string[]; nextAction: string; limitations: string[]; createdAt: string };
  type AgentAIResult = { mode: string; status: string; model: string; agentId: string; agentName: string; taskTitle: string; answer: string; limitations: string[]; usage?: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | null; createdAt: string };

  let activeTab = $state<Tab>('AI Workspace');
  let taskInput = $state('');
  let tasks = $state<DraftTask[]>([]);
  let notice = $state('Workspace baru sedang disiapkan. Task belum dikirim ke executor.');
  let accessToken = $state<string | null>(null);
  let signedInEmail = $state<string | null>(null);
  let taskBusy = $state(false);
  let taskFeedback = $state('');
  let taskFeedbackError = $state(false);
  let agentRuns = $state<AgentRunView[]>([]);
  let runSearch = $state('');
  let runStatusFilter = $state('all');
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

  function dateKeyLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDurationSeconds(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
    if (seconds < 60) return `${Math.round(seconds)} dtk`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes} m ${remainder} dtk`;
    return `${Math.floor(minutes / 60)} j ${minutes % 60} m`;
  }

  let runAnalytics = $derived.by(() => {
    const succeeded = agentRuns.filter((run) => run.status === 'succeeded').length;
    const failed = agentRuns.filter((run) => run.status === 'failed').length;
    const completedCount = succeeded + failed;
    const durations = agentRuns
      .filter((run) => (run.status === 'succeeded' || run.status === 'failed') && run.started_at && run.finished_at)
      .map((run) => (Date.parse(run.finished_at as string) - Date.parse(run.started_at as string)) / 1000)
      .filter((seconds) => Number.isFinite(seconds) && seconds >= 0);
    const averageSeconds = durations.length
      ? durations.reduce((total, seconds) => total + seconds, 0) / durations.length
      : null;

    const modelGroups = new Map<string, {
      model: string;
      total: number;
      succeeded: number;
      failed: number;
      durations: number[];
    }>();
    for (const run of agentRuns) {
      if (run.executor !== 'gemini-api' && !run.output?.model) continue;
      const modelFromError = run.error_message?.match(/Gemini \(([^)]+)\)/i)?.[1]?.trim();
      const model = run.output?.model?.trim() || modelFromError || 'Model belum tercatat';
      let group = modelGroups.get(model);
      if (!group) {
        group = { model, total: 0, succeeded: 0, failed: 0, durations: [] };
        modelGroups.set(model, group);
      }
      group.total += 1;
      if (run.status === 'succeeded') group.succeeded += 1;
      if (run.status === 'failed') group.failed += 1;
      if ((run.status === 'succeeded' || run.status === 'failed') && run.started_at && run.finished_at) {
        const seconds = (Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000;
        if (Number.isFinite(seconds) && seconds >= 0) group.durations.push(seconds);
      }
    }
    const modelStats = [...modelGroups.values()]
      .map((group) => {
        const completed = group.succeeded + group.failed;
        const average = group.durations.length
          ? group.durations.reduce((total, seconds) => total + seconds, 0) / group.durations.length
          : null;
        return {
          model: group.model,
          total: group.total,
          succeeded: group.succeeded,
          failed: group.failed,
          completed,
          successRate: completed ? Math.round((group.succeeded / completed) * 100) : null,
          averageDuration: formatDurationSeconds(average)
        };
      })
      .sort((a, b) => b.total - a.total || a.model.localeCompare(b.model));

    const today = new Date();
    const activityDays = Array.from({ length: 7 }, (_unused, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
      const key = dateKeyLocal(date);
      const count = agentRuns.filter((run) => dateKeyLocal(new Date(run.created_at)) === key).length;
      return {
        key,
        label: date.toLocaleDateString('id-ID', { weekday: 'short' }),
        dateLabel: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        count
      };
    });
    const peakActivity = Math.max(0, ...activityDays.map((day) => day.count));
    return {
      total: agentRuns.length,
      succeeded,
      failed,
      completedCount,
      successRate: completedCount ? Math.round((succeeded / completedCount) * 100) : null,
      averageDuration: formatDurationSeconds(averageSeconds),
      modelStats,
      activityDays: activityDays.map((day) => ({
        ...day,
        heightPercent: peakActivity ? (day.count ? Math.max(12, (day.count / peakActivity) * 100) : 4) : 4
      })),
      peakActivity
    };
  });

  let filteredAgentRuns = $derived(agentRuns.filter((run) => {
    const query = runSearch.trim().toLocaleLowerCase('id-ID');
    const searchable = [
      run.title,
      run.prompt ?? '',
      run.assigned_agent ?? '',
      run.output?.agent_name ?? '',
      run.output?.model ?? '',
      run.error_message ?? ''
    ].join(' ').toLocaleLowerCase('id-ID');
    const matchesSearch = !query || searchable.includes(query);
    const matchesStatus = runStatusFilter === 'all' || run.status === runStatusFilter;
    return matchesSearch && matchesStatus;
  }));

  type MarkdownBlock =
    | { type: 'heading'; level: number; content: string }
    | { type: 'paragraph'; content: string }
    | { type: 'ul' | 'ol'; items: string[] }
    | { type: 'quote'; content: string }
    | { type: 'code'; content: string }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'hr' };

  function escapeMarkdownHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Render a small, safe Markdown subset. Raw HTML is escaped before we add our own allowed tags.
  function renderInlineMarkdown(value: string): string {
    let html = escapeMarkdownHtml(value);
    const codeSpans: string[] = [];
    html = html.replace(/`([^`]+)`/g, (_match, code: string) => {
      const token = `\uE000${codeSpans.length}\uE001`;
      codeSpans.push(`<code>${code}</code>`);
      return token;
    });
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    html = html.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)<>]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return html.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => codeSpans[Number(index)] ?? '');
  }

  function renderMarkdown(markdown: string): string {
    const blocks: MarkdownBlock[] = [];
    const paragraph: string[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let codeLines: string[] = [];
    let inCodeBlock = false;
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');

    const splitTableRow = (line: string): string[] =>
      line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    const isTableSeparator = (line: string): boolean => {
      const cells = splitTableRow(line);
      return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
    };

    const flushParagraph = () => {
      if (paragraph.length) {
        blocks.push({ type: 'paragraph', content: paragraph.join(' ') });
        paragraph.length = 0;
      }
    };
    const flushList = () => {
      if (listType && listItems.length) blocks.push({ type: listType, items: listItems });
      listItems = [];
      listType = null;
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmed = line.trim();
      if (inCodeBlock) {
        if (/^```/.test(trimmed)) {
          blocks.push({ type: 'code', content: codeLines.join('\n') });
          codeLines = [];
          inCodeBlock = false;
        } else {
          codeLines.push(line);
        }
        continue;
      }
      if (/^```/.test(trimmed)) {
        flushParagraph();
        flushList();
        inCodeBlock = true;
        codeLines = [];
        continue;
      }
      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }
      // GitHub-flavoured Markdown table: header followed by a separator row.
      if (line.includes('|') && lineIndex + 1 < lines.length && isTableSeparator(lines[lineIndex + 1])) {
        flushParagraph();
        flushList();
        const headers = splitTableRow(line);
        lineIndex++;
        const rows: string[][] = [];
        while (lineIndex + 1 < lines.length) {
          const rowLine = lines[lineIndex + 1].trim();
          if (!rowLine || !rowLine.includes('|')) break;
          if (isTableSeparator(rowLine)) {
            lineIndex++;
            continue;
          }
          const cells = splitTableRow(rowLine);
          rows.push(headers.map((_header, cellIndex) => cells[cellIndex] ?? ''));
          lineIndex++;
        }
        blocks.push({ type: 'table', headers, rows });
        continue;
      }
      const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        flushParagraph();
        flushList();
        blocks.push({ type: 'heading', level: heading[1].length, content: heading[2] });
        continue;
      }
      if (/^(---+|\*\s*)$/.test(trimmed)) {
        flushParagraph();
        flushList();
        blocks.push({ type: 'hr' });
        continue;
      }
      const quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        flushList();
        blocks.push({ type: 'quote', content: quote[1] });
        continue;
      }
      const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      const nextListType = bullet ? 'ul' : numbered ? 'ol' : null;
      if (nextListType) {
        flushParagraph();
        if (listType && listType !== nextListType) flushList();
        listType = nextListType;
        listItems.push(bullet?.[1] ?? numbered?.[1] ?? '');
        continue;
      }
      flushList();
      paragraph.push(trimmed);
    }
    flushParagraph();
    flushList();
    if (inCodeBlock) blocks.push({ type: 'code', content: codeLines.join('\n') });

    return blocks.map((block) => {
      if (block.type === 'heading') return `<h${block.level}>${renderInlineMarkdown(block.content)}</h${block.level}>`;
      if (block.type === 'paragraph') return `<p>${renderInlineMarkdown(block.content)}</p>`;
      if (block.type === 'ul' || block.type === 'ol') {
        const items = block.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('');
        return block.type === 'ul' ? `<ul>${items}</ul>` : `<ol>${items}</ol>`;
      }
      if (block.type === 'quote') return `<blockquote>${renderInlineMarkdown(block.content)}</blockquote>`;
      if (block.type === 'code') return `<pre><code>${escapeMarkdownHtml(block.content)}</code></pre>`;
      if (block.type === 'table') {
        const headers = block.headers.map((header) => `<th scope="col">${renderInlineMarkdown(header)}</th>`).join('');
        const rows = block.rows.map((row) =>
          `<tr>${block.headers.map((_header, index) => `<td>${renderInlineMarkdown(row[index] ?? '')}</td>`).join('')}</tr>`
        ).join('');
        return `<div class="ai-table-wrap"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      return '<hr />';
    }).join('\n');
  }


  function formatRunDuration(run: AgentRunView): string {
    if (!run.started_at) return run.status === 'planned' ? 'Belum dimulai' : 'Durasi tidak tersedia';
    const start = Date.parse(run.started_at);
    const end = run.finished_at
      ? Date.parse(run.finished_at)
      : run.status === 'running'
        ? Date.now()
        : Date.parse(run.updated_at ?? run.created_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 'Durasi tidak tersedia';
    const seconds = Math.round((end - start) / 1000);
    if (seconds < 60) return `${seconds} dtk`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    if (minutes < 60) return `${minutes} m ${remainder} dtk`;
    return `${Math.floor(minutes / 60)} j ${minutes % 60} m`;
  }

  function formatRunStatus(status: string): string {
    const labels: Record<string, string> = {
      planned: 'Rencana',
      queued: 'Antrean',
      planning: 'Merencanakan',
      awaiting_approval: 'Menunggu persetujuan',
      running: 'Berjalan',
      succeeded: 'Berhasil',
      failed: 'Gagal',
      cancelled: 'Dibatalkan'
    };
    return labels[status] ?? status.replaceAll('_', ' ');
  }

  async function refreshAgentRuns() {
    const token = await getFreshAccessToken();
    if (!token) {
      runNotice = 'Sesi login sudah berakhir. Login kembali untuk memuat riwayat.';
      runFeedbackError = true;
      return;
    }
    await loadAgentRuns(token);
  }

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

  async function getFreshAccessToken(forceRefresh = false): Promise<string | null> {
    const current = await supabase.auth.getSession();
    let session = current.data.session;

    if (current.error || !session) {
      accessToken = null;
      signedInEmail = null;
      return null;
    }

    const expiresSoon = !session.expires_at || session.expires_at * 1000 <= Date.now() + 60_000;
    if (forceRefresh || expiresSoon) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
      if (refreshed.error || !session) {
        accessToken = null;
        signedInEmail = null;
        return null;
      }
    }

    accessToken = session.access_token;
    signedInEmail = session.user.email ?? null;
    return session.access_token;
  }

  async function runAIAgent(taskId: string) {
    if (aiBusyTaskId) return;
    aiBusyTaskId = taskId;
    agentAIError = '';
    agentAIResult = null;
    let token: string | null = null;
    let runId: string | null = null;
    let attemptedModel: string | null = null;
    let startedAgentName = 'AI Agent';

    const updateRun = async (
      bearer: string,
      id: string,
      status: 'succeeded' | 'failed',
      details: { output?: Record<string, unknown>; error_message?: string }
    ): Promise<AgentRunView | null> => {
      try {
        const response = await fetch('/api/agent-runs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
          body: JSON.stringify({ run_id: id, status, ...details })
        });
        const payload = await response.json() as { run?: AgentRunView };
        return response.ok ? payload.run ?? null : null;
      } catch {
        return null;
      }
    };

    try {
      token = await getFreshAccessToken();
      if (!token) {
        agentAIError = 'Sesi login tidak tersedia atau sudah kedaluwarsa. Silakan login kembali.';
        await goto('/login');
        return;
      }

      // Persist the run first, so each AI request has a durable history record.
      const startResponse = await fetch('/api/agent-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ task_id: taskId, run_kind: 'ai' })
      });
      const startPayload = await startResponse.json() as { run?: AgentRunView; error?: string; message?: string };
      if (!startResponse.ok || !startPayload.run?.id) {
        throw new Error(startPayload.message || startPayload.error || 'Riwayat Agent Run tidak bisa disimpan. AI belum dipanggil.');
      }
      runId = startPayload.run.id;
      startedAgentName = startPayload.run.output?.agent_name ?? startPayload.run.assigned_agent ?? 'AI Agent';
      agentRuns = [startPayload.run, ...agentRuns.filter((run) => run.id !== runId)];
      runStorageReady = true;
      runNotice = '';
      runFeedbackError = false;

      const sendRequest = (bearer: string) => fetch('/api/agent-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ task_id: taskId })
      });

      let response = await sendRequest(token);
      if (response.status === 401) {
        const previousToken = token;
        token = await getFreshAccessToken(true);
        if (!token) {
          if (previousToken && runId) {
            const failedRun = await updateRun(previousToken, runId, 'failed', { error_message: 'Sesi Supabase kedaluwarsa sebelum AI selesai.' });
            if (failedRun) agentRuns = [failedRun, ...agentRuns.filter((run) => run.id !== failedRun.id)];
          }
          agentAIError = 'Sesi login kedaluwarsa. Silakan login kembali lalu jalankan task ini lagi.';
          await goto('/login');
          return;
        }
        response = await sendRequest(token);
      }

      const result = await response.json() as { result?: AgentAIResult; error?: string; message?: string; model?: string };
      if (typeof result.model === 'string' && result.model.trim()) attemptedModel = result.model.trim();
      if (!response.ok || !result.result) {
        const message = result.message || result.error || 'AI Agent belum berhasil dijalankan.';
        throw new Error(message);
      }

      agentAIResult = result.result;
      activeTab = 'Task Center';
      const completedRun = await updateRun(token, runId, 'succeeded', {
        output: {
          mode: result.result.mode,
          model: result.result.model,
          agent_name: result.result.agentName,
          answer: result.result.answer,
          limitations: result.result.limitations,
          usage: result.result.usage ?? null,
          message: 'AI run completed successfully.'
        }
      });
      if (completedRun) {
        agentRuns = [completedRun, ...agentRuns.filter((run) => run.id !== completedRun.id)];
        runNotice = 'Hasil AI dan status run tersimpan di database staging.';
        runFeedbackError = false;
      } else {
        runNotice = 'Jawaban AI berhasil, tetapi status akhir belum tersimpan. Refresh run history atau coba lagi.';
        runFeedbackError = true;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'AI Agent belum berhasil dijalankan.';
      agentAIError = message;
      if (runId && token) {
        const persistedError = attemptedModel && !message.includes(attemptedModel)
          ? `Gemini (${attemptedModel}) gagal: ${message}`
          : message;
        const failedRun = await updateRun(token, runId, 'failed', { error_message: persistedError });
        if (failedRun) agentRuns = [failedRun, ...agentRuns.filter((run) => run.id !== failedRun.id)];
      }
    } finally {
      aiBusyTaskId = null;
    }
  }
  const workspaceAgentDefinitions = [
    { id: 'content-studio', name: 'Content Studio', role: 'Creative Lab', summary: 'Hooks, scripts & captions' },
    { id: 'research-agent', name: 'Research Agent', role: 'Insight Lab', summary: 'Research & evidence' },
    { id: 'workflow-planner', name: 'Workflow Planner', role: 'Automation Bay', summary: 'Workflows & integrations' },
    { id: 'strategy-planner', name: 'Strategy & Planner', role: 'Command Desk', summary: 'Planning & decisions' }
  ] as const;

  let workspaceMotion = $state(true);
  let roomAgents = $derived.by(() => workspaceAgentDefinitions.map((agent) => {
    const latestRun = agentRuns.find((run) =>
      run.assigned_agent === agent.id || run.output?.agent_name === agent.name
    );
    const state = latestRun?.status === 'running'
      ? 'working'
      : latestRun?.status === 'failed'
        ? 'attention'
        : latestRun?.status === 'succeeded'
          ? 'done'
          : latestRun && ['queued', 'planning', 'awaiting_approval'].includes(latestRun.status)
            ? 'queued'
            : latestRun?.status === 'planned'
              ? 'ready'
              : 'idle';
    const statusLabel = state === 'working'
      ? 'SEDANG BEKERJA'
      : state === 'attention'
        ? 'PERLU DICEK'
        : state === 'done'
          ? 'TASK SELESAI'
          : state === 'queued'
            ? 'DALAM ANTREAN'
            : state === 'ready'
              ? 'SIAP BERTUGAS'
              : 'STANDBY';
    return {
      ...agent,
      state,
      statusLabel,
      taskTitle: latestRun?.title ?? 'Menunggu task pertama',
      model: latestRun?.output?.model ?? (latestRun?.executor === 'gemini-api' ? 'Gemini API' : 'Local runtime'),
      runId: latestRun?.id ?? null
    };
  }));

  const tabs: Tab[] = ['Overview', 'AI Workspace', 'Task Center', 'Agent Hub', 'Automations', 'Integrations'];

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
          <span class="nav-icon">{tab === 'Overview' ? '◫' : tab === 'AI Workspace' ? '⬡' : tab === 'Task Center' ? '⌘' : tab === 'Agent Hub' ? '✳' : tab === 'Automations' ? '↗' : '⌁'}</span>
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
          <article class="metric-card"><div class="metric-top"><span>Agent blueprints</span><span class="metric-icon cyan">✳</span></div><div class="metric-value">04</div><div class="metric-foot"><span class="neutral-dot"></span> Local dry-run ready · AI runtime connected</div></article>
          <article class="metric-card"><div class="metric-top"><span>Agent runs</span><span class="metric-icon amber">↗</span></div><div class="metric-value">{runStorageReady === true ? runAnalytics.total.toString().padStart(2, '0') : '—'}</div><div class="metric-foot"><span class="neutral-dot"></span> Latest 50 saved records</div></article>
          <article class="metric-card"><div class="metric-top"><span>Quality checks</span><span class="metric-icon green">✓</span></div><div class="metric-value">—</div><div class="metric-foot"><span class="neutral-dot"></span> Not run yet</div></article>
        </div>

        <section class="section-heading analytics-heading">
          <div><span class="eyebrow">RUN PERFORMANCE</span><h2>Agent analytics</h2><p class="analytics-subtitle">Ringkasan dari maksimum 50 run terbaru di database staging.</p></div>
          <button class="run-refresh-button" type="button" onclick={() => void refreshAgentRuns()}>↻ Refresh data</button>
        </section>
        {#if runStorageReady === true}
          <div class="analytics-metrics">
            <article class="analytics-card"><div class="analytics-card-top"><span>Total runs</span><span class="analytics-icon">↗</span></div><strong>{runAnalytics.total}</strong><small>Riwayat tersimpan</small></article>
            <article class="analytics-card"><div class="analytics-card-top"><span>Success rate</span><span class="analytics-icon success">✓</span></div><strong>{runAnalytics.successRate === null ? '—' : `${runAnalytics.successRate}%`}</strong><small>{runAnalytics.succeeded} berhasil · {runAnalytics.completedCount} selesai</small></article>
            <article class="analytics-card"><div class="analytics-card-top"><span>Failed runs</span><span class="analytics-icon failure">!</span></div><strong>{runAnalytics.failed}</strong><small>Run yang gagal</small></article>
            <article class="analytics-card"><div class="analytics-card-top"><span>Avg. duration</span><span class="analytics-icon duration">◷</span></div><strong>{runAnalytics.averageDuration}</strong><small>Run selesai dengan durasi tercatat</small></article>
          </div>
          <article class="panel activity-panel">
            <div class="panel-heading"><div><span class="eyebrow">LAST 7 DAYS</span><h2>Run activity</h2></div><span class="activity-peak">{runAnalytics.total ? `${runAnalytics.total} run dimuat` : 'Belum ada run'}</span></div>
            <div class="activity-chart" role="img" aria-label="Grafik aktivitas Agent Run tujuh hari terakhir">
              {#each runAnalytics.activityDays as day (day.key)}
                <div class="activity-day" aria-label={`${day.dateLabel}: ${day.count} run`}>
                  <span class="activity-count">{day.count}</span>
                  <div class="activity-bar-track"><div class="activity-bar-fill" style={`height: ${day.heightPercent}%`}></div></div>
                  <span class="activity-weekday">{day.label}</span>
                  <span class="activity-date">{day.dateLabel}</span>
                </div>
              {/each}
            </div>
            <p class="activity-footnote">Berdasarkan waktu dibuat pada browser lokal; run di luar 50 record terbaru tidak dihitung dalam ringkasan ini.</p>
          </article>
          <article class="panel model-health-panel">
            <div class="panel-heading model-health-heading">
              <div><span class="eyebrow">MODEL HEALTH</span><h2>Performa per model</h2><p class="analytics-subtitle">Keberhasilan, kegagalan, dan durasi berdasarkan maksimal 50 run terakhir.</p></div>
              <span class="activity-peak">{runAnalytics.modelStats.length} model</span>
            </div>
            {#if runAnalytics.modelStats.length}
              <div class="model-health-table-wrap">
                <table class="model-health-table">
                  <thead>
                    <tr><th scope="col">Model</th><th scope="col">Total run</th><th scope="col">Berhasil</th><th scope="col">Gagal</th><th scope="col">Success rate</th><th scope="col">Rata-rata durasi</th></tr>
                  </thead>
                  <tbody>
                    {#each runAnalytics.modelStats as model (model.model)}
                      <tr>
                        <th scope="row"><span class="model-health-name">{model.model}</span></th>
                        <td>{model.total}</td>
                        <td><span class="model-health-success">{model.succeeded}</span></td>
                        <td><span class:run-number-failure={model.failed > 0}>{model.failed}</span></td>
                        <td>{model.successRate === null ? '—' : `${model.successRate}%`}</td>
                        <td>{model.averageDuration}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              {#if runAnalytics.modelStats.some((model) => model.model === 'Model belum tercatat')}
                <p class="activity-footnote">Sebagian run lama belum menyimpan nama model pada hasilnya. Run baru akan mencantumkan model pada pesan error jika Gemini mengembalikan informasi model.</p>
              {/if}
            {:else}
              <p class="model-health-empty">Belum ada run AI dengan informasi model. Jalankan satu task AI untuk mulai mengumpulkan metrik.</p>
            {/if}
          </article>
        {:else if runStorageReady === false}
          <div class="analytics-unavailable"><span>i</span><div><strong>Analytics belum tersedia</strong><p>{runNotice || 'Database Agent Run staging belum bisa dimuat.'}</p></div></div>
        {:else}
          <div class="analytics-unavailable"><span>◷</span><div><strong>Memuat analytics…</strong><p>Ringkasan akan muncul setelah riwayat Agent Run berhasil dimuat.</p></div></div>
        {/if}

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
      {:else if activeTab === 'AI Workspace'}
        <section class="page-intro workspace-intro">
          <div class="eyebrow"><span class="eyebrow-line"></span> VIXORA COZY AI STUDIO</div>
          <h1>AI Cozy <span>Workspace</span></h1>
          <p>Kantor kecil tempat tim AI bekerja dengan santai, saling bantu, dan sesekali rehat ngopi. Aktivitas robot dibuat hidup; status tugas tetap mengikuti Agent Run yang benar-benar tersimpan.</p>
        </section>

        <section class="digital-floor-toolbar" aria-label="Digital workspace controls">
          <div class="floor-live-status"><span class="floor-live-dot"></span><div><strong>COZY OFFICE ONLINE</strong><small>Staging runtime · refresh data kapan saja</small></div></div>
          <div class="floor-quick-stats">
            <div class="floor-stat"><span>Agent bekerja</span><strong>{agentRuns.filter((run) => run.status === 'running').length.toString().padStart(2, '0')}</strong></div>
            <div class="floor-stat"><span>Task berhasil</span><strong>{agentRuns.filter((run) => run.status === 'succeeded').length.toString().padStart(2, '0')}</strong></div>
            <div class="floor-stat"><span>Riwayat dimuat</span><strong>{agentRuns.length.toString().padStart(2, '0')}</strong></div>
          </div>
          <div class="floor-actions">
            <button class:floor-toggle-active={workspaceMotion} class="floor-motion-button" type="button" onclick={() => workspaceMotion = !workspaceMotion} aria-pressed={workspaceMotion}>{workspaceMotion ? 'Ⅱ Pause motion' : '▶ Resume motion'}</button>
            <button class="floor-refresh-button" type="button" onclick={() => void refreshAgentRuns()}>↻ Sync agents</button>
          </div>
        </section>

        <section class="ai-office-shell" aria-label="Animated AI team room">
          <div class="office-scene-topline"><span><i></i> DIGITAL FLOOR / 01</span><span>VIXORA LITTLE AI STUDIO</span><span class="office-signal">● SIGNAL STABLE</span></div>
          <div class="ai-office-scene" class:motion-paused={!workspaceMotion}>
            <div class="office-backwall">
              <div class="office-window-grid"></div>
              <div class="office-window-glow"></div>
              <div class="office-wall-orbit orbit-one"></div>
              <div class="office-wall-orbit orbit-two"></div>
            </div>

            <div class="office-wall-workboard" aria-hidden="true">
              <div class="wall-board-header"><span>TEAM NOTEBOOK</span><span>✦ take it easy</span></div>
              <div class="wall-board-body">
                <div class="wall-board-calendar"><span class="board-subtitle">TODAY'S LITTLE PLAN</span><i></i><i></i><i></i><i></i><i></i></div>
                <div class="wall-board-sticky sticky-red"><i></i><i></i><span>make cool stuff</span></div>
                <div class="wall-board-sticky sticky-yellow"><i></i><i></i><span>research ✦</span></div>
                <div class="wall-board-sticky sticky-green"><i></i><i></i><span>one step at a time</span></div>
                <div class="wall-board-mini-chart"><i></i><i></i><i></i><i></i><i></i></div>
              </div>
            </div>
            <div class="office-wall-shelf shelf-left" aria-hidden="true"><i></i><i></i><span></span><b></b></div>
            <div class="office-wall-shelf shelf-right" aria-hidden="true"><i></i><i></i><span></span><b></b></div>

            <div class="office-light-strip"></div>
            <div class="office-floor-grid"></div>
            <div class="office-floor-glow"></div>
            <div class="office-floor-ring ring-large"></div><div class="office-floor-ring ring-small"></div>
            <div class="office-cable cable-one"></div><div class="office-cable cable-two"></div>

            <div class="cozy-office-decor" aria-hidden="true">
              <div class="office-window-sun"><i></i><b></b></div>
              <div class="office-sofa"><span></span><i></i><b></b></div>
              <div class="office-plant plant-left"><i></i><i></i><i></i><i></i><i></i><span></span></div>
              <div class="office-plant plant-right"><i></i><i></i><i></i><i></i><i></i><span></span></div>
              <div class="office-coffee-cart"><span class="cart-shelf"></span><span class="cart-leg cart-leg-left"></span><span class="cart-leg cart-leg-right"></span><span class="cart-mug mug-one"><i></i></span><span class="cart-mug mug-two"><i></i></span><span class="cart-jar"></span></div>
              <div class="office-wall-note"><i></i><i></i><span>one task at a time ✦</span></div>
              <div class="office-rug"></div>
            </div>

            {#each roomAgents as agent, index (agent.id)}
              <button
                type="button"
                class={`office-station station-${agent.id} robot-state-${agent.state}`}
                aria-label={`Buka riwayat ${agent.name}; status ${agent.statusLabel}`}
                onclick={() => { runSearch = agent.id; activeTab = 'Task Center'; }}
              >
                <span class="station-orbit" aria-hidden="true"></span>
                <span class="station-number">0{index + 1}</span>
                <span class="station-coffee-cup" aria-hidden="true"><i></i><b></b></span>
                <div class="station-chair" aria-hidden="true"><span></span><i></i><b></b></div>
                <div class="office-robot" aria-hidden="true">
                  <span class="robot-shadow"></span>
                  <span class="robot-antenna"><i></i></span>
                  <span class="robot-head">
                    <span class="robot-ear robot-ear-left"></span><span class="robot-ear robot-ear-right"></span>
                    <span class="robot-face"><i></i><i></i><b></b></span>
                  </span>
                  <span class="robot-neck"></span>
                  <span class="robot-body"><i class="robot-chest-light"></i><b></b></span>
                  <span class="robot-arm robot-arm-left"><i></i><b></b></span>
                  <span class="robot-arm robot-arm-right"><i></i><b></b></span>
                  <span class="robot-leg robot-leg-left"><i></i></span><span class="robot-leg robot-leg-right"><i></i></span>
                </div>
                {#if agent.id === 'content-studio'}
                  <div class="station-special-prop prop-content" aria-hidden="true"><span class="content-canvas"><i></i><b></b><em></em></span><span class="content-swatch swatch-one"></span><span class="content-swatch swatch-two"></span><span class="content-swatch swatch-three"></span><span class="content-pencil"></span></div>
                {:else if agent.id === 'research-agent'}
                  <div class="station-special-prop prop-research" aria-hidden="true"><span class="research-chart"><i></i><i></i><i></i><i></i><i></i></span><span class="research-lens"></span><span class="research-notes"><i></i><i></i><i></i></span></div>
                {:else if agent.id === 'workflow-planner'}
                  <div class="station-special-prop prop-workflow" aria-hidden="true"><span class="flow-node node-one"></span><span class="flow-node node-two"></span><span class="flow-node node-three"></span><span class="flow-node node-four"></span><span class="flow-link link-one"></span><span class="flow-link link-two"></span><span class="flow-link link-three"></span></div>
                {:else}
                  <div class="station-special-prop prop-strategy" aria-hidden="true"><span class="strategy-note note-one"></span><span class="strategy-note note-two"></span><span class="strategy-note note-three"></span><span class="strategy-chart"><i></i><i></i><i></i><i></i></span><span class="strategy-pencil"></span></div>
                {/if}
                <div class="station-computer" aria-hidden="true">
                  <div class="station-monitor"><div class="monitor-camera"></div><div class="monitor-screen"><span></span><i></i><i></i><b></b><i></i></div><div class="monitor-neck"></div></div>
                  <div class="station-keyboard"><i></i><i></i><i></i><i></i></div>
                </div>
                <span class="station-desk-top" aria-hidden="true"></span><span class="station-desk-front" aria-hidden="true"></span><span class="station-desk-leg desk-leg-left" aria-hidden="true"></span><span class="station-desk-leg desk-leg-right" aria-hidden="true"></span>
                <span class="station-task-card">
                  <span class="station-agent-role">{agent.role}</span>
                  <strong>{agent.name}</strong>
                  <small>{agent.taskTitle}</small>
                  <span class="station-status"><i></i>{agent.statusLabel}</span>
                </span>
                <span class="station-open-hint">TAP TO SEE TASK ↗</span>
              </button>
            {/each}

            <div class="office-walking-bot" aria-hidden="true">
              <span class="walker-shadow"></span>
              <span class="walker-antenna"></span>
              <span class="walker-head"><i></i><i></i><b></b></span>
              <span class="walker-body"><i></i></span>
              <span class="walker-arm walker-arm-left"></span><span class="walker-arm walker-arm-right"></span>
              <span class="walker-leg walker-leg-left"></span><span class="walker-leg walker-leg-right"></span>
              <span class="walker-clipboard"><i></i><i></i><i></i></span>
              <span class="walker-thought">task delivery!</span>
            </div>
            <div class="office-floor-mark" aria-hidden="true">VIXORA <span>AI OPERATIONS</span></div>
            <div class="office-room-reflection" aria-hidden="true"></div>
          </div>
          <div class="office-scene-legend"><span><i class="legend-working"></i> Working</span><span><i class="legend-done"></i> Completed</span><span><i class="legend-attention"></i> Needs attention</span><span class="legend-tip">Klik workstation untuk membuka Task Center agent tersebut.</span></div>
        </section>

        <section class="workspace-agent-roster">
          <div class="section-heading"><div><span class="eyebrow">THE PEOPLE BEHIND THE PROMPTS</span><h2>Agent workstations</h2><p class="analytics-subtitle">Pilih satu robot untuk melihat tugas dan riwayatnya.</p></div><button class="text-button" onclick={() => activeTab = 'Task Center'}>Open Task Center <span>→</span></button></div>
          <div class="workspace-agent-grid">
            {#each roomAgents as agent (agent.id)}
              <button type="button" class={`workspace-agent-card robot-state-${agent.state}`} onclick={() => { runSearch = agent.id; activeTab = 'Task Center'; }}>
                <span class="workspace-agent-avatar"><i></i><i></i><b></b></span>
                <span class="workspace-agent-details"><strong>{agent.name}</strong><small>{agent.summary}</small><span class="workspace-agent-status"><i></i>{agent.statusLabel}</span></span>
                <span class="workspace-agent-arrow">↗</span>
              </button>
            {/each}
          </div>
        </section>

      {:else if activeTab === 'Task Center'}
        <section class="page-intro"><div class="eyebrow">WORK QUEUE</div><h1>Task <span>Center</span></h1><p>Draft tugas dan riwayat yang akan dikelola oleh orchestrator.</p></section>
        <article class="panel task-panel"><div class="panel-heading"><div><span class="eyebrow">NEW TASK</span><h2>Capture an objective</h2></div></div><form onsubmit={createDraft}><label class="sr-only" for="task-input">Describe a task</label><textarea id="task-input" bind:value={taskInput} placeholder="Jelaskan hasil yang ingin kamu capai…" rows="3"></textarea><div class="composer-footer"><span>Belum menjalankan agent</span><button class="primary-button" type="submit" disabled={!taskInput.trim() || taskBusy}>{taskBusy ? 'Saving…' : 'Save draft'} <span>↗</span></button></div></form>{#if taskFeedback}<p class={taskFeedbackError ? 'task-feedback is-error' : 'task-feedback is-success'} role={taskFeedbackError ? 'alert' : 'status'}>{taskFeedback}</p>{/if}</article>
        <p class="ai-privacy-note">Run AI Agent mengirim isi task ke Gemini API untuk menghasilkan teks/draft. Jangan masukkan kata sandi, API key, atau data sensitif perusahaan/karyawan. Gunakan hanya project API yang sudah kamu pastikan berada pada Free Tier; jika kuota habis, VIXORA tidak beralih ke provider lain.</p>
        <section class="section-heading"><div><span class="eyebrow">TASK HISTORY</span><h2>Recent tasks</h2></div><span class="muted-label">{tasks.length} DRAFT(S)</span></section>
        {#if tasks.length}
          <div class="task-list">{#each tasks as task (task.id)}<article class="task-row" aria-busy={aiBusyTaskId === task.id}><span class="task-symbol">⌘</span><div class="task-title"><strong>{task.title}</strong><small>Created at {task.createdAt} · {task.status === "Saved" ? "Supabase" : "Local"}</small></div><div class="task-actions"><span class="draft-pill">{task.status}</span><button class="run-task-button" type="button" onclick={() => void previewAgent(task.id)} disabled={previewBusyTaskId !== null || aiBusyTaskId !== null}>{previewBusyTaskId === task.id ? 'Testing…' : 'Test dry-run'}</button><button class="run-task-button live-ai-button" class:is-running={aiBusyTaskId === task.id} type="button" onclick={() => void runAIAgent(task.id)} disabled={aiBusyTaskId !== null || previewBusyTaskId !== null} aria-label={aiBusyTaskId === task.id ? `Running AI Agent for ${task.title}` : `Run AI Agent for ${task.title}`}>{aiBusyTaskId === task.id ? 'Running AI…' : 'Run AI Agent'}</button>{#if runStorageReady}<button class="run-task-button secondary-run-button" type="button" onclick={() => void createAgentRun(task.id)} disabled={runBusyTaskId !== null}>{runBusyTaskId === task.id ? 'Preparing…' : 'Prepare run'}</button>{/if}</div></article>{/each}</div>
        {:else}
          <div class="empty-state"><div class="empty-icon">⌘</div><h3>Belum ada task</h3><p>Tambahkan task pertama. Sign in untuk menyimpan task secara permanen.</p></div>
        {/if}
        {#if agentAIError}<p class="task-feedback is-error" role="alert">{agentAIError}</p>{/if}
        {#if agentAIResult}
          <section class="section-heading ai-result-heading"><div><span class="eyebrow">LIVE GEMINI RESPONSE</span><h2>{agentAIResult.agentName}</h2></div><span class="muted-label">{agentAIResult.model}</span></section>
          <article class="preview-card ai-result-card">
            <div class="preview-meta"><span class="preview-pill">GEMINI · FREE-TIER GUARD</span><span>{new Date(agentAIResult.createdAt).toLocaleString('id-ID')}</span>{#if agentAIResult.usage}<span>Tokens: {agentAIResult.usage.totalTokens ?? 'n/a'}</span>{/if}</div>
            <h3>{agentAIResult.taskTitle}</h3>
            <div class="ai-answer">{@html renderMarkdown(agentAIResult.answer)}</div>
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
        <section class="section-heading run-heading"><div><span class="eyebrow">ORCHESTRATOR</span><h2>Agent run history</h2><p class="run-heading-note">Riwayat permanen dari database staging · maksimal 50 run terbaru</p></div><span class="muted-label">{filteredAgentRuns.length} / {agentRuns.length} RUN</span></section>
        {#if runNotice}
          <p class={runFeedbackError ? 'task-feedback is-error' : 'task-feedback is-success'} role={runFeedbackError ? 'alert' : 'status'}>{runNotice}</p>
        {/if}
        {#if agentRuns.length}
          <div class="run-toolbar">
            <label class="run-search-box">
              <span aria-hidden="true">⌕</span>
              <input type="search" bind:value={runSearch} placeholder="Cari task, agent, model, atau error…" aria-label="Cari Agent Run History" />
            </label>
            <label class="run-filter-box">
              <span>Status</span>
              <select bind:value={runStatusFilter} aria-label="Filter status Agent Run">
                <option value="all">Semua status</option>
                <option value="succeeded">Berhasil</option>
                <option value="failed">Gagal</option>
                <option value="running">Berjalan</option>
                <option value="planned">Rencana</option>
                <option value="queued">Antrean</option>
                <option value="planning">Merencanakan</option>
                <option value="awaiting_approval">Menunggu persetujuan</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </label>
            <button class="run-refresh-button" type="button" onclick={() => void refreshAgentRuns()}>↻ Refresh</button>
          </div>
          {#if filteredAgentRuns.length}
            <div class="run-list">
              {#each filteredAgentRuns as run (run.id)}
              <article class="run-row">
                <span class="run-symbol">✳</span>
                <div class="run-title">
                  <strong>{run.title}</strong>
                  <small>{run.output?.agent_name ?? run.assigned_agent ?? 'Agent pending'} · {run.output?.model ?? run.executor ?? 'not connected'} · {new Date(run.created_at).toLocaleString('id-ID')} · Durasi {formatRunDuration(run)}</small>
                  {#if run.output?.answer}
                    <details class="run-output-details">
                      <summary>Lihat hasil AI{#if run.output?.usage?.totalTokens} · {run.output.usage.totalTokens} tokens{/if}</summary>
                      <div class="ai-answer run-history-answer">{@html renderMarkdown(run.output.answer)}</div>
                    </details>
                  {:else if run.output?.message}
                    <p>{run.output.message}</p>
                  {/if}
                  {#if run.error_message}<p class="run-error-message">{run.error_message}</p>{/if}
                </div>
                <div class="run-row-actions">
                  <span class="run-state-pill" class:run-state-success={run.status === 'succeeded'} class:run-state-failed={run.status === 'failed'} class:run-state-running={run.status === 'running'} class:run-state-planned={run.status === 'planned'}>{formatRunStatus(run.status)}</span>
                  {#if run.status === 'failed' && run.task_id}
                    <button class="run-retry-button" type="button" onclick={() => { if (run.task_id) void runAIAgent(run.task_id); }} disabled={aiBusyTaskId !== null || previewBusyTaskId !== null} title="Jalankan lagi task ini">↻ Jalankan lagi</button>
                  {/if}
                </div>
              </article>
            {/each}
            </div>
          {:else}
            <div class="empty-state run-filter-empty"><div class="empty-icon">⌕</div><h3>Tidak ada run yang cocok</h3><p>Coba kata kunci atau filter status yang berbeda.</p><button class="run-refresh-button" type="button" onclick={() => { runSearch = ''; runStatusFilter = 'all'; }}>Reset filter</button></div>
          {/if}
        {:else if runStorageReady === false}
          <div class="empty-state run-empty"><div class="empty-icon">✳</div><h3>Agent run history belum tersedia</h3><p>Penyimpanan staging belum bisa dimuat. Periksa pesan di atas atau coba refresh halaman. Database produksi tidak diubah.</p></div>
        {:else}
          <div class="empty-state run-empty"><div class="empty-icon">✳</div><h3>Belum ada Agent Run</h3><p>Jalankan AI pada salah satu task untuk menyimpan status, waktu, dan hasilnya di database staging.</p></div>
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
