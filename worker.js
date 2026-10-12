const corsHeaders = {
  "Access-Control-Allow-Origin": "https://vixora.my.id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const CREAO_APP_ID = "1305331a-99f0-4330-b1c1-226f5f0ea129";
const CREAO_BASE_URL = `https://agent.creao.ai/api/v1/apps/${CREAO_APP_ID}/runs`;

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });

const getCreaoKey = (env) =>
  typeof env?.CREAO_API_KEY === "string" ? env.CREAO_API_KEY.trim() : "";

async function authorizeSupabaseUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return { ok: false, status: 401, error: "Login diperlukan untuk menjalankan perintah." };

  const publishableKey = typeof env?.SUPABASE_PUBLISHABLE_KEY === "string"
    ? env.SUPABASE_PUBLISHABLE_KEY.trim()
    : "";
  if (!publishableKey) {
    return { ok: false, status: 503, error: "SUPABASE_PUBLISHABLE_KEY belum dikonfigurasi di Worker." };
  }

  try {
    const response = await fetch("https://gdxughluqryzlklrnzhz.supabase.co/auth/v1/user", {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { ok: false, status: 401, error: "Sesi login tidak valid atau sudah kedaluwarsa." };
    const user = await response.json();
    if (!user?.id) return { ok: false, status: 401, error: "Sesi login tidak valid." };
    return { ok: true, user };
  } catch {
    return { ok: false, status: 502, error: "Tidak dapat memverifikasi sesi login saat ini." };
  }
}

async function sendTelegramMessage(env, chatId, text) {
  const token = typeof env?.TELEGRAM_BOT_TOKEN === "string" ? env.TELEGRAM_BOT_TOKEN.trim() : "";
  if (!token) return false;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 3900) }),
  });
  return response.ok;
}

async function handleTelegramWebhook(request, env) {
  const expectedSecret = typeof env?.TELEGRAM_WEBHOOK_SECRET === "string"
    ? env.TELEGRAM_WEBHOOK_SECRET.trim()
    : "";
  if (!expectedSecret) return json({ ok: false, error: "Telegram webhook secret is not configured." }, 503);
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== expectedSecret) {
    return json({ ok: false, error: "Unauthorized webhook." }, 401);
  }

  const botToken = typeof env?.TELEGRAM_BOT_TOKEN === "string" ? env.TELEGRAM_BOT_TOKEN.trim() : "";
  if (!botToken) return json({ ok: false, error: "Telegram bot token is not configured." }, 503);

  let update;
  try {
    update = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON." }, 400);
  }
  const message = update?.message || update?.edited_message;
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  const chatId = message?.chat?.id;
  if (!text || chatId === undefined || chatId === null) return json({ ok: true, ignored: true });

  const allowed = (typeof env?.TELEGRAM_ALLOWED_CHAT_IDS === "string" ? env.TELEGRAM_ALLOWED_CHAT_IDS : "")
    .split(",").map((id) => id.trim()).filter(Boolean);
  if (!allowed.length) return json({ ok: false, error: "Telegram allowlist is not configured." }, 503);
  if (!allowed.includes(String(chatId))) return json({ ok: true, ignored: true });

  if (/^\/(start|help)(?:@\w+)?(?:\s|$)/i.test(text)) {
    await sendTelegramMessage(env, chatId,
      "VIXORA AI Command Center siap. Kirim instruksi dalam bahasa biasa untuk diteruskan ke executor. Periksa hasil sebelum menjalankan tindakan penting.");
    return json({ ok: true });
  }

  const command = text.replace(/^\/command(?:@\w+)?\s*/i, "").trim();
  if (!command) {
    await sendTelegramMessage(env, chatId, "Kirim instruksi dalam bahasa biasa, atau gunakan /command diikuti instruksi.");
    return json({ ok: true });
  }

  const result = await creaoRequest(CREAO_BASE_URL, env, {
    method: "POST",
    body: JSON.stringify({ inputs: { command } }),
  });
  if (result.error) {
    await sendTelegramMessage(env, chatId, "VIXORA belum siap: CREAO_API_KEY belum dikonfigurasi.");
    return json({ ok: false, error: "Executor is not configured." }, 503);
  }
  if (!result.response.ok) {
    await result.response.text().catch(() => "");
    await sendTelegramMessage(env, chatId, "Executor gagal menerima perintah. Coba lagi nanti.");
    return json({ ok: false, error: "Executor request failed." }, 502);
  }

  const run = await result.response.json().catch(() => null);
  const runId = run?.id || run?.run_id || run?.data?.id || run?.data?.run_id;
  const reply = runId
    ? `Perintah dikirim ke executor VIXORA.\nRun ID: ${runId}\nStatus: menunggu hasil executor.`
    : "Perintah dikirim ke executor VIXORA. Periksa dashboard untuk status selanjutnya.";
  await sendTelegramMessage(env, chatId, reply);
  return json({ ok: true, dispatched: true, runId: runId || null });
}

