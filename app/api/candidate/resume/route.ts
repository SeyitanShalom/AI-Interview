import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import {
  getErrorMessage,
  getMissingProfileColumns,
  isMissingProfileColumn,
  PROFILE_COMPAT_COLUMNS,
  PROFILE_CONTEXT_MIGRATION_MESSAGE,
  PROFILE_RESUME_COLUMNS,
  PROFILE_ROLE_COLUMNS,
} from "@/lib/profileSchema";

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

type ResumeProfileResult = ResumeProfile & {
  source: "text" | "gemini-file" | "fallback" | "empty";
  warning: string | null;
};

const RESUME_BUCKET = "resumes";

type StorageResult = Promise<{ error: unknown | null }>;

type ResumeStorageAdmin = {
  storage: {
    getBucket: (bucketId: string) => StorageResult;
    updateBucket: (
      bucketId: string,
      options: { public: boolean },
    ) => StorageResult;
    createBucket: (
      bucketId: string,
      options: { public: boolean },
    ) => StorageResult;
    from: (bucketId: string) => {
      upload: (
        path: string,
        body: Buffer,
        options: { contentType: string; upsert: boolean },
      ) => StorageResult;
      remove: (paths: string[]) => StorageResult;
    };
  };
};

type ProfileUpsertTable = {
  upsert: (
    payload: Record<string, unknown>,
    options: { onConflict: string },
  ) => {
    select: (columns: string) => {
      single: () => Promise<{ data: unknown; error: unknown | null }>;
    };
  };
};

function isMissingStorageBucket(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("bucket not found") ||
    message.includes("bucket does not exist") ||
    message.includes("the resource was not found")
  );
}

async function ensureResumeBucket(admin: ResumeStorageAdmin) {
  const { error: bucketError } = await admin.storage.getBucket(RESUME_BUCKET);

  if (!bucketError) {
    await admin.storage.updateBucket(RESUME_BUCKET, { public: true });
    return;
  }

  if (!isMissingStorageBucket(bucketError)) {
    throw new Error(
      `Resume bucket check failed: ${
        getErrorMessage(bucketError) || "Unknown storage error"
      }`,
    );
  }

  const { error: createError } = await admin.storage.createBucket(
    RESUME_BUCKET,
    {
      public: true,
    },
  );

  if (
    createError &&
    !getErrorMessage(createError).toLowerCase().includes("already exists")
  ) {
    throw new Error(
      `Resume bucket creation failed: ${
        getErrorMessage(createError) || "Unknown storage error"
      }`,
    );
  }
}

async function uploadResumeFile(
  admin: ResumeStorageAdmin,
  filePath: string,
  buffer: Buffer,
  contentType: string,
) {
  const upload = () =>
    admin.storage.from(RESUME_BUCKET).upload(filePath, buffer, {
      contentType,
      upsert: true,
    });

  let { error } = await upload();
  if (!error) return;

  if (!isMissingStorageBucket(error)) {
    throw new Error(getErrorMessage(error) || "Resume upload failed");
  }

  await ensureResumeBucket(admin);
  ({ error } = await upload());

  if (error) {
    throw new Error(getErrorMessage(error) || "Resume upload failed");
  }
}

