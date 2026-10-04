const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === "GET") {
      return json({
        status: "ok",
        service: "vixora-command-core",
        version: "0.1.0",
        routes: ["/", "/api/health", "/api/command"],
      });
    }

    if (request.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405, { Allow: "GET, POST, OPTIONS" });
    }

    if (url.pathname !== "/api/command") {
      return json({ success: false, error: "Not found" }, 404);
    }

    try {
      const body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ success: false, error: "Request body must be a JSON object" }, 400);
      }

      const command = typeof body.command === "string" ? body.command.trim() : "";
      if (!command) {
        return json({ success: false, error: "Command is required" }, 400);
      }

      const creaoWebhookUrl = typeof env?.CREAO_WEBHOOK_URL === "string" ? env.CREAO_WEBHOOK_URL.trim() : "";
      const creaoWebhookSecret = typeof env?.CREAO_WEBHOOK_SECRET === "string" ? env.CREAO_WEBHOOK_SECRET : "";

      if (!creaoWebhookUrl) {
        return json({
          success: true,
          status: "accepted",
          message: "Command accepted by VIXORA Core. CREAO webhook is not configured yet.",
          command,
          source: body.source || "unknown",
          execution: { planner: "vixora-core", executor: "creao", youtube: "via-creao", connected: false },
        });
      }

      const executorResponse = await fetch(creaoWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(creaoWebhookSecret ? { Authorization: `Bearer ${creaoWebhookSecret}` } : {}),
        },
        body: JSON.stringify({
          command,
          source: body.source || "vixora-command-center",
          requested_at: new Date().toISOString(),
        }),
      });

      if (!executorResponse.ok) {
        return json({
          success: false,
          status: "executor_error",
          error: `CREAO returned HTTP ${executorResponse.status}`,
          command,
        }, 502);
      }

      let executorData = null;
      try { executorData = await executorResponse.json(); } catch {}

      return json({
        success: true,
        status: "dispatched",
        message: "Command dispatched to CREAO. YouTube actions should run through the connected CREAO agent.",
        command,
        source: body.source || "unknown",
        execution: { planner: "vixora-core", executor: "creao", youtube: "via-creao", connected: true },
        executor: executorData,
      });
    } catch {
      return json({ success: false, error: "Invalid JSON request" }, 400);
    }
  },
};
