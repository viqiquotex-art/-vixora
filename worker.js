export default {
  async fetch(request, env) {

    // CORS agar website GitHub Pages bisa mengakses Vixora
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Menangani preflight request dari browser
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Tes saat URL Worker dibuka
    if (request.method === "GET") {
      return new Response(
        "Vixora API is running 🤖",
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // Hanya menerima POST
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed"
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    try {

      const body = await request.json();
      const message = body.message;

      if (!message) {
        return new Response(
          JSON.stringify({
            error: "Pesan kosong"
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      // Kirim pesan ke OpenAI
      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`
          },

          body: JSON.stringify({
            model: "gpt-5-mini",

            instructions:
              "Kamu adalah Vixora, AI pribadi milik pengguna. Kamu ramah, cerdas, santai, tidak kaku, dan menjelaskan sesuatu dengan bahasa Indonesia yang mudah dipahami. Gunakan humor ringan jika cocok. Jangan mengaku sebagai ChatGPT.",

            input: message
          })
        }
      );

      const data = await response.json();

      // Kalau OpenAI mengembalikan error
      if (!response.ok) {
        return new Response(
          JSON.stringify({
            error:
              data.error?.message ||
              "Terjadi kesalahan pada AI."
          }),
          {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      // Kirim jawaban kembali ke Vixora
      return new Response(
        JSON.stringify({
          reply: data.output_text
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    } catch (error) {

      return new Response(
        JSON.stringify({
          error: "Vixora mengalami kesalahan server."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }
  }
};