async function creaoRequest(url, env, init = {}) {
  const apiKey = getCreaoKey(env);
  if (!apiKey) {
    return { response: null, error: "CREAO_API_KEY is not configured in Worker secrets." };
  }

  return {
    response: await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }),
    error: null,
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/" || url.pathname === "/api/health")) {
      return json({
        status: "ok",
        service: "vixora-command-core",
        version: "0.3.0",
        deployment: "cloudflare-worker",
        agents: ["AGENT 01: content-agent"],
        executor: "creao-api-trigger",
        appId: CREAO_APP_ID,
        configuration: {
          creao: Boolean(getCreaoKey(env)),
          supabaseAuth: Boolean(env?.SUPABASE_PUBLISHABLE_KEY),
          telegram: Boolean(env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_WEBHOOK_SECRET && env?.TELEGRAM_ALLOWED_CHAT_IDS),
        },
        routes: ["/", "/api/health", "/api/command", "/api/command/:runId"],
      });
    }

    if (url.pathname === "/api/telegram/webhook") {
      if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, { Allow: "POST, OPTIONS" });
      return handleTelegramWebhook(request, env);
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/command/")) {
      const runId = url.pathname.split("/").filter(Boolean).pop();
      if (!runId) return json({ success: false, error: "Run ID is required" }, 400);

      const auth = await authorizeSupabaseUser(request, env);
      if (!auth.ok) return json({ success: false, status: auth.status === 401 ? "unauthorized" : "auth_unavailable", error: auth.error }, auth.status);

      const result = await creaoRequest(`${CREAO_BASE_URL}/${encodeURIComponent(runId)}`, env, { method: "GET" });

      if (result.error) {
        return json({ success: false, status: "not_configured", error: result.error }, 503);
      }

      if (!result.response.ok) {
        const detail = await result.response.text().catch(() => "");
        return json({
          success: false,
          status: "executor_error",
          error: `CREAO returned HTTP ${result.response.status}`,
          detail: detail.slice(0, 500),
        }, 502);
      }

      return json({
        success: true,
        status: "ok",
        executor: await result.response.json().catch(() => null),
      });
    }

    if (request.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405, {
        Allow: "GET, POST, OPTIONS",
      });
    }

    if (url.pathname !== "/api/command") {
      return json({ success: false, error: "Not found" }, 404);
    }

    const auth = await authorizeSupabaseUser(request, env);
    if (!auth.ok) return json({ success: false, status: auth.status === 401 ? "unauthorized" : "auth_unavailable", error: auth.error }, auth.status);

    try {
      const body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ success: false, error: "Request body must be a JSON object" }, 400);
      }

      const command = typeof body.command === "string" ? body.command.trim() : "";
      if (!command) {
        return json({ success: false, error: "Command is required" }, 400);
      }

      const source = typeof body.source === "string" && body.source.trim()
        ? body.source.trim()
        : "vixora-command-center";

      // Send commands to the configured executor; do not label static templates as AI-generated output.
      const result = await creaoRequest(CREAO_BASE_URL, env, {
        method: "POST",
        body: JSON.stringify({ inputs: { command } }),
      });

      if (result.error) {
        return json({ success: false, status: "not_configured", error: result.error }, 503);
      }

      if (!result.response.ok) {
        const detail = await result.response.text().catch(() => "");
        return json({
          success: false,
          status: "executor_error",
          error: `CREAO returned HTTP ${result.response.status}`,
          detail: detail.slice(0, 500),
          command,
        }, 502);
      }

      const executorData = await result.response.json().catch(() => null);

      return json({
        success: true,
        status: "dispatched",
        message: "Command dispatched to the VIXORA YouTube Executor via CREAO API Trigger.",
        command,
        source,
        execution: {
          planner: "vixora-core",
          executor: "creao-api-trigger",
          youtube: "via-creao",
          connected: true,
        },
        run: executorData,
      }, 202);
    } catch {
      return json({ success: false, error: "Invalid JSON request" }, 400);
    }
  },
};
