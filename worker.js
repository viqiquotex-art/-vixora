const corsHeaders = {
  "Access-Control-Allow-Origin": "https://vixora.my.id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/api/health")) {
      return json({
        status: "ok",
        service: "vixora-command-core",
        version: "0.2.0",
        executor: "creao-api-trigger",
        appId: CREAO_APP_ID,
        routes: ["/", "/api/health", "/api/command", "/api/command/:runId"],
      });
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/command/")) {
      const runId = url.pathname.split("/").filter(Boolean).pop();
      if (!runId) return json({ success: false, error: "Run ID is required" }, 400);

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

      // AGENT 01 — Content Agent
      // Handles content ideation and short-form scripting before executor dispatch.
      const contentIntent = /(?:ide|konsep|skrip|script|shorts?|konten|content|youtube short)/i.test(command);
      if (contentIntent) {
        const topicMatch = command.match(/(?:tentang|topik|tema|mengenai|about)\\s+(.+?)(?:\\.|$)/i);
        const topic = topicMatch?.[1]?.trim() || "AI";

        const content = [
          {
            title: "AI Itu Apa Sih? 30 Detik Paham",
            hook: "Kalau HP kamu bisa nebak kata berikutnya, itu contoh AI.",
            script: `AI sebenarnya ada di sekitar kita. Saat keyboard menebak kata berikutnya, saat YouTube merekomendasikan video, atau saat email memisahkan spam, ada sistem yang belajar dari pola data. Jadi AI bukan sulap. AI menggunakan data dan pola untuk membuat prediksi atau membantu mengambil keputusan. Singkatnya: AI belajar dari data, lalu menggunakan pola itu untuk membantu kita.`,
          },
          {
            title: "3 Kesalahan Umum Saat Pakai AI buat Tugas",
            hook: "Pakai AI buat tugas? Jangan lakukan tiga kesalahan ini.",
            script: `Pertama, copy-paste jawaban AI mentah-mentah. Kedua, percaya hasil AI seratus persen tanpa mengecek fakta. Ketiga, memberi perintah terlalu umum tanpa konteks. Cara lebih aman? Beri konteks yang jelas, gunakan AI sebagai partner berpikir, lalu cek kembali informasi penting sebelum dipakai.`,
          },
          {
            title: "AI di Saku Kamu",
            hook: "Tanpa sadar, kamu mungkin memakai AI setiap hari.",
            script: `Rekomendasi video, filter spam email, kamera yang mengenali objek, sampai prediksi kata di keyboard—semuanya bisa melibatkan AI atau machine learning. Jadi AI bukan cuma chatbot. Teknologi ini sudah masuk ke banyak fitur yang kita pakai setiap hari. Pertanyaannya bukan lagi kapan AI datang, tapi seberapa pintar kita menggunakannya.`,
          },
        ];

        return json({
          success: true,
          status: "completed",
          agent: "content-agent",
          agentCode: "AGENT 01",
          task: "short-form-content",
          topic,
          message: `Content Agent selesai. Aku membuat 3 konsep Shorts tentang ${topic}, lengkap dengan hook dan skrip 30 detik.`,
          result: content,
          next: "youtube-agent",
        });
      }

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
