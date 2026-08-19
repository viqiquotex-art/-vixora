export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Test Worker
    if (request.method === "GET") {
      return new Response(
        "Vixora Gemini AI is running 🤖",
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

      // Gemini API
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },

          body: JSON.stringify({
            system_instruction: {
              parts: [
                {
                  text:
                    "Kamu adalah Vixora, AI pribadi milik pengguna. Kamu cerdas, santai, ramah, tidak kaku, dan suka membantu. Gunakan bahasa Indonesia yang natural dan mudah dipahami. Gunakan humor ringan jika cocok. Jangan mengaku sebagai ChatGPT."
                }
              ]
            },

            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: message
                  }
                ]
              }
            ]
          })
        }
      );

      const data = await response.json();

      // Jika Gemini error
      if (!response.ok) {

        return new Response(
          JSON.stringify({
            error:
              data.error?.message ||
              "Gemini mengalami masalah."
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

      // Ambil jawaban Gemini
      const reply =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Vixora belum mendapatkan jawaban.";

      return new Response(
        JSON.stringify({
          reply: reply
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
