import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { routeTaskToAgent } from '$lib/server/agent-registry';

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  DASHSCOPE_API_KEY?: string;
  MODELSTUDIO_WORKSPACE_ID?: string;
  DASHSCOPE_FREE_QUOTA_ONLY_CONFIRMED?: string;
};
type SupabaseConfig = { url: string; key: string };
type TaskRow = { id: string; title: string; description: string | null; priority: string | null };

// Singapore / International Qwen model. Use the workspace-specific endpoint recommended by Alibaba.
const MODEL = 'qwen3.8-flash';

function getAlibabaChatUrl(env: Env): string | null {
  const workspaceId = env.MODELSTUDIO_WORKSPACE_ID?.trim();
  if (!workspaceId || !/^[a-zA-Z0-9-]+$/.test(workspaceId)) return null;
  return `https://${workspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions`;
}
const DEFAULT_SUPABASE_URL = 'https://gdxughluqryzlklrnzhz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImdkeHVnaGx1cXJ5emxrbHJuemh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjI0ODAsImV4cCI6MjEwMzEzODQ4MH0.YhQaMhH6gwhLZNVem9NR0Ow32iqrgcB3YiAi-WSBKMo';

function getConfig(platform: App.Platform | undefined): SupabaseConfig {
  const env = (platform?.env ?? {}) as Env;
  return {
    url: (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ''),
    key: env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  };
}

