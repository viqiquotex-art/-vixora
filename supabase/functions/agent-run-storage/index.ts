const AUTH_URL = "https://gdxughluqryzlklrnzhz.supabase.co";
const AUTH_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkeHVnaGx1cXJ5emxrbHJuemh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjI0ODAsImV4cCI6MjEwMzEzODQ4MH0.YhQaMhH6gwhLZNVem9NR0Ow32iqrgcB3YiAi-WSBKMo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Content-Type": "application/json",
};

function reply(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function bearer(request: Request): string | null {
  return (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

async function authenticateUser(token: string): Promise<{ id: string; email?: string } | null> {
  try {
    const response = await fetch(`${AUTH_URL}/auth/v1/user`, {
      headers: { apikey: AUTH_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: string; email?: string };
    return typeof user.id === "string" ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}

function getAdminCredentials(): { url: string; key: string; legacyJwt: boolean } | null {
  const url = Deno.env.get("SUPABASE_URL");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secretMap = Deno.env.get("SUPABASE_SECRET_KEYS");
  let modern = "";
  if (secretMap) {
    try {
      const parsed = JSON.parse(secretMap) as Record<string, string>;
      modern = parsed.default ?? "";
    } catch {
      modern = "";
    }
  }
  const key = legacy || modern;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key, legacyJwt: key.startsWith("eyJ") };
}

async function adminRest(path: string, init: RequestInit = {}): Promise<Response> {
  const credentials = getAdminCredentials();
  if (!credentials) throw new Error("Staging database server credentials are unavailable.");
  const headers = new Headers(init.headers);
  headers.set("apikey", credentials.key);
  // Legacy service-role keys are JWTs and require Authorization too. Modern sb_secret keys must
  // be sent as apikey only (the Edge Function gateway rejects them as Bearer JWTs).
  if (credentials.legacyJwt) headers.set("Authorization", `Bearer ${credentials.key}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  return await fetch(`${credentials.url}/rest/v1/${path}`, { ...init, headers });
}

async function getOwnedTask(taskId: string, token: string): Promise<{ id: string; title: string; description: string | null; priority: string } | null> {
  const response = await fetch(
    `${AUTH_URL}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,title,description,priority&limit=1`,
    { headers: { apikey: AUTH_ANON_KEY, Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ id: string; title: string; description: string | null; priority: string }>;
  return rows[0] ?? null;
}

function selectAgent(text: string): { id: string; name: string; capabilities: string[] } {
  const normalized = text.normalize("NFKC").toLowerCase();
  if (["youtube", "shorts", "reels", "caption", "skrip", "script", "hook", "konten", "video"].some((x) => normalized.includes(x))) {
    return { id: "content-studio", name: "Content Studio", capabilities: ["youtube", "shorts", "captions", "scripts", "hooks"] };
  }
  if (["research", "riset", "bandingkan", "compare", "sumber", "referensi", "analisis", "analysis"].some((x) => normalized.includes(x))) {
    return { id: "research-agent", name: "Research Agent", capabilities: ["research", "comparison", "sources", "evidence"] };
  }
  if (["workflow", "otomasi", "automation", "n8n", "webhook", "integrasi", "integrate"].some((x) => normalized.includes(x))) {
    return { id: "workflow-planner", name: "Workflow Planner", capabilities: ["workflow", "automation", "webhooks"] };
  }
  return { id: "strategy-planner", name: "Strategy & Planner", capabilities: ["planning", "strategy", "general"] };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const token = bearer(request);
  if (!token) return reply({ error: "Sign in is required." }, 401);

  const user = await authenticateUser(token);
  if (!user) return reply({ error: "Session is invalid or expired. Please sign in again." }, 401);
  const method = request.method.toUpperCase();

  if (method === "GET") {
    try {
      const query = "agent_runs?select=id,task_id,title,prompt,status,assigned_agent,executor,output,error_message,attempt_count,requires_approval,created_at,updated_at,started_at,finished_at&user_id=eq." +
        encodeURIComponent(user.id) + "&order=created_at.desc&limit=50";
      const response = await adminRest(query, { method: "GET" });
      if (!response.ok) return reply({ error: "Could not load staging agent runs." }, 502);
      return reply({ runs: await response.json(), storageReady: true });
    } catch {
      return reply({ error: "Staging agent-run storage is not configured." }, 503);
    }
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "Request body must be an object." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "Request body must be valid JSON." }, 400);
  }

  if (method === "POST") {
    if (!isUuid(body.task_id)) return reply({ error: "task_id must be a UUID." }, 400);
    const task = await getOwnedTask(body.task_id, token);
    if (!task) return reply({ error: "Task was not found for this account, or ownership could not be verified." }, 404);
    const agent = selectAgent(`${task.title}\n${task.description ?? ""}`);
    const prompt = (task.description?.trim() || task.title).slice(0, 12000);
    const isLiveRun = body.run_kind === "ai";
    const now = new Date().toISOString();
    const row = {
      user_id: user.id,
      task_id: task.id,
      title: task.title.slice(0, 240),
      prompt,
      status: isLiveRun ? "running" : "planned",
      assigned_agent: agent.id,
      executor: isLiveRun ? "gemini-api" : "not_connected",
      input: { source: "task_center", router: "vixora-deterministic-router-v1", priority: task.priority },
      output: isLiveRun
        ? { mode: "live-ai", agent_name: agent.name, message: "Gemini request started." }
        : { mode: "plan-only", agent_name: agent.name, message: "Agent selected and run plan recorded. No external executor has been called.", capabilities: agent.capabilities },
      error_message: null,
      attempt_count: isLiveRun ? 1 : 0,
      requires_approval: !isLiveRun,
      started_at: isLiveRun ? now : null,
    };
    try {
      const response = await adminRest("agent_runs", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      if (!response.ok) return reply({ error: "Could not create staging agent run." }, 502);
      const rows = await response.json() as Array<Record<string, unknown>>;
      if (!rows[0]) return reply({ error: "Run record was not returned." }, 502);
      return reply({ run: rows[0], storageReady: true }, 201);
    } catch {
      return reply({ error: "Staging agent-run storage is not configured." }, 503);
    }
  }

  if (method === "PATCH") {
    if (!isUuid(body.run_id)) return reply({ error: "run_id must be a UUID." }, 400);
    if (body.status !== "succeeded" && body.status !== "failed" && body.status !== "cancelled") {
      return reply({ error: "Only terminal run statuses can be recorded." }, 400);
    }
    const status = body.status;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status,
      finished_at: now,
      error_message: typeof body.error_message === "string" ? body.error_message.slice(0, 1000) : null,
      updated_at: now,
    };
    if (status === "succeeded" && body.output && typeof body.output === "object" && !Array.isArray(body.output)) {
      updates.output = body.output;
      updates.error_message = null;
    }
    try {
      const response = await adminRest(
        `agent_runs?id=eq.${encodeURIComponent(body.run_id)}&user_id=eq.${encodeURIComponent(user.id)}`,
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(updates) },
      );
      if (!response.ok) return reply({ error: "Could not update staging agent run." }, 502);
      const rows = await response.json() as Array<Record<string, unknown>>;
      if (!rows[0]) return reply({ error: "Agent run was not found for this account." }, 404);
      return reply({ run: rows[0], storageReady: true });
    } catch {
      return reply({ error: "Staging agent-run storage is not configured." }, 503);
    }
  }

  return reply({ error: "Method not allowed." }, 405);
});
