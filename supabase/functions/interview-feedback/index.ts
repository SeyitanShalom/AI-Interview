import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Feedback = {
  rubric_scores: {
    content: number;
    structure: number;
    clarity: number;
    impact: number;
    confidence: number;
  };
  content_score: number;
  style_score: number;
  overall_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  content_analysis: string;
  style_analysis: string;
};

type RequestBody = {
  sessionId?: string;
  jobRole?: string;
  question?: string;
  transcript?: string | null;
};

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

const MIN_TRANSCRIPT_WORDS = 20;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildFallbackFeedback(
  jobRole: string,
  question: string,
  transcript: string | null,
): Feedback {
  const words = (transcript ?? "").trim().split(/\s+/).filter(Boolean).length;
  const hasTranscript = words > 0;

  const content = clampScore(
    hasTranscript ? 45 + Math.min(words * 0.28, 35) : 45,
  );
  const structure = clampScore(
    hasTranscript ? 42 + Math.min(words * 0.24, 35) : 44,
  );
  const clarity = clampScore(
    hasTranscript ? 50 + Math.min(words * 0.18, 30) : 50,
  );
  const impact = clampScore(
    hasTranscript ? 38 + Math.min(words * 0.3, 38) : 40,
  );
  const confidence = clampScore(
    hasTranscript ? 52 + Math.min(words * 0.16, 28) : 52,
  );

  const contentScore = clampScore(
    content * 0.5 + structure * 0.3 + impact * 0.2,
  );
  const styleScore = clampScore(clarity * 0.6 + confidence * 0.4);
  const overallScore = clampScore(contentScore * 0.6 + styleScore * 0.4);

  return {
    rubric_scores: { content, structure, clarity, impact, confidence },
    content_score: contentScore,
    style_score: styleScore,
    overall_score: overallScore,
    summary: hasTranscript
      ? "Initial rubric-based feedback was generated locally. Add stronger evidence and outcomes to improve precision."
      : "Video submission was received, but no transcript text was provided for deep analysis. A baseline feedback profile has been generated.",
    strengths: [
      "Response stayed relevant to the interview prompt.",
      "Communication was understandable and easy to follow.",
      "You demonstrated a problem-solving mindset.",
    ],
    improvements: [
      "Use the STAR format (Situation, Task, Action, Result) for stronger structure.",
      "Add specific outcomes or metrics to show impact.",
      "End with one concise takeaway tied to the role.",
    ],
    content_analysis: `Role: ${jobRole}. Question analyzed: ${question}. Focus on clearer problem framing and concrete achievements to raise your content score.`,
    style_analysis:
      "Aim for confident pacing, concise sentences, and a stronger closing statement to improve delivery.",
  };
}

