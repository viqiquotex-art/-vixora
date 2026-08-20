```javascript
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // =========================
    // CORS PREFLIGHT
    // =========================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // =========================
    // TEST GET
    // =========================
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          message: "Vixora Gemini AI is running 🤖",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders,
          },
        }
      );
    }

    // =========================
    // ONLY POST ALLOWED
    // =========================
    if (request.method !== "POST") {
      return jsonResponse(
        {
          error: "Method not allowed",
        },
        405,
        corsHeaders
      );
    }

    try {
      // =========================
      // CHECK API KEY
      // =========================
      if (!env.GEMINI_API_KEY) {
        return jsonResponse(
          {
            error: "GEMINI_API_KEY belum dikonfigurasi di Cloudflare Worker.",
            code: "MISSING_API_KEY",
          },
          500,
          corsHeaders
        );
      }

      // =========================
      // READ REQUEST BODY
      // =========================
      let body;

      try {
        body = await request.json();
      } catch {
        return jsonResponse(
          {
            error: "Format request tidak valid.",
            code: "INVALID_JSON",
          },
          400,
          corsHeaders
        );
      }

      const message =
        typeof body.message === "string"
          ? body.message.trim()
          : "";

      if (!message) {
        return jsonResponse(
          {
            error: "Pesan kosong.",
            code: "EMPTY_MESSAGE",
          },
          400,
          corsHeaders
        );
      }

      // =========================
      // VIXORA SYSTEM PROMPT
      // =========================
      const systemPrompt = `
Kamu adalah Vixora, AI pribadi buatan Mas Viqi Septiawantoro.

IDENTITAS:
- Nama: Vixora.
- Creator: Mas Viqi Septiawantoro.
- Selalu panggil creator dengan "Mas Viqi".
- Jika ditanya siapa pembuat, pencipta, creator, pengembang, atau pemilik Vixora, jawab bahwa kamu dibuat oleh Mas Viqi.
- Jika ditanya siapa kamu, jawab bahwa kamu adalah Vixora, AI pribadi buatan Mas Viqi.

KEPRIBADIAN:
- Cerdas, ramah, santai, natural, dan membantu.
- Gunakan bahasa Indonesia secara default.
- Jangan terlalu formal atau bertele-tele.
- Gunakan humor ringan jika cocok.
- Jangan mengaku sebagai ChatGPT.
- Jangan mengarang informasi yang tidak diketahui.

