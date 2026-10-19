import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { routeTaskToAgent } from '$lib/server/agent-registry';

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  GEMINI_API_KEY?: string;
  GEMINI_FREE_TIER_ONLY_CONFIRMED?: string;
};
type SupabaseConfig = { url: string; key: string };
type TaskRow = { id: string; title: string; description: string | null; priority: string | null };

// Google AI Studio Gemini API. This route is only enabled after the operator confirms a Free Tier key/project.
const MODEL = 'gemini-3.8-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const DEFAULT_SUPABASE_URL = 'https://gdxughluqryzlklrnzhz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkeHVnaGx1cXJ5emxrbHJuemh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjI0ODAsImV4cCI6MjEwMzEzODQ4MH0.YhQaMhH6gwhLZNVem9NR0Ow32iqrgcB3YiAi-WSBKMo';

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

function mapGeminiError(status: number): { status: number; error: string; message: string } {
  if (status === 429) {
    return {
      status: 429,
      error: 'GEMINI_QUOTA_OR_RATE_LIMIT',
      message: 'Kuota gratis atau batas laju Gemini API sedang tercapai. Tidak ada fallback ke provider lain; periksa kuota di Google AI Studio.'
    };
  }
  if (status === 401 || status === 403) {
    return {
      status: 502,
      error: 'GEMINI_KEY_OR_PROJECT_ERROR',
      message: 'Google menolak permintaan. Periksa API key, akses model dan status project Free Tier di Google AI Studio. VIXORA tidak mencoba provider lain.'
    };
  }
  return {
    status: 502,
    error: 'GEMINI_REQUEST_FAILED',
    message: `Permintaan Gemini gagal (HTTP ${status}). Tidak ada fallback ke provider lain.`
  };
}

export const POST: RequestHandler = async ({ request, platform }) => {
  const env = (platform?.env ?? {}) as Env;
  const token = getBearer(request);
  if (!token) return json({ error: 'Sign in is required.' }, { status: 401 });

  if (!env.GEMINI_API_KEY?.trim()) {
    return json({
      error: 'GEMINI_NOT_CONFIGURED',
      message: 'Tambahkan GEMINI_API_KEY sebagai secret pada Cloudflare Worker staging. Key tidak perlu dan tidak boleh ditaruh di browser atau repository.'
    }, { status: 503 });
  }
  if (env.GEMINI_FREE_TIER_ONLY_CONFIRMED?.trim().toLowerCase() !== 'true') {
    return json({
      error: 'GEMINI_FREE_TIER_NOT_CONFIRMED',
      message: 'Run AI dikunci sampai Free Tier dikonfirmasi. Gunakan key/project Google AI Studio yang belum di-upgrade ke billing berbayar, lalu set GEMINI_FREE_TIER_ONLY_CONFIRMED=true pada Worker staging.'
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
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY.trim()
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: makeSystemPrompt(agent.id, agent.name) }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 1200,
          thinkingConfig: { thinkingLevel: 'low' }
        }
      }),
      // Keep a generous wall-clock deadline but request low reasoning effort to reduce latency.
      signal: AbortSignal.timeout(55000)
    });
  } catch (cause) {
    const errorName = cause instanceof Error ? cause.name : '';
    const errorMessage = cause instanceof Error ? cause.message : '';
    if (errorName === 'TimeoutError' || errorName === 'AbortError' || /timed? ?out|abort/i.test(errorMessage)) {
      return json({
        error: 'GEMINI_TIMEOUT',
        message: 'Gemini belum mengembalikan jawaban dalam 55 detik. Coba lagi sekali nanti; VIXORA tidak memanggil provider alternatif.'
      }, { status: 504 });
    }
    return json({
      error: 'GEMINI_NETWORK_ERROR',
      message: 'Cloudflare Worker tidak berhasil menyelesaikan koneksi ke Gemini API. Periksa secret GEMINI_API_KEY dan coba lagi. VIXORA tidak memanggil provider alternatif.',
      causeType: errorName || 'UnknownError'
    }, { status: 502 });
  }

  if (!response.ok) {
    const mapped = mapGeminiError(response.status);
    // Do not forward provider response bodies; they can contain sensitive operational details.
    return json({ error: mapped.error, message: mapped.message, model: MODEL }, { status: mapped.status });
  }

  const body = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
  const answer = body.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
  if (!answer) {
    return json({
      error: 'GEMINI_EMPTY_RESPONSE',
      message: body.promptFeedback?.blockReason
        ? 'Permintaan diblokir oleh filter keselamatan model. Coba ubah isi task.'
        : 'Gemini tidak mengembalikan teks. Silakan coba lagi.',
      model: MODEL
    }, { status: 502 });
  }

  return json({
    result: {
      mode: 'google-ai-studio-free-tier',
      status: 'completed',
      model: MODEL,
      agentId: agent.id,
      agentName: agent.name,
      taskTitle: task.title,
      answer,
      limitations: [
        'Tidak ada browsing atau grounding pencarian web pada request ini.',
        'Agent hanya menghasilkan teks/draft; tidak menjalankan tool atau workflow eksternal.',
        'Menggunakan Gemini API melalui Google AI Studio. Operator harus memastikan project masih berada pada Free Tier dan tidak terhubung ke billing berbayar.',
        'VIXORA tidak melakukan fallback ke model/provider lain jika request gagal atau kuota habis.'
      ],
      usage: body.usageMetadata ? {
        inputTokens: body.usageMetadata.promptTokenCount ?? null,
        outputTokens: body.usageMetadata.candidatesTokenCount ?? null,
        totalTokens: body.usageMetadata.totalTokenCount ?? null
      } : null,
      createdAt: new Date().toISOString()
    }
  }, { status: 200, headers: { 'cache-control': 'no-store' } });
};
