export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Worker test
    if (request.method === "GET") {
      return new Response(
        "Vixora Gemini AI is running 🤖",
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // Only POST
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
      const message = body.message?.trim();

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

      // ==============================
      // VIXORA PERSONALITY
      // ==============================

      const systemPrompt = `
Kamu adalah Vixora, AI pribadi buatan Mas Viqi Septiawantoro.

Identitas:
- Nama: Vixora.
- Creator: Mas Viqi Septiawantoro.
- Selalu panggil creator dengan "Mas Viqi".
- Jika ditanya siapa pembuat, pencipta, creator, pengembang, atau pemilik Vixora, jawab bahwa kamu dibuat oleh Mas Viqi.
- Jika ditanya siapa kamu, jawab bahwa kamu adalah Vixora, AI pribadi buatan Mas Viqi.

Kepribadian:
- Cerdas, ramah, santai, natural, dan membantu.
- Gunakan bahasa Indonesia secara default.
- Jangan terlalu formal atau bertele-tele.
- Gunakan humor ringan jika cocok.
- Jangan mengaku sebagai ChatGPT.
- Jangan mengarang informasi yang tidak diketahui.
`;

      // ==============================
      // GEMINI STREAM
      // ==============================

      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse";

      const response =
        await fetch(
          url,
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
                    text: systemPrompt
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

      // ==============================
      // ERROR
      // ==============================

      if (!response.ok) {

        const errorText =
          await response.text();

        return new Response(
          JSON.stringify({
            error: errorText
          }),
          {
            status: response.status,

            headers: {
              "Content-Type":
                "application/json",

              ...corsHeaders
            }
          }
        );
      }

      // ==============================
      // STREAM
      // ==============================

      const decoder =
        new TextDecoder();

      const encoder =
        new TextEncoder();

      const reader =
        response.body.getReader();

      const stream =
        new ReadableStream({

          async start(controller) {

            let buffer = "";

            try {

              while (true) {

                const {
                  done,
                  value
                } =
                  await reader.read();

                if (done) {
                  break;
                }

                buffer +=
                  decoder.decode(
                    value,
                    {
                      stream: true
                    }
                  );

                const lines =
                  buffer.split("\n");

                buffer =
                  lines.pop() || "";

                for (
                  const line
                  of lines
                ) {

                  const trimmed =
                    line.trim();

                  if (
                    !trimmed ||
                    !trimmed.startsWith("data:")
                  ) {
                    continue;
                  }

                  const json =
                    trimmed
                      .slice(5)
                      .trim();

                  if (!json) {
                    continue;
                  }

                  try {

                    const data =
                      JSON.parse(json);

                    const text =
                      data
                        .candidates?.[0]
                        ?.content?.parts?.[0]
                        ?.text;

                    if (text) {

                      controller.enqueue(
                        encoder.encode(text)
                      );

                    }

                  } catch {
                    // Ignore incomplete SSE chunks
                  }
                }
              }

              controller.close();

            } catch (error) {

              controller.error(
                error
              );

            }
          }
        });

      return new Response(
        stream,
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",

            "Cache-Control":
              "no-cache, no-transform",

            "X-Accel-Buffering":
              "no",

            ...corsHeaders
          }
        }
      );

    } catch (error) {

      return new Response(
        JSON.stringify({
          error:
            "Vixora mengalami kesalahan server."
        }),
        {
          status: 500,

          headers: {
            "Content-Type":
              "application/json",

            ...corsHeaders
          }
        }
      );
    }
  }
};
