// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Minimal local typing for VS Code TS server
type DenoLike = {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const DenoRuntime = (globalThis as unknown as { Deno: DenoLike }).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  jobRole?: string;
  previousQuestions?: string[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

async function callGemini(model: string, key: string, prompt: string) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    },
  );
}

DenoRuntime.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { jobRole = "Software Engineer", previousQuestions = [] } =
      (await req.json()) as RequestBody;

    const GEMINI_API_KEY = DenoRuntime.env.get("GEMINI_API_KEY");
    const GEMINI_MODEL =
      DenoRuntime.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const prompt = `
Generate ONE interview question for a ${jobRole} candidate.
Requirements:
- Behavioral or situational
- Clear and professional
- Avoid repeating these questions: ${previousQuestions.join(" | ") || "none"}
Return only the question text.
`.trim();

    const modelsToTry = [
      GEMINI_MODEL,
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
    ];
    let aiRes: Response | null = null;
    let modelUsed: string | null = null;

    for (const model of modelsToTry) {
      modelUsed = model;

      // retry once on 429
      aiRes = await callGemini(model, GEMINI_API_KEY, prompt);
      if (aiRes.status === 429) {
        await new Promise((r) => setTimeout(r, 1200));
        aiRes = await callGemini(model, GEMINI_API_KEY, prompt);
      }

      if (aiRes.ok) break;
      if (aiRes.status !== 404 && aiRes.status !== 429) break;
    }

    if (!aiRes || !aiRes.ok) {
      const details = aiRes ? await aiRes.text() : "No response";
      return new Response(
        JSON.stringify({
          error: "AI provider error",
          status: aiRes?.status ?? 500,
          modelUsed,
          modelsTried: modelsToTry,
          details,
        }),
        {
          status: aiRes?.status ?? 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiData = (await aiRes.json()) as GeminiResponse;
    const question =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Tell me about a challenging project and your impact.";

    return new Response(JSON.stringify({ question }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
