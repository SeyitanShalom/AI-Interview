import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import pdf from "pdf-parse";
import mammoth from "mammoth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

type ResumeProfile = {
  summary: string | null;
  roles: string[];
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; details?: unknown };
    return [maybeError.message, maybeError.details]
      .filter((part): part is string => typeof part === "string" && !!part)
      .join(" ");
  }

  return typeof error === "string" ? error : "";
}

function isMissingProfileRoleColumn(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("schema cache") &&
    (message.includes("resume_roles") || message.includes("target_roles"))
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
        "You extract candidate profile data from resumes. Return only the requested structured JSON and do not invent roles that are not supported by the resume.",
      input: prompt,
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          name: "resume_profile",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              roles: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["summary", "roles"],
          },
        },
      },
    }),
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
    if (roles.length >= 8) break;
  }

  return roles;
}

function extractFallbackRoles(text: string) {
  const roles: string[] = [];
  const titlePattern =
    /\b(?:job title|role|position)\s*[:\-]\s*([A-Za-z][A-Za-z0-9\s/&+.#-]{2,80})/gi;
  const commonRolePattern =
    /\b(?:senior|sr\.?|junior|jr\.?|lead|principal|staff|associate)?\s*(?:software engineer|frontend engineer|front-end engineer|frontend developer|front-end developer|backend engineer|back-end engineer|backend developer|back-end developer|full stack engineer|full-stack engineer|full stack developer|full-stack developer|web developer|mobile developer|data analyst|data scientist|data engineer|machine learning engineer|ai engineer|product manager|project manager|program manager|business analyst|ux designer|ui designer|product designer|devops engineer|cloud engineer|qa engineer|quality assurance engineer|cybersecurity analyst|security analyst|systems administrator|network engineer|accountant|marketing manager|sales representative|customer success manager|human resources manager|content writer)\b/gi;

  for (const match of text.matchAll(titlePattern)) {
    roles.push(match[1]);
  }

  for (const match of text.matchAll(commonRolePattern)) {
    roles.push(match[0]);
  }

  return normalizeRoles(roles);
}

function buildFallbackResumeProfile(text: string): ResumeProfile {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return {
    summary: cleaned
      ? cleaned.slice(0, 320) + (cleaned.length > 320 ? "..." : "")
      : null,
    roles: extractFallbackRoles(text),
  };
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

function parseResumeProfile(rawText: string, fallback: ResumeProfile) {
  const withoutFence = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const first = withoutFence.indexOf("{");
  const last = withoutFence.lastIndexOf("}");
  const jsonText =
    first >= 0 && last > first
      ? withoutFence.slice(first, last + 1)
      : withoutFence;

  try {
    const parsed = JSON.parse(jsonText) as {
      summary?: unknown;
      roles?: unknown;
    };
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.replace(/\s+/g, " ").trim()
        : fallback.summary;
    const roles = Array.isArray(parsed.roles)
      ? normalizeRoles(parsed.roles)
      : fallback.roles;

    return {
      summary,
      roles: roles.length > 0 ? roles : fallback.roles,
    };
  } catch {
    return fallback;
  }
}

async function generateResumeProfile(
  resumeText: string,
  filename: string,
): Promise<ResumeProfile> {
  const fallback = buildFallbackResumeProfile(resumeText);
  const trimmedText = resumeText.replace(/\s+/g, " ").trim();
  if (!trimmedText) return fallback;

  const openAIKey = process.env.OPENAI_API_KEY;
  const openAIModel = process.env.OPENAI_MODEL || "gpt-5.2";
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const providerPreference = process.env.AI_PROVIDER?.toLowerCase();
  const snippet = trimmedText.slice(0, 12000);

  const prompt = `
You are a career coach and ATS expert.
Extract a concise candidate profile from this resume.

Goals:
- Capture the person's seniority, core strengths, domain(s), and strongest achievements.
- Mention concrete skills, tools, and measurable impact if present.
- Extract up to 8 job roles/titles the candidate has held or is clearly suited for.
- Prefer specific titles over broad departments.
- Do not invent roles that are not supported by the resume.
- Keep it readable, specific, and professional.
- Do not mention that this is a resume or that you are an AI.
- Avoid generic filler like "hard-working" unless supported by evidence.

Return ONLY valid JSON in this exact shape:
{"summary":"2-4 sentences","roles":["Role 1","Role 2"]}

Resume filename: ${filename}
Resume text:
${snippet}
`.trim();

  const providerOrder =
    providerPreference === "gemini"
      ? ["gemini", "openai"]
      : ["openai", "gemini"];

  for (const provider of providerOrder) {
    if (provider === "openai" && openAIKey) {
      try {
        const aiRes = await callOpenAI(openAIModel, openAIKey, prompt);
        if (aiRes.ok) {
          const aiData = (await aiRes.json()) as OpenAIResponsesResponse;
          const text = extractOpenAIText(aiData);
          const parsed = parseResumeProfile(text, fallback);
          if (parsed.summary || parsed.roles.length > 0) return parsed;
        }
      } catch (error) {
        console.warn("OpenAI resume extraction failed", error);
      }
    }

    if (provider === "gemini" && geminiKey) {
      const modelsToTry = [
        geminiModel,
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
      ];

      for (const model of modelsToTry) {
        let aiRes = await callGemini(model, geminiKey, prompt);
        if (aiRes.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          aiRes = await callGemini(model, geminiKey, prompt);
        }

        if (!aiRes.ok) {
          if (aiRes.status === 404 || aiRes.status === 429) continue;
          break;
        }

        const aiData = (await aiRes.json()) as GeminiResponse;
        const text =
          aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        const parsed = parseResumeProfile(text, fallback);
        if (parsed.summary || parsed.roles.length > 0) return parsed;
      }
    }
  }

  return fallback;
}

async function getOwnerId(request: Request) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { ownerId: null, error: "Missing Supabase config", status: 500 };
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (!userErr && userData?.user) {
    return { ownerId: userData.user.id, error: null, status: 200 };
  }

  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ownerId: null, error: "Unauthorized", status: 401 };
  }

  const token = authHeader.split(" ")[1];
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!userResp.ok) {
    return { ownerId: null, error: "Invalid token", status: 401 };
  }

  const userJson = (await userResp.json()) as { id?: string | null };
  return { ownerId: userJson?.id ?? null, error: null, status: 200 };
}

