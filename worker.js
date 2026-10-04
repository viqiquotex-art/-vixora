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
  async fetch(request) {
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

      return json({
        success: true,
        status: "accepted",
        message: "Command received by VIXORA Core. External executors are the next connector layer.",
        command,
        source: body.source || "unknown",
        execution: {
          planner: "vixora-core",
          executors: ["creao", "youtube"],
          connected: false,
        },
      });
    } catch {
      return json({ success: false, error: "Invalid JSON request" }, 400);
    }
  },
};
