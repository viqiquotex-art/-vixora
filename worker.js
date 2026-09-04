export default {
  async fetch(request, env) {

    // ==========================================
    // CORS
    // ==========================================

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // ==========================================
    // OPTIONS
    // ==========================================

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ==========================================
    // GET — Health Check
    // ==========================================

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          message: "Vixora Worker is running 🤖",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ==========================================
    // POST — Basic API Response
    // ==========================================

    if (request.method === "POST") {
      try {
        const body = await request.json();

        return new Response(
          JSON.stringify({
            success: true,
            received: body,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid JSON request",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  },
};
