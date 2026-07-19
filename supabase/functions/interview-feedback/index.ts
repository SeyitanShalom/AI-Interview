import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Feedback = {
  rubric_scores: {
    content: number;
    structure: number;
    clarity: number;
    impact: number;
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
  answers?: Array<{
    question?: string;
    transcript?: string | null;
  }>;
  resumeSummary?: string | null;
  resumeRoles?: string[];
  targetRoles?: string[];
};

type InterviewAnswer = {
  question: string;
  transcript: string;
};

type DenoLike = {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
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

type OpenAIResponsesResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const DenoRuntime = (globalThis as unknown as { Deno: DenoLike }).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_TRANSCRIPT_WORDS = 12;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeRole(value: unknown) {
  if (typeof value !== "string") return null;

  const role = value
    .replace(/[\u2022*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, "")
    .trim();

  if (role.length < 2 || role.length > 80) return null;
  return role;
}

function normalizeRoles(values: unknown[]) {
  const seen = new Set<string>();
  const roles: string[] = [];

  for (const value of values) {
    const role = normalizeRole(value);
    if (!role) continue;

    const key = role.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    roles.push(role);
    if (roles.length >= 12) break;
  }

  return roles;
}

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim()
    : fallback;
}

function coerceStringList(values: unknown, fallback: string[]) {
  if (!Array.isArray(values)) return fallback;

  const list = values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, 5);

  return list.length > 0 ? list : fallback;
}

function normalizeAnswers(
  values: unknown,
  fallbackQuestion: string,
): InterviewAnswer[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((value, index) => {
      if (!value || typeof value !== "object") return null;

      const maybeAnswer = value as {
        question?: unknown;
        transcript?: unknown;
      };

      const transcript = normalizeText(maybeAnswer.transcript);
      if (!transcript) return null;

      const question = normalizeText(
        maybeAnswer.question,
        index === 0 ? fallbackQuestion : `Question ${index + 1}`,
      );

      return {
        question: question || `Question ${index + 1}`,
        transcript,
      } satisfies InterviewAnswer;
    })
    .filter((value): value is InterviewAnswer => Boolean(value))
    .slice(0, 20);
}

function scoreFromTranscript(words: number, hasMetrics: boolean) {
  const content = clampScore(34 + Math.min(words * 0.3, 38) + (hasMetrics ? 8 : 0));
  const structure = clampScore(34 + Math.min(words * 0.26, 36));
  const clarity = clampScore(42 + Math.min(words * 0.18, 34));
  const impact = clampScore(28 + Math.min(words * 0.28, 36) + (hasMetrics ? 10 : 0));

  return { content, structure, clarity, impact };
}

function buildInsufficientTranscriptFeedback(
  question: string,
  words: number,
): Feedback {
  return {
    rubric_scores: {
      content: 0,
      structure: 0,
      clarity: 0,
      impact: 0,
    },
    content_score: 0,
    style_score: 0,
    overall_score: 0,
    summary:
      words > 0
        ? `Only ${words} transcript words were captured, which is not enough speech to evaluate accurately. Please record the answer again or enter the transcript manually.`
        : "No speech transcript was captured, so this answer cannot be evaluated accurately. Please record the answer again or enter the transcript manually.",
    strengths: [],
    improvements: [
      "Record a complete spoken answer before submitting for feedback.",
      "If automatic transcription misses your answer, paste the transcript manually and submit again.",
    ],
    content_analysis: `Question analyzed: ${question}. There was not enough transcript evidence to score the answer.`,
    style_analysis:
      "Clarity cannot be assessed until enough speech is captured in the transcript.",
  };
}

function buildFallbackFeedback(
  jobRole: string,
  question: string,
  transcript: string | null,
): Feedback {
  const normalizedTranscript = normalizeText(transcript);
  const words = countWords(normalizedTranscript);
  const hasTranscript = words >= MIN_TRANSCRIPT_WORDS;
  const hasMetrics = /(\d+|percent|revenue|users|customers|latency|cost|time|growth|conversion|accuracy|quality)/i.test(
    normalizedTranscript,
  );

  if (!hasTranscript) {
    return buildInsufficientTranscriptFeedback(question, words);
  }

  const rubric = scoreFromTranscript(words, hasMetrics);
  const contentScore = clampScore(
    rubric.content * 0.5 + rubric.structure * 0.3 + rubric.impact * 0.2,
  );
  const styleScore = rubric.clarity;
  const overallScore = clampScore(contentScore * 0.6 + styleScore * 0.4);

  return {
    rubric_scores: rubric,
    content_score: contentScore,
    style_score: styleScore,
    overall_score: overallScore,
    summary: hasTranscript
      ? `Baseline rubric feedback for this ${jobRole} answer was generated from ${words} transcript words. More concrete evidence would make the assessment sharper.`
      : "No transcript text was available, so only a minimal baseline assessment could be generated.",
    strengths: hasTranscript
      ? [
          "The answer gives enough material to evaluate relevance to the question.",
          hasMetrics
            ? "The response includes some concrete evidence or measurable language."
            : "The response attempts to explain the candidate's approach.",
          "The response stays connected to the interview prompt.",
        ]
      : [
          "The submission was received successfully.",
          "The interview question is available for a later review.",
          "A full assessment can be generated once transcript text is provided.",
        ],
    improvements: [
      "Use Situation, Task, Action, and Result to make the answer easier to score.",
      "Add specific decisions, tradeoffs, and measurable outcomes.",
      "Close by tying the example back to the role and the question asked.",
    ],
    content_analysis: `Question analyzed: ${question}. The answer should be scored on evidence from the transcript, not on assumed resume experience.`,
    style_analysis:
      "Aim for concise sentences, clear sequencing, and a direct closing takeaway.",
  };
}

function buildPrompt(
  jobRole: string,
  question: string,
  transcript: string,
  answers: InterviewAnswer[],
  resumeSummary: string | null,
  resumeRoles: string[],
  targetRoles: string[],
) {
  const answerSections =
    answers.length > 0
      ? answers
          .map(
            (entry, index) => `Question ${index + 1}: ${entry.question}\nAnswer ${index + 1}: ${entry.transcript}`,
          )
          .join("\n\n")
      : "";

  return `
Evaluate this candidate interview answer and return strict JSON.

Role being practiced:
${jobRole}

Candidate-entered target roles:
${targetRoles.length ? targetRoles.join(", ") : "None provided"}

Resume-derived roles:
${resumeRoles.length ? resumeRoles.join(", ") : "None provided"}

Resume summary for calibration only:
${resumeSummary || "No resume summary provided."}

Interview question:
${question}

${answerSections ? `Candidate answers by question:\n${answerSections}` : `Candidate transcript:\n${transcript || "(no transcript provided)"}`}

Scoring rules:
- Score only what the transcript demonstrates.
- When multiple answers are provided, score each answer independently first, then evaluate the overall pattern across answers.
- Do not average away a weak answer; call out the specific question or answer that needs improvement.
- Use resume context only to calibrate role expectations; do not award points for resume claims that are not present in the answer.
- Penalize vague, generic, off-topic, or very short answers even if the resume context is strong.
- Reward specific actions, decisions, tradeoffs, role-relevant depth, and measurable outcomes.
- Reference concrete details from the answer when possible.
- If evidence is missing, say what evidence is missing instead of filling gaps.

Rubric, 0-100:
- content: relevance to the question, role-specific depth, factual/technical soundness
- structure: logical flow, STAR organization, coherence
- clarity: concise language, readability, specificity
- impact: measurable outcomes, user/business value, ownership

Weighting rules:
- content_score = 50% content + 30% structure + 20% impact
- style_score = clarity
- overall_score = 60% content_score + 40% style_score

Required JSON shape:
{
  "rubric_scores": {
    "content": number,
    "structure": number,
    "clarity": number,
    "impact": number
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

Return only JSON, no markdown code fences.
`.trim();
}

async function callGeminiFeedback(key: string, model: string, prompt: string) {
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

async function callOpenAIFeedback(key: string, model: string, prompt: string) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are a rigorous interview evaluator. Score only transcript evidence, use role context for calibration, and return only strict JSON.",
      input: prompt,
      max_output_tokens: 1800,
      text: {
        format: {
          type: "json_schema",
          name: "interview_feedback",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              rubric_scores: {
                type: "object",
                additionalProperties: false,
                properties: {
                  content: { type: "number" },
                  structure: { type: "number" },
                  clarity: { type: "number" },
                  impact: { type: "number" },
                },
                required: [
                  "content",
                  "structure",
                  "clarity",
                  "impact",
                ],
              },
              content_score: { type: "number" },
              style_score: { type: "number" },
              overall_score: { type: "number" },
              summary: { type: "string" },
              strengths: {
                type: "array",
                items: { type: "string" },
              },
              improvements: {
                type: "array",
                items: { type: "string" },
              },
              content_analysis: { type: "string" },
              style_analysis: { type: "string" },
            },
            required: [
              "rubric_scores",
              "content_score",
              "style_score",
              "overall_score",
              "summary",
              "strengths",
              "improvements",
              "content_analysis",
              "style_analysis",
            ],
          },
        },
      },
    }),
  });
}