async function extractResumeText(file: File, buffer: Buffer, filename: string) {
  if (
    file.type === "application/pdf" ||
    filename.toLowerCase().endsWith(".pdf")
  ) {
    const parsed = await pdf(buffer);
    return parsed?.text ?? null;
  }

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx") ||
    filename.toLowerCase().endsWith(".doc")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result?.value ?? null;
  }

  return buffer.toString("utf-8");
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    if (!serviceRole) {
      return NextResponse.json(
        { error: "Service role key missing" },
        { status: 500 },
      );
    }

    const ownerResult = await getOwnerId(request);
    if (!ownerResult.ownerId) {
      return NextResponse.json(
        { error: ownerResult.error || "Unauthorized" },
        { status: ownerResult.status },
      );
    }

    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const ownerId = ownerResult.ownerId;
    const filename = file.name || `resume-${Date.now()}`;
    const safeFilename = filename.replace(/[^\w.\-]+/g, "-");
    const filePath = `${ownerId}/resume-${Date.now()}-${safeFilename}`;

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("resumes")
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || "Upload failed" },
        { status: 500 },
      );
    }

    const { data: urlData } = await admin.storage
      .from("resumes")
      .getPublicUrl(filePath);
    const publicUrl = urlData?.publicUrl ?? null;

    let resumeText: string | null = null;
    try {
      resumeText = await extractResumeText(file, buffer, filename);
    } catch (error) {
      console.warn("resume extraction failed", error);
    }

    const resumeProfile = resumeText
      ? await generateResumeProfile(resumeText, filename)
      : { summary: null, roles: [] };

    console.log("[resume-upload] ownerId:", ownerId);
    console.log("[resume-upload] filename:", filename);
    console.log(
      "[resume-upload] resumeText length:",
      resumeText ? resumeText.length : 0,
    );
    console.log("[resume-upload] resumeSummary:", resumeProfile.summary);
    console.log("[resume-upload] resumeRoles:", resumeProfile.roles);

    const profilePayload = {
      id: ownerId,
      user_id: ownerId,
      role: "candidate",
      resume_url: publicUrl,
      resume_text: resumeText,
      resume_summary: resumeProfile.summary,
      resume_roles: resumeProfile.roles,
    };
    const { data: profile, error: upsertError } = await admin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "user_id" })
      .select("resume_url, resume_summary, resume_roles, target_roles")
      .single();

    if (upsertError) {
      console.error("[resume-upload] upsert error:", upsertError);
      if (isMissingProfileRoleColumn(upsertError)) {
        const { data: fallbackProfile, error: fallbackError } = await admin
          .from("profiles")
          .upsert(
            {
              id: ownerId,
              user_id: ownerId,
              role: "candidate",
              resume_url: publicUrl,
              resume_text: resumeText,
              resume_summary: resumeProfile.summary,
            },
            { onConflict: "user_id" },
          )
          .select("resume_url, resume_summary")
          .single();

        if (fallbackError) {
          return NextResponse.json(
            { error: fallbackError.message || "Profile update failed" },
            { status: 500 },
          );
        }

        return NextResponse.json({
          publicUrl,
          resumeSummary: resumeProfile.summary,
          resumeRoles: resumeProfile.roles,
          rolesPersisted: false,
          profile: {
            ...(fallbackProfile ?? {}),
            resume_roles: resumeProfile.roles,
            target_roles: [],
          },
          warning:
            "Resume roles were extracted but not saved because the profile role columns are missing. Run the latest Supabase migration.",
        });
      }

      return NextResponse.json(
        { error: upsertError.message || "Profile update failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      publicUrl,
      resumeSummary: resumeProfile.summary,
      resumeRoles: resumeProfile.roles,
      rolesPersisted: true,
      profile: profile ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
