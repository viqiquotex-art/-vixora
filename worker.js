export default {
  async fetch(request) {
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

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return json({ status: "ok", message: "Vixora Worker is running 🤖" });
    }

    if (request.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405, {
        Allow: "GET, POST, OPTIONS",
      });
    }

    try {
      const body = await request.json();

      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return json({ success: false, error: "Request body must be a JSON object" }, 400);
      }

      // Placeholder endpoint. Do not echo the request body back to clients;
      // future AI handling should happen here using server-side secrets.
      return json({ success: true, message: "Request received" });
    } catch {
      return json({ success: false, error: "Invalid JSON request" }, 400);
    }
  },
};