function extractOpenAIText(payload: OpenAIResponsesResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text?.trim()))
      .join("\n")
      .trim() || ""
  );
}

function parseFeedbackJson(rawText: string, fallback: Feedback): Feedback | null {
  const withoutFence = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
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
      typeof rubric.impact !== "number"
    ) {
      return null;
    }

    const cleanRubric = {
      content: clampScore(rubric.content),
      structure: clampScore(rubric.structure),
      clarity: clampScore(rubric.clarity),
      impact: clampScore(rubric.impact),
    };
    const contentScore = clampScore(
      cleanRubric.content * 0.5 +
        cleanRubric.structure * 0.3 +
        cleanRubric.impact * 0.2,
    );
    const styleScore = cleanRubric.clarity;
    const overallScore = clampScore(contentScore * 0.6 + styleScore * 0.4);

    return {
      rubric_scores: cleanRubric,
      content_score: contentScore,
      style_score: styleScore,
      overall_score: overallScore,
      summary: normalizeText(parsed.summary, fallback.summary),
      strengths: coerceStringList(parsed.strengths, fallback.strengths),
      improvements: coerceStringList(
        parsed.improvements,
        fallback.improvements,
      ),
      content_analysis: normalizeText(
        parsed.content_analysis,
        fallback.content_analysis,
      ),
      style_analysis: normalizeText(
        parsed.style_analysis,
        fallback.style_analysis,
      ),
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

  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from("interview_sessions")
    .update({
      ai_feedback: feedback,
      content_score: feedback.content_score,
      style_score: feedback.style_score,
      overall_score: feedback.overall_score,
      status: "completed",
      completed_at: completedAt,
    })
    .eq("id", sessionId);

  if (!error) return;

  console.warn(
    "Full feedback update failed; retrying with base session columns.",
    error,
  );

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
      answers = [],
      resumeSummary = null,
      resumeRoles = [],
      targetRoles = [],
    } = (await req.json()) as RequestBody;

    if (!sessionId || !question) {
      return jsonResponse(
        { error: "sessionId and question are required" },
        400,
      );
    }

    const cleanJobRole = normalizeRole(jobRole) || "Software Engineer";
    const cleanQuestion = normalizeText(question);
    const normalizedTranscript = normalizeText(transcript);
    const normalizedAnswers = normalizeAnswers(answers, cleanQuestion);
    const combinedAnswerTranscript = normalizedAnswers
      .map((entry, index) => `Question ${index + 1}: ${entry.question}\nAnswer ${index + 1}: ${entry.transcript}`)
      .join("\n\n");
    const feedbackTranscript = combinedAnswerTranscript || normalizedTranscript;
    const transcriptWordCount = countWords(feedbackTranscript);
    const cleanResumeSummary =
      typeof resumeSummary === "string" && resumeSummary.trim()
        ? resumeSummary.replace(/\s+/g, " ").trim().slice(0, 1600)
        : null;
    const cleanResumeRoles = normalizeRoles(resumeRoles);
    const cleanTargetRoles = normalizeRoles(targetRoles);

    const fallbackFeedback = buildFallbackFeedback(
      cleanJobRole,
      cleanQuestion,
      feedbackTranscript,
    );
    let feedback: Feedback = fallbackFeedback;
    let usedFallback = true;
    let provider: string | null = null;
    let modelUsed: string | null = null;

    const prompt = buildPrompt(
      cleanJobRole,
      cleanQuestion,
      feedbackTranscript,
      normalizedAnswers,
      cleanResumeSummary,
      cleanResumeRoles,
      cleanTargetRoles,
    );

    const openAIKey = DenoRuntime.env.get("OPENAI_API_KEY");
    const openAIModel = DenoRuntime.env.get("OPENAI_MODEL") || "gpt-5.2";
    const geminiKey = DenoRuntime.env.get("GEMINI_API_KEY");
    const geminiModel =
      DenoRuntime.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
    const providerPreference =
      DenoRuntime.env.get("AI_PROVIDER")?.toLowerCase() || "openai";
    const providerOrder =
      providerPreference === "gemini"
        ? ["gemini", "openai"]
        : ["openai", "gemini"];

    if (transcriptWordCount >= MIN_TRANSCRIPT_WORDS) {
      for (const candidateProvider of providerOrder) {
        if (candidateProvider === "openai" && openAIKey) {
          try {
            const aiRes = await callOpenAIFeedback(
              openAIKey,
              openAIModel,
              prompt,
            );
            if (aiRes.ok) {
              const aiData = (await aiRes.json()) as OpenAIResponsesResponse;
              const parsed = parseFeedbackJson(
                extractOpenAIText(aiData),
                fallbackFeedback,
              );
              if (parsed) {
                feedback = parsed;
                usedFallback = false;
                provider = "openai";
                modelUsed = openAIModel;
                break;
              }
            }
          } catch {
            // Try the next configured provider.
          }
        }

        if (candidateProvider === "gemini" && geminiKey) {
          const modelsToTry = [
            geminiModel,
            "gemini-2.0-flash",
            "gemini-1.5-flash-latest",
          ];

          for (const model of modelsToTry) {
            let geminiRes = await callGeminiFeedback(geminiKey, model, prompt);
            if (geminiRes.status === 429) {
              await new Promise((resolve) => setTimeout(resolve, 1200));
              geminiRes = await callGeminiFeedback(geminiKey, model, prompt);
            }

            if (!geminiRes.ok) {
              if (geminiRes.status === 404 || geminiRes.status === 429) {
                continue;
              }
              break;
            }

            const geminiData = (await geminiRes.json()) as GeminiResponse;
            const text =
              geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const parsed = parseFeedbackJson(text, fallbackFeedback);
            if (parsed) {
              feedback = parsed;
              usedFallback = false;
              provider = "gemini";
              modelUsed = model;
              break;
            }
          }

          if (!usedFallback) break;
        }
      }
    }

    await updateSessionFeedback(req, sessionId, feedback);

    return jsonResponse(
      {
        feedback,
        usedFallback,
        provider,
        modelUsed,
        minProviderWords: MIN_TRANSCRIPT_WORDS,
        transcriptWordCount,
      },
      200,
    );
  } catch (e: unknown) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown server error" },
      500,
    );
  }
});
