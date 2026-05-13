import React from "react";
import { createServerClient } from "@supabase/ssr";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function KitPage({ params }: PageProps) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration.");
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey);

  const { data: kit } = await supabase
    .from("interview_kits")
    .select("id, title, job_role, questions, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!kit) return notFound();

  const questions: string[] = Array.isArray(kit.questions)
    ? (kit.questions as string[])
    : typeof kit.questions === "string"
    ? JSON.parse(kit.questions || "[]")
    : [];

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
          <a
            href={`/candidate/dashboard?kit=${encodeURIComponent(kit.id)}`}
            className="inline-flex items-center px-4 py-2 rounded-md bg-linear-to-r from-primary to-primary-glow text-primary-foreground"
          >
            Open in Interview App
          </a>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-md border border-border/40 text-muted-foreground"
          >
            Return Home
          </a>
        </div>
      </div>
    </div>
  );
}
