import React from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SharedKit {
  id: string;
  title: string;
  job_role: string;
  questions: unknown;
  created_at: string;
}

function isMissingRpcError(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.message?.toLowerCase().includes("get_shared_interview_kit")
  );
}

function normalizeQuestions(rawQuestions: unknown) {
  if (Array.isArray(rawQuestions)) {
    return rawQuestions
      .map((question) => String(question).trim())
      .filter(Boolean);
  }

  if (typeof rawQuestions === "string") {
    try {
      const parsed = JSON.parse(rawQuestions) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((question) => String(question).trim())
          .filter(Boolean);
      }
    } catch {
      return rawQuestions.trim() ? [rawQuestions.trim()] : [];
    }
  }

  return [];
}

export default async function KitPage({ params }: PageProps) {
  const { id } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration.");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server components can read cookies, but may not always set them.
          }
        });
      },
    },
  });

  const { data: sharedKit, error: sharedKitError } = await supabase
    .rpc("get_shared_interview_kit", { kit_uuid: id })
    .maybeSingle();

  let kit = sharedKit as SharedKit | null;

  if (sharedKitError && isMissingRpcError(sharedKitError)) {
    const { data: fallbackKit } = await supabase
      .from("interview_kits")
      .select("id, title, job_role, questions, created_at")
      .eq("id", id)
      .maybeSingle();

    kit = fallbackKit as SharedKit | null;
  } else if (sharedKitError) {
    return notFound();
  }

  if (!kit) return notFound();

  const questions = normalizeQuestions(kit.questions);

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-display">{kit.title}</h1>
          <p className="text-sm text-muted-foreground">{kit.job_role}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Created {new Date(kit.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="space-y-4">
          {questions.length === 0 ? (
            <p className="text-muted-foreground">No questions in this kit.</p>
          ) : (
            questions.map((q, i) => (
              <div
                key={i}
                className="p-4 rounded-lg glass-card border-border/30"
              >
                <div className="text-sm font-mono text-primary">{i + 1}.</div>
                <p className="mt-1 text-foreground">{q}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Link
            href={`/candidate/dashboard?kit=${encodeURIComponent(kit.id)}`}
            className="inline-flex items-center px-4 py-2 rounded-md bg-linear-to-r from-primary to-primary-glow text-primary-foreground"
          >
            Open in Interview App
          </Link>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-md border border-border/40 text-muted-foreground"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
