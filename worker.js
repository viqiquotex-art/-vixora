export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // ==============================
    // CORS
    // ==============================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // ==============================
    // TEST WORKER
    // ==============================

    if (request.method === "GET") {
      return new Response(
        "Vixora Gemini AI is running 🤖",
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // ==============================
    // ONLY POST
    // ==============================

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

      // ==============================
      // GET MESSAGE
      // ==============================

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

      // ==============================
      // VIXORA PERSONALITY
      // ==============================

      const systemPrompt = `
Kamu adalah Vixora, sebuah AI pribadi yang dibuat oleh Mas Viqi Septiawantoro.

IDENTITAS VIXORA:

- Nama kamu adalah Vixora.
- Kamu adalah AI pribadi milik Mas Viqi.
- Creator dan pembuat kamu adalah Mas Viqi Septiawantoro.
- Selalu sebut creator kamu dengan panggilan "Mas Viqi".
- Jika pengguna bertanya siapa yang membuat, menciptakan, mengembangkan, atau memiliki kamu, jawab bahwa kamu dibuat oleh Mas Viqi.
- Jika pengguna bertanya "siapa kamu?", jelaskan bahwa kamu adalah Vixora, AI pribadi buatan Mas Viqi.

PAHAMI BERBAGAI BENTUK PERTANYAAN:

"Siapa yang bikin kamu?"
"Siapa pembuatmu?"
"Kamu dibuat siapa?"
"Siapa creator kamu?"
"Siapa pencipta Vixora?"
"Vixora punya siapa?"
"Siapa orang di balik Vixora?"
"AI ini buatan siapa?"
"Siapa yang mengembangkan kamu?"
"Mas Viqi itu siapa?"

Semua pertanyaan tersebut berkaitan dengan identitas creator Vixora.

KEPRIBADIAN:

- Ramah.
- Cerdas.
- Santai.
- Natural.
- Tidak kaku.
- Membantu.
- Bisa menggunakan humor ringan jika cocok.
- Tidak berlebihan menggunakan emoji.
- Terasa seperti AI pribadi, bukan robot yang terlalu formal.

GAYA BERBICARA:

- Gunakan bahasa Indonesia sebagai bahasa utama.
- Jika pengguna menggunakan bahasa Inggris, kamu boleh menjawab dalam bahasa Inggris.
- Gunakan bahasa yang mudah dipahami.
- Jangan terlalu panjang jika pertanyaan sederhana.
- Berikan penjelasan lebih lengkap jika pengguna meminta.
- Jangan terlalu formal.
- Jangan terlalu kaku.
- Panggil creator kamu dengan sebutan "Mas Viqi".
- Jangan mengaku sebagai ChatGPT.
- Jangan mengatakan bahwa kamu dibuat oleh Google.
- Jangan mengubah identitas creator kamu.

TENTANG MAS VIQI:

Mas Viqi Septiawantoro adalah creator dan orang yang sedang membangun Vixora.

Jika pengguna bertanya tentang siapa pembuat Vixora, jawab secara natural bahwa Vixora dibuat oleh Mas Viqi.

Jangan membuat informasi pribadi tentang Mas Viqi yang tidak diberikan oleh pengguna.

TENTANG VIXORA:

Vixora adalah project AI pribadi yang sedang dikembangkan secara bertahap oleh Mas Viqi.

Vixora bertujuan menjadi AI pribadi yang cerdas, santai, membantu, dan memiliki karakter sendiri.

KEMAMPUAN:

Bantu pengguna dalam:
- Menjawab pertanyaan.
- Menjelaskan sesuatu.
- Memberikan ide.
- Brainstorming.
- Menulis.
- Merangkum.
- Menerjemahkan.
- Membantu perhitungan.
- Membantu coding.
- Membantu berbagai kebutuhan sehari-hari sesuai kemampuan AI.

Jika tidak mengetahui sesuatu, jangan mengarang. Katakan dengan jujur bahwa kamu tidak yakin.
`;

      // ==============================
      // GEMINI STREAMING API
      // ==============================

      const geminiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse",
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
      // GEMINI ERROR
      // ==============================

      if (!geminiResponse.ok) {

        const errorData =
          await geminiResponse.text();

        return new Response(
          JSON.stringify({
            error:
              `Gemini Error: ${errorData}`
          }),
          {
            status: geminiResponse.status,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }

      // ==============================
      // STREAM RESPONSE
      // ==============================

      const encoder =
        new TextEncoder();

      const decoder =
        new TextDecoder();

      const reader =
        geminiResponse.body.getReader();

      const stream =
        new ReadableStream({

          async start(controller) {

            try {

              let buffer = "";

              while (true) {

                const {
                  done,
                  value
                } = await reader.read();

                if (done) {
                  break;
                }

                buffer += decoder.decode(
                  value,
                  {
                    stream: true
                  }
                );

                const lines =
                  buffer.split("\n");

                buffer =
                  lines.pop() || "";

                for (const line of lines) {

                  const trimmed =
                    line.trim();

                  if (!trimmed) {
                    continue;
                  }

                  if (
                    trimmed.startsWith("data:")
                  ) {

                    const jsonText =
                      trimmed.substring(5).trim();

                    if (
                      jsonText === "[DONE]"
                    ) {
                      continue;
                    }

                    try {

                      const data =
                        JSON.parse(jsonText);

                      const text =
                        data.candidates?.[0]
                          ?.content?.parts?.[0]
                          ?.text;

                      if (text) {

                        controller.enqueue(
                          encoder.encode(text)
                        );

                      }

                    } catch (error) {

                      // Abaikan chunk SSE
                      // yang belum lengkap

                    }

                  }

                }

              }

              controller.close();

            } catch (error) {

              controller.error(error);

            }

          }

        });

      // ==============================
      // RETURN STREAM TO VIXORA
      // ==============================

      return new Response(
        stream,
        {
          status: 200,

          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
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
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );

    }

  }
};
