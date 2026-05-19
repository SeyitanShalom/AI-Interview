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

function buildFallbackResumeSummary(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 300) + (cleaned.length > 300 ? "…" : "");
}

async function generateSemanticSummary(resumeText: string, filename: string) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const fallback = buildFallbackResumeSummary(resumeText);
  if (!geminiKey) return fallback;

  const trimmedText = resumeText.replace(/\s+/g, " ").trim();
  const snippet = trimmedText.slice(0, 12000);

  const prompt = `
You are a career coach and ATS expert.
Summarize this resume in 2-4 sentences with a strong semantic focus.

Goals:
- Capture the person's seniority, core strengths, domain(s), and strongest achievements.
- Mention concrete skills, tools, and measurable impact if present.
- Keep it readable, specific, and professional.
- Do not mention that this is a resume or that you are an AI.
- Avoid generic filler like "hard-working" unless supported by evidence.

Return ONLY valid JSON in this exact shape:
{"summary":"..."}

Resume filename: ${filename}
Resume text:
${snippet}
`.trim();

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
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as { summary?: string };
      const summary = parsed.summary?.trim();
      if (summary) return summary;
    } catch {
      const plain = cleaned.replace(/^summary\s*:\s*/i, "").trim();
      if (plain) return plain;
    }
  }

  return fallback;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    // Try to use cookie-based session first
    let ownerId: string | null = null;

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (!userErr && userData?.user) {
      ownerId = userData.user.id;
    }

    // If no cookie-based session, accept Authorization: Bearer <access_token>
    if (!ownerId) {
      const authHeader =
        request.headers.get("authorization") ||
        request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const token = authHeader.split(" ")[1];

      // Validate token by calling Supabase auth endpoint
      const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userResp.ok) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      const userJson = await userResp.json();
      ownerId = userJson?.id ?? null;
    }

    if (!ownerId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file") as any;
    if (!file)
      return NextResponse.json({ error: "Missing file" }, { status: 400 });

    const filename = file.name || `resume-${Date.now()}`;
    const filePath = `${ownerId}/resume-${Date.now()}-${filename}`;

    // Use service role key to perform the upload (server-side), but ensure ownerId comes from a validated token/cookie
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRole)
      return NextResponse.json(
        { error: "Service role key missing" },
        { status: 500 },
      );

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false },
    });

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("resumes")
      .upload(filePath, buffer, {
        contentType: file.type ?? "application/octet-stream",
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

    // Extract resume text depending on file type
    let resumeText: string | null = null;
    try {
      if (
        file.type === "application/pdf" ||
        filename.toLowerCase().endsWith(".pdf")
      ) {
        const parsed = await pdf(buffer);
        resumeText = parsed?.text ?? null;
      } else if (
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        filename.toLowerCase().endsWith(".docx") ||
        filename.toLowerCase().endsWith(".doc")
      ) {
        const result = await mammoth.extractRawText({ buffer });
        resumeText = result?.value ?? null;
      } else {
        // Fallback: try to treat file as text
        resumeText = buffer.toString("utf-8");
      }
    } catch (e) {
      // non-fatal: continue even if extraction fails
      console.warn("resume extraction failed", e);
      resumeText = null;
    }

    const resumeSummary = resumeText
      ? await generateSemanticSummary(resumeText, filename)
      : null;

    // Debug logging to trace why summaries may not persist or be empty
    console.log("[resume-upload] ownerId:", ownerId);
    console.log("[resume-upload] filename:", filename);
    console.log(
      "[resume-upload] resumeText length:",
      resumeText ? resumeText.length : 0,
    );
    console.log("[resume-upload] resumeSummary:", resumeSummary);

    const { data: upsertData, error: upsertError } = await admin
      .from("profiles")
      .upsert(
        {
          user_id: ownerId,
          resume_url: publicUrl,
          resume_text: resumeText,
          resume_summary: resumeSummary,
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error("[resume-upload] upsert error:", upsertError);
    } else {
      console.log("[resume-upload] upsert success:", upsertData?.[0]);
    }

    return NextResponse.json({
      publicUrl,
      resumeSummary,
      profile: upsertData?.[0] ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