function getResumeStoragePath(resumeUrl: string | null | undefined) {
  if (!resumeUrl) return null;

  try {
    const url = new URL(resumeUrl);
    const marker = `/${RESUME_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex >= 0) {
      return decodeURIComponent(
        url.pathname.slice(markerIndex + marker.length),
      );
    }
  } catch {
    // Fall back to string splitting for non-URL values.
  }

  const fallbackPath = resumeUrl.split(`/${RESUME_BUCKET}/`)[1];
  return fallbackPath ? decodeURIComponent(fallbackPath.split("?")[0]) : null;
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    return {
      admin: null,
      supabaseUrl: null,
      error: "Missing Supabase config",
      status: 500,
    };
  }

  if (!serviceRole) {
    return {
      admin: null,
      supabaseUrl,
      error: "Service role key missing",
      status: 500,
    };
  }

  return {
    admin: createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    }),
    supabaseUrl,
    error: null,
    status: 200,
  };
}

async function upsertProfileWithCompatibility(
  admin: { from: (table: string) => unknown },
  payload: Record<string, unknown>,
  selectColumns: string[],
) {
  const profileWritePayload = { ...payload };
  let profileSelectColumns = [...selectColumns];

  for (let attempt = 0; attempt <= PROFILE_COMPAT_COLUMNS.length; attempt += 1) {
    const selectColumnsText =
      profileSelectColumns.length > 0
        ? profileSelectColumns.join(", ")
        : "user_id";
    const profileTable = admin.from("profiles") as ProfileUpsertTable;
    const { data, error } = await profileTable
      .upsert(profileWritePayload, { onConflict: "user_id" })
      .select(selectColumnsText)
      .single();

    if (!error) {
      return { profile: data as Record<string, unknown> | null, error: null };
    }

    const missingUserIdColumn = isMissingProfileColumn(error, ["user_id"]);
    if (missingUserIdColumn) {
      return {
        profile: null,
        error:
          "Database migration needed: profiles.user_id is missing. Run supabase/migrations/20260523090000_repair_profile_resume_columns.sql, then try again.",
      };
    }

    const missingColumns = getMissingProfileColumns(
      error,
      PROFILE_COMPAT_COLUMNS,
    );
    if (missingColumns.length === 0) {
      return {
        profile: null,
        error: getErrorMessage(error) || "Profile update failed",
      };
    }

    for (const column of missingColumns) {
      delete profileWritePayload[column];
    }

    profileSelectColumns = profileSelectColumns.filter(
      (column) => !missingColumns.includes(column),
    );
  }

  return { profile: null, error: "Profile update failed" };
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

async function callGeminiWithFile(
  model: string,
  key: string,
  prompt: string,
  mimeType: string,
  buffer: Buffer,
) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: buffer.toString("base64"),
                },
              },
            ],
          },
        ],
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

function normalizeRoles(values: unknown[], maxRoles = 10) {
  const seen = new Set<string>();
  const roles: string[] = [];

  for (const value of values) {
    const role = normalizeRole(value);
    if (!role) continue;

    const key = role.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    roles.push(role);
    if (roles.length >= maxRoles) break;
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

  return normalizeRoles(roles, 8);
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

function getGeminiResumeModelsToTry() {
  return Array.from(
    new Set(
      [
        process.env.GEMINI_MODEL,
        process.env.GEMINI_TRANSCRIPTION_MODEL,
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
      ].filter((model): model is string => Boolean(model?.trim())),
    ),
  );
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
      ? normalizeRoles(parsed.roles, 8)
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
): Promise<ResumeProfileResult> {
  const fallback = buildFallbackResumeProfile(resumeText);
  const trimmedText = resumeText.replace(/\s+/g, " ").trim();
  if (!trimmedText) {
    return {
      ...fallback,
      source: "empty",
      warning:
        "No readable text could be extracted from the resume file. Try a text-based PDF or DOCX, not a scanned image.",
    };
  }

  const openAIKey = process.env.OPENAI_API_KEY;
  const openAIModel = process.env.OPENAI_MODEL || "gpt-5.2";
  const geminiKey = process.env.GEMINI_API_KEY;
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
          if (parsed.summary || parsed.roles.length > 0) {
            return { ...parsed, source: "text", warning: null };
          }
        }
      } catch (error) {
        console.warn("OpenAI resume extraction failed", error);
      }
    }

    if (provider === "gemini" && geminiKey) {
      for (const model of getGeminiResumeModelsToTry()) {
        try {
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
          if (parsed.summary || parsed.roles.length > 0) {
            return { ...parsed, source: "text", warning: null };
          }
        } catch (error) {
          console.warn(`Gemini resume extraction failed for ${model}`, error);
        }
      }
    }
  }

  return {
    ...fallback,
    source: "fallback",
    warning:
      "AI resume extraction was unavailable, so a basic summary was generated from extracted text.",
  };
}

async function generateResumeProfileFromFile(
  file: File,
  buffer: Buffer,
  filename: string,
): Promise<ResumeProfileResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return {
      summary: null,
      roles: [],
      source: "empty",
      warning:
        "No readable text could be extracted, and GEMINI_API_KEY is not configured for file-based resume analysis.",
    };
  }

  const mimeType = file.type || "application/pdf";
  const canUseGeminiFile =
    mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");

  if (!canUseGeminiFile) {
    return {
      summary: null,
      roles: [],
      source: "empty",
      warning:
        "No readable text could be extracted from this file. Try a text-based PDF or DOCX.",
    };
  }

  const prompt = `
You are a career coach and ATS expert.
Read the attached resume file and extract a concise candidate profile.

Goals:
- Capture the person's seniority, core strengths, domain(s), and strongest achievements.
- Mention concrete skills, tools, and measurable impact if present.
- Extract up to 8 job roles/titles the candidate has held or is clearly suited for.
- Prefer specific titles over broad departments.
- Do not invent roles that are not supported by the resume.
- Keep it readable, specific, and professional.
- Do not mention that this is a resume or that you are an AI.

Return ONLY valid JSON in this exact shape:
{"summary":"2-4 sentences","roles":["Role 1","Role 2"]}

Resume filename: ${filename}
`.trim();

  for (const model of getGeminiResumeModelsToTry()) {
    try {
      let aiRes = await callGeminiWithFile(
        model,
        geminiKey,
        prompt,
        mimeType,
        buffer,
      );
      if (aiRes.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        aiRes = await callGeminiWithFile(
          model,
          geminiKey,
          prompt,
          mimeType,
          buffer,
        );
      }

      if (!aiRes.ok) {
        if (aiRes.status === 404 || aiRes.status === 429) continue;
        break;
      }

      const aiData = (await aiRes.json()) as GeminiResponse;
      const text =
        aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      const parsed = parseResumeProfile(text, { summary: null, roles: [] });
      if (parsed.summary || parsed.roles.length > 0) {
        return { ...parsed, source: "gemini-file", warning: null };
      }
    } catch (error) {
      console.warn(`Gemini file resume extraction failed for ${model}`, error);
    }
  }

  return {
    summary: null,
    roles: [],
    source: "empty",
    warning:
      "The resume uploaded, but no readable text or profile details could be extracted. Try exporting the resume as a text-based PDF or DOCX.",
  };
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

    try {
      await uploadResumeFile(
        admin,
        filePath,
        buffer,
        file.type || "application/octet-stream",
      );
    } catch (uploadError) {
      return NextResponse.json(
        {
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Resume upload failed",
        },
        { status: 500 },
      );
    }

    const { data: urlData } = await admin.storage
      .from(RESUME_BUCKET)
      .getPublicUrl(filePath);
    const publicUrl = urlData?.publicUrl ?? null;

    let resumeText: string | null = null;
    try {
      resumeText = await extractResumeText(file, buffer, filename);
    } catch (error) {
      console.warn("resume extraction failed", error);
    }

    const resumeProfile = resumeText?.trim()
      ? await generateResumeProfile(resumeText, filename)
      : await generateResumeProfileFromFile(file, buffer, filename);

    console.log("[resume-upload] ownerId:", ownerId);
    console.log("[resume-upload] filename:", filename);
    console.log(
      "[resume-upload] resumeText length:",
      resumeText ? resumeText.length : 0,
    );
    console.log("[resume-upload] resumeSummary:", resumeProfile.summary);
    console.log("[resume-upload] resumeRoles:", resumeProfile.roles);
    console.log("[resume-upload] resumeProfileSource:", resumeProfile.source);
    if (resumeProfile.warning) {
      console.warn("[resume-upload] resumeProfileWarning:", resumeProfile.warning);
    }

    const profilePayload: Record<string, unknown> = {
      id: ownerId,
      user_id: ownerId,
      role: "candidate",
      resume_url: publicUrl,
      resume_text: resumeText,
      resume_summary: resumeProfile.summary,
      resume_roles: resumeProfile.roles,
    };
    const baseSelectColumns = [
      "resume_url",
      "resume_summary",
      "resume_roles",
      "target_roles",
    ];
    const profileWritePayload = { ...profilePayload };
    let profileSelectColumns = [...baseSelectColumns];
    let profile: Record<string, unknown> | null = null;
    let profileUpdateSucceeded = false;
    let resumeMetadataPersisted = true;
    let resumeUrlPersisted = true;
    let rolesPersisted = true;
    let warning: string | null = resumeProfile.warning;
    let lastProfileError: string | null = null;

    for (let attempt = 0; attempt <= PROFILE_COMPAT_COLUMNS.length; attempt += 1) {
      const selectColumns =
        profileSelectColumns.length > 0
          ? profileSelectColumns.join(", ")
          : "user_id";
      const { data, error } = await admin
        .from("profiles")
        .upsert(profileWritePayload, { onConflict: "user_id" })
        .select(selectColumns)
        .single();

      if (!error) {
        profile = (data ?? null) as unknown as Record<string, unknown> | null;
        profileUpdateSucceeded = true;
        break;
      }

      console.error(
        `[resume-upload] profile upsert attempt ${attempt + 1} error:`,
        error,
      );
      lastProfileError = getErrorMessage(error) || "Profile update failed";

      const missingColumns = getMissingProfileColumns(
        error,
        PROFILE_COMPAT_COLUMNS,
      );
      const missingUserIdColumn = isMissingProfileColumn(error, ["user_id"]);

      if (missingUserIdColumn) {
        return NextResponse.json(
          {
            error:
              "Database migration needed: profiles.user_id is missing. Run supabase/migrations/20260523090000_repair_profile_resume_columns.sql, then try the upload again.",
          },
          { status: 500 },
        );
      }

      if (missingColumns.length === 0) {
        return NextResponse.json(
          { error: getErrorMessage(error) || "Profile update failed" },
          { status: 500 },
        );
      }

      const missingResumeColumn = isMissingProfileColumn(
        error,
        PROFILE_RESUME_COLUMNS,
      );
      const missingRoleColumn = isMissingProfileColumn(
        error,
        PROFILE_ROLE_COLUMNS,
      );

      if (missingResumeColumn) {
        resumeMetadataPersisted = false;
        if (missingColumns.includes("resume_url")) {
          resumeUrlPersisted = false;
        }
        warning = PROFILE_CONTEXT_MIGRATION_MESSAGE;
      }

      if (missingRoleColumn) {
        rolesPersisted = false;
        warning = PROFILE_CONTEXT_MIGRATION_MESSAGE;
      }

      for (const column of missingColumns) {
        delete profileWritePayload[column];
      }

      profileSelectColumns = profileSelectColumns.filter(
        (column) => !missingColumns.includes(column),
      );

      if (
        !missingResumeColumn &&
        !missingRoleColumn &&
        !missingColumns.some((column) => column === "id" || column === "role")
      ) {
        return NextResponse.json(
          { error: getErrorMessage(error) || "Profile update failed" },
          { status: 500 },
        );
      }
    }

    if (!profileUpdateSucceeded) {
      resumeMetadataPersisted = false;
      resumeUrlPersisted = false;
      rolesPersisted = false;
      warning = lastProfileError
        ? `${PROFILE_CONTEXT_MIGRATION_MESSAGE} Last database error: ${lastProfileError}`
        : PROFILE_CONTEXT_MIGRATION_MESSAGE;
    }

    const responseProfile = {
      ...(profile ?? {}),
      resume_url:
        typeof profile?.resume_url === "string"
          ? profile.resume_url
          : publicUrl,
      resume_summary:
        typeof profile?.resume_summary === "string"
          ? profile.resume_summary
          : resumeProfile.summary,
      resume_roles: Array.isArray(profile?.resume_roles)
        ? profile.resume_roles
        : resumeProfile.roles,
      target_roles: Array.isArray(profile?.target_roles)
        ? profile.target_roles
        : [],
    };

    return NextResponse.json({
      publicUrl,
      resumeSummary: resumeProfile.summary,
      resumeRoles: resumeProfile.roles,
      resumeProfileSource: resumeProfile.source,
      resumeMetadataPersisted,
      resumeUrlPersisted,
      profilePersisted: profileUpdateSucceeded,
      rolesPersisted,
      warning,
      profile: responseProfile,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const adminConfig = createAdminClient();
    if (!adminConfig.admin || adminConfig.error) {
      return NextResponse.json(
        { error: adminConfig.error || "Missing Supabase config" },
        { status: adminConfig.status },
      );
    }

    const ownerResult = await getOwnerId(request);
    if (!ownerResult.ownerId) {
      return NextResponse.json(
        { error: ownerResult.error || "Unauthorized" },
        { status: ownerResult.status },
      );
    }

    const ownerId = ownerResult.ownerId;
    const admin = adminConfig.admin;

    let resumeUrl: string | null = null;
    const { data: profile, error: profileLoadError } = await admin
      .from("profiles")
      .select("resume_url")
      .eq("user_id", ownerId)
      .maybeSingle();

    if (profileLoadError) {
      if (!isMissingProfileColumn(profileLoadError, PROFILE_RESUME_COLUMNS)) {
        return NextResponse.json(
          {
            error:
              getErrorMessage(profileLoadError) ||
              "Failed to load resume profile",
          },
          { status: 500 },
        );
      }
    } else if (
      profile &&
      typeof (profile as { resume_url?: unknown }).resume_url === "string"
    ) {
      resumeUrl = (profile as { resume_url: string }).resume_url;
    }

    const resumePath = getResumeStoragePath(resumeUrl);
    if (resumePath) {
      const { error: removeError } = await admin.storage
        .from(RESUME_BUCKET)
        .remove([resumePath]);

      if (removeError) {
        return NextResponse.json(
          {
            error:
              getErrorMessage(removeError) ||
              "Failed to delete resume from storage",
          },
          { status: 500 },
        );
      }
    }

    const { profile: updatedProfile, error } =
      await upsertProfileWithCompatibility(
        admin,
        {
          id: ownerId,
          user_id: ownerId,
          role: "candidate",
          resume_url: null,
          resume_text: null,
          resume_summary: null,
          resume_roles: [],
        },
        ["resume_url", "resume_summary", "resume_roles", "target_roles"],
      );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        ...(updatedProfile ?? {}),
        resume_url: null,
        resume_summary: null,
        resume_roles: [],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const adminConfig = createAdminClient();
    if (!adminConfig.admin || adminConfig.error) {
      return NextResponse.json(
        { error: adminConfig.error || "Missing Supabase config" },
        { status: adminConfig.status },
      );
    }

    const ownerResult = await getOwnerId(request);
    if (!ownerResult.ownerId) {
      return NextResponse.json(
        { error: ownerResult.error || "Unauthorized" },
        { status: ownerResult.status },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      resumeRoles?: unknown;
      targetRoles?: unknown;
    };
    const resumeRoles = normalizeRoles(
      Array.isArray(body.resumeRoles) ? body.resumeRoles : [],
      12,
    );
    const targetRoles = normalizeRoles(
      Array.isArray(body.targetRoles) ? body.targetRoles : [],
      12,
    );

    const ownerId = ownerResult.ownerId;
    const { profile, error } = await upsertProfileWithCompatibility(
      adminConfig.admin,
      {
        id: ownerId,
        user_id: ownerId,
        role: "candidate",
        resume_roles: resumeRoles,
        target_roles: targetRoles,
      },
      ["resume_roles", "target_roles"],
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    if (
      !Array.isArray(profile?.resume_roles) ||
      !Array.isArray(profile?.target_roles)
    ) {
      return NextResponse.json(
        {
          error:
            "Database migration needed: profile role columns are missing. Run the latest profile resume/roles migration and try again.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      profile: {
        resume_roles: normalizeRoles(profile.resume_roles, 12),
        target_roles: normalizeRoles(profile.target_roles, 12),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