function getBearer(request: Request): string | null {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

function makeSystemPrompt(agentId: string, agentName: string): string {
  const common = [
    'You are a specialist agent inside VIXORA AI Workspace.',
    `Your assigned role is ${agentName} (agent id: ${agentId}).`,
    'Answer the user request directly in Indonesian unless their request is clearly in another language.',
    'Be specific, useful, and honest. Never claim to have searched the web, called an external tool, changed data, or executed a workflow when you have not.',
    'Do not use external tools. Do not create, publish, send, delete, buy, or modify anything; produce an answer/draft only.',
    'If the request depends on current facts or sources, clearly state that live research is not enabled in this run and separate known background from anything needing verification.',
    'Return readable Markdown, with concise headings and ordered steps when useful.'
  ];

  const specialist = {
    'content-studio': 'Specialty: content strategy, hooks, scripts, captions, titles, descriptions, and publishing metadata. Create original content tailored to the platform and audience; mark any assumptions.',
    'research-agent': 'Specialty: research design, comparisons, evidence tables, source evaluation, and synthesis. Do not invent citations, URLs, quotes, or current facts. If browsing is unavailable, provide a research plan and identify what must be verified.',
    'workflow-planner': 'Specialty: workflow architecture, n8n, webhooks, API integrations, validation, retries, observability, and security. Provide implementation-ready steps, but do not invoke or alter real workflows.',
    'strategy-planner': 'Specialty: general strategy and planning. Convert the goal into sequenced, measurable steps with dependencies, risks, and acceptance criteria.'
  } as Record<string, string>;

  return [...common, specialist[agentId] || 'Specialty: practical planning and problem solving.'].join('\n');
}

function mapAlibabaError(status: number): { status: number; error: string; message: string } {
  if (status === 429) {
    return {
      status: 429,
      error: 'ALIBABA_QUOTA_OR_RATE_LIMIT',
      message: 'Kuota gratis atau batas laju Alibaba Cloud sedang tercapai. VIXORA tidak beralih ke provider lain; periksa sisa kuota qwen3.8-flash di Model Studio.'
    };
  }
  if (status === 401 || status === 403 || status === 402) {
    return {
      status: 502,
      error: 'ALIBABA_KEY_REGION_OR_QUOTA_ERROR',
      message: 'Alibaba Cloud menolak permintaan. Periksa API key Model Studio wilayah Singapura, akses model, dan status Free Quota Only. VIXORA tidak mencoba provider lain.'
    };
  }
  return {
    status: 502,
    error: 'ALIBABA_REQUEST_FAILED',
    message: `Permintaan Alibaba Cloud gagal (HTTP ${status}). Tidak ada fallback ke provider lain.`
  };
}

export const POST: RequestHandler = async ({ request, platform }) => {
  const env = (platform?.env ?? {}) as Env;
  const token = getBearer(request);
  if (!token) return json({ error: 'Sign in is required.' }, { status: 401 });

  if (!env.DASHSCOPE_API_KEY?.trim()) {
    return json({
      error: 'ALIBABA_NOT_CONFIGURED',
      message: 'Tambahkan DASHSCOPE_API_KEY sebagai secret di Cloudflare Worker staging. Jangan menaruh API key di browser, chat, atau repository.'
    }, { status: 503 });
  }
  if (!getAlibabaChatUrl(env)) {
    return json({
      error: 'ALIBABA_WORKSPACE_NOT_CONFIGURED',
      message: 'Tambahkan MODELSTUDIO_WORKSPACE_ID untuk workspace Alibaba Model Studio wilayah Singapura yang sama dengan API key. VIXORA tidak memanggil endpoint regional lama.'
    }, { status: 503 });
  }
  if (env.DASHSCOPE_FREE_QUOTA_ONLY_CONFIRMED?.trim().toLowerCase() !== 'true') {
    return json({
      error: 'FREE_QUOTA_ONLY_NOT_CONFIRMED',
      message: 'Run AI dikunci untuk mencegah biaya tak terduga. Aktifkan Free Quota Only untuk model qwen3.8-flash di Alibaba Model Studio, lalu set DASHSCOPE_FREE_QUOTA_ONLY_CONFIRMED=true pada Worker staging.'
    }, { status: 503 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!input || typeof input !== 'object' || typeof (input as Record<string, unknown>).task_id !== 'string') {
    return json({ error: 'task_id is required.' }, { status: 400 });
  }

  const taskId = (input as Record<string, string>).task_id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) {
    return json({ error: 'task_id must be a UUID.' }, { status: 400 });
  }

  const config = getConfig(platform);
  const sessionResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, Authorization: `Bearer ${token}` }
  });
  if (!sessionResponse.ok) {
    return json({ error: 'Session is invalid or expired. Please sign in again.' }, { status: 401 });
  }

  const taskResponse = await fetch(
    `${config.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,title,description,priority&limit=1`,
    { headers: { apikey: config.key, Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!taskResponse.ok) return json({ error: 'Could not load the task for AI execution.' }, { status: taskResponse.status });
  const rows = await taskResponse.json() as TaskRow[];
  const task = rows[0];
  if (!task) return json({ error: 'Task was not found for this account.' }, { status: 404 });

  const agent = routeTaskToAgent(`${task.title}\n${task.description ?? ''}`);
  const userPrompt = [
    `Task title: ${task.title.slice(0, 240)}`,
    `Priority: ${task.priority || 'medium'}`,
    'Task details:',
    (task.description?.trim() || task.title).slice(0, 8000)
  ].join('\n');

  let response: Response;
  try {
    response = await fetch(getAlibabaChatUrl(env)!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DASHSCOPE_API_KEY.trim()}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: makeSystemPrompt(agent.id, agent.name) },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_completion_tokens: 1200,
        enable_thinking: false,
        stream: false
      }),
      signal: AbortSignal.timeout(25000)
    });
  } catch {
    return json({
      error: 'ALIBABA_NETWORK_ERROR',
      message: 'Tidak bisa menghubungi Alibaba Cloud Model Studio sekarang. Tidak ada provider alternatif yang dipanggil.'
    }, { status: 502 });
  }

  if (!response.ok) {
    // Parse only the provider error code/message to distinguish Free Quota Only exhaustion.
    // Do not forward provider responses, since they may contain operational details.
    const providerErrorText = await response.text().catch(() => '');
    let providerCode = '';
    try {
      const providerError = JSON.parse(providerErrorText) as { code?: string; error?: { code?: string; message?: string }; message?: string };
      providerCode = [providerError.code, providerError.error?.code, providerError.message, providerError.error?.message]
        .filter((part): part is string => typeof part === 'string')
        .join(' ');
    } catch {
      providerCode = providerErrorText.slice(0, 300);
    }
    if (/AllocationQuota\.FreeTierOnly/i.test(providerCode)) {
      return json({
        error: 'ALIBABA_FREE_QUOTA_EXHAUSTED',
        message: 'Kuota gratis Qwen3.8-Flash habis. Karena Free Quota Only aktif, Alibaba menolak permintaan berikutnya tanpa beralih ke penagihan pay-as-you-go.'
      }, { status: 429 });
    }
    const mapped = mapAlibabaError(response.status);
    return json({ error: mapped.error, message: mapped.message, model: MODEL }, { status: mapped.status });
  }

  const body = await response.json() as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    error?: { message?: string; code?: string };
  };
  const contentValue = body.choices?.[0]?.message?.content;
  const answer = typeof contentValue === 'string'
    ? contentValue.trim()
    : Array.isArray(contentValue)
      ? contentValue.map((part) => part.text || '').join('').trim()
      : '';
  if (!answer) {
    return json({
      error: 'ALIBABA_EMPTY_RESPONSE',
      message: 'Alibaba Cloud tidak mengembalikan teks. Periksa detail permintaan/model lalu coba lagi.',
      model: MODEL
    }, { status: 502 });
  }

  return json({
    result: {
      mode: 'alibaba-cloud-free-quota-only',
      status: 'completed',
      model: MODEL,
      agentId: agent.id,
      agentName: agent.name,
      taskTitle: task.title,
      answer,
      limitations: [
        'Tidak ada browsing atau grounding pencarian web pada request ini.',
        'Agent hanya menghasilkan teks/draft; tidak menjalankan tool atau workflow eksternal.',
        'Menggunakan Alibaba Cloud Model Studio model qwen3.8-flash di endpoint Singapura; hanya bisa berjalan saat Free Quota Only dikonfirmasi.',
        'VIXORA tidak melakukan fallback ke model/provider lain jika request gagal atau kuota habis.'
      ],
      usage: body.usage ? {
        inputTokens: body.usage.prompt_tokens ?? null,
        outputTokens: body.usage.completion_tokens ?? null,
        totalTokens: body.usage.total_tokens ?? null
      } : null,
      createdAt: new Date().toISOString()
    }
  }, { status: 200, headers: { 'cache-control': 'no-store' } });
};