async function callGeminiFeedback(
  key: string,
  model: string,
  jobRole: string,
  question: string,
  transcript: string | null,
) {
  const prompt = `
You are an interview coach. Evaluate the candidate response and return ONLY strict JSON.

Role: ${jobRole}

Use this rubric with 0-100 scores for each dimension:
- content: relevance, technical depth, factual correctness
- structure: logical flow, STAR organization, coherence
- clarity: concise language, readability, specificity
- impact: measurable outcomes, business/user value, ownership
- confidence: decisive tone, assertiveness, poise

Weighting rules:
- content_score = 50% content + 30% structure + 20% impact
- style_score = 60% clarity + 40% confidence
- overall_score = 60% content_score + 40% style_score

Required JSON shape:
{
  "rubric_scores": {
    "content": number,
    "structure": number,
    "clarity": number,
    "impact": number,
    "confidence": number
  },
  "content_score": number,
  "style_score": number,
  "overall_score": number,
  "summary": string,
  "strengths": [string, string, string],
  "improvements": [string, string, string],
  "content_analysis": string,
  "style_analysis": string
}

Interview question:
${question}

Candidate transcript (may be empty):
${transcript || "(no transcript provided)"}

Return only JSON, no markdown code fences.
`.trim();

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

function parseGeminiJson(rawText: string): Feedback | null {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/, "")
    .trim();

  const first = withoutFence.indexOf("{");
  const last = withoutFence.lastIndexOf("}");
  if (first === -1 || last === -1 || first >= last) return null;

  try {
    const parsed = JSON.parse(
      withoutFence.slice(first, last + 1),
    ) as Partial<Feedback>;

    const rubric = parsed.rubric_scores;
    if (
      !rubric ||
      typeof rubric.content !== "number" ||
      typeof rubric.structure !== "number" ||
      typeof rubric.clarity !== "number" ||
      typeof rubric.impact !== "number" ||
      typeof rubric.confidence !== "number" ||
      typeof parsed.content_score !== "number" ||
      typeof parsed.style_score !== "number" ||
      typeof parsed.overall_score !== "number" ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.strengths) ||
      !Array.isArray(parsed.improvements) ||
      typeof parsed.content_analysis !== "string" ||
      typeof parsed.style_analysis !== "string"
    ) {
      return null;
    }

    return {
      rubric_scores: {
        content: clampScore(rubric.content),
        structure: clampScore(rubric.structure),
        clarity: clampScore(rubric.clarity),
        impact: clampScore(rubric.impact),
        confidence: clampScore(rubric.confidence),
      },
      content_score: clampScore(parsed.content_score),
      style_score: clampScore(parsed.style_score),
      overall_score: clampScore(parsed.overall_score),
      summary: parsed.summary,
      strengths: parsed.strengths.map((s) => String(s)).slice(0, 5),
      improvements: parsed.improvements.map((s) => String(s)).slice(0, 5),
      content_analysis: parsed.content_analysis,
      style_analysis: parsed.style_analysis,
    };
  } catch {
    return null;
  }
}

async function updateSessionFeedback(
  req: Request,
  sessionId: string,
  feedback: Feedback,
) {
  const supabaseUrl = DenoRuntime.env.get("SUPABASE_URL");
  const anonKey = DenoRuntime.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return;

  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  await supabase
    .from("interview_sessions")
    .update({
      ai_feedback: feedback,
      overall_score: feedback.overall_score,
      status: "completed",
    })
    .eq("id", sessionId);
}

DenoRuntime.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const {
      sessionId,
      jobRole = "Software Engineer",
      question,
      transcript = null,
    } = (await req.json()) as RequestBody;

    if (!sessionId || !question) {
      return jsonResponse(
        { error: "sessionId and question are required" },
        400,
      );
    }

    const normalizedTranscript = (transcript ?? "").trim();
    const transcriptWordCount = normalizedTranscript
      .split(/\s+/)
      .filter(Boolean).length;

    if (transcriptWordCount < MIN_TRANSCRIPT_WORDS) {
      return jsonResponse(
        {
          error: `I couldn't hear enough speech in the recording to score it accurately. Please record again and speak more clearly. Minimum words: ${MIN_TRANSCRIPT_WORDS}.`,
          minWords: MIN_TRANSCRIPT_WORDS,
          actualWords: transcriptWordCount,
        },
        422,
      );
    }

    const geminiKey = DenoRuntime.env.get("GEMINI_API_KEY");
    const geminiModel =
      DenoRuntime.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

    let feedback: Feedback = buildFallbackFeedback(
      jobRole,
      question,
      normalizedTranscript,
    );
    let usedFallback = true;

    if (geminiKey) {
      const geminiRes = await callGeminiFeedback(
        geminiKey,
        geminiModel,
        jobRole,
        question,
        normalizedTranscript,
      );

      if (geminiRes.ok) {
        const geminiData = (await geminiRes.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const text =
          geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = parseGeminiJson(text);
        if (parsed) {
          feedback = parsed;
          usedFallback = false;
        }
      }
    }

    await updateSessionFeedback(req, sessionId, feedback);

    return jsonResponse({ feedback, usedFallback }, 200);
  } catch (e: unknown) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown server error" },
      500,
    );
  }
});