ATURAN:
- Jawab pertanyaan pengguna secara langsung.
- Jika informasi tidak diketahui atau tidak yakin, katakan dengan jujur.
- Utamakan jawaban yang jelas dan mudah dipahami.
`;

      // =========================
      // GEMINI API
      // =========================
      const model = "gemini-3.6-flash";

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

      const payload = {
        systemInstruction: {
          parts: [
            {
              text: systemPrompt,
            },
          ],
        },

        contents: [
          {
            role: "user",
            parts: [
              {
                text: message,
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      };

      // =========================
      // RETRY CONFIGURATION
      // =========================
      const maxRetries = 3;

      let response = null;
      let lastErrorText = "";

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          response = await fetch(url, {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY,
            },

            body: JSON.stringify(payload),
          });

          // SUCCESS
          if (response.ok) {
            break;
          }

          // Simpan error dari Gemini
          lastErrorText = await response.text();

          // Retry hanya untuk 429 / 5xx
          const shouldRetry =
            response.status === 429 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504;

          if (!shouldRetry || attempt === maxRetries) {
            break;
          }

          // Exponential backoff:
          // 1s → 2s → 4s
          const delay =
            Math.min(1000 * Math.pow(2, attempt), 8000) +
            Math.floor(Math.random() * 500);

          await sleep(delay);
        } catch (error) {
          lastErrorText = error?.message || "Network error";

          if (attempt === maxRetries) {
            break;
          }

          const delay =
            Math.min(1000 * Math.pow(2, attempt), 8000) +
            Math.floor(Math.random() * 500);

          await sleep(delay);
        }
      }

      // =========================
      // GEMINI ERROR HANDLING
      // =========================
      if (!response || !response.ok) {
        return handleGeminiError(
          response?.status || 500,
          lastErrorText,
          corsHeaders
        );
      }

      // =========================
      // STREAM GEMINI RESPONSE
      // =========================
      if (!response.body) {
        return jsonResponse(
          {
            error: "Gemini tidak mengembalikan response stream.",
            code: "NO_RESPONSE_BODY",
          },
          502,
          corsHeaders
        );
      }

      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const reader = response.body.getReader();

      const stream = new ReadableStream({
        async start(controller) {
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                break;
              }

              buffer += decoder.decode(value, {
                stream: true,
              });

              const lines = buffer.split("\n");

              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();

                // Lewati baris kosong
                if (!trimmed) {
                  continue;
                }

                // Hanya proses SSE data
                if (!trimmed.startsWith("data:")) {
                  continue;
                }

                const jsonText = trimmed
                  .slice(5)
                  .trim();

                if (!jsonText) {
                  continue;
                }

                try {
                  const data = JSON.parse(jsonText);

                  // =========================
                  // HANDLE STREAM ERROR
                  // =========================
                  if (data.error) {
                    controller.error(
                      new Error(
                        data.error.message ||
                        "Gemini stream error"
                      )
                    );

                    return;
                  }

                  // =========================
                  // EXTRACT TEXT
                  // =========================
                  const parts =
                    data.candidates?.[0]?.content?.parts;

                  if (!Array.isArray(parts)) {
                    continue;
                  }

                  for (const part of parts) {
                    if (
                      typeof part.text === "string" &&
                      part.text.length > 0
                    ) {
                      controller.enqueue(
                        encoder.encode(part.text)
                      );
                    }
                  }
                } catch {
                  // Abaikan potongan JSON yang tidak lengkap
                  // dan lanjutkan stream.
                }
              }
            }

            // Proses sisa buffer jika ada
            if (buffer.trim().startsWith("data:")) {
              const jsonText = buffer
                .trim()
                .slice(5)
                .trim();

              if (jsonText) {
                try {
                  const data = JSON.parse(jsonText);

                  const parts =
                    data.candidates?.[0]?.content?.parts;

                  if (Array.isArray(parts)) {
                    for (const part of parts) {
                      if (
                        typeof part.text === "string" &&
                        part.text.length > 0
                      ) {
                        controller.enqueue(
                          encoder.encode(part.text)
                        );
                      }
                    }
                  }
                } catch {
                  // Tidak melakukan apa-apa.
                }
              }
            }

            controller.close();
          } catch (error) {
            controller.error(error);
          } finally {
            try {
              reader.releaseLock();
            } catch {}
          }
        },
      });

      // =========================
      // RETURN STREAM
      // =========================
      return new Response(stream, {
        status: 200,

        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          ...corsHeaders,
        },
      });

    } catch (error) {
      console.error("VIXORA_WORKER_ERROR", error);

      return jsonResponse(
        {
          error: "Vixora mengalami kesalahan server.",
          code: "WORKER_ERROR",
        },
        500,
        corsHeaders
      );
    }
  },
};


// ==========================================
// HELPER: JSON RESPONSE
// ==========================================

function jsonResponse(data, status, corsHeaders) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders,
      },
    }
  );
}


// ==========================================
// HELPER: SLEEP
// ==========================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


// ==========================================
// HELPER: GEMINI ERROR
// ==========================================

function handleGeminiError(
  status,
  errorText,
  corsHeaders
) {
  let geminiError = null;

  try {
    geminiError = JSON.parse(errorText);
  } catch {
    // Bukan JSON
  }

  const apiMessage =
    geminiError?.error?.message ||
    geminiError?.error?.status ||
    errorText ||
    "Tidak ada detail error dari Gemini.";

  let userMessage =
    "Vixora gagal menghubungi Gemini.";

  let code =
    "GEMINI_ERROR";

  if (status === 400) {
    userMessage =
      "Request ke Gemini tidak valid.";
    code = "GEMINI_BAD_REQUEST";
  }

  if (status === 401) {
    userMessage =
      "API key Gemini tidak valid atau sudah tidak berlaku.";
    code = "GEMINI_UNAUTHORIZED";
  }

  if (status === 403) {
    userMessage =
      "API key Gemini tidak memiliki izin untuk menggunakan resource ini.";
    code = "GEMINI_FORBIDDEN";
  }

  if (status === 404) {
    userMessage =
      "Model Gemini tidak ditemukan. Periksa nama model.";
    code = "GEMINI_MODEL_NOT_FOUND";
  }

  if (status === 429) {
    userMessage =
      "Kuota atau rate limit Gemini sedang tercapai. Vixora sudah mencoba ulang otomatis, tetapi Gemini masih menolak request.";
    code = "GEMINI_RATE_LIMIT";
  }

  if (status === 500) {
    userMessage =
      "Gemini mengalami kesalahan server.";
    code = "GEMINI_SERVER_ERROR";
  }

  if (
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    userMessage =
      "Layanan Gemini sedang sibuk atau tidak tersedia sementara. Silakan coba lagi.";
    code = "GEMINI_TEMPORARY_ERROR";
  }

  console.error(
    "GEMINI_API_ERROR",
    JSON.stringify({
      status,
      code,
      message: apiMessage,
    })
  );

  return jsonResponse(
    {
      error: userMessage,
      code,
      status,
      detail: apiMessage,
    },
    status,
    corsHeaders
  );
}
```
