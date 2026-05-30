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
  resumeSummary?: string | null;
  resumeRoles?: string[];
  targetRoles?: string[];
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

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function normalizeTextList(values: unknown[], limit = 12) {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const item = value.replace(/\s+/g, " ").trim();
    if (!item) continue;

    const key = item.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    items.push(item);
    if (items.length >= limit) break;
  }

  return items;
}

function sanitizeQuestion(value: unknown) {
  if (typeof value !== "string") return null;

  const question = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (question.length < 20) return null;
  return question.slice(0, 700);
}

function parseQuestion(rawText: string) {
  const withoutFence = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const first = withoutFence.indexOf("{");
  const last = withoutFence.lastIndexOf("}");

  if (first >= 0 && last > first) {
    try {
      const parsed = JSON.parse(withoutFence.slice(first, last + 1)) as {
        question?: unknown;
      };
      return sanitizeQuestion(parsed.question);
    } catch {
      // Fall back to treating the provider output as plain text.
    }
  }

  return sanitizeQuestion(withoutFence);
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

async function callOpenAI(model: string, key: string, prompt: string) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are an expert interview designer. Generate one precise, candidate-specific interview question and return only structured JSON.",
      input: prompt,
      max_output_tokens: 500,
      text: {
        format: {
          type: "json_schema",
          name: "interview_question",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              question: { type: "string" },
            },
            required: ["question"],
          },
        },
      },
    }),
  });
}

function buildPrompt(
  jobRole: string,
  resumeSummary: string | null,
  resumeRoles: string[],
  targetRoles: string[],
  previousQuestions: string[],
) {
  const roleContext = normalizeRoles([jobRole, ...targetRoles, ...resumeRoles]);

  return `
Generate ONE interview question for the candidate.

Selected practice role:
${jobRole}

Candidate-entered target roles:
${targetRoles.length ? targetRoles.join(", ") : "None provided"}

Resume-derived roles:
${resumeRoles.length ? resumeRoles.join(", ") : "None provided"}

Resume summary:
${resumeSummary || "No resume summary provided."}

Questions already asked:
${previousQuestions.length ? previousQuestions.join(" | ") : "None"}

Requirements:
- Make the question specific to the selected role and candidate context.
- Prefer a realistic behavioral, project deep-dive, technical judgment, or situational question that fits the role.
- Do not ask the same question or a close paraphrase of any previous question.
- Do not mention private resume details as facts unless they are included in the summary above.
- Ask exactly one question that can be answered in 2-4 minutes.
- Avoid generic prompts like "tell me about yourself" or "what are your strengths".
- If context is thin, still tailor the question to this role: ${roleContext.join(", ") || jobRole}.

Return ONLY valid JSON:
{"question":"..."}
`.trim();
}

function getBackupQuestion(role: string, previousQuestions: string[]) {
  const normalizedRole = role.trim() || "Software Engineer";
  const templates = [
    "Walk me through a project where your decisions as a {role} changed the final outcome. What tradeoffs did you make?",
    "Describe a difficult problem you solved as a {role}. How did you diagnose it, and what evidence showed your solution worked?",
    "Tell me about a time you disagreed with a teammate or stakeholder while working as a {role}. How did you handle it?",
    "What is one measurable result you delivered as a {role}? Explain your specific contribution and what you would improve now.",
    "Imagine you join a team as a {role} and inherit a project with unclear requirements. What would you do in your first week?",
    "Tell me about feedback you received as a {role}. What changed in your work afterward?",
  ];
  const previous = new Set(previousQuestions.map((q) => q.toLowerCase()));
  const candidates = templates.map((template) =>
    template.replace("{role}", normalizedRole),
  );

  return (
    candidates.find((question) => !previous.has(question.toLowerCase())) ||
    candidates[Math.floor(Math.random() * candidates.length)]
  );
}

DenoRuntime.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let requestedJobRole = "Software Engineer";

  try {
    const {
      jobRole = "Software Engineer",
      resumeSummary = null,
      resumeRoles = [],
      targetRoles = [],
      previousQuestions = [],
    } = (await req.json()) as RequestBody;

    requestedJobRole = jobRole;

    const cleanJobRole = normalizeRole(jobRole) || "Software Engineer";
    const cleanResumeSummary =
      typeof resumeSummary === "string" && resumeSummary.trim()
        ? resumeSummary.replace(/\s+/g, " ").trim().slice(0, 1600)
        : null;
    const cleanResumeRoles = normalizeRoles(resumeRoles);
    const cleanTargetRoles = normalizeRoles(targetRoles);
    const cleanPreviousQuestions = normalizeTextList(previousQuestions, 12);

    const prompt = buildPrompt(
      cleanJobRole,
      cleanResumeSummary,
      cleanResumeRoles,
      cleanTargetRoles,
      cleanPreviousQuestions,
    );

    const openAIKey = DenoRuntime.env.get("OPENAI_API_KEY");
    const openAIModel = DenoRuntime.env.get("OPENAI_MODEL") || "gpt-5.2";
    const geminiKey = DenoRuntime.env.get("GEMINI_API_KEY");
    const geminiModel =
      DenoRuntime.env.get("GEMINI_MODEL") || "gemini-2.5-flash-lite";
    const providerPreference =
      DenoRuntime.env.get("AI_PROVIDER")?.toLowerCase() || "openai";
    const providerOrder =
      providerPreference === "gemini"
        ? ["gemini", "openai"]
        : ["openai", "gemini"];

    const attemptedProviders: string[] = [];

    for (const provider of providerOrder) {
      if (provider === "openai" && openAIKey) {
        attemptedProviders.push(`openai:${openAIModel}`);
        try {
          const aiRes = await callOpenAI(openAIModel, openAIKey, prompt);
          if (aiRes.ok) {
            const aiData = (await aiRes.json()) as OpenAIResponsesResponse;
            const question = parseQuestion(extractOpenAIText(aiData));
            if (question) {
              return jsonResponse({
                question,
                provider: "openai",
                modelUsed: openAIModel,
                usedFallback: false,
              });
            }
          }
        } catch {
          // Try the next configured provider.
        }
      }

      if (provider === "gemini" && geminiKey) {
        const modelsToTry = [
          geminiModel,
          "gemini-2.5-flash-lite",
          "gemini-2.0-flash",
          "gemini-1.5-flash-latest",
        ].filter((model, index, models) => models.indexOf(model) === index);

        for (const model of modelsToTry) {
          attemptedProviders.push(`gemini:${model}`);
          let aiRes = await callGemini(model, geminiKey, prompt);
          if (aiRes.status === 429) {
            await new Promise((r) => setTimeout(r, 1200));
            aiRes = await callGemini(model, geminiKey, prompt);
          }

          if (!aiRes.ok) {
            if (aiRes.status === 404 || aiRes.status === 429) continue;
            break;
          }

          const aiData = (await aiRes.json()) as GeminiResponse;
          const text =
            aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          const question = parseQuestion(text);
          if (question) {
            return jsonResponse({
              question,
              provider: "gemini",
              modelUsed: model,
              usedFallback: false,
            });
          }
        }
      }
    }

    return jsonResponse({
      question: getBackupQuestion(cleanJobRole, cleanPreviousQuestions),
      usedFallback: true,
      reason:
        attemptedProviders.length > 0
          ? "AI provider did not return a valid question"
          : "No AI provider configured",
      attemptedProviders,
    });
  } catch (e: unknown) {
    return jsonResponse({
      question: getBackupQuestion(requestedJobRole, []),
      usedFallback: true,
      reason: e instanceof Error ? e.message : "Unknown server error",
    });
  }
});
